# HANDOFF — CGPE Connect (Android) — INBOX Phase-14 verification (notifications/notices 5xx) — 2026-08-11

Verification-only session. **No code changed** — the app was found already conformant to backend
Phase 14, and the finding was recorded in `../contracts/INBOX.md`. `git push` still 403s (unchanged
— credential `reactjsaaziko` has no write access to `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`); every
commit back through `3ef5539` / `7c11c82` remains **local only**. No new commit this session (the only
edit was to `contracts/`, which is not under version control by anyone).

Gates: not re-run and not needed — zero source files changed. Last known green (from `3ef5539`):
`npx tsc --noEmit` exit 0; `npm test` **299 tests / 13 files**; `npm run lint` **0 errors / 12 warnings**.

## Done

- **Confirmed the app tells the truth when the backend returns 5xx (not an empty-200) on a
  notifications query error.** Backend Phase 14 (`INBOX.md`, 2026-08-11 item) made
  `GET /api/notifications`, `/notifications/unread-count`, and `/notices/unread` answer 503/500 on a
  DB fault instead of `200 { data:[] }`. The one of the three the app calls — `GET /api/notifications`
  via `getNotifications` — already keys on HTTP `ok`, not on empty-vs-non-empty, so a 5xx falls
  through to `unavailable('/notifications')` → raises the app-wide `<HealthBanner/>`, and
  `notifications.tsx` shows "The feed did not load / Try again" instead of "You are all caught up".
  **The app inherits the backend fix for free; no change was required.** Before the fix, the empty-200
  produced `ok:true, arr:[]` → a silent false-empty — exactly the case the item warned about.

## Files changed

- `../contracts/INBOX.md` — appended the mobile-side verification reply under the 2026-08-11
  `→ cgpe-admin, cgpe-mobile · from cgpe-api` Phase-14 item. Box left **unticked** (co-recipient is
  `cgpe-admin`, per the foot-of-file protocol); the reply records the audit trail. Grep-verified back
  after writing, per CLAUDE.md's concurrent-write rule — it survived.
- **No ANDROID source file changed.** `docs/HANDOFF.md`, `docs/DECISIONS.md`, `docs/PHASES.md`,
  `docs/STATUS.md` updated by this handoff.

## Decisions made

- **No app change; verify-and-record, not fix.** The three Phase-14 endpoints: the app calls **only
  `/notifications`** (grepped twice — `/notifications/unread-count` and `/notices/unread` have zero
  callers; the unread count is derived client-side from the fetched list). `getNotifications` already
  branches on HTTP status, `notifications.tsx` already branches its empty state on
  `useDataHealth().degraded`, home's bell shows no badge on outage (banner carries it), and
  `getCompanyNotices` reads a *different* endpoint (`/notices?limit=60`, not `/notices/unread`) through
  the reporting `tryEnvelope`. Nothing to fix. Full reasoning in DECISIONS 2026-08-11 (top entry).
- **`POST /notices/:id/read` 404-on-stale-id needs no handling.** Our one caller
  (`notice-board.tsx`, opening a notice) fires `markNoticeRead(id)` fire-and-forget with the result
  ignored (bare `req`, no health report), so a 404 is silently absorbed as "this notice is gone" —
  which is exactly the backend's guidance. We never read the new `read_by` field.
- **Box left unticked, reply underneath.** Item is multi-recipient (`cgpe-admin` + `cgpe-mobile`),
  and the item itself says "no tick needed unless you want the audit trail" — same protocol call as
  every earlier multi-recipient reply in the file.

## Known broken / deliberately skipped

- **`git push` still 403s** — all local commits (back through `3ef5539` / `7c11c82`) are unpushed. A
  human must grant write access or swap the Windows-credential-manager credential. Not retried.
- **No editor-buildable phase remains.** Phase 6 commissions / 9 / 16 are `cgpe-api`-blocked (no
  aggregate/salary endpoint). Everything else on the board (Phases 1/4/5/6/7/10/12/13) is a
  **handset-only** acceptance check that needs a device + live backend, not an editor.
- **The other three 2026-08-11 backend FYI notices to `cgpe-mobile` remain unticked** — Phase 5
  (`protect` user_id), Phase 9 (attendance watchdog), Phase 10 (`location_tracks` unique index),
  Phase 15 (dead-code), Phase 17 (weekly report). All are "FYI, nothing to do", multi-recipient, and
  none affects the app. Not ticked (editing `INBOX.md` for no functional reason invites the documented
  concurrent-write data loss).

## Next session starts here

- **No editor-buildable work remains.** The only genuinely-buildable carry-item (this session's
  Phase-14 grep) is now closed clean. Next is either a **handset + live-backend verification pass**
  (the Phases 1/4/5/6/7/10/12/13 acceptance criteria) or a **`cgpe-api` unblock** landing (then build
  Phase 6 commissions / 9 / 16).
- **First command:** `/boot`
- **Watch out for:** don't re-run the notifications/notices grep — it's verified. The app calls **only
  `GET /api/notifications`** of the three Phase-14 endpoints; the unread-count and notices/unread
  endpoints have no caller. And `health.degraded` is **global and sticky** — gate empty-state *copy*
  on it (as `notifications.tsx` does), but gate an individual *value* on its own data's presence.
