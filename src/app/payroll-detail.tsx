import { resolveCopy, type LocalCopy } from '@/i18n/copy';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import { EmptyState, Meter, Skeleton } from '@/ui/feedback';
import { KpiStrip, Pill } from '@/ui/data';
import type { KpiItem } from '@/ui/data';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { fmtDay, inr } from '@/lib/format';
import * as api from '@/data/api';
import type { PayrollProfile, PayrollProfileResult, PayrollRow, TaskReportMember, TaskReportResult } from '@/data/api';
import { maskAccountNumber } from '@/data/payroll';
import { useAuth } from '@/store/auth';
import { canSeeTeamPerformance } from '@/store/roles';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Payroll detail — ONE employee's pay breakdown + task activity for a month (PHASE-67).
 *
 * Reached from the Payroll roster (payroll.tsx) by tapping a member. It answers the owner's
 * question "show me each employee and HOW their pay was reached, and what they did." Two blocks:
 *   • PAY BREAKDOWN — the server's own `/compute` figures for this member+month, rendered
 *     verbatim (segment, salary, per-day / hourly rate, worked hours, the working-days
 *     derivation, payable). THE APP NEVER MULTIPLIES a rate (CLAUDE.md money rule) — every
 *     number here is computed server-side; the only on-device arithmetic is `absent = working −
 *     present`, a subtraction of DAYS, exactly as earnings.tsx does.
 *   • ACTIVITY — the member's completed tasks this month, via the Phase-45 task report. This is
 *     master-only data, so the block is gated on the REAL `super_admin` role (canSeeTeamPerformance,
 *     never the folded tier) and uses the same proven `{scope:'all'}` call the team-performance
 *     screen makes, then picks this member out of the roster client-side. An admin (non-master)
 *     sees the pay breakdown but not the activity.
 *   • ESSENTIAL DETAILS (POINT 13) — shift timing + bank details (beneficiary / bank / account /
 *     IFSC) from `GET /payroll/profiles/:userId`, MASTER-ONLY (owner decision 2026-08-25). The
 *     account number is MASKED to the last 4 with tap-to-reveal; Aadhaar & PAN are NEVER shown or
 *     even stored — `getPayrollProfile` drops them before they reach app state. Each blank field
 *     reads "pending", so a half-filled profile is honest rather than a confident blank.
 *
 * DOUBLE-GATED, like payroll.tsx. The pay data comes from the admin-only `/compute`; a leader
 * (folded into the mobile "admin" tier but 403'd by the backend) must see an honest refusal, not
 * a blank. So this screen re-checks the real admin role before it fetches.
 * ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEGMENT_LABEL: Record<string, string> = { day_wise: 'pay.dayWise', hourly: 'pay.hourly', base: 'pay.base' };
const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = { P1: 'danger', P2: 'warning', P3: 'neutral' };

/** Nothing from a wire body is trusted to be a finite number. */
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** Worked hours to one decimal, e.g. "170.5". */
const hrs = (v: number): string => (Math.round(v * 10) / 10).toString();

/**
 * The activity block's outcome, kept DISTINCT from "member has no tasks" — a failed task-report
 * read (5xx / timeout / the deploy-gap 404) must never render as a confident "nothing completed"
 * (CLAUDE.md rule 4, empty ≠ could-not-load; the sibling performance.tsx keeps the same split).
 *   • skipped — the viewer is not a master, so no activity is fetched or shown.
 *   • ok      — the report loaded; `member` may be null (this person had no counted tasks).
 *   • error   — the report failed to load; show an honest could-not-load line, not an empty list.
 */
type ActivityState =
  | { status: 'skipped' }
  | { status: 'ok'; member: TaskReportMember | null }
  | { status: 'error' };

/**
 * The master-only "essential details" outcome — shift + bank (Point 13). Kept DISTINCT the same way
 * ActivityState is: a failed profile read (5xx / timeout) must not read as "no bank details on file".
 *   • skipped — the viewer is not a master, so nothing is fetched or shown.
 *   • missing — the member has no payroll profile (404) → an honest "profile pending" note.
 *   • ok      — the profile loaded; individual fields may still be blank ("pending" per field).
 *   • error   — the read failed; show a could-not-load line, not an empty panel.
 */
type EssentialState =
  | { status: 'skipped' }
  | { status: 'missing' }
  | { status: 'ok'; profile: PayrollProfile }
  | { status: 'error' };

export default function PayrollDetail() {
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { user, ready } = useAuth();
  const params = useLocalSearchParams<{ user_id?: string; name?: string; nameCopy?: string; year?: string; month?: string }>();

  const userId = String(params.user_id ?? '');
  const paramName = typeof params.name === 'string' ? params.name : '';
  const paramNameCopy = useMemo<LocalCopy | undefined>(() => {
    if (typeof params.nameCopy !== 'string') return undefined;
    try {
      const value: unknown = JSON.parse(params.nameCopy);
      if (!value || typeof value !== 'object' || !('key' in value) || typeof value.key !== 'string') return undefined;
      if (!('params' in value) || value.params === undefined) return { key: value.key };
      if (!value.params || typeof value.params !== 'object' || Array.isArray(value.params)) return undefined;
      if (!Object.values(value.params).every(v => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))) return undefined;
      return { key: value.key, params: value.params as Record<string, string | number> };
    } catch { return undefined; }
  }, [params.nameCopy]);
  // The month is passed from the roster so the detail shows exactly the row the user tapped.
  const now = useRef(new Date()).current;
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;                 // 1-based, matches ?month=
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthLabel = `${MONTHS[Math.min(Math.max(month - 1, 0), 11)]} ${year}`;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isMaster = canSeeTeamPerformance(user);                            // real super_admin, for activity

  const [row, setRow] = useState<PayrollRow | null | 'missing'>(null);     // null = loading/error, 'missing' = not in roster
  const [activity, setActivity] = useState<ActivityState>({ status: 'skipped' });
  const [essential, setEssential] = useState<EssentialState>({ status: 'skipped' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async (opts: { refresh?: boolean; current?: () => boolean } = {}) => {
    if (!isAdmin) { setLoading(false); return; }                           // never call the admin endpoint as a non-admin
    if (opts.refresh) setRefreshing(true);
    // Pay from the admin roster (find this member); activity + bank/shift essentials only if a real
    // master (proven scope=all; bank details are master-only per the owner's Point-13 decision).
    const [roster, report, prof] = await Promise.all([
      api.getPayrollRoster(year, month),
      isMaster ? api.getTaskReport(monthKey, { scope: 'all' }) : Promise.resolve<TaskReportResult | null>(null),
      isMaster ? api.getPayrollProfile(userId) : Promise.resolve<PayrollProfileResult>({ status: 'error' }),
    ]);
    if (!alive.current || (opts.current && !opts.current())) return;
    if (roster === null) {
      setRow(null);                                                        // load failed → error state (health banner carries why)
    } else {
      const found = roster.find((r) => String(r.user_id) === userId) ?? null;
      setRow(found ?? 'missing');
    }
    // Essential details (master-only). A 404 is "no profile yet", not an outage; keep it distinct
    // from a read error so a blank never reads as a confident "no bank details".
    if (!isMaster) {
      setEssential({ status: 'skipped' });
    } else if (prof.status === 'ok') {
      setEssential({ status: 'ok', profile: prof.profile });
    } else if (prof.status === 'missing') {
      setEssential({ status: 'missing' });
    } else {
      setEssential({ status: 'error' });
    }
    // Keep "report failed" distinct from "member did nothing" — a null-from-error would otherwise
    // render as a confident empty list (the deploy-gap 404 is silent, so this is the only signal).
    if (!isMaster) {
      setActivity({ status: 'skipped' });
    } else if (report && report.status === 'ok') {
      setActivity({ status: 'ok', member: report.report.members.find((m) => String(m.userId) === userId) ?? null });
    } else {
      setActivity({ status: 'error' });
    }
    setLoading(false);
    setRefreshing(false);
  }, [isAdmin, isMaster, year, month, monthKey, userId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load({ current: () => active });
    return () => { active = false; };
  }, [load]));

  const retry = useCallback(() => { haptics.tap(); setLoading(true); void load(); }, [load]);

  // Hooks run unconditionally, ahead of every branch below.
  const rowData = row !== null && row !== 'missing' ? row : null;
  const m = rowData?.months?.[0];
  const payable = num(rowData?.payable);
  const shownPayable = useCountUp(payable);
  const present = num(m?.present_days);
  const workingDays = num(m?.working_days);
  const absent = Math.max(0, workingDays - present);                       // DAYS subtraction — never money
  const workedHours = num(m?.worked_hours);
  const perDayRate = m && typeof m.per_day_rate === 'number' ? m.per_day_rate : null;
  const hourlyRate = m && typeof m.hourly_rate === 'number' ? m.hourly_rate : null;
  const salary = num(rowData?.salary_amount);
  const segLabel = rowData ? (SEGMENT_LABEL[rowData.segment] ? t(SEGMENT_LABEL[rowData.segment]) : rowData.segment) : '';
  const displayName = rowData?.name ? resolveCopy(t, rowData.name, rowData.nameCopy)
    : paramName ? resolveCopy(t, paramName, paramNameCopy) : userId || t('pay.member');

  const kpis = useMemo<KpiItem[]>(() => [
    { label: t('pay.present'), value: String(present), icon: 'checkmark-circle', tone: present > 0 ? 'success' : 'neutral' },
    { label: t('pay.payableDays'), value: `${present}/${workingDays}`, icon: 'calendar', tone: 'primary' },
    { label: t('pay.absent'), value: String(absent), icon: 'close-circle', tone: absent > 0 ? 'danger' : 'neutral' },
    { label: t('pay.workedHours'), value: hrs(workedHours), icon: 'time', tone: 'neutral' },
  ], [present, workingDays, absent, workedHours, t]);

  // Belt-and-braces: the roster row that launched us already gated on the real role, but a leader
  // deep-linking here (mobile tier folds leader into "admin") must see an honest refusal.
  if (ready && !isAdmin) {
    return (
      <Screen>
        <Header title={t('payroll.title')} back />
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon="lock-closed-outline"
            title={t('payroll.restricted')}
            subtitle={t('payroll.restrictedBody')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={displayName} subtitle={loading ? t('payroll.loadingPay') : monthLabel} back />

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
        {loading ? (
          <DetailSkeleton />
        ) : row === 'missing' ? (
          <EmptyState
            icon="person-outline"
            title={t('payroll.noProfilePeriod', { period: monthLabel })}
            subtitle={t('payroll.noProfileBody')}
          />
        ) : row === null ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t('payroll.memberLoadFailed')}
            subtitle={health.degraded
              ? t('earnings.unconfirmed')
              : t('payroll.memberMonthFailed')}
            action={{ label: t('common.tryAgain'), onPress: retry }}
          />
        ) : (
          <>
            {/* ---------------- Headline payable ---------------- */}
            <Appear index={0}>
              <Card>
                <Eyebrow>{t('payroll.payablePeriod', { period: monthLabel })}</Eyebrow>
                <View accessible accessibilityLabel={t('payroll.payableA11y', { amount: inr(payable), name: displayName, period: monthLabel })}>
                  <Metric value={inr(shownPayable)} size={font.display} style={{ marginTop: 4 }} />
                </View>
                <Txt size={font.sub} color={c.muted} numeric style={{ marginTop: 6 }} numberOfLines={1}>
                  {[segLabel,
                    hourlyRate != null ? t('pay.ratePerHour', { amount: inr(hourlyRate) })
                      : perDayRate != null ? t('pay.ratePerDay', { amount: inr(perDayRate) }) : null,
                  ].filter(Boolean).join('  ·  ')}
                </Txt>
                <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.md }} numberOfLines={2}>
                  {t('payroll.memberGrossNote')}
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
                  <Meter value={present / workingDays} label={t('pay.payableDays')} valueLabel={t('pay.amountOfTotal', { amount: present, total: workingDays })} />
                </Card>
              </Appear>
            ) : null}

            {/* ---------------- How this pay was reached ---------------- */}
            <Appear index={3}>
              <View>
                <SectionHeader title={t('pay.basis')} />
                <Card style={{ gap: spacing.md }}>
                  <Fact label={t('filter.segment')} value={segLabel} />
                  {salary > 0 ? <Fact label={t('pay.monthlySalary')} value={inr(salary)} /> : null}
                  {hourlyRate != null ? <Fact label={t('pay.hourlyRate')} value={t('pay.ratePerHour', { amount: inr(hourlyRate) })} /> : null}
                  {perDayRate != null ? <Fact label={t('pay.perDayRate')} value={t('pay.ratePerDay', { amount: inr(perDayRate) })} /> : null}
                  {rowData && typeof rowData.office_hours === 'number'
                    ? <Fact label={t('pay.officeHours')} value={t('pay.hoursValue', { hours: hrs(rowData.office_hours) })} /> : null}
                  <Fact label={t('pay.presentDays')} value={t('pay.amountOfTotal', { amount: present, total: workingDays })} />
                  <Fact label={t('pay.workedHours')} value={t('pay.hoursValue', { hours: hrs(workedHours) })} />
                </Card>
              </View>
            </Appear>

            {/* ---------------- Working-days derivation (server-computed; shown, never recomputed) ---------------- */}
            {m && typeof m.days === 'number' ? (
              <Appear index={4}>
                <View>
                  <SectionHeader title={t('pay.workingDays')} />
                  <Card style={{ gap: spacing.md }}>
                    <Fact label={t('pay.calendarDays')} value={String(num(m.days))} />
                    {typeof m.sundays === 'number' ? <Fact label={t('pay.sundaysOff')} value={String(num(m.sundays))} /> : null}
                    {typeof m.holidays === 'number' ? <Fact label={t('notice.holidayGroup')} value={String(num(m.holidays))} /> : null}
                    <Fact label={t('pay.workingDays')} value={String(workingDays)} />
                    <Txt size={font.tiny} color={c.faint} numberOfLines={2}>
                      {t('pay.workingDaysNote')}</Txt>
                  </Card>
                </View>
              </Appear>
            ) : null}

            {/* ---------------- Essential details: shift + bank (master-only, Point 13) ---------------- */}
            {isMaster ? (
              <Appear index={5}>
                <View>
                  <SectionHeader title={t('payroll.essential')} />
                  {essential.status === 'error' ? (
                    <Card>
                      <Txt size={font.sub} color={c.muted} numberOfLines={3}>
                        {health.degraded
                          ? t('payroll.essentialUnconfirmed')
                          : t('payroll.essentialFailed')}
                      </Txt>
                    </Card>
                  ) : essential.status === 'missing' ? (
                    <Card>
                      <Txt size={font.sub} color={c.muted} numberOfLines={3}>
                        {t('payroll.essentialPending')}</Txt>
                    </Card>
                  ) : essential.status === 'ok' ? (
                    <EssentialDetails profile={essential.profile} />
                  ) : null}
                </View>
              </Appear>
            ) : null}

            {/* ---------------- Activity (master-only) ---------------- */}
            {isMaster ? (
              <Appear index={6}>
                <View>
                  <SectionHeader title={t('performance.completedMonth')} />
                  {activity.status === 'error' ? (
                    <Card>
                      <Txt size={font.sub} color={c.muted} numberOfLines={3}>
                        {health.degraded
                          ? t('payroll.activityUnconfirmed')
                          : t('payroll.activityFailed')}
                      </Txt>
                    </Card>
                  ) : (
                    <CompletedList tasks={activity.status === 'ok' ? (activity.member?.completedTasks ?? []) : []} />
                  )}
                </View>
              </Appear>
            ) : null}
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

/* A "label … value" line for the essential-details panel that renders an amber "Pending" pill when
 * the value is blank — so a half-filled profile reads honestly rather than as an empty value. A
 * `children` slot lets the account row supply its own masked/reveal control. */
function EssentialFact({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  const t = useT();
  const c = useTheme();
  const has = value != null && value.trim().length > 0;
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
      <Txt size={font.sub} color={c.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Txt>
      {children ? children : has ? <Metric value={value!} size={font.body} /> : <Pill label={t('claims.pending')} tone="warning" small />}
    </Row>
  );
}

/* The account number: masked to its last 4 by default, tap to reveal (owner decision — bank details
 * to the master only, account masked). A blank account shows the "Pending" pill like any other field.
 * The raw number is only ever displayed on the master's explicit tap; it is never persisted. */
function AccountReveal({ account }: { account?: string }) {
  const t = useT();
  const c = useTheme();
  const [revealed, setRevealed] = useState(false);
  const acct = (account ?? '').trim();
  if (!acct) return <EssentialFact label={t('payroll.accountNo')} />;
  return (
    <EssentialFact label={t('payroll.accountNo')}>
      <Pressable
        onPress={() => { haptics.tap(); setRevealed((v) => !v); }}
        accessibilityRole="button"
        accessibilityLabel={revealed ? t('payroll.hideAccount') : t('payroll.revealAccount')}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <Metric value={revealed ? acct : maskAccountNumber(acct)} size={font.body} />
        <Txt size={font.tiny} color={c.primary} weight="700">{revealed ? t('payroll.hide') : t('payroll.reveal')}</Txt>
      </Pressable>
    </EssentialFact>
  );
}

/* Shift timing + bank details for the master (Point 13). Salary/segment already live in "Pay basis",
 * so this panel adds only what isn't shown there: the shift window and the four bank fields. Aadhaar
 * and PAN are never included — getPayrollProfile drops them before they reach app state. */
function EssentialDetails({ profile }: { profile: PayrollProfile }) {
  const t = useT();
  const c = useTheme();
  const st = profile.shift_timing;
  const shift = st && (st.start || st.end) ? `${st.start ?? '—'}–${st.end ?? '—'}` : '';
  return (
    <Card style={{ gap: spacing.md }}>
      <EssentialFact label={t('payroll.shift')} value={shift} />
      <EssentialFact label={t('payroll.accountHolder')} value={profile.beneficiary_name} />
      <EssentialFact label={t('payroll.bank')} value={profile.bank_name} />
      <AccountReveal account={profile.account_no} />
      <EssentialFact label="IFSC" value={profile.ifsc_code} />
      <Txt size={font.tiny} color={c.faint} numberOfLines={2}>
        {t('payroll.bankPrivacy')}</Txt>
    </Card>
  );
}

/* The member's completed tasks this month — the same shape performance.tsx renders. Server order
 * is newest first. Empty (or no activity fetched) → an honest "none recorded" line. */
function CompletedList({ tasks }: { tasks: TaskReportMember['completedTasks'] }) {
  const tr = useT();
  const c = useTheme();
  if (tasks.length === 0) {
    return <Txt size={font.sub} color={c.muted}>{tr('performance.noCompletedMonth')}</Txt>;
  }
  return (
    <Card style={{ gap: spacing.md }}>
      {tasks.map((t, i) => (
        <View key={t.id || String(i)} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: spacing.md } : undefined}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
            <Txt size={font.sub} weight="600" numberOfLines={2} style={{ flex: 1 }}>{t.title}</Txt>
            <Pill label={t.onTime ? tr('performance.onTime') : tr('performance.late')} tone={t.onTime ? 'success' : 'warning'} small />
          </Row>
          <Row style={{ gap: spacing.xs, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {t.priority && PRIORITY_TONE[t.priority] ? <Pill label={t.priority} tone={PRIORITY_TONE[t.priority]} small /> : null}
            <Txt size={font.tiny} color={c.faint} numeric>
              {[t.dueAt ? tr('common.dueOn', { date: fmtDay(t.dueAt) }) : null, t.completedAt ? tr('performance.doneDate', { date: fmtDay(t.completedAt) }) : null].filter(Boolean).join('  ·  ')}
            </Txt>
          </Row>
        </View>
      ))}
    </Card>
  );
}

/* Loading — same footprint as the real screen (hero, four chips, meter, two fact cards) so nothing
 * reflows when the figures land. */
function DetailSkeleton() {
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
