# HANDOFF — CGPE Connect (Android) — Phase 18 BUILT (watchable E2E harness) — 2026-08-11

Phase 18 is built and green. The app now has a **watchable, A-to-Z, worst-case end-to-end test
harness**: one command opens a real browser that drives every web-reachable screen while you watch,
forces the worst backend states, hammers the forms with bad input, and records video + trace +
per-screen screenshots. Everything is offline and synthetic — **zero production data**. The spec's
headline risk (would the web build even boot?) is retired: it boots with **no app change**.

## Done
- **Phase 18 shipped, 33 Playwright tests green**, in a new `ANDROID/e2e/` tree kept outside `src/`:
  - `00-smoke` — the Expo **web** build boots and `/(auth)/login` renders with no redbox. **No web
    guard was needed** (`tracker.ts`/`biometricIdentity.ts`/`AppLock` already gate native modules).
  - `01-signin` — the backbone: mocked `/auth/login` (with CORS preflight), the real login form
    submits, home renders, and a deep-link re-boot restores the session from storage.
  - `10-walk-normal` — signs in against a healthy mock backend and deep-links to **all 42
    web-reachable screens**, asserting each renders (no redbox / not blank) with a per-screen
    screenshot. **42/42 render, 0 page errors.**
  - `30-worstcase` — **21 cases**: injects `500 / 503 / malformed / empty-200 / timeout / oversized`
    on representative data screens (leads, clients, claims, notifications) and asserts the screen
    still renders **and** the `<HealthBanner/>` obeys the data-health contract (an outage shows
    "could not load", never a fake empty; an oversized 200 renders the flood with no banner).
  - `40-forms` — **9 cases**: login bad-input (empty, whitespace-only, refused-credentials danger
    banner, network-failure offline banner, hostile/injection/emoji/RTL/over-length text,
    double-submit) + hostile input on search / task-new / claim-new (no crash, no redbox).
- **Two app-side edits only, both gate-isolation** (no screen touched): `tsconfig.json` excludes
  `e2e` (re-adding `node_modules` to the override), `eslint.config.js` ignores `e2e/**`.
- **Gates green:** `npx tsc --noEmit` exit 0; `npm test` **305/305** (14 files, unchanged);
  `npm run lint` **0 errors / 12 warnings** (Phase-15 baseline, unchanged).
- **Cleared the one open INBOX item** for `cgpe-mobile`: backend Phase 19 deleted the legacy
  `/api/users` identity store — grep-verified the app never called it, replied under the item
  (box left unticked — multi-recipient), grep-confirmed the reply persisted.

## Files changed
- **`e2e/` — new tree.** `playwright.config.ts` (headed by default, `HEADLESS=1` for CI; video +
  trace + screenshot on; port 8090; auto-starts/reuses the web server; `globalTeardown`);
  `tsconfig.json`; `tests/{00-smoke,01-signin,10-walk-normal,30-worstcase,40-forms}.spec.ts`;
  `helpers/{mock,session,render,artifacts,teardown}.ts`; `README.md`; `WEB-LIMITS.md`.
- **`tsconfig.json`** — added `exclude: ["node_modules","dist","e2e"]`.
- **`eslint.config.js`** — added `"e2e/**"` to `ignores`.
- **`.gitignore`** — ignore `e2e/artifacts/` (commit specs, ignore run output).
- **`package.json`** — `-D @playwright/test`; scripts `e2e` + `e2e:report`.
- **`../contracts/INBOX.md`** — one reply under the `/api/users`-deletion item (outside this git repo).
- **Docs:** this file, `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md`; memory
  `e2e-harness-phase18`.

## Decisions made (full reasoning in DECISIONS 2026-08-11, top)
- **Session mode is chosen by the login token prefix** — a `demo-` token runs the app fully offline
  (degraded rendering), any other token makes the mocked calls "real" so faults apply.
- **Healthy object/stat mocks are zero-FILLED, not `{}`** — several screens deref stat fields
  unguarded and crash on a partial object. (The app guards `null` but not `{}`; that is a real
  robustness class worth a future app fix, but it is out of scope for this test-infra phase.)
- **Worst-case + bad-input run on a representative set, not all 47** — the `<HealthBanner/>` is
  app-wide (mounted once, routed through `unavailable`/health), so the contract generalises. The
  selection is stated in `e2e/README.md` (no silent cap).
- **Detail-by-id reads 404** (a healthy backend has no record `e2e-1`) and synthetic ids are 24-hex
  so `api.ts` `healthKey()` collapses them and no false banner leaks.

## Known broken / deliberately skipped
- **~12 screens show a count=1 outage banner under the healthy walk** — from the home-dashboard
  widget prefetch that renders underneath a pushed stack screen on cold deep-links (all responses
  200 and valid; a timing/fidelity artifact, not a render failure). All 42 render. Recorded as info,
  not asserted. If Phase 19 wants pixel-clean healthy screenshots, this is the thread to pull.
- **Native-only surfaces are NOT covered** — `e2e/WEB-LIMITS.md` lists them: haptics, the
  AsyncStorage clock key + cold-start persistence, SecureStore biometric seal / `AppLock`, background
  GPS (`tracker.ts`), the native `LeafletMap`, the native base-URL branch. A green web run is the web
  slice, **not** "the whole app is verified." These stay on the handset backlog (Phases 1/4/5/6/7/9/
  10/12/13).
- **Salary (Phase 16) & commissions (Phase 6) — still backend-blocked** (unchanged): waiting for the
  backend to create a pay field + computed earnings endpoint and a commissions product aggregate.
- **`git push` still 403s** — credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. All commits this session are local and unpushed. Needs a
  human to grant access or swap the credential.

## Next session starts here
- **Phase 19 — language toggle across all 5 languages (incl. Hinglish / Gujlish).** Two parts:
  (1) the durable core — a **dictionary-parity Vitest** (all 5 dicts, same 74 keys, no blanks),
  buildable now with no device; (2) the visual per-language pass, which **now rides the Phase 18
  harness** — drive the language toggle in the browser and screenshot every screen per language
  (extend `10-walk-normal` with a language parameter, or add `50-languages.spec.ts`). Full path:
  `docs/spec/PHASE-19.md`.
- **First command:** `/boot`, then `npm run e2e` to watch the current harness before extending it.
- **Watch out for:** the language toggle is a per-user setting persisted at `cgpe.lang.<userId>`
  (`src/i18n/index.tsx`); to switch language in the harness you may need to drive Settings' language
  control (or seed the lang key) then reload — mirror how `session.ts` lets the app write its own
  storage rather than hand-seeding. Do **not** machine-translate missing strings (Phase 19 spec): a
  wrong Hinglish/Gujlish string is worse than an obvious English fallback — report gaps, don't guess.
