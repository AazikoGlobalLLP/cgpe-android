# Phase 25 — Commissions EARNED aggregate (the Phase-6 D-5 unblock)

**Status:** BUILT 2026-08-12. App-side only, against an already-shipped, already-verified endpoint.

Commissions (`src/app/commissions.tsx`) has never shown real earned data — it read
`GET /api/commissions` (owner-scoped **raw rows**), which `getCommission()` collapsed to a zeroed
shell, so the screen always rendered `blank` (Phase-6 D-5). The blocker was the missing **aggregate**
endpoint. `cgpe-api` shipped it (Backend Phase 31): `GET /api/commissions/my-summary`, the exact
self-scoped earned aggregate mobile filed. This phase consumes it.

## Source of truth (verified before writing code)

- `contracts/INBOX.md` — the `→ cgpe-mobile · 2026-08-12 · from cgpe-api` **LANDED** item (Backend
  Phase 31), which carries the full response shape and semantics.
- `contracts/api.md` §`/api/commissions` — the `/my-summary` row.
- `contracts/CHANGELOG.md` 2026-08-12 (ADDITIVE) — the change entry. No `models.md` change
  (response-only; nothing stored).

## The endpoint

`GET /api/commissions/my-summary` — `protect`-only, **self-scope forced to the token** (any
`?user_id=`/`?advisor_id=` is ignored; a caller can only read their own commissions, exactly like
`/payroll/my-earnings`). **No query params.** Returns:

```jsonc
{ "success": true, "data": {
  "thisMonth": 0, "lastMonth": 0, "pending": 0, "ytd": 0,
  "history": [ { "month": "Jul", "amount": 0 } ],   // last 6 calendar months, ASCENDING oldest→newest
  "recent":  [ { "id": "", "client": "", "plan": "", "amount": 0, "date": "ISO" } ]   // ≤5, newest first
} }
```

- **Bucketing axis = the commission's business period** (`month`+`year`), NOT `created_at` — a July
  commission counts as July regardless of when it was keyed in.
- **Earned** = every status EXCEPT `cancelled`/`disputed`. `ytd` = Σ for the current year.
  `pending` = Σ where `status==='approved' && is_paid===false` (the approved-but-unpaid balance).
- `recent[].client` = joined `Client.name` (`''` for a bonus/contest/override row with no `client_id`);
  `recent[].plan` = `policy_details.policy_type` else `commission_type`; `recent[].date` = `created_at`.
- **`tier` is NOT in this response** (re-deriving `total_premium` here would fork that business
  figure). Tier stays on `getMdrtTier` / `GET /api/advisor/performance/:advisorId` (Phase 23).
- **Empty = HTTP 200 with zeros + empty arrays** (no banner). **DB down = 503 + Retry-After** (banner).

## What was built

### `src/data/api.ts`

- New `getCommissionSummary(): Promise<CommissionSummaryResult>` where
  `CommissionSummaryResult = { status:'ok'; summary: Commission } | { status:'error' }`.
- **Two outcomes**, copied from `getMdrtTier`'s low-level `req()` posture (not `tryReal`, which would
  collapse the envelope via `json?.data ?? json`):
  - `ok` — a 200 whose `data` is an object. **200-zeros is an `ok`, raises no banner**; the screen's
    own blank check turns it into the calm "none yet" state (there is no `data:null` empty here, so
    this is a two-state result like `getMdrtTier`, not the three-state `getMyEarnings`).
  - `error` — a **503** (banner via `reportIfOutage`) OR a dead network / 4.5 s abort / contract-shape
    miss (`reportFailure`). A **401/403/404** is suppressed (an answer, not an outage).
- The mapping is **defensive**: `fin()` coerces every ₹ to a finite number, malformed `history`
  entries (non-string month / non-finite amount) are dropped, and each `recent` row's missing string
  fields default to `''`. **`target: 0` always** — the endpoint carries no target and none is invented.
- **Dead code removed:** the old `getCommission()` and its mis-shaped `EMPTY_COMMISSION` shell (single
  caller, now gone) were deleted, consistent with the Phase-14 dead-code sweep.

### `src/app/commissions.tsx`

- `load()` now calls `api.getCommissionSummary()` and sets `data` to `r.summary` on `ok`, `null` on
  `error`. Every existing render defense is unchanged — the screen already reads every field through
  `num()` + `Array.isArray`, computes `blank` (all-zeros), and branches its empty copy on
  `useDataHealth().degraded`, so the three visible states fall out for free:
  - real figures → the ledger;
  - `ok` zeros → `blank && !degraded` → "No commission recorded yet" (calm, no banner);
  - `error` → `data:null` → `blank && degraded` → "Your earnings did not load" + Try again + banner.
- The MDRT tier element (`MdrtTierProgress`, Phase 23) is untouched — a separate element on a separate
  endpoint, mounted above the ledger fork.
- The boundary comment was updated to describe `getCommissionSummary`'s union (honesty of comments).

### `src/data/__tests__/api-commissions.test.ts` (new, 14 cases)

Pins the wire contract through the public `getCommissionSummary`, `fetch` stubbed at the one boundary:
the request is **param-free and self-scoped** (no `user_id`/`advisor_id`/`?`); the field mapping;
every ₹ passed through **verbatim** (no on-device arithmetic); `target:0` is never invented; history
order preserved + malformed entries dropped; `recent` string fields defaulted; **200-zeros = `ok` with
no banner**; 503 = error + banner; 403/404 = error + no banner; 200-non-object = error + reported
fault; network throw = error + banner; a demo session makes no request.

## Done when

1. `commissions.tsx` renders real `thisMonth/lastMonth/pending/ytd/history/recent` from
   `/commissions/my-summary`; 200-zeros shows the calm empty state (no banner), 503 shows the
   retryable error state (banner) — met.
2. `api-commissions.test.ts` pins the envelope — met (14 cases).
3. `npx tsc --noEmit` clean, `npm test` green, no new lint errors — met (tsc 0, **387/387** (+14),
   lint 0 errors / 12 warnings baseline).
4. INBOX Phase-31 box ticked — met.
5. **Device check (carried):** open Commissions as a real advisor with booked policies against
   production and confirm the earned figures/history/recent render (not the empty state), light/dark
   at 390 px. Web/`npm test` cannot exercise the real host — same carried-verification shape as prior
   phases. Push still 403s (commit local).

## Deliberately out of scope

- **`target` / the monthly-target meter.** `/my-summary` carries no target, and `next_premium` (the
  MDRT tier goal) is an annual cumulative-premium figure in a different unit — it must not feed the
  monthly meter (INBOX 2026-08-12). `target` stays 0 → "no monthly target set". If a real monthly
  target source is wanted, it is a fresh `cgpe-api` ask.
- **Per-line-item drill-down / a full ledger page.** The screen shows the ≤5 `recent` rows the
  endpoint returns; a paginated ledger is not in scope.
- MDRT tier (already shipped as Phase 23).
