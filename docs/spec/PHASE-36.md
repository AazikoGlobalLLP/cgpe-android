# Phase 36 — [audit] Hardcoded-vs-DB data sweep (notifications first, then app-wide)

**Audit-only phase** (per `docs/PLAN-2026-08-14.md` Group A / §Phase 36). Deliverable is an **inventory**
separating (a) real fabrication to remove, (b) legitimate documented synthesis to keep, (c) static label/UI
config (fine). `[m]` — no contract change, no `[api]` ask. **No `src/` change** (see §1). Feeds Phase 37.

## 0. The question

The owner wants to know how much of the app is **hardcoded / synthesised** vs. really from the DB, and any
fabrication removed. Start with notifications/feeds, then sweep app-wide.

## 1. Verdict (headline)

**Bucket (a) — real fabrication to remove: NONE. There is nothing to delete.** No runtime path in `src/`
fabricates domain data: no seeded array of clients/leads/claims/plans/contests/notifications, no invented
rupee figure, no fake count/delta/timeline, and no `catch`/fallback that substitutes made-up records. The
no-mock-data contract is **already fully enforced**, and prior phases already removed every historical
fabrication (§3a). So this phase ships the **inventory**, not a code change — the same shape as Phase 34
(audited, found mobile owes nothing).

The value of this phase is the **separation** and the **proof**, not a deletion.

Enforcement mechanisms that make (a) empty, all verified this pass:
- `src/data/mock.ts` is `export {}` — imported by nothing (grep: 0 importers).
- `src/data/api.ts` `state` (line 262) — the local record buffer — starts **every** collection empty
  (`[]` / `null`); "NOT sample data" is its own doc comment. Nothing seeds it.
- **Every** `unavailable(endpoint, X)` call passes an **empty** `X`: `state.*` (empty), `[]`, `undefined`,
  or an `EMPTY_*` shell (`EMPTY_TICKET_PAGE` / `EMPTY_NOTES` / `EMPTY_KB` — all `data:[]`, zeroed counts).
  Verified all 30 call sites.
- A failed read resolves empty **and reports to `src/data/health.ts`**, so every list screen branches its
  empty state on `useDataHealth().degraded` — "could not load" (outage) vs. "genuinely empty" is never
  collapsed into a fabricated zero.

## 2. Notifications first (the stated priority) — clean

The whole notification/feed surface is 100% network-driven and refuses to invent state:
- `src/app/notifications.tsx` — feed from `getNotifications()`; mark-all is **verified, not assumed**
  (rolls back and shows a Banner if the server still reports unread); empty forks on health.
- `src/app/notify.tsx` — team dispatch; audience resolved server-side; reports the real created count.
- `src/app/notice-board.tsx` — read-only bulletin from `getCompanyNotices()`; **deliberately shows no
  unread badges** because the backend returns no per-user read state ("painting an unread dot from state we
  do not have would be an invented figure" — its own comment).
- `src/data/adapt.ts` `adaptNotification` — maps real raw fields only (`title`/`body`/`at`/`read`/`type`).
- `src/data/api.ts` `getNotifications` → `unavailable('/notifications', state.notifications)` where
  `state.notifications` is `[]`; `markAllNotificationsRead` returns whether the **server** accepted the write.

**Consequence for Phase 37:** its "remove any hardcoded notification data found in Phase 36" sub-task has
**nothing to remove** — there is none. Phase 37 is purely the mark-as-read + bell-dot-clear feature (and the
`[api]` persist-endpoint check).

## 3. The three buckets (app-wide inventory)

### (a) Real fabrication to remove — NONE

Confirmed by: 2 read-only sweep agents (app screens; data/lib/store), plus direct reads and whole-`src`
greps for `₹`/large-number literals, module-scope domain arrays (`^const X = [`), `useState([{…}])` seeded
state (0 hits), `Math.random` (only React-key fallbacks + a biometric nonce), and self-labeled
`dummy|fake|sample|hardcoded` (every hit is a comment documenting a **removed** fabrication or a hardcoded
**colour/coordinate**, never data).

Historical fabrications already removed in prior phases (evidence the rule bites — do **not** re-flag):
- `generateReport`'s ₹42,00,000 invented summary → returns `null` (Phase 8).
- `lic-plans.tsx` "benefit estimator" that multiplied sum-assured by a made-up factor and printed an
  indicative premium/maturity → **removed, not restyled** (`lic-plans.tsx:30-37`); `adaptLicPlan` leaves
  entry-age/term empty rather than mining one worked example.
- The Add-Lead sheet's invented `'warm'` priority → gone; `addLead` no longer sends a probability picked to
  make a badge read a certain way (`api.ts:744-747`, `leads.tsx:691`).
- The hardcoded Surat geofence pin (2 km, `enforce:true`) → `null` when unknown (Phase 7, `api.ts:1655`).
- `getActivity`'s hardcoded fallback / the old "invented client counts so no screen is empty" path
  (`api.ts:375,627`) → empty + health report.

### (b) Legitimate synthesis to keep (derived from real fetched data)

These are correct and must **not** be flagged as fabrication — each derives from real wire fields:
- **`src/data/adapt.ts`** — the documented synthesis hub: `adaptClient` computes `segment[]` from real
  policy dates; `adaptClaim` synthesises a claim `timeline` from `status_history` (and one "Claim registered"
  row from the real `created_at` when history is absent) and `ageDays` from `created_at`; `adaptLead`
  synthesises `notes[]` from the free-text `notes` string and derives `priority` from real `probability`;
  `adaptLicPlan` maps the legacy LIC shape. Each refuses to invent (lead stage never resolves **up** to
  `policy_issued`; LIC entry-age/term left empty).
- **`prospects.tsx` / `home.tsx`** — `pick(doc, CANDIDATE_KEYS)` resolves a schema-less collection; the
  `*_KEYS` arrays are the candidate-key lists, not data.
- **Write-buffer optimistic records** — `addTask`/`addLead`/`addClaim` build a `local` record from the
  **user's own typed input** with a local id/timestamp, held **only** on a genuine outage (never a
  server-refused 400 — `api.ts:749-753`). The user's own data seconds after they typed it, not invented.
- **Computed KPIs / deltas / counts** — home KPI strip, `screens/dashboards.tsx` totals, `analytics.tsx`
  session-over-session deltas + sparklines (withheld entirely if any reading is null; captioned as session
  readings), pipeline/claims/tasks/clients aggregates, `families.tsx` household sums, `payroll.tsx` roster
  total (sum of **server** `payable`, never a rate×days), `commissions`/`earnings` (every ₹ is the server's;
  `absent = workingDays − present` is day subtraction). All gated so a zero never means "not loaded".
- **Relative-time labels** — `timeAgo`/`dayLabel`/`eventToken`/`inDays` over real record timestamps.
- **One minor synthesis to note:** adapters substitute `new Date().toISOString()` for a **missing** wire
  timestamp (`adapt.ts:264-265`, `api.ts:284,289,306`) so a row that must render a date has one. It fills a
  presentation gap from "now", not a domain figure — acceptable, and the only place a non-wire value backs a
  rendered field.

### (c) Static UI / domain config (fine — noted, not enumerated)

Label/tone/icon maps (`data/labels.ts` — `STAGE_META`/`CLAIM_STATUS`/`SEG_META`/`REMINDER_ICON`), category &
tab metadata, segmented-control option lists, month/weekday arrays, empty-state copy, input placeholders and
**editable** form defaults (e.g. the new-claim `insurer` pre-fills editable "LIC of India"), the i18n
dictionaries (translated copy, not data), theme palettes/scales, and the fail-open RBAC config
`DEFAULT_UI` / `SCHEMA_FEATURE_DEFAULTS` in `store/appUi.tsx` (the app's own default **layout** when the
config endpoint is unreachable — not fabricated user data). `segments.tsx` `FALLBACK_FLAGS` is control
vocabulary only (filter chips before the first response / during an outage), replaced by the server's
`flagDefs`; no row/name/amount/date is ever sourced from it. Hardcoded colours/coordinates
(`tracker.ts` brand azure, `LeafletMap` centre pin) are UI, not data.

## 4. Method

- Direct reads: `notifications.tsx`, `notify.tsx`, `notice-board.tsx`, `labels.ts`, `adapt.ts`, the
  notification + `unavailable()` surface of `api.ts`, `lic-plans.tsx`, `segments.tsx`.
- Two read-only Explore sweeps: one over `src/app/**` (per-screen render classification), one over the data
  layer (the second died mid-run on an API error; its territory — every `unavailable()` arg + `state` +
  create paths + `DEFAULT_UI` — was re-covered directly).
- Whole-`src` greps: `₹`/large numbers, `^const X = [`, `useState([{`, `Math.random`, and self-labeled
  fabrication terms. All corroborate (a) = empty.

## 5. Gates

- **No `src/` change**, so no gate re-run. Baseline stands: `tsc` 0, `npm test` 417/417, lint 0 errors / 12
  warnings.

## 6. Done-when

- [x] Notifications/feeds swept first and separated — clean, 100% DB-driven (§2).
- [x] App-wide sweep complete; every non-network value classified into (a)/(b)/(c).
- [x] Bucket (a) real fabrication to remove: **NONE** — the no-mock-data rule is already enforced; historical
      fabrications were removed in prior phases (§3a).
- [x] Bucket (b) legitimate synthesis catalogued to keep (§3b) — do not re-flag.
- [x] Bucket (c) static config catalogued (§3c).
- [x] Phase 37 note recorded: no hardcoded notification data exists to remove (§2).
