# HANDOFF — CGPE Connect (Android) — Phase 65 built & pushed — 2026-08-20

Owner chose to build **Phase 65** (full-staff monitor roster) rather than wait on Phase 72's backend.
Phase 65 is fully built, tested, and pushed. **Phase 72 stays PENDING** — the owner's "backend done"
signal was verified PREMATURE (backend code is written but uncommitted, 404 on prod, no Firebase).

## Done
- **Every team member now appears on the master's Monitor roster and Agent map — even one who has
  never been assigned a task.** Before, the roster's universe was `/team/task-overview` (grouped by
  `team_tasks` assignee), so a member with zero tasks silently vanished ("only appears after they open
  the app"). Now, for a master, the universe is the super_admin-gated `/live-locations` (walks EVERY
  profile), left-joined with the task stats. A never-active member shows as **off-duty with zeroed
  stats** instead of disappearing; when they clock in, their pin appears on the map even with no task.
- Non-masters are untouched (they 403 on `/live-locations` → fall back to the exact old path, quietly).
- Gates green: `tsc` 0 · `npm test` **690** (+21: roster 9, api-live-locations 11, api-agents +1) ·
  eslint 0 new. Committed `0c4fde1` and pushed to `aaziko/Shivam`.

## Files changed
- `src/data/roster.ts` — NEW, pure + tested: `mergeRoster(live, overview)` (left-join by NAME) and
  `liveOnDutyPins(live)` (clocked-in → map pins), plus `LiveLocation`/`OverviewMember` types.
- `src/data/api.ts` — NEW `getLiveLocations()` + pure `mapLiveLocation()` (quiet-on-403/404 like
  `getBreakLocations`); master paths added to `getTeam()` and `getAgentLocations()`.
- `src/data/__tests__/roster.test.ts` — NEW (+9). `api-live-locations.test.ts` — NEW (+11).
  `api-agents.test.ts` — updated for the new live-first ordering + 1 master-path case.
- `docs/spec/PHASE-65.md` — NEW spec (decision, join-key rationale, honest limits).
- **No screen file changed** — `monitor.tsx` and `agent-map.tsx` consume these functions unchanged.

## Decisions made
- **Universe from `/live-locations`, join by NORMALIZED NAME not id.** The two endpoints key on
  different id spaces (`/live-locations` → `profile._id` 24-hex; `/team/task-overview` → `user_id`
  field `user_...`), so an id-join enriches nobody. Verified `/profiles/:id` accepts BOTH id types
  (`routes/profiles.js:100-103`), so a roster row carrying the `_id` still navigates correctly.
- **`[api]` prereq verified DEPLOYED before building** (deploy-gap discipline): live probe of
  `/live-locations` → 401 (present, gated), and the Phase-69 ObjectId fix is in the deployed code.
- **Show every staff member (greyed off-duty), not only ever-located ones** — the owner's complaint
  mandates it. Vetoable.

## Known broken / deliberately skipped
- **Map now shows "who's out RIGHT NOW."** A member who clocked OUT earlier today is no longer drawn
  as a grey pin while someone else is on duty (`/live-locations` gives no coord for an off-duty
  member) — they still appear in the roster. More honest, but a deliberate behavior change.
- **`/live-locations` returns ALL profiles** (`.find({})`, no `is_active`), and its payload carries
  no `is_active`, so a deactivated ex-employee could appear in the master roster. Over-inclusion is
  the safe direction; if stale accounts show up on-device, the fix is an `[api]` (add `is_active` /
  filter server-side). NOT filed yet — a candidate, not a blocker.
- **Device-unverified** — JS-only, rides the batch APK (no new native module).
- **Phase 72 (team push) still PENDING** — see below; do NOT cut the APK or mark it done.

## Next session starts here
- **Phase 72 executes on a *verified* "backend live" signal** (not just a claim). The owner said
  "backend ne kaam kar diya" this session; I verified it is NOT live — the push code in
  `../cgpe-backend-main` is **uncommitted** (`?? routes/push.js`, `models/PushToken.js`,
  `services/push.js`; ` M notify.js/tasks.js`), NOT on `origin/main` (tip `2531817` = Phase 69), and
  prod `/push/register` returns **404** (health 200). cgpe-api's own INBOX note confirms "NOT yet
  committed/deployed." Firebase/FCM also still unset. So Phase 72 needs: (1) backend dev commits →
  merges `origin/main` → deploys → restarts `:3001`; (2) owner sets up Firebase for `com.cgpe.connect`
  + FCM V1 key → EAS; (3) then re-verify (probe must be **401** not 404, a test token registers, a
  test push arrives) and cut the ONE combined APK (65+70+71+72+73). Verify method:
  `git -C ../cgpe-backend-main fetch` + `git status` on the push files + no-auth `curl .../push/register`.
- If no verified signal yet: there is no un-built mobile piece left in the 63–73 batches. Candidates
  are the Phase-65 `is_active` `[api]` note (only if a device test shows ex-employees), or the
  2026-08-18 batch (Phase 55 network resilience, Phase 56 iOS — needs an Apple account).
- First command: `/boot`
- Watch out for: **do NOT trust "backend done" — probe prod (401=live, 404=not) and check `git status`
  in `../cgpe-backend-main` before cutting an APK or marking Phase 72 done.** A push-less APK looks
  done but buzzes nothing.
