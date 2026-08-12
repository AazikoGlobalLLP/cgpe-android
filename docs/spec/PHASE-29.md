# Phase 29 — Consume the server-driven `theme.density` (mechanism + first screen)

**Owner-directed (2026-08-12).** Phase 28 shipped `theme.accent` + `theme.badge_label` and **deferred
`density`** (PHASE-28 D-4): `spacing`/`radius`/`font` were static module `const`s imported directly by
~81 files, so density needed the whole scale converted to a runtime, context-driven scale — a large,
cross-cutting refactor. This phase builds that runtime mechanism and migrates **one** high-traffic screen
as proof; the remaining ~80 files migrate incrementally in later phases.

## 1. Scope (owner-locked via AskUserQuestion, 2026-08-12)

Two things the contract does **not** define were locked with the owner before any code:

- **Approach:** ship the density **mechanism** + migrate **ONE** screen this phase (≤8 files), keeping
  the static `spacing`/`radius`/`font` exports as the **comfortable** default so all ~80 unmigrated
  importers render exactly as today (non-regressive). Not a big-bang.
- **`compact` numbers (gentle, spacing-led):** `compact = spacing ×0.85, radius ×0.90, font ×1.0` —
  tighten whitespace and corners, **keep type sizes** for legibility and ≥44pt touch targets. These
  numbers exist **nowhere upstream** (the contract/schema/`ADMIN_PANEL_SYNC.md` define `density` only as
  the enum `{comfortable, compact}`, default `comfortable`); they are a mobile design decision the owner
  approved, **not** a contract value.

**Proof screen:** `src/app/(tabs)/clients.tsx` — a core tab, a scrollable paginated list (where compact
density is most visible), lean and self-contained (15 scale references), web-reachable for the E2E walk.

## 2. Source of truth (verified 2026-08-12)

- **Shape** — `theme?.density?: 'comfortable' | 'compact'` (`api.ts:2673`; schema
  `ui_rbac_config.json:158`, `default: "comfortable"`; `models.md` §`app_role_preferences`). Already
  validated by `normalizeTheme` (`appUi.tsx:285`: only `compact`/`comfortable` survive, no default
  applied — an absent/mis-cased density is `undefined`). This phase only **consumes** that output.
- **The numeric meaning of `compact` is undefined upstream** — grep of `../contracts/`, the schema, and
  `ADMIN_PANEL_SYNC.md` for `density` returns only the enum + a `comfortable` default. Hence the
  owner-lock in §1.
- **The scale** — `spacing`/`radius`/`font` (`theme.tsx`) were plain module `const`s imported by ~81
  files (941 references). The palette (`Palette`, via `useTheme()`) is the only runtime/context-driven
  part of the design system.

## 3. What shipped

1. **`src/theme/density.ts` (new, pure).** `applyDensity(base, density)` — a deterministic transform:
   `comfortable`/`undefined` → returns the base palette **by reference** (fail-open, exactly like
   `deriveBrandPalette`); `compact` → returns a new palette with `spacing` = `compactSpacing(base.spacing)`
   (×0.85, `Math.round`) and `radius` = `compactRadius(base.radius)` (×0.90, `Math.round`, `pill`
   preserved). `font` and every colour/gradient pass through verbatim. Reads the comfortable scale **off
   the palette**, so the comfortable numbers live in exactly one place (`theme.tsx`) and are never copied.
   Imports only erased types, so it unit-tests with no React and no native stub.
   - **compact spacing:** `xs 4→3 · sm 8→7 · md 12→10 · lg 16→14 · xl 20→17 · xxl 24→20 · xxxl 32→27`.
   - **compact radius:** `sm 10→9 · md 14→13 · lg 18→16 · xl 24→22 · xxl 30→27 · pill 999→999`.
2. **`src/theme/theme.tsx`.** The layout scale now lives **on** the `Palette` (`spacing`/`radius`/`font`
   with new `Spacing`/`Radius`/`Font` types), so `useTheme()` carries it and a subtree can be
   re-provided a density-scaled copy. The `light`/`dark` palettes carry the comfortable scale by
   reference; the module still **exports** `spacing`/`radius`/`font` (unchanged values) so the ~80
   unmigrated importers keep rendering comfortable until migrated. Re-exports `applyDensity`.
3. **`src/app/_layout.tsx`.** The `BrandTheme` bridge now applies density **after** accent —
   `applyDensity(deriveBrandPalette(base, accent), density)` — memoised on `[base, accent, density]`.
   Density scales layout independent of colour; both fail open by reference, so a role with neither an
   accent nor a compact density gets the exact base palette and the memo never churns.
4. **`src/app/(tabs)/clients.tsx` (migrated, proof).** Reads the scale off `useTheme()` via
   `const { spacing, radius, font } = c` (destructure — keeps the per-screen diff tiny for the rollout;
   the style bodies are unchanged). The module-scope `SEP_INSET` const became a `sepInset(spacing)`
   helper so row separators stay aligned when the gutter tightens (the 44pt avatar does not scale).
5. **`src/theme/__tests__/density.test.ts` (new).** 10 cases pinning the exact compact numbers,
   fail-open reference-equality (undefined + comfortable), font-unchanged, base-not-mutated,
   colour/token pass-through, determinism.

## 4. Done when

- `npx tsc --noEmit` clean · `npm test` green · no new lint errors — **all met**
  (tsc 0; **417/417**, +10 `density.test.ts`; lint 0 errors / 12 warnings baseline).
- **Device check (carried, not editor-buildable):** on a handset, a role whose `app_role_preferences`
  doc carries `theme.density: "compact"` shows a visibly tighter **Clients** list (rows/gutters), with
  type sizes and touch targets unchanged, in both light and dark at 390 px; a `comfortable`/absent role
  is unchanged. Requires a seeded dept config with a compact density (ties into the Phase-26/27 seeding
  backlog). Other screens stay comfortable until migrated (§6).

## 5. Decisions

**D-1 — Mechanism + one screen, not a big-bang (owner choice).** Converting all ~81 importers in one
phase would break the project's ≤8-files/phase convention, produce a huge mostly-device-verified diff,
and carry real regression risk. Instead: build the runtime mechanism, keep the static exports as the
comfortable default (non-regressive), and migrate `clients.tsx` as proof. Departments' other screens
adopt density as each screen is migrated — incremental, like the Phase-27 "no big-bang" philosophy.

**D-2 — Scale lives on the `Palette` (one context), migrate by destructuring.** Rather than a second
`ScaleContext`, the scale rides the palette that `useTheme()`/`PaletteProvider`/`BrandTheme` already
provide (PROJECT_MAP already frames `theme.tsx` as owning "the spacing/radius/font/motion scales"). A
screen migrates by `const { spacing, radius, font } = c` — a ~1-line change per component, style bodies
untouched — so the remaining ~80 files are cheap to convert. `tsc` guarantees completeness: removing the
static import surfaces any missed reference as a compile error.

**D-3 — compact = spacing ×0.85, radius ×0.90, font ×1.0 (owner choice; gentle, spacing-led).** Compact
tightens whitespace and corners but **keeps type sizes** — legibility and ≥44pt touch targets are
preserved, matching the theme's own "legibility beats density / touch targets stay ≥44pt" note
(`theme.tsx:22-24`) and `kb.tsx`'s "LEGIBILITY BEATS DENSITY". `pill` radius (999) never shrinks.

**D-4 — Fail-open by reference.** `applyDensity` returns the *same* base object for
`comfortable`/`undefined`, so a config outage, a density-less role, or an unseeded department renders the
comfortable scale with zero churn — matching rule 1 of the server-driven-UI contract.

**D-5 — The numbers are a mobile decision, not a contract.** `density` is enum-only upstream; the
multipliers are owner-locked here (§1) and documented as design, not contract. No contract change is
owed, and none was made.

## 6. Not done here / handed off

- **The other ~80 files** still import the static `spacing`/`radius`/`font` and render **comfortable**
  regardless of `density` until migrated. Each future migration is a ≤8-file phase using the D-2 pattern.
  Highest-value next targets: the other list tabs (`tasks`/`leads`/`claims`) and the shared list
  primitives in `ui/data.tsx`/`ui/identity.tsx` (migrating those lifts density across many screens at
  once). `home.tsx` (62 references, a danger zone) should be migrated deliberately, on its own.
- **Device confirmation** of compact vs comfortable on a real handset in light/dark — not
  editor-buildable (no seeded compact-density doc exists yet; Phase-26/27 seeding backlog).
- **Contract:** no change requested; `density` is consumed exactly as documented (response-only,
  optional, enum). Mobile owes `cgpe-api`/`cgpe-admin` nothing for this phase.
