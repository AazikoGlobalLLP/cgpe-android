/**
 * Band 2 #3 (owner backlog Point 5) — the `updateTask` EDIT contract, pinned.
 *
 * `updateTask` PATCHes /team/tasks/:id with a PARTIAL body: only the fields the caller supplies are
 * sent, priority is mapped to the server P-code, and — the load-bearing bit — `dueAt` is sent ONLY
 * when the caller changes the due date, so an unrelated edit (e.g. fixing a title) can never move a
 * task's existing timestamp. The backend PATCH has no ownership gate, so there is no `forbidden`
 * outcome; a refused body or a dead session resolve `server`/`network`, and — since PATCH is a WRITE —
 * a network throw is a SINGLE fetch (writes never retry, per the retry-backoff trap in CLAUDE.md).
 *
 * Mirrors `api-task-queue.test.ts`: resetModules + await import per test (api.ts holds mutable state),
 * a real token so the network is not disabled, and fetch stubbed. No timer advance is needed because
 * the mocked fetch settles immediately.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** The PATCH request body of the Nth fetch call, parsed. */
const bodyOf = (call = 0) => JSON.parse(fetchSpy.mock.calls[call][1].body as string);
/** The URL + method of the Nth fetch call. */
const reqOf = (call = 0) => ({ url: String(fetchSpy.mock.calls[call][0]), method: fetchSpy.mock.calls[call][1].method });

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  api.setAuthToken('test-token');       // a real session (a `demo-` token would disable the network)
  api.setCurrentUser('u1', 'Tester');
});
afterEach(() => {
  vi.useRealTimers();
});

describe('updateTask — edit PATCH contract', () => {
  it('PATCHes /team/tasks/:id and maps the app fields to the server body (priority → P-code)', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true }));
    const res = await api.updateTask('task-7', {
      title: 'Collect KYC',
      description: 'bring the PAN copy',
      client: 'Acme',
      priority: 'high',
      dueDate: '2026-09-01T17:00:00.000Z',
    });
    expect(res).toEqual({ ok: true });

    const { url, method } = reqOf();
    expect(method).toBe('PATCH');
    expect(url).toMatch(/\/team\/tasks\/task-7$/);
    expect(bodyOf()).toEqual({
      title: 'Collect KYC',
      details: 'bring the PAN copy',
      clientName: 'Acme',
      priority: 'P1',
      dueAt: '2026-09-01T17:00:00.000Z',
    });
  });

  it('omits dueAt entirely when no dueDate is supplied — an unrelated edit never moves the due date', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true }));
    await api.updateTask('task-7', { title: 'Renamed', description: '', client: '', priority: 'medium' });

    const body = bodyOf();
    expect(body).toEqual({ title: 'Renamed', details: '', clientName: '', priority: 'P2' });
    expect(body).not.toHaveProperty('dueAt');
  });

  it('sends ONLY the fields provided (a priority-only edit sends just the priority)', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true }));
    await api.updateTask('t1', { priority: 'low' });
    expect(bodyOf()).toEqual({ priority: 'P3' });
  });

  it('empty description / client are sent as "" so the backend can clear them', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true }));
    await api.updateTask('t1', { description: '', client: '' });
    expect(bodyOf()).toEqual({ details: '', clientName: '' });
  });

  it('a 400 refusal resolves { ok: false, reason: "server" } (no forbidden — edit has no ownership gate)', async () => {
    fetchSpy.mockResolvedValue(reply(400, { success: false, message: 'A title is required.' }));
    const res = await api.updateTask('t1', { title: '   ' });
    expect(res).toEqual({ ok: false, reason: 'server' });
  });

  it('a 500 resolves { ok: false, reason: "server" }', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false }));
    const res = await api.updateTask('t1', { title: 'x' });
    expect(res).toEqual({ ok: false, reason: 'server' });
  });

  it('a NETWORK throw resolves { ok: false, reason: "network" } with a SINGLE fetch (writes never retry)', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const res = await api.updateTask('t1', { title: 'x' });
    expect(res).toEqual({ ok: false, reason: 'network' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('no session (no token) refuses as network without touching the network', async () => {
    api.setAuthToken(null);
    const res = await api.updateTask('t1', { title: 'x' });
    expect(res).toEqual({ ok: false, reason: 'network' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
