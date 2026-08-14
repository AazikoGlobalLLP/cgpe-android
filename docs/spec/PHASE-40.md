# PHASE 40 — [m][sec] Live-location visibility = Master only

**Status:** BUILT 2026-08-14. `tsc` 0 · `npm test` 435/435 (+5) · lint baseline (0 errors / 12 warnings).
Commit local (push still 403s). On-device Master check carried (native map + real accounts).

Owner backlog `docs/PLAN-2026-08-14.md` §Phase 40 (Group C — master role + monitoring). The first
mobile-buildable step of the master chain after Phase 38 (the DB promotion, filed). Depends only on 38.

---

## 1. Goal (binary)

Only the **Master** (real `super_admin`) may see where the field physically is. A non-master — including
an **admin** and a **leader** — must never reach the location fetch, and must land on an honest
"Master access only" state, never a false blank map.

The live-location surfaces are exactly two coordinate-bearing screens:
- `agent-map.tsx` — the live pins (`getAgentLocations` → LeafletMap).
- `agent-track.tsx` — the movement replay (`getTrackSessions`/`getTrack` → LeafletMap path).

## 2. Why this is a real gap (verified in code)

- `agent-track.tsx` was **already** gated (`capabilitiesOf(user).tier === 'master'`) — correct in effect,
  but via the caps indirection (fragile: a future `viewAs` pass through `capabilitiesOf` would break it).
- `agent-map.tsx` had **NO gate at all** — any signed-in user reaching `/agent-map` fetched `getTeam()` +
  `getAgentLocations()` on focus. Its only entry points were `more.tsx`'s admin-oversight group (gated
  `isAdmin` = `caps.manageTeam`, **true for admin AND master**) and the Admin/Master dashboards. So **an
  admin or a leader could open the live map today.** That is the hole Phase 40 closes.

The trap this phase is written against (handoff + PLAN rule 1): `tierOf()` folds `leader` **into** the
admin tier, and `capabilitiesOf().seeAgentMap` is `true` for the whole admin tier. Gating location on the
tier/caps would leak it to every admin and leader. Master is `super_admin` and nothing else, so the gate
is a **direct real-`role`** comparison (the Phase-20 pattern), not the folded tier.

## 3. What is NOT a location read (scope boundary)

`getTeam()` (`api.ts:1573`) calls `getAgentLocations()` internally **only to derive a duty boolean**
(`clockedIn`) — it discards the lat/lng and never surfaces coordinates on `TeamMember`. So the team
roster / dashboard "on duty / off" counts are a **duty-status** surface, not a location-visibility
surface, and stay visible to admin/team exactly as before. Phase 40 gates the map/coordinates only.
`getTrackableMembers()` (used by `notify.tsx` for recipient selection) returns `{id,name,role}` — no
location — and is out of scope.

## 4. The change (6 files, ≤8 budget)

1. **`store/roles.ts`** — NEW pure predicate `canSeeLiveLocation(user) = user?.role === 'super_admin'`,
   documented as the ONE shared location gate. Real role, immune to the folded tier and to `viewAs`.
2. **`app/agent-map.tsx`** — import `useAuth` + `canSeeLiveLocation`; `load()` bails (`setLoading(false)`)
   when not master, so the fetch never fires; an early `ready && !isMaster` return shows the honest
   "Master access only" `EmptyState` (waits for `ready` so a real master is not flashed the refusal
   during session restore). Placed **before** the loading skeleton.
3. **`app/agent-track.tsx`** — swap `capabilitiesOf(user).tier === 'master'` → `canSeeLiveLocation(user)`
   (same result, explicit real-role, no caps indirection); drop the now-unused `capabilitiesOf` import.
4. **`app/(tabs)/more.tsx`** — move the "Agent locations" tile into the existing `caps.tier === 'master'`
   branch alongside "Movement paths", so **both** location tiles are Master-only. (The More tile stays
   `caps.tier`-gated — viewAs-aware — because it is a UI affordance; the SCREEN gate on the real role is
   the security authority.) Admin/leader keep team roster, analytics, payroll, campaigns, notify.
5. **`screens/dashboards.tsx`** — remove the "Agent map" quick action from the **Admin** dashboard.
   The **Master** dashboard keeps "Agent map" + "Movement" (that dashboard renders for master only).
6. **`store/__tests__/roles.test.ts`** — NEW (5 cases). Pins the invariant across all 6 roles + null:
   admits `super_admin`; refuses every other role; refuses admin **and** leader specifically (the folded
   trap); refuses null; and agrees exactly with `tierOf() === 'master'` for every role.

## 5. Decisions

- **D-1: real-`role` gate, not caps/tier.** Master = `super_admin` only (`tierOf` proves it). A direct
  `role` comparison is both the correct rule and immune to the folded-leader tier and to a `viewAs`
  preview. One shared predicate (`canSeeLiveLocation`) so the two screens can never drift apart.
- **D-2: duty status stays open.** On/off counts (`getTeam`) are not location reads (§3) — not gated.
- **D-3: More tiles stay `viewAs`-aware, screens are real-role.** The tile is an affordance; the screen
  is the boundary. A master previewing a lower tier still holds the real role and can deep-link in.
- **D-4: no `[api]` ask, no contract change.** This is a pure `[m]` client gate over endpoints that
  already exist. Nothing filed.

## 6. Done means (this phase)

`tsc` 0 · `npm test` green · no new lint errors — **all met**. Plus an on-device check that is
**not editor-buildable**: (a) a real `super_admin` opens Agent locations + Movement paths and sees the
map; (b) a real admin and a real leader find the tiles gone from More and the Admin dashboard, and a
deep-link to `/agent-map` / `/agent-track` shows "Master access only", never a blank/loading map;
(c) light/dark at 390 px. Depends on Phase 38's DB promotion for a live master account, but the gate
itself holds regardless of whether the 3 numbers are promoted yet.

## 7. Next

Phase 39 — the master-only monitoring surface (performance + location + salary, no task UI), which
reuses these now-gated location screens. Then the location-hardening phases (41/42) and the reports
(44/45) feed it. Full path: `docs/PLAN-2026-08-14.md` §Phase 39.
