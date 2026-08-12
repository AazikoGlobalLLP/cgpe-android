# HANDOFF — CGPE Connect (Android) — Phase 25 — 2026-08-12

Built the commissions EARNED aggregate against the just-shipped `GET /api/commissions/my-summary`
(backend Phase 31), closing the long-standing Phase-6 D-5 blocker. Also verified, at the owner's
request, whether the app's **layout comes from the DB or is static** — findings + a proposal below.

## Done
- **The Commissions screen now shows real earned money.** This month / last month / pending payout /
  year-to-date / a 6-month trend / recent credits — all from the caller's OWN commissions
  (self-scoped by the server). Three honest states: real figures, a calm "no commission recorded yet"
  (200-zeros, no banner), and a retryable "did not load" (503, banner). No fabricated zeros, no
  on-device arithmetic — every ₹ is the server's. The MDRT tier element (Phase 23) is unchanged.

## Files changed
- `src/data/api.ts` — new `getCommissionSummary(): {status:'ok';summary} | {status:'error'}` on
  `GET /commissions/my-summary` (low-level `req()`, two-outcome posture like `getMdrtTier`;
  200-zeros = ok/no-banner, 503 = error/banner, 401/403/404 suppressed). Defensive field mapping,
  `target:0` (no source, never invented). Removed the now-dead `getCommission()` + mis-shaped
  `EMPTY_COMMISSION` shell (single caller, gone).
- `src/app/commissions.tsx` — `load()` calls `getCommissionSummary()`; every existing render defense
  and the `blank`/`degraded` empty-state fork unchanged. Boundary comment updated (honesty of comments).
- `src/data/__tests__/api-commissions.test.ts` — new, 14 cases pinning the wire contract.
- `docs/spec/PHASE-25.md` (new), `docs/DECISIONS.md`, `docs/PHASES.md` (board row 25 + `## Now` +
  `## Next 3`), `docs/STATUS.md` — updated.
- `../contracts/INBOX.md` — Phase-31 box **ticked** (build done + verified); reply grepped back durable.

## Decisions made
- **Two-outcome result, not three.** `/my-summary` has no `data:null` empty — an advisor with no
  commissions gets a 200 with zeros. So the empty state is an `ok` carrying zeros, and the screen's
  existing blank check renders it. `req()` (not `tryReal`) keeps a shape-miss reportable.
- **`target:0` always.** The endpoint carries no monthly target and `next_premium` (MDRT) is a
  different unit, so the meter stays "no monthly target set" — an honest blank, never a guess.
- **Removed dead code** (`getCommission`/`EMPTY_COMMISSION`) rather than leave a fabricated shell —
  Phase-14 hygiene. Single caller, verified.
- Gates: `tsc` 0, `npm test` **387/387** (+14), lint 0 errors / 12 warnings (baseline). Commit
  `039cf63` (local — push 403s).

## LAYOUT QUESTION — verified (owner asked: is the layout from the DB, and can each dept's layout be DB-driven?)
- **It is ALREADY DB-driven, and per-department.** `GET /api/rbac/app-ui` (`cgpe-backend-main/routes/rbac.js`)
  reads a per-role/department document from the Mongo collection **`app_role_preferences`**, deep-merges
  it over role defaults over global defaults, and returns the resolved layout. The app fetches it on
  every cold start (`store/appUi.tsx`) and renders dashboard + nav + capabilities from it. The admin
  panel writes it via `PUT /api/rbac/app-ui/:roleKey` (admin/leader/super_admin). **Change the DB doc →
  every user in that dept picks it up on next cold start. No new APK.** Contract/schema:
  `ANDROID/ui_rbac_config.json`.
- **What the DB controls today:** which dashboard widgets show + their **order**, each widget's title
  override / max items / visibility, the hero mode (4 options), the bottom **tabs** + order, hidden
  modules, the 14 feature flags, and theme (accent/badge/density). Dept resolution:
  `resolveRoleKey` → `sales`/`operations` use the **department**; everyone else uses the **role**.
- **What is STATIC (the honest caveat):** the internal layout of each screen (its RN JSX/styling/fields)
  is compiled into the APK. The DB **composes from a fixed catalogue** — 20 known widget keys, 5
  renderable tab routes (`home/tasks/clients/leads/claims` + always `more`), 4 hero modes, 14 flags —
  and drops anything outside it. So the DB can reorder/hide/retitle/limit and flip capabilities per dept,
  but it is **not** a free-form drag-anywhere page builder, and a genuinely new widget/tab needs an app
  code change first (then the DB can turn it on per dept). Known gaps: `nav.more_sections` grouping is
  stored/served but **not yet consumed** by the app (Phase 10 D-3); `theme` only partially consumed;
  `prospects`/`tickets` can't be physical tabs yet.

## Known broken / deliberately skipped
- **Device check for Phase 25** — a real advisor with booked policies vs production, light/dark at 390 px.
  Not editor-buildable.
- **i18n P1 (Phase 22 bulk)** — paused on human gu/hi/hi-en/gu-en copy; machine translation forbidden.
- **Device-check backlog — CARRIED** (Phases 1/4/5/6/7/9/10/12/13/16/23/24/**25**). Phase-1 clock-in is
  the stated hard prerequisite.
- **`git push` still 403s** — `reactjsaaziko` lacks write on `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. All
  commits local (this session: `039cf63`). Needs a human to grant access or swap the credential.
- **Per-dept `app_role_preferences` docs may not be seeded** — can't query the live DB from here. Many
  roles likely still run on `from_defaults:true`. Seeding/verifying real per-dept docs is a proposal, not
  done (see Next).

## Next session starts here
- **Owner to choose.** If the owner wants to push the DB-driven layout further (their question points that
  way), the natural next phase is **Phase 26 — make per-department layout fully DB-editable**: (a) seed/verify
  the `app_role_preferences` docs per department via the admin panel, (b) consume `nav.more_sections` in the
  app (closes Phase 10 D-3) so More-tab grouping is DB-driven, (c) finish consuming `theme` for per-dept
  branding. All app-side + admin-panel; no new backend endpoint. Otherwise the board's other levers are:
  owner-supplied i18n copy → unpauses Phase 22; a handset → the carried device checks (incl. Phase 25).
- **First command:** `/boot`
- **Watch out for:** `../contracts/INBOX.md` shifts **mid-session** under concurrent writes — the Phase-31
  item moved +13 lines between boot and handoff this session. Anchor every edit on surrounding text, never
  a line number, and **grep your reply back** after writing (done this session — tick confirmed durable).
