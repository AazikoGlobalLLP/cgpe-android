@AGENTS.md

# CGPE Connect — Android (Expo SDK 57 · RN 0.86 · expo-router · TS strict)

Session name in `../contracts/INBOX.md`: **`cgpe-mobile`**.
Siblings: `../cgpe-backend-main` (`cgpe-api`), `../cgpe-front-main-RECOVERED` (`cgpe-admin`).
Start every session with `/boot`. Map: `docs/PROJECT_MAP.md`. Plan: `docs/PHASES.md`.

## Contracts
- ../contracts/ is the single source of truth for anything crossing frontend ↔ backend ↔ android.
- Never invent a field name, endpoint, status value, or error code. Read ../contracts/ first.
- Changing the contract = edit ../contracts/*, append to CHANGELOG.md, THEN change code.
- If code and contract disagree, the contract wins and the code is a bug.
- Base URL is `https://cgpe.in/internal/api`, so an app path `/leads` is backend `/api/leads`.
- `ADMIN_PANEL_SYNC.md` / `ADMIN_PANEL_GUIDE.md` are prose; where they disagree with `contracts/`,
  contracts wins (`contracts/CHANGELOG.md` lists 15 confirmed drifts).
- **`contracts/` is written concurrently by `cgpe-api` and `cgpe-admin` while you work.** `INBOX.md`
  went 4.7 KB → 25 KB inside one session. **Re-read immediately before editing**, and never conclude
  a file there is missing or empty from one directory listing — check again with an explicit path.
  Confirmed again 2026-08-10: item headings moved between two reads **minutes apart**, so
  **anchor every edit on surrounding text, never on a line number**, and expect an offset-based
  insert to land in the wrong item. `INBOX.md` went 77 KB → 103 KB inside the Phase 4 session
  alone. Answer questions addressed to `cgpe-mobile` even when they are not about your current
  phase — they block the sibling session's phase.
- **Put the answer under the box that is blocking.** Phase 4 found two `cgpe-mobile` boxes still
  open whose answer had been written weeks-equivalent earlier under a *different*, multi-recipient
  item — so `cgpe-api` read "mobile has not answered" and held a phase. Say it twice rather than
  once in the wrong place. Tick a box only when the item is addressed to this session alone;
  otherwise reply underneath and say why the box is left open.
- ⚠️ **A concurrent write can DELETE your replies, not just move them.** On 2026-08-10 `INBOX.md`
  went 116,824 → 111,088 bytes inside one boot, and the ~5.7 KB it lost was three `cgpe-mobile`
  Phase-4 replies — including **two ticked boxes that reverted to `[ ]`**, so `cgpe-api` would have
  read mobile as never having answered. **After writing to `INBOX.md`, grep your own reply back**
  (`grep -c "Phase N]" INBOX.md`) and re-write it if it is gone. There is no undo — see below.
- ⚠️ **`../contracts/` is not under version control by anyone.** The parent directory
  `CGPE-CURRENT-PROJECT/` is a git repo with **zero commits** and `contracts/` is untracked in it,
  so every INBOX reply exists only on that disk. Do not assume it is backed up, and do not create
  that first commit yourself — it would sweep three project trees into one repo.

## Commands
- `npx expo start --go` — Expo Go. **`--go` is required**; `expo-dev-client` is installed, so a bare
  `expo start` targets the dev build. `--tunnel` for a phone on another network.
- `npx expo start --web` — the only way to reach a localhost backend.
- `npx tsc --noEmit` — a green gate. Run before every commit.
- `npm test` — Vitest, 258 tests over 9 files, ~0.6 s, no network. The second green gate.
  Config is `vitest.config.mts`; the four `test/stubs/*` files exist only so native modules
  resolve in Node. `globals: false`, so every file imports `describe`/`it`/`expect`/`vi` from
  `vitest` explicitly. Some cases deliberately pin **known bugs** and live in `describe` blocks
  saying so — when a phase fixes one, that test going red is the signal, not a regression.
  Phase 3 flipped `api-renewals.test.ts:187` on purpose; Phase 4 flipped two `adapt.test.ts` cases;
  Phase 7 flipped both of `api-geo.test.ts`'s and **deleted that file's now-empty pinned block**.
  The only pinned-bug block left in the suite is `adapt.test.ts`'s `mapClaimStatus` pins.
  `src/lib/tracker.ts` has **no test coverage at all** — there is no `expo-location` or
  `expo-task-manager` stub, so the background recorder is only reachable by hand on a device.
  **A test that touches `src/data/api.ts` must `vi.resetModules()` and `await import('@/data/api')`
  inside `beforeEach`** — that module holds mutable state (`authToken`, `sessionReal`,
  `suppressed`, `state`) with no reset export, so a static import leaks one test into the next.
  `api-leads.test.ts`, `api-whatsapp.test.ts` and `api-renewals.test.ts` are the pattern to copy.
  Timers are faked, so a call that reaches `unavailable()` **must not be awaited directly** — hold
  the promise, `await vi.advanceTimersByTimeAsync(400)`, then await it, or the test times out on
  `wait()`.
- `npm run lint` — **green as of Phase 15 (2026-08-11): 0 errors, 12 warnings.** Rule is still
  **no new errors**. **Takes longer than 120 s**, so it exceeds the default tool timeout — run it in
  the background or raise the timeout, and read the count off the `✖ N problems (…errors, …warnings)`
  line. The React Compiler is enabled (`app.json` `experiments.reactCompiler:true`), so
  `eslint-plugin-react-hooks` v7 promotes its compiler rules to **errors**; three of them —
  `react-hooks/{immutability,refs,set-state-in-effect}` — are **disabled with a documented reason**
  in `eslint.config.js` because they fire on working Reanimated/Animated code and the app's
  effect→loader→setState data-fetch convention (a rewrite, not a bug). Do **not** re-enable those
  three without rewriting the flagged call sites, and do **not** silence `react-hooks/purity` (kept
  on) — fix its hits at source, as Phase 15 did for the one `Date.now()`-in-render case in `home.tsx`
  (`useState(() => Date.now())`).
- `npm run e2e` — **Phase 18 watchable E2E harness** (Playwright + Expo **web**, lives in `e2e/`,
  outside `src/` so it is invisible to the three gates — `tsconfig` excludes it, eslint ignores
  `e2e/**`, Vitest is scoped to `src/`, EAS never bundles it). Opens a real browser that walks all 42
  web-reachable screens A-to-Z and stress-tests them (injected `500/503/malformed/empty/timeout/
  oversized` + form bad-input), saving video+trace+screenshots to `e2e/artifacts/` (open
  `OPEN-ME.md`). Headed by default (`HEADLESS=1` for CI). Auto-starts/reuses the web server on port
  **8090** (not 8081). ALL traffic is synthetic Playwright mocking — never hits production. The Expo
  web build **boots with no app guard** (native modules already gate themselves for web). Cannot test
  native-only surfaces (haptics, background GPS, biometric lock, native map, cold-start persistence) —
  see `e2e/WEB-LIMITS.md`. `npm run e2e:report` opens the HTML report.
- `eas build -p android --profile preview` — the installable APK (`production` emits an AAB).
- `npm run reset-project` — **NEVER RUN.** Deletes `src/` and `scripts/`.

**git RESOLVED 2026-08-10 — do not re-diagnose it.** Every git command used to abort with
`detected dubious ownership in repository at 'F:/…/ANDROID'` (the directory is owned by a different
SID than the logged-in user), which is why Phases 1 and 2 went uncommitted for two sessions. The
one-time fix has been applied and is global, so git now works normally here:
`git config --global --add safe.directory F:/Shivam-Aaziko-Dev-MERN/CGPE-CURRENT-PROJECT/ANDROID`.
If it ever reappears (a new machine or a reset global config), re-run exactly that. It is **not** a
corrupt repo, and it is never fixed by re-cloning. Work on branch `Shivam`; never push to `main`.

**`git push` currently fails 403 and no amount of retrying will fix it.** The stored credential is
`reactjsaaziko`; the remote is `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`, and that account has no
write access. This needs a human to grant access or swap the credential in Windows Credential
Manager. Do **not** change the remote URL, rewrite history, or re-clone to work around it — commit
locally and say clearly in the handoff that the push is outstanding. `gh` is not installed here.

**Write commit messages to a file and use `git commit -F <file>`.** A multi-line `-m` here-string
breaks under PowerShell 5.1 as soon as the message contains a double quote: PowerShell splits it and
git reads the fragments as pathspecs (`error: pathspec 'could' did not match any file(s)`). The body
is left uncommitted and it looks like a git failure when it is a quoting failure.

## Conventions
1. Imports are `@/*` → `./src/*`. Zero `../` imports exist in `src/`; keep it that way.
2. Styling is inline objects off `const c = useTheme()`. `StyleSheet.create` appears exactly once
   (`ui/Splash.tsx`). Never a bare `fontWeight` — use `type()` / `<Txt weight>` / `<Metric>`;
   Android does not synthesise the Geist weights.
3. State is React Context only (`src/store`), fetched with a hand-rolled `let alive = true` or a
   `reqId` guard. No Redux/Zustand/react-query. `useData` exists but one screen uses it — not the norm.
4. A failed request NEVER fabricates data: resolve empty via `unavailable()` in `src/data/api.ts`,
   which reports to `src/data/health.ts` and raises the one global `<HealthBanner/>`. Screens branch
   their empty state on `useDataHealth().degraded` so "no clients" ≠ "could not load clients".
5. New route = drop a file in `src/app`. A new **tab** must be added twice: `<Tabs.Screen>` *and*
   `TAB_META` + `ORDER` in `src/app/(tabs)/_layout.tsx`.

## Danger zones
- `src/data/api.ts` (1744 lines, 56 importers) — `state` is a write buffer, not seed data.
  `setAuthToken` silently disables all network calls for a token starting `demo-`.
- `src/app/(tabs)/home.tsx` (1915 lines) — the only consumer of `useAppUi()`.
- `src/app/_layout.tsx:18` `import '@/lib/tracker'` is load-bearing; removing it kills background GPS
  on headless wakeups while foreground testing still passes.
- Provider order in `_layout.tsx`: `AppUiProvider` inside `AuthProvider`, `ToastProvider` inside
  `ConfirmProvider` (else `useToast()` is a silent no-op). **Phase 28:** `BrandTheme` sits inside
  `AppUiProvider` and re-provides the department-accented palette via `PaletteProvider` (`theme.tsx`)
  to everything below; the base `ThemeProvider` MUST stay on top. Do **not** "simplify" by moving
  `ThemeProvider` below `AppUiProvider` — it would un-theme the Confirm/Toast overlays. Accent maths
  is pure in `theme/brand.ts` (`deriveBrandPalette`, fail-open by reference); `theme.density` is
  parsed-but-ignored (deferred, see `docs/spec/PHASE-28.md` D-4).
- `store/appUi.tsx` `SCHEMA_FEATURE_DEFAULTS` mirrors `ui_rbac_config.json` **by hand** — drifts silently.
- `store/roles.ts` `tierOf()` grants Master by `user.role === 'super_admin'` (Phase 11,
  2026-08-11) — no email literal, but that means Master tier now lives entirely in the backend's
  `Profile.role` field. If Master unexpectedly reads as Admin/Team, that is a database row on the
  `cgpe-api` side, not a client bug — check `Profile.role` in `staff_unified` before touching this
  file. See `docs/spec/PHASE-11.md` D-4. **`tierOf()` folds `leader` INTO the `admin` tier** (so
  `caps.manageTeam` is true for a leader) — but several backend surfaces gated `authorize('admin')`
  **403 a leader** (payroll is the live example: `routes/payroll.js:22-23`). So any mobile surface that
  consumes an admin-only endpoint must gate on the **real** `user.role === 'admin'|'super_admin'`, never
  on `caps`/the tier, or a leader reaches the fetch and gets a 403 blank. Phase 20 (`app/payroll.tsx`)
  does exactly this; copy it. See `docs/spec/PHASE-20.md` D-3.
- Dead, do not maintain: `ui/kit.tsx`, `ui/characters.tsx`, `hooks/use-theme.ts`,
  `hooks/use-color-scheme*.ts`, `constants/theme.ts`, `src/global.css`, `data/mock.ts`.
- `HOW_TO_RUN.md` and `TESTING_GUIDE.md` were corrected in Phase 8 (2026-08-11) — they no
  longer describe an offline demo mode or a hand-editable localhost default. Keep them honest
  when `src/constants/config.ts`'s base-URL logic or the login path changes again.
- **i18n (`src/i18n/index.tsx`) — two traps before adding keys.** **75 keys** exist; ~6 files use `t()`
  substantially and — as of **Phase 21 P1 (2026-08-12)** — **16 more screens** wire a handful of shared
  `common.*` labels (`Call`/`Cancel`/`Delete`/`WhatsApp`/`Today`); ~40 screens are still ~100% hardcoded
  English (the full worklist + plan is scoped in `docs/i18n/`). **All net-new `common.*` keys (`tryAgain`
  ×34, `clearSearch`, `refresh`, the outage body, the a11y labels) still need human copy — do NOT wire them
  until gu/hi/hi-en/gu-en are supplied (PHASE-19 §4).** When wiring a shared label, reuse an existing key;
  add a new one only by lifting existing human copy (as `common.today` did from `tab.home`) or with supplied
  copy — never a machine guess. Some screens bind the translator to `tr` (not `t`) where a local `t` already
  exists (`tickets/index.tsx`, `notes.tsx`). (1) `t()` is now `t(key, params?)` (Phase 21 P0, 2026-08-11, `a7a0979`):
  named `{placeholder}` interpolation + count-plurals (`key_one`/`key_other`, CLDR by active language,
  falls back to base key). Use `t(key, {name})` / `t(key, {count})` for dynamic strings — **never string
  concatenation** (Hindi/Gujarati word order). Single-arg `t(key)` is unchanged. Pure seams
  `pluralCategory`/`interpolate`/`translate(…,lookup?)` are exported and tested in `__tests__/format.test.ts`.
  (2) The parity test `src/i18n/__tests__/dictionaries.test.ts` hard-codes `EN_KEYS.length === 75` (bump
  it deliberately when adding keys) **and** its leak check rejects only `value === key`, **not**
  `value === English` — so a Gujarati entry left as the English string **passes the suite green**. The
  test cannot certify translation happened; human copy is load-bearing and machine translation is
  forbidden (PHASE-19 §4).

## Done means
`npx tsc --noEmit` clean, `npm test` green, no new lint errors, and the affected rows of
`TESTING_GUIDE.md` walked by hand **on a device** (web does not exercise haptics, AsyncStorage
clock keys, or background GPS — and neither does `npm test`, which covers pure logic only).
