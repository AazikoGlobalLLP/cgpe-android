# HANDOFF — CGPE Connect (Android) — Phase D5 (typo-tolerant search, [m] half) — 2026-08-24

## Done
- **Search now forgives typos.** A mistyped or transposed character reaches the record: "rajseh"
  finds **Rajesh**, "jeevn" finds **Jeevan**, "ptael" finds **Patel**. This works on the fully-local
  collections (leads / claims / tasks) and on any client/ticket rows the server already returned.
- Typo hits are ranked as a new lowest tier, so a real substring match is never buried by a
  lucky near-miss, and numeric lookups (phone / policy) are deliberately NOT fuzzed.

## Files changed
- `src/lib/fuzzyMatch.ts` — NEW pure leaf. Optimal String Alignment distance (Levenshtein +
  adjacent transposition, so a two-letter swap costs 1 not 2), bounded with early-exit so it stays
  cheap over hundreds of rows per keystroke. Exports `osaWithin` / `fuzzyBudget` / `tokenFuzzyHit`.
- `src/lib/__tests__/fuzzyMatch.test.ts` — NEW, +15 cases pinning the metric, the length thresholds,
  the transposition-costs-1 rule, and the "too short to be safe" refusals.
- `src/app/search.tsx` — one new `T_FUZZY = 0.5` tier in `tierFor` (guarded by `!q.numeric`) plus a
  small `fuzzyMatches(q, valueLower)` wiring helper. Score `5 + weight`: below "contains"
  (`10 + weight`), above a server-only row (`1`).
- `docs/spec/PHASE-D5.md` — NEW. Locks the thresholds and scopes the `[api]` half out.

## Decisions made
- **Fuzzy is a fractional tier (0.5), not a new integer tier.** Keeps the existing `tier*10+weight`
  scoring untouched and guarantees a typo never outranks a genuine substring hit.
- **Numeric queries are excluded from fuzzy.** A wrong digit fuzzy-matching a *different* person's
  phone/policy number is a wrong answer, not a helpful one; the digit path already owns numeric lookups.
- **Thresholds locked, not eyeballed:** query token <4 chars ineligible · 4–6 → 1 edit · 7+ → 2 edits;
  value words <4 chars are never fuzzy targets. Pure + unit-tested so re-tuning is a deliberate edit.
- **Pure logic in its own tested lib**, wiring in the screen — matches the project's seam convention
  (`netResilience`, `pushRouting`, …); `tierFor` itself stays inline/untested as it already was.

## Known broken / deliberately skipped
- **The `[api]` half is NOT done — owner relay owed.** Clients and tickets are searched SERVER-side
  against the ~9k-row book (never pulled to the handset), and that search is exact/substring — so a
  *typed* typo returns **no candidates** for the local scorer to rescue. True whole-book typo tolerance
  needs server-side fuzzy on `GET /api/clients?search=` and `GET /api/tickets?search=`. INBOX left
  untouched on purpose (corruption risk); relay to the owner in plain language (text below).
- **Device-unverified.** JS-only ⇒ OTA-eligible, but no phone has run it. Joins the accumulated OTA
  backlog (A3, B5, D3/B1/D4/C2/D6, E2) all waiting on ONE APK to reach a phone.
- Reports remain OPS-blocked (prod render webhook env unset + n8n template) — unchanged, not code.

## Next session starts here
- Phase D5+: either **relay the `[api]` server-fuzzy ask** and pick the next owner backlog item, OR
  **cut ONE EAS `preview` APK** so all accumulated OTA work (now including D5) reaches the phone.
- First command: `/boot`
- Watch out for: the `[api]` half — do NOT tell the owner "search typos are fully fixed". Client/ticket
  typos across the whole book still miss until the backend `?search=` goes fuzzy. Only local
  collections + already-returned rows are covered by what shipped.

### Plain-language `[api]` relay for the owner
"Make the client and ticket search on the server typo-tolerant. Right now, if you misspell a name,
the app finds nothing from the main client book. The phone app already ranks fuzzy matches — it just
needs the server to return near-miss candidates for `?search=` on clients and tickets."
