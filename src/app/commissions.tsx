import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import { EmptyState, Meter, Skeleton } from '@/ui/feedback';
import { ListSection, MetricTile, Pill, Sparkline } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { MdrtTier } from '@/data/api';
import type { Commission } from '@/data/types';
import { useAuth } from '@/store/auth';
import { fmtDate, inr, inrShort } from '@/lib/format';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Commissions — what the month has actually earned, against what it was meant to.
 *
 * THE HEADLINE IS THE ONLY COUNT-UP, and it is earned: this figure moves when a policy is
 * credited, and the movement between two visits to the screen is what an advisor opens it
 * to see. Every other number lands instantly. A dashboard where everything animates is one
 * where nothing is noticed.
 *
 * NO FILLED BRAND CARD. The hero used to be a solid azure panel with hardcoded white ink,
 * which spent the brand on a surface carrying one number and broke in dark mode, where
 * white on lifted azure fails contrast. The figure carries itself: Metric at display size,
 * tabular, negative tracking. The gradient stays rationed to the clock-in ring and the tab.
 *
 * EVERY FIELD IS DEFENDED AT THE BOUNDARY. `getCommissionSummary` returns `{status:'ok',summary}`
 * or `{status:'error'}`; on error `data` is set to `null`, so `history`/`recent` read back undefined
 * and `data.history.map(...)` (what this screen used to do) would crash on the exact failure path.
 * Everything below reads through `num` and an Array.isArray check, and a section with nothing behind
 * it is not rendered at all.
 *
 * NOTHING IS DERIVED THAT THE SERVER DID NOT SEND. No projected payout, no annualised run
 * rate, no "on track for" figure. Growth appears only when there is a real previous month to
 * divide by. The MDRT-tier target and the per-product breakdown both arrive fully computed on
 * `/my-summary` (backend Phase 62) — the app renders them, never recomputes. An invented number
 * on a commission screen is a promise about someone's income.
 *
 * THE MDRT TIER IS THE "TARGET". Since Phase 62 the summary carries `target` = the advisor's next
 * MDRT tier premium, the SAME figure as `/advisor/performance` (shared FYC basis), so the tier card
 * now reads it straight off the summary — one call, not two. It is a PREMIUM/production goal, not a
 * rupee-commission target, and is gated to advisor-track roles for whom FYC premium means something.
 * ------------------------------------------------------------------ */

/** The empty shell omits several fields outright, so nothing is trusted to be a number. */
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** `fmtDate` returns an em dash for an unparseable date, and the UI does not print those. */
function dateOr(iso?: string): string {
  if (!iso) return '';
  const s = fmtDate(iso);
  return !s || s === '—' ? '' : s;
}

export default function Commissions() {
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { user } = useAuth();

  // The MDRT tier ladder is an advisor-track achievement (FYC premium). Only advisor / learn_advisor
  // read their OWN performance cleanly: the backend 403s any other id for an `advisor`, team-scopes a
  // `leader` (403 on self), and a total_premium of ₹0 for an admin/payroll is a meaningless "0% to
  // Quarter MDRT". So the tier element is gated to the roles it means something for, reading own id.
  const tierAdvisorId = user?.id && (user.role === 'advisor' || user.role === 'learn_advisor') ? user.id : null;

  const [data, setData] = useState<Commission | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /**
   * Deliberately not `useData`: that hook writes state after its await with no cancellation,
   * so backing out of this route while the ledger is in flight updates a dead screen.
   * `current` cancels a specific load (the focus effect flips it on blur) and `alive` covers
   * unmount for every caller, so no path here can setState on a screen that has gone away.
   */
  const load = useCallback(async (opts: { refresh?: boolean; current?: () => boolean } = {}) => {
    if (opts.refresh) setRefreshing(true);
    const r = await api.getCommissionSummary();
    if (!alive.current || (opts.current && !opts.current())) return;
    // `ok` carries the earned aggregate (zeros included — the blank check below turns 200-zeros into
    // the calm "none yet" state); `error` becomes null, and the global banner has already spoken, so
    // `blank && health.degraded` shows "did not load" rather than a fabricated zero.
    setData(r.status === 'ok' ? r.summary : null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Refetched on focus: the ledger moves while the user is elsewhere in the app, and a stale
  // month total is the one figure on this screen nobody should be reading.
  useFocusEffect(useCallback(() => {
    let active = true;
    void load({ current: () => active });
    return () => { active = false; };
  }, [load]));

  const thisMonth = num(data?.thisMonth);
  const lastMonth = num(data?.lastMonth);
  const pending = num(data?.pending);
  const ytd = num(data?.ytd);

  // Hooks run unconditionally, ahead of every state branch below.
  const shownMonth = useCountUp(thisMonth);

  // The MDRT-tier "target" now rides on the summary (Phase 62). Mapped to the card's shape; `null`
  // when the server sent no target (non-advisor / failed FYC read), which — with the role gate above
  // — is why an admin/payroll never sees a meaningless "₹0, 0% to Quarter MDRT" card.
  const tier: MdrtTier | null = useMemo(() => {
    const tg = data?.target;
    if (!tg) return null;
    return { current: tg.current, next: tg.next, nextPremium: tg.nextPremium, toNext: tg.toNext, totalPremium: tg.achievedPremium };
  }, [data]);

  // Per-product breakdown of this year's earned commissions (server-grouped, Σ === ytd).
  const byProduct = useMemo(() => {
    const b = data?.byProduct;
    if (!Array.isArray(b)) return [];
    return b.filter((p) => p && typeof p.product === 'string' && p.product && Number.isFinite(p.amount));
  }, [data]);

  /** Six months is what the backend returns and what fits a phone without shrinking labels. */
  const series = useMemo(() => {
    const h = data?.history;
    if (!Array.isArray(h)) return [];
    return h
      .filter((m) => m && typeof m.month === 'string' && Number.isFinite(m.amount))
      .slice(-6);
  }, [data]);

  const recent = useMemo(() => {
    const r = data?.recent;
    if (!Array.isArray(r)) return [];
    return r.filter((x) => x && (x.client || x.plan || Number.isFinite(x.amount)));
  }, [data]);

  const amounts = useMemo(() => series.map((m) => num(m.amount)), [series]);
  const peak = amounts.length > 0 ? Math.max(...amounts) : 0;

  const blank = thisMonth === 0 && lastMonth === 0 && pending === 0 && ytd === 0
    && series.length === 0 && recent.length === 0;

  /** Only computed when there is a real base to compare against. */
  const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;
  const growthPct = growth == null ? 0 : Math.round(growth);

  const retry = useCallback(() => {
    haptics.tap();
    setLoading(true);
    void load();
  }, [load]);

  const subtitle = loading
    ? 'Loading your earnings'
    : blank
      ? 'Earnings and payouts'
      : `${inrShort(ytd)} year to date`;

  return (
    <Screen>
      <Header title="Commissions" subtitle={subtitle} back />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 48,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load({ refresh: true })}
            tintColor={c.primary}
            colors={[c.primary]}
            progressBackgroundColor={c.card}
          />
        }
      >
        {/* Tier progress reads off the summary's `target` (Phase 62), gated to advisor-track roles.
            It lives ABOVE the ledger's blank fork so an advisor with no commissions still sees the
            ladder at ₹0; on the ledger's own load it shows its skeleton, and null on error/non-advisor. */}
        {tierAdvisorId ? (
          loading ? <TierSkeleton /> : tier ? <MdrtTierCard tier={tier} /> : null
        ) : null}

        {loading ? (
          <LedgerSkeleton />
        ) : blank ? (
          health.degraded ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Your earnings did not load"
              subtitle="The commission ledger could not be reached, so these blanks are unconfirmed rather than zero. Pull down to try again."
              action={{ label: t('common.tryAgain'), onPress: retry }}
            />
          ) : (
            <EmptyState
              icon="wallet-outline"
              title="No commission recorded yet"
              subtitle="Once a policy you booked is processed, the earning, its payout status and the running year total appear here."
              action={{ label: t('common.refresh'), onPress: retry }}
            />
          )
        ) : (
          <>
            {/* ---------------- This month ---------------- */}
            <Appear index={0}>
              <Card>
                <Eyebrow>{t('tasks.viewMonth')}</Eyebrow>
                <Metric value={inr(shownMonth)} size={font.display} style={{ marginTop: 4 }} />

                <View style={{ marginTop: spacing.md }}>
                  {growth == null ? (
                    <Txt size={font.cap} color={c.faint} numberOfLines={2}>
                      No figure for last month, so there is nothing to compare against yet.
                    </Txt>
                  ) : (
                    <Pill
                      label={growthPct === 0
                        ? 'Level with last month'
                        : `${growthPct > 0 ? '+' : '-'}${Math.abs(growthPct)}% vs last month`}
                      tone={growthPct === 0 ? 'neutral' : growthPct > 0 ? 'success' : 'danger'}
                      icon={growthPct === 0 ? 'remove' : growthPct > 0 ? 'trending-up' : 'trending-down'}
                      numeric
                    />
                  )}
                </View>

              </Card>
            </Appear>

            {/* ---------------- Breakdown ---------------- */}
            <Appear index={1}>
              <Row style={{ alignItems: 'stretch' }}>
                <MetricTile
                  label="Last month"
                  value={inrShort(lastMonth)}
                  icon="calendar-outline"
                  tone="neutral"
                />
                <MetricTile
                  label="Pending payout"
                  value={inrShort(pending)}
                  icon="hourglass-outline"
                  tone="warning"
                />
              </Row>
            </Appear>

            {/* ---------------- By product ----------------
                Server-grouped this-year earnings; the bar is each product's share of YTD (Σ === ytd),
                so the app never sums anything itself. Only rendered when the server returned rows. */}
            {byProduct.length > 0 ? (
              <Appear index={2}>
                <View>
                  <SectionHeader title="This year by product" />
                  <Card style={{ gap: spacing.md }}>
                    {byProduct.map((p, i) => (
                      <Meter
                        key={`${p.product}-${i}`}
                        label={p.count > 0 ? `${p.product} · ${p.count} ${p.count === 1 ? 'credit' : 'credits'}` : p.product}
                        value={ytd > 0 ? num(p.amount) / ytd : 0}
                        valueLabel={inrShort(num(p.amount))}
                        tone="primary"
                      />
                    ))}
                  </Card>
                </View>
              </Appear>
            ) : null}

            {/* ---------------- Trend ---------------- */}
            <Appear index={3}>
              <View>
                <SectionHeader title={series.length > 1 ? `Last ${series.length} months` : 'Year to date'} />
                <Card>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Txt size={font.cap} weight="600" color={c.muted}>Year to date</Txt>
                      <Metric value={inr(ytd)} size={font.h2} style={{ marginTop: 2 }} />
                    </View>
                    {peak > 0 ? (
                      <Pill label={`Best ${inrShort(peak)}`} tone="primary" small numeric />
                    ) : null}
                  </Row>

                  {amounts.length >= 2 ? (
                    <>
                      <Sparkline
                        data={amounts}
                        bars={amounts.length}
                        height={76}
                        tone={c.primary}
                        style={{ marginTop: spacing.lg }}
                      />
                      {/* Same count and the same 2pt gap as the bars, so a label can never
                          drift off its own column, and no chart library is needed. */}
                      <View style={{ flexDirection: 'row', gap: 2, marginTop: spacing.sm }}>
                        {series.map((m, i) => {
                          const newest = i === series.length - 1;
                          return (
                            <View key={`${m.month}-${i}`} style={{ flex: 1, minWidth: 2, alignItems: 'center' }}>
                              <Txt
                                size={font.tiny}
                                weight={newest ? '800' : '500'}
                                color={newest ? c.text : c.faint}
                                numberOfLines={1}
                              >
                                {m.month}
                              </Txt>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  ) : (
                    <Txt size={font.sub} color={c.muted} style={{ marginTop: spacing.md }} numberOfLines={2}>
                      Not enough months on record yet to draw a trend.
                    </Txt>
                  )}
                </Card>
              </View>
            </Appear>

            {/* ---------------- Recent credits ---------------- */}
            <Appear index={4}>
              <View>
                <SectionHeader title="Recent commissions" />
                {recent.length === 0 ? (
                  <Card>
                    <EmptyState
                      icon="receipt-outline"
                      title="No individual payouts listed"
                      subtitle="The totals above are in, but the ledger has not returned the line items behind them."
                    />
                  </Card>
                ) : (
                  <ListSection>
                    {recent.map((r, i) => {
                      const when = dateOr(r.date);
                      const sub = [r.plan, when].filter(Boolean).join(' · ');
                      return (
                        <PersonRow
                          key={`${r.id ?? 'credit'}-${i}`}
                          // `client` can be absent on a raw ledger row, and an empty name
                          // reaches colorFromString, which indexes into the string.
                          name={r.client || 'Client'}
                          subtitle={sub || undefined}
                          subtitleNumeric={!!when}
                          size={40}
                          style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
                          right={
                            <Metric
                              value={`+${inrShort(num(r.amount))}`}
                              size={font.body}
                              color={c.success}
                            />
                          }
                        />
                      );
                    })}
                  </ListSection>
                )}
              </View>
            </Appear>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ================================================================== *
 * MDRT tier progress — a SEPARATE element from the money ledger below.
 *
 * The ladder is server-authoritative (`utils/mdrtTiers.js`, six owner-confirmed thresholds) and
 * bucketed from the advisor's cumulative FYC premium — an ANNUAL production goal, a different unit
 * than the earned-commission figures, so it stands as its own card.
 *
 * Since backend Phase 62 the tier rides on the commissions summary's `target` (shared FYC basis with
 * `/advisor/performance`, so the two surfaces can never disagree) — the caller passes it in, and this
 * component is pure. It renders only when a real tier came back for an advisor-track role; a non-advisor
 * or a failed FYC read leaves `target:null`, so this card never shows a meaningless "₹0, 0% to Quarter
 * MDRT". Every ₹ is the server's.
 * ================================================================== */

function MdrtTierCard({ tier }: { tier: MdrtTier }) {
  const c = useTheme();
  const { current, next, nextPremium, toNext, totalPremium } = tier;
  const atTop = next == null || nextPremium == null;      // TOT — nothing above
  const progress = !atTop && (nextPremium as number) > 0 ? totalPremium / (nextPremium as number) : 0;

  return (
    <Appear index={0}>
      <View>
        <SectionHeader title="MDRT tier" />
        <Card>
          <Eyebrow>First-year premium</Eyebrow>
          <Metric value={inr(totalPremium)} size={font.h2} style={{ marginTop: 2 }} />

          <View style={{ marginTop: spacing.md }}>
            {current ? (
              <Pill label={`${current} reached`} tone="success" icon="ribbon" small />
            ) : (
              <Txt size={font.cap} color={c.faint} numberOfLines={2}>
                {`Not at the first tier yet — ${next ?? 'Quarter MDRT'} begins at ${inrShort(nextPremium ?? 0)} of first-year premium.`}
              </Txt>
            )}
          </View>

          <View style={{
            marginTop: spacing.lg,
            paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: c.hairline,
          }}>
            {atTop ? (
              <Txt size={font.sub} weight="600" color={c.text} numberOfLines={2}>
                {`You've reached ${current ?? 'the top'} — the highest tier.`}
              </Txt>
            ) : (
              <>
                <Meter
                  label={`Next: ${next}`}
                  value={progress}
                  valueLabel={`${inrShort(totalPremium)} of ${inrShort(nextPremium ?? 0)}`}
                  tone="primary"
                />
                <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.sm }}>
                  {`${inr(toNext)} more to reach ${next}.`}
                </Txt>
              </>
            )}
          </View>
        </Card>
      </View>
    </Appear>
  );
}

function TierSkeleton() {
  const c = useTheme();
  return (
    <View>
      <SectionHeader title="MDRT tier" />
      <View style={{
        backgroundColor: c.card,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        padding: spacing.lg,
        gap: spacing.md,
      }}>
        <Skeleton width={110} height={10} />
        <Skeleton width="46%" height={24} />
        <Skeleton width={150} height={20} radius={radius.pill} />
        <Skeleton width="100%" height={10} radius={radius.pill} style={{ marginTop: spacing.sm }} />
      </View>
    </View>
  );
}

/* ================================================================== *
 * Loading — hero block, two tiles, the chart, then payout rows. Same
 * footprint as the real screen, so nothing reflows when figures land.
 * ================================================================== */

function LedgerSkeleton() {
  const c = useTheme();
  const surface = {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: spacing.lg,
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={[surface, { gap: spacing.md }]}>
        <Skeleton width={86} height={10} />
        <Skeleton width="62%" height={30} />
        <Skeleton width={140} height={20} radius={radius.pill} />
        <Skeleton width="100%" height={10} radius={radius.pill} style={{ marginTop: spacing.sm }} />
      </View>

      <Row style={{ alignItems: 'stretch' }}>
        {[0, 1].map((i) => (
          <View key={i} style={[surface, { flex: 1, gap: spacing.sm }]}>
            <Skeleton width={34} height={34} radius={11} />
            <Skeleton width="72%" height={10} style={{ marginTop: spacing.sm }} />
            <Skeleton width="54%" height={22} />
          </View>
        ))}
      </Row>

      <View style={[surface, { gap: spacing.md }]}>
        <Skeleton width={96} height={10} />
        <Skeleton width="46%" height={22} />
        <Skeleton width="100%" height={72} radius={radius.sm} />
      </View>

      <View style={[surface, { gap: spacing.lg }]}>
        {[0, 1, 2].map((i) => (
          <Row key={i}>
            <Skeleton width={40} height={40} radius={40 / 2.6} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton width="58%" height={12} />
              <Skeleton width="40%" height={10} />
            </View>
            <Skeleton width={58} height={14} />
          </Row>
        ))}
      </View>
    </View>
  );
}
