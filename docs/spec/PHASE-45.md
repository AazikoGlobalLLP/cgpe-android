# PHASE-45 — [api]+[m] Per-member completed-tasks report + performance score

**Status:** VERIFIED gap (genuinely new) · score locked with owner · FILED to `cgpe-api` · no mobile build yet — 2026-08-15.

Owner backlog Phase 45 (Group F, `docs/PLAN-2026-08-14.md:131`): a per-member report of **what they
completed, when, and how much**, with a **performance score**. Owner's hard rule: **count only tasks that
were assigned AND actually completed — NOT reminders, NOT self-created-but-unfinished.** The app renders
the score; **it never computes it** (rule 2). Feeds the master surface (Phase 39).

---

## 1. Verified against the real backend first (tags wrong 5×)

Read the real `cgpe-backend-main` code before filing. Two things touch this area; **neither satisfies the
rule**, so this is a genuine new aggregate (unlike Phases 38/43/44, which were already-satisfied).

### 1.1 `GET /api/team/task-overview` (`routes/team.js:27-177`) — close, but not the rule
Aggregates the `team_tasks` collection **per member**, joins Profile (role/dept) + manager (teamstructures),
returns per member `counts:{total,open,done,overdue}` and `completion_pct = round(done/total×100)`, plus each
task. **Why it is not the owner's number:**
- `done` = any status in `DONE = ['done','completed','closed','resolved','cancelled']` (`team.js:23`) — so it
  **counts `cancelled` as done**, which the owner excluded.
- The denominator `total` is **every** task grouped under that assignee — includes **self-created** tasks and
  **reminders** (`type`), both of which the owner excluded.
- No performance **score** beyond the raw completion %.
- Grouping is by `assigneeName` only; it does not separate "assigned by a manager" from "self-created."

### 1.2 `StaffScore` (`models/StaffScore.js`, `routes/staffScores.js`) — a MANUAL table, not derived
`task_completion_percentage` / `reward_points` / `streak_days` / `rank_position` / `achievements` are **typed
in by hand** by an admin/leader (`POST`/`PUT`, `authorize('admin','leader')`). Nothing computes them from real
completed tasks. So it does **not** reflect actual work and cannot be the source of truth for this feature.

### 1.3 Nothing else computes it
`routes/reports.js` has no task/score logic (grep: 0). `routes/dashboard.js` uses `team_tasks` only for an
org-level open count (`:171`) + a unified work queue (`:258`), no per-member score. `routes/tasks.js` is
CRUD; notably it stamps `assigneeName = actor` on a self-created task (`tasks.js:241`) — see §3.

### 1.4 The data needed already exists in `team_tasks`
Per-task fields available (verified in `team.js` create/update handlers): `assigneeName`, `createdBy` (name),
`createdById` (user_id), `type`, `priority` (`P1`/`P2`/`P3`), `status`, `dueAt`, `createdAt`, `updatedAt`, and
**`statusHistory: [{ status, at, by }]`** — pushed on every status change (`team.js:240`). So the backend can
derive **when** a task was completed (the earliest `statusHistory` entry whose `status` is a completed status)
and **by whom**, and compare that to `dueAt` for on-time. No schema change is required to build the aggregate.

---

## 2. Owner-locked definitions (AskUserQuestion, 2026-08-15) — DO NOT invent, DO NOT drift

The plan said "do not invent the score weights — lock with owner." Locked, all four:

1. **Score = importance + timeliness.** Per member per month:
   `score = round(100 × earned ÷ possible)`, over the counted tasks (§3):
   - each task's `possible = { P1:3, P2:2, P3:1 }[priority]` (unknown/missing priority → treat as P3 = 1);
   - `earned = possible × 1.0` if completed **on time**, `× 0.5` if completed **late**, `0` if not completed;
   - `possible = 0` (no counted tasks) → score is **null / "no tasks"**, never `0%` (0% would read as failure).
2. **`cancelled` is NOT completed** — excluded from BOTH the completed set and the denominator (it is dropped
   work, not an achievement). Completed statuses = `done` / `completed` / `closed` / `resolved`.
3. **Only manager-assigned tasks count** — a task the person created for themselves **never** counts, finished
   or not. Mechanism (recommended, §3): `creator ≠ assignee`.
4. **Per calendar month** — one score per member per month (matches payroll + the existing `StaffScore` table);
   any past month is queryable.

Also fixed by the owner's standing rule (not asked — already decided): **exclude reminders** (`type ===
'reminder'`) and exclude **Unassigned** tasks.

---

## 3. The counted set (recommended mechanism — `cgpe-api`'s call)

A `team_tasks` row counts toward member **M**'s month **Y-MM** iff ALL of:
- **assigned to M**: `assigneeName` resolves (by lowercased full_name → Profile) to M;
- **manager-assigned (not self-created)**: `createdById !== M.user_id` **and** `createdBy(name) !== M.name`.
  Rationale: `POST /api/tasks` stamps `assigneeName = actor` for self-created tasks (`tasks.js:241`) and
  `POST /api/team/tasks` stamps `createdById = req.user.user_id` for delegated ones, so `creator ≠ assignee`
  cleanly separates delegated from self-created and prevents self-inflation (the owner's stated concern);
- **not a reminder**: `type !== 'reminder'`;
- **not cancelled**: `status !== 'cancelled'`;
- **belongs to the month**: recommended basis = the task's **due date** month (`dueAt`), falling back to
  `createdAt` when `dueAt` is absent. ⚠️ **One open definition point** — the owner locked "per calendar month"
  but not which date stamps the month; recommend due-month (that is the month the work was *owed*), flag for
  `cgpe-api` + owner to confirm.

Per counted task:
- **completed** = its status is a completed status (§2.2);
- **completed on time** = completed AND the completion timestamp (earliest `statusHistory` entry reaching a
  completed status; fall back to `updatedAt`) `<=` end of `dueAt` day. **No `dueAt` → treated as on time**
  (a task with no deadline cannot be late);
- **late** = completed but after the due date;
- **not completed** = still open at month end.

---

## 4. Proposed response shape (filed to `cgpe-api`; they own the final shape)

`GET /api/team/task-report?month=YYYY-MM[&scope=all|own][&user_id=…]` (reuse `task-overview`'s RBAC/scope):
```
{ success, data: {
  month: "YYYY-MM",
  members: [{
    name, user_id, role, department,
    counts: { assigned, completed, on_time, late, not_completed },  // assigned = counted denominator
    score,            // 0–100 integer, or null when assigned === 0
    completed_tasks: [{ id, title, priority, due_at, completed_at, on_time }]  // the "what + when"
  }],
  totals: { members, assigned, completed, on_time, late }
}}
```
Every number is the server's; the phone renders, never multiplies (rule 2). `score` null ⇒ the app shows
"no tasks", never "0%".

---

## 5. Mobile side — SHIPPED same day (cgpe-api Phase 53 landed the aggregate)

**Filing → verify → reader → render, all 2026-08-15:**
- **Backend shipped it** as `GET /api/team/task-report` (cgpe-api Backend Phase 53). Verified against their real
  `routes/team.js` — every owner-locked def matches exactly (see §2). The flagged open point (§3 month basis) was
  resolved to **due-month, owner-CONFIRMED** (AskUserQuestion, 2026-08-15).
- **Reader:** `getTaskReport(month,{scope,userId})` + pure `mapTaskReport` in `src/data/api.ts` — two-outcome
  `req()` posture (403 wrong-role = quiet answer, 5xx/network/shape = banner); server owns every count/score,
  the app never recomputes (rule 2); `score:null` kept distinct from `0`. Pinned by `api-task-report.test.ts` (16).
- **Render:** NEW `src/app/performance.tsx` — one screen, two views by `?view=` param. **Self** (`/performance`,
  `scope:'own'`, ungated — server self-scopes) = the caller's score hero (0–100 + Meter) + Assigned/Completed/
  On-time/Late KPIs + completed-tasks list. **Team** (`/performance?view=team`, `scope:'all'`) = the ranked roster
  (score badge + counts per member, tap-to-expand completed tasks) + totals, **master-only** via NEW pure
  `canSeeTeamPerformance(user)` in `store/roles.ts` (real `super_admin` role, never the folded tier — Phase-40
  rule; pinned in `roles.test.ts`). **Owner-locked visibility** (AskUserQuestion, 2026-08-15): each member sees
  their OWN; only `super_admin` sees all. More-tab tiles: master-only "Team performance" + ungated "My performance".
- Gates green: `tsc` 0 · `npm test` **487/487** · lint 0 errors. **No contract change** (pure consumer of Phase 53).
- **DEVICE CHECK CARRIED** (native + backend-live-gated): own score for a member, ranked roster for a real
  `super_admin`, "Owner access only" for a real admin/leader deep-linking `?view=team` — once cgpe-api's `:3001`
  restart makes the endpoint return live data.

---

## 6. Decisions

- **Genuine gap — file it** (contrast Phases 38/43/44). Verified: no existing endpoint counts manager-assigned,
  non-cancelled, non-reminder completed tasks per member with a score. `StaffScore` is manual entry;
  `task-overview`'s `done` includes cancelled + self-created + reminders.
- **Score weights locked with the owner, not invented** — importance (P1:3/P2:2/P3:1) + timeliness
  (on-time ×1 / late ×0.5), monthly, `score = 100 × earned/possible`, null when no tasks (never 0%).
- **`creator ≠ assignee` is the "manager-assigned" test** — recommended (mechanism is `cgpe-api`'s), justified
  by `tasks.js:241` stamping self-assignee.
- **Do not compute on device.** The app renders `score`/`completed_at`; a future cutoff/weight change is a new
  `[api]` ask with the owner's exact numbers, never a mobile guess (rule 2 / rule 4).

## 7. Necessary-but-not-sufficient
Live only when `cgpe-api` ships the aggregate (+ `api.md`/`models.md`), the owner confirms the month-basis
(§3), and a later mobile phase renders it + a device check. Until then this phase = verified + score-locked +
filed.
