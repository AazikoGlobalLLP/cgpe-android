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
 *
 * ⚠️ NUMBERS. The spec fixes none of these, so they are PROPOSED DEFAULTS pending an owner lock, and
 * every one is a single named constant so tuning is a one-line change. The threshold is derived from
 * accelerometer physics (still noise ≈ 0.02 g, walking ≫ 0.1 g); the STILL time interval is the one
 * GPS-behaviour number the owner should confirm against a real battery measurement (§3 gate).
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
  /** 'balanced' ≈ ~100 m (usable point); 'low' would be km-level, too coarse to keep — so both use balanced. */
  accuracy: 'balanced' | 'low';
  /** Min ms between location checks. */
  timeInterval: number;
  /** Min metres of movement before a fix is delivered — already suppresses fixes when stationary. */
  distanceInterval: number;
  /** Batching window for deferred delivery. */
  deferredUpdatesInterval: number;
};

/** MOVING = today's single profile, unchanged — the safe default the recorder has always used. */
export const MOVING_PROFILE: SamplingProfile = {
  accuracy: 'balanced',
  timeInterval: 60000,
  distanceInterval: 30,
  deferredUpdatesInterval: 60000,
};

/**
 * STILL = check five times less often when stationary. ONLY the time intervals lengthen: accuracy and
 * distanceInterval stay identical to MOVING so the fixes we still take remain usable and a real move
 * is caught by distance immediately. `timeInterval`/`deferredUpdatesInterval` 300000 is the one number
 * the owner should confirm against the §3 battery measurement.
 */
export const STILL_PROFILE: SamplingProfile = {
  accuracy: 'balanced',
  timeInterval: 300000,
  distanceInterval: 30,
  deferredUpdatesInterval: 300000,
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
