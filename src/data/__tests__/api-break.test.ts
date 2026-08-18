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
let api: Api;
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
