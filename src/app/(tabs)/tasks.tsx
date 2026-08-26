import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Fab, IconBtn, SearchBar, Segmented } from '@/ui/controls';
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
import { useAppUi } from '@/store/appUi';
import { capabilitiesOf } from '@/store/roles';
import * as api from '@/data/api';
import {
  CATEGORY_ICON, Task, TaskStatus, TaskView, TASK_PRIORITY, TASK_STATUS,
  dueBucket, taskProgress, todayWorkload, todayWorkloadTasks, tasksInRange, groupTasksByDay,
  weekRange, monthRange, searchTasks, monthMatrix, taskCountsByDay,
} from '@/data/tasks';
import type { MonthCell, DayTally } from '@/data/tasks';
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
 *   2. WHAT SHOULD I LOOK AT?       The time toggle (D4, owner 2026-08-22): Today / This week /
 *      This month / Calendar, default Calendar. One list, four windows onto it — Today is the
 *      shared actionable set, week/month group by day, Calendar is a month strip you tap a day
 *      on. Each window has its own honest empty state; "nothing this week" and "this day is
 *      clear" are different facts and must not share one generic message.
 *   3. CAN I CLOSE IT FROM HERE?    Swipe. Walking, one-handed, with the phone in the same
 *      hand holding a file, opening a task to tick it is three interactions too many. Every
 *      view renders the same TaskCard, so complete/reopen work identically in all four.
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

// `dueBucket` + the time-view helpers live in @/data/tasks so Home and this screen share one
// (unit-tested) definition. D4 (owner, 2026-08-22) replaced the five status filters with four
// TIME views — Today / This week / This month / Calendar, default Calendar.

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 24 * 60 * 60 * 1000;
// Band 2 #4: the calendar header names the month in full. English month names match the rest of
// the app's date rendering (`fmtDate`/`fmtDay` show "24 Aug" in every language), so this adds no
// i18n copy debt — dates are not localised anywhere in the app.
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** Local midnight of a date, in ms. India has no DST, so a day window is exactly DAY_MS wide. */
function startOfDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Open tasks first, done last; within each, earliest due first (undated sinks to the end). */
function sortTasks(arr: Task[]): Task[] {
  return arr.slice().sort((a, b) => {
    const ad = a.status === 'done' ? 1 : 0;
    const bd = b.status === 'done' ? 1 : 0;
    if (ad !== bd) return ad - bd;
    const at = new Date(a.dueDate).getTime();
    const bt = new Date(b.dueDate).getTime();
    return (Number.isNaN(at) ? Infinity : at) - (Number.isNaN(bt) ? Infinity : bt);
  });
}

/** A human day header for the week/month day groups. Today/Tomorrow/Yesterday are localised;
 *  other days fall back to a weekday + date (`fmtDay`), which needs no translation. */
function dayHeading(ms: number, t: ReturnType<typeof useT>): string {
  const today = startOfDayMs(new Date());
  if (ms === today) return t('tasks.today');
  if (ms === today + DAY_MS) return t('tasks.tomorrow');
  if (ms === today - DAY_MS) return t('tasks.yesterday');
  return `${WD[new Date(ms).getDay()]}, ${fmtDay(new Date(ms))}`;
}

/** Per-view empty-state icon + whether the state offers an "add task" action. The title/body
 *  strings are resolved with literal `t()` keys at the call site (owner copy, all 5 languages). */
const VIEW_META: Record<TaskView, { icon: IconName; add?: boolean }> = {
  today: { icon: 'checkmark-done-circle', add: true },
  week: { icon: 'calendar-outline' },
  month: { icon: 'calendar-outline' },
  calendar: { icon: 'calendar-clear-outline', add: true },
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
  const { ready: uiReady, can } = useAppUi();
  const caps = capabilitiesOf(user, viewAs);
  const ownOnly = caps.tier === 'team';
  // Phase 57a: the offline read-cache key MUST match `getTasks`'s (`own` vs `all` cache apart).
  const tasksKey = `tasks:${ownOnly ? 'own' : 'all'}`;
  // Band 2 #3 (owner backlog Point 5): move the create refusal to the ENTRY. The backend 403s a
  // team-tier advisor on ANY `POST /team/tasks` (team.js:384 — real role must be admin/leader/
  // super_admin), so inviting them to "Add task" only to fail at submit is the bug. `caps.assignTasks`
  // is the reliable, role-derived mirror of that gate (true ⟺ tier admin/master; respects "view as");
  // it is what actually protects team-tier, because the RBAC `can_create_task` flag fails OPEN when
  // unseeded. ANDing the flag (fail-open until the store is ready) subsumes Home's gate and lets the
  // panel turn create off for an entitled department later.
  const canCreateTask = caps.assignTasks && (uiReady ? can('can_create_task') !== false : true);

  const [list, setList] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // D4: the active time view (default Calendar). Band 2 #4 (owner Point 4): the calendar is now a
  // month GRID — `cursor` is the {year, month} the grid displays (paged with ‹prev/next›) and
  // `selDay` is the tapped day whose tasks list below it. The lazy initialisers open on the current
  // month/today with no Date.now() in render (the react-hooks/purity rule forbids that in the render
  // body; a useState initialiser is exempt, the same pattern the old strip used).
  const [view, setView] = useState<TaskView>('calendar');
  const [selDay, setSelDay] = useState(() => startOfDayMs(new Date()));
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  // `todayMs` marks the current day on the grid (the "today" ring, `isCurrentMonth`, the "Today" jump).
  // It is STATE refreshed on every focus, not a []-memo: a tab screen stays mounted, so a []-memo would
  // freeze "today" at first mount and — since the hero's `todayWorkload(list)` re-reads the clock on each
  // focus refetch — the calendar ring would disagree with the header after the app crosses midnight.
  const [todayMs, setTodayMs] = useState(() => startOfDayMs(new Date()));
  const [notice, setNotice] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);
  // Band 2 #2 (owner backlog Point 2, 2026-08-24): a local, in-memory search over the already-
  // loaded list. Typing here searches the WHOLE list (not just the active time view), so a task
  // in a future month — unreachable from Today/Week/Month — is still findable. The scorer is the
  // one the global Search screen uses (`searchTasks` → `@/lib/searchScore`): typo-, word-order-
  // and phone-tail-tolerant. No network: instant on every keystroke.
  const [query, setQuery] = useState('');

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
    // Re-stamp "today" on each focus so the calendar ring/header stay in step across a midnight
    // crossing. Identical value → React bails, so this is a no-op on the same day.
    setTodayMs(startOfDayMs(new Date()));
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

  // D4 — the four time views over one task list. Each renders real TaskCards (swipe-complete and
  // reopen keep working); week/month are grouped by day, all statuses within the range (a time
  // view shows what is scheduled AND what was closed in the period). Today reuses the shared
  // `todayWorkloadTasks` set, so the list can never disagree with the hero's headline count.
  const todayTasks = useMemo(() => sortTasks(todayWorkloadTasks(list)), [list]);
  const weekGroups = useMemo(() => {
    const r = weekRange();
    return groupTasksByDay(tasksInRange(list, r.start, r.end)).map((g) => ({ day: g.day, tasks: sortTasks(g.tasks) }));
  }, [list]);
  const monthGroups = useMemo(() => {
    const r = monthRange();
    return groupTasksByDay(tasksInRange(list, r.start, r.end)).map((g) => ({ day: g.day, tasks: sortTasks(g.tasks) }));
  }, [list]);

  // Band 2 #4 — the calendar month GRID. `grid` is the 6×7 rectangle for the paged month;
  // `countsByDay` is the per-day tally (total/open/done/overdue) the cells read for their count +
  // all-done marker. `new Date(...)` here lives inside a memo/initialiser, never the render body, so
  // it does not trip react-hooks/purity.
  const grid = useMemo(() => monthMatrix(new Date(cursor.y, cursor.m, 1)), [cursor]);
  const countsByDay = useMemo(() => taskCountsByDay(list), [list]);
  const selDayTasks = useMemo(() => sortTasks(tasksInRange(list, selDay, selDay + DAY_MS)), [list, selDay]);

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

  // Search runs over the pending drafts AND the server-confirmed list, so a task just created
  // offline is findable too. `sortTasks` gives the results the tab's usual order (open first,
  // earliest due), and the scorer preserves input order so that sort is the only ranking.
  const searchTerm = query.trim();
  const searching = searchTerm.length > 0;
  const searchResults = useMemo(
    () => (searching ? sortTasks(searchTasks([...pendingCards, ...list], searchTerm)) : []),
    [searching, searchTerm, pendingCards, list],
  );

  const pickView = (next: TaskView) => {
    if (next === view) return;
    haptics.select();
    setNotice(null);
    setView(next);
  };
  const pickDay = (ms: number) => {
    if (ms === selDay) return;
    haptics.select();
    setSelDay(ms);
  };
  // Band 2 #4 — month paging. `shiftMonth` steps the grid a month either way (JS `Date` normalises a
  // month of -1 or 12 across the year boundary); `goToday` snaps back to the current month AND
  // selects today; `pickCell` selects a day and, if the tap landed on a spill-over cell from an
  // adjacent month, follows the grid there so the selection stays visible.
  const shiftMonth = (delta: number) => {
    haptics.select();
    setCursor((cur) => {
      const d = new Date(cur.y, cur.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const goToday = () => {
    haptics.select();
    const n = new Date();
    setCursor({ y: n.getFullYear(), m: n.getMonth() });
    setSelDay(startOfDayMs(n));
  };
  const pickCell = (cell: MonthCell) => {
    pickDay(cell.ms);
    if (!cell.inMonth) {
      const d = new Date(cell.ms);
      setCursor({ y: d.getFullYear(), m: d.getMonth() });
    }
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

  // Per-view empty copy. The A2 "you have overdue work" caveat is no longer needed: the Today
  // view's set (todayWorkloadTasks) ALREADY includes open-overdue tasks, so if it is empty there
  // genuinely is nothing overdue. The calendar's empty names the selected day.
  const empty = VIEW_META[view];
  const emptyTitle =
    view === 'today' ? t('tasks.emptyTodayTitle')
      : view === 'week' ? t('tasks.emptyWeekTitle')
        : view === 'month' ? t('tasks.emptyMonthTitle')
          : dayHeading(selDay, t);
  const emptyBody =
    view === 'today' ? t('tasks.emptyTodayBody')
      : view === 'week' ? t('tasks.emptyWeekBody')
        : view === 'month' ? t('tasks.emptyMonthBody')
          : t('tasks.emptyCalendarBody');
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

      {/* Band 2 #2: local search over the loaded list. Fixed below the header so it stays put
          while the results scroll. Shown once the first load has landed (a box over a skeleton
          is useless). */}
      {!loading ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.sm }}>
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={() => {}}
            placeholder={t('common.search')}
          />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg, paddingTop: 4,
          paddingBottom: insets.bottom + 150, gap: spacing.lg,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
        // Band 2 #2: the SearchBar above keeps the keyboard up, so without this the first tap on a
        // result (open / complete / Clear search) is eaten to dismiss it — the two-tap "feels
        // broken" bug the global Search screen guards against the same way (search.tsx).
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
            {/* A failed complete/reopen surfaces here in BOTH search and normal modes. */}
            {notice ? (
              <Banner
                tone={notice.tone}
                title={notice.title}
                message={notice.message}
                onDismiss={() => setNotice(null)}
              />
            ) : null}

            {searching ? (
              /* Band 2 #2 — a flat list of every loaded task that matches, in the tab's usual
                 order (open first, earliest due). No hero, no time toggle: search is one job. */
              searchResults.length === 0 ? (
                <Card>
                  <EmptyState
                    icon="file-tray-outline"
                    title={`No task matches "${searchTerm}"`}
                    subtitle={
                      outage
                        ? 'Some tasks could not be loaded, so this may be incomplete. Pull down to refresh, then search again.'
                        : 'Nothing in your tasks carries that. Try a shorter piece of the title, the client name, or the last four digits of a mobile.'
                    }
                    action={{ label: 'Clear search', onPress: () => setQuery('') }}
                  />
                </Card>
              ) : (
                <View style={{ gap: 10 }}>
                  <Txt size={font.sub} color={c.muted} numberOfLines={1}>
                    {`${searchResults.length} ${searchResults.length === 1 ? 'result' : 'results'} for "${searchTerm}"`}
                  </Txt>
                  {searchResults.map((task, i) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      index={i}
                      onPress={task.pending ? () => {} : () => router.push(`/task/${task.id}`)}
                      onDone={task.pending ? undefined : () => quickDone(task)}
                      onReopen={task.pending ? undefined : () => reopen(task)}
                    />
                  ))}
                </View>
              )
            ) : (
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

                {/* At-a-glance counts. Since D4 the screen navigates by TIME view (below), so
                    these three are an informational read-out rather than filters — overdue work
                    is reachable in the Today view, which includes open-overdue tasks. */}
                <Row style={{ gap: spacing.lg }}>
                  <HeroStat label={t('tasks.overdue')} value={counts.overdue} tint={counts.overdue > 0 ? c.danger : c.faint} />
                  <HeroStat label={t('tasks.inProgress')} value={counts.in_progress} tint={c.primary} />
                  <HeroStat label={t('tasks.upcoming')} value={counts.upcoming} tint={c.accent} />
                </Row>
              </Card>
            </Appear>

            {/* D4: four TIME views. Default Calendar. The track scrolls only if the labels
                overflow a narrow phone; truncating them would make the toggle unreadable. */}
            <Appear index={1}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: spacing.xs }}
              >
                <Segmented<TaskView>
                  options={[
                    { key: 'today', label: t('tasks.today') },
                    { key: 'week', label: t('tasks.viewWeek') },
                    { key: 'month', label: t('tasks.viewMonth') },
                    { key: 'calendar', label: t('tasks.viewCalendar') },
                  ]}
                  value={view}
                  onChange={pickView}
                />
              </ScrollView>
            </Appear>

            {/* Band 2 #4: the Calendar view is a real month GRID — ‹prev/next› paging, a per-day
                count, all-completed days marked. Tap a day to list its tasks below. */}
            {view === 'calendar' ? (
              <>
                <Appear index={2}>
                  <MonthGrid
                    grid={grid}
                    counts={countsByDay}
                    selDay={selDay}
                    todayMs={todayMs}
                    onPrev={() => shiftMonth(-1)}
                    onNext={() => shiftMonth(1)}
                    onToday={goToday}
                    onPick={pickCell}
                    t={t}
                  />
                </Appear>
                {/* Orientation for the day list below — which day these tasks belong to, and how
                    many. Only when the day has tasks; an empty day is named by its empty state. */}
                {selDayTasks.length > 0 ? (
                  <Row style={{ alignItems: 'center', gap: spacing.sm }}>
                    <Txt size={font.sub} weight="800" numberOfLines={1} style={{ flex: 1 }}>
                      {dayHeading(selDay, t)}
                    </Txt>
                    <Pill label={String(selDayTasks.length)} tone="neutral" small numeric />
                  </Row>
                ) : null}
              </>
            ) : null}

            {/* Phase 57b: offline task drafts, pinned above the (server-confirmed) list so they stay
                visible under every view and never distort the hero/counts, which reflect only real
                tasks. Each is inert — no swipe, no complete, not tappable — until it flushes. */}
            {pendingCards.length > 0 ? (
              <View style={{ gap: 10 }}>
                {pendingCards.map((task, i) => (
                  <TaskCard key={task.id} task={task} index={i} onPress={() => {}} />
                ))}
              </View>
            ) : null}

            {outage ? (
              <Card>
                <EmptyState
                  icon="cloud-offline"
                  title="Tasks did not load"
                  subtitle="The server could not be reached, so this is not a confirmed empty list. Pull down to refresh."
                  action={{ label: 'Retry', onPress: () => load(true) }}
                />
              </Card>
            ) : bookEmpty ? (
              <Card>
                <EmptyState
                  icon="clipboard-outline"
                  title="No tasks yet"
                  subtitle={canCreateTask
                    ? 'Nothing has been assigned to you, and you have not created anything. Add the first task to start your day.'
                    : 'Nothing has been assigned to you yet. New tasks will appear here as soon as someone assigns you work.'}
                  action={canCreateTask ? { label: t('tasks.add'), onPress: () => router.push('/task-new') } : undefined}
                />
              </Card>
            ) : view === 'week' || view === 'month' ? (
              /* Grouped by day. */
              (view === 'week' ? weekGroups : monthGroups).length === 0 ? (
                <Card>
                  <EmptyState
                    icon={empty.icon}
                    title={emptyTitle}
                    subtitle={emptyBody}
                    action={empty.add && canCreateTask ? { label: t('tasks.add'), onPress: () => router.push('/task-new') } : undefined}
                  />
                </Card>
              ) : (
                <View style={{ gap: spacing.lg }}>
                  {(view === 'week' ? weekGroups : monthGroups).map((g) => (
                    <View key={g.day} style={{ gap: 10 }}>
                      <Row style={{ alignItems: 'center', gap: spacing.sm }}>
                        <Txt size={font.sub} weight="800" numberOfLines={1} style={{ flex: 1 }}>{dayHeading(g.day, t)}</Txt>
                        <Pill label={String(g.tasks.length)} tone="neutral" small numeric />
                      </Row>
                      {g.tasks.map((task, i) => (
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
                  ))}
                </View>
              )
            ) : (
              /* Today or Calendar: a single flat day list. */
              (view === 'today' ? todayTasks : selDayTasks).length === 0 ? (
                <Card>
                  <EmptyState
                    icon={empty.icon}
                    title={emptyTitle}
                    subtitle={emptyBody}
                    action={empty.add && canCreateTask ? { label: t('tasks.add'), onPress: () => router.push('/task-new') } : undefined}
                  />
                </Card>
              ) : (
                <View style={{ gap: 10 }}>
                  {(view === 'today' ? todayTasks : selDayTasks).map((task, i) => (
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
              )
            )}
            </>
            )}
          </>
        )}
      </ScrollView>

      {/* Band 2 #3: hidden for a team-tier advisor — the backend 403s their create, so the FAB
          would only lead to a refusal. Entitled tiers (admin/leader/master) keep it. */}
      {canCreateTask ? (
        <Fab
          icon="add"
          label={t('tasks.add')}
          onPress={() => router.push('/task-new')}
          style={{ bottom: insets.bottom + 76 }}
        />
      ) : null}
    </Screen>
  );
}

/* ---------- HeroStat ----------
 * Since D4 the screen navigates by time view, so these are an at-a-glance read-out of the day's
 * shape (overdue / in progress / upcoming) rather than filters. */
function HeroStat({ label, value, tint }: { label: string; value: number; tint: string }) {
  const c = useTheme();
  const { font } = c;
  return (
    <View
      style={{ flex: 1, minHeight: 44, justifyContent: 'center', paddingVertical: 6 }}
      accessible
      accessibilityLabel={`${label}, ${value} tasks`}
    >
      <Metric value={String(value)} size={19} color={value > 0 ? tint : c.faint} />
      <Txt size={font.tiny} weight="600" color={c.muted} numberOfLines={1} style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </View>
  );
}

/* ---------- MonthGrid ----------
 * Band 2 #4 (owner Point 4): the Calendar view's real 7-column month grid. Replaces D4's
 * single-month horizontal rail. A header pages ‹prev / month year / next› (and offers a "Today"
 * jump when paged away from the current month); a weekday row labels the columns; six week-rows of
 * GridDay cells show each day's task COUNT (not a binary dot) with all-completed days in success
 * tone. Layout maths is pure in `@/data/tasks`; this component only paints and wires taps. */
function MonthGrid({ grid, counts, selDay, todayMs, onPrev, onNext, onToday, onPick, t }: {
  grid: { year: number; month: number; weeks: MonthCell[][] };
  counts: Map<number, DayTally>;
  selDay: number;
  todayMs: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onPick: (cell: MonthCell) => void;
  t: ReturnType<typeof useT>;
}) {
  const c = useTheme();
  const { spacing, font } = c;
  const td = new Date(todayMs); // `new Date(ms)` is deterministic — not a purity-rule now-read.
  const isCurrentMonth = td.getFullYear() === grid.year && td.getMonth() === grid.month;
  // Prev/next a11y names the DESTINATION month (better than a generic "previous month" and it needs
  // no i18n key — the label is built from the same English month names the header shows).
  const prev = new Date(grid.year, grid.month - 1, 1);
  const next = new Date(grid.year, grid.month + 1, 1);

  return (
    <View style={{ gap: spacing.sm }}>
      <Row style={{ alignItems: 'center', gap: spacing.sm }}>
        <IconBtn
          icon="chevron-back"
          size={38}
          bg={c.primarySoft}
          color={c.primary}
          accessibilityLabel={`${MONTHS_FULL[prev.getMonth()]} ${prev.getFullYear()}`}
          onPress={onPrev}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt size={font.h3} weight="800" numberOfLines={1}>
            {`${MONTHS_FULL[grid.month]} ${grid.year}`}
          </Txt>
        </View>
        <IconBtn
          icon="chevron-forward"
          size={38}
          bg={c.primarySoft}
          color={c.primary}
          accessibilityLabel={`${MONTHS_FULL[next.getMonth()]} ${next.getFullYear()}`}
          onPress={onNext}
        />
      </Row>

      {/* A one-tap jump home, only when paged away — the current month opens by default. */}
      {!isCurrentMonth ? (
        <Pressable
          onPress={onToday}
          accessibilityRole="button"
          accessibilityLabel={t('tasks.today')}
          style={({ pressed }) => [{ alignSelf: 'center', opacity: pressed ? 0.6 : 1 }]}
        >
          <Pill label={t('tasks.today')} tone="primary" small />
        </Pressable>
      ) : null}

      {/* Column headers. English weekday letters match the app's existing WD usage (no i18n copy). */}
      <Row>
        {WD.map((w, i) => (
          <Txt key={i} size={11} weight="700" color={c.muted} style={{ flex: 1, textAlign: 'center' }}>
            {w}
          </Txt>
        ))}
      </Row>

      {grid.weeks.map((week, wi) => (
        <Row key={wi} style={{ gap: 4 }}>
          {week.map((cell) => (
            <GridDay
              key={cell.ms}
              cell={cell}
              tally={counts.get(cell.ms)}
              selected={cell.ms === selDay}
              isToday={cell.ms === todayMs}
              onPress={() => onPick(cell)}
            />
          ))}
        </Row>
      ))}
    </View>
  );
}

/* ---------- GridDay ----------
 * One day cell in the month grid. Shows the date and, when the day carries tasks, the COUNT —
 * tinted so the day's state reads at a glance: success = every task done, danger = open work now
 * overdue, accent = open work not yet due. A selected day fills with the primary; today wears a
 * thin primary ring. Spill-over days from the neighbouring months are dimmed but still tappable. */
function GridDay({ cell, tally, selected, isToday, onPress }: {
  cell: MonthCell;
  tally: DayTally | undefined;
  selected: boolean;
  isToday: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const { radius } = c;
  const total = tally?.total ?? 0;
  const allDone = total > 0 && (tally?.open ?? 0) === 0;
  const overdue = (tally?.overdue ?? 0) > 0;
  const countColor = selected ? c.onPrimary : allDone ? c.success : overdue ? c.danger : c.accent;
  const state = total === 0 ? 'no tasks'
    : `${total} ${total === 1 ? 'task' : 'tasks'}${allDone ? ', all done' : overdue ? ', overdue' : ''}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${cell.date} ${MONTHS_FULL[new Date(cell.ms).getMonth()]}, ${state}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [{
        flex: 1, height: 46, borderRadius: radius.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: selected ? c.primary : 'transparent',
        // Constant hairline border so the "today" ring never shifts the cell's box.
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isToday && !selected ? c.primary : 'transparent',
        opacity: pressed ? 0.6 : cell.inMonth ? 1 : 0.35,
      }]}
    >
      <Metric
        value={String(cell.date)}
        size={15}
        color={selected ? c.onPrimary : cell.inMonth ? c.text : c.muted}
      />
      {/* Reserve the count row's height whether or not a number shows, so dates stay aligned. */}
      <View style={{ height: 13, justifyContent: 'center' }}>
        {total > 0 ? (
          <Txt size={10.5} weight="800" numeric color={countColor}>{String(total)}</Txt>
        ) : null}
      </View>
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
              {isPending ? <PendingBadge /> : <Pill label={t(st.labelKey)} tone={st.tone} small />}
              <Pill label={t(pr.labelKey)} tone={pr.tone} small />
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
