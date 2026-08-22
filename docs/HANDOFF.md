# HANDOFF — CGPE Connect (Android) — Owner backlog B2–B5 (live location) — 2026-08-22

Owner picked the B2–B5 live-location cluster (`docs/OWNER-BACKLOG-2026-08-21.md` §B — "the hardest
cluster"). All four items were verified against the **real** backend code
(`cgpe-backend-main/routes/timeTracker.js`, `models/DayLog.js`) before any edit. Exactly one was a
buildable app bug (B5); it shipped and cascaded to fix B4's list symptom. B2 was already done and
honest; B3 needs a backend field first. Gates green (`tsc` 0 · `npm test` 797 · eslint 0), committed,
pushed `aaziko/Shivam`. JS-only / OTA-eligible; **device-unverified**.

## Done
- **B5** (`0e2a77b`) — the Agent-locations screen now lists the **whole staff directory**, not just
  GPS-located pins. Before, one member clocked-in-with-GPS hid everyone else ("1 on duty, 1 tracked").
  Now the roster LIST always comes from `getTeam()`/`mergeRoster` (the full super_admin live-locations
  universe); the MAP still plots only real `pins` (a location nobody shared is never fabricated). Header
  reads "N on duty · M in team · K on map"; the Off-duty section no longer truncates at 12.
- **B4 (list half)** — a member with no assigned task and/or no GPS point now appears as an off-duty
  roster row (side-effect of the B5 fix). Their **map pin** remains a data question (did points upload?).
- **B2 — confirmed already built + honest** (no code): `team/[id].tsx` `openLive` → `getLastLocation` →
  `/last-location` serves a member's newest point on OR off duty with a freshness label. Off-duty data
  only exists with 24/7 consent + bg tracker + the new native APK — a platform reality, not a bug.

## Files changed
- `src/app/agent-map.tsx` — B5: roster list built from the full `team` universe (fallback to `pins` only
  on an outage); map still plots `pins`; honest header counts; Off-duty cap of 12 removed.

## Decisions made
- **B5 roster = `team` always; map = `pins` always.** The two answer different questions: "who is on
  staff / on duty" (list) vs "whose live location can we plot" (map). Conflating them was the bug.
- **Header shows three honest counts** ("on duty · in team · on map") rather than the old ambiguous
  "N tracked", which implied N people had a GPS fix when only pins do.
- **B3 is a backend ask, not app code.** The red "Clock-out" map layer the legend promises has no live
  data source: `/live-locations` returns only the clock-**in** point. The clock-**out** coord is already
  stored (`DayLog.clockOutLoc`, set on clock-out) — it just isn't surfaced. The app already draws red
  `outLat/outLng` pins, so once the field ships the app follow-up is tiny.
- **INBOX not edited** (same call as the prior batch): concurrent-write corruption risk; the owner-relay
  courier is the proven path. The B3 ask + B4 data check were handed to the owner in plain language.

## Known broken / deliberately skipped
- **Device-unverified** — B5 is a master-only screen needing a real super_admin session + members with
  live locations. OTA-eligible (JS-only); no new APK cut yet.
- **B3 red clock-out layer** — not built; blocked on the backend surfacing `clockOutLoc` on
  `/live-locations`. Relay filed with the owner, not INBOX.
- **B4 map pin for Pavitra** — a data question (points with accuracy > 100 m are dropped server-side;
  a session-less batch is discarded). Owner/backend to verify her points uploaded.
- **B2 off-duty real data** — requires each person's 24/7 consent + the bg tracker + the new native APK;
  platform/ops, unchanged.

## Next session starts here
- Owner to decide: **cut a fresh APK** (bundles B5 + the D3/B1/D4/C2/D6 batch + Phases 77/78 for a
  device test), and/or start the next backlog cluster (A3 attendance · D5 fuzzy search · E2 report).
- First command: `/boot`
- Watch out for: **B5 is master-only** — a non-master still sees "Master access only" by design
  (`canSeeLiveLocation`). And the map deliberately plots fewer people than the list (only shared GPS) —
  that gap is correct, not a regression. Don't "fix" it by fabricating pins.
