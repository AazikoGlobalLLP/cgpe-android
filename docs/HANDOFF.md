# HANDOFF — CGPE Connect (Android) — Final APK cut + on-device tested + H1/M1/M2/M3 fixed — 2026-08-19 (#4)

The 2026-08-19 batch (Phases 63/64/66/67) shipped in a combined APK **and was verified on real hardware** this session — the
app was driven over USB/ADB on the owner's Samsung A54 as the Master (super_admin) account. The new batch is **green on-device
and in a code audit**. A parallel code audit surfaced a real **HIGH latent bug** in the adjacent Phase-50 clock flow plus three
mediums; **all four are now fixed** and folded into a fresh APK.

## Done
- **Combined APK cut + delivered:** EAS `6b76608b`, v1.10.0, commit `da9e5a9`, direct `.apk`
  `https://expo.dev/artifacts/eas/K5bRx6VlgAUC2xxViT-NJHnnbuSMvNHqCGgrAeVN1WA.apk` — **supersedes `8f3238fa`**. Contains
  63/64/66/67 + the H1/M1/M2/M3 fixes below.
- **On-device verified (Master account, real A54):** Monitor on-duty **1/3 (not 0)**; agent-map "Live field status: 1" with no
  false banner; **Live location** honest last-known (10m ago, On duty, ±100m, real coords, "not a live ping"); **payroll-detail**
  full breakdown (the "0 days → ₹574" = 2.5h × ₹226 hourly); **Esri satellite + points** toggles; **team performance** 75/100
  (math checks out); greeting emoji; Viewing-as; Clients/360/Tasks/Claims/Notifications/Commissions; **outage banner honesty +
  clears on recovery**; i18n switch works (coverage gaps noted).
- **H1 FIXED** (`dfa10f2`): clock-in/out now handle the server's `REASON_REQUIRED` (out-of-range / early) → a mandatory reason
  Sheet → re-send with the reason. No more false "server could not be reached"; the agent can actually clock out.
- **M1/M2/M3 FIXED** (`95b0da2`): claims 403 classified (no false outage); matured policy no longer flagged premium-due/renewal
  (premium.tsx + clients.tsx, guarded at source); agent-map stale prior-day point no longer shown as live "on duty".
- Gates green throughout: `tsc` 0 · `npm test` **625** · eslint 0 new.

## Files changed
- `src/app/(tabs)/home.tsx` — H1: `toggleClock(reasonText?)` + `needsReason` branch on both clock paths + a reason `Sheet`
  (mirrors the Phase-52 break sheet) that re-sends the action; reason coerced to a string so the onPress event isn't misread.
- `src/data/api.ts` — M1: `getClaims` captures `status` + `reportIfOutage(status,'/claims')`. M3: `toPin(row,p,live=true)`;
  the `getAgentLocations` fallback passes `live=false` so prior-day points aren't "on duty".
- `src/data/adapt.ts` — M2: `isPremiumDueThisMonth` and the `renewal_due` segment now guard on `status !== 'matured'`.
- `docs/DEVICE-TESTING-GUIDE-v1.10.0.md` — NEW: full step-by-step device checklist (24 sections, edge cases, physical-only marks).
- `docs/DEVICE-TEST-FINDINGS-2026-08-19.md` — NEW: device + code-audit findings, APK links, fix status.
- `docs/PHASES.md`, `docs/DECISIONS.md` — status.

## Decisions made
- **Device testing IS possible over USB/ADB from here** (proven) — but it's black-box: no creds (owner logs in), and
  bg-GPS/geofence/biometric/real-writes can't be driven. See DECISIONS 2026-08-19 for the reusable how-to.
- **H1 fixed with a reason Sheet, English copy** — the whole home.tsx clock-notice surface is already hardcoded English, so this
  is consistent (not machine translation). Localise when the 5-language reason copy lands.
- **Phase-50 office geofence must NOT be enabled until H1 ships in an installed APK (done: `6b76608b`) AND the sheet is localized.**
  Until the fence is configured server-side, H1 is latent and can't be end-to-end device-tested.

## Known broken / deliberately skipped
- **Reason sheet is English-only** — needs the owner's 5-language reason copy (like consent/break) to localise. Not blocking install.
- **H1 not end-to-end device-verified** — the `needsReason` path only fires once the office geofence is configured on the server.
- **LOW/cosmetic items NOT fixed** — i18n coverage gaps (Settings/Claims/Search English; Home "tasks done today" / "Nothing is
  overdue…"), `inrShort` trailing zero, `toDate('0')`, `-₹0`, `mapClaimStatus` partial_paid (pinned), "Advisor" subtitle for the
  Master, in-app Version reads 1.8.0, FAB overlaps. Full list in `docs/DEVICE-TEST-FINDINGS-2026-08-19.md`.
- **Phase 65 (`[m]` full-staff roster) NOT built** — still the one open mobile piece; would need its own APK.
- **Physical tests owner-owed** — §5 bg GPS (clock out+in on THIS APK first), §3 geofence, biometric, break 8h30m gate, WhatsApp send.
- **`git push` still 403s** — every commit local (`dfa10f2`, `95b0da2`, `da9e5a9`, `27beb1c`).

## Next session starts here
- Phase: **localise the H1 reason sheet** (needs the owner's 5-language copy) — or clear the LOW/cosmetic list, or build **Phase 65**.
- First command: `/boot`
- Watch out for: **do NOT let the owner enable the Phase-50 office geofence until the `6b76608b` APK is installed AND the reason
  sheet is localized** — otherwise an out-of-range/early clock-out is fixed but still English-only for Gujarati/Hindi agents.
