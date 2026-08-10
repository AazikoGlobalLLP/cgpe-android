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

## Commands
- `npx expo start --go` — Expo Go. **`--go` is required**; `expo-dev-client` is installed, so a bare
  `expo start` targets the dev build. `--tunnel` for a phone on another network.
- `npx expo start --web` — the only way to reach a localhost backend.
- `npx tsc --noEmit` — a green gate. Run before every commit.
- `npm test` — Vitest, 140 tests, ~0.4 s, no network. The second green gate (Phase 2).
  Config is `vitest.config.mts`; the four `test/stubs/*` files exist only so native modules
  resolve in Node. ~20 cases deliberately pin **known bugs** and live in `describe` blocks saying
  so — when Phase 4 or Phase 7 fixes one, that test going red is the signal, not a regression.
- `npm run lint` — 46 errors on a clean tree. Rule is **no new errors**, not zero.
- `eas build -p android --profile preview` — the installable APK (`production` emits an AAB).
- `npm run reset-project` — **NEVER RUN.** Deletes `src/` and `scripts/`.

**git in this working copy fails before it starts.** Every git command aborts with
`detected dubious ownership in repository at 'F:/…/ANDROID'` — the directory is owned by a
different SID than the logged-in user. One-time fix, then git works normally:
`git config --global --add safe.directory F:/Shivam-Aaziko-Dev-MERN/CGPE-CURRENT-PROJECT/ANDROID`.
Do not diagnose this as a corrupt repo, and never "fix" it by re-cloning.

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
  `ConfirmProvider` (else `useToast()` is a silent no-op).
- `store/appUi.tsx` `SCHEMA_FEATURE_DEFAULTS` mirrors `ui_rbac_config.json` **by hand** — drifts silently.
- Dead, do not maintain: `ui/kit.tsx`, `ui/characters.tsx`, `hooks/use-theme.ts`,
  `hooks/use-color-scheme*.ts`, `constants/theme.ts`, `src/global.css`, `data/mock.ts`.
- Stale docs: `HOW_TO_RUN.md` and `TESTING_GUIDE.md` describe an offline demo mode and a localhost
  default that no longer exist.

## Done means
`npx tsc --noEmit` clean, `npm test` green, no new lint errors, and the affected rows of
`TESTING_GUIDE.md` walked by hand **on a device** (web does not exercise haptics, AsyncStorage
clock keys, or background GPS — and neither does `npm test`, which covers pure logic only).
