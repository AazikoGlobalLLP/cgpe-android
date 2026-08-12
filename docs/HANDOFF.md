# HANDOFF — CGPE Connect (Android) — Phase 26 — 2026-08-12

Consumed `nav.more_sections` so the More tab's grouping is now DB-driven per department (closes the
last server-driven-nav gap, Phase 10 D-3). Then, owner-directed, wrote a backend seed script so each
department actually gets a distinct More layout — **not yet run** (needs live-Mongo access this repo
does not have). One security flag below.

## Done
- **The More tab's content groups — their titles, order and membership — now come from the DB.**
  `more.tsx` renders them from the resolved `GET /api/rbac/app-ui` document's `nav.more_sections`.
  Edit a department's `app_role_preferences` doc → its More tab regroups on the next cold start, no
  APK. The admin oversight group and the personal rows (Viewing-as / My earnings) stay fixed; a
  module omitted from `more_sections` is NOT hidden (only `nav.hidden` hides) — it falls to a
  trailing "More" group.
- **A backend seed script exists** (`cgpe-backend-main/scripts/seedAppRolePreferences.js`) that gives
  each of the 8 resolver keys its own `nav.more_sections`. It writes **only** the More grouping +
  label — never any capability/permission. Dry-run by default. **The owner runs it** in their env.

## Files changed
- `src/store/appUi.tsx` — new pure exported `arrangeMoreSections()` selector (mirrors `resolveTabs`:
  known + not-hidden + first-wins dedupe, drop empty groups, trailing catch-all); `DEFAULT_UI.nav.more_sections`
  rewritten to name every one of the 22 catalogue modules once.
- `src/app/(tabs)/more.tsx` — new `MORE_CATALOGUE` (module key → icon/label/href); content groups
  render from config, admin group + "Personal" tail stay fixed; `profile`/`tickets` dynamic values.
- `src/store/__tests__/appUi.test.ts` — +11 `arrangeMoreSections` cases (**398/398**).
- `ui_rbac_config.json` — `_KNOWN_GAP` block updated to **FULLY RESOLVED**.
- `docs/spec/PHASE-26.md` (new) · `docs/DECISIONS.md` · `docs/PHASES.md` · `docs/PROJECT_MAP.md` — updated.
- `../contracts/INBOX.md` — heads-up filed to `cgpe-admin` (their "stored, not yet live" label for
  `more_sections` is now stale) + to `cgpe-api` (seed script + the credential flag).
- **SIBLING repo** `cgpe-backend-main/scripts/seedAppRolePreferences.js` (new, uncommitted) — the seed.

## Decisions made
- **Consume `more_sections`; admin oversight + personal rows stay fixed** (PHASE-26 D-2/D-3). Trailing
  catch-all enforces the contract's hard rule "omission re-prioritises, never hides" (D-1).
  `DEFAULT_UI.nav.more_sections` rewritten because it is now the rendered default (D-4).
  `collapsed_by_default` still not consumed (D-5, needs collapsible UI).
- **Seed writes only `nav.more_sections` + `label`** (dotted-path `$set` + `$setOnInsert`), never
  `features`/`dashboard`/`tabs`/`hidden` — so it cannot change permissions, only menu arrangement.
- Gates: `tsc` 0, `npm test` **398/398** (+11), lint 0 errors / 12 warnings. Commits `7d3a2d4`,
  `2f9448d` (local — push still 403s).

## Known broken / deliberately skipped
- **⚠️ SECURITY — hardcoded prod Mongo credential in the seed script.** `seedAppRolePreferences.js:56`
  was edited (after authoring) to add a live Atlas URI as an `|| '…'` fallback. It is a secret in
  source AND unreachable dead code (`_mongoUri` exits first). **Remove that line before that file is
  committed anywhere, and rotate the credential.** Not reverted (intentional edit) but flagged.
- **Seed NOT yet run** — no DB access from this repo; the owner runs it (`--commit`). The 6 non-sample
  role layouts (`admin/advisor/learn_advisor/leader/payroll_staff/super_admin`) are proposals to review.
- **`resolveRoleKey` limits "departments."** It keys only `sales`/`operations` departments + roles, so
  real business departments (HEALTH INSURANCE, TATA AIA, RECRUITMENT, MUTUAL FUNDS…) resolve by role
  (usually `leader`) and don't get their own layout without a backend `resolveRoleKey` change (`cgpe-api`).
- **Phase 26 device check** — light/dark at 390 px, ≥2 real dept configs, and the one visible shift
  (My earnings/Payroll/Viewing-as now in a "Personal" tail vs the old "Account" group). Not editor-buildable.
- **i18n P1** — still paused on human gu/hi/hi-en/gu-en copy. **Device-verification backlog** carried
  (Phases 1/4/5/6/7/9/10/12/13/16/23/24/25/26).
- **`git push` still 403s** — all commits local.

## Next session starts here
- **Owner to choose:** (1) run the seed — dry-run then `--commit` (after removing the credential line
  and reviewing the 6 proposed layouts); (2) spec the `resolveRoleKey` change so each real business
  department gets its own layout; or (3) the Phase-26 device check on a handset.
- **First command:** `/boot`
- **Watch out for:** the hardcoded credential in the seed script (remove + rotate before sharing that
  file), and `../contracts/INBOX.md` shifting mid-session under concurrent writes (anchor edits on
  surrounding text, grep replies back).
