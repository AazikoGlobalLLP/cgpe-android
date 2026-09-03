import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
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
import type { TeamMember } from '@/data/team';
import { mergePayrollRoster, payrollRosterStats, type PayrollRosterEntry } from '@/data/payroll';
import { inr } from '@/lib/format';
import { useT } from '@/i18n';

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
 * WHOLE TEAM, DATA-PENDING MADE VISIBLE (POINT 13). `/compute` iterates only members who have a
 * `PayrollProfile`, so the owner saw only the one person with a profile and everyone else looked
 * *dropped*. This screen now left-joins the full staff directory (`getAssignableTeam` → `/profiles`)
 * with the computed roster (pure `mergePayrollRoster`, tested in `data/payroll.ts`): every member
 * appears and anyone without a computed row is flagged "data pending" instead of being absent.
 * Creating the missing profiles is a DATA job (owner/OPS) — no client code conjures a salary that
 * was never entered; this only makes the gap honest and visible.
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
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { user, ready } = useAuth();

  const [months] = useState(lastTwelveMonths);
  const [sel, setSel] = useState(0);                       // index into `months`; 0 = current month
  const [roster, setRoster] = useState<PayrollRow[] | null>(null);
  const [directory, setDirectory] = useState<TeamMember[]>([]);  // full staff list, so pending members show
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
    // Both admin-only calls in parallel: the computed roster (profile-holders) and the full staff
    // directory. `getAssignableTeam` never rejects — it returns [] on failure — so a directory miss
    // degrades to the profile-holders alone, never an error. `roster === null` is the only failure.
    const [rows, dir] = await Promise.all([
      api.getPayrollRoster(period.year, period.month),
      api.getAssignableTeam(),
    ]);
    if (!alive.current || (opts.current && !opts.current())) return;
    setRoster(rows);
    setDirectory(dir);
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

  // The whole-team roster (directory left-joined with the computed rows) and its header figures — the
  // total is a sum of the server's OWN per-member payables, an aggregate of computed figures, never a
  // salary derived on-device. Hooks run unconditionally, ahead of every branch below.
  const merged = useMemo(() => mergePayrollRoster(directory, roster ?? []), [directory, roster]);
  const stats = useMemo(() => payrollRosterStats(merged), [merged]);
  const shownTotal = useCountUp(stats.totalPayable);

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
            action={{ label: t('common.tryAgain'), onPress: retry }}
          />
        ) : merged.length === 0 ? (
          <EmptyState
            icon={health.degraded ? 'cloud-offline-outline' : 'people-outline'}
            title={health.degraded ? 'The staff directory did not load' : 'No team members to show'}
            subtitle={health.degraded
              // The roster computed but the staff directory read failed — this is blank, not empty.
              ? 'The salary figures came through, but the staff directory could not be reached, so this is blank rather than genuinely empty. Pull down to try again.'
              : 'No staff are set up on the payroll roster for this month yet.'}
            action={{ label: t('common.tryAgain'), onPress: retry }}
          />
        ) : (
          <>
            {/* ---------------- Total for the month ---------------- */}
            <Appear index={0}>
              <Card>
                <Eyebrow>{`Total payable · ${period.label}`}</Eyebrow>
                <Metric value={inr(shownTotal)} size={font.display} style={{ marginTop: 4 }} />
                <Row style={{ marginTop: spacing.md, gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Pill label={`${stats.members} ${stats.members === 1 ? 'member' : 'members'}`} tone="neutral" small numeric />
                  {stats.withPay > 0 ? <Pill label={`${stats.withPay} with pay`} tone="success" small numeric /> : null}
                  {stats.pending > 0 ? <Pill label={`${stats.pending} data pending`} tone="warning" small numeric /> : null}
                </Row>
                <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.md }} numberOfLines={3}>
                  {stats.pending > 0
                    ? 'Computed by the server from each member’s attendance (gross, before deductions). Members marked “data pending” have no salary profile yet — an admin sets one up in the panel before their pay can be computed.'
                    : 'Computed by the server from each member’s attendance. Figures are gross, before deductions.'}
                </Txt>
              </Card>
            </Appear>

            {/* ---------------- By member ---------------- */}
            <Appear index={1}>
              <View>
                <SectionHeader title="By member" />
                <ListSection>
                  {merged.map((e, i) => <MemberRow key={`${e.user_id}-${i}`} entry={e} year={period.year} month={period.month} />)}
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

/* One member's row. A member WITH a payroll profile shows their pay segment + present/working days and
 * the server's payable (or "No pay"/"No staff match" rather than a bare ₹0). A member WITHOUT a profile
 * (Point 13) shows their department/role and an amber "Data pending" pill — visible, not dropped.
 * Tapping opens the per-member breakdown for THIS month (Phase 67); the detail screen itself renders
 * an honest "no payroll profile" state for a pending member, so the tap is always safe. */
function MemberRow({ entry, year, month }: { entry: PayrollRosterEntry; year: number; month: number }) {
  const router = useRouter();
  const row = entry.row;
  const m = row?.months?.[0];
  const parts: string[] = [];
  if (row) {
    parts.push(SEGMENT_LABEL[row.segment] ?? row.segment);
    if (m) parts.push(`${num(m.present_days)}/${num(m.working_days)} days`);
  } else if (entry.branch) {
    parts.push(entry.branch);                              // pending: show what we DO know
  } else if (entry.role) {
    parts.push(entry.role);
  }
  const payable = num(row?.payable);
  const open = () => {
    haptics.select();
    router.push({
      pathname: '/payroll-detail',
      params: { user_id: entry.user_id, name: entry.name ?? '', year: String(year), month: String(month) },
    });
  };
  return (
    <PersonRow
      name={entry.name || entry.user_id || 'Member'}
      subtitle={parts.length ? parts.join(' · ') : undefined}
      subtitleNumeric={!!row}
      size={40}
      onPress={open}
      style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
      right={
        entry.pending
          ? <Pill label="Data pending" tone="warning" small />
          : !row?.staff_found
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
