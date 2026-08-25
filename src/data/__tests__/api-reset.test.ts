/**
 * ROUND-4 LOOPHOLE HUNT (2026-08-25) — `resetApiState()` seals the shared-handset PII bleed.
 *
 * `store/auth` already purges the AsyncStorage / SecureStore caches on logout / silent-401 expiry
 * (`purgeUserScopedCaches`), but `data/api.ts` also holds per-user data in JS memory that no purge
 * ever touched: the module-scope `state` write buffer AND the `clientCache` / `claimCache` /
 * `waThreadCache` lookup Maps. The sharpest consequence is an AUTHZ BYPASS: `getClient` / `getClaim`
 * / `getWaThread` are cache-FIRST — they return `clone(cache.get(id))` before any network call or
 * backend 403 — so a record the OUTGOING user loaded could be read by the NEXT person on the handset
 * with no server check at all. `resetApiState()` (called from `clear()` and `onSessionExpired`)
 * empties every one of those, so this pins that the cache stops short-circuiting after teardown.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` owns, so the real `req` / `tryReal` / cache path runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (body: unknown) => reply(200, body);

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  api.setAuthToken('test-token');          // a token starting `demo-` would NOT enable real requests
  api.setCurrentUser('userA', 'User A');   // the outgoing user
});

describe('resetApiState — no per-user PII survives a user switch (round 4)', () => {
  it('clears clientCache so getClient stops serving a cached book record without a network call', async () => {
    // User A loads a page of the client book → clientCache is populated with real PII.
    fetchSpy.mockResolvedValueOnce(ok({ data: [{ _id: 'c1', name: 'asha patel', mobile: '9876500001' }], totalPages: 1 }));
    const page = await api.getClientsPage(1);
    expect(page.items.map((cl) => cl.id)).toContain('c1');
    const callsAfterList = fetchSpy.mock.calls.length;

    // Cache-FIRST: reading the same id again returns from clientCache with NO fetch — exactly the
    // short-circuit that would hand User A's client to User B on a shared handset (no 403 possible).
    const cached = await api.getClient('c1');
    expect(cached?.id).toBe('c1');
    expect(fetchSpy.mock.calls.length).toBe(callsAfterList);   // served from cache, no request

    // Teardown (what clear() / onSessionExpired now call). The cache must be empty afterwards, so the
    // same read is forced onto the network where the backend 403 is the authority for the next user.
    api.resetApiState();
    fetchSpy.mockResolvedValueOnce(ok({ _id: 'c1', name: 'asha patel', mobile: '9876500001' }));
    await api.getClient('c1');
    expect(fetchSpy.mock.calls.length).toBe(callsAfterList + 1);   // cache gone → a real request was made
  });

  it('is safe to call when nothing has been cached, and idempotent', () => {
    expect(() => { api.resetApiState(); api.resetApiState(); }).not.toThrow();
  });
});
