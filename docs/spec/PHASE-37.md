# Phase 37 — [m] Notification mark-as-read (per-item) + clear the bell dot

Owner backlog `docs/PLAN-2026-08-14.md`. `[m]` only — **no contract change, no `[api]` ask** (§1). The feature
Phase 36 pre-cleared: that audit proved there is **no** hardcoded notification data to strip, so this is purely
the mark-as-read + bell-dot piece.

## 0. The ask

Add a "mark as read" action to notifications; when an item is read, the unread dot/count on the header bell
clears. Verify a read-persist endpoint exists **before** wiring — history warns the WhatsApp inbox has none, so
its `unread` never clears.

## 1. Backend verified FIRST — the endpoint already exists (no `[api]` ask)

Grepped the real `cgpe-backend-main`, not the tags. `routes/notifications.js:86-111`:

```
PUT /api/notifications/:id/read   (protect; ownership-checked)
  → findById(:id); 404 if missing; 403 if notification.user_id !== req.user.id; else markAsRead()
  → 200 { success:true, data:Notification, message:'Notification marked as read' }
```

Already documented in `contracts/api.md:878` (`markAsRead()` sets `read:true`, `read_at:now`; "No admin
override"). So the per-item read is a **real, persisted, self-scoped** write — unlike WhatsApp `unread`. `id`
is the row's Mongo `_id`, which is exactly what `adaptNotification` stores in `AppNotification.id`
(`adapt.ts:389` `String(raw._id || raw.id)`), so it drops straight into the path. **Nothing to file; contract
already carries it.** (`mark-all-read` already existed and was already wired — Phase 37 is the per-item +
bell-dot piece.)

## 2. What shipped

### (a) `src/data/api.ts` — `markNotificationRead(id): Promise<boolean>`
The per-item companion to `markAllNotificationsRead`, same low-level `req()` posture and same boolean contract
(returns whether the SERVER accepted it, so a caller never claims a read it did not get). Reporting mirrors
`reportIfOutage`: a **403** (not the caller's row) and a **404** (already gone) are ANSWERS — they stay quiet and
let the screen roll back — while a 5xx / malformed 4xx / dead network is a fault that raises the health banner.
`healthKey` collapses the 24-hex `_id` segment back to `/notifications/:id/read`, the key `reportFailure` uses.
Guards `!sessionReal`/`FORCE_DEMO`/empty-id (no request, returns false).

### (b) `src/app/notifications.tsx` — tap an unread row to mark it read
`markOne(n)` is wired to `SpineRow`'s existing `onPress`, **only for unread rows** (a read row has nothing to do,
so it takes no press — its lack of feedback reads as "nothing here"). Same **verified, not assumed** posture as
mark-all: the node greys on the tap frame (optimistic, functional `setItems` so two quick taps each flip their
own row), and if `markNotificationRead` returns false the **single** row is put straight back to unread and the
existing shared Banner explains — never a cleared row the server never agreed to. Per-item does **not** refetch
the whole feed (a single PUT is authoritative and a refetch would re-stagger the list); the mark-all path keeps
its verify-refetch. The screen's own unread Pill + bottom "Mark N as read" bar derive from `unread`, so they
update as rows flip and the bar hides when the last unread clears. Rows still **do not navigate**
(`AppNotification` carries no target id) — marking read is the one thing a row can honestly act on.

### (c) `src/app/(tabs)/home.tsx` — the bell clears on return
`/notifications` is a **pushed route**, so Home stays MOUNTED beneath it and its mount-time `load()` never
re-runs on the way back — the dot would otherwise stay frozen at its old count. Added a `useFocusEffect` that
re-reads **just the feed** (not the whole dashboard) on every RE-focus (returning from the route, or switching
back to this tab); the **first** focus is skipped (`bellPrimed` ref) because the mount `load()` already fetched
once, so a cold open never double-fetches. **Outage-guarded (convention 4):** if the refetch comes back empty
because the network is down (`getHealth().degraded`, read LIVE after the await — the failing fetch is what would
raise it), the last known count is kept rather than forging a "0 unread" bell; a genuinely empty feed on a
healthy backend still clears.

### (d) `src/data/__tests__/api-notifications.test.ts` — NEW (13 tests)
The notifications read-state **wire contract**, fetch stubbed at the `req()` boundary (same harness as
`api-whatsapp.test.ts`): `markNotificationRead` PUTs to `/notifications/:id/read` with the id in the path; true
on 200; **403/404 = false + no banner**; 500 / dead network / 200-`success:false` = false + banner under the
collapsed `/notifications/:id/read` key; no request on empty-id or a demo session. Plus `markAllNotificationsRead`
(verb/path/true, 500→banner) and `getNotifications` (maps rows incl. the `is_read` alias; an outage resolves
EMPTY + degraded, never a fabricated feed).

## 3. Decisions

- **D-1. No `[api]` ask, no contract change.** The persist endpoint already exists (`PUT /:id/read`) and is
  already in `api.md:878`. This is the opposite of the WhatsApp-inbox case; Phase 37 is a pure client wire-up.
- **D-2. Tap-to-mark-read, not a swipe or a per-row button.** The standard notification-feed gesture; `SpineRow`
  already exposes `onPress` with pressed-opacity feedback, so no primitive change. Only unread rows are pressable.
- **D-3. Per-item does not refetch; only rolls back the one row on failure.** A single PUT is authoritative and a
  whole-feed refetch per tap would re-stagger the list. Mark-all keeps its verify-refetch (it flips many rows at
  once and the cost of being wrong there is higher).
- **D-4. 403/404 are answers, not outages.** `markNotificationRead` suppresses 401/403/404/501 (mirrors
  `reportIfOutage`), so a stale/foreign id never pins the app-wide health banner. This is a deliberate,
  defensible difference from `markAllNotificationsRead` (which can only realistically 5xx, so it reports any
  `!ok`); per-item genuinely can 403/404.
- **D-5. The bell refresh is outage-guarded and reads health LIVE.** The render-time `useDataHealth()` snapshot is
  stale after the await, so the guard uses `getHealth()` (the live bus) — the very fetch that came back empty is
  what would have raised the flag. Keeps the "never a fabricated zero" rule at the bell, matching how the feed
  screen already forks degraded vs. empty.

## 4. Gates

- `npx tsc --noEmit` → **0**.
- `npm test` → **430/430** (+13, `api-notifications.test.ts`; the prior 417 unchanged).
- `npm run lint` → **0 errors / 12 warnings** (baseline).

## 5. Device check (carried — native-only, not editor-verifiable)

`npm test`/web do not exercise the pushed-route focus lifecycle, haptics, or the real bell. On a device:
- Bell shows N unread on Home → open Notifications → tap an unread row → node greys, "New" pill goes, count
  drops; the bottom bar hides when the last one clears.
- Back to Home → the bell dot reflects the new count (clears when 0). Switch tabs away and back → still correct.
- Airplane mode: tapping an unread row rolls it back to unread + shows the Banner (no false clear); the Home bell
  keeps its last count rather than dropping to 0.
- A genuinely-all-read feed on a healthy backend clears the bell.

## 6. Done-when

- [x] A per-item "mark as read" action exists (tap an unread row) and persists to the server.
- [x] Backend persist endpoint verified to exist BEFORE wiring (no `[api]` ask needed).
- [x] Marking items read clears the unread dot/count on the header bell (on return to Home / tab re-focus).
- [x] Honest failure: a refused/failed per-item mark rolls that row back and says so; an outage never forges a
      "0 unread" bell.
- [x] Gates green (§4). Device check carried (§5).
