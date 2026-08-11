# HANDOFF — CGPE Connect (Android) — Phase 12 (BUILT) — 2026-08-11

Phase 12 is built, gated green, and committed locally on branch `Shivam`. `git push` still 403s
(unchanged — credential `reactjsaaziko` has no write access to `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`;
needs a human). Both commits are local only.

Gates, all green after the change: `npx tsc --noEmit` exit 0; `npm test` **281 tests / 11 files**
(was 271/10 — +10 in the new `api-agents.test.ts`, no regressions); `npm run lint` **0 errors /
12 warnings** (the Phase-15 baseline, no new warnings).

## Done

- **A leader's "On duty now" count is real at the wire, not hardcoded 0.** `getAgentLocations()` used
  to enumerate the roster through admin-only `GET /api/profiles`, which 403s for anyone outside
  `{admin, super_admin, payroll_staff}`. A leader (and any advisor) therefore got an empty roster →
  no `/attendance` fan-out → no pins → "0 on duty" on every dashboard and an empty agent map, even with
  the whole team clocked in. It now reads the roster from `GET /api/team/task-overview?scope=all` — the
  same source `getTeam()` already trusts, readable by any staff, whose `/attendance/user/:id` fan-out
  already has no role check. `getTeam` / `team/index.tsx` / `agent-map.tsx` needed **no change** — the
  fix is upstream of them (spec D-4), so the leader's `clockedIn`, the Team screen's "On duty now" KPI,
  and the agent map all become correct automatically.
- **Confirmed the `[api]` tag was wrong — no `cgpe-api` change was needed (D-1).** All three endpoints
  the leader path uses already exist and are correctly gated for a leader.
- **Verified the `?scope=all` leader-clamp in the producer's own code before finalising the diff
  (D-2).** `../cgpe-backend-main/utils/scope.js` `visibilityScope`: the `view==='all'` → `mode:'all'`
  return is gated inside `if (canViewAll)`, `canViewAll = isSuperAdmin || role==='admin'`. A leader is
  neither, so `?scope=all` is ignored and clamped to `{mode:'team', userIds:[self,...team]}`. The param
  is *needed* to keep admin/master org-wide (the bare endpoint defaults them to `mode:'own'`, showing
  only themselves on the map) — the opposite of what "drop the param" would do.
- **Filed an INBOX notice** to `cgpe-api`/`cgpe-admin` ("shipped app-side, no API change, the `[api]`
  tag was wrong; if the scope gating changes so a leader's `?scope=all` widens org-wide, tell us"),
  grepped back and confirmed it survived a concurrent write.

## Files changed

- `src/data/api.ts` — `getAgentLocations()` only: roster source `GET /profiles?limit=60` →
  `GET /team/task-overview?scope=all`, validator `isArr` → `(d) => d && Array.isArray(d.members)`,
  roster read from `d.members`, outage reported under the existing `/attendance` health key (not a
  competing `/team/task-overview` row `getTaskOverview` owns, D-3). ~4 functional lines + a doc comment.
- `src/data/__tests__/api-agents.test.ts` — **new.** 10 cases pinning the wire contract: roster request
  is `/team/task-overview` (never `/profiles`), `?scope=all` is present, envelope unwrap, the leader
  path yields an `onDuty:true` pin, clocked-out → `onDuty:false`, no-coords/no-`user_id` → no pin, and a
  task-overview outage lands on the `/attendance` health key.
- `docs/PHASES.md` — board row 12 → **Done** (`4507d6e`), `[api]` struck through; `## Now`, the Phase 12
  detail section (three result notes), and `## Next 3` (Phase 12 drops off) updated.
- `docs/DECISIONS.md`, `docs/HANDOFF.md`, `docs/STATUS.md` — this handoff.
- `../contracts/INBOX.md` — the shipped-app-side notice (that dir is untracked, so not committed).

## Decisions made

- **`?scope=all` stays on the request** rather than the bare endpoint, because it is what preserves
  admin/master org-wide breadth while the server clamps a leader — verified in `visibilityScope`, not
  assumed from contract prose. A test pins the param so a later edit can't silently drop it. See
  DECISIONS 2026-08-11 (Phase 12 — built) below and spec D-2.
- **`team/index.tsx` and `agent-map.tsx` left untouched** (D-4) — the fix is upstream; editing them
  would be scope the DONE-WHEN doesn't ask for. `getTeam`'s double `task-overview` fetch (once for
  members, once inside `getAgentLocations` for pins) is accepted as-is; collapsing it is a valid
  optimisation left out to keep the diff to one function.
- **`getTrackableMembers` left on `/profiles`** (D-5) — the master track-viewer's picker is a
  master/super-admin surface by nature; its admin gate is correct, not a bug.

## Known broken / deliberately skipped

- **Phase 12's DONE-WHEN proper needs a handset** — a real leader account on a live backend with at
  least one team member clocked in, showing the true "On duty now" count instead of 0/N (spec
  criterion 6). `npm test` covers the wire contract only. Carried, like Phases 1/4/5/7/10/13.
- **`git push` still 403s** — both commits (`4507d6e`, `c8a4a79`) are local only. A human must grant
  write access or swap the Windows-credential-manager credential. Did not retry (documented as
  unfixable by retrying), did not touch the remote.
- **Phase 6 (partial) not started** — notes (`search`→`q`) and LIC (`{meta,plans}` unwrap) are
  buildable app-side; commissions needs a pending server aggregate endpoint. LIC also needs the
  `api.ts:1966`-vs-`api.md:1192` 404-in-production-vs-live disagreement settled first.
- **The 20-person fan-out cap** (`getAgentLocations` slices to 20) predates this phase and is unchanged
  — a non-issue for a leader's team (<20), left as-is (spec §5).

## Next session starts here

- **Phase 6 (partial):** build the two app-side envelope fixes — notes search `search`→`q`, and LIC
  plans `{meta, plans}` unwrap + field adapter. Skip commissions (backend-blocked). Settle the LIC
  404-vs-live disagreement first (read the live host / backend route).
- **First command:** `/boot`
- **Watch out for:** the LIC fix is worthless until you resolve whether `/api/lic-plans` actually 404s
  in production (`api.ts:1966` asserts it does; `api.md:1192` documents it live) — verify against the
  backend route or the live host before writing the unwrap, or you'll ship a fix for a dead endpoint.
