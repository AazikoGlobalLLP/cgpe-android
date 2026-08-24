/**
 * PHASE 2 — `taskProgress` pinned.
 *
 * Four lines of code (src/data/tasks.ts:41-45) that decide what every progress bar in the app
 * shows. It has no rounding, no clamp and no optional chaining, and three of those facts are
 * load-bearing somewhere else in the codebase. Spec: docs/spec/PHASE-2.md.
 *
 * src/data/tasks.ts has ZERO imports, so this file needs no stub and no environment.
 */
import { describe, expect, it } from 'vitest';
import {
  dueBucket, taskProgress, todayProgress, todayWorkload, todayWorkloadTasks,
  weekRange, monthRange, tasksInRange, groupTasksByDay,
  monthMatrix, taskCountsByDay,
  searchTasks, taskSearchFields,
  type Task, type TaskStatus, type TaskStep,
} from '@/data/tasks';
import { W_ID, W_SECOND, W_TEXT } from '@/lib/searchScore';

/** Minimal Task. Only `status` and `steps` are read by taskProgress. */
function task(status: TaskStatus, steps: TaskStep[]): Task {
  return {
    id: 't1', title: 'Call the policyholder', description: '', status,
    priority: 'medium', category: 'Follow-up', dueDate: '', assignedBy: 'system',
    steps, createdAt: '',
  };
}
const step = (i: number, done: boolean): TaskStep => ({ id: 's' + i, label: 'step ' + i, done });

describe('taskProgress — status short-circuits', () => {
  it('returns 1 for a done task without reading its steps', () => {
    // tasks.ts:42 returns before the steps array is touched, so a done task with 0 of 5
    // ticked renders a full bar next to an empty checklist.
    const t = task('done', [0, 1, 2, 3, 4].map((i) => step(i, false)));
    expect(taskProgress(t)).toBe(1);
  });

  it('returns the hardcoded 0.5 for an in_progress task with no steps', () => {
    // tasks.ts:43 — a literal "in progress but no checklist" fudge, not a computed value.
    expect(taskProgress(task('in_progress', []))).toBe(0.5);
  });

  it('returns 0 for a todo task with no steps', () => {
    expect(taskProgress(task('todo', []))).toBe(0);
  });

  it('returns 0 for a BLOCKED task with no steps, exactly like todo', () => {
    // tasks.ts:43 tests only for 'in_progress', so blocked and todo are indistinguishable.
    // If a later phase makes blocked render differently, this test must break.
    expect(taskProgress(task('blocked', []))).toBe(0);
  });
});

describe('taskProgress — step arithmetic', () => {
  it('returns an UNROUNDED float for 1 of 3', () => {
    // tasks.ts:44 is a bare division: no Math.round, no toFixed, no *100, no clamp.
    const t = task('todo', [step(0, true), step(1, false), step(2, false)]);
    expect(taskProgress(t)).toBe(1 / 3);
  });

  it('returns an UNROUNDED float for 2 of 3', () => {
    const t = task('todo', [step(0, true), step(1, true), step(2, false)]);
    expect(taskProgress(t)).toBe(2 / 3);
  });

  it('returns exactly 1 when every step is done on a NOT-done task', () => {
    // 3/3 === 1, so the `prog >= 1` success-tone branches at src/app/(tabs)/tasks.tsx:566
    // and src/app/task/[id].tsx:441 fire while TASK_STATUS still renders "To do".
    const t = task('todo', [step(0, true), step(1, true), step(2, true)]);
    expect(taskProgress(t)).toBe(1);
  });

  it('lets step progress override the in_progress fudge once a checklist exists', () => {
    // Coincidentally 0.5 again — which is exactly why it needs pinning. Only holding this
    // alongside the 1/3 case proves the branch ORDER at tasks.ts:43-44.
    const t = task('in_progress', [step(0, true), step(1, false)]);
    expect(taskProgress(t)).toBe(0.5);
  });

  it('returns 0 when a checklist exists but nothing is ticked', () => {
    const t = task('todo', [step(0, false), step(1, false)]);
    expect(taskProgress(t)).toBe(0);
  });
});

describe('taskProgress — pinned current behaviour (change deliberately, not by accident)', () => {
  it('THROWS a TypeError when `steps` is missing entirely', () => {
    // tasks.ts:43 reads `t.steps.length` with no optional chaining and no default. The type
    // declares steps as required, so constructing this needs a cast — but it is reachable at
    // runtime from any Task not built by adaptTask (src/data/api.ts:178 is the only thing
    // guaranteeing []). If a later phase adds `t.steps?.length ?? 0`, update this on purpose.
    expect(() => taskProgress({ status: 'todo' } as unknown as Task)).toThrow(TypeError);
  });
});

/* -------------------------------------------------------------------------------------------
 * PHASE 53b — the task-count bug (owner #1, 2026-08-18).
 *
 * `dueBucket` and `todayProgress` are the single shared definition that Home and the Tasks tab
 * both call, so the two headline counts cannot drift. These pins lock the two properties the fix
 * exists to guarantee:
 *   1. an UNDATED task (dueDate '') sorts to 'upcoming' — never a false 'overdue'/'today';
 *   2. completing then reopening a task shifts the ratio by ONE step (the numerator), never a
 *      simultaneous jump in the denominator (the owner-reported "count animates wrong on reopen").
 * A fixed local-noon `now` is injected so the buckets don't depend on the runner's clock/timezone.
 * ------------------------------------------------------------------------------------------- */
const NOW = new Date(2026, 7, 18, 12, 0, 0); // local noon, 18 Aug 2026 — far from any midnight boundary
/** ISO for local noon `offset` days from NOW (0 = today, -1 = yesterday, +1 = tomorrow). */
const dayAt = (offset: number) => new Date(2026, 7, 18 + offset, 12, 0, 0).toISOString();
/** A Task with only the fields these helpers read; everything else is a harmless default. */
function mk(o: Partial<Task>): Task {
  return {
    id: 't', title: '', description: '', status: 'todo', priority: 'medium',
    category: 'Task', dueDate: '', assignedBy: '', steps: [], createdAt: '', ...o,
  };
}

describe('dueBucket — an undated task is never overdue or due today', () => {
  it("sorts an empty dueDate ('') to 'upcoming', not 'overdue'/'today'", () => {
    // THE fix: adaptTeamTask now leaves an undated task's dueDate ''. new Date('') is Invalid →
    // NaN comparisons fall through to 'upcoming'. Before, it fell back to the server touch-time.
    expect(dueBucket(mk({ dueDate: '' }), NOW)).toBe('upcoming');
  });
  it("classifies past → 'overdue', same day → 'today', future → 'upcoming' against the injected now", () => {
    expect(dueBucket(mk({ dueDate: dayAt(-1) }), NOW)).toBe('overdue');
    expect(dueBucket(mk({ dueDate: dayAt(0) }), NOW)).toBe('today');
    expect(dueBucket(mk({ dueDate: dayAt(1) }), NOW)).toBe('upcoming');
  });
});

describe('todayProgress — belongs = due-today ∪ completed-today', () => {
  it('is {0,0,0} for an empty list', () => {
    expect(todayProgress([], NOW)).toEqual({ total: 0, done: 0, pct: 0 });
  });

  it('counts a due-today task in the denominator, and only in the numerator once done', () => {
    expect(todayProgress([mk({ dueDate: dayAt(0), status: 'todo' })], NOW)).toEqual({ total: 1, done: 0, pct: 0 });
    expect(todayProgress([mk({ dueDate: dayAt(0), status: 'done', completedAt: dayAt(0) })], NOW)).toEqual({ total: 1, done: 1, pct: 1 });
  });

  it('reopen only moves the numerator: a due-today task done→todo keeps total 1 while done flips 1→0', () => {
    const done = todayProgress([mk({ dueDate: dayAt(0), status: 'done', completedAt: dayAt(0) })], NOW);
    const reopened = todayProgress([mk({ dueDate: dayAt(0), status: 'todo', completedAt: undefined })], NOW);
    expect(done).toEqual({ total: 1, done: 1, pct: 1 });
    expect(reopened).toEqual({ total: 1, done: 0, pct: 0 });
    expect(reopened.total).toBe(done.total); // the denominator does NOT jump — the whole point
  });

  it('credits a task COMPLETED today even if it was due earlier (overdue-but-done-today counts)', () => {
    expect(todayProgress([mk({ dueDate: dayAt(-1), status: 'done', completedAt: dayAt(0) })], NOW)).toEqual({ total: 1, done: 1, pct: 1 });
  });

  it('does NOT count a task completed on a PREVIOUS day (history never pollutes today)', () => {
    // The old `(done && bucket !== 'upcoming')` clause swept in every non-upcoming done task
    // regardless of when it closed; this is the case that fixes.
    expect(todayProgress([mk({ dueDate: dayAt(-1), status: 'done', completedAt: dayAt(-1) })], NOW)).toEqual({ total: 0, done: 0, pct: 0 });
  });

  it('excludes an undated OPEN task entirely (no due-today claim, not completed)', () => {
    expect(todayProgress([mk({ dueDate: '', status: 'todo' })], NOW)).toEqual({ total: 0, done: 0, pct: 0 });
  });

  it('an undated task counts the day it is completed, and cleanly leaves the set when reopened', () => {
    expect(todayProgress([mk({ dueDate: '', status: 'done', completedAt: dayAt(0) })], NOW)).toEqual({ total: 1, done: 1, pct: 1 });
    // Reopen (status todo + completedAt cleared): both total and done drop to 0 — no phantom
    // 'today' bucket from a touch-time, no oscillation.
    expect(todayProgress([mk({ dueDate: '', status: 'todo', completedAt: undefined })], NOW)).toEqual({ total: 0, done: 0, pct: 0 });
  });

  it('still counts a due-today done task whose completedAt is missing or stale (the due-today clause carries it)', () => {
    expect(todayProgress([mk({ dueDate: dayAt(0), status: 'done' })], NOW)).toEqual({ total: 1, done: 1, pct: 1 });
    expect(todayProgress([mk({ dueDate: dayAt(0), status: 'done', completedAt: dayAt(-1) })], NOW)).toEqual({ total: 1, done: 1, pct: 1 });
  });

  it('aggregates a mixed list correctly', () => {
    const list = [
      mk({ dueDate: dayAt(0), status: 'todo' }),                      // due today, open      → denom
      mk({ dueDate: dayAt(0), status: 'done', completedAt: dayAt(0) }),// due today, done      → denom+num
      mk({ dueDate: dayAt(-1), status: 'done', completedAt: dayAt(0) }),// overdue, done today  → denom+num
      mk({ dueDate: dayAt(-1), status: 'done', completedAt: dayAt(-1) }),// done yesterday      → excluded
      mk({ dueDate: dayAt(1), status: 'todo' }),                      // upcoming             → excluded
      mk({ dueDate: '', status: 'todo' }),                            // undated open         → excluded
    ];
    expect(todayProgress(list, NOW)).toEqual({ total: 3, done: 2, pct: 2 / 3 });
  });
});

/* -------------------------------------------------------------------------------------------
 * todayWorkload — the Tasks-tab headline (PHASE 75, owner report A2). Same shape as
 * `todayProgress` but the belongs-set ALSO includes OPEN overdue tasks, because an overdue item
 * (e.g. a ticket claimed today, dated by its own older open date) is actionable today and must not
 * read as "0 / nothing scheduled". Home's clock-in hero and the Tasks tab SHARE this; `todayProgress`
 * (pure due-today) is retained as a reference, so these pins also assert the two differ on open-overdue.
 * ------------------------------------------------------------------------------------------- */
describe('todayWorkload — belongs = due-today ∪ open-overdue ∪ completed-today', () => {
  it('is {0,0,0} for an empty list', () => {
    expect(todayWorkload([], NOW)).toEqual({ total: 0, done: 0, pct: 0 });
  });

  it('counts a due-today task exactly like todayProgress', () => {
    expect(todayWorkload([mk({ dueDate: dayAt(0), status: 'todo' })], NOW)).toEqual({ total: 1, done: 0, pct: 0 });
    expect(todayWorkload([mk({ dueDate: dayAt(0), status: 'done', completedAt: dayAt(0) })], NOW)).toEqual({ total: 1, done: 1, pct: 1 });
  });

  it('INCLUDES an open overdue task — the A2 fix — where todayProgress EXCLUDES it', () => {
    expect(todayWorkload([mk({ dueDate: dayAt(-1), status: 'todo' })], NOW)).toEqual({ total: 1, done: 0, pct: 0 });
    // The exact difference the fix exists for: todayProgress still returns 0 (→ "nothing scheduled").
    expect(todayProgress([mk({ dueDate: dayAt(-1), status: 'todo' })], NOW)).toEqual({ total: 0, done: 0, pct: 0 });
  });

  it('credits an overdue task completed today, and reopening it only moves the numerator', () => {
    const done = todayWorkload([mk({ dueDate: dayAt(-1), status: 'done', completedAt: dayAt(0) })], NOW);
    const reopened = todayWorkload([mk({ dueDate: dayAt(-1), status: 'todo', completedAt: undefined })], NOW);
    expect(done).toEqual({ total: 1, done: 1, pct: 1 });
    expect(reopened).toEqual({ total: 1, done: 0, pct: 0 });
    expect(reopened.total).toBe(done.total); // denominator stays put across complete↔reopen
  });

  it('excludes an overdue task completed on a PREVIOUS day, and an undated OPEN task', () => {
    expect(todayWorkload([mk({ dueDate: dayAt(-1), status: 'done', completedAt: dayAt(-1) })], NOW)).toEqual({ total: 0, done: 0, pct: 0 });
    expect(todayWorkload([mk({ dueDate: '', status: 'todo' })], NOW)).toEqual({ total: 0, done: 0, pct: 0 });
  });

  it('aggregates a mixed list: due-today + open-overdue + overdue-done-today, excluding history/upcoming/undated', () => {
    const list = [
      mk({ dueDate: dayAt(0), status: 'todo' }),                        // due today, open       → denom
      mk({ dueDate: dayAt(0), status: 'done', completedAt: dayAt(0) }), // due today, done       → denom+num
      mk({ dueDate: dayAt(-1), status: 'todo' }),                       // overdue, open         → denom
      mk({ dueDate: dayAt(-1), status: 'done', completedAt: dayAt(0) }),// overdue, done today   → denom+num
      mk({ dueDate: dayAt(-1), status: 'done', completedAt: dayAt(-1) }),// done yesterday       → excluded
      mk({ dueDate: dayAt(1), status: 'todo' }),                        // upcoming              → excluded
      mk({ dueDate: '', status: 'todo' }),                             // undated open          → excluded
    ];
    expect(todayWorkload(list, NOW)).toEqual({ total: 4, done: 2, pct: 2 / 4 });
  });
});

/* -------------------------------------------------------------------------------------------
 * D4 (owner, 2026-08-22) — the Tasks-tab TIME VIEWS: weekRange / monthRange / tasksInRange /
 * groupTasksByDay / todayWorkloadTasks. NOW is Tuesday 18 Aug 2026 (local noon), so the ISO week
 * runs Mon 17 Aug → Mon 24 Aug (end exclusive) and the month runs 1 Aug → 1 Sep (end exclusive).
 * ------------------------------------------------------------------------------------------- */
describe('weekRange — Monday-start ISO week containing now', () => {
  it('returns [Mon 17 Aug 00:00, Mon 24 Aug 00:00) for a Tuesday now', () => {
    const r = weekRange(NOW);
    expect(r.start).toBe(new Date(2026, 7, 17, 0, 0, 0, 0).getTime());
    expect(r.end).toBe(new Date(2026, 7, 24, 0, 0, 0, 0).getTime());
  });
  it('spans exactly 7 days', () => {
    const r = weekRange(NOW);
    expect(r.end - r.start).toBe(7 * 24 * 60 * 60 * 1000);
  });
  it('is stable across the whole week (Monday and Sunday give the same bounds)', () => {
    const mon = weekRange(new Date(2026, 7, 17, 9, 0, 0));
    const sun = weekRange(new Date(2026, 7, 23, 23, 0, 0));
    expect(mon).toEqual(sun);
  });
});

describe('monthRange — calendar month containing now', () => {
  it('returns [1 Aug 00:00, 1 Sep 00:00) for an August now', () => {
    const r = monthRange(NOW);
    expect(r.start).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).getTime());
    expect(r.end).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime());
  });
});

describe('tasksInRange — due day within [start, end), all statuses, undated excluded', () => {
  it('keeps only tasks whose due day is inside the week, boundaries handled (start inclusive, end exclusive)', () => {
    const week = weekRange(NOW);
    const inMon = mk({ id: 'mon', dueDate: dayAt(-1) });   // 17 Aug — the inclusive start
    const inTue = mk({ id: 'tue', dueDate: dayAt(0) });    // 18 Aug
    const inSun = mk({ id: 'sun', dueDate: dayAt(5) });    // 23 Aug — last day in
    const outNextMon = mk({ id: 'nm', dueDate: dayAt(6) });// 24 Aug — the exclusive end, OUT
    const outPrevSun = mk({ id: 'ps', dueDate: dayAt(-2) });// 16 Aug — OUT
    const got = tasksInRange([inMon, inTue, inSun, outNextMon, outPrevSun], week.start, week.end).map((t) => t.id);
    expect(got).toEqual(['mon', 'tue', 'sun']);
  });
  it('keeps a DONE task in range (a time view shows what was closed, not only what is open)', () => {
    const week = weekRange(NOW);
    const doneInWeek = mk({ id: 'd', dueDate: dayAt(0), status: 'done', completedAt: dayAt(0) });
    expect(tasksInRange([doneInWeek], week.start, week.end).map((t) => t.id)).toEqual(['d']);
  });
  it('excludes an undated task from every range', () => {
    const month = monthRange(NOW);
    expect(tasksInRange([mk({ dueDate: '' })], month.start, month.end)).toEqual([]);
  });
});

describe('groupTasksByDay — grouped by due calendar day, days ascending, undated dropped', () => {
  it('buckets tasks by their local day and orders the groups earliest-first', () => {
    const list = [
      mk({ id: 'b', dueDate: dayAt(1) }),
      mk({ id: 'a1', dueDate: dayAt(0) }),
      mk({ id: 'a2', dueDate: dayAt(0) }),
      mk({ id: 'undated', dueDate: '' }),
    ];
    const groups = groupTasksByDay(list);
    expect(groups.length).toBe(2);
    expect(groups[0].day).toBeLessThan(groups[1].day);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a1', 'a2']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['b']);
  });
  it('returns [] for an all-undated list', () => {
    expect(groupTasksByDay([mk({ dueDate: '' }), mk({ dueDate: '' })])).toEqual([]);
  });
});

describe('todayWorkloadTasks — the SET behind the todayWorkload counts', () => {
  it('returns the exact tasks that make up the todayWorkload total (counts can never disagree)', () => {
    const list = [
      mk({ id: 'today', dueDate: dayAt(0), status: 'todo' }),
      mk({ id: 'openOverdue', dueDate: dayAt(-1), status: 'todo' }),
      mk({ id: 'doneToday', dueDate: dayAt(-1), status: 'done', completedAt: dayAt(0) }),
      mk({ id: 'upcoming', dueDate: dayAt(1), status: 'todo' }),
      mk({ id: 'undated', dueDate: '', status: 'todo' }),
    ];
    const set = todayWorkloadTasks(list, NOW);
    expect(set.map((t) => t.id).sort()).toEqual(['doneToday', 'openOverdue', 'today']);
    expect(set.length).toBe(todayWorkload(list, NOW).total);
  });
});

/**
 * Band 2 #2 (owner backlog Point 2, 2026-08-24) — the Tasks-tab local search. `searchTasks`
 * filters an already-loaded list with the shared scorer, so it must forgive typos and word
 * order, match a client mobile by its tail, and never invent matches. `taskSearchFields` is the
 * one definition of "which columns of a task are searchable", shared with the global Search screen.
 */
describe('taskSearchFields — the searchable columns of a task', () => {
  it('exposes title/mobile/client/category/details/assigned-by with load-bearing weights', () => {
    // The weights are NOT cosmetic: search.tsx feeds this straight into rank(), where weight is
    // the intra-tier tie-break that orders task results. Pin the full shape, weights included, so
    // a weight edit that silently re-ranks global search fails here.
    const t = mk({
      title: 'Renew policy', clientPhone: '9876588891', client: 'Rajesh Patel',
      category: 'Renewal', description: 'call before 5pm', assignedBy: 'Sunita',
    });
    expect(taskSearchFields(t)).toEqual([
      { key: 'name', value: 'Renew policy', weight: W_ID },
      { key: 'mobile', value: '9876588891', weight: W_ID },
      { key: 'client', value: 'Rajesh Patel', weight: W_SECOND },
      { key: 'category', value: 'Renewal', weight: W_TEXT },
      { key: 'details', value: 'call before 5pm', weight: W_TEXT },
      { key: 'assigned by', value: 'Sunita', weight: W_TEXT },
    ]);
  });
});

describe('searchTasks — local, typo-/word-order-/phone-tail-tolerant', () => {
  const list: Task[] = [
    mk({ id: 'a', title: 'Call Rajesh Patel', client: 'Rajesh Patel', clientPhone: '9876588891' }),
    mk({ id: 'b', title: 'Collect KYC documents', category: 'Documentation' }),
    mk({ id: 'c', title: 'Renew Jeevan Anand', description: 'maturity due', client: 'Sunita Mehta' }),
  ];
  const ids = (raw: string) => searchTasks(list, raw).map((t) => t.id);

  it('a blank query returns the list unchanged (same reference)', () => {
    expect(searchTasks(list, '')).toBe(list);
    expect(searchTasks(list, '   ')).toBe(list);
  });

  it('matches by a piece of the title', () => {
    expect(ids('rajesh')).toEqual(['a']);
  });

  it('forgives a transposition — "rajseh" still finds "Rajesh"', () => {
    expect(ids('rajseh')).toEqual(['a']);
  });

  it('matches out-of-order words — "patel rajesh" finds "Rajesh Patel"', () => {
    expect(ids('patel rajesh')).toEqual(['a']);
  });

  it('matches the client mobile by its last four digits', () => {
    expect(ids('8891')).toEqual(['a']);
  });

  it('searches secondary/free-text columns (category, details, client)', () => {
    expect(ids('documentation')).toEqual(['b']); // category
    expect(ids('maturity')).toEqual(['c']);       // description
    expect(ids('mehta')).toEqual(['c']);          // client name
  });

  it('a short token must be really present — no fuzzing 3-letter noise', () => {
    // "kyc" is a genuine substring of task b, but "kyd" (a typo) is too short to fuzzy-match.
    expect(ids('kyc')).toEqual(['b']);
    expect(ids('kyd')).toEqual([]);
  });

  it('returns [] when nothing carries the query', () => {
    expect(ids('nonexistent')).toEqual([]);
  });

  it('returns ALL matches in INPUT order — a plain filter, not a ranked/sliced result', () => {
    // Distinct from the global search's rank(), which sorts by score and caps at GROUP_CAP.
    // searchTasks preserves input order (the Tasks tab re-sorts itself) and keeps every match.
    const many: Task[] = [
      mk({ id: 'x1', title: 'Renewal call' }),        // prefix on title
      mk({ id: 'x2', title: 'KYC upload' }),          // no match
      mk({ id: 'x3', title: 'Policy', category: 'Renewal' }), // exact on category
      mk({ id: 'x4', title: 'Visit', description: 'renewal reminder' }), // prefix in details
    ];
    expect(searchTasks(many, 'renewal').map((t) => t.id)).toEqual(['x1', 'x3', 'x4']);
  });

  it('does NOT cap the result at GROUP_CAP — a broad query returns every match', () => {
    const big: Task[] = Array.from({ length: 25 }, (_, i) => mk({ id: `r${i}`, category: 'Renewal' }));
    expect(searchTasks(big, 'renewal')).toHaveLength(25); // rank()-based code would truncate to 20
  });
});

/* -------------------------------------------------------------------------------------------
 * Band 2 #4 (owner backlog Point 4, 2026-08-24) — the Tasks-tab CALENDAR month grid.
 *
 * `monthMatrix` lays out a fixed 6×7 rectangle of days for one month (leading/trailing cells
 * borrowed from the neighbours), and `taskCountsByDay` tallies tasks per day so the grid can show
 * a real per-day COUNT (not a binary dot) and mark all-completed days. Both are pure and
 * injectable, so the grid's correctness is proven here, off-device. NOW stays Tue 18 Aug 2026.
 * ------------------------------------------------------------------------------------------- */
const DAY = 24 * 60 * 60 * 1000;
/** Local midnight, `offset` days from 18 Aug 2026 — the ms key `taskCountsByDay` buckets on. */
const midnight = (offset: number) => new Date(2026, 7, 18 + offset, 0, 0, 0, 0).getTime();

describe('monthMatrix — a fixed 6×7 month grid', () => {
  it('always returns 6 weeks of 7 days (42 cells), so the grid height never changes between months', () => {
    for (const anchor of [new Date(2026, 1, 10), new Date(2026, 7, 18), new Date(2026, 4, 1), new Date(2028, 1, 29)]) {
      const g = monthMatrix(anchor);
      expect(g.weeks).toHaveLength(6);
      g.weeks.forEach((w) => expect(w).toHaveLength(7));
      expect(g.weeks.flat()).toHaveLength(42);
    }
  });

  it('names the anchored month (0-based) and is anchor-agnostic within that month', () => {
    const g = monthMatrix(new Date(2026, 7, 18, 12, 0, 0));
    expect(g.year).toBe(2026);
    expect(g.month).toBe(7); // August
    // The 1st, mid-month and the last instant of the month all produce the identical grid.
    expect(monthMatrix(new Date(2026, 7, 1))).toEqual(monthMatrix(new Date(2026, 7, 18, 23, 59, 59)));
  });

  it('starts each row on Sunday by default (weekStartsOn 0)', () => {
    const flat = monthMatrix(new Date(2026, 7, 18)).weeks.flat();
    expect(new Date(flat[0].ms).getDay()).toBe(0); // Sunday
    // Every row begins on a Sunday.
    monthMatrix(new Date(2026, 7, 18)).weeks.forEach((w) => expect(new Date(w[0].ms).getDay()).toBe(0));
  });

  it('can start each row on Monday (weekStartsOn 1) without changing the in-month days', () => {
    const g = monthMatrix(new Date(2026, 7, 18), 1);
    expect(new Date(g.weeks[0][0].ms).getDay()).toBe(1); // Monday
    expect(g.weeks.flat().filter((c) => c.inMonth).map((c) => c.date)).toEqual(
      Array.from({ length: 31 }, (_, i) => i + 1),
    );
  });

  it('cells are exactly one day apart, strictly increasing — no gaps, no duplicates (no DST in IN)', () => {
    const flat = monthMatrix(new Date(2026, 7, 18)).weeks.flat();
    for (let i = 1; i < flat.length; i++) expect(flat[i].ms - flat[i - 1].ms).toBe(DAY);
  });

  it('flags exactly the anchored month\'s days inMonth, in order 1..lastDate', () => {
    const flat = monthMatrix(new Date(2026, 7, 18)).weeks.flat();
    const inMonth = flat.filter((c) => c.inMonth);
    expect(inMonth.map((c) => c.date)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1)); // Aug = 31 days
    inMonth.forEach((c) => {
      expect(new Date(c.ms).getMonth()).toBe(7);
      expect(new Date(c.ms).getFullYear()).toBe(2026);
    });
    // A known cell keys to that date's local midnight — the exact key taskCountsByDay uses.
    expect(flat.find((c) => c.inMonth && c.date === 18)!.ms).toBe(midnight(0));
  });

  it('borrows leading cells from the previous month and trailing from the next, all inMonth:false', () => {
    const flat = monthMatrix(new Date(2026, 7, 18)).weeks.flat();
    const firstIn = flat.findIndex((c) => c.inMonth);
    const lastIn = flat.length - 1 - [...flat].reverse().findIndex((c) => c.inMonth);
    flat.slice(0, firstIn).forEach((c) => {
      expect(c.inMonth).toBe(false);
      expect(new Date(c.ms).getMonth()).toBe(6); // July
    });
    flat.slice(lastIn + 1).forEach((c) => {
      expect(c.inMonth).toBe(false);
      expect(new Date(c.ms).getMonth()).toBe(8); // September
    });
  });

  it('rolls the YEAR over: a January grid\'s leading cells are December of the PRIOR year', () => {
    const g = monthMatrix(new Date(2026, 0, 15)); // January 2026
    const jan1 = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();
    const leading = g.weeks.flat().filter((c) => !c.inMonth && c.ms < jan1);
    // Jan 1 2026 is a Thursday, so with a Sunday start there ARE leading cells — assert they exist
    // and are all Dec 2025 (this is the rollover the year-and-month inMonth check guards).
    expect(leading.length).toBeGreaterThan(0);
    leading.forEach((c) => {
      expect(new Date(c.ms).getFullYear()).toBe(2025);
      expect(new Date(c.ms).getMonth()).toBe(11); // December
    });
  });

  it('counts a leap February as 29 in-month days and a common one as 28', () => {
    expect(monthMatrix(new Date(2028, 1, 10)).weeks.flat().filter((c) => c.inMonth)).toHaveLength(29); // 2028 leap
    expect(monthMatrix(new Date(2026, 1, 10)).weeks.flat().filter((c) => c.inMonth)).toHaveLength(28); // 2026 common
  });
});

describe('taskCountsByDay — per-day tallies for the grid (undated excluded)', () => {
  it('is an empty map for an empty list', () => {
    expect(taskCountsByDay([], NOW).size).toBe(0);
  });

  it('tallies total/open/done/overdue per day and drops undated/invalid tasks', () => {
    const list = [
      mk({ dueDate: dayAt(0), status: 'todo' }),                        // today, open
      mk({ dueDate: dayAt(0), status: 'in_progress' }),                // today, open
      mk({ dueDate: dayAt(0), status: 'done', completedAt: dayAt(0) }),// today, done
      mk({ dueDate: dayAt(-1), status: 'todo' }),                      // yesterday, OPEN → overdue
      mk({ dueDate: dayAt(1), status: 'todo' }),                       // tomorrow, open (not overdue)
      mk({ dueDate: '', status: 'todo' }),                            // undated → excluded
    ];
    const m = taskCountsByDay(list, NOW);
    expect(m.size).toBe(3); // three distinct dated days; the undated task adds no key
    expect(m.get(midnight(0))).toEqual({ total: 3, open: 2, done: 1, overdue: 0 });
    expect(m.get(midnight(-1))).toEqual({ total: 1, open: 1, done: 0, overdue: 1 });
    expect(m.get(midnight(1))).toEqual({ total: 1, open: 1, done: 0, overdue: 0 });
  });

  it('marks an all-completed day with open 0 (the grid\'s "all done" signal)', () => {
    const m = taskCountsByDay([
      mk({ dueDate: dayAt(0), status: 'done', completedAt: dayAt(0) }),
      mk({ dueDate: dayAt(0), status: 'done', completedAt: dayAt(0) }),
    ], NOW);
    expect(m.get(midnight(0))).toEqual({ total: 2, open: 0, done: 2, overdue: 0 });
  });

  it('a PAST day that is fully done is not overdue (overdue counts OPEN work only)', () => {
    const m = taskCountsByDay([mk({ dueDate: dayAt(-1), status: 'done', completedAt: dayAt(-1) })], NOW);
    expect(m.get(midnight(-1))).toEqual({ total: 1, open: 0, done: 1, overdue: 0 });
  });

  it('keys on local midnight — the same key monthMatrix cells carry', () => {
    const m = taskCountsByDay([mk({ dueDate: dayAt(0) })], NOW);
    const cell = monthMatrix(NOW).weeks.flat().find((c) => c.inMonth && c.date === 18)!;
    expect(m.get(cell.ms)!.total).toBe(1); // grid cell ms and tally key are interchangeable
  });
});
