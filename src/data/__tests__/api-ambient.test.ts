/**
 * PHASE 41 (41a data layer) — the 24/7 off-duty location + DPDP-consent wire contract, pinned.
 *
 * Every expectation was read in `contracts/api.md` §`/api/time-tracker` — "Phase 43 additions" —
 * and cross-checked against the shipped backend (`cgpe-backend-main/routes/timeTracker.js`
 * `/consent`, `/track/ambient`; `__tests__/auth.phase43.test.js`) BEFORE it was written:
 *
 *   POST /api/time-tracker/consent
 *     body:  { granted:boolean (required), version? }
 *     200:   { success:true, data:{ status, decided_at, version } }
 *     400:   { success:false, message:'granted (boolean) is required.' }   ← malformed body
 *     404:   profile missing
 *   POST /api/time-tracker/track/ambient
 *     body:  { points:[{lat,lng,at,accuracy,speed,heading,battery}], date? }   ← NO session_id
 *     200:   { success:true, added:<n>, dropped:<n> }        ← both TOP-LEVEL, not inside `data`
 *     403:   { success:false, code:'consent_required' }       ← stop recording + drop the buffer
 *
 * WHY THIS FILE EXISTS. The request body and the response envelope ARE the contract, and neither is
 * visible to `tsc` or to a test of pure logic. Two traps are pinned specifically: (1) ambient must
 * NEVER carry a `session_id` (it is token-attributed, no shift), and (2) the 403 `consent_required`
 * must be distinguished from a transient fault — it is an ANSWER (stop), not a retry.
 *
 * FETCH IS STUBBED, not mocked-through: `api.ts` is the only file that calls `fetch`, so a stub at
 * that boundary exercises the real `req`/health paths. `api.ts` holds mutable module state with no
 * reset export, so every test re-imports it (CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** One ambient fix as `lib/tracker.ts`'s `toPoints` serialises it (coarse, battery-friendly). */
const point = (extra: Record<string, unknown> = {}) => ({
  lat: 21.20878,
  lng: 72.839281,
  at: '2026-08-10T22:15:00.000Z',
  accuracy: 480.2,
  speed: 0,
  heading: 0,
  battery: 0.63,
  ...extra,
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

describe('setLocationConsent — the DPDP consent write', () => {
  it('POSTs { granted:true } and returns the server-confirmed state', async () => {
    fetchSpy.mockResolvedValueOnce(
      reply(200, { success: true, data: { status: 'granted', decided_at: '2026-08-14T10:00:00.000Z', version: 'v1' } }),
    );
    const r = await api.setLocationConsent(true);

    const { url, init, body } = sent();
    expect(url).toContain('/time-tracker/consent');
    expect(init.method).toBe('POST');
    expect(body).toEqual({ granted: true });                 // no `version` key when omitted
    expect(r).toEqual({ status: 'ok', consent: 'granted', decidedAt: '2026-08-14T10:00:00.000Z', version: 'v1' });
  });

  it('includes `version` only when supplied', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { status: 'granted', decided_at: null, version: '3' } }));
    await api.setLocationConsent(true, '3');
    expect(sent().body).toEqual({ granted: true, version: '3' });
  });

  it('withdrawal: POSTs { granted:false } and reports the withdrawn state', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { status: 'withdrawn', decided_at: '2026-08-14T11:00:00.000Z', version: 'v1' } }));
    const r = await api.setLocationConsent(false);
    expect(sent().body).toEqual({ granted: false });
    expect(r).toMatchObject({ status: 'ok', consent: 'withdrawn' });
  });

  it('falls back to the requested state and null fields when the 200 body omits them', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: {} }));
    const r = await api.setLocationConsent(true);
    expect(r).toEqual({ status: 'ok', consent: 'granted', decidedAt: null, version: null });
  });

  it('400 (granted not a boolean) is a definite refusal AND a malformed-request outage', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false, message: 'granted (boolean) is required.' }));
    const r = await api.setLocationConsent(true);
    expect(r).toEqual({ status: 'refused' });
    expect(health.getHealth().failures).toContain('/time-tracker/consent');   // 400 = malformed → banner
  });

  it('404 (no profile) is a refusal that stays QUIET — an answer, not an outage', async () => {
    fetchSpy.mockResolvedValueOnce(reply(404, { success: false }));
    const r = await api.setLocationConsent(true);
    expect(r).toEqual({ status: 'refused' });
    expect(health.getHealth().degraded).toBe(false);                          // 404 = answer → no banner
    expect(health.getHealth().failures).not.toContain('/time-tracker/consent');
  });

  it('5xx is a retryable error and raises the outage banner', async () => {
    fetchSpy.mockResolvedValueOnce(reply(503, { success: false }));
    const r = await api.setLocationConsent(true);
    expect(r).toEqual({ status: 'error' });
    expect(health.getHealth().failures).toContain('/time-tracker/consent');
  });

  it('a dead network is a retryable error and raises the banner', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    const r = await api.setLocationConsent(true);
    expect(r).toEqual({ status: 'error' });
    expect(health.getHealth().failures).toContain('/time-tracker/consent');
  });

  it('never touches the network in a demo session', async () => {
    api.setAuthToken('demo-abc');   // a demo token makes the session non-real
    const r = await api.setLocationConsent(true);
    expect(r).toEqual({ status: 'error' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('postAmbientPoints — the off-duty ingest', () => {
  it('sends nothing and reports `sent` for an empty batch', async () => {
    expect(await api.postAmbientPoints([])).toEqual({ outcome: 'sent', added: 0, dropped: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs { points } with NO session_id, and forwards added+dropped from the 200', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, added: 2, dropped: 1 }));
    const r = await api.postAmbientPoints([point(), point({ lat: 21.3, lng: 72.9 })]);

    const { url, init, body } = sent();
    expect(url).toContain('/time-tracker/track/ambient');
    expect(init.method).toBe('POST');
    expect(Object.keys(body).sort()).toEqual(['points']);        // no `session_id`, no `date`
    expect(JSON.stringify(body)).not.toContain('session');       // ambient is token-attributed, never a shift
    expect(r).toEqual({ outcome: 'sent', added: 2, dropped: 1 });
  });

  it('includes `date` only when supplied', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, added: 1, dropped: 0 }));
    await api.postAmbientPoints([point()], '2026-08-14');
    expect(sent().body).toMatchObject({ date: '2026-08-14' });
    expect(sent().body.session_id).toBeUndefined();
  });

  it('coerces missing/odd added+dropped counts to 0', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true }));
    expect(await api.postAmbientPoints([point()])).toEqual({ outcome: 'sent', added: 0, dropped: 0 });
  });

  it('403 consent_required → stop + drop the buffer (distinct from a retry)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(403, { success: false, code: 'consent_required', message: 'consent required' }));
    const r = await api.postAmbientPoints([point()]);
    expect(r).toEqual({ outcome: 'consent-required', added: 0, dropped: 0 });
  });

  it('401 → signed-out (the recorder stops, the token is dead)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(401, { success: false }));
    expect(await api.postAmbientPoints([point()])).toEqual({ outcome: 'signed-out', added: 0, dropped: 0 });
  });

  it('429 → retry (back off, keep the buffer)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(429, { success: false }));
    expect(await api.postAmbientPoints([point()])).toEqual({ outcome: 'retry', added: 0, dropped: 0 });
  });

  it('a non-consent 4xx is refused; a 5xx is a retry', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false }));
    expect(await api.postAmbientPoints([point()])).toEqual({ outcome: 'refused', added: 0, dropped: 0 });
    fetchSpy.mockResolvedValueOnce(reply(500, { success: false }));
    expect(await api.postAmbientPoints([point()])).toEqual({ outcome: 'retry', added: 0, dropped: 0 });
  });

  it('a dead network is a retry, and the background recorder NEVER raises the outage banner', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    expect(await api.postAmbientPoints([point()])).toEqual({ outcome: 'retry', added: 0, dropped: 0 });
    // Silent like postTrackPoints: a failed ambient upload must not pin the global banner open.
    fetchSpy.mockResolvedValueOnce(reply(503, { success: false }));
    await api.postAmbientPoints([point()]);
    expect(health.getHealth().degraded).toBe(false);
    expect(health.getHealth().failures).not.toContain('/time-tracker/track/ambient');
  });

  it('never touches the network in a demo session', async () => {
    api.setAuthToken('demo-abc');
    expect(await api.postAmbientPoints([point()])).toEqual({ outcome: 'sent', added: 0, dropped: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
