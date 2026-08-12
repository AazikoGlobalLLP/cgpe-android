# Phase 26 — Consume `nav.more_sections` (More tab grouping is now DB-driven)

**Owner-directed scope (2026-08-12).** The owner asked whether each department's layout can live in
the DB and change there automatically. Phase 10 already made `nav.tabs`/`nav.hidden` DB-driven, but
left `nav.more_sections` **stored, validated and served but NOT consumed** — the last open item on
the server-driven-nav gap (Phase 10 D-3; `ui_rbac_config.json:320-324` records mobile as the fix
owner). This phase closes it: the **groups, titles and order of the More tab's content modules now
come from the admin-panel document**, not a hard-coded list. Change the dept's `app_role_preferences`
doc → the More tab regroups on the next cold start. No backend, no panel, no contract change.

The owner explicitly chose this slice over per-dept doc *seeding* (admin-panel + live-Mongo work,
not buildable from this repo) and over `theme` consumption (needs a provider-order change, almost
entirely device-verified). Both stay out — see "Not done".

## Goal
`src/app/(tabs)/more.tsx`'s content-module groups render from `config.nav.more_sections` (the
resolved per-role/department document from `GET /api/rbac/app-ui`), preserving every existing
role-gate, the live ticket count, and `nav.hidden` filtering — and **without ever stranding a
reachable module** (the contract's hard product rule). The arrangement is computed by a new pure,
unit-tested selector `arrangeMoreSections`, mirroring Phase 10's `resolveTabs`.

## Files
- `src/store/appUi.tsx` — new exported pure selector `arrangeMoreSections(sections, known, isHidden,
  leftoverTitle?)`; `DEFAULT_UI.nav.more_sections` rewritten to a canonical default grouping that
  covers every catalogue module (so the fallback/admin/master layout is intentional and the
  catch-all is empty for it).
- `src/app/(tabs)/more.tsx` — new `MORE_CATALOGUE` (module key → `{icon,label,value,href}`); the four
  hard-coded content groups replaced by `arrangeMoreSections(...)` mapped through the catalogue; the
  admin oversight group, the personal local-feature rows, About and Sign out stay fixed.
- `src/store/__tests__/appUi.test.ts` — a new `describe` block pinning `arrangeMoreSections`.

## Source of truth (verified in the contract, not tags)
- `ui_rbac_config.json:100-113` — `nav.more_sections` is `{ title, items:string[], collapsed_by_default? }[]`,
  "Ordered groups inside the More tab." `items` has **no enum** — the module-key vocabulary is
  open/free-form. Sample role docs (`:192-197`, `:226-230`) use keys like `clients segments families
  premium lic-plans leads prospects claims tickets reminders calendar commissions kb notice-board
  contests profile attendance settings account`.
- `ui_rbac_config.json:18` (`no_feature_deletion_rule`) + `:116` (`hidden` description): **the hard
  product rule** — "Every module remains reachable from the More tab unless `nav.hidden` explicitly
  lists it. Nothing is ever deleted, only re-prioritised." So omission from `more_sections` re-orders;
  it must **never** hide. This is what forces the trailing catch-all (D-1).
- `appUi.tsx` — `normalizeUiConfig` already guarantees `config.nav.more_sections` is a non-empty,
  validated `{title,items}[]` (falls back to `DEFAULT_UI.nav.more_sections` when nothing survives,
  `:264`), so the selector always has clean input. `resolveTabs` (`:307`) is the pattern to mirror.
- Admin/master sample docs (`:256`, `:284`) carry **no `more_sections`** → they resolve to
  `DEFAULT_UI.nav.more_sections`. This is why the admin oversight group must stay fixed, not
  config-driven (D-2), and why the default grouping is rewritten to be intentional (D-4).

## Done when
`npx tsc --noEmit` clean · `npm test` green (+ new `arrangeMoreSections` cases) · no new lint errors.
Behaviourally: the More tab's content groups' titles and order follow `config.nav.more_sections`;
a module named in a group renders once, in that group; a module the config omits is still reachable
(trailing group); a module in `nav.hidden` disappears everywhere; every role-gate (admin oversight,
master-only movement paths, real-admin-only payroll, previewing-as) behaves exactly as before.
Device check (renders on a real handset, light/dark at 390 px, against ≥2 real dept configs)
outstanding — not editor-buildable.

## Decisions

**D-1 — Omission never hides; only `nav.hidden` hides. Enforced by a trailing catch-all.** The
contract's hard product rule (`ui_rbac_config.json:18`) is that a module stays reachable unless
`nav.hidden` names it. So `arrangeMoreSections` renders the config's groups first, then appends ONE
trailing group (`leftoverTitle`, default `"More"`) holding every catalogue module that is not hidden
and was not placed by any config group. A half-written or minimal dept doc therefore re-prioritises
the menu but can never make a module vanish — the same fail-open doctrine as `resolveTabs` and
`DEFAULT_UI`. Hiding remains a separate, explicit, deliberately-sparse control.

**D-2 — The admin oversight group stays FIXED, not config-driven.** `team / agent-map / agent-track /
analytics / campaigns / notify` (and the local `payroll` row) are **excluded from the content
catalogue** and render in the same prepended, role-gated group as today (`isAdmin` gates the group,
`caps.tier === 'master'` gates movement paths, the real `admin`/`super_admin` role gates payroll).
Rationale: (a) admin/master configs carry no `more_sections`, so config-driving these safety-sensitive
tools would make them vanish for the very roles that need them; (b) their placement is not something a
department should reorder. `nav.hidden` still filters each admin row (the existing per-item
`isHidden(navKey)` check is preserved). Consequence: a dept doc that lists an admin key in
`more_sections` has no effect on that key (it is not in the content catalogue) — documented, acceptable.

**D-3 — The personal local-feature rows stay FIXED, after the config groups.** "Viewing as" (gated
`realCaps.manageTeam`), "My earnings" (every member, Phase 16), and "Payroll" (real-admin, Phase 20)
are **not server nav modules** — they have no `navKey` and appear in no `more_sections`. They render
in a fixed "Personal" group placed after the config-driven groups and before About/Sign out. This is
the one visible layout change vs today (previously they sat inside the hand-authored "Account" group
next to profile/settings); profile/settings/account are now content-catalogue modules and render in
whatever config group names them (the "You" group in the defaults). Flagged for the device check.

**D-4 — `DEFAULT_UI.nav.more_sections` rewritten to a canonical grouping covering every catalogue
module.** DEFAULT_UI is the fallback for a config outage AND the resolved layout for every role whose
doc omits `more_sections` (admin, master, and any unseeded dept). Since it is now actually rendered,
its contents must be a deliberate default, not the placeholder it was. It is rewritten to group all
22 content modules sensibly (The book / Day to day / Board / Reference / You), so the catch-all (D-1)
is empty for the default case and no module is orphaned. The array is still handed back by reference
by `normalizeUiConfig` (the existing `.toBe(...)` identity tests are unaffected — only contents
changed, not the object).

**D-5 — `collapsed_by_default` is still NOT consumed.** The schema carries a per-group
`collapsed_by_default` boolean (`ui_rbac_config.json:110`); `normalizeSections` already drops it and
a pinned test asserts that (`appUi.test.ts:373`). Rendering collapsible groups is a separate UI build;
this phase leaves the drop in place and does not read the flag. Documented scope cut, not an oversight.

**D-6 — The selector is pure and tested; the `more.tsx` wiring is presentational.** `arrangeMoreSections`
is a pure function over strings (titles, keys, a hidden-predicate) — no React, no catalogue — so it is
unit-tested in `appUi.test.ts` exactly like `resolveTabs`, covering: config order preserved, cross-group
dedupe (first placement wins), `nav.hidden` removes a key everywhere, unknown/uncatalogued keys dropped,
empty config groups dropped, and the trailing catch-all (present when modules are unplaced, absent when
all are placed, and itself hidden-filtered). The `more.tsx` catalogue + JSX is the untested presentational
class (Phases 8/11/17/24) — `tsc` + `lint` gate it, the device check validates it.

## Not done (deliberate)
- **Per-department doc seeding.** Making each dept actually *get* a distinct layout is admin-panel +
  live-Mongo work (`cgpe-admin` writes `app_role_preferences` via `PUT /rbac/app-ui/:roleKey`) — not
  buildable from this repo. This phase makes the app *consume* whatever the DB serves; seeding real
  per-dept docs is the owner's/`cgpe-admin`'s next lever.
- **`theme` (accent/badge/density).** Still normalized-but-unconsumed. `accent` needs a provider-order
  change (`ThemeProvider` sits above `AppUiProvider`); density/badge are almost entirely device-verified.
  Out of this slice by owner choice.
- **Config-driving the admin oversight group / personal rows** (D-2, D-3) and **collapsible groups**
  (D-5).
- **Device check** — light/dark at 390 px against ≥2 real department configs. Not editor-buildable.
