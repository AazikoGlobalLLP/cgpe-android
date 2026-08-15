# Phase 44 — Strict salary from working hours / days `[api]`+`[m]`

**Session:** `cgpe-mobile` · **Date:** 2026-08-15 · **Status:** VERIFIED — **ALREADY SATISFIED** end to end.
No `[api]` ask, no mobile build, no contract change. Owner confirmed the live formula as-is (AskUserQuestion, 2026-08-15).
Roadmap: `docs/PLAN-2026-08-14.md` §Phase 44 (Group F). Owner backlog item.

## 0. What the owner asked
> Salary must be computed **from actual working hours/days** and shown as **one amount**.
> (Rule 2: the app never multiplies — this is a backend payroll-engine formula; mobile renders the result.)

## 1. Finding (verified against real code, both trees, this session)

**Phase 44 is already shipped, live, and owner-locked** — the strict hours/days salary engine exists on the
backend (Backend **Phase 25b**, locked 2026-08-11), is wired to the live attendance store, and both mobile
payroll surfaces already render the server-computed `payable` plus the hours/days basis. **Nothing is missing to
file and nothing to build.** This is the Phase-43 / Phase-38 "verify → already satisfied" outcome.

### 1.1 The engine (pure arithmetic, owner-locked)
`cgpe-backend-main/services/payrollEngine.js` — every constant traces to a numbered row in the backend's
`docs/spec/payroll.md`; no invented numbers.

- **`base`** segment — flat full salary, no attendance proration (`payrollEngine.js:88`).
- **`day_wise`** segment — `payable = (salary_amount / working_days) × present_days` (`:99`, `:101-104`).
- **`hourly`** segment — `payable = (salary_amount / working_days / office_hours) × worked_hours`
  (`:106-111`); `office_hours` defaults to **8.5** (8h 30m, per-member, `PayrollProfile.office_hours`).
- **`working_days` = days_in_month − Sundays − holidays** (`monthCalendar`, `:47-74`) — Saturday is a working
  day; Sunday is the only weekly off; a holiday that falls on a Sunday is not double-docked.
- **Rounding** — computed at full precision, final `payable` rounded to nearest **₹1**; a multi-month range
  rounds **once** on the total (`:143`, `:178`; spec row 8).

### 1.2 The attendance inputs (real hours/days, owner-locked cutoffs)
`cgpe-backend-main/services/payrollAttendance.js` turns raw `daylogs` rows into the two figures the engine needs.
The half-day rule is **owner-approved fixed cutoffs** (spec row 15, locked 2026-08-11), decided by hours worked,
**not** scaled by shift:

| worked hours (that day) | credit |
|---|---|
| ≥ 8h | **1.0** (full day) |
| ≥ 4h | **0.5** (half day) |
| < 4h | **0** (absent) |

- `present_days = Σ dayCredit(totalWorked/3600)` → drives `day_wise` (`payrollAttendance.js:31-36`, `:44-69`).
- `worked_hours = Σ totalWorked/3600` (raw actual hours) → drives `hourly`.
- `totalWorked` is stored in **seconds** on `models/DayLog.js`, converted to hours before the cutoff.

### 1.3 Where the inputs come from (live join, correct id)
`routes/payroll.js` `buildRoster()` (`:299-366`) reads each member's **live `daylogs`** by the member's Profile
**ObjectId `_id`** (`DayLog.find({ userId: staff._id, date: {$gte,$lte} })`, `:335`) — the correct join, and it
**deliberately does not** replicate `routes/attendance.js`'s string/ObjectId calendar mismatch bug. Logs are
bucketed per calendar month so a partial month still divides by its **own** full-month `working_days`
(spec row 4). No manual entry — the figures are read from the time-tracker the owner asked to auto-read.

### 1.4 Exposure + access
Both endpoints reuse the **same** `buildRoster()` + the locked engine, so a member's self-view can never diverge
from an admin's figure — there is no second salary formula:
- **`GET /api/payroll/my-earnings?month=YYYY-MM`** — **self only**: `protect`-only, registered **above**
  `router.use(authorize('admin'))` (`payroll.js:41` vs `:84`); `user_id` is **forced** to the token identity
  (`:50`), so a client `?user_id=` is ignored and nobody reads another member's pay.
- **`GET /api/payroll/compute?year=&month=`** — **admin/super_admin only** roster; `GET /export` the same as
  `.xlsx`.

## 2. What mobile already does (renders it — zero change)
- **`src/app/earnings.tsx`** (self-view, mobile Phase 16/28) — `getMyEarnings()` (`api.ts:1989`); the header
  literally reads *"attendance-derived days/hours"*. Renders `payable` (as one amount, count-up), `present_days`,
  `working_days`, `worked_hours`, `per_day_rate`, segment label, `office_hours`. The only arithmetic is
  `absent = working_days − present_days` (a subtraction of **days**, not money) and the payable-days meter ratio
  — **no `×` on a rate anywhere** (`earnings.tsx:27-30`).
- **`src/app/payroll.tsx`** (admin roster, mobile Phase 20) — `getPayrollRoster()` (`api.ts:1960`). Per member:
  segment + `present/working days` + the server's `payable`; the roster **total** is a sum of the server's own
  per-member payables (an aggregate of computed figures, not a re-computation — `payroll.tsx:33-34`, `:125`).
- Types `PayrollRow`/`PayrollMonth` (`api.ts:1922-1942`) already carry every field; `payable` is documented
  *"Server-computed, rounded to ₹1. The app RENDERS this; it never multiplies a rate."*

## 3. Decisions
- **D-1: closed as already-satisfied — do NOT file an `[api]` ask.** The strict hours/days formula the roadmap
  said to "file the exact inputs/rounding" for **already exists, is owner-locked (Backend Phase 25b), and is
  live.** Filing a "please build a salary formula" ask would be wrong — nothing is missing. (The plan text
  predates knowledge that Backend Phase 25b had shipped it.)
- **D-2: do NOT invent an alternative formula, cutoff, or per-day rate.** The owner was shown the exact live
  formula (§1) via AskUserQuestion and chose **"correct as-is"** (2026-08-15). A future change to the cutoffs
  (8h/4h) or the working-days basis (Sat/Sun/holidays) would be a **new** `[api]` ask carrying the owner's exact
  numbers — never a mobile guess (rule 2 / rule 4).
- **D-3: no mobile build.** Both surfaces already render the server `payable` as one amount plus the hours/days
  basis. Nothing to add.

## 4. Done when
**Met.** Salary is computed server-side strictly from actual working hours/days (owner-locked 8h/4h cutoffs,
day-wise & hourly formulas, ₹1 rounding), read from the live `daylogs`, and shown as one amount on both the
self-view (`earnings.tsx`) and the admin roster (`payroll.tsx`). No `src/` change → **no gate re-run** (baseline
stands: `tsc` 0, `npm test` 467/467, lint 0 errors / 12 warnings). Remaining is only the existing carried device
check for the payroll screens against production data (not new to Phase 44).
