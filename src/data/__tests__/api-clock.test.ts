/**
 * PHASE 50 — `clockIn` / `clockOut` reason threading + the new `REASON_REQUIRED` outcome.
 *
 * The backend (cgpe-api Backend Phase 64) reversed the refuse model: an out-of-range clock-in/out
 * or an early clock-out is now ALLOWED but must carry a non-empty reason, enforced server-side.
 * Two distinct refusals come back and the app must keep them apart:
 *   - 403 `LOCATION_RESTRICTION`  → location UNDETERMINABLE (missing / too-coarse GPS): can't
 *     attribute the clock event at all. Surfaces as `blocked` (unchanged).
 *   - 400 `REASON_REQUIRED`       → known, but outside the fence (or early): tell me why. Surfaces
 *     as `needsReason`, carrying which rule(s) fired and the distance, so the screen can prompt.
 *
 * Verified against the real handlers: `cgpe-backend-main/routes/timeTracker.js` clock-in
 * (`:449-457`) and clock-out (`:719-732`), and `utils/geofence.checkNearestGeofence`.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` owns, exercising the real `req` path. `api.ts`
 * holds module state with no reset export (`sessionReal`, `authToken`), and Vitest isolates per
 * FILE, so the module is re-imported in `beforeEach` (CLAUDE.md test rule).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** The JSON body the app sent on the Nth fetch call. */
const sentBody = (n = 0) => JSON.parse((fetchSpy.mock.calls[n] as [string, { body: string }])[1].body);

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  api.setAuthToken('test-token'); // a real (non-demo) session, so the calls actually reach fetch
});

const COORDS = { lat: 21.2, lng: 72.8, accuracy: 20, city: 'Surat' };

describe('clockIn — reason threading', () => {
  it('sends NO reason field when none is supplied, and returns the session id on success', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { sessionId: 'sess-1' } }));
    const res = await api.clockIn(COORDS);
    expect(res).toEqual({ ok: true, message: undefined, sessionId: 'sess-1' });
    expect(sentBody()).toEqual({ ...COORDS, source: 'mobile' }); // no `reason` key
  });

  it('sends a trimmed reason when supplied', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { sessionId: 'sess-2' } }));
    await api.clockIn(COORDS, '  stuck in traffic near client  ');
    expect(sentBody().reason).toBe('stuck in traffic near client');
  });

  it('omits the reason key for a whitespace-only reason (treated as absent)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { sessionId: 'sess-3' } }));
    await api.clockIn(COORDS, '   ');
    expect('reason' in sentBody()).toBe(false);
  });

  it('a KNOWN out-of-range clock-in with a reason is accepted', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { sessionId: 'sess-4' } }));
    const res = await api.clockIn(COORDS, 'client site visit');
    expect(res.ok).toBe(true);
    expect(res.sessionId).toBe('sess-4');
  });

  it('maps 400 REASON_REQUIRED to needsReason (NOT blocked), carrying distance', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, {
      success: false, error: 'REASON_REQUIRED',
      message: 'You are outside the office area. A reason is required to clock in from here.',
      distance_m: 640, radius_m: 200,
    }));
    const res = await api.clockIn(COORDS);
    expect(res.ok).toBe(false);
    expect(res.needsReason).toBe(true);
    expect(res.outOfRange).toBe(true);
    expect(res.blocked).toBeUndefined();
    expect(res.distance_m).toBe(640);
    expect(res.message).toContain('reason is required');
  });

  it('keeps 403 (undeterminable location) as `blocked`, distinct from needsReason', async () => {
    fetchSpy.mockResolvedValueOnce(reply(403, {
      success: false, error: 'LOCATION_RESTRICTION',
      message: 'Location access is required to clock in.', distance_m: null,
    }));
    const res = await api.clockIn(COORDS);
    expect(res.blocked).toBe(true);
    expect(res.needsReason).toBeUndefined();
    expect(res.distance_m).toBeNull();
  });

  it('a plain server error is still a generic server failure, not a reason prompt', async () => {
    fetchSpy.mockResolvedValueOnce(reply(500, { success: false, message: 'boom' }));
    const res = await api.clockIn(COORDS);
    expect(res).toEqual({ ok: false, reason: 'server', message: 'boom' });
  });

  it('never reaches the network on a signed-out session', async () => {
    api.setAuthToken(null as unknown as string);
    const res = await api.clockIn(COORDS);
    expect(res).toEqual({ ok: false, reason: 'network' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('clockOut — reason threading + early / out-of-range flags', () => {
  it('a normal on-time in-range clock-out sends no reason and succeeds', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: {} }));
    const res = await api.clockOut(COORDS);
    expect(res).toEqual({ ok: true });
    expect('reason' in sentBody()).toBe(false);
  });

  it('maps 400 REASON_REQUIRED (out of range only) to needsReason with outOfRange true, early false', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, {
      success: false, error: 'REASON_REQUIRED',
      message: 'You are away from the office. A reason is required to clock out from here.',
      out_of_range: true, early: false, distance_m: 1200,
    }));
    const res = await api.clockOut(COORDS);
    expect(res.needsReason).toBe(true);
    expect(res.outOfRange).toBe(true);
    expect(res.early).toBe(false);
    expect(res.distance_m).toBe(1200);
  });

  it('maps an EARLY-only clock-out to needsReason with early true, outOfRange false', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, {
      success: false, error: 'REASON_REQUIRED',
      message: 'You are clocking out early. A reason is required.',
      out_of_range: false, early: true, distance_m: 40,
    }));
    const res = await api.clockOut(COORDS);
    expect(res.needsReason).toBe(true);
    expect(res.early).toBe(true);
    expect(res.outOfRange).toBe(false);
  });

  it('maps a BOTH out-of-range AND early clock-out to both flags set', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, {
      success: false, error: 'REASON_REQUIRED',
      message: 'You are clocking out early and away from the office. A reason is required.',
      out_of_range: true, early: true, distance_m: 900,
    }));
    const res = await api.clockOut(COORDS);
    expect(res.outOfRange).toBe(true);
    expect(res.early).toBe(true);
  });

  it('sends the reason on the re-send after a prompt', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: {} }));
    await api.clockOut(COORDS, 'left early — doctor appointment');
    expect(sentBody().reason).toBe('left early — doctor appointment');
  });

  it('keeps LOCATION_REQUIRED (a 400 without the REASON_REQUIRED error) as a plain server failure', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, {
      success: false, error: 'LOCATION_REQUIRED', message: 'Location is required to clock out.',
    }));
    const res = await api.clockOut({});
    expect(res.needsReason).toBeUndefined();
    expect(res).toEqual({ ok: false, reason: 'server', message: 'Location is required to clock out.' });
  });
});
