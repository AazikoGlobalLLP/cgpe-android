/**
 * Haptics — the tactile half of the design system.
 *
 * WHY THIS WRAPPER EXISTS rather than calling expo-haptics inline:
 *
 * 1. WEB SAFETY. expo-haptics is a no-op shim on web, but `Haptics.notificationAsync`
 *    still rejects in some browsers rather than resolving. Every call here is fire-and-
 *    forget and swallows rejection, so a haptic can never break a user action.
 *
 * 2. SEMANTIC NAMES, NOT PHYSICAL ONES. Screens should say what HAPPENED ("a record was
 *    saved") and let this module decide the intensity. Calling `ImpactFeedbackStyle.Heavy`
 *    from a screen hard-codes a physical choice into business logic, and the app ends up
 *    with heavy taps on trivial actions — the buzzy, cheap feel we are avoiding.
 *
 * 3. RATIONING. Haptics follow the same discipline as the brand gradient: they mark
 *    moments that MATTER. Every tap buzzing is what makes an app feel toy-like. The
 *    budget:
 *      · tap()      — committing an action (submit, confirm, toggle a real value)
 *      · select()   — moving between discrete options (segment, chip, filter, stepper)
 *      · success()  — a write reached the server and came back OK
 *      · warn()     — refused but recoverable (out of geofence, validation)
 *      · error()    — the write failed or the session died
 *    Plain navigation gets NOTHING. Scrolling gets nothing. Opening a screen gets nothing.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS !== 'web';

/** Fire-and-forget: a haptic must never reject into a user flow. */
const fire = (fn: () => Promise<unknown>) => {
  if (!enabled) return;
  try {
    void fn().catch(() => {});
  } catch {
    // Some platforms throw synchronously when the module is unavailable.
  }
};

export const haptics = {
  /** Committing an action: submit, confirm, toggle a value that persists. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Moving between discrete options: segment, chip, filter, stepper. */
  select: () => fire(() => Haptics.selectionAsync()),

  /** A write reached the server and succeeded. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** Refused but recoverable: out of geofence, validation failure. */
  warn: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),

  /** The write failed, or the session died. */
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),

  /** Reserved for the clock-in ring completing — the app's single most physical moment. */
  heavy: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
};

export default haptics;
