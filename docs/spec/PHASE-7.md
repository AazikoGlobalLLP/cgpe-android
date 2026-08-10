# PHASE 7 — Geofence and tracking correctness

Session `cgpe-mobile`. Written 2026-08-10, before a line changed, from a full read of
`cgpe-backend-main/utils/geofence.js` (105 lines), `cgpe-backend-main/routes/timeTracker.js`
(1432 lines), `contracts/api.md` §time-tracker, and the app's own geofence + tracking paths.

Closes `contracts/INBOX.md` **D5** and this session's half of **D10**.

---

## The one-sentence goal

Stop the app enforcing a fence the server never agreed to, and stop it posting GPS points that
cannot be attributed to a shift.

## DONE WHEN (from `docs/PHASES.md:201-206`)

1. A buffer replayed after clock-out uploads successfully.
2. With `/geofence` unreachable, clock-in is allowed rather than blocked by hardcoded Surat
   coordinates.
3. No UI copy says "200 m".

---

## 1. What is actually broken — verified, with citations

### 1.1 The offline fence is not the server's fence, in either direction

| | server | app |
|---|---|---|
| radius when unconfigured | **200 m** `utils/geofence.js:27` | **2000 m** `api.ts:1494` |
| accuracy credit | `Math.min(acc, 100)` `geofence.js:93` | `Math.min(accuracy, 100)` `api.ts:1522` |
| coarse-fix rejection | `acc > 300` → refuse `geofence.js:89` | **absent** |
| accuracy type handling | `Number(accuracy)` `geofence.js:88` | `typeof accuracy === 'number'` `api.ts:1522` |
| negative accuracy | credited as negative (bug) `geofence.js:93` | credited as negative (bug) `api.ts:1522` |
| distance maths | identical | identical |

The app's offline fence is therefore **ten times wider than the server's at the office pin and
absolutely closed everywhere else**. It is not "fail closed"; it is *fail wrong* — lax where the
server is strict, strict where the server would never have been asked.

### 1.2 One failed fetch decides the fence for the life of the process

`api.ts:1495-1502`. `_geoCache` is assigned on the **first** call, from `tryReal`, which returns
`null` on a throw, on any non-2xx and on a 200 whose body has no finite `lat`. Nothing clears it —
grep of `src/` returns only `api.ts:1495/1499/1501/1502`, and `setAuthToken` (`api.ts:60-66`)
clears `suppressed` but not this. **Signing out and back in as a different person keeps the
poisoned fence.** Recovery needs an app restart.

Worse, a `404`/`501` on `/time-tracker/geofence` is *suppressed* by `reportIfOutage`
(`api.ts:128-131`) because it is an answer rather than a fault — correctly, for the banner. So if
that route is simply not deployed, the user gets a silent, permanent, wrong 2 km Surat fence with
no outage indication at all.

### 1.3 A client refusal never reaches the server

`home.tsx:788-796` hard-returns before `api.clockIn` at `:832`. So every case where the client is
stricter than the server is a clock-in the server would have accepted and never heard about.
Two such cases exist today: a numeric-**string** accuracy (client tolerance 0, server 100) and a
**negative** accuracy (client makes the fence stricter, no `Math.max(0, …)`).

### 1.4 The phase text's stated benefit is wrong, and it matters

> "so an unreachable `/geofence` stops locking a whole branch office out of clocking in"

There is **one** global fence: a single `org_settings` document, `_id: 'office_geofence'`
(`timeTracker.js:1284-1292`), and `clock-in` re-validates against it unconditionally
(`timeTracker.js:319-329`, whose own comment says *"the server is the authority — a tampered app
cannot bypass this"*). A branch office more than ~300 m from that pin is refused **by the server**,
reachable `/geofence` or not. Failing open moves the refusal one round trip later and changes the
wording; it does not admit anybody the server would refuse.

**That is the actual argument for the change, and it is a better one.** The client pre-check exists
to save a round trip, not to be a second authority. When it cannot know the fence, the honest thing
is to say nothing and let the server answer — in the server's own words.

### 1.5 D5 is right about the backend and wrong about this app

Every clause of D5 about the server checks out: `timeTracker.js:1339` reads `req.body.session_id`
with no camelCase alias, falls through to `resolveActiveSession` on any falsy value, and
`:1340` returns `400 {success:false, message:'No active session — clock in first.'}` (em dash,
U+2014) when none resolves. `DayLog.endSession` nulls `activeSessionId`, so after clock-out the
resolve returns null.

But **the app already sends `session_id`** — `api.ts:1633/1638/1643` — so the replay case D5
describes does not occur on the normal path. The failure survives by a different route:

**`JSON.stringify({ session_id: undefined, points })` omits the key entirely**, producing exactly
the body D5 warns about. Reachable whenever `sid` is undefined: `clockIn`'s three-shape dig
(`api.ts:1542`) missing the id, or the OS firing the task with `STATE_KEY` absent or corrupt
(`tracker.ts:129` returns a state with no `sid`) while the service is still registered.

**And a sid-less post is worse than a 400.** `resolveActiveSession` resolves from the **token**
(`timeTracker.js:1311`, `userId: profileId` from `req.user._id`). On a shared handset where user A's
service is still running after user B signs in, A's buffered points post with B's token and land on
**B's session**. `startTracking` already guards the mirror image of this (`tracker.ts:356-359`,
"on a shared handset could belong to a different person entirely"); the sid-less post is the hole
that guard does not cover.

### 1.6 A refusal is indistinguishable from an outage, and the buffer pays for it

`api.ts:1636-1639` collapses everything to a boolean: a 400 gives `ok === false`, a throw is caught
and returns `false`. `tracker.ts:167-168` maps both to `'retry'`, and `ingest` (`:254-255`) keeps
the buffer. So a permanently-refused batch is retried on every wake-up until `MAX_POINTS` evicts it,
and nothing is ever reported to `health.ts`.

### 1.7 The server silently discards points the app is configured to produce

`timeTracker.js:1350` drops every point whose accuracy is worse than 100 m, then `:1351` answers
`200 { success: true, added: 0 }` if that leaves nothing. The app requests
`Location.Accuracy.Balanced` (`tracker.ts:371`) — expo documents that as *accurate to within one
hundred metres*, i.e. the app is recording **exactly at the server's discard threshold**. The app
reads only `ok`, so a batch the server threw away entirely is reported as delivered and the buffer
is cleared. This is not a fix this phase makes (see §5) but it is why `added` starts being read.

---

## 2. Locked decisions

**D-1. The client pre-check may never refuse what the server would allow.** This is the phase's
central rule and every decision below follows from it. The pre-check's only job is to save a round
trip on a refusal that is certain. Where it cannot be certain, it allows and lets
`POST /clock-in` answer — that endpoint is the authority (`timeTracker.js:317-318`) and its refusal
carries the server's own message, distance and radius.

**D-2. The hardcoded Surat fence is deleted, not widened.** `FALLBACK_GEOFENCE` is a coordinate and
a radius invented in the app that has to match a row in someone else's database. `cgpe-api` filed
that exact hazard against the panel as **D13** ("two copies of an unversioned default set in two
repos is still one drift away from a preview that lies"). An unknown fence is now represented as
**unknown** — `getGeofence()` returns `Geofence | null` — rather than as a guess.

**D-3. Only a successful fetch is cached.** A failure leaves `_geoCache` null so the next clock-in
tap retries. At most one extra request per tap, and the poisoned-for-the-session state disappears.

**D-4. `enforce:false` and "fence unknown" stay distinguishable in the return type.**
`checkGeofence` gains `known: boolean`. Both allow, but only one of them means the server has told
us the fence is off. A caller that cannot tell them apart cannot write honest copy later.

**D-5. The refusal copy states no fence size.** It states the measured distance and how much closer
to move: *"You're 480 m from the office. Move about 280 m closer to clock in."* Both numbers are
computed from values we actually hold, the second one already includes the accuracy credit, and
neither can disagree with the server the way a quoted radius does. This is what closes D10's *"any
UI copy that states 200 m will disagree with the server"* — **without duplicating the server's own
stale wording**, which still renders "within 0.2 km" (`geofence.js:101`) and is `cgpe-api`'s to fix.

**D-6. Distances under a kilometre render in metres**, rounded to 10 m, with a non-breaking space
(`lib/format.ts`'s rule: every space inside a value is U+00A0). `(200/1000).toFixed(1)` = "0.2 km"
is the shape of the server's stale message; a 200 m fence is a metres-scale fact and reads as one.

**D-7. The accuracy tolerance is coerced like the server and clamped at zero.** `Number(accuracy)`
matches `geofence.js:88` and removes the string-accuracy divergence; `Math.max(0, …)` removes the
negative-accuracy case where the app is stricter than the server. Both moves are permitted by D-1
because both make the client *more* permissive, never less. **The server's own negative-accuracy
bug is left alone** — it is `cgpe-api`'s code and matching a bug is not agreement.

**D-8. The server's `accuracy > 300` rejection is deliberately NOT mirrored.** Mirroring it would
copy a threshold that lives in `geofence.js:89` and can move, to buy one round trip — and it would
make the client refuse, which D-1 forbids. A weak fix now reaches the server and comes back as a
403 carrying *"GPS signal is too weak to confirm you are at the office. Move to open sky and try
again."*, which is better copy than anything we would compose. **Consequence, stated so it is not
a surprise: the client pre-check can no longer be one-for-one with the server, by design.**

**D-9. Points are never posted without an explicit session id.** `postTrackPoints` requires one.
This makes the D5 body impossible to construct rather than merely unlikely, and it closes §1.5's
shared-handset misattribution — the only alternative is to let the server guess the owner from the
token, and the token is the thing that changes on a shared phone.

**D-10. A shift whose session id is unknown records no route, and says so on the screen.** If
`clockIn` returns `ok` without a session id, `startTracking` is not called and the clock-in banner
says the shift started but the route is not being recorded. A route recorded against nothing is
worse than no route — it burns battery, holds a notification, collects a person's location all day,
and delivers nothing. The attendance record itself is unaffected; it lives on the server either way.

**It is deliberately NOT reported through `health.ts`.** That channel says "we could not load
this" and raises the global outage banner. The clock-in *worked*; the body was usable for the
thing it was for. Raising an outage would be a second lie in the opposite direction, which is the
mistake Phase 3 spent a whole phase not making (401/403/404 are answers, not faults).

**D-11. Delivery has four outcomes, not two.** `postTrackPoints` returns
`'sent' | 'refused' | 'retry' | 'no-session'`. `refused` (any 4xx — the server understood and said
no) drops the buffer, because retrying cannot help; `retry` (network, timeout, 5xx) keeps it.
Same distinction Phase 1 drew with `WriteFailure`'s `invalid` and `unsupported`, and Phase 5 drew
with the `delivery` union: **the status code is not the outcome, the body's verdict is.**

**D-12. `added` is read and returned.** The server answers `{ success:true, added:N }`
(`timeTracker.js:1368`) and N can be **0** for a batch it accepted and entirely discarded. The
buffer is still cleared — re-sending would be discarded identically — but the number stops being
invisible, and §5 files the underlying accuracy floor to `cgpe-api`.

**D-13. `stopTracking` still drops the last leg on a failed final flush, unchanged.** The existing
docstring (`tracker.ts:416-419`) argues it correctly: the shift is over, nothing will wake to retry,
and a stale bag of one person's coordinates on a shared handset is worse than a route missing its
last minute. This phase does not reopen a decision that was already made honestly.

**D-14. The phase is reviewed adversarially before it is called done.** Phase 4's rule, held in
Phase 5, held here.

---

## 3. Files

| File | Change |
|---|---|
| `src/data/api.ts` | `FALLBACK_GEOFENCE` deleted; `getGeofence` → `Geofence \| null`, caches successes only; `checkGeofence` gains `known`, coerces + clamps the tolerance, new copy; `postTrackPoints` → `TrackDelivery` union, requires a session id, reads `added`; `startTrack`/`stopTrack` require one too |
| `src/lib/tracker.ts` | `deliver` consumes the union; `refused` drops the buffer, `no-session` stops the service; `startTracking` refuses to start without a session id |
| `src/app/(tabs)/home.tsx` | a clock-in that succeeds without a session id says the shift started but the route is not being recorded, instead of silently tracking nothing |
| `src/data/__tests__/api-geo.test.ts` | the two Phase-2 pins flip; the fallback cases are rewritten around "unknown" |
| `src/data/__tests__/api-track.test.ts` | **new** — the wire contract for `/track/points`, `/track/start`, `/track/stop` and `/geofence` |

`src/lib/format.ts` gains no code; `nbsp` is imported from it.

## 4. Acceptance criteria

1. `GET /time-tracker/geofence` unreachable (network error, 500, 404 or a 200 with a junk body) →
   `checkGeofence` returns `allowed: true`, `known: false`, and clock-in proceeds to the server.
2. That failure is **not** cached: a second call re-requests, and a later success is cached.
3. `enforce: false` from the server → `allowed: true`, `known: true`.
4. A refusal message contains no fence size, renders metres under 1 km with U+00A0, and names how
   much closer to move.
5. Accuracy `'100'` (string) and accuracy `-200` both produce a verdict at least as permissive as
   accuracy `0` at the same point.
6. `postTrackPoints` with no session id performs **no fetch** and returns `no-session`.
7. With a session id, the request body is exactly `{ session_id, points }` with `session_id`
   snake_case, and each point carries only `lat`/`lng`/`at`/`accuracy`/`speed`/`heading`.
8. A 400 from `/track/points` returns `refused` and the tracker drops the buffer; a network throw
   returns `retry` and the tracker keeps it.
9. A 200 `{ success: true, added: 0 }` returns `sent` with `added: 0`.
10. **Device:** clock in at the office, walk out of range, clock out — the route appears under the
    master's shift replay with a non-zero point count.
11. **Device:** with the phone in airplane mode, tapping clock-in reaches the "could not be
    recorded" banner rather than "Too far to clock in".

## 5. Deliberately out of scope

- **The server's stale "within 0.2 km" copy** (`geofence.js:101`) and its understatement of its own
  fence by the accuracy credit. `cgpe-api`'s file. We render it verbatim on a 403, per Phase 5's
  rule about quoting the producer — it is awkward, not jargon. Flagged again in the INBOX.
- **`POST /track/points` has no ownership check** — `timeTracker.js:1359` filters on `session_id`
  alone with `{ upsert: true }`, so any staff token can append points to any session id, or invent
  one. Same class as Phase 5's finding on `POST /whatsapp/hub/send`. Filed as an observation.
- **The 100 m accuracy floor** (`timeTracker.js:1350`) versus the app's `Accuracy.Balanced`
  (`tracker.ts:371`). Raising recording accuracy is a battery-versus-fidelity trade for the product
  owner, not a bug fix. Filed with numbers.
- **`clockIn` reports a 409 "Already clocked in" as "The server could not be reached."**
  (`api.ts:1541` → `home.tsx:847-855`). Real, and the same honesty class this project fixes first —
  but it is a clock-state bug, not a geofence or tracking one, and absorbing it here is the
  scope-creep `docs/PHASES.md` forbids. Recorded for its own phase.
- **Signing out does not stop a running route service.** Related to §1.5 and worth its own look.
- **`services/attendanceWatchdog.js` re-implements the fence with no accuracy tolerance and never
  reads `enforce`**, so turning the fence off still generates out-of-bounds WhatsApp nudges.
  Backend-side; filed.
