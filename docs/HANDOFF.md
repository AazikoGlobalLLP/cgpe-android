# HANDOFF — CGPE Connect (Android) — Phase 37 — 2026-08-14

This session ran **Phase 37 — [m] notification mark-as-read (per-item) + clear the bell dot** — the first
feature off the owner backlog (PLAN Group B) after the three audits. It is a **pure `[m]` build**: the persist
endpoint already existed, so no contract change and no `[api]` ask. Gates green; commit local (push still 403s).

## Done
- **Verified the backend FIRST (grep, not tags):** `PUT /api/notifications/:id/read` already exists
  (`cgpe-backend-main/routes/notifications.js:86-111` — `protect`, ownership-checked: 404 missing / 403 not
  yours / else `markAsRead()` persists `read:true`+`read_at`) and is already documented at `contracts/api.md:878`.
  So — unlike the WhatsApp inbox (no read endpoint) — **nothing was filed; this is a client wire-up only.**
- **Per-item mark-read shipped, honest:** tap an **unread** notification row → it marks read on the server and
  greys; a refused/failed mark rolls that single row back to unread and shows the existing Banner (never a
  cleared row the server didn't agree to). Marking items read clears the header bell's unread dot on return to
  Home, and an outage never forges a "0 unread" bell.
- **Gates:** `tsc` 0 · `npm test` **430/430** (+13, new `api-notifications.test.ts`) · lint 0 errors / 12
  warnings (baseline).

## Files changed
- `src/data/api.ts` — NEW `markNotificationRead(id):Promise<boolean>` (per-item companion to
  `markAllNotificationsRead`; suppresses 401/403/404/501 as answers, reports real faults).
- `src/app/notifications.tsx` — `markOne(n)` wired to `SpineRow.onPress` for unread rows (optimistic +
  single-row rollback); header doc-comment updated ("rows do not navigate — they mark themselves read").
- `src/app/(tabs)/home.tsx` — `useFocusEffect` re-reads just the feed on RE-focus so the bell clears on return
  from the pushed `/notifications` route (first focus skipped; outage-guarded via live `getHealth()`); added
  `useFocusEffect` + `getHealth` imports.
- `src/data/__tests__/api-notifications.test.ts` — NEW, 13 tests (read-state wire contract).
- `docs/spec/PHASE-37.md` — NEW. `docs/PHASES.md` (Phase 37 → `## Now`; `## Next 3` promoted to 38→40→39).
  `docs/DECISIONS.md` (1 entry, prepended). `docs/STATUS.md` (rewritten). memory `owner-backlog-2026-08-14` +
  `MEMORY.md` updated.
- Commit `<local>` (docs+code; push still 403s).

## Decisions made
- **No `[api]` ask, no contract change** — the persist endpoint already exists and is documented (DECISIONS
  2026-08-14 top; PHASE-37 D-1). Do NOT re-file it.
- **403/404 are answers, not outages** — `markNotificationRead` suppresses them (mirrors `reportIfOutage`), a
  deliberate divergence from `markAllNotificationsRead` (which can only 5xx). PHASE-37 D-4.
- **Per-item does not refetch the feed; mark-all keeps its verify-refetch.** PHASE-37 D-3.
- **The bell focus-refresh is outage-guarded and reads health LIVE** (`getHealth()` after the await, not the
  stale render snapshot) — never a fabricated "0 unread" (convention 4). PHASE-37 D-5.

## Known broken / deliberately skipped
- **Device check CARRIED** (native-only: pushed-route focus lifecycle, haptics, the real bell — `npm test`/web
  can't exercise them): tap-to-read greys the row + drops the count + hides the bar at zero; the Home bell
  reflects the new count on return and on tab re-focus; airplane-mode tap rolls the row back + Banner, and the
  bell keeps its last count (no false zero); a genuinely all-read feed on a healthy backend clears the bell.
  PHASE-37 §5.
- **`git push` still 403s** — stored credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; the commit is **local only**. Needs a human to fix access.

## Next session starts here
- **Phase 38→40→39 — master role via DB → gate → surface (owner backlog).** Set `Profile.role` in the DB for
  the 3 master phone numbers (an owner/DB change — **NEVER** a client phone literal in `src/`, per Phase 11),
  then gate the master monitoring surface (performance + location + salary, no tasks) on the **REAL**
  `user.role`, not the tier (Phase-20 pattern — a leader/admin folds into the tier but a real endpoint 403s
  them). **Verify the real `cgpe-backend-main` before filing any `[api]` ask** (tags wrong 5×). Full plan:
  `docs/PLAN-2026-08-14.md` §Phase 38+.
- **First command:** `/boot`
- **Watch out for:** role-by-identity lives in DB `Profile.role`, never a phone literal; the app never computes
  money (salary is a backend formula); the master surface must gate on the real role, not `caps`/tier.
