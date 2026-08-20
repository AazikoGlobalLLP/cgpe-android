import { describe, it, expect } from 'vitest';
import {
  buildSyncItems,
  planSync,
  fingerprint,
  allDayRange,
  type SyncItem,
  type SyncMap,
} from '@/lib/calendarSync';
import type { Task } from '@/data/tasks';
import type { Reminder } from '@/data/types';

/**
 * PHASE 73 (Option B — auto-add tasks/reminders to the phone calendar). `lib/calendar.ts` imports
 * `expo-calendar` and is device-only, so the two decisions that must be correct — which items to
 * mirror, and the idempotent create/update/delete plan — live in the pure `lib/calendarSync.ts` and
 * are pinned here.
 */

function mkTask(p: Partial<Task>): Task {
  return {
    id: 't1', title: 'A task', description: '', status: 'todo', priority: 'medium',
    category: 'General', dueDate: '2026-08-25', assignedBy: 'boss', steps: [], createdAt: '2026-08-20',
    ...p,
  };
}
function mkReminder(p: Partial<Reminder>): Reminder {
  return { id: 'r1', type: 'followup', title: 'A reminder', subtitle: '', date: '2026-08-26', done: false, ...p };
}

describe('buildSyncItems — what belongs on the calendar (PHASE 73)', () => {
  it('includes dated, open tasks and reminders with namespaced keys', () => {
    const items = buildSyncItems([mkTask({ id: 'x' })], [mkReminder({ id: 'y' })]);
    expect(items.map((i) => i.key)).toEqual(['task:x', 'reminder:y']);
  });

  it('SKIPS undated items — never coerces a blank date to today', () => {
    expect(buildSyncItems([mkTask({ dueDate: '' })], [])).toEqual([]);
    expect(buildSyncItems([], [mkReminder({ date: '' })])).toEqual([]);
    // A garbage date is Invalid → also skipped, not epoch-1970.
    expect(buildSyncItems([mkTask({ dueDate: 'not-a-date' })], [])).toEqual([]);
  });

  it('EXCLUDES completed items so finishing a task reconciles to a delete', () => {
    expect(buildSyncItems([mkTask({ status: 'done' })], [])).toEqual([]);
    expect(buildSyncItems([], [mkReminder({ done: true })])).toEqual([]);
  });

  it('carries description + client into the notes', () => {
    const [item] = buildSyncItems([mkTask({ description: 'Call them', client: 'Asha' })], []);
    expect(item.notes).toBe('Call them\nClient: Asha');
  });
});

describe('fingerprint — day-granular change signature (PHASE 73)', () => {
  const base: SyncItem = { key: 'task:1', title: 'Renew policy', startISO: '2026-08-25T09:00:00Z', notes: '' };

  it('is stable across a time-of-day jitter on the same local day', () => {
    expect(fingerprint(base)).toBe(fingerprint({ ...base, startISO: '2026-08-25T09:45:00Z' }));
  });

  it('changes on a rename or a reschedule to another day', () => {
    expect(fingerprint(base)).not.toBe(fingerprint({ ...base, title: 'Renew LIC policy' }));
    expect(fingerprint(base)).not.toBe(fingerprint({ ...base, startISO: '2026-08-26T09:00:00Z' }));
  });
});

describe('planSync — idempotent reconciliation (PHASE 73)', () => {
  const a: SyncItem = { key: 'task:a', title: 'A', startISO: '2026-08-25', notes: '' };
  const b: SyncItem = { key: 'task:b', title: 'B', startISO: '2026-08-26', notes: '' };

  it('creates everything on the first sync (empty map)', () => {
    const plan = planSync([a, b], {});
    expect(plan.create).toEqual([a, b]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('does NOTHING when the map already matches (the common refresh case)', () => {
    const map: SyncMap = { 'task:a': { eventId: 'e-a', fp: fingerprint(a) }, 'task:b': { eventId: 'e-b', fp: fingerprint(b) } };
    const plan = planSync([a, b], map);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('updates only the item whose title/day changed, keeping its event id', () => {
    const map: SyncMap = { 'task:a': { eventId: 'e-a', fp: fingerprint(a) }, 'task:b': { eventId: 'e-b', fp: fingerprint(b) } };
    const a2 = { ...a, title: 'A renamed' };
    const plan = planSync([a2, b], map);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([{ item: a2, eventId: 'e-a' }]);
    expect(plan.remove).toEqual([]);
  });

  it('removes a previously mirrored item that is no longer desired (completed/deleted/undated)', () => {
    const map: SyncMap = { 'task:a': { eventId: 'e-a', fp: fingerprint(a) }, 'task:b': { eventId: 'e-b', fp: fingerprint(b) } };
    const plan = planSync([a], map); // b dropped out of desired
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([{ key: 'task:b', eventId: 'e-b' }]);
  });

  it('handles a create + update + remove in one pass', () => {
    const map: SyncMap = { 'task:a': { eventId: 'e-a', fp: 'STALE' }, 'task:gone': { eventId: 'e-g', fp: 'x' } };
    const plan = planSync([a, b], map); // a changed (stale fp), b new, task:gone removed
    expect(plan.update).toEqual([{ item: a, eventId: 'e-a' }]);
    expect(plan.create).toEqual([b]);
    expect(plan.remove).toEqual([{ key: 'task:gone', eventId: 'e-g' }]);
  });
});

describe('allDayRange — a whole-day span, never a fake today (PHASE 73)', () => {
  it('spans exactly 24h from local midnight for a valid date', () => {
    const r = allDayRange('2026-08-25T13:00:00Z')!;
    expect(r).not.toBeNull();
    expect(r.end.getTime() - r.start.getTime()).toBe(86400000);
    expect(r.start.getHours()).toBe(0);
  });

  it('returns null for a blank or invalid date', () => {
    expect(allDayRange('')).toBeNull();
    expect(allDayRange('nonsense')).toBeNull();
  });
});
