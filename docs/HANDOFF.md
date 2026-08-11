# HANDOFF — CGPE Connect (Android) — Phase 7 — 2026-08-10

Two commits on `Shivam`: `3e092ad` (code + spec + tests) · `fc09934` (the review fixes).
**The branch is NOT pushed — `git push` still returns 403. Seven phases now sit locally.**
Gates: `npx tsc --noEmit` exit 0 · `npm test` **258 passed / 9 files** · `npm run lint` 46 errors
(byte-identical to baseline).

## Done

- **The app no longer enforces a fence the server never agreed to.** It carried its own copy — a
  Surat pin, 2 km radius, `enforce:true`, compiled into the APK — against a server default of
  200 m: ten times wider than the server at the office and absolutely closed everywhere else,
  including an office the master had legitimately moved the fence to.
- **An unreachable `/geofence` no longer blocks clock-in.** The client pre-check may never refuse
  what the server would allow; it exists to save a round trip, and `clock-in` re-validates against
  the one real fence on every request regardless. An unknown fence now allows and says nothing,
  and the server answers in its own words.
- **Nothing is cached.** The old cache poisoned itself on the first failed fetch for the life of
  the process — signing out and back in as someone else kept it — and, per the review, its success
  half was a second staleness bug: a master's fence move would not reach a phone open since
  morning. Deleting the cache made both structurally impossible instead of carefully handled.
- **No UI copy states a fence size.** The refusal now names a measured distance and how much
  closer to move — numbers that cannot disagree with the server the way a quoted radius can.
- **`postTrackPoints` requires an explicit session id and refuses to fetch without one** — closing
  D5's hole by a different route than D5 named: the app already sent `session_id`, but
  `JSON.stringify` drops a key whose value is `undefined`, producing exactly the session-less body
  D5 warns about. A sid-less post is worse than a 400: the server resolves the owner from the
  token, so on a shared handset it lands on whoever is signed in now.
- **A shift with no session id records no route and says so on the clock-in banner**, instead of
  silently tracking nothing.
- **Delivery has five outcomes, not two**, and a 401/429 no longer deletes a buffered route. The
  review caught this as a regression the phase itself introduced: classifying any 4xx as `refused`
  turned a routine 24 h token expiry into a deleted afternoon of route, repeating all shift in a
  headless wake because `expireSession` has no subscriber when `AuthProvider` never mounted.

## Files changed

- `src/data/api.ts` — `FALLBACK_GEOFENCE` deleted; `getGeofence` → `Geofence | null`, caches
  successes only until the review deleted the cache entirely; `checkGeofence` gains `known`,
  coerces + clamps the accuracy tolerance, new copy; `postTrackPoints` → five-outcome
  `TrackDelivery` union, requires a session id, reads `added`.
- `src/lib/tracker.ts` — `deliver` consumes the union; `refused` drops the buffer, `signed-out`
  stops the service; `startTracking` refuses to start without a session id.
- `src/app/(tabs)/home.tsx` — a clock-in that succeeds without a session id says the shift started
  but the route is not being recorded.
- `src/data/__tests__/api-geo.test.ts` — the two remaining Phase-2 pins flipped; the now-empty
  pinned-bugs block deleted; fallback cases rewritten around "unknown".
- `src/data/__tests__/api-track.test.ts` **(new, wire contract for `/track/points`, `/track/start`,
  `/track/stop`, `/geofence`)**.
- `docs/spec/PHASE-7.md` **(new)** — fourteen locked decisions, eleven acceptance criteria,
  what the review found, out-of-scope list.
- `docs/{PHASES,PROJECT_MAP,DECISIONS,STATUS}.md`, `CLAUDE.md`, `../contracts/INBOX.md`.

## Decisions made

- **The client pre-check may never refuse what the server would allow.** The phase's central rule.
  It exists to save a round trip on a refusal that is certain; where it cannot be certain, it
  allows and lets `clock-in` answer, because that endpoint is the authority.
- **The phase's own stated justification was wrong, and the real one is better.** "An unreachable
  `/geofence` locks a branch office out" cannot happen — there is one global fence and the server
  re-validates every request. Failing open moves the refusal one round trip later; it does not
  admit anyone the server would refuse. The honest reason is that the pre-check should say nothing
  when it cannot know the answer.
- **The server's `accuracy > 300` rejection is deliberately not mirrored.** Copying it would spend
  a round trip to duplicate a threshold that lives in someone else's file and can move, and it
  would make the client refuse — which the central rule forbids.
- **A split adversarial vote is a signal, not a dismissal.** Both real defects the review caught
  came from findings where one skeptic refuted and one did not; the strict "unanimous non-refutal"
  bar alone would have discarded both. Read split votes by hand.
- **A phase is reviewed adversarially before it is called done** (Phase 4's rule, held through
  Phase 5, held here). Four lenses, 26 findings, 52 verdicts, four non-refutations, two real
  defects fixed in `fc09934`.

## Known broken / deliberately skipped

- **The branch is not pushed — `git push` returns 403** — unchanged, now seven phases of local
  work. Needs a human to grant `Dev-Shivam-05/CGPE-ANDROID-APPLICATION` write access or swap the
  credential in Windows Credential Manager.
- **INBOX D5 and D10 are both closed on this session's side** — see `docs/PHASES.md`'s "Open INBOX
  items" section. Nothing is open against `cgpe-mobile` as of this close.
- **Phase 7 acceptance criteria 10–11 are unverified** — they need a handset: a shift's route
  appearing under the master's replay, and airplane mode reaching "could not be recorded" rather
  than "Too far to clock in".
- **Phase 1 acceptance criteria 1–6 are still unverified** — haptics, an AsyncStorage clock key and
  background GPS need a handset in airplane mode. Seven phases have not covered them.
- **The server's own refusal copy still says "within 0.2 km"**, understating its own fence by the
  accuracy credit. Rendered verbatim on a 403 per Phase 5's quote-the-producer rule. `cgpe-api`'s
  to fix; filed again in the INBOX.
- **`POST /track/points` has no ownership check** — any staff token can append points to any
  session id, or invent one. Same class as Phase 5's finding on the WhatsApp send endpoint. Filed
  as an observation.
- **The server silently discards every tracking point whose accuracy is worse than 100 m**, and the
  app records at `Accuracy.Balanced` — documented by Expo as accurate to within 100 m, i.e. right
  at the server's discard threshold. Not this phase's fix; filed with numbers for the product owner.
- **`clockIn` reports a 409 "Already clocked in" as "The server could not be reached."** Real, same
  honesty class this project fixes first, but a clock-state bug rather than a geofence or tracking
  one. Recorded for its own phase, not absorbed here.
- **Signing out does not stop a running route service.** Related to the shared-handset finding
  above; worth its own look.
- **`services/attendanceWatchdog.js` re-implements the fence with no accuracy tolerance and never
  reads `enforce`**, so turning the fence off still generates out-of-bounds WhatsApp nudges.
  Backend-side; filed.
- **`src/screens/dashboards.tsx:292-297` still shows all-zero Master KPI tiles on a partial
  outage** — still in no phase's file list. Carried since Phase 3.
- **`addTask`, `reassignTask`, `toggleReminder`, `toggleTaskStep`, `toggleClaimDoc` still fabricate
  success** — Phase 9. **`generateReport` still invents ₹42,00,000** — Phase 8.

## Next session starts here

- Phase 8: delete the last fabricated-data path — `generateReport` returns `null` on failure
  instead of inventing ₹42,00,000 of cover — and correct the stale docs (`config.ts`'s five
  now-false comments, `HOW_TO_RUN.md` / `TESTING_GUIDE.md`'s offline-demo-mode and localhost-default
  claims, neither of which exists any more).
- **Files:** `src/data/api.ts`, `src/constants/config.ts`, `src/data/tasks.ts`, `src/data/team.ts`,
  `HOW_TO_RUN.md`, `TESTING_GUIDE.md`.
- **Done when:** grep for `source: 'demo'` returns nothing, and no doc in the repo describes sample
  data.
- First command: `npm test`.
- Watch out for: **`../contracts/INBOX.md` deletes content, not just moves it** — re-read
  immediately before editing, anchor every edit on surrounding text rather than a line number, and
  grep your own reply back after you write it. Nothing is currently open against this session, but
  a sibling can add an item mid-session.
