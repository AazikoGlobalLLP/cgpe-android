# Phase 20 — Admin payroll roster (in-app), on the existing admin endpoint

Built 2026-08-11. Owner-directed scope change from Phase 16.

## Why this exists (and how it differs from Phase 16)

Phase 16 ("My earnings") is a **self-view**: every signed-in advisor sees *their own* attendance-derived
pay. It is still **blocked** — the backend salary surface is deliberately admin-only
(`routes/payroll.js:22-23` = `router.use(protect); router.use(authorize('admin'))`), and no self-scoped
read exists (`grep -i earnings` over the backend = 0; the narrowed ask sits unanswered at the foot of
`../contracts/INBOX.md`). That was re-verified against the producer's **real code** this session
(`middleware/auth.js:73` 403s any non-admin; the whole-tree grep finds only the 8 admin routes).

At the owner's explicit direction (they chose "Build an admin-only salary screen in the app" when asked),
this phase builds a **different** screen against the endpoint that *does* exist: `GET /api/payroll/compute`,
admin/super_admin only. It is a mobile slice of the payroll roster the `cgpe-admin` panel owns — **not** a
self-service earnings screen, and **not** the Phase 16 UI (whose lock is preserved for when the self-read
lands).

## What was built

**Files (4):**
- `src/data/api.ts` — `getPayrollRoster(year, month)` + `PayrollRow` / `PayrollMonth` types.
- `src/app/payroll.tsx` — the screen (new route `/payroll`).
- `src/app/(tabs)/more.tsx` — one gated entry row in the Admin group.
- `src/data/__tests__/api-payroll.test.ts` — the wire contract (7 tests).

**Endpoint.** `GET /api/payroll/compute?year=&month=` → `{ success, data: RosterRow[], period, message }`,
`RosterRow = { user_id, name, staff_found, segment, salary_amount, office_hours, payable, months:[{ year,
month, working_days, present_days, worked_hours, per_day_rate, payable_precise }] }` (`contracts/api.md`
§`/api/payroll`). `getPayrollRoster` requests one month, so the client already knows the period; it reads
the roster array `tryReal` unwraps from `json.data` and ignores the top-level `period`.

## Locked decisions

- **D-1 — No PII on the phone.** `/compute` deliberately omits Aadhaar/PAN/bank (`routes/payroll.js:306`);
  those live only on `/profiles` and `/export`. The screen shows salary amount, attendance days/hours, and
  the server-computed `payable`. No PII field is fetched or rendered.
- **D-2 — The app never multiplies.** Every `payable` is computed server-side. The only arithmetic on the
  screen is the roster **total**, a `reduce(+)` over the server's own per-member payables — an aggregate of
  computed figures, not a salary derived from a rate. A test pins that `payable` is passed through verbatim.
- **D-3 — Gate on the REAL role, not the tier.** Mobile's `tierOf()` folds `leader` into the `admin` tier
  (`store/roles.ts:43`), but the backend `authorize('admin')` **403s a leader**. So the More entry row and
  the screen both gate on `user.role === 'admin' || 'super_admin'`, never on `caps.manageTeam`. A leader
  therefore never reaches the fetch; a stale-role deep-link still degrades honestly (403 → `tryReal` null →
  the "could not load / admin-only" states), never a false zero.
- **D-4 —403 is an answer, 503 is an outage.** `getPayrollRoster` returns `null` on any failure/refusal and
  `[]` on a loaded-but-empty roster, so the screen tells "loaded, none" from "could not load". `tryReal`
  suppresses 403/404 (no banner) and reports 503 (banner) — pinned by two tests.
- **D-5 — Not a new tab, no server nav key.** Reached from More's Admin group only. The row carries no
  `navKey`: it is a local feature, not part of the server `nav.tabs`/`nav.hidden` schema, so it is not
  hideable via RBAC config (and cannot be accidentally filtered by an unknown key).
- **D-6 — Month strip, not the Phase 16 hero.** Last 12 months, current first, built once in a lazy
  `useState` initialiser (never `new Date()` in render — `react-hooks/purity`, Phase 15). The Phase 16 UI
  lock (`useCountUp` hero, `<Spine>`, `characters.tsx`) is untouched and reserved for the self-view.

## DONE WHEN (met)

- [x] An admin/super_admin opens **More → Payroll** and sees the month's roster: total payable, member
      count, and per-member name / segment / present-days / server payable.
- [x] A leader/advisor never sees the row, and a deep-link to `/payroll` shows an honest "admin-only" or
      "could not load" state — never a fabricated ₹0.
- [x] The displayed payable equals the server's `payable`; no `*` on a rate in `src/app/payroll.tsx`.
- [x] `npx tsc --noEmit` exits 0; `npm test` green (**330**, +7); `npm run lint` no new errors.

## Out of scope / carried

- **The Phase 16 self-view stays blocked** — this does not build it, and the narrowed self-read ask stays
  filed with `cgpe-api`.
- **No writes.** Payroll profiles are created/edited in the `cgpe-admin` panel; this screen is read-only.
- **No Excel export** (`/export` is a binary download, admin panel's job) and **no per-member month drill-down**
  beyond the selected month's figures. Device check: renders on a real handset in light/dark — carried, like
  the other device-verification items.
