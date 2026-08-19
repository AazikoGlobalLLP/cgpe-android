/**
 * PHASE 52 — `startBreak` / `stopBreak` against the already-live break endpoints.
 *
 * The backend break handlers exist and record location (`cgpe-backend-main/routes/timeTracker.js`
 * `/break/start` :772, `/break/stop` :870). They do NOT yet accept a `reason` (filed as INBOX
 * `[api]` Break A, 2026-08-18) — the app sends it additively so it is stored the moment the backend
 * persists it, and dropped harmlessly until then. Honest write-path posture, same as clockIn/out:
 *   - 403 `LOCATION_RESTRICTION` → `blocked`.
 *   - any other non-2xx (400 "Must be clocked in" / "Already on break", 500) → a plain failure.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` owns, exercising the real `req` path. `api.ts` holds
 * module state with no reset export (`sessionReal`, `authToken`), and Vitest isolates per FILE, so
 * the module is re-imported in `beforeEach` (CLAUDE.md test rule).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** The JSON body the app sent on the Nth fetch call. */
const sentBody = (n = 0) => JSON.parse((fetchSpy.mock.calls[n] as [string, { body: string }])[1].body);
/** The URL the app hit on the Nth fetch call. */
const sentUrl = (n = 0) => (fetchSpy.mock.calls[n] as [string])[0];

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health'); // same instance api is bound to (resetModules cleared it)
  api.setAuthToken('test-token'); // a real (non-demo) session, so the calls actually reach fetch
});

const COORDS = { lat: 21.2, lng: 72.8, accuracy: 20, city: 'Surat' };

describe('startBreak', () => {
  it('POSTs to /break/start with coords + source, no reason when none supplied, ok on 200', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { breakStartTime: '2026-08-18T10:00:00Z' } }));
    const res = await api.startBreak(COORDS);
    expect(res.ok).toBe(true);
    expect(sentUrl()).toContain('/time-tracker/break/start');
    expect(sentBody()).toEqual({ ...COORDS, source: 'mobile' }); // no `reason` key
  });

  it('sends a trimmed reason when supplied', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: {} }));
    await api.startBreak(COORDS, '  lunch with a client  ');
    expect(sentBody().reason).toBe('lunch with a client');
  });

  it('omits the reason key for a whitespace-only reason (treated as absent — the reason is optional)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: {} }));
    await api.startBreak(COORDS, '   ');
    expect('reason' in sentBody()).toBe(false);
  });

  it('maps 403 LOCATION_RESTRICTION to blocked', async () => {
    fetchSpy.mockResolvedValueOnce(reply(403, { success: false, error: 'LOCATION_RESTRICTION', message: 'You must be at the office to start a break.' }));
    const res = await api.startBreak(COORDS);
    expect(res.blocked).toBe(true);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('office');
  });

  it('keeps the 400 "Already on break" / "Must be clocked in" state guards as a plain server failure', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false, message: 'Already on break' }));
    const res = await api.startBreak(COORDS);
    expect(res).toEqual({ ok: false, reason: 'server', message: 'Already on break' });
    expect(res.blocked).toBeUndefined();
  });

  it('a 500 is a generic server failure', async () => {
    fetchSpy.mockResolvedValueOnce(reply(500, { success: false, message: 'boom' }));
    const res = await api.startBreak(COORDS);
    expect(res).toEqual({ ok: false, reason: 'server', message: 'boom' });
  });

  it('never reaches the network on a signed-out session', async () => {
    api.setAuthToken(null as unknown as string);
    const res = await api.startBreak(COORDS);
    expect(res).toEqual({ ok: false, reason: 'network' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('stopBreak', () => {
  it('POSTs to /break/stop with coords + source and never sends a reason, ok on 200', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { breakDuration: 1800, totalBreak: 1800 } }));
    const res = await api.stopBreak(COORDS);
    expect(res).toEqual({ ok: true });
    expect(sentUrl()).toContain('/time-tracker/break/stop');
    expect('reason' in sentBody()).toBe(false);
  });

  it('maps 403 to blocked', async () => {
    fetchSpy.mockResolvedValueOnce(reply(403, { success: false, error: 'LOCATION_RESTRICTION', message: 'restricted' }));
    const res = await api.stopBreak(COORDS);
    expect(res.blocked).toBe(true);
  });

  it('keeps the 400 "Not on break" guard as a plain server failure', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false, message: 'Not on break' }));
    const res = await api.stopBreak(COORDS);
    expect(res).toEqual({ ok: false, reason: 'server', message: 'Not on break' });
  });

  it('never reaches the network on a signed-out session', async () => {
    api.setAuthToken(null as unknown as string);
    const res = await api.stopBreak(COORDS);
    expect(res).toEqual({ ok: false, reason: 'network' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('getBreakLocations (Phase 66 master read)', () => {
  it('parses members + break points (start/end, reason, active) from the Phase-66 shape', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { date: '2026-08-18', members: [
      { user_id: 'u1', full_name: 'Asha', role: 'advisor', is_on_break: true, breaks: [
        { lat: 21.2, lng: 72.8, at: '2026-08-18T10:00:00Z', kind: 'start', accuracy: 12, reason: 'lunch' },
        { lat: 21.21, lng: 72.81, at: '2026-08-18T10:30:00Z', kind: 'end', accuracy: 15 },
        { lat: 21.22, lng: 72.82, at: '2026-08-18T13:00:00Z', kind: 'start', active: true, reason: 'tea' },
      ] },
    ] } }));
    const res = await api.getBreakLocations();
    expect(sentUrl()).toContain('/time-tracker/break-locations');
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ userId: 'u1', name: 'Asha', role: 'advisor', onBreak: true });
    expect(res[0].breaks).toHaveLength(3);
    expect(res[0].breaks[0]).toEqual({ lat: 21.2, lng: 72.8, at: '2026-08-18T10:00:00Z', kind: 'start', reason: 'lunch', active: false });
    expect(res[0].breaks[1]).toEqual({ lat: 21.21, lng: 72.81, at: '2026-08-18T10:30:00Z', kind: 'end', reason: null, active: false });
    expect(res[0].breaks[2].active).toBe(true);
  });

  it('appends ?user_id= when a specific member is named', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { members: [] } }));
    await api.getBreakLocations('u7');
    expect(sentUrl()).toContain('user_id=u7');
  });

  it('a 403 (non-master asking for others) is a QUIET empty answer, not an outage', async () => {
    fetchSpy.mockResolvedValueOnce(reply(403, { success: false, message: 'Access denied' }));
    const res = await api.getBreakLocations();
    expect(res).toEqual([]);
    expect(health.getHealth().degraded).toBe(false);   // a permission result, never the banner
  });

  it('a 404/501 (endpoint not on the deployed build — the deploy gap) is a QUIET empty answer, not the "server did not answer" banner', async () => {
    // PHASE 64: on the map, this endpoint 404s against a prod build that predates it. The old
    // `status === 403`-only guard let that 404 fall straight through to the HealthBanner ("server
    // did not answer") — the symptom the owner reported. 404/501 mean "not deployed", an ANSWER, so
    // they must stay quiet exactly like 403; only a real fault raises the banner (asserted below).
    for (const status of [404, 501]) {
      fetchSpy.mockResolvedValueOnce(reply(status, { success: false, message: 'Not found' }));
      const res = await api.getBreakLocations();
      expect(res).toEqual([]);
    }
    expect(health.getHealth().degraded).toBe(false);   // neither status raised the banner
  });

  it('a real 5xx IS reported (the banner boundary — suppressing 404 must not swallow a true outage)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(500, { success: false, message: 'boom' }));
    const res = await api.getBreakLocations();
    expect(res).toEqual([]);                            // still never fabricates a pin
    expect(health.getHealth().degraded).toBe(true);    // but the genuine outage is surfaced honestly
    expect(health.getHealth().failures).toEqual(['/time-tracker/break-locations']);
  });

  it('a dead network / abort IS reported (the catch path still banners)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    const res = await api.getBreakLocations();
    expect(res).toEqual([]);
    expect(health.getHealth().failures).toEqual(['/time-tracker/break-locations']);
  });

  it('drops break points with non-finite coordinates (never fabricates a pin)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { members: [
      { user_id: 'u1', full_name: 'Asha', role: 'advisor', is_on_break: false, breaks: [
        { lat: 'x', lng: 72.8, kind: 'start' },
        { lat: 21.2, lng: 72.8, at: '2026-08-18T10:00:00Z', kind: 'start' },
      ] },
    ] } }));
    const res = await api.getBreakLocations();
    expect(res[0].breaks).toHaveLength(1);
    expect(res[0].breaks[0].lat).toBe(21.2);
  });
});
