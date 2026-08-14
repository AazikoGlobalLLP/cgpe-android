# HANDOFF — CGPE Connect (Android) — Phase 41a-iii-b part 2 — 2026-08-14

Built the whole `tracker.ts` 24/7-recorder slice **in the editor** this session, after the owner chose (via
AskUserQuestion) "write it all now" over deferring to the device. Gates are green, but **none of it is
device-verified** — `tracker.ts` has no test stub, the acceptance gate is a handset matrix (§12.7), and the
file's own header warns a mistake "looks fine in foreground, breaks only after a process kill." So this is a
complete, reviewable, gate-green slice that a build-and-device session must now prove (or correct) on real phones.

## Done (editor-built, DEVICE-UNVERIFIED)
- **One unified 24/7 recorder** (PHASE-41 §12.1). The single background service now records continuously once
  consent is granted; **clock-in/out no longer start/stop it — they only flip attribution.** Each flushed batch
  is posted as the **shift** (`/track/points`) when a shift `sid` is set, or as **off-duty ambient**
  (`postAmbientPoints`, `off_duty`) when it isn't. Clock-out seals the shift but the service keeps recording
  ambient.
- **Non-consented users are byte-identical to today** (§12.1 graceful degradation): service starts on clock-in,
  stops on clock-out, `/track/points` only. 24/7 is purely additive and engages only under granted consent; a
  fail-open (`error`) consent read arms nothing.
- **Consent grant arms the recorder** (`consent.tsx` Agree → `startAmbientTracking({prompt:true, notif})`), and
  **an already-consented user is armed on boot without a prompt** (`_layout.tsx` ConsentGate).
- **Battery-opt exemption** requested after the background grant (Android, best-effort, once per install), and a
  **neutral "location on for work" foreground notification** in the user's own language (persisted at arm time
  because a headless restart has no i18n).

## Files changed
- `src/lib/tracker.ts` — the unified recorder: `ingest` attribution routing; NEW `deliverAmbient`, `localDate`,
  `ambientArmed`, `readNotif`/`writeNotif`, `startService` (extracted); repurposed `startTracking`/`stopTracking`
  (armed vs. not); NEW exports `startAmbientTracking`/`stopAmbientTracking`; battery-opt step in
  `ensureBackgroundPermission`; NEW markers `track.ambient`/`track.notif`/`track.batteryOptAsked`.
- `src/app/consent.tsx` — onAgree arms 24/7 (`prompt:true`, resolved notif) before Home; header comment updated
  (no longer "not auto-gated").
- `src/app/_layout.tsx` — ConsentGate boot-arms (`prompt:false`) on `ok+granted`; tracker import switched to a
  named import (still evaluates the module side effect); `useT` added.
- `app.json` — `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission (NOTE: `RECEIVE_BOOT_COMPLETED` + boot-receiver
  plugin are **41b**, deliberately NOT added here).
- `package.json` / `package-lock.json` — `expo-intent-launcher@57.0.1` (via `npx expo install`).
- `docs/PHASES.md` · `docs/DECISIONS.md` · `docs/STATUS.md` · `docs/spec/PHASE-41.md` (§8, §12 status) — this phase.

## Decisions made (full detail: DECISIONS.md 2026-08-14 top)
- Read `track.ambient` **fresh from storage** per attribution branch, not a once-per-JS-start module flag —
  avoids a headless-wake race that could tear the 24/7 service down.
- `startAmbientTracking` takes the resolved `notif` strings as a param (tracker has no i18n; §12.4 needs them
  captured at arm time).
- Battery-opt fires **once per install** (a flag) — reconciles §12.3 (step in the shared permission ladder) with
  §12.7.5 ("appears once"). **Side effect (flag this):** a plain **shift** clock-in now also fires the one-time
  battery-opt prompt.
- `expo-intent-launcher` is a **top-level static import** (web/iOS shim is `export default {}`), keeping lint at
  0 errors / 12 warnings.
- Boundary-batch slop accepted for v1 (≤ one ~60 s interval mis-attributed across a clock event).

## Gates
`tsc` **0** · `npm test` **467/467** (unchanged — `tracker.ts` has no stub, wiring is presentational) · lint
**0 errors / 12 warnings** (baseline). **No contract change** (pure consumer of shipped Phase 43) → no
INBOX/CHANGELOG. Commit local; **`git push` still 403s** (human-owned credential swap).

## Known broken / deliberately skipped
- **NOTHING here is device-verified.** `tsc`/`npm test`/lint green ≠ working for `tracker.ts` (§12.0).
- **`stopAmbientTracking` is exported but not wired to sign-out / consent-withdrawal** — no withdrawal UI exists
  yet, and both self-heal via the next ambient flush (`signed-out` / `consent_required` → stop). A later slice.
- **41b not started:** `RECEIVE_BOOT_COMPLETED` + boot-receiver config plugin (reboot persistence) and the
  watchdog re-arm are 41b, not this phase — so a device **reboot** does not yet re-arm the recorder.
- **`isTracking()` now means "service running (shift OR 24/7)"** — reads true for an armed, not-clocked-in user.
  It has **zero consumers** in `src` (verified by grep), so no UI regression; left as-is.

## Next session starts here (BUILD + DEVICE)
- **First: build an installable app** — `eas build -p android --profile preview` (new native module +
  permission mean Expo Go / the current binary will NOT exercise this; a fresh dev-client/APK is required).
- **Then walk the §12.7 acceptance matrix on 3+ handsets** (Samsung / Xiaomi / OnePlus / Pixel):
  1. Grant consent → neutral 24/7 notification appears in the user's language.
  2. Off-duty + moving → points land as **ambient / `off_duty:true`** (confirm via master surface or DB).
  3. Clock in → points attribute to the **shift**; clock out → shift sealed, recording **drops to ambient
     without the service stopping**.
  4. Swipe the app away → the service survives and keeps recording.
  5. Battery-opt prompt appears **once** after the background grant.
  6. Withdraw consent server-side → next ambient flush gets 403 → service **stops** + buffer dropped.
  7. **Fail-open:** a consent-read error on boot arms **no** recording.
  8. **Battery drain measured over a real working day** — the §3 hard gate; target small single-digit %. If it
     exceeds that, motion-adaptive sampling (**41c**) is the fix, not shipping as-is.
- Also fold in **part 1's** owed on-device UX check (non-granted user → `/consent`, no Home flash/loop, survives
  restored-route cold start).
- Watch out for: `tracker.ts` is the danger zone — verify AFTER swiping the app away / a process kill, not just
  in the foreground. If the shift recorder regressed for a non-consenting user, that's a byte-identical-path bug
  to hunt first.
- First command: `/boot`
