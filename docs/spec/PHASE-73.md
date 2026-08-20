# PHASE 73 — Auto-add assigned tasks/reminders to the phone calendar (Option B)

**Owner batch 2026-08-20, item #4.** Owner chose **Option B — AUTO-sync** (auto-add on assign), not
just a one-click export. Pure client `[m]` — **no `[api]`** (the member's own app already holds their
own tasks/reminders); needs `expo-calendar` → a native APK rebuild, so it rides the same batch as
70/71/72.

## Defaulted open questions (mobile's call — "aapke according"; all vetoable)
| Question | Default chosen | Why |
|---|---|---|
| Tasks only, or +reminders? | **Both tasks + reminders** | Owner's ask named both. |
| Undated items (`dueDate`/`date` === '') | **SKIP** — never coerce to today | The app's Invalid-Date-safe rule; an undated task must not fake a calendar day. |
| Dedicated calendar vs the user's default? | **Dedicated "CGPE Connect" calendar** | Cleanly labelled + removable in one place; scopes the idempotency. |
| Event shape | **All-day** on the due date | A due date is a day, not a time; avoids timezone-of-time pitfalls. |
| Completed / removed items | **Deleted** from the calendar on next sync | Keeps the calendar truthful (reconciliation). |
| UI copy / toggle | **None (silent auto-sync)** | Avoids a new i18n key that would need human copy; a future on/off toggle + a "synced" indicator are the follow-up that needs owner copy. |

## Built (`[m]`, rides the batch APK — native module, NOT OTA)
- **Dep:** `expo-calendar@~57.0.2` (`npx expo install`). `app.json`: the `expo-calendar` config plugin
  (calendar permission rationale) + `READ_CALENDAR`/`WRITE_CALENDAR` Android permissions.
- **`src/lib/calendarSync.ts` (PURE, tested):** `buildSyncItems(tasks, reminders)` (skips undated +
  completed, namespaced keys), `fingerprint` (day-granular so time jitter doesn't churn events),
  `planSync(desired, map)` → **idempotent** `{create, update, remove}` reconciliation (the core of
  Option B — without it every refresh would duplicate events), and `allDayRange` (Invalid-Date-safe).
- **`src/lib/calendar.ts` (native, silent, best-effort):** find-or-create the dedicated calendar,
  read/apply the plan via the SDK-57 object API (`getCalendars`/`createCalendar` → `ExpoCalendar`,
  `cal.createEvent`, `ExpoCalendarEvent.get(id).update()/.delete()`), persist a `key → {eventId, fp}`
  map in storage. Permission is requested **lazily** — only when there is actually something to add,
  and at most once (declining turns auto-sync off, never nags). `maybeSyncCalendar` throttles
  foreground syncs (15 min); `clearCalendarSync` removes this user's events on sign-out.
- **Wiring:** a root-level `CalendarGate` in `_layout.tsx` (beside `PushGate`) syncs on sign-in +
  foreground and clears on sign-out. Uses the SAME split as push — native imports never reach
  `store/auth`, and the sign-out cleanup needs no auth token so it lives in the gate (not `auth.tsx`).

**Gates:** `tsc` 0 · `npm test` **669** (+13 in `calendarSync.test.ts`) · eslint 0 errors.

## Honest ceilings / notes
- **Silent by design:** events appear in the "CGPE Connect" calendar with no in-app UI. Discoverable
  because the calendar is named and separable; a future on/off toggle + "last synced" line needs
  human i18n copy (no machine translation).
- **Reschedule/rename** propagate (fingerprint → update); **manual deletion** of an event by the user
  is re-created on the next sync (the app treats the assigned task as the source of truth).
- iOS uses the same code path (permission plist strings are in the plugin), but iOS is not a shipping
  target here (Phase 56).
- Not device-verified: `expo-calendar` is native (no Vitest stub), so the sync decisions are proven
  via `calendarSync.ts`; the actual event writes are device-only.

## Remaining
Batch APK (with 70/71/72) · on-device verify: a member with a dated task sees a "CGPE Connect"
calendar entry appear; completing it removes the entry; sign-out clears the entries.
