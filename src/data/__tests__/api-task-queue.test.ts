/**
 * PHASE 57b (Task-create) — the `addTask` FOUR-outcome write contract, pinned.
 *
 * The offline write queue turns a task create from "always looks like it worked" into four honest
 * outcomes, and the DISTINCTION is the whole safety property:
 *   - a 200 with a server id         → `saved`     (on the server)
 *   - a 403                          → `forbidden` (this account may not create tasks — NOT queued)
 *   - any other server REFUSAL       → `failed`    (NOT queued — replaying a rejected write is wrong)
 *   - a NETWORK throw                → `queued`    (the additive draft is held to sync later)
 * A queued draft must land in the pending-writes bus flagged `pending`; a refusal must NOT.
 *
 * The queue's device I/O (AsyncStorage) is a no-op under the test stub, so this pins the CLASSIFY +
 * bus behaviour; the flush replay + storage round-trip are device-only, like every AsyncStorage path
 * in this suite. The pure decisions are in `lib/writeQueue`'s own test.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Pending = typeof import('@/data/pendingWrites');
let api: Api;
let pending: Pending;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const FIELDS = {
  title: 'Offline task',
  description: 'collect the KYC',
  client: 'Acme',
  priority: 'high' as const,
  category: 'Claim',
  dueDate: '2026-08-20T17:00:00.000Z',
  assigneeName: 'Bob',
};

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

describe('addTask — four outcomes', () => {
  it('SAVED: a 200 with a server id returns the task carrying that id and queues nothing', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: { id: 'srv-9' } }));
    const res = await api.addTask(FIELDS);
    expect(res.status).toBe('saved');
    expect(res.status === 'saved' && res.task.id).toBe('srv-9');
    expect(res.status === 'saved' && res.task.title).toBe('Offline task');
    expect(pending.getPendingByKind('task')).toHaveLength(0);
  });

  it('FORBIDDEN: a 403 returns forbidden and does NOT queue (retry cannot grant the role)', async () => {
    fetchSpy.mockResolvedValue(reply(403, { success: false, message: 'not allowed' }));
    const res = await api.addTask(FIELDS);
    expect(res.status).toBe('forbidden');
    expect(pending.getPendingByKind('task')).toHaveLength(0);
  });

  it('FAILED: a 400 server refusal returns failed and does NOT queue', async () => {
    fetchSpy.mockResolvedValue(reply(400, { success: false, message: 'bad' }));
    const res = await api.addTask(FIELDS);
    expect(res.status).toBe('failed');
    expect(pending.getPendingByKind('task')).toHaveLength(0);
  });

  it('FAILED: a 200 WITHOUT a server id is a refusal, not a success — failed, not queued', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: {} }));
    const res = await api.addTask(FIELDS);
    expect(res.status).toBe('failed');
    expect(pending.getPendingByKind('task')).toHaveLength(0);
  });

  it('QUEUED: a NETWORK throw queues an additive draft flagged pending, storing the resolved body fields', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const res = await api.addTask(FIELDS);
    expect(res.status).toBe('queued');
    expect(res.status === 'queued' && res.task.pending).toBe(true);
    expect(res.status === 'queued' && res.task.title).toBe('Offline task');
    expect(res.status === 'queued' && res.task.priority).toBe('high');
    expect(res.status === 'queued' && res.task.client).toBe('Acme');

    const q = pending.getPendingByKind('task');
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe('task');
    expect(q[0].payload).toEqual({
      title: 'Offline task',
      description: 'collect the KYC',
      client: 'Acme',
      priority: 'high',
      category: 'Claim',
      dueDate: '2026-08-20T17:00:00.000Z',
      assigneeName: 'Bob',
    });
  });

  it('QUEUED: an unassigned offline create resolves the assignee to the current user, not blank', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    await api.addTask({ title: 'Solo task', dueDate: '2026-08-20T17:00:00.000Z' });
    const q = pending.getPendingByKind('task');
    expect(q).toHaveLength(1);
    expect((q[0].payload as { assigneeName: string }).assigneeName).toBe('Tester');
  });

  it('FAILED: no session (no token) refuses without touching the network or the queue', async () => {
    api.setAuthToken(null);
    const res = await api.addTask(FIELDS);
    expect(res.status).toBe('failed');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(pending.getPendingByKind('task')).toHaveLength(0);
  });
});
