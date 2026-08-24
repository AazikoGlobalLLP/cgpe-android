# Band 2 #4 — Calendar month grid (owner backlog Point 4, P2 / one P1 bit, OTA)

**Built 2026-08-24.** Client-only, OTA-eligible — the backend needs no change (every task endpoint is
deployed; `docs/OWNER-BACKLOG-2026-08-24.md` Point 4 verified this). Reuses the create-gating shipped in
Band 2 #3 unchanged.

## What was wrong

D4 (2026-08-22) gave the Tasks tab four time views — Today / This week / This month / **Calendar**. The
Calendar was a **single-month horizontal day RAIL**:

- **one month only** — no prev/next, so a task in a future (or past) month was unreachable from any
  Tasks view;
- a **binary dot** — a 1-task day and a 6-task day looked identical (the count was computed but only
  spoken in the a11y label);
- no distinction for a day whose work is all **done**.

## What changed (client, OTA)

The rail is replaced by a real **7-column month grid**.

### Pure maths — `src/data/tasks.ts` (unit-tested, injectable, no React)

- **`monthMatrix(anchor, weekStartsOn = 0)`** → `{ year, month, weeks: MonthCell[][] }`.
  - A **fixed 6 × 7 = 42-cell** grid, so the grid never changes height when you page between a 5-week
    and a 6-week month (worst case leading 6 + 31 days = 37 ≤ 42). Leading days from the previous month
    and trailing days from the next fill the rectangle and are flagged **`inMonth: false`**.
  - Weeks start on **Sunday by default** (matches the app's existing Sun-first `WD` header on the
    Tasks/Calendar screens). `weekStartsOn = 1` gives a Monday-first grid (parameterised, tested).
  - `MonthCell.ms` is **local midnight** — the exact key `taskCountsByDay` / `tasksInRange` bucket on, so
    a cell's tally is `counts.get(cell.ms)` with no re-derivation. India has no DST, so cells are exactly
    one day apart. `inMonth` compares **year AND month** so a January grid's December leading cells (prior
    *year*) are correctly out-of-month.
- **`taskCountsByDay(list, now)`** → `Map<number, DayTally{ total, open, done, overdue }>`.
  - Buckets tasks by due calendar day; undated/invalid excluded (same rule as `tasksInRange`).
  - `overdue` counts **OPEN** tasks on a day strictly before `now` only — a past day that is fully done
    is not overdue.
  - The grid reads `.total` for the count, `total > 0 && open === 0` as an all-completed day, and
    `.overdue > 0` for the danger tint.

14 new tests in `src/data/__tests__/tasks.test.ts` (fixed `NOW` = Tue 18 Aug 2026), covering: 42-cell
invariance, Sunday/Monday start, contiguity, in-/out-of-month flags, **year rollover**, leap vs common
February, per-day tallies, all-done days, overdue = open-only, and key-parity between a grid cell's `ms`
and a tally key.

### UI — `src/app/(tabs)/tasks.tsx`

- State: **`cursor {y, m}`** = the displayed month (lazy-initialised to the current month), paged by
  `shiftMonth(±1)` (JS `Date` normalises the year boundary). `selDay` (unchanged) = the tapped day whose
  tasks list below. `grid`/`countsByDay`/`todayMs` are memos; every `new Date(...)` lives in a memo or a
  `useState` initialiser, **never the render body** (the `react-hooks/purity` rule is on).
- **`MonthGrid`** — header `‹  Month Year  ›` (two `IconBtn` chevrons whose a11y labels name the
  *destination* month), a **"Today"** pill shown only when paged away from the current month, a weekday
  header row, and six week-rows of **`GridDay`** cells.
- **`GridDay`** — the date, and when the day carries tasks the **per-day count**, tinted so the day's
  state reads at a glance: **success = every task done** (the distinct all-completed marking), danger =
  open work overdue, accent = open work not yet due. Selected day fills primary; today wears a thin
  primary ring (constant hairline border so the ring never shifts the box). Spill-over cells from
  adjacent months are dimmed (`opacity 0.35`) but still tappable — tapping one follows the grid to that
  month (`pickCell`).
- A compact **day heading** (`dayHeading(selDay) · count`) sits between the grid and the selected-day
  list — this names which day the list is for, which also resolves the one decoupling below.

## Decisions

- **Paging preserves the selected day; it does not auto-select.** Page to another month and `selDay`
  stays put (the grid shows no highlight in the new month until you tap a day). The day heading names the
  selected day, so "grid shows September, list shows 24 Aug" is never ambiguous. This matches the
  mobile-calendar convention (browse the grid, tap to change the detail).
- **Zero new i18n keys.** The "Today" pill reuses `tasks.today`. Month names (`MONTHS_FULL`) and weekday
  letters (`WD`) are **English by design** — consistent with `fmtDate`/`fmtDay`, which render dates in
  English in every language across the whole app; dates are not localised anywhere. A11y labels (grid
  cells, nav buttons) are English and include those English month names. No dictionary or parity-count
  change, so no 5-language copy debt is incurred.
- **Create-gating reused, not re-authored.** `canCreateTask` (Band 2 #3) still gates the `<Fab>` and
  every empty-state "Add task". This phase did not touch it.

## Adversarial review (4-dimension workflow → per-finding verify)

The maths and regression dimensions came back **clean** (0 findings). Two **low**-severity findings were
confirmed and both were fixed:

1. **`todayMs` staleness across midnight.** It was a `useMemo(…, [])`, so the "today" ring / `isCurrentMonth`
   / "Today" pill froze at first mount — and since the hero's `todayWorkload(list)` re-reads the clock on
   each focus refetch, the calendar could disagree with the header after midnight on a tab that stays
   mounted. **Fixed:** `todayMs` is now **state re-stamped on every tab focus** (identical value → React
   bails, so it is a no-op on the same day), keeping the ring and header in step.
2. **`emptyCalendarBody` said "strip above"** — stale after the rail became a grid. **Fixed in English**
   (the source): "strip above" → "calendar above". The four translated strings (gu/hi/hi-en/gu-en) still
   say "strip" and **owe a human copy pass** — machine translation is forbidden, so this is flagged as an
   owner copy-debt item, not guessed. No functional break (the empty state correctly points up at the
   grid either way).

## Known minor nit (owner copy-debt)

- `tasks.emptyCalendarBody` in **gu / hi / hi-en / gu-en** still carries the old "strip" wording. English is
  corrected; the four translations need one human-supplied line each (drop the "strip" noun, e.g.
  "calendar above").

## Out of scope (deferred, per the backlog)

- `can_assign_task_to_others` flag wiring → Band 2 #8 (role-toggles), after the owner's role matrix.
- An arbitrary in-app due-date picker and a "create task for THIS member" deep-link → optional, not built.

## Gates

`tsc` 0 · `npm test` **891** (+14) · `eslint` 0 on changed files. Device-unverified (OTA-eligible) —
the calendar grid, month paging, per-day counts and all-done marking need an on-device pass per
`TESTING_GUIDE.md`.
