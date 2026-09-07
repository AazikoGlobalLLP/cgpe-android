import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/data/api';
import { campaignOutcome } from '@/lib/campaignOutcome';
import { useAuth } from '@/store/auth';
import { useT } from '@/i18n';
import { resolveCopy, textCopy, type LocalCopy } from '@/i18n/copy';

/**
 * Background job runner. A campaign send keeps running even if the user navigates
 * away — they can choose to Monitor it or Continue working.
 *
 * NOTE on progress: the backend dispatches the whole audience to n8n in ONE call,
 * so true per-recipient acknowledgement isn't exposed. We therefore show the real
 * audience (names + personalised messages) and advance an *estimated* cursor while
 * the request is in flight, then reconcile with the backend's real sent count.
 */
export type JobLogLine = { at: number; text: string; textCopy?: LocalCopy; state: 'sent' | 'info' | 'error' };
export type Job = {
  id: string;
  label: string;
  labelCopy?: LocalCopy;
  type: 'renewal' | 'birthday' | 'anniversary' | 'maturity';
  status: 'running' | 'done' | 'failed';
  total: number;
  processed: number;
  sent: number;
  startedAt: number;
  finishedAt?: number;
  message?: string;
  messageCopy?: LocalCopy;
  /** The server refused the bulk send for this role. A terminal-but-not-failed outcome that
   *  every consumer (both campaign screens + the job monitor) must render as a warning, not
   *  as a failure and not as a 100% success. */
  needsRole?: boolean;
  log: JobLogLine[];
};

type Ctx = {
  jobs: Job[];
  activeJob: Job | null;
  startCampaign: (type: Job['type'], label: string, labelCopy?: LocalCopy) => Promise<string>;
  getJob: (id: string) => Job | undefined;
  clearFinished: () => void;
};

const JobsContext = createContext<Ctx>({} as Ctx);
export const useJobs = () => useContext(JobsContext);

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <OwnerJobsProvider key={user?.id ?? 'signed-out'} ownerId={user?.id ?? null}>{children}</OwnerJobsProvider>;
}

function OwnerJobsProvider({ children, ownerId }: { children: React.ReactNode; ownerId: string | null }) {
  const t = useT();
  const [jobs, setJobs] = useState<Job[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const currentTimers = timers.current;
    return () => {
      alive.current = false;
      Object.values(currentTimers).forEach(clearInterval);
    };
  }, []);

  const patch = useCallback((id: string, fn: (j: Job) => Job) => {
    if (!alive.current) return;
    setJobs((prev) => prev.map((j) => (j.id === id ? fn(j) : j)));
  }, []);

  const startCampaign = useCallback(async (type: Job['type'], label: string, labelCopy?: LocalCopy) => {
    if (!ownerId || !alive.current) return '';
    const id = 'job_' + Date.now();
    const job: Job = { id, label, labelCopy, type, status: 'running', total: 0, processed: 0, sent: 0, startedAt: Date.now(), log: [{ at: Date.now(), text: 'Building audience…', textCopy: textCopy('job.buildingAudience'), state: 'info' }] };
    setJobs((prev) => [job, ...prev].slice(0, 10));

    let total = 0;

    // RENEWALS: the backend campaign aggregation is scope-buggy for super_admin, so
    // scan the real 9,012-client book ourselves (fupDate within 30 days) — this IS
    // the background work, streaming live scan progress.
    if (type === 'renewal') {
      const recipients = await api.scanRenewals(30, (scanned, foundN, totalBook) => {
        patch(id, (j) => (j.status !== 'running' ? j : {
          ...j, total: foundN, processed: foundN,
          log: [...j.log.slice(-30), { at: Date.now(), text: `Scanned ${scanned.toLocaleString('en-IN')} / ${totalBook.toLocaleString('en-IN')} clients · ${foundN} due`, textCopy: textCopy('job.scanned', { scanned: scanned.toLocaleString('en-IN'), total: totalBook.toLocaleString('en-IN'), due: foundN }), state: 'sent' }],
        }));
      });
      if (!alive.current) return id;
      total = recipients.length;
      patch(id, (j) => ({ ...j, total, processed: total, log: [...j.log, { at: Date.now(), text: `${total} clients have a premium due in the next 30 days.`, textCopy: textCopy('job.premiumDue', { count: total }), state: 'info' }] }));
      if (total === 0) { patch(id, (j) => ({ ...j, status: 'done', finishedAt: Date.now(), message: 'No renewals due in the next 30 days.', messageCopy: textCopy('job.noRenewals') })); return id; }
      const res = await api.sendCampaign('renewal');
      if (!alive.current) return id;
      const out = campaignOutcome(res, total);
      patch(id, (j) => ({
        ...j, status: out.status, needsRole: out.needsRole, sent: out.sent, finishedAt: Date.now(),
        message: out.needsRole
          ? `${total} renewals found. This account can't bulk-send (needs an admin role). Open the list to send individually.`
          : (res.message || `Dispatched to ${total} client(s).`),
        messageCopy: out.needsRole ? textCopy('job.renewalRoleBlocked', { count: total }) : res.message ? res.messageCopy : textCopy('job.dispatchedTo', { count: total }),
        log: [...j.log, { at: Date.now(), text: out.needsRole ? out.logText : (res.message || 'Dispatched.'), textCopy: out.needsRole ? out.logCopy : res.message ? res.messageCopy : textCopy('job.dispatchedLog'), state: out.logState }],
      }));
      return id;
    }

    // Other campaign types: use the audience endpoint.
    const audience = await api.getCampaignAudience(type as any);
    if (!alive.current) return id;
    total = audience?.count ?? 0;
    const names = (audience?.sample || []).map((s) => s.name);
    patch(id, (j) => ({ ...j, total, log: [...j.log, { at: Date.now(), text: `Audience ready, ${total} recipient(s) with personalised messages.`, textCopy: textCopy('job.audienceReady', { count: total }), state: 'info' }] }));

    if (total === 0) {
      patch(id, (j) => ({ ...j, status: 'done', finishedAt: Date.now(), message: 'No matching clients right now.', messageCopy: textCopy('job.noMatches') }));
      return id;
    }

    // Fire the real send (does not block the UI)
    const sendPromise = api.sendCampaign(type as any);

    // 3) Advance an estimated cursor while the dispatch is in flight
    let i = 0;
    timers.current[id] = setInterval(() => {
      if (!alive.current) return;
      i = Math.min(total, i + Math.max(1, Math.round(total / 40)));
      const who = names[i % (names.length || 1)] || 'client';
      patch(id, (j) => (j.status !== 'running' ? j : {
        ...j,
        processed: i,
        log: [...j.log.slice(-40), { at: Date.now(), text: `Dispatching to ${who}…`, textCopy: textCopy('job.dispatchingTo', { name: who }, names[i % (names.length || 1)] ? undefined : { name: textCopy('task.clientLabel') }), state: 'sent' }],
      }));
      if (i >= total) { clearInterval(timers.current[id]); delete timers.current[id]; }
    }, 220);

    // 4) Reconcile with the backend's real result. A 403 role refusal is honoured here
    //    exactly as on the renewal path above: a completed job that delivered nothing, not a
    //    failure — `campaignOutcome` is the single rule both paths share.
    sendPromise.then((res) => {
      clearInterval(timers.current[id]); delete timers.current[id];
      if (!alive.current) return;
      const out = campaignOutcome(res, total);
      patch(id, (j) => ({
        ...j,
        status: out.status,
        needsRole: out.needsRole,
        processed: total,
        sent: out.sent,
        finishedAt: Date.now(),
        message: res.message,
        messageCopy: res.messageCopy,
        log: [...j.log, { at: Date.now(), text: out.logText, textCopy: out.logCopy, state: out.logState }],
      }));
    }).catch((e) => {
      clearInterval(timers.current[id]); delete timers.current[id];
      if (!alive.current) return;
      const copy = e?.message ? e.messageCopy : textCopy('api.sendFailed');
      patch(id, (j) => ({ ...j, status: 'failed', finishedAt: Date.now(), message: e?.message || 'Send failed', messageCopy: copy, log: [...j.log, { at: Date.now(), text: e?.message || 'Send failed', textCopy: copy, state: 'error' }] }));
    });

    return id;
  }, [patch, ownerId]);

  // Only the exposed view is translated. A language change cannot restart a dispatch.
  const displayedJobs = useMemo(() => jobs.map((job) => ({
    ...job, label: resolveCopy(t, job.label, job.labelCopy),
    message: job.message == null ? undefined : resolveCopy(t, job.message, job.messageCopy),
    log: job.log.map((line) => ({ ...line, text: resolveCopy(t, line.text, line.textCopy) })),
  })), [jobs, t]);

  const value: Ctx = {
    jobs: displayedJobs,
    activeJob: displayedJobs.find((j) => j.status === 'running') || null,
    startCampaign,
    getJob: (id) => displayedJobs.find((j) => j.id === id),
    clearFinished: () => setJobs((prev) => prev.filter((j) => j.status === 'running')),
  };

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}
