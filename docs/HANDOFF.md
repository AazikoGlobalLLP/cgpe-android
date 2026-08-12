# HANDOFF — CGPE Connect (Android) — Phase 31 — 2026-08-12

Phase 29 built the density mechanism + migrated one proof screen (`clients.tsx`); Phase 30 migrated the
three other core list tabs (`tasks`/`leads`/`claims`). This session continued the rollout onto the
**shared list primitives** (`ui/data.tsx` + `ui/identity.tsx`) — the highest-leverage target, because these
are consumed by many screens, so migrating them lifts `theme.density:"compact"` onto the ELEMENTS they
render across the whole app at once. Pure rollout — no mechanism change, no contract change, no new copy.
All three gates green, two commits local (push still 403s).

## Done
- **A department whose config sets `theme.density: "compact"` now renders the shared list ELEMENTS tighter
  wherever they appear** — status Pills, StatCard/MetricTile number tiles, DataRow/ListSection detail rows,
  KpiStrip chips, ActionTile quick actions, and PersonRow/Avatar people rows — spacing ×0.85, radius ×0.90,
  type sizes and ≥44pt touch targets unchanged. Renders on the next cold start, no APK. A
  `comfortable`/absent role is unchanged (fail-open by reference).
- **Honest nuance (not overclaimed):** a not-yet-migrated screen's **own** outer layout (its container
  padding/gaps, still computed from the static exports) stays comfortable until that screen is migrated too.
  So this widens density's reach substantially without making any single unmigrated screen fully compact.
- **Non-regressive:** every file NOT yet migrated (~73, incl. `home.tsx` and `base`/`controls`/`feedback`/
  `sheet`) still renders comfortable exactly as before — the static `spacing`/`radius`/`font` exports are
  untouched.

## Files changed
- `src/ui/data.tsx` — static `{ font, radius, spacing }` import stripped; `Pill`→`{radius,font}`,
  `StatCard`→`{spacing,font}`, `DeltaBadge`→`{radius,font}`, `MetricTile`→`{spacing,font}`,
  `DataRow`→`{spacing,font}`, `ListSection`→`{spacing,radius,font}`, `KpiChip`→`{spacing,radius,font}`,
  `ActionTile`→`{spacing,radius}` all destructure off `c`. `KpiStrip` had **no `useTheme()` call at all** and
  now reads `{spacing}` (hook placed before its early return). The module-scope `PILL_FS` const became a
  `pillFs(font)` helper, computed per-component off `c.font` (font never scales, but the size is still read
  off the scale, not copied). `Sparkline`/`Label`/`usePressScale` use no scale tokens — untouched.
- `src/ui/identity.tsx` — same import strip; `PersonRow` destructures `{spacing,radius,font}`.
  `Avatar`/`AvatarStack` use only size-derived literals — untouched. Commit `2dd37fe` (2 files, local).
- `docs/spec/PHASE-31.md` (new); `docs/PHASES.md` (`## Now` + `## Next 3`) + `docs/DECISIONS.md` +
  `docs/STATUS.md` + project `CLAUDE.md` (density note: primitives now migrated, ~73 remain, the
  element-vs-own-layout nuance, the `pillFs`/`KpiStrip` gotchas). Commit `5697d3c` (docs), local — push
  still 403s. `.claude/settings.json` left as-is (modified before this session).

## Decisions made
- **D-1 — reuse the Phase-29 D-2 pattern verbatim; no mechanism change.** The mechanism is done; this is
  pure rollout. Strip the static import, destructure off `c`, `tsc` proves completeness.
- **D-2 — destructure precisely what each component uses** (`{radius,font}`, `{spacing,radius}`, …) — precise
  destructuring avoids `no-unused-vars` warnings and keeps the diff faithful.
- **D-3 — two non-mechanical cases handled as helpers/hooks, not literals.** `data.tsx`'s module-scope
  `PILL_FS` → a `pillFs(font)` helper (a module const can't react to context; identical treatment to
  `clients.tsx`/`leads.tsx`'s `sepInset`); `KpiStrip` had no `useTheme()` at all and gains one before its
  early return (Rules of Hooks). Every other component already called `useTheme()`.
- **D-4 — two files, the primitives only** — kept within the ≤8-files convention; the remaining primitives
  (`base`/`controls`/`feedback`/`sheet`) and `home.tsx` (62 refs, danger zone) are separate later phases.
- **D-5 — leverage nuance recorded, not overclaimed** (see Done, second bullet).

## Known broken / deliberately skipped
- **Device check (carried — the only thing left for Phase 31).** A role with `theme.density:"compact"`
  showing tighter primitives in light/dark at 390 px, type/targets unchanged; a comfortable role unchanged.
  **Not editor-buildable: no compact-density dept doc is seeded yet** (Phase-26/27 seeding backlog) — same
  prerequisite as Phases 29/30.
- **The other ~73 files** still render their own outer layout comfortable until migrated — deliberately
  deferred. Top targets: the remaining shared primitives `ui/base.tsx`/`ui/controls.tsx`/`ui/feedback.tsx`/
  `ui/sheet.tsx`, then `home.tsx` on its own. These are the top editor-buildable levers now.
- **No new test** — presentational migration, no new pure logic (same untested class as the
  `clients.tsx`/list-tab migrations; the density numbers are already pinned by `density.test.ts`).
- **⚠️ SECURITY (carried, unchanged):** `cgpe-backend-main/scripts/seedAppRolePreferences.js:56` still
  hardcodes a live Atlas credential — **remove + rotate before that file is committed anywhere.** Sibling
  repo, not touched.
- **Phase 27 (`resolveRoleKey`) still awaiting `cgpe-api`** — INBOX ask still `[ ]` (unanswered).
- **Device-verification backlog** carried (Phases 1/4/5/6/7/9/10/12/13/16/23/24/25/28/29/30 + now 31).
- **`git push` still 403s** — all commits local (stored credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; needs a human to grant access or swap the credential).
- **No contract change / no INBOX activity this phase** — density is enum-only upstream and consumed exactly
  as documented; nothing crosses a repo boundary, no sibling session needs notifying.

## Next session starts here
- **Phase 32 — continue the density rollout:** migrate the remaining shared primitives `ui/base.tsx` +
  `ui/controls.tsx` + `ui/feedback.tsx` + `ui/sheet.tsx` (or `home.tsx`, 62 refs, a danger zone, on its
  own). Same D-2 pattern. No backend, no copy — buildable today. Or, if `cgpe-api` has replied to the
  Phase-27 `resolveRoleKey` ask, do Phase 27 verification instead.
- **First command:** `/boot`
- **Watch out for:** in these primitives, look for **module-scope** scale uses (a const capturing the scale
  at load, like `data.tsx`'s old `PILL_FS`) — they can't be destructured off `c`, so turn them into a helper
  that takes the scale; and for components with **no `useTheme()` call at all** (like `KpiStrip` was) — add
  the hook. `tsc` flags every stale reference once the static import is gone, but it does NOT flag a
  component that quietly relied on the module import with no hook of its own. And do not reorder the
  load-bearing providers in `_layout.tsx` — `BrandTheme` applies both accent and density.
