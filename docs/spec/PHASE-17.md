# PHASE 17 — Warn on an out-of-bounds clock-out

Session `cgpe-mobile`. Written 2026-08-11, before a line changed, from a full read of
`src/app/(tabs)/home.tsx`'s `toggleClock` (the only clock-in/out handler) and `src/data/api.ts`'s
`checkGeofence` / `distanceText` / `clockOut`.

---

## The one-sentence goal

Clocking out from outside the office fence keeps succeeding exactly as it does today, and now also
shows a warning naming the measured distance — never a refusal, never a quoted radius.

## DONE WHEN (from `docs/PHASES.md`'s Phase 17 section)

1. Clocking out from outside the fence still succeeds exactly as it does today.
2. That clock-out additionally shows a warning stating the measured distance (no quoted radius —
   same convention as Phase 7's D-5/D-6).
3. Clocking out from inside the fence shows no warning, unchanged from today.

---

## 1. What is actually true today — verified, with citations

`home.tsx:778-806` (pre-fix) runs `api.checkGeofence()` only when `!clock.in`, i.e. only on the
way in. The comment directly above it already states the rule this phase must not break:

> CLOCK-OUT IS NO LONGER FENCED. Agents finish the day at a client's home, and making them return
> to the office to end a shift means clocking out the next morning instead, so the record stops
> being true. The backend records the clock-out coordinates and flags out-of-bounds rather than
> refusing the write.

`api.ts`'s `checkGeofence()` (`:1607-1636`) already computes everything a warning needs —
`allowed`, `known`, `distance_m`, `radius_m` — and Phase 7 built it to never refuse anything the
server would allow. It has exactly one caller today (the clock-in pre-check), so calling it a
second time, from the clock-out branch, changes nothing about its own contract.

**One thing that is not reusable as-is: `geo.message`.** It is composed for the clock-in refusal
specifically — `` `You're ${distanceText(dist)} from the office. Move about ${distanceText(dist -
radius_m)} closer to clock in.` `` (`api.ts:1634`). "Move closer to clock in" is nonsensical after
a clock-out has already succeeded, so the clock-out warning needs its own sentence built from
`distance_m` directly, not `geo.message` verbatim.

**The server never blocks a clock-out on the fence.** Confirmed against the phase text in
`docs/PHASES.md` (citing `timeTracker.js:488-497`, `:498-518`, `:553-561`): `/clock-out`'s response
is `{ session, totalWorked, totalBreak }` with no fence verdict in it, persisted or not. The
existing `res.blocked` branch in the clock-out arm of `toggleClock` (`:813-817`, unchanged by this
phase) is therefore not the path a geofence rejection reaches — it exists for some other 403 shape,
untouched here and out of scope.

## 2. Locked decisions

**D-1. The geofence check runs on both directions of `toggleClock`, not just clock-in.** Rather
than adding a second `api.checkGeofence()` call, the existing `if (fix && !webDemo && !clock.in)`
guard is widened to `if (fix && !webDemo)`, and the blocking behaviour stays nested under
`!clock.in`. One call, two uses — matches the function's own doc comment ("this returns null on
any failure... `checkGeofence` is the only caller and it runs once per clock-in tap" no longer
being quite true, but the "may never refuse what the server would allow" contract is unchanged and
is what actually matters).

**D-2. The verdict is captured before the write and read after it succeeds.** `clockOutFence` is
set from the pre-write `checkGeofence()` call, but the warning is only shown after
`api.clockOut()` has returned a non-blocked, `ok` result and local state has already flipped to
"off duty". A warning must never appear ahead of, or instead of, the success it is decorating —
same shape as Phase 7's own route-recording warning ("Shift started, route not recorded") that
fires beside a real clock-in success.

**D-3. The clock-out warning states the measured distance and nothing else.** No radius, quoted or
otherwise — `radius_m` is available on the verdict object and is deliberately not read. Same
convention as D-5/D-6 from Phase 7: a number this app states must be true from where the person is
standing, not a fence size that can move on the server without this app knowing.

**D-4. `distanceText` is exported from `api.ts` rather than reimplemented in `home.tsx`.** It
already does exactly the formatting this warning needs (nbsp-joined, km above 1000 m, a 10 m
floor) and is the same function the clock-in refusal's `geo.message` is built from. The alternative
— a second copy of the same rounding/unit logic in `home.tsx` — would be a formatting rule that can
silently drift from its own precedent. One word changed (`function` → `export function`); no
behaviour in `api.ts` changes.

**D-5. `geo.message` is not reused for the clock-out warning.** See §1 — it is a clock-in sentence.
The clock-out warning is a new one-line template built from `clockOutFence.distance_m` via
`api.distanceText()`.

## 3. Files

| File | Change |
|---|---|
| `src/app/(tabs)/home.tsx` | `toggleClock` — widen the geofence pre-check to run on both directions; capture the clock-out verdict; show a warning after a successful clock-out when it says out-of-bounds |
| `src/data/api.ts` | export the existing `distanceText` helper so the new warning can reuse it instead of duplicating the formatting rule (D-4) — the only file not in the phase's original one-file list, forced by D-4, not new scope |

## 4. Acceptance criteria

1. `npx tsc --noEmit` and `npm test` stay green (258 tests, 9 files — this phase adds no new pure
   logic to pin; the change is entirely in the imperative write-path handler).
2. `npm run lint` stays at the 46-error baseline.
3. Clocking out with a fix that `checkGeofence` marks `allowed: true` (inside the fence, or an
   unknown/disabled fence) shows no new notice — unchanged from before this phase.
4. Clocking out with a fix that `checkGeofence` marks `known: true, allowed: false` still performs
   the clock-out write, still stops local tracking, still flips local state to "off duty", and
   additionally shows a warning naming the measured distance.
5. The write itself (`api.clockOut`) is never made conditional on the geofence verdict — the only
   new branch reads `clockOutFence` after the existing `res.blocked` / `!res.ok` early-returns.

## 5. Deliberately out of scope

- **Teaching `/clock-out`'s response to return `out_of_bounds`/`distance_m` itself**, so the
  warning could be built from the write's own reply instead of a second `checkGeofence` call. Named
  in `docs/PHASES.md` as the more architecturally clean fix and worth filing to `cgpe-api`
  regardless — not this phase's blocker, since re-deriving the verdict client-side needs no
  contract change and the app already has the exact function for it.
- **The existing `res.blocked` branch in the clock-out arm** (`home.tsx:813-817`). Not verified to
  be reachable via the geofence — the phase text and `timeTracker.js`'s cited lines say the server
  does not 403 a clock-out on distance — and not touched here.
- **`services/attendanceWatchdog.js`'s separate hard-200 m fence** (named in the Phase 7 result as
  "a third fence with a third answer"). Backend-side, unrelated to this app's clock-out button.
