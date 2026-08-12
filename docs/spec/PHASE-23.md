# Phase 23 — MDRT tier-progress element on Commissions

**Built 2026-08-12.** The buildable slice of the Phase-6-blocked commissions screen — HANDOFF
option (d). Commissions itself stays backend-blocked on the earned aggregate
(`GET /api/commissions/my-summary`, filed to `cgpe-api`, unscoped). This ships the ONE real,
server-authoritative datum the screen can already show: the caller's **MDRT/COT/TOT tier progress**,
as a **separate element** — never the monthly meter.

## Goal
Render an advisor's own MDRT tier progress on `src/app/commissions.tsx`, reading the
already-verified backend Phase-29 endpoint, so the screen shows real data even while the earned
ledger is blank.

## Files
- `src/data/api.ts` — new `getMdrtTier(advisorId)` + `MdrtTier`/`MdrtTierResult` types.
- `src/app/commissions.tsx` — new `MdrtTierProgress` component + `TierSkeleton`; role-gated mount.
- `src/data/__tests__/api-mdrt.test.ts` — new, 13 cases pinning the wire contract.

## Source of truth (verified in the producer's real code, not tags)
- `GET /api/advisor/performance/:advisorId` (`routes/advisor.js:23`, `protect`). Returns
  `data.performance.{ total_premium, mdrt_tier:{ current, next, next_premium, to_next } }`.
  `contracts/api.md` §`/api/advisor` (row confirmed 2026-08-12), `utils/mdrtTiers.js`
  `classifyMdrtTier` (six owner-confirmed thresholds ₹3.75L…₹90L).
- The app's `User.id` maps from the backend `user_id` (`adapt.ts:153`), so passing `user.id` as
  `advisorId` is a self-read.

## Done when
`npx tsc --noEmit` clean · `npm test` green · no new lint errors — **all met**: tsc exit 0,
`npm test` **373/373** (+13, `api-mdrt.test.ts`), lint 0 errors / 12 warnings (baseline). Device
check (renders on a real handset, light/dark at 390 px, for a real advisor with sales) outstanding.

## Decisions

**D-1 — A SEPARATE element, never the monthly meter.** `next_premium` is an **annual cumulative-FYC-
premium** tier goal; the screen's meter is `thisMonth / target` in **monthly commission**. Feeding the
tier figure into that meter would read ~0% forever and mislabel a career goal as a monthly quota
(INBOX 2026-08-12). So the tier renders in its own card with its own meter (`total_premium /
next_premium`), and the two never mix.

**D-2 — Its own endpoint, so it renders ABOVE the ledger's loading/blank fork.** The tier reads
`/advisor/performance/:advisorId`, independent of `getCommission()`. `getCommission` still resolves
the empty shell (Phase-6 D-5), so the screen is always `blank` today — a tier card placed *inside*
the non-blank branch would never show. It is mounted above the fork and shows real data while the
ledger stays blank. That is the entire value of the slice.

**D-3 — Gated to `advisor` / `learn_advisor`, reading own id.** The MDRT ladder is an advisor-track
FYC-premium achievement. The backend 403s an `advisor` for any id but their own (`advisor.js:28`),
team-scopes a `leader` (403 on their own id — no self team row), and a `total_premium` of ₹0 for an
admin/payroll is a meaningless "0% to Quarter MDRT". So the element is gated to the roles it means
something for. A 403 is still handled as an **answer** (suppressed, no banner), so a stale-role
deep-link degrades to a silent no-card, never a false ₹0.

**D-4 — `req()` not `tryReal`, two outcomes told apart; silent on error.** Same three-state posture as
Phase 16's `getMyEarnings`: `ok` (valid tier) vs `error` (5xx/network → banner via `reportIfOutage`;
401/403/404 → suppressed). On error the card renders **nothing** — it is a bonus element, and a real
outage is already announced once by the global `<HealthBanner/>`. A stable health key
`/advisor/performance/:id` is used so repeated failures collapse to one banner row regardless of the
id's form.

**D-5 — Every ₹ is the server's; tier labels rendered verbatim.** No on-device arithmetic on any
figure. The tier names (`Quarter MDRT`…`TOT`) are rendered exactly as the server sends them — no
acronym is expanded or invented (CLAUDE.md). The TOT top state (`next:null`) shows "the highest
tier", no meter.

## Not done (deliberate)
- **The earned aggregate** (`thisMonth/lastMonth/pending/ytd/history/recent`) — still backend-blocked
  on `GET /api/commissions/my-summary`. This slice does not touch that; the filing to `cgpe-api`
  stands.
- **No leader/admin tier view.** A leader's own-id read 403s by backend design; a team roll-up would
  be `/advisor/team-performance` (leader-only) — a different, larger surface, out of scope.
- **Device check.** A real advisor with sales, light/dark at 390 px — not editor-buildable.
