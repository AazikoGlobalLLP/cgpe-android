/**
 * PHASE 66 — `getLastLocation` wire contract, pinned. `GET /api/time-tracker/last-location?user_id=X`
 * (Backend Phase 69). Powers the master "Live location" button (last-known, on or off duty).
 *
 * WHAT THIS GUARDS. Three outcomes must stay apart: a real point (`ok`), a genuine "never shared"
 * (`none`, HTTP 200 `data:null`), and a failure (`error`). Coordinates are master-only, so a 403
 * (and the deploy-gap 404) is a QUIET answer — `error` with NO banner — while a real 5xx/network
 * fault DOES raise the banner. A garbage 200 body must never become a fabricated pin.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` owns, so the real `req`/`reportIfOutage`/health
 * paths run. `api.ts` holds mutable module state with no reset export, so it is re-imported per test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const sentUrl = (n = 0) => (fetchSpy.mock.calls[n] as [string])[0];

const POINT = {
  user_id: 'u7', lat: 21.2049, lng: 72.8397, at: '2026-08-19T09:30:00.000Z',
  accuracy: 12, off_duty: false, is_clocked_in: true, age_seconds: 180,
};

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');
});

describe('getLastLocation — the request', () => {
  it('appends ?user_id= for a named member', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: POINT }));
    await api.getLastLocation('u7');
    expect(sentUrl()).toContain('/time-tracker/last-location?user_id=u7');
  });

  it('sends no query for the caller’s OWN last point', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: POINT }));
    await api.getLastLocation();
    expect(sentUrl()).toContain('/time-tracker/last-location');
    expect(sentUrl()).not.toContain('user_id');
  });

  it('makes no request at all on a signed-out session', async () => {
    api.setAuthToken(null as unknown as string);
    expect(await api.getLastLocation('u7')).toEqual({ status: 'error' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('getLastLocation — the three outcomes', () => {
  it('maps a real point to { status:"ok", loc } with all eight fields', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: POINT }));
    const res = await api.getLastLocation('u7');
    expect(res).toEqual({ status: 'ok', loc: {
      userId: 'u7', lat: 21.2049, lng: 72.8397, at: '2026-08-19T09:30:00.000Z',
      accuracy: 12, offDuty: false, isClockedIn: true, ageSeconds: 180,
    } });
  });

  it('HTTP 200 data:null (member never shared) → { status:"none" }, no banner', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: null }));
    expect(await api.getLastLocation('u7')).toEqual({ status: 'none' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('a 200 with a non-finite coordinate is "no usable location" (none), never a fabricated pin or banner', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { ...POINT, lat: 'x' } }));
    expect(await api.getLastLocation('u7')).toEqual({ status: 'none' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('a 200 with the (0,0) "GPS had no fix" sentinel is none (the map pipeline drops it too)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { ...POINT, lat: 0, lng: 0 } }));
    expect(await api.getLastLocation('u7')).toEqual({ status: 'none' });
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('getLastLocation — quiet answers vs real outages', () => {
  it('a 403 (non-master asking for another) → error, NO banner (a permission answer)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(403, { success: false, message: 'Access denied' }));
    expect(await api.getLastLocation('u7')).toEqual({ status: 'error' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('a 404 (endpoint not on the deployed build — the deploy gap) → error, NO banner', async () => {
    fetchSpy.mockResolvedValueOnce(reply(404, { success: false, message: 'Not found' }));
    expect(await api.getLastLocation('u7')).toEqual({ status: 'error' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('a real 5xx IS reported (the banner boundary)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(500, { success: false, message: 'boom' }));
    expect(await api.getLastLocation('u7')).toEqual({ status: 'error' });
    expect(health.getHealth().failures).toEqual(['/time-tracker/last-location']);
  });

  it('a dead network → error, banner raised', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    expect(await api.getLastLocation('u7')).toEqual({ status: 'error' });
    expect(health.getHealth().failures).toEqual(['/time-tracker/last-location']);
  });
});

describe('mapLastLocation — pure', () => {
  it('drops a non-finite coordinate OR the (0,0) no-fix sentinel (never fabricates a pin)', () => {
    expect(api.mapLastLocation({ ...POINT, lng: undefined })).toBeNull();
    expect(api.mapLastLocation({ ...POINT, lat: 0, lng: 0 })).toBeNull();
    expect(api.mapLastLocation(null)).toBeNull();
  });

  it('coerces defensively: absent accuracy/at/age → null, truthy flags → booleans', () => {
    const loc = api.mapLastLocation({ user_id: 'u9', lat: 21, lng: 72, off_duty: 1, is_clocked_in: 0 });
    expect(loc).toEqual({
      userId: 'u9', lat: 21, lng: 72, at: null, accuracy: null,
      offDuty: true, isClockedIn: false, ageSeconds: null,
    });
  });
});
