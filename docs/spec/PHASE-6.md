# Phase 6 (partial) — Notes search + LIC plans envelope

**Status:** spec locked 2026-08-11. App-side only. Commissions (the third of Phase 6) stays
**backend-blocked** and is out of this phase — see D-5.

Phase 6 in `docs/PHASES.md` bundled three "envelope mismatch" screens: commissions, LIC plans,
notes search. It was tagged `[api]`. That tag is stale for two-thirds of it (DECISIONS 2026-08-11):
notes and LIC are pure app-side conformance bugs; only commissions needs a server endpoint that is
still pending. This phase ships the two app-side halves.

## The two bugs, verified against the producer's code

### 1. Notes search — the app sends the wrong query key

`getNotes` (`src/data/api.ts`) builds `/notice-board?search=<term>`. The backend handler
(`cgpe-backend-main/routes/noticeBoard.js:93`) destructures `const { q, category, tag, status,
pinned, page, limit } = req.query` and applies the text filter on **`q`** (`:102-105`), across
`text`, `transcript`, `tags` and `noticeId`. It never reads `search`. So **every notes search the
app has ever run was silently ignored** — the server returned the caller's whole board unfiltered
and the app filtered nothing. `qs()` drops empty values, so an empty search sends no `q=` (unchanged).

**Fix:** send `q` instead of `search`. One key rename in the `qs({...})` call. The app's internal
`getNotes({ search })` signature is unchanged — only the wire key moves.

### 2. LIC plans — the app never unwraps `{ meta, plans }`, and has no field adapter

`GET /api/lic-plans` is **live**, not 404. It is mounted at `cgpe-backend-main/app.js:461` and its
GET handler (`routes/licPlans.js:62-71`) returns:

```
{ success: true, data: { meta, plans: rows.map(unifiedToLic) } }
```

`getLicPlans` did `tryReal<any[]>('/lic-plans', {}, isArr)`. `tryReal` unwraps `json.data` to the
`{ meta, plans }` **object**, then `isArr` fails on it (it is not an array) → `null` →
`unavailable(...)` → empty. So the screen showed empty against a perfectly healthy backend, and —
because a 200 with an unusable body is *reported* (`api.ts` `tryReal` doc) — it also raised a false
outage. Two layers were wrong:

- **Envelope:** the plans are at `data.plans`, not `data`.
- **Fields:** each plan is in the **legacy LIC shape** produced by the backend's `unifiedToLic`
  (`services/productIngestion.js:142-157`) — `product_id`, `plan_name`, `plan_table`,
  `category_label`, `summary`, `riders[]` — none of which match the app's `LicPlan`
  (`name`, `code`, `type`, `tags`, …). Even a bare array would have rendered blank rows.

**Fix:** `getLicPlans` validates `Array.isArray(d.plans)`, then maps `d.plans` through a new pure
`adaptLicPlan` (`src/data/adapt.ts`).

## The `/api/lic-plans` "404 in production" question — SETTLED: it is live (D-1)

The handoff flagged a blocker: `api.ts` comments (old `:1977`, `:125`) asserted `/api/lic-plans`
**404s in production**, while `contracts/api.md:1187-1195` documents it live. Shipping an unwrap for
a dead endpoint would be wasted work. **Resolved against the producer's real code, not the prose:**

- `app.js:461` — `app.use('/api/lic-plans', require('./routes/licPlans'));` — the router is mounted.
- `routes/licPlans.js` — full CRUD, `router.use(protect)`, GET readable by any staff, seeds the
  unified collection on first read.

Deployed, mounted code — not an env/secret question. The only way it 404s in production is if the
droplet runs code older than this working tree, and `cgpe-api` has been actively shipping from this
tree (Phases 5, 8, 9, 10, 14 all landed 2026-08-11). The "404 in production" comments are **stale
and are corrected** as part of this phase (honesty-of-comments, Phase 8 precedent). The device
acceptance check (below) is what confirms it against the real host.

## `adaptLicPlan` — the locked field mapping (D-2)

Maps each legacy-LIC plan (wire) → `LicPlan` (app). Only fields the wire actually carries are
mapped; the rest stay empty and the screen already drops empty values rather than printing
"undefined".

| `LicPlan` | ← wire (`unifiedToLic` output) | note |
|---|---|---|
| `id` | `product_id` \|\| `_id` | LIC product code, e.g. `LIC-914` |
| `name` | `plan_name` | e.g. "New Endowment Plan" |
| `code` | `plan_table` | LIC plan/table number, e.g. "914" — the UI's "Plan number" |
| `type` | `category_label` \|\| `category` | e.g. "Endowment (participating)"; the group heading |
| `highlight` | `summary` \|\| `benefit_note` | one-line plan description |
| `tags` | `riders[]` (strings only) | rider names; surfaced under a **"Riders"** heading (D-3) |
| `minAge` | `0` | **not carried** — see below |
| `maxAge` | `0` | **not carried** |
| `term` | `''` | **not carried** |

**Why entry-age and term are empty (not mined).** The seed
(`cgpe-backend-main/data/lic_plans_library.json`) carries no plan-level entry-age band and no
plan-level term. The only `term` present is a single illustrative value inside
`worked_example.inputs.term` (e.g. 20) — one example, **not** the plan's allowed term range — and
`worked_example` is an opaque calc blob. Mining a plan-wide "term" or "entry age" from one worked
example would be fabricating a figure the data does not assert, which the no-mock-data contract
exists to stop. `minAge`/`maxAge`=0 → `posInt` → `null` → the UI drops the age row; `term`='' →
dropped. Honest omission, not a made-up number.

## Scope decisions

- **D-3 — "Sold for" → "Riders".** The LIC detail sheet rendered `plan.tags` under a **"Sold for"**
  heading. `tags` now carries `riders`, so that heading would mislabel riders as target segments.
  The heading is corrected to "Riders". (The wire carries no "sold for / segment" list; that pill
  group is genuinely riders now.)
- **D-4 — empty state branches on health.** The old empty state hard-coded "The plan library is not
  published yet / not being served to the app on this build" — now false, since the endpoint is
  live. Rewritten to mirror the sibling `kb.tsx`: `useDataHealth().degraded` → "couldn't load,
  retry"; otherwise → a calm "no plans on file yet". No copy claims a build/publish state that is
  not real.
- **D-5 — commissions stays out.** `GET /api/commissions` returns owner-scoped **raw rows**
  (`api.md:1163`), not the aggregate the screen wants, and `target` has no source in the rows. The
  aggregate endpoint (`/api/commissions/team-summary`, un-shadowed by backend Phase 13) exists but
  the *product* aggregate the screen needs is still pending (product-owner confirmed, DECISIONS
  2026-08-11). Deriving money on-device is rejected (Phase 16 precedent). `commissions.tsx` is
  untouched.

## Files

- `src/data/api.ts` — `getNotes` (`search`→`q`), `getLicPlans` (unwrap `data.plans` + adapt),
  and the two stale "404 in production" comments corrected.
- `src/data/adapt.ts` — new `adaptLicPlan`; `LicPlan` added to the type import.
- `src/app/lic-plans.tsx` — stale header comment corrected, empty state branched on health,
  "Sold for" → "Riders".
- `src/data/__tests__/api-lic.test.ts` (new) — pins the envelope unwrap, the field mapping through
  the public `getLicPlans`, and the health behaviour (live 200 reports no outage; 500 does; 404
  stays quiet).
- `src/data/__tests__/api-notes.test.ts` (new) — pins that the search term goes out as `q`, never
  `search`.
- `src/data/__tests__/adapt.test.ts` — `adaptLicPlan` pure-mapping cases.

## Done when

1. `getNotes({ search: 'x' })` sends `/notice-board?q=x` (never `search=x`) — pinned by test.
2. `getLicPlans()` against the live `{ data: { meta, plans } }` returns adapted `LicPlan[]` with
   real `name`/`code`/`type`/`highlight` and no false outage — pinned by test.
3. `npx tsc --noEmit` clean, `npm test` green, no new lint errors.
4. **Device check (carried):** open LIC Plans against production with a staff token and confirm the
   catalogue renders (not the empty state); type a term into Notes search and confirm the list
   narrows. Web/`npm test` cannot exercise the real host — same carried-verification shape as
   Phases 1/4/5/7/12/13.

## Deliberately out of scope

- Commissions (D-5, backend-blocked).
- `nav.more_sections`, notes `needsPhone` empty-state copy, LIC `worked_example`/calc rendering,
  and any `/api/products` multi-carrier migration — none are Phase 6's DONE-WHEN.
