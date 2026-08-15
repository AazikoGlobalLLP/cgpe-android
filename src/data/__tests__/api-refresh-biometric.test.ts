/**
 * PHASE 48 — the biometric session-restore wire contract, pinned.
 *
 * Every expectation is quoted from `contracts/api.md` §`/api/auth` and was re-read in
 * `cgpe-backend-main/routes/auth.js` (`/refresh-biometric`, `/logout`) before it was written
 * (backend Phase 58):
 *
 *   POST /api/auth/refresh-biometric   { refresh_token, device_id? }   — PUBLIC (no `protect`)
 *     200: { success:true, data:{ user:<toPublicJSON()>, token, refresh_token }, message:'Session restored.' }
 *     400: { success:false, error:'refresh_token is required.' }           — missing
 *     401: { success:false, error:'INVALID_REFRESH', message:'…' }         — revoked/expired/unknown/reuse
 *     503: { success:false, error:'Database connection not available…' }   — DB down
 *   POST /api/auth/logout  { refresh_token }  (protect)  — revokes that credential server-side
 *   POST /api/auth/login & /api/auth/verify-otp  — now also return `data.refresh_token` (30d, additive)
 *
 * WHY THIS FILE EXISTS. `refreshBiometricSession` is the ONLY path that turns a biometric-sealed
 * refresh credential back into a live session, no id/OTP. Its THREE outcomes are the whole point
 * and must never blur: 'ok' starts a session (and MUST carry a rotated refresh_token to re-seal),
 * 'declined' (400/401) is an ANSWER that routes to manual sign-in and must raise no outage, and
 * 'error' (5xx / dead net / a 200 missing the rotated credential) keeps the binding and is
 * retryable. The security-load-bearing facts pinned here: a partial 200 body is NOT a session, a
 * 401 with no bearer does NOT cascade into a session-expiry, and the endpoint is called with no
 * Authorization header (it is public by necessity — the access token is dead).
 *
 * FETCH IS STUBBED at the one boundary `api.ts` uses, so the real `req` / health path runs.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (body: unknown) => reply(200, body);

/** A profile as the backend serialises one (`toPublicJSON()`). */
const userRow = (extra: Record<string, unknown> = {}) => ({
  user_id: 'U1', full_name: 'Asha Rao', email: 'asha@cgpe.in', role: 'advisor', ...extra,
});

/** The request the app actually sent: [url, init]. */
const sent = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  const headers = (init?.headers || {}) as Record<string, string>;
  return { url, init, headers, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  // The real scenario: the access token has silently expired, so there is NO bearer. The restore
  // endpoint is public and must be reached without one.
  api.setAuthToken(null);
});
afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------- refreshBiometricSession — the request */

describe('refreshBiometricSession — the request', () => {
  it('POSTs { refresh_token } to /auth/refresh-biometric with NO Authorization header (public)', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { user: userRow(), token: 'fresh.access', refresh_token: 'rot.refresh' }, message: 'Session restored.' }));
    await api.refreshBiometricSession('sealed.refresh');
    expect(sent().url.endsWith('/auth/refresh-biometric')).toBe(true);
    expect(sent().init.method).toBe('POST');
    expect(sent().body).toEqual({ refresh_token: 'sealed.refresh' });
    expect(sent().headers.Authorization).toBeUndefined();
  });

  it('includes device_id only when one is passed', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { user: userRow(), token: 't', refresh_token: 'r' } }));
    await api.refreshBiometricSession('sealed.refresh', 'install-abc');
    expect(sent().body).toEqual({ refresh_token: 'sealed.refresh', device_id: 'install-abc' });
  });

  it('makes NO request for an empty refresh token, and declines', async () => {
    const r = await api.refreshBiometricSession('');
    expect(r).toEqual({ status: 'declined' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------- refreshBiometricSession — the outcome */

describe('refreshBiometricSession — the outcome', () => {
  it('200 with { user, token, refresh_token } → ok, adapts the user and returns the rotated credential', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { user: userRow(), token: 'fresh.access', refresh_token: 'rot.refresh' }, message: 'Session restored.' }));
    const r = await api.refreshBiometricSession('sealed.refresh');
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.token).toBe('fresh.access');
      expect(r.refreshToken).toBe('rot.refresh');
      expect(r.user.id).toBe('U1');
      expect(r.user.name).toBe('Asha Rao');
    }
  });

  it('200 MISSING the rotated refresh_token → error, never a session (would leave a revoked seal)', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { user: userRow(), token: 'fresh.access' } }));
    const r = await api.refreshBiometricSession('sealed.refresh');
    expect(r).toEqual({ status: 'error' });
  });

  it('200 missing the access token → error', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { user: userRow(), refresh_token: 'rot.refresh' } }));
    const r = await api.refreshBiometricSession('sealed.refresh');
    expect(r).toEqual({ status: 'error' });
  });

  it('401 INVALID_REFRESH → declined (an answer: revoked / past 30 days / reuse)', async () => {
    fetchSpy.mockResolvedValue(reply(401, { success: false, error: 'INVALID_REFRESH', message: 'Session could not be restored. Please sign in again.' }));
    const r = await api.refreshBiometricSession('dead.refresh');
    expect(r).toEqual({ status: 'declined' });
  });

  it('400 (missing on the server) → declined', async () => {
    fetchSpy.mockResolvedValue(reply(400, { success: false, error: 'refresh_token is required.' }));
    const r = await api.refreshBiometricSession('whatever');
    expect(r).toEqual({ status: 'declined' });
  });

  it('503 (DB down) → error, retryable', async () => {
    fetchSpy.mockResolvedValue(reply(503, { success: false, error: 'Database connection not available. Please try again later.' }));
    const r = await api.refreshBiometricSession('sealed.refresh');
    expect(r).toEqual({ status: 'error' });
  });

  it('500 → error', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false }));
    const r = await api.refreshBiometricSession('sealed.refresh');
    expect(r).toEqual({ status: 'error' });
  });

  it('a dead network → error (keep the binding, offer retry — never a refusal)', async () => {
    fetchSpy.mockRejectedValue(new Error('Failed to fetch'));
    const r = await api.refreshBiometricSession('sealed.refresh');
    expect(r).toEqual({ status: 'error' });
  });

  it('a 401 with NO bearer does not cascade into a session expiry (public endpoint)', async () => {
    // reportAuth only expires when a token was SENT; a public restore call sends none. If this
    // regressed, the very act of a declined restore would trip the global expiry path.
    const health = await import('@/data/health');
    fetchSpy.mockResolvedValue(reply(401, { success: false, error: 'INVALID_REFRESH' }));
    await api.refreshBiometricSession('dead.refresh');
    expect(health.getHealth().degraded).toBe(false);
  });
});

/* --------------------------------------------------------------------------- serverLogout */

describe('serverLogout', () => {
  it('POSTs { refresh_token } to /auth/logout so the server revokes it', async () => {
    api.setAuthToken('live.access'); // logout runs while still authenticated
    fetchSpy.mockResolvedValue(ok({ success: true, message: 'Logged out successfully' }));
    await api.serverLogout('sealed.refresh');
    expect(sent().url.endsWith('/auth/logout')).toBe(true);
    expect(sent().init.method).toBe('POST');
    expect(sent().body).toEqual({ refresh_token: 'sealed.refresh' });
  });

  it('sends an empty body when there is no refresh token, and never throws', async () => {
    api.setAuthToken('live.access');
    fetchSpy.mockResolvedValue(ok({ success: true }));
    await expect(api.serverLogout(null)).resolves.toBeUndefined();
    expect(sent().body).toEqual({});
  });

  it('swallows a network failure — a failed revoke must not block sign-out', async () => {
    api.setAuthToken('live.access');
    fetchSpy.mockRejectedValue(new Error('network'));
    await expect(api.serverLogout('sealed.refresh')).resolves.toBeUndefined();
  });
});

/* ------------------------------------------------ login / verifyOtp now thread refresh_token */

describe('login / verifyOtp carry the refresh credential (additive)', () => {
  it('login returns refreshToken when the server includes data.refresh_token', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { user: userRow(), token: 'acc', refresh_token: 'ref30d' } }));
    const r = await api.login('asha@cgpe.in', 'pw');
    expect(r.token).toBe('acc');
    expect(r.refreshToken).toBe('ref30d');
  });

  it('login returns refreshToken undefined when the server omits it (still a valid login)', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { user: userRow(), token: 'acc' } }));
    const r = await api.login('asha@cgpe.in', 'pw');
    expect(r.token).toBe('acc');
    expect(r.refreshToken).toBeUndefined();
  });

  it('verifyOtp returns refreshToken when present', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { user: userRow(), token: 'acc', refresh_token: 'ref30d' } }));
    const r = await api.verifyOtp('9876500000', '123456');
    expect(r?.refreshToken).toBe('ref30d');
  });
});
