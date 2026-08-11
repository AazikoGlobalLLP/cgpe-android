# HANDOFF — CGPE Connect (Android) — Phase 16 re-evaluated: blocker moved, not cleared — 2026-08-11

No build this session. A boot found the backend's **Phase 25 payroll cluster** had landed — the
endpoints mobile Phase 16 ("My earnings") was blocked on. Re-verified against `cgpe-api`'s **real code**
(not the payroll INBOX notices — those are addressed to `cgpe-admin`, and mobile `[api]` tags have been
wrong 5×). The verdict: the two things Phase 16 asked to be **built** now **exist**, but they are gated
admin-only, so a mobile self-view still cannot read them. Phase 16 stays blocked — but the ask shrank
from "build a pay field + a formula" to **one self-scoped read**, which was re-filed to `cgpe-api`.

## Done
- **Verified Phase 16's blocker against the producer's code, not the tags.**
  - Pay field now **exists**: `models/PayrollProfile.js` / `payroll_profiles.salary_amount` + `segment`.
  - Server-side computation now **exists**: `services/payrollEngine.js` `computeRangeSalary()` returns a
    rounded `payable` **number** via `GET /api/payroll/compute` — exactly the "compute server-side, app
    never multiplies" shape the spec demanded.
  - **But admin-only**: `routes/payroll.js:22-23` = `router.use(protect); router.use(authorize('admin'))`
    over the whole router; `authorize` (`middleware/auth.js:73`) 403s anyone not `super_admin`/`admin`. So
    advisor / learn_advisor / leader / payroll_staff all get **403** on `/compute`. `?user_id=` is
    admin-only member selection, not a self-scope. `grep -i earnings` over the whole backend = **0 hits** —
    the proposed `GET /api/payroll/my-earnings` was never built; the engine is reachable ONLY via the two
    admin routes (`/compute`, `/export`). What landed is the *manager-views-salary* surface Phase 16 put
    OUT OF SCOPE, and it belongs to `cgpe-admin` (the payroll INBOX items are addressed to them).
- **Filed the narrowed ask to `cgpe-api`** under the standing dependency item in `../contracts/INBOX.md`
  (appended, not rewritten; **grepped back after writing** per the concurrent-write rule — 3 anchors
  present). The ask is now one self-scoped read: `GET /api/payroll/my-earnings` (`protect` only, own
  records only, same posture as `/time-tracker/stats`) **or** a self path reusing `buildRoster()` with
  `user_id` forced to `req.user.user_id` — no new math, same engine, same numbers.
- **Updated docs:** `docs/spec/PHASE-16.md` (new §"UPDATE 2026-08-11 — blocker moved, not cleared";
  original lock preserved), `docs/PHASES.md` (new "Now" entry + board row 16 + "Next 3" #1), this file.

## Decisions made
- **Did NOT build the locked UI against a non-existent endpoint.** It could only ever render its
  error/empty state — untested dead code — and Phase 16's own §RISKS makes unfixed clock-in (Phase 1, still
  handset-unverified) a hard prerequisite. The screen ships when a self-read exists, not before.
- **Did NOT re-scope Phase 16 into an admin/manager payroll screen in the app.** That surface is
  `cgpe-admin`'s (they own the payroll create/update + compute + export screens, items 25a/b/c), and
  Phase 16 explicitly scoped a self-view. Duplicating the admin panel in the app was not asked for.
- **Read the code, not the notices.** The payroll items are addressed to `cgpe-admin`; concluding "Phase
  16 is unblocked" from them would have repeated the exact wrong-tag mistake of Phases 6/9/10/11/12.
- **Two original Phase-16 blockers are now moot for the self-read path** (recorded so the design doesn't
  reopen them): "app must not multiply" (server returns the number) and the ambiguous-present-days /
  self-writable-`/work-settings` / unscoped-`/attendance/user/:id` trio (the engine reads the member's own
  `daylogs` by `_id` server-side). The only thing left is scoping the READ to the caller.

## Known broken / deliberately skipped
- **Phase 16 still blocked** — on a self-scoped earnings read. Not editor-buildable until `cgpe-api` adds it.
- **Phase 6 commissions — unchanged, still blocked.** `routes/commissions.js` has no product aggregate and
  no `target` source; `/commissions/team-summary` is not that aggregate. Deriving on-device stays rejected.
- **`git push` still 403s** — credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. This session's docs commit is **local**. Needs a human.
- **Contracts write is unversioned** — the INBOX reply lives only on that disk (contracts/ is untracked by
  design). It was grepped back once; if a concurrent write later deletes it, re-file from this handoff.

## Next session starts here
- **If `cgpe-api` has shipped a self-scoped earnings read** (`GET /api/payroll/my-earnings` or a self path
  off `buildRoster`) — Phase 16 is buildable: build `src/app/earnings.tsx` per the locked UI in
  `docs/spec/PHASE-16.md`, wire `getMyEarnings()` in `api.ts`, revive `src/ui/characters.tsx`, add the More
  "Me" row + the `attendance.tsx` link row. Reconcile 3 real people's months by hand before shipping
  (§RISKS). Clock-in honesty (Phase 1) must be handset-verified first.
- **If still blocked** — the only app-side-buildable item is **widening `t()` coverage** (Settings body /
  chrome still hardcoded English; scope from `e2e/artifacts/screens/languages/*`), but every new string
  needs **human-supplied** Hinglish/Gujlish copy (Phase 19 spec §4). Otherwise the **device-verification
  backlog** (Phases 1/4/5/6/7/9/10/12/13) needs a handset.
- **First command:** `/boot`. Re-read `../contracts/INBOX.md` for a `cgpe-api` reply to the narrowed
  earnings ask before assuming Phase 16 is still blocked.
