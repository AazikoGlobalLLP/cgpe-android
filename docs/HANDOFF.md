# HANDOFF — CGPE Connect (Android) — Phase 29 — 2026-08-12

Phase 28 deferred `theme.density` (D-4) because the layout scale was static consts in ~81 files. This
session **built the density mechanism** and migrated **one** proof screen (the owner-locked "mechanism +
one screen" approach, not a big-bang). A code session, all three gates green, commit local (push still
403s). The `compact` numbers and the blast-radius decision were **owner-locked via AskUserQuestion**
before any code, because `density` is enum-only upstream (no numbers written down anywhere).

## Done
- **A department whose config sets `theme.density: "compact"` now renders a visibly tighter Clients
  list** — spacing and corner radii shrink (spacing ×0.85, radius ×0.90), while **type sizes and ≥44pt
  touch targets stay unchanged** (legibility). Renders on the next cold start, no APK. A
  `comfortable`/absent role is unchanged (fail-open by reference).
- **The runtime density mechanism exists app-wide** and is non-regressive: every screen NOT yet migrated
  still renders the comfortable scale exactly as before. Only migrated screens (so far `clients.tsx`)
  react to `density`.
- **The numbers are pinned by tests** and documented as a mobile design decision (not a contract).

## Files changed
- `src/theme/density.ts` (new, pure) — `applyDensity(base, density)`: fail-open by reference for
  comfortable/absent; `compact` tightens spacing/radius (`Math.round`, `pill` preserved), font + colours
  pass through. Reads the comfortable scale off the palette, so the numbers live in one place. Imports
  only erased types (unit-tests with no React/native stub, like `brand.ts`).
- `src/theme/theme.tsx` — layout scale now lives ON the `Palette` (new `Spacing`/`Radius`/`Font` types)
  so `useTheme()` carries it; the static `spacing`/`radius`/`font` exports stay = comfortable so the ~80
  unmigrated importers are non-regressive. Re-exports `applyDensity`.
- `src/app/_layout.tsx` — the `BrandTheme` bridge applies density AFTER accent
  (`applyDensity(deriveBrandPalette(base, accent), density)`).
- `src/app/(tabs)/clients.tsx` — migrated to read the scale off `c` via destructuring; module-scope
  `SEP_INSET` became a `sepInset(spacing)` helper so separators stay aligned when the gutter tightens.
- `src/theme/__tests__/density.test.ts` (new, +10) — pins the exact compact numbers, fail-open
  reference-equality, font-unchanged, base-not-mutated, pass-through, determinism.
- `docs/spec/PHASE-29.md` (new); `docs/DECISIONS.md` + `docs/PHASES.md` + `docs/STATUS.md` + project
  `CLAUDE.md` (density danger-zone note) updated. Commit `b77dcab` (9 files, local — push still 403s).
  `.claude/settings.json` left as-is (modified before this session).

## Decisions made
- **D-1 — mechanism + one screen, not a big-bang (owner).** Converting all ~81 files in one phase breaks
  the ≤8-files convention, is mostly device-verified, and is risky. Ship the mechanism, keep static
  exports = comfortable (non-regressive), migrate `clients.tsx` as proof; the rest migrate incrementally.
- **D-2 — scale lives on the `Palette`; migrate by destructuring.** One context (reuses the Phase-28
  bridge/`PaletteProvider`); a screen migrates via `const { spacing, radius, font } = c` — style bodies
  untouched, so the ~80 remaining files are cheap. `tsc` guarantees completeness (strip the import → any
  miss is a compile error).
- **D-3 — compact = spacing ×0.85, radius ×0.90, font ×1.0 (owner; gentle, spacing-led).** Type sizes
  kept for legibility/≥44pt targets; `pill` never shrinks.
- **D-4 — fail-open by reference** (comfortable/absent → the same base object).
- **D-5 — the numbers are a mobile decision, not a contract.** `density` is enum-only upstream; no
  contract change is owed and none was made.

## Known broken / deliberately skipped
- **Device check (carried) — the only thing left for Phase 29.** A role with `theme.density:"compact"`
  showing a tighter Clients list in light/dark at 390 px, type/targets unchanged; a comfortable role
  unchanged. **Not editor-buildable: no compact-density dept doc is seeded yet** (Phase-26/27 seeding backlog).
- **The other ~80 files** still render comfortable until migrated — deliberately deferred to later ≤8-file
  phases (D-1/D-2). This is the top editor-buildable lever now.
- **INBOX honesty note (deliberately skipped, low-value):** the Phase-28 `→ cgpe-admin` FYI said
  `theme.density` "has no device effect yet" — now updated in that item to "consumed on migrated screens."
- **⚠️ SECURITY (carried, unchanged):** `cgpe-backend-main/scripts/seedAppRolePreferences.js:56` still
  hardcodes a live Atlas credential — **remove + rotate before that file is committed anywhere.** Sibling
  repo, not touched.
- **Phase 27 (`resolveRoleKey`) still awaiting `cgpe-api`** — INBOX ask still `[ ]` (unanswered).
- **Device-verification backlog** carried (Phases 1/4/5/6/7/9/10/12/13/16/23/24/25/28 + now 29).
- **`git push` still 403s** — all commits local.

## Next session starts here
- **Phase 30 — continue the density rollout:** migrate the next screens to the D-2 pattern (best targets:
  the list tabs `tasks`/`leads`/`claims`, then the shared `ui/data.tsx` + `ui/identity.tsx` list
  primitives, which lift density across many screens at once; `home.tsx` — 62 refs, a danger zone — on its
  own). No backend, no copy — buildable today. Or, if `cgpe-api` has replied to the `resolveRoleKey` ask,
  do Phase 27 verification instead.
- **First command:** `/boot`
- **Watch out for:** when migrating a screen, strip the static `spacing`/`radius`/`font` import and let
  `tsc` flag every reference — but check for **module-scope** uses (like `clients.tsx`'s old `SEP_INSET`),
  which a hook/destructure can't cover and must become a helper taking the scale. And the load-bearing
  provider order in `_layout.tsx` — `BrandTheme` now applies BOTH accent and density; do not reorder.
