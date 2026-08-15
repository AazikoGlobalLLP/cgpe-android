/**
 * PHASE 41b — the location watchdog's re-arm decision, kept as a PURE function so the one
 * safety-critical property is pinned by a test. `tracker.ts` itself is device-only and
 * untestable in Node/web (there is no `expo-location` / `expo-task-manager` stub — see
 * `test/stubs/`), so this seam lives in its own module with zero native imports, exactly like
 * `theme/density.ts` / `theme/brand.ts` do for their own logic.
 *
 * WHY A WATCHDOG EXISTS (PHASE-41 §2.3/§2.4). The recorder is a foreground-service-backed
 * background location task. Two things silently end it that the service alone cannot survive:
 *   1. an aggressive OEM (Samsung/MIUI/Oppo…) kills the service mid-day under Doze (§2.4);
 *   2. the device reboots — expo-location's task does NOT survive a reboot (§2.3).
 * The watchdog is a periodic background task (`expo-background-task`, ~15 min, WorkManager on
 * Android). WorkManager restores persisted periodic work after a reboot, so the SAME watchdog
 * covers both cases: whenever it runs it asks whether recording SHOULD be live and, if it is
 * not, re-arms the one unified recorder. (This is why 41b needs no hand-written native
 * BootReceiver — the boring, debuggable path; the cost is a re-arm within ~one interval of boot
 * rather than within seconds.)
 *
 * THE INVARIANT, IN ONE PLACE. The recorder should be alive **iff** there is a live shift OR
 * 24/7 (off-duty) recording is armed. Getting this wrong is not cosmetic:
 *   - re-arming when NEITHER holds resumes recording for someone who is off shift and never
 *     consented — a privacy break;
 *   - failing to re-arm is exactly the silent tracking-loss this whole sub-phase exists to stop.
 */

/**
 * - `rearm`  — recording should be live but the OS service is not running (killed, or a reboot):
 *              start the recorder again.
 * - `idle`   — recording should be live and the service is already running: healthy, do nothing.
 * - `retire` — neither a shift nor 24/7 is active: nothing to watch, so unregister the watchdog
 *              and stop waking the device (a battery cost, §3). A clock-in or a fresh consent
 *              grant re-registers it.
 */
export type WatchdogAction = 'rearm' | 'idle' | 'retire';

export function watchdogAction(input: {
  /** 24/7 off-duty recording is consented and armed (`track.ambient` === '1'). */
  armed: boolean;
  /** A clocked-in shift owns the persisted state (`state.sid` present). */
  hasShift: boolean;
  /** The OS location service is currently running (`hasStartedLocationUpdatesAsync`). */
  running: boolean;
}): WatchdogAction {
  const shouldRecord = input.armed || input.hasShift;
  if (!shouldRecord) return 'retire';
  return input.running ? 'idle' : 'rearm';
}
