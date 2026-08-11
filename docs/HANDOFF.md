# HANDOFF — CGPE Connect (Android) — Phase 16 re-evaluated (no build) — 2026-08-11

No code shipped. A boot found the backend's **Phase 25 payroll cluster** had landed — the endpoints
mobile Phase 16 ("My earnings") was blocked on. Re-verified against `cgpe-api`'s **real code** (not the
payroll INBOX notices — those are addressed to `cgpe-admin`, and mobile `[api]` tags have been wrong 5×).
Verdict: the two things Phase 16 asked to be **built** now **exist**, but they are gated admin-only, so a
mobile self-view still cannot read them. Phase 16 stays blocked — the ask shrank from "build a pay field
+ a formula" to **one self-scoped read**, which was re-filed to `cgpe-api`.

## Done
- **Established (by reading the producer's code) that Phase 16's blocker moved but did not clear.**
  - Pay field now exists: `payroll_profiles.salary_amount` + `segment` (`models/PayrollProfile.js`).
  - Server-side computation now exists: `services/payrollEngine.js` `computeRangeSalary()` → a rounded
    `payable` **number** via `GET /api/payroll/compute` — the "compute server-side, app never multiplies"
    shape the spec demanded.
  - **But admin-only:** `routes/payroll.js:22-23` = `router.use(protect); router.use(authorize('admin'))`;
    `authorize` (`middleware/auth.js:73`) 403s anyone not `super_admin`/`admin`. Advisor / learn_advisor /
    leader / payroll_staff all get 403 on `/compute`. `?user_id=` is admin-only member selection, not a
    self-scope. `grep -i earnings` over the whole backend = 0 — no `my-earnings` route exists; the engine
    is reachable ONLY via the two admin routes. What landed is the *manager-views-salary* surface Phase 16
    put OUT OF SCOPE, and it is `cgpe-admin`'s to consume.
- **Narrowed ask re-filed to `cgpe-api`** in `../contracts/INBOX.md` (appended under the standing
  dependency item; **grepped back after writing** per the concurrent-write rule — 3 anchors present): one
  self-scoped read, `GET /api/payroll/my-earnings` (`protect` only, own records only) or a self path
  reusing `buildRoster()` with `user_id = req.user.user_id`. No new math, same engine, same numbers.

## Files changed
- `docs/spec/PHASE-16.md` — new §"UPDATE 2026-08-11 — blocker moved, not cleared"; original lock preserved
  (blockers #1/#2 superseded, UI lock + acceptance criteria still stand).
- `docs/PHASES.md` — new "Now" entry, board row 16, and "Next 3" #1 rewritten to the narrowed state.
- `docs/HANDOFF.md` — this file, rewritten for the session.
- `docs/DECISIONS.md` — appended the "read the code not the notices; don't build against a phantom
  endpoint" decision.
- `docs/STATUS.md` — rewritten (manager-facing) for the salary re-check.
- `../contracts/INBOX.md` — appended the narrowed self-earnings ask (untracked repo; local disk only).
- Memory: `phase16-blocked-on-self-scoped-read.md` (+ index) so the next boot doesn't re-derive this.
- Commit `21b3be1` (docs only; `src/` untouched). Push still 403s → **local only**.

## Decisions made
- **Did NOT build the locked UI against a non-existent endpoint** — it could only render its error/empty
  state (untested dead code), and §RISKS makes unfixed clock-in (Phase 1) a hard prerequisite.
- **Did NOT re-scope Phase 16 into an in-app admin/manager payroll screen** — that surface is
  `cgpe-admin`'s (payroll items 25a/b/c are addressed to them); Phase 16 scoped a self-view, not a
  duplicate of the admin panel.
- **Read the code, not the INBOX notices** — the payroll items are addressed to `cgpe-admin`; concluding
  "Phase 16 unblocked" from them would repeat the wrong-tag mistake of Phases 6/9/10/11/12.

## Known broken / deliberately skipped
- **Phase 16 still blocked** — on a self-scoped earnings read; not editor-buildable until `cgpe-api` adds it.
- **Phase 6 commissions — unchanged, still blocked** — no product aggregate / no `target` source in
  `routes/commissions.js`; deriving on-device stays rejected.
- **`git push` still 403s** — credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; commit `21b3be1` is local. Needs a human.
- **The INBOX reply is on unversioned disk** — grepped back once; if a later concurrent write deletes it,
  re-file from this handoff.

## Next session starts here
- Phase 16: if `cgpe-api` shipped a self-scoped earnings read, build `src/app/earnings.tsx` per the locked
  UI (wire `getMyEarnings()` in `api.ts`, revive `src/ui/characters.tsx`, add the More "Me" row +
  `attendance.tsx` link) — reconcile 3 real people's months by hand before shipping; else widen `t()`
  coverage (needs your Hinglish/Gujlish copy) or take the handset device-backlog.
- First command: `/boot` — then re-read `../contracts/INBOX.md` for a `cgpe-api` reply to the narrowed
  earnings ask before assuming Phase 16 is still blocked.
- Watch out for: the payroll INBOX items are addressed to `cgpe-admin`, NOT mobile — don't read them as
  "Phase 16 is unblocked". The compute endpoint is admin-only; mobile needs a *self-scoped* read that does
  not exist yet.
