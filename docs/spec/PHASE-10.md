# PHASE 10 — Wire server-driven navigation

Session `cgpe-mobile`. Written 2026-08-11, after the code, from a full read of
`src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/more.tsx`, `src/store/appUi.tsx`, `ui_rbac_config.json`
and `ADMIN_PANEL_SYNC.md` §3.6.8/§9.

---

## The one-sentence goal

`nav.tabs` and `nav.hidden`, stored and served correctly since before this app existed, now
actually change what a device shows — the documented known gap in `ADMIN_PANEL_SYNC.md` §9 and
`ui_rbac_config.json`'s `_KNOWN_GAP` block.

## DONE WHEN (from `docs/PHASES.md`'s Phase 10 section)

1. Saving a tab order in the admin panel changes the bar on the next cold start.
2. A module in `nav.hidden` is unreachable.

---

## 1. What is actually true today — verified, with citations

- `ui_rbac_config.json:90-97`: `nav.tabs` is `maxItems: 5`, items drawn from the enum
  `["home", "tasks", "clients", "leads", "claims", "prospects", "tickets", "more"]`. The server
  truncates a 6+ entry array on write (`ADMIN_PANEL_SYNC.md:865-866`, verified from that side).
- Of those eight values, only six correspond to a `<Tabs.Screen>` this build registers today:
  `home`, `tasks`, `clients`, `claims`, `more` (all in the old `ORDER` constant) and `leads`
  (registered at `_layout.tsx`'s bottom but excluded from the old `TAB_META`/`ORDER`, reachable
  only via More's "Leads and pipeline" row). `prospects` and `tickets` are flat stack routes
  (`src/app/prospects.tsx`, `src/app/tickets/index.tsx`) living outside the `(tabs)` route group —
  there is no file for expo-router to register as a sixth/seventh `Tabs.Screen`.
- `appUi.tsx`'s `normalizeUiConfig` already parses `nav.tabs`/`nav.hidden`/`nav.more_sections`
  faithfully (Phase 2, confirmed by the now-updated pinned-bug test at
  `appUi.test.ts` — "does not truncate nav.tabs to five, and does not enum-check them"). Nothing
  in the normaliser needed to change; the gap was entirely that nothing downstream read the result.
- `more.tsx`'s existing groups are hand-curated, not a generic renderer: role-conditional titles
  ("All teams and admins" vs "Team members"), a live ticket count, the "Viewing as" preview sheet,
  and `caps.tier === 'master'`-gated rows sit alongside the plain destinations. `nav.more_sections`
  (title + ordered items) has no equivalent slot for any of that.

## 2. Locked decisions

**D-1. `more` is always rendered, immune to both `nav.tabs` and `nav.hidden`.** It is the sole
escape hatch to any module that lost its tab slot, and the only place Sign Out lives — hiding it
would strand the session with no way back and no way out. Every sample config in
`ui_rbac_config.json` already lists it last (`["home","tasks","leads","clients","more"]`,
`["home","tasks","claims","tickets","more"]`), so this changes nothing for a well-formed document;
it only guards a malformed or adversarial one.

**D-2. `prospects` and `tickets` are not made into physical tab-bar entries this phase.** They are
valid `nav.tabs` values per the schema, but rendering them as a bottom tab would mean moving
`prospects.tsx` / `tickets/index.tsx` into the `(tabs)` route group — a structural change with its
own blast radius (every `router.push('/prospects')` / `('/tickets')` reference, and whatever the
group boundary currently buys them) that the phase's three-file budget does not cover. `resolveTabs`
(new, `appUi.tsx`) filters `nav.tabs` down to the six routes this build can actually render before
computing bar order; a config naming `prospects`/`tickets` for a tab slot degrades to "reachable
from More" — exactly where they already were before this phase, so nothing regresses. Filed as a
known follow-up, not to `cgpe-api` (no contract change needed) — a future mobile-only phase.

**D-3. `nav.more_sections` (title + item grouping) is not wired into `more.tsx`'s group
structure.** Only `nav.hidden` is enforced. `more_sections` is a presentation preference — which
existing curated group a destination is filed under, and in what order — and `hidden` is the field
`ui_rbac_config.json` itself calls "the ONLY control that makes a module unreachable"
(`:116`, `_README.no_feature_deletion_rule`). The phase's binary DONE-WHEN is reachability, not
grouping, and replacing the hand-curated groups (role-conditional labels, the live ticket count,
the view-as sheet) with a generic `{title, items}` renderer would flatten real presentation logic
for a benefit `more_sections` was never positioned to require — nothing here claims a module is
gone that `more_sections`-grouping would have kept, so honesty toward the contract is preserved.
Reordering by `more_sections` is left as future work if the product actually wants panel-driven
section order.

**D-4. `nav.tabs[0]` is not wired to `index.tsx`'s post-login redirect.** The schema documents the
first entry as "the landing screen after sign-in" (`ui_rbac_config.json:93`), but `app/index.tsx`
is not in this phase's file list, is not exercised by the DONE-WHEN, and changing the sign-in
landing route is a materially different risk (a misconfigured `nav.tabs[0]` pointing at a route
that 403s for this role would break sign-in itself, not just reorder a bar). Left for a future
phase if wanted.

**D-5. Quick-action tiles on More (Search / Reminders / Tickets / WhatsApp) also honor
`nav.hidden`.** They are shortcuts that duplicate hrefs already present in the grouped list; leaving
one reachable after its module was explicitly hidden would make the setting dishonest. Each tile
keeps a fixed `tileIndex` (0–3) regardless of which siblings are hidden, so hiding one tile does not
shift the tile colour of the ones next to it — `ActionTile`'s colour is `tileIndex % c.tiles.length`
(`ui/data.tsx:610`), a presentation detail unrelated to reachability.

## 3. Files

| File | Change |
|---|---|
| `src/store/appUi.tsx` | New `KNOWN_TAB_ROUTES`, exported `resolveTabs(config)` (ordered, deduped, hidden-filtered, `more`-guaranteed tab list — D-1, D-2), private `isModuleHidden`. Both wired into `AppUiState` as `tabs`/`isHidden` so consumers don't reimplement the selector. |
| `src/app/(tabs)/_layout.tsx` | `TAB_META` gains a `leads` entry (icon pair only — `tab.leads` already exists in all five `i18n` dictionaries, added ahead of this phase). The bar's `items` filter/sort now reads `useAppUi().tabs` instead of the deleted module-level `ORDER` constant. |
| `src/app/(tabs)/more.tsx` | Every group entry that corresponds to a `nav.hidden`-addressable module gets a `navKey`; groups are filtered (and dropped entirely if emptied) against `isHidden`. Quick-action tiles rebuilt as a filtered, fixed-`tileIndex` array (D-5). |

`src/store/__tests__/appUi.test.ts` — 8 new cases pin `resolveTabs`, plus one existing pinned-bug
comment corrected (it asserted "nothing consumes config.nav today"; that stopped being true this
phase).

## 4. Acceptance criteria

1. `npx tsc --noEmit` exits 0.
2. `npm test` exits 0 (266 tests, 9 files — 258 carried plus 8 new for `resolveTabs`).
3. `npm run lint` stays at the 46-error baseline.
4. A config with `nav.tabs: ["home","tasks","leads","clients","more"]` renders the bar in that
   order, with Leads taking Claims's old slot.
5. A config with `nav.hidden: ["campaigns"]` removes the Campaigns row from More entirely (and,
   for a role where it would otherwise show, no quick-action tile links to it either).
6. `more` renders in the bar and Sign Out remains reachable regardless of what `nav.tabs` /
   `nav.hidden` say (D-1).
7. Every existing More screen behaviour not covered above — role gating via `capabilitiesOf`,
   the live ticket count, the view-as sheet, group titles and their fixed order — is unchanged
   from before this phase.

## 5. Deliberately out of scope

- **Moving `prospects`/`tickets` into the `(tabs)` route group** so they can be real bottom tabs.
  D-2. A future phase, app-side only, no `cgpe-api`/`cgpe-admin` change needed.
- **`nav.more_sections`-driven grouping and ordering inside More.** D-3.
- **`nav.tabs[0]` as the post-login landing route.** D-4.
- **Any change to `ADMIN_PANEL_SYNC.md`/`ui_rbac_config.json`'s `_KNOWN_GAP` block.** Both already
  say the fix is app-side and needs no panel/backend change (`ui_rbac_config.json:319-325`); once
  this phase ships, an `cgpe-admin`-side doc correction is theirs to make, not filed here since the
  contract is unchanged — the panel's own honesty labelling (§3.6.8's "stored, not yet live on
  device") simply becomes true rather than needing new behaviour.
