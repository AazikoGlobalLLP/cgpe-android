/**
 * When may the app offer to restart itself for an over-the-air update, and how often may it look?
 *
 * ── WHY THIS FILE IS SEPARATE FROM `lib/ota.ts` ───────────────────────────────────────────────
 * `lib/ota.ts` holds the `expo-updates` calls behind a lazy `require`, and a lazy `require`
 * resolves through Node rather than Vite — so neither a `vitest.config.mts` alias nor `vi.mock`
 * can reach it (Phase 86). Anything worth pinning therefore has to be a plain function that takes
 * data, which is what lives here. This module imports nothing native and is safe in the test graph.
 *
 * ── THE ONE RULE THAT MATTERS ─────────────────────────────────────────────────────────────────
 * The app OFFERS a restart. It never performs one on its own.
 *
 * `Updates.reloadAsync()` restarts the JS runtime, and this app has already paid for learning what
 * that costs: `react-navigation` erases the navigation state on unmount, so a reload drops the user
 * back at `app/index.tsx` and the whole back stack is gone (the same mechanism documented at
 * `CrashReport.retryLabel`). Doing that unasked — mid-form, mid-claim, mid-capture — would lose the
 * user's work to fix a bug they had not noticed. So the update downloads quietly, waits, and the
 * user chooses the moment. `checkAutomatically: ON_LOAD` means it applies on the next natural
 * launch anyway, which is the floor; the banner is what turns "tomorrow" into "now".
 */

/** Milliseconds between foreground update checks. One quiet request per half hour, at most. */
export const FOREGROUND_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * May we look for an update now?
 *
 * `checkAutomatically: ON_LOAD` only checks at cold start, and these handsets are not restarted for
 * days — a field agent foregrounds the same process every morning. Without a foreground check an
 * OTA would take as long to arrive as an APK, which defeats the point. Throttled so that
 * foregrounding the app twenty times an hour costs one request, not twenty.
 *
 * @param lastCheckedAt epoch ms of the previous check, or null if we have never checked
 * @param now           epoch ms
 */
export function shouldCheckOnForeground(
  lastCheckedAt: number | null | undefined,
  now: number,
  minIntervalMs: number = FOREGROUND_CHECK_INTERVAL_MS,
): boolean {
  if (lastCheckedAt == null) return true;
  /* A device clock that moved BACKWARDS (a manual change, or a timezone-fiddling user) would make
     `now - lastCheckedAt` negative and, with a naive `>=`, still pass. The real hazard is the
     opposite one: if we stored a timestamp from the future, a `>=` test would block every check
     until real time caught up — potentially days. Treat any non-forward clock as "stale, check". */
  if (now < lastCheckedAt) return true;
  return now - lastCheckedAt >= minIntervalMs;
}

/**
 * Should the "update ready" banner be on screen?
 *
 * @param enabled   `expo-updates` is operational — false in Expo Go, dev builds and on web, where
 *                  offering a restart would be a lie (there is nothing to restart INTO).
 * @param pending   a new update is downloaded and will run on the next reload.
 * @param dismissed the user waved it away this session.
 * @param outage    `data/health` is reporting a failure, so `HealthBanner` is occupying this slot.
 *                  Both float at the bottom, and an outage is the more urgent of the two — a user
 *                  who cannot load their clients does not need to hear about a JS update. Suppress
 *                  rather than stack: the update is still pending and the banner returns after.
 */
export function shouldOfferRestart(input: {
  enabled: boolean;
  pending: boolean;
  dismissed: boolean;
  outage: boolean;
}): boolean {
  const { enabled, pending, dismissed, outage } = input;
  return enabled && pending && !dismissed && !outage;
}
