# Band 2 #5 — Client Search in More (owner backlog Point 10) — DECISION: no build

**Date:** 2026-08-24 · **Status:** closed, zero code change · **Owner call recorded so this is not re-litigated.**

## The ask (Point 10)
"Put a Search button in More that opens a simple, fast client search." Verified state: More already
carries **two** entries into the global search — the prominent "Search" quick-action tile
(`src/app/(tabs)/more.tsx:313`, `navKey:'search'`) and the "Global search — Everything" catalogue row
(`more.tsx:119`) — plus the Home search glyph. The proposed delta was a `scope=clients` mode:
one request/keystroke, "Find a client" chrome.

## Owner decision (AskUserQuestion, 2026-08-24)
Chose **"Keep global, just rank clients first"** — explicitly **declined** the new client-only scoped
mode. So no `scope=clients` param, no new More entry, no relabel. Do **not** rebuild the scoped mode
in a future session; it was considered and declined on purpose.

## Why no code change is warranted (verified, not assumed)
Ranking already puts Clients first for the queries a client search is for:
- `src/lib/searchScore.ts` — identifying fields (name/mobile/policy) carry `W_ID=3` and the strongest
  tiers (`T_EXACT=3`/`T_PREFIX=2`); `bestHit` = `tier*10 + weight`, so tier dominates.
- `src/app/search.tsx:546` — groups sort by top score desc, ties break to canonical order where
  **Clients = `order:0`** (first). So Clients lead on any equal-strength match, and lead outright for
  name/mobile/policy lookups (their `W_ID` hits outscore weaker matches elsewhere).
- The **only** time another type leads is when it has a *genuinely stronger* match — e.g. typing a
  claim/ticket reference surfaces that record above a weaker Clients hit. That is the deliberate,
  documented "strongest match answers the query" design (`search.tsx:544-546`).

**Force-pinning the Clients group to the absolute top regardless of match strength would be a
regression**, not the ask: it would bury an exact claim/ticket-reference match under a weaker Clients
group, making reference lookups worse. Declined for that reason unless the owner explicitly overrides.

## Optional, offered (owner may still take it later — one-line change, its own commit)
"Always pin the Clients group first" — a single change to the group sort in `search.tsx` (sort Clients
before all other groups, keep score order inside each group). Tradeoff stated above: reference lookups
would show Clients above a stronger exact reference match. Not implemented; awaiting an explicit yes.

## Notes
- The prominent Search tile is dropped only if `isHidden('search')` (server RBAC). RBAC is unseeded in
  prod (owner backlog Point 6), so defaults show it — the tile is visible to every tier today.
- Gates untouched (no source change): `tsc`/`npm test`/`eslint` unaffected.
- INBOX untouched (no contract change).
