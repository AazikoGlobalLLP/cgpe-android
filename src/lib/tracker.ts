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
import { Platform, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as IntentLauncher from 'expo-intent-launcher';
import * as BackgroundTask from 'expo-background-task';
import { Accelerometer } from 'expo-sensors';
import { storage } from './storage';
import { watchdogAction } from './watchdog';
import { isBufferStale, WATCHDOG_INTERVAL_MS } from './staleBuffer';
import { partitionShiftPoints } from './boundaryAttribution';
import { dropMocked, shouldSignalWithdrawal, locationBlockReason, type BlockReason } from './antiCircumvention';
import {
  classifyMotion,
  debounceMotion,
  resolveMotion,
  samplingProfile,
  AMBIENT_PROFILE,
  MOTION_WINDOW,
  type MotionState,
  type SamplingProfile,
} from './motion';
import * as api from '@/data/api';

const isNative = Platform.OS !== 'web';
/** Android-specific gate: `timeInterval` throttles delivery only on Android, so `distanceInterval: 0`
 *  is safe there but firehoses iOS (which has no timeInterval) — see `startService`. */
const isAndroid = Platform.OS === 'android';

/**
 * Registered with the OS and persisted by TaskManager across launches. Renaming this
 * orphans any service already running on a device that upgraded mid-shift, so it stays put.
 */
const ROUTE_TASK = 'cgpe-field-route';

/**
 * PHASE 41b — the reliability watchdog (§2.3/§2.4). A DISTINCT task from ROUTE_TASK: this one is a
 * periodic `expo-background-task` (WorkManager on Android), not a location subscription. Its only
 * job is to re-arm ROUTE_TASK when the OS has killed the foreground service (aggressive OEM Doze) or
 * the device rebooted (expo-location's task does not survive a reboot). WorkManager restores this
 * periodic task after a reboot, so one watchdog covers both cases without a native BootReceiver.
 * Renaming it orphans a schedule already registered on an upgraded device, so it stays put.
 */
const WATCHDOG_TASK = 'cgpe-track-watchdog';
/**
 * 15 min is the Android floor for a periodic background task (expo-background-task, SDK 57). Derived
 * from the shared ms constant so this cadence and PHASE 71's freshness threshold (`STALE_AFTER_MS =
 * 60 min − this interval`, in `staleBuffer.ts`) can never drift apart.
 */
const WATCHDOG_INTERVAL_MIN = WATCHDOG_INTERVAL_MS / (60 * 1000);

const STATE_KEY = 'track.state';
/** Written by the previous (foreground-watch) implementation. Cleaned up, never read. */
const LEGACY_SESSION_KEY = 'track.sessionId';
/**
 * Must match `TOKEN_KEY` in `store/auth.tsx`. Duplicated rather than imported because
 * importing the auth store here would pull React state into a headless task context.
 */
const TOKEN_KEY = 'cgpe.token';

/**
 * PHASE 41 — 24/7 (off-duty) recording. It is armed only after the user grants consent (`/consent`),
 * and the flag is persisted so a headless wake — a brand-new JS context — can tell whether a batch
 * with no shift `sid` is a consented ambient batch (post it) or the PHASE 7 unattributable case (stop).
 * `track.notif` holds the RESOLVED (translated) 24/7 notification strings, captured at arm time because
 * a headless service restart has no i18n context (§12.4). `track.batteryOptAsked` makes the
 * battery-optimisation prompt fire at most once per install rather than on every clock-in.
 */
const AMBIENT_KEY = 'track.ambient';
const NOTIF_KEY = 'track.notif';
const BATTOPT_KEY = 'track.batteryOptAsked';
/**
 * PHASE 41c — the last committed motion state (`{state,at}`) written by the accelerometer classifier.
 * Read at each service (re)start to pick the sampling profile. Persisted (not a module var) so a
 * headless restart / watchdog re-arm can read it, and stamped with `at` so a stale `still` fails safe
 * to `moving` (`resolveMotion`) — an out-of-date reading must never make us under-sample and lose a route.
 */
const MOTION_KEY = 'track.motion';

/** The two foreground-service notifications: the shift recorder's, and the neutral 24/7 one. */
type Notif = { title: string; body: string };
const SHIFT_NOTIF: Notif = {
  title: 'Recording your field route',
  body: 'Your shift is being tracked. Clock out to stop.',
};
/**
 * Neutral 24/7 fallback, matching the English `consent.serviceTitle`/`serviceBody` (i18n). Used only
 * when the resolved strings are absent (e.g. a headless restart before any in-app arm) — normally the
 * user's own language is read back from `track.notif`.
 */
const AMBIENT_NOTIF_FALLBACK: Notif = { title: 'CGPE Connect', body: 'Location on for work' };

/**
 * Offline retention buffer for the route. It only grows while the device has no usable network; every
 * batch that lands clears it, so this cap guards a dead-zone stretch, not the normal case. PHASE 63 made
 * the shift cadence a fixed ~60 s even when stationary (`distanceInterval: 0`), so the old 240 would have
 * held only ~4 h — a 5× drop from before. Raised to 720 (~12 h at one fix a minute) so a long offline
 * shift keeps far more of its early legs. Safe on Android (SharedPreferences has no hard value-size
 * limit, verified 2026-08-19); a >12 h continuous-offline shift still evicts the oldest and would need
 * upload chunking (follow-up), and iOS's historical ~2 KB Keychain limit is moot until iOS ships.
 *
 * PHASE 78: the cadence is now HOURLY, so 720 is far more headroom than the "~12 h" above describes —
 * it is now weeks of offline points, and eviction is effectively unreachable. Left at 720 ON PURPOSE:
 * this is a CAP, it costs nothing until a device is genuinely offline for days, and lowering it could
 * only ever discard route data that was successfully captured. Do not "right-size" it.
 */
const MAX_POINTS = 720;

/** `[lat, lng, epochMs, accuracy, speed, heading]` — compact because it is re-serialised on every fix. */
type PointTuple = [number, number, number, number | null, number | null, number | null];

type Persisted = {
  v: 1;
  /** Attendance session this route belongs to. */
  sid?: string;
  /**
   * Epoch ms of the clock-in that opened `sid`, so `ingest` can split a straddling batch at the
   * boundary (release audit 2026-08-29, `boundaryAttribution.ts`): a 24/7-armed member's points
   * recorded BEFORE this instant are off-duty (ambient), not shift. Absent ⇒ boundary unknown ⇒
   * everything attributes to the shift (the exact pre-audit behaviour).
   */
  sidStartedAt?: number;
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
          sidStartedAt: Number(p.sidStartedAt) > 0 ? Number(p.sidStartedAt) : undefined,
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
  //
  // `signed-out` comes back for a 401 as well as for an absent token: in a headless context
  // nothing is subscribed to `expireSession`, so the dead token stays in storage and the check
  // above cannot see it. Both mean the same thing here — this service can no longer upload.
  const res = await api.postTrackPoints(toPoints(pts), sid).catch(() => null);
  if (!res) return 'retry';
  return res.outcome === 'no-session' ? 'unattributable' : res.outcome;
}

/* ------------------------------------------------------------------ 24/7 (PHASE 41) */

/** Local calendar date as YYYY-MM-DD so the server keys `ambient:<uid>:<date>` correctly across midnight. */
function localDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * True when this install has consented to 24/7 (off-duty) recording. Read fresh from storage — NOT a
 * module flag — everywhere the attribution branch decides, because a headless wake gets a new JS
 * context and the OS can invoke the task before a once-per-start hydration resolves; a stale `false`
 * there would misread a consented ambient batch as unattributable and tear the service down.
 */
async function ambientArmed(): Promise<boolean> {
  return (await storage.get(AMBIENT_KEY)) === '1';
}

/**
 * The neutral 24/7 foreground-service notification, RESOLVED to the user's language at arm time and
 * read back here. A headless service restart (41b boot-receiver) has no i18n context, so the strings
 * are captured when 24/7 is armed, not resolved now. Falls back to a neutral English default.
 */
async function readNotif(): Promise<Notif> {
  try {
    const raw = await storage.get(NOTIF_KEY);
    if (raw) {
      const n = JSON.parse(raw);
      if (n && typeof n.title === 'string' && typeof n.body === 'string') return { title: n.title, body: n.body };
    }
  } catch {
    // Corrupt JSON: use the neutral default rather than start the service with no notification.
  }
  return AMBIENT_NOTIF_FALLBACK;
}

async function writeNotif(n: Notif): Promise<void> {
  await storage.set(NOTIF_KEY, JSON.stringify({ title: n.title, body: n.body }));
}

/**
 * Off-duty (ambient) sibling of `deliver`. Same token rehydration — a headless context has no token
 * and `postAmbientPoints` short-circuits `sent` when the session is not real, so without this the
 * buffer would be cleared having sent nothing. The date is the LOCAL calendar day so the server's
 * `ambient:<uid>:<date>` key is right across midnight. `consent-required` (403) means consent was
 * withdrawn server-side; the caller stops 24/7 and drops the buffer (that withdrawal already reached
 * the master, PHASE-41 §5).
 */
async function deliverAmbient(pts: PointTuple[]): Promise<api.AmbientDelivery> {
  if (!pts.length) return 'sent';
  if (!api.isRealSession()) {
    const token = await storage.get(TOKEN_KEY);
    if (!token) return 'signed-out';
    api.setAuthToken(token);
    // A demo token has no server behind it. Report success so the buffer does not grow forever.
    if (!api.isRealSession()) return 'sent';
  }
  const res = await api.postAmbientPoints(toPoints(pts), localDate()).catch(() => null);
  if (!res) return 'retry';
  return res.outcome;
}

/* ------------------------------------------------------------------ motion classifier (PHASE 41c) */

/**
 * The accelerometer classifier runs only while JS is alive (foreground; sensors pause in the
 * background). Its rolling window lives in MODULE state — fine, because it never has to survive a
 * headless wake: only CONFIRMED transitions are persisted to `track.motion`, and that persisted state
 * is what the headless location (re)start reads. So the classifier's whole job is to keep that state
 * current whenever the app is open. LIMIT (honest): because sensors pause in the background, a pocketed
 * phone is not reclassified, so `still` rarely activates in the field — true background adaptivity
 * needs the native Activity Recognition source (§4, option 3). This is the §12.8 lever to MEASURE first.
 */
let accelSub: { remove: () => void } | null = null;
let motionSamples: { x: number; y: number; z: number }[] = [];
let motionState: MotionState = 'moving'; // safe default until the first confident reading
let motionStreak = 0;

/** Persist a committed motion transition, stamped so `resolveMotion` can age out a stale `still`. */
async function persistMotion(state: MotionState): Promise<void> {
  try {
    await storage.set(MOTION_KEY, JSON.stringify({ state, at: Date.now() }));
  } catch {
    // A missed write just means the next service start keeps the previous (or default) profile.
  }
}

/** Resolve the persisted, freshness-checked motion state for a service (re)start. Defaults to `moving`. */
async function readMotion(): Promise<MotionState> {
  try {
    const raw = await storage.get(MOTION_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && (p.state === 'still' || p.state === 'moving') && typeof p.at === 'number') {
        return resolveMotion(p.state, p.at, Date.now());
      }
    }
  } catch {
    // Corrupt/absent: the denser MOVING profile is always the safe default.
  }
  return 'moving';
}

function onAccel(m: { x: number; y: number; z: number }): void {
  motionSamples.push({ x: m.x, y: m.y, z: m.z });
  if (motionSamples.length < MOTION_WINDOW) return;
  const reading = classifyMotion(motionSamples);
  motionSamples = [];
  const next = debounceMotion(motionState, reading, motionStreak);
  motionStreak = next.streak;
  if (next.changed) {
    // A CONFIRMED transition (survived the debounce). Persist ONLY here — never on every 4 Hz sample —
    // so storage sees a handful of writes a day. The new profile is applied at the next natural service
    // (re)start (clock-in/out, arm, watchdog re-arm); v1 does NOT restart a live service mid-session —
    // that would fight 41b's reliability and flicker the notification for little real gain given the
    // foreground-only limit above. See PHASE-41 §8 (41c).
    motionState = next.state;
    void persistMotion(next.state);
  }
}

/** Begin classifying motion while recording. Idempotent, best-effort, native-only. */
async function startMotionClassifier(): Promise<void> {
  if (!isNative || accelSub) return;
  try {
    // Seed the committed state from storage so a fresh JS context doesn't start at the default and
    // re-flip on the first window.
    motionState = await readMotion();
    motionSamples = [];
    motionStreak = 0;
    Accelerometer.setUpdateInterval(250); // ~4 Hz — enough for a walking cadence, cheap on battery
    accelSub = Accelerometer.addListener(onAccel);
  } catch {
    accelSub = null; // no accelerometer (emulator/unsupported): motion stays the safe MOVING default
  }
}

/** Stop classifying — paired with a real recorder teardown so the sensor never runs without the recorder. */
function stopMotionClassifier(): void {
  try {
    accelSub?.remove();
  } catch {
    // Nothing further we can do.
  }
  accelSub = null;
  motionSamples = [];
  motionStreak = 0;
}

/**
 * Map the motion profile's accuracy string to expo-location's enum. High (~10 m) is the crux of PHASE 63:
 * it is what survives the backend's shift-point `accuracy <= 100 m` drop, so `'high'` must NEVER resolve
 * to Balanced. A `Record` keyed by the union means tsc flags any unmapped accuracy AND a wrong pairing is
 * a single, glaring line rather than a buried `if`. (tracker.ts is device-only — no expo-location stub —
 * so this cannot be unit-tested here; motion.ts pins the profile strings, and this table is the auditable
 * 1:1 translation. See PHASE-63 review, test-quality finding.)
 */
const ACCURACY_ENUM: Record<SamplingProfile['accuracy'], Location.Accuracy> = {
  high: Location.Accuracy.High,
  balanced: Location.Accuracy.Balanced,
  low: Location.Accuracy.Low,
};
function accuracyOf(profile: SamplingProfile) {
  return ACCURACY_ENUM[profile.accuracy];
}

/**
 * PHASE 41b — register the periodic watchdog if it is not already registered. Idempotent (guarded by
 * `isTaskRegisteredAsync`) so re-arming never churns the WorkManager schedule. Best-effort: the
 * watchdog is a reliability booster layered on the foreground service, never a hard requirement, so a
 * device without background-task support still records — it just loses the auto-re-arm.
 */
async function ensureWatchdog(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(WATCHDOG_TASK)) return;
    await BackgroundTask.registerTaskAsync(WATCHDOG_TASK, { minimumInterval: WATCHDOG_INTERVAL_MIN });
  } catch {
    // No background-task scheduler on this device/build: the foreground service still records.
  }
}

/** PHASE 41b — stop the watchdog waking the device. Paired with a real recorder teardown. */
async function retireWatchdog(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(WATCHDOG_TASK)) await BackgroundTask.unregisterTaskAsync(WATCHDOG_TASK);
  } catch {
    // Nothing further we can do from JS.
  }
}

/**
 * Start the ONE background location foreground-service if it is not already running, with the given
 * notification. Extracted from `startTracking` (PHASE-41 §12.1: one unified recorder) so the shift
 * and 24/7 paths share identical sampling options and differ only in the notification wording. A
 * running service is never restarted, so clocking in over a running 24/7 service keeps that service —
 * and its neutral notification — exactly as it was. The watchdog is (re-)ensured on every call
 * (PHASE 41b): registering here, the single place the recorder starts, means the re-arm check exists
 * whenever recording is live, and self-heals a watchdog that somehow went missing.
 */
async function startService(notif: Notif): Promise<void> {
  const already = await Location.hasStartedLocationUpdatesAsync(ROUTE_TASK).catch(() => false);
  if (already) {
    await ensureWatchdog();
    await startMotionClassifier();
    return;
  }
  // PHASE 63: WHICH profile depends on what this service is recording. A shift (a persisted `sid`) gets
  // the aggressive "every point / High" profile; the 24/7 OFF-DUTY ambient recorder (a service running
  // with NO sid) gets the coarser AMBIENT_PROFILE, so consent-based off-duty tracking is not upgraded to
  // continuous ~10 m home recording (privacy) or an always-hot GPS radio (battery). Within a shift the
  // motion classifier still chooses (currently neutralised — STILL == MOVING — pending an owner battery
  // lock). Applied only at (re)start — the reliability-safe point to change GPS options (a live service
  // can't be reconfigured without a stop+start, which would fight 41b and flicker the notification), so a
  // 24/7-armed user who clocks in over an already-running ambient service keeps the ambient profile until
  // the next genuine restart (documented limitation; the common non-24/7 path tears down on clock-out and
  // starts fresh on clock-in).
  const { sid } = await readState();
  const profile = sid ? samplingProfile(await readMotion()) : AMBIENT_PROFILE;
  await Location.startLocationUpdatesAsync(ROUTE_TASK, {
    // Accuracy + cadence come from the profile above. On the shift path: High accuracy +
    // distanceInterval 0, so a point lands on the time interval even when the phone is stationary and
    // each fix is precise enough to survive the backend's shift-point >100 m drop. PHASE 78 made that
    // time interval HOURLY (owner-locked, see `motion.ts` HOURLY_MS) — it was 60 s under PHASE 63.
    accuracy: accuracyOf(profile),
    timeInterval: profile.timeInterval,
    // distanceInterval 0 records on the time interval even when stationary. `timeInterval` throttles that
    // ON ANDROID ONLY; iOS ignores `timeInterval`, so 0 there would firehose fixes at the GPS's
    // native rate (battery/data). Keep a non-zero iOS distance filter (restores the pre-63 iOS behaviour;
    // iOS background is a separate Phase-56 effort). `x || 30` only rewrites a 0 → 30.
    distanceInterval: isAndroid ? profile.distanceInterval : profile.distanceInterval || 30,
    deferredUpdatesInterval: profile.deferredUpdatesInterval,
    // The service can restart in the background, where a settings dialog would be both impossible and
    // alarming. `ensureBackgroundPermission` is where the user is told that location is switched off.
    mayShowUserSettingsDialog: false,
    // iOS: without these the OS pauses updates the moment it decides the user is stationary, and the
    // route ends up with holes.
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    // Android: no foreground service means the OS kills the process. The wording is passed in so the
    // shift path reads "Recording your field route" and the 24/7 path reads the neutral consented copy.
    foregroundService: {
      notificationTitle: notif.title,
      notificationBody: notif.body,
      // Brand azure. Hardcoded because the theme is a React hook and the OS restarts this service in
      // contexts where no provider exists.
      notificationColor: '#3182ed',
      // The recording outlives the app window: swiping the app away must not silently end it. Only
      // clock out (shift) or consent withdrawal (24/7) does that.
      killServiceOnDestroy: false,
    },
  });
  // PHASE 41b: the recorder is now live — arm the watchdog that keeps it alive through OEM kills and
  // reboots. After `startLocationUpdatesAsync` so a failed start never leaves a watchdog with nothing
  // to guard (that call throws on a mis-provisioned service and this line is skipped).
  await ensureWatchdog();
  // PHASE 41c: keep the motion classifier running alongside the recorder (idempotent, foreground-only).
  await startMotionClassifier();
}

/**
 * Tear the OS service down. Deliberately not wrapped in `serial` so it can be called from
 * inside an already-serialised block.
 */
async function stopUpdates(): Promise<void> {
  running = false;
  // PHASE 41b: this is a genuine teardown (clock-out without 24/7, consent withdrawal, sign-out, or
  // the unattributable case) — every caller of stopUpdates is stopping the recorder for real, so the
  // watchdog must retire too, otherwise it would wake and re-arm what we just tore down. The armed
  // clock-out path keeps recording and does NOT call stopUpdates, so ambient's watchdog survives.
  await retireWatchdog();
  // PHASE 41c: the recorder is gone — stop the accelerometer too so it never runs on its own.
  stopMotionClassifier();
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

/**
 * PHASE 41b — the watchdog task, defined at module scope so a headless wake (WorkManager, including
 * the post-reboot restore) finds it registered. Runs every ~15 min: it re-arms the recorder if the
 * OS killed it, leaves it alone if healthy, or retires itself when there is nothing left to record.
 */
if (!TaskManager.isTaskDefined(WATCHDOG_TASK)) {
  TaskManager.defineTask(WATCHDOG_TASK, async () => {
    try {
      await serial(watchdogTick);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      // A failed tick must not disable the schedule; WorkManager retries at the next interval.
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/**
 * PHASE 71 — how long a single forced fix may take before the watchdog gives up on it. A background
 * WorkManager tick has a bounded execution window, and `getCurrentPositionAsync` has no timeout of its
 * own, so an indoor / cold-GPS fix that never arrives must not hang the serial chain for the whole
 * window. On timeout we skip this tick and the next one (~15 min later) retries.
 */
const FORCED_FIX_TIMEOUT_MS = 30 * 1000;

/** Resolve `p`, or reject after `ms`. Keeps a hang-prone native call from stalling the watchdog. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * PHASE 71 — take ONE location fix right now and feed it through `ingest`, so a live shift or 24/7
 * session that the OS location stream has starved (Doze / OEM battery-kill) still records a point
 * within the ceiling. Best-effort and bounded — a fix that does not arrive inside
 * `FORCED_FIX_TIMEOUT_MS` is abandoned and the next tick retries. Reusing `ingest` (not a bespoke
 * post) means de-dup, mock-drop, shift/ambient attribution and delivery all stay in the ONE honest
 * write path — the forced point is treated exactly like an OS-delivered one.
 *
 * ACCURACY MATCHES THE SESSION, not a constant. A live SHIFT wants High (~10 m) so the fix survives
 * the backend's shift-point >100 m drop. An off-duty AMBIENT session (no shift sid) must stay on the
 * COARSE profile (Balanced ~100 m): ambient points are NOT distance-dropped server-side, so High buys
 * nothing, and a forced High fix while the phone sits at home would store a ~10 m home coordinate
 * roughly hourly under Doze — the exact "continuous ~10 m home recording" escalation `AMBIENT_PROFILE`
 * exists to avoid (loophole audit round 3, 2026-08-25).
 */
async function captureForcedPoint(hasShift: boolean): Promise<void> {
  const accuracy = hasShift ? Location.Accuracy.High : Location.Accuracy.Balanced;
  let loc: Location.LocationObject | null = null;
  try {
    loc = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy }),
      FORCED_FIX_TIMEOUT_MS,
    );
  } catch {
    return; // no fix in the window (indoors, GPS cold, timeout) — the next watchdog tick retries
  }
  if (!loc) return;
  await ingest([loc]);
}

/**
 * One watchdog check. Reads intent from persisted storage (a fresh headless context has no module
 * state), asks the OS whether the service is actually running, and acts on the pure decision
 * (`watchdogAction`). Runs inside `serial` so it cannot race a concurrent location-batch ingest.
 */
async function watchdogTick(): Promise<void> {
  const armed = await ambientArmed();
  const state = await readState();
  const isRunning = await Location.hasStartedLocationUpdatesAsync(ROUTE_TASK).catch(() => false);
  const action = watchdogAction({ armed, hasShift: !!state.sid, running: isRunning });
  if (action === 'retire') {
    // Neither a shift nor 24/7 is active. Nothing to guard — stop waking the device (§3 battery), and
    // record nothing: there is no session to attribute a forced point to. A stray service still
    // running here is torn down by the next `ingest`, which owns dropping the unattributable buffer
    // safely; the watchdog only stops watching.
    await retireWatchdog();
    return;
  }
  if (action === 'rearm') {
    // Killed by the OS or lost to a reboot. Bring the recorder back with the neutral, pre-resolved
    // notification — a headless restart has no i18n context (§12.4). Attribution resumes on its own:
    // `ingest` reads `state.sid` at flush time, so the re-armed service posts to the open shift if
    // there is one, otherwise as ambient.
    await startService(await readNotif());
    running = true;
  }
  // PHASE 71 — recording SHOULD be live now (action was 'idle' or we just re-armed). The OS location
  // stream is best-effort: under Doze it can be starved for far longer than the requested cadence,
  // leaving a long flat gap in the route. If the newest recorded point is stale, take one fix now so a
  // live shift never goes a full hour without a point. The trigger sits a whole watchdog interval below
  // the 60-min ceiling (`staleBuffer.ts`), so a point missed at one tick is still caught within the
  // hour at the next. HONEST CEILING: WorkManager is itself Doze-deferred, so this is best-effort, not
  // a hard real-time guarantee.
  //
  // PHASE 78 CHANGED WHAT THIS IS. At a 60 s cadence this was a rare BACKSTOP for a starved stream. Now
  // that the cadence is hourly and `STALE_AFTER_MS` is 45 min, the staleness trigger fires BEFORE a
  // healthy hourly stream delivers, so this forced fix becomes a routine, often PRIMARY, source of
  // route points. That is benign — `ingest` de-dupes and treats a forced point exactly like an
  // OS-delivered one — but it means the real-world cadence is ~45-60 min driven from here, not 60 min
  // driven by the OS, and battery profiling should attribute the cost to this path, not to the stream.
  if (isBufferStale(state.lastAt, Date.now())) {
    await captureForcedPoint(!!state.sid);   // High for a live shift, coarse Balanced for ambient
  }
}

/** Body of the location task. Runs inside `serial`, so it owns the persisted state exclusively. */
async function ingest(locations: Location.LocationObject[]): Promise<void> {
  const state = await readState();
  let lastAt = state.lastAt;

  // PHASE 41d anti-circumvention (§5): drop OS-flagged mock-provider fixes so a fake-GPS app cannot
  // spoof a location into the record. A spoofer's points vanish here and therefore surface as a
  // coverage GAP to the backend silent-user detector ([api], filed) — transparent, never fabricated.
  const real = dropMocked(locations);
  for (const loc of real) {
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

  // Attribution by the session id at flush time (PHASE-41 §12.1). A shift `sid` present ⇒ the batch is
  // the shift's (unchanged). Absent + 24/7 armed ⇒ off-duty ambient. Absent + NOT armed ⇒ the PHASE 7
  // unattributable case (a service running with no shift and no consent) → tear it down.
  if (state.sid) {
    // RELEASE AUDIT 2026-08-29 — split the batch at the clock-in instant so a 24/7-armed member's
    // pre-clock-in OFF-DUTY points are not filed under the shift (`boundaryAttribution.ts`). With
    // hourly sampling a batch can hold up to an hour of off-duty movement plus the first shift points;
    // attributing the whole batch by `sid` filed that movement under the shift. When `sidStartedAt` is
    // unknown (0 — a non-24/7 shift clears its buffer at clock-in so it holds no pre-clock-in points, or
    // a shift resumed from before this field existed) the split returns everything as shift, i.e. the
    // exact pre-audit behaviour — so this is a no-op for every non-24/7 user.
    const { shift, preShift } = partitionShiftPoints(state.pts, state.sidStartedAt ?? 0, (t) => t[2]);
    const outcome = await deliver(state.sid, shift);
    if (outcome === 'signed-out' || outcome === 'unattributable') {
      // `signed-out`: the account was signed out while the service kept running. `unattributable`
      // (PHASE 7): a running service with no session id collects location for nobody and, if posted,
      // would resolve the owner from whichever token is on the handset — one person's route landing
      // on another's day. Either way, drop everything and stop.
      await storage.remove(STATE_KEY);
      await stopUpdates();
      return;
    }
    // The pre-clock-in points are OFF-DUTY. Post them to ambient when 24/7 is armed; otherwise a
    // non-consented user has no ambient dataset for them, so they are dropped. An ambient result here
    // (consent-required, refused, sent) must NOT tear down the live shift — the shift is validly
    // attributed on its own basis (the employee clocked in); only a lost account (`signed-out`) stops it.
    let preShiftRetry = false;
    if (preShift.length && (await ambientArmed())) {
      const amb = await deliverAmbient(preShift);
      if (amb === 'signed-out') {
        await storage.remove(STATE_KEY);
        await stopUpdates();
        return;
      }
      preShiftRetry = amb === 'retry';
    }
    // Rebuild the buffer from only what must be retried; everything sent/refused/dropped is gone.
    // Pre-shift points are older, so they lead — keeping the buffer in chronological order.
    const keepShift = outcome === 'retry' ? shift : [];
    const keepPreShift = preShiftRetry ? preShift : [];
    state.pts = keepPreShift.length || keepShift.length ? [...keepPreShift, ...keepShift] : [];
  } else if (await ambientArmed()) {
    const outcome = await deliverAmbient(state.pts);
    if (outcome === 'sent' || outcome === 'refused') state.pts = [];
    if (outcome === 'consent-required') {
      // Consent was withdrawn on the server (Phase 43 already notified the master, §5). Stop the 24/7
      // recorder entirely and drop the buffer — no un-consented recording may continue.
      await storage.remove(STATE_KEY);
      await storage.remove(AMBIENT_KEY);
      await stopUpdates();
      return;
    }
    if (outcome === 'signed-out') {
      await storage.remove(STATE_KEY);
      await stopUpdates();
      return;
    }
    // `retry` ⇒ keep the buffer; the service stays and the next wake retries.
  } else {
    // NOT armed and no session id: the exact PHASE 7 unattributable case, preserved — a service
    // running with no shift and no consent has nothing it may post. Drop everything and stop.
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

    // Battery-optimisation exemption (PHASE-41 §12.2/§12.3). Android only, best-effort, NON-BLOCKING:
    // it must never flip `granted`. A phone that keeps the app battery-optimised has its foreground
    // service killed by aggressive Doze, so we ask the OS to exempt it. Fired at most once per install
    // (a persisted flag) so it does not re-prompt on every clock-in. JS cannot read whether the
    // exemption was accepted — no PowerManager binding — so a native reporter is left for 41b/41d.
    if (Platform.OS === 'android') {
      const asked = await storage.get(BATTOPT_KEY);
      if (asked !== '1') {
        await storage.set(BATTOPT_KEY, '1'); // once, whatever the user chooses — no nagging
        try {
          // Android-only (guarded above). The native module resolves to `{}` on web/iOS so the import
          // is safe everywhere; `startActivityAsync` throws UnavailabilityError if ever reached off
          // Android, which this try/catch would swallow anyway.
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            { data: 'package:com.cgpe.connect' },
          );
        } catch {
          // The activity may be unavailable, or the permission missing on an older build — never fail
          // the permission grant over the battery-opt booster.
        }
      }
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

      const armed = await ambientArmed();
      const state = await readState();

      if (!armed) {
        // NOT consented to 24/7 — today's exact shift-only behaviour, unchanged. A new shift must
        // never inherit the previous shift's undelivered points, which on a shared handset could
        // belong to a different person entirely; points survive only when the session id is
        // byte-identical, i.e. this is a genuine resume.
        if (state.sid !== sid) {
          state.pts = [];
          state.lastAt = 0;
          state.sidStartedAt = Date.now();   // clock-in instant → the boundary `ingest` splits on
        }
        state.sid = sid;
        await writeState(state);
        await storage.remove(LEGACY_SESSION_KEY);
        api.startTrack(sid).catch(() => {});
        await startService(SHIFT_NOTIF);
        running = true;
        return;
      }

      // 24/7 armed (PHASE-41 §12.1): clocking in only BEGINS shift attribution — the recorder is
      // already running in ambient mode. Keep its buffer and keep the neutral 24/7 notification —
      // `startService` no-ops on the already-running service.
      //
      // ⚠️ PHASE 78 WIDENED THE ATTRIBUTION SLOP FROM ~60 s TO UP TO AN HOUR, and this is the one
      // place that materially changes. A batch straddling the clock-in boundary is attributed whole,
      // by `state.sid` at FLUSH time, so with an hourly cadence a fix taken up to an hour BEFORE the
      // advisor clocked in can now land inside the shift (and the reverse at clock-out). That was an
      // accepted one-minute rounding error before; it is now potentially a whole hour of off-duty
      // movement filed under a shift. Flagged to the owner as a consequence of the hourly lock — the
      // fix, if it is ever judged to matter, is to split the buffer at the boundary timestamp rather
      // than attributing the batch as a unit. NOT done here: it is a behaviour change nobody asked
      // for, and doing it silently inside a cadence change is how a subtle data bug gets shipped.
      if (state.sid !== sid) state.sidStartedAt = Date.now();   // clock-in instant → the boundary `ingest` splits on
      state.sid = sid;
      await writeState(state);
      await storage.remove(LEGACY_SESSION_KEY);
      api.startTrack(sid).catch(() => {});
      await startService(await readNotif());
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
    if (!(await ambientArmed())) {
      // NOT consented to 24/7 — today's exact behaviour: flush the last points, tear the service
      // down, clear the buffer.
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
      return;
    }

    // 24/7 armed (PHASE-41 §12.1): clocking out ENDS shift attribution but the recorder keeps running
    // in ambient mode. Flush the shift's last points, seal the shift server-side, and drop the shift
    // id so subsequent batches post as ambient — but LEAVE the service and its notification up.
    try {
      const state = await readState();
      if (state.pts.length && state.sid) {
        const outcome = await deliver(state.sid, state.pts);
        // Sent/refused: clear. Retry (dead zone): keep — the next ambient flush sends them, a few
        // shift points landing as off-duty (the accepted boundary slop, §12.1), which beats dropping.
        if (outcome === 'sent' || outcome === 'refused') state.pts = [];
      }
      if (state.sid) await api.stopTrack(state.sid).catch(() => {});
      state.sid = undefined;
      state.sidStartedAt = undefined;   // shift closed — retire the boundary with its sid
      await writeState(state);
    } catch {
      // Non-fatal: the recorder stays in ambient mode regardless.
    }
    // `running` stays true — ambient recording continues past clock-out.
  });
}

/**
 * Arm 24/7 (off-duty) recording after the user grants consent (PHASE-41 §12.2). Idempotent and
 * best-effort; it never throws.
 *
 * `prompt:true` is the consent-grant tap — it runs the full permission ladder
 * (`ensureBackgroundPermission`, now including the battery-opt step) and only arms if background
 * permission is actually granted. `prompt:false` is a boot / already-granted user — it NEVER prompts
 * on a cold start and arms only if background permission is already held. `notif` is the RESOLVED
 * (translated) 24/7 notification, persisted so a later headless restart can read it (§12.4).
 *
 * The permission flow runs OUTSIDE the serial lock — it can open system dialogs and take seconds, and
 * must not block location-batch ingest that also serialises on the persisted state.
 */
export async function startAmbientTracking({ prompt, notif }: { prompt: boolean; notif?: Notif }): Promise<void> {
  if (!isNative) return;
  if (notif) await writeNotif(notif);

  let ok: boolean;
  if (prompt) {
    ok = (await ensureBackgroundPermission()).granted;
  } else {
    const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
    ok = !!bg?.granted;
  }
  if (!ok) return; // never arm 24/7 without background permission

  await serial(async () => {
    try {
      await storage.set(AMBIENT_KEY, '1');
      await startService(await readNotif());
      running = true;
    } catch {
      running = await Location.hasStartedLocationUpdatesAsync(ROUTE_TASK).catch(() => false);
    }
  });
}

/**
 * Disarm 24/7 recording — on consent withdrawal or sign-out (PHASE-41 §12.2). Flushes any buffered
 * OFF-DUTY points best-effort (a shift's points are the shift's to seal, not ours to post as ambient),
 * tears the service down, and clears the persisted 24/7 state.
 */
export async function stopAmbientTracking(): Promise<void> {
  if (!isNative) return;
  await serial(async () => {
    try {
      const state = await readState();
      if (state.pts.length && !state.sid) await deliverAmbient(state.pts);
      await stopUpdates();
    } catch {
      // Fall through: the cleanup below must happen either way.
    }
    running = false;
    await storage.remove(STATE_KEY);
    await storage.remove(AMBIENT_KEY);
  });
}

/**
 * PHASE 41d §5 — the consent-withdrawal signal. Called on app foreground: if a consented 24/7 user has
 * had the OS background-location permission revoked (they turned it off in Settings), treat that as a
 * withdrawal — POST consent=false so the server notifies every master (a loud, transparent opt-out) and
 * stop the recorder. Best-effort, never throws, native-only.
 *
 * SAFE AGAINST FALSE ALARMS: it fires only for an `armed` (consented) user; a FAILED permission read is
 * skipped (never signals on uncertainty, so a transient error can't spam masters); and `stopAmbientTracking`
 * clears the armed flag, so a real revocation fires the master alert exactly once, not on every foreground.
 */
export async function syncConsentWithPermission(): Promise<void> {
  if (!isNative) return;
  if (!(await ambientArmed())) return; // only a consented 24/7 user can withdraw
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (!bg) return; // could not read the permission — never signal a withdrawal on an uncertain read
  if (!shouldSignalWithdrawal({ armed: true, bgGranted: bg.granted })) return;
  await api.setLocationConsent(false).catch(() => {}); // Phase 43: notifies every super_admin
  await stopAmbientTracking(); // clears AMBIENT_KEY → this fires once per revocation, and stops recording
}

/**
 * PHASE 41d §5 — the app-block evaluation. Reads the live OS location state for a consented 24/7
 * user and returns the pure `locationBlockReason` (services_off / foreground_denied /
 * background_denied / null). Native + consented (`armed`) only.
 *
 * FAIL-OPEN, on purpose: any read error resolves `null`, so a transient permission-read failure can
 * never trap staff behind the block screen — the same safety posture as `needsConsentGate` and
 * `syncConsentWithPermission` (never act against the user on an uncertain read).
 *
 * COMPOSITION WITH THE WITHDRAWAL SIGNAL (spec-literal, owner-chosen 2026-08-15): a REVOKED background
 * permission is owned by `syncConsentWithPermission` (withdrawal → every master notified + disarm),
 * which clears the armed flag — so once that has run this returns `null` for the permission case and
 * the block clears. The block screen therefore lands durably on device-Location-OFF (services), while
 * permission revocation routes through the loud withdrawal path + the /consent wall on the next open.
 */
export async function evaluateLocationBlock(): Promise<BlockReason> {
  if (!isNative) return null;
  try {
    if (!(await ambientArmed())) return null; // only a consented 24/7 user is ever blocked
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return locationBlockReason({
      armed: true,
      servicesEnabled,
      fgGranted: fg.granted,
      bgGranted: bg.granted,
    });
  } catch {
    return null; // uncertain read → never block
  }
}

/**
 * PHASE 41d §5 — open the settings page that lets the user clear the block. `services_off` is the
 * system Location on/off toggle, so it opens LOCATION_SOURCE_SETTINGS (Android); a permission denial
 * lives on this app's details page, so `Linking.openSettings()` (both platforms — Android app info →
 * Permissions, iOS the app's Settings pane). Best-effort: a missing activity or OEM quirk is swallowed
 * so it can never throw into the block overlay — the user can still reach settings by hand.
 */
export async function openLocationSettings(reason: BlockReason): Promise<void> {
  if (!isNative) return;
  try {
    if (Platform.OS === 'android' && reason === 'services_off') {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS);
      return;
    }
    await Linking.openSettings();
  } catch {
    // Activity unavailable / rejected — never fail the block screen over the settings shortcut.
  }
}

/** True if the background route service is currently running. */
export function isTracking(): boolean {
  return running;
}
