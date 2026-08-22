# HANDOFF — CGPE Connect (Android) — Owner backlog D3/B1/D4/C2/D6 — 2026-08-22

The owner said "implement everything (D3/B1/D4/C2/D6), perfectly, take the time." All five
owner-backlog items were built, gated (tsc 0 · npm test 797 · eslint 0 errors), committed one
per phase, and pushed to `aaziko Shivam`. All new English strings were then localized in all 5
languages from owner-supplied copy. Everything is JS-only / OTA-eligible and **device-unverified**.

## Done
- **D3** (`be207a6`) — Home's day-figure boxes (Overdue / In-progress / Due-today / Follow-ups /
  Open-claims / Open-tickets = the `kpi_strip` widget) now **lead** the dashboard instead of sitting
  below the task list. Stable partition in the `widgets` memo; every other widget keeps its order.
- **B1** (`2cda2d3`) — the Master dashboard shows the **whole team in detail**: grouped Admins &
  leaders / Agents, on-duty first, each row a new `MemberDetailRow` with every real figure the server
  returned (premium MTD, clients, done, renewals %, open work, open claims) — shown only when > 0,
  never a fabricated zero. Replaced the truncated admins-only "Admins (4)" list.
- **D4** (`bf9575a`) — the Tasks tab is now **Today / This week / This month / Calendar** (default
  Calendar). Calendar = a month day-strip (opens on today, dotted where there's open work) → tap a day
  to see its tasks. Today = the shared `todayWorkloadTasks` set. Week/Month group by day. Every view
  renders the same `TaskCard`, so swipe/tap complete + reopen still work. Pure tested date helpers in
  `data/tasks.ts` (+10 unit tests).
- **C2** (`aee594c`) — clocking out before completing **8h30m** of worked time now prompts a mandatory
  reason ("early jaane ka kya reason hai?") that is sent to the server (stored + a master is notified).
  Reuses the existing Phase-50 reason Sheet and the 5-language `clock.reasonEarly` copy.
- **D6a/b/c** (`d4b0471`) — for **team members only**: (a) a leaner Home (secondary reference tiles
  sink below the actionable widgets), (b) a one-time dismissible "Your day in 3 steps" guide card, and
  (c) a full-width, prominent **Clock in** button before the shift starts.
- **i18n** (`2531484`) — 21 new keys (`tasks.view*` / `tasks.empty*` / `tasks.tomorrow` /
  `tasks.yesterday` + `guide.*`) wired into all 5 dictionaries from owner copy; parity test 111 → 132.

## Files changed
- `src/app/(tabs)/home.tsx` — D3 kpi_strip hoist + D6a team widget partition + D6b guide
  (state/effect/`HomeGuideCard`) + D6c full-width Clock-in + C2 short-shift reason pre-check + guide i18n.
- `src/screens/dashboards.tsx` — B1: `MemberDetailRow` + `byDuty`; MasterDashboard full team breakdown.
- `src/app/(tabs)/tasks.tsx` — D4: 4 time views, month strip (`TaskDayCell`), day-grouped week/month,
  informational hero stats; i18n via `t()`.
- `src/data/tasks.ts` — D4 pure helpers: `TaskView`, `weekRange`, `monthRange`, `tasksInRange`,
  `groupTasksByDay`, `todayWorkloadTasks` (todayWorkload refactored to reuse it).
- `src/data/__tests__/tasks.test.ts` — +10 D4 helper tests (now 37 in file, suite 797).
- `src/i18n/index.tsx` — 21 new keys × 5 languages (owner copy).
- `src/i18n/__tests__/dictionaries.test.ts` — parity count 111 → 132.

## Decisions made
- **C2 threshold = 8h30m** (owner-locked; matches the existing `MIN_SHIFT_MS` payroll figure). Reason
  routes to super_admin (Phase 50). No new i18n — reuses `clock.reasonEarly`.
- **D4 replaces the 5 status filters** rather than adding a second row. Overdue/in-progress tasks stay
  reachable in the Today view (it includes open-overdue); done tasks appear in their due-period views.
  Hero's 3 counts became informational (navigation is now by time view). Week = Monday-start ISO week.
- **D6d (hide advanced sections) needed NO code** — the More screen's admin group already renders only
  when `caps.manageTeam` (false for team), and preview-as-team hides it too. The sales↔ops content
  split (D1/D2) is an admin-panel config job the app already obeys via `nav.hidden`/`nav.tabs`; it was
  deliberately NOT duplicated with client department literals.
- **INBOX not edited** — it was mid-flux from sibling sessions; a plain-language relay was handed to the
  owner instead (see Next session / DECISIONS).

## Known broken / deliberately skipped
- **Device-unverified** — C2 needs a real clocked-in session; the Tasks/Home changes need a device pass.
  OTA-eligible (JS-only). No new APK cut yet.
- **Calendar view is current-month only** — no prev/next month navigation (possible follow-up).
- **D1/D2 sales↔ops split** — owner must relay to the admin panel: *"In the UI-RBAC screen, for the
  Operations role hide `leads` + `prospects`; for the Sales role hide `claims` + `tickets`."* The app
  already enforces it once set.
- **Push delivery** still needs the owner's FCM V1 service-account key on EAS (Phase 74) — unchanged.
- **"Can't reach server"** on some networks is still the MTU/IPv6 server-path issue (dual-stack `cgpe.in`
  owed by OPS), NOT an app bug — unchanged.

## Next session starts here
- Owner to decide: **cut a fresh APK** so all of D3/B1/D4/C2/D6 reach the phone for a device test,
  and/or pick the next backlog cluster (A3 attendance, B2–B5 live-location, D5 fuzzy search, E2 report).
- First command: `/boot`
- Watch out for: **D4 changed the whole Tasks screen** — the old 5 status filters are gone; if the owner
  reports "where did Overdue/Done go", they're in the Today view (open-overdue) and each task's due-period
  view (done), by design. And the Calendar strip is current month only.
