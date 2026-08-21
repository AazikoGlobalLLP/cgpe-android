import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Fab, IconBtn, Segmented } from '@/ui/controls';
import { Banner, EmptyState, ProgressBar, Skeleton, SkeletonCard } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { Pill } from '@/ui/data';
import { SwipeRow } from '@/ui/swipe';
import type { SwipeAction } from '@/ui/swipe';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { SyncChip } from '@/ui/SyncChip';
import { usePendingWrites, useDropNotice, PendingBadge } from '@/ui/pending';
import { setDropNotice } from '@/data/pendingWrites';
import { haptics } from '@/lib/haptics';

import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { capabilitiesOf } from '@/store/roles';
import * as api from '@/data/api';
import { CATEGORY_ICON, Task, TaskStatus, TASK_PRIORITY, TASK_STATUS, dueBucket, taskProgress, todayWorkload } from '@/data/tasks';
import { fmtDay, fmtTime } from '@/lib/format';
import { call } from '@/lib/actions';

/* ------------------------------------------------------------------ *
 * Tasks — the app's centre of gravity.
 *
 * The product pivoted to task-first, so this screen has to answer three questions in the
 * order a field agent asks them:
 *
 *   1. HOW MUCH OF TODAY IS LEFT?   The hero. One figure, counted up when it changes,
 *      because the change IS the information: a task closing should be felt as the number
 *      moving, not discovered by re-reading a static label.
 *   2. WHAT SHOULD I LOOK AT?       The segmented filter. Five exclusive views over the
 *      same list, each with its own honest empty state — "nothing overdue" and "nothing
 *      upcoming" are different facts and must not share one generic message.
 *   3. CAN I CLOSE IT FROM HERE?    Swipe. Walking, one-handed, with the phone in the same
 *      hand holding a file, opening a task to tick it is three interactions too many.
 *
 * NO GRADIENT IN THE HERO. The previous version wrapped this card in the deep hero ramp,
 * which put the app's rationed signature on a surface that is on screen the entire session.
 * The gradient belongs to the clock-in ring and the active tab indicator; here the figure
 * carries the weight instead.
 *
 * EVERY WRITE IS OPTIMISTIC AND REVERSIBLE. The tick lands on the same frame as the touch,
 * but `updateTaskStatus` can come back 403 (the task belongs to someone else). When it
 * does, THAT ROW is put back and a Banner says so. An optimistic UI that cannot un-promise
 * is just a lie with good timing.
 *
 * THREE EMPTY FACTS, THREE MESSAGES. "The server did not answer", "you have no tasks at
 * all" and "nothing sits in this particular view" demand different reactions from the user,
 * so they never share a screen state.
 *
 * READS ARE CANCELLABLE. This is a tab screen: it survives blur, and a focus refetch can
 * overtake a pull-to-refresh already in flight. Every read carries a sequence number and is
 * dropped if a newer read superseded it, if the screen blurred, or if it unmounted — but
 * the spinners are always cleared while mounted, so a cancelled read can never leave a
 * RefreshControl turning forever.
 * ------------------------------------------------------------------ */

type Filter = 'today' | 'overdue' | 'in_progress' | 'upcoming' | 'done';

// `dueBucket` + `todayProgress` now live in @/data/tasks so Home and this screen share one
// definition (and it is unit-tested). Home imports the same pair.

/** One honest message per view. A shared "All clear" would misreport four of the five. */
const EMPTY_COPY: Record<Filter, { icon: IconName; title: string; subtitle: string; add?: boolean }> = {
  today: {
    icon: 'checkmark-done-circle',
    title: 'Nothing due today',
    subtitle: 'Today is clear. Add a task to plan the rest of the day.',
    add: true,
  },
  overdue: {
    icon: 'time-outline',
    title: 'Nothing overdue',
    subtitle: 'Every task from an earlier day has been closed.',
  },
  in_progress: {
    icon: 'play-circle-outline',
    title: 'Nothing in progress',
    subtitle: 'Open a task and start it, and it will be listed here.',
  },
  upcoming: {
    icon: 'calendar-outline',
    title: 'Nothing upcoming',
    subtitle: 'No task is scheduled after today.',
    add: true,
  },
  done: {
    icon: 'trophy-outline',
    title: 'Nothing completed yet',
    subtitle: 'Tasks you close are collected here for the rest of the day.',
  },
};

/* ---------- loading ----------
 * Shaped like the real screen: hero card, filter track, three rows. The layout does not
 * shift when the data lands, which a centred spinner cannot promise. */
function TasksSkeleton() {
  const c = useTheme();
  const { spacing, radius } = c;
  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 10 }}>
            <Skeleton width="38%" height={10} />
            <Skeleton width="52%" height={30} />
            <Skeleton width="46%" height={11} />
          </View>
          <Skeleton width={56} height={24} radius={radius.pill} />
        </Row>
        <Skeleton width="100%" height={8} radius={4} style={{ marginTop: 14 }} />
        <View style={{
          height: StyleSheet.hairlineWidth, backgroundColor: c.hairline,
          marginVertical: spacing.lg, marginHorizontal: -spacing.lg,
        }} />
        <Row style={{ gap: spacing.xl }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, gap: 7 }}>
              <Skeleton width={26} height={19} />
              <Skeleton width="72%" height={10} />
            </View>
          ))}
        </Row>
      </Card>

      <Skeleton width="100%" height={46} radius={radius.pill} />

      <View style={{ gap: 10 }}>
        <SkeletonCard rows={1} />
        <SkeletonCard rows={0} />
        <SkeletonCard rows={1} />
      </View>
    </View>
  );
}

export default function Tasks() {
  const c = useTheme();
  // Phase 30: layout scale comes off the theme so `theme.density` can tighten it per department.
  const { spacing, font } = c;
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { user, viewAs } = useAuth();
  const ownOnly = capabilitiesOf(user, viewAs).tier === 'team';
  // Phase 57a: the offline read-cache key MUST match `getTasks`'s (`own` vs `all` cache apart).
  const tasksKey = `tasks:${ownOnly ? 'own' : 'all'}`;

  const [list, setList] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('today');
  const [notice, setNotice] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);

  /** Latest read wins. Anything older is discarded rather than written over fresher rows. */
  const reqId = useRef(0);
  /** The leak guard. No state is written once the screen is gone. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async (isRefresh = false, focused?: () => boolean) => {
    const my = ++reqId.current;
    if (isRefresh) setRefreshing(true);
    const next = await api.getTasks(ownOnly);
    // Unmounted, or a newer read already owns the state: write nothing at all.
    if (!mounted.current || my !== reqId.current) return;
    // Blurred mid-read: the rows are stale and a refocus refetches, but the spinners still
    // have to come down or the RefreshControl turns forever behind the other tab.
    if (!focused || focused()) setList(next);
    setLoading(false);
    setRefreshing(false);
  }, [ownOnly]);

  useFocusEffect(useCallback(() => {
    let focused = true;
    void load(false, () => focused);
    return () => { focused = false; };
  }, [load]));

  const counts = useMemo(() => {
    const open = list.filter((x) => x.status !== 'done');
    return {
      today: open.filter((x) => dueBucket(x) === 'today').length,
      overdue: open.filter((x) => dueBucket(x) === 'overdue').length,
      in_progress: open.filter((x) => x.status === 'in_progress').length,
      upcoming: open.filter((x) => dueBucket(x) === 'upcoming').length,
      done: list.filter((x) => x.status === 'done').length,
    };
  }, [list]);

  const filtered = useMemo(() => {
    const open = list.filter((x) => x.status !== 'done');
    if (filter === 'done') return list.filter((x) => x.status === 'done');
    if (filter === 'in_progress') return open.filter((x) => x.status === 'in_progress');
    return open.filter((x) => dueBucket(x) === filter);
  }, [list, filter]);

  // PHASE 75 (A2/A1): the headline counts "today's ACTIONABLE work" = due-today ∪ OPEN-overdue, so an
  // overdue item (e.g. a ticket claimed today but dated by its own older open date) shows here
  // instead of reading "0 / nothing scheduled". This matches THIS screen's header ("N due now" =
  // today + overdue) AND Home's clock-in hero, which shares `todayWorkload` so the two never drift.
  const today = useMemo(() => todayWorkload(list), [list]);

  // The one count-up on this screen. It moves only when a task actually closes. Clamp to the
  // (instant) total so that when a reopened task LEAVES today's set — denominator drops at once
  // while the numerator eases down — the card never flashes an impossible "2 / 1" mid-animation.
  const shownDone = Math.min(useCountUp(today.done), today.total);

  // PHASE 57b — offline write queue. Task drafts created offline live in the pending bus (loaded from
  // storage on sign-in, so they survive an app kill); they render here with a "Pending sync" badge,
  // and a one-time drop notice reports any the server later refused. Newest draft on top.
  const pendingTasks = usePendingWrites('task');
  const dropNotice = useDropNotice();
  const pendingCards = useMemo(() => pendingTasks.map(api.taskDraftToTask).reverse(), [pendingTasks]);

  // When a draft flushes (the queue shrinks) the real server task now exists — refetch so it lands as
  // a confirmed row while the pending card drops away in the same pass.
  const prevPending = useRef(pendingTasks.length);
  useEffect(() => {
    if (pendingTasks.length < prevPending.current && !loading) void load(false);
    prevPending.current = pendingTasks.length;
  }, [pendingTasks.length, loading, load]);

  const pickFilter = (next: Filter) => {
    if (next === filter) return;
    haptics.select();
    setNotice(null);
    setFilter(next);
  };

  /**
   * Optimistic status write with a real rollback. Shared by quick-complete and reopen.
   *
   * The rollback restores ONLY this row, functionally. Snapshotting the whole list and
   * restoring it would undo any other tick the user landed while this request was in the
   * air — the failure of one write must never revert a different, successful one.
   */
  const setStatus = async (task: Task, status: TaskStatus, refusedTitle: string) => {
    // Snapshot completedAt too: the optimistic write stamps it now (below) so `todayWorkload`
    // credits the close to today; a rollback must put the prior value (usually undefined) back.
    const before = { status: task.status, steps: task.steps, completedAt: task.completedAt };
    setList((cur) => cur.map((x) => (
      x.id === task.id
        ? {
            ...x, status,
            steps: status === 'done' ? x.steps.map((s) => ({ ...s, done: true })) : x.steps,
            completedAt: status === 'done' ? new Date().toISOString() : undefined,
          }
        : x
    )));

    const res = await api.updateTaskStatus(task.id, status);
    if (!mounted.current) return;

    if (!res.ok) {
      setList((cur) => cur.map((x) => (x.id === task.id ? { ...x, ...before } : x)));
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: refusedTitle,
        message: res.forbidden
          ? 'This task is assigned to someone else, so it cannot be changed from here.'
          : 'The server did not accept the change. Try again in a moment.',
      });
      return;
    }
    haptics.success();
    setNotice(null);
  };

  const quickDone = (task: Task) => setStatus(task, 'done', 'Task was not closed');
  const reopen = (task: Task) => setStatus(task, 'todo', 'Task was not reopened');

  // PHASE 75 (A2): on the default 'today' filter an empty list must not claim "today is clear"
  // while work is overdue — point the user at the Overdue view instead (owner report, 2026-08-21).
  const empty = filter === 'today' && counts.overdue > 0
    ? {
        icon: 'time-outline' as IconName,
        title: 'Nothing due today',
        subtitle: `But ${counts.overdue} ${counts.overdue === 1 ? 'task is' : 'tasks are'} overdue — check the Overdue view.`,
        add: false,
      }
    : EMPTY_COPY[filter];
  // Three different facts, three different messages. An empty list under an outage means
  // "could not load"; an empty BOOK means "nothing has been assigned yet"; an empty view
  // means "this filter has nothing in it". They demand opposite reactions from the user.
  const outage = health.degraded && list.length === 0;
  const bookEmpty = !outage && list.length === 0;

  return (
    <Screen>
      <Header
        title={t('tasks.title')}
        subtitle={`${counts.today + counts.overdue} ${t('tasks.dueNow')} · ${counts.done} ${t('tasks.doneLabel')}`}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg, paddingTop: 4,
          paddingBottom: insets.bottom + 150, gap: spacing.lg,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Phase 57a: shown only when these rows came from the offline cache after a failed refetch. */}
        <SyncChip endpointKey={tasksKey} />

        {/* Phase 57b: a one-time notice for any offline task draft the server later refused (dropped). */}
        {dropNotice ? (
          <Banner
            tone="warning"
            title="An offline task was not saved"
            message={dropNotice}
            onDismiss={() => setDropNotice(null)}
          />
        ) : null}
        {loading ? <TasksSkeleton /> : (
          <>
            {/* HERO — how much of today is left. */}
            <Appear>
              <Card>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Eyebrow>{t('tasks.todayProgress')}</Eyebrow>
                    {today.total > 0 ? (
                      <>
                        <Row style={{ alignItems: 'flex-end', gap: 6, marginTop: 3 }}>
                          <Metric value={String(shownDone)} size={font.display} />
                          <Txt size={font.h3} weight="700" color={c.muted} numeric style={{ marginBottom: 5 }}>
                            / {today.total}
                          </Txt>
                        </Row>
                        <Txt size={font.sub} color={c.muted} numberOfLines={1}>
                          {counts.overdue > 0 ? `done · ${counts.overdue} overdue` : 'tasks done today'}
                        </Txt>
                      </>
                    ) : (
                      <>
                        <Txt size={font.h3} weight="800" style={{ marginTop: 5 }} numberOfLines={1}>
                          Nothing scheduled
                        </Txt>
                        <Txt size={font.sub} color={c.muted} style={{ marginTop: 3 }} numberOfLines={2}>
                          No task is due today.
                        </Txt>
                      </>
                    )}
                  </View>
                  {today.total > 0 ? (
                    <Pill
                      label={`${Math.round(today.pct * 100)}%`}
                      tone={today.pct >= 1 ? 'success' : 'primary'}
                      numeric
                    />
                  ) : null}
                </Row>

                {today.total > 0 ? (
                  <ProgressBar
                    value={today.pct}
                    tone={today.pct >= 1 ? c.success : c.primary}
                    height={8}
                    style={{ marginTop: 14 }}
                  />
                ) : null}

                <View style={{
                  height: StyleSheet.hairlineWidth, backgroundColor: c.hairline,
                  marginVertical: spacing.lg, marginHorizontal: -spacing.lg,
                }} />

                {/* gap 16 against each stat's -8 margin: the hit areas end up exactly
                    adjacent, never overlapping, while the first and last stay optically
                    flush with the card's own padding. */}
                <Row style={{ gap: spacing.lg }}>
                  <HeroStat
                    label={t('tasks.overdue')}
                    value={counts.overdue}
                    tint={counts.overdue > 0 ? c.danger : c.faint}
                    active={filter === 'overdue'}
                    onPress={() => pickFilter('overdue')}
                  />
                  <HeroStat
                    label={t('tasks.inProgress')}
                    value={counts.in_progress}
                    tint={c.primary}
                    active={filter === 'in_progress'}
                    onPress={() => pickFilter('in_progress')}
                  />
                  <HeroStat
                    label={t('tasks.upcoming')}
                    value={counts.upcoming}
                    tint={c.accent}
                    active={filter === 'upcoming'}
                    onPress={() => pickFilter('upcoming')}
                  />
                </Row>
              </Card>
            </Appear>

            {/* Five exclusive views over one list. The track scrolls because five labels
                do not fit a phone, and truncating them would make the filter unreadable. */}
            <Appear index={1}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: spacing.xs }}
              >
                <Segmented<Filter>
                  options={[
                    { key: 'today', label: t('tasks.today') },
                    { key: 'overdue', label: t('tasks.overdue') },
                    { key: 'in_progress', label: t('tasks.inProgress') },
                    { key: 'upcoming', label: t('tasks.upcoming') },
                    { key: 'done', label: t('tasks.doneLabel') },
                  ]}
                  value={filter}
                  onChange={pickFilter}
                />
              </ScrollView>
            </Appear>

            {/* Phase 57b: offline task drafts, pinned above the (server-confirmed) filtered list so
                they stay visible under every filter and never distort the hero/counts, which reflect
                only real tasks. Each is inert — no swipe, no complete, not tappable — until it flushes. */}
            {pendingCards.length > 0 ? (
              <View style={{ gap: 10 }}>
                {pendingCards.map((task, i) => (
                  <TaskCard key={task.id} task={task} index={i} onPress={() => {}} />
                ))}
              </View>
            ) : null}

            {notice ? (
              <Banner
                tone={notice.tone}
                title={notice.title}
                message={notice.message}
                onDismiss={() => setNotice(null)}
              />
            ) : null}

            {filtered.length === 0 ? (
              <Card>
                {outage ? (
                  <EmptyState
                    icon="cloud-offline"
                    title="Tasks did not load"
                    subtitle="The server could not be reached, so this is not a confirmed empty list. Pull down to refresh."
                    action={{ label: 'Retry', onPress: () => load(true) }}
                  />
                ) : bookEmpty ? (
                  <EmptyState
                    icon="clipboard-outline"
                    title="No tasks yet"
                    subtitle="Nothing has been assigned to you, and you have not created anything. Add the first task to start your day."
                    action={{ label: t('tasks.add'), onPress: () => router.push('/task-new') }}
                  />
                ) : (
                  <EmptyState
                    icon={empty.icon}
                    title={empty.title}
                    subtitle={empty.subtitle}
                    action={empty.add ? { label: t('tasks.add'), onPress: () => router.push('/task-new') } : undefined}
                  />
                )}
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {filtered.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    onPress={() => router.push(`/task/${task.id}`)}
                    onDone={() => quickDone(task)}
                    onReopen={() => reopen(task)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Fab
        icon="add"
        label={t('tasks.add')}
        onPress={() => router.push('/task-new')}
        style={{ bottom: insets.bottom + 76 }}
      />
    </Screen>
  );
}

/* ---------- HeroStat ----------
 * A count that is also the way into its view. Making these inert would leave three
 * numbers on the card that answer "how many" and refuse to answer "which ones". */
function HeroStat({ label, value, tint, active, onPress }: {
  label: string; value: number; tint: string; active: boolean; onPress: () => void;
}) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value} tasks`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [{
        flex: 1, minHeight: 44, justifyContent: 'center',
        paddingVertical: 6, paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? c.cardAlt : active ? c.cardAlt : 'transparent',
      }]}
    >
      <Metric value={String(value)} size={19} color={value > 0 ? tint : c.faint} />
      <Txt size={font.tiny} weight="600" color={active ? c.text : c.muted} numberOfLines={1} style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/* ---------- TaskCard ----------
 * Row surface, not a stacked card: a hairline border and a priority rail carry the
 * grouping, so ten of these read as one list rather than ten floating panels.
 *
 * The swipe panel and the visible tick are the SAME action on purpose. Swipe is fast but
 * invisible, so the button is what teaches it exists and what anyone who cannot swipe
 * precisely uses instead. */
export function TaskCard({ task, index = 0, onPress, onDone, onReopen }: {
  task: Task;
  index?: number;
  onPress: () => void;
  onDone?: () => void;
  onReopen?: () => void;
}) {
  const c = useTheme();
  const { spacing, font } = c;
  const t = useT();
  const st = TASK_STATUS[task.status];
  const pr = TASK_PRIORITY[task.priority];
  const prog = taskProgress(task);
  const isDone = task.status === 'done';
  // Phase 57b: a pending (offline-queued) draft is not on the server yet, so it must be inert — no
  // swipe, no complete, no navigation to a detail that can't load — and carry a "Pending sync" badge.
  const isPending = !!task.pending;
  const overdue = dueBucket(task) === 'overdue' && !isDone;
  const prTint = task.priority === 'high' ? c.danger : task.priority === 'medium' ? c.warning : c.faint;
  const stepsDone = task.steps.filter((s) => s.done).length;

  const actions: SwipeAction[] = [];
  if (!isPending && !isDone && onDone) actions.push({ icon: 'checkmark-done', label: 'Done', tone: 'success', onPress: onDone });
  if (!isPending && !isDone && task.clientPhone) {
    actions.push({ icon: 'call', label: t('common.call'), tone: 'primary', onPress: () => { haptics.tap(); call(task.clientPhone!); } });
  }
  if (!isPending && isDone && onReopen) actions.push({ icon: 'arrow-undo', label: 'Reopen', tone: 'warning', onPress: onReopen });

  const due = `${overdue ? 'Overdue · ' : ''}${fmtDay(task.dueDate)} · ${fmtTime(task.dueDate)}${task.client ? ` · ${task.client}` : ''}`;

  return (
    <Appear index={index}>
      <SwipeRow
        actions={actions}
        onPress={onPress}
        style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }}
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: prTint }} />
          <View style={{ flex: 1, padding: 13, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
              <View style={{
                width: 38, height: 38, borderRadius: 12,
                backgroundColor: isDone ? c.successSoft : c.primarySoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons
                  name={(CATEGORY_ICON[task.category] || 'checkbox') as IconName}
                  size={18}
                  color={isDone ? c.success : c.primary}
                />
              </View>

              <View style={{ flex: 1, gap: 3 }}>
                <Txt size={14.5} weight="700" numberOfLines={2}
                  style={{ textDecorationLine: isDone ? 'line-through' : 'none' }}>
                  {task.title}
                </Txt>
                <Txt size={font.cap} color={overdue ? c.danger : c.muted} numeric numberOfLines={1}>
                  {due}
                </Txt>
              </View>

              {!isDone && onDone ? (
                <IconBtn
                  icon="checkmark"
                  size={38}
                  bg={c.successSoft}
                  color={c.success}
                  accessibilityLabel={`Mark ${task.title} done`}
                  onPress={onDone}
                />
              ) : null}
            </View>

            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {isPending ? <PendingBadge /> : <Pill label={st.label} tone={st.tone} small />}
              <Pill label={pr.label} tone={pr.tone} small />
              <Pill label={task.category} tone="neutral" small />
            </Row>

            {task.steps.length > 0 ? (
              <Row style={{ gap: spacing.sm }}>
                <ProgressBar
                  value={prog}
                  tone={prog >= 1 ? c.success : overdue ? c.danger : c.primary}
                  height={5}
                  style={{ flex: 1 }}
                />
                <Txt size={11} weight="700" color={c.faint} numeric>
                  {stepsDone}/{task.steps.length}
                </Txt>
              </Row>
            ) : null}
          </View>
        </View>
      </SwipeRow>
    </Appear>
  );
}
