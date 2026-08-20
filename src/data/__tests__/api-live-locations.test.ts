/**
 * PHASE 65 — `getLiveLocations` and the roster/map integration it powers.
 *
 * `GET /time-tracker/live-locations` is super_admin-gated and iterates EVERY profile, so it is the
 * universe the master's monitor roster and agent map must draw from — not `/team/task-overview`,
 * which only lists members with an assigned team-task. This file pins:
 *   - the wire→app mapping (on-duty coord present, off-duty coord absent, never a fake pin);
 *   - the health posture — a non-master 403 / a pre-deploy 404·501 is a QUIET empty answer, only a
 *     real 5xx/network faults the banner (same contract as `getBreakLocations`, since this is called
 *     on every roster load INCLUDING by non-masters);
 *   - `getTeam` surfacing a member who is absent from task-overview (the actual bug); and
 *   - `getAgentLocations` returning the master's on-duty pins in one call, no per-member fan-out.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` owns; the module is re-imported per test because
 * `api.ts` holds un-resettable module state (`sessionReal`, `authToken`) — CLAUDE.md test rule.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const sentUrl = (n = 0) => (fetchSpy.mock.calls[n] as [string])[0];

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token'); // a real (non-demo) session, so the calls actually reach fetch
});

const KEY = '/time-tracker/live-locations';

describe('getLiveLocations', () => {
  it('maps the wire rows — on-duty carries a coord, off-duty carries none (never a fabricated pin)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: [
      { userId: 'oid-asha', full_name: 'Asha', email: 'asha@cgpe.in', role: 'advisor', isClockedIn: true, isOnBreak: false, currentLocation: { lat: 21.2, lng: 72.8, accuracy: 12 }, lastActivity: '2026-08-20T09:00:00Z' },
      { userId: 'oid-ben', full_name: 'Ben', role: 'leader', isClockedIn: false, isOnBreak: false, currentLocation: null, lastActivity: '2026-08-20T09:05:00Z' },
    ] }));

    const rows = await api.getLiveLocations();

    expect(sentUrl()).toContain(KEY);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ userId: 'oid-asha', name: 'Asha', email: 'asha@cgpe.in', role: 'advisor', isClockedIn: true, isOnBreak: false, lat: 21.2, lng: 72.8, lastActivity: '2026-08-20T09:00:00Z' });
    expect(rows[1].lat).toBeUndefined();     // off duty → no currentLocation → no coord
    expect(rows[1].lng).toBeUndefined();
    expect(rows[1].email).toBeUndefined();
  });

  it('drops a row with no id (never invents a phantom member)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: [
      { full_name: 'No Id', role: 'advisor', isClockedIn: false },
      { userId: 'oid-ok', full_name: 'Ok', role: 'advisor', isClockedIn: false },
    ] }));
    const rows = await api.getLiveLocations();
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe('oid-ok');
  });

  it('a 403 (non-master) is a QUIET empty answer, not an outage', async () => {
    fetchSpy.mockResolvedValueOnce(reply(403, { success: false, message: 'Access denied' }));
    const rows = await api.getLiveLocations();
    expect(rows).toEqual([]);
    expect(health.getHealth().degraded).toBe(false);
  });

  it('a 404/501 (endpoint not on the deployed build) is a QUIET empty answer', async () => {
    for (const status of [404, 501]) {
      fetchSpy.mockResolvedValueOnce(reply(status, { success: false, message: 'Not found' }));
      expect(await api.getLiveLocations()).toEqual([]);
    }
    expect(health.getHealth().degraded).toBe(false);
  });

  it('a real 5xx IS reported (the banner boundary)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(500, { success: false, message: 'boom' }));
    expect(await api.getLiveLocations()).toEqual([]);
    expect(health.getHealth().degraded).toBe(true);
    expect(health.getHealth().failures).toEqual([KEY]);
  });

  it('a dead network / abort IS reported', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    expect(await api.getLiveLocations()).toEqual([]);
    expect(health.getHealth().failures).toEqual([KEY]);
  });

  it('never reaches the network on a signed-out session', async () => {
    api.setAuthToken(null as unknown as string);
    expect(await api.getLiveLocations()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('getTeam — the master roster now includes members with no team-task', () => {
  it('sources the universe from /live-locations and left-joins task-overview stats', async () => {
    // call 0: getTaskOverview (only Asha has a team-task) — call 1: getLiveLocations (Asha + Ben)
    fetchSpy
      .mockResolvedValueOnce(reply(200, { success: true, data: { members: [
        { name: 'Asha', user_id: 'user_asha', department: 'Sales', counts: { done: 2, open: 1 }, completion_pct: 60, tasks: [] },
      ] } }))
      .mockResolvedValueOnce(reply(200, { success: true, data: [
        { userId: 'oid-asha', full_name: 'Asha', role: 'advisor', isClockedIn: true, isOnBreak: false, currentLocation: { lat: 21, lng: 72 } },
        { userId: 'oid-ben', full_name: 'Ben', role: 'leader', isClockedIn: false, isOnBreak: false, currentLocation: null },
      ] }));

    const team = await api.getTeam();

    expect(sentUrl(1)).toContain(KEY);
    expect(team.map((m) => m.name).sort()).toEqual(['Asha', 'Ben']);
    const ben = team.find((m) => m.name === 'Ben')!;
    expect(ben).toBeDefined();                 // Ben has no team-task — used to vanish, now present
    expect(ben.clockedIn).toBe(false);
    expect(ben.branch).toBe('');
    const asha = team.find((m) => m.name === 'Asha')!;
    expect(asha.clockedIn).toBe(true);         // duty from the live row
    expect(asha.branch).toBe('Sales');         // stats grafted from task-overview by name
    expect(asha.stats.policiesMtd).toBe(2);
  });

  it('falls back to the existing task-overview roster for a non-master (live-locations 403)', async () => {
    // call 0: getTaskOverview  — call 1: getLiveLocations 403  — call 2: getAgentLocations fan-out (unchanged path)
    fetchSpy
      .mockResolvedValueOnce(reply(200, { success: true, data: { members: [
        { name: 'Asha', user_id: 'user_asha', counts: { done: 1, open: 0 }, tasks: [] },
      ] } }))
      .mockResolvedValueOnce(reply(403, { success: false, message: 'Access denied' }))
      .mockResolvedValue(reply(200, { success: true, data: { members: [] } })); // getAgentLocations inner reads → empty

    const team = await api.getTeam();

    expect(team).toHaveLength(1);
    expect(team[0].name).toBe('Asha');
    expect(health.getHealth().degraded).toBe(false); // the 403 stayed quiet
  });
});

describe('getAgentLocations — master on-duty pins in one call', () => {
  it('returns clocked-in members from /live-locations with NO per-member fan-out', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: [
      { userId: 'oid-asha', full_name: 'Asha', role: 'advisor', isClockedIn: true, isOnBreak: false, currentLocation: { lat: 21.2, lng: 72.8 }, lastActivity: '2026-08-20T09:00:00Z' },
      { userId: 'oid-ben', full_name: 'Ben', role: 'leader', isClockedIn: false, isOnBreak: false, currentLocation: null },
    ] }));

    const pins = await api.getAgentLocations();

    expect(pins).toEqual([{ id: 'oid-asha', name: 'Asha', inLat: 21.2, inLng: 72.8, inTime: '2026-08-20T09:00:00Z', onDuty: true }]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);       // one call — no /attendance/user fan-out
  });

  it('falls through to the task-overview fan-out when nobody is clocked in with a coordinate', async () => {
    // call 0: getLiveLocations (someone present but off duty → no pins) — call 1: task-overview fan-out
    fetchSpy
      .mockResolvedValueOnce(reply(200, { success: true, data: [
        { userId: 'oid-a', full_name: 'A', role: 'advisor', isClockedIn: false, isOnBreak: false, currentLocation: null },
      ] }))
      .mockResolvedValueOnce(reply(200, { success: true, data: { members: [] } }));

    const pins = await api.getAgentLocations();

    expect(pins).toEqual([]);
    expect(sentUrl(1)).toContain('/team/task-overview'); // proved it fell through to the old path
  });
});
