/** September 7 contract: intake/review only. No response means erasure or session teardown. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let api: typeof import('@/data/api');
let session: typeof import('@/lib/session');
let fetchSpy: ReturnType<typeof vi.fn>;
const requestId = '507f1f77bcf86cd799439011';
const reply = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const data = (status = 'pending', extra = {}) => ({ request_id: requestId, status, ...extra });

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  session = await import('@/lib/session');
  api.setAuthToken('account-a-token');
});
afterEach(() => { vi.useRealTimers(); });

describe('requestAccountDeletion — request submission, never a DELETE', () => {
  it.each(['pending', 'under_review', 'rejected'])('accepts a 202 %s request/replay and keeps authentication', async (status) => {
    const expired = vi.fn();
    session.onSessionExpired(expired);
    fetchSpy.mockResolvedValue(reply(202, { success: true, data: data(status) }));
    expect(await api.requestAccountDeletion()).toEqual({ ok: true, request: { requestId, status, reviewNotes: '' } });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/\/auth\/me\/deletion-request$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({});
    expect(init.headers.Authorization).toBe('Bearer account-a-token');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: data(status) }));
    await api.getAccountDeletionRequest();
    expect(fetchSpy.mock.calls[1][1].headers.Authorization).toBe('Bearer account-a-token');
  });

  it.each([
    [200, { success: true, data: data() }],
    [202, { success: true, data: {} }],
    [202, { success: false, data: data() }],
    [202, { data: data() }],
    [202, { success: true, data: data('deleted') }],
    [202, { success: true, data: data('approved') }],
    [202, { success: true, data: data('pending', { request_id: '' }) }],
    [202, { success: true, data: data('pending', { review_notes: {} }) }],
  ])('does not confirm malformed/non-contract success (%s)', async (status, body) => {
    fetchSpy.mockResolvedValue(reply(status as number, body));
    expect(await api.requestAccountDeletion()).toEqual({ ok: false, reason: 'server' });
  });

  it.each([404, 405, 501])('reports unsupported server (%s) without retrying a write', async (status) => {
    fetchSpy.mockResolvedValue(reply(status, { success: false }));
    expect(await api.requestAccountDeletion()).toEqual({ ok: false, reason: 'unsupported' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([400, 429, 500, 503])('leaves %s unconfirmed without a duplicate write', async (status) => {
    fetchSpy.mockResolvedValue(reply(status, { success: false }));
    expect(await api.requestAccountDeletion()).toEqual({ ok: false, reason: 'server' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps a network failure unconfirmed and never retries the POST', async () => {
    fetchSpy.mockRejectedValue(new Error('offline'));
    expect(await api.requestAccountDeletion()).toEqual({ ok: false, reason: 'network' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not fabricate a request while signed out', async () => {
    api.setAuthToken(null);
    expect(await api.requestAccountDeletion()).toEqual({ ok: false, reason: 'network' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('getAccountDeletionRequest — an unavailable read is not an empty status', () => {
  it('reads own review status and notes without supplying a subject', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: data('rejected', {
      user_id: 'account-a', review_notes: 'Please contact the office.',
    }) }));
    expect(await api.getAccountDeletionRequest()).toEqual({ ok: true, request: {
      requestId, status: 'rejected', reviewNotes: 'Please contact the office.',
    } });
    expect(fetchSpy.mock.calls[0][0]).toMatch(/\/auth\/me\/deletion-request$/);
    expect(fetchSpy.mock.calls[0][1].body).toBeUndefined();
    expect(fetchSpy.mock.calls[0][1].method).toBeUndefined();
  });

  it('represents GET 404 as no request returned, not an unsupported POST', async () => {
    fetchSpy.mockResolvedValue(reply(404, { success: false, error: 'No account deletion request found.' }));
    expect(await api.getAccountDeletionRequest()).toEqual({ ok: true, request: null });
  });

  it.each([{}, null, data('completed'), { ...data(), review_notes: [] }])('rejects malformed 200 data (%j)', async (body) => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: body }));
    expect(await api.getAccountDeletionRequest()).toEqual({ ok: false, reason: 'server' });
  });

  it('reports exhausted transient GET failure, never an authoritative empty result', async () => {
    fetchSpy.mockResolvedValue(reply(503, { success: false }));
    const promise = api.getAccountDeletionRequest();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await promise).toEqual({ ok: false, reason: 'server' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('account identity across awaited responses', () => {
  it.each(['getAccountDeletionRequest', 'requestAccountDeletion'] as const)('%s preserves session on 403 but expires the rejected credential on 401', async (method) => {
    const expired = vi.fn();
    session.onSessionExpired(expired);
    fetchSpy.mockResolvedValue(reply(403, { success: false }));
    expect(await api[method]()).toEqual({ ok: false, reason: 'forbidden' });
    expect(expired).not.toHaveBeenCalled();
    fetchSpy.mockResolvedValue(reply(401, { success: false }));
    await api[method]();
    expect(expired).toHaveBeenCalledOnce();
  });

  it.each([200, 401])('discards an old user\'s delayed %s without expiring the new session', async (status) => {
    const expired = vi.fn();
    session.onSessionExpired(expired);
    let resolve!: (value: ReturnType<typeof reply>) => void;
    fetchSpy.mockReturnValue(new Promise((r) => { resolve = r; }));
    const promise = api.getAccountDeletionRequest();
    api.setAuthToken('account-b-token');
    resolve(reply(status, { success: true, data: data() }));
    expect(await promise).toEqual({ ok: false, reason: 'network' });
    expect(expired).not.toHaveBeenCalled();
  });

  it('discards a late accepted submission after sign-out', async () => {
    let resolve!: (value: ReturnType<typeof reply>) => void;
    fetchSpy.mockReturnValue(new Promise((r) => { resolve = r; }));
    const promise = api.requestAccountDeletion();
    api.setAuthToken(null);
    resolve(reply(202, { success: true, data: data() }));
    expect(await promise).toEqual({ ok: false, reason: 'network' });
  });
});
