/**
 * PHASE 41c — motion-adaptive GPS sampling, decision half. PURE (no native imports) so the tuning
 * and — more importantly — the FAIL-SAFE rules are pinned by a test; `tracker.ts` wires the
 * accelerometer + applies the chosen profile but is itself device-only (no expo-sensors /
 * expo-location stub — see `test/stubs/`). Same pure-seam pattern as `watchdog.ts` / `theme/density.ts`.
 *
 * WHY THE ACCELEROMETER (PHASE-41 §4). Each accelerometer sample is `{x,y,z}` in g. The MAGNITUDE
 * sqrt(x²+y²+z²) is rotation-invariant: gravity contributes ~1g however the phone is held, so the
 * spread (std-dev) of the magnitude over a short window is real movement, not orientation. Still =
 * spread near the sensor noise floor; walking/driving = a clearly larger spread. This is a coarse
 * still-vs-moving signal, NOT the still/walking/driving that Google's Activity Recognition gives —
 * that tier needs the native module (§4, deliberately not taken here).
 *
 * WHAT THE MOTION STATE IS FOR (§3). "Sparse when still, denser when moving." A stationary phone
 * needs GPS to wake far less often; a moving one needs the normal cadence to draw a usable route.
 * ⚠️ PHASE 63 (2026-08-19, owner #1): this economy is currently NEUTRALISED — `STILL_PROFILE` is now
 * identical to `MOVING_PROFILE` — because the owner requires EVERY point retained (the old "sparse when
 * still" behaviour was a root cause of the reported no-points/straight-line bug). The classifier still
 * runs and persists its state, so re-enabling the economy is a one-line STILL_PROFILE re-tune once the
 * owner locks a battery number.
 *
 * ⚠️ NUMBERS. The spec fixes none of these, so they are PROPOSED DEFAULTS pending an owner lock, and
 * every one is a single named constant so tuning is a one-line change. The threshold is derived from
 * accelerometer physics (still noise ≈ 0.02 g, walking ≫ 0.1 g); the accuracy/always-on-60 s battery
 * cost (PHASE 63) is the GPS-behaviour tradeoff the owner should confirm against a real measurement (§3).
 */

export type MotionState = 'still' | 'moving';

/** Std-dev of accelerometer magnitude above which the window reads as movement (g). Derived, tunable. */
export const MOTION_STDDEV_THRESHOLD_G = 0.05;
/** Samples per classification window. At ~4 Hz this is ~3 s — long enough to see a walking cadence. */
export const MOTION_WINDOW = 12;
/** Consecutive differing readings required before the committed state flips (anti-churn hysteresis). */
export const MOTION_DEBOUNCE = 3;
/**
 * How long a `still` reading stays trustworthy (ms). The accelerometer classifier only runs while JS
 * is alive (foreground); a `still` older than this is treated as `moving` so a stale reading can never
 * make us UNDER-sample and lose a route. `moving` never expires — the safe direction never goes stale.
 */
export const MOTION_FRESH_MS = 5 * 60 * 1000;

/** Sampling knobs handed to `Location.startLocationUpdatesAsync` (the constant options stay in tracker). */
export type SamplingProfile = {
  /**
   * 'high' ≈ ~10 m — survives the backend's `accuracy <= 100 m` shift-point drop; 'balanced' ≈ ~100 m
   * sits ON that drop edge (often discarded server-side); 'low' would be km-level, too coarse to keep.
   */
  accuracy: 'high' | 'balanced' | 'low';
  /** Min ms between location checks. */
  timeInterval: number;
  /** Min metres of movement before a fix is delivered. `0` = deliver on the time interval even when stationary. */
  distanceInterval: number;
  /** Batching window for deferred delivery. */
  deferredUpdatesInterval: number;
};

/**
 * MOVING — the always-on recorder profile (PHASE 63, 2026-08-19 owner #1 "capture every point").
 * `distanceInterval: 0` so a fix is delivered every `timeInterval` even when the phone is stationary —
 * the old `30` recorded NOTHING until the user moved 30 m (a root cause of the reported no-points bug).
 * `accuracy: 'high'` (~10 m) so each fix survives the backend's `accuracy <= 100 m` shift-point filter
 * that was silently dropping the coarser Balanced fixes. The battery cost of High + always-on 60 s is
 * the owner's flagged open question — dial it back here once they lock a number.
 */
export const MOVING_PROFILE: SamplingProfile = {
  accuracy: 'high',
  timeInterval: 60000,
  distanceInterval: 0,
  deferredUpdatesInterval: 60000,
};

/**
 * STILL — motion adaptivity is NEUTRALISED (PHASE 63): this profile is now identical to MOVING. The
 * old "sparse when still" economy both stretched the cadence to 5 min AND (via `distanceInterval: 30`)
 * recorded nothing while stationary — exactly the gap the owner reported — so it directly conflicts with
 * owner #1 ("retain every point"). The 41c classifier still runs and persists its state; keeping this
 * constant (rather than deleting the mechanism) means a future owner-locked battery phase re-tunes the
 * economy in one line and the classifier becomes meaningful again. See PHASE-63 / DECISIONS 2026-08-19.
 */
export const STILL_PROFILE: SamplingProfile = {
  accuracy: 'high',
  timeInterval: 60000,
  distanceInterval: 0,
  deferredUpdatesInterval: 60000,
};

export function samplingProfile(state: MotionState): SamplingProfile {
  return state === 'still' ? STILL_PROFILE : MOVING_PROFILE;
}

/** Population std-dev of the sample magnitudes (g). 0 for <2 samples — the caller treats that as "no read". */
export function magnitudeStdDev(samples: { x: number; y: number; z: number }[]): number {
  if (samples.length < 2) return 0;
  const mags = samples.map((s) => Math.hypot(s.x, s.y, s.z));
  const mean = mags.reduce((a, b) => a + b, 0) / mags.length;
  const variance = mags.reduce((a, m) => a + (m - mean) ** 2, 0) / mags.length;
  return Math.sqrt(variance);
}

/**
 * Classify a window. `null` when there are too few samples to decide (the caller keeps the current
 * committed state rather than guessing). At/above the threshold ⇒ `moving`, below ⇒ `still`.
 */
export function classifyMotion(
  samples: { x: number; y: number; z: number }[],
  threshold = MOTION_STDDEV_THRESHOLD_G,
): MotionState | null {
  if (samples.length < 2) return null;
  return magnitudeStdDev(samples) >= threshold ? 'moving' : 'still';
}

/**
 * Hysteresis reducer. A reading that differs from the committed state must repeat `needed` times in a
 * row before the state flips — so a single blip never restarts the recorder. A `null` reading (no
 * data) resets the streak and holds the state. Returns `changed:true` only on the flip.
 */
export function debounceMotion(
  committed: MotionState,
  reading: MotionState | null,
  streak: number,
  needed = MOTION_DEBOUNCE,
): { state: MotionState; streak: number; changed: boolean } {
  if (reading == null || reading === committed) return { state: committed, streak: 0, changed: false };
  const next = streak + 1;
  if (next >= needed) return { state: reading, streak: 0, changed: true };
  return { state: committed, streak: next, changed: false };
}

/**
 * Fail-safe resolution of a persisted reading at use time. `still` is honoured only if fresh; a stale
 * `still` (classifier paused in background longer than `freshMs`) resolves to `moving` so we never
 * under-sample on an out-of-date reading. `moving` is always returned as-is (the safe direction).
 */
export function resolveMotion(
  state: MotionState,
  at: number,
  now: number,
  freshMs = MOTION_FRESH_MS,
): MotionState {
  if (state === 'moving') return 'moving';
  return now - at <= freshMs ? 'still' : 'moving';
}
