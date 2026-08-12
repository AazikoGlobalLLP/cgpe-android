import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import { EmptyState, Meter, Skeleton } from '@/ui/feedback';
import { KpiStrip, Pill } from '@/ui/data';
import type { KpiItem } from '@/ui/data';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { MyEarnings, PayrollRow } from '@/data/api';
import { inr } from '@/lib/format';

/* ------------------------------------------------------------------ *
 * My earnings — the signed-in person's OWN attendance-derived pay for a month.
 * docs/spec/PHASE-16.md. Self-view: everyone sees only their own figure.
 *
 * SELF-SCOPED, ALL STAFF. Backed by `GET /api/payroll/my-earnings` (Phase 28) — the one
 * non-admin payroll route. The backend forces `user_id` to the token identity, so there is
 * NO role gate here (unlike the admin `/payroll` roster) and nobody can read another's pay.
 *
 * THE APP NEVER MULTIPLIES. Every figure — `payable`, `per_day_rate`, `salary_amount` — is
 * computed server-side by the locked salary engine and rendered verbatim. The only on-device
 * arithmetic is `absent = working_days − present_days`, a subtraction of DAYS (not money), and
 * the payable-days ratio for the progress meter. There is no `*` on a rate anywhere below.
 *
 * SCOPED TO THE v1 CONTRACT. `/my-earnings` returns the `/compute` RosterRow — a monthly
 * AGGREGATE, not the richer per-day body PHASE-16.md's UI lock proposed. So there is no per-day
 * spine (no `breakdown[]`), no overtime split, and no half-day count in v1: the KPIs are
 * Present · Payable days · Absent · Worked hours (the locked "Overtime h" chip has no v1 source).
 * See PHASE-16.md D-1 / D-2. `ui/characters.tsx` (UI-lock #10) was deleted in Phase 14, so the
 * expressive states use the app-wide `EmptyState`, exactly as payroll.tsx does (D-3).
 * ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEGMENT_LABEL: Record<string, string> = { day_wise: 'Day-wise', hourly: 'Hourly', base: 'Base' };

/** Nothing from a wire body is trusted to be a finite number. */
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Worked hours to one decimal, e.g. "170.5". */
const hrs = (v: number): string => (Math.round(v * 10) / 10).toString();

type MonthOpt = { key: string; label: string; short: string; year: number };

/**
 * The last 12 months, newest first, built ONCE in a lazy `useState` initialiser — `new Date()`
 * in the render body trips `react-hooks/purity` (Phase 15). `key` is the `?month=YYYY-MM` the
 * endpoint takes; index 0 is the current (still-running) month.
 */
function lastTwelveMonths(): MonthOpt[] {
  const now = new Date();
  const out: MonthOpt[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      short: MONTHS[d.getMonth()],
      year: d.getFullYear(),
    });
  }
  return out;
}

export default function Earnings() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const router = useRouter();

  const [months] = useState(lastTwelveMonths);
  const [sel, setSel] = useState(0);                    // index into `months`; 0 = current month
  const [res, setRes] = useState<MyEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const period = months[sel];
  const isCurrentMonth = sel === 0;                     // the running month — pay is provisional

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  /**
   * Loads the selected month. `alive` covers unmount; `current` lets the focus effect cancel a
   * load when the screen blurs or the month changes under it, so a slow reply never lands on a
   * screen showing a different month.
   */
  const load = useCallback(async (opts: { refresh?: boolean; current?: () => boolean } = {}) => {
    if (opts.refresh) setRefreshing(true);
    const r = await api.getMyEarnings(period.key);
    if (!alive.current || (opts.current && !opts.current())) return;
    setRes(r);
    setLoading(false);
    setRefreshing(false);
  }, [period.key]);

  // Refetch on focus AND when the month changes (the callback identity changes with `period.key`).
  useFocusEffect(useCallback(() => {
    let active = true;
    void load({ current: () => active });
    return () => { active = false; };
  }, [load]));

  const pickMonth = (i: number) => {
    if (i === sel) return;
    haptics.select();
    setLoading(true);
    setRes(null);
    setSel(i);
  };

  const retry = useCallback(() => { haptics.tap(); setLoading(true); void load(); }, [load]);

  // Hooks run unconditionally, ahead of every branch below.
  const row: PayrollRow | null = res?.status === 'ok' ? res.row : null;
  const m = row?.months?.[0];
  const payable = num(row?.payable);
  const shownPayable = useCountUp(payable);

  const present = num(m?.present_days);
  const workingDays = num(m?.working_days);
  const absent = Math.max(0, workingDays - present);            // DAYS subtraction — never money
  const workedHours = num(m?.worked_hours);
  const perDayRate = m && typeof m.per_day_rate === 'number' ? m.per_day_rate : null;
  const salary = num(row?.salary_amount);
  const segLabel = row ? (SEGMENT_LABEL[row.segment] ?? row.segment) : '';
  // A profile can exist for a month with nothing in it; per the spec that is the empty state, not a
  // fabricated ₹0. Gated on EVERYTHING being zero, not just attendance — a `base`-segment member can
  // have a non-zero payable with no present days (a flat salary), and that real figure must show.
  const nothingToShow = payable === 0 && present === 0 && workedHours === 0;

  const kpis = useMemo<KpiItem[]>(() => [
    { label: 'Present', value: String(present), icon: 'checkmark-circle', tone: present > 0 ? 'success' : 'neutral' },
    { label: 'Payable days', value: `${present}/${workingDays}`, icon: 'calendar', tone: 'primary' },
    { label: 'Absent', value: String(absent), icon: 'close-circle', tone: absent > 0 ? 'danger' : 'neutral' },
    { label: 'Worked hours', value: hrs(workedHours), icon: 'time', tone: 'neutral' },
  ], [present, workingDays, absent, workedHours]);

  const heroA11y = `Earned ${inr(payable)}${isCurrentMonth ? ' so far this month' : ''}, for ${period.label}`;

  return (
    <Screen>
      <Header title="My earnings" subtitle={loading ? 'Loading your pay' : period.label} back />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 48, gap: spacing.lg }}
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
        <MonthStrip months={months} sel={sel} onPick={pickMonth} />

        {loading ? (
          <EarningsSkeleton />
        ) : res?.status === 'empty' ? (
          <EmptyState
            icon="briefcase-outline"
            title="No pay profile yet"
            subtitle="You don't have a payroll profile set up yet. Once an administrator configures your salary, your monthly pay and attendance-based days appear here."
            action={{ label: 'Open attendance', onPress: () => router.push('/attendance' as Href) }}
          />
        ) : res?.status !== 'ok' ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="We couldn't load your earnings"
            subtitle={health.degraded
              ? 'The salary service could not be reached, so this is blank rather than empty. Pull down or retry.'
              : 'We could not load your pay for this month. Pull down or retry.'}
            action={{ label: 'Try again', onPress: retry }}
          />
        ) : nothingToShow ? (
          <EmptyState
            icon="calendar-outline"
            title={`No attendance recorded for ${period.label}`}
            subtitle="There are no clock-ins for this month, so there is nothing to pay yet. Clock in from the Today tab, and this fills in as the month goes on."
            action={{ label: 'Open attendance', onPress: () => router.push('/attendance' as Href) }}
          />
        ) : (
          <>
            {/* ---------------- The headline figure ---------------- */}
            <Appear index={0}>
              <Card>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Eyebrow>{`Earned · ${period.label}`}</Eyebrow>
                  {isCurrentMonth ? <Pill label="so far this month" tone="warning" small /> : null}
                </Row>
                <View accessible accessibilityLabel={heroA11y}>
                  <Metric value={inr(shownPayable)} size={font.display} style={{ marginTop: 4 }} />
                </View>
                <Txt size={font.sub} color={c.muted} numeric style={{ marginTop: 6 }} numberOfLines={1}>
                  {[segLabel, perDayRate != null ? `${inr(perDayRate)}/day` : null].filter(Boolean).join('  ·  ')}
                </Txt>
                <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.md }} numberOfLines={2}>
                  Computed by the server from your own attendance. This figure is gross, before any deductions.
                </Txt>
              </Card>
            </Appear>

            {/* ---------------- The four metrics ---------------- */}
            <Appear index={1}>
              <KpiStrip items={kpis} contentStyle={{ paddingHorizontal: spacing.lg }} style={{ marginHorizontal: -spacing.lg }} />
            </Appear>

            {/* ---------------- Payable-days progress ---------------- */}
            {workingDays > 0 ? (
              <Appear index={2}>
                <Card>
                  <Meter
                    value={present / workingDays}
                    label="Payable days"
                    valueLabel={`${present} of ${workingDays}`}
                  />
                </Card>
              </Appear>
            ) : null}

            {/* ---------------- Pay basis ---------------- */}
            <Appear index={3}>
              <View>
                <SectionHeader title="Pay basis" />
                <Card style={{ gap: spacing.md }}>
                  <Fact label="Segment" value={segLabel} />
                  {salary > 0 ? <Fact label="Monthly salary" value={inr(salary)} /> : null}
                  {perDayRate != null ? <Fact label="Per-day rate" value={inr(perDayRate)} /> : null}
                  {row && typeof row.office_hours === 'number'
                    ? <Fact label="Office hours" value={`${hrs(row.office_hours)} h`} /> : null}
                  <Fact label="Worked hours" value={`${hrs(workedHours)} h`} />
                </Card>
              </View>
            </Appear>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* One "label … value" line. Value is a Metric so figures align down the column and read tabular. */
function Fact({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
      <Txt size={font.sub} color={c.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Txt>
      <Metric value={value} size={font.body} />
    </Row>
  );
}

/* A horizontal strip of the last 12 months, current first — the same control payroll.tsx uses.
 * A plain Pressable chip: the app's Segmented/Pill chips are not built for a scrolling selector. */
function MonthStrip({ months, sel, onPick }: { months: MonthOpt[]; sel: number; onPick: (i: number) => void }) {
  const c = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
    >
      {months.map((mo, i) => {
        const active = i === sel;
        return (
          <Pressable
            key={mo.key}
            onPress={() => onPick(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={mo.label}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: active ? c.primary : c.card,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: active ? c.primary : c.border,
            }}
          >
            <Txt size={font.cap} weight={active ? '800' : '600'} color={active ? c.onPrimary : c.muted} numeric>
              {`${mo.short} ${String(mo.year).slice(2)}`}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* Loading — same footprint as the real screen (hero, four chips, meter, pay-basis) so nothing
 * reflows when the figures land. */
function EarningsSkeleton() {
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
        <Skeleton width={130} height={10} />
        <Skeleton width="58%" height={32} />
        <Skeleton width="40%" height={12} />
      </View>
      <Row style={{ gap: spacing.sm }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} width={92} height={46} radius={radius.md} />)}
      </Row>
      <View style={[surface, { gap: spacing.md }]}>
        <Skeleton width="46%" height={12} />
        <Skeleton width="100%" height={10} radius={radius.pill} />
      </View>
      <View style={[surface, { gap: spacing.lg }]}>
        {[0, 1, 2].map((i) => (
          <Row key={i} style={{ justifyContent: 'space-between' }}>
            <Skeleton width="34%" height={12} />
            <Skeleton width={70} height={14} />
          </Row>
        ))}
      </View>
    </View>
  );
}
