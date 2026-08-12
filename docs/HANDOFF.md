# HANDOFF — CGPE Connect (Android) — Phase 30 — 2026-08-12

Phase 29 built the density mechanism and migrated **one** proof screen (`clients.tsx`). This session
continued the rollout: migrated the **three other core list tabs** (`tasks`/`leads`/`claims`) to the same
D-2 destructure pattern. Pure rollout — no mechanism change, no contract change, no new copy. All three
gates green, two commits local (push still 403s), plus a CLAUDE.md note update.

## Done
- **A department whose config sets `theme.density: "compact"` now renders tighter Tasks, Leads and Claims
  tabs** — spacing and corner radii shrink (spacing ×0.85, radius ×0.90), type sizes and ≥44pt touch
  targets unchanged — alongside the Clients tab from Phase 29. Renders on the next cold start, no APK. A
  `comfortable`/absent role is unchanged (fail-open by reference).
- **Non-regressive:** every screen NOT yet migrated (~75 files, incl. `home.tsx` and the shared list
  primitives) still renders the comfortable scale exactly as before — the static `spacing`/`radius`/`font`
  exports are untouched.

## Files changed
- `src/app/(tabs)/claims.tsx` — static `{ font, radius, spacing }` import stripped; `Claims`,
  `ClaimsSkeleton`, `ClaimRow`, `RowSeparator` destructure their scale off `c`. No module-scope scale use.
- `src/app/(tabs)/tasks.tsx` — same strip; `Tasks`, `TasksSkeleton`, `HeroStat`, `TaskCard` destructure
  off `c`. No module-scope scale use.
- `src/app/(tabs)/leads.tsx` — same strip; `Leads`, `LeadRow`, `ListFooter`, `PipelineSheet`,
  `CloseOutSheet` destructure off `c`; `AddLeadSheet` + `SkeletonRow` (which had **no `useTheme()` call at
  all**, relying solely on the module import) now read the scale off the theme. The module-scope
  `SEP_INSET` const became a `sepInset(scale)` helper (identical to `clients.tsx`'s), and its two
  consumers (`RowSeparator`, `PipelineSkeleton`) compute `sepInset(c.spacing)` so separators stay aligned
  when the gutter tightens (the 44pt avatar is fixed and does not scale). Commit `d70da17` (3 files, local).
- `docs/spec/PHASE-30.md` (new); `docs/PHASES.md` (`## Now` + `## Next 3`) + `docs/DECISIONS.md` +
  `docs/STATUS.md` + project `CLAUDE.md` (density note: list tabs now migrated) updated. Commits `8a21198`
  (docs) + `b1ed959` (CLAUDE.md), local — push still 403s. `.claude/settings.json` left as-is (modified
  before this session).

## Decisions made
- **D-1 — reuse the Phase-29 D-2 pattern verbatim; no mechanism change.** The mechanism is done; this is
  pure rollout. Strip the static import, destructure off `c`, `tsc` proves completeness.
- **D-2 — destructure precisely what each component uses** (`{ spacing, font }`, `{ spacing, radius }`),
  matching `clients.tsx` — `noUnusedLocals` is off, but precise destructuring avoids `no-unused-vars`
  warnings and keeps the diff faithful.
- **D-3 — `leads.tsx`'s module-scope `SEP_INSET` → a `sepInset(scale)` helper**, the one non-mechanical
  case (a module const captures the comfortable scale at load and can't react to density). `tasks.tsx` and
  `claims.tsx` had no module-scope scale use.
- **D-4 — three files, not the shared primitives or `home.tsx`** — kept within the ≤8-files convention;
  the primitives and `home.tsx` (62 refs, danger zone) are separate later phases.

## Known broken / deliberately skipped
- **Device check (carried) — the only thing left for Phase 30.** A role with `theme.density:"compact"`
  showing tighter Tasks/Leads/Claims in light/dark at 390 px, type/targets unchanged; a comfortable role
  unchanged. **Not editor-buildable: no compact-density dept doc is seeded yet** (Phase-26/27 seeding
  backlog) — same prerequisite as Phase 29.
- **The other ~75 files** still render comfortable until migrated — deliberately deferred. Top targets:
  the shared `ui/data.tsx` + `ui/identity.tsx` list primitives (lift density across many screens at once),
  then `home.tsx` on its own. These are the top editor-buildable levers now.
- **No new test** — presentational migration, no new pure logic (the same untested class as the
  `clients.tsx` migration; the density numbers are already pinned by `src/theme/__tests__/density.test.ts`).
- **⚠️ SECURITY (carried, unchanged):** `cgpe-backend-main/scripts/seedAppRolePreferences.js:56` still
  hardcodes a live Atlas credential — **remove + rotate before that file is committed anywhere.** Sibling
  repo, not touched.
- **Phase 27 (`resolveRoleKey`) still awaiting `cgpe-api`** — INBOX ask still `[ ]` (unanswered).
- **Device-verification backlog** carried (Phases 1/4/5/6/7/9/10/12/13/16/23/24/25/28/29 + now 30).
- **`git push` still 403s** — all commits local.
- **No contract change / no INBOX activity this phase** — density is enum-only upstream and consumed
  exactly as documented; nothing crosses a repo boundary, no sibling session needs notifying.

## Next session starts here
- **Phase 31 — continue the density rollout:** migrate the shared list primitives `ui/data.tsx` +
  `ui/identity.tsx` (migrating those lifts density across many screens at once — highest leverage), or
  `home.tsx` (62 refs, a danger zone) on its own. Same D-2 pattern. No backend, no copy — buildable today.
  Or, if `cgpe-api` has replied to the Phase-27 `resolveRoleKey` ask, do Phase 27 verification instead.
- **First command:** `/boot`
- **Watch out for:** in `ui/data.tsx`/`ui/identity.tsx`, these are **shared primitives** consumed by many
  screens, so a scale change there is higher-blast-radius than a single screen — but the mechanism is the
  same: strip the static import and let `tsc` flag every reference. Check for **module-scope** scale uses
  (like `leads.tsx`'s old `SEP_INSET`) which a hook/destructure can't cover and must become a helper. And
  do not reorder the load-bearing providers in `_layout.tsx` — `BrandTheme` applies both accent and density.
