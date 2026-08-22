/**
 * PHASE 78 — the `Idempotency-Key` header on the three additive create endpoints, pinned.
 *
 * THE BUG THIS CLOSES (mobile audit 2026-08-21, #7; backend shipped the dedupe in Phase 81): a
 * create whose ack is lost AFTER the server committed (weak network, or our 12 s timeout firing
 * post-receipt) is re-POSTed by the offline write queue on reconnect, inserting a SECOND identical
 * row — a duplicate lead double-counts the pipeline and sends two agents after one prospect. The
 * server now dedupes on `(creator, key)`, but only if the client sends the SAME key on the first
 * attempt and its replay. That is the load-bearing property, and it is exactly what this file pins:
 *
 *   1. every online create (`/leads`, `/team/tasks`, `/notice-board`) sends an `Idempotency-Key`
 *      header, within the server's required 8–200 char length;
 *   2. a create that THROWS stores that SAME key on its queued draft — so the eventual replay
 *      carries it (generate-once-and-reuse, not a fresh key per attempt);
 *   3. the flush replay actually re-sends the stored key.
 *
 * Contract: `contracts/api.md` §Idempotency-Key. Fetch is stubbed at the one boundary the app calls
 * (`req`), as in the sibling api-*.test.ts files.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Pending = typeof import('@/data/pendingWrites');
let api: Api;
let pending: Pending;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** The init the app passed to fetch on call `i`, and the Idempotency-Key it carried (or undefined). */
const sentKey = (i = 0): string | undefined => {
  const init = fetchSpy.mock.calls[i]?.[1] as RequestInit | undefined;
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return headers['Idempotency-Key'];
};

/** The server-side length guard the key must satisfy (api.md §Idempotency-Key). */
const inRange = (k: string | undefined) => typeof k === 'string' && k.length >= 8 && k.length <= 200;

async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(400);
  return p;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  pending = await import('@/data/pendingWrites');
  api.setAuthToken('test-token');
  api.setCurrentUser('u1', 'Tester');   // the queue is per-user
});
afterEach(() => {
  vi.useRealTimers();
});

describe('online creates send a valid Idempotency-Key header', () => {
  it('addLead sends one on POST /leads', async () => {
    fetchSpy.mockResolvedValue(reply(201, { success: true, data: { lead: { _id: 'srv-1', name: 'asha patel', phone: '9876543210', status: 'new_lead', probability: 10 } } }));
    await api.addLead({ name: 'Asha Patel', phone: '9876543210' });
    expect(inRange(sentKey())).toBe(true);
  });

  it('addTask sends one on POST /team/tasks', async () => {
    fetchSpy.mockResolvedValue(reply(201, { success: true, data: { id: 'srv-t1' } }));
    await api.addTask({ title: 'Call Asha', assigneeName: 'Tester' });
    expect(inRange(sentKey())).toBe(true);
  });

  it('addNote sends one on POST /notice-board', async () => {
    fetchSpy.mockResolvedValue(reply(201, { success: true, data: { noticeId: 'NB-ABC', text: 'hi' } }));
    await api.addNote('remember to follow up', 'note', []);
    expect(inRange(sentKey())).toBe(true);
  });

  it('two separate creates get DIFFERENT keys (dedupe is per logical create, not global)', async () => {
    fetchSpy.mockResolvedValue(reply(201, { success: true, data: { lead: { _id: 'srv-1', name: 'a', phone: '9876543210', status: 'new_lead', probability: 10 } } }));
    await api.addLead({ name: 'A', phone: '9876543210' });
    await api.addLead({ name: 'B', phone: '9876543211' });
    expect(sentKey(0)).not.toBe(sentKey(1));
  });
});

describe('a create that throws stores the SAME key on its queued draft', () => {
  it('addLead: the queued draft carries the key sent on the failed online attempt', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    await settle(api.addLead({ name: 'Asha Patel', phone: '9876543210' }));

    const attemptKey = sentKey(0);
    expect(inRange(attemptKey)).toBe(true);

    const q = pending.getPendingByKind('lead');
    expect(q).toHaveLength(1);
    // The load-bearing property: replay will reuse THIS, and it equals what the server already saw.
    expect(q[0].idempotencyKey).toBe(attemptKey);
  });

  it('addTask: the queued draft carries the failed attempt key', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    await settle(api.addTask({ title: 'Call Asha' }));
    const q = pending.getPendingByKind('task');
    expect(q).toHaveLength(1);
    expect(q[0].idempotencyKey).toBe(sentKey(0));
    expect(inRange(q[0].idempotencyKey)).toBe(true);
  });

  it('addNote: the queued draft carries the failed attempt key', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    await settle(api.addNote('follow up', 'note', []));
    const q = pending.getPendingByKind('note');
    expect(q).toHaveLength(1);
    expect(q[0].idempotencyKey).toBe(sentKey(0));
    expect(inRange(q[0].idempotencyKey)).toBe(true);
  });
});

describe('the flush replay re-sends the stored key so the server dedupes', () => {
  it('replays a queued lead with its ORIGINAL idempotency key', async () => {
    const offlineStore = await import('@/data/offlineStore');
    const draft = {
      id: 'pending-1',
      kind: 'lead' as const,
      payload: { name: 'Asha Patel', phone: '9876543210', status: 'new_lead' },
      createdAt: '2026-08-22T00:00:00.000Z',
      attempts: 0,
      idempotencyKey: 'idem-fixed-key-123456',
    };
    vi.spyOn(offlineStore, 'loadQueue').mockResolvedValue([draft]);
    vi.spyOn(offlineStore, 'saveQueue').mockResolvedValue();
    // The server replays its stored 2xx (a real lead document) — flush marks it synced.
    fetchSpy.mockResolvedValue(reply(201, { success: true, data: { lead: { _id: 'srv-1', name: 'asha patel', phone: '9876543210', status: 'new_lead', probability: 10 } } }));

    const res = await api.flushWriteQueue();

    expect(res.synced).toBe(1);
    expect(sentKey(0)).toBe('idem-fixed-key-123456');
  });

  it('an OLD draft with no key replays without the header (back-compat, never worse than before)', async () => {
    const offlineStore = await import('@/data/offlineStore');
    const draft = {
      id: 'pending-old',
      kind: 'note' as const,
      payload: { text: 'legacy', category: 'note', tags: [] },
      createdAt: '2026-08-22T00:00:00.000Z',
      attempts: 0,
      // no idempotencyKey — persisted before Phase 78
    };
    vi.spyOn(offlineStore, 'loadQueue').mockResolvedValue([draft]);
    vi.spyOn(offlineStore, 'saveQueue').mockResolvedValue();
    fetchSpy.mockResolvedValue(reply(201, { success: true, data: { noticeId: 'NB-1', text: 'legacy' } }));

    const res = await api.flushWriteQueue();

    expect(res.synced).toBe(1);
    expect(sentKey(0)).toBeUndefined();
  });
});
