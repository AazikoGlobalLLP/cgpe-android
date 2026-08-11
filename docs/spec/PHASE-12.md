# PHASE 12 — `/profiles` role gate: a leader's on-duty count

Session `cgpe-mobile`. Written 2026-08-11, before a line changed, from a full read of
`src/data/api.ts` (`getAgentLocations`, `getTeam`, `getTaskOverview`, `toPin`), `src/app/team/index.tsx`,
`src/app/agent-map.tsx`, and `contracts/api.md` §`/api/profiles`, §`/api/attendance`, §`/api/team`.

---

## The one-sentence goal

`getAgentLocations()` stops enumerating the roster through the admin-only `GET /api/profiles`
(which 403s for a leader, so the on-duty cross-reference comes back empty and every dashboard says
"0 on duty") and reads it from `GET /api/team/task-overview` instead — the endpoint `getTeam()`
already trusts for the roster, and one any staff member can read, scoped by the server to what their
role is allowed to see.

## DONE WHEN (from `docs/PHASES.md`'s Phase 12 section)

1. A leader account sees the correct on-duty count.

---

## 1. What is actually true today — verified, with citations

**The break is a single wrong door, not a missing endpoint.** `getAgentLocations()`
(`src/data/api.ts:1855`) does three things in sequence:

1. `tryReal<any[]>('/profiles?limit=60', {}, isArr)` (`:1862`) to get the roster's `user_id`s.
2. `.filter((p) => p.user_id).slice(0, 20)` (`:1863`) to cap the fan-out.
3. For each person, `GET /attendance/user/:userId` (`:1869`, `:1882`), keep whoever has clock-in
   coordinates, build an `AgentPin` via `toPin` (`:1841`).

Step 1 is the whole bug. `GET /api/profiles` requires `role ∈ {admin, super_admin, payroll_staff}`,
else **403** (`contracts/api.md:211`). A **leader** is not in that set, so a leader (and any advisor)
gets an empty array → no people → no `/attendance` calls → no pins → `onDuty` is false for everyone.

**Steps 2–3 already work for a leader.** `GET /api/attendance/user/:userId` has **"no
ownership/role check at all; any authenticated user can read any other user's raw attendance"**
(`contracts/api.md:544`). So once the roster is populated, the attendance fan-out needs no new
access.

**The right source is the one `getTeam` already uses.** `getTeam()` (`:1392`) builds its roster from
`getTaskOverview()` → `GET /api/team/task-overview` (`:340`), which is **"any staff; scoped by
`visibilityScope` … leader sees their team; admin/super_admin widen with `?scope=all`"**
(`contracts/api.md:715`). Each member object it returns carries exactly the two fields the
`getAgentLocations` pipeline consumes downstream — `user_id` and `name`
(`contracts/api.md:715`, the `members:[{ name, user_id, role, department, phone, … }]` shape). This
endpoint is proven live in production: the Team screen's roster loads today, and it loads from here.

**No GPS is at stake in the swap.** The roster source has never carried coordinates — `/profiles`
didn't either. GPS comes only from the `/attendance/user/:id` rows, read in `toPin(row, p)` off
`row.clock_in`/`row.clock_out` (`:1842-1851`); from the roster person `p`, `toPin` reads only
`p.user_id` and (as a name fallback) `p.full_name || p.name` (`:1846-1847`). `task-overview` members
supply `user_id` and `name`, so `toPin` is satisfied unchanged.

**The fix propagates to both consumers with no screen edit.**

- `getTeam()` (`:1397-1400`) already cross-references `getAgentLocations()` pins to set each member's
  `clockedIn`. Fix the pin source and the leader's `clockedIn` becomes real automatically. →
  `team/index.tsx`'s `onDuty` / "On duty now" KPI (`team/index.tsx:67,73,105`) is then correct with
  no change to that file.
- `agent-map.tsx` calls `getAgentLocations()` directly (`agent-map.tsx:92`) and renders
  `pins.length > 0 ? pins.map(fromPin) : team.map(fromMember)` (`:107`). A leader now gets a
  non-empty `pins` array → the map and its "on duty" headline populate, again with no change to that
  file.

So the phase's predicted three-file list (`api.ts`, `team/index.tsx`, `agent-map.tsx`) collapses to
**one source file plus a new test** — same "predicted list shrank because the fix is upstream of the
screens" shape as Phase 11 and Phase 5.

## 2. Locked decisions

**D-1. No `cgpe-api` change — the `[api]` tag on the status board is wrong.** All three endpoints the
leader path needs already exist and are correctly gated for a leader: `/team/task-overview`
(any staff, server-scoped), `/attendance/user/:id` (any staff, no gate). Only `/profiles`
(admin-only) was the wrong choice on the client. This phase is pure app-side, and the `[api]` marker
in `docs/PHASES.md` row 12 should be removed when it ships. (Backend un-shadowing of
`/commissions/team-summary` etc. is unrelated — that was Phase 6.)

**D-2. `getAgentLocations` reads `GET /api/team/task-overview?scope=all`, and extracts `.members`.**
Two parts:
- **The endpoint** replaces `/profiles?limit=60`. Validator changes from `isArr` to
  `(d) => d && Array.isArray(d.members)` (the exact validator `getTaskOverview` already uses at
  `:341`), and the roster becomes `d.members` instead of the bare array. Everything after — the
  `.filter(p => p.user_id).slice(0,20)` and the `/attendance` fan-out — is unchanged.
- **`?scope=all`** preserves the org-wide breadth the old admin-only `/profiles` gave admin/master,
  while the server clamps a leader/advisor's `scope=all` down to their permitted set — the
  server-authoritative scoping this API uses everywhere (`applyOwnerScope` rewrites an out-of-scope
  owner to a match-nothing sentinel; INBOX `2026-08-10 from cgpe-api`, the Phase-7 isolation notice).
  **Build step, not an assumption:** confirm in `../cgpe-backend-main/routes/team.js` +
  `utils/scope`'s `visibilityScope` that a `leader` passing `scope=all` is clamped to their team and
  **not** widened org-wide. If that turns out false, drop `?scope=all` and use the bare
  `/team/task-overview` (a leader is still correctly scoped to their team by default; the only cost
  is that admin/master's agent-map roster then follows their own task-overview scope — a pre-existing
  breadth question, not this phase's DONE-WHEN). This is the one thing to verify against the
  producer's code before the diff is final, in the manner of Phase 4.

**D-3. Failure reports under the `/attendance` health key, matching the existing demo-path key.** The
call passes an explicit key of `'/attendance'` to `tryReal`, so a `task-overview` outage surfaces as
the same "field status could not load" row the demo path already raises via
`unavailable('/attendance', …)` (`:1861`) and the agent-map's degraded copy expects — rather than a
second `/team/task-overview` row competing with the one `getTaskOverview` owns. Presentation only; it
does not affect the count.

**D-4. `getTeam`, `team/index.tsx`, `agent-map.tsx` are not edited.** The fix is entirely upstream of
them (see §1). Touching them would be scope the DONE-WHEN does not ask for. `getTeam` continues to
call `getAgentLocations()` and cross-reference by id-or-name (`:1398-1400`); the redundant second
`/team/task-overview` fetch this creates within one `getTeam` call (once for members, once inside
`getAgentLocations` for pins) is accepted as-is — it is the same round-trip count `getTeam` already
had (`getTaskOverview` then `getAgentLocations`), just pointed at a reachable endpoint. Collapsing it
into a single fetch is a valid optimisation, deliberately left out to keep the diff to one function.

**D-5. `getTrackableMembers` is left on `/profiles`.** The master track-viewer's member picker
(`:1440`) legitimately uses `/profiles?limit=100` and is a master/super-admin surface by nature
(`agent-track.tsx` is master-only) — a leader is not its audience, so its admin gate is correct, not
a bug. This phase touches only `getAgentLocations`.

## 3. Files

| File | Change |
|---|---|
| `src/data/api.ts` | `getAgentLocations()` only: swap the roster source `GET /profiles?limit=60` → `GET /team/task-overview?scope=all`, validator `isArr` → `members` array, read `d.members`, report under the `/attendance` health key. ~4 lines. Doc comment updated to name the endpoint and why. |
| `src/data/__tests__/api-agents.test.ts` (new) | Pin the new wire contract: the roster request is `/team/task-overview` (never `/profiles`); a members list + attendance rows builds the expected pins; a still-clocked-in member is `onDuty:true`, a clocked-out one `onDuty:false`; a member with no clock-in coords yields no pin. |

`src/app/team/index.tsx` and `src/app/agent-map.tsx` were in the phase's predicted file list and need
no change — see D-4.

## 4. Acceptance criteria

1. `npx tsc --noEmit` exits 0.
2. `npm test` green, with the new `api-agents.test.ts` added (271 → 271 + N); no existing test
   regresses. A test that imports `@/data/api` uses the `vi.resetModules()` + `await import` +
   `setAuthToken('test-token')` pattern (per CLAUDE.md and `api-track.test.ts`).
3. `npm run lint` stays at the baseline **0 errors / 12 warnings**.
4. In `getAgentLocations`, `grep` confirms the roster fetch is `/team/task-overview` and there is no
   `/profiles` reference left **in that function** (other functions may still use `/profiles`
   legitimately — D-5).
5. Test proof of the leader path: given a `task-overview` response whose `members` carry `user_id`
   and an `/attendance/user/:id` reply with `clock_in.{lat,lng}` and no `clock_out.time`,
   `getAgentLocations()` returns one pin with `onDuty:true`; the first `fetch` call's URL contains
   `/team/task-overview` and none contains `/profiles`.
6. **Handset + live backend (carried, not done in the editor):** a real **leader** account opens the
   Team screen against production with at least one team member clocked in, and the "On duty now"
   KPI shows the true count instead of `0/N`. This is the DONE-WHEN proper; like Phases 1/4/5/7/10/13
   it needs a device, a live backend, a leader token, and someone actually clocked in — none
   reachable from `npm test`, which covers the wire contract only.

## 5. Deliberately out of scope

- **The Phase-6 commissions/LIC/notes work.** Verified this session to be app-side too, but the
  commissions third depends on a server aggregate endpoint that is **still pending on `cgpe-api`**
  (confirmed with the product owner 2026-08-11) — so Phase 6 is not bundled here.
- **`getTaskOverview`'s own default scope for admin/master** (whether the admin roster should be
  org-wide by default). Pre-existing behaviour, unrelated to the leader on-duty fix, and changing it
  would move the Team screen's roster breadth — a separate decision.
- **The 20-person fan-out cap and its "most-at-risk-first" ordering.** `getAgentLocations` slices to
  20 and `task-overview` sorts members by overdue tasks, not by likelihood of being on duty, so a
  very large org could miss an on-duty person past position 20. This cap predates the phase (the
  `/profiles` path sliced 20 too) and is a non-issue for a leader's team (typically < 20). Left as-is.
- **Collapsing `getTeam`'s double `task-overview` fetch** into one shared roster (D-4).
- **A test harness for `team/index.tsx` / `agent-map.tsx`.** Those screens stay untouched and have no
  coverage today; this phase pins the data-layer wire contract only, the one thing a Node test can
  actually exercise.
