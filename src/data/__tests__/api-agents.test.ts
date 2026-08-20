/**
 * PHASE 12 — the agent-pin roster wire contract, pinned.
 *
 * THE BUG THIS FILE GUARDS AGAINST. `getAgentLocations()` used to read the roster from admin-only
 * `GET /api/profiles` (`contracts/api.md:211` — role ∈ {admin, super_admin, payroll_staff}, else
 * 403). A LEADER is not in that set, so a leader got an empty roster → no `/attendance` fan-out →
 * no pins → "0 on duty" on every dashboard and an empty agent map, even with the whole team clocked
 * in. The fix reads the roster from `GET /api/team/task-overview` instead — any staff may read it,
 * the server scopes it per role, and it is the SAME source `getTeam()` already trusts, so the
 * on-duty numerator now matches the roster denominator it is compared against.
 *
 * WHY `?scope=all`, verified in the producer's code before it was written. `../cgpe-backend-main/
 * utils/scope.js` `visibilityScope`: the `view==='all'` → `mode:'all'` branch lives INSIDE
 * `if (canViewAll)` (`:69`), and `canViewAll` is `isSuperAdmin || role==='admin'`. A leader is
 * neither, so `?scope=all` is IGNORED for a leader — they fall through to the `role==='leader'`
 * branch (`:81`) and are clamped to `{ mode:'team', userIds:[self, ...team] }`. So `?scope=all`
 * preserves admin/super_admin org-wide breadth (which the bare endpoint would NOT — it defaults them
 * to `mode:'own'`) while a leader stays clamped to their team. That is the whole reason the param
 * is on the request, and this file pins it so a later edit cannot silently drop it.
 *
 * FETCH IS STUBBED, not mocked-through: `api.ts` is the only file that calls `fetch`, so a stub at
 * that boundary exercises the real `req`/`tryReal`/health paths. `api.ts` holds mutable module state
 * with no reset export, so every test re-imports it (CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A `/team/task-overview` member as the handler serialises it (`routes/team.js:120-132`). */
const member = (name: string, user_id: string | null, extra: Record<string, unknown> = {}) => ({
  name, user_id, role: 'advisor', department: 'Sales', phone: '9876543210', ...extra,
});

/** One `/attendance/user/:id` row: clock_in coords make a pin; a clock_out.time ends the shift. */
const att = (row: Record<string, unknown>) => ({ success: true, data: [row] });
const clockedIn = (lat: number, lng: number, extra: Record<string, unknown> = {}) =>
  att({ clock_in: { lat, lng, time: '2026-08-11T03:30:00.000Z' }, ...extra });
const clockedOut = (lat: number, lng: number) =>
  att({ clock_in: { lat, lng, time: '2026-08-11T03:30:00.000Z' }, clock_out: { lat, lng, time: '2026-08-11T12:00:00.000Z' } });

/**
 * Route the stub by path: the roster call to `/team/task-overview`, everything else to the
 * per-user attendance fan-out keyed by the user_id in the URL. Query strings (`?scope=all`,
 * `?date=…`) are ignored so the FIRST attendance pass ("today") always resolves.
 *
 * PHASE 65: `getAgentLocations` now tries the super_admin-gated `/time-tracker/live-locations` FIRST.
 * This file pins the NON-MASTER / task-overview path, so live-locations is served a 403 by default
 * (exactly a leader's response) — the app suppresses it (quiet, no banner) and falls through to the
 * task-overview fan-out these tests describe. A test wanting the master path sets `live`.
 */
function serve(opts: { overview?: unknown; overviewStatus?: number; attendance?: Record<string, unknown>; live?: unknown; liveStatus?: number }) {
  fetchSpy.mockImplementation(async (url: string) => {
    if (url.includes('/live-locations')) return reply(opts.liveStatus ?? 403, opts.live ?? { success: false, message: 'Access denied' });
    if (url.includes('/team/task-overview')) return reply(opts.overviewStatus ?? 200, opts.overview);
    const m = url.match(/\/attendance\/user\/([^?]+)/);
    if (m) return reply(200, opts.attendance?.[decodeURIComponent(m[1])] ?? { success: true, data: [] });
    return reply(404, { success: false });
  });
}

/** The task-overview URL the app hit (Phase 65: no longer necessarily the first fetch). */
const overviewUrl = () => urls().find((u) => u.includes('/team/task-overview'));

const urls = () => fetchSpy.mock.calls.map((c) => String(c[0]));

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT make the session real
});

describe('getAgentLocations — the roster comes from task-overview, never /profiles', () => {
  it('fetches the roster from /team/task-overview and never touches /profiles (the leader 403 door)', async () => {
    serve({
      overview: { success: true, data: { members: [member('Asha', 'u-asha')] } },
      attendance: { 'u-asha': clockedIn(21.2, 72.83) },
    });
    await api.getAgentLocations();

    expect(overviewUrl()).toContain('/team/task-overview');
    expect(urls().some((u) => u.includes('/profiles'))).toBe(false);
  });

  it('sends ?scope=all — the param that keeps admin/master org-wide while the server clamps a leader', async () => {
    // If this ever regresses to the bare endpoint, an admin/super_admin silently drops to
    // `mode:'own'` (see the header note) and their agent map shows only themselves. Pinned.
    serve({ overview: { success: true, data: { members: [] } } });
    await api.getAgentLocations();
    expect(overviewUrl()).toContain('/team/task-overview?scope=all');
  });

  it('unwraps the { data: { members } } envelope (validator is a members array, not a bare array)', async () => {
    // `tryReal` reads `json?.data ?? json`, so the roster is `data.members`. A body without a
    // `members` array must be treated as no roster, not crash.
    serve({ overview: { success: true, data: { members: [member('Asha', 'u-asha')] } }, attendance: { 'u-asha': clockedIn(21.2, 72.83) } });
    expect(await api.getAgentLocations()).toHaveLength(1);

    serve({ overview: { success: true, data: { totals: {} } } }); // no members array
    expect(await api.getAgentLocations()).toEqual([]);
  });

  it('PHASE 65: a master gets on-duty pins straight from /live-locations, with NO attendance fan-out', async () => {
    // When live-locations answers (super_admin), each clocked-in member's coordinate becomes a pin in
    // one call — including a member with no team-task, whom the task-overview universe would drop.
    serve({
      liveStatus: 200,
      live: { success: true, data: [
        { userId: 'oid-asha', full_name: 'Asha', role: 'advisor', isClockedIn: true, isOnBreak: false, currentLocation: { lat: 21.2, lng: 72.8 }, lastActivity: '2026-08-20T09:00:00Z' },
      ] },
    });
    const pins = await api.getAgentLocations();

    expect(pins).toEqual([{ id: 'oid-asha', name: 'Asha', inLat: 21.2, inLng: 72.8, inTime: '2026-08-20T09:00:00Z', onDuty: true }]);
    expect(urls().some((u) => u.includes('/attendance/user/'))).toBe(false); // no per-member fan-out
    expect(overviewUrl()).toBeUndefined();                                   // task-overview not needed
  });
});

describe('getAgentLocations — the leader path (DONE-WHEN, at the wire)', () => {
  it('builds one pin, onDuty:true, from a member with clock_in coords and no clock_out.time', async () => {
    // Criterion 5 of docs/spec/PHASE-12.md verbatim: a task-overview member carrying user_id + an
    // /attendance reply with clock_in.{lat,lng} and no clock_out.time → one onDuty pin, and the
    // first fetch is /team/task-overview with none hitting /profiles.
    serve({
      overview: { success: true, data: { members: [member('Asha', 'u-asha')] } },
      attendance: { 'u-asha': clockedIn(21.20878, 72.839281) },
    });
    const pins = await api.getAgentLocations();

    expect(pins).toEqual([
      expect.objectContaining({ id: 'u-asha', name: 'Asha', inLat: 21.20878, inLng: 72.839281, onDuty: true }),
    ]);
    expect(overviewUrl()).toContain('/team/task-overview');
    expect(urls().some((u) => u.includes('/profiles'))).toBe(false);
  });

  it('marks a clocked-out member onDuty:false and a still-in member onDuty:true', async () => {
    serve({
      overview: { success: true, data: { members: [member('Asha', 'u-asha'), member('Ravi', 'u-ravi')] } },
      attendance: { 'u-asha': clockedIn(21.2, 72.8), 'u-ravi': clockedOut(21.3, 72.9) },
    });
    const byId = Object.fromEntries((await api.getAgentLocations()).map((p) => [p.id, p]));

    expect(byId['u-asha'].onDuty).toBe(true);
    expect(byId['u-ravi'].onDuty).toBe(false);
    expect(byId['u-ravi'].outTime).toBe('2026-08-11T12:00:00.000Z');
  });

  it('yields no pin for a member with no clock-in coordinates', async () => {
    // Asha is clocked in with coords; Bao has an attendance row but no clock_in lat/lng. Only
    // Asha becomes a pin — proving the coordinate gate in `toPin`, not merely roster membership.
    serve({
      overview: { success: true, data: { members: [member('Asha', 'u-asha'), member('Bao', 'u-bao')] } },
      attendance: { 'u-asha': clockedIn(21.2, 72.8), 'u-bao': att({ clock_in: { time: '2026-08-11T03:30:00.000Z' } }) },
    });
    const pins = await api.getAgentLocations();
    expect(pins.map((p) => p.id)).toEqual(['u-asha']);
  });

  it('drops a member with no user_id before fanning out, and never calls /attendance for them', async () => {
    // `.filter(p => p.user_id)` — a task-overview member whose assignee name did not resolve to a
    // profile carries user_id:null and cannot be fanned out (there is no id to query).
    serve({
      overview: { success: true, data: { members: [member('Asha', 'u-asha'), member('Ghost', null)] } },
      attendance: { 'u-asha': clockedIn(21.2, 72.8) },
    });
    const pins = await api.getAgentLocations();

    expect(pins.map((p) => p.id)).toEqual(['u-asha']);
    expect(urls().some((u) => u.includes('/attendance/user/null'))).toBe(false);
  });
});

describe('getAgentLocations — honesty of the empty/degraded states', () => {
  it('reports a task-overview outage under the /attendance health key, not a competing task-overview row', async () => {
    // D-3: the demo path already raises `/attendance` (`unavailable('/attendance', [])`) and the
    // agent-map degraded copy expects it. `getTaskOverview` owns the `/team/task-overview` row; a
    // second one from here would double-count the same outage.
    serve({ overviewStatus: 500, overview: { success: false, message: 'boom' } });
    expect(await api.getAgentLocations()).toEqual([]);

    const h = health.getHealth();
    expect(h.degraded).toBe(true);
    expect(h.failures).toContain('/attendance');
    expect(h.failures).not.toContain('/team/task-overview');
  });

  it('returns [] with no pins when the roster is empty, and raises no outage', async () => {
    serve({ overview: { success: true, data: { members: [] } } });
    expect(await api.getAgentLocations()).toEqual([]);
    expect(health.getHealth().degraded).toBe(false);
  });

  it('makes no request at all on a demo session', async () => {
    api.setAuthToken('demo-token');
    expect(await api.getAgentLocations()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
