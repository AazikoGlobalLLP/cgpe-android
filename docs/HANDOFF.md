# HANDOFF — CGPE Connect (Android) — i18n widening SCOPED (no build) — 2026-08-11

Board was editor-exhausted: Phase 16 self-view is **still backend-blocked** and no other phase was
unblocked. Re-verified the blocker against `cgpe-api`'s **real code** (not tags/INBOX), then — at the
user's "whatever you suggest" — **scoped** the `t()` language-widening work into a decision-ready
deliverable in `docs/i18n/`. **Nothing was built, no dictionary edited, no string translated.**

## Done
- **Re-confirmed Phase 16 is still blocked, three ways.** INBOX foot (the narrowed self-earnings ask,
  `INBOX.md` ~line 3245–3290) has **no `cgpe-api` reply**; and the producer's live code still gates the
  whole payroll router admin-only — `routes/payroll.js:22-23` = `router.use(protect); router.use(authorize('admin'))`,
  routes are only `/profiles`, `/profiles/:userId`, `/compute`, `/export`, **no `my-earnings`**,
  `req.user.user_id` appears only as a profile-write audit field. So the self-scoped read still does not exist.
- **Scoped the `t()` widening** (PHASES "Next 3" #3) via six parallel read-only extraction passes over
  ~45 screens. Produced `docs/i18n/SCOPE.md` (the plan) + `docs/i18n/inventory/01–06*.md` (the full
  string list: screen · line · kind · English · proposed key). Observable facts now on record:
  only **74 keys** are wired via `t()` in 6 files (all partial); **~40 screens are 100% hardcoded
  English**; **~1,800 string occurrences** → ~1,200–1,400 unique keys after a `common.*` dedup.
- **Surfaced three prerequisites** a future builder needs before any copy helps (see DECISIONS today):
  (1) `t()` has **no interpolation** — ~30% of strings are dynamic and need a `t(key, params)` + plural
  extension, must not be concatenated (Hindi/Gujarati word order); (2) a `common.*` shared layer
  ("Try again" ×~30, the ~8-variant outage body); (3) the parity test hard-codes `EN_KEYS.length === 74`
  **and** its leak check only rejects `value === key`, **not** `value === English` — so a Gujarati entry
  left as English **passes silently**. Verified against the real test file.

## Files changed
- `docs/i18n/SCOPE.md` — **new**: coverage map, volume, 3 prerequisites, priority tiers, how to supply copy.
- `docs/i18n/inventory/01-home-account-auth.md … 06-attendance-team.md` — **new**: the full extracted worklist.
- `docs/DECISIONS.md`, `docs/PHASES.md` (Now + Next-3 #3 + board), `docs/STATUS.md` (manager rewrite), this file.
- `CLAUDE.md` — appended an i18n trap note (parity-test hard-count + `value===English` blind spot; `t()` no interpolation).
- Memory: `i18n-widening-scope.md` (+ MEMORY.md pointer).
- **No `src/` change. No contract/INBOX change** (app-side scoping only — no sibling notification needed).

## Decisions made
- **Scoped, did not build.** Widening `t()` needs human-supplied Hinglish/Gujlish/Hindi/Gujarati copy
  (~4,800 non-English strings) — not a solo editor task, and PHASE-19 §4 forbids machine translation. So
  the useful move was to turn ~1,800 raw strings into a plan + worklist that lets the owner decide.
- **Fan-out extraction, then synthesise.** Six parallel read-only agents (not a Workflow) — proportionate
  to a broad read across ~45 screens; results consolidated by hand into `docs/i18n/`.

## Known broken / deliberately skipped
- **Phase 16 self-view — still blocked** on a self-scoped payroll read (`GET /api/payroll/my-earnings`,
  `protect`-only) that does not exist. `docs/i18n/` does NOT touch it.
- **Phase 6 commissions — unchanged, still blocked** (no product aggregate / no `target`).
- **`t()` widening not built** — needs the P0 interpolation extension + human copy. Only scoped.
- **Data-derived label maps not counted** — `src/data/labels.ts` / `tasks.ts` (STAGE_META, SEG_META,
  CLAIM_STATUS…) are a separate ~50–100-string surface, excluded from the inventory by design.
- **`git push` still 403s** — `docs/i18n/` committed **local only**; credential `reactjsaaziko` has no write access.
- **Device-verification backlog** — unchanged, still needs a handset.

## Next session starts here
- **First command:** `/boot`, then re-read `../contracts/INBOX.md` foot for a `cgpe-api` reply to the
  narrowed self-earnings ask before assuming Phase 16 is buildable.
- **If a self-scoped read landed:** build the Phase 16 self-view per its preserved UI lock (do NOT point
  `payroll.tsx` at it — that's the admin roster).
- **Else, the newly-unblocked editor work is the `t()` widening prerequisite** — build the `t(key, params)`
  interpolation + plural extension and the `common.*` layer (needs **no** copy), per `docs/i18n/SCOPE.md`
  §3. Then wire one Tier-1 screen and hand the owner its fill-in list. This is the one path that advances
  without waiting on the backend or a translator.
- **Watch out for:** the i18n parity test (`src/i18n/__tests__/dictionaries.test.ts`) — bump its hard
  `EN_KEYS.length === 74` when adding keys, and remember its leak check will NOT catch an English string
  left in a non-English dict, so real copy is load-bearing.
