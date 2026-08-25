# HANDOFF — CGPE Connect (Android) — Role identity model + sales-client carve-out + Band 2 #8 gates — 2026-08-25

## Done
- **The app now knows each staff member's department.** Login was silently dropping `department` and
  `_origRole` (the backend sends the whole `staff_unified` row via `toPublicJSON`, but `adaptUser`
  kept only 9 fields). Both now flow through, and a member's **Department shows on their Profile**.
- **A "final identity" model exists.** Pure `identityOf({role, department, origRole})` →
  `{tier, department (canonical|null), siloed, drift}`: `role` is authoritative, `_origRole` only
  raises a **drift** flag (never a grant), department is canonicalised against the backend's 9.
- **A sales-department advisor can open the Clients tab and see ONLY their own clients** (server
  enforces strict own-only), while Segments/Families/Campaigns stay master/admin. This was shipped
  **only after verifying the backend gate is live on `origin/main`** — enabling it against the
  undeployed server would have re-leaked the whole ~9k client book.
- **5 role-permission toggles now actually gate their controls** (task transfer, campaign send,
  notification dispatch, New-claim, claim-ticket). Behaviour is unchanged today (flags fail open /
  the tier already grants them); a future seeded per-role config can now tighten each.
- **The 21-staff role reconciliation is complete** (owner + their senior signed off). Only ONE role
  actually changes vs the live DB: **Ankit Shah `advisor → super_admin`** (an owner-run DB script).
- Gates on the final state: `tsc` 0 · `npm test` **931** (+21 across the session) · `eslint` 0 new
  errors. Three commits pushed to `aaziko Shivam`. All OTA-eligible, device-unverified.

## Files changed
- `src/data/types.ts` — `User` gains optional `department` + `origRole`.
- `src/data/adapt.ts` — `adaptUser` carries `department`/`_origRole` (trimmed; key omitted when empty).
- `src/store/roles.ts` — `DEPARTMENTS` (9, mirrors backend) + `canonicalizeDepartment` port;
  `tierOfRole` core (tierOf delegates); `identityOf`; `isSalesDepartment`/`isSalesAdvisor`/
  `canViewOwnClients` (the sales carve-out, mirrors backend P90 byte-for-byte).
- `src/app/profile.tsx` — Department row under Access level.
- `src/app/(tabs)/_layout.tsx`, `(tabs)/clients.tsx`, `client/[id].tsx`, `search.tsx` — client
  tab/list/detail/search → `canViewOwnClients` (opens to a sales advisor, own-only).
- `src/app/(tabs)/more.tsx` — split: `clients` entry → own-clients; segments/families/premium stay full-book.
- `src/app/task/[id].tsx`, `notify.tsx`, `campaigns.tsx`, `(tabs)/claims.tsx`, `tickets/[id].tsx` — the 5 gates.
- `src/store/appUi.tsx` — 14-flag wiring-status doc block (which are wired, which not, and why).
- `src/store/__tests__/roles.test.ts` (+21), `src/data/__tests__/adapt.test.ts` — new coverage.

## Decisions made
- **`role` is authoritative; `_origRole` is a drift-flag only, never a grant** — else a demoted
  super_admin (Ved Test) would silently re-promote.
- **The sales carve-out mirrors the server's DEPARTMENT rule exactly** — so Jagdish Bhai (dept
  `SALES - RENEWALS & LIC`) counts as a sales advisor for client access even though the owner calls
  his function "ops". The app MUST match the server or the two disagree.
- **Did NOT ship the app carve-out until Phase 89/90 were confirmed ancestors of `origin/main`**
  (deploy-gap discipline). Verified: `origin/main` = `990c660`, `/health` 200.
- **5 flags wired, 5 not** — agent-map/movement-paths are already master-only via `canSeeLiveLocation`
  (a fail-open flag can only narrow, never widen); advance-claim/export-data/edit-client have no app
  affordance (owner decisions A/B).

## Known broken / deliberately skipped
- **3 owner-run PROD scripts unverified** — `promoteStaffSuperAdmin.js` (Ankit), `addGeneralInsuranceDept.js
  --commit`, `seedAppRolePreferences.js` (Ops/Sales menu). Ankit also has no password yet.
- **Device-unverified** — a sales advisor's Clients tab shows own/few or empty (server returns own-only;
  most `advisor_id` links aren't backfilled on the import yet), NOT the whole book.
- **`cgpe-connect.staff_unified.json`** (password hashes + PII) is still in the repo root, untracked and
  NOT committed — the owner should delete it.
- Pre-existing lint warnings (`claims.tsx` nonce dep, `more.tsx` unused `c`) — not introduced here.

## Next session starts here
- Phase: **Point 13 — Payroll roster merge + "data pending" + bank/essential panel** (needs the owner's
  PII/role/masking decision + the OPS data job of creating payroll profiles) **OR #10 Document picker**
  (P1, NOT OTA — `expo-document-picker` is native → a new APK + OPS Spaces env). Every self-contained OTA
  Band-2 item is now shipped.
- First command: `/boot`
- Watch out for: **never re-open a client surface for team without first confirming the backend gate is
  deployed on `origin/main`** — the app-side hiding is the only thing protecting the book when the server
  gate isn't live (this session's Phase 89/90 deploy-gap catch).
