# HANDOFF — CGPE Connect (Android) — INBOX sync (no phase) — 2026-08-11

No phase was built this session. The board is **exhausted for editor-buildable work** — every
app-side phase is done, and the only two that remain (Phase 6 commissions, Phase 16 salary) are
genuinely `cgpe-api`-blocked. This was a boot → verify → INBOX-hygiene session. **No `src/` file
changed; no gates were re-run** (nothing to gate). The only writes were three acknowledgement
replies in `../contracts/INBOX.md`, which is outside the `ANDROID` git repo.

## Done
- **Re-confirmed the two remaining phases are still backend-blocked**, from `contracts/CHANGELOG.md`
  this boot: no *product* commissions aggregate and no `target` source (Phase 6), and no
  salary/wage/per_day/ctc field on any backend model (Phase 16). Nothing app-side to build.
- **Three new backend FYI notices (all `→ cgpe-admin, cgpe-mobile`) verified against our own code
  and answered underneath** — each a genuine "nothing to do" for the app:
  - **Backend Phase 9** (attendance watchdog / D9/D7/D11) — grep for
    `attendance_violations|attendance.*webhook|weekly_summary|N8N_ATTENDANCE` in `ANDROID/src` → 0
    hits. The app reads only `/api/attendance/*`; it never touches the webhook, the violations
    collection, or the weekly-summary payload.
  - **Backend Phase 10** (`ux_session_id` unique index on `location_tracks.session_id`) — confirmed
    the app already sends `session_id` snake-case on all three track writes with no `sessionId`
    alias (`api.ts:1796/1824/1838`; `api-track.test.ts:88` asserts the alias is absent). The index
    reinforces our shipped D5 choice; it decides nothing new.
  - **Backend Phase 15** (dead-code sweep) — no Gujarati-bank caller, no `/api/health` caller, and
    nothing keys on the old catch-all-404 `availableRoutes`/`path`/`method` body (the one 404-body
    read takes `message`, which is the new shape).

## Files changed
- `../contracts/INBOX.md` — three `[cgpe-mobile, 2026-08-11, boot]` replies appended under the
  Backend Phase 9 / 10 / 15 items (boxes left unticked — all multi-recipient with `cgpe-admin`, per
  protocol). Grep-verified present after writing (survived any concurrent write).
- **No `src/` change. No `ANDROID` repo change** other than this doc set (HANDOFF/DECISIONS/PHASES/
  STATUS).

## Decisions made
- **Wrote the three INBOX acknowledgements rather than leave them silent.** They were "nothing to
  do" FYIs, but an unanswered box reads to `cgpe-api` as "mobile hasn't picked this up." Verifying
  from our own code (not trusting the notice) and replying is the cheap, correct close — same
  pattern as the Phase-14 boot reply already in the file.
- **No commit, by design.** `../contracts/` is untracked and must not be committed from here
  (CLAUDE.md), and the `ANDROID` repo had no source change. The pre-existing `M .claude/settings.json`
  from boot was left untouched.

## Known broken / deliberately skipped
- **`git push` still 403s** — unchanged. Every local commit back through `7c11c82` (incl. Phase 9's
  `bff1971`) is unpushed. Credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. Needs a human. Not retried.
- **Phase 6 commissions & Phase 16 salary — still `cgpe-api`-blocked.** Re-verified this session.
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
- **Watch out for:** don't re-verify the three Phase-9/10/15 FYIs — they're answered and confirmed
  no-ops this session. And **don't trust a phase's `[api]`/"blocked" tag without grepping
  `../cgpe-backend-main/routes/*` first** — it has been wrong for Phases 6/9/10/11/12. Before
  concluding a phase is backend-blocked, read the actual handler.
