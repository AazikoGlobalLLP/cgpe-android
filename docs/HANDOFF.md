# HANDOFF — CGPE Connect (Android) — Phase 50 (data-layer BUILT) + Phase 41 (v1.9.0 APK cut) — 2026-08-17

Active session. Owner confirmed Phase 50's decisions, `cgpe-api` shipped it, mobile built the tested data-layer half;
then the owner re-prioritised: **the app-closed (background) location bug is now #1**, so a fresh **v1.9.0 native APK**
was cut for the device test. Also captured a batch of 6 new owner feature requests (triaged, mostly not yet built).

## Done
- **Phase 50 backend VERIFIED + mobile data-layer BUILT (commit `6b2da6f`, gates green: `tsc` 0 · `npm test` 576 · eslint 0 errors).**
  `cgpe-api` shipped Backend Phase 64; I read their real code field-for-field (not the ticked summary) — nearest-office
  fence, server-enforced `REASON_REQUIRED`, `EARLY_CLOCKOUT_GRACE_MIN=15`, n8n+in-app super_admin-only alert (no coords),
  `GET /geofence` additive `offices[]`. Mobile now: `getGeofence` reads `offices[]`; `checkGeofence` measures the
  **nearest** office (**fixes a real office-B pre-check lockout**); `clockIn`/`clockOut` thread an optional `reason` and
  map `REASON_REQUIRED` to a distinct `needsReason` outcome. NEW `api-clock.test.ts` + nearest-of-two cases.
- **Owner CONFIRMED all Phase-50 §6 decisions** (nearest-office auto, reason mandatory, 15-min early buffer, immediate
  mark, n8n→super_admin-only 3 accounts) — recorded in `contracts/INBOX.md` + `PHASE-50.md` (commit `217ca81`).
- **Two office pins LOCKED** (owner-supplied): Adajan `21.208267,72.839960` · Katargam `21.187084,72.797604` — in the
  INBOX ask + spec §1 (set in the panel/DB via `PUT /geofence` `offices[]`, NOT client literals). Commit `ddbb33e`.
- **App-closed location (owner #1): diagnosed + fixed-forward.** The 24/7 recorder was written but the installed APK
  predated its native modules (verified app.json perms/plugins + package.json deps are all committed/correct). Cut a
  fresh EAS preview APK **v1.9.0**, build `86c1406c`, direct APK handed to owner:
  `https://expo.dev/artifacts/eas/eUcZu5h738F4LbqmNqUHK7k2RZxE7FqlY14A6DY_VXk.apk` + a device checklist (Location=Allow-
  all-the-time, Battery=Unrestricted + accept the once-per-install popup, Auto-start ON). **Awaiting owner device test.**
- **n8n workflow behaviour spec** handed to the owner for their n8n dev (payload shape, super_admin-only routing, message templates).

## Files changed
- `src/data/api.ts` — `getGeofence` reads additive `offices[]`; `checkGeofence` measures the nearest office; `clockIn`/`clockOut` thread `reason` + map `REASON_REQUIRED`.
- `src/data/__tests__/api-geo.test.ts` — `offices[]` read + nearest-of-two cases (incl. the office-B lockout regression).
- `src/data/__tests__/api-clock.test.ts` — NEW: reason threading + `REASON_REQUIRED` / 403 / plain-error split.
- `app.json` — version `1.8.0` → `1.9.0` so the owner can confirm the new background-location build on-device.
- `docs/spec/PHASE-50.md` — §6 → CONFIRMED, §3 updated, §1 office coords, status line.
- `docs/PHASES.md`, `docs/DECISIONS.md` — board + decision record.
- `contracts/INBOX.md` (untracked — parent dir not git) — owner-confirmed §6 block + coords + mobile-verification reply under cgpe-api's ticked Phase-64 item.

## Decisions made
- **App-closed location is owner #1 and fixed-forward with a native APK (v1.9.0), not an editor patch** — it needs native modules a JS/OTA update can't add; the device-test + OEM battery/auto-start settings are owed by the owner (a device miss here is usually settings, not code).
- **App-installed signal = "recent location points"** (owner choice) — a member who recently sent points ⇒ app present. To be filed as a backend ask (verify real code first).
- **Office pins go in the panel/DB via `PUT /geofence` `offices[]`, never client literals** (Phase 7 rule).
- **Phase 50 home reason-prompt UI is deferred** — it needs 5-language HUMAN copy (machine translation forbidden) + a device; the tested data-layer seam is ready for it.

## Known broken / deliberately skipped
- **App-closed location is DEVICE-UNVERIFIED** — awaiting owner's on-device test of v1.9.0 with the settings applied.
- **Phase 50 home.tsx reason-prompt UI + 5-language copy** — not built (copy blocker + device); the `home.tsx:835` hard-refuse must become a Sheet prompt that re-sends with the reason.
- **Off-duty (ambient) points have NO mobile read path** — the red/green (Phase 42) + the map in/out-path toggle both need a NEW backend read; not filed yet.
- **2 backend asks still to file** (verify real code first): app-installed = recent-points signal; off-duty points read. Plus the mobile map toggles (satellite + points) are pure-mobile and unbuilt.
- **`git push` still 403s** — every commit (`217ca81`,`6b2da6f`,`8d0ffad`,`ddbb33e`) is local only.
- **Go-live for Phase 50** still needs owner/ops: set the two pins via `PUT /geofence`, set `N8N_ATTENDANCE_WEBHOOK_URL`, `:3001` restart.

## Next session starts here
- Phase 41 device-verify (owner #1): confirm the owner's v1.9.0 test result; then build the mobile map toggles (satellite + points) and file the 2 backend asks (app-installed=recent points, off-duty read for red/green + in/out).
- First command: `/boot`
- Watch out for: the app-closed fix needs the phone's **battery/auto-start settings**, not just the APK — a device miss is usually settings, not a code bug. And do NOT build the red/green or in/out-path map features until the **off-duty backend read exists** (the app cannot read ambient points today).
