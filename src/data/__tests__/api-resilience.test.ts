/**
 * Phase 55 — network resilience wired into the real `req()` / `uploadFile` / `testConnection`.
 *
 * This pins the BEHAVIOUR the pure `netResilience` rules produce once they are in the transport:
 *   - an idempotent READ retries ONCE on a transient fault (5xx / 429 / a throw) and recovers if the
 *     retry lands; a WRITE never retries (a clock-in / send must not double-fire);
 *   - a considered answer (404) is not retried;
 *   - the failure KIND reaches `data/health` so the banner can name it;
 *   - `testConnection` probes the unauthenticated /health honestly (first result, no retry);
 *   - `uploadFile` now carries an AbortController signal so a stall can't hang forever.
 *
 * Fake timers, because a real read now waits a 600 ms backoff before its retry — the tests advance
 * past it instead of paying it. `api.ts` holds module state with no reset export, so it is re-imported
 * per test (CLAUDE.md). Fetch is stubbed at the one boundary so the real req/health paths run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
/** An error shaped like our AbortController's abort (what a timeout surfaces as). */
const abortErr = () => { const e = new Error('The operation was aborted'); e.name = 'AbortError'; return e; };

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT make the session real
});

afterEach(() => { vi.useRealTimers(); });

describe('req() retry — idempotent reads recover from a transient fault', () => {
  it('retries a GET once after a 5xx and RECOVERS when the retry lands (no banner)', async () => {
    fetchSpy
      .mockResolvedValueOnce(reply(500, { success: false, error: 'flaky' }))
      .mockResolvedValueOnce(reply(200, { success: true, data: { plans: [] } }));   // getLicPlans validates data.plans
    const p = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(2000);   // past the backoff, so the 2nd attempt fires
    expect(await p).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(health.getHealth().degraded).toBe(false);   // recovered — the transient blip never reached the user
  });

  it('gives up after the BOUNDED number of retries (2 attempts total) and reports "server"', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false, error: 'down' }));
    const p = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);   // 1 first attempt + RETRY_ATTEMPTS(1)
    expect(health.getHealth().degraded).toBe(true);
    expect(health.getHealth().kind).toBe('server');
  });

  it('retries a GET on a network THROW and carries the "network" kind when it stays down', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const p = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(health.getHealth().kind).toBe('network');
  });

  it('does NOT retry a 404 — a considered answer, not a transient fault, and stays quiet', async () => {
    fetchSpy.mockResolvedValue(reply(404, { success: false, message: 'gone' }));
    const p = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);            // answered once, not retried
    expect(health.getHealth().degraded).toBe(false);      // 404 is an answer → no banner
  });
});

describe('req() retry — WRITES are never retried', () => {
  it('does not retry a POST that hits a 5xx (a write must not double-fire)', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false, message: 'boom' }));
    const r = await api.sendOtp('9876543210');   // POST /auth/request-otp
    expect(r.ok).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('testConnection — the on-device app-vs-WiFi probe', () => {
  it('reports ok + a round-trip time when /health answers 200', async () => {
    fetchSpy.mockResolvedValue(reply(200, { status: 'ok' }));
    const r = await api.testConnection();
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(typeof (r as { ms: number }).ms).toBe('number');
  });

  it('pings the /health path (unauthenticated diagnostic)', async () => {
    fetchSpy.mockResolvedValue(reply(200, {}));
    await api.testConnection();
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/health');
  });

  it('classifies a 5xx as a reachable-but-unwell "server" problem and does NOT retry', async () => {
    fetchSpy.mockResolvedValue(reply(503, { success: false }));
    const r = await api.testConnection();
    expect(r).toMatchObject({ ok: false, kind: 'server', status: 503 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);   // a diagnostic reports the first result honestly
  });

  it('classifies a fetch throw as "network" (cannot reach the host)', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await api.testConnection()).toMatchObject({ ok: false, kind: 'network' });
  });

  it('classifies our abort as "timeout" (the server did not answer in time)', async () => {
    fetchSpy.mockRejectedValue(abortErr());
    expect(await api.testConnection()).toMatchObject({ ok: false, kind: 'timeout' });
  });

  it('raises NO outage banner — it is a probe, not a data read', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    await api.testConnection();
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('uploadFile — the stall guard (Phase 55)', () => {
  it('carries an AbortController signal on the upload request (the old code had none)', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: { url: 'https://cdn/x.jpg', key: 'x' } }));
    const r = await api.uploadFile('file:///tmp/a.jpg', 'a.jpg');
    expect(r).toEqual({ url: 'https://cdn/x.jpg', key: 'x' });
    const uploadCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes('/upload'));
    expect(uploadCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns null when the upload throws — e.g. the abort a timeout fires — instead of hanging', async () => {
    fetchSpy.mockRejectedValue(abortErr());
    expect(await api.uploadFile('file:///tmp/a.jpg', 'a.jpg')).toBeNull();
  });
});
