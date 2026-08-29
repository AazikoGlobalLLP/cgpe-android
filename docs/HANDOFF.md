# HANDOFF — CGPE Connect (Android) — Store-deployment track (session 1) — 2026-08-29

> This session opened a **new track**: the App Store + Google Play deployment program, from the owner's
> spec `CGPE_Connect_App_Store_Play_Store_Developer_Deployment_Spec.md`. It is **separate** from the i18n
> phase track (which is at Phase 84). The i18n `## Now`/`## Next 3` in `PHASES.md` still stand.

## Done

- **The deployment spec was verified word-by-word against the real code** (8-agent read-only audit, 0 errors,
  every finding cited to file:line). Result: the app is **~90% already built and correct** for store
  submission. Of the spec's 12-phase program: 2 done, 1 code-remaining (now fixed), 4 partial/verify, 5 blocked
  by external accounts/quota/assets.
- **Section-5 boundary bug is fixed.** A 24/7-armed member's pre-clock-in *off-duty* GPS points are no longer
  filed under the shift — they route to the ambient dataset. It is a **no-op for non-24/7 users** and falls back
  to the exact old behaviour when the clock-in instant is unknown. Proven by first-ever tracker attribution unit
  tests. (Runtime is device-only — needs a handset walk-through before it reaches a phone.)
- **The app now reports its real version** (1.10.0) on the in-app About screen — it was showing 1.8.0.
- **A store-submission evidence folder exists** (`docs/store-release/1.10.0/`) — permissions map, data map,
  retention proof, consent copy, secrets scan, and ready-to-adapt Play/Apple declarations + demo-video script.
- **The spec's ~10 stale/wrong claims are corrected** in an appended "Verification Errata (2026-08-29)" section.
- Verified live: the 90/180-day location retention job **is on the backend's deployed `origin/main`** (`990c660`).

## Files changed

- `src/lib/boundaryAttribution.ts` — **new** pure, device-free helper `partitionShiftPoints` (the correct split).
- `src/lib/__tests__/boundaryAttribution.test.ts` — **new** exhaustive tests (before/at/after clock-in, straddle, unknown boundary, bad clock).
- `src/lib/tracker.ts` — persist `sidStartedAt`; `ingest()` splits the batch at the boundary and routes each partition to its endpoint; retire the boundary on clock-out.
- `src/constants/config.ts`, `package.json`, `package-lock.json` — version reconciled to 1.10.0.
- `docs/store-release/1.10.0/**` — **new** store-submission evidence folder.
- `CGPE_Connect_App_Store_Play_Store_Developer_Deployment_Spec.md` — Verification Errata appended (**on disk, deliberately not committed** — owner's working doc).

## Decisions made

- **Target both stores; ship privately** (Managed Google Play private app + Apple Business Manager Custom App) — owner will buy the Apple account. Private org distribution removes the biggest risk (public review of a 24/7 employee-tracking app) while keeping the feature unchanged. EAS builds/submits iOS from the cloud, so **no Mac is needed** — only an iPhone for QA.
- **Implement the boundary split** (owner said "depend on you") — it strengthens the shift/ambient separation the store story rests on, and it is safe (no-op for non-24/7 users).
- **Keep the split scoped to the clock-IN direction.** The reverse clock-out spill (a few trailing shift points landing as ambient in a dead zone) is documented residual — a heavier recorder-lifecycle change, low impact.

## Known broken / deliberately skipped

- **Boundary fix is unverified on a device** — `tracker.ts` is device-only and no APK can build until the EAS quota resets (1 Sep). It MUST be walked on a handset during device QA before it ships.
- **Consent-language recording** — deliberately NOT coded. It needs a backend-defined field name; adding a guessed one would be a dead zero-consumer key. File it as a contract item when pursued (no INBOX entry added — non-blocking).
- **FGS stale-notification refresh** — documented, not coded. The fix restarts the location service, which fights the owner-locked reliability design; it is a rare edge case. See the errata + `store-declarations.md`.
- **Permission stripping** (`ACTIVITY_RECOGNITION`, iOS `NSMotionUsageDescription`) — documented as review items, not stripped (would risk the accelerometer/motion classifier).

## Next session starts here

- **Store-deployment track:** everything code-side that can be done without a build/account/asset is done. The next moves are **owner/ops** (Apple account, EAS submit creds, FCM key, public pages, store assets) — see `docs/store-release/1.10.0/README.md`. The next *engineering* step is the **1-Sep APK**, which carries BOTH the i18n work and this boundary fix, and is where the boundary fix gets its device QA.
- **i18n track (unchanged):** Phase 85 — Batch 6b or the `home.tsx` nav-catalogue free win. First command: `npm test`.
- **Watch out for:** the boundary fix touches `tracker.ts`, the device-only load-bearing recorder. Do not "tidy" `sidStartedAt` away, and do not ship it to a phone without the handset walk-through (clock in, move, clock out with points buffered across each boundary → confirm attribution).
