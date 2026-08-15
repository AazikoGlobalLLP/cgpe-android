# HANDOFF — CGPE Connect (Android) — Phase 48 — 2026-08-15

Phase 48 (`[sec]` biometric-only session restore) went the full arc in this session: verified the gap →
owner-locked the model → filed the `[api]` ask → cgpe-api shipped it (Backend Phase 58) → verified their
real code → **built + tested the mobile restore flow.** It is code-complete; only an on-device + security
review against the running server remains (needs cgpe-api's `:3001` restart).

## Done
- **A user who returns days later, logged-out, can get back into their OWN account with fingerprint/face
  only — no id/password/OTP.** The login screen shows an "Unlock with fingerprint" affordance when a sealed
  credential from a prior login exists; tapping it restores the same account.
- **The safe rule holds both ways:** biometric restore works only after a session *silently* expired. If the
  user deliberately taps **Log out**, restore is refused and a full login is required — enforced on the phone
  (the sealed credential is destroyed) AND on the server (the refresh credential is revoked).
- Backend was verified perfect before any mobile code: the re-mint endpoint is public, refuses a replayed
  access token, rotates on every use, revokes the whole chain on reuse, and auto-expires after 30 days.
- All three gates green: `tsc` 0 · `npm test` **513/513** (+18) · eslint 0 errors (3 pre-existing warnings).

## Files changed
- `src/lib/biometricIdentity.ts` — the biometric-sealed value is now the **30-day refresh token**, not the
  24h access token (`BoundIdentity.refreshToken`); `RECORD_VERSION` bumped **1→2** so old v1 records (holding
  a dead access token) are orphaned fail-closed. All install-scope / reinstall / enrolment-change hardening
  untouched — only the sealed secret changed.
- `src/data/api.ts` — NEW `refreshBiometricSession(refreshToken, deviceId?)` (three-outcome `ok`/`declined`/
  `error` over public `req()`; a partial 200 → `error`, never a session; 400/401 → `declined` with no expiry
  cascade since no bearer is sent) + `serverLogout(refreshToken?)`; `login`/`verifyOtp` thread `refresh_token`.
- `src/store/auth.tsx` — `persist()` re-seals the refresh token on every auth + stores a plaintext copy for
  revoke-only; NEW `restoreBiometricSession()` + `canBiometricRestore()`; `logout()` revokes server-side before
  `clear()`; `clear()` drops `REFRESH_KEY`; `setBiometric` seals the refresh token (and no longer refuses the
  toggle when a session has none). Silent expiry still does NOT clear the binding.
- `src/app/(auth)/login.tsx` — gated "Unlock with fingerprint" affordance (+ "or sign in" divider) → restore.
- `src/data/__tests__/api-refresh-biometric.test.ts` — NEW (18) — pins the wire contract + the three outcomes.
- `docs/spec/PHASE-48.md` §6, `docs/PHASES.md` (Now), `docs/DECISIONS.md` (×2), `contracts/INBOX.md` (filed +
  verified note) — the paper trail.

## Decisions made
- **Seal the 30-day refresh token, not the 24h access token** (owner-locked model). The access token dies
  before the "2 days later" scenario, and the server refuses a non-refresh token (`typ:'refresh'` check), so
  sealing it would be dead weight. `RECORD_VERSION` 1→2 orphans old records fail-closed.
- **Backend chose the refresh-token allow-list, not the simpler sliding-session** — because only the allow-list
  can be revoked server-side, which is what "an explicit logout forces a full login" (D-2) requires on the wire.
- **`restoreBiometricSession()` requires a rotated credential on the 200** — a partial body is treated as a
  fault (`error`), never a session, so the keystore never keeps a token the server just revoked.
- **JS-only build, no new native module/permission** — stays OTA-eligible for Phase 49.

## Known broken / deliberately skipped
- **Device + security review NOT done** — needs cgpe-api's `:3001` restart so the new endpoint is live, then a
  real handset: restore after a real >24h expiry; explicit-logout blocks restore; >30d refused; cross-device
  rejection; enrolment-change fail-closed. Not editor-verifiable (`biometricIdentity.ts`/`tracker.ts` are
  device-only; `expo-secure-store` biometric gates never run in Node/web).
- **`device_id` binding not wired** — v1 is user-bound only (no stable install id sent). cgpe-api's design
  (row + request must BOTH carry it) makes adding it later non-breaking.
- **`git push` still 403s** — every commit this session (`8aa9fbd`, `1375de2`) + all prior is local-only;
  credential `reactjsaaziko` has no write access. **This blocks Phase 49** and needs a human credential swap.
- Carried device/backend checks unchanged from prior phases: 41 part-2 (24/7 recorder), 42 (route colouring),
  43 (geofence), 45 (both performance screens, needs `:3001` restart), 46 (emoji alignment).

## Next session starts here
- **Phase 49 — final APK + one-click link, then OTA-only — is the LAST phase, but it is GATED, not
  editor-buildable yet.** Pre-flight (all must be true first): every device-verification check above cleared on
  a real handset, AND the `git push` 403 resolved (a production build must ship from pushed, backed-up code).
  Until those, there is no new editor code — the remaining work is on-device verification + the ops fixes.
- First command: `/boot`
- Watch out for: **do not cut the "final" APK while checks are unverified or the push is broken.** Also, Phase
  41 already added a native module (`expo-intent-launcher`), so at least one more native APK build is due
  before "final" — OTA covers only JS/asset updates, never a native change (`docs/PLAN-2026-08-14.md` §49).
