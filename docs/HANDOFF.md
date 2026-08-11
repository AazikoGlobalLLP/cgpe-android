# HANDOFF — CGPE Connect (Android) — Phase 12 (spec written, NOT built) — 2026-08-11

This was a **verification + spec** session. No `src/` code changed, no tests changed, nothing was
committed until this handoff. Branch `Shivam`; `git push` still 403s (unchanged, needs a human —
credential `reactjsaaziko` has no write access to `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`).
Gates were not re-run because no code moved — last known green from Phase 15: `tsc` exit 0,
`npm test` 271/10 files, `npm run lint` 0 errors / 12 warnings.

## Done

- **Confirmed which blocked phase is actually buildable, and why.** The handoff-flagged "re-check
  whether cgpe-api shipped a Phase 6 / Phase 12 dependency" is done, using the Phase-4 method (read
  the contract row → the producer's handler → our own code):
  - **Phase 12 is fully app-side — its `[api]` tag is WRONG.** The only break is that
    `getAgentLocations()` enumerates the roster through admin-only `GET /api/profiles` (403s for a
    leader → empty on-duty). The correct source, `GET /api/team/task-overview`, is readable by any
    staff, server-scoped per role, already trusted by `getTeam()`, and carries the two fields the
    pipeline needs (`user_id`, `name`). The attendance fan-out it feeds (`/attendance/user/:id`) has
    **no role check at all** (`api.md:544`), so it already works for a leader. No cgpe-api change.
  - **Phase 6 is mostly app-side too, but the money third is genuinely backend-blocked.** Notes
    search sends `search=` where the server reads `q=` (`api.md:880`); LIC plans expects `data` to be
    an array but the server sends `{ meta, plans }` (`api.md:1192`) — both pure client conformance
    bugs against stable documented shapes. **Commissions** wants a personal aggregate but
    `GET /api/commissions` returns owner-scoped raw rows (`api.md:1163`), and `target` has no source
    in them — that needs a server aggregate endpoint the **product owner confirmed is still pending**.
- **Wrote `docs/spec/PHASE-12.md`** — the full, approvable spec (goal, verified-today section with
  citations, five locked decisions, one-file diff plan, acceptance criteria, out-of-scope). It was
  presented for approval; the user ran `/handoff` before saying "build", so **the build has not
  started.**

## Files changed

- `docs/spec/PHASE-12.md` — **new.** The Phase 12 spec. This is the only new content besides the
  handoff docs below.
- `docs/HANDOFF.md`, `docs/DECISIONS.md`, `docs/PHASES.md` — this handoff (board row 12, `## Now`,
  `## Next 3`, two DECISIONS entries).
- **No `src/` file was touched. No test file was added yet.**

## Decisions made

- **Build Phase 12 next, not Phase 6.** Phase 12 is cleanly unblocked and needs no backend; Phase 6's
  commissions third is backend-pending (user's call: skip/swap the `[api]` parts of Phase 6 for now).
- **Phase 12 fix is a ~4-line swap in one function** (`getAgentLocations`): roster source
  `/profiles?limit=60` → `/team/task-overview?scope=all`, validator `isArr` → `members`-array, read
  `d.members`, report under the `/attendance` health key. `getTeam`, `team/index.tsx`,
  `agent-map.tsx` need **no change** — the fix is upstream of all of them. Full rationale:
  `docs/spec/PHASE-12.md` D-1…D-5, and DECISIONS 2026-08-11 (Phase 12).

## Known broken / deliberately skipped

- **Phase 12 is specced but NOT built** — no `getAgentLocations` edit, no test, gates not re-run.
  Stopped at the approval gate.
- **One open item to verify BEFORE finalising the Phase 12 diff (spec D-2):** confirm in
  `../cgpe-backend-main/routes/team.js` + `utils/scope`'s `visibilityScope` that a **leader** passing
  `?scope=all` on `/team/task-overview` is **clamped to their team, not widened org-wide**. If it is
  NOT clamped, drop `?scope=all` and use the bare endpoint (a leader is still team-scoped by default).
  This is the single thing that could change the diff.
- **Phase 6 commissions/LIC/notes not started** — notes + LIC are buildable app-side but were not
  bundled; commissions needs the pending server aggregate endpoint. Also unresolved: `api.ts:1966`
  asserts `/api/lic-plans` **404s in production** while `api.md:1192` documents it live — a
  contract-vs-deployment disagreement to settle (read the backend route / hit the live host) before
  the LIC fix is worth shipping.
- **`git push` still 403** — commit is local only; a human must grant write access or swap the
  Windows-credential-manager credential.
- **All handset-only criteria from Phases 1/4/5/7/10/13 remain unverified** — no device work here.

## Next session starts here

- **Phase 12:** build the `getAgentLocations` roster-source swap per `docs/spec/PHASE-12.md`, add
  `src/data/__tests__/api-agents.test.ts` pinning the leader path, run the gates.
- **First command:** read the backend clamp first — open
  `../cgpe-backend-main/routes/team.js` and `../cgpe-backend-main/utils/scope*` and grep
  `visibilityScope` to settle spec D-2 (`?scope=all` clamp for a leader). THEN edit `api.ts:1855-1863`.
- **Watch out for:** the `?scope=all` clamp (D-2) is the one assumption that can be wrong — verify it
  against the producer's code, don't trust the contract prose alone. And re-read `../contracts/INBOX.md`
  fresh at boot; it is written concurrently.
