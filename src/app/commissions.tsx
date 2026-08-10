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
import type { Commission } from '@/data/types';
import { fmtDate, inr, inrShort } from '@/lib/format';

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
 * EVERY FIELD IS DEFENDED AT THE BOUNDARY. `getCommission` falls back to a zeroed shell
 * whose shape does not match the `Commission` type at runtime: `history` and `recent` come
 * back undefined, so `data.history.map(...)` (what this screen used to do) crashed on the
 * exact failure path the fallback exists to serve. Everything below reads through `num` and
 * an Array.isArray check, and a section with nothing behind it is not rendered at all.
 *
 * NOTHING IS DERIVED THAT THE SERVER DID NOT SEND. No projected payout, no annualised run
 * rate, no "on track for" figure. Growth appears only when there is a real previous month to
 * divide by, and the target meter only when a target actually came back. An invented number
 * on a commission screen is a promise about someone's income.
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
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();

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
    const d = await api.getCommission();
    if (!alive.current || (opts.current && !opts.current())) return;
    setData(d ?? null);
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
  const target = num(data?.target);

  // Hooks run unconditionally, ahead of every state branch below.
  const shownMonth = useCountUp(thisMonth);

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
        {loading ? (
          <LedgerSkeleton />
        ) : blank ? (
          health.degraded ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Your earnings did not load"
              subtitle="The commission ledger could not be reached, so these blanks are unconfirmed rather than zero. Pull down to try again."
              action={{ label: 'Try again', onPress: retry }}
            />
          ) : (
            <EmptyState
              icon="wallet-outline"
              title="No commission recorded yet"
              subtitle="Once a policy you booked is processed, the earning, its payout status and the running year total appear here."
              action={{ label: 'Refresh', onPress: retry }}
            />
          )
        ) : (
          <>
            {/* ---------------- This month ---------------- */}
            <Appear index={0}>
              <Card>
                <Eyebrow>This month</Eyebrow>
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

                {target > 0 ? (
                  <View style={{
                    marginTop: spacing.lg,
                    paddingTop: spacing.md,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.hairline,
                  }}>
                    <Meter
                      label="Monthly target"
                      value={thisMonth / target}
                      valueLabel={`${inrShort(thisMonth)} of ${inrShort(target)}`}
                      tone={thisMonth >= target ? 'success' : 'primary'}
                    />
                  </View>
                ) : (
                  <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.md }}>
                    No monthly target is set on your profile.
                  </Txt>
                )}
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

            {/* ---------------- Trend ---------------- */}
            <Appear index={2}>
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
            <Appear index={3}>
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
