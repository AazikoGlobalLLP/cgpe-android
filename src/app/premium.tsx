import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/theme';
import { Card, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, Segmented } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, useToast } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { ListSection } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import { useConfirm } from '@/ui/Confirm';
import { useJobs } from '@/store/jobs';
import { useT } from '@/i18n';
import * as api from '@/data/api';
import type { Client } from '@/data/types';
import { isPremiumDueThisMonth, isBirthdayThisMonth, monthMatches } from '@/data/adapt';
import { renewalMessage, birthdayMessage, maturityMessage, anniversaryMessage } from '@/lib/messages';
import { whatsapp } from '@/lib/actions';

/* ------------------------------------------------------------------ *
 * Premium & greetings — four campaigns over one client book.
 *
 * WHAT THE SCREEN IS FOR: pick an occasion, see who it applies to, then either message one
 * person from the list or hand the whole audience to the background job runner. Those are
 * two different commitments and they are deliberately two different buttons, at two
 * different sizes, in two different places.
 *
 * RENEWALS ARE THE ODD ONE OUT, and the shape of this screen says so. The campaign
 * aggregate is scope-buggy for super_admin, so renewals are scanned live from the real
 * client book by the job itself. There is therefore no list to pre-load and no honest
 * count to show before the scan runs, which is why `count` is -1 for that tab and the hero
 * reads as an invitation to scan rather than as a figure. Showing an estimate there would
 * be inventing a number about real policyholders.
 *
 * SUCCESS IS REPORTED BY THE JOB, NOT BY THE BUTTON. `startCampaign` resolves as soon as a
 * job exists, which is not the same thing as a message reaching a policyholder: for the
 * three audience-backed occasions the dispatch is still in flight at that moment, and a
 * role-refused (403) send comes back as a FINISHED job that delivered nothing at all.
 * Firing `haptics.success` there told the advisor "sent" for a campaign that had not sent.
 * The tracked job is therefore watched to a terminal state, and only a job that reports real
 * deliveries earns `success`; nothing delivered earns `warn`, a failed job earns `error`.
 * `haptics.tap` still marks the moment of commit, which is what it is for.
 *
 * NO GRADIENT, NO FABRICATED TOTALS. The gradient is rationed to the clock-in ring and the
 * active tab indicator; the copy says what is actually true, which is "your whole client
 * book" rather than a hardcoded client count that is not read from anywhere.
 * ------------------------------------------------------------------ */

type Kind = 'renewal' | 'birthday' | 'maturity' | 'anniversary';
type Rec = { name: string; phone: string; message: string };
type Notice = { tone: FeedbackTone; title: string; message: string; jobId?: string };

/**
 * One occasion, one glyph, one tone. The soft/solid pair comes straight from the palette
 * rather than being alpha-mixed here, so both schemes stay correct without this screen
 * knowing anything about how the theme derives its washes.
 */
const KIND_META: Record<Kind, { icon: IconName; fg: (c: Palette) => string; bg: (c: Palette) => string }> = {
  renewal: { icon: 'refresh-circle', fg: (c) => c.warning, bg: (c) => c.warningSoft },
  birthday: { icon: 'gift', fg: (c) => c.accent, bg: (c) => c.accentSoft },
  maturity: { icon: 'cash', fg: (c) => c.info, bg: (c) => c.infoSoft },
  anniversary: { icon: 'heart', fg: (c) => c.danger, bg: (c) => c.dangerSoft },
};

const num = (n: number) => n.toLocaleString('en-IN');

/**
 * Job messages are authored in `store/jobs`, which is outside this phase's scope and writes
 * its copy with em-dashes. This app's user-visible strings do not use them, so a store
 * message surfaced verbatim in a Banner is normalised on the way through. The information
 * is preserved; only the punctuation changes.
 */
const plain = (s?: string): string => (s ? s.replace(/\s*—\s*/g, ', ').trim() : '');

function msgFor(kind: Kind, cl: Client): string {
  const p = cl.policies[0];
  const ctx = { name: cl.name, premium: p?.premium, sumAssured: p?.sumAssured, policyNo: p?.number, mode: p?.frequency, dueDate: p?.nextRenewal, dob: cl.dob, maturity: p?.maturityDate, since: Number(cl.since) || undefined };
  if (kind === 'birthday') return birthdayMessage(ctx);
  if (kind === 'maturity') return maturityMessage(ctx);
  if (kind === 'anniversary') return anniversaryMessage(ctx);
  return renewalMessage(ctx);
}

function matches(kind: Kind, cl: Client): boolean {
  if (kind === 'renewal') return isPremiumDueThisMonth(cl);
  if (kind === 'birthday') return isBirthdayThisMonth(cl);
  if (kind === 'maturity') return cl.segment.includes('maturity_soon');
  if (kind === 'anniversary') return monthMatches(cl.policies[0]?.startDate);
  return false;
}

/* ---------- loading ----------
 * Hero block plus three audience rows, in the real proportions. A centred spinner here
 * would drop the send button off screen and then push it back when the list arrives. */
function PremiumSkeleton() {
  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Skeleton width={46} height={46} radius={15} />
          <View style={{ flex: 1, gap: 9 }}>
            <Skeleton width="42%" height={28} />
            <Skeleton width="66%" height={12} />
          </View>
        </Row>
        <Skeleton width="100%" height={11} style={{ marginTop: spacing.lg }} />
        <Skeleton width="82%" height={11} style={{ marginTop: 7 }} />
        <Skeleton width="100%" height={48} radius={radius.md} style={{ marginTop: spacing.lg }} />
      </Card>

      <Card padded={false}>
        <View style={{ padding: spacing.lg, gap: spacing.xl }}>
          {[0, 1, 2].map((i) => (
            <Row key={i}>
              <Skeleton width={44} height={44} radius={17} />
              <View style={{ flex: 1, gap: 7 }}>
                <Skeleton width="54%" height={13} />
                <Skeleton width="38%" height={11} />
              </View>
              <Skeleton width={82} height={38} radius={radius.md} />
            </Row>
          ))}
        </View>
      </Card>
    </View>
  );
}

export default function Premium() {
  const c = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const router = useRouter();
  const { jobs, startCampaign } = useJobs();

  const [kind, setKind] = useState<Kind>('renewal');
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [more, setMore] = useState(0);
  const [list, setList] = useState<Rec[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  /** Latest read wins. Flicking between occasions must never land an older audience. */
  const reqId = useRef(0);

  /** The unmount guard. No state is written, and no route is pushed, once the screen is gone. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /**
   * Focus is tracked separately from mount. A campaign keeps running while the advisor works
   * on another screen, and buzzing their hand about a job they are not looking at is noise.
   * The Banner is still set either way, so the outcome is waiting when they come back.
   */
  const focused = useRef(true);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; };
  }, []));

  /**
   * Two cancellation tokens, because there are two different ways a read goes stale:
   * `isCurrent` retires a read whose focus pass has ended, `reqId` retires occasion B's
   * slower response so it cannot overwrite occasion C's. `alive` covers unmount.
   */
  const load = useCallback(async (k: Kind, isCurrent?: () => boolean) => {
    const my = ++reqId.current;
    const stale = () => !alive.current || my !== reqId.current || (isCurrent ? !isCurrent() : false);

    setLoading(true);
    // A dispatch outcome outlives an audience reload; a plain "nothing to send" refusal does not.
    setNotice((n) => (n && n.jobId ? n : null));

    // Renewals are scanned from the real client book by the background job
    // (the campaign aggregation is scope-buggy for super_admin), so this tab is a
    // call-to-action rather than a pre-loaded list.
    if (k === 'renewal') { setCount(-1); setList([]); setMore(0); setLoading(false); return; }

    const audience = await api.getCampaignAudience(k);
    if (stale()) return;

    if (audience && audience.count > 0) {
      setCount(audience.count);
      setMore(Math.max(0, audience.count - audience.sample.length));
      setList(audience.sample.map((s) => ({ name: s.name, phone: '+' + String(s.phone).replace(/\D/g, ''), message: s.message })));
    } else {
      const clients = await api.getClients();
      if (stale()) return;
      const m = clients.filter((cl) => matches(k, cl) && cl.phone);
      setCount(m.length);
      setMore(Math.max(0, m.length - 20));
      setList(m.slice(0, 20).map((cl) => ({ name: cl.name, phone: cl.phone, message: msgFor(k, cl) })));
    }
    setLoading(false);
  }, []);

  /* This focus effect is the ONLY caller. `kind` is in its dependency list, so changing the
   * occasion re-runs it and the cleanup retires the previous read. Calling load() from the
   * segment handler as well, which is what this screen used to do, fired every audience
   * request twice against a 9,000-row endpoint. */
  useFocusEffect(useCallback(() => {
    let current = true;
    void load(kind, () => current);
    return () => { current = false; };
  }, [load, kind]));

  const changeKind = (k: Kind) => {
    if (k === kind) return;
    haptics.select();
    setNotice(null);
    setKind(k);
  };

  /* ---------- what the job actually did ----------
   * `jobs` is live context state, so the tracked job is re-read on every store update. The
   * effect below is pure state-reading with no async work and no timer of its own, and the
   * reported set makes it fire exactly once per job, when that job reaches a terminal state. */
  const trackedJob = useMemo(
    () => (jobId ? jobs.find((j) => j.id === jobId) ?? null : null),
    [jobs, jobId],
  );
  const reported = useRef<Set<string>>(new Set());

  useEffect(() => {
    const j = trackedJob;
    if (!j || j.status === 'running') return;
    if (reported.current.has(j.id)) return;
    reported.current.add(j.id);

    // Checked FIRST, before 'failed': a 403 role refusal is a completed job that delivered
    // nothing, and the advisor's next move (message individually, or ask an admin) is entirely
    // different from a server failure. Reading `j.needsRole` — the typed flag the runner now
    // sets on both send paths — rather than the red "Dispatch failed" this screen used to show.
    if (j.needsRole) {
      if (focused.current) haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'Your role cannot send bulk campaigns',
        message: 'The server refused the bulk send for this account, so nothing was dispatched. Message clients one at a time from the list below, or ask an admin or team leader to run this campaign.',
        jobId: j.id,
      });
      return;
    }

    if (j.status === 'failed') {
      if (focused.current) haptics.error();
      setNotice({
        tone: 'danger',
        title: 'Dispatch failed',
        message: plain(j.message) || 'The send did not reach the server, so nothing was delivered. Try again, or message clients one at a time from the list.',
        jobId: j.id,
      });
      return;
    }

    if (j.total === 0) {
      if (focused.current) haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'Nothing to send',
        message: plain(j.message) || 'No client matched this occasion, so nothing was dispatched.',
        jobId: j.id,
      });
      return;
    }

    if (j.sent > 0) {
      // The one confirmed dispatch on this screen, and the one place success is earned.
      if (focused.current) haptics.success();
      setNotice({
        tone: 'success',
        title: `Dispatched to ${num(j.sent)} client(s)`,
        message: plain(j.message) || 'The server confirmed the campaign was handed to the sender.',
        jobId: j.id,
      });
      return;
    }

    // Finished, but not one delivery was confirmed — and NOT a role refusal (that is caught
    // above). The server found recipients but acknowledged no delivery.
    if (focused.current) haptics.warn();
    setNotice({
      tone: 'warning',
      title: 'Nothing was confirmed sent',
      message: plain(j.message) || `${num(j.total)} recipient(s) were found, but the server did not confirm a single delivery. Send them one at a time from the list below.`,
      jobId: j.id,
    });
  }, [trackedJob]);

  const meta = KIND_META[kind];
  const title = kind === 'renewal' ? t('premium.dueThisMonth')
    : kind === 'birthday' ? t('premium.birthdaysThisMonth')
    : kind === 'maturity' ? t('premium.maturitySoon')
    : t('premium.anniversaries');
  const isScan = count < 0;

  const openJob = useCallback(
    (id: string) => router.push({ pathname: '/job/[id]', params: { id } }),
    [router],
  );

  /* ---------- the bulk commitment ---------- */
  const sendAll = useCallback(async () => {
    if (sending) return;

    if (!isScan && count <= 0) {
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'Nothing to send',
        message: 'No client matches this occasion right now, so there is nobody to message.',
      });
      return;
    }

    const ok = await confirm({
      title: isScan ? 'Find and send renewal reminders?' : `Send to ${num(count)} client(s)?`,
      message: isScan
        ? 'Your whole client book is scanned for premiums due in the next 30 days, and each of those clients is sent a personalised WhatsApp. It runs in the background, so you can keep working.'
        : `A personalised WhatsApp will be sent to all ${num(count)} matching client(s). This runs in the background.`,
      confirmText: isScan ? 'Scan and send' : 'Start sending',
      icon: meta.icon,
    });
    if (!alive.current || !ok) return;

    haptics.tap();
    setNotice(null);
    setSending(true);

    const id = await startCampaign(kind, title);
    if (!alive.current) return;
    setSending(false);
    setJobId(id);

    /* The handoff, kept intact. The copy claims no stage on purpose: a renewal scan can
     * already have finished by the time this dialog is answered, and "Sending started" would
     * then be describing something that had stopped. */
    const monitor = await confirm({
      title: 'Campaign handed off',
      message: isScan
        ? 'Your client book is being scanned and renewal reminders dispatched in the background. Watch the progress, or keep working?'
        : 'The messages are being dispatched in the background. Watch the progress, or keep working?',
      confirmText: 'Monitor progress',
      cancelText: 'Continue working',
      icon: 'paper-plane',
    });
    if (!alive.current) return;
    if (monitor) openJob(id);
    else toast('Running in the background. Tap the progress bar to monitor.', 'info');
  }, [sending, isScan, count, confirm, meta.icon, startCampaign, kind, title, openJob, toast]);

  /* ---------- the single commitment ---------- */
  const sendOne = (r: Rec) => {
    haptics.tap();
    whatsapp(r.phone, r.message);
  };

  const bulkLabel = sending ? 'Starting'
    : isScan ? 'Find and send renewals'
    : `${t('premium.sendAll')} (${num(count)})`;

  return (
    <Screen>
      <Header title={t('premium.title')} subtitle="Personalised WhatsApp campaigns" back />

      {/* Kept outside the loading branch so the occasion can be changed while an
          audience is still being fetched. */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.xs }}>
          <Segmented<Kind>
            options={[
              { key: 'renewal', label: t('premium.renewalDue') },
              { key: 'birthday', label: t('act.birthdays') },
              { key: 'maturity', label: t('premium.maturitySoon') },
              { key: 'anniversary', label: t('premium.anniversaries') },
            ]}
            value={kind}
            onChange={changeKind}
          />
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg, paddingTop: 4,
          paddingBottom: insets.bottom + 48, gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <PremiumSkeleton /> : (
          <>
            {/* HERO — who this occasion reaches, and the one button that reaches them. */}
            <Appear>
              <Card>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 15, backgroundColor: meta.bg(c),
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={meta.icon} size={23} color={meta.fg(c)} />
                  </View>

                  <View style={{ flex: 1 }}>
                    {isScan ? (
                      <Txt size={font.h2} weight="800" numberOfLines={1}>Scan the book</Txt>
                    ) : (
                      <Metric value={num(count)} size={font.display} />
                    )}
                    <Txt size={font.sub} color={c.muted} numberOfLines={2} style={{ marginTop: 2 }}>
                      {isScan ? 'Premiums falling due in the next 30 days' : title}
                    </Txt>
                  </View>

                  {/* No count pill here. The Metric to the left already IS the count, and
                      a badge repeating it is decoration wearing a data component's clothes. */}
                </Row>

                <Txt size={font.cap} color={c.muted} style={{ marginTop: 14, lineHeight: 18 }}>
                  {isScan
                    ? 'Your whole client book is read live, then each client with a premium due is sent a personalised reminder on WhatsApp. It runs in the background.'
                    : t('premium.oneClick')}
                </Txt>

                <Button
                  full
                  size="lg"
                  variant={isScan ? 'primary' : 'whatsapp'}
                  icon={isScan ? 'search' : 'logo-whatsapp'}
                  label={bulkLabel}
                  loading={sending}
                  disabled={!isScan && count === 0}
                  onPress={sendAll}
                  style={{ marginTop: spacing.lg }}
                />
              </Card>
            </Appear>

            {/* What the last dispatch actually did, in the content flow rather than as a
                toast: a refusal is a condition the advisor has to act on, not a passing note. */}
            {notice ? (
              <Banner
                tone={notice.tone}
                title={notice.title}
                message={notice.message}
                action={notice.jobId ? { label: 'Monitor progress', onPress: () => openJob(notice.jobId!) } : undefined}
                onDismiss={() => setNotice(null)}
              />
            ) : null}

            {list.length === 0 ? (
              <Card>
                {isScan ? (
                  <EmptyState
                    icon="sync-circle"
                    title="Scan on demand"
                    subtitle="Renewals are read live from your full client book rather than cached, so there is nothing to list until a scan runs."
                    action={{ label: 'Find and send renewals', onPress: sendAll }}
                  />
                ) : count > 0 ? (
                  /* Counted, but not named. The figure is the server's so it stays on the
                     hero, and filling this space with rows would be inventing policyholders. */
                  <EmptyState
                    icon="eye-off-outline"
                    title={`${num(count)} matched, none listed`}
                    subtitle="The server counted this audience but sent back no sample rows, so there are no names to show. The send button above still reaches every one of them."
                    action={{ label: 'Reload the sample', onPress: () => void load(kind) }}
                  />
                ) : health.degraded ? (
                  <EmptyState
                    icon="cloud-offline"
                    title="Audience did not load"
                    subtitle="The server could not be reached, so this is not a confirmed empty list. Try the request again in a moment."
                    action={{ label: 'Try again', onPress: () => void load(kind) }}
                  />
                ) : (
                  <EmptyState
                    icon="checkmark-done-circle"
                    title="Nothing due"
                    subtitle="No client on your book matches this occasion this month."
                  />
                )}
              </Card>
            ) : (
              <ListSection
                title="Audience sample"
                footer={more > 0
                  ? `Plus ${num(more)} more client(s). Use the send button above to reach every one of them.`
                  : 'Every matching client is listed here.'}
              >
                {list.map((r, i) => (
                  <Appear key={`${r.phone}-${i}`} index={i}>
                    <View style={{ paddingHorizontal: spacing.lg }}>
                      <PersonRow
                        name={r.name}
                        subtitle={r.phone}
                        subtitleIcon="call-outline"
                        subtitleNumeric
                        right={
                          <Button
                            size="sm"
                            variant="whatsapp"
                            icon="logo-whatsapp"
                            label={t('common.send')}
                            onPress={() => sendOne(r)}
                          />
                        }
                      />
                    </View>
                  </Appear>
                ))}
              </ListSection>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
