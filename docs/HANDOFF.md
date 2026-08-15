# HANDOFF — CGPE Connect (Android) — Phase 39 — 2026-08-15

Phase 39 (the master-only monitoring surface — the owner's "main side") built as one small, self-contained
`[m]` change: a new `/monitor` hub screen that gathers the already-existing, already-master-gated lenses
(location, movement, performance, salary) plus the team roster into one dedicated master landing, with **no task
UI**. No backend, no contract, no i18n change. Also added **Phase 49** to the roadmap (final APK + one-click link →
OTA-only updates). **Owner has marked Phase 41 (24/7 background location) as the #1 next priority.**

## Done
- **A master (real `super_admin`) now has a single "Monitor" surface.** More → Master control → **Monitor** opens
  `/monitor`: a 2×2 lens grid (**Locations** first — the owner's "most important" — Movement, Performance, Payroll,
  each opening its existing screen) over the team roster (on-duty KPIs + rows tapping into each member's detail).
  No task UI. A real admin or leader never sees the Monitor tile, and a deep-link to `/monitor` shows "Owner access
  only" — the gate is the real role, never the folded tier.
- **The roadmap now ends with Phase 49** — the ship step: after everything is built + device-verified, cut one
  final signed APK, hand a one-click download link (the last link ever), then push all future JS/content updates
  over-the-air. The honest limit is written down: OTA covers only the JS/asset layer; a native change still needs a
  fresh APK.

## Files changed
- `src/app/monitor.tsx` — NEW. The master monitoring hub: `canMonitorTeam` gate → lens grid → `getTeam()` roster
  (rows → `/team/[id]`). Invents nothing; outage-honest via `useDataHealth()`.
- `src/store/roles.ts` — NEW pure `canMonitorTeam(user) = user?.role === 'super_admin'`, parallel to
  `canSeeLiveLocation` / `canSeeTeamPerformance` (kept separate so the three gates can't drift).
- `src/store/__tests__/roles.test.ts` — +4 cases pinning `canMonitorTeam` across all 6 roles + null.
- `src/app/(tabs)/more.tsx` — fixed master-only "Monitor" row at the top of the Master-control group (no navKey).
- `docs/spec/PHASE-39.md` — NEW spec. `docs/PHASES.md` — Phase 39 "Now" block. `docs/PLAN-2026-08-14.md` — NEW
  Phase 49 (Group I — Ship) + execution order + owner/ops asks.

## Decisions made
- **Shape = a monitoring HUB, reached pushed from More** (both owner-locked via AskUserQuestion). Not a per-member
  unified card (would need per-member location/payroll deep-links that don't exist = new backend); not a bottom tab
  (`nav.tabs` is DB-driven, a master-only tab needs an `[api]`/RBAC change).
- **`canMonitorTeam` added even though it is byte-identical to the other two `super_admin` predicates** — the file
  already keeps them separate "so they can't drift"; a distinct name documents what is gated and is pinned on its own.
- **Phase 49 records the OTA hard limit explicitly** — "last link ever" holds for JS/content updates only; native
  changes (Phase 41's tracker module already being one) still need a rebuild. Do not over-promise zero rebuilds.

## Known broken / deliberately skipped
- **Device check CARRIED for Phase 39** (native + backend-live-gated): a real `super_admin` reaches the hub, the four
  lenses open, roster taps open the detail; a real admin + leader find the tile gone and a deep-link shows "Owner
  access only". Needs Phase 38's DB promotion for a live master + cgpe-api's `:3001` restart for a live roster.
- **`git push` still 403s** — this commit (`2750794`) + `c4f40bb` (Phase 49 doc) + the local Phase-45/46 commits are
  local-only; credential `reactjsaaziko` has no write access. Needs a human credential swap. **This blocks Phase 49.**
- Carried device/backend checks: 41 part-2 (24/7 recorder), 42 (route colouring, blocked on 41), 43 (geofence), 45
  (both performance screens), 46 (emoji alignment). All native/backend-live-gated, not editor-buildable.

## Next session starts here
- **Phase 41 — 24/7 background location — is the owner's #1 priority.** Its remaining work (`tracker.ts` device
  slice / battery-opt / boot re-arm) is **device + EAS-build-gated, NOT editor-buildable** — the editor half
  (41a + 41a-iii-b) is already built and device-unverified (`16e75ae`). So the next real step is a fresh EAS/dev-client
  build on a real handset + the §12.7 acceptance matrix (`docs/spec/PHASE-41.md` §12). If working editor-only, the
  next editor-actionable item is **Phase 47** (Viewing-as → one number — first confirm the flag mechanism with the
  owner/backend; DB capability, never a phone literal).
- First command: `/boot`
- Watch out for: **Phase 41 is #1 by owner priority but is device/build-gated** — do not "build" it in the editor
  again; it needs a handset. And **every commit is local (push 403s)** — flag the push as the blocker for Phase 49.
