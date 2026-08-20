# Phase 65 — every team member appears in the monitor roster / agent map (not only after they "open the app")

**Owner complaint.** On the master's Monitor and Agent-map, a staff member only shows up **after
they have been assigned a team-task** ("opened the app" was the owner's proxy for that). People with
no assigned `team_tasks` row silently vanish from the roster.

**Verified root cause.** Both `getTeam()` (the roster) and `getAgentLocations()` (the map pins) drew
their *universe of people* from `GET /team/task-overview`, whose `members[]` are grouped by
`team_tasks` **assignee** (`../cgpe-backend-main/routes/team.js:128-134`). A member with zero team-tasks
never enters that list → never in the roster, never a pin.

## The fix — `[m]` only (the `[api]` half was already live)

Source the master's universe from `GET /api/time-tracker/live-locations`, which iterates **every**
profile (`routes/timeTracker.js:1014` `STAFF_COLLECTION.find({})`), left-joined with the task-overview
stats. A never-active member now appears **off-duty with zeroed stats** instead of vanishing.

**`[api]` prerequisite — VERIFIED DEPLOYED before building** (deploy-gap discipline). `/live-locations`
is on deployed `origin/main` (backend Phase 69, tip `2531817`), `super_admin`-gated
(`timeTracker.js:1008`, live probe → **401** with no auth, not 404, not a 200 leak), and the Phase-69
`String(s._id) === String(activeSessionId)` ObjectId fix is present (`:1030`). No mobile `[api]` filing
needed — pure consumer.

### Files
- `src/data/roster.ts` (NEW, pure + tested) — `mergeRoster(live, overview)` left-joins the two sources;
  `liveOnDutyPins(live)` turns clocked-in members into map pins. `LiveLocation` / `OverviewMember` types.
- `src/data/api.ts` — NEW `getLiveLocations()` (+ pure `mapLiveLocation`), quiet-on-403/404 like
  `getBreakLocations`; `getTeam()` and `getAgentLocations()` take the master path when live answers.
- `src/data/__tests__/roster.test.ts` (NEW, +9), `api-live-locations.test.ts` (NEW, +11),
  `api-agents.test.ts` (updated for the new live-first ordering, +1 master-path case).
- **No screen change** — `monitor.tsx` and `agent-map.tsx` consume these functions unchanged.

### Key design facts (verified in the producers' real code)
1. **Join key is the NORMALIZED NAME, not an id.** `/live-locations` keys people by `profile._id`
   (24-hex ObjectId, `timeTracker.js:1038`); `/team/task-overview` keys by the `user_id` **field**
   (`user_...`, `team.js:142/178`). The id spaces never match, so an id-join would enrich nobody. Name
   is the only shared key — the same reason `getTeam`'s pre-existing on-duty cross-ref already matched
   names. A missed enrichment leaves a member present-but-zeroed (honest), never vanished.
2. **`/profiles/:id` accepts both** an ObjectId (`findById`) and a `user_id` (`findByUserId`)
   (`routes/profiles.js:100-103`), so a roster row carrying the live `_id` still navigates to
   `/team/[id]` correctly.
3. **Duty comes straight from the live row** (`isClockedIn` = `!!activeSessionId` server-side), so no
   attendance-pin cross-reference is needed for the master roster.
4. **Non-masters are untouched.** `/live-locations` 403s for them → `[]` → the exact existing
   task-overview roster/map path runs, and the 403 is suppressed (no banner).

### Owner decision taken (spec open Q)
Show **every** active staff member, greyed as off-duty when they have no location — not only members
who have *ever* shared a location. The complaint ("appear, not only after they open the app") mandates
option 1. Vetoable.

### Known limitations / honest ceilings
- **The map's on-duty view is now "who is out RIGHT NOW".** For a master, on-duty pins come straight
  from `/live-locations`. A member who clocked **out earlier today** is no longer drawn as a grey pin
  when someone else is on duty (live-locations gives no coordinate for an off-duty member). They still
  appear in the roster. This is arguably *more* honest (no stale point shown as current), but it is a
  deliberate behavior change from the old task-overview+attendance pass.
- **`/live-locations` returns ALL profiles** (`.find({})`, no `is_active` filter) and its payload
  carries no `is_active`, so a deactivated/ex-employee row would appear in the master roster. Over-
  inclusion is the safe direction (the complaint was the opposite), but if stale accounts show up the
  refinement is an **`[api]`**: add `is_active` to the `/live-locations` payload (or filter server-side).
  Filed as a follow-up, not a blocker.
- **Device-unverified** — JS-only, rides the batch APK (no new native module). Verify on a handset: a
  staff member with zero team-tasks now shows in `/monitor` and `/agent-map`.

### Gates
`tsc` 0 · `npm test` **690** (+21) · eslint 0 errors (2 pre-existing `api.ts` warnings).
