# HANDOFF — CGPE Connect (Android) — Phase 44 — 2026-08-15

Verified Phase 44 (strict salary from working hours/days) against the real backend and found it **already
satisfied end to end** — the strict engine exists, is owner-locked, and is live (Backend Phase 25b), and both
mobile payroll screens already render it. Showed the owner the exact live formula (AskUserQuestion) and they chose
**"correct as-is."** A pure verify-and-document phase: **no `[api]` ask** (nothing missing), **no mobile build**,
**no contract change**, gates untouched. Third same-shape outcome after Phases 38/43 — verify first, don't invent.

## Done
- **Salary is already computed server-side strictly from actual working hours/days and shown as one amount**,
  on both the staff self-view (`earnings.tsx`) and the admin roster (`payroll.tsx`). Verified the formula in real
  code (both trees): a full day counts at ≥8h worked, half at ≥4h, nothing below 4h (owner-locked fixed cutoffs);
  `day_wise` = (salary ÷ working_days) × present_days, `hourly` = (salary ÷ working_days ÷ office_hours[8.5]) ×
  worked_hours, `base` = flat; working_days = days − Sundays − holidays; payable rounded to ₹1. The figures come
  from the **live `daylogs`**, joined by the member's Profile ObjectId `_id`. The phone never does the sums — it
  renders the server's `payable`.
- Owner confirmed the live formula is what they want, so the phase closed with zero change.

## Files changed
- `docs/spec/PHASE-44.md` — NEW: the verified finding (engine, cutoffs, join, exposure, mobile render, decisions).
- `docs/PHASES.md` — `## Now` Phase 44 entry (VERIFIED already-satisfied); `## Next 3` re-pointed to Phase 45.
- `docs/DECISIONS.md` — one entry (2026-08-15): Phase 44 already-satisfied, owner-confirmed, zero change.
- `docs/STATUS.md` — manager-facing rewrite: salary-from-hours request confirmed already built + working.
- **No `src/` change.** Commit `b761628` (local only — push 403s). No `contracts/` change (nothing crossed a
  repo boundary — no INBOX/CHANGELOG edit, no session to notify).

## Decisions made
- **Phase 44 is closed as already-satisfied — do NOT file an `[api]` ask.** The plan told this session to "file
  the exact inputs/rounding" of the salary formula, but that formula already exists, is owner-locked (Backend
  Phase 25b, 2026-08-11), and is live. A "please build a salary formula" ask would be wrong — the plan text
  predates knowledge that Backend Phase 25b had shipped it. (DECISIONS 2026-08-15.)
- **Do NOT invent an alternative cutoff, rate, or working-days basis.** The owner was shown the exact live
  formula and chose "correct as-is." A future change to the 8h/4h cutoffs or the Sat/Sun/holiday basis is a
  **new** `[api]` ask carrying the owner's exact numbers — never a mobile guess (rule 2 / rule 4).
- **Verify the producer's real code before filing, even when the roadmap says `[api]`** — the plan named Phase 44
  an `[api]` filing, but reading `services/payrollEngine.js` + `payrollAttendance.js` + `routes/payroll.js` showed
  it was already done. Same lesson as the 5× wrong tags.

## Known broken / deliberately skipped
- **`git push` still 403s** — commit `b761628` (and the prior `16e75ae`, `1a880f0`, `2f55d85`, …) are local only;
  needs a human credential swap (`reactjsaaziko` has no write access to `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`).
- **Payroll-screen device check is CARRIED** (not new to Phase 44) — `earnings.tsx`/`payroll.tsx` against
  production data on a real handset, light/dark at 390 px. Editor gates are green; this is the existing device gate.
- **Phase 41a-iii-b part 2 remains DEVICE-UNVERIFIED** (commit `16e75ae`) — the unified 24/7 recorder; its
  acceptance gate is the §12.7 handset matrix (EAS build + 3+ OEMs + battery over a real day). Untouched this session.
- **Phase 43 device check carried** — a member inside their assigned pin clocks in; ~201 m away is refused with
  the measured distance — once an admin sets a `start_location` and the `:3001` restart lands.

## Next session starts here
- Phase 45: verify the real `cgpe-backend-main` for a completed-assigned-tasks aggregate + performance score, then
  **LOCK the score weights with the owner (AskUserQuestion) before filing** — do NOT invent the weights.
- First command: `/boot`
- Watch out for: **do not invent the performance-score weights, and count only tasks that were assigned AND
  actually completed — NOT reminders, not self-created-unfinished** (owner's hard rule, PLAN §Phase 45). And, as
  with 44, **verify the backend before filing** — an aggregate may already exist (tags wrong 5×). The app renders
  the score; it never computes it (rule 2).
