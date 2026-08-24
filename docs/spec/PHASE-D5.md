# PHASE D5 — Typo-tolerant search (the `[m]` half)

**Owner ask:** search should still find a record when the query is *mistyped* — "rajseh" for
"Rajesh", "jeevn" for "Jeevan". Today `search.tsx`'s scorer is tiered substring matching
(exact / prefix / contains / compact / token) with **no edit-distance**, so a single wrong or
transposed character misses entirely.

## What ships here (`[m]`, buildable, this phase)
A last-resort **fuzzy tier** below "contains", so a query token within a small edit budget of a
word in the record still matches — for the fully-local collections (leads / claims / tasks) and
for any client/ticket rows the server returned.

### Rules (locked, numeric — no invented values)
1. **Metric:** Optimal String Alignment distance (Levenshtein + adjacent transposition), so a
   transposition like `rajseh`→`rajesh` costs **1**, not 2. Bounded with early-exit.
2. **Eligibility by query-token length L** (`fuzzyBudget`):
   - `L < 4` → **not eligible** (0 budget). Below four letters too many words sit within one edit.
   - `4 ≤ L ≤ 6` → budget **1**.
   - `L ≥ 7` → budget **2**.
   A value word must also be `≥ 4` chars to be a fuzzy target.
3. **Numeric queries are excluded.** A mistyped digit must never fuzzy-match a *different*
   person's phone / policy number. `q.numeric` short-circuits to no fuzzy.
4. **Multi-token:** every query token must be satisfied — a `< 4` token by substring, a `≥ 4`
   token by fuzzy budget. `rajseh ptael` → `Rajesh Patel`.
5. **Rank:** fuzzy tier `T_FUZZY = 0.5` → score `5 + fieldWeight` (5–8). Below a genuine
   "contains" (`10 + weight`) and above a server-only row (`1`). Typo hits never outrank a real
   substring hit.

### Files
- `src/lib/fuzzyMatch.ts` — pure: `osaWithin`, `fuzzyBudget`, `tokenFuzzyHit` (leaf, no app imports).
- `src/lib/__tests__/fuzzyMatch.test.ts` — unit tests for all three.
- `src/app/search.tsx` — one new lowest tier in `tierFor` guarded by `!q.numeric`, plus a small
  `fuzzyMatches(q, value)` wiring helper.

### Done when
`tsc` 0 · `npm test` green (new suite added) · eslint 0 new. Device-unverified (JS-only, OTA-eligible).

## The `[api]` half (NOT this phase — owner relay)
Clients and tickets are **server-searched** against the ~9k-row book (never pulled to the
handset), and that search is exact/substring — so a typed typo returns **no candidates** for the
local scorer to rescue. True whole-book typo tolerance for clients/tickets needs **server-side
fuzzy** (`GET /api/clients?search=`, `GET /api/tickets?search=`). Relay to the owner; do not touch
`INBOX.md` (corruption risk — these cross-repo asks are handed as plain-language relays).
