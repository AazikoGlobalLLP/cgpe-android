# Band 2 #3 — Task-flow mitigations (owner backlog Point 5, P1, OTA)

**Verified 2026-08-24** against the real app, the deployed backend (`cgpe-backend-main/routes/team.js`,
`utils/scope.js`, `models/Task.js`) and `contracts/api.md` §`/api/team/tasks` — by a 6-agent understand
workflow. Every decision below cites a verified fact; nothing is guessed.

## The four client deliverables (app-side only)

The owner's create-*policy* question ("may a team member create their own tasks at all?") and the
"anyone can edit any team task" question are **owner `[decision]` + `[api]`** — out of scope. The app
can only mirror what the backend enforces today. What it enforces:

- **Create** `POST /api/team/tasks` (`team.js:384`): hard allow-list `['admin','leader','super_admin']`
  by **real role**; every other role gets `403 "Only admin/leader can create tasks."` — so a team-tier
  advisor cannot create **any** task, even a personal one.
- **Edit** `PATCH /api/team/tasks/:id` (`team.js:420-458`): **no ownership/role gate** — *any*
  authenticated staff may edit or reassign *any* team task (401 only if unauthenticated). Accepts
  `title / details / priority / type / dueAt(or due_at) / clientName(or client) / status`; overwrites
  only the keys sent; `''`/`null` clears details/client; `400` if nothing changes or title blank.
- **Roster**: `getTeam()` derives from the self-scoped `/team/task-overview` (`scope.js`: plain member =
  `own`, leader = `team`, admin/super = all). So the assignee picker is missing colleagues who have no
  task yet — even for an **admin** — and is self-only for a team member. Real colleagues come from the
  staff directory `/profiles` (admin/super) — a leader/team 403.
- **Checklist**: `team_tasks` carry **no** steps anywhere (`models/Task.js`; `adaptTeamTask` hardcodes
  `steps:[]`). The "Workflow" checklist card is therefore *always* empty for real team tasks.

### 1. Move the create refusal to the entry (don't invite team-tier into a 403)

Gate every create affordance on **`canCreateTask = capabilitiesOf(user, viewAs).assignTasks &&
can('can_create_task') !== false`** (fail-open on the flag until the RBAC store is ready).

- `assignTasks` is the reliable, role-derived predicate: `true` ⟺ tier admin/master ⟺ real role
  ∈ {admin, leader, super_admin} — **exactly** the backend create gate (leader folds into the admin
  tier in `tierOf()` and IS allowed by the endpoint, so gating on the tier/caps is correct here,
  unlike payroll). It respects "viewing as" (a master previewing team sees no create — the point of
  preview) and is immune to the unseeded RBAC config (the `can_create_task` flag fails **open**, so it
  alone would not hide the FAB — the `assignTasks` term is what actually protects team-tier).
- ANDing `can('can_create_task') !== false` subsumes Home's existing gate (`home.tsx:688`) and lets the
  panel turn create OFF for an entitled department in the future.
- `(tabs)/tasks.tsx`: hide the `<Fab>` and drop the "Add task" action from the three empty states when
  `!canCreateTask`; the book-empty copy changes to an assignment-only message for non-creators.
- `task-new.tsx`: an **entry guard** — a non-creator who reaches the form by deep-link/other entry sees
  the "This account cannot create tasks" state immediately instead of the whole form. The existing
  submit-time `forbidden` branch stays as the backstop.
- **Also gated (review fix):** `home.tsx`'s create gate (`canCreateTask` at :688) gained the same
  `caps.assignTasks` term — the flag alone fails open, so without it Home still invited team-tier into
  the create dead-end — and the "Assign task" quick action on the Admin/Master dashboards
  (`screens/dashboards.tsx`) is now gated on a `canCreateTask` prop passed down from Home. Every create
  affordance in the app now shares one predicate.

### 2. Hide the always-empty "Workflow" checklist card

`task/[id].tsx`: render the whole `<Appear index={2}>` Workflow section (SectionHeader + Card) **only
when `task.steps.length > 0`**. Real team tasks always have zero steps, so this removes a card that
reads as broken. The legacy `/tasks` adapter *can* produce steps, so the checklist is kept for the
(currently dead) path that has them — this is "hide when empty", not "delete".

### 3. Add an Edit-task screen (reuse the live PATCH)

- New `updateTask(id, patch)` in `api.ts`: PATCHes `/team/tasks/:id` (the same path status/reassign
  already use) with only the changed fields; `dueAt` sent **only** when the user changes the due date,
  so an untouched task keeps its exact timestamp. Three-outcome `{ ok, reason? }` like
  `updateTaskStatus`; no 403 gate on edit, so no client role gate on the Edit affordance (matches the
  backend — a team member may edit the task assigned to them).
- New route `src/app/task-edit.tsx`: title / details / client / priority, plus Due as a
  `Keep · Today · Tomorrow · In a week` segment (default **Keep** → dueAt omitted). Prefilled from the
  task passed by params. On save → PATCH → `router.back()`; the detail screen refetches on focus.
  (Category was deliberately dropped — a task's server `type` is often not one of the create form's
  category chips, so a Chips control would read as "nothing selected"; edit stays focused on the
  Point-5 fields. The param was removed too so no dead code is left.)
- Entry point: a pencil in the detail screen's `Header right` slot (`Header` already supports `right`),
  shown **only for a not-done task** (review fix): a field-edit PATCH bumps the backend `updatedAt`,
  which `adaptTeamTask` reads as a done task's `completedAt` — editing a task finished days ago would
  re-credit it to *today's* completed count. A done task is corrected via Reopen first.
- ⚠️ New route ⇒ regenerate `.expo/types/router.d.ts` via `expo start` before `router.push` typechecks
  (CLAUDE.md typed-routes trap).

### 4. Fix the roster source so entitled users see real colleagues

- New `getAssignableTeam()` in `api.ts`: prefer the staff **directory** `/profiles?limit=500` (returns
  every colleague for an admin/super_admin — fixing the missing-colleague bug) and fall back to the
  scoped `getTeam()` roster when the directory 403s (a leader keeps their own team; a team member gets
  self/empty and never reaches a picker). No new endpoint; no contract change.
- Both pickers switch from `getTeam()` to `getAssignableTeam()`: the create assignee picker
  (`task-new.tsx`) and the transfer picker (`task/[id].tsx`).
- **Search + sort (review fix):** the directory can be large, so `getAssignableTeam()` sorts by name and
  each picker sheet grows a `SearchBar` (shown once the roster > 8) that filters via the pure, tested
  `filterMembers()` in `data/team.ts`; the render is capped (40 create / 24 transfer) with a visible
  "Showing N of M — search by name" hint so colleagues past the cap are reachable and never *silently*
  hidden. The sheet's own ScrollView already carries `keyboardShouldPersistTaps="handled"`, so the
  first tap on a result still lands (convention #6).
- **Transfer is assign-to-others**, so gate the transfer affordance on
  `capabilitiesOf(user, viewAs).assignTasks` (the RBAC config sets `can_assign_task_to_others:false` for
  team; and a team member genuinely has no directory to transfer to). A team-tier user sees the
  "Assigned to" row read-only instead of a transfer that leads to an always-empty sheet.

## i18n

Matches `task-new.tsx` (100% hardcoded English) and the Band 2 #2 precedent: new sentences are
hardcoded English; existing shared keys (`t('tasks.add')`, `t('common.cancel')`) are reused. **No new
i18n key is added, so no 5-language copy is owed.**

## Gates / done

`tsc --noEmit` 0 · `npm test` green (+ `updateTask` cases in a new `api-task-edit.test.ts`) · `eslint` 0
new · adversarial review workflow clean · device-unverified (OTA-eligible — no native dep).

## Deliberately NOT done (owner-owned)

- **Create policy** — whether team-tier should create their own tasks (backend 403s them today). The app
  moves the refusal to the entry; it does **not** enable creation the backend forbids. `[decision]+[api]`.
- **Edit ownership** — the backend lets any staff edit/reassign any team task (no scope). Flagged, not
  fixed. `[api]/[decision]`.
- **Real task checklists** — no backend step endpoint exists (Phase 9 / `[api]`). The card is hidden, not
  populated.
- INBOX untouched — additive client behaviour, no contract change.
