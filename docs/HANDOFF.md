# HANDOFF — CGPE Connect (Android) — Band 2 #4: Calendar month grid — 2026-08-24

## Done
- **The Tasks-tab "Calendar" is now a real month grid, not a one-line day strip.** You get a proper
  7-column month with a ‹ August 2026 › header, back/forward arrows to any month (a task next month is
  finally reachable), and a one-tap **Today** button when you've paged away. Every day shows **how many
  tasks** it carries (a busy day and a one-task day now look different — before, both showed the same
  dot), and a day whose work is all finished is coloured green. Tap a day to list its tasks below, with a
  heading naming the day.
- **The create-gating from Band 2 #3 is untouched** — a team-tier advisor still sees no "Add task" FAB or
  empty-state button; entitled tiers still do.
- The date maths is pure and unit-tested (`monthMatrix`, `taskCountsByDay` — 14 new tests): fixed 6×7 grid
  so the height never jumps between months, correct across year-rollover (a January grid's leading days are
  the prior December) and leap Februaries, per-day tallies with overdue = open-past-day only.
- Gates green: `tsc` 0 · `npm test` **891** (+14) · `eslint` 0 new (the lone i18n warning at :647 is a
  pre-existing ref-cleanup one, untouched). Commit `c3c3537`, pushed `aaziko/Shivam`. OTA-eligible;
  **device-unverified**.

## Files changed
- `src/data/tasks.ts` — **NEW** pure `monthMatrix(anchor, weekStartsOn=0)` → `{year,month,weeks:MonthCell[][]}`
  (fixed 6×7=42 cells; leading/trailing days flagged `inMonth:false`; `ms` = local midnight, same key the
  tallies use; `inMonth` compares year AND month for the rollover). **NEW** `taskCountsByDay(list, now)` →
  `Map<number, DayTally{total,open,done,overdue}>` (undated excluded; `overdue` = open past-day only).
  Types `MonthCell`, `DayTally`.
- `src/data/__tests__/tasks.test.ts` — **+14** tests (monthMatrix structure/start-day/contiguity/in-month/
  year-rollover/leap; taskCountsByDay tallies/all-done/overdue-open-only/key-parity).
- `src/app/(tabs)/tasks.tsx` — removed the rail (`monthDays`/`openByDay`/`stripOffset`/`TaskDayCell`);
  added `cursor{y,m}` state + `shiftMonth`/`goToday`/`pickCell`, `grid`/`countsByDay` memos, `todayMs`
  **state** (re-stamped on focus), and the **`MonthGrid`** + **`GridDay`** components. `MONTHS_FULL` const.
- `src/i18n/index.tsx` — English `tasks.emptyCalendarBody` "strip above" → "calendar above" (source only).
- `docs/spec/BAND2-4-calendar.md` — **NEW** spec (decisions + the review's two fixes + copy-debt).

## Decisions made
- **Zero new i18n keys.** The "Today" pill reuses `tasks.today`; month/weekday names are English by design
  (consistent with `fmtDate`/`fmtDay`, which render dates in English in every language). No dictionary
  count bump, no 5-language copy owed for the grid itself.
- **Paging preserves the selected day; it does not auto-select.** Browse the grid, tap to change the day
  list below. The day heading names the selected day, so a "grid shows September, list shows 24 Aug" state
  is never ambiguous.
- **Sunday-first grid** (matches the app's existing Sun-first `WD` header), parameterised (`weekStartsOn`).
- Two low-severity findings from a 4-dimension adversarial review were fixed (maths + regressions came back
  clean): `todayMs` is now focus-refreshed state (a `[]`-memo froze "today" across midnight while the
  header advanced); the `emptyCalendarBody` English copy was de-staled.

## Known broken / deliberately skipped (owner-owned)
- **`emptyCalendarBody` in gu / hi / hi-en / gu-en still says "strip".** English is fixed; the four
  translations owe one human line each (drop the "strip" noun) — machine translation is forbidden, so it's
  flagged, not guessed. Not a functional break.
- **`can_assign_task_to_others` flag wiring** — deferred to Band 2 #8 (role toggles), after the owner's
  role matrix. This phase kept the Band 2 #3 `caps.assignTasks` gating; it did not wire the separate flag.
- **Arbitrary in-app due-date picker / "create task for THIS member" deep-link** — optional (Point 4), not
  built.
- The "today" ring advances on the next tab focus, not live at the midnight tick (acceptable; the old rail
  had no marker at all).
- INBOX untouched (additive client behaviour, no contract change).

## Next session starts here
- Phase: **Band 2 #5 — Client Search in More** (owner backlog Point 10, P2, OTA). A prominent global
  "Search" tile already exists in More; the ask is a **client-only** search (one request per keystroke, not
  three) that's faster. Plan: add an optional `scope=clients` param to `search.tsx` — when set, fire only
  the clients request and relabel the chrome "Find a client"; point the More tile at it. It inherits Point
  9's scope automatically. Authoritative worklist: `docs/OWNER-BACKLOG-2026-08-24.md`.
- First command: `/boot`
- Watch out for: `search.tsx` is the shared scorer's home (`lib/searchScore`, also used by Tasks-tab search
  and `data/tasks.ts`); don't perturb the global-search path — add a scoped MODE alongside it, don't replace
  it. Confirm with the owner whether they want client-only or clients-first-global, and whether to keep both
  More entries (`[decision]` in Point 10).
