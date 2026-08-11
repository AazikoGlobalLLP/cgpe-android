# HANDOFF — CGPE Connect (Android) — INBOX sync (no phase) — 2026-08-11

No phase was built this session. The board is still **exhausted for editor-buildable work** — every
app-side phase is done, and the only two that remain (Phase 6 commissions, Phase 16 salary) are
genuinely `cgpe-api`-blocked. This was a boot → verify → INBOX-hygiene session. **No `src/` file
changed; no gates were re-run** (nothing to gate). The only writes were two acknowledgement replies
in `../contracts/INBOX.md`, which is outside the `ANDROID` git repo.

## Done
- **Answered the two newest `→ cgpe-admin, cgpe-mobile` FYIs from `cgpe-api`** (both dated
  2026-08-11, both previously unanswered by this session — `cgpe-admin` had replied, mobile had not).
  Each verified against our own code (not trusted from the notice) and confirmed a genuine no-op:
  - **Backend Phase 18** (`/api/leaves` is now a real feature, was a stub; `GET /api/attendance/calendar`
    and `/day/:date` gained `is_leave` / `leave_type` and a new `status:'leave'`) — the app calls
    **none** of the 8 `/api/leaves` routes (`grep -niE "leave|/api/leaves" ANDROID/src` → only prose,
    the `leaveTimer`/`LEAVE_AFTER_*` identifiers, and one "Leave unassigned" UI string; no leave
    helper), and it opens **neither** attendance endpoint Phase 18 changed (`grep -nE
    "is_leave|leave_type" → 0`; `grep -nE "attendance/calendar|attendance/day" → 0`; the app's whole
    attendance surface is `/attendance/history`, `/time-tracker/history`, `/attendance/user/:id`).
    `attendance.tsx`'s `Entry` shape (`:49`) carries no `status` field, so the new `status:'leave'`
    value is inert by construction.
  - **Backend Phase 17** (weekly-report scheduler wired to already-stored `report_schedule`; `weekday`
    convention pinned `0`=Sun…`6`=Sat; `last_sent` now written) — `grep -niE
    "report-schedule|report_schedule|last_sent|/reports|weekly" ANDROID/src` → **0 matches**. The app
    never reads the report schedule or calls `/api/settings/report-schedule` or `/api/reports`; that
    config lives only in the panel. Droplet email-transport gap (`SMTP_*` / empty
    `N8N_EMAIL_WEBHOOK_URL`) is the same console-side blocker already on record.

## Files changed
- `../contracts/INBOX.md` — two `[cgpe-mobile, 2026-08-11, boot]` replies appended under the Backend
  Phase 18 and Phase 17 items (boxes left unticked — both multi-recipient with `cgpe-admin`, per
  protocol). Grep-verified present after writing (survived any concurrent write).
- **No `src/` change. No `ANDROID` repo change** other than this doc set (HANDOFF/DECISIONS/PHASES/
  STATUS).

## Decisions made
- **Answered rather than left silent, and recorded a forward-looking note on Phase 18.** Both were
  "nothing to do" FYIs, but an unanswered box reads to `cgpe-api` as "mobile hasn't picked this up"
  (the exact failure the Phase-4 boxes hit). The one non-obvious point worth keeping: when Phase 16
  ("My earnings") eventually unblocks, the now-**real** leave data + the attendance `status:'leave'`
  day become a legitimate *input* to a "present days / payable days" figure — a leave day is not an
  absence. But Phase 16 stays blocked on a **pay field + salary formula**, which Phase 18 does not
  supply (leaves ≠ salary). See DECISIONS 2026-08-11 (top).
- **No commit, by design.** `../contracts/` is untracked and must not be committed from here
  (CLAUDE.md), and the `ANDROID` repo had no source change. The pre-existing `M .claude/settings.json`
  from boot was left untouched.

## Known broken / deliberately skipped
- **`git push` still 403s** — unchanged. Every local commit back through `7c11c82` is unpushed.
  Credential `reactjsaaziko` has no write access to `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. Needs a
  human. Not retried.
- **Phase 6 commissions & Phase 16 salary — still `cgpe-api`-blocked.** Phase 18 making `/api/leaves`
  real does **not** unblock Phase 16 — it supplies leave data, not a pay rate or a salary formula.
- **Device-verification backlog** — handset-only acceptance criteria carried from Phases
  1/4/5/6/7/9/10/12/13 (haptics, AsyncStorage clock key, background GPS, master route replay,
  airplane-mode behaviour, leader on-duty count, offline map render, LIC catalogue + notes-search
  against production, reminder cold-start persistence). Needs a device, not an editor.

## Next session starts here
- **No editor-buildable phase remains.** Next is either a **device-verification pass** (needs a
  handset + live backend + signed-in staff account) or a **`cgpe-api` unblock landing** — the moment
  they ship the commissions *product* aggregate or a salary/pay field, Phase 6 commissions / Phase 16
  become buildable.
- **First command:** `/boot`
- **Watch out for:** don't re-verify the Phase-17/18 FYIs — they're answered and confirmed no-ops
  this session. And **don't trust a phase's `[api]`/"blocked" tag without grepping the sibling
  backend first** — it has been wrong for Phases 6/9/10/11/12. Before concluding a phase is
  backend-blocked, read the actual handler.
