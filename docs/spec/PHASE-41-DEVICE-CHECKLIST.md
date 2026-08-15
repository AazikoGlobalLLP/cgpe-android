# Phase 41 — on-device verification checklist (the acceptance gate)

**Written:** 2026-08-15. **Status:** Phase 41 is **editor-complete** (41a–41d built, gates green:
`tsc` 0 · `npm test` 552 · eslint 0 errors). Nothing here is editor-buildable — every row is a
device observation. This doc consolidates the checks that are otherwise scattered across
`PHASE-41.md` §12.7 / §3 and the 41b/41c/41d prose in `PHASES.md`, so a real handset pass misses
nothing. Each row names the **exact code path** and the **exact observable** — no invented numbers.

> Not editor-runnable. Do NOT tick a row from reading code — every box below is a thing you watch
> happen on a phone. When done, record pass/fail per handset in the grid at the foot.

---

## 0. Preconditions (all four must hold, or the pass is invalid)

- [ ] **A native build**, not OTA. 41b/41c added two native modules (`expo-background-task`,
  `expo-sensors`) + the `RECEIVE_BOOT_COMPLETED` / `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` manifest
  entries, so an OTA update **cannot** carry Phase 41. Cut it with
  `eas build -p android --profile preview` (installable APK) or a dev-client build.
- [ ] **Backend live on `:3001`** with Phase 43 (consent + ambient) and Phase 45 (retention)
  deployed — the consent write, `me.location_consent`, `POST /track/ambient`, and the withdrawal
  master-notify all live server-side. A device miss here is a backend-not-restarted issue, not a
  client bug (see the OPS trap in `CLAUDE.md`).
- [ ] **A live consented `super_admin`** account (a real DB `Profile.role`, Phase 38) on a *second*
  device, so the master-visibility rows (ambient `off_duty` points, withdrawal alert) can be
  confirmed from the master surface, not just the DB.
- [ ] **3+ handsets across OEMs** — Samsung / Xiaomi / OnePlus / Pixel — because the reliability
  (41b) and battery (§3) results diverge by OEM Doze aggressiveness. One phone is not a pass.

---

## 1. 41a — consent + unified 24/7 recorder (§12.7 matrix)

| # | Step | Expected observable | Code anchor |
|---|---|---|---|
| 1 | Grant consent on the `/consent` screen | The 24/7 service notification appears with **neutral wording in the user's language** (not the shift "Recording your field route" text) | `consent.tsx` onAgree → `startAmbientTracking({prompt:true,notif})`; `track.notif` captured at arm time |
| 2 | Off-duty (not clocked in), pocket the phone, walk ~200 m | Points land as **ambient / `off_duty:true`** (confirm on the master surface or DB); **coarse fixes are kept** — no ≤100 m accuracy drop on the ambient path | `tracker.ingest` absent+armed ⇒ `deliverAmbient`→`postAmbientPoints` (`off_duty`) |
| 3 | Clock in, move, then clock out | On clock-in the **same** service now attributes to the **shift** (`/track/points`); on clock-out the shift seals and recording **drops back to ambient without the service stopping** | `startTracking`/`stopTracking` only flip the shift `sid`; service stays up when armed |
| 4 | Swipe the app away from Recents | The service **survives** and keeps recording in whichever mode applies | foreground service; verify the notification persists |
| 5 | Watch after the background-location grant | The battery-optimisation prompt appears **exactly once**; accepting it makes the service more kill-resistant | `ensureBackgroundPermission` → `IntentLauncher … REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `track.batteryOptAsked` once-per-install |
| 6 | Withdraw consent **server-side** (admin panel), then wait for the next ambient flush | The flush gets **`403 consent_required`** → the service **stops** and the buffer is **dropped** (no un-consented recording) | `postAmbientPoints` 403 ⇒ stop + drop |
| 7 | **Fail-open:** boot the app with the consent read forced to `error` (kill network at cold start) | **No** 24/7 recording starts and **nobody** is gated to `/consent` | `needsConsentGate` `error`→no; `_layout` ConsentGate boot-arm only on `ok+granted` |

## 2. 41b — reliability watchdog (re-arm after OEM kill + reboot)

| # | Step | Expected observable | Code anchor |
|---|---|---|---|
| 8 | While armed, force-stop / let the OEM Doze-kill the service | The watchdog **re-arms** the recorder within ~one interval (~15 min, WorkManager cadence — not seconds) | `WATCHDOG_TASK` + `watchdogTick`; `ensureWatchdog` paired to `startService` |
| 9 | Reboot the handset (do **not** reopen the app) | After boot, WorkManager restores the periodic task and it **re-arms** the recorder within ~15 min — no hand-written BootReceiver | `expo-background-task` restored-after-reboot; re-arm iff live shift OR 24/7 armed |
| 10 | Clock out **and** withdraw consent so nothing is left to record | The watchdog **retires** — the device stops being woken (protects §3 battery) | `retireWatchdog` at `stopUpdates`; `watchdog.ts` re-arm invariant |

## 3. 41c — motion-adaptive sampling (verify, then MEASURE)

| # | Step | Expected observable | Code anchor |
|---|---|---|---|
| 11 | Sit still (phone on a desk, screen on) for >5 min, then walk | While still + foreground, sampling lengthens the **time** cadence to 5 min; on movement it returns to the Balanced/60 s/30 m cadence. **Scope honesty:** the profile is applied at each service (re)start, **not mid-session**, and the accelerometer **pauses in background**, so `still` rarely fires for a pocketed phone | `motion.ts` `classifyMotion`/`samplingProfile`/`resolveMotion`; `startService` reads `track.motion` |

> §12.8 / §3: 41c is the **lever**, not a guaranteed win. Row 11 confirms the classifier *works*;
> whether it *helps* is decided by the row 16 battery measurement.

## 4. 41d — anti-circumvention (§5)

| # | Step | Expected observable | Code anchor |
|---|---|---|---|
| 12 | **Fake-GPS drop:** enable Developer Options → "Select mock location app", spoof a location while armed | The spoofed `mocked:true` fixes **never enter the record** — the route shows a **gap**, not a fake path | `dropMocked` in `antiCircumvention.ts`, wired into `tracker.ingest` |
| 13 | **Revoke → master alert:** as a consented 24/7 user, revoke the OS **background** location permission | Consent is set to withdrawn (**every super_admin is notified** — a loud opt-out) and the recorder stops; fires **once** per revocation, and a *failed* permission read never spam-alerts | `PermissionMonitor` → `syncConsentWithPermission` → `setLocationConsent(false)` + `stopAmbientTracking`; `shouldSignalWithdrawal` armed-gated |
| 14 | **App-block overlay:** as a consented 24/7 user, turn the **device Location toggle OFF** (system quick-setting) | A full-screen **"Turn location back on to use CGPE Connect"** overlay appears in the user's language; **Open settings** lands on the device Location page; the Android **back button cannot escape** it; it **clears** the moment you return with Location back on | `LocationBlock.tsx`; `evaluateLocationBlock`→`locationBlockReason` `services_off`; `openLocationSettings` → `LOCATION_SOURCE_SETTINGS` |
| 15 | **Accepted gap (owner signed off):** a **mid-session permission** revoke | Shows **no block screen until the next app open** — the withdrawal path (row 13) handles it meanwhile; on next open the `/consent` wall gates | Composition note: withdrawal disarms `armed` → `evaluateLocationBlock` returns `null` for the permission case; block settles on device-Location-OFF |

## 5. §3 — battery (the hard acceptance gate)

| # | Step | Expected observable | Code anchor |
|---|---|---|---|
| 16 | Run a **full real working day** on **each** of the 3+ handsets with 24/7 armed | Drain overhead attributable to the app is a **small single-digit %**. If it exceeds that, 41c motion-adaptive sampling is the mitigation lever — **do not ship as-is** | `PHASE-41.md` §3 / §12.7.8 / §12.8 |

---

## Result grid (fill in on the device pass)

| # | Check | Samsung | Xiaomi | OnePlus | Pixel |
|---|---|:-:|:-:|:-:|:-:|
| 1 | Consent → neutral notification, right language | | | | |
| 2 | Ambient `off_duty` points off-shift, coarse kept | | | | |
| 3 | Attribution flips on clock-in/out, service never stops | | | | |
| 4 | App-swipe survival | | | | |
| 5 | Battery-opt prompt once | | | | |
| 6 | Withdraw → 403 → stop + drop | | | | |
| 7 | Fail-open boot arms nobody | | | | |
| 8 | OEM-kill → re-arm ~1 interval | | | | |
| 9 | Reboot → restored + re-arm | | | | |
| 10 | Off-shift + un-armed → retire stops wakeups | | | | |
| 11 | Motion classifier still→5 min, moving→Balanced | | | | |
| 12 | Fake-GPS fixes dropped (gap, not fake route) | | | | |
| 13 | Revoke bg permission → every master alerted, once | | | | |
| 14 | Device-Location-OFF → app-block overlay + Open settings + back-swallow + auto-clear | | | | |
| 15 | Mid-session permission revoke → no block till next open (accepted gap) | | | | |
| 16 | **Battery: small single-digit % over a real day** | | | | |

**Done when** every row passes on 3+ handsets **and** row 16 is within the §3 budget. Only then is
Phase 41 verified; do **not** cut the "final" APK (Phase 49) before that, or while `git push` still
403s.
