# Phase 38 — Master for the 3 numbers via `Profile.role` (NOT client literals)

**Type:** `[db]` (owner/DB data change) · `[sec]` (grants the highest tier) · **no `[m]` build, no `[api]` code change**
**Date:** 2026-08-14
**Status:** VERIFIED end-to-end; ask filed to `cgpe-api`/owner. Deliverable is a DB change the owner runs — **zero `src/` change**, per PLAN §Phase 38.

Owner backlog (`docs/PLAN-2026-08-14.md` §Phase 38): make `9099032033`, `9825135034`,
`9106988376` **master**, "baki depend on db." Cross-cutting rule 1: role by identity =
DB `Profile.role`, **never** a client phone literal in `src/`.

---

## 1. Owner decision (AskUserQuestion, 2026-08-14)

In this codebase **"master" is exactly the `super_admin` role** — the `Profile.role` enum
(`cgpe-backend-main/models/Profile.js:28`) is `payroll_staff | advisor | learn_advisor |
leader | admin | super_admin`; there is **no separate monitor-only rank**. Promoting to
`super_admin` grants FULL org-wide power (see all data/PII, edit/promote any user, pass every
`authorize()` gate), not just the view-team monitoring surface described for Phase 39.

**Owner chose: full `super_admin`.** So Phase 38 = a DB role change on 3 accounts, zero code.
A narrower "monitor-only master" would need a NEW backend role/capability (a `cgpe-api` build)
and would reshape Phases 39/40 — explicitly NOT taken.

---

## 2. Verified chain (both trees, real code — not tags)

Setting `staff_unified.role = 'super_admin'` for a phone-login account makes it read as Master
on the device with **no `src/` change**. Every hop confirmed:

1. **DB is the source of truth.** `models/Profile.js` binds to the merged **`staff_unified`**
   collection (`STAFF_COLLECTION`); `role` is an indexed enum that includes `super_admin`
   (`Profile.js:23-31`).
2. **Phone-OTP login returns the role verbatim.** `POST /api/auth/request-otp` +
   `POST /api/auth/verify-otp` resolve the profile via `findStaffByIdentifier`, which matches a
   phone on the **last 10 digits** (`Profile.find({ phone: { $regex: ten + '$' } })`,
   `routes/auth.js:869`) and returns `data.user = profile.toPublicJSON()` (which includes
   `role`) + a `{ user_id }` JWT (`routes/auth.js:1015`). Password login is identical
   (`routes/auth.js:834`).
3. **Mobile maps `role` straight through.** `verifyOtp`/`login` → `adaptUser(data.user)`
   (`src/data/api.ts:557,603`) → `User.role = raw.role` (`src/data/adapt.ts:157`).
4. **`tierOf()` reads it.** `tierOf(user) === 'master'` iff `user.role === 'super_admin'`
   (`src/store/roles.ts:42`). No phone literal anywhere — rule 1 satisfied by construction.
5. **Backend honours it.** `authorize()` lets `super_admin` (rank 4, `isSuperAdmin`) pass
   **every** gate unconditionally (`middleware/auth.js:57,73`).

**The existing DB-change tool:** `scripts/makeSuperAdmin.js` does exactly
`updateOne(query, { $set: { role: 'super_admin' } })` on `staff_unified` — but it accepts
`<user_id | email>`, **not a phone**. Its own docstring names the cleaner owner path: *Admin
Panel → User Management → edit user → Role → Super Admin* (once one super_admin exists).

---

## 3. Three preconditions the owner/`cgpe-api` MUST verify per number

These determine whether the promotion actually takes effect for a **phone** login:

- **P1 — exactly ONE active profile per phone.** `findStaffByIdentifier` REFUSES phone login
  when the last-10 digits match **more than one active** profile ("This number is linked to
  more than one account. Please sign in with your email instead.", `routes/auth.js:871`), and
  returns "no account" when **zero** match (`:870`). So per number confirm
  `db.staff_unified.countDocuments({ phone: /<last10>$/, is_active: true }) === 1`. Duplicates
  → merge/deactivate the extras (or that user signs in by email); zero → the account isn't on
  file yet.
- **P2 — sign out and back in.** The app restores the **cached** `user` from AsyncStorage
  (`cgpe.user`) on cold start and only refreshes `role` on a fresh `login`/`verifyOtp`
  (`src/store/auth.tsx:104-110` restores the persisted user; it does not re-fetch `/auth/me` to
  refresh the role). So after promotion each device must sign out + back in (or reinstall) — the
  script output says exactly this.
- **P3 — `[sec]` full-power grant, reversible.** `super_admin` passes every `authorize()` gate
  (edit/promote any user, all PII, org-wide). Owner confirmed intended (§1). Reversible by
  setting the role back to its prior value. Security review noted per PLAN rule 5.

---

## 4. What was filed / handed off

- **INBOX ask** `→ cgpe-api · 2026-08-14 · from cgpe-mobile`: promote the 3 phones to
  `super_admin` on `staff_unified` (owner/DB action; no backend code, no mobile code), with P1
  as the per-number checklist and P2/P3 as the follow-ups. Phone-safe one-liner supplied
  (`makeSuperAdmin.js` can't take a phone).
- **Owner relay copy** (plain language) handed over for the courier workflow (proven Phase 34).

## 5. Done means (this phase)

- No `src/` change, no gate re-run — the deliverable is a DB change, not code (PLAN §Phase 38).
  Baseline stands: `tsc` 0, `npm test` 430/430, lint 0 errors / 12 warnings.
- **On-device verification (owner, after the DB change):** each of the 3 numbers signs in by
  phone + OTP and lands on the Master experience (MASTER badge / master-gated surfaces),
  reconciled against P1 (one active profile per number). This closes the phase.

## 6. Next

**Phase 40** — Location visibility = Master only (gate `agent-map`/`agent-track` on the REAL
`user.role === 'super_admin'`, Phase-20 pattern; a non-master never reaches the fetch). That is
the first mobile-buildable step and depends on 38. Then Phase 39 (the master monitoring surface).
