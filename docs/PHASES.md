# Phases — CGPE Connect (Android)

Session: **`cgpe-mobile`**. Siblings: `cgpe-api` (`../cgpe-backend-main`), `cgpe-admin`
(`../cgpe-front-main-RECOVERED`). Shared contract: `../contracts/`.

Ordering rule used here: **things the app currently lies to the user about come first**, then the
gate that stops them coming back, then contract repairs, then the features that were specified but
never wired.

Each phase touches ≤8 files and produces one demoable thing.
`[api]` = needs a matching change in `cgpe-api`, filed via `../contracts/INBOX.md`.

---

## Now

**Phase 30 — density rollout: migrate the list tabs (`tasks`/`leads`/`claims`). BUILT 2026-08-12.** The
top editor-buildable lever after Phase 29 (PHASE-29 §6): the mechanism was done and one proof screen
(`clients.tsx`) migrated, so this rolls the same D-2 pattern onto the three other core list tabs — no
mechanism change, no contract change, no new copy. Per screen: strip the static `{ font, radius, spacing }`
import, destructure **exactly** the scale each component uses off `c` (`const { spacing, font } = c`),
style bodies untouched; `tsc` proves completeness (a missed ref becomes a compile error once the static
import is gone). `claims.tsx` and `tasks.tsx` had no module-scope scale use; `leads.tsx`'s module-scope
`SEP_INSET` const became a `sepInset(scale)` helper (identical to `clients.tsx`'s) so row separators stay
aligned when the gutter tightens, and its `AddLeadSheet`/`SkeletonRow` (which had no `useTheme()` call at
all) now read the scale off the theme. A department with `theme.density:"compact"` now renders these three
tabs tighter (spacing ×0.85 / radius ×0.90 / font ×1.0, applied by `applyDensity`) on the next cold start;
unmigrated screens stay comfortable (static exports unchanged) — non-regressive. Gates green: `tsc` 0,
`npm test` **417/417** (unchanged — presentational migration, no new pure logic; the density numbers are
already pinned by `density.test.ts`), lint 0 errors / 12 warnings (baseline). Commit `d70da17` (local —
push still 403s). **Device check carried** (a seeded `theme.density:"compact"` dept config showing tighter
Tasks/Leads/Claims, light/dark at 390 px; other screens stay comfortable) — not editor-buildable (no
seeded compact doc yet). Next density targets: the shared `ui/data.tsx`/`ui/identity.tsx` list primitives
(lift many screens at once), then `home.tsx` (62 refs, danger zone) on its own. Full path:
`docs/spec/PHASE-30.md`; DECISIONS 2026-08-12 (top).

**Phase 29 — consume server-driven `theme.density` (mechanism + first screen). BUILT 2026-08-12.** The
Phase-28 D-4 deferral, unblocked. `spacing`/`radius`/`font` were static module consts imported by ~81
files (941 refs), so density needed a runtime-scale refactor; this phase builds that mechanism and
migrates ONE proof screen, with the rest migrating incrementally later (owner-locked approach — not a
big-bang). Two undefined-upstream things owner-locked via AskUserQuestion before code: the `compact`
numbers (`density` is enum-only in `../contracts/` + `ui_rbac_config.json:158` + `ADMIN_PANEL_SYNC.md`)
and the blast radius. **compact = spacing ×0.85, radius ×0.90, font ×1.0** (gentle, spacing-led — type
sizes kept for legibility/≥44pt targets; D-3). Mechanism mirrors Phase 28's `deriveBrandPalette`: new pure
`applyDensity(base, density)` in **`src/theme/density.ts`** — fail-open **by reference** for
comfortable/absent (D-4), compact tightens `spacing`/`radius` (`Math.round`, `pill` preserved), font +
every colour pass through. The layout scale now lives **on the `Palette`** (new `Spacing`/`Radius`/`Font`
types) so `useTheme()` carries it (D-2); the static `spacing`/`radius`/`font` exports stay = comfortable, so
the ~80 unmigrated importers are **non-regressive**. The **`BrandTheme`** bridge in `_layout.tsx` applies
density **after** accent (`applyDensity(deriveBrandPalette(base, accent), density)`). Proof screen
`(tabs)/clients.tsx` migrated by destructuring the scale off `c` (tiny per-screen diff for the rollout); its
module-scope `SEP_INSET` became a `sepInset(spacing)` helper so separators stay aligned when the gutter
tightens (the 44pt avatar doesn't scale). compact spacing `4→3·8→7·12→10·16→14·20→17·24→20·32→27`, radius
`10→9·14→13·18→16·24→22·30→27·pill 999`. The numbers are a mobile decision, **not** a contract (D-5) — no
contract change. Gates green: `tsc` 0, `npm test` **417/417** (+10, `src/theme/__tests__/density.test.ts`),
lint 0 errors / 12 warnings (baseline). Commit local (push still 403s). **Device check carried** (a seeded
`theme.density:"compact"` dept config showing a tighter Clients list, light/dark at 390 px; other screens
stay comfortable until migrated) — not editor-buildable (no seeded compact doc yet). Full path:
`docs/spec/PHASE-29.md`; DECISIONS 2026-08-12 (top).

**Phase 28 — consume server-driven `theme` (accent + badge). BUILT 2026-08-12.** The owner-picked
Phase-26 lever (c). `normalizeTheme` had parsed `theme` into `{accent,badge_label,density}` since before
Phase 26 but **nothing read it**; this makes two of the three facets live. Owner-locked scope: consume
**accent** + **badge_label** now, **defer density** (D-4 — `spacing`/`radius`/`font` are static consts in
~81 files, so density needs a runtime-scale refactor, a separate phase); accent reaches **`primary` +
`gradientBrand`** (D-2); badge renders in the **Home greeting header** (D-3). New pure
`deriveBrandPalette(base, accent)` in **`src/theme/brand.ts`** — deterministic transform that overrides the
brand primary family + signature gradient from the accent and returns the base palette **by reference** when
there is no valid accent (fail-open, D-5). A new **`BrandTheme`** bridge in `_layout.tsx` sits **inside**
`AppUiProvider` (so it can read `config.theme.accent`) and re-provides the accented palette via a new
`PaletteProvider` — so the top-level tree is NOT reordered, keeping the base `ThemeProvider` above
`Confirm`/`Toast` (D-1). Semantic colours + the teal `accent` token are deliberately untouched (accent =
brand identity, not a status recolour). The Home badge uses the brand `primary` family, so a set accent
tints it to match; renders only when `badge_label` is present. Accent intent is the panel's own
(`ADMIN_PANEL_SYNC.md` §3.6.9: "swap `M.primary`"). Gates green: `tsc` 0, `npm test` **407/407** (+9,
`src/theme/__tests__/brand.test.ts`), lint 0 errors / 12 warnings (baseline). Commit local (push still 403s).
**No contract change** (theme is response-only/optional, consumed as documented). **Device check carried**
(a seeded `theme.accent`+`badge_label` dept config, light/dark at 390 px; accent-less role stays azure) —
not editor-buildable (no themed doc seeded yet). Full path: `docs/spec/PHASE-28.md`; DECISIONS 2026-08-12 (top).

**Phase 27 — per-business-department app layouts (`resolveRoleKey` widening). FILED to `cgpe-api`, no
mobile build — 2026-08-12.** The owner picked, of the three carried Phase-26 options, "spec the
`resolveRoleKey` change." Verified in code: `resolveRoleKey` (`routes/rbac.js:396`) compares the RAW
lowercased department and only special-cases `sales`/`operations`, so 7 of the 9 canonical departments
(`enums.md` §2.1) — including the 3 SALES sub-departments (`SALES-CGPE_Tree`/`RENEWALS & LIC`/`MUTUAL
FUNDS & WEALTH`, which lowercase to `sales-cgpe_tree` ≠ `sales`) — resolve by role and can never point at
a department doc, however much the panel/seed writes. **This is a pure BACKEND change: mobile has no
resolver** (`grep resolveRoleKey ANDROID/src` = 0) and `normalizeUiConfig` renders any `role_key`
fail-open, so the app already shows a new department's layout with **zero `src/` change** the moment the
backend emits the key and a doc exists. Wrote `docs/spec/PHASE-27.md` and filed a `→ cgpe-api` ask in
`contracts/INBOX.md` (grep-verified durable, 2 hits) — the follow-up the Phase-26 seed heads-up
pre-promised, now that the owner has confirmed. **Recommended** (mechanism is cgpe-api's call): derive
keys via the already-exported `canonicalizeDepartment()` (`utils/rbac.js:130`) → a `DEPT_KEY` map
(`HEALTH INSURANCE→health_insurance`, `TATA AIA→tata_aia`, … ; `sales`/`operations` unchanged for
back-compat), and use a **non-regressive candidate-key chain** (`[deptKey, roleKey, 'advisor']`,
first-with-a-doc wins) so a department peels off onto its own layout only when seeded — no big-bang, no
blank dashboards. Mobile requires only four mechanism-agnostic guarantees (back-compat / non-regression /
lowercase keys / collision-free — no `dept:` namespace needed). **Nothing built here, no gate re-run**
(there is nothing mobile-side to build — D-1). Necessary-but-not-sufficient: per-department layouts are
live only when the resolver change (cgpe-api), seeded docs (Phase-26 seed script widened + owner-run),
and a device check all exist. Two items flagged not decided: the seed must gain the new keys, and whether
the new Sales-family keys should inherit `MANDATORY_BY_ROLE`'s Sales widgets (a backend product call).
Full path: `docs/spec/PHASE-27.md`; DECISIONS 2026-08-12 (top).

**Phase 26 — More-tab grouping is now DB-driven (`nav.more_sections` consumed). BUILT 2026-08-12.** The
owner-chosen slice of the "make per-department layout DB-editable" question, and the close of the last
server-driven-nav gap (Phase 10 D-3; `ui_rbac_config.json:320-324` named mobile the fix owner). The field
was normalised/served since before Phase 10 but **no screen read it** — now `src/app/(tabs)/more.tsx`'s
content-module groups render from `config.nav.more_sections`, so a department's `app_role_preferences` doc
controls the More tab's **groups, titles and order** (change the doc → regroups next cold start, no APK).
New pure selector **`arrangeMoreSections(sections, known, isHidden, leftoverTitle?)`** in
`src/store/appUi.tsx` mirrors Phase 10's `resolveTabs`: filters each config group to catalogue modules that
are known + not in `nav.hidden` + not already placed (first-wins dedupe), drops empty groups, and — per the
contract's **hard product rule** (`ui_rbac_config.json:18`: only `nav.hidden` hides) — appends ONE trailing
"More" catch-all of every known, non-hidden module the config left unplaced, so **omission re-prioritises,
never hides**. Fail-open on `undefined`/empty sections. `more.tsx` renders three regions: a **FIXED**
role-gated **admin oversight** group (D-2 — admin/master docs carry no `more_sections`, and these
safety-sensitive tools + `nav.hidden` filtering stay exactly as before; Payroll still gates on the REAL
`admin`/`super_admin` role), the **config-driven** content groups (new `MORE_CATALOGUE` maps each key →
icon/label/href; `profile`→user name and `tickets`→live open-count are the two dynamic values), and a
**FIXED** "Personal" tail (Viewing-as, My earnings — D-3, not server nav modules). `DEFAULT_UI.nav.more_sections`
was rewritten (D-4) to a canonical grouping naming every one of the 22 catalogue modules once, because it is
now the RENDERED layout for a config outage and for every role whose doc omits `more_sections`
(admin/master/unseeded) — so the catch-all is empty for the default and nothing is orphaned. `collapsed_by_default`
still not consumed (D-5, separate collapsible-UI build; the pinned drop stands). Gates green: `tsc` 0,
`npm test` **398/398** (+11 `arrangeMoreSections` cases in `appUi.test.ts`), lint 0 errors / 12 warnings
(baseline). Commit local (push still 403s). One visible layout shift (My earnings/Payroll/Viewing-as → a
"Personal" tail vs the old "Account" group) + the general regrouping need a **device check** (light/dark at
390 px, ≥2 real dept configs) — not editor-buildable. `MORE_CATALOGUE` (more.tsx) and
`DEFAULT_UI.nav.more_sections` (appUi.tsx) must be kept in step (documented at both sites). Full path:
`docs/spec/PHASE-26.md`; DECISIONS 2026-08-12 (top).

**Phase 25 — commissions EARNED aggregate. BUILT 2026-08-12.** The Phase-6 D-5 unblock. `cgpe-api` shipped
`GET /api/commissions/my-summary` (Backend Phase 31) — the self-scoped earned aggregate mobile filed — and
this phase consumes it. New `getCommissionSummary()` in `src/data/api.ts` uses low-level `req()` with a
two-outcome posture like `getMdrtTier`: `ok` (a 200 object; **200-zeros included raises no banner** — the
screen's blank check renders the calm "none yet" state) / `error` (503 → banner; 401/403/404 suppressed as
answers; dead network / abort / shape-miss → banner). Maps `{thisMonth,lastMonth,pending,ytd,history[],
recent[]}` defensively (finite-coerced ₹, malformed history dropped, missing `recent` strings → `''`) and
sets **`target:0`** — the endpoint carries no target and none is invented (the screen shows "no monthly
target set"). Every ₹ is the server's; **the app never multiplies** (pinned by test). `commissions.tsx`'s
`load()` swaps `getCommission()` → `getCommissionSummary()`; all existing render defenses + the
`blank`/`degraded` empty-state fork are unchanged, so the three honest states fall out (figures · calm "none
yet" · retryable "did not load"). MDRT tier (Phase 23) stays a **separate** element on
`/advisor/performance/:id`, untouched. Dead `getCommission()` + mis-shaped `EMPTY_COMMISSION` shell removed
(single caller, gone — Phase-14 hygiene). Gates green: `tsc` 0, `npm test` **387/387** (+14,
`api-commissions.test.ts`), lint 0 errors / 12 warnings (baseline). Commit local (push still 403s). **INBOX
Phase-31 box ticked.** **Phase 6 D-5 is now closed.** Device check (a real advisor with booked policies vs
production, light/dark at 390 px) outstanding. Full path: `docs/spec/PHASE-25.md`; DECISIONS 2026-08-12 (top).

**Commissions blocker CLEARED mid-handoff — 2026-08-12. Build queued as Phase 25 (no code yet).** During
this session's handoff, a concurrent write landed `GET /api/commissions/my-summary` (Backend Phase 31) at the
TOP of `contracts/INBOX.md` — the exact self-scoped EARNED aggregate mobile filed
(`thisMonth/lastMonth/pending/ytd/history[{month,amount}]/recent[{id,client,plan,amount,date}]`, `protect`-only
+ token-forced self-scope, 200-zeros empty / 503 error; `tier` omitted by design — read from
`/advisor/performance/:advisorId`, which Phase 23 already does). Verified the shape matches our filing and
replied under the item, **left unticked** (build owed). Per `/handoff` no code was written. **Next session's
first action is Phase 25**: `getCommissionSummary()` + wire `commissions.tsx`'s ledger + `api-commissions.test.ts`,
then tick the box. The board is **no longer editor-exhausted**. See HANDOFF "Next session starts here".

**Phase 24 — per-client coverage score on Smart segments. BUILT 2026-08-12.** The one fresh
editor-buildable lever after the board went editor-exhausted: `cgpe-api` backend Phase 30 (P2-CL-01)
landed a **response-only** per-row `coverage_score` on `GET /api/clients/segments` — an endpoint mobile
already calls (`getClientSegments`, `api.ts:2480`). Additive, contract already carries it (`api.md`
§`/segments` + `models.md` §`Client`), no backend dependency, no INBOX ask (the notice was `→ cgpe-admin`;
mobile owed nothing). One guarded `asNum(o.coverage_score)` read added to `toRowView` in `segments.tsx`,
rendered as `· NN%` on the row's cover readout and as a labelled **Coverage** `DataRow` in the detail
sheet (`success` ≥100 / `warning` <100 — the server's own documented invariant, same tones as the
existing underinsured/well_insured Pills). **`null` (no cover on file) draws no coverage line — never a
fabricated `0%`; a floored real `0` (tiny cover) shows `0%`** (the file's own `asNum` doctrine keeps the
two distinct). No rupee benchmark asserted on the row (mobile doesn't read `thresholds.coverage`). No
on-device math. Gates green: `tsc` 0, `npm test` **373/373** (unchanged — guarded mapper passthrough +
presentational JSX, the untested class of Phases 8/11/17), lint 0 errors / 12 warnings (baseline). Commit
local (push still 403s). Device check (production data on a handset, light/dark at 390 px) outstanding.
Full path: `docs/spec/PHASE-24.md`; DECISIONS 2026-08-12 (top).

**INBOX sync (no phase) — 2026-08-12 (6th of the day). Answered cgpe-admin's RECRUITER_MASTER CC.** Boot
found the board editor-exhausted and one fresh open item CC'ing this session: cgpe-admin filed a discovery
question to `cgpe-api` (blocking their Phase 45) — how does the API expose `ca-data` rows with
`masterListType: "RECRUITER_MASTER"`? — CC'ing mobile on the premise "it currently shows up only in
cgpe-mobile's `ANDROID/src/app/prospects.tsx`" and that we "already render RECRUITER_MASTER and may know the
endpoint." **Verified that premise is WRONG** and replied so the sibling stops treating mobile as ground
truth: a fresh case-insensitive grep for `masterListType`/`RECRUITER_MASTER` over `ANDROID/src` = **0 hits**
(not in `prospects.tsx`, nowhere). Our prospects screen calls `GET /api/prospects` (`getProspects`,
`api.ts:2432`) + `GET /api/prospects/segments` (`api.ts:2445`) and **no `/api/ca-data/*` route** (that's
cgpe-admin's `CaData.tsx`); it renders schema-agnostically via `pick(doc, candidateKeys)`, which only *looks*
like it handles those rows. The endpoint/param/envelope answer is `cgpe-api`'s to give — **not blocking
mobile**. Box left **unticked** (`→ cgpe-api`, mobile only CC'd); reply grepped back durable (INBOX lines
50–52). **No `src/` change, no gate re-run** (373 green, Phase-23 baseline). DECISIONS 2026-08-12 (top); HANDOFF.

**Phase 23 — MDRT tier-progress element on Commissions. BUILT 2026-08-12.** The buildable slice of the
Phase-6-blocked commissions screen (HANDOFF option d). Commissions itself stays backend-blocked on the earned
aggregate (`GET /api/commissions/my-summary`, filed to `cgpe-api`, unscoped) — this ships the ONE real datum the
screen can already show: the caller's own **MDRT/COT/TOT tier progress**, as a **separate** element (never the
monthly meter). New `getMdrtTier(advisorId)` reads the already-verified backend Phase-29 endpoint
`GET /api/advisor/performance/:advisorId` (`data.performance.{total_premium, mdrt_tier:{current,next,next_premium,
to_next}}`) — **no contract change, no new INBOX ask**. New `MdrtTierProgress` card on `commissions.tsx`: FYC-premium
headline, "current tier reached" pill, and a `total_premium / next_premium` `<Meter>` to the next tier (TOT shows
"the highest tier", no meter). **Mounted ABOVE the ledger's loading/blank fork** because `getCommission` still
resolves the empty shell (screen is always `blank`), so the tier shows real data while the ledger is blank — the
point of the slice. **Role-gated to `advisor`/`learn_advisor` reading own id** (backend 403s an advisor for any
other id, team-scopes a leader on self, gives admin/payroll a meaningless ₹0); a 403 is an answer (suppressed, no
banner). `req()` three-state posture copied from Phase 16's `getMyEarnings`; silent on error (the global
`<HealthBanner/>` speaks once); every ₹ is the server's; tier names verbatim. Gates green: `tsc` 0, `npm test`
**373/373** (+13, `api-mdrt.test.ts`), lint 0 errors / 12 warnings (baseline). Commit local (push still 403s).
**Commissions earned aggregate stays blocked** (the `/commissions/my-summary` filing stands). Device check (a real
advisor with sales, light/dark at 390 px) outstanding. Full path: `docs/spec/PHASE-23.md`; DECISIONS 2026-08-12 (top).

**INBOX sync (no phase) — 2026-08-12 (5th of the day). Phase 6 commissions re-evaluated against backend Phase 29.**
A boot found ONE fresh open item addressed here (`→ cgpe-admin, cgpe-mobile · 2026-08-12 · from cgpe-api`, backend
Phase 29): the MDRT/COT/TOT tier ladder is now server-authoritative (`utils/mdrtTiers.js`), and `cgpe-api` pointed
mobile at `performance.mdrt_tier.next_premium`/`to_next` on `GET /api/advisor/*` as the "next-tier target behind
your commissions **target** ask", offering to scope a dedicated `/commissions/*` self-target endpoint if we file the
shape. **Verified the claim in their real code** (`classifyMdrtTier()` → `{current,next,next_premium,to_next}`,
thresholds ₹3.75L…₹90L; `GET /api/advisor/performance/:advisorId` `protect`-only, self-safe — advisor→own-only 403
at `advisor.js:28`, leader→team; returns `performance.total_premium` + `mdrt_tier`). **But it does NOT unblock
`commissions.tsx`:** (1) the screen's real blocker is the **earned aggregate** (`thisMonth/lastMonth/pending/ytd/
history/recent` per the `Commission` type) — `/api/commissions` returns raw owner rows, Phase 29 ships no aggregate;
(2) `next_premium` is an **annual cumulative-premium** tier goal, a different unit than the screen's `thisMonth /
target` **monthly-commission** meter (`commissions.tsx:209`), so it must NOT be fed into that meter. **Owner
directed: file the aggregate to `cgpe-api`.** Filed a fresh top-of-queue `→ cgpe-api · 2026-08-12 · from cgpe-mobile`
item — a self-scoped `GET /api/commissions/my-summary` (`protect`-only, token-forced self-scope, same posture as
`/payroll/my-earnings`): the earned aggregate the `Commission` type needs **plus an optional `tier` block** from
`classifyMdrtTier` that mobile would render as a **separate** MDRT-tier-progress element, never the monthly meter.
Also replied under the Phase-29 box (left **unticked** — multi-recipient); both writes grepped back durable. **No
`src/` change, no gate re-run.** **Commissions stays backend-blocked** (Phase-6 D-5 narrowed, not closed) until
`cgpe-api` scopes the aggregate. DECISIONS 2026-08-12 (top); HANDOFF.

**INBOX sync (no phase) — 2026-08-12 (4th of the day).** Board editor-exhausted (Phase 16 built/device-only,
Phase 6 backend-blocked, Phase 22 copy-paused). A boot found **two** open `cgpe-mobile` items from `cgpe-api`
and answered both, **no `src/` change**. **(1) Attendance → `daylogs` (backend Phase-20-tail FIX):** the four
reads `/attendance/{current,user/:id,history,stats}` now source the live `daylogs` store, same wire shape;
`cgpe-api` warned "a 2-session day yields 2 rows for that date — check if any screen assumed one row per day"
and asked "flag if you want `/user/:id` scoped". Verified against our code that **neither surface assumes
one-row-per-date**: `attendance.tsx` (`getAttendanceHistory`) renders each record as its own date-spine row,
grouped by month, keyed by index — a 2-session day shows 2 rows, each with its own in/out; `getAgentLocations`
(`/attendance/user/:id`) is array-aware (today-pass takes `rows[rows.length-1]` = latest session, fallback
sorts by date and takes the most recent). Recorded one nuance (the "Days logged"/"Closed days" KPIs count
sessions not distinct dates, but that's byte-identical to the old per-session collection — unchanged by the
fix, not a regression) and answered the scoping ask: **leave `/user/:id` unscoped** (a per-caller owner scope
would empty our agent-map/on-duty fan-out; if scoped later, gate on role not self-only). **(2) `/api/exams`
deletion (backend Phase 22):** grep `exams|Exam|EnglishQuestion` over `ANDROID/src` = 0 hits — inert.
Both boxes answered underneath, left **unticked** (multi-recipient), grepped back (one edit re-anchored after
a concurrent write shifted the item +16 lines). No gate re-run. `cgpe-api` should read the attendance reply.
DECISIONS 2026-08-12 (top); HANDOFF.

**Phase 16 — "My earnings" self-view. BUILT 2026-08-12.** The blocker cleared: `cgpe-api` shipped
`GET /api/payroll/my-earnings` (backend Phase 28) — a **`protect`-only, self-scoped** read that forces
`user_id` to the token, so every user this phase targets (advisor/learn_advisor/leader/payroll_staff)
reads **their own** pay and nobody else's. Built the self-view against it. New route `src/app/earnings.tsx`:
headline `payable` (server-computed, rendered via `inr()`), KPI strip (Present · Payable days · Absent ·
Worked hours), payable-days `<Meter>`, pay-basis card, 12-month strip, and a "so far this month"
provisional pill on the current month. Reached from an **ungated** row in `more.tsx`'s Account group
(self-scoped — every member, unlike the admin-only Payroll roster) and a link card on `attendance.tsx`.
`getMyEarnings` uses low-level `req()` (not `tryReal`, which collapses `data:null`) so the **three states
stay distinct**: `ok` / `empty` (200 `data:null` → "no pay profile", no banner) / `error` (5xx/network →
banner + Retry). **The app never multiplies** — every ₹ figure is the server's; the only on-device math is
`absent = working_days − present_days` (days, not money). **Scoped to the v1 aggregate** the endpoint
returns, not the richer per-day body the UI lock proposed (owner chose ship-now over re-block): no per-day
spine, "Overtime h" KPI → "Worked hours", `EmptyState` in place of the Phase-14-deleted `characters.tsx` —
`docs/spec/PHASE-16.md` D-1/D-2/D-3. Gates green: `tsc` 0, `npm test` **360/360** (+10, `api-earnings.test.ts`),
lint 0 errors/12 warnings (baseline). Commit `c77e1ad` (local — push still 403s). **Device check carried**
(reconcile ≥3 real people vs the payroll sheet; light/dark at 390 px; Phase-1 clock-in is the stated hard
prerequisite). DECISIONS 2026-08-12 (top); HANDOFF.

**INBOX sync (no phase) — 2026-08-12 (3rd of the day).** Board editor-exhausted (Phase 22 paused on owner
copy, Phase 16 backend-blocked). The one upstream change dated today — `cgpe-api` Phase 27's PII-free
`GET /api/campaigns/audience/count` — was verified a **no-op for mobile**: `getCampaignAudience`
(`api.ts:2013`) feeds `campaigns.tsx`/`premium.tsx`/`jobs.tsx`, all of which render the audience **sample**
on purpose (the campaign preview), and mobile has no count-only surface that would ship PII for a number, so
the item was correctly `→ cgpe-admin` only. At the owner's direction, **re-filed the standing Phase-16
self-earnings ask as a fresh, self-contained top-of-queue nudge** (2026-08-12 `→ cgpe-api`) so it stops being
buried at the foot of a 260 KB file — one narrowed ask (a self-scoped read of the `payable`
`computeRangeSalary()` already produces), unticked, grepped back (survived). **No `src/` change, no gate
re-run.** DECISIONS 2026-08-12 (top).

**INBOX sync (no phase) — 2026-08-12 (2nd of the day).** A boot found the board editor-exhausted and one
`→ cgpe-admin, cgpe-mobile` item open and addressed here: `cgpe-api` backend Phase 11 closed the
`GET/PUT /api/rbac/app-ui` `data` envelope (dropped `_id`/`updated_at`/`updated_by`) and asked mobile to confirm
it reads none of the three. **Verified inert:** `getAppUiConfig` (`api.ts:2516`) hands its response straight to
`normalizeUiConfig` (`appUi.tsx:213`), which rebuilds a fresh object from only `role_key`/`label`/`dashboard`/
`nav`/`features`/`theme`; the `AppUiConfig` type declares no audit field; tree-wide `updated_at`/`updated_by`
grep hits only unrelated domains. Answered underneath in `INBOX.md` (box unticked — multi-recipient) and
grepped the reply back. **No `src/` change, no gate re-run.** Then handed the owner the bounded `common.*`
fill-list (SCOPE §4.1 net-new set) and **paused i18n at their direction** — no translator available now, so
Phase 22's bulk (`tryAgain` ×34 etc.) stays blocked on human copy. Fixed one stale SCOPE §4.1 line
(`common.today` was still listed as to-add; it shipped). DECISIONS 2026-08-12 (top).

**Phase 21 P1 (i18n) — `common.*` dedup, the copy-free slice. BUILT 2026-08-12.** Owner-directed "full
copy-free dedup". Routed the **already-translated** repeated labels to existing `common.*` keys across
**16 screens** — `Call`→`common.call`, `Cancel`→`common.cancel`, `Delete`→`common.delete`,
`WhatsApp`→`common.whatsapp` (a trade noun, so English in all 5 langs → **centralization only, no visible
change**, kept for button-row consistency). `Call`/`Cancel`/`Delete` now render in Gujarati/Hindi where they
were hardcoded English. Added **one** net-new key, **`common.today`**, by **lifting** the existing
`tab.home`/`tasks.today` human copy (identical `આજે`/`आज`/`Aaj`/`Aaje`) — **dedup of approved copy, NOT machine
translation** — so parity moved **74→75** (bumped deliberately in `dictionaries.test.ts`); wired the standalone
`Today` eyebrows (`home` ×2, `attendance`) and the `reminders` "Today"/"Overdue"/"Upcoming" section titles
(the last two reuse existing `tasks.overdue`/`tasks.upcoming` — translating only "Today" of the three would look
half-done). **Deliberately NOT wired** (needs copy or would be half-done): every other net-new `common.*` key —
`tryAgain` (×34, the biggest single win), `clearSearch`, `refresh`, the ~8-variant **outage body**, the a11y
`Call {name}`/`Open WhatsApp chat` labels — all need human gu/hi/hi-en/gu-en copy (PHASE-19 §4 forbids machine
translation); the four module-level date helpers (`calendar.dayTitle`, `reminders.timeFor`,
`notifications.dayLabel`, `whatsapp/[id].dayLabel`) which mix `Today`/`Yesterday`/weekdays in one function;
the `task-new` "Today" picker option; and `more.tsx`'s nav-tile "WhatsApp". Naming: `tickets/index.tsx`
(`t = typeMeta`) and `notes.tsx` (`setTotal((t)=>…)`) bind the translator to `tr` to avoid shadowing; every
other screen uses `t = useT()`. Gates green: `tsc` 0, `npm test` **350/350** (unchanged — no new pure logic,
parity assertion moved 74→75), `lint` 0 errors/12 warnings (baseline). Push still 403s (commit local). **The
copy-free `common.*` work is now exhausted** — further P1 and any Tier-1 wiring wait on **owner-supplied copy**
(fill-list = the net-new `common.*` set in `docs/i18n/SCOPE.md` §4.1). Full path: `docs/i18n/SCOPE.md` §3/§4.1/§8;
DECISIONS 2026-08-12 (top); HANDOFF.

**Phase 21 (i18n P0) — `t()` extended to `t(key, params?)`. BUILT 2026-08-11 (`a7a0979`).** The one
copy-free, backend-free step off the scoped i18n worklist (`docs/i18n/SCOPE.md` §3 P0). `t` gained (1)
named `{placeholder}` interpolation — an unmatched token is left **verbatim** (`{name}`), a visible bug
not a silent blank — and (2) count-aware plurals: `params.count` (a number) selects `key_one`/`key_other`
by the **CLDR cardinal rule for the active language** (English marks only 1 as `one`; Hindi & Gujarati and
their romanized pair mark **both 0 and 1** as `one`), falling back to the base key when no variant exists.
**No string concatenation** — Hindi/Gujarati word order differs, so a dynamic string is one template.
Single-arg `t(key)` is **byte-identical** to before (language → English → key). **No dictionary key added**,
so the hard `EN_KEYS.length === 74` parity gate is untouched and still green. Three pure exported seams
(`pluralCategory`, `interpolate`, `translate(…, lookup?)` with an injected lookup) let every branch be
pinned against a controlled dictionary without a real key — `src/i18n/__tests__/format.test.ts`, 20 cases.
Gates: `tsc` 0, `npm test` **350/350** (+20), `lint` 0 errors/12 warnings (baseline). Push still 403s
(commit local). The mechanism is now in place; wiring dynamic strings still waits on human copy. Next
copy-free step is P1 (the `common.*` dedup layer). Full path: `docs/i18n/SCOPE.md`; DECISIONS 2026-08-11 (top).

**i18n `t()` widening — SCOPED, not built — 2026-08-11.** Board was editor-exhausted (Phase 16 self-view
re-verified still backend-blocked: `routes/payroll.js:22-23` still `authorize('admin')`, no `my-earnings`,
INBOX ask unanswered). At the user's direction, scoped the PHASES "Next 3" #3 item instead: six parallel
read-only extraction passes over ~45 screens →  `docs/i18n/SCOPE.md` + `inventory/01–06*.md` (the full
string list, screen · line · kind · English · proposed key). **Findings:** only **74 keys** wired via
`t()` in 6 files (all partial); **~40 screens are 100% hardcoded English**; **~1,800 occurrences** →
~1,200–1,400 unique keys. **Three prerequisites before any copy helps:** (1) `t()` has NO interpolation —
~30% of strings are dynamic, need a `t(key,params)`+plural extension (no concatenation; Hindi/Gujarati
word order); (2) a `common.*` dedup layer ("Try again" ×~30); (3) the parity test hard-codes
`EN_KEYS.length===74` and its leak check rejects only `value===key`, **not** `value===English`, so a
Gujarati entry left as English passes green — human copy is load-bearing. **Nothing built, no dictionary
edited, no string translated, gates not re-run.** Committed local-only (push 403s). The next
editor-buildable step (no backend, no translator) is the P0 `t()` extension + `common.*` layer. Full
path: `docs/i18n/SCOPE.md`; DECISIONS 2026-08-11 (top); HANDOFF.

**Phase 20 — Admin payroll roster (in-app). BUILT 2026-08-11.** Owner-directed scope change from
Phase 16. Re-verified against `cgpe-api`'s **real code** (not tags — wrong 5×) that the Phase 16
self-view is *still* blocked: the whole payroll router is admin-only (`routes/payroll.js:22-23` =
`authorize('admin')`; `middleware/auth.js:73` 403s any non-admin), and a whole-tree grep finds only
the 8 admin routes — the self-scoped read mobile needs was never built. So at the owner's explicit
direction, built a **different** screen against the endpoint that *does* exist: a mobile slice of the
payroll roster the `cgpe-admin` panel owns, admin/super_admin only. New route `src/app/payroll.tsx`
consumes `GET /api/payroll/compute?year=&month=` (a 12-month strip, current first); shows total
payable + per-member name/segment/present-days/**server-computed** payable. **No PII on the phone** —
`/compute` omits Aadhaar/PAN/bank (`routes/payroll.js:306`); those live only on `/profiles`+`/export`.
**The app never multiplies** — every `payable` is the server's; the one sum (roster total) is an
aggregate of computed figures, pinned by a test. **Gated on the REAL role, not the tier** — mobile's
`tierOf` folds `leader` into "admin" but the backend 403s a leader, so the More row and the screen both
gate on `user.role === 'admin'|'super_admin'`; a leader never reaches the fetch, and a stale-role
deep-link degrades honestly (403 → `tryReal` null → "admin-only"/"could not load", never a false ₹0).
4 files (`api.ts` +`getPayrollRoster`/types, `payroll.tsx`, `more.tsx` +1 gated row, new
`api-payroll.test.ts`). Gates green: `tsc` 0, `npm test` **330/330** (+7), `lint` 0 errors/12 warnings
(baseline). Push still 403s (commit local). The **Phase 16 self-view stays blocked** and its UI lock is
untouched; the narrowed self-read ask stays filed. Full path: `docs/spec/PHASE-20.md`; DECISIONS
2026-08-11 (top); HANDOFF. Device check (renders on a real handset, light/dark) carried.

**Phase 16 re-evaluation (no build) — 2026-08-11.** A boot found the backend's **Phase 25 payroll
cluster** had landed (25a profiles / 25b compute / 25c export) — the endpoints Phase 16 ("My earnings")
was blocked on. Re-verified against `cgpe-api`'s **real code** (not the payroll INBOX notices, which are
addressed to `cgpe-admin`, and mobile tags have been wrong 5×): the pay field
(`payroll_profiles.salary_amount`) and the server-side formula (`services/payrollEngine.js`
`computeRangeSalary` → a `payable` **number**) now **exist**, so the two things Phase 16 asked to be built
are done. **But** `routes/payroll.js:22-23` gates the whole router `authorize('admin')`
(`middleware/auth.js:73` 403s any non-admin/super_admin), and `grep -i earnings` over the backend = **0** —
there is no self-service read, and `?user_id=` is admin-only member selection, not a self-scope. So a
signed-in advisor still cannot see their **own** pay; what landed is the *manager-views-salary* surface
Phase 16 declared OUT OF SCOPE (it is `cgpe-admin`'s to consume). **Outcome:** Phase 16 stays blocked, but
the ask **narrowed** from "build a pay field + a formula" to one self-scoped read
(`GET /api/payroll/my-earnings`, own records only, reusing the existing engine) — re-filed to `cgpe-api`
in `../contracts/INBOX.md` (grepped back after writing, per the concurrent-write rule). No `src/` change,
no gate re-run. Updated `docs/spec/PHASE-16.md` §"UPDATE 2026-08-11", this board, and the handoff. The
locked UI was deliberately **not** built against a non-existent endpoint (untested dead code; Phase 1
clock-in is a hard prerequisite anyway). Push still 403s.

**Phase 19 — language toggle verified + hardened. BUILT 2026-08-11.** Verify + harden the *existing*
5-language toggle (English, ગુજરાતી, हिन्दी, **Hinglish**, **Roman Gujarati/Gujlish**), not build a new
one. Shipped in two units. **(1) The durable core:** a dictionary-parity Vitest
(`src/i18n/__tests__/dictionaries.test.ts`, 18 cases) asserts all 5 dictionaries expose the exact same
**74-key** set with **no blank / missing / key-identical** value — the value checks
`Dict = Record<TKey, string>` cannot make at compile time. It **passes as-is**: the shipped dictionaries
are already at full parity, so **no dictionary was edited and nothing was machine-translated** (spec §4:
a gap is a finding to report, never a guess to fill). Needed one app line — `export const DICT` (was
private) — so the test can read the dictionaries; screens still use `t()`. `npm test` **305 → 323**.
**(2) The visual half rides Phase 18:** `e2e/tests/50-languages.spec.ts` (one test per language) drives
the **real** Settings toggle into each language, asserts it applies **live** and **survives a reload**
(DONE-3, web slice), then walks all 42 screens and screenshots each into `languages/<code>/` for a human
naturalness (DONE-4) + layout (DONE-5) review, asserting **no raw key leaks** (DONE-2). Result:
**42/42 render in all 5 languages, 0 key leaks.** `assertRenders` gained opt-in `{ settleSplash }`
(default off — other specs unchanged) that waits out the animated Splash so the stills + leak scan see
the real screen, not the logo (the Phase-18-flagged "pixel-clean screenshots" thread). **Coverage
reality:** only the **74 `t()`-wired keys** change with the toggle — much of the app (Settings body,
most chrome) is **hardcoded English** and stays English in every language; widening `t()` is separate,
larger work, out of this "verify + harden" scope. Gates green: `tsc` 0, `npm test` **323/323**, `lint`
0 errors/12 warnings. Push still 403s (commits `433250c`, `2c599c5` local). Full path:
`docs/spec/PHASE-19.md`; DECISIONS 2026-08-11 (top); HANDOFF.

**Phase 18 — watchable A-to-Z + worst-case E2E harness. BUILT 2026-08-11.** The spec's named
risk (§2) is retired: **the Expo web build boots and renders `/(auth)/login` with no web guard** —
`tracker.ts` / `biometricIdentity.ts` / `AppLock` already gate their native modules behind
`isNative`/`!isWeb`. Built a Playwright harness in `ANDROID/e2e/` (outside `src/`, invisible to all
gates) that drives the Expo **web** build in a real browser the user can watch, with video + trace +
per-screen screenshots. **33 tests green:** the web boots (`00-smoke`); the backbone works
(`01-signin` — mocked login + CORS, real form submit, deep-link session restore); an **A-to-Z walk
renders all 42 web-reachable screens** (`10-walk-normal`, 0 page errors); **21 worst-case cases** inject
500/503/malformed/empty-200/timeout/oversized on representative data screens and assert the screen
still renders **and** the `<HealthBanner/>` obeys the data-health contract (`30-worstcase`); and a
**bad-input matrix** covers login (empty/whitespace/refused/network/hostile/double-submit) + hostile
input on search/task-new/claim-new (`40-forms`). Every response is synthetic Playwright mocking —
**zero production data**. One command: `npm run e2e` (headed; `HEADLESS=1` for CI). Artifacts land in
`e2e/artifacts/` with an `OPEN-ME.md` index + `WHAT-WEB-CANNOT-REACH.md` (the native-only backlog web
can't verify: haptics, background GPS, biometric lock, native map, cold-start persistence). Gates
green: `tsc` exit 0, `npm test` 305/305, `npm run lint` 0 errors/12 warnings. Two app-side edits only,
both gate-isolation: `tsconfig.json` excludes `e2e`, `eslint.config.js` ignores `e2e/**`. Known
cosmetic quirk documented: ~12 More-menu/detail screens show a count=1 outage banner under the healthy
mock from the home-dashboard prefetch underlay on cold deep-links — not a render failure. Push still
403s (commit local). Full path: `docs/spec/PHASE-18.md`; DECISIONS 2026-08-11 (top); memory
`e2e-harness-phase18`.

**Session close — two new phases planned, no build — 2026-08-11.** At the user's direction, this
session re-verified the two remaining blockers against `cgpe-api`'s **real code** (not the tags —
wrong before on Phases 6/9/10/11/12) and confirmed both still real: `routes/commissions.js` has no
product aggregate and no `target` (Phase 6), and no backend model/route carries any
`salary|wage|per_day|ctc|pay_rate` field — only the role `payroll_staff` / department `payroll`
(Phase 16). **Reason nothing shipped: waiting for the backend to create the endpoints.** Instead,
laid the path for two new phases and queued them **ahead of** salary, per the user's order: **Phase
18** — a *watchable*, A-to-Z, worst-case end-to-end test pass (Playwright driving the Expo **web**
build in headed Chromium, video+trace, deterministic edge-case injection; `docs/spec/PHASE-18.md`);
and **Phase 19** — verify + harden the *existing* 5-language toggle incl. **Hinglish** (Hindi-in-
Latin) / **Gujlish** (Gujarati-in-Latin), core being a dictionary-parity Vitest that needs no device
(`docs/spec/PHASE-19.md`). Filed one consolidated `→ cgpe-api` INBOX ask for the two blocking
endpoints (commissions product aggregate + a computed salary/earnings endpoint), grep-verified
present. No `src/` change, no gate re-run. See `docs/HANDOFF.md` + DECISIONS 2026-08-11 (top).

**INBOX sync (no phase) — 2026-08-11 (2nd of the day).** A boot found the board still
**editor-exhausted** and the two newest `→ cgpe-admin, cgpe-mobile` FYIs from `cgpe-api` unanswered by
this session — Backend **Phase 18** (`/api/leaves` is now a real 8-route feature, was a stub;
`GET /api/attendance/calendar` + `/day/:date` gained `is_leave`/`leave_type` + `status:'leave'`) and
Backend **Phase 17** (weekly-report scheduler wired to stored `report_schedule`; `weekday` pinned
`0`=Sun…`6`=Sat; `last_sent` now written). Both verified against our own code as genuine no-ops
(`grep` for `/api/leaves` → only prose + local `leaveTimer`/`LEAVE_AFTER_*` identifiers, no helper;
`is_leave`/`leave_type`/`attendance/calendar`/`attendance/day` → 0 hits, and `attendance.tsx`'s `Entry`
shape has no `status` field so `status:'leave'` is inert; `report-schedule`/`report_schedule`/
`last_sent`/`/reports`/`weekly` → 0 hits) and answered underneath in `INBOX.md` (boxes left unticked —
multi-recipient). **No `src/` change, no gate re-run.** Recorded that Phase 18's real leave data will
matter to Phase 16 ("My earnings") as a *payable-days* input **if/when** Phase 16 unblocks — but Phase
16 stays blocked on a pay field + formula, which Phase 18 does not supply (leaves ≠ salary). DECISIONS
2026-08-11 (top). See `docs/HANDOFF.md`.

**INBOX sync (no phase) — 2026-08-11 (1st).** An earlier boot found the board editor-exhausted and
three `→ cgpe-admin, cgpe-mobile` FYIs — Backend **Phase 9** (attendance watchdog), **Phase 10**
(`ux_session_id` unique index on `location_tracks.session_id`), **Phase 15** (dead-code sweep). All
three verified against our own code as genuine no-ops and answered underneath in `INBOX.md` (boxes
left unticked — multi-recipient). **No `src/` change, no gate re-run.** DECISIONS 2026-08-11.

**Phase 9 — reminders persist; `[api]` tag was wrong. Done.** Built 2026-08-11. The board marked
Phase 9 "Blocked on cgpe-api", but `POST /reminders/:id/acknowledge` has existed all along
(`routes/reminders.js:419`) — same stale-tag pattern as Phases 6/10/11/12. `toggleReminder` now POSTs
that endpoint and returns the server's verdict; `adaptReminder`'s done-regex gained `acknowledg` so the
persisted state reads back as done; and since the backend has no un-acknowledge, the reopen control was
removed (completion is one-way) and `reminders.tsx` gained `tasks.tsx`-style optimistic rollback (revert
+ warning `Banner` on a refused write, `haptics.success` only on a confirmed one). `toggleTaskStep` was
already removed in Phase 1; **`toggleClaimDoc` was deliberately left as-is** — the claim checklist
already discloses it does not persist (`claim/[id].tsx:416`) and its tick is load-bearing for the upload
flow, so making it read-only (the original plan) would delete honest working code (D-3, a flagged
deviation). `npx tsc --noEmit` exit 0; `npm test` **305 / 14** (+6); `npm run lint` 0 errors / 12
warnings. Push still 403s — commit local. Cold-start persistence needs a handset (carried). Spec:
`docs/spec/PHASE-9.md`; DECISIONS 2026-08-11 (top).

**INBOX backend-Phase-14 grep (notifications/notices 5xx) — verified conformant, no app change.**
2026-08-11. `cgpe-api` changed `GET /api/notifications`, `/notifications/unread-count`,
`/notices/unread` to answer **503/500** on a DB fault instead of `200 { data:[] }`, and asked both
clients to confirm they branch on `success`/HTTP status rather than reading the empty-200 as "empty".
Verified clean: the app calls **only `/notifications`** of the three (the other two have zero callers;
unread is derived client-side), `getNotifications` already keys on HTTP `ok` so a 5xx falls through to
`unavailable('/notifications')` → global `<HealthBanner/>`, and `notifications.tsx:286-300` already
branches its empty state on `useDataHealth().degraded`. `getCompanyNotices` reads a *different*
endpoint (`/notices?limit=60`, not `/notices/unread`) through the reporting `tryEnvelope`, and
`markNoticeRead`'s new 404-on-stale-id is silently absorbed by its fire-and-forget caller. The app
inherits the backend honesty fix for free. Recorded as a reply under the INBOX item (box left unticked
— multi-recipient with `cgpe-admin`). No source changed; gates not re-run. DECISIONS 2026-08-11 (top).

**Dashboards partial-outage tile (Phase-3 carry-out) — done.** Built 2026-08-11. The last
editor-buildable item on the board: `src/screens/dashboards.tsx`'s Master (`:292-297`) and Admin
(`:211-213`) KPI grids rendered each org figure as `snapshot?.field ?? 0`, so a partial outage
(roster loads, org endpoints down → `getOrgSnapshot` returns `null`) showed "0 clients · ₹0 claims
paid" as fact. Each fabricating tile now mirrors the hero at `:266` — `snapshot ? <value> :
NO_VALUE` — so an absent snapshot reads "-", never a conjured zero; a healthy backend is unchanged
(a genuine org `0` still shows). Gated on **`snapshot`-presence, not the global `degraded` flag**:
that is what the hero and home's analytics widget (`home.tsx:1682`) already key on, and `degraded`
is app-wide/sticky (`health.ts` L8), so gating tile values on it would blank a loaded tile whenever
any unrelated endpoint failed and make a tile disagree with the hero on the same number. Master's
"Open tasks" tile keeps its **real** loaded-`tasks` fallback (not a fabricated zero) and is
unchanged. 8 tile expressions, one file, no type widened / no shell invented / hero untouched. No
test (presentational JSX, no RN renderer in-harness — same class as Phases 8/11/17). `npx tsc
--noEmit` exit 0; `npm test` **299/13** (unchanged); `npm run lint` 0 errors / 12 warnings. Closes
the `docs/spec/PHASE-3.md` §2 carry-out and "Next 3" #3. DECISIONS 2026-08-11.

**Phase 6 (partial) — done.** Built 2026-08-11. The two app-side halves shipped; **commissions stays
backend-blocked** (D-5), so the phase remains partial. `npm test` runs **299** tests across 13 files
and exits 0 (+18: 6 `adaptLicPlan` cases, a new `api-notes.test.ts` (5), a new `api-lic.test.ts` (7));
`npx tsc --noEmit` exits 0; `npm run lint` stays at the Phase-15 baseline (0 errors / 12 warnings).
(1) **Notes search** — `getNotes` sent `search=`, but `/api/notice-board` reads **`q`**
(`noticeBoard.js:93,102`) and ignored `search`, so every notes search returned the whole board
unfiltered; now sends `q`. (2) **LIC plans** — the **`[api]` framing and the "404 in production"
comment were both stale**. `GET /api/lic-plans` is **live** (`app.js:461`) and returns
`{ data:{ meta, plans } }` (`routes/licPlans.js:62-71`); the old `getLicPlans` validated that object
with `isArr`, always missed, and showed empty + a false outage. It now unwraps `data.plans` and maps
the legacy LIC shape through a new `adaptLicPlan` (`product_id→id`, `plan_name→name`,
`plan_table→code`, `category_label→type`, `summary→highlight`, `riders→tags`; entry-age/term stay
empty — the wire carries neither, D-2). The stale comments are corrected and the LIC empty state now
branches on `useDataHealth().degraded` (D-4). **The LIC catalogue rendering against production and
notes-search narrowing both need a handset + live host** — carried, like Phases 1/4/5/7/12/13. Spec:
`docs/spec/PHASE-6.md`.

**Phase 12 — done.** Built 2026-08-11, commit `4507d6e`. `npm test` runs **281** tests across 11 files
and exits 0 (10 new in `api-agents.test.ts`); `npx tsc --noEmit` exits 0; `npm run lint` stays at the
Phase-15 baseline (0 errors / 12 warnings). Its **`[api]` tag was wrong — the fix is fully app-side**
(D-1). A leader's "0 on duty" was caused by `getAgentLocations()` reading the roster through admin-only
`GET /api/profiles` (403s for a leader); it now reads `GET /api/team/task-overview?scope=all`, readable
by any staff and already trusted by `getTeam()`. The `?scope=all` leader-clamp (spec D-2) was **verified
in the producer's code before the diff**: `../cgpe-backend-main/utils/scope.js` `visibilityScope` gates
the `view==='all'` → `mode:'all'` branch on `isSuperAdmin || role==='admin'`, so a leader's `?scope=all`
is ignored and clamped to `{mode:'team', userIds:[self,...team]}`; the param preserves admin/master
org-wide breadth (the bare endpoint would default them to `mode:'own'`) without widening a leader. A
~4-line swap in one function; `getTeam`/`team/index.tsx`/`agent-map.tsx` needed no change — the fix is
upstream of them (D-4). **The leader on-duty count itself needs a handset + live backend to confirm**
(criterion 6) — carried, like Phases 1/4/5/7/10/13. Spec: `docs/spec/PHASE-12.md`.

**Phase 15 — done.** Built 2026-08-11, commit `292610b`. `npm run lint` now **exits 0**, down from
45 errors on a clean tree; `npx tsc --noEmit` exits 0; `npm test` still **271** across 10 files.
All 45 errors were React-Compiler rules (`eslint-plugin-react-hooks` v7, promoted to errors because
`app.json` sets `experiments.reactCompiler:true`). The one `react-hooks/purity` hit — `Date.now()`
in the render body via `useState(Date.now())` in `home.tsx` — was a real minor impurity, fixed at
source with a lazy initialiser (`useState(() => Date.now())`), and that rule stays **on**. The other
three (`immutability` ×9 on Reanimated `sv.value=` writes; `refs` ×11 on the RN Animated
`useRef(new Animated.Value()).current` idiom; `set-state-in-effect` ×24 on the app's effect→loader→
setState data-fetch convention) are disabled with a documented rationale block in `eslint.config.js`
— the disable-with-a-reason escape hatch this phase's DONE-WHEN allows, and the call the handoff
directed. 12 warnings remain (all pre-existing; none new). No source logic changed beyond the
one-line `home.tsx` initialiser.

**Phase 14 — done.** Built 2026-08-11, commit `1a37144`. `npm test` still runs **271** tests across
10 files and exits 0 (no new pure logic to pin — this only removes code); `npx tsc --noEmit` exits 0;
`npm run lint` is now **45 errors / 12 warnings**, *down* from the 46/15 baseline (the deleted files
carried 1 error + 3 warnings), so no new errors. Seven dead files were removed as a closed cluster
(`ui/kit.tsx`, `ui/characters.tsx`, `hooks/use-theme.ts`, `hooks/use-color-scheme.ts` + `.web.ts`,
`constants/theme.ts`, `global.css`), plus the orphaned date helpers in `data/tasks.ts` and the
`teamMembers`/`teamActivityFeed` zero-consumer exports (and their helpers) in `data/team.ts`. Types
and live runtime exports were untouched. `src/ui/vendor/leaflet-1.9.4.ts` was **not** touched — it is
imported by `LeafletMap.tsx` and only looks orphaned because eslint ignores it (handoff warning heeded).

**Phase 13 — done.** Built 2026-08-11. `npm test` runs **271** tests across 10 files and exits 0
(5 new, pinning the vendored payload and that `LeafletMap.tsx` no longer references the CDN);
`npx tsc --noEmit` exits 0; `npm run lint` stays at the 46-error baseline. Leaflet 1.9.4 (JS + CSS)
is vendored into `src/ui/vendor/leaflet-1.9.4.ts` (generated by `scripts/vendor-leaflet.mjs` from
the pinned `leaflet` devDependency) and inlined into the WebView HTML instead of pulled from
`unpkg.com` — so the map library loads with the network blocked. Tile imagery is deliberately **not**
vendored (the world's tiles can't be bundled); its existing "tiles could not load" banner is the
honest offline degrade. **The offline-render acceptance check needs a handset** — see
`docs/spec/PHASE-13.md` §4.6.

**Phase 10 — done.** Built 2026-08-11. `npm test` runs **266** tests across 9 files and exits 0 (8
new, pinning the new `resolveTabs` selector); `npx tsc --noEmit` exits 0; `npm run lint` stays at
the 46-error baseline. `(tabs)/_layout.tsx`'s bottom bar now renders from `config.nav.tabs` /
`nav.hidden` instead of the hard-coded `ORDER` constant, and `more.tsx` drops any row (and quick-
action tile) whose module is in `nav.hidden`. `nav.more_sections` grouping and moving
`prospects`/`tickets` into the tab bar itself are deliberately out of scope — see
`docs/spec/PHASE-10.md`.

**Phase 11 — done.** Built 2026-08-11. `npm test` runs **258** tests across 9 files and exits 0
(no new pure logic to pin — a single predicate swap in an already-untested function);
`npx tsc --noEmit` exits 0; `npm run lint` stays at the 46-error baseline. `tierOf()` grants
Master by `Profile.role === 'super_admin'` — the server's own top rank — instead of matching
`shivam@cgpe.in`. No email address literal remains in `src/`.

**Phase 17 — done.** Built 2026-08-11, commit `140d020`. `npm test` runs **258** tests across 9
files and exits 0 (no new pure logic to pin — the change is entirely in the imperative
`toggleClock` handler); `npx tsc --noEmit` exits 0; `npm run lint` stays at the 46-error baseline.
Clocking out from outside the office fence still succeeds exactly as before and now shows a
warning naming the measured distance; clocking out from inside the fence is unchanged.

**Phase 8 — done.** Built 2026-08-11, commits `e5b57ef` (code + spec + docs) and `4e12688` (the
review fix). `npm test` runs **258** tests across 9 files and exits 0; `npx tsc --noEmit` exits 0;
`npm run lint` is byte-identical to the 46-error baseline. `generateReport` no longer invents a
₹42,00,000 report on failure — it returns `null`, same shape as the other nullable single-object
endpoints — and `HOW_TO_RUN.md`/`TESTING_GUIDE.md`/`config.ts` no longer describe an offline demo
mode or a sample-data fallback that stopped existing phases ago.

**Phase 7 — done.** Built 2026-08-10, commits `3e092ad` (code + spec + tests) and `fc09934` (the
review fixes). `npm test` runs **258** tests across 9 files and exits 0; `npx tsc --noEmit` exits 0;
`npm run lint` is byte-identical to the 46-error baseline. **INBOX D5 and D10 are both closed on
this side.** The app no longer carries its own copy of the office fence, and no longer posts GPS
points it cannot attribute to a shift. **Acceptance criteria 10–11 need a handset** — see the spec.

**Phase 5 — done.** Built 2026-08-10, commit `95f1ccb` plus the review fixes. `npm test` runs
**219** tests across 8 files and exits 0; `npx tsc --noEmit` exits 0; `npm run lint` is
byte-identical to the 46-error baseline. Every WhatsApp message this app had ever "sent" was
refused with a 400 and reported as sent. **Acceptance criteria 9–10 need a device** — see the spec.

**Phase 4 — done.** Built 2026-08-10 across five commits, `5c08872` → `edc373c`. `npm test` runs
**188** tests across 7 files and exits 0; `npx tsc --noEmit` exits 0; `npm run lint` is
byte-identical to the 46-error baseline. The app now speaks `Lead.status`; the two `adapt.test.ts`
pins were flipped on purpose and a new `api-leads.test.ts` pins the request bodies and response
envelopes themselves. An adversarial review of the first commit raised 22 findings, of which **8
survived two independent skeptics each** and were fixed in `06641b1` — including one real bug the
phase itself introduced (a swallowed outage; see DECISIONS).
**Acceptance criteria 7–9 need a device and a live backend** — see the spec.

**Phase 3 — done.** Built 2026-08-10, commit `e0b0b2c`. `npm test` ran **164** tests across 6
files and exited 0. **git is also unblocked** — Phases 1 and 2 had never been committed and are now
in `123db30`.

**Phase 1 — still code-complete, verification still outstanding.** Acceptance criteria 1–6 in
`docs/spec/PHASE-1.md` need a handset in airplane mode. Neither Phase 2 nor Phase 3 covers them:
they are haptics, an AsyncStorage clock key and background GPS, none of which a Node test can
exercise.

## Next 3

**Top editor-buildable lever now → Phase 31, the density rollout continues.** Phase 29 shipped the
`theme.density` mechanism + migrated `(tabs)/clients.tsx`; **Phase 30 (2026-08-12) migrated the three
other list tabs `tasks`/`leads`/`claims`** (commit `d70da17`). ~75 files still render comfortable until
migrated. Each migration is a ≤8-file phase using the PHASE-29 **D-2** pattern: `const { spacing, radius,
font } = c`, strip the static import (`tsc` flags any miss), watch for **module-scope** scale uses (they
can't be destructured — make a helper, as `clients.tsx`/`leads.tsx`'s `sepInset` did). Best next targets:
the shared list primitives in `ui/data.tsx` + `ui/identity.tsx` (those lift density across many screens at
once — highest leverage), then `home.tsx` (62 refs, a danger zone) on its own. No backend, no copy —
buildable today. See `docs/spec/PHASE-30.md` + `docs/spec/PHASE-29.md`.

1. **Phase 27 — per-business-department layouts (`resolveRoleKey` widening). FILED to `cgpe-api`
   2026-08-12; awaiting their reply.** A pure backend change (mobile has no resolver, renders any
   `role_key` fail-open — **nothing mobile-side to build**). Wrote `docs/spec/PHASE-27.md` + filed the
   `→ cgpe-api` ask (grep-verified durable). Recommended a non-regressive candidate-key chain
   (`[deptKey, roleKey, 'advisor']`) + a `canonicalizeDepartment`-derived `DEPT_KEY` map
   (`HEALTH INSURANCE→health_insurance`, …; `sales`/`operations` unchanged). **Next when they reply:**
   verify the shipped shape against their real code, confirm a new dept key renders, then widen the
   Phase-26 seed script to the new keys for the owner to run. See the `## Now` entry + DECISIONS
   2026-08-12 (top). Until `cgpe-api` replies, nothing *on Phase 27* is editor-buildable — but the
   density rollout above (Phase 30) is.

2. **Phase 26 — More-tab grouping DB-driven (`nav.more_sections`). BUILT 2026-08-12 (part b); a device
   check + two other levers remain.** Owner picked, of the three Phase-26 parts, the app-side slice (b):
   consume `nav.more_sections`. **Shipped** — `arrangeMoreSections` selector + `MORE_CATALOGUE` +
   config-driven `more.tsx` groups; `tsc` 0, `npm test` **398/398**, lint baseline. See the `## Now` entry +
   DECISIONS 2026-08-12 (top) + `docs/spec/PHASE-26.md`. **Still open (the other two levers the owner did NOT
   pick this round):** (a) **seed/verify real per-dept `app_role_preferences` docs** — admin-panel +
   live-Mongo work (`cgpe-admin` writes them via `PUT /app-ui/:roleKey`), **not buildable from this repo**;
   many roles likely still run `from_defaults:true`, so the new More-tab DB control has nothing dept-specific
   to render until docs are seeded. (c) **finish consuming `theme`** — **BUILT as Phase 28 (2026-08-12):**
   `theme.accent` (recolours brand `primary` + `gradientBrand`) and `theme.badge_label` (Home header badge)
   are live via a `BrandTheme` bridge inside `AppUiProvider` (no top-level reorder) + pure
   `deriveBrandPalette` in `src/theme/brand.ts`; **`density` deferred** (Phase 29 — static spacing/radius/font
   consts in ~81 files need a runtime-scale refactor). See the `## Now` Phase-28 entry. Plus the
   Phase-26 **device check** (light/dark 390 px, ≥2 real dept configs; the "Personal" tail layout shift).
   The internal layout of each screen stays static in the APK (the DB composes from a fixed catalogue — 20
   widgets, 5 tab routes, 4 hero modes, 14 flags — not a free-form page builder). **Seeding update
   (2026-08-12, owner-directed):** wrote a **backend seed script** `cgpe-backend-main/scripts/seedAppRolePreferences.js`
   that upserts `nav.more_sections` for all 8 resolver keys (writes ONLY the More grouping + label, never
   permissions; dry-run by default). **Not yet run** — needs live-Mongo access this repo lacks, so the owner
   runs it. **⚠️ SECURITY:** that file's line 56 was edited to hardcode a live Atlas credential as an `||`
   fallback (a secret-in-source AND dead code) — **remove + rotate before committing it anywhere**
   (DECISIONS 2026-08-12 top; HANDOFF). **`resolveRoleKey` caveat:** business departments (HEALTH INSURANCE,
   TATA AIA, RECRUITMENT…) resolve by role, not department name, so per-business-department layouts need a
   backend `resolveRoleKey` change (`cgpe-api`) first — not built.

   **Phase 25 — commissions EARNED aggregate. BUILT 2026-08-12; only a device check remains.** `cgpe-api`
   shipped `GET /api/commissions/my-summary` (Backend Phase 31) and `getCommissionSummary()` + the wired
   `commissions.tsx` ledger + `api-commissions.test.ts` shipped against it the same session (commit `039cf63`,
   387/387). Phase 6 D-5 is closed. What's left is **not editor-buildable**: a real advisor with booked policies
   vs production, light/dark at 390 px. (Historic context below — Phase 16 self-view salary BUILT 2026-08-12,
   device check only; the MDRT tier element BUILT as Phase 23.)

   **Phase 16 self-view salary — BUILT 2026-08-12; only a device check remains.** The blocker cleared
   (`cgpe-api` backend Phase 28 shipped `GET /api/payroll/my-earnings`, `protect`-only + self-scoped) and
   `src/app/earnings.tsx` shipped against it the same session (commit `c77e1ad`). What's left is **not
   editor-buildable**: reconcile ≥3 real people's months against the payroll sheet by hand on a handset,
   and the light/dark 390 px render — plus **Phase 1 clock-in** stays the hard prerequisite. If the per-day
   breakdown is wanted, re-file `breakdown[]` + the days split to `cgpe-api` (they offered — PHASE-16.md
   D-1). **Commissions (Phase 6) is the top *net-new* blocked item** and stays backend-blocked. **2026-08-12
   update:** backend Phase 29 made the MDRT tier ladder server-authoritative, so a *target* source now exists
   (`performance.mdrt_tier.next_premium`/`to_next` on `GET /api/advisor/*`, verified in `utils/mdrtTiers.js`).
   But it does **not** unblock `commissions.tsx`: (a) the screen's real blocker is the **earned aggregate**
   (`thisMonth/lastMonth/pending/ytd/history/recent`), which `/api/commissions` (raw rows) and Phase 29 both
   fail to supply; (b) `next_premium` is an **annual cumulative-premium** tier goal, a different unit than the
   `thisMonth / target` **monthly** meter (`commissions.tsx:209`), so it must not be fed into it. Per owner
   direction, filed a self-scoped `GET /api/commissions/my-summary` shape (earned aggregate + optional `tier`
   block) to `cgpe-api`. **2026-08-12 (Phase 23):** the standalone MDRT-tier-progress element against
   `/api/advisor/performance/:advisorId` **is now BUILT** — it renders real tier data on the commissions screen
   for advisor/learn_advisor. The **earned** figures (thisMonth/ytd/pending/history/recent) stay backend-blocked
   until `/commissions/my-summary` is scoped; nothing more app-side on commissions until then.
   Full detail: `docs/spec/PHASE-23.md`, `docs/spec/PHASE-16.md` §"BUILT 2026-08-12", `docs/spec/PHASE-6.md`, DECISIONS 2026-08-12 (top).
3. **Device-verification backlog — handset-only acceptance carried from Phases 1/4/5/6/7/9/10/12/13/16/23/24**
   (haptics, the AsyncStorage clock key, background GPS, the master route replay, airplane-mode
   behaviour, a leader's true "On duty now" count, the offline map render, the LIC catalogue + notes
   search against production, reminder cold-start persistence, the language-key cold-start, the Phase-16
   earnings reconcile, the Phase-23 MDRT tier card, and now the Phase-24 coverage % against real
   production data). Phases 18/19 cover the web-reachable slice; the native-only remainder still needs a
   phone + a live backend. Not editor-buildable.
4. **Widen `t()` coverage — SCOPED (2026-08-11); P0 now BUILT, P1 is the next copy-free step.** Full
   worklist + plan in `docs/i18n/` (`SCOPE.md` + `inventory/01–06*.md`): only 74 keys wired across 6
   files, ~40 screens 100% hardcoded, ~1,800 string occurrences. **P0 done (Phase 21, `a7a0979`):**
   `t(key, params?)` interpolation + count-plural extension now exists and is tested — dynamic strings can
   be wired without concatenation. **P1 copy-free slice done (Phase 21 P1, 2026-08-12):** the
   already-translated repeats (`Call`/`Cancel`/`Delete`/`WhatsApp`) are routed to existing `common.*` keys
   across 16 screens, and `common.today` was added by lifting existing copy (parity **75**). **The copy-free
   `common.*` work is now exhausted** — everything remaining (the net-new `common.*` keys: `tryAgain` ×34,
   `clearSearch`, `refresh`, the outage body, the a11y labels; then any Tier-1 screen, SCOPE.md §5) needs
   **human-supplied** Hinglish/Gujlish/Hindi/Gujarati (~4,800 strings; no machine guess, Phase 19 §4). The
   fill-list is the net-new `common.*` set in SCOPE.md §4.1. **Owner paused this 2026-08-12** (no translator
   available now) — resume the moment copy lands. Trap: adding real keys bumps the parity test's
   hard count (now `=== 75`), and it won't catch an English string left in a non-English dict.

> **Also still open:** the **device-verification backlog** — handset-only acceptance criteria carried
> from Phases 1, 4, 5, 6, 7, 9, 10, 12, 13 (haptics, the AsyncStorage clock key, background GPS, the
> master route replay, airplane-mode behaviour, a leader's true "On duty now" count, the offline map
> render, the LIC catalogue + notes search against production, reminder cold-start persistence).
> Phase 18 covers the **web-reachable** slice of this; the native-only remainder still needs a phone.

> **Also queued, not in the top 3:** **Phase 6**, the remaining envelope mismatches, if `cgpe-api`
> has un-shadowed `GET /api/commissions/team-summary`. Phase 4 proved the method: read the contract
> row, read the handler, then assert the envelope in a test that fails if the shape moves.

> **Carried out of Phase 3 — CLOSED 2026-08-11.** `src/screens/dashboards.tsx`'s Master
> (`:292-297`) and Admin (`:211-213`) KPI tiles rendered `snapshot?.field ?? 0`, so a **partial**
> outage (roster loads, org endpoints down) showed "0 clients · ₹0 claims paid" as fact. Each
> fabricating tile now mirrors the hero at `:266` — `snapshot ? <value> : NO_VALUE` — gated on
> snapshot-presence (not the global `degraded` flag; see DECISIONS 2026-08-11 for why). Master's
> "Open tasks" tile keeps its real loaded-`tasks` fallback. Left out of Phase 3 originally because
> `dashboards.tsx` was not in its file list; now done as a standalone carry-out.

## Status board

| # | Phase | Status |
|---|---|---|
| 1 | Write-path honesty | **Built** — handset verification outstanding |
| 2 | Test runner + pure logic | **Done** 2026-08-10 — 140 tests green |
| 3 | Data-health channel | **Done** 2026-08-10 — 164 tests green (`e0b0b2c`) |
| 4 | Leads contract | **Done** 2026-08-10 — 188 tests green (`5c08872`…`edc373c`); device checks outstanding |
| 5 | WhatsApp send | **Done** 2026-08-10 — 219 tests green (`95f1ccb`); device checks outstanding |
| 6 | Remaining envelope mismatches ~~`[api]`~~ | **Partial — done** 2026-08-11 — notes + LIC shipped app-side, 299 tests green; **commissions still blocked on `cgpe-api`** (no aggregate endpoint). **2026-08-12:** backend Phase 29 made MDRT `next_premium` a server-authoritative *target* source, but it doesn't unblock the screen (earned aggregate still unsourced; `next_premium` is an annual premium goal, not the monthly meter's unit) — filed `GET /commissions/my-summary` self-aggregate shape to `cgpe-api`, no build. **2026-08-12 (handoff): UNBLOCKED — `cgpe-api` SHIPPED `GET /api/commissions/my-summary` (Backend Phase 31), shape matches our filing; build queued as Phase 25 (next session), INBOX box left unticked until built**. **2026-08-12 (Phase 25): BUILT & CLOSED — `getCommissionSummary()` consumes `/my-summary`, `commissions.tsx` renders the earned ledger, `api-commissions.test.ts` pins the envelope, INBOX box ticked. See row 25** |
| 7 | Geofence + tracking (INBOX D5, D10) | **Done** 2026-08-10 — 258 tests green (`3e092ad`, `fc09934`); device checks outstanding |
| 8 | Last fabricated-data path + stale docs | **Done** 2026-08-11 — 258 tests green (`e5b57ef`, `4e12688`) |
| 9 | Reminders/checklists persist ~~`[api]`~~ | **Done** 2026-08-11 — 305 tests green; `[api]` tag was wrong (reminders wired to existing `acknowledge`); device check outstanding |
| 10 | Server-driven navigation (§9 gap) | **Done** 2026-08-11 — 266 tests green |
| 11 | Server-derived tier | **Done** 2026-08-11 — 258 tests green |
| 12 | `/profiles` role gate ~~`[api]`~~ | **Done** 2026-08-11 — 281 tests green (`4507d6e`); verified **app-side** (tag was wrong); device check outstanding |
| 13 | Vendor Leaflet | **Done** 2026-08-11 — 271 tests green; device check outstanding |
| 14 | Dead-code sweep | **Done** 2026-08-11 — 271 tests green (`1a37144`); lint 46→45 |
| 15 | Lint to green | **Done** 2026-08-11 — `npm run lint` exits 0 (was 45 errors); 271 tests green (`292610b`) |
| 16 | "My earnings" salary section ~~`[api]`~~ | **Built** 2026-08-12 — blocker cleared (backend Phase 28: `GET /api/payroll/my-earnings`, `protect`-only, self-scoped). New `src/app/earnings.tsx` self-view; 360 tests green (+10, `api-earnings.test.ts`); no PII, no on-device math, no role gate (self-scoped). Scoped to the v1 aggregate (D-1/D-2/D-3). Commit `c77e1ad`; device check + Phase-1 clock-in prerequisite outstanding |
| 17 | Warn on out-of-bounds clock-out | **Done** 2026-08-11 — 258 tests green (`140d020`) |
| 18 | Watchable A–Z + worst-case E2E test | **Built** 2026-08-11 — Playwright/Expo-web harness, 33 tests green (42 screens render + 21 worst-case + 9 bad-input); web boots with no guard; gates green |
| 19 | Language toggle (5 langs incl. Hinglish/Gujlish) | **Built** 2026-08-11 — parity Vitest (323/323, +18) + per-language E2E walk (42/42 render, 0 key leaks × 5 langs); dictionaries already complete; naturalness review outstanding |
| 20 | Admin payroll roster (in-app) | **Built** 2026-08-11 — owner-directed; `src/app/payroll.tsx` on admin-only `GET /payroll/compute`, 330 tests green (+7); no PII, no on-device math, gated on real role. Phase 16 self-view still blocked; device check outstanding |
| 21 | i18n P0 — `t(key, params?)` interpolation + plurals | **Built** 2026-08-11 (`a7a0979`) — named `{placeholder}` fill + CLDR `key_one`/`key_other` by active language; single-arg `t()` byte-identical; no dict key added (parity 74 untouched); 350 tests green (+20); pure engine only, no screen wired yet |
| 22 | i18n P1 — `common.*` dedup (copy-free slice) | **Built** 2026-08-12 — routed `Call`/`Cancel`/`Delete`/`WhatsApp` → existing `common.*` across 16 screens + added `common.today` (lifted copy, parity 74→75); 350 tests green (unchanged), lint 0/12. Net-new `common.*` keys (`tryAgain` ×34 etc.) still blocked on human copy |
| 23 | MDRT tier-progress element on Commissions | **Built** 2026-08-12 — buildable slice of Phase-6 (option d). New `getMdrtTier` on the verified Phase-29 `GET /advisor/performance/:advisorId`; `MdrtTierProgress` card is a **separate** element (never the monthly meter), mounted above the ledger fork so it shows real data while the earned aggregate stays blocked. Role-gated advisor/learn_advisor, own id; no contract change. 373 tests green (+13); no PII, no on-device math. Device check outstanding |
| 24 | Coverage score on Smart segments | **Built** 2026-08-12 — surfaced the response-only per-row `coverage_score` (backend Phase 30, P2-CL-01) landed additively on `GET /clients/segments`, which mobile already calls. One guarded `asNum` read in `segments.tsx`; shown as `· NN%` on the row + a labelled **Coverage** DataRow in the sheet (tone by the server's `100`⟺well_insured/`<100`⟺underinsured invariant). `null`→no line (never `0%`); real `0`→`0%`. No contract change, no INBOX ask, no on-device math. 373 tests green (unchanged); lint 0/12. Device check outstanding |
| 25 | Commissions EARNED aggregate ~~`[api]`~~ | **Built** 2026-08-12 — Phase-6 D-5 unblock. New `getCommissionSummary()` on the shipped `GET /commissions/my-summary` (backend Phase 31, self-scoped, `protect`-only); two-outcome `req()` posture like `getMdrtTier` (200-zeros = ok/no-banner, 503 = error/banner). `commissions.tsx` renders the earned ledger (thisMonth/lastMonth/pending/ytd/history/recent); `target:0` (no source, never invented); no on-device math. Dead `getCommission`/`EMPTY_COMMISSION` removed. **387 tests green (+14, `api-commissions.test.ts`)**; lint 0/12. **INBOX Phase-31 box ticked. Phase 6 D-5 closed.** Device check outstanding |
| 26 | More-tab grouping DB-driven (`nav.more_sections`) | **Built** 2026-08-12 — closes Phase 10 D-3 (the last server-driven-nav gap; contract named mobile the fix owner). New pure `arrangeMoreSections` selector in `appUi.tsx` (mirrors `resolveTabs`: known+not-hidden+first-wins dedupe, drops empty groups, trailing catch-all so omission re-prioritises never hides — `ui_rbac_config.json:18`). `more.tsx` renders fixed admin oversight + config-driven content groups (new `MORE_CATALOGUE`, `profile`/`tickets` dynamic values) + fixed "Personal" tail. `DEFAULT_UI.nav.more_sections` rewritten to name all 22 catalogue modules once. **398 tests green (+11, `arrangeMoreSections` in `appUi.test.ts`)**; tsc 0; lint 0/12. Owner-chosen slice (b); seeding (a) + theme (c) not built. Device check + "Personal" tail layout shift outstanding |

---

## Phase 1 — Write-path honesty ✅ BUILT 2026-08-10 (handset verification outstanding)
Make the five write functions that always report success return the real server verdict.
**Files:** `src/data/api.ts`, `src/app/(tabs)/home.tsx`, `src/app/task/[id].tsx`,
`src/app/account.tsx`, `src/store/auth.tsx`
**Done when:** with the device in airplane mode, clock-in shows "Attendance could not be recorded",
fires no success haptic, writes no local clock record, and starts no tracking session; marking a task
done shows "Status was not saved" and does not navigate away; account deletion surfaces the server's
refusal instead of signing the user out.
Full spec: `docs/spec/PHASE-1.md`.

## Phase 2 — A test runner, and the pure logic pinned ✅ DONE 2026-08-10
Add Vitest and cover the logic that is business-critical and has zero coverage today.
**Files:** `package.json`, `tsconfig.json`, `vitest.config.mts`, `test/stubs/{react-native,
async-storage, expo-local-authentication, expo-secure-store}.ts`,
`src/data/__tests__/{adapt,api-geo,api-renewals,tasks}.test.ts`,
`src/store/__tests__/appUi.test.ts`
**Done when:** `npm test` runs green in CI-less local, covering `adapt.ts` mappers, `distanceMeters`
+ `checkGeofence`, `scanRenewals` date rollover, `taskProgress`, and `normalizeUiConfig`.
**Result:** 140 tests, 5 files, ~0.4 s, no network, no `vi.mock`. Four alias stubs exist only so
native modules resolve — no stubbed byte sits between a test and a function under test.
Full spec, the two deviations from the file list above, and the mutation check that proves the
suite is not vacuous: `docs/spec/PHASE-2.md`.

> **Tests pin TODAY'S behaviour, bugs included.** ~20 cases sit in `describe` blocks named
> *"pinned known bugs — these must be updated deliberately when fixed"*. When Phase 4 fixes
> `mapLeadStage` or Phase 7 changes the geofence, those tests **going red is the intended
> signal** — read the case comment, then update the expectation on purpose.

## Phase 3 — Repair the data-health honesty channel ✅ DONE 2026-08-10 (`e0b0b2c`)
`tryReal` reports failures; `reportSuccess` clears per-endpoint instead of wiping the list;
`getTeamActivity` stops fabricating an outage.
**Files:** `src/data/api.ts`, `src/data/health.ts`, `src/ui/health-banner.tsx`,
`src/app/team/index.tsx`, `src/data/__tests__/{api-renewals,health}.test.ts`
**Done when:** killing the backend and opening the Master dashboard raises the banner (today it
renders a plausible all-zero org silently), and opening Team against a healthy backend raises none.

**Result.** 24 new tests. Three things turned out to be true that the phase text did not say:

1. **A `tryReal`-only fix could not have closed it.** `getClientStats` returned a truthy all-zeros
   object on every path, which made `getOrgSnapshot`'s outage gate at `api.ts:275` *unreachable
   dead code* — so the all-zero org was not a rendering choice, it was a dead branch. Fixing it
   required the bare-`req()` paths too (`getClientsPage`, `getClientStats`, `scanRenewals`).
2. **Not every failure is an outage.** 401/403/404/501 are answers, not faults. Reporting 403 would
   have pinned a permanent banner on every advisor, because `GET /profiles` is admin-only — i.e.
   the naive fix fails this phase's own second acceptance criterion.
3. **`clone(undefined)` threw**, so `unavailable()` *rejected* for all six single-record lookups.
   Those "could not load" empty states had never rendered either. Found by a new test.

Full spec, the ten locked decisions, and what was deliberately left out: `docs/spec/PHASE-3.md`.

> **`api-renewals.test.ts:187` was flipped deliberately.** It asserted `degraded === false` after a
> failed `scanRenewals` page and was written in Phase 2 to go red exactly here. Same convention as
> the `adapt.test.ts` pins that Phase 4 will flip.

## Phase 4 — Leads contract ✅ DONE 2026-08-10 (`5c08872`)
Unwrap the `{ lead }` envelope on `GET`/`POST`, send `status` with the server's own enum, and teach
`mapLeadStage` the real vocabulary.
**Files:** `src/data/api.ts`, `src/data/adapt.ts`, `src/app/lead/[id].tsx`,
`src/app/(tabs)/leads.tsx` — **plus five the compiler forced**: `types.ts`, `labels.ts`,
`(tabs)/home.tsx`, `search.tsx`, `__tests__/adapt.test.ts`, and a new `__tests__/api-leads.test.ts`.
**Done when:** tapping a lead opens its detail screen with data; a stage change persists across a
cold start; a `policy_issued` lead renders as won, not New; a newly created lead shows its real name.

**Result.** 21 new tests. Four things turned out to be true that the phase text did not say:

1. **The app had invented a vocabulary, not just a mapping.** Three of `LeadStage`'s six values
   existed in no backend vocabulary that can be written, so "teach `mapLeadStage` the real
   vocabulary" could not be done without replacing the union — the funnel is now four steps.
2. **No stage change had ever persisted.** `{ stage }` is not a schema path; Mongoose strict mode
   dropped it and the server answered 200 with the record unchanged. The read-back then failed, so
   the app has been correctly reporting "not saved" for a write it was making impossible.
3. **The write's own reply is the better confirmation.** `PUT` returns the post-update document,
   and unlike `GET /:id` it has no ownership check — so the old two-call confirm reported "not
   saved" for a genuinely saved change on any *unowned* lead, which the list deliberately shows.
4. **`getLeads` could pin the outage banner open for a whole session.** Every `/api/leads` route is
   behind `requireModule('sales')`; the 403 was never classified. Same defect Phase 3 fixed for
   `/profiles`, still live on the busiest lead read.

Full spec, the eleven locked decisions and what was deliberately left out: `docs/spec/PHASE-4.md`.

> **The two `adapt.test.ts` pins were flipped deliberately** and moved out of the pinned-bugs block,
> because they now assert correct behaviour. Same convention as `api-renewals.test.ts:187` in
> Phase 3. The block still holds the `mapClaimStatus` pins, which are the same class of defect in
> the claims mapper and are still open.

## Phase 5 — WhatsApp send ✅ DONE 2026-08-10 (`95f1ccb`)
Send `text` (not `message`), resolve the phone from `waThreadCache` (not the empty `state.waThreads`),
and let a failure reach the UI.
**Files:** `src/data/api.ts`, `src/app/whatsapp/[id].tsx` — **not** `src/data/adapt.ts`, which the
phase text listed and which turned out to need nothing; plus a new `__tests__/api-whatsapp.test.ts`.
**Done when:** a sent message reaches the gateway; a rejected send returns the text to the composer
instead of painting a sent tick.

**Result.** 31 new tests. Three things turned out to be true that the phase text did not say:

1. **A 200 from this endpoint is not a send.** The handler writes its `wa_comm_messages` log row
   *before* it calls the gateway (`routes/whatsapp.js:834-857`) and answers `200 success:true`
   either way. The only honest signal is the **top-level `delivery` object** — which sits beside
   `data`, so `tryReal` (`json?.data ?? json`) destroys it. That one fact decided the shape of the
   fix: bare `req()`, as `addLead` does, and a four-outcome union.
2. **Both 400s were already firing, and the phone one fired first.** `phone` came from
   `state.waThreads`, which is empty for the life of the process, so the send was refused at
   `:821` before the missing `text` was ever reached. Fixing the field name alone would have
   changed nothing a user could see.
3. **The error branch had never executed.** `tryReal(..., () => true)` cannot fail, and the `null`
   was discarded, so the composer's rollback-and-banner path — words back in the box, error haptic
   — was unreachable code. Same defect class as Phase 1's write paths.

Full spec, the fourteen locked decisions and what was deliberately left out: `docs/spec/PHASE-5.md`.

> **The phone is recovered from the `custom:<last10>` thread id when the cache is cold**, which is
> the backend's own convention (`:829`, and `GET /hub/messages` parses a bare `threadRef` the same
> way). It is deliberately strict — `<prefix>:<10 digits>` or a bare ten digits, nothing else.
> The lenient reading turns a Mongo `_id` hex into a plausible Indian mobile and sends a
> customer's message to a stranger. There is a test named after exactly that.

## Phase 6 — Remaining envelope mismatches ~~`[api]`~~ ✅ PARTIAL — DONE 2026-08-11 (notes + LIC)
Commissions (array vs aggregate), LIC plans (`{meta, plans}` vs array), notes search (`search` vs `q`).
**Files (shipped):** `src/data/api.ts`, `src/data/adapt.ts` (new `adaptLicPlan`), `src/app/lic-plans.tsx`,
plus new `__tests__/{api-lic,api-notes}.test.ts` and `adaptLicPlan` cases in `adapt.test.ts` — **not**
`src/app/notes.tsx` (the fix is one wire key in `getNotes`, upstream of the screen).
**Done when:** all three screens show real data against production.

**Result — two of three shipped, app-side.** The `[api]` tag was stale for both shipped halves.

1. **Notes search** — the app sent `search=`; `/api/notice-board` reads **`q`**
   (`noticeBoard.js:93,102-105`) and ignored `search`, so no notes search ever filtered. One wire key.
2. **LIC plans** — the endpoint is **live**, not 404. It is mounted at `app.js:461` and returns
   `{ success:true, data:{ meta, plans } }` (`routes/licPlans.js:62-71`), each plan in the legacy LIC
   shape from `unifiedToLic`. The old `getLicPlans` validated the unwrapped `{meta,plans}` object with
   `isArr`, always missed, and rendered empty + a false outage. Now it unwraps `data.plans` and maps
   each row through `adaptLicPlan` (spec D-2). The "404 in production" comments (two in `api.ts`, the
   `lic-plans.tsx` header + empty-state copy) were **stale and are corrected**; the LIC empty state now
   branches on `useDataHealth().degraded` (D-4) and the detail's rider pills are relabelled from
   "Sold for" to "Riders" (D-3). Entry-age and term are left empty — the wire carries neither as a
   plan-level fact, so mining one would fabricate a figure.
3. **Commissions — still `cgpe-api`-blocked (D-5).** `GET /api/commissions` returns owner-scoped **raw
   rows**, not the aggregate the screen wants, and `target` has no source in the rows. The
   `/commissions/team-summary` shadow was un-shadowed by backend Phase 13, but the *product* aggregate
   the screen needs is still pending (product-owner confirmed). Deriving money on-device is rejected
   (Phase 16 precedent). `commissions.tsx` is untouched.

**LIC rendering against production and notes search narrowing both need a handset + live host** — carried.
Full spec, the five locked decisions and what was left out: `docs/spec/PHASE-6.md`.

## Phase 7 — Geofence and tracking correctness ✅ DONE 2026-08-10 (`3e092ad`, `fc09934`)
Adopt `contracts/INBOX.md` **D5** (`session_id`, not `sessionId`) and **D10** (effective fence is up
to 300 m, not a flat 200 m). Make the geofence fallback fail **open**, not closed.
**Files:** `src/lib/tracker.ts`, `src/data/api.ts`, `src/app/(tabs)/home.tsx` — plus the rewritten
`__tests__/api-geo.test.ts` and a new `__tests__/api-track.test.ts`.
**Done when:** a buffer replayed after clock-out uploads successfully; with `/geofence` unreachable,
clock-in is allowed rather than blocked by hardcoded Surat coordinates; no UI copy says "200 m".

**Result.** 39 new tests. Four things turned out to be true that the phase text did not say:

1. **The phase text's own justification was wrong, and the real one is better.** "An unreachable
   `/geofence` locks a whole branch office out" cannot happen: there is exactly **one** global
   fence (`org_settings._id:'office_geofence'`), and `clock-in` re-validates against it on every
   request, so a branch office beyond it is refused by the *server* whether or not the app fails
   open. Failing open moves the refusal one round trip later. The defensible rule — and the one
   every decision in the spec follows from — is that **the client pre-check may never refuse what
   the server would allow**, because `home.tsx` returns before the write and the server never
   hears about it.
2. **The offline fence was not "fail closed", it was wrong in both directions.** The app's
   fallback was 2000 m against a server default of **200 m**: ten times wider at the office pin
   and absolutely closed anywhere else. Two more cases had the client *stricter* than the server —
   a numeric-string accuracy, and a negative one, which made the fence tighter instead of being
   clamped. Both were people refused a clock-in the server would have accepted.
3. **D5 was right about the backend and spent on this app — but the hole survived by another
   route.** We already send `session_id`. `JSON.stringify` omits a key whose value is `undefined`,
   so a shift with no session id produced exactly the body D5 warns about. And the 400 is the
   mild half: `resolveActiveSession` resolves the owner from the **token**, so on a shared handset
   a session-less batch lands on whoever is signed in now.
4. **The review found a regression the phase itself introduced.** Classifying any 4xx as `refused`
   deleted a whole afternoon's buffered route on a routine 24 h token expiry — and in a headless
   wake it repeats all shift, because `expireSession` has no subscriber when `AuthProvider` never
   mounted. 401 now stops the service; 429 retries. See the spec's §6.

Full spec, the fourteen locked decisions, what the review found and what was deliberately left
out: `docs/spec/PHASE-7.md`.

> **Two more Phase-2 pins were flipped deliberately**, and `api-geo.test.ts`'s
> `pinned known bugs` block is now **empty and deleted** — the negative-accuracy case and the
> "states a 2.0 km fence" case both assert correct behaviour now. Same convention as
> `api-renewals.test.ts:187` in Phase 3 and the two `adapt.test.ts` pins in Phase 4. The only
> pinned-bug block left in the suite is `adapt.test.ts`'s `mapClaimStatus` pins.

## Phase 8 — Delete the last fabricated-data path, and the stale docs ✅ DONE 2026-08-11 (`e5b57ef`)
`generateReport` returns `null` on failure instead of inventing ₹42,00,000 of cover.
Correct `config.ts`'s five now-false comments, and `HOW_TO_RUN.md` / `TESTING_GUIDE.md`, which still
describe an offline demo mode and a localhost default that no longer exist.
**Files:** `src/data/api.ts`, `src/constants/config.ts`, `src/data/tasks.ts`, `src/data/team.ts`,
`HOW_TO_RUN.md`, `TESTING_GUIDE.md`
**Done when:** grep for `source: 'demo'` returns nothing, and no doc in the repo describes sample data.

**Result.** No new tests — the fixed `generateReport` is a one-line `tryReal` passthrough, the
same untested shape as its cited precedents `getDashboardOverview` / `getClaimsSummary`. Two
things turned out to be true that the phase text did not say:

1. **The fabrication was already distrusted, not merely unnoticed.** `client/[id].tsx`'s only
   caller had a `source !== 'demo'` guard and a comment explaining why — proof the fabrication
   had never reached a screen, but also proof it was surviving only because of one call site's
   memory. A second caller checking only `.ok` would have shown an invented life-cover figure to
   a real customer. Deleting it at the source, not just distrusting it at the call site, is what
   makes that impossible rather than merely unlikely — same shape as Phase 7's D-2 and Phase 5's
   D-1.
2. **`config.ts`'s five comments were not independent of each other.** An adversarial review (one
   pass, proportionate to the phase's size) caught that rewriting the "Backend base URL" paragraph
   while leaving its neighbour — a numbered list 24 lines above, itself untouched by the phase
   text's own count — still saying "Set API_BASE_URL below" for native produced a file that
   contradicted itself one paragraph later. Fixed in `4e12688`.

Full spec, the six locked decisions and what the review found: `docs/spec/PHASE-8.md`.

## Phase 9 — Make reminders and checklists persist ~~`[api]`~~ ✅ DONE 2026-08-11 — the `[api]` tag was wrong
`toggleReminder`, `toggleTaskStep` and `toggleClaimDoc` made no network call and mutated buffers that
are never populated. Either wire them or remove the controls — a tick that silently reverts is worse
than no tick.
**Files:** `src/data/api.ts` (`toggleReminder`), `src/data/adapt.ts` (`adaptReminder` done-regex),
`src/app/reminders.tsx`, plus new `__tests__/api-reminders.test.ts` and an `adapt.test.ts` case —
**not** `src/app/task/[id].tsx` (control already removed in Phase 1) or `src/app/claim/[id].tsx`
(already honest — D-3).
**Done when:** a completed reminder is still complete after a cold start, or the control is gone.

**Result.** 6 new tests. The `[api]` tag was stale: `POST /reminders/:id/acknowledge` has existed
since before the app did (`routes/reminders.js:419`, `api.md:914`) — same "predicted dependency was
never real" shape as Phases 6/10/11/12. Three controls, three truths:
1. **`toggleReminder` — wired.** Now POSTs `/reminders/:id/acknowledge` and returns the server's
   verdict (`Promise<boolean>`, `markAllNotificationsRead` shape). `adaptReminder`'s done-regex gained
   `acknowledg` so the persisted `status:'acknowledged'` reads back as done; `getReminders` already
   reads the same Mongoose store, same `_id` space, so no new read. **Completion is one-way** — the
   backend has no un-acknowledge — so the "Reopen" swipe + undo button were removed (a reopen could
   only silently revert). `reminders.tsx` now mirrors `tasks.tsx`: optimistic tick, per-row rollback +
   warning `Banner` on refusal, `haptics.success` only on a confirmed write.
2. **`toggleTaskStep` — already gone** (Phase 1 tombstone at `api.ts:465`); no endpoint exists.
3. **`toggleClaimDoc` — left as-is (D-3), a deviation from the plan.** The claim checklist already
   discloses it does not persist (`claim/[id].tsx:416`) and its tick is load-bearing for the real
   upload flow; there is no `documents` field on the backend `Claim` to wire. Making it read-only would
   delete honest working code to fix a non-existent lie. Flagged in DECISIONS + handoff.

**The cold-start persistence needs a handset + live backend** (criterion 4) — carried, like the other
device checks. Spec: `docs/spec/PHASE-9.md`.

## Phase 10 — Wire server-driven navigation ✅ DONE 2026-08-11
The documented known gap (`ADMIN_PANEL_SYNC.md` §9). `(tabs)/_layout.tsx` builds its bar from
`useAppUi().config.nav.tabs` instead of the module `ORDER` constant, spilling entries beyond five
into More; `more.tsx` filters on `nav.hidden` and groups by `nav.more_sections`.
**Files:** `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/more.tsx`, `src/store/appUi.tsx`
**Done when:** saving a tab order in the admin panel changes the bar on the next cold start, and a
module in `nav.hidden` is unreachable.

**Result.** 8 new tests, pinning the new `resolveTabs` selector. Two things turned out to be true
that the phase text did not say:

1. **Two of the eight values `nav.tabs`' own schema enum allows (`prospects`, `tickets`) have no
   physical tab to become.** They live outside the `(tabs)` route group as flat stack screens;
   turning them into real bottom tabs means moving those files, a bigger structural change than
   this phase's three-file budget covers. `resolveTabs` filters `nav.tabs` down to the six routes
   this build can render before computing bar order, so a config naming either one degrades to
   "reachable from More" — exactly where they already were.
2. **`more` had to become unconditional, not config-driven.** It is the only way back to a module
   that lost its tab slot, and the only place Sign Out lives — so it renders in the bar and stays
   reachable regardless of what `nav.tabs`/`nav.hidden` say. Every real config in
   `ui_rbac_config.json` already lists it last, so this changes nothing for a well-formed document.
3. **`nav.more_sections` grouping/ordering was deliberately left out.** Only `nav.hidden` — the
   field the contract itself calls "the ONLY control that makes a module unreachable" — is wired
   into `more.tsx`. The existing groups carry curated, role-conditional presentation (a live ticket
   count, Master/Admin copy switches, the view-as sheet) that a generic `{title, items}` renderer
   would have flattened for a benefit the DONE-WHEN criterion never asked for.

Full spec, all five locked decisions and what was deliberately left out: `docs/spec/PHASE-10.md`.

## Phase 11 — Server-derived tier ✅ DONE 2026-08-11
`store/roles.ts` grants the top privilege tier by string-matching a hardcoded personal email address
compiled into every APK. Derive the tier from the server's own role/claims instead.
**Files:** `src/store/roles.ts`, `src/store/auth.tsx`, `src/data/api.ts`, `src/app/(tabs)/more.tsx`
**Done when:** no email address literal remains in `src/`, and the master experience survives that
person changing address.

**Result.** No new tests — `tierOf()` had zero coverage before this phase and still does; the
change is a one-line predicate swap, same class as Phase 17. One thing worth recording:

1. **The predicted file list shrank to one file (plus the type it depends on).** `contracts/enums.md`
   §1.1 already documents `Profile.role`'s top rank, `super_admin`, as passing "every `authorize()`
   gate unconditionally" — the server's own opinion of who is Master, already returned unfiltered on
   login and `/auth/me`. `auth.tsx`, `api.ts` and `more.tsx` needed no change: role already flowed
   through `adaptUser()`, and every tier consumer already went through `capabilitiesOf()`, not the
   email. `data/types.ts`'s `Role` union gained `'super_admin'` — required for the comparison to
   type-check under TS strict, not optional polish.
2. **This ships without a live-database check that any specific account currently holds
   `role: 'super_admin'`** — that's production data, unreachable from this repo. Asked rather than
   assumed; the answer was to proceed and confirm/set it separately. Not a lockout risk if it's not
   set yet — `tierOf()` falls through to whatever the account's actual role implies. See
   `docs/spec/PHASE-11.md` D-4 if Master unexpectedly reads as Admin after this ships.

Full spec and the four locked decisions: `docs/spec/PHASE-11.md`.

## Phase 12 — `/profiles` role gate ✅ DONE 2026-08-11 (`4507d6e`) — the `[api]` tag was wrong
`GET /profiles` is admin-only, but `getTeam()` calls `getAgentLocations()` on its success path purely
to compute `clockedIn` — so advisors and leaders saw "0 on duty" and an empty agent map.
**Files:** `src/data/api.ts` (`getAgentLocations` only), `src/data/__tests__/api-agents.test.ts` (new)
— **not** `team/index.tsx` / `agent-map.tsx`, which the phase text predicted and which needed nothing
(the fix is upstream of them, D-4). Same "predicted list shrank" shape as Phases 5 and 11.
**Done when:** a leader account sees the correct on-duty count.

**Result.** 10 new tests. Three things worth recording:

1. **The break was one wrong door, not a missing endpoint — so no `cgpe-api` change (D-1).** The roster
   source moved `GET /profiles?limit=60` → `GET /team/task-overview?scope=all`; the `/attendance/user/:id`
   fan-out it feeds already works for a leader (no role check, `api.md:544`), and `task-overview` members
   carry the `user_id`+`name` `toPin` reads. The `[api]` marker on the board is struck through.
2. **`?scope=all` was verified against the producer's code, not trusted from the contract prose (D-2).**
   `../cgpe-backend-main/utils/scope.js` `visibilityScope` gates the `all` → org-wide branch on
   `isSuperAdmin || role==='admin'`, so a leader's `?scope=all` is silently ignored and clamped to their
   team. The param is needed to keep admin/master org-wide (the bare endpoint defaults them to `mode:'own'`,
   showing only themselves on the map) — the opposite of what "drop the param" would have done. A test pins
   the request carries `?scope=all` so a later edit can't quietly drop it.
3. **The outage reports under the existing `/attendance` health key (D-3), not a competing
   `/team/task-overview` row** — `getTaskOverview` owns that one, and the demo path + agent-map degraded
   copy already key on `/attendance`. Presentation only; it does not affect the count.

The leader on-duty count against production is the DONE-WHEN proper and **needs a handset + live backend +
a leader token + someone actually clocked in** (spec criterion 6) — carried, not editor-verifiable.
Full spec, the five locked decisions and what was left out: `docs/spec/PHASE-12.md`.

## Phase 13 — Vendor Leaflet ✅ DONE 2026-08-11
`LeafletMap.tsx` pulled Leaflet 1.9.4 from unpkg and tiles from a CDN at runtime, with no SRI and no
offline fallback — in a field-sales app whose users are on mobile data by definition.
**Files:** `src/ui/LeafletMap.tsx`, `scripts/vendor-leaflet.mjs` (new), `src/ui/vendor/leaflet-1.9.4.ts`
(new, generated), `src/ui/__tests__/leaflet-vendor.test.ts` (new), `package.json`, `eslint.config.js`
— **not `assets/`**: the WebView renders `source={{ html }}` with no base URL, so the library is
inlined as a bundled string, not shipped as an asset file (spec D-2).
**Done when:** the map renders with the network blocked after first load.

**Result.** 5 new tests. Two things worth recording:

1. **"Renders offline" is the library, not the tiles — and that distinction is the whole phase.**
   The world's tile imagery cannot be bundled into an APK, so vendoring means Leaflet itself runs
   offline (frame, gestures, pins, route) while the tile layer degrades to the existing "tiles could
   not load" banner over a live map. The Phase 10 handoff warned against misreading this; `docs/spec/
   PHASE-13.md` D-1 locks it.
2. **Inlining beats an asset file *and* beats SRI.** `source={{ html }}` has no base URL, so a
   `file://`/relative asset can't resolve without enabling exactly the file-origin access this phase
   exists to avoid — the library is bundled as a string and inlined. That also removes the "no SRI"
   risk entirely: there is no remote fetch left to hash. Tiles stay on the CDN, pinned by a test so a
   later edit doesn't rip them out alongside the library reference.

Full spec, the six locked decisions and what was left out: `docs/spec/PHASE-13.md`.

## Phase 14 — Dead-code sweep ✅ DONE 2026-08-11 (`1a37144`)
Remove `ui/kit.tsx`, `ui/characters.tsx`, `hooks/use-theme.ts`, `hooks/use-color-scheme*.ts`,
`constants/theme.ts`, `src/global.css`, and the orphaned helpers in `data/tasks.ts` / `data/team.ts`.
**Done when:** `npx tsc --noEmit` is still clean and nothing imports the removed modules.

**Result.** No new tests — the phase only removes code. Three things worth recording:

1. **The seven files were a *closed* dead cluster, verified before deleting, not assumed.** Each was
   imported only by another member of the set or by nothing: `global.css ← constants/theme.ts ←
   use-theme.ts`; `use-color-scheme.ts`/`.web.ts ← use-theme.ts`; `kit.tsx`, `characters.tsx` and
   `use-theme.ts` had zero importers. Live code (`theme/theme.tsx`, `ui/Splash.tsx`) imports
   `useColorScheme` straight from `react-native`, not from the deleted hook.
2. **`kit.tsx`'s own docstring lied — it claimed "81 import sites across 39 screens."** A precise
   `from '@/ui/kit'` grep across the whole tree returned **zero** import statements; the screens were
   migrated to the split modules (`@/ui/base`, `@/ui/data`, …) in an earlier phase and the barrel's
   header was never updated. `PROJECT_MAP.md`'s "zero importers despite its docstring" was right.
3. **`global.css` is genuinely dead — there is no CSS toolchain to process it.** No NativeWind,
   Tailwind or `cssInterop` anywhere in the repo's config; its only importer was the dead
   `constants/theme.ts`. In `data/tasks.ts`/`team.ts` only zero-consumer code was removed (private
   date helpers left over from the deleted seed arrays, and `team.ts`'s `teamMembers`/
   `teamActivityFeed` empty stubs that every import site had already stopped using via `import type`);
   all types and live label maps / `taskProgress` stayed. `src/ui/vendor/leaflet-1.9.4.ts` was left
   alone — it is imported by `LeafletMap.tsx` and only looks orphaned because eslint ignores it.

## Phase 15 — Lint to green ✅ DONE 2026-08-11 (`292610b`)
45 errors on a clean tree (46 before Phase 14 removed one with the dead files), all from four
React-Compiler rules that `eslint-plugin-react-hooks` v7 promotes to errors because `app.json` sets
`experiments.reactCompiler:true`.
**Done when:** `npm run lint` exits 0, or every remaining rule is explicitly disabled with a reason.

**Result.** No new tests — a lint-config change plus a one-line initialiser, no new pure logic to
pin. `npm run lint` exits 0 (0 errors, 12 warnings — all pre-existing); `npx tsc --noEmit` exits 0;
`npm test` still 271 across 10 files. Three things worth recording:

1. **The React Compiler is genuinely on, so these rules are not noise to be silenced blindly.**
   `app.json` `experiments.reactCompiler:true` means `babel-plugin-react-compiler@1.0.0` runs at
   build; the v7 hooks plugin ships the compiler's static rules as errors. The compiler **bails out
   of optimising** a component it can't prove safe rather than miscompiling it — so a flagged
   component still runs correctly, it just forgoes auto-memoisation. That is why disabling the rules
   is safe *and* why it is a real (if modest) cost: those components opt out of compiler wins.
2. **One error was a genuine bug and is fixed at source, not disabled.** `react-hooks/purity` fired
   once — `useState(Date.now())` in `home.tsx` evaluates the impure `Date.now()` in the render body
   on every pass. The lazy-initialiser form `useState(() => Date.now())` defers it to mount with an
   identical value. The `purity` rule stays **on** to catch the next real one.
3. **The other three were disabled with a documented rationale, per the handoff's explicit call.**
   `immutability` (×9, Reanimated `sv.value=` writes in worklets/handlers), `refs` (×11, the RN
   Animated `useRef(new Animated.Value()).current` idiom and the latest-value ref pattern), and
   `set-state-in-effect` (×24, the app's single data-fetch convention — CLAUDE.md §Conventions 3)
   all fire on patterns that are correct for this codebase. Rewriting 20+ screens (incl. the
   1915-line `home.tsx`) with zero test coverage was out of scope; the disable block in
   `eslint.config.js` names each rule, its count, and why.

## Phase 16 — "My earnings": attendance-derived salary `[api]` — NEW, requested 2026-08-10
A new section showing the signed-in person **their own** present-day count and the salary amount that
attendance earns them. Premium, interactive, built from the existing design tokens.
**Files (app):** `src/app/earnings.tsx` (new), `src/data/api.ts`, `src/data/adapt.ts`,
`src/data/types.ts`, `src/app/(tabs)/more.tsx`, `src/app/attendance.tsx`
**Done when:** a staff member opens Earnings and sees present days, payable days and amount for the
selected month, matching what payroll would compute by hand for the same month.
Full spec + the exact inputs still needed from the product owner: `docs/spec/PHASE-16.md`.

> **Blocked on two things, both real.**
> 1. **The salary formula.** To be supplied by the product owner (see the spec's INPUT REQUIRED list).
> 2. **The backend has no salary data at all.** `payroll_staff` is only a role name — there is no
>    `salary`, `wage`, `per_day` or `ctc` field on `Profile` or any other model, and `/api/leaves/*`
>    is a stub that returns an empty array and persists nothing. `cgpe-api` must store a pay rate and
>    expose a computed endpoint before the app can render a figure.
>
> **Do not derive salary on the device.** Two reasons: `GET /api/work-settings` is `protect`-only, so
> any advisor can rewrite `daily_hours` / thresholds and change their own pay; and present-days is
> ambiguous on the server — `routes/attendance.js` merges two different collections per calendar day
> (`attendance`, historical, and `daylogs`, live), so only the backend can define one authoritative count.

---

## Phase 17 — Warn on an out-of-bounds clock-out ✅ DONE 2026-08-11
Show a non-blocking warning when someone clocks out outside the office fence. Requested directly
(Hinglish: *"agar clock-out ke waqt woh location ke andar na ho toh warning dijiye"*).

**What's already true, verified before writing this down:**
- Clock-out is **deliberately never blocked** by the fence — Phase 7's decision, held on both
  sides. `home.tsx:780-797` skips the client pre-check entirely on the clock-out path (`!clock.in`
  guards it), and the server's own comment at `timeTracker.js:488-497` explains why: a field
  agent's last call of the day is a client's home, and forcing a return to the office to end a
  shift just moves the lie from "where" to "when". **This phase must not re-introduce blocking** —
  it adds a warning, not a refusal.
- The server already computes `out_of_bounds` / `distance_m` on every clock-out
  (`timeTracker.js:498-518`, `checkClockGeofence` — the same function and the same global fence
  clock-in uses, `timeTracker.js:319`) — but **never returns them**. `contracts/api.md:522`
  already has this mapped: `LocationSchema` in `models/DayLog.js` only declares `lat`/`lng`/
  `accuracy`, so `distance_m`/`out_of_bounds` are stripped from `endedSession` before
  `res.json` sends it, and `/clock-out`'s response (`timeTracker.js:553-561`) is `{ session,
  totalWorked, totalBreak }` — no fence verdict anywhere in it, persisted or not.
- **Consequence: this does NOT need a `cgpe-api` change.** Re-deriving the same verdict
  client-side, for display only, is exactly what `api.checkGeofence()` already does for clock-in
  (Phase 7) — same fence, same math, same server-authority rule. Waiting on a backend contract
  change here would be duplicating work the app can already do today.

**Files:** `src/app/(tabs)/home.tsx` (call `api.checkGeofence()` on the clock-out path too, and
show a warning `Banner`/`notice` after a successful clock-out when it says `!allowed` — never
before, and never gating the write itself).

**Done when:** clocking out from outside the fence still succeeds exactly as it does today, and
additionally shows a warning stating the measured distance (same "no fence size stated" convention
as Phase 7's D-5/D-6 — a quoted radius can disagree with the server, a measured distance cannot);
clocking out from inside the fence shows no warning, unchanged from today.

**Deliberately out of scope:** teaching the *server's* `/clock-out` response to return
`out_of_bounds`/`distance_m` so the warning could be built from the write's own reply instead of a
second `checkGeofence` call. That would be the more architecturally clean fix and is worth filing
to `cgpe-api` regardless (the field is computed and thrown away every single clock-out), but it is
not this phase's blocker — see the "does not need a `cgpe-api` change" note above.

**Result.** No new tests — this phase adds no new pure logic to pin; the change is entirely inside
`toggleClock`'s imperative write path, which has zero test coverage on either side of this diff
(same class as `generateReport` before Phase 8). Two things worth recording:

1. **One caller, widened, not duplicated.** The existing `if (fix && !webDemo && !clock.in)`
   geofence pre-check became `if (fix && !webDemo)`, with the blocking branch still nested under
   `!clock.in`. The clock-out arm captures the verdict in `clockOutFence` and reads it only after
   `api.clockOut()` has already returned a non-blocked, `ok` result — so the warning is strictly
   beside a real success, never ahead of or instead of one.
2. **`geo.message` was not reusable.** It is composed for the clock-in refusal specifically
   ("Move about X closer to clock in"), which reads as nonsense after a clock-out has already
   completed. `distanceText()` — the private formatter `geo.message` itself is built from — is now
   exported from `api.ts` (`src/data/api.ts`, one word) so the clock-out warning can build its own
   sentence from `distance_m` without duplicating the km/m rounding rule.

Full spec and the five locked decisions: `docs/spec/PHASE-17.md`.

---

## Phase 18 — Watchable, A-to-Z, worst-case end-to-end test pass 🟡 PLANNED 2026-08-11
Requested directly: test the whole app A-to-Z, worst-case / all-unexpected-edge-cases, in a way the
user can **watch** — a browser opening, or some mobile-screen-type surface, where every action is
visible. User pre-approved the tooling choice.

**The path, chosen and locked (full spec: `docs/spec/PHASE-18.md`):** **Playwright driving the Expo
*web* build (`npx expo start --web`) in headed Chromium**, with `video`+`trace`+`screenshot` on, and
**deterministic edge-case injection** via `page.route` network mocking (500 / 503+Retry-After /
empty `{data:[]}` / malformed body / timeout / 401 mid-session / 403 RBAC / oversized list / slow
net). The user watches live and re-watches the recording; edge states are synthetic, so the run
touches **zero production data**.

**Files (new, outside `src/` so `tsc`/Vitest/EAS ignore them):** `e2e/playwright.config.ts`,
`e2e/*.spec.ts`, `e2e/artifacts/` (git-ignored). Plus, *only if needed*, a minimal
`Platform.OS !== 'web'` guard around a module-scope native import to make the web build boot (each
such guard recorded as a decision; the three gates must stay green).

**Done when:** one command opens a visible browser that walks all 47 screens A-to-Z while the user
watches; a video+trace is saved; every web-reachable screen renders (no blank, no error boundary) in
its normal **and** injected worst-case states; every form takes bad-input/boundary abuse; a
pass/fail report + per-state screenshots land in one folder.

**First task + main risk:** the app may not boot on web as-is (`_layout.tsx:18`
`import '@/lib/tracker'` and other module-scope native imports). Step 1 is getting `/(auth)/login` to
render web-side without a redbox. Make the **minimum** web guard — do not rewrite screens for web.

**Explicitly NOT covered by the web harness (stays handset-only):** haptics, the AsyncStorage
`clock.<date>` key, background GPS, the biometric AppLock, the `react-native-webview` LeafletMap, and
the native base-URL branch. Phase 18 **shrinks** the device-verification backlog; it does not replace
it. A green web pass must not be read as "the whole app is verified."

## Phase 19 — Language toggle: verify + harden all 5 languages (incl. Hinglish / Gujlish) 🟡 PLANNED 2026-08-11
Requested directly: the app can run in **Gujlish / Hinglish** too — *Hinglish* = Hindi pronunciation
in English letters, *Gujlish* = Gujarati pronunciation in English letters. Add it as a tracked row.

**What's already true:** the app **ships** all 5 dictionaries today (`src/i18n/index.tsx`: English,
हिन्दी, ગુજરાતી, Hinglish, Roman Gujarati — 5 × 74 keys). So this phase **verifies + hardens the
existing toggle**, it does not build a new one. Full spec: `docs/spec/PHASE-19.md`.

**The path:** (1) **buildable now, needs no device** — a `src/i18n/__tests__/dictionaries.test.ts`
(Vitest) asserting all 5 dictionaries share the exact same key set with no blank / missing / key-echo
values; this is a *permanent gate* against the "added a key in English, forgot the other four"
regression. (2) **visual half** — rides the Phase 18 harness: set each of the 5 languages, walk the
screen inventory, screenshot each; a human confirms Hinglish/Gujlish read naturally and layout holds
at 390 px.

**Done when:** the parity test is green in `npm test`; no screen leaks a raw i18n key in any language;
the toggle switches + persists; Hinglish/Gujlish screenshots read as Hindi/Gujarati-in-Latin (human
review), and no text clips/overflows.

**Not done:** machine-translating or auto-transliterating a missing string — a wrong romanised string
is worse than an obvious English fallback, so gaps are **reported**, not guessed. No new language, no
RTL (none of the five are RTL).

**Sequencing (both 18 & 19):** land **before** Phase 16 (salary) / Phase 6 (commissions), per the
user's order — "pehle test + language, uske baad salary aur jo baaki hai." 16 and 6 stay
backend-blocked regardless.

---

## Recommended session split

| Session | Phases | Why |
|---|---|---|
| `cgpe-mobile` (this one) | 1 → 5, 7 → 11, 13 → 15, **17** | Pure app-side. Phase 1 first, then 2 so everything after it is verifiable. |
| `cgpe-mobile` + `cgpe-api` | 6, 9, 12, **16** | Need a backend change first. File the INBOX item, wait for the reply, then build. |
| `cgpe-admin` | — | Phase 10 makes the panel's existing nav controls take effect; no panel change needed. Tell them when it ships. |

**Phase 16 can be pulled forward.** It does not depend on 8–15. Its only hard app-side prerequisite is
**Phase 1** — clock-in currently reports success when the write never reached the server, so a salary
figure built on today's attendance data would quietly under-pay whoever clocked in on a bad connection.
Phase 7 (tracking/geofence correctness) should land before it too. Everything else is `cgpe-api` work
that can run in parallel.

## Open INBOX items addressed to this session

From `../contracts/INBOX.md`, re-read 2026-08-10 at the close of Phase 7. **Nothing is open against
this session.** Both remaining boxes were closed by Phase 7:

- **D5** `POST /time-tracker/track/points` reads `session_id`, not `sessionId`. ✅ **Closed** —
  answered with the finding that the app already sent snake_case and the hole survived through
  `JSON.stringify` dropping an `undefined` key, plus the shared-handset consequence D5 did not
  name. Ticked; the item was addressed to this session alone.
- **D10** the clock-in fence is up to 300 m, not a flat 200 m (`utils/geofence.js:93-94` credits up
  to 100 m of GPS accuracy). ✅ **Answered** — the app now states no fence size at all. Box left
  unticked because the item is addressed to `cgpe-admin` as well, per the protocol.

Filed **to** `cgpe-api` in the same pass: the 100 m accuracy floor on `/track/points` versus the
app's `Accuracy.Balanced` recording; `/track/points` having no ownership check; and their own
rejection copy still rendering "within 0.2 km".

Closed this session, and worth knowing they were closed **twice**: the `/auth` registration item
and the blocking "does the app call any of these 31 endpoints" item were both answered and ticked
in Phase 4, then **deleted from the file by a concurrent write** during Phase 5's boot. Both were
re-verified from scratch — not re-pasted — and re-written. See `DECISIONS.md`.

Awaiting a reply **to** us: whether the n8n hub webhook is configured in production. It decides
whether the app can send WhatsApp messages at all, and no client can see it from the outside.
