# Phase 34 — [audit] Self-created task not visible on the phone

**Audit only — no fix code written this phase (per `docs/PLAN-2026-08-14.md` Group A).** Deliverable: a
written root-cause finding + the one-line fix. The fix is its own small phase (**Phase 34b**, below).

> **RESOLVED 2026-08-14 — fixed on the BACKEND (`cgpe-api` Phase 40), mobile owes nothing.** The audit's
> §6 secondary finding turned out to be the true fix. `cgpe-api` (a) now stamps `createdById` (= caller
> `user_id`) on every `team_tasks` write, incl. `POST /api/team/tasks` (`routes/team.js:200`), and (b) rewrote
> the `/task-overview` own/team creator match to `createdById ∈ allowedUids` (new rows) **AND** `createdBy(name)
> ∈ allowedNames` (legacy rows) — `routes/team.js:63-75` — deleting the broken name-vs-user_id comparison.
> Verified in their source + `__tests__/auth.phase40.test.js` (9 cases, 590 green). The owner's self-created
> task now returns in his **default own-scope** — precise (shows HIS task, not everyone's), so the mobile
> `?scope=all` change below (**Phase 34b) is NO LONGER NEEDED for the owner's bug** and is deferred; it stays a
> candidate only if we later want an admin to see the whole team's board on the ordinary Tasks tab (vs. the
> dedicated master surface, Phase 39). ⚠️ OPS: the backend change was uncommitted at reply time and needs a
> `:3001` restart (and a prod deploy for cgpe.in) before it shows on a device. Mobile code unchanged.

## 0. The report

Owner signs in as `super_admin` (the same account as the admin panel), creates a task **for himself**, and
it never appears on the phone — not on Home's `my_tasks` widget, not on the Tasks tab, and **not even after a
restart**. The owner also confirmed admin-panel **layout** changes *do* reach the phone, so `rbac/app-ui` is
wired — this is specifically a **task-data** problem, not a config problem.

## 1. Verdict (answering the deliverable's question)

**It is a BACKEND SCOPE problem, compounded by an assignee/creator identity mismatch in `team_tasks`. It is
NOT a client-side filter.**

Two independent contributors, both server-side:

1. **A super_admin defaults to `own` scope, and mobile never opts into `all`.** The phone's task list comes
   from `GET /team/task-overview` (no query params). `visibilityScope(req)` resolves an admin/super_admin who
   did **not** pass `?scope=all` to `mode:'own', userIds:[self]` — by explicit product design
   (`utils/scope.js:5-13`, `:68-78`). So the overview keeps only `team_tasks` the caller "owns".
2. **The self-created task fails BOTH ownership predicates** the overview uses (`routes/team.js:54-66`):
   `assigneeName.toLowerCase() ∈ {caller's Profile full_name}` **OR** `createdBy ∈ {caller's user_id}`.

The correct-scoping route (`GET /api/tasks`, which *does* match on `created_by ∈ scope.userIds`) is **never
consulted** — see §4.

## 2. The read path on the phone (evidence)

- `getTasks(ownOnly)` (`src/data/api.ts:337-348`) calls `getTaskOverview()` **first**
  (`GET /team/task-overview`, `api.ts:332-334`) and only falls back to `GET /tasks?limit=500` **if the overview
  returns `null`**.
- `getTaskOverview` uses `tryReal(..., (d) => d && Array.isArray(d.members))`. An **empty** `{ members: [] }` is
  a valid array ⇒ it returns the object, **not `null`** ⇒ the `/tasks` fallback (`api.ts:346-347`) is **dead in
  practice**. The phone's source of truth is therefore `team_tasks` via the overview, exclusively.
- Callers pass `ownOnly=false` for a super_admin: `caps.tier==='master'` ⇒ `isTeam=false`
  (`home.tsx:517`, called at `:669`) and `ownOnly = tier==='team'` = false (`tasks.tsx:159`, called at `:179`).
  So the **client-side `mine` filter (`api.ts:340-343`) is not even applied** for the owner — the client
  returns every member the server sent, unfiltered. The miss is 100% server-side.

## 3. The server scope (evidence)

`GET /api/team/task-overview` (`routes/team.js:27-167`):

- Loads **all** `team_tasks`, then `visibilityScope(req)` (`:52`). For `scope.mode !== 'all'` it filters
  (`:54-66`) to tasks where `assigneeName` (lower/trim) is in `allowedNames`, **or** `createdBy` is in
  `allowedUids`.
- `allowedNames` is built by looking up the caller's `user_id` in the **staff directory**
  (`STAFF_COLLECTION`) and taking that Profile's `full_name` (`:56-60`). `allowedUids = {self}`.
- "Members" are then derived by **grouping the surviving tasks by `assigneeName`** (`:72-78`). A member row
  exists **only if a surviving task carries that assignee** — there is no roster join. Nothing survives ⇒
  `members: []` ⇒ `getTasks` returns `[]` ⇒ empty widget/tab. A cold restart re-runs the identical scoped
  query ⇒ still empty. **That is why "even after restart" changes nothing** — there is no client cache to blame.

### Why the self-created task matches neither predicate

- **`assigneeName` match is fragile.** The task shows only if `team_tasks.assigneeName` equals the
  super_admin's Profile `full_name` (case-insensitive, trimmed). It commonly won't:
  - Created "for himself" with **no explicit assignee** ⇒ stored as the literal **`'Unassigned'`**
    (`routes/team.js:183` default; mobile `addTask` fallback `api.ts:483`). `'unassigned'` ∉ `allowedNames`.
  - The super_admin has **no `STAFF_COLLECTION` row** with a matching `user_id`/`full_name` (plausible for an
    admin-panel account not in the staff directory) ⇒ `allowedNames` is **empty** ⇒ the caller matches
    **nothing** and sees **zero** team tasks in own-scope.
  - Any name variant (email, display name, spacing/casing beyond trim+lowercase, a name ≠ the directory
    `full_name`).
- **`createdBy` match is structurally broken.** Every write path stores `team_tasks.createdBy` as a **name
  string** — `actor = req.user.full_name || req.user.user_id || 'admin'` (`routes/tasks.js:249` mirror;
  `routes/team.js:186` admin-panel create) — but the scope filter compares `createdBy` against `allowedUids`,
  a set of **user_ids** (`routes/team.js:63-64`). A name is **never** in a user-id set, so the `createdBy`
  branch can **never** rescue a self-created task. This is a genuine backend bug (secondary; see §6).

## 4. Why the `tasks`-collection route would have worked — but is never reached

`GET /api/tasks` (`routes/tasks.js:13-141`) scopes correctly for this case: its `ownerOr` includes
`{ created_by: { $in: scope.userIds } }` **and** keeps unowned rows (`:66-82`). A super_admin's self-created
row (whose `tasks.created_by = req.user.user_id`, set at `:211`) **would** appear there. The admin panel's
`POST /api/tasks` even writes to this collection (`:223`). But the phone only falls back to `/tasks` when the
overview returns `null` (§2), which it doesn't — so the one route that scopes `created_by` as a user_id is
never consulted. The app deliberately treats `team_tasks`/overview as the source of truth (`api.ts:293-297`).

## 5. Fix — Phase 34b (mobile, `[m]`, one line)

Request the overview with `?scope=all` when the signed-in user is a **real** admin/super_admin:

```
GET /team/task-overview?scope=all      // only when user.role === 'admin' || 'super_admin'
```

Why this is the right fix:
- It matches `getTasks`'s own **documented contract** — *"own only for team tier; **everything for
  admin/master**"* (`api.ts:336`). Today that contract is silently unmet because mobile never sends the switch
  the backend requires for it.
- It surfaces the self-created task **regardless of its `assigneeName`** (it's in `team_tasks`; `scope.mode
  ==='all'` ⇒ `scopedTasks = tasks`, no name/id join, `routes/team.js:53`).
- It is **safe / a no-op for non-admins**: `?scope=all` is honoured only inside the `canViewAll` branch
  (`utils/scope.js:68-78`). A **leader** still gets team scope, an **advisor** still gets own scope — the
  backend ignores the param for them. No isolation is weakened.
- It is **aligned with the roadmap**: Phase 39's master-monitoring surface wants the master to see all
  members' tasks anyway.

**Trap (must gate on the REAL role, not the folded tier):** `store/roles.ts` `tierOf()` folds `leader` into
the `admin` tier, but the backend only widens for `isSuperAdmin || role==='admin'`. Gate the `?scope=all` on
`user.role === 'admin' || 'super_admin'` (the Phase-20 real-role pattern, `app/payroll.tsx`), **not** on
`caps`/tier. Sending it for a leader is harmless (ignored) but gating on the real role keeps intent honest and
future-proof. `api.ts` currently tracks only `currentUserId`/`currentUserName` (`api.ts:60-61,71`); Phase 34b
must thread the caller's real role into `getTaskOverview` (a `currentUserRole` set alongside, or a param).

**Scope of 34b:** `getTaskOverview()` + its role input in `src/data/api.ts`; a wire test in
`api-tasks.test.ts` (new — asserts `?scope=all` is sent for admin/super and omitted otherwise); no contract
change (`?scope=all` is an existing documented param). ≤3 files. Gates as usual (`tsc`/`npm test`/lint), then
device-check: super_admin sees their self-created task on Home + Tasks; a plain advisor still sees only theirs.

## 6. Secondary finding (backend, NOT fixed here — file to `cgpe-api` only if we want non-admin self-view)

`/team/task-overview` matches `createdBy` against **user_ids** (`routes/team.js:63-64`) while every writer
stores `team_tasks.createdBy` as a **name** (`routes/tasks.js:249`, `routes/team.js:186`). Effect: a
**non-admin** (advisor/leader) who self-creates a team task, leaving assignee blank/`Unassigned`, can't see it
by the `createdBy` path either — only the `assigneeName` path can save them. The 34b `scope=all` fix resolves
the **owner's reported super_admin case** without touching this, so per `PLAN` rule 3 (verify → file only what
is genuinely missing) we do **not** file it now. If the owner later wants non-admins to reliably see their own
self-created team tasks, the clean fix is backend: either store `createdBy`/`createdById` consistently as the
user_id, or have the scope match `createdBy` against `allowedNames` too. Raised, not decided.

## 7. Done-when (this audit phase)

- [x] Reproduced the failure in code (read path + server scope traced end-to-end, both repos).
- [x] Root cause named: **backend `own`-scope default for super_admin + assignee/creator identity mismatch in
      `team_tasks`**, surfaced because mobile reads `/team/task-overview` without `?scope=all`. **Not** a client
      filter; **not** an app-ui problem.
- [x] One-line fix specified (Phase 34b) with the real-role-gate trap flagged.
- [x] Secondary backend bug documented, filing deferred per PLAN rule 3.
