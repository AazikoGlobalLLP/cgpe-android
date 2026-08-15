# PHASE-39 — Master-only monitoring surface ("the main side")

**Type:** `[m]` (pure mobile — no backend, no contract change) · **[sec]** (master-gated oversight)
**Owner backlog:** Group C, Phase 39 (`docs/PLAN-2026-08-14.md:78`).
**Depends on (all built):** 38 (master role via DB), 40 (location gated to real `super_admin`),
44 (salary already computed + rendered), 45 (performance report + score + `performance.tsx`).

---

## 1. What the owner asked for

> "A dedicated master view that shows, for each team member: **performance/activity, location
> (most important), and salary report** — and **no task UI**, 'jyada features ki zarurat nahi.'
> Gate strictly to Master. Reuse existing screens where possible rather than a new app."

Every piece already exists as its own screen and is already gated in More's **Master control**
group — they are just **scattered**:

| Lens | Existing screen | Gate today |
|---|---|---|
| Location (live pins) | `/agent-map` | real `super_admin` (Phase 40) |
| Location (movement replay) | `/agent-track` | real `super_admin` (Phase 40) |
| Performance / score | `/performance?view=team` | real `super_admin` (Phase 45) |
| Salary report | `/payroll` | `admin \| super_admin` |
| Activity (per member) | `/team` → `/team/[id]` | in the admin/master group |

So Phase 39 adds **no new data path** — it adds **one dedicated master landing** that gathers
these lenses in one place ("the main side"), instead of the master hunting the More menu.

## 2. Owner decision (AskUserQuestion, 2026-08-15)

1. **Shape = Monitoring hub.** One new master-only screen: lens tiles at the top (Locations —
   most important — Movement, Team performance, Payroll) + the **team roster** below; tapping a
   member opens their existing `/team/[id]` detail (which already carries activity). **No task
   UI.** Matches "jyada features ki zarurat nahi." (Rejected: a per-member unified card — would
   need per-member deep-links into location & payroll that do not exist, i.e. new backend.)
2. **Entry = pushed from More.** A "Monitor" row at the **top of the Master-control group** opens
   the hub. (Rejected: a new bottom tab — `nav.tabs` is DB-driven, so a master-only tab would need
   an `[api]`/RBAC change, out of a pure `[m]` scope.)

## 3. The gate (the security-critical part)

The hub is **Master-only**, and — exactly like Phase 40/45 — it gates on the **REAL**
`user.role === 'super_admin'`, never the folded tier (`tierOf()` folds `leader` INTO admin, so a
tier/caps gate would leak the whole monitoring surface to every admin and leader).

- **New pure predicate `canMonitorTeam(user)` in `store/roles.ts`**, parallel to
  `canSeeLiveLocation` / `canSeeTeamPerformance` (all three = `super_admin`; kept separate on
  purpose so they can't drift, per the file's own convention).
- The hub bails to an honest "Owner access only" `EmptyState`, **waiting for `ready`** so a real
  master is not flashed the refusal during session restore (the `agent-map`/`performance` pattern).
- The **individual screens keep their own gates** — the hub is a convenience entry, not the
  security authority. A deep-link straight to `/agent-map` is still gated at `agent-map`.
- The **"Monitor" tile in More** sits inside the existing `caps.tier === 'master'` branch (the
  same authority as the Agent-locations / Team-performance tiles), so it is off the Admin/leader
  menu — but the SCREEN's real-role gate is the guarantee, the tile is an affordance.

## 4. Files (≤8)

1. `src/store/roles.ts` — add `canMonitorTeam(user)`.
2. `src/store/__tests__/roles.test.ts` — pin it across all 6 roles + null (admits only
   `super_admin`; refuses admin AND leader; agrees with `tierOf()==='master'`).
3. `src/app/monitor.tsx` — **NEW** the hub: gate → lens grid (Locations / Movement / Performance /
   Payroll) → team roster (reuse `getTeam()`, rows → `/team/[id]`). No task UI.
4. `src/app/(tabs)/more.tsx` — add a "Monitor" `Entry` at the top of the master branch.

## 5. Reuse / honesty rules kept

- **No fabricated data.** The roster is `getTeam()` (already outage-honest via `unavailable()` +
  `useDataHealth().degraded`); the lenses are just navigation. No counts are invented on the hub.
- **The app renders, never recomputes.** The hub carries no scores/salary of its own — those live
  on the destination screens (server-owned). It only shows roster identity + live duty status
  (already a real cross-reference inside `getTeam()`), which is not a location read.
- **No i18n dictionary change** — the hub is English chrome like the other master screens
  (`performance.tsx`, `payroll.tsx`, `agent-map.tsx` are all hardcoded English); wiring `t()` here
  would need supplied copy in 5 languages (PHASE-19 §4) and is out of scope. Follows precedent.
- **`/monitor` href is cast `as Href`** until `expo start` regenerates route types (the
  `consent.tsx` / `earnings` precedent).

## 6. Done when

- `tsc --noEmit` 0 · `npm test` green (+ the new `canMonitorTeam` cases) · no new lint errors.
- **DEVICE CHECK (carried, native + backend-live-gated):** a real `super_admin` opens More →
  Monitor and reaches the hub; the four lenses open their screens; the roster lists members and
  a tap opens the member detail; a real **admin** and a real **leader** find the Monitor tile gone
  and a deep-link to `/monitor` shows "Owner access only", never the hub. Light/dark at 390px.
  (Needs Phase 38's DB promotion for a live master + cgpe-api's `:3001` restart for live roster.)

## DECISIONS 2026-08-15

- **Hub, not per-member card, and pushed from More, not a tab** — both owner-locked (§2). The hub
  is the smallest thing that satisfies "one dedicated main side" while reusing every screen and
  touching no backend.
- **`canMonitorTeam` added despite being identical to the other two `super_admin` predicates** —
  the file already keeps `canSeeLiveLocation` and `canSeeTeamPerformance` separate for exactly this
  reason ("so they can't drift"); a distinct name documents *what* is gated and lets the hub's gate
  be pinned independently. Not folded into a shared helper.
- **No task UI** — explicit owner constraint. The hub links to location/performance/salary/activity
  only; Tasks stays on its own tab.
