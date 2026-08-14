# HANDOFF — CGPE Connect (Android) — Phase 38 — 2026-08-14

This session ran **Phase 38 — [db]+[sec] Master for the 3 numbers via `Profile.role`** — the head of the
master-role chain (owner backlog PLAN Group C). It is a **verify-and-file phase with NO code on either side**:
the whole login→role→tier chain already works, so making the 3 accounts Master is a pure DB data change the
owner runs. Board + spec + decisions + memory updated; INBOX ask filed + grepped back; commit local (push 403s).

## Done
- **Verified end-to-end (both trees, real code — not tags) that "master" needs zero app code.** Phone-OTP login
  matches by the **last 10 digits** (`findStaffByIdentifier`, `routes/auth.js:869`) and returns `role` verbatim
  via `toPublicJSON()` (`:1015`); mobile maps it through `adaptUser` (`adapt.ts:157`); `tierOf()` returns
  `master` iff `role==='super_admin'` (`store/roles.ts:42`) — **no phone literal in `src/`, by design**;
  `authorize()` passes `super_admin` unconditionally (`middleware/auth.js:57,73`). So promoting
  `9099032033`/`9825135034`/`9106988376` to `staff_unified.role='super_admin'` makes them read as Master with
  **zero `src/` change and no backend code change**.
- **Owner decision captured (AskUserQuestion):** "master" = **full `super_admin`** (org-wide power: edit/promote
  any user, all PII), NOT a narrower monitor-only role (that would be a new backend capability, not taken). The
  `Profile.role` enum has no separate monitor rank — `super_admin` is the whole mechanism.
- **Filed a verified `→ cgpe-api · from cgpe-mobile` INBOX ask** (grepped back durable, 2 hits) + handed the
  owner a plain-language relay copy (courier workflow): promote the 3 numbers, with the 3 preconditions below.

## Files changed
- `docs/spec/PHASE-38.md` — NEW. The full verification chain, owner decision, mechanism, 3 preconditions.
- `docs/PHASES.md` — Phase 38 → `## Now`; `## Next 3` re-headed to **40→39** (38 now filed).
- `docs/DECISIONS.md` — 1 entry prepended (2026-08-14, Phase 38).
- `docs/STATUS.md` — rewritten (manager-facing).
- `../contracts/INBOX.md` — NEW top-of-queue `→ cgpe-api` ask (the DB promotion). **Outside this git repo.**
- memory `owner-backlog-2026-08-14` + `MEMORY.md` — Phase 38 recorded. **Outside this git repo.**
- Commit `60c6cdb` (the 4 in-repo docs; local — push still 403s). INBOX/memory are on disk only, uncommitted by design.

## Decisions made
- **"master" = full `super_admin`, delivered as a DB `Profile.role` change with zero `src/` change** (owner-confirmed;
  DECISIONS 2026-08-14 top; PHASE-38 §1). The value is FORCED by the code — do not invent a "master" role value or
  reintroduce a phone literal.
- **No `[api]` code ask and no contract change** — login already returns the role correctly; the only action is the
  owner/DB promotion. Not a backend build.
- **Full super_admin over monitor-only** — a monitor-only master would need a new backend role/capability and would
  reshape Phases 39/40. Explicitly not taken.

## Known broken / deliberately skipped
- **Phase 38 completes only when the OWNER makes the DB change** — the app side is done. Three preconditions decide
  whether phone login works: (P1) **exactly one active profile per phone** (login refuses >1 active match,
  `auth.js:871`; 404s on 0, `:870`); (P2) **sign out + back in** on each device (the app restores the cached `user`
  and only refreshes `role` on a fresh login/OTP); (P3) **[sec]** full-power grant, reversible by resetting the role.
  `makeSuperAdmin.js` takes `user_id|email` **not a phone** → use the panel or `updateOne({phone:/…$/},{$set:{role}})`.
- **On-device Master check CARRIED** — needs the owner to run the DB change first, then each number signs in and
  lands on Master. Not editor-verifiable.
- **`git push` still 403s** — stored credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; commit `60c6cdb` is local only. Needs a human to fix access.

## Next session starts here
- **Phase 40 — [m][sec] Location visibility = Master only.** Gate the live-location surfaces (`agent-map`,
  `agent-track`, any member-location read) on the **REAL** `user.role === 'super_admin'` (Phase-20 pattern — a
  non-master never reaches the fetch, and a stale-role deep-link degrades honestly, never a false blank). This is
  the first mobile-buildable step of the master chain and depends only on Phase 38 (now filed). Then Phase 39 (the
  master monitoring surface: performance + location + salary, no task UI). Full plan: `docs/PLAN-2026-08-14.md`
  §Phase 40/39.
- **First command:** `/boot`
- **Watch out for:** gate on the **real `user.role`**, never on `caps`/the folded tier — `tierOf()` folds `leader`
  into the admin tier, but only `super_admin` is Master; copy the Phase-20 real-role gate exactly. And role lives in
  DB `Profile.role`, never a phone literal in `src/`.
