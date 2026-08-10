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

**Phase 3 — done.** Built 2026-08-10, commit `e0b0b2c`. `npm test` runs **164** tests across 6
files and exits 0; `npx tsc --noEmit` exits 0; `npm run lint` is byte-identical to the 46-error
baseline. **git is also unblocked** — Phases 1 and 2 had never been committed and are now in
`123db30`.

**Phase 1 — still code-complete, verification still outstanding.** Acceptance criteria 1–6 in
`docs/spec/PHASE-1.md` need a handset in airplane mode. Neither Phase 2 nor Phase 3 covers them:
they are haptics, an AsyncStorage clock key and background GPS, none of which a Node test can
exercise.

## Next 3

1. **Phase 4** — the leads contract (envelope unwrap, `stage`→`status`, stage vocabulary).
   Two tests in `adapt.test.ts` are pinned to today's wrong mapping and **must go red** when this
   lands; that is the signal, not a regression.
2. **Phase 5** — WhatsApp send (`text` not `message`, phone from `waThreadCache`).
3. **Phase 7** — geofence + tracking (INBOX D5 `session_id`, D10 the fence is up to 300 m).

> **Carried out of Phase 3, small and specified:** `src/screens/dashboards.tsx:292-297` renders the
> Master KPI tiles as `snapshot?.total_clients ?? 0`, so a **partial** outage (roster loads, org
> endpoints down) still shows "0 clients · ₹0 claims paid" as fact. The hero directly above it at
> `:266` already does the right thing with its `NO_VALUE` placeholder — the tile grid just needs the
> same treatment. Left out because `dashboards.tsx` is not in Phase 3's file list and the phase's
> own DONE-WHEN (a *fully* dead backend) is met without it.

## Status board

| # | Phase | Status |
|---|---|---|
| 1 | Write-path honesty | **Built** — handset verification outstanding |
| 2 | Test runner + pure logic | **Done** 2026-08-10 — 140 tests green |
| 3 | Data-health channel | **Done** 2026-08-10 — 164 tests green (`e0b0b2c`) |
| 4 | Leads contract | Next |
| 5 | WhatsApp send | Not started |
| 6 | Remaining envelope mismatches `[api]` | Blocked on `cgpe-api` |
| 7 | Geofence + tracking (INBOX D5, D10) | Not started |
| 8 | Last fabricated-data path + stale docs | Not started |
| 9 | Reminders/checklists persist `[api]` | Blocked on `cgpe-api` |
| 10 | Server-driven navigation (§9 gap) | Not started |
| 11 | Server-derived tier | Not started |
| 12 | `/profiles` role gate `[api]` | Blocked on `cgpe-api` |
| 13 | Vendor Leaflet | Not started |
| 14 | Dead-code sweep | Not started |
| 15 | Lint to green | Not started |
| 16 | "My earnings" salary section `[api]` | **Blocked** — awaiting the salary formula *and* a backend pay field |

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

## Phase 4 — Leads contract
Unwrap the `{ lead }` envelope on `GET`/`POST`, send `status` with the server's own enum, and teach
`mapLeadStage` the real vocabulary.
**Files:** `src/data/api.ts`, `src/data/adapt.ts`, `src/app/lead/[id].tsx`,
`src/app/(tabs)/leads.tsx`
**Done when:** tapping a lead opens its detail screen with data; a stage change persists across a
cold start; a `policy_issued` lead renders as won, not New; a newly created lead shows its real name.

## Phase 5 — WhatsApp send
Send `text` (not `message`), resolve the phone from `waThreadCache` (not the empty `state.waThreads`),
and let a failure reach the UI.
**Files:** `src/data/api.ts`, `src/app/whatsapp/[id].tsx`, `src/data/adapt.ts`
**Done when:** a sent message reaches the gateway; a rejected send returns the text to the composer
instead of painting a sent tick.

## Phase 6 — Remaining envelope mismatches `[api]`
Commissions (array vs aggregate), LIC plans (`{meta, plans}` vs array), notes search (`search` vs `q`).
**Files:** `src/data/api.ts`, `src/app/commissions.tsx`, `src/app/lic-plans.tsx`, `src/app/notes.tsx`
**Done when:** all three screens show real data against production. Needs `cgpe-api` to un-shadow
`GET /api/commissions/team-summary` (declared after `/:id`, so it is dead code today).

## Phase 7 — Geofence and tracking correctness
Adopt `contracts/INBOX.md` **D5** (`session_id`, not `sessionId`) and **D10** (effective fence is up
to 300 m, not a flat 200 m). Make the geofence fallback fail **open**, not closed.
**Files:** `src/lib/tracker.ts`, `src/data/api.ts`, `src/app/(tabs)/home.tsx`
**Done when:** a buffer replayed after clock-out uploads successfully; with `/geofence` unreachable,
clock-in is allowed rather than blocked by hardcoded Surat coordinates; no UI copy says "200 m".

## Phase 8 — Delete the last fabricated-data path, and the stale docs
`generateReport` returns `null` on failure instead of inventing ₹42,00,000 of cover.
Correct `config.ts`'s five now-false comments, and `HOW_TO_RUN.md` / `TESTING_GUIDE.md`, which still
describe an offline demo mode and a localhost default that no longer exist.
**Files:** `src/data/api.ts`, `src/constants/config.ts`, `src/data/tasks.ts`, `src/data/team.ts`,
`HOW_TO_RUN.md`, `TESTING_GUIDE.md`
**Done when:** grep for `source: 'demo'` returns nothing, and no doc in the repo describes sample data.

## Phase 9 — Make reminders and checklists persist `[api]`
`toggleReminder`, `toggleTaskStep` and `toggleClaimDoc` make no network call and mutate buffers that
are never populated. Either wire them or remove the controls — a tick that silently reverts is worse
than no tick.
**Files:** `src/data/api.ts`, `src/app/reminders.tsx`, `src/app/task/[id].tsx`,
`src/app/claim/[id].tsx`
**Done when:** a completed reminder is still complete after a cold start, or the control is gone.

## Phase 10 — Wire server-driven navigation
The documented known gap (`ADMIN_PANEL_SYNC.md` §9). `(tabs)/_layout.tsx` builds its bar from
`useAppUi().config.nav.tabs` instead of the module `ORDER` constant, spilling entries beyond five
into More; `more.tsx` filters on `nav.hidden` and groups by `nav.more_sections`.
**Files:** `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/more.tsx`, `src/store/appUi.tsx`
**Done when:** saving a tab order in the admin panel changes the bar on the next cold start, and a
module in `nav.hidden` is unreachable.

## Phase 11 — Server-derived tier
`store/roles.ts` grants the top privilege tier by string-matching a hardcoded personal email address
compiled into every APK. Derive the tier from the server's own role/claims instead.
**Files:** `src/store/roles.ts`, `src/store/auth.tsx`, `src/data/api.ts`, `src/app/(tabs)/more.tsx`
**Done when:** no email address literal remains in `src/`, and the master experience survives that
person changing address.

## Phase 12 — `/profiles` role gate `[api]`
`GET /profiles` is admin-only, but `getTeam()` calls `getAgentLocations()` on its success path purely
to compute `clockedIn` — so advisors and leaders see "0 on duty" and an empty agent map.
**Files:** `src/data/api.ts`, `src/app/team/index.tsx`, `src/app/agent-map.tsx`
**Done when:** a leader account sees the correct on-duty count.

## Phase 13 — Vendor Leaflet
`LeafletMap.tsx` pulls Leaflet 1.9.4 from unpkg and tiles from a CDN at runtime, with no SRI and no
offline fallback — in a field-sales app whose users are on mobile data by definition.
**Files:** `src/ui/LeafletMap.tsx`, `assets/`
**Done when:** the map renders with the network blocked after first load.

## Phase 14 — Dead-code sweep
Remove `ui/kit.tsx`, `ui/characters.tsx`, `hooks/use-theme.ts`, `hooks/use-color-scheme*.ts`,
`constants/theme.ts`, `src/global.css`, and the orphaned helpers in `data/tasks.ts` / `data/team.ts`.
**Done when:** `npx tsc --noEmit` is still clean and nothing imports the removed modules.

## Phase 15 — Lint to green
46 errors on a clean tree, mostly React-Compiler rules firing on Reanimated shared values.
**Done when:** `npm run lint` exits 0, or every remaining rule is explicitly disabled with a reason.

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

## Recommended session split

| Session | Phases | Why |
|---|---|---|
| `cgpe-mobile` (this one) | 1 → 5, 7 → 11, 13 → 15 | Pure app-side. Phase 1 first, then 2 so everything after it is verifiable. |
| `cgpe-mobile` + `cgpe-api` | 6, 9, 12, **16** | Need a backend change first. File the INBOX item, wait for the reply, then build. |
| `cgpe-admin` | — | Phase 10 makes the panel's existing nav controls take effect; no panel change needed. Tell them when it ships. |

**Phase 16 can be pulled forward.** It does not depend on 8–15. Its only hard app-side prerequisite is
**Phase 1** — clock-in currently reports success when the write never reached the server, so a salary
figure built on today's attendance data would quietly under-pay whoever clocked in on a bad connection.
Phase 7 (tracking/geofence correctness) should land before it too. Everything else is `cgpe-api` work
that can run in parallel.

## Open INBOX items addressed to this session

From `../contracts/INBOX.md`, dated 2026-08-10, **not yet ticked off** — no code has changed:

- `contracts/` now exists and is populated (426 endpoints). → adopted as the source of truth in `CLAUDE.md`.
- **D5** `/track/points` reads `session_id`, not `sessionId`. → Phase 7.
- **D10** the clock-in fence is up to 300 m, not a flat 200 m. → Phase 7.
