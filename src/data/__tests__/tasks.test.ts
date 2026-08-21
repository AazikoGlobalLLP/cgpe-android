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
import { dueBucket, taskProgress, todayProgress, todayWorkload, type Task, type TaskStatus, type TaskStep } from '@/data/tasks';

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
 * read as "0 / nothing scheduled". Home keeps the tighter `todayProgress` — the divergence is
 * deliberate, so these pins also assert the two functions differ exactly on open-overdue.
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
