# Phase 24 — Surface the per-client coverage score on Smart segments

**Built 2026-08-12.** The one fresh editor-buildable lever after the board went editor-exhausted:
`cgpe-api` backend Phase 30 (P2-CL-01) landed a **response-only** per-row `coverage_score` on
`GET /api/clients/segments` — an endpoint mobile already calls. Additive, contract already carries
it, no backend dependency, no new INBOX ask. This renders that adequacy figure on the segments
screen so the underinsured/well-insured story the screen is built around now carries a number.

## Goal
Render each client/household's server-derived `coverage_score` (life cover as a % of the ₹1cr
benchmark) on `src/app/segments.tsx` — glanceable on the row, detailed in the sheet — without any
on-device arithmetic, and without ever drawing a fabricated `0%` for a `null`.

## Files
- `src/app/segments.tsx` — one field added to `RowView` + `toRowView` (guarded `asNum` read);
  the row's cover readout gains `· NN%`; the detail sheet's `ListSection` gains a "Coverage" row.

## Source of truth (verified in the contract, not tags)
- `contracts/api.md` §`/api/clients` `/segments` row: each entry in `data.rows` carries a derived
  `coverage_score` = `floor( min(1, total_life_cover / thresholds.coverage) × 100 )`, integer
  `0..100` **or `null` when no cover is on file**. Invariant stated there: `100` ⟺ `well_insured`,
  `<100` ⟺ `underinsured`, `null` ⟺ `no_coverage`. `floor` means a cover just under the benchmark
  reads `99`, not `100`.
- `contracts/models.md` §`Client` — "Derived response field (NOT stored)": same definition,
  response-only, no column in the `clients` collection.
- Mobile sends **no** `?coverageThreshold=` (`getClientSegments`, `api.ts:2480`), so the benchmark
  is always the server default (₹1cr) — but the row never asserts that rupee figure (see D-3).

## Done when
`npx tsc --noEmit` clean · `npm test` green · no new lint errors — **all met**: tsc exit 0,
`npm test` **373/373** (unchanged — see D-4), lint 0 errors / 12 warnings (baseline). A segment row
whose server row carries `coverage_score` shows an integer `NN%`; a `null` shows no coverage line
(never `0%`); a real `0` (a tiny cover that floors to 0) shows `0%`. Device check (renders on a real
handset, light/dark at 390 px, against production data) outstanding.

## Decisions

**D-1 — `null` is hidden, never `0%`; a real `0` is shown.** The contract's `null` means "no cover on
file" — the screen already carries a `no_coverage` / "No cover on file" flag for that, so a `null`
`coverage_score` draws no coverage line at all. But because the formula floors, a tiny positive cover
can legitimately produce `0` (e.g. ₹1,000 against a ₹1cr benchmark → `0`), which is real low-coverage
data and IS shown as `0%`. The guard `asNum(o.coverage_score)` preserves this distinction: `0` stays
`0`, missing/`null` becomes `null`. This is the "a missing number stays null and is not drawn" rule
the file's own `asNum` doctrine already states (`segments.tsx:59-64`).

**D-2 — Shown twice: glanceable on the row, labelled in the sheet.** The row's own comment says
"Cover is the figure every flag on this screen is ultimately about, so it belongs on the row rather
than one tap deeper" (`segments.tsx:600`). `coverage_score` is the normalised form of exactly that,
so it rides the existing right-hand cover readout as `₹5L cover · 62%` (a one-token, `numberOfLines={1}`
append — no new layout). The detail sheet adds a full "Coverage" `DataRow` (`NN%`) right after "Life
cover", where the ₹ and the % sit together.

**D-3 — No rupee benchmark asserted on the row.** The row shows `· 62%`, not `· 62% of ₹1cr`. Mobile
does not read `data.thresholds.coverage` into the row, and CLAUDE.md forbids asserting a number that
isn't in front of us. The percent is unambiguous next to the ₹ cover; the benchmark stays the
server's business.

**D-4 — Tone follows the server's own invariant; no new threshold invented.** The sheet's Coverage
row is `success` at `>= 100`, `warning` below — which is exactly the contract's documented invariant
(`100` ⟺ well insured, `<100` ⟺ underinsured) and byte-consistent with the `underinsured`/`well_insured`
flag Pills the same screen already renders in the same tones. So the colour is the server's decision
surfaced, not a client-side cutoff.

**D-5 — No new test.** The change is a guarded row-mapper passthrough (one `asNum` line, identical in
kind to the ~15 other fields `toRowView` reads, none individually tested) plus presentational JSX.
`toRowView` is private to the screen file and importing a screen module into Vitest would pull React
Native in with no renderer — the same untested class as Phases 8/11/17. `npm test` stays **373/373**;
the display logic (`null` → hidden, `0` → `0%`, tone by invariant) is inline JSX, not a pure function,
and extracting a helper to test one ternary would be over-engineering.

## Not done (deliberate)
- **Sorting/filtering by coverage score.** The screen already sorts by `coverage_asc`/`coverage_desc`
  (rupee cover) server-side; a score-based sort/filter would be a new `getClientSegments` param and a
  backend change — out of scope for a response-only render.
- **Surfacing `thresholds.coverage` or a progress bar.** A `<Meter>` of `score/100` was considered but
  the compact `NN%` reads cleaner in a dense list; the sheet's tone already signals adequacy.
- **Device check.** Renders against real production data on a handset, light/dark at 390 px — not
  editor-buildable.
