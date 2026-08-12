# Phase 31 — Density rollout: the shared list primitives (`ui/data.tsx` + `ui/identity.tsx`)

**Continues the Phase-29 density rollout (2026-08-12).** Phase 29 built the `theme.density` mechanism and
migrated one proof screen (`clients.tsx`); Phase 30 migrated the three other core list tabs
(`tasks`/`leads`/`claims`). Both phases named the **shared list primitives** as the highest-leverage next
target (PHASE-29 §6, PHASE-30 "Next density targets"), because migrating them lifts density across **every
screen that renders them at once** rather than one screen per phase. This is pure rollout — no mechanism
change, no contract change, no new copy.

## 1. Scope

Migrate the two shared primitive modules with the **PHASE-29 D-2 pattern** verbatim:

- **`src/ui/data.tsx`** — the numbers layer: `Pill`, `StatCard`, `Sparkline`, `MetricTile`, `DataRow`,
  `ListSection`, `KpiStrip`, `ActionTile` (plus internal `DeltaBadge`, `KpiChip`, `Label`).
- **`src/ui/identity.tsx`** — the who-is-this layer: `Avatar`, `AvatarStack`, `PersonRow`.

Nothing else. The other shared primitives (`base.tsx`, `controls.tsx`, `feedback.tsx`, `sheet.tsx`, …) and
`home.tsx` (62 refs, a danger zone) are separate later phases, keeping this within the ≤8-files convention.

## 2. Source of truth (unchanged from Phase 29)

- `applyDensity(base, density)` (`src/theme/density.ts`, pure) already tightens `spacing` (×0.85) and
  `radius` (×0.90) and passes `font` through (×1.0), fail-open by reference for `comfortable`/absent.
- The scale rides the `Palette` — `useTheme().spacing` / `.radius` / `.font` (`theme.tsx`). The `BrandTheme`
  bridge in `_layout.tsx` applies density after accent. This phase only **consumes** that output on two more
  modules; it touches none of the mechanism.
- The static `spacing`/`radius`/`font` exports stay = comfortable, so the ~73 still-unmigrated files remain
  non-regressive.

## 3. What shipped

1. **`src/ui/data.tsx` (migrated).** Static `{ font, radius, spacing }` import stripped; each component
   destructures **exactly** the scale it uses off `c`:
   - `Pill` → `{ radius, font }`; `StatCard` → `{ spacing, font }`; `DeltaBadge` → `{ radius, font }`;
     `MetricTile` → `{ spacing, font }`; `DataRow` → `{ spacing, font }`; `ListSection` →
     `{ spacing, radius, font }`; `KpiChip` → `{ spacing, radius, font }`; `ActionTile` → `{ spacing, radius }`.
   - `KpiStrip` **had no `useTheme()` call at all** (it relied solely on the module import) and now reads
     `{ spacing }` off the theme — the hook is placed **before** its `items.length === 0` early return, per
     the Rules of Hooks.
   - The **module-scope** `PILL_FS` const (which captured `font.tiny` at load) became a `pillFs(font)`
     helper, computed per-component off `c.font` — the same treatment `clients.tsx`/`leads.tsx` gave their
     module-scope `sepInset`. Font never scales with density (×1.0), but the size is still **read** off the
     scale, never copied. `PILL_PX`/`PILL_PY`/`PILL_ICON` are pure literals and stay module consts.
   - `Sparkline`, `Label`, `usePressScale` use no scale tokens and are untouched.
2. **`src/ui/identity.tsx` (migrated).** Static `{ font, radius, spacing }` import stripped; `PersonRow`
   destructures `{ spacing, radius, font }` off `c`. `Avatar`/`AvatarStack` use only size-derived literals
   (`size/2.6`, `size*0.36`, `size*0.3`, `size*0.34`) — no scale tokens — and are untouched.
3. **No new test.** Presentational migration, no new pure logic; the density numbers are already pinned by
   `src/theme/__tests__/density.test.ts`. Same untested class as the `clients.tsx`/list-tab migrations.

`tsc` proves completeness: with the static imports gone, a missed reference is a compile error.

## 4. Done when

- `npx tsc --noEmit` clean · `npm test` green · no new lint errors — **all met** (tsc 0; **417/417**
  unchanged; lint 0 errors / 12 warnings baseline). Commit local (push still 403s).
- **Device check (carried, not editor-buildable):** on a handset, a role whose `app_role_preferences` doc
  carries `theme.density: "compact"` shows visibly tighter list primitives (pills, stat/metric tiles,
  data rows, KPI chips, person rows) on the screens that use them, with type sizes and ≥44pt touch targets
  unchanged, in both light and dark at 390 px; a `comfortable`/absent role is unchanged. Requires a seeded
  compact-density dept config (Phase-26/27 seeding backlog) — the same prerequisite as Phases 29/30.

## 5. Decisions

**D-1 — Reuse the PHASE-29 D-2 pattern verbatim; no mechanism change.** The mechanism is done; this is pure
rollout. Strip the static import, destructure off `c`, `tsc` proves completeness. Same as Phase 30 D-1.

**D-2 — Destructure precisely what each component uses.** `noUnusedLocals` is off, but precise destructuring
(`{ radius, font }`, `{ spacing, radius }`, …) avoids `no-unused-vars` warnings and keeps the diff faithful.
Matches `clients.tsx`/the list tabs.

**D-3 — Two module-scope / no-hook cases handled as helpers/hooks, not literals.** `data.tsx`'s
module-scope `PILL_FS` → a `pillFs(font)` helper (a module const captures the comfortable scale at load and
can't react to context; font ×1.0 makes it stable, but the value is still read off the scale, never
hard-coded). `KpiStrip` had no `useTheme()` at all and gains one before its early return. These are the two
non-mechanical cases; every other component already called `useTheme()`.

**D-4 — Two files, the primitives only.** Kept within the ≤8-files convention. `base.tsx`/`controls.tsx`/
`feedback.tsx`/other primitives and `home.tsx` are deferred to later phases (D-4 mirrors Phase 30 D-4).

**D-5 — Leverage nuance recorded, not overclaimed.** Migrating the primitives means the **elements** they
render (a Pill, a DataRow, a PersonRow) tighten under compact on **every** screen that renders them — but a
not-yet-migrated screen's **own** layout (its outer container padding/gaps, computed from the static
exports) stays comfortable until that screen is migrated too. So this widens density's reach substantially
without making any single unmigrated screen fully compact. No contract change; `density` is enum-only
upstream and consumed exactly as documented.

## 6. Not done here / handed off

- **The other ~73 files** still import the static `spacing`/`radius`/`font` and render their **own** layout
  comfortable until migrated. Next targets: the remaining shared primitives (`base.tsx`, `controls.tsx`,
  `feedback.tsx`, `sheet.tsx`), then `home.tsx` (62 refs, danger zone) on its own. Each is a ≤8-file phase
  using the D-2 pattern.
- **Device confirmation** of compact vs comfortable on a real handset in light/dark — not editor-buildable
  (no seeded compact-density doc exists yet; Phase-26/27 seeding backlog).
- **Contract:** no change requested; mobile owes `cgpe-api`/`cgpe-admin` nothing for this phase.
