import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { ListSection, Pill } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import * as api from '@/data/api';
import type { PayrollRow } from '@/data/api';
import { inr } from '@/lib/format';

/* ------------------------------------------------------------------ *
 * Payroll — the admin/master salary roster for one month.
 *
 * WHY THIS SCREEN EXISTS, AND WHAT IT IS NOT. The mobile "My earnings" self-view
 * (docs/spec/PHASE-16.md) is still blocked: the backend salary surface is deliberately
 * admin-only (`routes/payroll.js:22-23` = `authorize('admin')`), and no self-scoped read
 * exists. At the owner's direction this screen consumes the EXISTING admin endpoint instead
 * — `GET /api/payroll/compute` — so an admin can see the computed roster on the phone. It is
 * a slice of the cgpe-admin panel's payroll surface, not a self-service earnings screen.
 *
 * NO PII ON THE PHONE. `/compute` deliberately omits the sensitive columns (Aadhaar / PAN /
 * bank) — those live only on `/profiles` and `/export` (routes/payroll.js:306). This screen
 * shows salary amount, attendance-derived days/hours, and the server-computed payable.
 *
 * THE APP NEVER MULTIPLIES. Every `payable` is computed server-side. The one arithmetic here
 * is the roster TOTAL, which is a sum of the server's own per-member payables — an aggregate
 * of figures the server produced, not a salary derived from a rate.
 *
 * DOUBLE-GATED. The More entry row only renders for a real `admin`/`super_admin` role, and
 * this screen re-checks the same before it fetches — because mobile's tier model folds
 * `leader` into the "admin" tier, but the backend 403s a leader. So a leader never reaches
 * the fetch, and a stale-role edge still degrades honestly rather than showing a false zero.
 * ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEGMENT_LABEL: Record<string, string> = { day_wise: 'Day-wise', hourly: 'Hourly', base: 'Base' };

/** The empty/failed roster carries no guarantees, so nothing is trusted to be a number. */
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

type MonthOpt = { year: number; month: number; key: string; label: string; short: string };

/**
 * The last 12 calendar months, newest first. Built ONCE in a lazy `useState` initialiser, never
 * in the render body — `new Date()` in render trips `react-hooks/purity` (Phase 15, home.tsx).
 * API months are 1-based, matching `?month=`.
 */
function lastTwelveMonths(): MonthOpt[] {
  const now = new Date();
  const out: MonthOpt[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    out.push({
      year: d.getFullYear(),
      month,
      key: `${d.getFullYear()}-${String(month).padStart(2, '0')}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      short: MONTHS[d.getMonth()],
    });
  }
  return out;
}

export default function Payroll() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { user, ready } = useAuth();

  const [months] = useState(lastTwelveMonths);
  const [sel, setSel] = useState(0);                       // index into `months`; 0 = current month
  const [roster, setRoster] = useState<PayrollRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const period = months[sel];

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  /**
   * Loads the selected month's roster. Guarded twice: `alive` covers unmount, and `current`
   * lets the focus effect cancel a load when the screen blurs or the month changes under it —
   * so a slow reply never lands on a screen showing a different month or already gone.
   */
  const load = useCallback(async (opts: { refresh?: boolean; current?: () => boolean } = {}) => {
    if (!isAdmin) { setLoading(false); return; }           // never fetch the admin endpoint as a non-admin
    if (opts.refresh) setRefreshing(true);
    const rows = await api.getPayrollRoster(period.year, period.month);
    if (!alive.current || (opts.current && !opts.current())) return;
    setRoster(rows);
    setLoading(false);
    setRefreshing(false);
  }, [isAdmin, period.year, period.month]);

  // Refetches on focus AND when the month changes (the callback identity changes with `period`).
  useFocusEffect(useCallback(() => {
    let active = true;
    void load({ current: () => active });
    return () => { active = false; };
  }, [load]));

  const pickMonth = (i: number) => {
    if (i === sel) return;
    haptics.select();
    setLoading(true);
    setRoster(null);
    setSel(i);
  };

  const retry = useCallback(() => { haptics.tap(); setLoading(true); void load(); }, [load]);

  // Sum of the server's own per-member payables — an aggregate of computed figures, NOT a
  // salary derived on-device. Hooks run unconditionally, ahead of every branch below.
  const totalPayable = useMemo(() => (roster ?? []).reduce((s, r) => s + num(r.payable), 0), [roster]);
  const shownTotal = useCountUp(totalPayable);
  const withPay = useMemo(() => (roster ?? []).filter((r) => num(r.payable) > 0).length, [roster]);

  // Belt-and-braces: the entry row already gates on the real role, but a leader who deep-links
  // here (mobile tier folds leader into "admin") must see an honest refusal, not a 403 blank.
  if (ready && !isAdmin) {
    return (
      <Screen>
        <Header title="Payroll" back />
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon="lock-closed-outline"
            title="Payroll is admin-only"
            subtitle="Salary figures are visible to administrators and the master account. Ask an administrator if you need access."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Payroll" subtitle={loading ? 'Loading the salary roster' : period.label} back />

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
          <RosterSkeleton />
        ) : roster === null ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="The payroll roster did not load"
            subtitle={health.degraded
              ? 'The salary service could not be reached, so this is blank rather than empty. Pull down to try again.'
              : 'We could not load the payroll roster for this month. Pull down or retry.'}
            action={{ label: 'Try again', onPress: retry }}
          />
        ) : roster.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No payroll profiles yet"
            subtitle="Nobody has a salary profile for this month. Payroll profiles are created in the admin panel; once they exist, each member's computed pay appears here."
          />
        ) : (
          <>
            {/* ---------------- Total for the month ---------------- */}
            <Appear index={0}>
              <Card>
                <Eyebrow>{`Total payable · ${period.label}`}</Eyebrow>
                <Metric value={inr(shownTotal)} size={font.display} style={{ marginTop: 4 }} />
                <Row style={{ marginTop: spacing.md, gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Pill label={`${roster.length} ${roster.length === 1 ? 'member' : 'members'}`} tone="neutral" small numeric />
                  {withPay > 0 ? <Pill label={`${withPay} with pay`} tone="success" small numeric /> : null}
                </Row>
                <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.md }} numberOfLines={2}>
                  Computed by the server from each member&apos;s attendance. Figures are gross, before deductions.
                </Txt>
              </Card>
            </Appear>

            {/* ---------------- By member ---------------- */}
            <Appear index={1}>
              <View>
                <SectionHeader title="By member" />
                <ListSection>
                  {roster.map((r, i) => <MemberRow key={`${r.user_id}-${i}`} row={r} />)}
                </ListSection>
              </View>
            </Appear>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* A horizontal strip of the last 12 months, current first. A plain Pressable chip — the
 * app's chips (Segmented, Pill) are not built for a scrolling 12-item selector. */
function MonthStrip({ months, sel, onPick }: { months: MonthOpt[]; sel: number; onPick: (i: number) => void }) {
  const c = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
    >
      {months.map((m, i) => {
        const active = i === sel;
        return (
          <Pressable
            key={m.key}
            onPress={() => onPick(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={m.label}
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
              {`${m.short} ${String(m.year).slice(2)}`}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* One member's row: name, pay segment + present/working days, and the server's payable. A row
 * with no matching staff profile, or no attendance, says so rather than printing a bare ₹0. */
function MemberRow({ row }: { row: PayrollRow }) {
  const m = row.months?.[0];
  const seg = SEGMENT_LABEL[row.segment] ?? row.segment;
  const parts = [seg];
  if (m) parts.push(`${num(m.present_days)}/${num(m.working_days)} days`);
  const payable = num(row.payable);
  return (
    <PersonRow
      name={row.name || row.user_id || 'Member'}
      subtitle={parts.join(' · ')}
      subtitleNumeric
      size={40}
      style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
      right={
        !row.staff_found
          ? <Pill label="No staff match" tone="warning" small />
          : payable > 0
            ? <Metric value={inr(payable)} size={font.body} />
            : <Pill label="No pay" tone="neutral" small />
      }
    />
  );
}

/* Loading — the month total block, then member rows. Same footprint as the real screen so
 * nothing reflows when figures land. */
function RosterSkeleton() {
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
        <Skeleton width={120} height={10} />
        <Skeleton width="60%" height={30} />
        <Skeleton width={150} height={20} radius={radius.pill} />
      </View>
      <View style={[surface, { gap: spacing.lg }]}>
        {[0, 1, 2, 3].map((i) => (
          <Row key={i}>
            <Skeleton width={40} height={40} radius={40 / 2.6} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton width="52%" height={12} />
              <Skeleton width="34%" height={10} />
            </View>
            <Skeleton width={64} height={14} />
          </Row>
        ))}
      </View>
    </View>
  );
}
