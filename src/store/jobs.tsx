import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import * as api from '@/data/api';

/**
 * Background job runner. A campaign send keeps running even if the user navigates
 * away — they can choose to Monitor it or Continue working.
 *
 * NOTE on progress: the backend dispatches the whole audience to n8n in ONE call,
 * so true per-recipient acknowledgement isn't exposed. We therefore show the real
 * audience (names + personalised messages) and advance an *estimated* cursor while
 * the request is in flight, then reconcile with the backend's real sent count.
 */
export type JobLogLine = { at: number; text: string; state: 'sent' | 'info' | 'error' };
export type Job = {
  id: string;
  label: string;
  type: 'renewal' | 'birthday' | 'anniversary' | 'maturity';
  status: 'running' | 'done' | 'failed';
  total: number;
  processed: number;
  sent: number;
  startedAt: number;
  finishedAt?: number;
  message?: string;
  log: JobLogLine[];
};

type Ctx = {
  jobs: Job[];
  activeJob: Job | null;
  startCampaign: (type: Job['type'], label: string) => Promise<string>;
  getJob: (id: string) => Job | undefined;
  clearFinished: () => void;
};

const JobsContext = createContext<Ctx>({} as Ctx);
export const useJobs = () => useContext(JobsContext);

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const timers = useRef<Record<string, any>>({});

  const patch = useCallback((id: string, fn: (j: Job) => Job) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? fn(j) : j)));
  }, []);

  const startCampaign = useCallback(async (type: Job['type'], label: string) => {
    const id = 'job_' + Date.now();
    const job: Job = { id, label, type, status: 'running', total: 0, processed: 0, sent: 0, startedAt: Date.now(), log: [{ at: Date.now(), text: 'Building audience…', state: 'info' }] };
    setJobs((prev) => [job, ...prev].slice(0, 10));

    let total = 0;
    let names: string[] = [];

    // RENEWALS: the backend campaign aggregation is scope-buggy for super_admin, so
    // scan the real 9,012-client book ourselves (fupDate within 30 days) — this IS
    // the background work, streaming live scan progress.
    if (type === 'renewal') {
      const recipients = await api.scanRenewals(30, (scanned, foundN, totalBook) => {
        patch(id, (j) => (j.status !== 'running' ? j : {
          ...j, total: foundN, processed: foundN,
          log: [...j.log.slice(-30), { at: Date.now(), text: `Scanned ${scanned.toLocaleString('en-IN')} / ${totalBook.toLocaleString('en-IN')} clients · ${foundN} due`, state: 'sent' }],
        }));
      });
      total = recipients.length;
      names = recipients.map((r) => r.name);
      patch(id, (j) => ({ ...j, total, processed: total, log: [...j.log, { at: Date.now(), text: `${total} clients have a premium due in the next 30 days.`, state: 'info' }] }));
      if (total === 0) { patch(id, (j) => ({ ...j, status: 'done', finishedAt: Date.now(), message: 'No renewals due in the next 30 days.' })); return id; }
      const res = await api.sendCampaign('renewal');
      patch(id, (j) => ({
        ...j, status: res.ok ? 'done' : (res.needsRole ? 'done' : 'failed'), sent: res.count || 0, finishedAt: Date.now(),
        message: res.needsRole
          ? `${total} renewals found. This account can't bulk-send (needs an admin role) — open the list to send individually.`
          : (res.message || `Dispatched to ${total} client(s).`),
        log: [...j.log, { at: Date.now(), text: res.needsRole ? 'Bulk send blocked for this role.' : (res.message || 'Dispatched.'), state: res.ok ? 'info' : 'error' }],
      }));
      return id;
    }

    // Other campaign types: use the audience endpoint.
    const audience = await api.getCampaignAudience(type as any);
    total = audience?.count ?? 0;
    names = (audience?.sample || []).map((s) => s.name);
    patch(id, (j) => ({ ...j, total, log: [...j.log, { at: Date.now(), text: `Audience ready — ${total} recipient(s) with personalised messages.`, state: 'info' }] }));

    if (total === 0) {
      patch(id, (j) => ({ ...j, status: 'done', finishedAt: Date.now(), message: 'No matching clients right now.' }));
      return id;
    }

    // Fire the real send (does not block the UI)
    const sendPromise = api.sendCampaign(type as any);

    // 3) Advance an estimated cursor while the dispatch is in flight
    let i = 0;
    timers.current[id] = setInterval(() => {
      i = Math.min(total, i + Math.max(1, Math.round(total / 40)));
      const who = names[i % (names.length || 1)] || 'client';
      patch(id, (j) => (j.status !== 'running' ? j : {
        ...j,
        processed: i,
        log: [...j.log.slice(-40), { at: Date.now(), text: `Dispatching to ${who}…`, state: 'sent' }],
      }));
      if (i >= total) { clearInterval(timers.current[id]); delete timers.current[id]; }
    }, 220);

    // 4) Reconcile with the backend's real result
    sendPromise.then((res) => {
      clearInterval(timers.current[id]); delete timers.current[id];
      patch(id, (j) => ({
        ...j,
        status: res.ok ? 'done' : 'failed',
        processed: total,
        sent: res.count || (res.ok ? total : 0),
        finishedAt: Date.now(),
        message: res.message,
        log: [...j.log, { at: Date.now(), text: res.message || (res.ok ? 'Campaign dispatched.' : 'Send failed.'), state: res.ok ? 'info' : 'error' }],
      }));
    }).catch((e) => {
      clearInterval(timers.current[id]); delete timers.current[id];
      patch(id, (j) => ({ ...j, status: 'failed', finishedAt: Date.now(), message: e?.message || 'Send failed', log: [...j.log, { at: Date.now(), text: e?.message || 'Send failed', state: 'error' }] }));
    });

    return id;
  }, [patch]);

  const value: Ctx = {
    jobs,
    activeJob: jobs.find((j) => j.status === 'running') || null,
    startCampaign,
    getJob: (id) => jobs.find((j) => j.id === id),
    clearFinished: () => setJobs((prev) => prev.filter((j) => j.status === 'running')),
  };

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}
