# HANDOFF — CGPE Connect (Android) — Phase 35 — 2026-08-14

This session ran **Phase 35 — [audit] intermittent touch-freeze, esp. the AppLock "Unlock" button** end to
end: audited it, disproved the plan's three suspects, root-caused the real bug, and shipped the fix in one file.
`[m]` — mobile-only, no contract change, no `[api]` ask.

## Done
- **The AppLock "Unlock" button responds every time.** The owner's bug — tapping Unlock "often does nothing,"
  intermittently, worst on Samsung/OEM handsets — is fixed. Biometric unlock attempts are now serialised, so
  exactly one system prompt is ever live; the dead-tap window is gone.
- **The root cause is written down** (`docs/spec/PHASE-35.md`): `attempt()` fired two overlapping
  `LocalAuthentication.authenticateAsync()` calls (auto-lock + AppState foreground return + the Unlock button,
  with no guard). Because the app passes `disableDeviceFallback:false`, tapping "Use PIN" launches Android's
  separate Confirm-Device-Credential activity → the app goes `background → active` → the foreground `AppState`
  listener read that as "the user returned" and fired a **second** `attempt()` over the first. Android rejects a
  concurrent `authenticateAsync` ("already in progress"); `authenticateBiometric` (fail-closed) swallows it into
  a plain `false` — so the tap showed no prompt and never unlocked. NOT a pointer-absorbing overlay.

## Files changed
- `src/ui/AppLock.tsx` — the fix. New `inFlight` ref serialises `attempt()` (one biometric prompt at a time) +
  `try/finally` guarantees `trying`/`inFlight` reset (also kills a latent "button stuck disabled" trap); the
  foreground `AppState` listener now gates on `!inFlight.current` so the prompt's own AppState churn can't spawn
  a competing prompt. A genuine foreground return still re-locks. Big block comment explains why.
- `docs/spec/PHASE-35.md` — NEW. The audit finding: report · verdict · mechanism · the three suspects disproved
  · the fix · gates · device-check acceptance list · done-when.
- `docs/PHASES.md` (Now + Next 3), `docs/DECISIONS.md` (1 entry, prepended), `docs/STATUS.md` (rewrite),
  memory `owner-backlog-2026-08-14` — Phase-35 close. Commit `2fc683b` (local; push still 403s).

## Decisions made
- **The fix is a re-entrancy guard, NOT a pointerEvents change.** The plan pointed at "an opacity-0 View
  absorbing touches (the `sheet.tsx` bug class)," the gesture-handler root, and a lingering full-screen overlay.
  All three were investigated and **disproven** (PHASE-35 §3): AppLock's overlay correctly captures its own
  touches, `JobPill`/`HealthBanner` return `null` when idle, and `Splash` sits below at `zIndex:50` and unmounts
  cleanly. Adding speculative `pointerEvents` hardening would have been dead weight; the fix is scoped to the one
  real defect.
- **Kept `disableDeviceFallback:false`.** The device-passcode fallback is deliberate (`store/auth.tsx` — a
  handset with no biometric hardware must still be unlockable). It is the *trigger* for the AppState churn but
  not a bug; the correct fix is to serialise attempts, not to remove the fallback.

## Known broken / deliberately skipped
- **Device check is CARRIED — not editor-verifiable.** AppLock is native-only: there is no
  `expo-local-authentication` / `AppState` stub, and neither `npm test` (pure logic) nor the Expo web build
  reaches biometric + OS-lifecycle behaviour (CLAUDE.md). The fix is verified by reading. The acceptance walk
  (PHASE-35 §6: cold-start unlock, "Use PIN" round-trip, repeated Unlock taps, background→foreground re-lock)
  needs a physical Android handset, ideally Samsung/One UI where the AppState bounce is most reliable.
- **"Touches stop in several places" — only the AppLock repro was in scope.** The report mentioned other
  places; the plan's clear repro was AppLock and that is what was root-caused and fixed. If touch-freeze recurs
  elsewhere, it is a *different* cause (the overlay stack was cleared of invisible absorbers here — see §3).
- **`git push` still 403s** — stored credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; commit `2fc683b` is **local only**.

## Next session starts here
- **Phase 36 — [audit] hardcoded-vs-DB data sweep (notifications first, then app-wide).** Deliverable is an
  **inventory** separating (a) real fabrication to remove, (b) legitimate documented synthesis to keep (claim
  timeline, lead notes, prospects via `pick()`), (c) static label maps (fine). Note the project already forbids
  fabricated data (`data/mock.ts` is `export {}`; failed reads resolve empty via `unavailable()`). Feeds Phase
  37 (notification mark-read + bell-dot clear). Full plan: `docs/PLAN-2026-08-14.md` §Phase 36.
- **First command:** `/boot`
- **Watch out for:** do NOT flag legitimate synthesis as fabrication. `adapt.ts` synthesises claim
  timeline/lead notes and `prospects.tsx` resolves schema-less docs via `pick()` **on purpose** — those are the
  (b) bucket, not the (a) bucket. The audit's value is the separation, not a blanket "remove synthesis."
