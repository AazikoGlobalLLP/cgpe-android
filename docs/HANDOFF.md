# HANDOFF — CGPE Connect (Android) — Phase 20: admin payroll roster (in-app) — 2026-08-11

Built an **admin-only payroll roster screen** in the app, at the owner's direction. This is a scope
change from Phase 16, not the Phase 16 self-view — that stays blocked. First the salary state was
re-verified against `cgpe-api`'s **real code** (the user believed "salary is done from the backend";
it is built but deliberately admin-only, with no self-scoped read), then the admin screen was built on
the endpoint that actually exists.

## Done
- **Re-verified the salary blocker against the producer's real code** (not tags, not my earlier read).
  The whole payroll router is admin-only: `routes/payroll.js:22-23` = `router.use(protect);
  router.use(authorize('admin'))`, `middleware/auth.js:73` 403s any non-`admin`/`super_admin`, and a
  whole-tree grep (`earnings|my-earnings|/payroll`) finds only the 8 admin routes — no self-scoped read
  was ever built. So the Phase 16 self-view (every advisor sees their own pay) is genuinely still
  blocked; the manager-facing admin surface is what exists.
- **Built Phase 20 — an admin-only in-app payroll roster.** New route `src/app/payroll.tsx` on
  `GET /api/payroll/compute?year=&month=` (admin/super_admin only). A 12-month strip (current first);
  shows total payable, member count, and per-member name / pay segment / present-days / the
  **server-computed** payable. Reached from **More → Payroll** (Admin group).
  - **No PII on the phone** — `/compute` omits Aadhaar/PAN/bank (`routes/payroll.js:306`); those live
    only on `/profiles` + `/export`, which this screen does not call.
  - **The app never multiplies** — every `payable` is the server's; the sole on-device sum is the roster
    total (an aggregate of computed figures). Pinned by a test.
  - **Gated on the REAL role, not the tier** — mobile's `tierOf` folds `leader` into "admin" but the
    backend 403s a leader, so the More row and the screen both gate on
    `user.role === 'admin' || 'super_admin'`. A leader never fetches; a stale-role deep-link degrades to
    "admin-only"/"could not load" (403 → `tryReal` null), never a false ₹0.
- **Answered one outstanding INBOX FYI** addressed to this session — cgpe-api **Phase 20** (attendance
  `/calendar` + `/day/:date` ObjectId-join fix). Verified as a genuine no-op (the app calls neither
  endpoint: two greps, both zero) and replied underneath (box left unticked — multi-recipient). Grepped
  the reply back per the concurrent-write rule; it survived.

## Files changed
- `src/data/api.ts` — new `getPayrollRoster(year, month)` + `PayrollRow` / `PayrollMonth` types (after
  `getAttendanceHistory`).
- `src/app/payroll.tsx` — **new** screen (the admin payroll roster + `MonthStrip` / `MemberRow` /
  `RosterSkeleton`).
- `src/app/(tabs)/more.tsx` — one gated Payroll row in the Admin group (real-role gate).
- `src/data/__tests__/api-payroll.test.ts` — **new**, 7 tests (request, envelope, payable passthrough,
  empty roster, 403-is-answer, 503-is-outage, demo no-op).
- `docs/spec/PHASE-20.md` (new), `docs/PHASES.md` (Now + board row 20 + Next-3 #1), `docs/DECISIONS.md`
  (top entry), this file, `docs/STATUS.md` (manager-facing rewrite).
- `../contracts/INBOX.md` — the Phase-20 attendance FYI reply (untracked disk; not in any commit).

## Gates
- `npx tsc --noEmit` → exit 0.
- `npm test` → **330 / 16 files** (+7). Was 323.
- `npm run lint` → **0 errors, 12 warnings** — byte-identical baseline; none of the 12 are in the new
  files.

## Decisions made
- **Verified before building** — the user said the salary backend was done; it is, but admin-only, and
  the self-read Phase 16 needs does not exist. Reported that with evidence rather than building against
  the wrong assumption.
- **Built a separate admin screen, not a Phase 16 re-scope** — the Phase 16 UI lock and its self-read
  ask are untouched. This screen is a mobile slice of the `cgpe-admin` payroll surface (accepted
  duplication, owner's call).
- **Consumed `/compute` (no PII), gated on real role, never multiplied** — see `docs/spec/PHASE-20.md`
  D-1…D-6 and DECISIONS 2026-08-11 (top).

## Known broken / deliberately skipped
- **Phase 16 self-view still blocked** — on a self-scoped earnings read (`GET /api/payroll/my-earnings`,
  `protect` only) that does not exist. Phase 20 does not unblock it.
- **Phase 6 commissions — unchanged, still blocked** (no product aggregate / no `target`).
- **`git push` still 403s** — credential `reactjsaaziko` has no write access; commit is **local only**.
- **Device check for `/payroll`** — renders on a real handset in light/dark; carried with the other
  device-verification items (web/native slices).

## Next session starts here
- First command: `/boot`, then re-read `../contracts/INBOX.md` for a `cgpe-api` reply to the narrowed
  self-earnings ask (still at the foot of the file, unanswered) before assuming Phase 16 is buildable.
- If a self-scoped read landed: build the Phase 16 self-view per its preserved UI lock (do **not** point
  `payroll.tsx` at it — that's the admin roster).
- Else editor-buildable work is: widen `t()` coverage (needs human-supplied Hinglish/Gujlish copy) or
  the handset device backlog. Nothing else is unblocked.
- Watch out for: the payroll surface is admin-only by the owner's deliberate decision — do not read the
  existence of `/compute`/`/export` as "Phase 16 unblocked". Mobile's tier folds `leader` into "admin",
  so any new payroll surface must gate on the real `user.role`, not `caps`.
