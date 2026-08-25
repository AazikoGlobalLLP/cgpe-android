/**
 * PHASE 76 (audit #5) — the enqueue-DURING-flush race.
 *
 * `flushWriteQueue` used to load the queue ONCE and write its mutated local snapshot back after each
 * replay. If the user queued a NEW create while a replay's network POST was in flight, that draft
 * landed on disk and was then silently overwritten by the flush's stale snapshot — a customer lead
 * gone from storage and screen with no notice. The fix re-reads the queue from disk AFTER each replay
 * and mutates only the replayed draft by id, so a concurrently-enqueued draft survives.
 *
 * Unlike the other queue tests (which let the Vitest AsyncStorage stub answer "empty"), this file
 * mocks AsyncStorage with a REAL in-memory store so the offlineStore round-trip actually happens —
 * that round-trip is exactly what the race lives in.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// A real in-memory AsyncStorage so loadQueue/saveQueue actually persist (the race is on disk).
// A fresh Map per module evaluation → `vi.resetModules()` in beforeEach gives each test a clean store.
vi.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: async (k: string, v: string) => { mem.set(k, v); },
      getAllKeys: async () => [...mem.keys()],
      multiRemove: async (ks: string[]) => { ks.forEach((k) => mem.delete(k)); },
    },
  };
});

type Api = typeof import('@/data/api');
type Store = typeof import('@/data/offlineStore');
let api: Api;
let store: Store;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const leadDraft = (id: string, name: string, phone: string) => ({
  id, kind: 'lead' as const,
  payload: { name, phone, status: 'new_lead' },
  createdAt: '2026-08-01T00:00:00.000Z', attempts: 0,
});

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  store = await import('@/data/offlineStore');
  api.setAuthToken('test-token');       // a real session (a `demo-` token would disable the network)
  api.setCurrentUser('u1', 'Tester');   // the queue is per-user
});
afterEach(() => {
  vi.useRealTimers();
});

describe('flushWriteQueue — a draft enqueued during a replay is never clobbered (audit #5)', () => {
  it('a NEW draft that lands while draft X is replaying (X → synced) survives the flush', async () => {
    const X = leadDraft('pending-X', 'Xavier', '1112223330');
    const B = leadDraft('pending-B', 'Bela', '4445556660');
    await store.saveQueue('u1', [X]);

    // Simulate a concurrent enqueue during the replay POST: while X's create is "in flight", the user
    // saves lead B, so the on-disk queue becomes [X, B] (enqueueWrite's net effect). Then X's POST 201s.
    fetchSpy.mockImplementation(async () => {
      const cur = await store.loadQueue('u1');
      await store.saveQueue('u1', [...cur, B]);
      return reply(201, { success: true, data: { lead: { _id: 'srv-X', name: 'Xavier', phone: '1112223330', status: 'new_lead' } } });
    });

    const res = await api.flushWriteQueue();
    expect(res.synced).toBe(1);              // X synced and removed

    const finalQ = await store.loadQueue('u1');
    expect(finalQ.map((d) => d.id)).toEqual(['pending-B']);   // B PRESERVED (was silently lost under the bug)
  });

  it('the same holds when X is KEPT (a 5xx), not just synced', async () => {
    const X = leadDraft('pending-X', 'Xavier', '1112223330');
    const B = leadDraft('pending-B', 'Bela', '4445556660');
    await store.saveQueue('u1', [X]);

    fetchSpy.mockImplementation(async () => {
      const cur = await store.loadQueue('u1');
      await store.saveQueue('u1', [...cur, B]);
      return reply(500, { success: false, error: 'Server Error' });   // X → keep (5xx under the cap)
    });

    const res = await api.flushWriteQueue();
    expect(res.synced).toBe(0);
    expect(res.dropped).toBe(0);

    const finalQ = await store.loadQueue('u1');
    const ids = finalQ.map((d) => d.id).sort();
    expect(ids).toEqual(['pending-B', 'pending-X']);          // both kept — X bumped, B preserved
    expect(finalQ.find((d) => d.id === 'pending-X')!.attempts).toBe(1);
  });
});

describe('flushWriteQueue — a network THROW keep does NOT bump the poison-cap counter (loophole audit 2026-08-25)', () => {
  it('an offline flush (replay throws) keeps the draft at attempts:0, so a later 5xx still gets the full cap', async () => {
    const X = leadDraft('pending-X', 'Xavier', '1112223330');
    // Start it partway to the cap — a legitimate offline draft that has replayed a few times.
    await store.saveQueue('u1', [{ ...X, attempts: 3 }]);

    // The network is dead: the replay POST throws (no server answer at all).
    fetchSpy.mockImplementation(async () => { throw new Error('Network request failed'); });

    const res = await api.flushWriteQueue();
    expect(res.synced).toBe(0);
    expect(res.dropped).toBe(0);                              // a throw NEVER drops

    const finalQ = await store.loadQueue('u1');
    const x = finalQ.find((d) => d.id === 'pending-X')!;
    expect(x).toBeDefined();
    // The bug: the throw bumped attempts to 4, so the very NEXT server 5xx would hit the cap and drop
    // a create that never reached the server. The fix keeps it flat — only a real 5xx counts.
    expect(x.attempts).toBe(3);
  });
});
