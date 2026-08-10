/**
 * Field-route tracking. While a team member is clocked in we record their GPS path and
 * stream it to the backend so the master can replay where they went.
 *
 * WHY THIS IS A BACKGROUND TASK AND NOT A FOREGROUND WATCH.
 * The previous implementation used `Location.watchPositionAsync`, which only runs while the
 * app is in the foreground. An advisor spends the day with the phone in a pocket, so the
 * recorded "route" was really just the handful of minutes the app happened to be open. It
 * was replaced by a foreground-service backed background task once the app was provisioned
 * for it: ACCESS_BACKGROUND_LOCATION / FOREGROUND_SERVICE / FOREGROUND_SERVICE_LOCATION in
 * app.json plus `isAndroidBackgroundLocationEnabled` and
 * `isAndroidForegroundServiceEnabled` on the expo-location plugin. (An earlier attempt
 * crashed on device precisely because those were missing: Android force-stops a
 * mis-provisioned foreground service and no JS try/catch can intercept that.)
 *
 * THE TASK IS DEFINED AT MODULE SCOPE, ON PURPOSE.
 * When the OS wakes the app to hand over a batch of locations, it boots the JS bundle with
 * no views mounted, looks up the task by name, and drops the update on the floor if nothing
 * is registered by the time evaluation finishes. Registration therefore cannot live inside
 * `startTracking` or a React effect. It also means this module must be imported from the
 * root layout so it is evaluated on every JS start, including headless ones.
 *
 * NOTHING MAY LIVE ONLY IN MEMORY.
 * A headless wake-up gets a brand new JS context: module variables are empty, AuthProvider
 * never mounted, so `data/api` holds no token. The pending point buffer, the shift's session
 * id and the auth token are all read back from storage on every wake. A buffer kept in a
 * module variable would be lost on the common path, not the rare one.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { storage } from './storage';
import * as api from '@/data/api';

const isNative = Platform.OS !== 'web';

/**
 * Registered with the OS and persisted by TaskManager across launches. Renaming this
 * orphans any service already running on a device that upgraded mid-shift, so it stays put.
 */
const ROUTE_TASK = 'cgpe-field-route';

const STATE_KEY = 'track.state';
/** Written by the previous (foreground-watch) implementation. Cleaned up, never read. */
const LEGACY_SESSION_KEY = 'track.sessionId';
/**
 * Must match `TOKEN_KEY` in `store/auth.tsx`. Duplicated rather than imported because
 * importing the auth store here would pull React state into a headless task context.
 */
const TOKEN_KEY = 'cgpe.token';

/**
 * Roughly four hours of points at one fix a minute. The buffer only grows while the device
 * has no usable network, and every batch that lands clears it, so this cap is a guard
 * against an all-day dead zone rather than the normal case.
 */
const MAX_POINTS = 240;

/** `[lat, lng, epochMs, accuracy, speed, heading]` — compact because it is re-serialised on every fix. */
type PointTuple = [number, number, number, number | null, number | null, number | null];

type Persisted = {
  v: 1;
  /** Attendance session this route belongs to. */
  sid?: string;
  pts: PointTuple[];
  /** Newest timestamp already buffered, so a redelivered batch cannot duplicate rows. */
  lastAt: number;
};

/**
 * Mirrors `hasStartedLocationUpdatesAsync` so the existing synchronous `isTracking()` stays
 * synchronous. Hydrated once per JS start (below) because after an app restart mid-shift the
 * service is running but this module has only just been evaluated.
 */
let running = false;

/**
 * Read-modify-write of the persisted buffer happens from two places that can overlap: the
 * OS delivering a batch and the user tapping clock out. There is a single JS context per
 * app, so chaining the operations is enough to stop one from clobbering the other.
 */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.then(() => undefined, () => undefined);
  return next;
}

const opt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function round(n: number | null | undefined, dp: number): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function normalize(raw: unknown): PointTuple[] {
  if (!Array.isArray(raw)) return [];
  const out: PointTuple[] = [];
  for (const t of raw) {
    if (!Array.isArray(t) || t.length < 3) continue;
    const lat = Number(t[0]);
    const lng = Number(t[1]);
    const at = Number(t[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(at)) continue;
    out.push([lat, lng, at, opt(t[3]), opt(t[4]), opt(t[5])]);
  }
  return out.slice(-MAX_POINTS);
}

async function readState(): Promise<Persisted> {
  try {
    const raw = await storage.get(STATE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.v === 1) {
        return {
          v: 1,
          sid: typeof p.sid === 'string' && p.sid ? p.sid : undefined,
          pts: normalize(p.pts),
          lastAt: Number(p.lastAt) || 0,
        };
      }
    }
  } catch {
    // Corrupt or half-written JSON: start clean rather than stall the whole shift.
  }
  return { v: 1, pts: [], lastAt: 0 };
}

async function writeState(s: Persisted): Promise<void> {
  await storage.set(STATE_KEY, JSON.stringify({ ...s, pts: s.pts.slice(-MAX_POINTS) }));
}

function toPoints(pts: PointTuple[]): api.TrackPoint[] {
  return pts.map(([lat, lng, at, accuracy, speed, heading]) => ({
    lat,
    lng,
    at: new Date(at).toISOString(),
    accuracy: accuracy ?? undefined,
    speed: speed ?? undefined,
    heading: heading ?? undefined,
  }));
}

type Delivery = 'sent' | 'refused' | 'retry' | 'signed-out' | 'unattributable';

/**
 * Post a batch.
 *
 * `sent` — the server took them, drop them. `refused` — the server understood and said no, also
 * drop them: a 4xx does not improve by being repeated, and before PHASE 7 both this and a dead
 * network came back as the same `false`, so a permanently-refused batch was retried on every
 * wake-up until the 240-point cap evicted it. `retry` — keep them. `signed-out` — there is no
 * longer an account to post them to. `unattributable` — we have no session id, so nothing
 * collected here can be tied to a shift; see `ingest`.
 *
 * The token rehydration is the important part. In a headless context `data/api` has no
 * token, and `postTrackPoints` short-circuits to `sent` when the session is not real, so
 * without this the buffer would be cleared on every wake having sent absolutely nothing.
 */
async function deliver(sid: string | undefined, pts: PointTuple[]): Promise<Delivery> {
  if (!pts.length) return 'sent';
  if (!api.isRealSession()) {
    const token = await storage.get(TOKEN_KEY);
    if (!token) return 'signed-out';
    api.setAuthToken(token);
    // A demo token has no server behind it. Report success so the buffer does not grow
    // forever on a device that is only being demoed.
    if (!api.isRealSession()) return 'sent';
  }
  // The session-id guard lives in `postTrackPoints`, not here, so there is exactly one place
  // that decides what an un-attributable batch is — and a test can pin it on the wire.
  const res = await api.postTrackPoints(toPoints(pts), sid).catch(() => null);
  if (!res) return 'retry';
  return res.outcome === 'no-session' ? 'unattributable' : res.outcome;
}

/**
 * Tear the OS service down. Deliberately not wrapped in `serial` so it can be called from
 * inside an already-serialised block.
 */
async function stopUpdates(): Promise<void> {
  running = false;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(ROUTE_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(ROUTE_TASK);
      return;
    }
  } catch {
    // Fall through to the TaskManager-level unregister below.
  }
  // Belt and braces: if expo-location could not stop it (service already dead, or the task
  // was registered by a previous build) unregister by name so the device is not left with a
  // permanent notification and a location subscription nobody owns.
  try {
    if (await TaskManager.isTaskRegisteredAsync(ROUTE_TASK)) await TaskManager.unregisterTaskAsync(ROUTE_TASK);
  } catch {
    // Nothing further we can do from JS.
  }
}

/* ------------------------------------------------------------------ the task */

/**
 * Registered unconditionally at module scope. On web `defineTask` is a no-op map write, so
 * there is no platform branch to get wrong; the guard is only against Fast Refresh
 * re-evaluating this module and warning about a duplicate definition.
 */
if (!TaskManager.isTaskDefined(ROUTE_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(ROUTE_TASK, async ({ data, error }) => {
    if (error) {
      if (__DEV__) console.warn('[tracker] location task error', error.message);
      return; // One bad batch must not take the service down for the rest of the shift.
    }
    const locations = data?.locations;
    if (!Array.isArray(locations) || !locations.length) return;

    // A rejection out of a task executor is an unhandled rejection in a context with no
    // error boundary and no screen to show it on, so the whole body is contained here.
    await serial(async () => {
      try {
        await ingest(locations);
      } catch {
        // Keep the service alive; the next batch retries with the same persisted buffer.
      }
    });
  });
}

/** Body of the location task. Runs inside `serial`, so it owns the persisted state exclusively. */
async function ingest(locations: Location.LocationObject[]): Promise<void> {
  const state = await readState();
  let lastAt = state.lastAt;

  for (const loc of locations) {
    const c = loc?.coords;
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
    const at = Number(loc.timestamp) || Date.now();
    // Deferred batching can hand back a fix we already hold. Anything older than the newest
    // buffered point is a replay, unless the clock jumped backwards by minutes (a real
    // device time change), in which case we adopt the new baseline instead of silently
    // discarding the rest of the shift.
    if (at <= lastAt && lastAt - at < 300000) continue;
    state.pts.push([
      round(c.latitude, 6) ?? 0,
      round(c.longitude, 6) ?? 0,
      at,
      round(c.accuracy, 1),
      round(c.speed, 2),
      round(c.heading, 1),
    ]);
    lastAt = at;
  }

  state.lastAt = lastAt;
  // Keep the most recent stretch: for a route replay the last hour is worth more than the
  // first, and the tail is what the flush is about to send anyway.
  if (state.pts.length > MAX_POINTS) state.pts = state.pts.slice(-MAX_POINTS);

  const outcome = await deliver(state.sid, state.pts);
  // Two different facts, one buffer action: `sent` landed and `refused` was declined, and
  // neither is improved by being sent again.
  if (outcome === 'sent' || outcome === 'refused') state.pts = [];

  if (outcome === 'signed-out' || outcome === 'unattributable') {
    // `signed-out`: the account was signed out while the service kept running.
    // `unattributable` (PHASE 7): the service is running with no session id, so every fix it
    // collects belongs to no shift and cannot be posted — the server would otherwise resolve
    // the owner from whichever token is on the handset, which is how one person's route lands
    // on another person's day.
    // Either way, leaving the service up would burn battery, hold a notification the user
    // cannot explain, and collect location for nobody. Drop everything.
    await storage.remove(STATE_KEY);
    await stopUpdates();
    return;
  }
  await writeState(state);
}

// After the app is killed and relaunched mid-shift the service is still running but this
// module has only just been evaluated, so `isTracking()` would lie until the next clock
// action. Ask the OS once per JS start.
if (isNative) {
  Location.hasStartedLocationUpdatesAsync(ROUTE_TASK)
    .then((v) => { running = v; })
    .catch(() => { /* task never registered on this device */ });
}

/* ------------------------------------------------------------------ public API */

/**
 * Ask for everything the background route recorder needs, in the order the platforms
 * require: foreground first, background second. Android auto-denies a background request
 * that arrives before foreground has been granted, so the order is not cosmetic.
 *
 * The caller gates clock-in on this and shows `reason` to the user, which is why every
 * failure path returns a specific sentence instead of a generic one. Deliberately NOT
 * called from `startTracking`: a permission dialog belongs to a button press, not to a
 * background service starting up.
 */
export async function ensureBackgroundPermission(): Promise<{ granted: boolean; reason?: string }> {
  if (!isNative) {
    return {
      granted: false,
      reason: 'Route recording works in the CGPE Connect app on your phone. The browser preview cannot record a field route.',
    };
  }
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return {
        granted: false,
        reason: 'Location is switched off on this phone. Turn on Location in your device settings, then try again.',
      };
    }

    let fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) {
      return {
        granted: false,
        reason: fg.canAskAgain
          ? 'Location permission was declined. CGPE Connect needs your location to confirm you are at the office and to record your field route.'
          : 'Location permission is blocked for CGPE Connect. Open Settings, find CGPE Connect, and allow Location.',
      };
    }

    let bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) {
      // Both platforms have a real path here: Android shows the permission page where the
      // user picks "Allow all the time", iOS asks for "Always" (or offers it later).
      const setting = Platform.OS === 'ios' ? 'Always' : 'Allow all the time';
      return {
        granted: false,
        reason: `Background location is not allowed yet. Open Settings, find CGPE Connect, and set Location to "${setting}" so your route keeps recording while the phone is in your pocket.`,
      };
    }

    return { granted: true };
  } catch {
    return {
      granted: false,
      reason: 'Location permission could not be checked on this phone. Restart the app and try again.',
    };
  }
}

/**
 * Begin recording the field route for a clocked-in session.
 *
 * Best-effort by contract: it never throws and never blocks clock-in. It also never asks for
 * a permission, only reads one, because the caller has already run
 * `ensureBackgroundPermission()`. Foreground permission alone is enough to keep recording
 * (Android via the foreground service, iOS via the background location indicator), so a user
 * who granted "while using" still gets a usable route rather than nothing at all.
 *
 * PHASE 7: `sid` IS REQUIRED. A shift whose session id we do not have records no route at all,
 * because a route that cannot be attributed is worse than none — it burns battery, holds a
 * notification, collects somebody's location all day, and then either 400s or lands on whoever
 * happens to be signed in. The caller says so on screen; see `postTrackPoints`.
 */
export async function startTracking(sid: string): Promise<void> {
  if (!isNative || !sid) return;
  await serial(async () => {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (!fg.granted) return;

      const state = await readState();
      // A new shift must never inherit the previous shift's undelivered points, which on a
      // shared handset could belong to a different person entirely. Points survive only when
      // the session id is byte-identical, i.e. this is a genuine resume.
      if (state.sid !== sid) {
        state.pts = [];
        state.lastAt = 0;
      }
      state.sid = sid;
      await writeState(state);
      await storage.remove(LEGACY_SESSION_KEY);

      api.startTrack(sid).catch(() => {});

      const already = await Location.hasStartedLocationUpdatesAsync(ROUTE_TASK).catch(() => false);
      if (!already) {
        await Location.startLocationUpdatesAsync(ROUTE_TASK, {
          // Balanced is a deliberate battery choice: these people are out all day and a
          // route replay does not need lane-level precision.
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000,
          distanceInterval: 30,
          deferredUpdatesInterval: 60000,
          // The service can restart in the background, where a settings dialog would be
          // both impossible and alarming. `ensureBackgroundPermission` is where the user is
          // told that location is switched off.
          mayShowUserSettingsDialog: false,

          // iOS: without these the OS pauses updates the moment it decides the user is
          // stationary, and the shift ends up with holes.
          activityType: Location.ActivityType.AutomotiveNavigation,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,

          // Android: no foreground service means the OS kills the process. The wording is
          // literal on purpose, the user should never wonder what this notification is.
          foregroundService: {
            notificationTitle: 'Recording your field route',
            notificationBody: 'Your shift is being tracked. Clock out to stop.',
            // Brand azure. Hardcoded because the theme is a React hook and the OS restarts
            // this service in contexts where no provider exists.
            notificationColor: '#3182ed',
            // The shift outlives the app window: swiping the app away must not silently end
            // route recording. Only clock out does that.
            killServiceOnDestroy: false,
          },
        });
      }
      running = true;
    } catch {
      // A refused or unavailable service must not fail the clock-in that triggered it.
      running = await Location.hasStartedLocationUpdatesAsync(ROUTE_TASK).catch(() => false);
    }
  });
}

/**
 * Stop recording and seal the session's path.
 *
 * Idempotent: a second call finds no buffer and no running service and quietly does nothing.
 * Order matters. Points are flushed before the service is unregistered and before
 * `stopTrack` seals the session server-side, so the sealed route includes its own last
 * minute.
 *
 * If that final flush fails (clocking out inside a dead zone) the points are dropped rather
 * than kept. The shift is over, nothing will wake up to retry them, and a stale bag of one
 * person's coordinates sitting on a shared handset is a worse outcome than a route that is
 * missing its last leg.
 */
export async function stopTracking(): Promise<void> {
  if (!isNative) return;
  await serial(async () => {
    try {
      const state = await readState();
      if (state.pts.length) await deliver(state.sid, state.pts);
      await stopUpdates();
      if (state.sid) await api.stopTrack(state.sid).catch(() => {});
    } catch {
      // Fall through: the storage cleanup below must happen either way.
    }
    running = false;
    await storage.remove(STATE_KEY);
    await storage.remove(LEGACY_SESSION_KEY);
  });
}

/** True if the background route service is currently running. */
export function isTracking(): boolean {
  return running;
}
