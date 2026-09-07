import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@/data/tasks';
import type { Reminder } from '@/data/types';
import type { TFn } from '@/i18n';
import { fingerprint, type SyncMap } from '@/lib/calendarSync';

type EventDetail = {
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  notes: string;
};
type NativeEvent = {
  id: string;
  detail: EventDetail;
  update: (detail: EventDetail) => Promise<void>;
  delete: () => Promise<void>;
};

const h = vi.hoisted(() => ({
  saved: new Map<string, string>(),
  events: new Map<string, NativeEvent>(),
  tasks: [] as Task[],
  log: [] as string[],
  createCount: 0,
  activeMutations: 0,
  maxActiveMutations: 0,
  beforeCreate: null as null | ((ordinal: number) => Promise<void>),
  beforeDelete: null as null | ((id: string) => Promise<void>),
  getTasks: vi.fn<(fresh?: boolean) => Promise<Task[]>>(),
  getReminders: vi.fn<() => Promise<Reminder[]>>(),
  createEvent: vi.fn<(detail: EventDetail) => Promise<NativeEvent>>(),
  getEvent: vi.fn<(id: string) => Promise<NativeEvent>>(),
  requestPermission: vi.fn<() => Promise<{ granted: boolean; canAskAgain: boolean }>>(),
}));

// Mock only native/data boundaries. The real calendar queue, projection, and fingerprint run.
vi.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event' },
  CalendarAccessLevel: { OWNER: 'owner' },
  getCalendarPermissions: async () => ({ granted: true, canAskAgain: true }),
  requestCalendarPermissions: h.requestPermission,
  getCalendars: async () => [{
    id: 'calendar-1',
    title: 'CGPE Connect',
    allowsModifications: true,
    createEvent: h.createEvent,
  }],
  createCalendar: async () => { throw new Error('The dedicated test calendar already exists'); },
  ExpoCalendarEvent: { get: h.getEvent },
}));
vi.mock('@/lib/storage', () => ({
  storage: {
    get: async (key: string) => h.saved.get(key) ?? null,
    set: async (key: string, value: string) => { h.saved.set(key, value); },
    remove: async (key: string) => { h.saved.delete(key); },
  },
}));
vi.mock('@/data/api', () => ({ getTasks: h.getTasks, getReminders: h.getReminders }));
vi.mock('@/data/health', () => ({ getHealth: () => ({ failures: [] }) }));

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function task(id: string): Task {
  return {
    id, title: 'Raw title ' + id, description: 'Raw description ' + id,
    client: 'Raw client ' + id, status: 'todo', priority: 'medium',
    category: 'General', dueDate: '2026-09-15', assignedBy: 'boss',
    steps: [], createdAt: '2026-09-01',
  };
}

// Captured translators use obvious language markers, without mounting/importing the React provider.
function tr(language: string): TFn {
  return (key, params) => key === 'calendar.clientNote'
    ? language + ' client: ' + String(params?.name)
    : language + ':' + key;
}

function savedMap(): SyncMap {
  return JSON.parse(h.saved.get('cal.map') ?? '{}') as SyncMap;
}

async function mutation<T>(name: string, run: () => Promise<T>): Promise<T> {
  h.activeMutations += 1;
  h.maxActiveMutations = Math.max(h.maxActiveMutations, h.activeMutations);
  h.log.push(name + ':start');
  try {
    const value = await run();
    h.log.push(name + ':done');
    return value;
  } finally {
    h.activeMutations -= 1;
  }
}

beforeEach(() => {
  vi.resetModules();
  h.saved.clear();
  h.events.clear();
  h.tasks = [];
  h.log = [];
  h.createCount = 0;
  h.activeMutations = 0;
  h.maxActiveMutations = 0;
  h.beforeCreate = null;
  h.beforeDelete = null;
  h.getTasks.mockReset().mockImplementation(async () => h.tasks);
  h.getReminders.mockReset().mockResolvedValue([]);
  h.requestPermission.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  h.getEvent.mockReset().mockImplementation(async (id) => {
    const event = h.events.get(id);
    if (!event) throw Object.assign(new Error('Missing test event'), { code: 'ERR_EVENT_NOT_FOUND' });
    return event;
  });
  h.createEvent.mockReset().mockImplementation(async (detail) => {
    const ordinal = ++h.createCount;
    const id = 'event-' + ordinal;
    return mutation('create:' + id, async () => {
      await h.beforeCreate?.(ordinal);
      const event: NativeEvent = {
        id,
        detail: { ...detail },
        update: async (next) => mutation('update:' + id, async () => {
          event.detail = { ...next };
        }),
        delete: async () => mutation('delete:' + id, async () => {
          await h.beforeDelete?.(id);
          h.events.delete(id);
        }),
      };
      h.events.set(id, event);
      return event;
    });
  });
});

describe('calendar queue ownership and language reconciliation (Phase 116)', () => {
  it('keeps the latest queued same-owner language and updates notes on the existing native ID', async () => {
    const { syncCalendar } = await import('@/lib/calendar');
    const row = task('a');
    h.tasks = [row];
    const started = deferred();
    const release = deferred();
    h.beforeCreate = async () => { started.resolve(); await release.promise; };

    const first = syncCalendar('owner-a', tr('en'));
    await started.promise;
    const intermediate = syncCalendar('owner-a', tr('gu'));
    const latest = syncCalendar('owner-a', tr('hi'));
    release.resolve();
    await Promise.all([first, intermediate, latest]);

    expect(h.createEvent).toHaveBeenCalledTimes(1);
    expect(h.getTasks).toHaveBeenCalledTimes(2);
    expect([...h.events.keys()]).toEqual(['event-1']);
    expect(h.log.filter((entry) => entry.startsWith('delete:'))).toEqual([]);
    expect(h.log.filter((entry) => entry === 'update:event-1:done')).toHaveLength(1);
    const final = h.events.get('event-1')!;
    expect(final.detail).toEqual({
      ...h.createEvent.mock.calls[0][0],
      notes: 'Raw description a\nhi client: Raw client a',
    });
    expect(final.detail.title).toBe(row.title);
    expect(h.createEvent.mock.calls[0][0].notes).toBe('Raw description a\nen client: Raw client a');
    expect(savedMap()).toEqual({
      'task:a': {
        eventId: 'event-1',
        fp: fingerprint({
          key: 'task:a', title: row.title, startISO: row.dueDate, notes: final.detail.notes,
        }),
      },
    });
    expect(h.saved.get('cal.owner')).toBe('owner-a');
    expect(h.maxActiveMutations).toBe(1);
    expect(h.requestPermission).not.toHaveBeenCalled();
  });

  it('finishes owner A cleanup before owner B can fetch and create its mirror', async () => {
    const { syncCalendar } = await import('@/lib/calendar');
    h.tasks = [task('a')];
    await syncCalendar('owner-a', tr('en'));
    const deleting = deferred();
    const release = deferred();
    h.beforeDelete = async () => { deleting.resolve(); await release.promise; };
    h.tasks = [task('b')];

    const nextOwner = syncCalendar('owner-b', tr('gu'));
    await deleting.promise;
    try {
      expect(h.createEvent).toHaveBeenCalledTimes(1);
      expect(h.getTasks).toHaveBeenCalledTimes(1);
      expect(h.saved.get('cal.owner')).toBe('owner-a');
    } finally {
      release.resolve();
      await nextOwner;
    }

    expect([...h.events.keys()]).toEqual(['event-2']);
    expect(h.events.get('event-2')!.detail.title).toBe('Raw title b');
    expect(Object.keys(savedMap())).toEqual(['task:b']);
    expect(h.saved.get('cal.owner')).toBe('owner-b');
    expect(h.log.indexOf('delete:event-1:done')).toBeLessThan(h.log.indexOf('create:event-2:start'));
    expect(h.maxActiveMutations).toBe(1);
  });

  it('rejects an old in-flight source result after clear and a new owner generation', async () => {
    const { syncCalendar, clearCalendarSync } = await import('@/lib/calendar');
    const started = deferred();
    const oldRows = deferred<Task[]>();
    h.getTasks.mockImplementationOnce(async () => {
      started.resolve();
      return oldRows.promise;
    });

    const oldSync = syncCalendar('owner-a', tr('en'));
    await started.promise;
    const clearing = clearCalendarSync();
    h.tasks = [task('b')];
    const newSync = syncCalendar('owner-b', tr('hi'));
    oldRows.resolve([task('a')]);
    await Promise.all([oldSync, clearing, newSync]);

    expect(h.createEvent).toHaveBeenCalledTimes(1);
    expect(h.createEvent.mock.calls[0][0].title).toBe('Raw title b');
    expect(Object.keys(savedMap())).toEqual(['task:b']);
    expect(h.saved.get('cal.owner')).toBe('owner-b');
    expect(h.getTasks).toHaveBeenCalledTimes(2);
    expect(h.maxActiveMutations).toBe(1);
  });

  it('retains a late partial creation when cleanup fails and retries it before another owner writes', async () => {
    const { syncCalendar } = await import('@/lib/calendar');
    h.tasks = [task('a-1'), task('a-2')];
    const secondCreateStarted = deferred();
    const releaseSecondCreate = deferred();
    let allowCleanup = false;
    h.beforeCreate = async (ordinal) => {
      if (ordinal === 2) {
        secondCreateStarted.resolve();
        await releaseSecondCreate.promise;
      }
    };
    h.beforeDelete = async (id) => {
      if (id === 'event-2' && !allowCleanup) throw new Error('Transient native deletion failure');
    };

    const oldSync = syncCalendar('owner-a', tr('en'));
    await secondCreateStarted.promise;
    h.tasks = [task('b')];
    const newSync = syncCalendar('owner-b', tr('hi'));
    releaseSecondCreate.resolve();
    await Promise.all([oldSync, newSync]);

    // The first A event was checkpointed before the switch; the second native result arrived after
    // invalidation. Both entered cleanup, and the failed ID remains attributable to A on disk.
    expect(h.events.has('event-1')).toBe(false);
    expect([...h.events.keys()]).toEqual(['event-2']);
    expect(h.saved.get('cal.owner')).toBe('owner-a');
    expect(Object.keys(savedMap())).toEqual(['task:a-2']);
    expect(savedMap()['task:a-2'].eventId).toBe('event-2');
    expect(h.getTasks).toHaveBeenCalledTimes(1);
    expect(h.createEvent).toHaveBeenCalledTimes(2);

    allowCleanup = true;
    await syncCalendar('owner-b', tr('hi'));

    expect([...h.events.keys()]).toEqual(['event-3']);
    expect(h.events.get('event-3')!.detail.title).toBe('Raw title b');
    expect(Object.keys(savedMap())).toEqual(['task:b']);
    expect(h.saved.get('cal.owner')).toBe('owner-b');
    expect(h.log.indexOf('delete:event-2:done')).toBeLessThan(h.log.indexOf('create:event-3:start'));
    expect(h.maxActiveMutations).toBe(1);
  });
});
