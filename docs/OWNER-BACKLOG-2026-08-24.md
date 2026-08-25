# Owner backlog — 2026-08-24 — 12 points, verified against real code + prioritized

Owner listed 12 points after analysing the app. Each was investigated **against the actual code** (this app,
the sibling backend on deployed `origin/main` tip `49482e9`, and `contracts/`) by a dedicated agent — nothing
here is guessed; every claim cites a file. This document is the triage + the deep description of each item.

## How this is prioritized (the owner's "main point")

The owner said: **give highest priority to the tasks where a human's need is.** I read that two ways and serve
both, on purpose:

1. **A human (you) is the only unblock.** Many items cannot start — or cannot truly finish — without an owner
   **decision**, an **OPS/server** action, or a **backend relay** (our push is 403-blocked; prod runs only
   `origin/main`). Those are pulled into **Band 1** at the top so you can act on them *in parallel* while I build
   the code. This is the literal "needs a human" reading.
2. **The team's real need.** Items that block the field team's daily work, or expose data, are ranked **P0/P1**
   regardless of who owns them.

**Priority key:** P0 = blocks real work or leaks data, fix now · P1 = real daily friction / broken feature ·
P2 = enhancement / polish / new feature. **Owner tags:** `[m]` cgpe-mobile (I build) · `[api]` backend
(owner relays) · `[admin]` admin panel · `[ops]` server/env/data (owner) · `[decision]` product call (owner).

---

## Master table — all 12, ranked

| # | Point | Priority | Who must act | Can I build now? |
|---|---|---|---|---|
| **9** | Client book is visible to **every** team member (privacy) | **P1 (→P0 if you say so)** | `[decision]`+`[api]`+`[ops-data]`+`[m]` | Partial — app mitigations only; real fix is backend+data |
| **11** | Document **upload** missing + captured file fails/loses link (Claims) | **P1** | `[m]`+`[ops]`+`[api]`+`[decision]` | Yes — picker (needs new APK) ; OPS+link need you |
| **1** | **Report** generation doesn't work | **P1** | `[m]`+`[ops]`+`[decision]` | **Yes — real 12 s client bug I can fix now (OTA)** |
| **6** | **Role-based** system "not working" | **P1** | `[decision]`+`[admin/ops-config]`+`[m]` | Partial — mechanism exists; needs your matrix + config |
| **5** | **Task / member-task** flow (team can't create; roster empty; no edit) | **P1** | `[decision]`+`[api]`+`[m]` | Partial — app mitigations yes; create-policy needs you |
| **2** | **Search** "word-by-word" (Tickets/Tasks), make simple/fast | **P1** | `[m]`+`[api]` | Yes — Tasks local search now (OTA); server fix relayed |
| **4** | My-Tasks-Today + **Calendar** UI + member-task-create | **P2** (one P1 bit) | `[m]`+`[decision]` | Yes — calendar grid + gating (OTA) |
| **10** | **Client Search** button in More (simple/fast) | **P2** | `[m]`+`[decision]` | Yes — a Search tile already exists; scope it to clients |
| **3** | **Premium & Greeting** check/optimize | **P2** | `[decision]`+`[m]` | Yes — greeting is fine; consolidate 2 duplicate screens |
| **7** | **Goal-based** system (role + goals) | **P2** | `[decision]`+`[api]`+`[admin]`+`[m]` | No — net-new feature; spec-lock first |
| **8** | Personalized **WhatsApp automation** + multiple numbers | **P2** | `[decision]`+`[api]`+`[ops]`+`[m]` | Partial — personalization done; automation/numbers new |
| **12** | **Voice Assistant** (explicitly LAST) | **P2** | `[decision]`+`[m]`+`[ops]` | No — feasible, but needs a native rebuild + a spike |
| **13** | **Payroll shows only ONE member** — want everyone, pay per their work, + bank/essential details, + a "data pending" warning | **P1** | `[ops-data]`+`[decision]`+`[m]`+(opt)`[api]` | Partial — I can show ALL staff + pending-warnings + a bank/details panel now (OTA); the reason only one shows is a data job (owner) |

_(Point 13 added 2026-08-25 — owner observation after using the app; verified against real code same as the other 12.)_

---

## 🔴 Band 1 — Needs YOU (decide / OPS / relay). Start these in parallel; I can't do them alone.

These are the human bottlenecks. Each is a short, concrete ask. Full reasoning is in the deep sections below.

1. **Reports [ops]** — On the server, set `CGPE_REPORT_WEBHOOK_URL` (or `N8N_REPORT_WEBHOOK_URL`) +
   `CGPE_REPORT_SECRET`, make sure the n8n "cgpe-report-render" workflow is live, confirm nginx read-timeout in
   front of `:3001` is ≥ 60 s, then restart `:3001`. *(Without this, no report can ever generate — regardless of
   the app fix.)*
2. **Document upload [ops]** — On the server, set DigitalOcean Spaces env
   (`DO_SPACES_ENDPOINT/KEY/SECRET/REGION/BUCKET_NAME`) + `BACKEND_URL`, restart `:3001`. *(Today uploads land on
   throwaway local disk with a `localhost` URL — this is the biggest single reason captures "fail" / vanish.)*
   Also **[decision]**: should claim documents live in a **public** Spaces bucket, or private/signed URLs? They
   may contain PII/policy scans.
3. **Client access [decision]** — What should a **normal team member** see in Clients? (a) only clients assigned
   to them, (b) their team/branch, (c) nothing (Master/admin-only), or (d) the whole book is fine (then it's not a
   leak). Today it's (d) by contract, and every team token can read all ~9,000 clients via API/search/deep-link.
   If you pick (a)/(b)/(c) it needs a **backend + contract change** (relay) and probably a **data job** to assign
   client ownership.
4. **Role-based matrix [decision]** — For each role **and** each department, write down: which bottom tabs, which
   menu modules to **remove** (not just hide-that-does-nothing), which dashboard widgets, and which of the 14
   feature toggles are on. The machinery is built and deployed — it's just **not configured** (no per-role data
   exists yet). Also decide: does "reduce a role's menu" mean *hide the widget* (still reachable) or *remove it*?
   Today only true removal (`nav.hidden`) actually restricts.
5. **Task creation policy [decision]+[api]** — Should a normal team member be able to create **their own** tasks?
   Today the backend 403s them, yet the app invites them to. If yes → backend relay. And: who may assign tasks to
   **others**?
6. **Search [api]** — Relay the "make server search tokenized" ask (so "patel rajesh" finds "Rajesh Patel", and
   name + phone-tail matches). This is the true fix for "word-by-word". I'll ship the Tasks-tab local search now.
7. **Premium [decision]** — `/premium` and `/campaigns` are near-duplicate screens. Keep one (recommend retire
   `/premium`, point everything at `/campaigns`) or both?
8. **WhatsApp [decision]+[ops]** — Define "automation" (unattended daily occasion auto-send? admin-scheduled
   one-shots? nothing beyond today's manual send?) and "multiple numbers" (a pool of business numbers routed by
   n8n? each advisor from their own WhatsApp? inbound routing?). Also confirm the n8n WhatsApp webhooks are set
   and in **live-send** (not simulate) mode on prod.
9. **Goals [decision]** — Spec-lock the goal model (per-user / per-role / per-department; which metrics; auto vs
   manual progress; display-only vs gates-access) before any build.
10. **Voice assistant [decision]** — Go/no-go on a native rebuild + a de-risk spike; on-device vs server speech;
    which languages you'll actually promise (Gujarati speech is the real risk).

---

## 🟢 Band 2 — Client work I can build now (OTA-eligible unless noted). Suggested order.

1. **Report 12 s timeout fix** *(P1, OTA)* — the highest-value quick win; ~3 lines + tests (details in Point 1).
2. **Tasks-tab local search** *(P1, OTA)* — instant in-memory search, forgives typos/word-order (Point 2).
3. **Task flow mitigations** *(P1, OTA)* — hide the always-empty checklist card, gate "Add task" on the real
   permission, add an "Edit task" screen, fix the empty assign/transfer roster (Point 5).
4. **Calendar grid + create gating** *(P2, OTA)* — real month grid with prev/next nav; gate create affordances
   (Point 4).
5. **Client Search in More** *(P2, OTA)* — scope the existing search to clients-only (one request, faster)
   (Point 10).
6. **Premium/Greeting cleanup** *(P2, OTA)* — fix the 403-mislabel, delete dead `greeting()`, (pending your
   decision) consolidate the two campaign screens (Point 3).
7. **Client-search leak mitigation** *(P1, OTA)* — make global search honor role/hidden scope so a hidden Clients
   tab doesn't leak clients through search (Point 9, app half).
8. **Role toggles wiring** *(P1, OTA)* — make the 10 currently-inert feature toggles actually gate the app
   (Point 6, after you define the matrix).
9. **Contest mapper fix** *(P2, OTA)* — a latent bug that will bite the moment any contest is created (Point 7).
10. **Document picker** *(P1, NOT OTA — needs a new APK)* — add file/gallery picker + honest errors (Point 11,
    app half).

---
---

# Deep descriptions — every point

Each: **What you noticed → What's really happening (verified) → Root cause → Who owns it → What changes →
Effort → Decisions I need from you → Priority.**

---

## Point 1 — Report generation doesn't work → **P1** `[m]`+`[ops]`+`[decision]`

**What you noticed:** reports don't generate properly.

**What's really happening (verified):** The report path is fully wired and the app side is *honest* — it opens
the rendered report, shows a PDF/view link, never fabricates numbers, and already names the failure cause
(`client/[id].tsx:105-128`, `api.ts:3230-3264`, `api-report.test.ts` 9 cases). The backend route is **deployed
and correct** (`routes/clients.js:320`), and it deliberately waits **up to 60 s** for the n8n render (which takes
**15–40 s**). **But the app aborts the request at 12 s** — `generateReport` reuses the ordinary 12 s read timeout
(`api.ts:3237` → `REQUEST_TIMEOUT`, `config.ts:74`). So **every first-time report is killed by the app before the
server can answer**, and because the app timed out, the shared 7-day cache never gets populated either. From the
user's seat: "reports never generate." (A *cached* report — one the panel already made in 7 days — returns fast
and works; only fresh ones die.)

**Root cause — two stacked:** (1) **CLIENT bug** — 12 s timeout on a long POST that needs ~60 s. The codebase
already has the pattern for long calls (`sendCampaign` passes 30 000; `UPLOAD_TIMEOUT` 30 000) — `generateReport`
just doesn't use it. (2) **OPS gap** — the n8n report webhook env is (almost certainly) unset on prod, so the
endpoint returns `503 not_configured`; without it, no report can ever be built.

**Who owns it:** `[m]` I fix the timeout · `[ops]` you set the webhook env + confirm the nginx proxy timeout ≥ 60 s
· `[decision]` acceptable max wait; whether a slow report should raise the global outage banner.

**What changes (client):** add `REPORT_TIMEOUT = 65000` in `config.ts`; pass it in `generateReport`
(`api.ts:3237`). Recommended: a report timeout should show a *report-specific* "taking longer than usual" message,
**not** flip the whole-app outage banner (`api.ts:3260-3263`). Optional: surface `data.cached` ("loaded
instantly"); send `phoneLast10` so app+panel share cache keys. +tests.

**Effort:** S–M (client), OTA-eligible. **Decisions I need:** exact max wait (recommend 65 s); suppress the global
banner for slow reports? (recommend yes). **Priority:** P1 — reads as fully broken, but needs both my fix *and*
your OPS action.

---

## Point 2 — Search "word-by-word", make simple/fast → **P1** `[m]`+`[api]`

**What you noticed:** searching a name happens "word-by-word"; make it simple and fast, especially in Tickets and
Tasks.

**What's really happening (verified):** Three different search surfaces. The **global Search** screen
(`search.tsx`) is actually clever locally (typo-tolerant, out-of-order, phone-tail) — but only for
leads/claims/tasks it pulls to the phone; **clients and tickets are matched on the server**. The server search
(`routes/tickets.js:134-141`, `clients.js:284-289`, `tasks.js:55-58`) is **one regex of the whole query string**
across fields — so "patel rajesh" does **not** find "Rajesh Patel", "rajesh 8891" (name + phone tail) finds
nothing (no single field holds both), and a typo finds nothing. That rigidity is the "word-by-word" feeling, most
visible on **Tickets** because ticket search is server-only. Separately, the **Tasks tab has no search box at
all** (`(tabs)/tasks.tsx` — only the time-view toggle), so finding a task forces a trip to global Search. "Slow"
= every keystroke on Tickets/Clients is a fresh network round-trip.

**Root cause:** (A) the backend's single contiguous-substring regex (word order + adjacency required) — deployed,
live; (B) no in-tab Tasks search; (C) network latency per keystroke, not the debounce.

**Who owns it:** `[m]` Tasks local search + shared scorer + tickets local-narrow · `[api]` tokenize the server
`search` param (the real fix) — **owner relays** (this is the same "whole-book fuzzy" ask already owed from D5).

**What changes:** *Client (now, OTA):* add a local search box to the Tasks tab that filters the already-loaded
list in memory (instant, typo-forgiving); extract `search.tsx`'s matcher into a shared tested `lib/searchScore.ts`;
optionally locally re-rank the loaded tickets page while the server responds. *Backend (relay):* split `search` on
spaces and build an `$and` of per-token `$or` regexes in tickets/clients/tasks/leads — small, backward-compatible,
fixes word-order + cross-field everywhere. **Do this together with Point 10** (same root cause).

**Effort:** M (client). **Decisions I need:** Tasks gets its own search box (recommend yes)? tokenized-regex enough
or do you want true typo-tolerant server search (Atlas Search — heavier, costs)? **Priority:** P1.

---

## Point 3 — Premium & Greeting: check/optimize → **P2** `[decision]`+`[m]`

**What you noticed:** check and optimize Premium and Greeting.

**What's really happening (verified):** **Greeting is healthy** — Home computes the time-of-day text + emoji
correctly and localizes it in all 5 languages (`home.tsx:557-562, 2066-2068`); no change needed. (There's a
*dead* `greeting()` in `format.ts:148-153` with zero callers — safe to delete.) The real finding: **`/premium`
("Premium & Greetings") and `/campaigns` are two user-visible screens doing the same job** — bulk personalized
WhatsApp over 4 occasions, same three endpoints. `campaigns.tsx` is a strict **superset** (KPI summary, message
preview before sending, live progress, and correct 403 handling). Both are reachable from More *and* Home, so the
duplication shows in two menus. One real defect: `premium.tsx` mislabels a **permission (403)** refusal as
"Dispatch failed" with an error buzz (it lacks the role-refused branch `campaigns.tsx` has).

**Root cause:** enhancement/architecture — `campaigns.tsx` was built later but `premium.tsx` was never retired.
Plus the one 403-mislabel bug and dead code.

**Who owns it:** `[decision]` keep one screen or both · `[m]` the cleanup either way.

**What changes:** (recommend) retire `/premium`, point its nav entries at `/campaigns`; **fix the 403 mislabel** in
`store/jobs.tsx` so a role limit reads as "your role can't bulk-send" not "failed" (benefits both screens); delete
dead `greeting()`. Consolidating also removes `premium.tsx`'s heavy whole-book client scans.

**Effort:** S for the fixes; M for consolidation. **Decisions I need:** one screen or both? Is the old "renewal
audience is scope-buggy for super_admin" still true (if fixed, we can drop a whole client-side workaround)?
**Priority:** P2.

---

## Point 4 — My-Tasks-Today + Calendar + member-task-create → **P2** (one P1 bit) `[m]`+`[decision]`

**What you noticed:** tasks show in "My Tasks Today", but Calendar and member-task-create need checking; improve
the Calendar UI.

**What's really happening (verified):** **Member-task-create works end-to-end** — `task-new.tsx` has an assignee
picker (roster from `getTeam()`), sends `assigneeName`, backend stores it and the assignee sees it; the backend is
live. The **Tasks-tab "Calendar"** (added in D4) is a **minimal horizontal date rail of the current month only** —
no month grid, no prev/next navigation (so a task in a *future* month is unreachable from any Tasks view), and each
day shows a **binary dot** (a 1-task day and a 6-task day look identical; the count is computed but only in the
a11y label). Note there are **two different "Calendars"**: this task rail, and a separate `calendar.tsx` reminders
agenda — same word, different data, which is itself confusing. One real gap: the Tasks-tab "Add task" affordances
**ignore the permission flag** (Home already gates it), so a team member is invited to create and only learns they
can't at submit.

**Root cause:** enhancement/polish; the create-gating inconsistency is the one defect-shaped item. Backend needs
no change (all endpoints deployed).

**What changes (client, OTA):** replace the rail with a real **7-column month grid + ‹prev/next› + month header**;
show the per-day **count** (not a binary dot) and mark all-completed days distinctly; gate the FAB/empty "Add task"
on `can('can_create_task')` like Home; wire the unused `can_assign_task_to_others` flag so only entitled roles see
the "assign to someone else" options; optional: an in-app (pure-JS) arbitrary date picker and a "create task for
THIS member" deep-link.

**Effort:** M (client, OTA). **Decisions I need:** full month grid (recommend yes)? may plain team members create
tasks at all (see Point 5)? which roles may assign to others? arbitrary due date vs the 3 presets? **Priority:** P2
(the create-gating sub-item is P1).

---

## Point 5 — Task / member-task flow (create + manage) → **P1** `[decision]`+`[api]`+`[m]`

**What you noticed:** make the overall task-create and member-task-management flow simple and smooth.

**What's really happening (verified):** For **admin/leader/super_admin** the flow is fully functional. For the
**majority user (team-tier advisors) it's largely broken**: (1) the app's only create path is `POST /team/tasks`,
which the **backend 403s for team-tier** (`team.js:382-385`) — so a normal member **cannot create even a personal
to-do**, yet the UI shows the whole form and only refuses at submit; (2) the **assign/transfer roster is empty for
team members** — it's derived from a self-scoped source, so their picker shows only themselves; (3) **no way to
edit a task after creating it** (the backend PATCH already accepts title/priority/due, the app just never sends
them); (4) **every task's detail shows an always-empty "Workflow" checklist** (team tasks carry no steps), so it
reads as broken. Also: two parallel task systems (`tasks` vs `team_tasks`), name-based assignment keying, and a
PATCH with no ownership gate (any signed-in user can edit/reassign any team task).

**Root cause:** two genuine defects (team-tier can't create; empty roster) + product/policy + two-system tech-debt.

**Who owns it:** `[decision]` may team members create own tasks / assign to others? `[api]` the create-policy +
(optional) task-steps endpoint · `[m]` the client mitigations.

**What changes:** *Client now (OTA):* move the refusal to the **entry** (gate create affordances so users aren't
invited into a 403); **hide the empty checklist card**; add an **"Edit task"** screen reusing the live PATCH
fields; **fix the roster source** so entitled users see real colleagues. *Backend (relay, after your decision):*
allow team members to create their own tasks (relax `POST /team/tasks` for self-assign, or use the already-live
`POST /api/tasks`); decide whether to scope PATCH to owner/manager; decide the two-systems question.

**Effort:** M (client mitigations); the create-policy + steps are L and cross-repo. **Decisions I need:** (1) can
team members create own tasks? (2) self-assign only, or assign to others too? (3) collapse the two task systems?
(4) is "anyone can edit any task" intended? (5) build real task checklists or drop the card? **Priority:** P1 —
the owner's core ask is unmet for most users.

---

## Point 6 — Role-based system "not working" → **P1** `[decision]`+`[admin/ops-config]`+`[m]`

**What you noticed:** the role-based system isn't working properly; each role should get only what it needs.

**What's really happening (verified):** The mechanism is **fully built and deployed** — the server drives the
mobile tabs, menu, dashboard and feature flags per role via `GET /rbac/app-ui`, and the admin panel has a complete
editor for it. The **sensitive** surfaces (live location, Monitor, Payroll, team performance, Notify) **are
correctly locked** to real super_admin/admin at both screen and backend. So it's not wide-open. What's actually
wrong is three things: (1) **it's not configured** — no per-role documents have been seeded, so most staff roles
fall back to defaults that show the **full** menu (the More tab shows everything to everyone); (2) **10 of the 14
feature toggles do nothing** in the app — the panel can flip them but the app ignores them; (3) two deliberate
product rules fight your mental model — the app **fails open** (a config error shows everything) and **switching a
module "off" doesn't remove it** (only `nav.hidden` truly removes; everything else falls to a catch-all group).

**Root cause:** ~80% an unseeded **data/config job** + two design rules, ~20% real client gaps (inert toggles, two
gating models). Not a single bug, not a deploy gap.

**Who owns it:** `[decision]` you define the matrix + the "hide vs remove" philosophy · `[admin/ops]` configure it
(panel or seed script) · `[m]` wire the 10 inert toggles + add 2 screen-level guards (deep-link protection).

**What changes:** **(A)** you write the per-role/per-department matrix (tabs / removed modules / widgets / which
toggles). **(B)** configure it — via the panel's Android Application editor or an extended seed script (runs once,
no APK). **(C)** I wire the 10 dead toggles so the panel actually bites, and add screen guards to Campaigns/
Analytics so a deep link can't render an admin shell. **Also verify every staff member's `Profile.role` in the DB
is correct** — the sensitive gating keys entirely off that, so a wrong role there is a permission bug no code fix
touches.

**Effort:** client Fix-1 M, Fix-2 S; the dominant cost is your matrix + the config data entry (no code).
**Decisions I need:** the full matrix; does "reduce menu" mean hide (still reachable) or remove? do the 9
departments each need their own layout? do you want the 10 inert toggles made real? are all `Profile.role` values
correct today? **Priority:** P1 (over-exposure of ordinary modules; not a data leak — that's Point 9).

---

## Point 7 — Goal-based system (role + goals) → **P2** `[decision]`+`[api]`+`[admin]`+`[m]`

**What you noticed:** add a goal-based system alongside role-based; access + workflow driven by role and assigned
goals.

**What's really happening (verified):** There is **no assignable goal/target concept today**. Three goal-*shaped*
fragments exist but none fits: the MDRT tier is a *derived achievement ladder* (not assignable); the task
performance score is *retrospective* (not a forward target); the **Contest** system is the closest primitive but is
(a) a shared competition not an individual objective, (b) **broken in the app** (every field of the app's Contest
type mismatches the backend — any real contest would render blank), (c) **has no admin UI to create one**, and (d)
progress is set manually. A dormant gamification model (`StaffScore`) exists but the app uses none of it.

**Root cause:** enhancement — a real goal layer is a net-new **Goal model + assign/progress endpoints + admin UI +
app surface**, plus a stack of product decisions. (The Contest wire-drift is a separable P2 app bug.)

**Who owns it:** `[decision]` (dominant — the model is undefined) · `[api]` new backend · `[admin]` assignment UI ·
`[m]` the app surface + (if wanted) goal-gated workflow.

**What changes:** after you spec-lock — a `Goal` collection (scope user/role/dept, metric, target, period), progress
**computed server-side** from existing data (premium/tasks/leads/activity) so it's un-fakeable; an admin "Goals"
section; an app `/goals` surface (Meter + remaining) following the existing commissions pattern. Keep the two halves
separate: **display goal progress** (low risk) can ship well before **gating access by goals** (high risk — can
lock people out). I can fix the **Contest mapper** now regardless.

**Effort:** client L (whole feature XL cross-repo). **Decisions I need:** per-user/role/dept? auto vs manual
progress? which metrics + exact targets? display-only or gates access (ship which first)? reuse Contest/StaffScore
or a clean model? who assigns? reward on completion? **Priority:** P2.

---

## Point 8 — Personalized WhatsApp automation + multiple numbers → **P2** `[decision]`+`[api]`+`[ops]`+`[m]`

**What you noticed:** implement personalized WhatsApp automation; handle multiple WhatsApp numbers properly.

**What's really happening (verified):** **Personalization is already done** end-to-end — the server builds a fully
personalized message per recipient (birthday with age, anniversary years, renewal with premium/policy/due,
maturity), and the app mirrors the same templates for 1:1 sends; the tick is honestly gated on real dispatch. What
is **absent**: (1) **unattended automation** — there's no daily cron that scans "today's birthdays / due renewals"
and auto-sends; the only scheduling is an admin explicitly setting a future one-shot, and the **app never uses even
that** (no scheduling UI). So from the app, 100% of sends are "send now". (2) **Multiple sender numbers** — not
modelled **anywhere**: the whole stack assumes **one sender per n8n webhook**; there is no `from`/sender field and
no routing by number. (The only "multiple numbers" that works today is the trivial case where the single-send deep
link opens each advisor's own phone WhatsApp.)

**Root cause:** enhancement — two net-new capabilities the system was never built for.

**Who owns it:** `[decision]` define both asks · `[api]`+`[ops]` the automation cron / sender routing + n8n ·
`[m]` at most a scheduling/number-picker UI slice.

**What changes:** depends entirely on your definitions. If "automation" = unattended occasion auto-send → a
**backend daily scheduler** reusing the existing audience builder, **with an "already-sent-today" ledger** so a
restart can't double-message customers. If it = admin-scheduled one-shots surfaced in-app → the backend supports it;
the app gap is a **scheduling UI** (the one client slice). Multiple numbers → **decide the model first**, then
backend/n8n routing, then a small app label/picker. Do **not** invent a number scheme in the app — there's no field
to bind it to.

**Effort:** client S–M (only if app scheduling/number UI is wanted); substance is backend/n8n. **Decisions I need:**
what "automation" means; what "multiple numbers" means; are the n8n webhooks live (not simulate) on prod?
**Priority:** P2 (→P1 if you treat automation as core).

---

## Point 9 — Client access not role-based (whole book visible to all) → **P1 (→P0)** `[decision]`+`[api]`+`[ops-data]`+`[m]`

**What you noticed:** any team member can access the entire Clients section; it must be role-based, and Master-only
stays Master-only.

**What's really happening (verified — this is the serious one):** **Hiding the tab does not fix this.** The backend
`GET /clients` is protected but has **no role gate**, and the visibility model (owner-chosen, in the contract)
makes **unowned records firm-wide-visible to every authenticated token**. The imported ~9,000-row LIC book is
overwhelmingly unowned, so **every team advisor can read essentially the whole book** — by list, by global search
(`search.tsx` queries clients unconditionally, even when the tab is hidden), and by opening any client by id via
deep link. The app even forces `scope=all`. So this is real PII exposure, and it lives in the **backend + data**,
not in tab visibility.

**Root cause:** a deliberate, contracted backend scope model (unowned = firm-visible) + no authorize gate on
`GET /clients`. The app compounds it (forces wide scope, renders the tab to all, search ignores scope).

**Who owns it:** `[decision]` what a team member should see · `[api]` narrow the scope + edit the contract ·
`[ops-data]` assign client ownership (else strict scoping shows a team member ~0 clients) · `[m]` app mitigations.

**What changes:** **decide first** (own-only / team / none / status-quo). To truly restrict → backend: drop the
unowned-firm fallback for team roles and/or add a server-enforced `can_view_client` capability re-checked at
`GET /clients` + `/clients/:id`; edit `contracts/api.md` §3.1 + CHANGELOG first. **Master stays whole-book by
construction.** *Client mitigations I can ship now (necessary but not sufficient):* make global search honor
role/hidden scope so a hidden Clients tab stops leaking clients through search; stop forcing `scope=all`.

**Effort:** client S–M (mitigations only); the real fix is backend + a data migration (L, owner-owned). **Decisions
I need:** the visibility rule; should admin keep whole-book or be narrowed; is the imported book *intended* to be
firm-wide (then not a leak); who funds the ownership-assignment data job. **Priority:** P1, and **P0 if you consider
whole-book PII visible to every team member unacceptable today.** Note the client mitigation must be coordinated —
tightening scope before ownership is assigned would empty team members' Clients lists.

---

## Point 10 — Client Search button in More (simple/fast) → **P2** `[m]`+`[decision]`

**What you noticed:** put a Search button in More that opens a simple, fast client search.

**What's really happening (verified):** **A prominent "Search" tile already exists at the top of More** (plus a
"Global search" row and a Home search glyph). It opens the global search over 5 record types, ranks clients first,
autofocuses the keyboard, and is typo-tolerant. So the button exists — the gap vs your ask is that it's a
**global** search (fires 3 requests per keystroke) rather than a **client-only** one (1 request, faster). There's
also a chance your department's config **hides** the tile, or you simply haven't seen it.

**Root cause:** enhancement — the entry exists; making it client-scoped is the delta.

**What changes (client, OTA):** add an optional `scope=clients` param to the existing search screen — when set, fire
**only** the clients request (one round-trip, the concrete speed win) and relabel the chrome "Find a client"; point
the More tile at it. Keep the global "Everything" search as a separate row if you want both. Inherits Point 9's
scope automatically.

**Effort:** S (client, OTA). **Decisions I need:** client-only or is clients-first-global fine? keep both entries?
(and please confirm the existing tile isn't hidden for your team). **Priority:** P2.

---

## Point 11 — Document Upload + Capture broken (Claims) → **P1** `[m]`+`[ops]`+`[api]`+`[decision]`

**What you noticed:** no document-**upload** option (only Capture) in Claims etc.; a camera-captured image errors
and doesn't reach the server.

**What's really happening (verified — a real broken workflow, three separate faults):** (1) **No file picker at
all, and the gallery is unreachable when camera permission is granted.** Upload exists only in the two Claims
screens, using only the camera library; the photo-gallery path is reached **only if you deny camera permission**,
and there's **no PDF/document browse** even though the backend accepts PDFs/Office docs. The button literally says
"Capture or upload a document" but there's no upload. (2) **Cloud storage is OFF on prod** — verified
`cloudStorageConfigured:false` — so every upload falls back to **ephemeral local droplet disk** with a
`localhost` URL (wiped on redeploy, and a write failure returns a 500 the app shows as "didn't upload"). This is
the most likely source of the actual on-device error. (3) **Even on success the file is never linked to the
claim** — names get folded into the notes text and the URL is discarded; the checklist tick is local-only and
persists nothing. (The client multipart itself is correctly formed — that part is *not* the bug.)

**Root cause:** client feature gap (no picker; gallery gated behind camera-deny; opaque errors; upload not linked)
+ OPS (Spaces env unset) + backend/product (no claim↔file link endpoint).

**Who owns it:** `[m]` picker + honest errors + attach call · `[ops]` Spaces env (biggest single fix) · `[api]`+
`[decision]` the durable claim↔file link.

**What changes:** *Client:* add `expo-document-picker`; replace the forced-camera flow with an action sheet — "Take
a photo / Choose from gallery / Choose a file"; make `uploadFile` return the **real** failure (too-large /
type-rejected / timeout / server) instead of one generic banner; after upload, POST the file metadata to the live
`/api/file-attachments` (or a new claim-scoped endpoint) so it's durable. **This needs a new APK** (document-picker
is native — not OTA). *OPS:* set the Spaces env + `BACKEND_URL`, restart `:3001`. *Backend/decision:* pick the
claim-link model.

**Effort:** client M (new native module → new APK); L end-to-end with OPS + backend. **Decisions I need:**
public vs private/signed Spaces bucket for claim docs (PII)? which other sections need upload (materials/tickets/
KYC)? link via generic `/api/file-attachments` or a new claim endpoint? Can you grab one device logcat of a failing
capture so I confirm the exact error? **Priority:** P1.

---

## Point 12 — Voice Assistant → **P2 (explicitly LAST)** `[decision]`+`[m]`+`[ops]`

**What you asked:** can we add a personalized Voice Assistant so a user (e.g. an older/less-tech member) can speak
a request — "mujhe ye client chahiye aur premium jaanna hai" — and it finds the client, gets the details, and
speaks the answer back?

**Honest verdict (verified): Feasible — yes. Trivial — no.** English/Hinglish/Hindi "ask → look up → speak back"
is clearly achievable on this stack. The reasons it's real work:

- **The whole speech stack is missing** — no speech-to-text, no text-to-speech, no microphone permission are in the
  app today. All three are **native**, so this needs a **new APK, not an OTA update** (same class as the push/
  calendar builds).
- **The action + brains are largely already there (the good news):** the app already has the exact lookup functions
  (`getClientsPage`, `getClient` — the client's premium/policies are on-device once resolved), and the **backend
  already ships a deployed natural-language query engine (`/api/ai/query`) and an LLM proxy (`/api/assistant/chat`)**
  — so the "understand + act" layer is mostly free.
- **The dominant risk is Gujarati.** On-device Gujarati speech recognition and Gujarati TTS voices are frequently
  missing/weak on budget Android — it can silently degrade to Hindi/text for exactly the users it targets.

**Recommended plan:** a scoped "**command bar**" (press-and-hold mic → look up a client → **speak** premium/renewal),
**read-only** for v1 (never sends WhatsApp or writes — safety), English/Hinglish first. **Do a one-build de-risk
spike first** (add the speech modules, measure real hi-IN/gu-IN on your team's actual phones) before investing
further. Server Whisper (better Gujarati, but sends voice off-device + per-minute cost) only if on-device proves too
weak.

**Effort:** XL (dominated by native speech integration + device-by-device Gujarati testing; the spike alone is M).
**Decisions I need:** go/no-go on a native cycle for the lowest-priority item; on-device vs server speech (privacy
vs accuracy — the team says client financial details aloud); is Gujarati a hard requirement or is Hindi/Hinglish OK
for v1; read-only v1? is the backend LLM actually enabled on prod (OPS)? **Priority:** P2, last.

---

## Point 13 — Payroll shows only ONE member; want everyone + pay-per-work + bank/essential details + a "data pending" warning → **P1** `[ops-data]`+`[decision]`+`[m]`+(opt)`[api]`

_(Added 2026-08-25. Owner: "inside Payroll only Pavitra bhai shows — work out why everyone isn't showing, and make it so each person's payroll shows according to their work; from there add bank details / whatever essential details; and show a warning that this employee's data is pending.")_

**What you noticed:** open Payroll and only **one** member (Pavitra) appears; the rest of the team is missing. You want every employee listed with pay computed from their work, their bank/essential details visible, and a clear warning where an employee's data isn't set up yet.

**What's really happening (verified — this is a DATA gap, not a broken screen):** The Payroll roster is `GET /api/payroll/compute` (`src/data/api.ts:2700` → `routes/payroll.js:368`), and `buildRoster()` iterates **only `PayrollProfile` documents** — `const profiles = await PayrollProfile.find(filter)` (`routes/payroll.js:327`), then computes each one's pay from *their own* `daylogs`. **A member appears in Payroll only if an admin created a payroll profile for them** (`POST /api/payroll/profiles`, which requires `salary_amount` + `segment`). So "only Pavitra shows" means **only Pavitra has a payroll profile** — everyone else has none, so there's no salary/segment to compute and they never enter the roster. This is exactly the shape of Point 6 (RBAC built but *unseeded*): the machine is fine, the per-member data was never entered. The app even says so in its own copy ("Payroll profiles are created in the admin panel; once they exist, each member's computed pay appears here" — `payroll.tsx:180`), but that message only shows when the roster is **totally** empty, so with one profile present it's hidden and the screen just looks like it's dropping people.

Two more verified facts that shape the fix:
- **"Pay according to work" already works — but needs a salary to multiply.** Attendance/worked-hours is read live from every member's `daylogs` (`routes/payroll.js:335`, `services/payrollAttendance.js`), so the *work* side exists for everyone. But pay = work × a **rate**, and the rate lives on the payroll profile (`salary_amount` + `segment`). No profile ⇒ genuinely nothing to compute, not a bug to fix in code. So "show everyone's pay per their work" still requires each employee to have a salary profile (or a department default) — a **data job**.
- **Bank/essential details already exist server-side and are reachable — but are deliberately kept OFF the phone today.** `PayrollProfile` carries `beneficiary_name / bank_name / account_no / ifsc_code / aadhar_no / pan_no` (`models/PayrollProfile.js`, deployed on `origin/main`), and `GET /api/payroll/profiles/:userId` (admin-only) returns the **full** doc including them. But `/compute` and the detail screen intentionally **omit** all PII (`payroll.tsx:29-31` "NO PII ON THE PHONE"; `publicRow()` drops bank fields). Adding bank/essential details to the app therefore **reverses that earlier decision** — which the owner is now explicitly asking for, but it must be flagged as a sensitivity call (see Decisions).

**Root cause:** ~80% an **unseeded data job** (only one `payroll_profiles` row exists) + a **product decision** the owner is now changing (show bank/essential PII on the phone) + a small **client gap** (the roster shows only profile-holders instead of the whole team, so a missing profile reads as a dropped person rather than a "pending" one).

**Who owns it:** `[ops-data]` create payroll profiles for the rest of the staff (the real reason only one shows) · `[decision]` may the app show bank/Aadhaar/PAN on a field phone, and to which role, masked or full · `[m]` show every staff member with a "data pending" warning + a bank/essential-details panel · (optional) `[api]` an "include all staff" compute mode so the app needs one call, not two.

**What changes:**
- *Client now (OTA, admin-gated screen so no new exposure surface):* **merge the compute roster with the full staff directory.** The app already has `getAssignableTeam()` (`/profiles?limit=500`, all active staff) and `getPayrollRoster()` (profile-holders). Show **every** staff member; anyone with no computed row renders as a **"Payroll data pending"** warning row (amber `Pill`, no ₹) instead of being absent — so the roster is the whole team and the gaps are visible, not silent. On the **detail** screen, additionally fetch `GET /api/payroll/profiles/:userId` and render an **"Essential details"** section (salary/segment/shift + bank: beneficiary / bank / account / IFSC), each missing field marked "pending" — behind whatever role/masking the owner picks.
- *Data (owner/OPS — the actual "why only one shows" fix):* create a `payroll_profiles` row (salary_amount + segment, + bank/PII if wanted) for **each** staff member, in the admin panel or via a one-time seed script (same pattern as the Point 6 RBAC seeding). Until this is done, the app will correctly show the rest of the team as "data pending" — which is the honest state, not an error.
- *Backend (optional relay):* add `?include_all_staff=true` to `/compute` that left-joins `Profiles` and returns profile-less members as `{ staff_found:true, profile:null, payable:null }`, so the app doesn't need the second directory call. Nice-to-have; the client merge covers it without a backend change.

**Effort:** client **M** (roster merge + pending rows + detail bank/essential section), OTA. Data job **S per member but manual** (dominant cost, owner/OPS). Optional `[api]` compute mode **S**.

**Decisions I need from you:**
1. **Bank/Aadhaar/PAN on the phone — yes/no, and how?** This reverses the current "no PII on the phone" rule. Recommend: show bank details (beneficiary/bank/account/IFSC) to **super_admin/master only** (not the whole admin tier), and **mask** the account number to the last 4 by default with a tap-to-reveal — and keep **Aadhaar/PAN off the phone entirely** unless you specifically need them there. Your call.
2. **The seeding: who enters the payroll profiles for the rest of the team, and with what salary/segment?** (This is the real unblock — no code makes a profile-less member show pay.) Do you want a **department default** salary/segment so a member with no explicit profile still computes, or must every member be entered individually?
3. Should a "data pending" member be **hidden** or **shown as a warning row** (recommend shown — you asked for the warning)?
4. Want the optional backend "include all staff" mode, or is the app-side merge fine?

**Priority:** **P1** — you can't run payroll for the team and it reads as broken; but note the dominant fix is a **data job (create the profiles)**, and the client work makes the gap visible + adds the details, it does not conjure salaries that were never entered.

---

## Owner relay texts (copy-paste)

**To backend `[api]` — tokenized search (Point 2):**
> "Make client/ticket/task search tokenized. Right now search matches the whole typed phrase as one block, so
> 'patel rajesh' doesn't find 'Rajesh Patel' and 'name + phone digits' finds nothing. Split the search text on
> spaces and require each word to match some field (AND of per-word OR-across-fields). Single-word searches stay the
> same. Applies to tickets, clients, tasks, leads."

**To backend `[api]` + decision — client visibility (Point 9):**
> "Decide what a normal team member should see in Clients (only their own / their team / none / whole book). If not
> 'whole book', change the client visibility so the imported unowned book is NOT shown to team members, add a
> server-checked client-view permission, and update the contract. This also needs client records to be assigned an
> owner (a data job) — otherwise team members see zero clients."

**To OPS `[ops]` — the three server switches:**
> "1) Reports: set `CGPE_REPORT_WEBHOOK_URL` (or `N8N_REPORT_WEBHOOK_URL`) + `CGPE_REPORT_SECRET`, ensure the n8n
> report workflow is live, nginx read-timeout ≥ 60 s, restart :3001.
> 2) Uploads: set DigitalOcean Spaces env (`DO_SPACES_ENDPOINT/KEY/SECRET/REGION/BUCKET_NAME`) + `BACKEND_URL`,
> restart :3001 — else claim documents land on throwaway disk.
> 3) WhatsApp: confirm the n8n WhatsApp webhooks are set and in live-send (not simulate) mode."

---

## What I recommend doing next (this session's handoff → next session)

- **Build Band 2 in order**, starting with the **report 12 s timeout fix** (a real bug, ~3 lines + tests, OTA), then
  Tasks local search, then the task-flow mitigations. These reach the team without waiting on anyone.
- **You act on Band 1 in parallel** — especially the three OPS switches (reports/uploads/WhatsApp), the client-access
  decision (privacy), and the role matrix.
- I did **not** touch `contracts/INBOX.md` (corruption risk); the relay texts above are ready for you to send.

_Nothing in this document has shipped yet — it is the triaged plan the owner asked for._
