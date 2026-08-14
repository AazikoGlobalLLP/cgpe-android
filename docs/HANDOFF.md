# HANDOFF — CGPE Connect (Android) — Phase 40 — 2026-08-14

This session **built Phase 40 (live-location visibility = Master only)**, then — at the owner's request —
**verified the current location-tracking behavior and escalated Phase 41 (24/7 background location) to #1**.

## Done
- **Live agent locations are now Master-only.** Only a real `super_admin` can open the two coordinate-bearing
  screens — `agent-map` (live pins) and `agent-track` (movement replay). An admin or a **leader** (who
  `tierOf()` folds into the admin tier) no longer reaches the location fetch: the tiles are gone from the More
  tab and the Admin dashboard, and a deep-link to either screen shows an honest **"Master access only"** state,
  never a blank/loading map. Before this, `agent-map` had **no gate at all** and any admin/leader could open it.
- **Duty status stays open (verified, not gated).** `getTeam()` uses locations only to compute a clocked-in
  boolean and discards coordinates, so the roster/dashboard "on duty" counts are unchanged — only the map/
  coordinates are Master-gated.
- **Answered the owner's 24/7 question from the real code:** location is **NOT** tracked 24/7 — it is
  **shift-bound** (clock-in → clock-out). During a shift it survives app-close/background via the Android
  foreground service; between shifts it records nothing and drops any fix it can't tie to a session.
- Gates green: `tsc` 0 · `npm test` **435/435** (+5) · lint **0 errors / 12 warnings** (baseline).

## Files changed
- `src/store/roles.ts` — NEW pure predicate `canSeeLiveLocation(user) = user?.role === 'super_admin'` — the ONE
  shared location gate (real role, never the folded tier or `viewAs`), so the two screens can't drift.
- `src/app/agent-map.tsx` — import `useAuth`+predicate; `load()` bails before the fetch when not master; honest
  `ready && !isMaster` "Master access only" `EmptyState`, placed before the loading skeleton.
- `src/app/agent-track.tsx` — swapped its `capabilitiesOf().tier` caps check for `canSeeLiveLocation` (same
  result, explicit real-role); dropped the now-unused import.
- `src/app/(tabs)/more.tsx` — moved the "Agent locations" tile into the existing `caps.tier==='master'` branch
  beside "Movement paths" (both location tiles now Master-only).
- `src/screens/dashboards.tsx` — removed the "Agent map" quick action from the **Admin** dashboard (Master keeps it).
- `src/store/__tests__/roles.test.ts` — NEW (5): pins the gate across all 6 roles + null, incl. the admin/leader
  folded-tier trap and agreement with `tierOf()==='master'`.
- `docs/spec/PHASE-40.md` — NEW spec. `docs/PHASES.md` / `docs/DECISIONS.md` / `docs/STATUS.md` updated.
- `docs/PHASES.md` + `docs/PLAN-2026-08-14.md` — **Phase 41 escalated to #1** (24/7 location), with the DPDP/
  policy caveat recorded. Commits: `40b3e1e` (Phase 40), `915f4b3`+`c1da964` (escalation). All local — push 403s.

## Decisions made
- **Location gate = the REAL `super_admin` role via one shared predicate** (`canSeeLiveLocation`), never the
  folded tier/caps — `tierOf()` folds `leader` into admin and `seeAgentMap` is true for the whole admin tier, so
  a tier gate would leak location to every admin/leader. Duty status is not a location read and stays open.
  (DECISIONS 2026-08-14, top; PHASE-40 §5.)
- **Phase 41 (24/7 location) pulled ahead of Phase 39** per the owner. Dependency-consistent (39's location
  element consumes 41/42). **True off-shift 24/7 is a policy + DPDP-consent decision, not a pure code change** —
  flagged for an explicit owner call before Phase 41 is built.

## Known broken / deliberately skipped
- **On-device Master check for Phase 40 CARRIED** — needs a real `super_admin` (see the map) vs. a real admin/
  leader (tiles gone, deep-link refused). Not editor-verifiable; needs Phase 38's DB promotion for a live master
  account, though the gate itself holds regardless.
- **`git push` still 403s** — stored credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; commits `40b3e1e`/`915f4b3`/`c1da964` are local only. Needs a human.
- **No contract/INBOX change this session** — Phase 40 is pure `[m]` over existing endpoints; nothing crosses a
  repo boundary, so no sibling session needs notifying.

## Next session starts here
- **Phase 41 — [m]+[api][sec] 24/7 / guaranteed background location, any device.** FIRST STEP IS NOT CODE: confirm
  with the owner what "24/7" means (reliably capture the whole shift on any handset — Samsung/Xiaomi battery
  killers included — vs. literally always-on beyond shifts) and the DPDP consent/notice model. Then audit
  `lib/tracker.ts` (module-scope task, `_layout.tsx:18` load-bearing import) + the "Allow all the time"
  background-permission flow + delivery to `/time-tracker/track/points` (Phase 7 flagged the server DROPS fixes
  with accuracy > 100 m while the app records at ~100 m — likely an `[api]` fix). `docs/PLAN-2026-08-14.md` §41/42.
- **First command:** `/boot`
- **Watch out for:** `lib/tracker.ts` has **NO test coverage and is device-only** (no `expo-location`/
  `expo-task-manager` stub) — nothing here is provable in Vitest or web; every change needs a real multi-handset
  check. And the shift-bound design is deliberate (privacy/attributability/battery) — do NOT make it always-on
  without the owner's explicit consent decision first (rule 5).
