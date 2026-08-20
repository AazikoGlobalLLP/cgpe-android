# Glossary — CGPE Connect (Android)

Terms with a fixed project meaning. A later session must not redefine these.

| Term | Fixed meaning |
|---|---|
| **`unavailable(endpoint, value)`** | The one sanctioned failure path in `src/data/api.ts`. Reports to `data/health`, waits `MOCK_LATENCY`, returns an EMPTY value. `tryReal` returning `null` is **not** this — it reports nothing. |
| **`state` (in `api.ts`)** | A write buffer for records the user just typed this session. **Not** seed data, not a cache. Repopulating it re-introduces fabricated policyholders. |
| **Real-backend-only** | There is no offline/demo mode. A failed read resolves empty and raises the HealthBanner. `FORCE_DEMO` is `false` and no longer synthesises records — it only short-circuits the network. |
| **Fail-open (RBAC)** | If `GET /rbac/app-ui` 404s, 500s or times out, the app shows the **full** menu with every capability on. A layout-config outage must never lock a field agent out of their own work. Real authorisation lives in the API routes. |
| **Fail-open (geofence)** | From Phase 7: if the office fence cannot be fetched, clock-in is **allowed**. The server re-validates independently. |
| **Mandatory widget** | A dashboard widget the server re-asserts as visible on both read and write. Sales: `my_tasks prospects leads_pipeline personal_notes`. Operations: `my_tasks claim_requests personal_notes issue_logs`. Its visibility switch renders disabled and ON. |
| **Array order is render order** | `dashboard.widgets[]` order **is** the contract. Never sort it — not by key, not by visibility, not "mandatory first". |
| **Inert config** | `nav.tabs`, `nav.hidden`, `nav.more_sections` — stored, validated and served correctly by the backend, and consumed by **no** screen in v1.8.0. Phase 10 wires them. |
| **Tier** vs **Role** | **Role** is the server's `advisor \| learn_advisor \| leader \| admin \| payroll_staff`. **Tier** is the app's own `master \| admin \| team`, computed client-side in `store/roles.ts`. They are separate systems; `more.tsx` gates on tier, `home.tsx` gates on the RBAC config. |
| **Session death** | A 401 **with a token present**. Routed through `src/lib/session.ts`, latched so a 6-request fan-out logs out exactly once. A **403 is deliberately not session death** — it means "this role may not do that". |
| **Sent (WhatsApp)** | "This app handed the message to the gateway." It never means delivered or read. |
| **Done (this repo)** | `npx tsc --noEmit` clean + no new lint errors + the affected rows of `TESTING_GUIDE.md` walked by hand. From Phase 2, also `npm test` green. |
| **Spine** | The signature date-column layout (`src/ui/spine.tsx`): `[time gutter][rule + node][content]`. Used by home, calendar, attendance, notifications, reminders, `claim/[id]`, `team/[id]`. |
| **`cgpe-mobile` / `cgpe-api` / `cgpe-admin`** | The three session names used in `../contracts/INBOX.md`. This repo is `cgpe-mobile`. |
| **Read cache (Phase 57a)** | A per-user, versioned AsyncStorage copy of the last SUCCESSFUL list read, keyed `cache.v1.<userId>.<endpointKey>` → `{at,data}`. Served ONLY when a re-fetch fails and an entry exists (the **stale** state). It is **not** `state` (that is unsent user input) and **not** a fallback for a healthy-but-empty read. Excludes client PII + ₹ (row 3). Purged on logout. |
| **Three read states (Phase 57a)** | **live** = fresh fetch; **stale** = re-fetch failed but cache exists → cached rows + a "Synced <time>" chip + the degraded banner still shows; **could-not-load** = re-fetch failed and no cache → empty + banner. Never a fourth state that looks like live data but is stale and unlabelled. |
| **Freshness bus (`src/data/freshness.ts`)** | Sibling to `health.ts`. Records per-endpoint `{stale, syncedAt}` so a screen can render the stale chip without changing any read function's return type. `markFresh`/`markStale`/`useDataFreshness`. |
