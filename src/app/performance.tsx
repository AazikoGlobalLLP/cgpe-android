import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import { EmptyState, Meter, Skeleton } from '@/ui/feedback';
import { KpiStrip, Pill } from '@/ui/data';
import type { KpiItem } from '@/ui/data';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { fmtDay } from '@/lib/format';
import * as api from '@/data/api';
import type { TaskReport, TaskReportMember, TaskReportResult } from '@/data/api';
import { useAuth } from '@/store/auth';
import { canSeeTeamPerformance } from '@/store/roles';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Performance — the completed-tasks report + monthly score (PHASE-45).
 *
 * TWO VIEWS, ONE SCREEN, owner-locked (2026-08-15):
 *   • SELF (default, `/performance`)          — every member sees their OWN score. No gate; the
 *     server self-scopes `?scope=own` to the token, so nobody reads another's score this way.
 *   • TEAM (`/performance?view=team`)          — the whole roster, MASTER-ONLY. Gated on the REAL
 *     `super_admin` role via `canSeeTeamPerformance` (never the folded tier — an admin/leader must
 *     not see everyone's score; the Phase-40 rule). `?scope=all`.
 *
 * THE SERVER OWNS THE SCORE. Every count and the 0–100 score come from `GET /team/task-report`
 * (Backend Phase 53), computed from the owner-locked rules (manager-assigned + actually-completed
 * only; importance×timeliness; per due-month). This screen RENDERS them — it never recomputes
 * (rule 2). `score:null` means "no counted tasks" and is shown as an em dash + a plain line, never
 * a fabricated 0%. On-time vs late is a fact from the server, so it is the only thing coloured.
 * ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type MonthOpt = { key: string; label: string; short: string; year: number };

/** Last 12 months, newest first — built ONCE in a lazy initialiser (a bare `new Date()` in render
 *  trips `react-hooks/purity`, Phase 15). `key` is the `?month=YYYY-MM` the endpoint takes. */
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

/** Priority pill tone — importance, not judgement: P1 highest. Unknown/absent → no pill. */
const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = { P1: 'danger', P2: 'warning', P3: 'neutral' };

export default function Performance() {
  const c = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const params = useLocalSearchParams<{ view?: string }>();
  const teamView = params.view === 'team';
  const { user, ready } = useAuth();
  // Team roster is Master-only; the real-role gate, never the folded tier (Phase 40/45).
  const isMaster = canSeeTeamPerformance(user);

  const [months] = useState(lastTwelveMonths);
  const [sel, setSel] = useState(0);
  const [res, setRes] = useState<TaskReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const period = months[sel];
  const isCurrentMonth = sel === 0;                     // still-running month — provisional

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async (opts: { refresh?: boolean; current?: () => boolean } = {}) => {
    // A non-master must never even request the whole-team roster.
    if (teamView && !isMaster) { setLoading(false); return; }
    if (opts.refresh) setRefreshing(true);
    const r = await api.getTaskReport(period.key, teamView ? { scope: 'all' } : { scope: 'own' });
    if (!alive.current || (opts.current && !opts.current())) return;
    setRes(r);
    setLoading(false);
    setRefreshing(false);
  }, [period.key, teamView, isMaster]);

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

  const report: TaskReport | null = res?.status === 'ok' ? res.report : null;
  const title = teamView ? 'Team performance' : 'My performance';

  // Gate the team roster before the skeleton, waiting for `ready` so a real master is not flashed
  // the refusal during session restore (the agent-map pattern).
  if (teamView && ready && !isMaster) {
    return (
      <Screen>
        <Header title={title} back />
        <EmptyState
          icon="lock-closed-outline"
          title="Owner access only"
          subtitle="The whole team's performance is visible to the owner (master admin). You can see your own from More → My performance."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={title} subtitle={loading ? 'Loading' : period.label} back />

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
          <PerfSkeleton team={teamView} />
        ) : res?.status !== 'ok' ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="We couldn't load performance"
            subtitle={health.degraded
              ? 'The report service could not be reached, so this is blank rather than empty. Pull down or retry.'
              : 'We could not load performance for this month. Pull down or retry.'}
            action={{ label: t('common.tryAgain'), onPress: retry }}
          />
        ) : teamView ? (
          <TeamReport report={report!} isCurrentMonth={isCurrentMonth} />
        ) : (
          <SelfReport member={report!.members[0] ?? null} isCurrentMonth={isCurrentMonth} monthLabel={period.label} />
        )}
      </ScrollView>
    </Screen>
  );
}

/* ---------------- Self view: the caller's own row (server self-scoped) ---------------- */
function SelfReport({ member, isCurrentMonth, monthLabel }: { member: TaskReportMember | null; isCurrentMonth: boolean; monthLabel: string }) {
  const c = useTheme();
  const counts = member?.counts;
  const noTasks = !member || member.score === null || (counts?.assigned ?? 0) === 0;

  const kpis = useMemo<KpiItem[]>(() => [
    { label: 'Assigned', value: String(counts?.assigned ?? 0), icon: 'clipboard', tone: 'primary' },
    { label: 'Completed', value: String(counts?.completed ?? 0), icon: 'checkmark-circle', tone: (counts?.completed ?? 0) > 0 ? 'success' : 'neutral' },
    { label: 'On time', value: String(counts?.onTime ?? 0), icon: 'time', tone: (counts?.onTime ?? 0) > 0 ? 'success' : 'neutral' },
    { label: 'Late', value: String(counts?.late ?? 0), icon: 'alert-circle', tone: (counts?.late ?? 0) > 0 ? 'warning' : 'neutral' },
  ], [counts]);

  if (noTasks) {
    return (
      <EmptyState
        icon="clipboard-outline"
        title={`No assigned tasks for ${monthLabel}`}
        subtitle="This score counts tasks a manager assigned to you and you completed. There are none for this month yet, so there is no score to show."
      />
    );
  }

  return (
    <>
      <Appear index={0}>
        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Eyebrow>{`Performance · ${monthLabel}`}</Eyebrow>
            {isCurrentMonth ? <Pill label="so far this month" tone="warning" small /> : null}
          </Row>
          <ScoreHero score={member!.score} />
          <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.md }} numberOfLines={3}>
            Scored by the server from the tasks a manager assigned you: more important tasks and finishing on time count for more. Cancelled tasks, reminders and your own to-dos do not count.
          </Txt>
        </Card>
      </Appear>

      <Appear index={1}>
        <KpiStrip items={kpis} contentStyle={{ paddingHorizontal: spacing.lg }} style={{ marginHorizontal: -spacing.lg }} />
      </Appear>

      <Appear index={2}>
        <View>
          <SectionHeader title="Completed this month" />
          <CompletedList tasks={member!.completedTasks} />
        </View>
      </Appear>
    </>
  );
}

/* ---------------- Team view: the whole roster, master-only ---------------- */
function TeamReport({ report, isCurrentMonth }: { report: TaskReport; isCurrentMonth: boolean }) {
  const c = useTheme();
  const { members, totals } = report;

  if (members.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No performance yet this month"
        subtitle="No manager-assigned tasks have been recorded for anyone this month, so there is nothing to score."
      />
    );
  }

  return (
    <>
      <Appear index={0}>
        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>Team totals</Eyebrow>
            {isCurrentMonth ? <Pill label="so far this month" tone="warning" small /> : null}
          </Row>
          <Row style={{ gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' }}>
            <Stat label="Members" value={String(totals.members)} />
            <Stat label="Completed" value={String(totals.completed)} tone="success" />
            <Stat label="On time" value={String(totals.onTime)} tone="success" />
            <Stat label="Late" value={String(totals.late)} tone="warning" />
          </Row>
        </Card>
      </Appear>

      {members.map((m, i) => (
        <Appear index={Math.min(i + 1, 6)} key={m.userId || m.name || String(i)}>
          <MemberCard member={m} />
        </Appear>
      ))}
      <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.xs }} numberOfLines={2}>
        Score counts only manager-assigned tasks that were completed — cancelled tasks, reminders and self-created tasks are excluded. Ranked highest first.
      </Txt>
    </>
  );
}

/** One member: score + counts, tap to expand their completed tasks. */
function MemberCard({ member }: { member: TaskReportMember }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const { counts } = member;
  const sub = [member.role, member.department].filter(Boolean).join(' · ');
  const canExpand = member.completedTasks.length > 0;

  return (
    <Card style={{ gap: spacing.sm }}>
      <Pressable
        onPress={canExpand ? () => { haptics.select(); setOpen((o) => !o); } : undefined}
        accessibilityRole={canExpand ? 'button' : undefined}
        accessibilityState={canExpand ? { expanded: open } : undefined}
        accessibilityLabel={`${member.name}, score ${member.score === null ? 'no tasks' : member.score}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={font.body} weight="700" numberOfLines={1}>{member.name || 'Unnamed'}</Txt>
          {sub ? <Txt size={font.cap} color={c.muted} numberOfLines={1} style={{ marginTop: 2 }}>{sub}</Txt> : null}
        </View>
        <ScoreBadge score={member.score} />
        {canExpand ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.faint} /> : null}
      </Pressable>

      <Row style={{ gap: spacing.xs, flexWrap: 'wrap' }}>
        <Pill label={`${counts.completed}/${counts.assigned} done`} tone="primary" small />
        {counts.onTime > 0 ? <Pill label={`${counts.onTime} on time`} tone="success" small /> : null}
        {counts.late > 0 ? <Pill label={`${counts.late} late`} tone="warning" small /> : null}
        {counts.notCompleted > 0 ? <Pill label={`${counts.notCompleted} open`} tone="neutral" small /> : null}
      </Row>

      {open ? (
        <View style={{ marginTop: spacing.xs }}>
          <CompletedList tasks={member.completedTasks} />
        </View>
      ) : null}
    </Card>
  );
}

/* ---------------- Shared bits ---------------- */

/** The big 0–100 score + a proportional meter. `null` (no tasks) → an em dash, never a 0%. */
function ScoreHero({ score }: { score: number | null }) {
  const c = useTheme();
  if (score === null) {
    return <Metric value="—" size={font.display} style={{ marginTop: 4 }} />;
  }
  return (
    <View style={{ marginTop: 4, gap: spacing.sm }}>
      <Row style={{ alignItems: 'baseline', gap: 4 }}>
        <Metric value={String(score)} size={font.display} />
        <Txt size={font.h3} color={c.muted} numeric>/ 100</Txt>
      </Row>
      <Meter value={score / 100} label="Score" valueLabel={`${score} / 100`} />
    </View>
  );
}

/** Compact score for a roster row. `null` → "No tasks". */
function ScoreBadge({ score }: { score: number | null }) {
  const c = useTheme();
  if (score === null) {
    return <Txt size={font.cap} color={c.faint} numeric>No tasks</Txt>;
  }
  return (
    <Row style={{ alignItems: 'baseline', gap: 2 }}>
      <Metric value={String(score)} size={font.h2} />
      <Txt size={font.tiny} color={c.faint} numeric>/100</Txt>
    </Row>
  );
}

/** A stat cell for the team totals card. */
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' }) {
  const c = useTheme();
  const col = tone === 'success' ? c.success : tone === 'warning' ? c.warning : c.text;
  return (
    <View>
      <Txt size={font.cap} color={c.muted}>{label}</Txt>
      <Metric value={value} size={font.h2} style={{ marginTop: 2, color: col }} />
    </View>
  );
}

/** The completed-tasks list (shared by self + expanded member). Server order = newest first. */
function CompletedList({ tasks }: { tasks: TaskReportMember['completedTasks'] }) {
  const c = useTheme();
  if (tasks.length === 0) {
    return <Txt size={font.sub} color={c.muted}>No completed tasks recorded.</Txt>;
  }
  return (
    <Card style={{ gap: spacing.md }}>
      {/* `task`, not `t`: the screen above binds the translator as `t` (i18n batch 2). This
          component has no translator yet, but the 'On time'/'Late' pill below is next in line for
          copy, and a map item named `t` is exactly the shadowing trap that would silently break it. */}
      {tasks.map((task, i) => (
        <View key={task.id || String(i)} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: spacing.md } : undefined}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
            <Txt size={font.sub} weight="600" numberOfLines={2} style={{ flex: 1 }}>{task.title}</Txt>
            <Pill label={task.onTime ? 'On time' : 'Late'} tone={task.onTime ? 'success' : 'warning'} small />
          </Row>
          <Row style={{ gap: spacing.xs, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {task.priority && PRIORITY_TONE[task.priority] ? <Pill label={task.priority} tone={PRIORITY_TONE[task.priority]} small /> : null}
            <Txt size={font.tiny} color={c.faint} numeric>
              {[task.dueAt ? `Due ${fmtDay(task.dueAt)}` : null, task.completedAt ? `Done ${fmtDay(task.completedAt)}` : null].filter(Boolean).join('  ·  ')}
            </Txt>
          </Row>
        </View>
      ))}
    </Card>
  );
}

/* Horizontal strip of the last 12 months, current first — same control earnings.tsx uses. */
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

/* Loading — matches the real footprint so nothing reflows when data lands. */
function PerfSkeleton({ team }: { team: boolean }) {
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
        <Skeleton width="48%" height={32} />
        <Skeleton width="100%" height={10} radius={radius.pill} />
      </View>
      {team ? (
        [0, 1, 2].map((i) => (
          <View key={i} style={[surface, { gap: spacing.sm }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Skeleton width="40%" height={14} />
              <Skeleton width={54} height={20} />
            </Row>
            <Skeleton width="70%" height={12} />
          </View>
        ))
      ) : (
        <Row style={{ gap: spacing.sm }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} width={92} height={46} radius={radius.md} />)}
        </Row>
      )}
    </View>
  );
}
