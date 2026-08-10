# SPEC LOCK — Phase 2: A test runner, and the pure logic pinned

Status: **BUILT 2026-08-10.** Locked values below were chosen as defaults during the build rather
than approved one by one; every one of them is a technical choice with no product consequence, and
each is recorded here with the reason. Row 4 is the only one worth arguing about.

## The problem in one sentence

The project has **no test runner and no test file**, so every phase's DONE WHEN is a manual
walkthrough on a handset — which is exactly why Phase 1 shipped code-complete but unverified.

Verified absent before starting: no `*.test.*`, no `*.spec.*`, no `__tests__/`, no `jest.config.*`,
no `vitest.config.*`, no test script, and no test dependency in `package.json`. `npx tsc --noEmit`
is the only green gate today.

## SPEC LOCK — Phase 2

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | Which runner? | **Vitest 4.1.10**, `environment: 'node'` | `docs/PHASES.md` Phase 2 already names Vitest. Nothing under test renders, so jsdom/jest-expo/`@testing-library` would all be machinery bought for nothing. Vitest's engines field is `^20 \|\| ^22 \|\| >=24`; this box is Node 26.5.0 |
| 2 | How do native imports get resolved? | Four **alias stubs** under `test/stubs/` (`react-native`, `@react-native-async-storage/async-storage`, `expo-local-authentication`, `expo-secure-store`), declared in `vitest.config.ts` only | `react-native@0.86`'s entry is Flow syntax that esbuild cannot parse. The alias is a resolution fix, not a behavioural one — no stubbed byte sits between a test and the function under test |
| 3 | `vi.mock` or aliases? | **Aliases only. Zero `vi.mock` calls** | Every blocker is module *resolution*. Solving it once in config beats repeating a hoisted mock in every file and forgetting it in the next one |
| 4 | `appUi.tsx` needs 4 stubs only because of two value imports `normalizeUiConfig` never uses. Extract it to a dependency-free module instead? | **No. Stub, do not refactor.** | Extracting `normalizeUiConfig` into `src/store/appUiNormalize.ts` would drop appUi from four stubs to zero and is the cleaner end state — but it is a source change to a file Phase 10 will rewrite anyway, and Phase 2's job is to build the gate, not to move code through it. **Flagged, not chosen silently.** Reconsider during Phase 10 |
| 5 | What do the tests assert — correct behaviour or current behaviour? | **Current behaviour, always.** A case that pins a known bug says so in its name and lives in a `describe` block marked as such | A test asserting the *fixed* behaviour would make Phase 4/7 land red for the wrong reason, and would be red today for no reason. Pinning today's behaviour is what makes a later change *visible* |
| 6 | Timezone dependence | **Every expectation is constructed locally** (`new Date(y, m, d).toISOString()`), never written as a UTC literal. `TZ: 'Asia/Kolkata'` is set in config as belt-and-braces, but no assertion depends on it | `scanRenewals` is local-time end to end (`api.ts:651,663-664`) and serialises to UTC (`:673`). A hardcoded `'2026-12-31T18:30:00.000Z'` passes in IST and fails in UTC. Constructing the expectation the same way the code does is TZ-independent by construction |
| 7 | `src/data/api.ts` module state | `vi.resetModules()` + a fresh `await import()` in `beforeEach`, and geofence cases in a **different file** from renewal cases | `_geoCache` (`api.ts:1037`), `sessionReal` (`:46`), `state` (`:152`) and three Maps have no reset path. Vitest isolates per *file*, not per test, so without this the first `checkGeofence` call pins the fallback for every later case in the file — which would pass for the wrong reason |
| 8 | Test discovery glob | `src/**/__tests__/**/*.test.ts` | The repo vendors 50+ real `*.test.ts` files under `.agents/skills/gstack/test/`. Vitest's default include would collect all of them |
| 9 | Coverage tooling | **None.** No `@vitest/coverage-v8` | A coverage number on 5 functions out of a 1744-line module measures nothing useful and invites chasing the percentage instead of the risk |

## OUT OF SCOPE (will NOT build)

- Any component/render test. No `@testing-library/react-native`, no `react-test-renderer`.
- `AppUiProvider`, `useAppUi`, `visibleWidgetsOf`, `canIn` — provider tests need React rendering
  and a mocked `api.getAppUiConfig`. Their own phase.
- The **real** `/time-tracker/geofence` fetch path (`api.ts:1042-1043`). Reaching it needs
  `setAuthToken` + a fetch stub + a guaranteed-cold `_geoCache`; a test that gets any of the three
  wrong passes for the wrong reason. Add it once the runner is proven.
- A cross-repo contract test reading `ui_rbac_config.json` at test time to catch
  `SCHEMA_FEATURE_DEFAULTS` drift. Worth doing; its own decision, its own file.
- Fixing any bug a test pins. Phase 2 pins; Phase 4 and Phase 7 fix.

## ACCEPTANCE CRITERIA (binary, testable — no handset needed)

- [x] `npm test` exits 0. **140 tests across 5 files**, 385 ms.
- [x] Coverage by function: `adapt.ts` mappers, `distanceMeters`, `checkGeofence`, `scanRenewals`
      date rollover, `taskProgress`, `normalizeUiConfig`.
- [x] `npx tsc --noEmit` exits 0 **with the new files in the program** — `tsconfig.json` include
      is `**/*.ts` plus a `.mts` glob added for the config, and the inherited exclude lists
      `jest.config.js` but nothing of ours.
- [x] `npm run lint` reports 61 problems / 46 errors / 15 warnings — byte-identical to the
      documented baseline, so no new errors. Verified the new files are *linted and clean*, not
      merely unmatched, by running `npx eslint` against them directly.
- [x] Nothing under `src/app` imports `test/`, so Metro cannot bundle a stub.
- [x] **No test performs real I/O.** The two files that could both neutralise `fetch`:
      `api-geo.test.ts` installs a `fetch` that THROWS (any call is a bug in the test, and the
      "never called" assertion is what proves `tryReal` short-circuits), and
      `api-renewals.test.ts` stubs it entirely. `adapt` and `tasks` reach no network code at all.
- [x] **The suite is not vacuous.** Verified by mutation: changing the `in_progress` fudge from
      `0.5` to `0.6` and adding a `Math.round(... * 100) / 100` to `taskProgress` turned 3 tests
      red with the right messages; both mutations were then reverted and the suite is green.

## Deviations from the plan in `docs/PHASES.md`

Both are additive; neither drops anything the phase promised.

1. **Five test files, not three.** `scanRenewals` was split out of `api-geo.test.ts` into
   `src/data/__tests__/api-renewals.test.ts`, and `taskProgress` got its own
   `src/data/__tests__/tasks.test.ts` (the plan listed no file for it). The split is the point:
   the renewals file must stub `fetch`, and the geofence file asserts `fetch` is *never* called —
   sharing a file would let one file's stub silently satisfy the other's forbidden request.
2. **`vitest.config.mts`, not `.ts`.** This package is CommonJS, so Vite loads a `.ts` config
   through its CJS loader and warns on *every run* that the ESM syntax in it is unsupported by
   the loader that becomes the default in a future Vite major. `.mts` removes the warning for the
   right reason instead of suppressing it. `"**/*.mts"` was added to `tsconfig.json` include so
   the file is still type-checked. Note `expo lint` does not match `.mts`, so the config is
   linted by nothing — `tsc` is its only gate.

## RISKS

- **A stub becomes the thing under assertion.** Today it cannot be: `Platform` is dereferenced only
  at `constants/config.ts:45` and `api.ts:1277` (`uploadFile`), and none of the five functions
  touches either. The moment someone tests `AppUiProvider` or the auth store, that changes. Guard:
  keep the alias list at four, and treat *any* new export added to a stub as a signal the test has
  drifted out of pure-logic territory.
- **`scanRenewals`' request URL is stub-selected.** `Platform.OS = 'android'` makes
  `config.ts:44-52` choose `PROD_API`. Mitigated by asserting on the path suffix, never the full URL.
- **`npx tsc --noEmit` now type-checks the tests.** A type error in a test blocks the commit gate.
  That is the intended trade, but it is a new way for the gate to go red.
- **`normalizeUiConfig` returns `DEFAULT_UI`'s own arrays by reference** (`appUi.tsx:257,263,264`)
  and nothing is frozen. A test that mutates a returned config poisons `DEFAULT_UI` for every later
  case in the file. Tests treat every returned config as read-only.
