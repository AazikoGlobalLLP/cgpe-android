# HANDOFF — CGPE Connect (Android) — Phase 28 — 2026-08-12

The owner picked, of the two remaining Phase-26 levers, **(c) "finish consuming `theme`."** This
session **built it** — the server-driven `theme.accent` and `theme.badge_label` are now live on
device (density deferred with a documented reason). A code session, all three gates green, commit
local (push still 403s).

## Done
- **A department's `app_role_preferences.theme.accent` now recolours the app's brand.** When a role's
  config carries a `#RRGGBB` accent, the app's `primary` family (buttons, links, primary pills,
  active-tab text) **and** the signature gradient (clock-in ring, active-tab pill) render in that
  colour, in both light and dark, on the next cold start — no APK. A role with no `theme`, or a
  config outage, renders the built-in azure/teal identity **unchanged** (fail-open by reference).
- **A department badge shows on Home.** `theme.badge_label` (≤12 chars) renders as a small chip in
  the Home greeting header, styled in the brand-`primary` family so a set accent tints it to match;
  absent `badge_label` draws nothing.
- **The provider-order knot the last handoff flagged is solved without a risky reorder** — see D-1.
- **Confirmed no contract change is owed:** `theme` is consumed exactly as `api.md`/`models.md`
  document it (response-only, optional, passed through unvalidated). `ADMIN_PANEL_SYNC.md` §3.6.9's
  "if you ever add `theme.accent`" note is now satisfied on the device side.

## Files changed
- `src/theme/brand.ts` (new) — pure `deriveBrandPalette(base, accent)`: deterministic override of
  `primary`/`primaryDark`/`primaryGlow`/`primarySoft`/`onPrimary` + `gradientBrand` from the accent;
  returns the base palette **by reference** when there is no valid accent (fail-open). Imports only
  the `Palette` **type** (erased), so it unit-tests with no React and no native stub.
- `src/theme/theme.tsx` — re-exports `deriveBrandPalette`; adds `PaletteProvider` (raw `ThemeContext`
  re-provider, needed because the context is module-private).
- `src/app/_layout.tsx` — new `BrandTheme` bridge mounted **inside** `AppUiProvider` (above
  `JobsProvider`): reads `config.theme?.accent` + the base palette, memoises `deriveBrandPalette`,
  re-provides via `PaletteProvider`.
- `src/app/(tabs)/home.tsx` — the department badge (guarded on `config.theme?.badge_label`) in the
  greeting header.
- `src/theme/__tests__/brand.test.ts` (new) — 9 cases pinning `deriveBrandPalette`.
- `docs/spec/PHASE-28.md` (new); `docs/DECISIONS.md` + `docs/PHASES.md` + `docs/STATUS.md` updated.
- Commit `877a07f` (8 files, local — push still 403s). `.claude/settings.json` left as-is (modified
  before this session).

## Decisions made
- **D-1 — bridge inside `AppUiProvider`, do NOT reorder the top tree.** Moving `ThemeProvider` below
  `AppUiProvider` would un-theme the `Confirm`/`Toast` overlays between them. A `BrandTheme` bridge
  inside `AppUiProvider` re-provides an accented palette to everything below; the base `ThemeProvider`
  stays on top and supplies the scheme-correct palette the bridge derives from.
- **D-2 — accent reaches `primary` + `gradientBrand` (owner choice).** Semantic colours
  (success/warning/danger/info/whatsapp/gold) and the separate teal `accent` token are deliberately
  left untouched — accent is brand identity, not a status recolour.
- **D-3 — badge in the Home greeting header (owner choice).**
- **D-4 — density deferred, with reason.** `spacing`/`radius`/`font` are **static module constants**
  imported directly by ~81 files (not read off the palette), so making `density` change layout needs
  that whole scale converted to a runtime context — a large cross-cutting refactor, its own phase.
  Until then a `density` value is parsed and ignored (no effect, no error).
- **D-5 — fail-open by reference.** No valid accent → the *same* base object is returned, so an
  outage/accent-less role restyles nothing.

## Known broken / deliberately skipped
- **Device check (carried) — the only thing left for Phase 28.** A role whose config carries
  `theme.accent` + `badge_label` showing the recoloured primary/gradient + badge in light/dark at
  390 px, and an accent-less role staying azure. **Not editor-buildable: no themed dept doc is
  seeded yet** (ties into the Phase-26/27 seeding backlog).
- **`density` consumption** — deferred (D-4), a separate phase.
- **⚠️ SECURITY (carried, unchanged):** `cgpe-backend-main/scripts/seedAppRolePreferences.js:56`
  still hardcodes a live Atlas credential as an `||` fallback — **remove + rotate before that file is
  committed anywhere.** Sibling repo, not touched this session.
- **Phase 27 (`resolveRoleKey`) still awaiting `cgpe-api`** — INBOX ask box still `[ ]` (unanswered).
- **Device-verification backlog** carried (Phases 1/4/5/6/7/9/10/12/13/16/23/24/25/26 + now 28).
- **`git push` still 403s** — all commits local.

## Next session starts here
- **Phase 29 (or continue 27):** if `cgpe-api` has replied to the `resolveRoleKey` ask, verify their
  shipped shape against their real code and confirm a new dept key renders. Otherwise the board is
  editor-exhausted again — remaining levers are Phase-29 **density** (a real editor-buildable but
  large runtime-scale refactor across ~81 files), the seeding backlog (owner-run, live-Mongo,
  sibling repo), i18n Tier-1 wiring (blocked on human copy), and the device-verification backlog.
- **First command:** `/boot`
- **Watch out for:** the load-bearing provider order in `_layout.tsx` — `BrandTheme` now sits inside
  `AppUiProvider` and re-provides the palette; do **not** "simplify" it by moving `ThemeProvider`
  below `AppUiProvider` (it would un-theme Confirm/Toast). And `../contracts/INBOX.md` still shifts
  under concurrent writes (anchor edits on surrounding text, grep replies back).
