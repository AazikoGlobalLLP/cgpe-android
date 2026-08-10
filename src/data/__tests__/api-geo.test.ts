/**
 * PHASE 2 — `distanceMeters`, `getGeofence` and `checkGeofence` pinned.
 *
 * This is the arithmetic that decides whether a field agent is allowed to start their shift.
 * The client check is UX-only (the server re-validates), but it is what the person actually
 * sees, and it currently fails CLOSED when the geofence route is unreachable.
 *
 * NO fetch stub is installed here on purpose. `sessionReal` starts false (api.ts:46), so
 * `tryReal` short-circuits at api.ts:119 BEFORE any network call and `_geoCache` becomes the
 * real FALLBACK_GEOFENCE. Every case below therefore exercises genuine code with nothing
 * mocked — and the "fetch was never called" assertion is what proves the short-circuit.
 *
 * scanRenewals lives in api-renewals.test.ts, NOT here: it needs a fetch stub, and a stub
 * installed in this file could silently satisfy a geofence request that should never happen.
 *
 * src/data/api.ts holds module-level state with no reset path (`_geoCache` at api.ts:1037,
 * `sessionReal` at :46), and Vitest isolates per FILE, not per test — hence vi.resetModules()
 * and a fresh import in beforeEach. See docs/spec/PHASE-2.md row 7.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

/** The office pin baked into api.ts:1036, repeated here so a change to it breaks a test. */
const OFFICE = { lat: 21.208780388697864, lng: 72.83928189060113 };

beforeEach(async () => {
  vi.resetModules();
  // Not a stub of behaviour — a tripwire. Any real network call in this file is a bug in the
  // test, and it should fail loudly rather than hit the production backend.
  fetchSpy = vi.fn(() => { throw new Error('no test in this file may perform a fetch'); });
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
});

describe('distanceMeters', () => {
  it('returns exactly 0 for identical points', () => {
    expect(api.distanceMeters(0, 0, 0, 0)).toBe(0);
    expect(api.distanceMeters(OFFICE.lat, OFFICE.lng, OFFICE.lat, OFFICE.lng)).toBe(0);
  });

  it('measures one degree of latitude at the equator', () => {
    // Closed form for a pure meridian arc: R * (1 degree in radians). Derived independently
    // of the haversine expansion, so it pins R = 6371000 (api.ts:1049) and the degree
    // conversion (:1050) rather than restating the implementation.
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
    const d = api.distanceMeters(OFFICE.lat, OFFICE.lng, OFFICE.lat + 0.01, OFFICE.lng);
    expect(d).toBeCloseTo(6371000 * (Math.PI / 180) / 100, 3);
  });

  it('reaches half the circumference at antipodal points without producing NaN', () => {
    // Documents the theoretical Math.sqrt(1 - a) hazard — there is no Math.max(0, ...) clamp
    // at api.ts:1053 — WITHOUT asserting NaN, which at this pair would encode luck.
    expect(api.distanceMeters(0, 0, 0, 180)).toBeCloseTo(6371000 * Math.PI, 2);
  });

  it('propagates NaN, because it validates nothing', () => {
    // The guard lives in the CALLER (checkGeofence, api.ts:1060-1062). This pins where the
    // responsibility sits.
    expect(Number.isNaN(api.distanceMeters(NaN, 0, 0, 0))).toBe(true);
    expect(Number.isNaN(api.distanceMeters(0, 0, undefined as unknown as number, 0))).toBe(true);
  });
});

describe('getGeofence — offline fallback', () => {
  it('returns the Surat office pin with NO network call', async () => {
    // sessionReal is false, so tryReal never reaches fetch. The fetch assertion IS the proof.
    await expect(api.getGeofence()).resolves.toEqual({
      lat: 21.208780388697864,
      lng: 72.83928189060113,
      radius_m: 2000,
      label: 'CGPE Head Office',
      enforce: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('caches the fallback BY REFERENCE for the rest of the session', () => {
    // api.ts:1043 assigns FALLBACK_GEOFENCE itself, not a copy — so a caller that mutates the
    // returned object changes the fence for every later call. This is also why every test file
    // touching the geofence must vi.resetModules().
    return Promise.all([api.getGeofence(), api.getGeofence()]).then(([first, second]) => {
      expect(second).toBe(first);
    });
  });
});

describe('checkGeofence', () => {
  it('fails CLOSED when the geofence config is unreachable', async () => {
    // FALLBACK_GEOFENCE carries enforce:true, so a config outage BLOCKS clock-in rather than
    // allowing it. docs/PHASES.md Phase 7 changes this to fail open; when it does, this test
    // must be updated deliberately.
    const res = await api.checkGeofence(0, 0); // Gulf of Guinea
    expect(res.allowed).toBe(false);
    expect(res.radius_m).toBe(2000);
    expect(res.distance_m).toBeGreaterThan(8_000_000);
  });

  it('treats coordinates (0, 0) as a real fix, because the guard is loose equality', async () => {
    // api.ts:1060 `lat == null` does NOT catch 0, so the null-island is a valid position and
    // the user is told how far away they are rather than to enable location.
    const res = await api.checkGeofence(0, 0);
    expect(res.message).not.toBe('Enable location to clock in.');
  });

  it('allows a point inside the fallback radius', async () => {
    const res = await api.checkGeofence(OFFICE.lat + 0.017, OFFICE.lng);
    expect(res).toEqual({
      allowed: true,
      distance_m: 1890,
      radius_m: 2000,
      message: 'Within the office area',
    });
  });

  it('denies a point just outside, and rounds distance_m independently of the message', async () => {
    // api.ts:1067-1068: distance_m is Math.round(dist) = 2002 while the message formats the
    // UNROUNDED value as '2.00'. The two disagree by design, and that mismatch is exactly what
    // a naive tidy-up would collapse. Note the two different precisions: toFixed(2) for the
    // distance, toFixed(1) for the radius.
    const res = await api.checkGeofence(OFFICE.lat + 0.018, OFFICE.lng);
    expect(res.allowed).toBe(false);
    expect(res.distance_m).toBe(2002);
    expect(res.message).toContain('2.00 km from the office');
    expect(res.message).toContain('within 2.0 km');
  });

  it('caps the accuracy tolerance at 100 m, flipping the same point to allowed', async () => {
    // tol = Math.min(500, 100) = 100, and 2001.5 - 100 <= 2000. So the real worst-case
    // effective radius is 2100 m, not 2000. distance_m is unaffected — tolerance changes only
    // the verdict.
    const res = await api.checkGeofence(OFFICE.lat + 0.018, OFFICE.lng, 500);
    expect(res.allowed).toBe(true);
    expect(res.distance_m).toBe(2002);
    expect(res.message).toBe('Within the office area');
  });

  it('ignores a numeric-STRING accuracy, so the same point is denied', async () => {
    // api.ts:1064 requires `typeof accuracy === 'number'`. Together with the previous case
    // this fences the type check.
    const res = await api.checkGeofence(OFFICE.lat + 0.018, OFFICE.lng, '500' as unknown as number);
    expect(res.allowed).toBe(false);
  });

  it('denies a missing GPS fix with distance_m null, not 0', async () => {
    const expected = {
      allowed: false, distance_m: null, radius_m: 2000,
      message: 'Enable location to clock in.',
    };
    expect(await api.checkGeofence(undefined, OFFICE.lng)).toEqual(expected);
    expect(await api.checkGeofence(OFFICE.lat, undefined)).toEqual(expected);
    expect(await api.checkGeofence(null as unknown as number, OFFICE.lng)).toEqual(expected);
    expect(await api.checkGeofence(NaN, OFFICE.lng)).toEqual(expected);
    expect(await api.checkGeofence(Infinity, OFFICE.lng)).toEqual(expected);
  });

  it('never performs a network call on any of these paths', () => {
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('pinned known bugs — these must be updated deliberately when fixed', () => {
  it('a NEGATIVE accuracy makes the check STRICTER instead of being clamped', async () => {
    // Math.min(-200, 100) = -200, so `dist - tol` becomes dist + 200 and a point comfortably
    // inside the radius is denied. There is no Math.max(0, ...) at api.ts:1064.
    const inside = await api.checkGeofence(OFFICE.lat + 0.017, OFFICE.lng);
    expect(inside.allowed).toBe(true);

    const sameSpotWithNegativeAccuracy =
      await api.checkGeofence(OFFICE.lat + 0.017, OFFICE.lng, -200);
    expect(sameSpotWithNegativeAccuracy.allowed).toBe(false);
    expect(sameSpotWithNegativeAccuracy.distance_m).toBe(1890);
  });

  it('states a 2.0 km fence, which contracts/INBOX.md D10 says the server does not enforce', () => {
    // The server's effective fence is up to 300 m (it credits up to 100 m of GPS accuracy),
    // per contracts/INBOX.md D10. The app's OFFLINE fallback is 2000 m with enforce:true, so
    // an unreachable config both blocks legitimate clock-ins and quotes a radius the server
    // never agreed to. docs/PHASES.md Phase 7 owns this.
    return api.getGeofence().then((g) => {
      expect(g.radius_m).toBe(2000);
      expect(g.enforce).toBe(true);
    });
  });
});
