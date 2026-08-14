/**
 * PHASE 41 (41a-iii data layer) — the boot-gate consent READ wire contract, pinned.
 *
 * `getLocationConsent()` reads `GET /api/rbac/config` `me.location_consent` — the input the boot gate
 * uses to decide whether to show the mandatory `/consent` notice and whether to start the ambient
 * recorder. Every expectation was read against the shipped backend BEFORE it was written:
 *
 *   GET /api/rbac/config   (routes/rbac.js `GET /config`, `meFor`)
 *     200: { success:true, config:{…}, me:{ …, location_consent:{ status, decided_at, version } } }
 *          ↑ `me` is TOP-LEVEL, NOT under `data`; a legacy profile reads status:'pending'.
 *          ↑ pre-Phase-43 deploy the whole `location_consent` block is simply ABSENT.
 *
 * TWO INVARIANTS THIS FILE EXISTS TO PROTECT:
 *  1. It reads `json.me.location_consent`, never `json.data.*` — the wrong unwrap (the app's usual
 *     `.data` envelope) would read `undefined` for every user and silently disable the gate forever.
 *  2. It FAILS OPEN and stays SILENT: absent block / non-2xx / dead network all return `error` and
 *     NEVER raise the health banner. The gate treats `error` as "don't redirect", so a transient
 *     outage or a not-yet-deployed backend can never trap staff behind the consent wall, and a read
 *     that runs on every cold start can never pin a banner open.
 *
 * FETCH IS STUBBED at the `api.ts` boundary (the only file that calls `fetch`), so the real
 * `req`/health paths run. `api.ts` holds mutable module state with no reset export, so every test
 * re-imports it (CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A `GET /rbac/config` envelope with the given `me.location_consent` (omit `lc` for a legacy body). */
const config = (lc?: unknown) => ({
  success: true,
  config: { departments: [], modules: [], matrix: {}, permissions: {} },
  me: lc === undefined ? { role: 'advisor' } : { role: 'advisor', location_consent: lc },
});

/** The request the app actually sent: [url, init]. */
const sent = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  return { url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT make the session real
});

describe('getLocationConsent — the boot-gate consent read', () => {
  it('GETs /rbac/config with no body and returns the granted state from the TOP-LEVEL me block', async () => {
    fetchSpy.mockResolvedValueOnce(
      reply(200, config({ status: 'granted', decided_at: '2026-08-14T10:00:00.000Z', version: 'v.01' })),
    );
    const r = await api.getLocationConsent();

    const { url, init, body } = sent();
    expect(url).toContain('/rbac/config');
    expect(init.method ?? 'GET').toBe('GET');   // a read, never a write
    expect(body).toBeUndefined();
    expect(r).toEqual({ status: 'ok', consent: 'granted', decidedAt: '2026-08-14T10:00:00.000Z', version: 'v.01' });
  });

  it('reads `withdrawn` and `pending` verbatim (not just granted)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, config({ status: 'withdrawn', decided_at: null, version: null })));
    expect(await api.getLocationConsent()).toMatchObject({ status: 'ok', consent: 'withdrawn' });

    fetchSpy.mockResolvedValueOnce(reply(200, config({ status: 'pending', decided_at: null, version: null })));
    expect(await api.getLocationConsent()).toMatchObject({ status: 'ok', consent: 'pending' });
  });

  it('coerces absent/odd decided_at + version to null', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, config({ status: 'granted' })));
    expect(await api.getLocationConsent()).toEqual({ status: 'ok', consent: 'granted', decidedAt: null, version: null });
  });

  it('does NOT read the state off json.data (the app’s usual envelope) — only json.me', async () => {
    // A body that carries a granted state ONLY under `data` must NOT be honoured: `me` is authoritative.
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { me: { location_consent: { status: 'granted' } } } }));
    expect(await api.getLocationConsent()).toEqual({ status: 'error' });
  });

  it('a legacy 200 with NO location_consent block is a silent, fail-open unknown', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, config(undefined)));   // Phase 43 not yet deployed
    expect(await api.getLocationConsent()).toEqual({ status: 'error' });
    expect(health.getHealth().degraded).toBe(false);
    expect(health.getHealth().failures).not.toContain('/rbac/config');
  });

  it('an unrecognised status string is a fail-open unknown, not an `ok`', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, config({ status: 'maybe' })));
    expect(await api.getLocationConsent()).toEqual({ status: 'error' });
  });

  it('a 5xx fails open and stays SILENT — it never pins the boot banner open', async () => {
    fetchSpy.mockResolvedValueOnce(reply(503, { success: false }));
    expect(await api.getLocationConsent()).toEqual({ status: 'error' });
    expect(health.getHealth().degraded).toBe(false);
    expect(health.getHealth().failures).not.toContain('/rbac/config');
  });

  it('a 403 (role cannot read config) fails open and stays silent', async () => {
    fetchSpy.mockResolvedValueOnce(reply(403, { success: false }));
    expect(await api.getLocationConsent()).toEqual({ status: 'error' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('a dead network fails open and stays silent', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    expect(await api.getLocationConsent()).toEqual({ status: 'error' });
    expect(health.getHealth().degraded).toBe(false);
    expect(health.getHealth().failures).not.toContain('/rbac/config');
  });

  it('never touches the network in a demo session', async () => {
    api.setAuthToken('demo-abc');   // a demo token makes the session non-real
    expect(await api.getLocationConsent()).toEqual({ status: 'error' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('needsConsentGate — the boot-gate redirect decision', () => {
  it('redirects (true) ONLY on a confirmed non-granted answer', () => {
    expect(api.needsConsentGate({ status: 'ok', consent: 'pending', decidedAt: null, version: null })).toBe(true);
    expect(api.needsConsentGate({ status: 'ok', consent: 'withdrawn', decidedAt: null, version: null })).toBe(true);
  });

  it('does NOT redirect a user who already granted consent', () => {
    expect(api.needsConsentGate({ status: 'ok', consent: 'granted', decidedAt: '2026-08-14T10:00:00.000Z', version: 'v.01' })).toBe(false);
  });

  it('FAILS OPEN on an unknown read — an outage/legacy-backend/dead-network never traps staff', () => {
    // This is the load-bearing invariant: `error` must be "don't redirect", never "gate them".
    expect(api.needsConsentGate({ status: 'error' })).toBe(false);
  });
});
