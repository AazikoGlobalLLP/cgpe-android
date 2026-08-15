# Phase 47 — "Viewing as" is Master-only

**Status:** BUILT 2026-08-15 (local — push 403s). `[m]` only, no backend, no contract change.
**Owner backlog:** Phase 47 (Group G). "Remove the Viewing-as row from More except for one owner number."

## 1. Goal
Stop showing the "Viewing as" (tier-preview) row in the More tab's Personal group to admins and
leaders. Only the Master may preview another side.

## 2. What "Viewing as" is (verified before touching anything)
- `viewAs: Tier | null` is **pure client-side state** in `src/store/auth.tsx:56` — never persisted,
  reset to `null` on logout (`:182`) and on any session change (`:70`).
- It is a **downward-only preview**: `capabilitiesOf(user, viewAs)` (`src/store/roles.ts:96-108`)
  clamps the previewed tier to `≤` the real tier via the rank map (`:100`), so it can NEVER grant
  more access than the user actually holds. It only changes what THIS device shows the user.
- The row lives in More's fixed "Personal" tail (`src/app/(tabs)/more.tsx`, PHASE-26 D-3). Its ONLY
  entry point is that row → `setViewSheet(true)` → the preview sheet → `setViewAs`. No other opener.
- **Old gate:** the row rendered when `realCaps.manageTeam` was true — and `manageTeam` is true for
  the WHOLE admin tier, into which `tierOf()` folds `leader`. So every admin and leader saw it.

## 3. The trap (why this is not a phone literal — rule 1)
The owner backlog phrases this as "except for one number" (`9106988376`). But rule 1 forbids a phone
literal in `src/` (the email literal was removed in Phase 11 for exactly this reason), and that number
is one of the THREE promoted to `super_admin` in Phase 38 — so there is no per-account field in the
app today that separates one master from another. A truly-one-account gate would require a NEW
per-profile capability flag on the backend `Profile`, surfaced to the app (an `[api]` ask, Phase-38
shape).

**Owner decision (AskUserQuestion, 2026-08-15): gate on the real `super_admin` role.** The owner chose
the pure-`[m]`, ship-today option knowing the trade-off: all three master accounts keep "Viewing as",
every admin and leader loses it. Not down to one number, but that was the owner's explicit call over
filing a new backend flag. So: no `[api]` ask, no phone literal, no backend change.

## 4. The change
- NEW pure predicate `canViewAs(user) = user?.role === 'super_admin'` in `src/store/roles.ts`,
  parallel to `canSeeLiveLocation` / `canSeeTeamPerformance` / `canMonitorTeam` (Phases 40/45/39) —
  kept as its own named predicate so the four gates can be reasoned about and pinned independently and
  can't drift, exactly as those three are.
- `more.tsx`: the Personal-tail "Viewing as" row is gated on `canViewAs(user)` instead of
  `realCaps.manageTeam`. Reads the REAL role (not the preview `caps`), so the row stays visible while a
  master is previewing a lower tier — they can still switch back.
- `roles.test.ts`: +4 cases pinning `canViewAs` across all 6 roles + null (admits only `super_admin`,
  refuses admin AND leader specifically — the folded-tier trap — refuses null, agrees with
  `tierOf()==='master'`).

`realCaps` is still used by the preview sheet's option filter (`more.tsx:425`,
`TIER_RANK[o.tier] <= TIER_RANK[realCaps.tier]`), so it is not orphaned. The sheet, the "Preview"
pills, and `applyView` are unchanged — they are only reachable once `viewAs` is set, which now only a
master can do.

## 5. Gates
- `npx tsc --noEmit` — 0.
- `npm test` — **495/495** (+4 `canViewAs` cases in `roles.test.ts`).
- `npx eslint` on the three touched files — 0 errors (1 pre-existing `more.tsx:129` `c`-unused
  warning, not introduced here).

## 6. Done when / device check (carried, native-only)
A real admin and a real leader open More and find no "Viewing as" row; a real `super_admin` still sees
it and can preview the Admin / Team sides and switch back. Needs Phase 38's DB promotion for a live
master account to see the positive case on device, but the gate holds regardless.

## 7. Not done (deliberate)
Restricting to literally one of the three master numbers. That needs a per-profile backend capability
flag (an `[api]` ask + an owner DB set on one account) — the owner declined it in favour of the
role-based gate. If they later want exactly-one, file the flag to `cgpe-api` (Phase-38 courier shape)
and swap `canViewAs` to read `user.<flag>`; the app-side seam is already a single predicate.
