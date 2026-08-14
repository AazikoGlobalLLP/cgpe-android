# Phase 33 — Density rollout: the Home dashboard (`(tabs)/home.tsx`)

**Continues the Phase-29 density rollout (2026-08-14).** Phases 29/30 migrated the four core list tabs;
Phase 31 the shared list primitives (`data.tsx`/`identity.tsx`); Phase 32 the remaining shared primitives
(`base`/`controls`/`feedback`/`sheet`). Every one of those named **`home.tsx`** as the next target and the
last big single-file lever (PHASE-32 §6). This is pure rollout — no mechanism change, no contract change, no
new copy.

## 1. Scope

Migrate **`src/app/(tabs)/home.tsx`** alone — the 1915-line Home dashboard, 62 scale references,
`AppUiProvider`'s **only** consumer and a documented **danger zone** (project `CLAUDE.md`). One file, kept
well within the ≤8-files convention, deliberately on its own because of its size and its load-bearing role.

## 2. Source of truth (unchanged from Phase 29)

- `applyDensity(base, density)` (`src/theme/density.ts`, pure) already tightens `spacing` (×0.85) and
  `radius` (×0.90) and passes `font` through (×1.0), fail-open by reference for `comfortable`/absent.
- The scale rides the `Palette` — `useTheme().spacing` / `.radius` / `.font` (`theme.tsx`). The `BrandTheme`
  bridge in `_layout.tsx` applies density after accent. This phase only **consumes** that output; it touches
  no mechanism and does **not** reorder the load-bearing providers.
- The static `spacing`/`radius`/`font` exports stay = comfortable, so the still-unmigrated screens remain
  non-regressive.

## 3. What shipped

Static `{ font, radius, spacing }` import stripped; each of the file's five scale-using components
destructures **exactly** the scale it uses off `c`:

- **`WidgetShell`** and **`SmallEmpty`** **had no `useTheme()` call at all** (they relied solely on the
  module import) — each gains `const { spacing } = useTheme()`.
- **`LinkCard`** → `{ radius, spacing, font }`; **`HomeSkeleton`** → `{ spacing, radius }`.
- **`Home`** (the default export) → `{ spacing, radius, font }`, destructured right after its existing
  `const c = useTheme()`. The inline `renderWidget` helper (defined later in `Home`'s body) and all of the
  dashboard JSX from line ~1096 onward close over these bindings, so every one of the 62 references resolves.
- `ClockRing` already had `c` but uses no scale tokens (only colours) — untouched. The module-scope helper
  functions/consts (`bucket`, `hhmm`, `BUILT_IN_WIDGETS`, `LINK_WIDGETS`, …) reference no scale token.

**Unlike the Phase-32 primitives, this file had no module-scope scale const and no default parameter that
captured the scale** — so no `btnFs`-style helper and no optional-prop fallback was needed; it is a straight
strip + destructure. No new test (presentational migration, no new pure logic; the density numbers are
already pinned by `src/theme/__tests__/density.test.ts` — same untested class as every prior density phase).

`tsc` proves completeness: with the static import gone, a reference outside a scope that now carries the
destructure is a compile error.

## 4. Done when

- `npx tsc --noEmit` clean · `npm test` green · no new lint errors — **all met** (tsc 0; **417/417**
  unchanged; full-suite lint 0 errors / 12 warnings baseline, and `home.tsx` itself lints **0/0**). Commit
  `f754843` (local — push still 403s).
- **Device check (carried, not editor-buildable):** on a handset, a role whose `app_role_preferences` doc
  carries `theme.density: "compact"` shows a visibly tighter Home dashboard — section gutters, the clock/hero
  card, KPI strip, quick-action row, link cards and the first-load skeleton — with type sizes and ≥44pt touch
  targets unchanged, in both light and dark at 390 px; a `comfortable`/absent role is unchanged. Requires a
  seeded compact-density dept config (Phase-26/27 seeding backlog) — the same prerequisite as Phases 29–32.

## 5. Decisions

**D-1 — Reuse the PHASE-29 D-2 pattern verbatim; no mechanism change.** Strip the static import, destructure
off `c`, `tsc` proves completeness. Same as Phases 30/31/32 D-1.

**D-2 — Destructure precisely what each component uses.** `WidgetShell`/`SmallEmpty` need only `{ spacing }`;
`HomeSkeleton` only `{ spacing, radius }`; `LinkCard`/`Home` need all three. Precise destructuring avoids
`no-unused-vars` and keeps the diff faithful (six lines total).

**D-3 — Two no-`useTheme()` components gain the hook; nothing else non-mechanical.** `WidgetShell` and
`SmallEmpty` had no `useTheme()` at all and gain it (placed as the component's first statement). This file has
**no** module-scope scale const and **no** default-param scale capture, so — unlike Phase 32 — neither the
helper nor the optional-prop fallback variant of D-3 was required.

**D-4 — One file, on its own.** `home.tsx` is a danger zone (`AppUiProvider`'s only consumer, 1915 lines), so
it was migrated alone rather than batched, per the Phase-30/31/32 handoffs that reserved it for its own phase.
Providers in `_layout.tsx` are untouched — `BrandTheme` still applies accent then density.

**D-5 — This screen is now fully compact-aware.** Because `home.tsx` owns its whole layout (it renders its own
gutters and hero, not just shared primitives), migrating it makes the **entire** Home surface tighten under
compact — both its own outer layout and the already-migrated primitives it renders. The Phase-31/32 "elements
tighten but the screen's own layout stays comfortable" nuance no longer applies to Home. No contract change;
`density` is enum-only upstream and consumed exactly as documented.

## 6. Not done here / handed off

- **The remaining unmigrated files** (~68) still import the static `spacing`/`radius`/`font` and render their
  own layout comfortable until migrated. No single dominant target remains now that the tabs, the shared
  primitives and Home are done — the rest are the other `ui/` modules
  (`spine`/`swipe`/`Confirm`/`JobPill`/`health-banner`/`AppLock`/`Splash`) and the ~40 flat stack-route
  screens (`client/[id]`, `lead/[id]`, `attendance`, `search`, `settings`, …). Each is a ≤8-file phase using
  the D-2 pattern; they can be batched by area (e.g. all detail screens, all settings-family screens).
- **Device confirmation** of compact vs comfortable on a real handset in light/dark — not editor-buildable
  (no seeded compact-density doc exists yet; Phase-26/27 seeding backlog).
- **Contract:** no change requested; mobile owes `cgpe-api`/`cgpe-admin` nothing for this phase.
