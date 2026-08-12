# Phase 30 — Density rollout: migrate the list tabs (`tasks` / `leads` / `claims`)

**Continues Phase 29.** Phase 29 built the runtime density mechanism (`applyDensity`, the scale on the
`Palette`, the `BrandTheme` bridge) and migrated **one** proof screen (`clients.tsx`). The remaining ~80
files still import the static `spacing`/`radius`/`font` and render **comfortable** regardless of
`theme.density` until migrated. This phase migrates the three other core list tabs — the highest-value
next targets named in PHASE-29 §6 — using the same D-2 destructure pattern. No mechanism change, no
contract change, no new copy.

## 1. Scope

Migrate `src/app/(tabs)/tasks.tsx`, `src/app/(tabs)/leads.tsx`, `src/app/(tabs)/claims.tsx` to read the
layout scale off `useTheme()` so a department whose config carries `theme.density: "compact"` renders
these three tabs tighter (spacing ×0.85, radius ×0.90, font ×1.0 — the Phase-29 owner-locked numbers,
applied by `applyDensity`) on the next cold start. **Out of scope:** the shared list primitives
(`ui/data.tsx`, `ui/identity.tsx`) and `home.tsx` — each a separate later phase (PHASE-29 §6).

## 2. The D-2 migration pattern (from PHASE-29 D-2, proven on `clients.tsx`)

Per screen, mechanical and `tsc`-checked for completeness:

1. Change the import `{ font, radius, spacing, useTheme }` → `{ useTheme }` (strip the static scale).
2. In every component that uses the scale, destructure **exactly what it uses** off the theme —
   `const { spacing, font } = c;` right after `const c = useTheme();` (or `const { spacing, radius } =
   useTheme();` in a helper that has no other need for `c`). Style bodies are untouched.
3. Turn any **module-scope** use of the scale into a helper that takes the scale as a parameter — a
   hook/destructure cannot cover module scope.
4. Run `tsc --noEmit`: removing the static import makes any missed reference a compile error, so a green
   `tsc` is the completeness guarantee.

## 3. What shipped (commit `d70da17`, local)

- **`src/app/(tabs)/claims.tsx`** — static import stripped; `Claims`, `ClaimsSkeleton`, `ClaimRow`,
  `RowSeparator` destructure their scale off `c`. No module-scope scale use. (`Hairline` uses no scale —
  untouched.)
- **`src/app/(tabs)/tasks.tsx`** — static import stripped; `Tasks`, `TasksSkeleton`, `HeroStat`,
  `TaskCard` destructure their scale off `c`. No module-scope scale use.
- **`src/app/(tabs)/leads.tsx`** — static import stripped; `Leads`, `LeadRow`, `ListFooter`,
  `PipelineSheet`, `CloseOutSheet` destructure off `c`; `AddLeadSheet` and `SkeletonRow` (which had no
  `useTheme()` call at all, relying solely on the module import) now `const { spacing[, radius] } =
  useTheme();`. The **module-scope `SEP_INSET` const** (`spacing.lg + 44 + spacing.md`) became a
  `sepInset(scale)` helper — identical to `clients.tsx`'s — and its two consumers (`RowSeparator`,
  `PipelineSkeleton`) compute `sepInset(c.spacing)` so separators stay aligned when the gutter tightens
  (the 44pt avatar is a fixed touch target and does not scale).

No new test file — this is presentational migration with no new pure logic (the same untested class as
the `clients.tsx` migration in Phase 29; the density numbers themselves are already pinned by
`src/theme/__tests__/density.test.ts`).

## 4. Done when

- `npx tsc --noEmit` clean · `npm test` green · no new lint errors — **all met**
  (tsc 0; **417/417** unchanged; lint 0 errors / 12 warnings baseline).
- **Device check (carried, not editor-buildable):** on a handset, a role whose `app_role_preferences`
  doc carries `theme.density: "compact"` shows visibly tighter **Tasks / Leads / Claims** tabs
  (rows/gutters/corners), type sizes and ≥44pt touch targets unchanged, light and dark at 390 px; a
  `comfortable`/absent role is unchanged. Still blocked on a seeded compact-density dept config existing
  (Phase-26/27 seeding backlog) — same prerequisite as Phase 29.

## 5. Decisions

**D-1 — Reuse the Phase-29 D-2 pattern verbatim; no mechanism change.** The mechanism is done; this is
pure rollout. Each screen migrates by stripping the static import and destructuring off `c`, exactly as
`clients.tsx` did. `tsc` proves completeness.

**D-2 — Destructure precisely what each component uses** (`{ spacing, font }`, `{ spacing, radius }`,
etc.), matching `clients.tsx`'s per-component style. `noUnusedLocals` is off, but precise destructuring
avoids `@typescript-eslint/no-unused-vars` warnings and keeps the diff faithful to the reference screen.

**D-3 — `leads.tsx`'s module-scope `SEP_INSET` → `sepInset(scale)` helper**, the one non-mechanical case.
A module-scope const captures the *comfortable* scale at load and never reacts to density; converting it
to a helper that takes the active `c.spacing` is the PHASE-29 D-2 rule for module-scope uses. `tasks.tsx`
and `claims.tsx` had no module-scope scale use.

**D-4 — Three files, not the list primitives or `home.tsx`.** Kept within the ≤8-files convention and the
"one demoable thing" rule. The shared primitives and `home.tsx` (62 refs, a danger zone) remain separate
later phases per PHASE-29 §6.

## 6. Not done here / handed off

- **`ui/data.tsx` + `ui/identity.tsx`** (shared list primitives — migrating these lifts density across
  many screens at once) and **`home.tsx`** (on its own) — the next density-rollout targets.
- **The other ~75 files** still render comfortable until migrated.
- **Device confirmation** — carried, needs a seeded compact-density doc (Phase-26/27 seeding backlog).
- **Contract:** no change; `density` consumed exactly as documented (response-only, optional, enum).
