# HANDOFF — CGPE Connect (Android) — Phases 41b–41d + Phase 50 — 2026-08-15

This session finished the remaining Phase-41 sub-phases in the editor (41b/41c/41d) and captured a new
owner request as Phase 50. **All of Phase 41 is now editor-complete; nothing more is editor-buildable there.**
The whole thing is DEVICE-UNVERIFIED and needs a native APK build (two new native modules → not OTA).

## Done (observable behavior)
- **The 24/7 recorder re-arms itself** after an aggressive-OEM kill AND after a reboot (a periodic watchdog;
  WorkManager restores it post-reboot — no native BootReceiver). (41b)
- **GPS sampling adapts to motion** — an accelerometer classifier marks the phone still/moving and the
  recorder samples sparser when stationary. (41c)
- **Fake-GPS is rejected** — OS-flagged mock-provider fixes are dropped, so a spoofed location can't be
  recorded. (41d)
- **Revoking location permission is a loud opt-out** — a consented user who turns off "Allow all the time"
  has every super-admin notified and the recorder stopped. (41d)
- **Two backend asks filed** (courier workflow, owner to relay): a silent-user gap-detector → master alert
  (41d §5); and dual-office geofence + out-of-range/early-clock-out reason → super-admin (Phase 50).
- Gates green all session: `tsc` 0 · `npm test` **552/552** (+29) · eslint 0 errors (2 pre-existing warnings).

## Files changed
- `src/lib/watchdog.ts` (new) — pure watchdog re-arm decision (`watchdogAction`); `watchdog.test.ts` (+11).
- `src/lib/motion.ts` (new) — accelerometer classifier + sampling profiles + hysteresis + fail-safe freshness;
  `motion.test.ts` (+16).
- `src/lib/antiCircumvention.ts` (new) — `dropMocked` + `shouldSignalWithdrawal` + `locationBlockReason`;
  `antiCircumvention.test.ts` (+12).
- `src/lib/tracker.ts` — watchdog task + register/retire at the startService/stopUpdates chokepoints; motion
  classifier wiring + profile-at-restart; mock filter in `ingest`; `syncConsentWithPermission`.
- `src/app/_layout.tsx` — `PermissionMonitor` (fires the consent-withdrawal signal on foreground).
- `app.json` + `package.json` — added `expo-background-task` 57.0.10, `expo-sensors` 57.0.2,
  `RECEIVE_BOOT_COMPLETED` permission (+ auto-added background-task config plugin).
- `docs/spec/PHASE-41.md` (41b/c/d), `docs/spec/PHASE-50.md` (new), `docs/PHASES.md`, `docs/DECISIONS.md`.
- `contracts/INBOX.md` — 2 `→ cgpe-api` asks filed (grepped back durable).

## Decisions made
- **41b: one watchdog covers OEM-kill AND reboot** (expo-background-task/WorkManager persists across reboot),
  so no hand-written Kotlin BootReceiver — boring over clever. Trade: reboot re-arm within ~15 min, not seconds.
  **Owner may veto** and ask for the native receiver.
- **41c: expo-sensors accelerometer classifier**, profile applied at each service (re)start, NOT mid-session
  (would fight 41b + flicker the notification). Honest limit: the sensor pauses in the background, so `still`
  rarely fires for a pocketed phone — §12.8 says MEASURE battery first. **Numbers proposed, pending owner lock:**
  STILL time-interval 5 min, still/moving threshold 0.05 g.
- **41d: drop mocks (not label)** — self-enforcing (a spoofer goes silent → the gap-detector flags them). The
  withdrawal signal is fail-safe against spurious master alerts (armed-gated, skips a failed permission read,
  fires once). App-block **trigger LOCKED** (block if any of services/fg/bg off) but the **screen needs 5-language
  copy**. Gap-detector is backend-owned → filed.
- **Phase 50: backend-first** (server 403s out-of-range today; reversing that is a contract change) + **office
  pins in the panel, not client literals** (Phase 7 removed exactly that) + unknowns flagged, not invented.

## Known broken / deliberately skipped
- **ALL of Phase 41 is DEVICE-UNVERIFIED** — needs a native EAS/dev-client build (new modules
  `expo-background-task` + `expo-sensors` + `RECEIVE_BOOT_COMPLETED` → **NOT OTA**), then the §12.7 matrix and the
  §3 battery measurement over a real day on 3+ handsets (Samsung/Xiaomi/OnePlus/Pixel).
- **41d app-block SCREEN not built** — needs owner 5-language HUMAN copy (proposed English is in `PHASE-41.md`
  §8/41d). Trigger is already locked; wiring is a small follow-up once copy lands.
- **Phase 50 not built** — awaits cgpe-api shipping the change + the panel pins set + the owner confirming the 5
  flagged points (`PHASE-50.md` §6).
- **`git push` still 403s** — EVERY commit this session is local-only (`71d15a3 b535c10 25d3d5b 1d75521 08dd00f
  a484f54 5fe05bc 2617c27 a5bc712 0885197`) + the 2 INBOX asks (contracts/ is untracked). Blocks Phase 49; needs a
  human credential swap.

## Next session starts here
- **Phase 41 device-verification pass (owner's #1) — cut a native APK, then walk the §12.7 matrix + measure
  battery.** Everything editor-side is done; this is pure build-and-verify. Do NOT cut the "final" APK (Phase 49)
  while checks are unverified or the push is broken.
- First command: `/boot`
- Watch out for: **Phase 41 added TWO native modules — a native build is mandatory, OTA cannot carry it.** And the
  two filed `[api]`s (gap-detector, Phase 50) need the owner to relay them to cgpe-api.
