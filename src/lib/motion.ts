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
 * ⚠️ PHASE 63 (2026-08-19, owner #1): on the CLOCKED-IN shift path this economy is NEUTRALISED —
 * `STILL_PROFILE` equals `MOVING_PROFILE` — because the owner requires EVERY shift point retained (the
 * old "sparse when still" behaviour was a root cause of the reported no-points/straight-line bug), and
 * the `motion.test.ts` owner-#1 guard LOCKS that (distanceInterval 0 / accuracy 'high' on both).
 * That neutralisation still stands: the two shift profiles remain identical, so the classifier can
 * never make a stationary phone record LESS than a moving one.
 *
 * ⚠️ PHASE 78 (2026-08-26) SUPERSEDED THE CADENCE HALF OF THAT GUARD. The owner asked for hourly
 * sampling to cut battery and mobile-data cost, was shown what it does to route detail, and confirmed.
 * All three profiles are now `HOURLY_MS` (see the constant below for the full decision record); the
 * guard's `timeInterval <= 60000` assertion was replaced with one that pins the hourly value instead.
 *
 * ⚠️ NUMBERS. The spec fixes none of these, so they are PROPOSED DEFAULTS pending an owner lock, and
 * every one is a single named constant so tuning is a one-line change. The threshold is derived from
 * accelerometer physics (still noise ≈ 0.02 g, walking ≫ 0.1 g). The cadence is now owner-locked
 * (Phase 78); the ACCURACY/battery tradeoff is still the one the owner should confirm against a real
 * measurement (§3).
 */

export type MotionState = 'still' | 'moving';

/**
 * PHASE 78 (2026-08-26) — the sampling cadence for EVERY profile, shift and off-duty alike.
 *
 * ⚠️ THIS REVERSES PHASE 63 / OWNER #1, AND THAT WAS THE OWNER'S EXPLICIT CALL, MADE WITH THE
 * TRADE-OFF IN FRONT OF THEM. The request arrived through `contracts/INBOX.md` (2026-08-26,
 * cgpe-api, owner-relayed): every 60 s is too expensive on battery and mobile data, make it hourly.
 * The consequence was put to the owner in writing before anything changed — at 60 min a nine-hour
 * shift records roughly NINE points, so the master live map draws nine straight hops between them,
 * which looks exactly like the "no points / straight line" bug that Phase 63 was written to fix —
 * and the owner chose hourly anyway. It is a cost decision (battery and data for 21 field staff),
 * not an oversight, so the owner-#1 guard below was edited deliberately rather than worked around.
 *
 * WHAT STILL HOLDS after the change, so route quality does not fall further than the cadence alone:
 *   • `distanceInterval` stays 0 on both shift profiles. That is the OTHER half of the Phase-63 fix
 *     and it is untouched — a stationary phone still reports. Gating on movement again is what made
 *     a parked advisor record nothing at all, which is a different and worse failure than sparseness.
 *   • `accuracy` stays 'high' on both, so each fix still survives the backend's `accuracy <= 100 m`
 *     shift-point filter. A coarse fix is not merely imprecise here, it is DISCARDED server-side.
 *   • The 15-min watchdog still forces a fix once the newest point is older than `STALE_AFTER_MS`
 *     (45 min), so the ~60-minute best-effort ceiling in `staleBuffer.ts` now coincides with the
 *     cadence instead of backstopping it. The backend's 3 h `LOCATION_GAP_THRESHOLD_MIN` stays safe.
 *
 * IF THE STRAIGHT-LINE ROUTES ARE REPORTED AGAIN, this constant is the first thing to read: the fix
 * is to lower it, and the guard test records what each value costs.
 */
export const HOURLY_MS = 3600000;

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
 * that was silently dropping the coarser Balanced fixes.
 * PHASE 78: the cadence is `HOURLY_MS`, not the Phase-63 60 s — the owner locked that number knowing
 * it thins a nine-hour shift to ~9 points. `distanceInterval` and `accuracy` are deliberately UNCHANGED,
 * because those two are what stop a stationary or imprecise fix being lost entirely.
 */
export const MOVING_PROFILE: SamplingProfile = {
  accuracy: 'high',
  timeInterval: HOURLY_MS,
  distanceInterval: 0,
  deferredUpdatesInterval: 60000,
};

/**
 * STILL — on the shift path, motion adaptivity is NEUTRALISED (PHASE 63): this profile is identical to
 * MOVING. The old "sparse when still" economy both stretched the cadence to 5 min AND (via
 * `distanceInterval: 30`) recorded nothing while stationary — exactly the gap the owner reported — so it
 * conflicts with owner #1 ("retain every shift point"), and the owner-#1 test guard locks both profiles
 * to distanceInterval 0 / accuracy 'high'. The 41c classifier still runs and persists its state; the
 * constant is kept (not deleted) so the mechanism survives. Note: OFF-DUTY battery economy is NOT here —
 * it lives in `AMBIENT_PROFILE`; re-introducing a shift-time still-economy needs a deliberate guard edit.
 */
export const STILL_PROFILE: SamplingProfile = {
  accuracy: 'high',
  timeInterval: HOURLY_MS,
  distanceInterval: 0,
  deferredUpdatesInterval: 60000,
};

/**
 * AMBIENT — the 24/7 OFF-DUTY recorder profile. `tracker.ts` selects it whenever the recorder runs with
 * NO shift session id. Deliberately COARSER than the shift profile — Balanced (~100 m, not High ~10 m)
 * and distance-gated (30 m) — so consent-based off-duty tracking is NOT silently upgraded to continuous
 * ~10 m home recording (a privacy escalation) and does not keep the GPS radio hot around the clock
 * (battery). This preserves the pre-PHASE-63 off-duty behaviour; PHASE 63's "capture every point" is a
 * CLOCKED-IN-shift requirement only (owner #1). This constant is the lever to dial off-duty cost.
 *
 * ⚠️ PHASE 78 (2026-08-26, owner via `contracts/INBOX.md`): hourly, like the shift profiles. This is
 * the profile that actually runs around the clock, so it is where the owner's battery/data complaint
 * really lands. It stays COARSER than the shift profiles in the two ways that matter for privacy —
 * Balanced accuracy and `distanceInterval: 30` — so off-duty tracking is still not a continuous ~10 m
 * record of someone's home. WHAT THIS DOES NOT CHANGE: a point still arrives roughly hourly even when
 * the OS starves this stream, because the 15-min watchdog forces a fix once the newest point is older
 * than `STALE_AFTER_MS` (45 min) — a ~60-minute best-effort ceiling that is independent of this
 * constant (`staleBuffer.ts`). So the backend's 3 h `LOCATION_GAP_THRESHOLD_MIN` stays safe.
 */
export const AMBIENT_PROFILE: SamplingProfile = {
  accuracy: 'balanced',
  timeInterval: HOURLY_MS,
  distanceInterval: 30,
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
