# HANDOFF — CGPE Connect (Android) — Phase 2 — 2026-08-10

## Done

- **`npm test` exists and is green: 140 tests, 5 files, ~0.4 s, exit 0.** The project went from
  zero automated coverage to two green gates.
- The logic that decides **who gets contacted about a renewal** is pinned: `scanRenewals`' year
  re-projection now has tests for the 31 Dec → 1 Jan roll, a 29 Feb anchor in a non-leap year,
  both sides of the month-end boundary, "due today", and both sides of the inclusive N-day window.
- The logic that decides **whether someone may start their shift** is pinned: `distanceMeters`
  against a closed-form meridian arc, and `checkGeofence`'s allow/deny boundary, its 100 m accuracy
  cap, and the fact that it currently fails **closed** when the geofence config is unreachable.
- The logic that decides **what a field agent sees on their dashboard** is pinned:
  `normalizeUiConfig` against null, primitives, arrays, `{}`, unknown widget keys, duplicate keys,
  seven `max_items` coercions, wrong-typed feature flags and a half-written theme.
- Every `adapt.ts` mapper is pinned, including the four values it **synthesises** (client segments,
  claim docs, claim timeline, lead notes).
- **The suite is proven non-vacuous.** Mutating `taskProgress` (0.5 → 0.6, plus rounding) turned
  three tests red with the correct messages; both mutations were reverted and the suite is green.
- `npx tsc --noEmit` exits 0 with the tests and config inside the program. `npm run lint` is
  61 problems / 46 errors / 15 warnings — byte-identical to the baseline.

## Files changed

- `package.json` — added `test` / `test:watch` scripts and the `vitest` + `@types/node` devDeps.
  Nothing removed; `main`, `dependencies` and every existing script untouched.
- `tsconfig.json` — added a `.mts` glob to `include` so the Vitest config is still type-checked.
- `vitest.config.mts` **(new)** — `environment: 'node'`, include scoped to
  `src/**/__tests__/**/*.test.ts`, four native-module aliases, and the two `tsconfig` path aliases
  mirrored by hand. `.mts` and not `.ts` — see Decisions.
- `test/stubs/react-native.ts`, `async-storage.ts`, `expo-local-authentication.ts`,
  `expo-secure-store.ts` **(new)** — resolution-only stubs. Deliberately tiny; each one documents
  exactly which source line forced it to exist.
- `src/data/__tests__/adapt.test.ts` **(new, 68 tests)** — every mapper and the five date predicates.
- `src/data/__tests__/api-geo.test.ts` **(new, 18 tests)** — `distanceMeters`, `getGeofence`,
  `checkGeofence`. Installs a `fetch` that **throws**; the "never called" assertion is what proves
  `tryReal` short-circuits.
- `src/data/__tests__/api-renewals.test.ts` **(new, 16 tests)** — `scanRenewals`. The only file
  that stubs `fetch` with a working response.
- `src/data/__tests__/tasks.test.ts` **(new, 10 tests)** — `taskProgress`.
- `src/store/__tests__/appUi.test.ts` **(new, 28 tests)** — `normalizeUiConfig`.
- `docs/spec/PHASE-2.md` **(new)** — spec lock, 9 locked rows, acceptance criteria, and the two
  deviations from the file list in `PHASES.md`.
- `docs/PHASES.md`, `docs/PROJECT_MAP.md`, `CLAUDE.md` — Phase 2 marked done; the "no test runner"
  and "tsc is the only gate" claims corrected everywhere they appeared.
- `../contracts/INBOX.md` — annotated the shared `contracts/ now exists` item to record that the
  mobile side picked it up. **Box left unticked**, because that item is addressed to `cgpe-admin`
  as well and the protocol forbids ticking someone else's box.
- `src/data/tasks.ts` — **touched and reverted.** Mutated deliberately to prove the suite catches a
  regression, then restored byte-for-byte. Verified green afterwards.

## Decisions made

- **Tests pin TODAY'S behaviour, bugs included.** ~20 cases assert wrong-but-current results and
  live in `describe` blocks named *"pinned known bugs — these must be updated deliberately when
  fixed"*. Asserting the *fixed* behaviour would have made the suite red today for no reason and
  would have made Phase 4 land red for the wrong reason.
- **Stub at the module boundary; do not refactor to make testing easier.** `normalizeUiConfig`
  needs four stubs only because of two value imports it never uses. Extracting it into a
  dependency-free module is the cleaner end state and was **flagged, not chosen silently** — it is
  a source change to a file Phase 10 rewrites anyway.
- **Geofence and renewal tests live in separate files** so one file's `fetch` stub cannot satisfy
  the other file's forbidden request.
- **No time expectation is written as a UTC literal.** Every one is constructed with the same
  local-time `new Date(y, m, d)` the code uses, so nothing depends on the machine's timezone.
- **`vitest.config.mts`, not `.ts`**, so Vite stops warning on every run for the right reason
  instead of the warning being suppressed.

## Known broken / deliberately skipped

- **Phase 1 acceptance criteria 1–6 are STILL UNVERIFIED, and Phase 2 does not cover them.** They
  are haptics, an AsyncStorage clock key and background GPS — a Node test cannot reach any of them.
  They still need a handset in airplane mode.
- **Coverage is five functions, not the app.** Every screen, every provider, every write path,
  `AppUiProvider`, `useAppUi` and the whole of `src/ui` have zero coverage. A green `npm test` says
  the pure logic is unchanged; it says nothing about whether the app works.
- **The real `/time-tracker/geofence` fetch path is not covered** (`api.ts:1042-1043`). Reaching it
  needs `setAuthToken` + a fetch stub + a guaranteed-cold `_geoCache`, and a test that gets any of
  the three wrong passes for the wrong reason. Deliberately deferred until the runner is proven.
- **No drift guard on `SCHEMA_FEATURE_DEFAULTS`.** It is restated by hand in `appUi.test.ts`, which
  catches a change to the *code* but not a change to `ui_rbac_config.json`. A real guard has to read
  the JSON at test time, which makes it a cross-repo contract test — its own decision.
- **`expo lint` does not match `.mts`**, so `vitest.config.mts` is linted by nothing. `tsc` is its
  only gate.
- **`.easignore` still uploads `test/` and `__tests__/` in the EAS archive.** Harmless — Metro never
  bundles them — and left alone because an EAS build cannot be verified from this machine, and a
  wrong ignore pattern is far worse than a few KB.
- **Nothing is committed.** `git` was permission-denied in this session, and this working copy also
  reports *dubious ownership* to git. See the next section.

## Next session starts here

- **Phase 3:** repair the data-health honesty channel — `tryReal` never calls `reportFailure` so
  ~13 endpoints fail silently, `reportSuccess` wipes the whole failure list instead of clearing one
  endpoint, and `getTeamActivity` fabricates an outage on every Team screen load.
- **First command:** `npm test` — confirm the 140 still pass before touching anything.
- **Watch out for:** Phase 3 edits `src/data/api.ts` and `src/data/health.ts`, and
  `api-renewals.test.ts` asserts `getHealth().degraded === false` after a failed `scanRenewals`
  page. **That test is supposed to go red the moment `scanRenewals` starts reporting failures — it
  is the finding, not a regression.** Read the comment on the case before you change it, and update
  the expectation deliberately.
