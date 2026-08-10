# Project Map — CGPE Connect (Android)

Expo SDK 57 · React Native 0.86 · React 19.2 · expo-router · TypeScript strict.
App version **1.8.0** · package `com.cgpe.connect` · EAS project `6d177f14-d6e3-494a-8ae3-d764332ff256`.

Written 2026-08-10 from a full read of `src/` plus the sibling backend and admin panel.
Every claim here was checked against the code, not inferred from file names.

---

## 1. Where this sits

```
CGPE-CURRENT-PROJECT/
├── ANDROID/                     ← this repo, session `cgpe-mobile`
├── cgpe-backend-main/           ← Express + MongoDB, session `cgpe-api`
├── cgpe-front-main-RECOVERED/   ← React + Vite admin panel, session `cgpe-admin`
├── contracts/                   ← SHARED source of truth (api.md, models.md, enums.md, CHANGELOG.md, INBOX.md)
├── ADMIN_PANEL_SYNC.md          ← prose contract for the server-driven UI + geofence + webhooks
└── ADMIN_PANEL_GUIDE.md         ← prose contract for the panel's Android Application screen
```

The app is **real-backend-only**. `API_BASE_URL` resolves to `https://cgpe.in/internal/api`
on native and on hosted web; `http://localhost:3001/api` only when the web origin is localhost.
So an app path `/leads` is backend `/api/leads`. There is no per-profile override in `eas.json`.

Fabricated sample data was deleted in an earlier phase. `src/data/mock.ts` is `export {}` by policy.
A failed read resolves **empty** and reports to `src/data/health.ts`.

---

## 2. Layers

### 2.1 Entry & navigation

| File | Role |
|---|---|
| `src/app/_layout.tsx` | Provider tree + headerless `<Stack>`. Also mounts `JobPill`, `HealthBanner`, `AppLock`, `Splash`. Line 18's bare `import '@/lib/tracker'` is **load-bearing** — it registers the background GPS task at module scope. |
| `src/app/index.tsx` | 14-line gate. `<Redirect>` to `/(tabs)/home` or `/(auth)/login`. |
| `src/app/(auth)/login.tsx` | The only sign-in surface. Password ⇄ OTP segmented control. |
| `src/app/(tabs)/_layout.tsx` | Custom tab bar, gradient pill. Tabs **hard-coded** in `TAB_META`/`ORDER`. `leads` is registered but hidden from the bar. |

Provider order is load-bearing:
`GestureHandlerRootView > SafeAreaProvider > ThemeProvider > I18nProvider > AuthProvider > AppUiProvider > JobsProvider > ConfirmProvider > ToastProvider > Stack`.
`AppUiProvider` calls `useAuth()`, so it must stay inside `AuthProvider`. `ToastProvider` outside
`ConfirmProvider` makes `useToast()` a silent no-op.

**Route tree** — 46 route files. `/` · `/(auth)/login` · `/(tabs)/{home,tasks,clients,claims,more,leads}`
· flat stack routes `/account /agent-map /agent-track /analytics /attendance /calendar /campaigns
/claim-new /claim/[id] /client/[id] /commissions /contests /families /job/[id] /kb /lead/[id]
/lic-plans /notes /notice-board /notifications /notify /premium /profile /prospects /reminders
/search /segments /settings /task-new /task/[id] /team /team/[id] /tickets /tickets/[id]
/whatsapp /whatsapp/[id]`.

### 2.2 Data layer — `src/data/`

| File | Role |
|---|---|
| `api.ts` **(1744 lines, 56 importers)** | The entire network layer. `req()` wrapper (Bearer token, 4.5 s AbortController), `tryReal` / `tryEnvelope` helpers, `unavailable()` failure path, ~90 exported domain functions. `state` (line 137) is a **write buffer for records the user just typed**, not seed data. |
| `adapt.ts` | Pure Mongo-document → app-type mappers. Claim docs, claim timeline, client segments and lead notes are *synthesised* here from raw fields. |
| `types.ts` | Domain interfaces + `Role = advisor \| learn_advisor \| leader \| admin \| payroll_staff`. |
| `health.ts` | Outage bus `{degraded, failures[], at}`. `reportFailure()` raises the global banner. |
| `labels.ts` | Static display maps: `STAGE_META`, `PRIORITY_TONE`, `CLAIM_STATUS`, `SEG_META`, `REMINDER_ICON`. |
| `tasks.ts` / `team.ts` | Types + label maps. Seed arrays removed; a few orphaned helpers remain. |
| `mock.ts` | **Dead by policy** — `export {}`. Do not repopulate. |

`unavailable(endpoint, value)` and `tryReal`/`tryEnvelope` are both sanctioned failure paths since
**Phase 3** — the helpers now report too, and classify first: 401/403/404/501 are answers rather
than faults and stay quiet, while a 200 with an unusable body is reported. The two meet on one
string via `healthKey()`, so one broken endpoint is one banner row. A `suppressed` set carries the
"this was an answer" verdict from the helper to `unavailable`, which would otherwise re-report it.

### 2.3 State — `src/store/`

| File | Role |
|---|---|
| `auth.tsx` | Token lifecycle. Persists `cgpe.token` / `cgpe.user` / `cgpe.biometric` via `@/lib/storage`. Subscribes to `onSessionExpired`. Re-seals the biometric identity binding on every sign-in. |
| `appUi.tsx` | Server-driven UI. Fetches `GET /rbac/app-ui`, normalises untrusted JSON, exposes `{config, ready, refresh, isVisible, widgets, can, usingFallback}`. **Fails open** to `DEFAULT_UI` (everything visible). |
| `roles.ts` | Client-side tier model, separate from the RBAC config. `tierOf()` → `master \| admin \| team`; `capabilitiesOf()` → 7 booleans. |
| `jobs.tsx` | In-memory campaign runner (max 10 jobs, never persisted). Backs `/job/[id]` and `JobPill`. |

### 2.4 UI system — `src/ui/` and `src/theme/`

`theme/theme.tsx` is the design-system source of truth: `light`/`dark` palettes, `ThemeProvider`,
`type()`/`tnum`/`eyebrow`, and the spacing/radius/font/motion scales + `shadow()`.
`theme/fonts.ts` bundles six Geist cuts and never blocks boot.

`base.tsx` (layout+text) · `controls.tsx` (Button/IconBtn/Fab/Chips/Segmented/Stepper/SearchBar/Field)
· `data.tsx` (Pill/StatCard/Sparkline/MetricTile/DataRow/ListSection/KpiStrip/ActionTile)
· `feedback.tsx` (Loader/Skeleton/EmptyState/ProgressBar/Meter/Banner/Toast)
· `sheet.tsx` (the app's only modal surface) · `motion.tsx` · `spine.tsx` (the date-spine signature layout)
· `swipe.tsx` · `identity.tsx` · `Confirm.tsx` · `JobPill.tsx` · `health-banner.tsx` · `AppLock.tsx`
· `Splash.tsx` · `LeafletMap.tsx` (1031 lines of hand-written HTML/JS in a WebView).

**Dead — do not maintain:** `ui/kit.tsx` (zero importers despite its docstring), `ui/characters.tsx`,
`hooks/use-theme.ts`, `hooks/use-color-scheme.ts(.web.ts)`, `constants/theme.ts`, `src/global.css`.

### 2.5 Native & utilities — `src/lib/`

| File | Role |
|---|---|
| `tracker.ts` | Background field-route recorder. Defines the expo-task-manager task at **module scope**, buffers fixes in SecureStore, uploads batches to `/time-tracker/track/points`. Duplicates `TOKEN_KEY` from `store/auth.tsx` on purpose (importing the store into a headless context would pull React in). |
| `biometricIdentity.ts` | Seals `(userId, token)` behind SecureStore `requireAuthentication:true` + an AsyncStorage install marker (defeats iOS keychain-survives-uninstall). Only the **write** half is wired up. |
| `format.ts` | India/LIC formatting — `inr`, `inrShort` (K/L/Cr), dates, `initials`, `greeting`. Every intra-value space is U+00A0. |
| `messages.ts` | WhatsApp copy templates, ported from backend `services/greetingEngine.js`. |
| `haptics.ts` · `actions.ts` · `session.ts` · `storage.ts` | Semantic haptics · deep-link helpers · session-death event bus · cross-platform KV. |

### 2.6 i18n

`src/i18n/index.tsx` — the whole system in one file: **5 dictionaries × 74 flat keys**
(English, ગુજરાતી, हिन्दी, Hinglish, Roman Gujarati), per-user persistence, `refreshI18nUser()` bus.
Language is a per-user setting and is **not** part of the role document.

---

## 3. Screens (47) and what they call

| Screen | Backing calls |
|---|---|
| `(tabs)/home.tsx` **(1915 lines)** | The **only** consumer of `useAppUi()`. Config-driven ordered widget list, GPS clock-in/out hero, KPI strip, quick actions. 3.5 s fail-open config timeout. |
| `(tabs)/leads.tsx` · `lead/[id].tsx` | `getLeads` / `getLead` / `addLead` / `setLeadStage`. A stage write is believed only when the server's own reply carries the new value; since Phase 4 that reply is the `PUT`'s `{ new: true }` document, not a second `GET`. Stage values are `Lead.status` verbatim — `contracts/enums.md:212`, and `enums.md` §15 lists three other lead vocabularies that must not be merged with it. |
| `(tabs)/clients.tsx` · `client/[id].tsx` | Server-paginated 100/page + debounced server search; segment filters applied client-side over loaded pages only. |
| `(tabs)/claims.tsx` · `claim/[id].tsx` · `claim-new.tsx` | Register (limit 500) + summary. Status-advance is deliberately **disabled** — no endpoint exists. |
| `(tabs)/tasks.tsx` · `task/[id].tsx` · `task-new.tsx` | 5 exclusive filter views, optimistic complete/reopen with per-row rollback. Exports `TaskCard` and `dueBucket`. |
| `(tabs)/more.tsx` | The real role-gating surface — builds its groups from `capabilitiesOf()`. Hard-coded; does **not** read `nav.more_sections`. |
| `analytics.tsx` | `getClientStats` + `getCampaignSummary`. Deltas compare against the previous in-session reading — no server history exists. |
| `campaigns.tsx` · `premium.tsx` | Bulk WhatsApp over 4 occasions. Sends go through `useJobs().startCampaign`, not a direct call. |
| `segments.tsx` · `families.tsx` · `prospects.tsx` | `/clients/segments`, `/families`, `/recruitment-prospects`. Prospects resolves every field through `pick(doc, CANDIDATE_KEYS)` — the collection is schema-less. |
| `search.tsx` | 5 collections, hand-written 3-tier fuzzy scorer. Clients+tickets server-side; leads/claims/tasks bulk-pulled and matched locally, cached as an in-flight promise for 90 s. |
| `notes.tsx` | Private board over `/notice-board` CRUD. Renders voice-note provenance (Gujarati transcript disclosure). |
| `kb.tsx` · `lic-plans.tsx` · `contests.tsx` · `commissions.tsx` | `/insurance-kb`, `/lic-plans`, `/contests`, `/commissions`. |
| `attendance.tsx` · `calendar.tsx` · `reminders.tsx` | Date-spine views. Attendance's "Today" card reads AsyncStorage `clock.<toDateString()>` written by home. |
| `agent-map.tsx` · `agent-track.tsx` | LeafletMap pins / GPS replay. `agent-track` is master-only. |
| `notifications.tsx` · `notify.tsx` · `notice-board.tsx` | Feed · admin dispatch · read-only company bulletin. |
| `tickets/index.tsx` · `tickets/[id].tsx` | Fully server-side pagination/search/facets. No write is painted optimistically. |
| `whatsapp/index.tsx` · `whatsapp/[id].tsx` | Thread inbox + conversation. Outbox reconciles against the server echo **by text, counted**. |
| `team/index.tsx` · `team/[id].tsx` · `screens/dashboards.tsx` | Roster · member · presentational Admin/Master dashboards (zero API calls — all props from home). |
| `settings.tsx` · `account.tsx` · `profile.tsx` · `job/[id].tsx` | Preferences · DPDP/deletion · read-only profile · campaign monitor. |

---

## 4. The server-driven UI contract

`GET /api/rbac/app-ui` returns the caller's resolved layout, fetched on **every cold start**.
Role resolution: `department` if `sales`/`operations`, else `role`.

- 20 known widget keys, 4 hero modes, 14 feature flags. Array order **is** render order.
- Mandatory widgets are re-asserted server-side on read *and* write —
  sales: `my_tasks prospects leads_pipeline personal_notes`;
  operations: `my_tasks claim_requests personal_notes issue_logs`.
- Fail-open is contractual: a 404/500/timeout falls back to `DEFAULT_UI` (full menu, every capability on).
- **`home.tsx` reads exactly 4 flags:** `can_clock_in`, `can_create_task`, `can_view_team_roster`,
  `can_view_org_analytics`. The other ten gate controls on other screens.
- **`nav.tabs`, `nav.hidden` and `nav.more_sections` are inert.** The server stores and serves them
  correctly; no screen consumes them. This is the documented known gap (`ADMIN_PANEL_SYNC.md` §9)
  and is Phase 9 here.

`ui_rbac_config.json` at the repo root is **not imported by any TypeScript file** — it is the
checked-in JSON-Schema contract for the panel. `appUi.tsx`'s `SCHEMA_FEATURE_DEFAULTS` mirrors it
**by hand** and will drift silently.

---

## 5. Known-bad, mapped

Full detail and ownership in `docs/PHASES.md`. Summary of what is broken **today**:

| Area | Symptom |
|---|---|
| Write-path honesty | `deleteAccount`, `clockIn`, `clockOut`, `updateTaskStatus`, `toggleTaskStep` all resolve success on failure. Screens fire success haptics and navigate away. Several carefully-written error branches are unreachable. |
| Leads | **Fixed in Phase 4** (2026-08-10, `5c08872`). The app now uses `Lead.status`'s five enforced values, sends `{ status }` on `PUT`, unwraps `data.lead` on `GET /:id` and `POST`, and takes the write's own reply as the confirmation. Still open by choice: `/leads/:id/notes` and `/timeline` have no caller (notes are synthesised from the free-text `notes` string), the list ignores `data.pagination` above 500 leads, and a `requireModule('sales')` 403 renders as "No leads in your pipeline yet" rather than "your department has no access" — the RBAC denial body has no `error` key. |
| WhatsApp | `POST /whatsapp/hub/send` sends `message` (server reads `text`) with a phone resolved from an always-empty buffer. Every send is dropped, UI shows "sent". |
| Commissions / LIC plans | Envelope shape mismatches — both screens can never show real data even against a healthy backend. |
| Health channel | **Fixed in Phase 3** (2026-08-10, `e0b0b2c`). One gap remains: `src/screens/dashboards.tsx:292-297` still renders `snapshot?.total_clients ?? 0` on the Master KPI tiles, so a *partial* outage shows "0 clients · ₹0 claims paid" as fact. The hero at `:266` already uses `NO_VALUE`. |
| Geofence | Falls back to hardcoded Surat coords with `enforce: true`, `radius_m: 2000`, cached for the session. Per `contracts/INBOX.md` D10 the real server fence is up to **300 m**, not 200 m. |
| Tracking | Per `contracts/INBOX.md` D5, `/track/points` reads `session_id`, not `sessionId`. |
| Tests | **Phase 2 added Vitest**, **Phase 3 took it to 164**, **Phase 4 to 188** over 7 files (2026-08-10): `adapt.ts`, `distanceMeters`/`checkGeofence`, `scanRenewals`, `taskProgress`, `normalizeUiConfig`, the whole data-health channel, and now the leads **wire contract** — `api-leads.test.ts` asserts the request bodies and response envelopes against `contracts/api.md:366-370`, which is the only kind of test that could have caught Phase 4's defects. `npm test` is a second green gate alongside `npx tsc --noEmit`. Everything else — every screen, every provider, most write paths — still has zero coverage. |
