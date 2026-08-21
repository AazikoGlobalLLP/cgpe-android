# Owner backlog — 2026-08-21 — triaged (mobile / backend / admin / data-OPS)

Owner walkthrough after installing the push-enabled APK (`0d68ac07`, commit `ce9b1e6`). Every item below is
classified by OWNER of the fix. **`[m]`** = cgpe-mobile (this repo). **`[api]`** = cgpe-backend-main. **`[admin]`** =
cgpe-front-main-RECOVERED. **`[data/ops]`** = owner/DB/infra, no code. **`[verify]`** = must confirm against real code
before building. Nothing here is built yet — this is the triage the owner asked for.

Deploy reality (verified this session): backend deploy gap is CLOSED — `origin/main` = `10e1f76`, all Phase 41–79
endpoints live on prod (401 = live). The ticket→team_tasks mirror `cb3f9de` IS on origin/main. So most "not working"
items are NOT a deploy gap; they are real mobile-render or backend-data or config issues.

---

## A. Tasks / clock-in / progress

| # | Item | Owner | Note |
|---|---|---|---|
| A1 | Ticket "I'll handle this" → task shows in **Home/Today** but NOT on the **clock-in location screen** | **[m]** `[verify]` | Home hero and the clock-in card read different task sources. Find which list the clock-in widget queries vs Home; the ticket-mirrored `team_tasks` row is live (`cb3f9de`). |
| A2 | Tasks tab **"Today's Progress = 0 / nothing scheduled"** despite the task existing | **[m]** `[verify]` | `dueBucket`/`taskProgress` in `(tabs)/tasks.tsx` likely buckets the mirrored task as unscheduled (missing due/schedule field). Check the backend `team_tasks` shape vs the app's Today filter. |
| A3 | **Present/absent** attendance not working well | **[m]+[api]** `[verify]` | Verify `/attendance/history` data (backend sources `daylogs`) and `attendance.tsx` rendering. Could be data or render. |

## B. Master monitoring / live location / map  (the hardest cluster)

| # | Item | Owner | Note |
|---|---|---|---|
| B1 | **Master detailed breakdown** — master panel shows an overview, owner wants it in DETAIL | **[m]** | `screens/dashboards.tsx` (Master dashboard) is presentational — expand to a detailed per-member breakdown. |
| B2 | **Live button for an OFF-DUTY (not-clocked-in) person** — can we see their live location now? where/how? | **[m]+[api]+[data/ops]** | Off-duty tracking = Phase 41 (24/7 CONSENTED location). It only works if that person GRANTED always-on bg-location consent AND the bg tracker runs (needs the new native APK + their permission). "No recent location … needs consent and bg permission" is HONEST/by-design, not a bug. To actually see it: (a) person consents + grants bg permission, (b) app bg-tracker active, (c) backend serves their last point (gated to super_admin). Verify the backend endpoint returns off-duty last-location for a consented user. |
| B3 | Map can't distinguish **BREAK-time vs OUT-time** location (in-time maybe shows) | **[m]+[api]** `[verify]` | Break pins exist (Phase 52 orange via `getBreakLocations`). "OUT time" (after clock-out) has no distinct layer. Verify what the backend stores post-clock-out; add a distinct map layer/legend. |
| B4 | **Pavitra** member — nothing shows though they went out WITH clock-in | **[api]+[m]** `[verify]` | Data question first: did Pavitra's track points upload to the backend? (accuracy>100 m are dropped server-side; a session-less batch is discarded.) Then the Phase 65 roster join-by-NAME — a name mismatch would hide them. Verify backend has their points before touching the app. |
| B5 | Agent-locations shows **"1 on duty, 1 tracked"** — owner wants **ALL members + all locations** | **[m]+[api]** `[verify]` | Phase 65 already left-joins full staff into the roster. Two truths: (i) a member with NO shared location has nothing to plot (you can't show a location they never sent); (ii) the roster LIST should still show everyone. Verify why only 2 appear — is `/live-locations` returning all staff, or is the app filtering to those with points? |

**B-summary:** live/off-duty location is genuinely cross-cutting — backend endpoint + mobile consent/render + a device
running the bg tracker (new APK) + each person's consent. It is NOT a one-file mobile fix.

## C. Clock-in / break / clock-out flow

| # | Item | Owner | Note |
|---|---|---|---|
| C1 | **Break** button → keyboard does not appear (reason Sheet) | **[m]** | `autoFocus`/focus-on-mount bug in the break-reason `Sheet` TextInput (Phase 52). Mobile-only fix. |
| C2 | **Clock-out** doesn't ask a reason when the shift is short (owner: "< [X] hours → ask reason") | **[m]** | Phase 50's clock-out reason PROMPT UI was the documented remaining mobile piece (backend reason endpoint already shipped, Backend Phase 64). Wire the prompt in `home.tsx`. Confirm the hour threshold with owner (earlier spec = 8h30m break gate + 15-min early-clock-out buffer). |

## D. Roles / navigation / cleanup

| # | Item | Owner | Note |
|---|---|---|---|
| D1 | **Role-based sections** — operational person must NOT see sales (leads/prospects); sales must NOT see operational (claims/tickets) | **[admin]+[api]+[m]** | Mobile ALREADY honors `nav.hidden`/`nav.tabs`/`more_sections` per department (Phases 10/26). So this is mainly a CONFIG job: set the per-department UI-RBAC in the **admin panel** (writes `PUT /rbac/app-ui/:roleKey`), backend enforces module access. Verify leads/prospects/claims/tickets are all gateable modules; then it's data, not app code. |
| D2 | **Remove Clients section** for team members; global search shows a client ONLY when searched (no full client book to team); global search includes everything | **[m]+[api]** | Hide the Clients tab per-department (config, D1). "Only searched clients" = mobile search UX + the client list endpoint scope. Global search "include everything" = extend `search.tsx` collections. Partly config, partly mobile, partly backend scope. |
| D3 | **Move "Overdue & quick-info"** options above, in the team-members screen | **[m]** | UI reorder in `team/index.tsx`. Mobile-only. |
| D4 | **Tasks in CALENDAR view** with toggles (today / this week / this month / calendar), default = calendar | **[m]** | New task-view feature in `(tabs)/tasks.tsx` (+ maybe reuse `calendar.tsx` date-spine). Mobile-only, sizeable. |
| D5 | **Typo-tolerant / fuzzy** global + master client search | **[m]+[api]** | `search.tsx` already has a client-side fuzzy scorer for leads/claims/tasks; clients/tickets are SERVER-searched, so typo-tolerance there = backend fuzzy/`$text`/Atlas-search. Mixed. |
| D6 | **Clean, simple UX for non-tech team members** — remove clutter, easy adoption without hesitation | **[m]** | Broad mobile design pass (spec-lock with the owner on exactly what to hide/simplify — undefined-adjective request, needs numbers/criteria first). |

## E. Data / OPS / reports  (NOT mobile code)

| # | Item | Owner | Note |
|---|---|---|---|
| E1 | **Remove test data** from EACH AND EVERY DB collection | **[data/ops]+[api]** | Backend/owner DB operation. ⚠️ Data-safety: this is destructive and touches the LIVE book — must be done deliberately by whoever owns the DB, with a backup first. NOT a mobile task; the app fabricates no data (verified — `mock.ts` is empty by policy). |
| E2 | **Generate report** — no report generates anywhere | **[api]+[data/ops]** `[verify]` | `reports/monthly` is live (401) but on-demand `POST /reports/pdf` needs the droplet env `CGPE_REPORT_RENDER_URL` + `CGPE_REPORT_SECRET` + the n8n `cgpe-report-render` template. Almost certainly the render webhook/env is unset on prod, not an app bug. Verify env + n8n; the app's `generateReport` returns null honestly on failure. |

---

## Owner-facing summary (who does what)

- **Mobile (my work), buildable now:** A1, A2, B1, B3(render), C1, C2, D3, D4, D6, and the app-side of B5/D1/D2/D5. Several
  are real features/phases, not quick fixes — especially D4 (calendar tasks), D6 (UX overhaul), B1 (master detail).
- **Backend (cgpe-api), owner relays:** A3(data), B2/B4/B5 endpoints, B3(data), D5 server-fuzzy, E2 report env, and enforcing D1.
- **Admin panel (cgpe-admin):** D1 — set each department's visible modules in the UI-RBAC screen (this is the lever that
  makes "operational hides sales / sales hides operational" real; mobile already obeys it).
- **Data/OPS/owner:** E1 (test-data cleanup — destructive, do with a backup), E2 report env, B2 off-duty consent + the
  new native APK, and the still-pending **FCM key upload** for push delivery.

## Not-yet-decided (needs owner spec-lock before building)
- C2 exact hour threshold for the clock-out reason.
- D6 exact list of what to hide/simplify for team members.
- B2/B5 owner's expectation vs the platform reality that a location can only be shown if the person consented + shared it.
