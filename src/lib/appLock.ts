/**
 * PHASE 70 — the App-Lock re-lock decision, kept as a PURE function so the one behaviour the
 * owner reported ("the app makes me fingerprint-unlock every time I reopen it") is pinned by a
 * test. `ui/AppLock.tsx` itself is device-only — it drives `AppState`, `BackHandler` and
 * `expo-local-authentication`, none of which have a Node/web stub — so this seam lives in its own
 * module with zero native imports, exactly like `lib/watchdog.ts` does for its own decision.
 *
 * THE BUG THIS FIXES. Before Phase 70, `AppLock` re-locked and fired the biometric prompt on
 * EVERY `background → active` transition (and on every cold start with a saved session). A field
 * user who glances at WhatsApp, takes a call, or checks a map for ten seconds came back to a
 * fingerprint wall each time — read as "the app keeps logging me out." The session was never
 * touched; only the lock was re-arming with no sense of how long the user had actually been away.
 *
 * THE FIX. Remember when the app was last backgrounded and only re-lock if the gap exceeds a
 * grace window. A brief trip skips the prompt; a real absence still re-locks, so a found or
 * borrowed handset cannot be opened after the phone has been set down for a while.
 *
 * THE GRACE WINDOW IS OWNER-SET. 5 minutes, chosen by the owner (AskUserQuestion, 2026-08-20) —
 * a quick app-switch or call is inside it, a coffee break is outside it. Not a value invented here.
 */
export const APP_LOCK_GRACE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Whether returning to the app should re-lock and prompt for biometrics, given when it was last
 * backgrounded (`lastActiveMs`) and the current time (`nowMs`).
 *
 * FAILS CLOSED — re-locks (returns `true`) whenever the elapsed time cannot be trusted:
 *   - no stored timestamp (first launch, or the process was killed before it could stamp);
 *   - a non-finite / non-positive timestamp (corrupt storage);
 *   - a NEGATIVE elapsed, i.e. the device clock moved backwards since backgrounding.
 * The lock exists to keep a found handset shut, so "I'm not sure how long you were away" must
 * mean lock, never open. It only skips the prompt when a valid, recent timestamp is within grace.
 */
export function shouldRelock(
  lastActiveMs: number | null,
  nowMs: number,
  graceMs: number = APP_LOCK_GRACE_MS,
): boolean {
  if (lastActiveMs == null || !Number.isFinite(lastActiveMs) || lastActiveMs <= 0) return true;
  const elapsed = nowMs - lastActiveMs;
  if (!Number.isFinite(elapsed) || elapsed < 0) return true; // clock skew → be safe, lock
  return elapsed > graceMs;
}

/**
 * Parse the persisted "last backgrounded" timestamp back into a number, tolerating the `null`
 * a missing key returns and any garbage a corrupt store could hold. A bad value becomes `null`,
 * which `shouldRelock` reads as "unknown → lock".
 */
export function parseLastActive(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
