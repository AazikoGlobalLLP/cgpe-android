# HANDOFF — CGPE Connect (Android) — Phase 17 — 2026-08-11

One commit on `Shivam`: `140d020` (code + spec + docs).
**The branch is NOT pushed — `git push origin Shivam` still 403s.** Ten phases now sit locally.
Gates: `npx tsc --noEmit` exit 0 · `npm test` **258 passed / 9 files** · `npm run lint` 46 errors
(byte-identical to baseline).

## Done

- **Clocking out from outside the office fence now shows a warning naming the measured
  distance.** The write itself is unchanged: the clock-out still succeeds, the shift still
  closes, tracking still stops — Phase 7's rule that clock-out is never refused by the fence is
  untouched. The geofence check now also runs on the clock-out direction, purely to inform a
  warning shown *after* the write has already succeeded.
- **Clocking out from inside the fence, or with no fence known, shows nothing new** — unchanged
  from before this phase.

## Files changed

- `src/app/(tabs)/home.tsx` — `toggleClock`'s geofence pre-check now runs on both directions
  (`if (fix && !webDemo)` instead of gating on `!clock.in`); the blocking behaviour stays nested
  under the clock-in branch exactly as before. The clock-out branch captures the verdict in
  `clockOutFence` and reads it only after `api.clockOut()` has returned a non-blocked, `ok`
  result and local state has already flipped to "off duty".
- `src/data/api.ts` — the private `distanceText()` formatter is exported (one word). The
  clock-in refusal's `geo.message` is built from it internally; the new clock-out warning needed
  the same km/m rounding rule for its own sentence, since `geo.message` itself reads as nonsense
  after a clock-out ("Move about X closer to clock in").
- `docs/spec/PHASE-17.md` **(new)** — five locked decisions, the acceptance criteria, what was
  deliberately left out.
- `docs/{PHASES,PROJECT_MAP,DECISIONS}.md` — phase closed out per project convention.
- `../contracts/INBOX.md` — two writes, both grepped back after writing to confirm nothing was
  lost to a concurrent edit (see "Watch out for" below):
  1. Replied to a Phase-13 notice addressed to both `cgpe-admin` and `cgpe-mobile` (seven
     previously-dead routes now reachable): confirmed the Android app calls none of them, and
     does not call `PUT /api/leads/:id/transfer` either. Box left unticked — addressed to
     `cgpe-admin` as well.
  2. Filed a new observation to `cgpe-api`: `/clock-out` computes `out_of_bounds`/`distance_m`
     on every call and discards both before the response is built (`timeTracker.js:498-518`,
     `:553-561`); this phase's fix now duplicates that computation client-side. Not a request —
     recorded because the field already exists in memory and is thrown away.

## Decisions made

- **One `checkGeofence()` call, widened to run on both directions, not a second call.** See
  `docs/DECISIONS.md`'s two 2026-08-11 entries for the full reasoning — `geo.message` is
  clock-in-specific text and isn't reusable for the clock-out warning, and `distanceText` is
  exported rather than reimplemented so the two warnings share one rounding rule.
- **The warning is read only after the write has already succeeded** — same shape as Phase 7's
  own "Shift started, route not recorded" warning: beside a real success, never ahead of or
  instead of one.
- **The server-side fix (returning `out_of_bounds`/`distance_m` from `/clock-out` so this app
  could read the write's own reply instead of a second `checkGeofence` call) is filed as an
  observation to `cgpe-api`, not waited on.** Named in the Phase 17 spec as the more
  architecturally clean fix, but re-deriving the verdict client-side needed no contract change,
  so building it now rather than waiting was the right call — same logic Phase 7 used for the
  geofence pre-check itself.

## Known broken / deliberately skipped

- **The branch is not pushed — `git push origin Shivam` returns 403** — re-confirmed this
  session, unchanged. Ten phases of local-only work now. Needs a human to grant
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION` write access or swap the credential in Windows
  Credential Manager.
- **Phase 17 added no new test file.** The change is entirely inside `toggleClock`'s imperative
  write-path handler, which has zero test coverage on either side of this diff — same class as
  `generateReport` before Phase 8.
- **Everything already carried from Phases 1, 4, 5 and 7's handset-only acceptance criteria
  remains unverified** — no device work happened this session (haptics, the AsyncStorage clock
  key, background GPS, a shift's route appearing under the master's replay, and airplane mode
  reaching "could not be recorded").
- **`src/screens/dashboards.tsx:292-297` still shows all-zero Master KPI tiles on a partial
  outage** — still in no phase's file list. Carried since Phase 3.
- **`addTask`, `reassignTask`, `toggleReminder`, `toggleTaskStep`, `toggleClaimDoc` still
  fabricate success** — Phase 9, blocked on `cgpe-api`.

## Next session starts here

- **Phase 11 is next per `docs/PHASES.md`'s "Next 3"** — server-derived tier. `store/roles.ts`
  still grants the top privilege tier by string-matching a personal email address compiled into
  every APK; derive it from the server's own role/claims instead.
  **Files:** `src/store/roles.ts`, `src/store/auth.tsx`, `src/data/api.ts`,
  `src/app/(tabs)/more.tsx`. **Done when:** no email address literal remains in `src/`, and the
  master experience survives that person changing address.
- First command: `npm test`.
- Watch out for: **`../contracts/INBOX.md` kept changing mid-session** — it grew from 2063 to
  2113 lines while Phase 17 was being built, and the new content was a fresh item addressed to
  this session that had to be answered before closing out. Re-read it fresh at the next boot
  regardless of what this handoff says, anchor any edit on surrounding text rather than a line
  number, and grep your own reply back immediately after writing it.
