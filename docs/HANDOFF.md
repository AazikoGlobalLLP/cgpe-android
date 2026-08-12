# HANDOFF — CGPE Connect (Android) — Phase 27 — 2026-08-12

Owner picked, of the three carried Phase-26 options, "spec the `resolveRoleKey` change so each real
business department gets its own layout." This session **specced it and filed the ask to `cgpe-api`**.
It is a **pure backend change** — the mobile app has no role-key resolver and renders any `role_key`
fail-open, so there was **nothing to build in `src/`** and no gate to re-run. Docs-only session.

## Done
- **A written, verified proposal now exists** for letting each of the 7 business departments that
  currently can't (`HEALTH INSURANCE`, `TATA AIA`, `RECRUITMENT & CALLING`, the 3 SALES
  sub-departments, `OTHERS`) get their own in-app menu/layout — and the request is on `cgpe-api`'s
  queue. When they ship it and a doc is seeded, that department's More tab / tabs / dashboard change
  on the next cold start with **no APK and no mobile code**.
- **Confirmed mobile owes zero code:** `grep resolveRoleKey ANDROID/src` = 0; `normalizeUiConfig`
  accepts any `role_key`; `arrangeMoreSections`/`resolveTabs` render whatever arrives, fail-open to
  `DEFAULT_UI`. So this is entirely a `cgpe-api` deliverable.

## Files changed
- `docs/spec/PHASE-27.md` (new) — the ask: verified source-of-truth (9 canonical departments from
  `enums.md` §2.1; `resolveRoleKey` at `routes/rbac.js:396` uses *raw* lowercase; `canonicalizeDepartment()`
  at `utils/rbac.js:130` already normalizes and is exported; `buildConfig` fail-open), a recommended
  non-regressive candidate-key chain + `DEPT_KEY` map, and the 4 mechanism-agnostic guarantees. D-1..D-5.
- `docs/DECISIONS.md` — appended the Phase-27 decision (top).
- `docs/PHASES.md` — `## Now` gained the Phase-27 entry; `## Next 3` re-led with Phase 27.
- `../contracts/INBOX.md` (**outside this repo**) — `→ cgpe-api` ask filed at top of queue,
  grep-verified durable (2 hits). The follow-up the Phase-26 seed heads-up pre-promised.
- Commit `3f67784` (3 docs files, local — push still 403s). `.claude/settings.json` left as-is
  (it was already modified before this session).

## Decisions made
- **This is a backend ask, not a mobile build (spec D-1).** The resolver lives only in `cgpe-api`;
  building a client-side department map would duplicate server logic and break the server-driven-UI
  contract. Phase-27's mobile deliverable is the spec + the contract ask; the box stays open until
  `cgpe-api` replies.
- **Recommend a non-regressive candidate-key chain** (`[deptKey, roleKey, 'advisor']`, first-with-a-doc
  wins) over an unconditional dept key — so a `HEALTH INSURANCE` leader keeps their `leader` layout
  until a `health_insurance` doc is seeded (no big-bang, no blank dashboards). Final mechanism is
  `cgpe-api`'s; mobile requires only 4 guarantees (back-compat for `sales`/`operations`, non-regression,
  lowercase keys, collision-free).
- **Derive keys via `canonicalizeDepartment`, not raw slugging** (D-4) — normalizes free-string
  department variants and, as a bonus, fixes `"Sales Team"`-type misses the current raw resolver has.

## Known broken / deliberately skipped
- **The backend change itself is not done** — it is `cgpe-api`'s to build (filed, box open).
- **Necessary-but-not-sufficient:** new keys still need **seeded docs** — the Phase-26 seed script
  (`cgpe-backend-main/scripts/seedAppRolePreferences.js`) must gain the new keys and be **owner-run**;
  else they fail open to defaults. Per-department layouts are live only when resolver + docs + a device
  check all exist.
- **⚠️ SECURITY (carried, unchanged):** `seedAppRolePreferences.js:56` still hardcodes a live Atlas
  credential as an `||` fallback (secret-in-source AND dead code) — **remove + rotate before that file
  is committed anywhere.** Not touched this session (sibling repo, intentional prior edit).
- **`MANDATORY_BY_ROLE` for new Sales-family keys** — raised in the ask, not decided (backend product
  call): a `sales_cgpe_tree` doc would not inherit the Sales mandatory widgets today.
- **Device-verification backlog** carried (Phases 1/4/5/6/7/9/10/12/13/16/23/24/25/26).
- **`git push` still 403s** — all commits local.

## Next session starts here
- **Phase 28 (or continue 27):** if `cgpe-api` has replied to the `resolveRoleKey` ask, verify their
  shipped shape against their real code and confirm the app renders a new dept key; otherwise the board
  is editor-exhausted and every remaining lever is owner-run, backend-dependent, or handset-only.
- **First command:** `/boot`
- **Watch out for:** `../contracts/INBOX.md` shifting under concurrent writes (anchor edits on
  surrounding text, grep replies back) — and the still-live hardcoded credential in the sibling seed
  script (remove + rotate before it is shared).
