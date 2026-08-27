import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import { IconBtn } from '@/ui/controls';
import { Banner, EmptyState, Meter, Skeleton } from '@/ui/feedback';
import { DataRow, KpiStrip, ListSection, MetricTile, Sparkline } from '@/ui/data';
import type { Delta, KpiItem } from '@/ui/data';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';

import * as api from '@/data/api';
import { inr, inrShort } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { capabilitiesOf } from '@/store/roles';
import { RestrictedNotice } from '@/ui/RestrictedNotice';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Analytics — the data console.
 *
 * THE ONE RULE THIS SCREEN LIVES BY: a figure shown here is a figure the backend
 * actually returned. `/campaigns/summary` legitimately answers zero for most counters on
 * most days (nobody has a birthday today, nothing matures this quarter), and a zero is a
 * reading, not a gap. So zeros render as zeros. What is NEVER rendered is a number the
 * server did not send: if the campaign aggregate fails, that block is replaced by a Banner
 * rather than by a row of confident zeroes that mean "we could not ask".
 *
 * WHERE THE DELTAS COME FROM, since neither endpoint returns history. Each reading this
 * session is kept in `history`, and a tile's delta compares the current reading with the
 * PREVIOUS one. That is a real measurement of a real change, and it is captioned as such
 * under the grid so nobody reads it as day-on-day growth. The sparkline is the same series.
 * Before a second reading exists there is no delta and no sparkline at all — an honest
 * nothing rather than a flat line implying stability that was never observed.
 *
 * NO GRADIENT. The previous version wrapped the headline premium in the deep hero ramp.
 * The brand gradient is rationed to the clock-in ring and the active tab indicator; here
 * the figure carries its own weight through Metric's tabular cut and negative tracking.
 * ------------------------------------------------------------------ */

/** Exactly what the two endpoints promise, nulls and all. No widening, no shells. */
type Stats = Awaited<ReturnType<typeof api.getClientStats>>;
type Camp = Awaited<ReturnType<typeof api.getCampaignSummary>>;

/**
 * One observation of the whole console, taken when a fetch lands.
 *
 * The campaign-derived fields are `number | null` rather than falling back to 0, because
 * "the aggregate answered zero" and "the aggregate did not answer" are different facts. A
 * 0 fallback would let a failed reading followed by a successful one manufacture a delta
 * out of an outage.
 */
type Snap = {
  premium: number;
  clients: number;
  cover: number;
  birthdays: number;
  renewals: number | null;
  reachable: number | null;
  maturity: number | null;
  anniversaries: number | null;
};

const SNAP_KEYS: (keyof Snap)[] = [
  'premium', 'clients', 'cover', 'birthdays', 'renewals', 'reachable', 'maturity', 'anniversaries',
];

/** Readings kept per session. 16 is exactly what a Sparkline draws. */
const MAX_READINGS = 16;

const num = (n: number) => n.toLocaleString('en-IN');

/* ---------- loading ----------
 * Shaped like the console itself: headline block, a 2x2 tile grid, a meter pair and a
 * grouped list. The layout does not move when the figures land. */
function SkeletonTile() {
  return (
    <Card style={{ flex: 1, padding: spacing.lg }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Skeleton width={34} height={34} radius={11} />
        <Skeleton width={46} height={19} radius={radius.pill} />
      </Row>
      <Skeleton width="62%" height={10} style={{ marginTop: spacing.md }} />
      <Skeleton width="76%" height={24} style={{ marginTop: 7 }} />
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <Skeleton width="44%" height={10} />
        <Skeleton width="72%" height={32} style={{ marginTop: 9 }} />
        <Skeleton width="58%" height={12} style={{ marginTop: 10 }} />
        <Skeleton width="100%" height={30} radius={radius.sm} style={{ marginTop: spacing.lg }} />
      </Card>

      <Row style={{ gap: 10, alignItems: 'stretch' }}>
        <SkeletonTile />
        <SkeletonTile />
      </Row>
      <Row style={{ gap: 10, alignItems: 'stretch' }}>
        <SkeletonTile />
        <SkeletonTile />
      </Row>

      <Card>
        <Skeleton width="52%" height={11} />
        <Skeleton width="100%" height={10} radius={5} style={{ marginTop: 9 }} />
        <Skeleton width="46%" height={11} style={{ marginTop: spacing.xl }} />
        <Skeleton width="100%" height={10} radius={5} style={{ marginTop: 9 }} />
      </Card>

      <Card padded={false}>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <Row key={i} style={{ justifyContent: 'space-between' }}>
              <Skeleton width="42%" height={12} />
              <Skeleton width="26%" height={12} />
            </Row>
          ))}
        </View>
      </Card>
    </View>
  );
}

export default function Analytics() {
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { user, viewAs, ready } = useAuth();

  const [stats, setStats] = useState<Stats>(null);
  const [camp, setCamp] = useState<Camp>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /* Session readings. A new entry is appended only when something actually moved, so a
   * screen that is focused five times without a change stays a single reading. */
  const [history, setHistory] = useState<Snap[]>([]);

  /** The leak guard. No state is written once the screen is gone. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /**
   * Both aggregates are fetched together so the console never shows half a reading, and
   * the reading is recorded HERE, where the data lands, rather than in an effect watching
   * the data. A fetch completing is an event; treating it as a render consequence is what
   * makes a history like this cascade.
   */
  const load = useCallback(async (isRefresh = false, focused?: () => boolean) => {
    if (isRefresh) setRefreshing(true);
    const [s, cm] = await Promise.all([
      api.getClientStats().catch(() => null),
      api.getCampaignSummary().catch(() => null),
    ]);
    if (!mounted.current) return;
    if (!focused || focused()) {
      setStats(s);
      setCamp(cm);
      if (s) {
        const snap: Snap = {
          premium: s.total_premium,
          clients: s.total_clients,
          cover: s.total_sum_assured,
          birthdays: s.birthdays_this_month,
          renewals: cm ? cm.renewal_due : null,
          reachable: cm ? cm.opted_in : null,
          maturity: cm ? cm.maturity_soon : null,
          anniversaries: cm ? cm.anniversary_month : null,
        };
        setHistory((h) => {
          const last = h[h.length - 1];
          if (last && SNAP_KEYS.every((k) => last[k] === snap[k])) return h;
          return [...h, snap].slice(-MAX_READINGS);
        });
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let focused = true;
    void load(false, () => focused);
    return () => { focused = false; };
  }, [load]));

  const reload = () => { void load(true); };

  const current = history.length > 0 ? history[history.length - 1] : null;
  const previous = history.length > 1 ? history[history.length - 2] : null;

  /**
   * Delta against the previous reading in this session. No previous reading, or no
   * movement, means NO badge: a "0" delta would claim stability that was not observed.
   * `workload` figures (renewals falling due) get a muted badge because more work is
   * neither good news nor bad news, and colouring it would be a judgement the data
   * cannot support.
   */
  const deltaFor = (key: keyof Snap, opts: { workload?: boolean; money?: boolean } = {}): Delta | undefined => {
    if (!current || !previous) return undefined;
    const now = current[key];
    const was = previous[key];
    if (now == null || was == null) return undefined;
    const diff = now - was;
    if (diff === 0) return undefined;
    const size = opts.money ? inrShort(Math.abs(diff)) : num(Math.abs(diff));
    return {
      value: `${diff > 0 ? '+' : '-'}${size}`,
      direction: diff > 0 ? 'up' : 'down',
      tone: opts.workload ? 'muted' : diff > 0 ? 'good' : 'bad',
    };
  };

  /**
   * The same session history the deltas come from, as a series a tile can draw.
   *
   * TWO REFUSALS ARE DELIBERATE. One reading is not a trend, so a single observation draws
   * nothing rather than a lone full-height bar implying a shape. And if ANY reading in the
   * window is null (the campaign aggregate was down when that observation was taken), the
   * whole strip is withheld: silently closing the gap would draw a smooth line across an
   * outage and turn "we could not ask" into "it did not move".
   */
  const seriesFor = (key: keyof Snap): number[] | undefined => {
    if (history.length < 2) return undefined;
    const vals = history.map((h) => h[key]);
    if (vals.some((v) => v == null)) return undefined;
    return vals as number[];
  };

  const premiumSeries = useMemo(() => history.map((h) => h.premium), [history]);

  // The headline. It counts because the figure moving IS the news on this screen.
  const shownPremium = useCountUp(stats?.total_premium ?? 0);

  /**
   * Campaign-engine counters only. `camp.birthday_month` is deliberately NOT in this strip:
   * the tile above already carries this month's birthdays from the clients aggregate, and
   * the two endpoints scope differently, so two chips with the same label and two different
   * numbers would read as a bug rather than as two measurements.
   */
  const campItems: KpiItem[] = camp ? [
    { label: t('premium.birthdaysToday'), value: num(camp.birthday_today), tone: 'accent', icon: 'gift' },
    { label: t('premium.anniversaries'), value: num(camp.anniversary_month), tone: 'danger', icon: 'heart' },
    { label: t('premium.maturitySoon'), value: num(camp.maturity_soon), tone: 'info', icon: 'cash' },
  ] : [];

  /**
   * Every chip in the strip answered zero. A real reading, and it needs saying out loud.
   * Derived from `campItems` rather than from a hand-written list of fields, so it cannot
   * drift out of step with which counters are actually on screen.
   */
  const campAllZero = campItems.length > 0 && campItems.every((k) => k.value === '0');

  const totalClients = stats?.total_clients ?? 0;
  const reachShare = camp && totalClients > 0 ? camp.opted_in / totalClients : 0;
  const renewalShare = camp && totalClients > 0 ? camp.renewal_due / totalClients : 0;

  // Round-4 loophole hunt (2026-08-25): this console shows org-wide client / premium / claim totals —
  // leadership data. Gate it IN-SCREEN (defence-in-depth for a deep-link), matching the hardened Home
  // analytics affordance. Wait for `ready` so a real admin is not flashed the refusal during restore.
  if (ready && !capabilitiesOf(user, viewAs).orgAnalytics) {
    return (
      <RestrictedNotice
        title="Portfolio analytics"
        heading="Analytics is for managers"
        subtitle="Organisation-wide figures are visible to team leads and admins."
      />
    );
  }

  return (
    <Screen>
      <Header
        title="Portfolio analytics"
        subtitle="Organisation wide, live figures"
        back
        right={
          <IconBtn
            icon="refresh"
            accessibilityLabel="Reload portfolio figures"
            onPress={reload}
            // Also inert during the first read: tapping it there queues a second identical
            // pair of aggregate requests behind the one already in flight.
            disabled={refreshing || loading}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg, paddingTop: 4,
          paddingBottom: insets.bottom + 48, gap: spacing.lg,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <AnalyticsSkeleton /> : !stats ? (
          <Card>
            {health.degraded ? (
              <EmptyState
                icon="cloud-offline"
                title="Portfolio figures did not load"
                subtitle="The server could not be reached, so nothing here is confirmed. Pull down to try the request again."
                action={{ label: t('common.tryAgain'), onPress: reload }}
              />
            ) : (
              <EmptyState
                icon="stats-chart"
                title="No live portfolio yet"
                subtitle="These figures are read from your CGPE account. Sign in and the whole book is measured here."
                action={{ label: t('common.tryAgain'), onPress: reload }}
              />
            )}
          </Card>
        ) : (
          <>
            {/* HEADLINE — the one figure the whole book rolls up to. */}
            <Appear>
              <Card>
                <Eyebrow>Total annual premium</Eyebrow>
                <Metric value={inr(shownPremium)} size={font.display} style={{ marginTop: 4 }} />
                <Row style={{ gap: spacing.sm, marginTop: 6 }}>
                  <Txt size={font.sub} color={c.muted} numeric numberOfLines={1}>
                    {num(stats.total_clients)} clients
                  </Txt>
                  <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: c.faint }} />
                  <Txt size={font.sub} color={c.muted} numeric numberOfLines={1} style={{ flexShrink: 1 }}>
                    {inrShort(stats.total_sum_assured)} sum assured
                  </Txt>
                </Row>

                {premiumSeries.length > 1 ? (
                  <>
                    <Sparkline data={premiumSeries} tone={c.primary} height={30} style={{ marginTop: spacing.lg }} />
                    <Txt size={font.tiny} color={c.faint} style={{ marginTop: 7 }} numberOfLines={1}>
                      {premiumSeries.length} readings taken in this session
                    </Txt>
                  </>
                ) : null}
              </Card>
            </Appear>

            {/* THE FOUR THAT MATTER. Zeros are real answers here.
                Each tile carries the delta AND the strip from the same session series, so
                the badge says how far it moved and the strip says whether it has been
                drifting or jumped once. Both vanish together before a second reading. */}
            <Appear index={1}>
              <Row style={{ gap: 10, alignItems: 'stretch' }}>
                <MetricTile
                  label={t('tab.clients')}
                  value={num(stats.total_clients)}
                  icon="people"
                  tone="primary"
                  delta={deltaFor('clients')}
                  sparkline={seriesFor('clients')}
                />
                <MetricTile
                  label="Sum assured"
                  value={inrShort(stats.total_sum_assured)}
                  icon="shield-checkmark"
                  tone="info"
                  delta={deltaFor('cover', { money: true })}
                  sparkline={seriesFor('cover')}
                />
              </Row>
            </Appear>

            <Appear index={2}>
              <Row style={{ gap: 10, alignItems: 'stretch' }}>
                {/* Omitted rather than zeroed when the aggregate did not answer: a
                    confident "0 renewals due" would be the most expensive wrong number
                    on this screen. The Banner below says why it is missing. */}
                {camp ? (
                  <MetricTile
                    label={t('premium.renewalsDue')}
                    value={num(camp.renewal_due)}
                    icon="refresh-circle"
                    tone="warning"
                    delta={deltaFor('renewals', { workload: true })}
                    sparkline={seriesFor('renewals')}
                  />
                ) : null}
                <MetricTile
                  label={t('premium.birthdaysThisMonth')}
                  value={num(stats.birthdays_this_month)}
                  icon="gift"
                  tone="accent"
                  delta={deltaFor('birthdays', { workload: true })}
                  sparkline={seriesFor('birthdays')}
                />
              </Row>
            </Appear>

            {history.length > 1 ? (
              <Txt size={font.tiny} color={c.faint} style={{ marginTop: -6, marginHorizontal: spacing.xs }}>
                Badges and strips compare readings taken in this session, not against yesterday. A tile with no strip has not been read twice with a complete answer.
              </Txt>
            ) : null}

            {/* REACH — the share of the book the campaigns can actually touch. */}
            <Appear index={3}>
              <SectionHeader title="Reach" />
              {!camp ? (
                <Banner
                  tone="warning"
                  title="Campaign counters did not load"
                  message="The campaign aggregate did not answer, so reach and this month's counts are not shown. The portfolio totals above are unaffected."
                  action={{ label: t('common.tryAgain'), onPress: reload }}
                />
              ) : totalClients === 0 ? (
                <Card>
                  <EmptyState
                    icon="people-outline"
                    title="No clients counted yet"
                    subtitle="Reach is measured against the size of your book, and the book currently reads zero."
                  />
                </Card>
              ) : (
                <Card>
                  <Meter
                    label="Reachable on WhatsApp"
                    value={reachShare}
                    valueLabel={`${num(camp.opted_in)} of ${num(totalClients)}`}
                    color={c.whatsapp}
                  />
                  <View style={{ height: spacing.xl }} />
                  <Meter
                    label={t('premium.dueThisMonth')}
                    value={renewalShare}
                    valueLabel={`${num(camp.renewal_due)} of ${num(totalClients)}`}
                    tone="warning"
                  />
                </Card>
              )}
            </Appear>

            {/* THIS MONTH — the campaign engine's own counters, zeros included.
                A wall of zeros is the correct answer on most days for most accounts, and it
                is left standing rather than swapped for an empty state, because the chips
                being present is what proves the aggregate answered. The caption underneath
                exists so the row is not misread as a screen that failed to fill in. */}
            {camp ? (
              <Appear index={4}>
                <SectionHeader title={t('tasks.viewMonth')} />
                <KpiStrip
                  items={campItems}
                  style={{ marginHorizontal: -spacing.lg }}
                  contentStyle={{ paddingHorizontal: spacing.lg }}
                />
                {campAllZero ? (
                  <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.md, marginHorizontal: spacing.xs }}>
                    Every counter here was answered as zero by the campaign engine. Nothing falls due this month, and nothing is missing.
                  </Txt>
                ) : null}
              </Appear>
            ) : null}

            {/* THE EXACT FIGURES, for anyone who came here to quote one. */}
            <Appear index={5}>
              <ListSection
                title="Book detail"
                footer="Averages are derived from the totals above. A counter that reads zero was answered as zero by the server."
              >
                <DataRow label="Total annual premium" icon="cash-outline" value={inr(stats.total_premium)} copyable />
                <DataRow label="Total sum assured" icon="shield-outline" value={inr(stats.total_sum_assured)} copyable />
                {stats.total_clients > 0 ? (
                  <DataRow
                    label="Average annual premium"
                    icon="calculator-outline"
                    value={inr(stats.total_premium / stats.total_clients)}
                  />
                ) : null}
                {stats.total_clients > 0 ? (
                  <DataRow
                    label="Average cover per client"
                    icon="albums-outline"
                    value={inr(stats.total_sum_assured / stats.total_clients)}
                  />
                ) : null}
                <DataRow label="Clients on the book" icon="people-outline" value={num(stats.total_clients)} />
                {camp ? (
                  <DataRow
                    label="Reachable on WhatsApp"
                    icon="logo-whatsapp"
                    tone={camp.opted_in > 0 ? 'success' : 'neutral'}
                    value={num(camp.opted_in)}
                  />
                ) : null}
              </ListSection>
            </Appear>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
