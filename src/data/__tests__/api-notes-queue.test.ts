/**
 * PHASE 57b — the `addNote` three-outcome write contract, pinned.
 *
 * The offline write queue turns a note create from two outcomes into three, and the DISTINCTION is
 * the whole safety property:
 *   - a 200 `{success:true}`        → `saved`  (on the server)
 *   - a server REFUSAL (a 4xx/5xx)  → `failed` (NOT queued — replaying a rejected write is wrong)
 *   - a NETWORK throw               → `queued` (the additive draft is held to sync later)
 * A queued draft must land in the pending-writes bus with `pending:true`; a refusal must NOT.
 *
 * The queue's device I/O (AsyncStorage) is a no-op under the test stub, so this pins the CLASSIFY +
 * bus behaviour (the pure decisions are in `lib/writeQueue`'s own test); the flush replay + storage
 * round-trip are device-only, like every other AsyncStorage path in this suite.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Pending = typeof import('@/data/pendingWrites');
let api: Api;
let pending: Pending;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  pending = await import('@/data/pendingWrites');
  api.setAuthToken('test-token');       // a real session (a `demo-` token would disable the network)
  api.setCurrentUser('u1', 'Tester');   // the queue is per-user; without an id nothing can be queued
});
afterEach(() => {
  vi.useRealTimers();
});

describe('addNote — three outcomes', () => {
  it('SAVED: a 200 {success:true} returns the server note and queues nothing', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: { id: 'srv-1', text: 'hi' } }));
    const res = await api.addNote('hi', 'note', []);
    expect(res.status).toBe('saved');
    expect(res.status === 'saved' && res.note.id).toBe('srv-1');
    expect(pending.getPendingByKind('note')).toHaveLength(0);
  });

  it('FAILED: a 400 server refusal returns failed and does NOT queue (retrying a rejected write is wrong)', async () => {
    fetchSpy.mockResolvedValue(reply(400, { success: false, message: 'bad' }));
    const res = await api.addNote('hi', 'note', []);
    expect(res.status).toBe('failed');
    expect(pending.getPendingByKind('note')).toHaveLength(0);
  });

  it('QUEUED: a NETWORK throw queues an additive draft flagged pending', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const res = await api.addNote('offline note', 'idea', []);
    expect(res.status).toBe('queued');
    expect(res.status === 'queued' && res.note.pending).toBe(true);
    expect(res.status === 'queued' && res.note.text).toBe('offline note');

    const q = pending.getPendingByKind('note');
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe('note');
    expect(q[0].payload).toEqual({ text: 'offline note', category: 'idea', tags: [] });
  });

  it('FAILED: no session (no token) refuses without touching the network or the queue', async () => {
    api.setAuthToken(null);
    const res = await api.addNote('hi', 'note', []);
    expect(res.status).toBe('failed');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(pending.getPendingByKind('note')).toHaveLength(0);
  });
});
