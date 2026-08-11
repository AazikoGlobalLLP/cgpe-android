# HANDOFF — CGPE Connect (Android) — Phase 6 (PARTIAL — BUILT) — 2026-08-11

Phase 6's two app-side halves (notes search, LIC plans) are built, gated green, and committed
locally on branch `Shivam` as `7c11c82`. Its third — commissions — stays **backend-blocked** and was
not touched. `git push` still 403s (unchanged — credential `reactjsaaziko` has no write access to
`Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; needs a human). `7c11c82` and the two earlier Phase-12
commits (`4507d6e`, `c8a4a79`) are all local only.

Gates, all green after the change: `npx tsc --noEmit` exit 0; `npm test` **299 tests / 13 files**
(was 281/11 — +18: 6 `adaptLicPlan` cases in `adapt.test.ts`, new `api-notes.test.ts` (5), new
`api-lic.test.ts` (7); no regressions); `npm run lint` **0 errors / 12 warnings** (the Phase-15
baseline, nothing new).

## Done

- **Notes search actually filters now.** `getNotes` sent `/notice-board?search=<term>`, but the
  handler reads **`q`** (`cgpe-backend-main/routes/noticeBoard.js:93`, filter at `:102-105`) and
  ignored `search` — so every notes search this app ever ran came back as the caller's whole board,
  unfiltered. One wire key (`search`→`q`); the app's internal `getNotes({ search })` signature is
  unchanged, so `notes.tsx` needed no edit.
- **LIC Plans renders real plans instead of a permanent empty state.** Two layers were wrong:
  `getLicPlans` validated the unwrapped `data` envelope with an array check while the real body is
  `{ success:true, data:{ meta, plans } }` (`routes/licPlans.js:62-71`), and the legacy LIC field
  names (`plan_name`/`product_id`/`plan_table`/`category_label`/`riders`) never matched the app's
  `LicPlan`. It now unwraps `data.plans` and maps each row through a new pure `adaptLicPlan`. Against
  a healthy backend it also stops raising a **false outage** (the old `isArr` miss on a 200 body was
  reported as a contract fault).
- **The stale "`/api/lic-plans` 404s in production" claim is corrected, not just worked around.** It
  is live — mounted at `app.js:461`, full CRUD behind `protect`. The two `api.ts` comments and the
  `lic-plans.tsx` header + empty-state copy that asserted 404 were false and are fixed; the LIC empty
  state now branches on `useDataHealth().degraded` like `kb.tsx` (outage vs genuinely-empty).
- **Filed an INBOX notice** to `cgpe-api`/`cgpe-admin` (shipped app-side, no API change; the one open
  question is whether `/api/lic-plans` is actually deployed on the **droplet** — I verified only the
  working tree), grepped it back, confirmed it survived a concurrent write.

## Files changed

- `src/data/api.ts` — `getNotes` (`search`→`q`, one key); `getLicPlans` (unwrap `data.plans`, validate
  `Array.isArray(d.plans)`, map through `adaptLicPlan`); two stale "404 in production" comments
  corrected (the `reportIfOutage` doc and the Phase-9 layer header).
- `src/data/adapt.ts` — new `adaptLicPlan` (legacy LIC shape → `LicPlan`); `LicPlan` added to the
  type import. Entry-age/term deliberately map to empty (the wire carries neither).
- `src/app/lic-plans.tsx` — stale header comment rewritten; empty state branched on health; rider
  pills relabelled "Sold for" → "Riders" (D-3).
- `src/data/__tests__/adapt.test.ts` — 6 `adaptLicPlan` pure-mapping cases.
- `src/data/__tests__/api-lic.test.ts` — **new.** 7 cases: GET path, `data.plans` unwrap, field
  mapping through the public API, live-200-no-outage, and the failure classification (500 → outage,
  404 → quiet, 200-with-no-plans → contract fault reported).
- `src/data/__tests__/api-notes.test.ts` — **new.** 5 cases pinning the search term goes out as `q`,
  never `search`, plus category passthrough and the `all` sentinel drop.
- `docs/spec/PHASE-6.md` — **new.** Full spec, the five locked decisions, the field-mapping table.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md` — board row 6 → partial-done, `## Now` /
  `## Next 3` / Phase-6 detail updated; the Phase 6 (built) decision; this handoff.
- `../contracts/INBOX.md` — the shipped-app-side notice (that dir is untracked, so not committed).

## Decisions made

- **`adaptLicPlan` leaves entry-age and term empty rather than mining `worked_example`.** The legacy
  round-trip carries no plan-level entry-age band and no plan-level term; the only `term` present is a
  single illustrative value inside `worked_example.inputs` (one example, not the plan's range). Mining
  it would fabricate a number the data does not assert — the exact class the no-mock-data contract
  stops. See DECISIONS 2026-08-11 (Phase 6 — built) D-2, and the spec's mapping table.
- **`riders` → `tags`, with the pill heading relabelled "Sold for" → "Riders" (D-3).** `tags` now
  carries real rider names; the old "Sold for" heading would mislabel them as target segments. The wire
  carries no "sold for" list, so relabelling is the honest fix.
- **Commissions left untouched (D-5).** `GET /api/commissions` returns owner-scoped raw rows, not the
  aggregate the screen wants, and `target` has no source. The product aggregate endpoint is still
  pending (product-owner confirmed). Deriving money on-device is rejected (Phase 16 precedent).

## Known broken / deliberately skipped

- **Phase 6's device DONE-WHEN needs a handset + live host** — the LIC catalogue rendering against
  production and notes search narrowing the list. `npm test` covers the wire contract only. Carried,
  like Phases 1/4/5/7/12/13.
- **The `/api/lic-plans` droplet question is open** — I verified it is live in the backend working
  tree, not on the production droplet. If the droplet runs older code where it 404s, the LIC fix is
  inert (screen degrades honestly) until redeploy. Asked in the INBOX; only `cgpe-api` can answer.
- **`git push` still 403s** — `7c11c82` (and `4507d6e`, `c8a4a79`) are local only. A human must grant
  write access or swap the Windows-credential-manager credential. Did not retry; did not touch the remote.
- **Commissions (Phase 6, third part) not started** — backend-blocked, above.

## Next session starts here

- **Phase 6 commissions is backend-blocked** — nothing app-side to build until `cgpe-api` exposes the
  product aggregate endpoint. The genuinely-buildable next work is the **device-verification backlog**
  (Phases 1/4/5/6/7/10/12/13 handset checks) or the small carried-out `dashboards.tsx:292-297`
  partial-outage tile (`## Next 3` item 3 — a partial outage still renders "0 clients · ₹0 claims
  paid" as fact on the Master KPI tiles; the hero above already uses `NO_VALUE`).
- **First command:** `/boot`
- **Watch out for:** the `dashboards.tsx` tile is `snapshot?.total_clients ?? 0` at `:292-297` — the
  fix is to give the tile grid the same `NO_VALUE` treatment the hero at `:266` already has, gated on
  `useDataHealth().degraded`, **not** to widen types or invent a new empty shell. It is small and
  specified; do not let it absorb the whole dashboard.
