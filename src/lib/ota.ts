/**
 * Over-the-air updates — the native seam.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────
 * Until now every JS fix needed a full EAS rebuild, and a rebuild is 15–20 minutes, a monthly
 * quota, and 21 people re-installing an APK by hand. The owner has asked for this three times
 * ("aisa change karo ki nayi APK ki zaroorat na pade"). It was deliberately kept out of the four
 * 2026-09-01 builds because it adds a native module and changes the boot path, and those builds
 * were fixing a crash. That objection is spent: build 5 is confirmed good on a handset.
 *
 * ── WHY EVERY `require` IS LAZY ───────────────────────────────────────────────────────────────
 * `expo-updates` is a NATIVE module. A top-level `import` of one from any file a route can reach
 * is the documented module-scope-throw trap (`CLAUDE.md` → "Native modules: TWO different traps"),
 * and it also breaks the Vitest graph with `__DEV__ is not defined`. Keeping the require inside the
 * try/catch means this module's own top level is native-free, so importing it costs nothing and
 * cannot throw. The pattern is `lib/buildInfo.ts`'s, and the decision half lives in the pure,
 * tested `lib/otaPolicy.ts` — a lazy require cannot be mocked (Phase 86), so nothing here is
 * testable and nothing here makes a decision.
 *
 * ── WHY NOTHING HERE REPORTS TO `data/health` ─────────────────────────────────────────────────
 * Convention #4 says a failed request must raise the outage banner so "empty" is never mistaken for
 * "could not load". That is about the BACKEND, and it must not be extended here. The update server
 * is `u.expo.dev`, a different host with nothing to do with the user's data: if it is unreachable
 * we simply keep running the JS we already have, which is correct and complete. Reporting it would
 * put "we could not load your data" on screen while every list on the phone is perfectly fine —
 * turning a silent non-event into a false alarm. Every function here fails quiet, on purpose.
 */

/** The slice of `expo-updates` this app uses. Optional throughout — an old or absent native side. */
type UpdatesModule = {
  isEnabled?: boolean;
  isEmbeddedLaunch?: boolean;
  updateId?: string | null;
  checkForUpdateAsync?: () => Promise<{ isAvailable?: boolean }>;
  fetchUpdateAsync?: () => Promise<{ isNew?: boolean }>;
  reloadAsync?: () => Promise<void>;
};

/** The native module, or null when it is unavailable (web, Expo Go, an unlinked build). */
function updates(): UpdatesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose (see file header)
    return require('expo-updates') as UpdatesModule;
  } catch {
    return null;
  }
}

/**
 * Is the update system actually operational? False in Expo Go, in a dev build and on web.
 *
 * Everything user-facing is gated on this, so a developer never sees a "restart to update" offer
 * that could not possibly do anything.
 */
export function otaEnabled(): boolean {
  try {
    return updates()?.isEnabled === true;
  } catch {
    return false;
  }
}

/**
 * The id of the over-the-air update currently running, or null when the app is running the JS
 * bundled into the APK itself.
 *
 * This is what stops OTA from destroying the one thing `9ecaa9e` bought us. `Settings › Version`
 * shows the native build number so a bug report can be tied to a specific APK — but once updates
 * ship, `1.10.0 (6)` is true of build 6 running ANY of its updates, and the only field-readable
 * discriminator in the app would silently stop discriminating. So the version line names the
 * update too. See `formatVersionLine` in `lib/buildInfo.ts`.
 */
export function runningUpdateId(): string | null {
  try {
    const u = updates();
    if (!u || u.isEnabled !== true) return null;
    /* `isEmbeddedLaunch` is the explicit signal that we are running the bundled JS. `updateId` is
       also null in that case, but checking both means a native side that reports one and not the
       other cannot make the app claim an update it is not running. */
    if (u.isEmbeddedLaunch === true) return null;
    const id = u.updateId;
    return typeof id === 'string' && id.trim() ? id : null;
  } catch {
    return null;
  }
}

/**
 * Look for a new update and, if there is one, download it.
 *
 * Resolves `true` only when a new update is now downloaded and waiting — i.e. when a reload would
 * actually change what runs. Never throws and never reports: in a dev build these calls throw by
 * design, and off-network they fail, and in both cases the honest answer is "no update, carry on".
 */
export async function checkAndFetchUpdate(): Promise<boolean> {
  try {
    const u = updates();
    if (!u || u.isEnabled !== true) return false;
    if (!u.checkForUpdateAsync || !u.fetchUpdateAsync) return false;

    const check = await u.checkForUpdateAsync();
    if (check?.isAvailable !== true) return false;

    const fetched = await u.fetchUpdateAsync();
    return fetched?.isNew === true;
  } catch {
    return false;
  }
}

/**
 * Restart into the downloaded update.
 *
 * Only ever called from the user's own tap on the update banner — see the "one rule that matters"
 * note in `lib/otaPolicy.ts` for why this is never automatic. Fails quiet: if the reload cannot
 * happen the user simply stays where they are, and the update applies at the next cold start.
 */
export async function applyUpdate(): Promise<void> {
  try {
    const u = updates();
    if (!u || u.isEnabled !== true || !u.reloadAsync) return;
    await u.reloadAsync();
  } catch {
    /* Nothing useful to say and nothing broken — the update is still pending for next launch. */
  }
}
