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
import { taskProgress, type Task, type TaskStatus, type TaskStep } from '@/data/tasks';

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
