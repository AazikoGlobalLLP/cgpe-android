# HANDOFF — CGPE Connect (Android) — Band 2 #3: task-flow mitigations — 2026-08-24

## Done
- **Team-tier advisors are no longer invited to create tasks they can't.** The backend 403s a
  team-tier advisor on *every* task create (verified in `team.js:384` — create is allow-listed to
  admin/leader/super_admin). The app now hides every "Add task" affordance from them — the Tasks-tab
  FAB and empty-state buttons, Home's quick-action and empty-states, and the Admin/Master dashboard
  tiles — and the create form refuses at the entry (for a deep-link) instead of only at submit. All of
  them share ONE predicate (`capabilitiesOf().assignTasks && can('can_create_task')`), so they can't
  drift. Entitled tiers are unaffected.
- **You can now edit a task after creating it.** A pencil in the task-detail header opens a new
  Edit-task screen (title / details / client / priority / due). Due defaults to "Keep" so fixing a
  typo never moves the due date. The pencil is hidden on a *done* task (editing it would have
  re-credited it to today's completed count).
- **The always-empty "Workflow" checklist card is gone.** Real team tasks carry no steps, so the card
  only ever showed a "No checklist" message that read as broken. It's now hidden when a task has no
  steps (kept for the legacy path that can have them).
- **The assign / transfer people-picker is fixed.** It now pulls the real staff directory (so an admin
  sees colleagues who have no task yet, not just people already in the task list), and each picker has
  a search box + name sort + a "showing N of M" hint so nobody past the render cap is silently hidden.
  Transfer is limited to entitled tiers (a team advisor has no one to hand a task to).
- Gates green: `tsc` 0 · `npm test` **877** (+14: `api-task-edit`, `team`) · `eslint` 0 new. Two
  adversarial review workflows run (15-agent full + 3-agent fix-delta); the full pass found 8 real
  issues, all fixed; the delta pass came back clean. Commit `af7e492`, pushed `aaziko/Shivam`.
  OTA-eligible; **device-unverified**.

## Files changed
- `src/data/api.ts` — **NEW** `updateTask(id, patch)` (PATCH `/team/tasks/:id`, partial body; `dueAt`
  sent only when the due date changes; three-outcome `{ok, reason?}`, no 403 gate — edit is open on the
  backend). **NEW** `getAssignableTeam()` — prefers the `/profiles` directory (admin/super get every
  colleague), falls back to the scoped `getTeam()` (leader gets their team; team-tier gets self/empty
  and never reaches a picker), sorted by name.
- `src/data/team.ts` — **NEW** pure `filterMembers(list, q)` (multi-token AND over name/branch/role;
  blank query = same reference). Shared by both pickers.
- `src/app/(tabs)/tasks.tsx` — `canCreateTask` gate on the FAB + all empty-state Add actions;
  book-empty copy differs for non-creators. Search branch (Band 2 #2) untouched.
- `src/app/(tabs)/home.tsx` — the create gate at `:688` now ANDs `caps.assignTasks` (was flag-only,
  which fails open); passes `canCreateTask` to the two dashboards.
- `src/screens/dashboards.tsx` — Admin/Master "Assign task" QuickRow gated on a new `canCreateTask`
  prop (fail-open default).
- `src/app/task/[id].tsx` — Workflow section hidden when `steps.length===0`; Edit pencil in the Header
  (hidden when done); transfer gated on `assignTasks`, uses `getAssignableTeam()`, and the transfer
  sheet gained search + cap + hint.
- `src/app/task-new.tsx` — entry guard for non-creators; roster from `getAssignableTeam()`; assignee
  sheet gained search + cap + hint.
- `src/app/task-edit.tsx` — **NEW** Edit screen.
- `src/data/__tests__/api-task-edit.test.ts` (**NEW**, 8) · `src/data/__tests__/team.test.ts`
  (**NEW**, 6) · `docs/spec/BAND2-3-task-flow.md` (**NEW** spec, kept in sync with the review fixes).

## Decisions made
- **Gate on `capabilitiesOf().assignTasks`, not the RBAC flag alone.** The RBAC `can_create_task` flag
  fails OPEN when unseeded (Point 6), so it can't hide create from the team-tier users we're protecting.
  `assignTasks` is the reliable role-derived mirror of the backend's allow-list (leader folds into the
  admin tier and IS allowed, so the tier is correct here — unlike payroll). The flag is ANDed on so a
  future seeded restriction still bites.
- **Edit is NOT gated; transfer IS.** The backend PATCH has no ownership gate (any staff may edit any
  team task), so a member may edit their own task — but transfer is assign-to-others, which the RBAC
  config forbids team-tier and which they have no roster for. This mirrors the backend exactly.
- **The pickers got real search, not just a bigger cap.** Enlarging the roster to the full directory
  made the pre-existing 24/40 caps bite; a name search + sort + overflow hint is the app's convention
  and removes the "can't reach that colleague" block. `filterMembers` is pure + tested.

## Known broken / deliberately skipped (owner-owned)
- **Create policy** — whether a team advisor should be able to create their *own* tasks is an owner
  `[decision]` + backend `[api]` relay (the backend 403s them today; the RBAC config's
  `can_create_task:true` default suggests the intent is "yes, self-only", which contradicts the
  backend). The app only moves the refusal to the entry; it does NOT enable what the backend forbids.
- **Edit ownership** — the backend lets any staff edit/reassign any team task (no scope). Flagged, not
  fixed — `[api]`/`[decision]`.
- **Real task checklists** — no backend step endpoint exists (`[api]`). The card is hidden, not filled.
- **Known nit (not fixed):** for a *leader with zero team-tasks*, `getAssignableTeam()` requests
  `/profiles` twice (its own attempt 403s, then `getTeam()`'s fallback retries it) — correct result,
  quiet, rare. Not worth the refactor.
- INBOX untouched (additive client behaviour, no contract change).

## Next session starts here
- Phase: **Band 2 #4 — Calendar grid + create gating** (owner backlog Point 4, P2/one-P1-bit, OTA).
  The Tasks tab already has 4 time views + a horizontal month day-strip (D4); Point 4 wants a real
  **7-column month grid with ‹prev/next› + month header**, the per-day **count** shown (not a binary
  dot), all-completed days marked, and the create-gating already done here reused. Then Point 10
  (Client Search in More — scope the existing search to clients-only). Authoritative worklist:
  `docs/OWNER-BACKLOG-2026-08-24.md`.
- First command: `/boot`
- Watch out for: the calendar work overlaps `(tabs)/tasks.tsx` (which now has the search branch AND the
  create-gating) — don't perturb either. Pure date-grid maths should go in `data/tasks.ts` (tested)
  like `weekRange`/`monthRange`/`tasksInRange` already are.
