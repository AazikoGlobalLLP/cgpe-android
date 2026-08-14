# Phase 32 — Density rollout: the remaining shared primitives (`base` / `controls` / `feedback` / `sheet`)

**Continues the Phase-29 density rollout (2026-08-12).** Phase 29 built the `theme.density` mechanism and
migrated one proof screen (`clients.tsx`); Phase 30 migrated the three other core list tabs
(`tasks`/`leads`/`claims`); Phase 31 migrated the two shared list-primitive modules (`ui/data.tsx` +
`ui/identity.tsx`). Both 30 and 31 named the **remaining shared primitives** as the next high-leverage
target (PHASE-31 §6, "Next targets"), because migrating them lifts density onto the base building blocks —
buttons, fields, cards, banners, skeletons, the modal sheet — that nearly every screen renders. This is
pure rollout — no mechanism change, no contract change, no new copy.

## 1. Scope

Migrate the four remaining shared primitive modules with the **PHASE-29 D-2 pattern** verbatim:

- **`src/ui/base.tsx`** — layout + text: `Header`, `SectionHeader`, `Card`, `GlassCard`, `Row`, `Txt`,
  `Metric`. (`Grad`, `Screen`, `KeyboardScroll`, `Eyebrow`, `noOutline` use no scale tokens — untouched.)
- **`src/ui/controls.tsx`** — everything the finger lands on: `Button`, `Fab`, `Chips`, `Segmented`,
  `Stepper`, `SearchBar`, `Field`. (`IconBtn` uses only its `size` prop — untouched.)
- **`src/ui/feedback.tsx`** — state disclosure: `Loader`, `Skeleton`, `SkeletonText`, `SkeletonCard`,
  `EmptyState`, `Meter`, `Banner`, `Toast`, `ToastProvider`. (`FillBar`/`ProgressBar` use only `motion` —
  untouched.)
- **`src/ui/sheet.tsx`** — the app's one modal surface: `Sheet`, `OptionChip`, `BarBtn`, `FilterSheet`.

Nothing else. `home.tsx` (62 refs, a danger zone) and the other `ui/` modules (`spine`/`swipe`/`Confirm`/…)
that still import the static scale are separate later phases, keeping this within the ≤8-files convention.

## 2. Source of truth (unchanged from Phase 29)

- `applyDensity(base, density)` (`src/theme/density.ts`, pure) already tightens `spacing` (×0.85) and
  `radius` (×0.90) and passes `font` through (×1.0), fail-open by reference for `comfortable`/absent.
- The scale rides the `Palette` — `useTheme().spacing` / `.radius` / `.font` (`theme.tsx`). The `BrandTheme`
  bridge in `_layout.tsx` applies density after accent. This phase only **consumes** that output on four more
  modules; it touches none of the mechanism.
- The static `spacing`/`radius`/`font` exports stay = comfortable, so the still-unmigrated files remain
  non-regressive.

## 3. What shipped

1. **`src/ui/base.tsx` (migrated).** Static `{ font, radius, spacing }` import stripped; each component
   destructures **exactly** the scale it uses off `c`: `Header` → `{ spacing, font }`; `SectionHeader` →
   `{ font }`; `Card` → `{ radius, spacing }`; `GlassCard` → `{ radius, spacing }`; `Row` → `{ spacing }`.
   `GlassCard` and `Row` **had no `useTheme()` call at all** and gain the hook. `Txt`/`Metric` had a
   **default parameter** that captured the scale (`size = font.body` / `font.metric`) — the param is made
   optional (`size?`) and the default resolved in the body as `sizeProp ?? c.font.<x>` (font ×1.0 makes the
   value stable, but it is still **read** off the scale, never copied; D-3).
2. **`src/ui/controls.tsx` (migrated).** Static import stripped; `Button`/`Fab`/`Chips`/`Segmented`/
   `Stepper`/`SearchBar`/`Field` each destructure `{ spacing, radius, font }` (or the subset they use) off
   `c`. The **module-scope** `BTN_FS` const (which captured `font.body` at load) became a `btnFs(font)`
   helper, computed per-component off `c.font` — identical treatment to `data.tsx`'s `pillFs` (Phase 31 D-3).
   `BTN_H`/`BTN_PX`/`BTN_ICON` are pure literals and stay module consts. `IconBtn` uses no scale — untouched.
3. **`src/ui/feedback.tsx` (migrated).** Static import stripped; `Loader`/`SkeletonCard`/`EmptyState`/
   `Meter`/`Banner`/`Toast` destructure the scale they use off `c`; `ToastProvider` reads `{ spacing }`.
   `SkeletonCard`/`SkeletonText`/`ToastProvider` **had no `useTheme()` call at all** and gain the hook.
   Two **default parameters** that captured the scale — `Skeleton`'s `radius: r = radius.sm` and
   `SkeletonText`'s `gap = spacing.sm` — are made optional and resolved in the body as `?? c.radius.sm` /
   `?? c.spacing.sm` (D-3). `FillBar`/`ProgressBar` use only `motion` and are untouched.
4. **`src/ui/sheet.tsx` (migrated).** Static import stripped; `Sheet` → `{ spacing, radius, font }`;
   `OptionChip` → `{ spacing, radius, font }`; `BarBtn` → `{ radius, font }`; `FilterSheet` →
   `{ spacing, font }`. `Sheet`'s `bodyPad` (built after the `if (!mounted) return null` early return) reads
   the destructured `spacing`, which is bound above the early return — no Rules-of-Hooks issue.
5. **No new test.** Presentational migration, no new pure logic; the density numbers are already pinned by
   `src/theme/__tests__/density.test.ts`. Same untested class as the `clients.tsx`/list-tab/Phase-31
   migrations.

`tsc` proves completeness: with the static imports gone, a missed reference is a compile error.

## 4. Done when

- `npx tsc --noEmit` clean · `npm test` green · no new lint errors — **all met** (tsc 0; **417/417**
  unchanged; lint 0 errors / 12 warnings baseline). Commit `2b50aaf` (local — push still 403s).
- **Device check (carried, not editor-buildable):** on a handset, a role whose `app_role_preferences` doc
  carries `theme.density: "compact"` shows visibly tighter base primitives (buttons, fields, cards, banners,
  skeletons, the modal sheet) on every screen that renders them, with type sizes and ≥44pt touch targets
  unchanged, in both light and dark at 390 px; a `comfortable`/absent role is unchanged. Requires a seeded
  compact-density dept config (Phase-26/27 seeding backlog) — the same prerequisite as Phases 29/30/31.

## 5. Decisions

**D-1 — Reuse the PHASE-29 D-2 pattern verbatim; no mechanism change.** The mechanism is done; this is pure
rollout. Strip the static import, destructure off `c`, `tsc` proves completeness. Same as Phases 30/31 D-1.

**D-2 — Destructure precisely what each component uses.** `noUnusedLocals` is off, but precise destructuring
(`{ radius, font }`, `{ spacing }`, …) avoids `no-unused-vars` warnings and keeps the diff faithful. Matches
`clients.tsx`/the list tabs/the Phase-31 primitives.

**D-3 — Three non-mechanical shapes handled as helper / hooks / fallbacks, not literals.** (a) `controls.tsx`'s
module-scope `BTN_FS` const → a `btnFs(font)` helper (a module const captures the comfortable scale at load
and can't react to context; font ×1.0 makes it stable, but the value is still read off the scale) — identical
to `data.tsx`'s `pillFs`. (b) **Default parameters** that captured the scale (`Txt`/`Metric` `size`,
`Skeleton` `radius`, `SkeletonText` `gap`) can't reference the body's `c`, so the param is made optional and
the default is resolved in the body as `?? c.<scale>.<x>` — a new variant of the same "read off the scale, not
copied" rule for the default-param case. (c) Components with **no `useTheme()` at all** (`GlassCard`, `Row`,
`SkeletonText`, `SkeletonCard`, `ToastProvider`) gain the hook, placed with the component's other hooks. Every
other component already called `useTheme()`.

**D-4 — Four files, the remaining primitives only.** Kept within the ≤8-files convention. `home.tsx` (62
refs, a danger zone) and the other `ui/` modules (`spine`/`swipe`/`Confirm`/`JobPill`/`health-banner`/…) that
still import the static scale are deferred to later phases (D-4 mirrors Phases 30/31 D-4).

**D-5 — Leverage nuance recorded, not overclaimed** (unchanged from Phase 31 D-5). Migrating these base
primitives means the **elements** they render (a Button, a Field, a Banner, a Sheet) tighten under compact on
**every** screen that renders them — but a not-yet-migrated screen's **own** outer layout (its container
padding/gaps, computed from the static exports) stays comfortable until that screen is migrated too. So this
widens density's reach substantially without making any single unmigrated screen fully compact. No contract
change; `density` is enum-only upstream and consumed exactly as documented.

## 6. Not done here / handed off

- **The remaining unmigrated files** still import the static `spacing`/`radius`/`font` and render their
  **own** layout comfortable until migrated. Top target: **`home.tsx`** (62 refs, danger zone —
  `AppUiProvider`'s only consumer) on its own. Then the other `ui/` modules
  (`spine`/`swipe`/`Confirm`/`JobPill`/`health-banner`/`AppLock`/`Splash`) and the screen files that still
  import the static scale. Each is a ≤8-file phase using the D-2 pattern.
- **Device confirmation** of compact vs comfortable on a real handset in light/dark — not editor-buildable
  (no seeded compact-density doc exists yet; Phase-26/27 seeding backlog).
- **Contract:** no change requested; mobile owes `cgpe-api`/`cgpe-admin` nothing for this phase.
