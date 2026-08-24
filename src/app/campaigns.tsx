import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, Segmented } from '@/ui/controls';
import { Banner, EmptyState, Meter, Skeleton, useToast } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { KpiStrip, ListSection } from '@/ui/data';
import type { KpiItem, Tone } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import { useConfirm } from '@/ui/Confirm';
import { useJobs } from '@/store/jobs';
import * as api from '@/data/api';
import type { CampaignSummary } from '@/data/api';
import { whatsapp } from '@/lib/actions';

/* ------------------------------------------------------------------ *
 * Campaigns console — the buckets, the audience, and the one commitment.
 *
 * THE API FOR THIS HAS BEEN WIRED FOR MONTHS WITH NO SCREEN ON IT. Three endpoints do the
 * work and each answers a different question, so the screen is laid out in that order:
 *
 *   /campaigns/summary   what does my book look like right now?   -> KpiStrip
 *   /campaigns/audience  who exactly would this occasion reach?   -> the sample list
 *   /campaigns/send      commit, to real policyholders            -> the one solid button
 *
 * THE PREVIEW IS A SAMPLE AND SAYS SO, EVERYWHERE. The audience endpoint returns a count
 * plus up to EIGHT personalised recipients. Rendering those eight under a heading like
 * "Recipients" would read as the whole list, and an advisor who scanned eight names and
 * pressed send would be dispatching to hundreds. Every piece of copy here therefore
 * separates the two numbers: the figure in the hero is the real audience, the rows below
 * are a sample of it, and the footer names the gap between them.
 *
 * THE MESSAGE BODY IS SHOWN, not just the name. This is the one thing the screen exists to
 * let you check: the greeting engine personalises per recipient (name, premium, due date),
 * and a bulk send you cannot read before committing is a bulk send you should not make.
 *
 * RENEWALS RE-SCAN ON SEND. `store/jobs` scans the live client book for renewals instead of
 * trusting the aggregate (which is scope-buggy for super_admin), so the preview count and
 * the sent count can legitimately differ for that one occasion. The copy says that rather
 * than quietly showing two different numbers.
 *
 * SENDING IS HANDED TO THE BACKGROUND RUNNER, exactly as premium.tsx does it: the button
 * resolves when a JOB EXISTS, which is not the same as a message reaching anybody. Success
 * is therefore reported by watching the job to a terminal state, and a 403 role refusal
 * gets its own Banner rather than being flattened into "send failed" - the advisor's next
 * move is completely different in that case (message individually, or ask an admin).
 *
 * No gradient. It is rationed to the clock-in ring and the active tab indicator.
 * ------------------------------------------------------------------ */

type Kind = 'renewal' | 'birthday' | 'maturity' | 'anniversary';
type Rec = { name: string; phone: string; message: string };
type Audience = Awaited<ReturnType<typeof api.getCampaignAudience>>;
type Notice = { tone: FeedbackTone; title: string; message: string; jobId?: string };

const KIND_META: Record<Kind, {
  icon: IconName;
  tone: Tone;
  fg: (c: Palette) => string;
  bg: (c: Palette) => string;
  /** What the audience actually is, in the advisor's words. */
  audience: string;
}> = {
  renewal: {
    icon: 'refresh-circle', tone: 'warning',
    fg: (c) => c.warning, bg: (c) => c.warningSoft,
    audience: 'Clients with a premium falling due',
  },
  birthday: {
    icon: 'gift', tone: 'accent',
    fg: (c) => c.accent, bg: (c) => c.accentSoft,
    audience: 'Clients with a birthday this month',
  },
  maturity: {
    icon: 'cash', tone: 'info',
    fg: (c) => c.info, bg: (c) => c.infoSoft,
    audience: 'Clients with a policy maturing soon',
  },
  anniversary: {
    icon: 'heart', tone: 'danger',
    fg: (c) => c.danger, bg: (c) => c.dangerSoft,
    audience: 'Clients whose policy anniversary falls this month',
  },
};

const KIND_LABEL: Record<Kind, string> = {
  renewal: 'Renewals',
  birthday: 'Birthdays',
  maturity: 'Maturity',
  anniversary: 'Anniversary',
};

const num = (n: number) => n.toLocaleString('en-IN');
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * `store/jobs` is outside this phase's scope and writes its copy with em-dashes. This app's
 * user-visible strings do not use them, so a store message surfaced in a Banner is
 * normalised on the way through. Information preserved, punctuation changed.
 */
const plain = (s?: string): string => (s ? s.replace(/\s*—\s*/g, ', ').trim() : '');

/**
 * A 403 from `/campaigns/send` reaches this screen only as job text, because the handoff
 * goes through the runner rather than calling `sendCampaign` directly (calling both would
 * dispatch twice). Both of the runner's role-refusal strings are matched here: the renewal
 * branch writes "needs an admin role", every other type surfaces the API's own
 * "Only admin/leader can send bulk campaigns."
 */
const ROLE_REFUSED = /admin\s*\/\s*leader|admin role|bulk[\s-]?send/i;

/** Digits only, then a leading +, so the WhatsApp deep link is always well formed. */
const waPhone = (raw: string) => '+' + String(raw ?? '').replace(/\D/g, '');

/* ================================================================== *
 * Loading — the real layout, held
 * ================================================================== */

function CampaignSkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      {/* KPI strip */}
      <View style={{ gap: spacing.sm }}>
        <Skeleton width={128} height={10} />
        <Row style={{ gap: spacing.sm }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} width={118} height={58} radius={radius.md} />)}
        </Row>
      </View>

      {/* Hero */}
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Skeleton width={46} height={46} radius={15} />
          <View style={{ flex: 1, gap: 9 }}>
            <Skeleton width="44%" height={28} />
            <Skeleton width="70%" height={12} />
          </View>
        </Row>
        <Skeleton width="100%" height={11} style={{ marginTop: spacing.lg }} />
        <Skeleton width="78%" height={11} style={{ marginTop: 7 }} />
        <Skeleton width="100%" height={54} radius={radius.md} style={{ marginTop: spacing.lg }} />
      </Card>

      {/* Sample rows, with their message blocks */}
      <Card padded={false}>
        <View style={{ padding: spacing.lg, gap: spacing.xl }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ gap: spacing.md }}>
              <Row>
                <Skeleton width={44} height={44} radius={17} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton width="52%" height={13} />
                  <Skeleton width="36%" height={11} />
                </View>
                <Skeleton width={76} height={38} radius={radius.md} />
              </Row>
              <View style={{ backgroundColor: c.cardAlt, borderRadius: radius.md, padding: spacing.md, gap: 7 }}>
                <Skeleton width="100%" height={9} />
                <Skeleton width="88%" height={9} />
                <Skeleton width="54%" height={9} />
              </View>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

/* ================================================================== *
 * One sampled recipient, message and all
 * ================================================================== */

const MSG_CLAMP = 4;

function SampleRow({ rec, index, onSend }: { rec: Rec; index: number; onSend: (r: Rec) => void }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Appear index={index}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
        <PersonRow
          name={rec.name}
          subtitle={rec.phone || 'No number on record'}
          subtitleIcon={rec.phone ? 'call-outline' : 'alert-circle-outline'}
          subtitleNumeric
          right={
            <Button
              size="sm"
              variant="whatsapp"
              icon="logo-whatsapp"
              label="Send"
              disabled={!rec.phone}
              onPress={() => onSend(rec)}
            />
          }
        />

        {rec.message ? (
          <View style={{
            marginTop: 6, marginLeft: 2,
            backgroundColor: c.cardAlt, borderRadius: radius.md,
            borderLeftWidth: 3, borderLeftColor: c.whatsapp,
            paddingVertical: spacing.md, paddingHorizontal: spacing.md,
          }}>
            <Txt
              size={font.cap}
              color={c.muted}
              numberOfLines={open ? undefined : MSG_CLAMP}
              style={{ lineHeight: 18 }}
            >
              {rec.message}
            </Txt>
            {/* 5pt of padding either side of a 13pt line plus 14pt of slop clears the 44pt
                floor without the link looking like a button. */}
            <Pressable
              onPress={() => setOpen((v) => !v)}
              hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={open ? `Collapse the message to ${rec.name}` : `Read the full message to ${rec.name}`}
              style={({ pressed }) => [{
                marginTop: 2, paddingVertical: 5, alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1,
              }]}
            >
              <Txt size={font.tiny} weight="700" color={c.primary}>
                {open ? 'Show less' : 'Read the full message'}
              </Txt>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Appear>
  );
}

/* ================================================================== *
 * Screen
 * ================================================================== */

export default function Campaigns() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const router = useRouter();
  const { jobs, startCampaign } = useJobs();

  const [kind, setKind] = useState<Kind>('renewal');
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [audience, setAudience] = useState<Audience>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
   * Focus is tracked separately from mount: a campaign keeps running while the advisor works
   * elsewhere, and buzzing their hand about a job they are not looking at is noise. The
   * Banner is set either way, so the outcome is waiting when they come back.
   */
  const focused = useRef(true);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; };
  }, []));

  /* ---------- book summary ---------- */
  const loadSummary = useCallback(async () => {
    const s = await api.getCampaignSummary();
    if (!alive.current) return;
    setSummary(s);
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  /* ---------- audience for the selected occasion ----------
   * Two cancellation tokens, because a read goes stale two different ways: `isCurrent`
   * retires a read whose focus pass has ended, `reqId` retires occasion B's slower response
   * so it cannot overwrite occasion C's. `alive` covers unmount.
   *
   * `quiet` exists for pull-to-refresh: swapping the loaded audience for a skeleton under
   * the user's own finger is a layout jump, not a progress report. The RefreshControl
   * spinner is the only signal that gesture needs. */
  const loadAudience = useCallback(async (k: Kind, isCurrent?: () => boolean, quiet = false) => {
    const my = ++reqId.current;
    const stale = () => !alive.current || my !== reqId.current || (isCurrent ? !isCurrent() : false);

    if (!quiet) setLoading(true);
    // A dispatch outcome outlives an audience reload; a plain refusal notice does not.
    setNotice((n) => (n && n.jobId ? n : null));

    const a = await api.getCampaignAudience(k);
    if (stale()) return;
    setAudience(a);
    setLoading(false);
  }, []);

  /* The ONLY caller. `kind` is in the dependency list, so changing the occasion re-runs it
   * and the cleanup retires the previous read. Calling loadAudience() from the segment
   * handler as well would fire every request twice against a 9,000-row endpoint. */
  useFocusEffect(useCallback(() => {
    let current = true;
    void loadAudience(kind, () => current);
    return () => { current = false; };
  }, [loadAudience, kind]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSummary(), loadAudience(kind, undefined, true)]);
    if (!alive.current) return;
    setRefreshing(false);
  }, [loadSummary, loadAudience, kind]);

  const changeKind = useCallback((k: Kind) => {
    if (k === kind) return;
    haptics.select();
    setNotice(null);
    setKind(k);
  }, [kind]);

  /* ---------- what the job actually did ----------
   * `jobs` is live context state, so the tracked job is re-read on every store update. This
   * effect is pure state-reading with no async work and no timer of its own, and the
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

    // Checked FIRST: a role refusal is a completed job that delivered nothing, and the
    // advisor's next move (message individually, or ask an admin) is entirely different from a
    // server failure. The runner now sets a typed `j.needsRole` flag on both send paths, so
    // that is the primary signal; the `ROLE_REFUSED` phrase match is kept as a defensive
    // fallback for any message that arrives without the flag.
    //
    // `j.sent === 0` guards the fallback only: the phrase match alone would misread a genuine
    // success whose server message happened to say "bulk send", and telling someone their
    // campaign was refused after it went out is the worse error. The flag needs no such guard.
    if (j.needsRole || (j.sent === 0 && ROLE_REFUSED.test(j.message ?? ''))) {
      if (focused.current) haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'Your role cannot send bulk campaigns',
        message: 'The server refused the bulk send for this account. Nothing was dispatched. Message clients one at a time from the sample below, or ask an admin or team leader to run this campaign.',
        jobId: j.id,
      });
      return;
    }

    if (j.status === 'failed') {
      if (focused.current) haptics.error();
      setNotice({
        tone: 'danger',
        title: 'Dispatch failed',
        message: plain(j.message) || 'The send did not reach the server, so nothing was delivered. Try again, or message clients one at a time from the sample below.',
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
        title: `Dispatched to ${num(j.sent)} ${plural(j.sent, 'client', 'clients')}`,
        message: plain(j.message) || 'The server confirmed the campaign was handed to the sender.',
        jobId: j.id,
      });
      return;
    }

    // Finished, but not one delivery confirmed.
    if (focused.current) haptics.warn();
    setNotice({
      tone: 'warning',
      title: 'Nothing was confirmed sent',
      message: plain(j.message) || `${num(j.total)} ${plural(j.total, 'recipient was', 'recipients were')} found, but the server did not confirm a single delivery. Send them one at a time from the sample below.`,
      jobId: j.id,
    });
  }, [trackedJob]);

  /* ---------- derived ---------- */
  const meta = KIND_META[kind];
  const count = audience?.count ?? 0;
  const sample: Rec[] = useMemo(
    () => (audience?.sample ?? []).map((s) => ({
      name: s.name || 'Unnamed client',
      phone: waPhone(s.phone),
      message: s.message || '',
    })),
    [audience],
  );
  const hidden = Math.max(0, count - sample.length);

  const running = trackedJob?.status === 'running';
  const jobTotal = trackedJob?.total ?? 0;
  const jobProcessed = trackedJob?.processed ?? 0;
  // useCountUp earns its place here and nowhere else on this screen: a dispatch cursor that
  // jumps is unreadable, and the CHANGE is the whole information.
  const processedShown = useCountUp(jobProcessed);

  const kpis: KpiItem[] = useMemo(() => {
    if (!summary) return [];
    const pick = (k: Kind) => () => changeKind(k);
    return [
      { label: 'Renewals due', value: num(summary.renewal_due), tone: 'warning', icon: 'refresh-circle', onPress: pick('renewal') },
      { label: 'Birthdays', value: num(summary.birthday_month), tone: 'accent', icon: 'gift', onPress: pick('birthday') },
      { label: 'Maturity soon', value: num(summary.maturity_soon), tone: 'info', icon: 'cash', onPress: pick('maturity') },
      { label: 'Anniversaries', value: num(summary.anniversary_month), tone: 'danger', icon: 'heart', onPress: pick('anniversary') },
      { label: 'Reachable', value: num(summary.opted_in), tone: 'success', icon: 'logo-whatsapp' },
      { label: 'In the book', value: num(summary.total_clients), tone: 'neutral', icon: 'people' },
    ];
  }, [summary, changeKind]);

  const reachShare = summary && summary.total_clients > 0
    ? summary.opted_in / summary.total_clients
    : null;

  const openJob = useCallback(
    (id: string) => router.push({ pathname: '/job/[id]', params: { id } }),
    [router],
  );

  /* ---------- the bulk commitment ---------- */
  const sendAll = useCallback(async () => {
    if (sending) return;

    if (count <= 0) {
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'Nothing to send',
        message: 'No client matches this occasion right now, so there is nobody to message.',
      });
      return;
    }

    const ok = await confirm({
      title: `Send to ${num(count)} ${plural(count, 'client', 'clients')}?`,
      message: kind === 'renewal'
        ? `Your whole client book is re-scanned when this runs, so the final count can differ a little from ${num(count)}. Every client with a premium due gets a personalised WhatsApp. This messages real policyholders.`
        : `A personalised WhatsApp goes to all ${num(count)} matching ${plural(count, 'client', 'clients')}, not just the ones sampled below. This messages real policyholders and cannot be recalled.`,
      confirmText: 'Start sending',
      icon: meta.icon,
    });
    if (!alive.current || !ok) return;

    haptics.tap();
    setNotice(null);
    setSending(true);

    const id = await startCampaign(kind, `${KIND_LABEL[kind]} campaign`);
    if (!alive.current) return;
    setSending(false);
    setJobId(id);

    /* The handoff, matched to premium.tsx. The copy claims no stage on purpose: a renewal
     * scan can already have finished by the time this dialog is answered, and "Sending
     * started" would then be describing something that had stopped. */
    const monitor = await confirm({
      title: 'Campaign handed off',
      message: kind === 'renewal'
        ? 'Your client book is being scanned and renewal reminders dispatched in the background. Watch the progress, or keep working?'
        : 'The messages are being dispatched in the background. Watch the progress, or keep working?',
      confirmText: 'Monitor progress',
      cancelText: 'Continue working',
      icon: 'paper-plane',
    });
    if (!alive.current) return;
    if (monitor) openJob(id);
    else toast('Running in the background. Tap the progress bar to monitor.', 'info');
  }, [sending, count, confirm, kind, meta.icon, startCampaign, openJob, toast]);

  /* ---------- the single commitment ---------- */
  const sendOne = useCallback((r: Rec) => {
    if (!r.phone) return;
    haptics.tap();
    whatsapp(r.phone, r.message);
  }, []);

  /* ---------- empty copy: three genuinely different states ---------- */
  const emptyBlock = count > 0 ? (
    /* Counted, but not named. The figure is the server's so it stays in the hero, and
       filling this space with rows would be inventing policyholders. */
    <EmptyState
      icon="eye-off-outline"
      title={`${num(count)} matched, none sampled`}
      subtitle="The server counted this audience but returned no sample rows, so there are no names or messages to check. The send button above still reaches every one of them."
      action={{ label: 'Reload the sample', onPress: () => void loadAudience(kind) }}
    />
  ) : health.degraded ? (
    <EmptyState
      icon="cloud-offline-outline"
      title="The audience did not load"
      subtitle="The server did not answer, so this is not a confirmed empty audience. Check your connection and try the request again."
      action={{ label: 'Try again', onPress: () => void loadAudience(kind) }}
    />
  ) : (
    <EmptyState
      icon="checkmark-done-circle-outline"
      title="Nobody is due for this"
      subtitle={`${meta.audience} would appear here. Nobody on your book qualifies right now, so there is nothing to send.`}
      action={{ label: 'Pick another occasion', onPress: () => changeKind(kind === 'renewal' ? 'birthday' : 'renewal') }}
    />
  );

  return (
    <Screen>
      <Header title="Campaigns" subtitle="Bulk WhatsApp outreach" back />

      {/* Kept outside the loading branch so the occasion can be changed while an audience
          is still in flight. */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.xs }}>
          <Segmented<Kind>
            options={[
              { key: 'renewal', label: KIND_LABEL.renewal },
              { key: 'birthday', label: KIND_LABEL.birthday },
              { key: 'maturity', label: KIND_LABEL.maturity },
              { key: 'anniversary', label: KIND_LABEL.anniversary },
            ]}
            value={kind}
            onChange={changeKind}
          />
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg, paddingTop: 4,
          paddingBottom: insets.bottom + 56, gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void refresh(); }}
            tintColor={c.primary}
            colors={[c.primary]}
            progressBackgroundColor={c.card}
          />
        }
      >
        {loading ? <CampaignSkeleton /> : (
          <>
            {/* CONTEXT — the buckets, tappable straight through to their occasion. */}
            {kpis.length > 0 ? (
              <Appear>
                <View style={{ gap: spacing.sm }}>
                  <Eyebrow style={{ marginLeft: spacing.xs }}>Your book right now</Eyebrow>
                  {/* Cancels the screen gutter so the strip bleeds to the edge and reads as
                      scrollable, then re-adds it inside. */}
                  <KpiStrip
                    items={kpis}
                    style={{ marginHorizontal: -spacing.lg }}
                    contentStyle={{ paddingHorizontal: spacing.lg }}
                  />
                </View>
              </Appear>
            ) : null}

            {/* ACTION — who this occasion reaches, and the one button that reaches them. */}
            <Appear index={1}>
              <Card>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 15, backgroundColor: meta.bg(c),
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={meta.icon} size={23} color={meta.fg(c)} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Metric value={num(count)} size={font.display} />
                    <Txt size={font.sub} color={c.muted} numberOfLines={2} style={{ marginTop: 2 }}>
                      {meta.audience}
                    </Txt>
                  </View>
                </Row>

                <Txt size={font.cap} color={c.muted} style={{ marginTop: 14, lineHeight: 18 }}>
                  {kind === 'renewal'
                    ? 'Each client gets their own reminder with their premium, policy number and due date. The book is re-scanned live when you send, so the final count can differ slightly from the figure above.'
                    : 'Each client gets their own message, personalised from their record. The rows below are a sample of the audience, not the whole of it.'}
                </Txt>

                {reachShare != null && summary ? (
                  <Meter
                    value={reachShare}
                    tone="success"
                    label="Reachable on WhatsApp"
                    valueLabel={`${num(summary.opted_in)} of ${num(summary.total_clients)}`}
                    style={{ marginTop: spacing.lg }}
                  />
                ) : null}

                <Button
                  full
                  size="lg"
                  variant="whatsapp"
                  icon="logo-whatsapp"
                  label={sending ? 'Starting' : count > 0 ? `Send to all ${num(count)}` : 'Nobody to send to'}
                  loading={sending}
                  disabled={count === 0}
                  onPress={() => { void sendAll(); }}
                  style={{ marginTop: spacing.lg }}
                />

                {running ? (
                  <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                    {/* No bar until there is a denominator. Meter renders its readout through
                        Metric, so a prose fallback in that slot would come out in the tabular
                        display cut, and a 0% bar would claim progress that is not measured yet. */}
                    {jobTotal > 0 ? (
                      <Meter
                        value={jobProcessed / jobTotal}
                        tone="accent"
                        label="Dispatching now"
                        valueLabel={`${num(processedShown)} of ${num(jobTotal)}`}
                      />
                    ) : (
                      <Txt size={font.cap} color={c.muted}>Building the audience for this send.</Txt>
                    )}
                    <Button
                      label="Monitor progress"
                      variant="ghost"
                      size="sm"
                      iconRight="arrow-forward"
                      onPress={() => { if (jobId) openJob(jobId); }}
                    />
                  </View>
                ) : null}
              </Card>
            </Appear>

            {/* What the last dispatch actually did, in the content flow rather than as a
                toast: a refusal is a condition to act on, not a passing note. */}
            {notice ? (
              <Banner
                tone={notice.tone}
                title={notice.title}
                message={notice.message}
                action={notice.jobId ? { label: 'Monitor progress', onPress: () => openJob(notice.jobId!) } : undefined}
                onDismiss={() => setNotice(null)}
              />
            ) : null}

            {sample.length === 0 ? (
              <Card>{emptyBlock}</Card>
            ) : (
              <ListSection
                title={`Sample of ${num(sample.length)} ${plural(sample.length, 'recipient', 'recipients')}`}
                footer={hidden > 0
                  ? `These are a sample. Sending reaches all ${num(count)} ${plural(count, 'client', 'clients')}, including ${num(hidden)} not shown here.`
                  : `Every matching client is shown. Sending reaches all ${num(count)} of them.`}
              >
                {sample.map((r, i) => (
                  <SampleRow key={`${r.phone}-${i}`} rec={r} index={i} onSend={sendOne} />
                ))}
              </ListSection>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
