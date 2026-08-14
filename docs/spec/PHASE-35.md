# Phase 35 — [audit] Intermittent touch-freeze, esp. the AppLock "Unlock" button

**Audit + fix in one phase** (per `docs/PLAN-2026-08-14.md` Group A / §Phase 35). Deliverable: root-cause +
fix. `[m]` — mobile-only, no contract change, no `[api]` ask. Fix applied to `src/ui/AppLock.tsx` this session.

## 0. The report

"Touches stop registering in several places; the clearest repro is the **AppLock** screen — tapping **Unlock**
often does nothing." Intermittent. The owner separately targets "any handset (Android/Samsung/iOS)" (Phase 41),
which matters here — the trigger is worst on OEM/Samsung skins.

## 1. Verdict (answering the deliverable's question)

**It is NOT a pointer-absorbing overlay. It is a re-entrant biometric race in `AppLock.tsx`: `attempt()` fires
two overlapping `LocalAuthentication.authenticateAsync()` calls, Android rejects the second as "already in
progress," and `authenticateBiometric` (fail-closed) turns that rejection into a plain `false` — so the tap
shows no prompt and never unlocks.** The button was never dead; the second biometric call was dead-on-arrival.

The plan named three suspects to investigate. All three are **disproven** (§3) — recorded because ruling them
out is half the audit. The real cause is §2.

## 2. Root cause (the mechanism)

`AppLock` is an absolutely-positioned overlay in `RootNav` (`app/_layout.tsx:98`). While locked it runs
`attempt()`, which calls `authenticateBiometric()` (`store/auth.tsx:275`) → `LocalAuthentication.
authenticateAsync({ disableDeviceFallback: false })`. `attempt()` is fired from **three** places with **no guard
against overlap** (pre-fix `AppLock.tsx`):

1. **Cold start** — the arm effect: `if (restoredSession && shouldLock) { setLocked(true); attempt() }`.
2. **Every foreground return** — the `AppState` listener: `if (back && shouldLock) { setLocked(true); attempt() }`.
3. **The Unlock button** — `onPress={attempt}`.

They overlap **deterministically**, not by luck:

- `disableDeviceFallback: false` means when the fingerprint fails, or the user taps **"Use PIN,"** Android
  launches its **separate Confirm-Device-Credential activity**. That sends the app `active → background →
  active`.
- The foreground listener's test — `appState.current.match(/inactive|background/) && next === 'active'` — reads
  that return-to-active as *"the user came back"* and fires a **second** `attempt()` **while the first prompt is
  still open**. (Samsung/One UI and some OEM skins also bounce `AppState` for the plain fingerprint sheet, so the
  loop can start without the PIN fallback at all — hence "intermittent / several devices.")
- Android's `BiometricPrompt` **cannot run two authentications at once**: the second `authenticateAsync` rejects
  immediately with *"authentication is already in progress."* `authenticateBiometric` catches every throw and
  **returns `false`** (its deliberate fail-closed posture, `store/auth.tsx:294-295`). So the second attempt
  resolves `false` **without ever painting a prompt** and the lock stays up.
- Net symptom: the user taps **Unlock** (or the flow auto-retries) and **nothing visible happens** — no prompt,
  no unlock — over and over. On each dismissal the AppState churn re-arms the loop. That is the "touch-freeze."

Two smaller aggravators on the same path, both fixed by the same change:

- While the auto-`attempt()` runs, `trying` is `true` so the button is `disabled` — a tap in that window is
  silently swallowed (correct intent, but it widens the dead-tap window during the race).
- `attempt()` had **no `try/finally`** around `setTrying`. Today `authenticateBiometric` can't throw (it catches
  internally), so `trying` doesn't *currently* stick — but the moment anyone changes that posture, `trying` would
  latch `true` and the button would be permanently disabled. The fix closes that latent trap too.

## 3. What was ruled out (the plan's three suspects)

1. **An opacity-0 View absorbing touches (the `sheet.tsx:101-111` bug class).** Not present. AppLock's overlay is
   a **solid** `position:absolute` View at `zIndex:60` that correctly captures its own touches; its Unlock
   `Pressable` is a direct child with a real laid-out hit target (`Grad` is a plain `LinearGradient`, `base.tsx:22`,
   with **no** `pointerEvents` override). The other always-mounted overlays — `JobPill`, `HealthBanner` — both
   early-return `null` when idle and are small **bottom-floating pills** when shown, never full-screen. `Splash`
   is the one full-screen Animated overlay, but it (a) sits at `zIndex:50`, **below** AppLock's `60`, and (b)
   **unmounts cleanly** on `splashDone` with **no fade-out** — it never lingers at opacity 0. There is no
   invisible absorber anywhere in the overlay stack.
2. **The gesture-handler root intercepting.** No. AppLock is plain `View`/`Pressable` with no gesture handler;
   the top-level `GestureHandlerRootView` (`_layout.tsx:108`) does not intercept a `Pressable`. (The `Sheet`
   correctly nests its **own** `GestureHandlerRootView` inside its `Modal`, `sheet.tsx:169` — unrelated.)
3. **A full-screen Animated overlay that stays mounted.** Only `Splash` qualifies, and it unmounts (see 1).

## 4. The fix (applied — `src/ui/AppLock.tsx`, mobile only)

Serialise biometric attempts so exactly **one** prompt is ever live:

- New `inFlight` ref (`AppLock.tsx:21`). `attempt()` returns early if a call is already running, sets
  `inFlight.current = true`, and resets it in a **`finally`** alongside `setTrying(false)` (`:46-57`).
- The `AppState` foreground listener now gates on **`!inFlight.current`** (`:77`) — so the prompt's OWN
  background→active churn can no longer spawn a competing attempt. A **genuine** foreground return (no prompt in
  flight) still re-locks and re-prompts exactly as before.

Why this is right and safe:

- It removes the **only** way two `authenticateAsync` calls could overlap, which is the entire root cause.
- It does **not** change *when* the app locks (cold start + real foreground return are untouched), the
  fail-closed security posture (`authenticateBiometric` unchanged), or the back-press swallow (`:83-100`).
- It's boring and local: one file, one ref, one guard, one `try/finally`. No contract, no other screen, no new
  dependency.
- The `finally` also permanently removes the latent "button stuck disabled" trap (§2).

## 5. Gates

- `npx tsc --noEmit` → **0**.
- `npm test` → **417/417** (unchanged). AppLock has **no test coverage** and cannot get any here: there is no
  `expo-local-authentication` / `AppState` stub, and the bug lives in native biometric + OS-lifecycle behaviour
  that neither Vitest nor the Expo **web** build exercises (CLAUDE.md: AppLock is a native-only surface; `npm
  test` is pure logic only). The fix is verified by reading, not by a red→green test.
- `npm run lint` → **0 errors / 12 warnings** (baseline, no new errors).

## 6. Device check (carried — the real acceptance test)

Not editor-buildable; must be walked on a **physical Android handset** with a saved session + biometric enabled
(ideally a Samsung/One UI device, where the AppState churn is most reliable):

- [ ] Cold-start with a restored session → lock appears, biometric prompt shows once; a **successful**
      fingerprint unlocks and the prompt does not immediately re-appear.
- [ ] On the prompt, tap **"Use PIN"** → the device-credential screen opens and returning does **not** leave a
      dead lock; **Unlock** responds on the first tap every time.
- [ ] Fail the fingerprint a few times, then tap **Unlock** repeatedly → a prompt appears **every** time (no
      dead taps, no "Verifying…" stuck state).
- [ ] Background the app while unlocked and return → it re-locks and prompts (the legitimate path still works).

## 7. Done-when

- [x] Root cause named: **re-entrant `attempt()` firing two concurrent `authenticateAsync` calls**, the second
      rejected by Android and swallowed to `false` by the fail-closed `authenticateBiometric`; triggered
      deterministically by the `disableDeviceFallback:false` device-credential activity's AppState churn (and by
      OEM fingerprint-sheet AppState bounce). **Not** a pointer-absorbing overlay; the plan's three suspects
      disproven (§3).
- [x] Fix applied to `src/ui/AppLock.tsx` (`inFlight` guard + `try/finally` + `!inFlight.current` on the
      foreground listener). One file.
- [x] Gates green (tsc 0 · npm test 417/417 · lint 0 errors/12 warnings).
- [ ] Device check (§6) — carried; native-only, cannot be run in the editor.
