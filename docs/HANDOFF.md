# HANDOFF — CGPE Connect (Android) — Band 2 #2: Tasks-tab local search — 2026-08-24

## Done
- **The Tasks tab now has a search box.** Typing filters the already-loaded task list in memory,
  instantly (no network). It forgives typos (`rajseh` → Rajesh), swapped word order (`patel rajesh`
  → "Rajesh Patel"), and matches a client's mobile by its last four digits. It searches the **whole**
  loaded list, so a task in a future month — which the Today/Week/Month/Calendar views cannot reach —
  is now findable. Offline drafts are searchable too and render inert.
- **The search scorer is now shared, not duplicated.** `search.tsx`'s hand-rolled scorer was extracted
  verbatim into a pure, unit-tested `src/lib/searchScore.ts`; the global Search screen and the Tasks tab
  now score a record identically and can't drift. Global search behaviour is unchanged.
- Gates green: `tsc` 0 · `npm test` **863** (+34) · `eslint` 0 new. Commit `c47be1b`, pushed
  `aaziko/Shivam`. OTA-eligible; device-unverified.

## Files changed
- `src/lib/searchScore.ts` — **NEW**. The pure scorer (`buildQuery`/`tierFor`/`bestHit`/`matchesFields`/
  `rank` + tier/weight consts + `Q`/`Field`/`Hit`/`Ranked` types), extracted verbatim from `search.tsx`.
  Imports **only** `@/lib/fuzzyMatch`, so it stays a leaf and is safe in the Vitest graph (no stub).
- `src/data/tasks.ts` — added `taskSearchFields(t)` (the one shared definition of a task's searchable
  columns, with load-bearing weights) and `searchTasks(list, raw)` (pure: blank query returns the list
  unchanged by reference; else filters by `matchesFields`; **preserves input order; no cap**).
- `src/app/search.tsx` — deleted the inline scorer, now imports it from `searchScore`; its local
  `taskFields` was replaced by the shared `taskSearchFields`. **No behaviour change** (parity confirmed).
- `src/app/(tabs)/tasks.tsx` — fixed `SearchBar` below the header (only after first load); when a query is
  present, a flat results list (or an honest no-match/outage `EmptyState`) replaces the hero/time-toggle;
  results reuse `TaskCard` (swipe-complete/reopen work); pending drafts render inert. The write-failure
  banner was hoisted so it shows in both search and normal modes. **`keyboardShouldPersistTaps="handled"`
  + `keyboardDismissMode="on-drag"`** on the ScrollView (see the review bug below).
- `src/lib/__tests__/searchScore.test.ts` — **NEW**, ~30 cases pinning the five tiers, phone-tail path,
  out-of-order matching, the weight tie-break, and `rank`'s cap.
- `src/data/__tests__/tasks.test.ts` — added `searchTasks`/`taskSearchFields` cases: typo/word-order/
  phone-tail, short-token literal requirement, blank-query same-reference, field weights, and the
  **multi-match input-order + `>GROUP_CAP` no-cap contract** (guards a future `rank()`-based regression).

## Decisions made
- **The scorer lives in `lib/searchScore.ts` (pure), the field lists stay with their owners.** `searchScore`
  knows nothing about a Client/Task/Ticket — it scores weighted `Field`s. `taskSearchFields` sits in
  `data/tasks` (next to `Task`) and is imported by BOTH search surfaces, so there's one definition of
  "how a task is searched". This keeps `searchScore` a native-free leaf reachable from the Vitest graph.
- **The Tasks local filter is uncapped and preserves input order** (the tab re-sorts with `sortTasks`),
  unlike the global search's `rank()` which sorts by score and slices to `GROUP_CAP=20`. Capping would
  *hide* matching tasks — wrong for "find a task". The adversarial review agreed (uncapped flag refuted).
- **New UI sentences are hardcoded English; the placeholder reuses `t('common.search')`.** Matches the
  all-English `search.tsx` and the report-fix precedent, so **no 5-language copy is owed**. A brand-new
  i18n key would have owed copy — deliberately avoided.
- **Ran a 10-agent adversarial review workflow after implementing.** Its `parity` pass came back clean;
  it caught one real major bug (below) and three test-hardening items, all fixed before commit.

## Known broken / deliberately skipped
- **This only searches the ALREADY-LOADED list.** The real "word order" fix for tickets/clients is the
  **`[api]` tokenize relay** (the backend `?search=` is a single whole-phrase regex — "patel rajesh" ≠
  "Rajesh Patel"; same owed ask as D5's whole-book fuzzy). Do **not** over-promise the local filter as
  fixing server search. INBOX untouched (no contract change — additive client behaviour).
- **The keyboard-swallows-first-tap bug the review caught** was real: the results ScrollView had no
  `keyboardShouldPersistTaps`, so the SearchBar (which keeps the keyboard up) ate the first tap on every
  result. Fixed to `"handled"` + `keyboardDismissMode="on-drag"`, matching `search.tsx`. **Any new screen
  with a text input above a scrollable tappable list needs this** — now noted in `CLAUDE.md`.
- Device-unverified (OTA) — walk the Tasks-tab search on a device: type a partial name, a typo, a
  4-digit phone tail; confirm the first tap opens a result (no double-tap).

## Next session starts here
- Phase: **Band 2 #3 — task-flow mitigations** (Point 5, P1, OTA). In `(tabs)/tasks.tsx` + `task/[id].tsx`
  + `task-new.tsx`: hide the always-empty "Workflow" checklist card, gate the "Add task" affordances on
  `can_create_task` (so team-tier users aren't invited into a backend 403), add an **Edit-task** screen
  reusing the live PATCH fields, and fix the empty assign/transfer roster. Authoritative worklist:
  `docs/OWNER-BACKLOG-2026-08-24.md` (Point 5, then Point 4 calendar grid).
- First command: `/boot`
- Watch out for: the create-policy half is a **decision + `[api]`** (should team-tier create their own
  tasks at all? the backend 403s them today) — the app can only move the refusal to the *entry* and fix
  the roster; do not silently "enable" creation the backend forbids. And the empty roster is derived from
  a self-scoped source — verify what `getTeam()` returns for a team-tier token before wiring the picker.
