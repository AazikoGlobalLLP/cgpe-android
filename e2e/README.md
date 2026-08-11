# CGPE Connect — watchable E2E harness (Phase 18 · language walk Phase 19)

Playwright drives the Expo **web** build in a real browser you can **watch**, walks every
web-reachable screen A-to-Z, forces worst-case backend states, and hammers the forms with bad
input. It records a video + trace + per-screen screenshots so you can re-watch afterwards.

Everything here lives **outside `src/`** and is invisible to the app's gates (`tsc`, Vitest, EAS,
lint). No test ever touches a real backend — every response is synthetic Playwright mocking, so
**zero production data** is read or written.

## Run it (watch live)

```bash
npm run e2e
```

A Chromium window opens and drives the app while you watch. The dev server (`expo start --web`)
is started automatically on port **8090** and reused if already running. First run compiles the
web bundle (~50s), so give it a moment.

- **Headless / CI:** set `HEADLESS=1` first — `HEADLESS=1 npm run e2e` (bash) or
  `$env:HEADLESS=1; npm run e2e` (PowerShell).
- **One spec:** `npm run e2e -- 10-walk-normal` (or `-g "leads"` to filter by title).
- **See the report:** `npm run e2e:report` (opens `e2e/artifacts/report`).

## What runs

| Spec | Covers |
|---|---|
| `00-smoke` | The web build boots and `/(auth)/login` renders without a redbox (Phase 18 step 1). |
| `01-signin` | The backbone: mocked login + CORS, real form submit, home render, deep-link session restore. |
| `10-walk-normal` | A-to-Z: signs in healthy, deep-links to all 42 web-reachable screens, asserts each renders + screenshots it. |
| `30-worstcase` | Injects 500 / 503 / malformed / empty-200 / timeout / oversized on representative data screens; asserts the screen still renders **and** the `<HealthBanner/>` obeys the data-health contract. |
| `40-forms` | Login bad-input matrix (empty, whitespace, refused, network, hostile text, double-submit) + hostile input on search / task-new / claim-new. |
| `50-languages` | **Phase 19.** For EACH of the 5 languages (en, gu, hi, hi-en, gu-en): drives the real Settings language toggle, asserts it applies live **and** survives a reload, then walks all 42 screens and screenshots each into `screens/languages/<code>/`. Asserts no raw i18n key leaks through (DONE-2). One test per language (a failure names the language). ~3 min/language, so the full matrix (210 screens) is ~15 min — run one at a time with `-g "Hinglish"` while iterating. |

### What the language walk does and does not prove

- **Proves:** the toggle works and persists (web); all 42 screens render in every language with no
  raw key leaking; the per-language screenshots exist for a human to review.
- **Does not prove — needs your eyes (Phase 19 DONE-4/5):** that Hinglish/Gujlish read *naturally*.
  Open `screens/languages/hi-en/` and `screens/languages/gu-en/` and read them. A machine cannot
  judge this, and by spec must not fail the build on a naturalness guess.
- **Known coverage reality:** only the **74 keys wired to `t()`** change with the toggle (tabs, the
  Today/home widgets, quick actions, common buttons, premium, report, sign-out, and two settings
  labels). Large parts of many screens are **hardcoded English** and stay English in every language —
  visible e.g. on the Settings body. That is the *current app*, not a toggle bug; widening `t()`
  coverage is a separate, larger piece of work. The dictionary-parity Vitest
  (`src/i18n/__tests__/dictionaries.test.ts`) is the durable gate for those 74 keys.
- **Cold-start caveat:** a web `page.reload()` is a fresh boot from the same localStorage — the honest
  web equivalent of a cold start, but not the OS killing the process. The real-restart persistence
  check stays a handset item (see `WEB-LIMITS.md`).

## Artifacts

After a run, open **`e2e/artifacts/OPEN-ME.md`** — it indexes the report, the video/trace, the
per-screen stills (`screens/normal|worst|forms/*`), and **`WHAT-WEB-CANNOT-REACH.md`**, the list of
native-only surfaces this web run does **not** verify (haptics, background GPS, biometric lock, the
native map, cold-start persistence). A green run is the web slice — those rows still need a handset.

## How the mocking works (helpers/)

- **`mock.ts`** — intercepts `**/api/**` with CORS + preflight. `installBackend(page, 'healthy'|'demo')`:
  a `demo-` login token makes the app run fully offline (degraded/empty rendering); any other token
  makes real (mocked) calls so faults take effect. `installFault(...)` overlays a single endpoint with
  a hostile response. Shapes match `src/data/api.ts`'s validators.
- **`session.ts`** — `signIn` drives the real login form against the mock, so the app writes its own
  session and later deep-links restore it.
- **`render.ts`** — `assertRenders` (no redbox / not blank) + the 42-route inventory. `assertRenders`
  takes an opt-in `{ settleSplash: true }` (used by `50-languages`) that waits for the animated Splash
  overlay to dismiss before the shot, so the screenshot — and the body text a caller scans — is the
  real screen, not the logo. Off by default, so the other specs are unchanged.
