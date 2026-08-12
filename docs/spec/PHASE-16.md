# SPEC LOCK — Phase 16: "My earnings" (attendance-derived salary)

Requested 2026-08-10. Status: **BUILT 2026-08-12 (v1, self-scoped).** The backend blocker cleared —
`GET /api/payroll/my-earnings` shipped (backend Phase 28) — and the self-view screen is now live.

---

## BUILT 2026-08-12 — against the shipped `GET /api/payroll/my-earnings`

`cgpe-api` shipped the one thing this phase was blocked on (backend Phase 28, `contracts/api.md`
§`/api/payroll`, INBOX 2026-08-12 `→ cgpe-mobile`): a **`protect`-only, self-scoped** read that forces
`user_id` to the token identity. Every user this spec targets (advisor/learn_advisor/leader/payroll_staff)
can now read **their own** pay; nobody can read anyone else's. Built the self-view against it.

**Files (6):** `src/data/api.ts` (+`getMyEarnings` + `MyEarnings` type; reuses the Phase-20 `PayrollRow`/
`PayrollMonth`), `src/app/earnings.tsx` (new route), `src/app/(tabs)/more.tsx` (+1 ungated "My earnings"
row in the Account group), `src/app/attendance.tsx` (+1 link card to `/earnings`), new
`src/data/__tests__/api-earnings.test.ts` (10 cases). `src/ui/characters.tsx` — see D-3.

**Gates:** `tsc` 0, `npm test` **360/360** (+10), lint pending/at baseline. Device check carried (below).

**The app never multiplies (verified).** Every money figure — `payable`, `per_day_rate`,
`salary_amount` — is the server's, rendered verbatim via `inr()`. The only on-device arithmetic is
`absent = working_days − present_days` (a subtraction of **days**, not money) and the payable-days ratio
for the progress meter. `grep -n '\*' src/app/earnings.tsx` finds no `*` on a rate. AC met.

### Deviations from the 2026-08-10 UI lock — all forced, none cosmetic

- **D-1 — v1 is the `/compute` aggregate, not the richer proposed body.** The backend returned the same
  `RosterRow` shape as the admin `/compute` (a **monthly aggregate**: `payable`, `salary_amount`,
  `per_day_rate`, `office_hours`, and one `months[]` entry `{working_days, present_days, worked_hours,
  per_day_rate, payable_precise}`), **not** the `days.{present,half,absent,holiday,weekly_off}` +
  `breakdown[]` + `provisional`/`as_of` body proposed in §"Proposed backend contract". They chose this
  deliberately ("guarantees your self-view is byte-identical to the admin figure … file it and we'll add"
  — INBOX). **Consequence:** the locked **per-day `<Spine>` list** (UI-lock #5 + interaction (d), "tap a
  day to see its in/out times and contribution") has **no v1 data source** and is **not built** — v1
  carries no per-day rows, and a per-day rupee figure would require the forbidden multiply. The owner
  chose (2026-08-12) to **ship the v1 aggregate now** rather than re-block on the richer body. If the
  per-day breakdown is wanted later, re-file `breakdown[]` + the days split to `cgpe-api`.
- **D-2 — KPI strip: "Overtime h" → "Worked hours".** UI-lock #4 locked four chips: Present · Payable
  days · Absent · **Overtime h**. v1 returns no overtime split (only total `worked_hours`), so the fourth
  chip shows **Worked hours** instead. Present/Payable-days/Absent are unchanged (Absent is the day
  subtraction above). The "so far this month" **provisional pill** (UI-lock, state matrix) IS built —
  inferred client-side when the selected month is the current one (index 0), not from an `as_of` field.
- **D-3 — expressive states use `EmptyState`, not `characters.tsx`.** UI-lock #10 said "revive
  `src/ui/characters.tsx`" — but that file was **deleted in Phase 14's dead-code sweep** (it no longer
  exists). Rather than reconstruct 7 illustrations from scratch (invented work), the empty/error/
  month-empty states use the app-wide `EmptyState`, exactly as `payroll.tsx` (Phase 20) does — the
  consistent idiom. The locked "concerned pose only after the 2nd retry" nuance was tied to the
  character; with `EmptyState` the error shows on first failure, matching every other screen.

### Three response states, told apart (the honesty core)

`getMyEarnings` uses low-level `req()` (not `tryReal`, which would collapse a `data:null` body into the
whole envelope): **`ok`** (a real row) · **`empty`** (HTTP 200 `data:null` → "no pay profile yet", **no
banner** — an explicit empty state, not an outage) · **`error`** (5xx/network/shape → retryable error +
`<HealthBanner/>`, except the 401/403/404/501 answer statuses which raise no banner). A month with a real
profile but all-zero figures shows "No attendance recorded for <month>", **not ₹0** — gated on
`payable === 0 && present === 0 && worked === 0` so a `base`-segment flat salary with no present days
still shows its real figure. All four pinned in `api-earnings.test.ts`.

### Still carried (device-only, per §ACCEPTANCE + §RISKS)
Reconcile ≥3 real people's months against the payroll sheet by hand before wide trust (highest-trust-cost
bug). Light/dark + 390 px render on a handset. **Phase 1 clock-in** remains the stated hard prerequisite
(handset-verification still outstanding) — a clock-in silently dropped on a bad connection would
under-count present days and thus under-state pay.

---

## UPDATE 2026-08-11 — re-evaluated against the backend's real code; blocker moved, not cleared

The two things this spec asked `cgpe-api` to **build** now both **exist** (backend Phase 25 payroll
cluster, 25a/b/c). But they are gated admin-only, so a mobile self-view still cannot read them. Verified
against the producer's code, not the INBOX payroll notices (those are addressed to `cgpe-admin`, and
mobile has been burned by wrong `[api]` tags on Phases 6/9/10/11/12):

- **Pay field now EXISTS** — `models/PayrollProfile.js` / `payroll_profiles.salary_amount` + `segment`
  (`day_wise|hourly|base`). Blocker #1 below ("no pay data anywhere") is **stale**.
- **Server-side computation now EXISTS** — `services/payrollEngine.js` `computeRangeSalary()` returns a
  rounded `payable` **number** (exactly the "compute server-side, app never multiplies" shape §Consequence
  demanded), reached via `GET /api/payroll/compute`.
- **BUT admin-only, so mobile is still blocked.** `routes/payroll.js:22-23` wraps the whole router in
  `router.use(protect); router.use(authorize('admin'))`; `authorize` (`middleware/auth.js:73`) 403s
  anyone not `super_admin`/`admin`. So every user this spec targets (advisor / learn_advisor / leader /
  payroll_staff) gets **403** on `/compute`. `?user_id=` only picks which member an *admin* computes — it
  is not a self-scope. `grep -i earnings` over the whole backend = **0 hits**: the `GET /api/payroll/my-earnings`
  proposed in §"Proposed backend contract" was never built, and `computeRangeSalary()` is reachable ONLY
  through the two admin routes (`/compute`, `/export`). What landed is the *manager-views-salary* surface
  this spec's §OUT OF SCOPE explicitly refused, and it belongs to `cgpe-admin`.

**The narrowed ask (filed to `cgpe-api` in `../contracts/INBOX.md`, 2026-08-11):** one self-scoped read —
`GET /api/payroll/my-earnings` (`protect` only, own records only, same posture as `/time-tracker/stats`),
**or** a self path reusing `buildRoster()` with `user_id` forced to `req.user.user_id`, lifted out of the
admin gate. No new math — same engine, same numbers.

**Two of the original blockers below are now moot for this path** (recorded so the design doesn't reopen
them): the "app must not multiply" rule is satisfied because the server returns the number; and blockers
#3/#4/#5 (ambiguous present-days, self-writable `/work-settings`, unscoped `/attendance/user/:id`) are
sidestepped because the engine reads the member's own `daylogs` by their `_id` server-side and trusts no
client figure. The **only** thing left is scoping the READ to the caller — which is strictly safer than the
existing admin `/compute` (caller sees only themselves).

**Not built this session, deliberately:** shipping the locked UI against a non-existent endpoint would be
untested dead code that can only ever render its error/empty state; and §RISKS makes unfixed clock-in
(Phase 1) a hard prerequisite regardless. Phase 16 resumes the moment a self-scoped read exists.

*(The rest of this spec is the original 2026-08-10 lock, preserved. Blockers #1 and #2 in "What does not
exist" are superseded by this update; the UI lock, state matrix, and acceptance criteria still stand.)*

## Scope, as read

> "…jahan pe logged in user ya team member ko **unka** total present aur attendance ke according
> **unke** salary ki amount unhe batani hai"

Read as **self-view**: each signed-in person sees *their own* present-day count and *their own*
earned amount. A manager viewing a subordinate's salary is **out of scope** — see below. If that
reading is wrong, say so, because it changes the backend work substantially.

---

## What already exists (verified against `../contracts/api.md`)

| Available | Detail |
|---|---|
| `GET /api/time-tracker/stats` | `{ totalDays, totalWorked, totalBreak, averageWorkedPerDay, averageBreakPerDay }` — **in seconds**, own records only, `startDate`/`endDate` apply only when *both* are given |
| `GET /api/time-tracker/history` | `DayLog[]`, own records only — explicitly **no admin override** |
| `GET /api/attendance/history` | `Attendance[]`, hard-scoped to own `user_id` |
| `GET /api/work-settings` | `{ daily_hours:8, weekly_hours:48, overtime_threshold:9, late_threshold:15, early_out_threshold:15, break_duration:60 }` |
| `GET /api/holidays` | Holiday calendar exists |

## What does **not** exist — this is why the phase is blocked

1. **No pay data anywhere.** Grepping `contracts/models.md` and `api.md` for
   `salary|payroll|wage|ctc|per_day|stipend` returns only the **role name** `payroll_staff`.
   No model carries a rate. Nothing to multiply by.
2. **`/api/leaves/*` is a stub.** `GET` always returns `[]`; `POST` returns **201 without persisting
   anything**. So "absent" and "on approved leave" are indistinguishable — any formula that treats
   them differently has no data source.
3. **"Present days" is ambiguous server-side.** `routes/attendance.js` merges *two different
   collections* per calendar day — `attendance` (legacy, historical, read-only) and `daylogs` (live,
   the only one written). Only the backend can define one authoritative count.
4. **`GET /api/work-settings` is `protect`-only.** Any advisor can rewrite `daily_hours` and the
   thresholds. If pay derives from those, that is a self-service pay raise.
5. **`GET /api/attendance/user/:userId` has no ownership or role check at all** — any authenticated
   user can read any other user's raw attendance. This is the *only* cross-user attendance read, and
   it is why manager-view is out of scope until it is fixed.

> **Consequence: the amount must be computed server-side and delivered as a number.**
> The app must not multiply anything. Points 3, 4 and 5 each independently make a device-side
> calculation wrong or abusable.

---

## INPUT REQUIRED from the product owner

The UI below is buildable today. The figure is not, until these are answered. Please reply with
values — they become rows in this table and then the backend contract.

| # | Question | Why it changes the build |
|---|---|---|
| 1 | Pay basis: fixed **monthly**, **per-day**, or **per-hour**? | Decides whether hours or days is the primary metric on screen |
| 2 | If monthly — divide by calendar days, a fixed **26**, or that month's actual working days? | Changes the per-day figure by up to 20% |
| 3 | What counts as a **half day**? (a worked-hours threshold? a late arrival?) | Adds a third state to every day cell |
| 4 | Do `late_threshold` / `early_out_threshold` (15 min each) deduct pay, or are they reporting only? | Decides whether the day list needs a deduction column |
| 5 | Is overtime past `overtime_threshold` (9 h) paid? At what multiple? | Adds an overtime row + its own metric |
| 6 | Are weekly offs and holidays **paid**? | Decides whether they count toward payable days |
| 7 | Paid-leave allowance per month/year? | Blocked anyway — `/api/leaves` persists nothing. Flagging that this needs building first |
| 8 | Deductions (PF / ESI / TDS / advances) — shown, or is this **gross only**? | Gross-only is far simpler; a net figure implies a payslip |
| 9 | Pay cycle: calendar month, or e.g. 26th → 25th? | Decides the month picker's boundaries |
| 10 | Does the person see their **rate**, or only the **amount**? | A visible rate is a sensitive field with its own access rule |
| 11 | Is the figure "**earned so far** this month" (live, moves daily) or "**last finalised** payslip"? | Live needs a clear as-of stamp; finalised needs a lock/approval step |

---

## SPEC LOCK — the UI

Extends the **existing** token set in `src/theme/theme.tsx`. No new colour, size, spacing or motion
value is introduced. All values below are already in the codebase.

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | "premium" | The existing palette only: `card #ffffff` on `bg #f7f9fc`, radius **18**, padding **16**, inter-card gap **24**, `shadow(c,1)`. The **one** gradient (`gradientBrand`, 135°) is reserved for the hero figure, matching `TierHero` — nowhere else on the screen | The app already has a premium language; a second one reads as a different app. `screens/dashboards.tsx` establishes "one sanctioned gradient" |
| 2 | "interactive" | Four concrete interactions, all from existing components: (a) month `<Segmented>` / horizontal month strip; (b) `useCountUp` on the headline amount, ~30 fps JS thread; (c) `<Meter>` for payable-days progress; (d) tap a day on the `<Spine>` to expand its in/out times and that day's contribution. No new gesture vocabulary | `useCountUp`, `Meter`, `Spine`, `Segmented` all ship today. `swipe.tsx` is deliberately *not* used — swiping a pay row implies an action there isn't one |
| 3 | Headline figure | `<Metric>` at `font.display` **32**, weight 900, `tabular-nums`, `-0.8px` tracking, formatted with `inr()` from `lib/format.ts` (U+00A0 spaces) | Matches the hero metric spec in `ADMIN_PANEL_SYNC.md` §3.6.2 and the app's existing money formatting |
| 4 | Supporting metrics | One `<KpiStrip>` of 4 `KpiChip`s: **Present** · **Payable days** · **Absent** · **Overtime h**. Tone `success` when non-zero for Present, `danger` for Absent, else `neutral` | `KpiStrip` + tone rules already exist; "never show a zero that merely means not-loaded" is the established rule |
| 5 | Day-by-day list | `<Spine>` / `<SpineRow>` — the app's signature date layout, already used by attendance, calendar, notifications | Attendance history is already a spine; a table here would be a second idiom for the same data |
| 6 | Month navigation | Horizontal month strip, last **12** months, current month selected on mount, `Appear` staggered entry | 12 matches the `Sparkline` horizon used on `commissions.tsx` |
| 7 | Where it lives | New route `src/app/earnings.tsx`, reached from `(tabs)/more.tsx` under the existing **"Me"** group, and from a link row on `attendance.tsx`. **No new tab** | A new tab needs `TAB_META` + `ORDER` edits and a 6th slot the bar does not have |
| 8 | Currency + rounding | `inr()` → whole rupees, no paise, Indian grouping | `lib/format.ts` is already the only money formatter in the app |
| 9 | Motion | `motion` scale from `theme.tsx` only, via `ui/motion.tsx`'s `Appear` + `usePressScale`. Honours the existing `useReducedMotion()` (AccessibilityInfo subscription) | The project already has a reduced-motion implementation; a second would drift |
| 10 | The character for expressive states | Revive `src/ui/characters.tsx` — 7 illustrations already built from `View` + `borderRadius` + `LinearGradient`, currently **dead code with zero importers** | `react-native-svg` is deliberately not a dependency. This file was built for exactly this and costs nothing to bring back |

### State matrix (React Native — adapted, no hover/cursor)

| State | Locked behaviour |
|---|---|
| default | Tokens above |
| pressed | `usePressScale` from `ui/motion.tsx`; ≤120 ms |
| disabled | Month chips for months before joining date: `opacity 0.4`, `accessibilityState={{disabled:true}}` |
| loading | `<SkeletonCard>` shaped like the hero + 4 chip skeletons + 6 spine-row skeletons. **Layout must not shift** when data lands |
| empty | No attendance for the month: `characters.tsx` idle pose, *"No attendance recorded for March"*, action **"Open attendance"** |
| error | `characters.tsx` concerned pose (only after the **second** failed retry, not first paint), *"We couldn't load your earnings"*, actions **Retry** + **Open attendance**, raw error behind a collapsed disclosure |
| degraded | If `useDataHealth().degraded`, the empty state says *"could not load"*, never *"nothing here"* — the app-wide rule from `CLAUDE.md` convention 4 |
| provisional | While the month is still running, a `<Pill>` reading **"so far this month"** beside the headline. A live figure that looks final is the failure mode this screen most needs to avoid |

### Accessibility floor
Touch targets ≥ 44×44. Every metric carries an `accessibilityLabel` that reads the full sentence
("Payable days, 22 of 26") — the character is never the only carrier of meaning. Amount changes
announced via `AccessibilityInfo.announceForAccessibility`. Both light and dark palettes, since
`ThemeProvider` follows the OS scheme.

---

## Proposed backend contract (for `cgpe-api` — needs their agreement)

```jsonc
// GET /api/payroll/my-earnings?month=2026-03      Bearer, own records only
{ "success": true, "data": {
  "month": "2026-03",
  "cycle": { "from": "2026-03-01", "to": "2026-03-31" },
  "days": { "present": 22, "half": 1, "absent": 2, "holiday": 4, "weekly_off": 5, "payable": 22.5 },
  "hours": { "worked": 176.5, "overtime": 4.0 },
  "amount": { "gross": 27500, "deductions": 0, "net": 27500, "currency": "INR" },
  "rate": { "visible": false },              // per INPUT #10
  "provisional": true,                        // month still running — per INPUT #11
  "as_of": "2026-03-24T11:02:00.000Z",
  "breakdown": [ { "date": "2026-03-01", "status": "present", "worked_h": 8.2, "amount": 1250 } ]
} }
```

`amount` is computed **server-side**. The app renders it and never multiplies.

---

## OUT OF SCOPE (will NOT build)

- **A manager viewing a team member's salary.** The only cross-user attendance endpoint
  (`GET /api/attendance/user/:userId`) has *no access control whatsoever*; building a salary view on
  it would let every advisor compute every colleague's pay. Needs a scoped endpoint first.
- Payslip PDF export, or anything presented as a statutory document.
- Editing attendance to correct pay. Read-only screen.
- Deductions, if the answer to INPUT #8 is "gross only".
- Any device-side salary arithmetic. See the five blockers above.

## ACCEPTANCE CRITERIA (binary, testable)

- [ ] For a month with known attendance, the displayed present / payable / absent counts equal what
      payroll computes by hand for the same person and month.
- [ ] The displayed amount equals `data.amount.net` from the API, byte-for-byte after `inr()` — the
      app performs no multiplication (verifiable by grep: no `*` on a rate in `src/app/earnings.tsx`).
- [ ] With the backend unreachable, the screen shows the error state with a working Retry, and the
      HealthBanner is raised.
- [ ] A month with no attendance shows the empty state, not `₹ 0`.
- [ ] A still-running month shows the "so far this month" pill; a closed month does not.
- [ ] Renders correctly in both light and dark, and at 390 px width.
- [ ] Every value used in `earnings.tsx` exists in `src/theme/theme.tsx` — no literal hex, no ad-hoc size.
- [ ] `npx tsc --noEmit` exits 0; no new lint errors.

## RISKS

- **Wrong pay shown to staff is the highest-trust-cost bug in the app.** Cheapest check: before it
  ships, reconcile three real people's months against the payroll sheet by hand.
- **Phase 1 is a hard prerequisite.** Clock-in currently returns `{ok:true}` on network failure, so
  attendance already has silent holes; salary would quietly under-pay whoever clocked in on a bad
  connection. Do not build this on top of unfixed clock-in.
- **The two-collection merge** (`attendance` vs `daylogs`) may make historical months disagree with
  live ones. Cheapest check: ask `cgpe-api` to return `days.source` per row during development.
