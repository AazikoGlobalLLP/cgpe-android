# HANDOFF — CGPE Connect (Android) — Phase 62 (commissions target + byProduct) — 2026-08-17

Owner-driven session. Two instructions: (1) de-prioritise Phase 41 on-device verification to **last**,
and (2) make the **backend-shipped task #1** and complete it. The backend update was `cgpe-api`'s
**Backend Phase 62** — the commissions screen's `target` (MDRT tier) + `byProduct` breakdown are now
live on `GET /api/commissions/my-summary`. Built and shipped the mobile side. Also handed the owner a
walkable device-test guide for Phase 41 (published as an artifact) before it was parked.

## Done
- **The Commissions screen now shows the MDRT-tier target and a per-product breakdown from one call.**
  An advisor sees their tier card (next-tier premium + progress) sourced straight from the commissions
  summary, and a new **"This year by product"** section where each bar is that product's share of the
  year-to-date total. A non-advisor (admin/payroll/leader) sees neither — no meaningless "₹0 · 0% to
  Quarter MDRT". The app renders the server's numbers and never re-sums.
- **One fewer network call:** the tier card previously made a second request to `/advisor/performance`.
  Backend Phase 62 shares the FYC basis, so the tier now rides on `/my-summary` and the second call is gone.
- **Phase 61 (backend QA-sweep hardening) verified mobile-unaffected** — the app's status-branching is
  already honest and every list it requests is ≤500/page, under the new 1000/page cap. No code change.
- **Phase 41 device-testing guide handed to the owner** (artifact) — 16 checks, 4 Android phones
  (Shivam/Ved/Pavitra field + a Master watcher), steps + expected results + a tick-off grid; iOS not needed.

## Files changed
- `src/data/types.ts` — `Commission.target` is now `CommissionTarget | null` (was scalar `0`); added
  `CommissionProduct` + `Commission.byProduct`.
- `src/data/api.ts` — `getCommissionSummary` maps `target` (camel-cased off the wire; odd/absent → `null`)
  and `byProduct` (nameless rows dropped, absent → `[]`); dropped the stale `target:0` mapping + comment.
- `src/app/commissions.tsx` — tier card driven off the summary's `target` (second `getMdrtTier` call
  removed), advisor-gate kept, always-blank "Monthly target" meter removed, new "This year by product"
  section added, `MdrtTierProgress` → pure `MdrtTierCard(tier)`.
- `src/data/__tests__/api-commissions.test.ts` — +5 cases (target object mapping, target null, odd
  target→null, byProduct verbatim + Σ===ytd, malformed byProduct dropped). Suite 552→557.
- `docs/PHASES.md` — Phase 62 added to `## Now`; `## Next 3` re-ordered; Phase 41 device-verify → last.
- `../contracts/INBOX.md` — replied under both 2026-08-17 `from cgpe-api` items (not committed; the
  contracts dir is untracked by design).

## Decisions made
- **Drive the tier card from `/my-summary.target`, drop the second `/advisor/performance` call** — the
  backend explicitly shares the FYC basis (Phase 62), so one call suffices. Kept the advisor/`learn_advisor`
  gate so a non-advisor never sees a meaningless "0% to Quarter MDRT". See DECISIONS 2026-08-17.
- **`getMdrtTier` kept exported + tested, just not called by this screen** — it is a legitimate
  `/advisor/performance` reader; removing it (and its 13-test file) is churn for no gain.
- **`target` labelled as a PREMIUM/production goal, not a rupee-commission target** — per the backend's
  explicit ⚠️; there is no commission-amount target in the data, so none is invented (rule 1/2).

## Known broken / deliberately skipped
- **Not yet live on device** — the two keys appear only after `cgpe-api` restarts `:3001`. Until then
  `/my-summary` returns the old body and the mapping falls back cleanly (`target:null`, `byProduct:[]`).
- **Phase 41 device verification is untouched and now parked LAST** (owner) — editor-complete, needs a
  handset; APK `7cdc351d` + `docs/spec/PHASE-41-DEVICE-CHECKLIST.md` are ready when the phones are.
- **`git push` still 403s** — commits `fc92573`, `e3341da` are local only. Blocks Phase 49, not this.
- **Phase 50** (dual-office + reason) still backend-gated; owner must relay the two filed `[api]`s.

## Next session starts here
- Phase 62 go-live check: once `cgpe-api`'s `:3001` restart lands, confirm on a real advisor account that
  the tier card + per-product bars render and `Σ byProduct === ytd`. Editor work is done.
- First command: `/boot`
- Watch out for: **a device miss here is almost certainly the backend not restarted, not a client bug** —
  `/my-summary` only returns `target`/`byProduct` after `cgpe-api`'s `:3001` restart (the standing OPS trap).
