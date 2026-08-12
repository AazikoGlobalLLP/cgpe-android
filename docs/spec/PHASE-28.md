# Phase 28 — Consume the server-driven `theme` (accent + badge)

**Owner-directed (2026-08-12).** Phase 26 left three levers open; the owner picked lever (c),
"finish consuming `theme`". `normalizeTheme` (`store/appUi.tsx`) has parsed `theme` into
`{ accent, badge_label, density }` since before Phase 26, but **no code read it**. This phase
makes two of the three facets live on device and defers the third with a documented reason.

## 1. Scope (owner-locked)

Three decisions were locked with the owner before any code was written:

- **Facets:** consume **`accent`** and **`badge_label`** now; **defer `density`** (D-4).
- **Accent reach:** recolour the brand `primary` family **and** the signature gradient
  (`gradientBrand`) — the "primary + gradient" option, not solid-primary-only (D-2).
- **Badge placement:** the **Home greeting header** (D-3).

## 2. Source of truth (verified 2026-08-12)

- **Shape** — `theme?: { accent?: string; badge_label?: string; density?: 'comfortable' | 'compact' }`
  (`api.ts:2673`; schema `ui_rbac_config.json:151-160`; `models.md` §`app_role_preferences`).
  `theme` is **optional and omitted when unset** (App-UI drift D12; a `theme:null` is
  schema-invalid), so absence must mean "inherit the azure/teal system", never "blank".
- **`accent`** is a `#RRGGBB` string; **`badge_label`** ≤12 chars; **`density`** ∈
  `{comfortable, compact}`. All three are already validated/clamped by `normalizeTheme`
  (`appUi.tsx:279-288`) — this phase only *consumes* that output, it does not re-parse the wire.
- **Documented accent intent** — the panel's own prose contract, `ADMIN_PANEL_SYNC.md` §3.6.9:
  *"If you ever add `theme.accent`, … swap `M.primary` for the chosen accent."* So accent
  overrides the **brand `primary`**, not the separate teal `accent` token, and not semantic
  status colours.
- **Provider order is load-bearing** — `ThemeProvider` sits **above** `AppUiProvider`
  (`_layout.tsx`), and the config (needed for the accent) is only available *inside*
  `AppUiProvider`. `ConfirmProvider`/`ToastProvider`/`RootNav` all sit inside `AppUiProvider`,
  so a bridge placed there can re-theme the whole app without moving the base `ThemeProvider`
  (which must stay on top so those overlays are themed) — see D-1.

## 3. What shipped

1. **`src/theme/brand.ts` (new, pure).** `deriveBrandPalette(base, accent)` — a deterministic
   transform: no valid accent → returns the base palette **by reference** (fail-open); a valid
   accent → overrides `primary` (= the accent), `primaryDark` (darken 14%), `primaryGlow`
   (lighten 24%), `primarySoft` (scheme's card tinted toward the accent), `onPrimary`
   (white/near-black by luminance, 150/255 threshold) and `gradientBrand`
   (`[primaryDark, primary, primaryGlow]`). Every other token — neutrals, semantic colours,
   tile inks, `gradientHero`/`gradientAccent` — passes through verbatim. **No colour is invented;**
   each is a transform of the given accent. Imports only the `Palette` **type** (erased), so it
   is unit-testable with no React and no native stub.
2. **`src/theme/theme.tsx`.** Re-exports `deriveBrandPalette` and adds `PaletteProvider` — a raw
   `ThemeContext` re-provider (the context is module-private), used by the bridge.
3. **`src/app/_layout.tsx`.** New `BrandTheme` bridge mounted **inside** `AppUiProvider`
   (above `JobsProvider`): reads `config.theme?.accent` + the base palette, memoises
   `deriveBrandPalette`, and re-provides via `PaletteProvider`. Every `useTheme()` consumer below
   picks up the branded palette; a config outage / accent-less role gets the base palette unchanged.
4. **`src/app/(tabs)/home.tsx`.** A small department badge (`config.theme?.badge_label`, ≤12 chars,
   uppercased) in the greeting header, styled in the brand `primary` family so a set accent tints
   it to match. Renders **only** when `badge_label` is present.
5. **`src/theme/__tests__/brand.test.ts` (new).** 9 cases pinning `deriveBrandPalette`:
   fail-open reference-equality, malformed-accent rejection, primary/gradient/onPrimary/soft
   derivation, scheme-dependent soft tint, pass-through of neutrals & semantics, determinism.

## 4. Done when

- `npx tsc --noEmit` clean · `npm test` green · no new lint errors — **all met**
  (tsc 0; **407/407**, +9; lint 0 errors / 12 warnings baseline).
- **Device check (carried, not editor-buildable):** on a handset, a role whose `app_role_preferences`
  doc carries a `theme.accent` + `badge_label` shows the recoloured primary/gradient and the badge,
  in **both** light and dark at 390 px; a role with no `theme` is unchanged azure/teal; the accent
  settles gracefully on config arrival (no flash). Requires a seeded dept config with a theme.

## 5. Decisions

**D-1 — Bridge inside `AppUiProvider`, do NOT reorder the top tree.** Moving `ThemeProvider`
below `AppUiProvider` would un-theme the `Confirm`/`Toast` overlays that sit between them. Instead
a `BrandTheme` bridge inside `AppUiProvider` re-provides an accented palette to everything below
via `PaletteProvider`. The base `ThemeProvider` stays on top and still provides the scheme-correct
palette the bridge derives from.

**D-2 — Accent reaches `primary` + `gradientBrand` (owner choice).** Solid-primary surfaces AND
the signature gradient (clock-in ring, active-tab pill) follow the department accent, for a
cohesive per-department look. Semantic colours (success/warning/danger/info/whatsapp/gold) and the
teal `accent` token are **deliberately left alone** — accent is brand identity, not a status recolour.

**D-3 — Badge in the Home greeting header (owner choice).** Home is where the user lands and where
department identity is most meaningful; it already consumes `useAppUi()`, so no new wiring — one
guarded JSX addition. The badge uses the brand `primary` family, so it inherits any accent.

**D-4 — Density deferred, with reason.** `spacing`/`radius`/`font` are **static module constants**
imported directly by ~81 files (not read off the palette), so making `density` change layout means
converting that whole scale to a runtime, context-driven scale across every importer — a large,
cross-cutting, mostly device-verified refactor, a different size of job than accent/badge. Deferred
as its own phase. Until then a `density` value is parsed and ignored (no effect, no error).

**D-5 — Fail-open by reference.** `deriveBrandPalette` returns the *same* base object when there is
no valid accent, so a config outage, an accent-less role, or an unseeded department renders the
built-in azure/teal identity with zero churn — matching rule 1 of the server-driven-UI contract
(a layout outage must never degrade the app).

## 6. Not done here / handed off

- **`density` consumption** — deferred (D-4); needs the static spacing/radius/font scale converted
  to a runtime context first.
- **Device confirmation** of accent + badge in light/dark against a real themed dept config — not
  editor-buildable (no seeded theme doc exists yet; ties into the Phase-26/27 seeding backlog).
- **Contract:** no change requested. `theme` is consumed exactly as `api.md`/`models.md` document
  it (response-only, optional, passed through unvalidated); mobile owes `cgpe-api`/`cgpe-admin`
  nothing for this phase. `ADMIN_PANEL_SYNC.md` §3.6.9's "if you ever add `theme.accent`" note is
  now satisfied on the device side.
