# HANDOFF — CGPE Connect (Android) — Phases 72 (mobile) + 73 built & pushed — 2026-08-20

Owner batch #3 and #4 of the 70–73 set. **Phase 72 (team push) mobile half is built and PENDING the
backend + Firebase** — do not mark it done or cut the APK until the owner signals the backend is live.
**Phase 73 (phone-calendar auto-sync) is fully built and pushed.** With 70 & 71 already done, the whole
70–73 batch is now built on the mobile side; the one remaining gate before the combined APK is Phase
72's backend + Firebase setup.

## Done
- **Team push — the phone half.** When the backend + Firebase are wired, a new department task /
  reassignment / new lead / due-reminder will send a REAL push that wakes a closed phone for that whole
  team; the app registers its push token on sign-in, shows the banner, and opens the Tasks/Leads tab on
  tap. Today it is dormant (no backend endpoint, no FCM) but degrades silently — no crash, no banner.
- **Phone-calendar auto-sync (owner chose Option B).** A member's assigned tasks + reminders now
  auto-appear in a dedicated **"CGPE Connect"** phone calendar and stay in sync — a completed/deleted
  task's event is removed, a renamed/rescheduled one updates, and sign-out clears that user's entries.
  Undated tasks are skipped (never faked onto today). Silent; permission asked once, only when there's
  something to add.
- Gates green both phases: `tsc` 0 · `npm test` **669** (was 644 → +12 push, +13 calendar) · eslint 0
  errors. Both committed and pushed to `aaziko/Shivam` (`64f1afc`, `aa8469f`).

## Files changed
- `app.json` — added `expo-notifications` + `expo-calendar` config plugins; `POST_NOTIFICATIONS`,
  `READ_CALENDAR`, `WRITE_CALENDAR` permissions.
- `package.json` / `package-lock.json` — `expo-notifications@~57.0.12`, `expo-calendar@~57.0.2`.
- `src/lib/pushRouting.ts` — NEW pure+tested: `routeForPush` (tap→tab), `shouldReRegister`.
- `src/lib/push.ts` — NEW native, fail-quiet: permission/channel/Expo-token, foreground handler, tap +
  cold-start routing.
- `src/lib/pushToken.ts` — NEW: `clearPushRegistration` + `SENT_TOKEN_KEY`, split out so `store/auth`
  (in the Vitest graph) never imports `expo-notifications`.
- `src/lib/calendarSync.ts` — NEW pure+tested: `buildSyncItems` (skip undated/completed), `planSync`
  (idempotent create/update/delete), `fingerprint`, `allDayRange`.
- `src/lib/calendar.ts` — NEW native, silent: find-or-create calendar, apply the plan via the SDK-57
  object API, key→{eventId,fp} map, lazy permission, sign-out cleanup, throttle.
- `src/data/api.ts` — `registerPushToken` / `unregisterPushToken` (silent, best-effort).
- `src/store/auth.tsx` — `logout()` calls `clearPushRegistration()` before the token is cleared.
- `src/app/_layout.tsx` — `PushGate` + `CalendarGate` root components.
- `src/lib/__tests__/{pushRouting,calendarSync}.test.ts` — NEW (+12, +13).
- `docs/spec/PHASE-72.md`, `docs/spec/PHASE-73.md` — NEW specs.
- `../contracts/INBOX.md` — filed the Phase-72 backend + Firebase ask to `cgpe-api` (owner relays).

## Decisions made
- **Phase 72 = Tier B real push** (owner-chosen), transport **Expo Push (`expo-server-sdk`)** over raw
  `firebase-admin` — least backend code, standard Expo path. All four triggers; recipients = everyone in
  the dept. Backend endpoints + `broadcastToDepartment` + `sendPush` + FCM are backend/infra (filed).
- **Native modules must stay out of the Vitest graph.** Importing `expo-notifications`/`expo-calendar`
  from a file the tests reach breaks Node with `__DEV__ is not defined` (via `expo-modules-core`). Fix:
  split the non-native slice into its own file (`pushToken.ts`) and keep native code only in modules
  that only `_layout` imports (`push.ts`, `calendar.ts`). See DECISIONS 2026-08-20.
- **Phase 73 = Option B auto-sync**, defaults (all vetoable): both tasks + reminders; SKIP undated;
  all-day events; dedicated removable calendar; silent (no new i18n copy needed — a toggle would).
  Idempotent reconciliation is the anti-duplicate core and is unit-tested.

## Known broken / deliberately skipped
- **Phase 72 delivers NO push yet** — needs (a) the backend build (device-token store,
  `/push/register`+`/unregister`, `broadcastToDepartment`, `sendPush`, 4 trigger wirings) and (b) a
  **Firebase/FCM project** (owner/infra HARD prereq). Both filed to INBOX; owner relays. Marked PENDING.
- **No combined APK cut** — per the owner's "build the batch, then ONE APK" rule, the APK waits until
  Phase 72's backend + Firebase are live, so it ships with working push, not a dormant half.
- **Device-unverified** — `expo-notifications` and `expo-calendar` are native (no Vitest stub). The pure
  decisions are tested; the actual token fetch, push delivery, and calendar writes are device-only.
- **iOS** not targeted (Phase 56); a push tap has no per-item detail route so it lands on the tab.

## Next session starts here
- **Phase 72 executes on the owner's "backend ne kaam kar diya" signal**: verify the backend against its
  real code (fetch + `git merge-base --is-ancestor <commit> origin/main` + a no-auth curl → 401=live,
  404=not) and that FCM is configured, confirm the app registers a token + a test push arrives, then cut
  the **ONE combined APK** (70+71+72+73). If no signal yet, Phase **65** (full-staff monitor roster from
  the now-live `/live-locations`) is the one remaining un-built mobile piece.
- First command: `/boot`
- Watch out for: **do NOT cut the APK or mark Phase 72 done until the backend + Firebase are verified
  live** — a push-less APK would look "done" but buzz nothing. And keep native imports out of any file
  the tests reach (the `__DEV__` trap above).
