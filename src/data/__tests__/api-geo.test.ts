/**
 * PHASE 2, REWRITTEN BY PHASE 7 — `distanceMeters`, `getGeofence` and `checkGeofence`.
 *
 * This is the arithmetic that decides whether a field agent is allowed to start their shift.
 * The client check is UX-only — `POST /time-tracker/clock-in` re-validates every request and is
 * the authority (`cgpe-backend-main/routes/timeTracker.js:317-318`) — but it is what the person
 * actually sees, and `home.tsx:788-796` hard-returns on a refusal, so anything this file gets
 * wrong in the STRICT direction is a clock-in the server would have accepted and never hears
 * about.
 *
 * PHASE 7 CHANGED THE PREMISE OF HALF THIS FILE. There is no fallback fence any more. The old
 * one was a Surat pin with a 2 km radius and `enforce: true`, against a server default of
 * **200 m** (`cgpe-backend-main/utils/geofence.js:27`) — wrong in both directions at once — and
 * it was cached on the FIRST call whatever happened, so one failed fetch fixed it for the life of
 * the process. Two Phase-2 cases pinned exactly that and are flipped here on purpose, per
 * `docs/PHASES.md`'s convention; the `pinned known bugs` block in this file is now empty and gone.
 *
 * Every server-side number below is quoted from `cgpe-backend-main/utils/geofence.js`:
 *   GET /api/time-tracker/geofence  →  { success, data: { lat, lng, radius_m, label, enforce } }
 *   default radius 200 m (:27) · accuracy credited up to 100 m (:93) · `enforce !== false` (:62)
 *
 * FETCH IS STUBBED, not mocked-through: `api.ts` is the only file that calls `fetch`, so a stub at
 * that boundary exercises the real `req` / `tryReal` / health path. `src/data/api.ts` holds
 * module-level state with no reset export (`_geoCache`, `sessionReal`, `suppressed`) and Vitest
 * isolates per FILE, so every test re-imports it. See docs/spec/PHASE-2.md row 7.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** The office pin the SERVER holds. Nothing in `src/` knows this any more — that is the fix. */
const FENCE = { lat: 21.208780388697864, lng: 72.83928189060113, radius_m: 200, label: 'CGPE Head Office', enforce: true };

const fenceReply = (over: Partial<typeof FENCE> = {}) =>
  reply(200, { success: true, data: { ...FENCE, ...over } });

/**
 * PHASE 50: getGeofence now returns the primary pin PLUS an `offices` list (in-range = within the
 * NEAREST). A legacy single-office wire body (no `offices`) derives exactly one office from the
 * primary pin, so this helper builds the expected returned object for the single-office cases.
 */
const withOffices = (
  f: Partial<typeof FENCE> & typeof FENCE,
  offices?: { lat: number; lng: number; label: string }[],
) => ({ ...f, offices: offices ?? [{ lat: f.lat, lng: f.lng, label: f.label }] });

/** A two-office wire body: office A = the Surat pin, office B = `metresNorth` metres north of it. */
const twoOfficeReply = (metresNorth: number, labelB = 'Katargam') =>
  reply(200, { success: true, data: { ...FENCE, offices: [
    { lat: FENCE.lat, lng: FENCE.lng, label: FENCE.label },
    { lat: FENCE.lat + M(metresNorth), lng: FENCE.lng, label: labelB },
  ] } });

/**
 * Metres north, expressed in degrees of latitude. Along a meridian the haversine collapses to
 * `R * Δφ` exactly, so this is a closed-form inverse of `distanceMeters` rather than a restatement
 * of it — and it pins R = 6371000 from the outside.
 */
const M = (m: number) => (m / 6371000) * (180 / Math.PI);

/** The single space inside a formatted value is U+00A0 (`lib/format.ts`), never U+0020. */
const NB = ' ';

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
});

/**
 * Most cases want a live session and a fence the server has already answered with. The reply is
 * persistent, not `…Once`, because `getGeofence` no longer caches — every `checkGeofence` asks.
 */
async function withFence(over: Partial<typeof FENCE> = {}) {
  api.setAuthToken('test-token');
  fetchSpy.mockResolvedValue(fenceReply(over));
}

describe('distanceMeters', () => {
  it('returns exactly 0 for identical points', () => {
    expect(api.distanceMeters(0, 0, 0, 0)).toBe(0);
    expect(api.distanceMeters(FENCE.lat, FENCE.lng, FENCE.lat, FENCE.lng)).toBe(0);
  });

  it('measures one degree of latitude at the equator', () => {
    // Closed form for a pure meridian arc: R * (1 degree in radians). Derived independently
    // of the haversine expansion, so it pins R = 6371000 and the degree conversion rather than
    // restating the implementation.
    const oneDegree = 6371000 * (Math.PI / 180);
    expect(api.distanceMeters(0, 0, 1, 0)).toBeCloseTo(oneDegree, 6);
  });

  it('measures one degree of longitude at the equator identically, which pins argument order', () => {
    // At latitude 0 both cosine factors are exactly 1, so the longitude term degenerates to
    // the latitude value. Holding this case AND the previous one is what pins the
    // (lat1, lng1, lat2, lng2) order — either alone would survive a transposition.
    const oneDegree = 6371000 * (Math.PI / 180);
    expect(api.distanceMeters(0, 0, 0, 1)).toBeCloseTo(oneDegree, 6);
  });

  it('scales linearly for a small offset from the office pin', () => {
    const d = api.distanceMeters(FENCE.lat, FENCE.lng, FENCE.lat + 0.01, FENCE.lng);
    expect(d).toBeCloseTo((6371000 * (Math.PI / 180)) / 100, 3);
  });

  it('reaches half the circumference at antipodal points without producing NaN', () => {
    // Documents the theoretical Math.sqrt(1 - a) hazard — there is no Math.max(0, ...) clamp —
    // WITHOUT asserting NaN, which at this pair would encode luck.
    expect(api.distanceMeters(0, 0, 0, 180)).toBeCloseTo(6371000 * Math.PI, 2);
  });

  it('propagates NaN, because it validates nothing', () => {
    // The guard lives in the CALLER (checkGeofence). This pins where the responsibility sits.
    expect(Number.isNaN(api.distanceMeters(NaN, 0, 0, 0))).toBe(true);
    expect(Number.isNaN(api.distanceMeters(0, 0, undefined as unknown as number, 0))).toBe(true);
  });

  it('agrees with the metres-to-degrees helper the rest of this file measures with', () => {
    // If this drifts, every distance assertion below is measuring something else.
    expect(api.distanceMeters(FENCE.lat, FENCE.lng, FENCE.lat + M(250), FENCE.lng)).toBeCloseTo(250, 6);
  });
});

describe('getGeofence — an unknown fence is unknown, not a guess', () => {
  it('FLIPPED FROM PHASE 2: returns null instead of a hardcoded 2 km Surat fence', async () => {
    // The Phase-2 case asserted `{ lat: 21.2087…, radius_m: 2000, enforce: true }` came back
    // with no network call. That object no longer exists in src/. A client that cannot learn the
    // fence must not invent one — see docs/spec/PHASE-7.md D-2.
    api.setAuthToken('test-token');
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    await expect(api.getGeofence()).resolves.toBeNull();
  });

  it('makes no request at all on a signed-out or demo session, and still answers null', async () => {
    // `tryReal` short-circuits before fetch when the session is not real. The assertion that
    // fetch was never called IS the proof of the short-circuit.
    await expect(api.getGeofence()).resolves.toBeNull();
    api.setAuthToken('demo-abc');
    await expect(api.getGeofence()).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('FLIPPED FROM PHASE 2: a failure is NOT cached, so the next attempt asks again', async () => {
    // The Phase-2 case pinned the opposite — the fallback was cached BY REFERENCE on the first
    // call, so one failed fetch decided the fence for the life of the JS context and not even
    // signing in as somebody else cleared it.
    api.setAuthToken('test-token');
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    expect(await api.getGeofence()).toBeNull();

    fetchSpy.mockResolvedValueOnce(fenceReply());
    expect(await api.getGeofence()).toEqual(withOffices(FENCE));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not cache a SUCCESS either, so a fence the master moves reaches a phone that stays open', async () => {
    // The review's own finding: caching only successes fixed half the staleness and left the
    // other half. `PUT /time-tracker/geofence` busts the server's 60 s cache
    // (`routes/timeTracker.js:1293`), so the app must not out-cache the server. There is one
    // caller and it runs on a button press twice a day, so the cache bought nothing.
    api.setAuthToken('test-token');
    fetchSpy.mockResolvedValueOnce(fenceReply());
    expect((await api.getGeofence())?.radius_m).toBe(200);

    fetchSpy.mockResolvedValueOnce(fenceReply({ radius_m: 350, lat: 12.9, lng: 77.6 }));
    expect((await api.getGeofence())?.radius_m).toBe(350);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns a fresh object each time, so no caller can mutate the fence for everybody', async () => {
    // The Phase-2 case pinned `expect(second).toBe(first)` — the fallback was handed out BY
    // REFERENCE, so one caller mutating the result changed the fence for every later call.
    await withFence();
    const first = await api.getGeofence();
    const second = await api.getGeofence();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it('unwraps `data` and reads the five documented fields (plus the derived office)', async () => {
    await withFence({ lat: 12.9, lng: 77.6, radius_m: 350, label: 'Bengaluru branch' });
    expect(await api.getGeofence()).toEqual(withOffices({
      lat: 12.9, lng: 77.6, radius_m: 350, label: 'Bengaluru branch', enforce: true,
    }));
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain('/time-tracker/geofence');
  });

  it('PHASE 50: consumes the additive offices[] list and keeps the legacy primary as office[0]', async () => {
    api.setAuthToken('test-token');
    fetchSpy.mockResolvedValueOnce(twoOfficeReply(2000));
    const g = await api.getGeofence();
    expect(g?.offices).toEqual([
      { lat: FENCE.lat, lng: FENCE.lng, label: FENCE.label },
      { lat: FENCE.lat + M(2000), lng: FENCE.lng, label: 'Katargam' },
    ]);
    // The legacy top-level lat/lng stays = the first office, so single-office display is unchanged.
    expect(g?.lat).toBe(FENCE.lat);
    expect(g?.lng).toBe(FENCE.lng);
  });

  it('PHASE 50: a legacy single-office body (no offices[]) derives exactly one office from the primary', async () => {
    await withFence();
    expect((await api.getGeofence())?.offices).toEqual([
      { lat: FENCE.lat, lng: FENCE.lng, label: FENCE.label },
    ]);
  });

  it('PHASE 50: drops malformed office entries, falling back to the primary pin if none survive', async () => {
    api.setAuthToken('test-token');
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { ...FENCE, offices: [
      { lat: 'x', lng: FENCE.lng, label: 'bad-lat' },
      { label: 'no coords at all' },
    ] } }));
    expect((await api.getGeofence())?.offices).toEqual([
      { lat: FENCE.lat, lng: FENCE.lng, label: FENCE.label },
    ]);
  });

  it('reads `enforce` the way the server writes it — anything but an explicit false is on', async () => {
    await withFence({ enforce: undefined as unknown as boolean });
    expect((await api.getGeofence())?.enforce).toBe(true);
  });

  it('treats a fence with no usable radius as a contract fault, not a number to invent', async () => {
    // The server always sends a positive radius_m (`utils/geofence.js:60`), so a body without one
    // is a drift. Repairing it locally with a made-up 2000 is what Phase 7 deleted.
    api.setAuthToken('test-token');
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { lat: 21.2, lng: 72.8 } }));
    expect(await api.getGeofence()).toBeNull();
    expect(health.getHealth().failures).toEqual(['/time-tracker/geofence']);
  });

  it('reports a 500 as an outage', async () => {
    api.setAuthToken('test-token');
    fetchSpy.mockResolvedValueOnce(reply(500, { success: false }));
    expect(await api.getGeofence()).toBeNull();
    expect(health.getHealth().degraded).toBe(true);
  });

  it('does NOT report a 404, so an undeployed route raises no banner — and still fails open', async () => {
    // Phase 3's classification: 401/403/404/501 are answers, not faults. The user gets no
    // outage banner AND no invented fence; the server decides at clock-in.
    api.setAuthToken('test-token');
    fetchSpy.mockResolvedValueOnce(reply(404, { success: false }));
    expect(await api.getGeofence()).toBeNull();
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('checkGeofence — the fence is unknown', () => {
  it('FLIPPED FROM PHASE 2: fails OPEN, and says the verdict is a deferral', async () => {
    // The Phase-2 case was named "fails CLOSED when the geofence config is unreachable" and
    // asserted `allowed === false` with `radius_m === 2000`. docs/PHASES.md Phase 7 owns the flip.
    api.setAuthToken('test-token');
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    const res = await api.checkGeofence(0, 0); // Gulf of Guinea, ~8000 km away
    expect(res).toEqual({ allowed: true, known: false, distance_m: null, radius_m: null, message: '' });
  });

  it('makes no distance or radius claim it cannot back', async () => {
    // `known: false` is the whole point: `allowed` here means "ask the server", not "you are at
    // the office", and a caller must be able to tell those apart before writing copy.
    api.setAuthToken('test-token');
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    const res = await api.checkGeofence(FENCE.lat + M(50_000), FENCE.lng, 10);
    expect(res.known).toBe(false);
    expect(res.distance_m).toBeNull();
    expect(res.radius_m).toBeNull();
    expect(res.message).toBe('');
  });

  it('fails open on a signed-out session without touching the network', async () => {
    const res = await api.checkGeofence(0, 0);
    expect(res.allowed).toBe(true);
    expect(res.known).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('checkGeofence — the fence is known', () => {
  it('allows a point inside the radius', async () => {
    await withFence();
    expect(await api.checkGeofence(FENCE.lat + M(100), FENCE.lng)).toEqual({
      allowed: true, known: true, distance_m: 100, radius_m: 200, message: 'Within the office area',
    });
  });

  it('PHASE 50: allows a fix at the SECOND office though it is far from the first — nearest wins', async () => {
    // THE REGRESSION THIS PINS: measuring against office[0] only would put this fix ~3.1 km out and
    // REFUSE it, locking out everyone standing at office B — a clock-in the server (which fences on
    // the NEAREST office) would allow. That is the exact "never refuse what the server allows" rule.
    api.setAuthToken('test-token');
    fetchSpy.mockResolvedValue(twoOfficeReply(3000)); // office B is 3 km north of office A
    const res = await api.checkGeofence(FENCE.lat + M(3100), FENCE.lng); // 100 m past office B
    expect(res.allowed).toBe(true);
    expect(res.distance_m).toBe(100); // distance to the NEAREST office (B), not the 3100 m to A
  });

  it('PHASE 50: denies a fix outside BOTH offices, reporting the distance to the NEARER', async () => {
    api.setAuthToken('test-token');
    fetchSpy.mockResolvedValue(twoOfficeReply(3000));
    // 1200 m north of A ⇒ 1200 m from A, 1800 m from B. Nearer is A at 1200 m.
    const res = await api.checkGeofence(FENCE.lat + M(1200), FENCE.lng);
    expect(res.allowed).toBe(false);
    expect(res.distance_m).toBe(1200);
  });

  it('denies a point outside it, and says how much closer to move rather than quoting a fence', async () => {
    // INBOX D10: any UI copy that states the fence size will disagree with the server, which
    // credits up to 100 m of accuracy on top of the radius and whose own message understates
    // itself as "within 0.2 km". Both numbers here are measured, so neither can contradict it.
    await withFence();
    const res = await api.checkGeofence(FENCE.lat + M(250), FENCE.lng);
    expect(res.allowed).toBe(false);
    expect(res.known).toBe(true);
    expect(res.distance_m).toBe(250);
    expect(res.message).toBe(`You're 250${NB}m from the office. Move about 50${NB}m closer to clock in.`);
    expect(res.message).not.toMatch(/km|0\.2|200 m/);
  });

  it('gives advice that is still true after you follow it, spending no accuracy credit', async () => {
    // The advice is `dist - radius`, NOT `dist - tol - radius`. At 250 m with a 40 m fix the
    // credited shortfall is 10 m — walk 10 m, get a 5 m fix on arrival, and the credit shrinks
    // and the refusal repeats. 50 m works whatever the next fix looks like. The VERDICT still
    // spends the credit, because that half has to match the server.
    await withFence();
    const res = await api.checkGeofence(FENCE.lat + M(250), FENCE.lng, 40);
    expect(res.allowed).toBe(false);
    expect(res.message).toContain(`Move about 50${NB}m closer`);
  });

  it('renders kilometres only above 1 km, to one decimal', async () => {
    await withFence();
    const res = await api.checkGeofence(FENCE.lat + M(1890), FENCE.lng);
    expect(res.message).toBe(`You're 1.9${NB}km from the office. Move about 1.7${NB}km closer to clock in.`);
  });

  it('never renders "1000 m" — the unit switches on the ROUNDED value', async () => {
    // 995 rounds to 1000, which is the one string the metres branch exists to avoid.
    await withFence();
    const res = await api.checkGeofence(FENCE.lat + M(995), FENCE.lng);
    expect(res.message).toContain(`You're 1.0${NB}km from the office`);
    expect(res.message).not.toContain('1000');
  });

  it('never says "0 m closer" for a near miss', async () => {
    await withFence();
    const res = await api.checkGeofence(FENCE.lat + M(203), FENCE.lng);
    expect(res.allowed).toBe(false);
    expect(res.message).toContain(`Move about 10${NB}m closer`);
  });

  it('MAKES D10 EXECUTABLE: the effective fence is up to 300 m, not a flat 200', async () => {
    // `utils/geofence.js:93-94` credits `Math.min(acc, 100)` before comparing to the radius.
    await withFence();
    expect((await api.checkGeofence(FENCE.lat + M(290), FENCE.lng, 100)).allowed).toBe(true);
    expect((await api.checkGeofence(FENCE.lat + M(310), FENCE.lng, 100)).allowed).toBe(false);
  });

  it('caps the accuracy credit at 100 m, so a hopeless fix does not buy an unlimited fence', async () => {
    await withFence();
    expect((await api.checkGeofence(FENCE.lat + M(310), FENCE.lng, 5000)).allowed).toBe(false);
  });

  it('does NOT mirror the server\'s >300 m outright rejection, and that is deliberate', async () => {
    // `utils/geofence.js:89` refuses any fix coarser than 300 m. Copying that threshold would
    // duplicate a number from someone else's file to buy one round trip, AND would make this
    // function refuse — which docs/spec/PHASE-7.md D-1 forbids. The server answers 403 with its
    // own better sentence instead.
    await withFence();
    const res = await api.checkGeofence(FENCE.lat, FENCE.lng, 5000);
    expect(res.allowed).toBe(true);
    expect(res.message).toBe('Within the office area');
  });

  it('FLIPPED FROM PHASE 2: a negative accuracy no longer makes the fence stricter', async () => {
    // Phase 2 pinned the bug: `Math.min(-200, 100)` is -200, so `dist - tol` became `dist + 200`
    // and a point comfortably inside was denied. Clamping at zero only ever ALLOWS more, which is
    // the one direction this function is permitted to differ from the server in.
    await withFence();
    const inside = await api.checkGeofence(FENCE.lat + M(100), FENCE.lng, -200);
    expect(inside.allowed).toBe(true);
    expect(inside.distance_m).toBe(100);
  });

  it('reads a numeric-STRING accuracy the way the server does, instead of refusing people', async () => {
    // The server coerces with `Number(accuracy)` (`utils/geofence.js:88`). The old
    // `typeof accuracy === 'number'` test gave the same fix a tolerance of 0, so the app denied a
    // clock-in the server would have allowed — and `home.tsx` returns before ever asking it.
    await withFence();
    const res = await api.checkGeofence(FENCE.lat + M(250), FENCE.lng, '80' as unknown as number);
    expect(res.allowed).toBe(true);
  });

  it('treats a missing accuracy as no credit, like the server', async () => {
    await withFence();
    expect((await api.checkGeofence(FENCE.lat + M(250), FENCE.lng)).allowed).toBe(false);
    expect((await api.checkGeofence(FENCE.lat + M(250), FENCE.lng, undefined)).allowed).toBe(false);
  });

  it('allows everything when the server says the fence is off, and marks that as KNOWN', async () => {
    // `enforce: false` is a fact about the fence; an unreachable config is the absence of one.
    // They both allow, and they must not be confused.
    await withFence({ enforce: false });
    expect(await api.checkGeofence(0, 0)).toEqual({
      allowed: true, known: true, distance_m: null, radius_m: 200, message: '',
    });
  });

  it('denies a missing GPS fix with distance_m null, not 0', async () => {
    await withFence();
    const expected = {
      allowed: false, known: true, distance_m: null, radius_m: 200,
      message: 'Enable location to clock in.',
    };
    expect(await api.checkGeofence(undefined, FENCE.lng)).toEqual(expected);
    expect(await api.checkGeofence(FENCE.lat, undefined)).toEqual(expected);
    expect(await api.checkGeofence(null as unknown as number, FENCE.lng)).toEqual(expected);
    expect(await api.checkGeofence(NaN, FENCE.lng)).toEqual(expected);
    expect(await api.checkGeofence(Infinity, FENCE.lng)).toEqual(expected);
  });

  it('treats coordinates (0, 0) as a real fix, because the guard is loose equality', async () => {
    // `lat == null` does NOT catch 0, so the null-island is a valid position and the user is told
    // how far away they are rather than to enable location.
    await withFence();
    const res = await api.checkGeofence(0, 0);
    expect(res.message).not.toBe('Enable location to clock in.');
    expect(res.allowed).toBe(false);
  });
});
