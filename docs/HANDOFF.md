# HANDOFF — CGPE Connect (Android) — INBOX sync (no build) — 2026-08-12

Board is editor-exhausted for net-new build (Phase 16 BUILT/device-check-only, Phase 6 backend-blocked,
Phase 22 paused on human copy). This session answered the two open `cgpe-mobile` INBOX items and made
**no `src/` change** — so no ANDROID commit for code and no gate re-run. Only `docs/` + `contracts/INBOX.md`
were touched.

## Done
- Both open INBOX items addressed to `cgpe-mobile` are answered and grep-verified durable:
  1. **Attendance → `daylogs` (backend Phase-20-tail FIX).** Verified in our own code that neither
     re-pointed surface assumes one row per date, so the multi-session-per-day case `cgpe-api` flagged does
     not break us: `attendance.tsx` draws each `/attendance/history` record as its own date-spine row
     (grouped by month, React-keyed by index — a 2-session day shows 2 rows, each with its own in/out);
     `getAgentLocations` (`/attendance/user/:id`) is array-aware (today-pass takes the latest session,
     fallback sorts by date and takes the most recent). Answered their "flag if you want `/user/:id` scoped"
     question: **leave it open** (scoping would empty our agent-map/on-duty fan-out).
  2. **`/api/exams` deletion (backend Phase 22).** Grep of `exams|Exam|EnglishQuestion` over `ANDROID/src`
     = **0 hits** — inert; confirmed underneath.
- Recorded one honest nuance so it isn't read as a missed defect: `attendance.tsx`'s KPI counters
  ("Days logged"/"Closed days") count sessions, not distinct dates, so a multi-session day inflates them —
  but that math is byte-identical to the old `attendance` collection's per-session storage, i.e. **unchanged
  by the fix**, not a regression it introduces. Left as-is.

## Files changed
- `../contracts/INBOX.md` — two `cgpe-mobile` replies (attendance-daylogs verification + exams not-affected),
  both left **unticked** (multi-recipient — `cgpe-admin` also addressed) per the box convention, both grepped
  back after writing (one survived a concurrent write that shifted the first item +16 lines mid-edit).
  Disk-only/untracked — not committed.
- `docs/HANDOFF.md`, `docs/DECISIONS.md`, `docs/PHASES.md`, `docs/STATUS.md` — this handoff.

## Decisions made
- **No `src/` change from either INBOX item.** Both were verified inert against our code, not propagated on
  the strength of the notice (the "receiving an item is not authorisation to act" rule). The attendance
  surfaces already handle N-sessions-per-day; the exam surface never existed here.
- **Told `cgpe-api` to leave `/attendance/user/:userId` unscoped** (they asked). `getAgentLocations`
  deliberately fans out across the whole roster to build the master agent-map + team on-duty count; a
  per-caller owner scope would empty it. If they scope it later, gate on **role** (admin/leader/master reads
  any; advisor reads self), not strict self-only, and ping us first.

## Known broken / deliberately skipped
- **Phase 16 device check — CARRIED** (highest-trust-cost). Reconcile ≥3 real people's months against the
  payroll sheet by hand on a phone; light/dark at 390 px. `npm test`/web cannot do this. **Phase 1 clock-in
  is the stated hard prerequisite.** Not editor-buildable.
- **Phase 22 (i18n P1 bulk) — paused on human copy.** Net-new `common.*` keys (`tryAgain` ×34, etc.) need
  gu/hi/hi-en/gu-en; machine translation forbidden (PHASE-19 §4).
- **Phase 6 (commissions) — backend-blocked.** No product aggregate, no `target` source in
  `routes/commissions.js`. Unchanged.
- **`git push` still 403s** — `reactjsaaziko` lacks write access; all prior commits local-only. Needs a human.

## Next session starts here
- Phase <next>: board is editor-exhausted for net-new build. The concrete levers are **(a)** owner-supplied
  i18n copy → unpauses Phase 22, **(b)** a handset → the Phase-16 device check + the carried device backlog,
  or **(c)** re-file `breakdown[]` + the days split to `cgpe-api` if the per-day earnings view is wanted
  (they offered — PHASE-16.md D-1). No net-new editor build is unblocked without one of these.
- First command: `/boot`
- Watch out for: `../contracts/INBOX.md` shifts **mid-session** under concurrent writes — this session's
  first edit failed with "file modified since read" and the target item moved +16 lines between two reads
  minutes apart. Anchor every edit on surrounding text, never a line number, and **grep your reply back**
  after writing.
