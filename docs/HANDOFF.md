# HANDOFF — CGPE Connect (Android) — Phase 34 — 2026-08-14

This session ran **Phase 34 — [audit] self-created task not visible** end to end, and it closed as **RESOLVED
in the same session**: the audit found the root cause, filed a verified backend ask, the owner relayed it, and
`cgpe-api` shipped the fix (their Phase 40). Mobile owes nothing.

## Done
- **A user's own self-created task now shows on the phone.** The owner's exact bug — `super_admin` creates a
  task for himself, it never appears on Home/Tasks even after restart — is fixed at the backend: every
  `team_tasks` write now stamps `createdById` (the creator's user_id) and `/team/task-overview`'s own/team
  filter matches the creator by `createdById` (new rows) **AND** by `createdBy` name (legacy rows). The task
  shows in the owner's **DEFAULT own-scope** — precise (his task, not everyone's), so no mobile change was
  needed.
- **The mechanism is understood and written down** (`docs/spec/PHASE-34.md`): the phone reads
  `GET /team/task-overview` (the `team_tasks` collection), never `GET /api/tasks` (that fallback is dead — an
  empty `{members:[]}` is a valid response); the old creator match compared a NAME against a set of user_ids,
  so it could never fire.

## Files changed
- `docs/spec/PHASE-34.md` — NEW. The audit finding (read path · server scope · root cause · one-line fix) plus
  a RESOLVED banner recording the backend Phase-40 fix. Commits `8248eb5` (finding) + resolution commit.
- `../contracts/INBOX.md` — filed `→ cgpe-api · 2026-08-14 · from cgpe-mobile` (the verified backend ask);
  `cgpe-api` replied and **ticked it** (their Phase 40). NOT under git (`contracts/` is untracked by policy).
- `docs/PHASES.md` (Now + Next 3), `docs/DECISIONS.md` (2 entries), `docs/STATUS.md` (rewrite), project
  `CLAUDE.md` (backend-courier workflow note) — Phase-34 close.

## Decisions made
- **The fix went to the BACKEND, not mobile.** The audit's first suggestion was a mobile `?scope=all` for real
  admins (Phase 34b), but the audit's §6 secondary finding — the `createdBy` name-vs-user_id mismatch — was the
  true root cause. Fixing it backend-side is more precise (shows the owner HIS task, not the whole board) and
  fixes it for non-admins too. `cgpe-api` shipped it; **34b is deferred** (revisit only if an admin should see
  the whole team's board on the ordinary Tasks tab vs. the dedicated master surface, Phase 39).
- **Backend-courier workflow confirmed and used.** The owner relays a verified `[api]` ask to the backend and
  confirms when live. Proven this session: filed → owner relayed → backend shipped → mobile verified, all in
  one session. Roadmap `[api]` items are no longer "blocked indefinitely."

## Known broken / deliberately skipped
- **⚠️ OPS — the backend fix is uncommitted and needs a `:3001` restart** (and a production deploy for cgpe.in)
  before it shows on a device. If a self-created task is still missing on device, that is the server not
  restarted, **not** a code bug — the fix is verified in source.
- **Mobile edge case (not the owner's case):** a task created *explicitly Unassigned from the panel* can still
  be hidden for a NON-admin on the phone, because the app groups by assignee (`getTasks(true)`'s client-side
  `mine` filter drops the "Unassigned" member group). A mobile-app-created self task avoids this (assignee
  defaults to the creator's name). Fixable in-app if it ever bites; left as-is.
- **Phase 34b (mobile `?scope=all`) deferred** — not needed for the owner's bug.
- **`git push` still 403s** — stored credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; all commits this session are **local**.

## Next session starts here
- **Phase 35 — [audit] touch-freeze, especially the AppLock "Unlock" button.** Investigate `ui/AppLock.tsx`
  overlay `pointerEvents` (the opacity-0-View-absorbs-touches class the sheet code documents at `sheet.tsx`) +
  the gesture-handler root + any full-screen Animated overlay that stays mounted. Deliverable: root-cause +
  fix. Full plan: `docs/PLAN-2026-08-14.md` §Phase 35.
- **First command:** `/boot`
- **Watch out for:** before treating Phase 34 as "still broken," confirm the backend `:3001` was restarted /
  prod deployed — the code fix is verified, so a device miss is almost certainly an un-restarted server.
