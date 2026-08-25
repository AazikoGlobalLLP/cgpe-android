# Decisions — CGPE Connect (Android)

Append-only. Newest first. One entry per decision that a future session would otherwise re-litigate.

Format: `## YYYY-MM-DD — <decision>` / **Context** / **Decision** / **Consequence**.

---

## 2026-08-25 — Backlog Point 13: Payroll shows only one member = a data-seeding gap, not a bug

**Context.** Owner reported that inside Payroll only one member ("Pavitra") appears, and asked to work
out why everyone isn't showing, then show each person's pay per their work + bank/essential details +
a "data pending" warning. Verified against real code: `GET /api/payroll/compute` iterates **only
`PayrollProfile` documents** (`routes/payroll.js:327`), so a member shows only if an admin created a
payroll profile (salary + segment) for them. Attendance/work is read live for everyone, but pay =
work × rate, and the rate lives on the profile — so a profile-less member has genuinely nothing to
compute. Bank/Aadhaar/PAN exist on `PayrollProfile` and are reachable via the admin-only
`/payroll/profiles/:userId`, but are deliberately kept off the phone today (`payroll.tsx:29-31`).

**Decision.** Recorded as **backlog Point 13** (triage only — describe, don't build this session). Root
cause = an **unseeded data job** (only one `payroll_profiles` row exists), analogous to Point 6's
unseeded RBAC. The fix has three owned parts: `[ops-data]` create profiles for the rest of the team (the
real unblock); `[decision]` whether to put bank/essential PII on the phone and how (recommend
super_admin/master only, account masked to last-4, Aadhaar/PAN off entirely); `[m]` merge the compute
roster with the full staff directory (`getAssignableTeam`) so every member shows and profile-less ones
render as a "Payroll data pending" warning, plus a bank/essential-details panel on the detail screen.

**Consequence.** No code shipped for Point 13. Putting bank/essential details on the phone **reverses**
the standing "NO PII ON THE PHONE" rule, so it must wait on the owner's role/masking decision. The
client roster-merge + pending-warning half is OTA-buildable now and does not conjure salaries that were
never entered — until the profiles are seeded, the rest of the team correctly reads as "data pending."

---

## 2026-08-25 — Band 2 #9: Contest mapper — a dedicated adapter, rank only when known

**Context.** Owner backlog Point 7 flagged the Contest surface as broken. Verified: `getContests` read
`GET /api/contests` straight into `Contest[]` with only an `isArray` check — no adapter. The wire rows
are raw contest documents (`title`/`reward_description`/`target_goal`/`target_unit`/`end_date` +
per-caller `user_progress` + top-5 `leaderboard`), none of whose field names match the app's `Contest`
shape, so every field mapped to `undefined` and any real contest rendered as a blank card. Latent —
no live contest has been created yet.

**Decision.** Added a pure `adaptContest(raw, userId?)` (`src/data/adapt.ts`), wired into `getContests`
with the existing `unavailable()` outage fallback. `progress = clamp01(user_progress / target_goal)`
(0/missing target → 0, never NaN/Infinity); `metric = "<progress> of <target> <unit>"` (unit defaults
to `points`); `rank` set **only** when the signed-in `currentUserId` appears in the leaderboard — never
inferred from a progress tie. Verified the mapping against deployed `origin/main` `49482e9` (route +
model byte-identical). +8 tests.

**Consequence.** A real contest now renders fully. An absent rank is honest silence, not a fabricated
`#0`. `contests.tsx` was already a correct `Contest` consumer and stayed untouched. Commit `9793327`,
pushed `aaziko Shivam`. tsc 0 / npm test 910 / eslint 0 new. Device-unverified (no live contest to see).

---

## 2026-08-24 — Band 2 #2: Tasks-tab local search + the search scorer extracted to `lib/searchScore.ts`

**Context.** Owner backlog Point 2: the Tasks tab had no search box, forcing a trip to the global
Search screen to find a task even though the whole list is already on the handset. The global search's
typo-/word-order-/phone-tail-tolerant scorer lived inline in `src/app/search.tsx` (a screen component),
untested except via the `fuzzyMatch` leaf.

**Decision.**
- Extracted the scorer VERBATIM into a new pure `src/lib/searchScore.ts` (`buildQuery`/`tierFor`/
  `bestHit`/`matchesFields`/`rank` + tier/weight consts + `Q`/`Field`/`Hit`/`Ranked` types). It imports
  ONLY `@/lib/fuzzyMatch`, so it stays a native-free leaf reachable from the Vitest graph without a stub.
  The per-domain field lists (`clientFields`/`taskSearchFields`/…) stay with their owners — `searchScore`
  scores weighted `Field`s and knows no domain types.
- `taskSearchFields` (a task's searchable columns, weighted) lives in `data/tasks.ts` and is imported by
  BOTH `search.tsx` and the Tasks tab — one definition of "how a task is searched", so the two can't drift.
- The Tasks local filter (`searchTasks`) is a pure `list.filter(matchesFields)`: blank query returns the
  list unchanged by reference, it PRESERVES input order (the tab re-sorts with `sortTasks`), and it is
  UNCAPPED — unlike the global search's `rank()` which sorts by score and slices to `GROUP_CAP=20`. Capping
  would hide matching tasks, which is wrong for "find a task".
- New UI sentences are hardcoded English; the placeholder reuses the already-translated `t('common.search')`.
  No new i18n key was added, so no 5-language copy is owed (matches all-English `search.tsx` + the report fix).
- After implementing, ran a 10-agent adversarial review workflow (`band2-2-search-review`). Its parity pass
  was clean; it CAUGHT a real major bug and it was fixed before commit: the results ScrollView had no
  `keyboardShouldPersistTaps`, so with the SearchBar keeping the keyboard up, the first tap on every result
  was swallowed to dismiss the keyboard (the two-tap "feels broken" bug). Fixed to `"handled"` +
  `keyboardDismissMode="on-drag"`, matching `search.tsx`. Also hardened three test gaps the review confirmed.

**Consequence.** Commit `c47be1b`, pushed `aaziko/Shivam`. tsc 0 / npm test 863 (+34) / eslint 0 new.
OTA-eligible, device-unverified. INBOX untouched — additive client behaviour, no contract change. The TRUE
word-order fix for tickets/clients server search is still the `[api]` tokenize relay (owner-owned, same owed
ask as D5); this local filter only narrows the already-loaded list — do not over-promise it.

---

## 2026-08-22 — Phase 77: sign-in distinguishes a TIMEOUT from an unreachable server

**Context.** The Phase 76 network diagnosis proved the "can't reach server" complaint was an
IPv6/NAT64-MTU stall: the app opens a real TCP+TLS socket to `cgpe.in` and sends its request, but the
reply is dropped on the reduced-MTU path, so OUR `AbortController` fires at `LOGIN_TIMEOUT`. The app
then showed *"Could not reach the CGPE server. Check your connection"* — the wrong instruction, since
the connection is up. Handoff flagged this honesty fix as "offered, not built."

**Decision.**
- **A timeout is not "unreachable," and the two are worded oppositely.** `api.ts`'s `NetworkError`
  now carries `readonly kind: 'timeout' | 'network'`. A fired abort (or an error message naming a
  timeout) → `'timeout'` (*"The CGPE server is taking too long to respond…"*, clock icon, Try again);
  anything else `fetch` throws → `'network'` (the existing reach-copy). Classified via a new
  `unreachableKind(e)` at the three auth throw sites (`login`/`sendOtp`/`verifyOtp`). The login screen
  (`Failure` kind widened to include `'timeout'`) renders the offline-toned banner for both but with a
  distinct timeout title/icon and NEVER "check your connection" on a timeout.
- **Scope limited to the auth screen on purpose.** `<HealthBanner/>` already split the three
  `FailureKind`s since Phase 55; the only place still lying was the LOGIN screen, which is where the
  owner actually saw the misleading copy. Data-read paths untouched. `[m]` only, no contract change.

**Consequence.** A slow/stalled sign-in reads honestly; the user is not sent to fix a working
connection. +6 tests (`api-login-failure.test.ts`), suite 772→778. Commit `5960677`, pushed
`aaziko/Shivam`. OTA-eligible (JS only) — rides the next APK/OTA, not yet in a build; device-unverified
(needs a real degraded-path sign-in to see the banner).

## 2026-08-21 — Phase 74: Android push enablement + launcher-icon fit + owner-backlog triage

**Context.** Owner created a Firebase project for `com.cgpe.connect` and added `google-services.json`, wanting real
team push (Phase 72 mobile was already built). Owner also cannot get a paid Apple account, reported a mis-fitting
launcher icon, and dictated a large walkthrough backlog asking for a mobile-vs-backend triage + `/handoff`.

**Decision.**
- **Wired `android.googleServicesFile` + cut a push-enabled APK** (`0d68ac07`, git `ce9b1e6`). The FCM transport is
  Firebase FCM V1 (Expo's path). The credential Expo needs is the **SERVICE ACCOUNT JSON** (Firebase → Service accounts →
  Generate new private key), NOT the **Web Push/VAPID** key the owner first copied; the Legacy Cloud Messaging API stays
  disabled. Delivery stays dormant until that JSON is uploaded to EAS.
- **FCM upload is an owner interactive step.** `eas credentials` is menu-only (no non-interactive flag) and this session's
  stdin is EOF, so I cannot run it; but the EAS CLI is already authed as `shivam-bhadoriya`, so the owner needs no
  expo.dev login/email — `npx eas-cli credentials -p android` in a real terminal, point at the JSON. (Owner hit a Windows
  single-keypress "Press any key" quirk → retry in PowerShell, or verify by install+login+create-task instead.)
- **Secured the service-account key** via `.gitignore` (`*-firebase-adminsdk-*.json`); it is a real secret and must only
  live in EAS credentials, never a commit. `google-services.json` (client config) IS committed — safe, ships in every APK.
- **Fixed the launcher icon by padding into the adaptive safe zone.** The adaptive foreground was the raw 827×975 logo
  used edge-to-edge, so every launcher mask cropped it. New `android-icon-cgpe-foreground.png` = 1024² transparent with the
  logo at the central ~60%; new `android-icon-cgpe.png` = 1024² square white main icon. Rides the next build (commit
  `5c8ac46`). Generated with jimp in the scratchpad (no ImageMagick/sharp present; project deps untouched).
- **Apple account reversal recorded** (owner CANNOT buy it): no cable-free/permanent/TestFlight/App-Store/iOS-push path
  exists without the paid $99/yr program; the only free route is a Mac + free Apple ID + cabled `expo run:ios --device`
  (7-day expiry, ≤3 apps, no push). For a whole team of iPhones there is no free scalable option — this is an Apple wall.
- **Triaged the owner backlog rather than building it** (owner's explicit instruction). Full split in
  `docs/OWNER-BACKLOG-2026-08-21.md` (~18 items, `[m]`/`[api]`/`[admin]`/`[data-ops]`).

**Consequence.** Android push is one owner step (FCM upload) + one clean rebuild away from live. The icon fix is in code
for the next build. The backlog is a durable, classified worklist; backend/data/OPS parts are filed to `contracts/INBOX.md`
for the owner to relay. Nothing from the backlog is built yet; several items need an owner spec-lock first.

## 2026-08-20 — Phase 56: iOS enablement (editor-side prep + account-free compile proof)

**Context.** The app always *targeted* iOS (`ios.bundleIdentifier` set, permission strings via config plugins) but was
**never built for it** — `eas.json` had no `ios` profile, and iOS signing needs Apple credentials EAS lacks. Owner made iOS
mandatory and (2026-08-20) chose this phase and confirmed they will buy the Apple Developer account. CNG project (no `ios/` dir).

**Decision.**
- **Added an `ios-simulator` EAS profile as the account-free compile proof.** A simulator build (`ios.simulator:true`,
  `distribution:internal`) needs no Apple account or signing (SDK-57 build-reference), so the full native iOS target could be
  built and verified BEFORE any spend. It ran green: build `9649bf51-ca6e-4359-90a8-d3b4c5a80f30`, SDK 57.0.0, git `49bb951`,
  status FINISHED. `preview` (Android APK / iOS ad-hoc) and `production` (TestFlight/App Store) are left ready for when
  credentials exist.
- **`ios.config.usesNonExemptEncryption:false`** — factually correct (the app is HTTPS/TLS-only, the Apple "exempt" case),
  not a guess; it removes the manual export-compliance prompt on every TestFlight upload. Confirmed present as
  `ITSAppUsesNonExemptEncryption` in the introspected config.
- **Regenerated the iOS app icon** rather than reuse an existing asset. `ios.icon` was `./assets/expo.icon` (the Expo default
  grid — wrong brand); `cgpe-logo.png` is 827×975 + alpha (invalid iOS icon: must be square, opaque); `icon.png` is 1024² but
  the Expo default art. New `assets/images/ios-icon.png` = the CGPE brand mark composited on the already-written-down
  `#ffffff` (Android adaptive-icon background), 1024² opaque. Grounded (no invented colour), reversible, new file only.
- **Did NOT hand-add iOS `UIBackgroundModes` / `BGTaskSchedulerPermittedIdentifiers`** — the `expo-background-task` plugin
  injects them via CNG prebuild (verified via `npx expo config --type introspect`). Hand-adding would duplicate/drift.
- **Documented the honest iOS 24/7 limit** (do NOT promise Android parity): iOS records the on-duty route while
  alive/backgrounded ('Always'), but background updates stop after a **force-quit** and recording stays off after a **reboot**
  until the app is reopened; the watchdog is opportunistic (`BGTaskScheduler`, not WorkManager's ~15-min cadence). The
  Simulator cannot run Background Tasks at all. `tracker.ts` is built around Android's foreground service, which iOS ignores.

**Consequence.** The iOS build is proven to compile from committed code; the only remaining iOS work is owner-gated on the
Apple Developer account, after which a TestFlight/ad-hoc build + on-device verification follows `docs/spec/PHASE-56.md` §4.
No contract change; no sibling session affected. Validation gate for config-only phases like this is `expo config --type
introspect` + an EAS build — the three code gates (`tsc`/`npm test`/eslint) are unaffected because no `src/` changed.

## 2026-08-20 — Phase 57 finished: Lead-create wired into the offline write queue

**Context.** With Notes and Task-create queued, Lead-create (`addLead`) was the last additive create still un-queued. On a
network throw `addLead` held the typed lead only in the ephemeral in-memory `state.leads` buffer — an app kill lost it, and
the Add-lead sheet told the user to "pull to refresh and check," implying manual re-entry.

**Decision.**
- **`addLead` was NOT rewritten to the 4-outcome `status` union** that `addTask`/`addNote` use. It keeps its existing
  3-outcome `AddLeadResult` (`ok:true` / `reason:'invalid'` / a held `reason`). Only the **network-throw** branch was rewired
  to enqueue a **persistent** `'lead'` draft (returned as `reason:'network'`, `lead.pending:true`) instead of the in-memory
  buffer. Rationale: minimal, preserves the pinned wire contract in `api-leads.test.ts`, avoids a ripple through the richer
  Add-lead sheet. The queue is still fully kind-generic (`'lead'` added to `QueueKind`/`KINDS`).
- **Only a genuine throw enqueues.** A `server` answer (5xx / 2xx-without-a-lead) stays in the ephemeral buffer (NOT queued —
  the server answered and refused, so an automatic retry is wrong); 400/403/404/501 are never held at all (spec row 9).
- **The stored payload IS the exact `/leads` request body** (schema field names), resolved once at enqueue time, so
  `replayWrite('lead')` POSTs it byte-identically (like the Notes branch); `leadDraftToLead()` reads it back for display.
- **A successfully-queued lead does NOT raise the global outage banner on its own** — unlike the pre-57 `addLead`, which
  reported `/leads` on every network throw. This matches the Notes/Tasks queue paths: the "saved on this device" toast is the
  per-write signal, and a concurrent failed read still raises the banner honestly. The unqueueable no-user throw still reports.
- **Pending lead drafts are pinned above the pipeline as bordered "Pending sync" cards, inert** (not tappable, no swipe) until
  they flush, and are excluded from the pipeline counts/meter (which must reflect only server-confirmed leads).

**Consequence.** Phase 57 offline support is complete — every additive create the app has (Notes, Tasks, Leads) survives an
app kill and auto-syncs on reconnect. Gates `tsc` 0 · `npm test` 763 (+8) · eslint 0 new. `[m]`-only, no contract change,
JS-only (OTA-eligible), device-unverified. New English strings ("Pending sync", the queued toast, the drop notice) owe
5-language human copy. Commit `00aee55`, pushed `aaziko/Shivam`.

---

## 2026-08-20 — Phase 57b finished: Task-create wired into the offline write queue

**Context.** 57b shipped the write queue for Notes only; Task-create (`addTask`) was the documented remaining piece.
`addTask` still returned the always-looks-saved `Task & {forbidden?}` and, on a network throw or a non-403 refusal,
fell through to a local buffer and reported success — the exact dishonesty 57b exists to remove, for the app's main
data-entry screen.

**Decision.**
- **`addTask` returns a FOUR-outcome `AddTaskResult`** (`saved`/`queued`/`forbidden`/`failed`), mirroring `AddNoteResult`
  but with `forbidden` split out because a 403 is an explainable role condition, not a transient error. Only a **network
  throw** enqueues; **no refusal (403 or otherwise) is ever queued** (replaying a rejected write is wrong).
- **A shared `taskCreateBody()` builds the `/team/tasks` POST for both the first attempt and the offline replay**, resolved
  ONCE at enqueue time — so a replay hours later sends a byte-identical body and can't re-derive a changed assignee.
- **A 200 without a server id is a refusal (drop), not a success** — mirrors the Notes replay's `success:false` guard.
- **Pending task drafts are pinned as a SEPARATE section on the Tasks tab, not merged into the filtered list** — so a
  not-yet-on-server draft cannot distort the hero "today" progress or the overdue/upcoming counts, which must reflect only
  confirmed tasks. Each pending card is inert (no swipe / complete / tap) with a "Pending sync" badge until it flushes; a
  reconcile-on-flush effect refetches when the queue shrinks so the synced task lands as a confirmed row.
- **Deliberate scope: creates only.** Leads-create is the only additive create still unqueued (optional; not in the
  owner's acceptance criteria). Same kind-generic mechanism if wanted.

**Consequence.** Phase 57 offline support is fully built (57a + 57b Notes + 57b Task-create). `addTask`'s return type
changed from `Task & {forbidden?}` to `AddTaskResult`; its one caller (`task-new.tsx`) was updated. `state.tasks.unshift`
no longer runs on the real-session failure path (it was part of the lie); the FORCE_DEMO path keeps it. Gates `tsc` 0 ·
`npm test` 755 (+8) · eslint 0 new. Commit `eb81a04`, pushed `aaziko/Shivam`. Device-unverified; new English strings owe
5-language copy. No contract change.

## 2026-08-20 — Phase 57 built (offline support: read cache 57a + safe write queue 57b, Notes)

**Context.** With Phase 72 re-verified still blocked (prod `/push/register` → 404, push code uncommitted in
`../cgpe-backend-main`, FCM unset), the owner chose **Phase 57 (offline support)** — an XL, design-first feature
with undefined scope. Spec-locked via a decision table (`docs/spec/PHASE-57.md`) and owner-approved (`go`).

**Decision.**
- **Cache OPERATIONAL lists only (Tasks/Reminders/Notifications/Leads); EXCLUDE client-book PII + ₹** (Clients/Claims
  stay online-only). DPDP: no sensitive plaintext at rest in AsyncStorage. Per-user, versioned (`cache.v1.<uid>.<key>`),
  purged on sign-out.
- **Three read states** — live / stale (cache shown + "Synced <time>" chip + degraded banner) / could-not-load
  (empty + banner, zero fabricated rows). Served ONLY when a re-fetch fails and a cache entry exists.
- **Write queue (57b): enqueue ONLY on a network throw**; a server ANSWER that refuses (4xx/5xx) is `failed`, never
  queued. Flush replays: 2xx→sync, 4xx/attempt-cap→drop+notice, 5xx/network→keep. Reconnect = **next-success +
  foreground** (JS-only, OTA — no NetInfo). Queue **persists across logout** (per-user); read cache does not.
- **57b wired for NOTES only** — the mechanism is kind-generic (`QueueKind`) but all 5 acceptance criteria are Notes,
  so wiring one screen bounds the risk. **Task-create is the documented remaining 57b piece.**
- **Pure seams (`lib/offlineCache.ts`, `lib/writeQueue.ts`) fully unit-tested; device I/O (`data/offlineStore.ts`)
  split out** because the Vitest AsyncStorage stub is a no-op — the same discipline as `netResilience`/`staleBuffer`.
- **New on-screen English strings ship as English** and owe 5-language HUMAN copy before becoming i18n keys
  (`common.lastSynced` etc.) — machine translation forbidden, and a fake-translated key passes the parity test dishonestly.

**Consequence.** 57a `20eb4ed`, 57b `e318e06`, both on `aaziko/Shivam`. Gates `tsc` 0 · `npm test` 747 (+18) · eslint 0
new. JS-only / OTA-eligible → does NOT ride the pending native APK. Device-unverified (AsyncStorage round-trip is
device-only). Remaining: Task-create wiring; 5-lang copy; a device pass (create offline → badge → reconnect → syncs).

## 2026-08-20 — Phase 55 built (network resilience); retry lives in `req()` for idempotent reads, 501 excluded

**Context.** Owner re-confirmed Phase 72 (team push) is blocked on the backend + Firebase (re-verified prod
`/push/register` → 404, push code uncommitted in `../cgpe-backend-main`), and chose to build **Phase 55**
instead — the "app doesn't work on my WiFi / this phone" complaint. Spec `docs/spec/ISSUES-2026-08-18.md`
§55 gave ranges, not exact numbers. Owner locked (AskUserQuestion) the **"Balanced"** preset and the **full**
scope (Test-connection button + kind-aware banner).

**Decision.**
- **Numbers (owner-locked):** read timeout 4.5 s → **12 s**, login/OTP **15 s**, upload **30 s**, **1** retry
  with **600 ms** exponential backoff. All in `src/constants/config.ts`. The exact seconds were a judgement
  call (no p95 measurement of the failing networks exists).
- **Retry belongs in `req()` and fires for IDEMPOTENT reads only** (a bare `req()` is a GET; every write
  passes a method), and only on a throw (network / our abort) or a transient status. Writes/uploads get one
  attempt so a clock-in / WhatsApp send / file upload can never double-fire.
- **501 is EXCLUDED from `isRetryableStatus`** despite being a 5xx: this backend uses 501 as the "endpoint
  not on the deployed build" signal, which `reportIfOutage` already treats as a quiet ANSWER (like 404).
  Retrying it is pointless and breaks the quiet-answer contract. This was surfaced by two existing tests
  (`api-break`, `api-live-locations`) going red — a real correctness find, not a test tweak.
- **A kind-less `reportFailure(endpoint)` PRESERVES the last `FailureKind`** rather than nulling it, because
  the common read path reports the same endpoint twice (`tryReal` with a kind, then the generic
  `unavailable` without one). Kinds only ever come from the classifiers, so preserving can never introduce a
  wrong one; it is cleared only when the failure list empties.
- **`uploadFile` gains an AbortController** (it had none — hung forever). **`testConnection()`** pings the
  unauthenticated `/health` with NO retry (a diagnostic reports the first result honestly) and drives a
  Settings "Test connection" verdict.

**Consequence.** `tsc` 0 · `npm test` **714** (+24) · eslint 0 new. Commit `941c583`, pushed `aaziko/Shivam`.
Pure `[m]`, no contract change. **Two costs, accepted:** (1) the suite's wall-time rose ~0.6 s → ~4 s because
real-timer api tests that exercise a retryable GET failure now each pay one real 600 ms backoff — a future
cleanup could fake-timer those files; (2) a handful of new on-screen English strings owe 5-language human
copy. **Device-unverified** (JS-only, rides the pending native batch APK). Full spec: `docs/spec/PHASE-55.md`.

## 2026-08-20 — Phase 65 built (full-staff monitor roster / map from `/live-locations`); Phase 72 "backend done" signal verified PREMATURE

**Context.** Owner said "wait, look at this — backend finished the task" (Phase 72 push). Per the standing
deploy-gap rule ("backend shipped ≠ live"), verified before acting: cgpe-api DID build it (INBOX Phase-72
`[x]`, their Phase 76/D-102) and the code exists in `../cgpe-backend-main`, but it is **uncommitted**
(`?? routes/push.js` / `models/PushToken.js` / `services/push.js`; ` M utils/notify.js` / `routes/tasks.js`),
**not on `origin/main`** (tip `2531817` = Phase 69), and prod `/push/register` + `/unregister` return **404**
(health 200). Firebase/FCM (hard prereq) also unset. Owner then chose (option a) to keep Phase 72 pending and
**build Phase 65** instead — the one un-built mobile piece from the 63–69 batch.

**Decision.** Phase 65: source the master's roster/map universe from the now-deployed, super_admin-gated
`GET /time-tracker/live-locations` (iterates every profile) instead of `/team/task-overview` (grouped by
`team_tasks` assignee → members with no task vanished), left-joined with the task-overview stats. **Join key
is the normalized NAME, not an id** — `/live-locations` keys people by `profile._id` (24-hex) while
task-overview keys by the `user_id` field (`user_...`); the id spaces never match, and `/profiles/:id` accepts
both types so a roster row carrying the `_id` still navigates. Verified `/live-locations` is deployed +
gated (live probe 401) + carries the Phase-69 ObjectId fix, BEFORE building. Pure logic in a new tested
`src/data/roster.ts` (`mergeRoster`/`liveOnDutyPins`); `api.getLiveLocations` is quiet-on-403/404 like
`getBreakLocations`; master paths in `getTeam`/`getAgentLocations`; non-masters (403 → []) keep the exact
old path. No screen change. Owner decision on the spec's open Q: show EVERY active staff member (greyed
off-duty), not only ever-located ones — the complaint mandates it.

**Consequence.** A staff member with zero team-tasks now appears on Monitor + the map (off-duty/zeroed)
instead of vanishing. Gates: `tsc` 0 · `npm test` **690** (+21) · eslint 0 new. Commit `0c4fde1`, pushed
`aaziko/Shivam`. Two honest limits (in `docs/spec/PHASE-65.md`): the map now shows "who's out RIGHT NOW"
(drops clocked-out-earlier-today grey pins when anyone is on duty — no coord for off-duty in the payload),
and `/live-locations` (`.find({})`, no `is_active`) could surface a deactivated account → optional `[api]`
follow-up (add `is_active`), not filed. Phase 72 stays PENDING; do NOT cut the APK until prod probes 401 and
Firebase is configured.

## 2026-08-20 — Phase 73 built (auto-sync assigned tasks/reminders to the phone calendar — Option B)

**Context.** Owner batch #4. Owner chose **Option B (auto-add on assign)** over the simpler one-click export. Pure client
`[m]` — no `[api]` (the member's own app already holds their own tasks via `getTasks(true)` + `getReminders()`); needs
`expo-calendar` (not previously installed) → a native APK rebuild.

**Decision.** Installed `expo-calendar@~57.0.2`. The idempotency logic — the one thing that MUST be right, or every refresh
duplicates events — is a PURE, tested `src/lib/calendarSync.ts` (`buildSyncItems` skips undated + completed items,
`planSync(desired, map)` computes create/update/delete against a persisted `key → {eventId, fp}` map, `fingerprint` is
day-granular so time jitter doesn't churn, `allDayRange` is Invalid-Date-safe). The native `src/lib/calendar.ts` finds-or-creates
a dedicated **"CGPE Connect"** calendar and applies the plan via the SDK-57 **object-oriented** API (`getCalendars`/
`createCalendar` → an `ExpoCalendar` with `.createEvent`; events via `ExpoCalendarEvent.get(id).update()/.delete()` — the classic
`*Async` free functions are gone in SDK 57). Defaults, all owner-vetoable: **both** tasks + reminders; **SKIP** undated (never
coerce a blank date to today — the app's Invalid-Date convention); **all-day** events; **dedicated, removable** calendar;
**silent** (no in-app UI, so no new i18n key that would need human copy — a future on/off toggle + "synced" indicator is the
follow-up that does). Permission is requested **lazily** (only when there is something to add, at most once — declining turns
sync off, never nags). `CalendarGate` in `_layout.tsx` syncs on sign-in + foreground (15-min throttle) and clears this user's
events on sign-out (shared-handset safety; needs no auth token, so it lives in the gate, not `auth.tsx`).

**Consequence.** A member's dated, open tasks/reminders auto-appear in their phone calendar and stay reconciled. Gates `tsc` 0 ·
`npm test` 669 (+13) · eslint 0. Commit `aa8469f`, pushed to `aaziko/Shivam`. Native module → rides the batch APK, not OTA.
Device-unverified (no Vitest stub for `expo-calendar`); the sync decisions are proven pure. Spec: `docs/spec/PHASE-73.md`.

## 2026-08-20 — Phase 72 built (team-targeted PUSH, mobile half); Tier B via Expo Push; native modules kept out of the test graph

**Context.** Owner batch #3. Owner chose (AskUserQuestion) **Tier B real push** that wakes a closed phone, **all four triggers**
(new dept task / reassign-transfer / new lead / due-overdue reminder), **recipients = everyone in the target department**
(assignee + creator included). Verified against real backend code first: `models/Task.js` has a free-text `department`;
`utils/notify.js` has `broadcastToAllActive` but nothing dept-scoped and no real push; no `firebase-admin`/`expo-server-sdk`, no
device-token store. So real push exists nowhere — a backend build + a Firebase/FCM infra step, both owner-relayed.

**Decision.** Built the mobile RECEIVER only (the backend + Firebase are filed to `contracts/INBOX.md`). Transport = **Expo Push**
(`getExpoPushTokenAsync` on the app + `expo-server-sdk` on the backend) over raw `firebase-admin` — the boring, standard Expo path
with the least backend code, still FCM underneath. Added `expo-notifications@~57.0.12` + `POST_NOTIFICATIONS` + config plugin.
Pure tested `pushRouting.ts` (`routeForPush` maps `data.type` → the Tasks/Leads tab, honours a `data.url` only if it is a
known-safe route — never navigate on a guess; `shouldReRegister` so a normal reopen doesn't re-POST). Native fail-quiet `push.ts`
(permission/channel/Expo-token, foreground handler, tap + cold-start routing). `api.registerPushToken/unregisterPushToken` are
**silent** — a not-yet-deployed 404/501 no-ops, never a health banner. `PushGate` registers on sign-in + routes taps;
`auth.logout()` unregisters BEFORE the token is cleared (the unregister is itself authenticated).

**KEY TRAP (will recur):** importing `expo-notifications` (or `expo-calendar`) from any module the Vitest graph reaches breaks
Node with `ReferenceError: __DEV__ is not defined` (via `expo-constants` → `expo-modules-core`). `store/auth` is in the graph
(`appUi.test` → `appUi` → `auth`), so the sign-out unregister could not import `push.ts`. Fix pattern: **split the non-native
slice into its own file** — `pushToken.ts` (storage + a fail-quiet api call, no native import) holds `clearPushRegistration`; the
native code (`push.ts`, `calendar.ts`) is imported ONLY by `_layout.tsx`, which no test reaches. Recorded in project CLAUDE.md.

**Consequence.** The app is a ready push receiver; it delivers nothing until the backend endpoints + a Firebase/FCM project exist
(both owner-owed, filed). Phase 72 is PENDING backend — execute/verify on the owner's "backend done" signal, then the combined
APK. Gates `tsc` 0 · `npm test` 656 (+12) · eslint 0. Commit `64f1afc`, pushed to `aaziko/Shivam`. Spec: `docs/spec/PHASE-72.md`.

## 2026-08-20 — Staff role/dept fixes are a panel/DB job, not a mobile change (8 records, owner applied)

**Context.** Owner sent 8 "FIX role/dept" corrections (Harsh→ops, Hemaben/Harish→General Insurance, Riddish→Banking & Collection,
Ankit→manager/CGPE-Tree-head, Jagdish→ops/LIC, Aashubhai→Driver, Priyanka→TATA AIA). The values mixed tiers, departments, and the
legacy `_origRole` field.

**Decision.** These are `staff_unified`/`Profile` DB edits made in the admin panel — NOT a `src/` change (role/dept are never
client literals; the mobile app only reads them at login). Translated the intent to the real model: `Profile.role` is a strict
6-value tier enum (`ops`/`manager`/`sales` are NOT tiers), `Profile.department` must be one of the 9 canonical `utils/rbac.js
DEPARTMENTS`, and org-role teams (Banking & Collection, Driver) are additive rows in the `org_roles` catalog
(`POST /api/org-roles`, super_admin). `_origRole` is a dead legacy migration field — ignored. Resolved the 4 ambiguous ones with
the owner (General Insurance = Operations side; Banking & Driver = new org-roles under Operations/OTHERS baselines; Ankit = leader
tier + SALES-CGPE_Tree). Owner applied them directly in the DB.

**Consequence.** No mobile code changed. This is the reference for "role/dept correction = panel/DB, translate to enum + 9
canonical departments + org-role catalog, never a `src/` literal."

## 2026-08-20 — Phase 71 built (≤60-min location heartbeat in the watchdog); threshold derived at 45 min, not the handoff's "55"

**Context.** Owner #2 of the 70–73 batch: "location doesn't update / background not running / 20 h straight-line route." Verified
against real code (Phase-71 triage): every route point is OS-delivery-driven and best-effort — `tracker.ts` asks the fused provider
for a fix on a ~60 s cadence but under Doze/OEM-kill the real gap can be far larger, and the ~15-min reliability watchdog only
re-armed/idled/retired the recorder — it **captured no point of its own**. So nothing in code guaranteed a point within any window.

**Decision.** Gave `watchdogTick` a second job: when the newest recorded point is stale, take ONE `getCurrentPositionAsync(High)`
fix and push it through the existing `ingest` path (de-dup, mock-drop, shift/ambient attribution, delivery — all unchanged;
High accuracy so it survives the backend's >100 m shift-point drop, same reason as Phase 63). The stale decision is a PURE, tested
helper `src/lib/staleBuffer.ts` (`isBufferStale`), not buried in device-only `tracker.ts` — same seam pattern as `watchdog.ts`/
`appLock.ts`, because `tracker.ts` has zero test coverage. **Threshold `STALE_AFTER_MS = ceiling − watchdog-interval = 60 − 15 =
45 min`, NOT the handoff's rough "~55 min":** with a 15-min watchdog, triggering at 55 would let a tick seeing 54 min do nothing and
the next tick act at ~69 min, overshooting the owner's 60-min ceiling; 45 keeps the idealized worst-case gap at 60. Derived from the
owner's real requirement, not invented. The forced fix is bounded by a 30 s `withTimeout` so a cold-GPS fix can't hang the serial
chain; `retire` early-returns (no session to attribute a forced point to); `WATCHDOG_INTERVAL_MIN` now derives from the shared ms
constant so cadence and threshold can't drift. Adversarially reviewed (no HIGH/MED; the "unattributable → teardown" branch is
unreachable from the forced path because retire returns first).

**Consequence.** A clocked-in (or 24/7-armed) member's route can't sit with an hour-long hole while the watchdog is firing.
**Honest ceiling stated in code + commit:** WorkManager is itself Doze-deferred, so ≤60 min is best-effort, not a hard real-time
guarantee (real gap = 60 min + fix-acquisition latency + watchdog Doze slippage); a hard bound would need a native exact-alarm.
Gates: `tsc` 0 · `npm test` **644** (+9) · eslint 0. Commit `612410f`, pushed to `aaziko/Shivam`. Pure JS but rides a native APK
rebuild to reach phones (not OTA) — bundles with 72/73. Device-verify: a stationary clocked-in phone gets points ≤~60 min apart
(DB `point_count`/`last_point_at`); "bg not running" is most likely the APK predating the Phase-41 modules or needing a clock-out+in.

## 2026-08-20 — `git push aaziko Shivam` can reject (remote ahead); integrate by MERGE, never force/rebase/reset

**Context.** After committing Phase 71 (`612410f`), `git push aaziko Shivam` was rejected `! [rejected] (fetch first)` — the remote
`aaziko/Shivam` had a commit we didn't have locally. This is expected now that the repo exists on GitHub: the owner (or the web UI)
can push to it between our sessions. The data-safety rule forbids force-push / reset / discard on any git error.

**Decision.** Fetched (non-destructive) and inspected the divergence: shared base `9bb0d42`; remote added one benign
`996727d "Update README.md"` (touches only README.md), local added `612410f` (touches only `src/lib/*`) — zero overlap. Integrated
with a plain **`git merge aaziko/Shivam --no-edit`** (ort, merge commit `bdffdef`, only README.md changed; my source files and the
unrelated `.claude/settings.json`/repo-root `.txt` all untouched), then pushed. No rebase (would have been blocked by the modified
`settings.json` anyway and rewrites history), no force, no discard.

**Consequence.** History on `aaziko/Shivam`: `9bb0d42 → 996727d (README) → 612410f (Phase 71) → bdffdef (merge)`. Next session:
if push rejects, fetch + `git log --oneline aaziko/Shivam..Shivam` / `..aaziko/Shivam` to see the divergence, then **merge** and
push — never force. Now also captured in project `CLAUDE.md`.

## 2026-08-20 — Phase 70 built (App-Lock 5-min grace window); confirmed it's the biometric lock re-arming, NOT a token expiry

**Context.** Owner: "app keeps logging me out / re-verifies every 2-3 hours." The triage (Phases 70) had flagged TWO possible
mechanisms — (1) the biometric App-Lock re-locking on every foreground return with no grace (`AppLock.tsx:77`, session alive), or
(2) a real 401 to the login card (prod `JWT_EXPIRE`, OPS). The fix forks entirely on which. Asked the owner (AskUserQuestion) which
screen they see; they answered the **dark fingerprint overlay** — i.e. Mechanism 1. They also chose a **5-minute** grace window.

**Decision.** Built the Mechanism-1 `[m]` fix only. New pure `src/lib/appLock.ts` (`shouldRelock`/`parseLastActive` +
`APP_LOCK_GRACE_MS = 5min`, fails closed on missing/corrupt/clock-skewed stamps) + `appLock.test.ts` (+10); `AppLock.tsx` stamps
the last-backgrounded moment (in-memory for the live process, persisted in SecureStore for cold start) and re-locks only when the
gap exceeds grace — on both the foreground and cold-start paths. Deliberately did NOT: (a) touch the quick-unlock default (`auth.tsx:130`,
left ON — owner wants the lock, just not the nagging; turning it off would silently disable the lock); (b) add silent-restore-on-401
(owner confirmed it's not the login card, so no real expiry — that would be speculative dead code); (c) do any OPS/`JWT_EXPIRE` work.

**Consequence.** A brief background trip (<5 min) no longer re-prompts; a real absence still re-locks; a found handset stays shut
after the phone's been set down. Gates: `tsc` 0 · `npm test` 635 · eslint 0. Commit `cd134ba`. Pure JS (OTA-eligible) but not yet on
any phone — rides the batch APK with 71/72/73. Device-verify: brief-trip skips prompt, >5 min re-locks, cold-start after OEM kill
honours grace.

## 2026-08-20 — New working git remote `aaziko` (AazikoGlobalLLP/cgpe-android); push-403 bypassed; push after every phase

**Context.** `git push` to `origin` (`Dev-Shivam-05/CGPE-ANDROID-APPLICATION`) has 403'd for many sessions (credential
`reactjsaaziko` has no write access), so every commit sat local. The owner supplied a repo they own and directed: create/push the
`Shivam` branch there, and push after **every** completed phase with a distinct commit message for easy tracking, then `/handoff`.

**Decision.** Added `https://github.com/AazikoGlobalLLP/cgpe-android.git` as a **separate** remote `aaziko` (left `origin`
untouched — no URL redirect, no history rewrite, no force) and `git push -u aaziko Shivam` — **it succeeds**. Branch `Shivam` (all
history + `cd134ba`) is now live there, tracking `aaziko/Shivam`.

**Consequence.** Stop telling the owner "push is blocked / commit local only" — that guidance in CLAUDE.md and older memories is now
stale for this remote. Per-phase workflow going forward: finish a phase → commit with a clear per-phase message → `git push aaziko
Shivam` → `/handoff`. Never push `main`; never touch `origin`. Do not commit the untracked repo-root `.txt` files or local
`.claude/settings.json` unless the owner asks.

## 2026-08-20 — H1 clock-reason Sheet fully localized (owner copy) + fresh APK `b01f4164`; the "reason sheet localized" precondition is now met

**Context.** The 2026-08-19 decision (below) left the Phase-50 geofence blocked on two preconditions: the `6b76608b` APK installed
AND the reason Sheet localized. The reason Sheet shipped English-only. The owner supplied 5-language human copy in-chat for all 12
strings (4 core: `clock.reasonTitleOut/In`, `clock.reasonEarly`, `clock.reasonAway`; 4 edge-case: `clock.reasonNeededTitleOut/
BodyOut/TitleIn/BodyIn`).

**Decision.** Wired 8 new `clock.*` keys across all 5 dictionaries (commits `08f3a4f` + `8e9ad46`, i18n parity 103 → 111), pointed
the `home.tsx` Sheet + both `setNotice` edge branches at `t()`, and reused `common.cancel`/`home.clockIn`/`home.clockOut` for the
buttons. Machine translation stays forbidden — this is owner copy. The server's own `message` still wins over the fallback keys.
Cut a fresh EAS APK `b01f4164` (v1.10.0, gitCommit `8e9ad46`) on owner request; it supersedes `6b76608b`.

**Consequence.** The "reason sheet localized" half of the geofence precondition is DONE; the remaining half is installing
`b01f4164` on the field phones. Still do NOT enable the fence until it's installed. Reminder for identifying builds: every preview
APK is v1.10.0 / versionCode 1 — distinguish by build-ID / gitCommit / APK SHA-256, never the version string.

## 2026-08-20 — Owner batch of 4 reported issues triaged into grounded Phases 70–73 (not built), key root causes

**Context.** Owner reported 4 items: (1) app keeps logging out / re-verifies every 2-3 hours; (2) wants a guaranteed location
point every ≤60 min + suspects bg location isn't running; (3) team-targeted notifications (new Sales task → notify Sales team);
(4) merge assigned tasks/reminders into the member's phone calendar + a one-click export. Each was investigated against the real
mobile + backend code (4 parallel agents, file:line cited) before writing any row.

**Decision.** Wrote them as Phases 70–73 in `PHASES.md`, not started (each needs owner decisions; 3 of 4 need a native rebuild).
Grounded root causes: **(70)** TWO mechanisms — the frequent re-verify is the biometric App-Lock with **no grace window**
(`AppLock.tsx:69-81`, `:77`), session INTACT (a `[m]` fix); the genuine 2-3h logout needs a real 401, and the code's token TTL
default is **24h** (`../cgpe-backend-main/routes/auth.js:64-66`) so a 2-3h cadence points at **prod `.env` `JWT_EXPIRE` set
short** (OPS) — the app uses a Bearer JWT, **not a cookie**. **(71)** There is **no code-driven time guarantee** today — all
points are OS-delivery best-effort and the watchdog captures none (`tracker.ts:592-611`); the fix is a forced
`getCurrentPositionAsync` heartbeat in `watchdogTick` (`[m]`, but WorkManager is Doze-deferred so the ceiling is ~15 min typical).
**(72)** Real push exists **nowhere** (no FCM/expo-notifications, no device-token store) — splits into Tier A (in-app, cheap) vs
Tier B (real push, native rebuild + Firebase + backend). **(73)** `expo-calendar` not installed (native rebuild); pure client,
no `[api]`; bulk export is simple, auto-sync needs an `id→eventId` idempotency map.

**Consequence.** Next session starts on Phase 70 but MUST first get the owner to answer the Mech-A-vs-B question (dark
fingerprint overlay vs full sign-in card) — it decides the whole fix. Do not chase a token bug before confirming the overlay.

## 2026-08-19 — Phase-50 office geofence must NOT go live until H1 (clock-reason UI) is installed + localized

**Context.** A code audit + a direct re-read found that `home.tsx` had **no `needsReason` branch**: the Phase-50 data layer maps
the server's `400 REASON_REQUIRED` (out-of-range / early clock-out) to `{ok:false, needsReason:true}` with `blocked` unset, so it
fell through to the generic `if (!res.ok)` and showed a **false "The server could not be reached"** — and because no reason was
ever collected, the clock-out could **never succeed**. This is exactly the owner's "finish at a client's home" scenario.

**Decision.** Fixed in `home.tsx` (`dfa10f2`): a `needsReason` branch on both clock paths opens a **mandatory reason `Sheet`**
(mirrors the Phase-52 break sheet) and re-sends `clockOut/clockIn(coords, reason)`, reusing the existing success path untouched.
The sheet copy is **English** — deliberately, because the whole home.tsx clock-notice surface is already hardcoded English, so
this is consistent, not machine translation. **The bug is LATENT** until the office geofence is configured server-side (the
server only returns `REASON_REQUIRED` once it has office pins to measure against), so it cannot be end-to-end device-tested until
go-live.

**Consequence.** **Do not enable the Phase-50 geofence (`PUT /geofence` pins) until the `6b76608b` APK is installed AND the reason
sheet is localized** with the owner's 5-language copy (like consent/break). Without the fix, enabling the fence breaks clock-out;
with the fix but no copy, Gujarati/Hindi field agents see an English prompt. Also fixed the same session (`95b0da2`): M1 claims-403
classify, M2 matured-policy premium-due guard at source (adapt.ts → fixes premium.tsx + clients.tsx), M3 agent-map stale on-duty
pin. LOW/cosmetic items left open — see `docs/DEVICE-TEST-FINDINGS-2026-08-19.md`.

## 2026-08-19 — Device testing IS possible over USB/ADB from this environment (reusable how-to)

**Context.** The owner asked whether they could connect the phone by USB and have the session test the app while they watch. ADB
was not installed here.

**Decision (capability, recorded for reuse).** It works, with limits. Downloaded Google **platform-tools** to the session
scratchpad (`.../scratchpad/platform-tools/adb.exe`) — no admin install. The owner enables USB-debugging + authorizes the PC +
**logs in themselves** (the app is real-backend-only; no credentials exist here). Confirm the exact build via **APK hash**
(`adb pull` the on-device `base.apk`, SHA-256 == the EAS artifact — version strings can't tell builds apart: every `preview`
build is v1.10.0 / versionCode 1). **Screen-off drops the ADB session** → `adb shell settings put global
stay_on_while_plugged_in 7` for the duration (reset to `0` after). Tap via `uiautomator dump` + parse `bounds`, or screenshot
coordinates ×1.17 (1080×2340 device). **Cannot be driven:** background GPS over a real shift, geofence at a real place,
biometric hardware, and real write actions (clock-in, WhatsApp send) — those stay owner-owed.

**Consequence.** Future sessions can do a real on-device visual/behaviour pass of anything reachable after the owner logs in,
which caught nothing the code missed on the new batch but is a genuine second gate. It does **not** replace the physical
checklist (`docs/DEVICE-TESTING-GUIDE-v1.10.0.md`).

## 2026-08-19 — DEPLOY GAP CLOSED: Backend Phase 69 is merged to origin/main AND live on prod (verified, end of session)

**Context.** The owner reported "backend push kar diya hai" at session end. Per the standing rule (verify deployment, not
just code / not just a push), this was checked against the real remote + live prod, not taken on trust.

**Decision (finding, recorded as fact).** The gap is fully closed. `git fetch` shows `origin/main` = `2531817`, which
CONTAINS Phase 69 (`f0eac8e`) — `git merge-base --is-ancestor f0eac8e origin/main` → true (was `1cad312`, Phase 38–40, all
session). Live prod probes confirm it is DEPLOYED and running: `GET https://cgpe.in/internal/api/time-tracker/last-location`
and `/team/task-report` now return **401** (route present, auth required) where they returned **404** (absent) earlier today;
`/health` → 200. So the full chain — pushed → merged to `origin/main` → deployed → `:3001` answering — is confirmed, not
just the push.

**Consequence.** Every backend-dependent symptom the owner saw (0 on-duty, "server did not answer", straight-line GPS, missing
payroll rate, ticket→task) is now resolvable server-side. Asks 1/2/3 (shift accuracy, attendance coords, /live-locations)
need ZERO app change and light up on the deployed backend. The app-side work — Phases 63/64/66/67 — still needs the ONE final
APK to reach the device (installed v1.10.0 predates them). **Method to reuse next time a deploy is claimed: `git fetch` +
`merge-base --is-ancestor <commit> origin/main` + a no-auth curl (401 = route deployed, 404 = not).**

---

## 2026-08-19 — Phase 66 `[m]`: master "Live location" (last-known) shows an HONEST readout, NOT the clock-in map pin

**Context.** Owner wants a master to see a member's live location on/off duty. No real-time ping exists (no push infra), so
the honest deliverable is **last-known**. Built `getLastLocation(userId)` over Backend Phase 69's `GET /last-location`
(three-outcome `ok`/`none`/`error`, mirrors `getTaskReport`; own always, another needs super_admin) + a master-only "Live
location" card on `team/[id]` (gated `canSeeLiveLocation` = real super_admin) → a Sheet. First cut embedded `LeafletMap` with a
single pin. A 4-lens adversarial review (`wf_aae29582`) caught **two real honesty bugs, both from reusing LeafletMap's pin**:
(1) `AgentPin` is a clock-in/out concept — LeafletMap draws every `inLat/inLng` point GREEN with a "Clocked in at …" popup and
ignores `onDuty`, so an **off-duty** member's last-known point rendered as a green "clocked in" pin contradicting the "Off
duty" label beside it; (2) a **(0,0) "GPS had no fix"** point (the tracker can store one; LeafletMap's `usable()` drops it)
mapped to `ok`, so the freshness/duty pills asserted a location the map then refused to plot ("No location points yet").

**Decision.** DO NOT reuse the clock-in map pin, and DO NOT hack `LeafletMap` (a 1031-line danger-zone WebView whose pin
colours agent-map depends on — a neutral single-pin mode is a separate, scoped change). Instead the Sheet shows an **honest
readout**: the freshness (`timeAgo(at)` or "Time not recorded"), the REAL duty state (on/off duty from the point's own
`is_clocked_in`/`off_duty`), accuracy, and the **copyable coordinates** the master opens in their own maps app (privacy-
conservative — no auto-send to an external service). And `mapLastLocation` now rejects the **(0,0)/non-finite** sentinel (same
rule as `usable()`) → `getLastLocation` returns `none` ("no recent location"), never a fabricated last-known. A
present-but-unusable point is `none` (calm), only a real fault is `error`.

**Consequence.** Both review bugs eliminated at the root (no map pin → no clock-in mislabel; no unusable point surfaced as
`ok`). The in-app **map visualization is a documented follow-up** needing a neutral-pin `LeafletMap` mode. Gates: `tsc` 0 ·
`npm test` **625** (+13, `api-lastlocation.test.ts`) · eslint 0 new. Coordinates stay master-only (contract). Needs Backend
Phase 69 deployed (endpoint 404s on prod today → honest "couldn’t load"). JS-only → final APK. Ships in the final APK.

---

## 2026-08-19 — Backend Phase 69 (the 5 mobile `[api]` asks) VERIFIED code-correct but NOT deployed — the deploy gap persists

**Context.** The owner relayed that the backend finished the 5 `[api]` asks from the 2026-08-19 batch. Verified each against
the **real `cgpe-backend-main` code** (6 parallel investigators, file:line): all 5 are code-correct — (1) shift accuracy
drop relaxed `<=100m`→`<=1000m` (`SHIFT_ACCURACY_MAX_M`, `timeTracker.js:1712`); (2) `dayLogToAttendanceRecords`/`withClockLoc`
now folds `clockInLoc`/`clockOutLoc` lat/lng onto `clock_in`/`clock_out` (`attendance.js:44-53,62,66` — the 0/0 fix);
(3) `/live-locations` super_admin-gated + `String()===String()` compare fixed; (4) NEW `GET /last-location` with the exact
8-field shape; (5) payroll `hourly_rate` + `days/sundays/holidays` in `computeRangeSalary` `months[]`.

**Decision.** Treat the backend as **code-done but NOT live**. Deployed `origin/main` is still `1cad312` (Phase 38–40);
Phase 69 (`f0eac8e`) is on local `main` + pushed to `origin/deploy-phases-41-69` but **NOT merged to `origin/main`**, which is
the only branch prod deploys. So NONE of the 5 fixes (nor Phases 41–68) run on the device yet. This is a clean fast-forward
(0 divergent / 53 ahead). **The deploy is the OWNER's action** — neither mobile (push 403) nor the backend session (won't
push to `main` by their own rule) can do it. Relayed as the standing OPS blocker.

**Consequence.** Asks 1/2/3 need ZERO mobile change and light up on deploy (GPS route fills in, On-duty populates). Asks 4/5
are the mobile builds (Phase 66 Live button, Phase 67 payroll detail — this session). Do **not** tell the owner these work on
the phone until `origin/main` carries Phase 69 and `:3001` restarts. Verify deployment, not just code (the recurring trap).

---

## 2026-08-19 — Phase 67 `[m]`: payroll-detail screen (per-member breakdown + activity); failed activity ≠ "no tasks"

**Context.** Owner asked to see every employee and, tapping one, HOW their pay was reached + what they did. Built a new
`payroll-detail` route reached from the Payroll roster (`payroll.tsx` rows now tap through). It re-fetches the admin roster
`getPayrollRoster` and finds the member; for a real master (`canSeeTeamPerformance`) it also fetches
`getTaskReport({scope:'all'})` — the proven call, not the unexercised `user_id` param — and picks the member's completed
tasks client-side. Consumes Backend Phase 69's additive `hourly_rate`/`days`/`sundays`/`holidays` (typed + wire-tested).

**Decision.** RENDER-NEVER-RECOMPUTE (rule 2): the working-days derivation shows the server's own `days`/`sundays`/`holidays`/
`working_days` — the app does not subtract them; `hourly_rate` is shown verbatim (no dividing payable/hours). Only `absent =
working − present` (a DAYS subtraction) is on-device, as `earnings.tsx` already does. DOUBLE-GATED like `payroll.tsx`: the pay
breakdown is admin/super_admin (the admin `/compute` endpoint); the activity block is super_admin-only (`isMaster`), so a
non-master admin sees the breakdown but never another member's tasks; a leader deep-linking gets an honest refusal.
**A 4-lens adversarial review (`wf_0829f800`) then caught a real bug and it was fixed:** the activity block collapsed a FAILED
`getTaskReport` (5xx/timeout/**the deploy-gap 404, which is silent — no banner**) into a confident "No completed tasks
recorded" — the empty≠could-not-load violation (rule 4) the health channel exists to prevent, and the sibling
`performance.tsx` handles correctly. Fixed by tracking a distinct `ActivityState` (`skipped`/`ok`/`error`) and rendering an
honest "couldn’t load this member’s activity" line on error, never a fake empty.

**Consequence.** Gates: `tsc` 0 · `npm test` **612** (+3 wire-contract locks on the new payroll fields) · eslint 0. New route
`/payroll-detail` (flat stack; `.expo/types` regenerated locally — gitignored, other devs regen on `expo start`). JS-only →
ships in the final 63–69 APK. The screen is data-complete but the payload/activity only fill in once Backend Phase 69 is
**deployed** (hourly_rate absent → that Fact row hidden; task-report 404 → the honest could-not-load line). Ships in the final APK.

---

## 2026-08-19 — Phase 64 `[m]`: getBreakLocations treats 404/501 as a QUIET answer (deploy-gap-proof), delegating to the ONE classifier

**Context.** The master monitor/map showed "server did not answer" (Phase 64b). The global `health.degraded` banner
needs a real 5xx/timeout/404; the likely trigger is `getBreakLocations` reading `/time-tracker/break-locations`, which on a
prod build that predates that endpoint returns **404**. The function hard-coded `if (status === 403) return []` as its only
quiet answer and routed everything else (404 included) through `unavailable()` → `reportFailure` → red banner. That `=== 403`
list had **drifted** from the app's actual contract for "which statuses are answers": `reportIfOutage` (`api.ts:130`) treats
**401/403/404/501** as answers (an undeployed route is `unsupported`, not a fault). The core "on duty 0 / live field status
0" zeros are a *separate* backend bug (`dayLogToAttendanceRecords` drops `clockInLoc` coords) — filed `[api]`, not mobile.

**Decision.** Route the whole `!ok` branch through the single classifier: `reportIfOutage(status, KEY)` (suppresses
401/403/404/501, reports the rest) followed by `unavailable(KEY, [])` (consumes the suppression note so answers stay quiet,
reports real faults). Removed the hand-coded `=== 403` short-circuit rather than extend it, so this can **never drift from
the contract again** — the exact drift-class bug being fixed. Introduced a local `const KEY` and passed it as `req()`'s 4th
arg so producer (`reportIfOutage`/`req`) and consumer (`unavailable`) meet on the same health key. Behaviour: 403 (non-master)
and 404/501 (deploy gap) → quiet `[]`, no banner; 400/5xx/network → honest banner, still `[]` (never fabricates a pin).

**Consequence.** The map no longer shows a false "server did not answer" for a not-yet-deployed break-locations endpoint;
once OPS deploys, orange break pins light up with no further app change. This does **not** fix the "0/0" zeros — those need
the `[api]` `clockInLoc` coordinate-surfacing fix (INBOX, owner relays) on deployed `origin/main`. The 403 empty answer now
incurs the standard `unavailable()` ~260ms `wait()` (was an immediate return) — matches every other empty path; the sole
caller (`agent-map.tsx:104`) fully awaits + `.catch()`es, so it is unaffected. Gates: `tsc` 0 · `npm test` **609** (+3, the
404/501 quiet-answer lock, the 5xx banner boundary, the network-catch banner) · eslint 0 new. Reviewed by a 4-lens
adversarial workflow (`wf_f9a30b90`) — 0 findings. JS-only → ships in the final 63–69 APK. Ships in the final APK.

---

## 2026-08-19 — Owner directive: build ALL of Phases 63–69 editor-side first, THEN one final APK, THEN test everything together

**Context.** After Phase 63 `[m]` was built, the owner directed (Hinglish): "sabhi phases complete hone ke baad final apk
banayege and then sabhi ki testing ek saath kar denge" — build all the phases, then make the final APK, then test all of it
at once.

**Decision.** No per-phase / interim EAS builds for the 63–69 batch. Every phase stays **editor-complete + gated (tsc/test/
lint) + committed locally**; the single **final APK is cut only after the whole batch is done**, and the on-device pass for
the entire batch happens together in one session. (EAS builds from the local working tree, so the 403 push block does not
prevent the final build when the time comes.)

**Consequence.** Do not offer or cut an APK mid-batch. When 63–69 are all built, cut ONE `preview` APK
(`npx eas-cli build -p android --profile preview --non-interactive`), get the direct `.apk` URL via `build:view <id> --json`,
and hand the owner one combined device-test checklist. Until then, "ships in the final APK" is the standing status for every
JS change in this batch.

---

## 2026-08-19 — Phase 63 `[m]` (background location, owner #1) BUILT + adversarially reviewed: shift captures every point at High; off-duty stays coarse

**Context.** Owner #1: a clocked-in member ("Pavitra") had the app open ~20h yet her route never came through — ~8km,
one straight line. Verified root causes: (1) the recorder requested `Balanced` (~100m) but the backend silently drops
every clocked-in fix with `accuracy > 100m` (`timeTracker.js:1671`); (2) `distanceInterval:30` meant a stationary phone
recorded nothing, and a "still" classifier reading stretched cadence to 5 min; (3) the straight line ≈ the background
service wasn't running (OPS/native-build, out of scope for a JS change). Built the `[m]` half, then ran a 4-lens
adversarial workflow (`wf_98aa7dfa`) BEFORE calling it done.

**Decision.** (1) **SHIFT profile = capture every point:** `MOVING_PROFILE`/`STILL_PROFILE` → `distanceInterval 0`
(deliver on the ~60s time interval even when stationary) + `accuracy 'high'` (~10m, clears the >100m server filter). The
motion "sparse when still" economy is **neutralised** (STILL == MOVING) and **guard-locked** by a test, because it was a
root cause of the reported gap. (2) **Off-duty is NOT upgraded:** `startService` is shared by the shift and 24/7 ambient
paths, so the review caught that both had inherited the aggressive profile → continuous ~10m recording of an off-duty
user's **home** (privacy) with the GPS radio hot 24/7 (battery). Fixed with a distinct coarser **`AMBIENT_PROFILE`**
(Balanced + distance-gated = the pre-63 off-duty behaviour), selected by the presence of a shift `sid`. Off-duty battery
economy now lives in `AMBIENT_PROFILE`, NOT in a STILL re-tune (the shift guard forbids that). (3) **iOS guarded:**
`distanceInterval 0` removes iOS's only throttle (`timeInterval` is Android-only) → iOS would firehose ~1Hz High fixes;
iOS keeps a non-zero distance filter, Android keeps 0. iOS bg tuning is deferred to Phase 56. (4) **Crux hardened:** the
new `'high'→Location.Accuracy.High` mapping (the single line that makes the fix work) was untested (tracker.ts is
device-only) → converted `accuracyOf` to a `Record<accuracy, Accuracy>` so tsc enforces completeness and a typo to
Balanced is one glaring line. (5) **Offline buffer:** the fixed 60s cadence shrank the 240-point buffer to ~4h → raised
`MAX_POINTS 240→720` (~12h); verified expo-secure-store has no hard value-size limit on Android.

**Consequence.** `tsc` 0 · `npm test` **606** (+2) · eslint 0 new. Commits `9033e88` + `26d011d` (local; push 403s).
**NOT a complete fix on these commits alone** (review, HIGH): `High` is a *target* — indoor/poor-signal fixes can still
report >100m and be dropped until the filed **`[api]` relax** of the >100m drop lands on deployed `origin/main`; do NOT
report to the owner as fixed pre-`[api]`+device. Ships only in a **native APK build** (JS-only but the profile rides a
build, not OTA). Device test MUST **clock out+in** (or reinstall) — the profile applies only at service (re)start.
Known limits: a 24/7-armed user who clocks in over a running ambient service keeps the coarse profile until a genuine
restart (documented, non-regressive); a >12h continuous-offline shift still evicts oldest (needs upload chunking); the
now-dormant 41c classifier runs for no behavioural effect (accepted minor overhead, revisited when STILL is re-tuned).

---

## 2026-08-19 — Owner issue batch (Phases 63–69) scoped from real code; SYSTEMIC finding: prod backend is ~28 phases behind + some commits unpushed

**Context.** Owner reported 6 monitoring/payroll/location issues + a re-report that "I'll handle this" still doesn't move
a ticket to Tasks. Rather than guess, ran 5 parallel read-only investigators over the real mobile AND backend code
(file:line cited). A cross-cutting root cause emerged that ties several symptoms together.

**Decision.** (1) **Scope, don't build yet** — wrote the grounded spec `docs/spec/ISSUES-2026-08-19.md` (Phases 63–69),
each with a verified root cause and an app/backend/OPS classification, plus board rows; filed the discrete `[api]`/`[sec]`
asks to `../contracts/INBOX.md` for the owner to relay. (2) **The headline finding is OPS, not code:** deployed
`origin/main` = `1cad312` (Phase 38–40), while every "shipped" backend piece Phases 41–68 (perf `task-report`,
`break-locations`, geofence, clock-reason, commissions, the **ticket→team_tasks mirror**) sits on `shivam`/local `main`,
never merged to `origin/main`; the deploy pipeline only ships `origin/main`. Hard proof: the ticket-mirror commit
`cb3f9de` is on **no remote branch at all** (`git branch -r --contains` → empty). So the owner's "ticket→task doesn't
work" (Phase 69) and "performance blank" (Phase 68) are the **same deploy gap** — the mobile side is already correct and
tested (`0b64be8`); nothing to build, the backend must push+merge+deploy+restart. (3) **A `:3001` restart alone does NOT
fix the monitor zeros** (Phase 64): `routes/attendance.js` genuinely drops the clock-in coordinates the map needs — a real
backend bug, separate from the deploy gap. (4) **Background tracking (Phase 63, owner #1)** has real app-config defects
(`distanceInterval:30` = nothing recorded when still; 5-min still-cadence; `Balanced` accuracy colliding with the backend's
>100 m drop) AND is very likely an ops/native-build gap (installed APK predates the Phase-41 modules / OEM battery kill) —
needs a device+DB check to disambiguate. (5) **Payroll "only 1 employee"** is data, not code — only one `payroll_profiles`
row exists; the mobile list is already multi-member. The real build is a per-employee pay-breakdown+activity detail screen
(reuse `earnings.tsx` + `performance.tsx`). (6) **Live-location button** is deliverable only as **last-known** location
(no push infra for a real-time ping) via a new master-gated `[api]` + an honest freshness label.

**Consequence.** Nothing built this batch — scoped + filed only; next session executes and relays. **The owner's most
important unblock is not a code change but getting the backend team to push + deploy `origin/main` + restart `:3001`**
(mobile can't — push 403s). Priority: background location (63) is #1. Do NOT re-verify the ticket-mirror or perf as "app
bugs" — they are correct in code and blocked purely on deploy.

---

## 2026-08-18 — Phase 53b (mobile half of owner #1: the "today" task count animating wrong on reopen) BUILT

**Context.** Owner's #1 issue: claiming a ticket doesn't surface it as a task, and reopening a completed task makes the
count jump. Two independent causes were verified against real code (6-agent investigation `wf_df890eaa-2f6`): **(53a,
backend)** a claimed ticket is written only on the tickets doc, never mirrored into `team_tasks`, so the task list can never
show it — filed to `cgpe-api` (INBOX, owner relays); **(53b, mobile)** `adaptTeamTask` derived `dueDate` from the server
touch-time `updated_at` for undated tasks, and both Home and the Tasks tab computed the "today" denominator as
`due-today ∪ (done && !upcoming)` — duplicated inline in two files — so a status change re-bucketed undated tasks and swept
every historical done task into "today", making a reopen change numerator AND denominator at once.

**Decision.** (1) **Undated → `''`, not `created_at`.** An undated task now keeps `dueDate === ''`. Verified downstream: `new
Date('')` is Invalid → `dueBucket` sorts it to `'upcoming'` (never a false overdue/today) and every formatter routes through
`toDate` → `'-'`; `tasks.test.ts` already blessed `dueDate:''`. `created_at` was rejected because it *reproduces* the bug
(old undated tasks would read "Overdue"). This also sidesteps the snake/camel casing trap — the `due_at||dueAt` prefix
(unchanged) still catches every real due date, so dated tasks are untouched. (2) **One shared, unit-tested helper.**
`dueBucket` moved to the zero-dep `@/data/tasks` (now takes an injectable `now`), and NEW `todayProgress(list, now)` =
`belongs(due-today ∪ completed-today)` — **both** Home and Tasks call it, so the two counts cannot drift, and a reopen shifts
only the numerator (an undated/overdue task completed-then-reopened leaves the SAME set cleanly; history from earlier days no
longer pollutes today). (3) **Honest optimistic model.** complete stamps `completedAt`, reopen clears it, with a correct
rollback; `completedAt`/`createdAt` in `adaptTeamTask` now read both snake+camel casings (team_tasks serialises camelCase),
so a done task always carries a completion timestamp the count can credit. (4) **Clamp the animated numerator.** An
adversarial review (`wf_5f13f693-c88`, behavior + count-math + contract lenses, 2 of 3 clean) surfaced one low-severity
cosmetic: on a reopen that drops a task out of today's set the denominator updates instantly while `useCountUp` eases the
numerator down, transiently showing "2 / 1". Fixed with `Math.min(shownDone, total)` at both hero render sites — it lands on
the owner's exact "count looks wrong on reopen" sensitivity.

**Consequence.** 53b is editor-complete: `tsc` 0 · `npm test` **603/603** (+12 pins: `dueBucket('')→'upcoming'`,
reopen-stability, completed-today crediting, history exclusion, and `adaptTeamTask` undated→`''` at the wire) · eslint 0 new
errors. Commit `46b061e` (local — push still 403s). **Only a device visual pass remains** (native count-up animation).
**53a stays backend-first** — a claimed ticket cannot appear as a task until `cgpe-api` ships the `team_tasks` mirror; do not
"fix" it mobile-side. An undated task now lives under the **Upcoming** filter (honest: it has no due date) rather than being
scattered by touch-time — a deliberate, verified behavior change, not a regression.

---

## 2026-08-18 — Phase 51 (map toggles) + Phase 52 (Break feature) built end-to-end; backend Phase 66 verified+consumed; v1.10.0 APK cut; new owner issue-batch under investigation

**Context.** Owner answered the map-toggle spec and bundled in a full Break feature + a colour scheme. Later reported the
backend "task complete"; verifying the real code showed the completed task was first Phase 65 (gap-detector, NOT break),
and only on a re-check was Phase 66 (the break enhancements) actually shipped — a live example of "a tick is not the code."
Then owner sent a new 7-item issue batch (task mismatch, offline, network, lead-open error, createdAt/updatedAt "", iOS
mandatory) and asked for well-defined rows + a handoff.

**Decision.** (1) **Phase 51 (`8eb4858`)** — satellite toggle uses **Esri World Imagery + Esri label overlay** (hybrid, no
API key); Apple/Google tiles need paid SDK/keys, so that is the honest ceiling (a small "Imagery © Esri" credit shows in
satellite). Show/hide-points toggles the marker layer (route line + arrows stay). Pins recoloured by EVENT (clock-in green
`c.success`, clock-out red `c.danger`). Satellite/points state lives in the outer `LeafletMap` so a theme flip (which
remounts `MapCanvas` via key) keeps the choice; re-asserted on the ready handshake. (2) **Phase 52 Break** — owner supplied
5-language copy, so the whole flow shipped (`8da2fb8` data+i18n, `b1cea19` home UI): after clock-in the hero shows **Break +
Clock out** side by side; the **8h30m gate** (`MIN_SHIFT_MS`, the payroll office-hours figure) shows a `useConfirm` first
only when the minimum is met; the reason is **optional** and sent **additively** (harmless before the backend stored it);
**clocking out while on break ends the break FIRST**, because `DayLog.clockOut` nulls `activeBreakStart` without recording
the in-progress break, so that break time would otherwise silently count as worked. (3) **Backend Phase 66 (`6ef26f0`)
consumed (`53ba448`)** — verified field-for-field: `breakSchema.reason` persists (B1, mobile already sent it → zero
change) and NEW master-gated `GET /break-locations` (B2) → `getBreakLocations()` draws **ORANGE** break pins (`c.warning`)
on `agent-map` (legend now green/orange/red); a 403-for-others is a quiet empty answer, never a fabricated pin. cgpe-api
chose a NEW dedicated endpoint over folding into the un-mastered `/live-locations` (which leaks staff email/role); mobile's
green pins come from `getAgentLocations` (attendance fan-out), not that leak. (4) **v1.10.0 APK cut** (EAS build
`0c648a0c`, direct `.apk` `https://expo.dev/artifacts/eas/ls-3QFiTrj-GuDt-6ot-Q7dQOuYkDcMLlt2InWDuf0s.apk`) bundling 51+52
on the same native base as v1.9.0 (all JS-only) + a device checklist `docs/spec/PHASE-51-52-DEVICE-CHECK.md`. (5) The new
7-item batch is being scoped by a parallel real-code investigation (workflow `wf_d89dc600-86e`) BEFORE rows are written, so
each task is grounded, not guessed — owner made **iOS mandatory** and **task mismatch** the two priorities.

**Consequence.** Phase 51 + 52 are complete pending only ops (backend `:3001` restart on the Phase-66 build for the orange
pins) + an on-device pass. `git push` still 403s — every commit is local. The 7-issue rows + iOS reliability answer land
once the investigation returns; do not write them from memory.

## 2026-08-17 — Phase 50 shipped+built; app-closed location (Phase 41) made owner #1 and fixed-forward with a v1.9.0 APK

**Context.** In one boot: the owner confirmed all Phase-50 §6 decisions, `cgpe-api` shipped them (Backend Phase 64), and
mobile built the consumer. Then the owner sent a batch of new requests and re-prioritised: the **app-closed background
location bug is now #1** ("app band ho toh location nahi milti — real testing"), plus 6 feature asks (satellite toggle,
red/green on/off-duty, app-installed view, map points + in/out-path toggles) and the two exact office coordinates.

**Decision.** (1) **Phase 50** — verified `cgpe-api`'s real Phase-64 code field-for-field (all 6 owner points; nearest
office, server-enforced `REASON_REQUIRED`, `EARLY_CLOCKOUT_GRACE_MIN=15`, n8n+in-app super_admin-only alert without
coordinates, additive `offices[]`), then built the editor-buildable mobile half (commit `6b2da6f`): `getGeofence` reads
`offices[]`, `checkGeofence` measures the **nearest** office (a real correctness fix — the old single-pin pre-check would
refuse someone standing at office B, which the server allows, breaking the Phase-7 "never refuse what the server allows"
rule), `clockIn`/`clockOut` thread `reason` + map `REASON_REQUIRED`. The `home.tsx` reason-prompt UI is **deferred** —
it needs 5-language HUMAN copy (machine translation forbidden) + a device. (2) **App-closed location** — diagnosed as the
Phase-41 native-build gap: the recorder is written and correctly configured (app.json perms/plugins + package.json deps
all committed), but the installed APK predated the native modules, so background recording could never run. **Fixed
forward by cutting a fresh EAS preview APK v1.9.0** (version bumped from 1.8.0 so the owner can confirm the new build
on-device; commit `ddbb33e`; build `86c1406c`) rather than any editor change — a JS/OTA update cannot add native modules.
(3) **App-installed signal = "recent location points"** (owner AskUserQuestion). (4) The two office pins
(Adajan `21.208267,72.839960`, Katargam `21.187084,72.797604`) are set in the **panel/DB** via `PUT /geofence`
`offices[]`, never client literals.

**Consequence.** Gates green on the mobile build (`tsc` 0 · `npm test` 576 · eslint 0 errors). The app-closed fix is now
a **device test** owed by the owner (install v1.9.0 + Location "Allow all the time" + Battery "Unrestricted" + Auto-start
ON — a miss here is usually settings, not code). Still owed next: the `home.tsx` reason-prompt UI + 5-lang copy; the
mobile map toggles (satellite + points, pure mobile); and 2 backend asks to file after verifying real code — app-installed
(recent-points) and an off-duty (ambient) points **read** (the app has no such read today, so the red/green Phase-42
colouring and the map in/out-path toggle are blocked on it). All commits local (`git push` still 403s).

## 2026-08-17 — Phase 50 set to #1 (backend-first, blocked); Phase 62 kept PENDING until owner confirms device test

**Context.** Owner re-prioritised the queue: make Phase 50 (dual-office geofence + out-of-range / early-clock-out
reason → super-admin) the #1 priority, keep Phase 62 PENDING until the owner personally confirms the on-phone test
passes, and asked for a plain-language device-check doc they can walk after logging into the app. Phase 41 stays LAST.

**Decision.** (1) Phase 62 stays **PENDING**, not "done", until the owner confirms "testing pass hai" — the build and
cross-repo contract are verified correct (gates re-run green this session: `tsc` 0 · `npm test` 557/557 · `fc92573`
intact), but the native advisor-login visual pass is the owner's to sign off; do not close it from the editor. Wrote
`docs/spec/PHASE-62-DEVICE-CHECK.md` (Test A advisor / Test B non-advisor / Test C edge + a sign-off that stays open
until the owner ticks it). (2) Phase 50 is **#1 but not yet actionable** — priority ≠ buildable. It is backend-first
(`docs/spec/PHASE-50.md`): `cgpe-api` must ship the two-office fence + reason capture + super-admin notify, the two
office pins must be set in the panel, and the owner must confirm the 5 flagged §6 points before any mobile build. The
next real Phase-50 move is an **owner action** (relay the two already-filed `[api]`s), not a mobile change.

**Consequence.** No `src/` change this session — docs only. Next session: if the owner has relayed the `[api]`s and
answered §6, verify `cgpe-api`'s real shipped code first (tags wrong 5×) before threading `reason`; otherwise there is
no mobile Phase-50 build to start. Do not mark Phase 62 done from the editor.

## 2026-08-17 — Phase 62 go-live verified by cross-repo code-read (not a live authed call)

**Context.** Owner confirmed `cgpe-api` is now running on `:3001` (Backend Phase 62 live) and asked to
verify Phase 62 end-to-end before handoff. The definitive go-live check is an authenticated advisor
call to `GET /api/commissions/my-summary` — but no advisor token exists in the editor environment.

**Decision.** Verified the go-live the only rigorous way available: field-for-field against the real
code on both sides (`cgpe-backend-main/routes/commissions.js` `/my-summary` `:319-352` + `utils/mdrtTiers.js`
vs mobile `api.ts:1342-1364` + `types.ts:140-163` + `commissions.tsx`). Confirmed: `target`/`byProduct`
shapes match; `next_premium` preserved as `null` at TOT (`numOrNull`, not `fin`); whole-object-or-null
degrade on a non-object `target`; product bars render `amount/ytd` (no re-sum, rule 2); the second
`/advisor/performance` fetch is removed. Gates re-run green (`tsc` 0 · `npm test` 557/557 · `fc92573`
intact). No `src/` change. The remaining on-device visual pass (real advisor login) is left for a
handset session — a device miss there would be an account/role issue, not a client bug.

**Consequence.** Phase 62 is contract-verified go-live-ready; only the device visual confirmation is
outstanding. Do not attempt to "verify" go-live with an unauthenticated call next session.

## 2026-08-17 — Commissions tier card reads `/my-summary.target`; drop the second `/advisor/performance` call (Phase 62)

**Context.** `cgpe-api` shipped Backend Phase 62: `GET /api/commissions/my-summary` now additive-returns
`target` (the advisor's next-MDRT-tier premium object, or `null`) and `byProduct` (this-year earned
commissions grouped by product, `Σ amount === ytd`), computed from the SAME FYC basis as
`GET /api/advisor/performance` via a shared `utils/fyc.js`. Owner flagged this **mobile #1**. Before this,
the commissions screen showed the MDRT tier via a SEPARATE `getMdrtTier` call to `/advisor/performance/:id`
(gated to advisor/`learn_advisor`), and the screen's scalar `target` field had no source (always `0`, so
the "Monthly target" meter was permanently blank). Verified against real backend code first (rule 5):
`routes/commissions.js` `/my-summary` (target `:338-345`, byProduct `:322-330`), `utils/fyc.js`,
`utils/mdrtTiers.js`, and `api.md`/`CHANGELOG.md` — all agree.

**Decision.** (1) Drive the tier card off the summary's `target` and **remove the second
`/advisor/performance` call** — the backend explicitly shares the FYC sum so the two surfaces can never
disagree, and one call is enough (backend's stated intent). (2) **Keep the advisor/`learn_advisor` gate**:
for a non-advisor, FYC = 0 and the backend still returns a non-null `target` with `achieved_premium:0`, so
un-gating would show a meaningless "₹0 · 0% to Quarter MDRT" — the exact thing the old gate guarded against.
(3) **Remove the always-blank scalar "Monthly target" meter** (its `target` was never populated). (4) **Add
a "This year by product" section** rendering `byProduct` — each bar = the row's share of `ytd`; the app
renders, never re-sums (rule 2). (5) **Keep `getMdrtTier` exported + tested** — it is a legitimate
`/advisor/performance` reader; deleting it + its 13-test file is churn for no gain. `target` is labelled a
PREMIUM/production goal, not a rupee-commission target (backend ⚠️; no commission-amount target exists).

**Consequence.** Commissions shows the tier + per-product breakdown from one call; a non-advisor sees
neither. Behavioural note: the tier card now shares the summary's fate (an outage hides both) instead of
being independent — acceptable now that `/my-summary` is the built, canonical source (the independence
mattered only while `/my-summary` was unbuilt). No contract change (pure consumer). Gates: `tsc` 0 ·
`npm test` **557** (+5) · eslint 0 errors (2 pre-existing `api.ts` warnings). Commit `fc92573` (local —
push 403s). Live only after `cgpe-api`'s `:3001` restart. Also this session: Phase 41 on-device
verification de-prioritised to LAST (owner); Phase 61 (backend QA-sweep) verified mobile-unaffected.

## 2026-08-15 — Matured policy status is DERIVED client-side from the maturity date (owner bug report)

**Context.** The owner sent a Client 360 screenshot: a policy with maturity **Mar 2023** still read
**"In force"**. Root cause: `adaptClient` (`src/data/adapt.ts`) hard-coded `status: 'in_force'` on
**every** policy regardless of its maturity date (the test even pinned it — "adaptClient can never
emit any other status"). The lic-import doc carries no reliable per-policy status field, which is why
it was hardcoded.

**Decision.** Derive the one status we CAN know for certain from the data: a maturity date **in the
past** (`daysUntil(maturity) < 0`) ⇒ `'matured'` (an existing contract status with its own label/tone
in `client/[id].tsx`), otherwise `'in_force'` exactly as before. `lapsed`/`paid_up` are left untouched
— the doc carries no data to infer them, and inventing them would violate rule 1. Owner-confirmed via
AskUserQuestion (2026-08-15). ALSO owner-chosen: **hide the "Premium due / X days late" indicator on a
matured policy** (KPI + the "Next premium" row) — a completed policy has no premium due, so leaving the
alarm would contradict the new "Matured" status. A genuinely in-force overdue policy still shows its
reminder. No new status value invented; no contract change (pure client-side inference over existing
fields). Ideally the backend would send a real policy status someday — NOT filed this session (the
derivation is honest and sufficient; filing would be scope creep at a bug fix).

**Consequence.** Every matured policy now reads "Matured" app-wide, not just this one client. Gates:
`tsc` 0 · `npm test` **553** (+4 pinning past→matured / future→in_force / no-date→in_force) · eslint 0.
Commits `390f7ab` (adapt) + `588a90d` (client screen), local (push 403s). Shipped in APK `7cdc351d`.
Caveat: a policy with a **missing/garbage** maturity date stays "In force" (can't be known matured
without a date) — that is a DATA issue, not a code bug.

## 2026-08-15 — WiFi "network error" is ENVIRONMENTAL, not an app bug; and EAS cloud build WORKS from here

**Context.** Owner reported the app fails with a network error on WiFi but works on mobile data, asking
to remove any "mobile-data mandatory" behavior. Validated rather than guessed.

**Decision / findings.** (1) There is **no network-type check anywhere in `src/`** (grep: 0 hits for
NetInfo/wifi/cellular) — the app never requires mobile data; native always hits `https://cgpe.in/internal/api`.
(2) The backend is **healthy and fast** from this machine — HTTP 200, body `Backend is running ✅`,
total **~0.04–0.17 s** over 3 tries, and cgpe.in is **IPv4-only** (no broken-IPv6 path). So the 4.5 s
`REQUEST_TIMEOUT` (`config.ts:65`) is NOT the cause when the network is good, and the WiFi-specific
failure is that **that particular WiFi cannot reach cgpe.in** (captive portal / firewall / no real
internet). **No code change made** — the definitive next step is the owner opening
`https://cgpe.in/internal/api/health` in the phone browser ON that WiFi. If it loads but the app still
fails, THEN revisit app-side (raise the 4.5 s timeout + add a retry) — a genuinely defensible change,
but not shipped blind. (3) **EAS cloud build works from this environment** (`npx eas-cli build -p
android --profile preview --non-interactive`): logged in as `shivam-bhadoriya`, keystore already on the
Expo server, ~15–20 min, and the direct `.apk` URL comes from `npx eas-cli build:view <id> --json` →
`.artifacts.applicationArchiveUrl`. The git-push 403 does **not** block shipping an APK.

**Consequence.** No `src/` change for the WiFi item (baseline gates stand). Two APKs were cut and handed
over this session. Documented the EAS-build capability + the WiFi diagnosis in `CLAUDE.md` so neither is
re-derived. If a future "slow WiFi" case is confirmed, the fix is the timeout/retry, filed as its own
small change with the owner's confirmation.

## 2026-08-15 — Phase 41d app-block SCREEN BUILT: owner copy landed → wired (spec-literal composition chosen)

**Context.** The 41d "turn location back on" gate had two blockers: 5-language human copy and a locked trigger.
Both are now cleared — the copy (`consent.blockedTitle`/`blockedBody`/`blockedAction`) is in the i18n dictionary
across all five languages (owner's `translation-v.01.txt`; note it uses the simpler `consent.blocked*` keys, NOT
the spec §8 draft's superseded `block.*` proposal), and the trigger was already LOCKED (block immediately when any
of services/fg/bg is off = non-null `locationBlockReason`). So the screen became editor-buildable.

**Decision.** Built it: `tracker.evaluateLocationBlock()` (native reads → the pure, tested `locationBlockReason`,
FAIL-OPEN to `null` on any uncertain read) + `openLocationSettings(reason)` (services_off → `LOCATION_SOURCE_SETTINGS`;
permission → `Linking.openSettings()`); NEW `src/ui/LocationBlock.tsx` overlay modeled on `AppLock` (owner copy,
"Open settings" CTA, re-checks on foreground, swallows Android back, `zIndex 55` below AppLock's 60, native +
signed-in only); mounted before `<AppLock/>` in `_layout.tsx`. Wired against the **wired** `consent.blocked*` keys,
not the spec's `block.*` proposal (the wired copy is the human-approved reality). Composition with the shipped
withdrawal signal is **spec-literal, owner-chosen via AskUserQuestion 2026-08-15**: a revoked background PERMISSION
keeps routing through `syncConsentWithPermission` (master alert + disarm) + the `/consent` wall on next open — which
clears `armed`, so `evaluateLocationBlock` returns `null` for that case and the block settles durably on
device-Location-OFF (services). Chosen over gating the block on a durable consent marker (would block permission-off
immediately too, but more state + double-fire) and over re-firing `/consent` on foreground (touches ConsentGate's
once-per-session invariant). No new tests — `tracker.ts`/UI are device-only (no stub), the pure brain is already
pinned in `antiCircumvention.test.ts`; no new i18n keys, so the parity count is untouched.

**Consequence.** 41d is now fully editor-complete. Gates: `tsc` 0 · `npm test` 552/552 (unchanged) · eslint 0 errors
(2 pre-existing `_layout` warnings). No contract change, no new dep. Commit `dd6a4c3` (local — push 403s).
**DEVICE-UNVERIFIED** (rolls into the aggregate Phase-41 native build): turn off device Location → overlay raises;
"Open settings" reaches the right page; return with it back on → clears; Android back can't escape. The one accepted
gap the owner signed off on: a mid-session permission-revoke shows no block until the next app open (withdrawal path
handles it meanwhile). Full path: `docs/spec/PHASE-41.md` §8 (41d).

## 2026-08-15 — Phase 50 (new owner request): dual-office geofence + out-of-range / early-clock-out reason → super-admin. SPEC + [api], no build

**Context.** Owner asked (2026-08-15): clock in/out from EITHER of two Surat offices (200 m); an out-of-range
clock-in/out is ALLOWED but must carry a reason → super_admin; an early clock-out must also carry a reason →
super_admin.

**Decision.** Do NOT build on mobile yet — capture it as Phase 50 (spec `docs/spec/PHASE-50.md`) + a filed `[api]`.
Reasons, all rule-grounded: (1) **Backend-first** — verified the server currently **403s** an out-of-range clock-in
(`timeTracker.js:259`), so a reason can never be captured client-side; it knows only ONE office; it stores no reason
and raises no such alert. This REVERSES the refuse model → a backend contract change, not a mobile-only wire-up (same
posture as Phase 43). (2) **No client coordinate literals** — the two office pins belong in the panel/DB; Phase 7
specifically removed a hardcoded Surat geofence pin, so hardcoding these would repeat a corrected anti-pattern. Filed
the two ADDRESSES for the owner/panel to geocode. (3) **Don't invent the unknowns** — "early", reason-mandatory,
two-offices-vs-per-member, combined-vs-separate prompt are undefined; flagged all as owner-to-confirm (Phase-45
pattern) rather than guessing. "early" recommended = before `shiftEnd` (already in `timeTracker.js:133`, grounded).
(4) **Reason-prompt UI needs 5-language human copy** (same i18n blocker as 41d app-block) — can't build the prompt yet.

**Consequence.** The feature is specced + the backend ask is filed with the design + open points; mobile builds only
after cgpe-api ships + the pins are set + the owner confirms the 5 flagged points. No `src/` change this turn.
Full path: `docs/spec/PHASE-50.md`; INBOX ask filed 2026-08-15.

## 2026-08-15 — Phase 41d continued: consent-withdrawal signal BUILT (owner-approved), app-block brain built, gap-detector [api] FILED

**Context.** After the mock-rejection build (below), the owner approved (AskUserQuestion 2026-08-15) pursuing the
other three §5 parts: the app-block screen, the consent-withdrawal signal, and filing the backend gap-detector.

**Decision.** (1) **Consent-withdrawal signal — BUILT.** `syncConsentWithPermission()` on app foreground (native-only
`PermissionMonitor` beside `ConsentGate`): a consented 24/7 user whose OS background permission is revoked →
`setLocationConsent(false)` (Phase 43 master notify) + `stopAmbientTracking`. Made it **fail-safe against spurious
master alerts**: `armed`-gated, a FAILED permission read returns early (never signal on uncertainty — the risk was
`getBackgroundPermissionsAsync().catch(()=>null)` defaulting to "not granted" and firing a false withdrawal), and it
self-clears so one revocation = one alert. (2) **App-block — BRAIN ONLY.** Built + tested the pure `locationBlockReason`
but did NOT build the screen: a user-facing gate needs **5-language human copy** (machine translation forbidden) + an
owner trigger decision. Building a screen with English-only or invented copy would violate the i18n rule and ship dead
keys. So the brain waits for copy; wiring it behind `PermissionMonitor` is then a small follow-up. (3) **Gap-detector —
FILED, not built here.** It is backend-owned (§5/§7), and its threshold + "expected window" are owner POLICY numbers I
must not invent — so I verified cgpe-backend has none, grounded the ask in its real scheduler/notify patterns, and filed
a top-of-queue `[api]` recommending the mechanism with the numbers **flagged for owner + cgpe-api to confirm** (Phase-45
pattern), then grepped the reply back durable.

**Consequence.** §5's client side is now as complete as it can be without owner copy: spoofed fixes are dropped, a
revoked permission is a loud (not silent) opt-out, and the enforcement observability is filed to the backend where §5
puts it. The ONLY remaining 41d work is (a) the owner's 5-language app-block copy → then wire the screen, and (b)
cgpe-api shipping the gap-detector. Gates: `tsc` 0 · `npm test` 552/552 · eslint 0 errors (2 pre-existing `_layout`
warnings). Commits `5fe05bc` (code). INBOX ask filed 2026-08-15. Full path: `docs/spec/PHASE-41.md` §8 (41d).

## 2026-08-15 — Phase 41d PART BUILT (editor): mock-location rejection; the other three §5 parts are owner-input / backend

**Context.** §5 anti-circumvention has four parts: (1) permission-monitor + app-block, (2) mock-location rejection,
(3) backend silent-user gap-detector → master alert, (4) consent-withdrawal auto-signal. Verified feasibility
against real code, not tags: `expo-location.LocationObject.mocked?:boolean` exists (SDK 57); `setLocationConsent`
exists; Phase-43 withdrawal-notify is live (`timeTracker.js:1425`); and cgpe-backend has **no** gap-detector (grep).

**Decision.** Build only the part with no blockers — **mock-location rejection** — and hold the rest for owner input.
Pure `dropMocked` in `src/lib/antiCircumvention.ts` (tested), wired into `ingest` so a fake-GPS fix never enters the
record. Chose **drop** over **label** (spec says "reject/label") because labelling would need a new backend field,
whereas dropping needs nothing AND is self-enforcing: a spoofer whose fixes are dropped goes silent, which the
backend gap-detector (part 3) flags — transparent, no fabricated data. Deliberately did NOT build the other three:
part 1's app-block needs **5-language human copy** (machine translation forbidden) + a trigger spec-lock; part 4's
auto-signal auto-notifies ALL masters (a blast-radius policy call + device-only wiring — a bad read could spam
spurious withdrawal alerts); part 3 is backend-owned with an undefined policy threshold ("X hours") I must not
invent (Phase-45 pattern: file with a recommended-and-flagged number once the owner sets it).

**Consequence.** The mobile-buildable anti-spoof is done + tested; §5's real enforcement centre of gravity is the
backend gap-detector + the owner-supplied app-block copy, so 41d is genuinely mostly NOT a mobile-editor build. Next
steps are owner decisions (app-block copy/trigger, withdrawal-signal policy, gap-detector threshold) — then file the
`[api]` and/or build the signal. Gates: `tsc` 0 · `npm test` 546/546 (+6) · eslint 0. Commit `08dd00f` (local — push
403s). DEVICE-UNVERIFIED (fake-GPS app on a handset). Full path: `docs/spec/PHASE-41.md` §8 (41d).

## 2026-08-15 — Phase 41c BUILT (editor): motion-adaptive sampling via expo-sensors; applied at restart, not mid-session; numbers pending lock

**Context.** 41c (PHASE-41 §3/§4) is "sparse when still, denser when moving." §4 left the activity SOURCE
open (expo-sensors DIY vs a native Google Activity Recognition module) and §12.8 frames adaptive sampling as
a lever to pull only IF the on-device battery measurement shows the 24/7 service over budget. The spec fixes
NO sampling numbers. Via AskUserQuestion (2026-08-15) the owner chose **"expo-sensors classifier now"** over
the pure-seam-only and the native-AR options — build a complete 41c in the editor, accepting it is coarser
and device-unverifiable. Read the SDK-57 accelerometer docs first (AGENTS.md): `{x,y,z}` in g, plain
Accelerometer needs no permission.

**Decision.** In-house Accelerometer classifier. The signal is the **rotation-invariant std-dev of the
sample magnitude** (gravity contributes ~1g in any orientation, so spread = real movement) → still/moving.
Kept the safety-critical logic PURE + tested in `src/lib/motion.ts` (`classifyMotion`, `samplingProfile`,
`debounceMotion`, `resolveMotion`), because `tracker.ts` is device-only (no stub). Three deliberate calls:
(1) **`ACTIVITY_RECOGNITION` NOT added** — the plain Accelerometer doesn't need it and adding an unused
dangerous permission is permission-creep; it's only for the step-counter / Google-AR path. (2) **Profile
applied at each service (re)start, NOT via a mid-session stop+start** — a live reconfigure would fight 41b's
reliability work and flicker the foreground notification, and (3) the accelerometer **pauses in the
background**, so `still` rarely activates for a pocketed phone anyway — mid-session churn would buy almost
nothing. (3) **A stale `still` fails safe to `moving`** (`resolveMotion`, 5-min freshness) so an out-of-date
reading can never under-sample and drop a route; `moving` (the denser, safe direction) never expires.

**Consequence.** A real, tested, wired classifier that is honestly a **foundation**: its real-world effect
is limited (foreground-only classification + restart-time application), which is exactly why §12.8 says to
MEASURE battery on-device before investing more. The upgrade path if the measurement demands it: the native
Activity Recognition source (§4 option 3) for true background still/walking/driving, and/or mid-session
reconfigure. **NUMBERS are PROPOSED DEFAULTS pending an owner lock** (spec has none): STILL time-interval
5 min (×5 the MOVING 60 s; only the time intervals lengthen, accuracy+distance stay usable), still/moving
threshold 0.05 g (derived: still noise ≈0.02 g, walking ≫0.1 g). Each is one named constant. One new native
module ⇒ needs a native APK build, NOT OTA. Gates green: `tsc` 0 · `npm test` 540/540 (+16) · eslint 0 on
touched files. Commit `25d3d5b` (local — push 403s). DEVICE-UNVERIFIED. Full path: `docs/spec/PHASE-41.md`
§8 (41c).

## 2026-08-15 — Phase 41b BUILT (editor): reliability watchdog; ONE watchdog covers both OEM-kill AND reboot, no native BootReceiver

**Context.** 41b's job (PHASE-41 §2.3/§2.4) is to keep the 24/7 recorder alive against the two things the
foreground service alone cannot survive: an aggressive-OEM Doze kill, and a device reboot (expo-location's
task does not survive a reboot). The spec §2.3 recommended a hand-written native Kotlin `BootReceiver` (+
`RECEIVE_BOOT_COMPLETED`) for the reboot case, and §2.4 a periodic `expo-background-task` watchdog for the
kill case. I read the SDK-57 `expo-background-task` docs first (AGENTS.md): registered tasks are "saved in
persistent storage and restored once the app is initialized… if the device reboots, background tasks will
resume" — i.e. WorkManager restores the periodic task after a reboot.

**Decision.** Build ONE watchdog (`expo-background-task`, 15-min floor) that covers BOTH cases, and do NOT
hand-write a native `BootReceiver`. Whenever the watchdog runs — on its interval, or when WorkManager
restores it after a reboot — it checks `hasStartedLocationUpdatesAsync` and re-arms the recorder if it
should be live but isn't. The re-arm decision is the pure `watchdogAction({armed,hasShift,running})` →
`rearm`/`idle`/`retire`, lifted into `src/lib/watchdog.ts` and pinned by `watchdog.test.ts` (+11), because
`tracker.ts` is device-only (no expo-location/task-manager stub). Register/retire are paired to the
`startService`/`stopUpdates` chokepoints so the watchdog's lifetime exactly tracks the recorder's; `retire`
(nothing to record) unregisters it so it stops waking the device (§3 battery). Added `RECEIVE_BOOT_COMPLETED`
explicitly (WorkManager also brings it) to make the reboot-persistence contract explicit; `expo install`
auto-added the `expo-background-task` config plugin to `app.json`.

**Consequence.** Reboot re-arm lands within ~one watchdog interval (~15 min), not within seconds as a native
BootReceiver could — an accepted v1 trade (boring/debuggable over blind, unverifiable Kotlin; my standing
"cannot debug clever" rule). Consistent with §2's stated "honest ceiling" that ~100% survival is not
softwarely guaranteed. **Owner may veto** and ask for the prompt-boot native receiver later; the watchdog
stays regardless (it is the kill-case defence). One new native module + a new permission ⇒ this needs a
native APK build, NOT OTA (compounds with the expo-intent-launcher build already due from 41a part 2). The
whole §2 re-arm behaviour + the §3 battery cost of the extra periodic task are a real-handset acceptance
gate — DEVICE-UNVERIFIED. Gates green: `tsc` 0 · `npm test` 524/524 (+11) · eslint 0 on touched files.
Commit local (push 403s). Full path: `docs/spec/PHASE-41.md` §8 (41b).

## 2026-08-15 — Phase 48 BUILT: cgpe-api shipped the re-mint endpoint (Backend Phase 58), mobile restore flow wired + tested

**Context.** cgpe-api reported the filed Phase-48 `[api]` ask done. Per protocol I verified their real
`routes/auth.js` + `models/RefreshToken.js` line by line (not the summary): PUBLIC `POST
/auth/refresh-biometric` (no `protect`), `jwt.verify` without `ignoreExpiration` (>30d refused), a
`typ:'refresh'` check that refuses a replayed access token, an allow-list row (exist + un-revoked + not
past expiry), rotate-on-use, reuse-of-revoked revokes the whole chain, flat `401 INVALID_REFRESH` / `400`
/ `503`, additive `refresh_token` at login/verify-otp, revoke-on-logout scoped to `{jti,user_id}`, token
never logged, 30d TTL index. It matches the ask exactly; they chose the refresh-token model over the
weaker sliding-session for the revocation D-2 needs. So the backend was perfect → I built the mobile side.

**Decision.** Built the mobile restore flow (5 files, no contract change, no native dep — JS-only so it
stays OTA-eligible). **The sealed value became the 30-day refresh token, not the 24h access token**
(`biometricIdentity.ts` `BoundIdentity.refreshToken`/`RECORD_VERSION` 1→2 to orphan v1 access-token
records fail-closed) — the access token dies before the "2 days later" scenario and the server refuses a
non-refresh token, so sealing it would be dead weight. `refreshBiometricSession()` uses low-level `req()`
(public, no bearer, no health side effect) with a three-outcome result: `ok` **requires a rotated
refresh_token on the 200** (a partial body → `error`, never a session — a stale seal would fail closed
next time); `declined` on 400/401 (an answer, and verified it can't cascade into a session-expiry because
no bearer is sent, so `reportAuth` never trips); `error` on 5xx/network (retryable). D-2 is enforced on
BOTH sides: `logout()` calls `serverLogout(refreshToken)` to revoke server-side before `clear()` destroys
the local binding; silent expiry still keeps the binding so restore works. `setBiometric` no longer
refuses the toggle when a session lacks a refresh token (app-lock only needs a live fingerprint; the seal
is a separate, restore-only concern). The login screen shows a gated "Unlock with fingerprint" affordance.

**Consequence.** Phase 48 is BUILT editor-side; device + security review carried (needs cgpe-api's `:3001`
restart for the live endpoint). Gates: `tsc` 0 · `npm test` 513/513 (+18, `api-refresh-biometric.test.ts`)
· eslint 0 errors (3 pre-existing warnings, none new). Commit local (push 403s). With 48 built, only Phase
49 (final APK → OTA) remains, gated on all-device-verification + the `git push` fix. Full path:
`docs/spec/PHASE-48.md` §6.

## 2026-08-15 — Phase 48: biometric-only session restore = restore-not-create, silent-expiry-only, 30-day window, needs a new backend re-mint endpoint

**Context.** Owner backlog Phase 48 ([sec], do last): return 2 days later logged-out → back into your OWN
account with fingerprint/face only, no id/OTP. Verified both trees first (tags wrong 5×). Mobile: the sealed
`(userId, token)` write-half is wired (`biometricIdentity.ts` + `auth.tsx`), the read-half
(`resolveBoundIdentity`) is fully built but has ZERO callers; today's login "biometric" is only a liveness
gate before a full id+password login, not a restore; explicit logout DESTROYS the binding on purpose, while
silent `onSessionExpired` does NOT. Backend: access tokens expire at **24h** (`auth.js:61-65`); `POST
/auth/refresh` exists but is `protect`-gated and `jwt.verify` **throws 401 on an expired token**
(`middleware/auth.js:16,39-45`) — so it CANNOT resurrect the 2-day-old token. No refresh-credential /
device-reauth route exists. So restore needs an `[api]` re-mint endpoint; it is not a pure `[m]` wire-up.

**Decision.** Owner-locked via AskUserQuestion (2026-08-15): (D-1) **restore the existing sealed session**,
not create a new account; (D-2) **only after a SILENT 24h expiry — never after an explicit "Log out"**
(keep destroy-on-logout; explicit logout forces a full login), enforced server-side too via revoke; (D-3)
a **bounded ~30-day** re-entry window, then a full login. Wrote `docs/spec/PHASE-48.md` (security-reviewed
design) and filed a verified `→ cgpe-api · from cgpe-mobile` INBOX ask: recommended a device-bound
`refresh_token` (30d, allow-list row, rotate-on-use) issued at login + a PUBLIC `POST
/auth/refresh-biometric` (not `protect`-gated) + revoke-on-logout; offered a simpler `ignoreExpiration:true`
sliding-session alternative and flagged it lacks server-side revocation (so it wouldn't enforce D-2).
Mechanism is `cgpe-api`'s call. **No mobile code built** (building the restore flow against a non-existent
endpoint = untested 404 dead code; Phase 43/45 file-first pattern).

**Consequence.** Phase 48 is now spec-locked + filed, waiting on `cgpe-api`. When they ship the re-mint
endpoint + contract, the `[m]` build: seal the refresh token instead of the access token (bump
`RECORD_VERSION` 1→2 to orphan v1 records), add `refreshBiometricSession()` (two-outcome `req()` +
`api-refresh-biometric.test.ts`), wire `resolveBoundIdentity` on the login screen, keep D-2's
destroy+revoke on explicit logout and NO-clear on silent expiry, then a device + security review. No `src/`
change → no gate re-run (baseline: `tsc` 0, `npm test` 495/495, lint 0 errors / 12 warnings). Full path:
`docs/spec/PHASE-48.md`.

## 2026-08-15 — Phase 47: "Viewing as" gated on the real super_admin role, not a per-account flag or a phone literal

**Context.** Owner backlog Phase 47 asks to keep the "Viewing as" (tier-preview) row for "one number only"
(`9106988376`). Rule 1 forbids a phone literal in `src/` (the email literal was removed in Phase 11 for exactly this
reason), and that number is one of the THREE accounts promoted to `super_admin` in Phase 38 — so the app has no
per-account field distinguishing one master from another. Hitting literally-one-account would need a NEW per-profile
capability flag on the backend `Profile`, surfaced to the app (an `[api]` ask, Phase-38 courier shape). Verified first
that "Viewing as" is harmless to widen or narrow: it is pure client state (`auth.tsx:56`, never persisted, reset on
logout) and a downward-only preview (`capabilitiesOf` clamps to `≤` the real tier, `roles.ts:100`) — it can never
escalate. The old gate `realCaps.manageTeam` showed it to the whole admin tier (leader folded in).

**Decision.** Owner chose (AskUserQuestion, 2026-08-15) to **gate on the real `super_admin` role** — a pure-`[m]`,
ship-today change — over filing a new backend flag, accepting that all three master accounts keep the row while every
admin and leader loses it. Built NEW pure `canViewAs(user)=user?.role==='super_admin'` in `store/roles.ts` (parallel
to the Phase 39/40/45 `super_admin` predicates, kept separate so they can't drift); `more.tsx` gates the Personal-tail
row on it, reading the REAL role so a master previewing a lower tier still sees the row to switch back. +4 `roles.test.ts`
cases.

**Consequence.** No `[api]` ask, no contract change, no phone literal. If the owner later wants exactly-one-account,
file the per-profile flag to `cgpe-api` and swap `canViewAs` to read `user.<flag>` — the app-side seam is already a
single predicate. Gates: `tsc` 0 · `npm test` 495/495 (+4) · eslint 0 errors (1 pre-existing `more.tsx` warning).
Commit local (push 403s). Full path: `docs/spec/PHASE-47.md`.

## 2026-08-15 — Phase 49 added: final APK + one-click link, then OTA-only updates (with an honest native-change caveat)

**Context.** The owner asked, in plain terms, for the very last deliverable: after everything is done, build ONE final
APK, hand a single one-click download link, and make that the LAST link ever — every future update should reach
installed phones "directly from code" with no new link. The obvious-but-dishonest move is to promise "no more links,
ever." That is false: over-the-air (OTA) updates can ship only the JavaScript/asset layer.

**Decision.** Added **Phase 49 (Group I — Ship)** to `docs/PLAN-2026-08-14.md`: pre-flight (gates green + device
backlog cleared + `git push` fixed) → wire `expo-updates`/EAS Update on the `production` profile → `eas build -p
android --profile production` (signed APK for a direct download) → thereafter `eas update` ships JS/content changes OTA.
**Wrote the hard limit into the plan explicitly:** OTA cannot ship a native change (new module, permission, SDK/RN bump,
icon/package/signing) — that always needs a fresh APK. Concretely, Phase 41's tracker already added a native module
(`expo-intent-launcher`) + permissions, so at least one more native build is due before the "final" APK. Marked
**Phase 41 as the owner's #1 next priority.**

**Consequence.** The roadmap now has a defined end state and an honest promise: "last link ever" = for JS/content
updates, not native ones. Owner must fix the `git push` 403 (all commits are local) and hold the signing key. Docs-only
change, no gate impact. Commit `c4f40bb` (local — push 403s).

## 2026-08-15 — Phase 39: the master monitoring surface is a HUB reached from More, not a per-member card or a tab

**Context.** Owner backlog Phase 39 wanted a dedicated master view of each member's performance / location / salary,
no task UI. Verified first that every one of those lenses ALREADY exists as its own screen and is ALREADY master-gated
(`agent-map`/`agent-track`, `performance?view=team`, `payroll`, `team/[id]`) — they were just scattered in the More
menu. So the question was purely shape, and two shapes were genuinely undecided.

**Decision.** Locked with the owner via AskUserQuestion: **(1) shape = a monitoring HUB** — one new `/monitor` screen
with a lens grid (Locations first — "most important" — Movement, Performance, Payroll) over the `getTeam()` roster,
each item opening its existing screen; NOT a per-member unified card (that needs per-member location/payroll deep-links
that don't exist = new backend). **(2) entry = pushed from More** (a master-only "Monitor" row at the top of Master
control), NOT a bottom tab (`nav.tabs` is DB-driven — a master-only tab would need an `[api]`/RBAC change, out of a
pure `[m]` scope). Gated on the REAL `super_admin` via a NEW pure `canMonitorTeam(user)` — parallel to
`canSeeLiveLocation`/`canSeeTeamPerformance`, kept a separate predicate so the three can't drift; the hub is a
convenience entry only, each destination keeps its own gate. No task UI (explicit owner constraint). The hub invents
nothing — no scores/salary of its own (server-owned on the destinations), only roster identity + live duty.

**Consequence.** Gates green (`tsc` 0, `npm test` 491/491 (+4), eslint new/touched 0 errors). No contract change — pure
`[m]` over existing endpoints. Device check carried (real-master reach + admin/leader refusal). Commit `2750794`
(local — push 403s). Full path: `docs/spec/PHASE-39.md`.

## 2026-08-15 — Phase 46: greeting emoji rendered as its own element, not folded into `greet.*`

**Context.** Owner backlog Phase 46: add a tasteful emoji to the greeting copy. The greeting renders in five languages
(`greet.morning`/`afternoon`/`evening` in en/gu/hi/hi-en/gu-en). The obvious-but-wrong move is to append the emoji to
the English dictionary string (leaves four languages without it) or to string-concatenate it onto the translated word
(risks Hindi/Gujarati word order — the standing i18n rule forbids concatenation).

**Decision.** Chose a **time-of-day** glyph off the greeting's own existing hour cutoffs — 🌅 (`hour < 12`) / ☀️
(`< 17`) / 🌆 (else) — derived as `greetEmoji` right beside `greet` in `(tabs)/home.tsx`, and rendered as a **standalone
`<Txt>` element** after `{greet},` in the header row. Because it is a separate element, all five languages share the one
glyph and no translated string is touched. Wrapped in a `View` with `accessibilityElementsHidden` /
`importantForAccessibility="no-hide-descendants"` so assistive tech reads the greeting, not "sunrise" (the `Txt`
primitive does not forward a11y props, so the wrapper — not props on `Txt` — carries the hint; `tsc` caught the first
attempt).

**Consequence.** Gates green (`tsc` 0, `npm test` 487/487 unchanged — presentational, lint home.tsx clean). No contract,
no backend, no i18n-dictionary change — pure `[m]` render. Device visual check carried (native emoji rendering/alignment,
light/dark at 390px). Commit `153ecc6` (local — push 403s). Full path: `docs/spec/PHASE-46.md`.

## 2026-08-15 — Phase 45 RENDER built: self + master-only team performance screen; visibility owner-locked

**Context.** With the backend live and the reader in, the render needed two product decisions I must not guess (it is
per-person performance data, the Phase-40 privacy class): who sees it, and where it lives.

**Decision.** Owner locked (AskUserQuestion, 2026-08-15): **each member sees their OWN score; only `super_admin` sees
the whole team.** Built ONE screen `src/app/performance.tsx` with two views by `?view=` param — self (`/performance`,
`scope:'own'`, ungated because the server self-scopes to the token) and team (`/performance?view=team`, `scope:'all'`,
gated). Added NEW pure `canSeeTeamPerformance(user) = user.role === 'super_admin'` in `store/roles.ts` — the roster gate
reads the REAL role, never the folded tier (an admin/leader must not see everyone's score; identical reasoning to
`canSeeLiveLocation`). Screen waits for `ready` before the "Owner access only" refusal (agent-map pattern). Wired two
More-tab tiles: "Team performance" (master-only, in the Master-control group) + "My performance" (ungated, Personal
tail). Pinned the gate across all roles in `roles.test.ts`.

**Consequence.** Gates green (`tsc` 0, `npm test` 487/487, lint 0 errors). No contract change (pure consumer). The app
renders the server's score/counts and NEVER recomputes (rule 2) — `score:null` shows an em dash + "no tasks", never a
fabricated 0%; only the server's on-time/late fact is coloured, so the screen invents no pass/fail threshold. Device
check carried (native + backend-live-gated on cgpe-api's `:3001` restart). If the owner later wants managers/leaders to
see their own team's scores, that is a gate widening (`scope` already supports a leader's team server-side) — a new
decision, not a mobile guess. Full path: `docs/spec/PHASE-45.md`.

## 2026-08-15 — Phase 45 backend SHIPPED (cgpe-api Phase 53) + VERIFIED + month-basis owner-confirmed + mobile reader built

**Context.** Same day as filing, `cgpe-api` shipped `GET /api/team/task-report` (Backend Phase 53). Their reply
flagged that the **month basis** (due-month vs completion-month) was shipped to the mobile+backend recommendation but
NOT yet owner-confirmed.

**Decision.** Accept it — verified their real `routes/team.js` line by line against every owner-locked def and it
matches exactly (cancelled excluded from both sets, manager-assigned only via `creator ≠ assignee`, reminders +
Unassigned dropped, `score = round(100×earned/possible)` P1:3/P2:2/P3:1 + on-time ×1.0 / late ×0.5, `possible===0 →
null`, IST due-month bucket). Resolved the open point directly with the owner (AskUserQuestion, 2026-08-15): **due-month
confirmed** — no completion-month switch needed. Built the mobile data reader `getTaskReport(month,{scope,userId})` +
pure `mapTaskReport` (two-outcome `req()` — 403 = quiet answer, outage = banner; server owns every count/score, app
never recomputes; `score:null` distinct from `0`) + `api-task-report.test.ts` (16). Recorded mobile verification under
the INBOX item (grepped durable).

**Consequence.** Gates green (`tsc` 0, `npm test` 483/483, lint 0 errors). No contract change (pure consumer). The
reader has **no UI consumer yet** — the render is a separate device phase feeding Phase 39 (the master monitoring
surface), and its visibility gating is master/admin-only (the Phase-40 role-gating class: gate on the REAL role, never
the folded tier, or performance data leaks to every admin/leader). A future weight/cutoff change is a new `[api]` ask
with the owner's exact numbers, never a mobile recompute. Full path: `docs/spec/PHASE-45.md`.

## 2026-08-15 — Phase 45 (completed-tasks report + performance score): genuine gap; score LOCKED with owner (not invented); FILED to cgpe-api

**Context.** Owner backlog Phase 45: a per-member report of what they completed, when, and how much, plus a
performance score — counting **only** tasks that were assigned by a manager AND actually completed (not reminders,
not self-created, not cancelled). The plan warned: **do not invent the score weights — lock with the owner** — and
verify the backend first (tags wrong 5×), because an aggregate may already exist.

**Decision.** File a NEW `[api]` ask — this is a genuine gap (contrast Phases 38/43/44, already-satisfied). Verified
in real code that nothing computes it: `GET /team/task-overview` (`team.js:27`) counts `cancelled` as done (`:23`)
and its denominator includes self-created + reminders; `StaffScore` (`staffScores.js`) is **manually typed** by an
admin, not derived; `reports.js`/`dashboard.js`/`tasks.js` have no per-member score. The raw data exists in
`team_tasks` (incl. `statusHistory:[{status,at,by}]` at `:240` for completion time), so no schema change is needed.
**Score locked with the owner via AskUserQuestion (2026-08-15), all four:** (1) importance + timeliness —
`score = round(100 × earned/possible)`, `possible = P1:3/P2:2/P3:1`, `earned = ×1.0` on time / `×0.5` late / `0`
unfinished, **null when no tasks (never 0%)**; (2) cancelled ≠ completed; (3) only manager-assigned counts —
self-created never (recommended `creator ≠ assignee`, justified by `tasks.js:241` stamping `assigneeName = actor`);
(4) per calendar month. Filed to `contracts/INBOX.md` (`→ cgpe-api`, grepped back durable) with a recommended
`GET /team/task-report?month=YYYY-MM` shape; flagged one open definition point (which date stamps the month —
recommend due-month) for cgpe-api + owner to confirm.

**Consequence.** No `src/` change → **no gate re-run** (baseline: `tsc` 0, `npm test` 467/467, lint 0/12). Live only
when cgpe-api ships the aggregate (+ `api.md`/`models.md`) and a later `[m]` phase renders it (`getTaskReport` + a
per-member surface, feeding Phase 39) + a device check. A future change to the weights/cutoffs is a **new** `[api]`
ask carrying the owner's exact numbers — never a mobile guess (rule 2 / rule 4). The app renders `score`; it never
computes it. Full path: `docs/spec/PHASE-45.md`.

## 2026-08-15 — Phase 44 (strict salary from hours/days) is ALREADY SATISFIED; verified, owner-confirmed as-is, zero change

**Context.** Owner backlog Phase 44: salary computed from actual working hours/days, shown as one amount. The plan
told this session to "file the exact inputs/rounding" of the formula to `cgpe-api` (rule 2 — the app never
multiplies). Before filing, verified whether a strict hours/days formula already existed (the plan text predates
recent backend work; `[api]` tags have been wrong 5×).

**Decision.** File **nothing** and build **nothing** — the strict engine already exists, is owner-locked, and is
live. Verified in real code (both trees): `services/payrollEngine.js` (Backend Phase 25b, locked 2026-08-11) —
`base` flat, `day_wise = (salary/working_days)×present_days`, `hourly = (salary/working_days/office_hours[8.5])×
worked_hours`, `working_days = days − Sundays − holidays`, `payable` rounded to ₹1; `services/payrollAttendance.js`
reduces the **live `daylogs`** with owner-locked fixed cutoffs (≥8h full / ≥4h half / <4h absent, spec row 15);
`routes/payroll.js` `buildRoster()` joins by Profile ObjectId `_id` (`:335`). Exposed self-scoped via
`/payroll/my-earnings` (`user_id` forced to token, above the admin gate) and admin-scoped via `/payroll/compute`,
both on the same engine. Mobile already renders it (`earnings.tsx` Phase 16/28, `payroll.tsx` Phase 20) — the
server `payable` as one amount plus the hours/days basis, never multiplying. The owner was shown the exact live
formula via AskUserQuestion (2026-08-15) and chose **"correct as-is."**

**Consequence.** No `[api]` INBOX ask (nothing missing — a "please build a salary formula" ask would be wrong),
no `src/` change → **no gate re-run** (baseline stands: `tsc` 0, `npm test` 467/467, lint 0/12). A future change to
the 8h/4h cutoffs or the Sat/Sun/holiday working-days basis would be a **new** `[api]` ask carrying the owner's
exact numbers — never a mobile guess (rule 2 / rule 4 / never invent). Only the existing carried payroll-screen
device check remains. Docs: `docs/spec/PHASE-44.md`.

## 2026-08-14 — Phase 43 SHIPPED by cgpe-api same-day (Backend Phase 50) + VERIFIED against real code; mobile confirmed zero-change

**Context.** The Phase 43 filing (below) was answered by `cgpe-api` the same day as Backend Phase 50. Per the
courier rule ("re-read the producer's real code before wiring the app side — tags wrong 5×"), verified rather
than trusting the "mobile owes zero change" summary.

**Decision.** Verified in their source and confirmed mobile owes zero change — no `src/` edit. Checked:
`getMemberGeofence(userId)` (`utils/geofence.js:91-112`) resolves member `payroll_profiles.start_location` →
office → default, centre-only (org radius/enforce kept), `+source`; clock-in enforces the caller's fence
(`routes/timeTracker.js:322-323`); `GET /geofence` returns it with the **unchanged** `{lat,lng,radius_m,label,
enforce}` shape + additive `source` (`:1274-1277`); the flagged `PUT /geofence` 2000→200 default bug is fixed
(`:1296-1298`). Mobile's `getGeofence`/`checkGeofence` (`src/data/api.ts:1707/1788`) map the fixed shape and
ignore `source` (inert); the `label`→"Your assigned location" is inert too (clock-in copy is distance-based).

**Consequence.** No `src/` change → **no gate re-run** (baseline stands: `tsc` 0, `npm test` 467/467, lint 0/12).
RE-VERIFIED note filed under the (cgpe-api-owned, already-ticked) INBOX item, grepped back durable. Phase 43 is
now backend-live-pending-restart; the only remaining mobile task is a **device check** (member inside pin clocks
in; ~201 m away refused with the measured distance) once an admin sets a `start_location`. Docs: `docs/spec/
PHASE-43.md` §8.

## 2026-08-14 — Phase 43 (per-member 200 m clock-in fence) is a pure `[api]` phase; VERIFIED + FILED, zero mobile build

**Context.** Owner backlog Phase 43: each member has their own set location and clock-in is allowed only within
200 m of it, not the single shared office fence. Two verification sweeps (backend real code + `contracts/`,
both trees) established the current state before any code was considered.

**Decision.** File it to `cgpe-api`, build nothing mobile-side. Verified that clock-in enforces ONE global
office fence keyed to nobody (`checkClockGeofence` has no user/profile param, `utils/geofence.js:80`;
`GET /geofence` serves the same fence to all, `routes/timeTracker.js:1267`); the two per-member fields that
exist (`Profile.attendanceRules.geo`, `PayrollProfile.start_location`) **do not drive clock-in** — the first is
break-fence-only and null everywhere, the second is documented as "the clock-in pin" but read only by
`routes/payroll.js`. So per-member enforcement is entirely backend-owned (data field + caller-keyed
`checkClockGeofence` + non-regressive fallback + set/self-read endpoints). Mobile clock-in is already
server-authoritative and fence-shape-agnostic (`getGeofence`/`checkGeofence`, `src/data/api.ts:1707/1788`; 403
`message`+`distance_m` verbatim), so a per-member fence served through the existing `GET /geofence` just works
with **no `src/` change** — the Phase 27 / Phase 38 "pure backend, mobile fail-open consumes" pattern.
Recommended (but did not dictate) `PayrollProfile.start_location` as the source field + a non-regressive
member-pin→office→default fallback; the field/unit/radius choice is `cgpe-api`'s.

**Consequence.** No `src/` change → **no gate re-run** (baseline stands: `tsc` 0, `npm test` 467/467, lint 0
errors / 12 warnings). Deliverable is `docs/spec/PHASE-43.md` + a top-of-queue `→ cgpe-api · from cgpe-mobile`
INBOX ask (grepped back durable, 1 hit) + a plain-language owner-relay copy. Per-member fencing is live only when
`cgpe-api` ships enforcement + a panel way to set each member's pin + an on-device check. The 200 m + 100 m
accuracy credit → ~300 m effective rule the roadmap asked us to confirm is confirmed and already mirrored by the
Phase-7 pre-check.

## 2026-08-14 — Phase 41a-iii-b part 2 BUILT in the editor (owner: "write it all now"), gates green but DEVICE-UNVERIFIED; the unified 24/7 recorder wired per PHASE-41 §12

**Context.** Yesterday's decision (below) was "don't author `tracker.ts` blind — write the plan." This session the
owner reversed that via AskUserQuestion: **write the full §12 code now** so the on-device session is pure
build-and-verify. The constraint kept from the prior decision: the non-consented recording path must stay
byte-identical (§12.1 graceful degradation), because a blind mistake in the repurposed `start/stopTracking`
could invisibly regress the working shift recorder (green gates ≠ working; `tracker.ts` has no test stub).

**Decision — what was built** (`src/lib/tracker.ts` + 3 wiring surfaces + `app.json` + `expo-intent-launcher`):
- **ONE unified recorder, attribution by `sid` at flush time** (§12.1). `ingest`: `sid` present ⇒ `deliver`
  (`/track/points`, unchanged); absent + armed ⇒ new `deliverAmbient` (`postAmbientPoints`, `off_duty`); absent
  + not armed ⇒ the exact PHASE-7 unattributable teardown, preserved. `start/stopTracking` repurposed to only
  set/clear the shift `sid` and ensure/keep the one service, never stop it, when 24/7 is armed.
- **New exports** `startAmbientTracking({prompt,notif})` / `stopAmbientTracking()`; new persisted markers
  `track.ambient` / `track.notif` / `track.batteryOptAsked`; battery-opt step in `ensureBackgroundPermission`.
- **Wiring:** `consent.tsx` onAgree → `startAmbientTracking({prompt:true, notif})` before Home; `_layout.tsx`
  ConsentGate boot-arm → `startAmbientTracking({prompt:false, notif})` on `ok+granted` (fail-open: `error`
  arms nothing). `home.tsx` clock-in/out unchanged (§12.5) — the new semantics live inside `tracker.ts`.

**Decision — deliberate reconciliations of the §12 plan** (all lean safe/boring):
- **D-a: read `track.ambient` FRESH from storage at each attribution branch, not a once-per-JS-start module
  flag** (deviates from §12.2's "read once"). A headless wake can invoke the task before a hydration promise
  resolves; a stale `false` would misread a consented ambient batch as unattributable and tear the 24/7 service
  down. Per-read is strictly more correct and the cost is one SecureStore read per ~60 s batch.
- **D-b: `startAmbientTracking` takes the resolved `notif` strings as a param** (§12.2 showed only `{prompt}`).
  `tracker.ts` has no i18n; §12.4 needs the RESOLVED (translated) notification persisted at arm time. The two
  arm call sites (consent screen, boot gate) both have i18n, so they pass `t('consent.serviceTitle'/'serviceBody')`.
- **D-c: battery-opt fires at most ONCE per install** (a `track.batteryOptAsked` flag; not in §12.3's text).
  §12.3 puts the step in the shared `ensureBackgroundPermission`, but §12.5 keeps clock-in calling it, so
  without the flag it would re-prompt on every clock-in. Side effect (flagged): a plain **shift** clock-in now
  also fires the one-time battery-opt prompt — beneficial for the shift service too, and recording semantics
  are unchanged.
- **D-d: `expo-intent-launcher` is a top-level static import**, not a lazy `require`. Its web/iOS shim is
  `export default {}`, so importing is safe on every platform (only a *call* throws off-Android, which is
  `Platform.OS==='android'`-guarded + try/caught). This keeps the lint baseline at 12 warnings (a `require`
  would have added a 13th, the storage.ts pattern).
- **D-e: boundary-batch slop accepted for v1** (§12.1/§12.8 device-call). A batch straddling clock-in/out
  mis-attributes by ≤ one ~60 s interval; not worth timestamp-splitting now.
- **D-f: `isTracking()` now means "service running (shift OR 24/7)"**, so it reads true for an armed,
  not-clocked-in user. Verified it has **zero consumers** in `src` (grep) — no UI regression; left as-is (dead
  export, not deleted per surgical-change rule).

**Consequence.** Gates green: `tsc` 0 · `npm test` **467/467** (unchanged — `tracker.ts` untestable, wiring
presentational) · lint **0 errors / 12 warnings** (baseline). **NONE of it is device-verified** — the §12.7
matrix (ambient `off_duty` points, attribution flip on clock-in/out without stopping the service, app-swipe
survival, battery-opt once, withdrawal→403→stop, fail-open boot, and battery drain measured over a real day on
3+ handsets) is the acceptance gate and needs a fresh EAS/dev-client build + handsets. Commit local (push 403s).
`stopAmbientTracking` is exported and ready but NOT yet wired to sign-out/withdrawal (no withdrawal UI yet; both
self-heal via the next ambient flush's `signed-out`/`consent-required`) — a later slice.

## 2026-08-14 — Phase 41a-iii-b part 2 is a build-and-device session (not editor); architecture LOCKED to one unified 24/7 recorder; device plan written (PHASE-41 §12)

**Context.** Owner chose "write the device-ready plan" over authoring the `tracker.ts` code blind. Checking
the native prerequisites first proved part 2 is not editor-buildable at all: `expo-intent-launcher` is **not
installed** (needed for the battery-opt exemption, §2.2), and `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` /
`RECEIVE_BOOT_COMPLETED` are **absent from `app.json`** — adding a native module + permissions changes the
native project, so it needs a fresh EAS build (not Expo Go). Plus `tracker.ts` has no test stub, so nothing
written for it is verifiable in the editor, and the file "looks fine in foreground, breaks only after a
process kill."

**Decision.** (1) **Do not author `tracker.ts` blind.** Writing a danger-zone refactor of the app's most
fragile file, gating only `tsc`/lint, would be declaring unverified work done (the karpathy #4 anti-pattern)
and could silently kill background GPS for the whole team. Instead, write a decision-complete execution plan
(PHASE-41 §12) so the on-device session is execution, not design. (2) **Architecture LOCKED: ONE unified
24/7 recorder**, not a second location task. Rationale: §2.1 ("reuse the shift recorder's service"), §3
battery (one GPS stream, not two), and a single Android location foreground-service/notification. The service
runs continuously under granted consent; clock-in/out only **set/clear the shift `sid`**, and `ingest`
attributes each batch by it — `sid` present ⇒ shift (`/track/points`), absent ⇒ ambient (`postAmbientPoints`,
`off_duty`). (3) **Graceful degradation LOCKED:** un-consented users keep today's exact shift-only behaviour,
so 24/7 is purely additive and can't regress anyone who hasn't consented — and a consent read that fails open
(`error`) never starts 24/7 recording blindly.

**Consequence.** No `src/` change this turn → no gate re-run (parts-1 gates stand: `tsc` 0, `npm test`
467/467, lint 0/12). The device session follows §12 (unified recorder + battery-opt step + persisted-i18n
notification + native build steps + a verification matrix whose hard gate is measured battery drain over a
real day on 3+ handsets). Commit `600628f` (local — push 403s). Part 2 is device/build-gated only, no longer
backend-gated (`909b117` live on `:3001`).

## 2026-08-14 — Phase 41a-iii-b (part 1) BUILT: the consent BOOT GATE (redirect) — pure decision seam + `_layout.tsx` wiring; `tracker.ts` device pieces still deferred

**Context.** Owner said "go" on 41a-iii-b. Re-checked the backend live-state first: `909b117 backend:
Phases 43-46 — location retention & ambient consent` is now **committed** (backend tree clean) and
cgpe-admin's INBOX re-verify confirms that exact commit is **live on `:3001`** (serving PID from 16:42:36),
so the "uncommitted / not restarted" hard-block from the last handoff is **gone**. What remains is the
device-only constraint: `tracker.ts` has no test stub, and the boot redirect changes app entry for every
user — its flash/loop/restored-route behaviour is verifiable only on a handset. 41a-iii-b is therefore two
unlike halves: the **boot-gate redirect** (editor-buildable app code — a decision + a `_layout.tsx` mount)
and the **`tracker.ts` device pieces** (ambient recorder + battery-opt + 24/7 notification — zero test path,
a danger zone).

**Decision.** Build the **editor-verifiable half now**, defer the device half — the same testable-slice split
every prior 41a step used. (1) **Extract the gate's decision as a pure predicate** `needsConsentGate(read)` in
`api.ts` beside `getLocationConsent`, so its ONE load-bearing safety property — **fail open** — is pinned by a
test, not buried in an effect: redirect ONLY on `ok`+non-granted (`pending`/`withdrawn`); `granted`→no, and
crucially `error`→**no** (an outage/legacy-backend/dead-network must never bounce every user to `/consent`).
(2) **Wire a headless `ConsentGate` at `_layout.tsx` level** (not `index.tsx`, which only mounts at `/`),
mounted beside `AppLock`/`JobPill` so it has the live nav context (JobPill navigates from exactly there).
Fires **once per signed-in session** (a `checked` ref, reset only on sign-out) so it cannot loop; the consent
screen's own success path `replace`s to Home and never re-triggers it. **No `let alive` guard** — the
component is process-lifetime (like AppLock) and does NO setState, only a one-shot `router.replace`; an
`alive` flag would actually swallow the redirect under StrictMode's dev double-mount. (3) **Native-only** —
the gate exists to enable the native recorder; web has none and the e2e web harness must keep reaching every
screen, so web is skipped outright. (4) **`/consent` cast `as Href`** — it postdates the last generated
route type (as `/earnings` already does in `attendance.tsx:240`) until `expo start` regenerates `.expo/types`.

**Consequence.** Gates green: `tsc` 0, `npm test` **467/467** (+3, `needsConsentGate` branches in
`api-consent-read.test.ts`), lint 0 errors / 12 warnings (baseline; my two touched src files add 0 new).
**No contract change** (pure consumer of the documented Phase 43 contract) → no INBOX/CHANGELOG. Commit local
(push still 403s). **Still deferred to the device pass (41a-iii-b part 2):** the redirect's on-device
verification (no Home flash-then-bounce, no loop, survives restored-route cold start) AND the whole
`tracker.ts` slice — the battery-opt step in `ensureBackgroundPermission`, the ambient recorder calling
`postAmbientPoints` on grant, and the neutral 24/7 foreground notification (the `consent.serviceTitle`/
`serviceBody` copy already exists from 41a-ii). Full path: `docs/spec/PHASE-41.md` §8.

## 2026-08-14 — Phase 41a-iii-a BUILT: `getLocationConsent()` boot-gate read (fail-open + fully silent); wiring + device pieces deferred to one device pass (41a-iii-b)

**Context.** Owner said "go" on Phase 41a-iii ("gating + device wiring"). But three of its four pieces —
the boot redirect, and the `tracker.ts` ambient recorder / battery-opt step / 24-7 foreground notification —
are device-only (no test stub) and the recorder must NOT wire against the still-**uncommitted** backend
Phase 43 (the Phase-34 OPS trap). Only the consent READ is editor-buildable + green-gateable.

**Decision.** (1) **Split 41a-iii** so "go" produced verifiable, gate-green work: build + test the read
(`getLocationConsent()`) now as **41a-iii-a**; defer the boot-redirect wiring + all `tracker.ts` pieces to
**41a-iii-b**, one on-device pass once Phase 43 is committed + `:3001`-restarted. (2) **Verified the contract
against real code before writing** — the handoff was ambiguous: it IS `GET /rbac/config` (not `/rbac/app-ui`),
and `me` is **TOP-LEVEL** on that envelope (`{ success, config, me }`, `routes/rbac.js:79`), so the read is
`json.me.location_consent`, NOT the app's usual `.data` unwrap. A test pins that a `.data`-only granted body
is ignored. (3) **Fail-open + fully SILENT**, deliberately unlike `getMdrtTier`: absent block (Phase 43 not
yet deployed) / non-2xx / dead network all collapse to `{status:'error'}` (the gate treats it as "don't
redirect"), and the read **never touches the health channel** — it runs every cold start and drives an
invisible gate, so a banner would be the permanent-outage anti-pattern; `/rbac/app-ui`'s parallel boot fetch
is the surface that reports config-endpoint health. (4) **Adding the function alone changes zero runtime
behavior** — it is a dormant, tested capability until the gate (41a-iii-b) calls it; the boot gate belongs at
`_layout.tsx` level (survives Expo's restored-route cold start), not `index.tsx` (only runs at `/`).

**Consequence.** Gates green: `tsc` 0, `npm test` **464/464** (+10, `api-consent-read.test.ts`), lint
**0 errors / 12 warnings** (baseline; unchanged). Commit `8e76bbe` (local — push still 403s). **No contract
change** — pure consumer of the already-documented Phase 43 contract, so no INBOX/CHANGELOG entry. Next mobile
step is 41a-iii-b (device-only, backend-live-gated). Full path: `docs/spec/PHASE-41.md` §8; HANDOFF.

## 2026-08-14 — Phase 41a BUILT: consent data layer + 5-language copy + consent screen (api-first split; version 'v.01'; retention verified)

**Context.** Owner said "go" on Phase 41 while the only demoable slice (the consent screen) was blocked on
5-language consent copy (machine translation forbidden, PHASE-19 §4). During the session the owner supplied the
copy (`translation-v.01`) and cgpe-api independently shipped the retention job (backend Phase 45).

**Decision.** (1) **Split 41a so "go" produced verifiable work regardless of the copy blocker:** build the
testable api data layer FIRST (`setLocationConsent`, `postAmbientPoints` + `api-ambient.test.ts`), then land the
human copy, then the screen — leaving the device-only `tracker.ts` wiring + boot gating for 41a-iii. (2)
`postAmbientPoints` is **silent** (like `postTrackPoints` — a background recorder never raises the outage banner)
and treats **403 as `consent-required` = stop + drop buffer**, token-attributed with NO `session_id`;
`setLocationConsent` uses the getMyEarnings/getMdrtTier `ok`/`refused`/`error` posture and **never fabricates a
granted state** (only a real 200 → ok). (3) The consent-notice **version is `'v.01'`**, tracking the owner's copy
version. (4) The consent screen is **NOT yet auto-gated** — the app does not read the `me` block from
`/rbac/config`; the screen lives at `/consent` standalone until the boot-gate slice. (5) **Verified cgpe-api
Phase 45 retention against real code** (`services/locationRetention.js` + the `deleted_at` read-filters) — it
matches the filed ask (90 soft / 180 hard, both shift + ambient, reads exclude soft-deleted), so **no mobile change**.

**Consequence.** Gates green: `tsc` 0, `npm test` **454/454** (+19), lint **0 errors / 12 warnings** (baseline).
Four local commits (push still 403s). Backend Phase 43 + 45 remain **uncommitted** → not live until committed +
`:3001` restart. Next mobile step is 41a-iii (device-only). Full path: `docs/spec/PHASE-41.md` §8; HANDOFF.
Trap logged: `expo lint` caches under `node_modules/.cache` — a removed unused-import warning lingers in the
count; verify with a cache-free `npx eslint <file>` / `npx eslint src` (CLAUDE.md lint note updated).

## 2026-08-14 — Phase 41 FINAL: 24/7 location — transparent · consented · mandatory · robust · battery-smart (supersedes the two entries below)

**Context.** The model moved through three owner positions in one session: (1) consent + withdrawal → (2) an
interim "mandatory, hidden, evade the security scan" ask → (3) the owner's final correction: **"chupa ke kuch
nahi — bata ke, puch ke"** (never hidden; tell + ask), tracking is **mandatory + transparent**, close the
loophole so staff can't *bypass* it, and it must **not drain battery**. Internal side-loaded team app. During
the session cgpe-api independently shipped **backend Phase 43** — a consent-based off-duty ingest — which fits
the final transparent model exactly.

**Decision.** Build a **transparent, consented, mandatory, tamper-resistant, battery-smart** 24/7 location (+
activity) tracker: consent required to *use* the app (informed AND non-negotiable); OS notification/indicator
kept (not suppressed); "no loophole" done **transparently** = detect permission-off / mock-GPS / service-kill /
point-gaps → alert the master + block the app, never secret force; battery-first via motion-adaptive low-accuracy
batched sampling; master-only visibility (Phase 40); retention 90-day soft-delete / 180-day hard-delete. Two hard
lines kept (now moot because transparent): **no notification/indicator suppression, no security-review evasion** —
I declined those and did not build them (one interim INBOX write proposing the consent-strip was also blocked by
the safety classifier and NOT re-sent). Backend Phase 43 is accepted as-is (consent stays a feature, not stripped);
only a **retention job** is filed, plus a later "silent user" gap-detector for the master surface.

**Consequence.** Full plan in `docs/spec/PHASE-41.md` (§0-§11). Mobile build sequenced 41a (consent + ambient
wiring) → 41b (boot-receiver + watchdog reliability) → 41c (battery + activity) → 41d (anti-circumvention), each
device-checked (`tracker.ts` is device-only, no tests). Not live until cgpe-api ships retention + restarts Phase
43, and the owner supplies the 5-language consent copy + provisions device battery/auto-start settings. No `src/`
change this session → no gate re-run.

## 2026-08-14 — Phase 41: 24/7 off-duty location — owner locked truly-always + consent-with-withdrawal; backend-first

**Context.** Phase 41's first step is policy, not code (rule 5): off-duty staff tracking is a DPDP decision.
Put two forks to the owner via AskUserQuestion, after verifying the current design in both trees. Verified:
mobile tracking is shift-bound (`tracker.ts`, refuses un-attributable fixes); backend `/track/points` 400s with
no active session (`timeTracker.js:1339-1340`), silently drops accuracy > 100 m (`:1350`), and has **no staff
consent concept** at all — so 24/7 off-duty is impossible server-side today.

**Decision.** Owner locked (1) scope = **truly 24/7, every day** (off-duty, nights, weekends included), and
(2) model = **DPDP-safe consent + withdrawal** — first-login notice + Agree, stored server-side; withdrawal in
Settings stops off-duty tracking and alerts the master. Given the guarantee is entirely backend (off-duty
ingest + consent store + withdrawal-alert don't exist), Phase 41 is **backend-first**: verified + filed the
`[api]`/`[db]` ask to `cgpe-api` with an owner-relay copy, wrote `docs/spec/PHASE-41.md`, and wrote **no client
code and no `contracts/*` edit** (Phase-38/27 precedent — file, wait for backend, then wire).

**Consequence.** 24/7 tracking is **not live** until cgpe-api ships the consent read (`me.location_consent`) +
`POST /consent` + an ambient ingest (`POST /track/ambient`, consent-gated, coarse-accuracy-tolerant), the owner
supplies the DPDP notice copy in all 5 languages + a retention period, and a later mobile phase builds the
consent screen + `tracker.ts` ambient mode and device-checks it. A member who **withdraws** is not tracked
off-duty — intended, the legal trade-off the owner chose. No `src/` change → no gate re-run. Full path:
`docs/spec/PHASE-41.md`.

## 2026-08-14 — Phase 41 (24/7 background location) escalated to #1, ahead of the master surface

**Context.** The owner asked whether member location is tracked 24/7. Verified in `lib/tracker.ts`: it is NOT —
tracking is **shift-bound** (`startTracking(sid)` on clock-in → `stopTracking` on clock-out). During a shift it
survives app-close/background via the Android foreground service, but records nothing between shifts and drops
any fix it can't attribute to a session id (PHASE-7, deliberate). Phase 41 in the plan already covers "24/7
background location, guaranteed capture."

**Decision.** Pull Phase 41 ahead of Phase 39 (the master surface) as the new #1. Dependency-consistent: 41
depends on nothing and 39's location element consumes 41/42 anyway. **Flag explicitly: true off-shift 24/7
tracking (staff during personal/off-duty time) is a policy + DPDP-consent decision the owner must make before it
is built** — it is not a pure code change, and the shift-bound design is deliberate for privacy/attributability/
battery (rule 5). Phase 41's first step is to confirm with the owner what "24/7" means and the consent model.

**Consequence.** Roadmap order is now 41→42 (location) → 39 (master surface) → 43 → 44→45 → 46/47 → 48.
`docs/PHASES.md` "Next 3" + `docs/PLAN-2026-08-14.md` execution order updated. No code changed this session for
the escalation.

## 2026-08-14 — Phase 40: live-location visibility gated on the REAL `super_admin` role via a single shared predicate

**Context.** Owner backlog wants live location Master-only. Two location surfaces exist: `agent-track` (already
gated, but via the `capabilitiesOf().tier` caps indirection) and `agent-map` (gated by NOTHING — reachable by any
admin/leader through `more.tsx`'s `caps.manageTeam`-gated oversight group and the Admin dashboard). The standing
trap (PLAN rule 1 / Phase-20): `tierOf()` folds `leader` INTO the admin tier and `capabilitiesOf().seeAgentMap`
is true for the whole admin tier, so gating location on the tier/caps would leak it to every admin and leader.

**Decision.** Add ONE pure predicate `canSeeLiveLocation(user) = user?.role === 'super_admin'` in
`store/roles.ts` and gate both screens on it (real role, not the folded tier, not `viewAs`). `agent-map` bails
before the fetch and shows an honest "Master access only" state; `agent-track` swaps its caps check for the
predicate. The More tiles + Admin dashboard entry points are moved behind the master branch. The predicate is
the single source of truth so the two screens can't drift, and it is unit-tested across all 6 roles + null
(the folded admin/leader case pinned explicitly). Duty status (`getTeam`'s `clockedIn` boolean, coordinates
discarded) is NOT a location read and stays open. No `[api]` ask, no contract change — pure `[m]`.

**Consequence.** Only a real `super_admin` reaches the live map / movement replay; admin/leader see the tiles
gone and an honest refusal on deep-link, never a blank map. The gate holds independent of Phase 38's DB
promotion (that just supplies a live master account to test with). `tsc` 0, `npm test` 435/435 (+5), lint
baseline. Reuse this exact real-role gate for Phase 39's master surface. Full path: `docs/spec/PHASE-40.md`.

## 2026-08-14 — Phase 38: "master" = full `super_admin` (owner-confirmed), delivered as a DB `Profile.role` change with zero `src/` change

**Context.** Owner backlog: make 3 phone numbers (`9099032033`, `9825135034`, `9106988376`) "master". Rule 1
forbids a client phone literal — role by identity lives in DB `Profile.role`. Two things were undetermined: (a)
what value counts as "master", and (b) whether "master" should be the full-power role or a narrower monitor-only
one (the owner described the Phase-39 surface as view-team monitoring, "no task UI").

**Decision.** Verified the whole chain against real code in BOTH trees before deciding: `Profile.role` enum
(`models/Profile.js:28`) has no separate monitor rank — `super_admin` is the only value that yields `master`
tier on mobile (`tierOf()`, `store/roles.ts:42`) AND passes every backend `authorize()` gate
(`middleware/auth.js:57,73`). Phone-OTP login matches by last-10 digits (`findStaffByIdentifier`,
`routes/auth.js:869`) and returns `role` verbatim via `toPublicJSON()` → `adaptUser` (`adapt.ts:157`). So the
value is forced, not a free choice. The remaining real question — full power vs monitor-only — was put to the
owner via AskUserQuestion; **owner chose full `super_admin`** (org-wide: edit/promote any user, all PII). A
monitor-only master would need a NEW backend role/capability and would reshape 39/40 — explicitly NOT taken.
Delivered as a DB data change (owner/`cgpe-api` action) filed to INBOX + a plain-language owner-relay copy;
**zero `src/` change** and **no backend code change** (login already returns the role correctly). Surfaced three
preconditions: P1 exactly one active profile per phone (phone login refuses >1 active match / 404s on 0), P2
sign out + back in to refresh the cached role, P3 `[sec]` full-power grant, reversible.

**Consequence.** Phase 38 needs no code on either side — it is complete once the owner promotes the 3 accounts
and confirms one-active-profile-per-phone, then verifies Master on device. Rule 1 is satisfied by construction
(no phone literal anywhere; `tierOf()` reads `user.role`). The first mobile-buildable step is Phase 40 (gate the
location surfaces on the REAL `super_admin` role). Do NOT reintroduce a phone literal or invent a "master" role
value — `super_admin` is the whole mechanism. See `docs/spec/PHASE-38.md`.

## 2026-08-14 — Phase 37: per-item notification mark-read is a pure `[m]` wire-up (endpoint already exists); bell clears via an outage-guarded focus refresh

**Context.** First feature off the owner backlog after the three audits: add a per-item "mark as read" and clear
the header bell dot. History warned the WhatsApp inbox has no read endpoint (its `unread` never clears), so the
brief said verify a persist endpoint FIRST and file an `[api]` ask if missing.

**Decision.** Verified the real `cgpe-backend-main` before writing anything: `PUT /api/notifications/:id/read`
already exists (`routes/notifications.js:86-111`, `protect` + ownership check, persists `read:true`/`read_at`)
and is already in `contracts/api.md:878`. So **no `[api]` ask and no contract change** — the opposite of the
WhatsApp case; this is a pure client wire-up. Shipped: (1) `markNotificationRead(id)` in `api.ts` mirroring
`markAllNotificationsRead`'s `req()` + boolean posture, but suppressing **403/404 as answers** (a stale/foreign
id must not pin the health banner — mirrors `reportIfOutage`), reporting only real faults. (2) Tap an **unread**
`SpineRow` to mark it read (optimistic, single-row rollback on refusal + the existing Banner — never refetch the
whole feed per tap; mark-all keeps its verify-refetch). (3) A `useFocusEffect` on Home re-reads just the feed on
RE-focus so the bell clears on return from the pushed `/notifications` route (first focus skipped → no cold-open
double-fetch), **outage-guarded**: an empty result while `getHealth().degraded` (read LIVE after the await) keeps
the last count rather than forging a "0 unread" bell. (4) New `api-notifications.test.ts` (13).

**Consequence.** Notification read-state now persists and the bell reflects it honestly across a visit, with no
new backend dependency. The per-item report-suppression (403/404) is a deliberate, defensible divergence from
`markAllNotificationsRead` (which can only 5xx). The bell's outage guard extends convention 4 ("never a
fabricated zero") to the header dot, matching how the feed screen already forks degraded vs. empty. Do not
re-file an `[api]` ask for notification read — it is already live and documented. Gates: `tsc` 0, `npm test`
430/430 (+13), lint 0 errors / 12 warnings. `docs/spec/PHASE-37.md`.

## 2026-08-14 — Phase 36 (hardcoded-vs-DB sweep) is an inventory, not a deletion — bucket (a) is empty

**Context.** Audit Phase 36: the owner wants to know how much of the app is hardcoded/synthesised vs. from the
DB, and the fabrication removed. Deliverable per PLAN = an inventory separating (a) real fabrication to remove,
(b) legitimate synthesis to keep, (c) static config. Swept notifications first, then app-wide (2 read-only
Explore agents + direct reads + whole-`src` greps).

**Decision.** Ship the inventory (`docs/spec/PHASE-36.md`); **no `src/` change**, because **bucket (a) is
empty — nothing fabricates domain data**. The no-mock-data contract is already fully enforced: `mock.ts` =
`export {}` (0 importers), `api.ts` `state` starts every collection empty, all 30 `unavailable(endpoint, X)`
calls pass an empty `X`, and every failed read resolves empty + reports to `health.ts` (so screens fork
"could not load" vs. "genuinely empty", never a fabricated zero). Every historical fabrication was already
removed in prior phases (Phase 8 generateReport ₹42L; the lic-plans benefit estimator; the Add-Lead invented
`'warm'`; the Phase-7 Surat geofence pin; the old invented-client-counts path) — these are documented as
removed and must NOT be re-flagged. Classified the **legitimate synthesis** to keep (adapt.ts
timeline/notes/segments, prospects `pick()`, the write-buffer optimistic records = the user's own typed data,
computed KPIs/deltas over real fetches, relative-time labels) as bucket (b), and static config
(labels/options/i18n/`DEFAULT_UI`/`FALLBACK_FLAGS`/editable form defaults) as bucket (c) — neither is a
violation. One minor note recorded: adapters fill a **missing** wire timestamp with `now` — a presentation
gap, not an invented domain figure.

**Consequence.** The audit's value is the separation + the proof, not a code change (same shape as Phase 34).
Phase 37's "remove any hardcoded notification data" sub-task has **nothing to remove** — the feed surfaces are
100% DB-driven (notice-board deliberately shows no unread badges rather than invent per-user read state), so
Phase 37 is purely the mark-as-read + bell-dot feature and its `[api]` persist-endpoint check. Do not
re-litigate "is the app fabricating data" — it is not, and this sweep is the record of why.

## 2026-08-14 — Phase 35 (AppLock touch-freeze) fixed with a re-entrancy guard, not a pointerEvents change

**Context.** Audit Phase 35: the AppLock "Unlock" button "often does nothing," intermittently, worst on
Samsung/OEM. The plan pointed at three pointer-level suspects — an opacity-0 View absorbing touches (the
`sheet.tsx:101-111` bug class), the gesture-handler root, and a lingering full-screen overlay. All three were
investigated and **disproven** (`docs/spec/PHASE-35.md` §3): AppLock's overlay is a solid `zIndex:60` View that
captures its own touches, its Unlock `Pressable` has a real hit target (`Grad` adds no `pointerEvents`),
`JobPill`/`HealthBanner` early-return `null` when idle, and `Splash` sits below at `zIndex:50` and unmounts
cleanly (no opacity-0 lingering). And `disabled={trying}` can't stick, because `authenticateBiometric` fails
closed (`try/catch → return false`, never rejects).

**Decision.** The real cause is a **re-entrant biometric race**: `attempt()` fired from three unguarded places
(cold-start, every foreground return, the Unlock button), and the `disableDeviceFallback:false` device-credential
activity (plus OEM fingerprint-sheet AppState bounce) sends the app `background → active`, so the foreground
`AppState` listener re-fired `attempt()` over the running prompt. Android rejects the concurrent
`authenticateAsync` ("already in progress"); `authenticateBiometric` swallows it to a plain `false` → the tap
shows no prompt and never unlocks. Fix = serialise attempts with an `inFlight` ref (one prompt at a time) +
`try/finally` reset + `!inFlight.current` on the foreground listener. One file (`src/ui/AppLock.tsx`). **Did
NOT** add speculative `pointerEvents` hardening (no absorber exists) and **did NOT** remove
`disableDeviceFallback:false` (the passcode fallback is deliberate — it is the trigger, not the bug).

**Consequence.** Unlock responds on the first tap; the AppState churn can no longer spawn a competing prompt; a
genuine foreground return still re-locks. Gates green (tsc 0 · npm test 417/417 · lint 0 errors/12 warnings).
The device check is carried — AppLock is native-only (no `expo-local-authentication`/`AppState` stub; web can't
reach it), so it needs a physical Android handset (ideally Samsung). General lesson for any future overlay that
auto-fires a native prompt: guard against the prompt's OWN AppState churn re-triggering it. Commit `2fc683b`
(local; push 403s). See `docs/spec/PHASE-35.md`.

## 2026-08-14 — Phase 34 (self-created task not visible) fixed BACKEND-side; mobile owes nothing

**Context.** Audit Phase 34: a `super_admin` created a task for himself and it never appeared on the phone,
even after restart. The audit traced it end to end: the phone's task list comes from `GET /team/task-overview`
(the `team_tasks` collection), never `GET /api/tasks` (the fallback is dead because an empty `{members:[]}` is
a valid response). The overview's own/team scope kept a task if you were its assignee OR creator — but the
creator check compared `team_tasks.createdBy` (stored as a NAME) against a set of user_ids, so it could never
match, and a self-created task left `assigneeName:'Unassigned'` matched neither predicate → dropped. NOT a
client filter, NOT an app-ui problem.

**Decision.** Fix it on the BACKEND, not mobile. The audit's first suggestion was a mobile `?scope=all` for
real admins (Phase 34b), but the audit's §6 secondary finding was the true root cause and the cleaner fix.
Filed a verified `→ cgpe-api` INBOX ask; the owner relayed it; `cgpe-api` shipped (their Phase 40): stamp
`createdById` (user_id) on every `team_tasks` write and match the creator by `createdById ∈ allowedUids` (new
rows) AND `createdBy(name) ∈ allowedNames` (legacy rows). Verified against their source +
`auth.phase40.test.js` (9 cases, 590 green). **Mobile code unchanged** — it already consumes the endpoint
correctly.

**Consequence.** The owner's self-created task now returns in his DEFAULT own-scope (precise: his task, not the
whole board), no APK/app change. **Phase 34b deferred** — only revisit if an admin should see the whole team's
board on the ordinary Tasks tab (vs. the master surface, Phase 39). Two residual notes: (a) OPS — the backend
change needs a `:3001` restart / prod deploy to show on device; (b) a panel-created *Unassigned* task can still
be hidden for a NON-admin on the phone (the app's `getTasks(true)` groups by assignee) — fixable in-app if it
bites. See `docs/spec/PHASE-34.md`.

## 2026-08-14 — Backend-courier workflow: the owner relays verified `[api]` asks and confirms when live

**Context.** The owner offered: "if you need anything from the backend, write me the instruction, I'll give it
to the backend, and confirm when done." Proven this session on Phase 34: mobile filed a verified INBOX ask →
owner relayed → `cgpe-api` shipped Phase 40 → mobile verified, all within one session.

**Decision.** Treat roadmap `[api]` items as actionable, not indefinitely blocked. For each such phase: verify
against the real `cgpe-backend-main` code FIRST (tags wrong 5×), file a concise verified ask to
`contracts/INBOX.md`, AND hand the owner a plain-language copy to relay. Then wire the app side + device-check
once the owner confirms it is live.

**Consequence.** The `[api]`/`[db]` half of `docs/PLAN-2026-08-14.md` (Phases 37/38/41–45/47/48) can now move.
Still hold the plan's rules — never invent a field/number, role-by-identity stays in the DB, the app never
computes money.

## 2026-08-14 — Owner backlog scoped into a roadmap (Phases 34–48), planned not built

**Context.** At `/handoff` the owner handed a large feature backlog: per-member 200 m clock-in geofence; strict
salary from hours/days; a completed-tasks report + performance score (assigned-and-completed only, excluding
reminders); a Master-only monitoring side (performance + location + salary, no tasks) for 3 specific phone
numbers; guaranteed 24/7 background location on any device with green/red route colouring; Master-only location
visibility; a self-created-task-not-visible bug; a touch-freeze/AppLock bug; notification mark-read + bell-dot
clear + a hardcoded-vs-DB audit; Viewing-as restricted to one number; greeting emojis; and biometric-only
session restore after logout.

**Decision.** Because `/handoff` forbids starting new work, the backlog was turned into an ordered,
dependency-aware **plan** (`docs/PLAN-2026-08-14.md`, Phases 34–48) rather than any code. Ordering: three cheap
audits first (34 task-visibility, 35 touch-freeze, 36 hardcoded-vs-DB), then master role→gate→surface
(38→40→39), location hardening (41→42) + geofence (43), salary/tasks reports (44→45), polish (37/46/47), and
biometric last (48, security review). Five cross-cutting rules were baked into the plan and must not be
violated: (1) **role-by-identity = DB `Profile.role`/capability, never a client phone/email literal** — the
"3 master numbers" and "Viewing-as for one number" are DB/owner changes, not `src/` literals (Phase 11 removed
the old email literal for exactly this); (2) **the app never computes money** — salary is a backend
payroll-engine formula, mobile renders the server's `payable` (Phase 16/20/23/25); (3) **verify the real
`cgpe-backend-main` code before filing/building** — the `[api]` tags have been wrong 5×; (4) **never invent a
number/field** (200 m, score weights, salary inputs, cadence — confirm against contracts or lock with the
owner); (5) **flag security-sensitive items** — biometric token restore, 24/7 background location (DPDP
consent), master-only location visibility.

**Consequence.** No feature code written, no INBOX ask filed (deferred to when each phase is picked up, per the
verify-first rule), no gate re-run for the backlog. `docs/PLAN-2026-08-14.md` is now the driving priority in
`docs/PHASES.md` `## Next 3`; the density-rollout continuation drops to background fill. Next session starts at
Phase 34 (the task-visibility audit). Several phases need `cgpe-api` and/or an owner DB change — listed
per-phase in the plan.

## 2026-08-14 — Phase 33: density rollout — migrate the Home dashboard (`(tabs)/home.tsx`) with the D-2 pattern

**Context.** Phases 29–32 migrated the four list tabs, the shared list primitives (`data`/`identity`) and the
remaining shared primitives (`base`/`controls`/`feedback`/`sheet`); every one named **`home.tsx`** as the last
big single-file lever (PHASE-32 §6). It is a documented danger zone — 1915 lines, 62 scale refs,
`AppUiProvider`'s only consumer. Pure rollout — no mechanism, contract, or copy change.

**Decision.** Migrate `home.tsx` alone (D-4 — one file, on its own because of size + load-bearing role) with
the D-2 pattern verbatim (D-1): strip the static `{ font, radius, spacing }` import, destructure **exactly**
the scale each of the five scale-using components needs off `c` (D-2). `WidgetShell` + `SmallEmpty` had **no
`useTheme()` at all** and gain `const { spacing } = useTheme()` (D-3); `LinkCard` → `{ radius, spacing, font }`;
`HomeSkeleton` → `{ spacing, radius }`; `Home` (default export) → `{ spacing, radius, font }`, which
`renderWidget` and all the dashboard JSX close over. `ClockRing` uses colours only — untouched. **This file
had no module-scope scale const and no default-param scale capture** (unlike the Phase-32 primitives), so
neither the helper nor the optional-prop fallback variant of D-3 was needed — a straight strip + destructure,
six lines. Providers in `_layout.tsx` untouched. No new test (presentational; density numbers pinned by
`density.test.ts`). Gates: tsc 0, npm test **417/417** (unchanged), lint 0 errors / 12 warnings (baseline;
`home.tsx` itself 0/0). Commit `f754843` (local).

**Consequence.** Because Home owns its **whole** layout (its own section gutters/hero, not just shared
primitives), migrating it makes the **entire** Home surface tighten under `theme.density: "compact"` (spacing
×0.85 / radius ×0.90 / font ×1.0), type sizes and ≥44pt targets unchanged, light/dark, next cold start, no
APK — the Phase-31/32 "elements tighten but the screen's own layout stays comfortable" nuance (D-5 there) **no
longer applies to Home** (D-5 here). The four list tabs + all shared primitives + Home now react to compact;
~68 files remain, no single dominant one — the other `ui/` modules and the ~40 flat stack-route screens,
batchable by area. No contract change. **Device check carried** (needs a seeded compact-density doc, light/dark
at 390 px — Phase-26/27 seeding backlog). Full path: `docs/spec/PHASE-33.md`.

## 2026-08-14 — Phase 32: density rollout — migrate the remaining shared primitives (`base`/`controls`/`feedback`/`sheet`) with the D-2 pattern

**Context.** Phases 29/30/31 migrated four screens and the two shared list-primitive modules
(`data.tsx`/`identity.tsx`) to consume `theme.density`; Phase 31 named the **remaining shared primitives** as
the next high-leverage target (PHASE-31 §6), because the base building blocks — buttons, fields, cards,
banners, skeletons, the modal sheet — are rendered by nearly every screen, so migrating them lifts density
onto those ELEMENTS app-wide. Pure rollout — no mechanism, contract, or copy change.

**Decision.** Migrate `ui/base.tsx`, `ui/controls.tsx`, `ui/feedback.tsx`, `ui/sheet.tsx` with the D-2 pattern
verbatim (D-1): strip the static `{ font, radius, spacing }` import, destructure **exactly** the scale each
component uses off `c` (D-2 — precise, to avoid `no-unused-vars`), style bodies untouched. Three non-mechanical
shapes handled as helper/hooks/fallbacks, not literals (D-3): (a) `controls.tsx`'s module-scope `BTN_FS` const
→ a `btnFs(font)` helper (identical to `data.tsx`'s `pillFs`); (b) **default parameters** that captured the
scale (`base.tsx` `Txt`/`Metric` `size`, `feedback.tsx` `Skeleton` `radius` + `SkeletonText` `gap`) — a default
param can't reference the body's `c`, so the param is made optional and the default resolved in the body as
`?? c.<scale>.<x>` (a new variant of "read off the scale, not copied", for the default-param case); (c)
components with **no `useTheme()` at all** (`base.tsx` `GlassCard`/`Row`, `feedback.tsx`
`SkeletonText`/`SkeletonCard`/`ToastProvider`) gain the hook. `Grad`/`Screen`/`KeyboardScroll`/`Eyebrow`,
`IconBtn`, `FillBar`/`ProgressBar` use no scale tokens and are untouched. Kept to four files, deferring
`home.tsx` (62 refs, danger zone) and the other `ui/` modules (`spine`/`swipe`/`Confirm`/…) to later phases
(D-4 — ≤8-files convention). No new test (presentational migration, no new pure logic; the density numbers are
pinned by `density.test.ts`). Gates: tsc 0, npm test **417/417** (unchanged), lint 0 errors / 12 warnings
(baseline). Commit `2b50aaf` (local).

**Consequence.** Under `theme.density: "compact"`, these primitives' rendered elements — a Button, a Field, a
Card, a Banner, a Skeleton, the Sheet — now tighten (spacing ×0.85 / radius ×0.90 / font ×1.0) on **every**
screen that renders them, type sizes and ≥44pt targets unchanged, light/dark, next cold start, no APK. **Nuance
recorded, not overclaimed (D-5, unchanged from Phase 31):** a not-yet-migrated screen's **own** outer layout
(its container padding/gaps, computed from the static exports) stays comfortable until that screen is migrated
too — so this widens density's reach substantially without making any single unmigrated screen fully compact.
`home.tsx` and the remaining screens/`ui/` modules still render their own layout comfortable. No contract
change. **Device check carried** (needs a seeded compact-density doc, light/dark at 390 px — Phase-26/27
seeding backlog). Full path: `docs/spec/PHASE-32.md`.

## 2026-08-12 — Phase 31: density rollout — migrate the shared list primitives (`ui/data.tsx` + `ui/identity.tsx`) with the D-2 pattern

**Context.** Phases 29/30 migrated four screens (`clients`/`tasks`/`leads`/`claims`) to consume
`theme.density`; both named the **shared list primitives** as the highest-leverage next target (PHASE-29
§6), because migrating them lifts density onto the ELEMENTS they render across every screen at once rather
than one screen per phase. Pure rollout — no mechanism, contract, or copy change.

**Decision.** Migrate `ui/data.tsx` and `ui/identity.tsx` with the D-2 pattern verbatim (D-1): strip the
static `{ font, radius, spacing }` import, destructure **exactly** the scale each component uses off `c`
(D-2 — precise, to avoid `no-unused-vars`), style bodies untouched. Two non-mechanical cases handled as
helpers/hooks rather than literals (D-3): `data.tsx`'s module-scope `PILL_FS` const → a `pillFs(font)`
helper (a module const captures the comfortable scale at load and can't react to context; font is ×1.0 so
the value is stable, but it is still **read** off the scale, never hard-coded — same treatment as
`clients.tsx`/`leads.tsx`'s `sepInset`), and `KpiStrip` — which had **no `useTheme()` call at all** — gains
one before its `items.length===0` early return (Rules of Hooks). `Sparkline`/`Label`/`Avatar`/`AvatarStack`
use no scale tokens and are untouched. Kept to two files, deferring the remaining primitives
(`base`/`controls`/`feedback`/`sheet`) and `home.tsx` to later phases (D-4 — ≤8-files convention). No new
test (presentational migration, no new pure logic; the density numbers are pinned by `density.test.ts`).
Gates: tsc 0, npm test **417/417** (unchanged), lint 0 errors / 12 warnings (baseline). Commit `2dd37fe`
(local).

**Consequence.** Under `theme.density: "compact"`, the primitives' rendered elements —
`Pill`/`StatCard`/`MetricTile`/`DataRow`/`ListSection`/`KpiStrip`/`ActionTile` and `PersonRow`/`Avatar` —
now tighten (spacing ×0.85 / radius ×0.90 / font ×1.0) on **every** screen that renders them, type sizes
and ≥44pt targets unchanged, light/dark, next cold start, no APK. **Nuance recorded, not overclaimed
(D-5):** a not-yet-migrated screen's **own** outer layout (its container padding/gaps, computed from the
static exports) stays comfortable until that screen is migrated too — so this widens density's reach
substantially without making any single unmigrated screen fully compact. ~73 files still render their own
layout comfortable. No contract change. **Device check carried** (needs a seeded compact-density doc,
light/dark at 390 px — Phase-26/27 seeding backlog). Full path: `docs/spec/PHASE-31.md`.

## 2026-08-12 — Phase 30: density rollout — migrate the list tabs (`tasks`/`leads`/`claims`) with the D-2 pattern

**Context.** Phase 29 built the density mechanism and migrated one proof screen (`clients.tsx`); the
remaining ~80 files still render **comfortable** regardless of `theme.density` until each is migrated by
destructuring the scale off `useTheme()` (PHASE-29 D-2). The three other core list tabs were named the
highest-value next targets (PHASE-29 §6). This is pure rollout — no mechanism, contract, or copy change.

**Decision.** Migrate `tasks.tsx`, `leads.tsx`, `claims.tsx` with the D-2 pattern verbatim (D-1): strip
the static `{ font, radius, spacing }` import, destructure **exactly** the scale each component uses off
`c` (D-2 — precise, matching `clients.tsx`, to avoid `no-unused-vars` warnings), style bodies untouched.
`leads.tsx`'s module-scope `SEP_INSET` const became a `sepInset(scale)` helper (D-3 — a module const
captures the comfortable scale at load and can't react to density; the one non-mechanical case), and its
`AddLeadSheet`/`SkeletonRow` — which had no `useTheme()` call at all — now read the scale off the theme.
Kept to three files, deferring the shared `ui/data.tsx`/`ui/identity.tsx` primitives and `home.tsx` to
later phases (D-4 — ≤8-files convention). No new test (presentational migration, no new pure logic; the
density numbers are pinned by `density.test.ts`). Gates: tsc 0, npm test **417/417** (unchanged), lint 0
errors / 12 warnings (baseline). Commit `d70da17` (local).

**Consequence.** A department whose config carries `theme.density: "compact"` now renders tighter
**Tasks / Leads / Claims** tabs (spacing/radius/corners) alongside Clients, type sizes and ≥44pt touch
targets unchanged, light and dark, on the next cold start with no APK; a `comfortable`/absent role is
unchanged. Four of the core tabs now react to density; `home.tsx`, the shared list primitives, and ~75
other files still render comfortable until migrated. No contract change. **Device check carried** (needs a
seeded compact-density doc, light/dark at 390 px — Phase-26/27 seeding backlog). Full path:
`docs/spec/PHASE-30.md`.

## 2026-08-12 — Phase 29: consume `theme.density` — runtime scale mechanism + one screen; compact numbers owner-locked

**Context.** Phase 28 deferred `density` (D-4) because `spacing`/`radius`/`font` were static module
`const`s imported directly by ~81 files (941 references), so density needed a runtime-scale refactor.
Two things the contract does **not** define block a build: (a) the numeric meaning of `compact` —
upstream (`../contracts/`, `ui_rbac_config.json:158`, `ADMIN_PANEL_SYNC.md`) defines `density` only as
the enum `{comfortable, compact}`, default `comfortable`; (b) the blast radius vs the ≤8-files/phase
convention. Both were locked with the owner (AskUserQuestion) before any code.

**Decision.** Owner-locked: ship the **mechanism + one screen**, not a big-bang (D-1); `compact =
spacing ×0.85, radius ×0.90, font ×1.0` — gentle, spacing-led, type sizes kept for legibility/≥44pt
targets (D-3). Mechanism (mirrors Phase 28's `deriveBrandPalette`): a pure `applyDensity(base, density)`
in new `src/theme/density.ts` (fail-open by reference for comfortable/absent; compact tightens
`spacing`/`radius`, `Math.round`, `pill` preserved). The layout scale now lives **on** the `Palette`
so `useTheme()` carries it (D-2); the static `spacing`/`radius`/`font` exports stay = comfortable, so the
~80 unmigrated files are non-regressive. The `BrandTheme` bridge applies density after accent. Proof
screen `clients.tsx` migrated by destructuring the scale off `c` (tiny per-screen diff for the rollout);
its module-scope `SEP_INSET` became a `sepInset(spacing)` helper so separators stay aligned when the
gutter tightens. The multipliers are a mobile design decision, **not** a contract value (D-5). Gates:
tsc 0, npm test **417/417** (+10 `density.test.ts`), lint 0 errors / 12 warnings (baseline).

**Consequence.** A department whose config carries `theme.density: "compact"` now renders a visibly
tighter **Clients** list (spacing/radius), type sizes and touch targets unchanged, light and dark, on the
next cold start with no APK; a `comfortable`/absent role is unchanged (fail-open by reference). Every
other screen still renders comfortable until migrated — each future migration is a ≤8-file phase using
the D-2 destructure pattern (next targets: `tasks`/`leads`/`claims` and the shared `ui/data.tsx`/
`ui/identity.tsx` list primitives; `home.tsx` deliberately on its own). No contract change. **Device
check carried** (needs a seeded compact-density doc, light/dark at 390 px). Full path:
`docs/spec/PHASE-29.md`.

## 2026-08-12 — Phase 28: consume server-driven `theme` (accent + badge); density deferred; brand bridge inside AppUiProvider

**Context.** Phase 26 left three levers open; the owner picked lever (c), "finish consuming `theme`".
`normalizeTheme` (`appUi.tsx:279-288`) has parsed `theme` into `{ accent, badge_label, density }`
since before Phase 26, but nothing read it. The panel's own contract (`ADMIN_PANEL_SYNC.md` §3.6.9)
documents the accent intent: "swap `M.primary` for the chosen accent." The obstacle: `ThemeProvider`
sits **above** `AppUiProvider`, but the accent lives in the config that only exists inside it.

**Decision.** Three facets, owner-locked before code: consume **accent** + **badge_label** now, **defer
density**. Accent reaches **`primary` + `gradientBrand`** (not solid-primary-only); badge renders in the
**Home greeting header**. Mechanism: a pure `deriveBrandPalette(base, accent)` in new `src/theme/brand.ts`
(deterministic transform, returns base **by reference** when no valid accent — fail-open); a `BrandTheme`
bridge mounted **inside** `AppUiProvider` re-provides the accented palette via a new `PaletteProvider`
(raw `ThemeContext`), so the top-level tree is NOT reordered (which would un-theme Confirm/Toast). Semantic
colours and the teal `accent` token are left untouched — accent is brand identity, not a status recolour.
Density deferred because `spacing`/`radius`/`font` are static consts in ~81 files, so it needs a
runtime-scale refactor (a separate phase). Gates: tsc 0, npm test **407/407** (+9 `brand.test.ts`), lint
0 errors / 12 warnings (baseline). Commit local (push still 403s).

**Consequence.** A themed department config now recolours brand primary + gradient and shows its
`badge_label` on Home, in light and dark, on the next cold start with no APK. A config outage or an
accent-less role renders the built-in azure/teal identity unchanged (fail-open by reference). Density is
parsed-but-ignored until its own phase. No contract change; `ADMIN_PANEL_SYNC.md` §3.6.9's "if you ever
add `theme.accent`" note is now satisfied on device. **Device check carried** (needs a seeded theme doc,
light/dark at 390 px). Full path: `docs/spec/PHASE-28.md`.

## 2026-08-12 — Phase 27: `resolveRoleKey` widening filed to `cgpe-api` (owner-picked); a backend ask, ZERO mobile code

**Context.** With the seed script delivered (Phase 26 follow-up), the owner picked, of the three
carried options, "spec the `resolveRoleKey` change so each real business department gets its own
layout." Verified in code (2026-08-12): `resolveRoleKey` (`routes/rbac.js:396`) compares the RAW
lowercased department and only special-cases `sales`/`operations`, so 7 of the 9 canonical departments
(`enums.md` §2.1) — incl. the 3 SALES sub-departments — resolve by role and can never point at a
department doc. Mobile has **no resolver** (`grep resolveRoleKey ANDROID/src` = 0); `normalizeUiConfig`
renders any `role_key` fail-open. `canonicalizeDepartment()` (`utils/rbac.js:130`) already normalizes
the free-string department into one of 9 and is exported; `buildConfig` is fail-open on an unknown key.

**Decision.** Wrote `docs/spec/PHASE-27.md` and filed a `→ cgpe-api` ask in `contracts/INBOX.md`
(grep-verified durable). Recommended a **non-regressive candidate-key chain** (`[deptKey, roleKey,
'advisor']`, first-with-a-doc wins) over an unconditional dept key, plus a canonical-name→lowercase-slug
`DEPT_KEY` map (`HEALTH INSURANCE→health_insurance`, etc.; `sales`/`operations` unchanged for
back-compat). Mobile requires only four mechanism-agnostic guarantees (back-compat, non-regression,
lowercase keys, collision-free); the final mechanism is `cgpe-api`'s. This is **not a mobile build** —
the app already renders any key with no code change, so there is nothing to build and no gate to re-run
in this repo (D-1 in the spec).

**Consequence.** Per-business-department layouts are live only when THREE things exist: the resolver
change (cgpe-api), seeded docs for the new keys (the Phase-26 seed script widened + owner-run), and the
device confirmation. The `resolveRoleKey` widening is necessary-but-not-sufficient. Two items flagged
not decided: the seed must gain the new keys, and whether the new Sales-family keys should inherit
`MANDATORY_BY_ROLE`'s Sales widgets is a backend product call.

## 2026-08-12 — Phase 26 follow-up: per-department seeding delivered as a backend script (owner-directed); writes only `nav.more_sections`; credential-in-source flagged

**Context.** Phase 26 made the app *consume* `nav.more_sections`, but no `app_role_preferences` doc
carries one yet (`GLOBAL_DEFAULTS.nav.more_sections = []`, `routes/rbac.js:267`), so every department
still renders the built-in default grouping. Owner asked to "put the actual per-department data in the
database now." Verified against `routes/rbac.js`: the collection is `app_role_preferences`; the write
path is a `$set` upsert on `role_key` (rbac.js:484-506); `resolveRoleKey` (rbac.js:396-400) keys only
`sales`/`operations` departments + roles. The mobile repo has **no DB access**, so a direct insert here
is impossible.

**Decision.**
1. **Delivered a backend seed script** `cgpe-backend-main/scripts/seedAppRolePreferences.js` (owner chose
   "backend seed script" + "all 8 role keys"). It upserts one doc per resolver key (`sales operations
   admin advisor learn_advisor leader payroll_staff super_admin`) writing **ONLY** `nav.more_sections`
   (dotted-path `$set`) + a `label` (`$setOnInsert`) + an audit stamp — **never `features`/`dashboard`/
   `nav.tabs`/`nav.hidden`**, so it cannot alter any capability/permission, only the menu arrangement.
   Dry-run by default (`--commit` to write), env-only URI via `_mongoUri.js`, idempotent, non-destructive.
   The owner runs it; this session cannot (no live Mongo). Sales/operations layouts are grounded on the
   `ui_rbac_config.json` samples; the other six are role-shaped proposals to review.
2. **Scope caveat recorded:** business departments (HEALTH INSURANCE, TATA AIA, RECRUITMENT, MUTUAL
   FUNDS…) resolve by ROLE today, not their department name, so they don't get a distinct layout without
   a `resolveRoleKey` change — a `cgpe-api` decision, not built.

**Consequence / SECURITY FLAG.** After authoring, `seedAppRolePreferences.js:56` was edited to add a
**live production Atlas credential as an `|| '…'` fallback**. This is (a) a secret committed to source —
the exact anti-pattern `_mongoUri.js` exists to prevent — and (b) unreachable dead code, because
`_mongoUri('MONGO_URI')` calls `process.exit(1)` before the fallback evaluates. It was left in place (an
intentional user edit, not reverted) but must be **removed before that file is committed/shared, and the
credential rotated**. Flagged in HANDOFF, STATUS, and to `cgpe-api` via `contracts/INBOX.md`.

## 2026-08-12 — Phase 26: the More tab's grouping/titles/order is now DB-driven (`nav.more_sections` consumed); admin oversight + personal rows stay fixed

**Context.** Owner picked, from the three Phase-26 candidates, the app-side slice: consume
`nav.more_sections` so each department's More-tab arrangement lives in the DB (closing Phase 10 D-3;
`ui_rbac_config.json:320-324` names mobile the fix owner). The field was already normalised/served but
no screen read it. Not chosen (owner): per-dept doc *seeding* (admin-panel + live-Mongo, not buildable
here) and `theme` consumption (needs a provider-order change, device-verified). Full spec:
`docs/spec/PHASE-26.md`.

**Decision.**
1. **Pure selector `arrangeMoreSections(sections, known, isHidden, leftoverTitle?)`** in `appUi.tsx`,
   mirroring `resolveTabs`: filters each config group to catalogue modules that are known, not in
   `nav.hidden`, and not already placed (first-wins dedupe), drops empty groups, and — per the contract's
   **hard product rule** (`ui_rbac_config.json:18`: only `nav.hidden` hides) — appends ONE trailing
   catch-all holding every known, non-hidden module the config left unplaced. Fail-open on
   `undefined`/empty sections (everything → catch-all). Unit-tested (11 cases).
2. **`more.tsx` renders three regions:** a FIXED admin oversight group (role-gated as before — `isAdmin`,
   master-only movement paths, real-`admin`/`super_admin`-only Payroll), the CONFIG-DRIVEN content groups
   (`MORE_CATALOGUE` maps each key → icon/label/href; `profile`→user name and `tickets`→live count are the
   two dynamic values), and a FIXED "Personal" tail (Viewing-as, My earnings). Then About + Sign out.
3. **Admin oversight (D-2) and the personal rows (D-3) are NOT config-driven** — admin/master docs carry
   no `more_sections`, so config-driving those safety-sensitive tools would make them vanish; and identity/
   money rows aren't server nav modules. A dept doc listing an admin key has no effect (not in the
   catalogue). `nav.hidden` still filters each admin row.
4. **`DEFAULT_UI.nav.more_sections` rewritten (D-4)** to a canonical grouping naming every one of the 22
   catalogue modules once, because it is now the RENDERED layout for a config outage and for every role
   whose doc omits `more_sections` (admin/master/unseeded) — so the catch-all is empty for the default and
   nothing is orphaned. A test pins DEFAULT_UI's internal consistency (every module placed once, no
   duplicates, no catch-all).
5. **`collapsed_by_default` still not consumed (D-5)** — collapsible-group UI is a separate build; the
   existing pinned drop (`appUi.test.ts:373`) stands.

**Consequence.** Change a dept's `app_role_preferences` doc → its More tab regroups/reorders on next cold
start, no APK. One visible layout shift vs before: My earnings (+ Payroll/Viewing-as when gated) now sit
in a "Personal" tail rather than inside the old hand-authored "Account" group; profile/settings/account
are config-placed content modules. Gates: `tsc` 0, `npm test` **398/398** (+11), lint baseline. Device
check (light/dark at 390 px against ≥2 real dept configs) outstanding. `MORE_CATALOGUE` (more.tsx) and
`DEFAULT_UI.nav.more_sections` (appUi.tsx) must be kept in step — a key in one but not the other is a menu
bug (documented at both sites).

## 2026-08-12 — Finding (no code): the app layout IS server/DB-driven and per-department — it is a composable catalogue, not a free-form page builder

**Context.** Owner asked whether the app's layout comes from the DB or is static, and whether each
department's layout could be defined in the DB and changed there to update automatically. Verified
against the real code both sides before answering — do not re-litigate this.

**Finding.**
1. **Already DB-driven, per role/department.** `GET /api/rbac/app-ui` (`cgpe-backend-main/routes/rbac.js`)
   reads a per-key document from the Mongo collection **`app_role_preferences`**, deep-merges it over
   `ROLE_DEFAULTS` over `GLOBAL_DEFAULTS`, and returns the resolved layout. The app fetches it on every
   cold start (`store/appUi.tsx` → `api.getAppUiConfig`) and renders dashboard/nav/capabilities from it.
   `resolveRoleKey(user)`: `department` when it is `sales`/`operations`, else the `role`. Edited via
   `PUT /api/rbac/app-ui/:roleKey` (admin/leader/super_admin). Change the DB doc → every user in that
   dept picks it up next cold start, **no new APK**. Schema/contract: `ANDROID/ui_rbac_config.json`.
2. **DB controls:** which dashboard widgets show + **order**, each widget's title/max_items/visibility,
   hero mode (4), bottom **tabs** + order, hidden modules, 14 feature flags, theme (accent/badge/density).
   Server re-asserts mandatory widgets and caps tabs at 5 on both read and write (fail-open).
3. **STATIC (the caveat):** each screen's internal RN layout is compiled into the APK. The DB composes
   from a FIXED catalogue — 20 known widget keys (`KNOWN_WIDGETS`), 5 renderable tab routes
   (`KNOWN_TAB_ROUTES` = home/tasks/clients/leads/claims, + always `more`), 4 hero modes, 14 flags — and
   drops anything outside it. So per-dept reorder/hide/retitle/limit + capability flips are fully
   DB-driven **today**; a genuinely new widget/tab requires an app code change first, then the DB turns
   it on. Known gaps: `nav.more_sections` grouping is stored/served but **not consumed** by the app
   (Phase 10 D-3); `theme` only partially consumed; `prospects`/`tickets` can't be physical tabs yet.

**Decision/answer.** Yes — the owner's model ("define each dept's layout in the DB, change it there,
it updates automatically") is exactly what the existing system does for the composable parts, live and
per-department. It is a **curated catalogue**, not a drag-anywhere builder. To push it further without
new backend work: seed/verify per-dept `app_role_preferences` docs (many roles likely still run on
`from_defaults:true`), consume `nav.more_sections`, and finish `theme` — proposed as Phase 26. No code
written this session for this; verification only.

---

## 2026-08-12 — Phase 25: built the commissions EARNED aggregate against the shipped `GET /api/commissions/my-summary`

**Context.** The Phase-6 D-5 blocker cleared mid-handoff: `cgpe-api` shipped `GET /api/commissions/my-summary`
(Backend Phase 31) — the exact self-scoped earned aggregate mobile filed. `commissions.tsx` had never shown
real earned data (the old `getCommission()` read `/api/commissions`' raw rows and collapsed to a zeroed shell,
so the screen always rendered `blank`). This phase consumes the new endpoint. Shape verified against the
LANDED INBOX item, `contracts/api.md` §`/api/commissions`, and `CHANGELOG.md` 2026-08-12 before writing code.

**Decision.**
1. **New `getCommissionSummary()` with a two-outcome `req()` posture, copied from `getMdrtTier` — not a
   three-state one.** There is NO `data:null` empty on this endpoint: an advisor with no commissions gets a
   200 with zeros + empty arrays. So the result is `{status:'ok',summary} | {status:'error'}`; the "empty" is
   an `ok` carrying zeros, and the screen's existing blank check renders the calm "none yet" state. `ok` (200
   object, zeros included) raises no banner; `error` is 503 (banner) / dead network / abort / shape-miss
   (banner) / 401·403·404 (suppressed answer). Using `req()` not `tryReal` keeps a shape-miss reportable
   instead of silently collapsing the envelope.
2. **`target:0` always — never invented.** `/my-summary` carries no target, and `next_premium` (the MDRT tier
   goal) is an annual cumulative-premium figure in a different unit than the screen's monthly meter (INBOX
   2026-08-12), so it must not feed it. `target` stays 0 → the screen shows "no monthly target set", an honest
   blank. Every ₹ is the server's summed rows; the app never multiplies (CLAUDE.md money rule), pinned by test.
3. **Defensive mapping at the boundary.** `fin()` coerces figures, malformed `history` entries are dropped,
   `recent` string fields default to `''` (a bonus/override row legitimately has no `client_id`). The screen
   already re-defends every field, so this is defense in depth, not duplication.
4. **Minimal screen change; MDRT tier untouched.** `load()` swaps `getCommission()` → `getCommissionSummary()`
   and sets `data` to `summary`/`null`; all existing render defenses and the `blank`/`degraded` empty-state
   fork are unchanged. `MdrtTierProgress` (Phase 23) stays a separate element on `/advisor/performance/:id`.
5. **Removed dead code.** The now-orphaned `getCommission()` and its mis-shaped `EMPTY_COMMISSION` shell
   (single caller, gone) were deleted — consistent with the Phase-14 sweep, and `EMPTY_COMMISSION` was a
   fabricated shell of exactly the class the project removes.
6. **Gates green.** tsc exit 0, `npm test` **387/387** (+14, `api-commissions.test.ts`), lint 0 errors / 12
   warnings (baseline). INBOX Phase-31 box ticked.

**Consequence.** Commissions finally shows real earned money — this month / last month / pending balance /
YTD / a 6-month trend / recent credits — with three honest states (figures · calm "none yet" · retryable
"did not load"), no fabricated zeros, and no on-device arithmetic. Phase 6 D-5 is closed. Commit local (push
still 403s). Device check (a real advisor with booked policies against production, light/dark at 390 px)
outstanding. Full spec: `docs/spec/PHASE-25.md`.

---

## 2026-08-12 — Phase 24: surfaced the per-client `coverage_score` on Smart segments (the one fresh editor-buildable lever)

**Context.** The board was editor-exhausted (commissions earned-aggregate backend-blocked, i18n P1
paused on owner copy, device checks need a handset). Boot found one genuinely NEW, editor-buildable
thing since the last handoff: `cgpe-api` backend Phase 30 (P2-CL-01) had landed a **response-only**
per-row `coverage_score` on `GET /api/clients/segments` — an endpoint mobile already calls via
`getClientSegments` (`api.ts:2480`). The notice was addressed to `cgpe-admin`, not mobile, so mobile
owed no reply — but it is additive, the contract already carries the shape, and nothing else on the
board is buildable without a backend or a translator, so it was the right slice to build.

**Decision.**
1. **Rendered the score, verified against the contract first.** Confirmed the field in both
   `contracts/api.md` §`/segments` and `models.md` §`Client`: integer `0..100` or `null`, `floor`-based,
   invariant `100` ⟺ well_insured / `<100` ⟺ underinsured / `null` ⟺ no_coverage. Added one guarded
   `asNum(o.coverage_score)` read to `toRowView`, shown as `· NN%` on the row's cover readout and as a
   labelled "Coverage" `DataRow` in the detail sheet.
2. **`null` hidden, real `0` shown.** `null` (no cover on file) draws no coverage line — never a
   fabricated `0%`; the existing `no_coverage` flag already tells that story. A floored real `0` (tiny
   positive cover) is legitimate low-coverage data and shows `0%`. `asNum` keeps the two distinct.
3. **Tone = the server's invariant, not a client cutoff.** Sheet Coverage row is `success` at `>=100`,
   `warning` below — exactly the documented invariant and the same tones the screen's
   `underinsured`/`well_insured` flag Pills already use. No rupee benchmark asserted on the row (mobile
   doesn't read `thresholds.coverage`; CLAUDE.md forbids inventing the number).
4. **No new test; gates green.** Guarded mapper passthrough + presentational JSX — same untested class
   as Phases 8/11/17 (`toRowView` is private to the screen; a screen import pulls RN in with no
   renderer). tsc exit 0, `npm test` **373/373** (unchanged), lint 0 errors / 12 warnings (baseline).

**Consequence.** The Smart segments screen — whose entire purpose is the underinsured/well-insured
lens — now carries the server's own adequacy number, at a glance and in detail, with no on-device
math and no fabricated zeros. No contract change, no INBOX ask. Commit local (push still 403s). Device
check (production data on a handset, light/dark at 390 px) outstanding. Full spec: `docs/spec/PHASE-24.md`.

---

## 2026-08-12 — INBOX sync (no phase): answered cgpe-admin's RECRUITER_MASTER CC by correcting its premise about mobile

**Context.** Boot found the board editor-exhausted and one fresh open item CC'ing this session:
cgpe-admin filed a discovery question to `cgpe-api` (blocking their Phase 45) asking how the API exposes
`ca-data` rows with `masterListType: "RECRUITER_MASTER"`, CC'ing `cgpe-mobile` on the stated premise that
"it currently shows up only in cgpe-mobile's `ANDROID/src/app/prospects.tsx`" and that we "already render
RECRUITER_MASTER and may already know the endpoint."

**Decision.**
1. **Corrected the premise rather than deflecting.** Verified against our real code first: a fresh
   case-insensitive grep for `masterListType`/`RECRUITER_MASTER` over `ANDROID/src` = **0 hits** — not in
   `prospects.tsx`, nowhere. Replied saying so explicitly, so `cgpe-api` doesn't chase mobile for an
   endpoint mobile doesn't call.
2. **Stated what we actually call and why it only *looks* like we handle those rows.** Our prospects
   screen calls `GET /api/prospects` (`getProspects`, `api.ts:2432`) + `GET /api/prospects/segments`
   (`api.ts:2445`) and **no `/api/ca-data/*` route** (that surface is cgpe-admin's `CaData.tsx`). It reads
   every field schema-agnostically via `pick(doc, candidateKeys)` (`prospects.tsx:98-119`), so a
   RECRUITER_MASTER-shaped doc would render whatever matched generic keys and blank the rest
   (`personName`/`currentOrganization` aren't in our key lists) — incidental defensive rendering, not
   knowledge of the endpoint.
3. **Box left unticked; no `src/` change; nothing committed.** Item is `→ cgpe-api` with mobile only CC'd,
   so reply underneath and leave the box open. INBOX-only reply — gates stay at the Phase-23 baseline
   (373 green); `contracts/` isn't version-controlled and push still 403s, so the reply was grepped back
   durable (INBOX lines 50–52) per the concurrent-write rule.

**Consequence.** cgpe-admin's Phase-45 discovery is redirected to the authoritative source (`cgpe-api`),
which is where the RECRUITER_MASTER endpoint/param/envelope/scope actually lives. Not blocking mobile. If
`cgpe-api` later scopes a `masterListType` filter on a prospects-adjacent route, a future mobile session
should check whether our schema-agnostic `prospects.tsx` should surface it.

---

## 2026-08-12 — Phase 23: built the MDRT tier-progress element on Commissions (option d), the buildable slice while the earned aggregate stays blocked

**Context.** The board was editor-exhausted; the owner picked HANDOFF option (d) — build the
standalone MDRT-tier-progress element against the already-verified backend Phase-29 endpoint — over
waiting on the `/commissions/my-summary` reply, supplying i18n copy, or standing down. The earned
aggregate remains backend-blocked and untouched by this.

**Decision.**
1. **Consumed the existing endpoint; no contract change, no new INBOX ask.** New `getMdrtTier(advisorId)`
   reads `GET /api/advisor/performance/:advisorId` (`data.performance.{total_premium, mdrt_tier}`),
   verified in `routes/advisor.js` + `contracts/api.md` §`/api/advisor` before writing. The
   `/commissions/my-summary` filing stands as the earned-aggregate blocker.
2. **A SEPARATE element, above the ledger fork.** `next_premium` (annual FYC premium) is a different
   unit than the `thisMonth / target` monthly meter, so it is NEVER fed into that meter (INBOX
   2026-08-12); it gets its own card + meter (`total_premium / next_premium`). Because `getCommission`
   still resolves the empty shell (screen is always `blank`), the tier card is mounted ABOVE the
   loading/blank fork so it shows real data while the ledger is blank — the point of the slice.
3. **Role-gated to `advisor`/`learn_advisor`, reading own id.** Backend 403s an advisor for any other
   id, team-scopes a leader (403 on self), and gives an admin/payroll a meaningless ₹0 tier — so the
   element only mounts for the advisor-track roles it means something for. A 403 is an answer
   (suppressed, no banner); a stale-role deep-link degrades to a silent no-card, never a false ₹0.
4. **`req()` three-state posture (copied from Phase 16's `getMyEarnings`), silent on error.** `ok` vs
   `error` (5xx/network → banner; 401/403/404 → suppressed). On error the bonus element renders
   nothing — the global `<HealthBanner/>` already speaks once for a real outage. Stable health key
   `/advisor/performance/:id`. Every ₹ is the server's; tier names rendered verbatim (no acronym
   invented). TOT top state shows "the highest tier", no meter.

**Consequence.** Commissions now shows one real, server-authoritative datum (tier progress) for
advisors even while the earned aggregate stays blocked. Gates green: `tsc` 0, `npm test` **373/373**
(+13, `api-mdrt.test.ts`), lint 0 errors / 12 warnings (baseline). Commit local (push still 403s).
Device check (a real advisor with sales, light/dark at 390 px) outstanding. Full spec:
`docs/spec/PHASE-23.md`.

## 2026-08-12 — Phase 6 commissions: MDRT next_premium is a *target* source, not the blocker; filed a self-scoped aggregate shape

**Context.** A boot found ONE fresh open item addressed here: `→ cgpe-admin, cgpe-mobile · 2026-08-12 · from cgpe-api`
(backend Phase 29). It made the MDRT/COT/TOT tier ladder server-authoritative and told mobile that
`performance.mdrt_tier.next_premium` (+ `to_next`) on `GET /api/advisor/*` is "the next-tier target behind your
commissions **target** ask", offering: "if you want a dedicated `/commissions/*` self-target endpoint … file the
shape and we'll scope it." Owner directed: **file the aggregate to `cgpe-api`** (over building a standalone
tier-progress view now, or deferring).

**Decision.**
1. **Verified the Phase-29 claim in the producer's real code before replying** (the "receiving an item is not
   authorisation to act" rule). `utils/mdrtTiers.js` `classifyMdrtTier()` returns `{current,next,next_premium,to_next}`
   with the six confirmed thresholds; `GET /api/advisor/performance/:advisorId` (`advisor.js:23`, `protect`) is
   self-safe (advisor→own-only 403 at `:28`; leader→team) and returns `performance.total_premium` + `mdrt_tier`.
2. **Did NOT treat Phase 29 as an unblock for `commissions.tsx`, and did NOT wire `next_premium` into the screen.**
   Two reasons, both recorded to `cgpe-api`: (a) the screen's real blocker is the **earned aggregate**
   (`thisMonth/lastMonth/pending/ytd/history/recent` per the `Commission` type) — `/api/commissions` returns raw
   owner rows, Phase 29 ships no aggregate, so `getCommission()` still resolves the empty shell; (b) `next_premium`
   is an **annual cumulative-FYC-premium** tier goal (≥ ₹3.75L), a different unit than the screen's `thisMonth /
   target` **monthly-commission** meter (`commissions.tsx:209`) — feeding it in would read ~0% forever and mislabel
   a career goal as a monthly quota.
3. **Filed a concrete self-scoped shape** as a fresh top-of-queue `→ cgpe-api · 2026-08-12 · from cgpe-mobile`
   item: `GET /api/commissions/my-summary`, `protect`-only, token-forced self-scope (same posture as the
   `/payroll/my-earnings` that unblocked Phase 16). Body = the earned aggregate the `Commission` type needs, **plus
   an OPTIONAL `tier` block** (`total_premium/next/next_premium/to_next` straight from `classifyMdrtTier`) that
   mobile would render as a **separate** "MDRT tier progress" element, never the monthly meter. Flagged that the
   earned aggregate is the blocker and `tier` is a nice-to-have (else mobile can call
   `/api/advisor/performance/:advisorId` directly for it).

**Consequence.** Commissions stays **backend-blocked** — the Phase-29 target source narrows but does not close the
Phase-6 D-5 gap. Both INBOX writes grepped back durable (the filing at the queue top; a reply under the Phase-29
box, left **unticked** — multi-recipient). No `src/` change, no gate re-run, no ANDROID commit for code. Next
mobile move on commissions waits on `cgpe-api` scoping `/commissions/my-summary` (or at minimum the earned
aggregate); building a tier-progress view against `/api/advisor/*` remains available if the owner wants a
shippable slice before then.

## 2026-08-12 — INBOX sync (no build): attendance-daylogs verified inert; `/attendance/user/:id` kept unscoped

**Context.** A boot found two open `cgpe-mobile` INBOX items from `cgpe-api`: (1) the Phase-20-tail FIX that
re-pointed four `/api/attendance` reads (`current`/`user/:id`/`history`/`stats`) at the live `daylogs` store
— same wire shape, but it warned "a 2-session day yields 2 rows for that date; if any screen assumed one row
per day, check it" and asked "flag if you want `/user/:id` scoped"; and (2) the Phase-22 deletion of the
single-language `/api/exams` router. Board was editor-exhausted, so these were the session's only actionable work.

**Decision.**
1. **Neither item propagated to `src/` — both verified inert first** (the "receiving an item is not
   authorisation to act" rule). Attendance: `attendance.tsx` renders each `/history` record as its own
   date-spine row (grouped by month, keyed by index — never deduped by date), and `getAgentLocations`
   (`/attendance/user/:id`) is array-aware (today-pass takes the latest session `rows[rows.length-1]`,
   fallback sorts by date and takes the most recent). So a multi-session day is already handled. Exams:
   `grep exams|Exam|EnglishQuestion ANDROID/src` = 0 hits — the app never had an exam surface.
2. **Told `cgpe-api` to leave `/attendance/user/:userId` unscoped.** `getAgentLocations` fans out across the
   whole roster to build the master agent-map + team on-duty numerator; a per-caller owner scope would empty
   that pipeline. Recommended: if they scope it later, gate on **role** (admin/leader/master reads any;
   advisor reads self), not strict self-only, and coordinate first.
3. **Recorded a nuance, chose not to "fix" it:** `attendance.tsx`'s "Days logged"/"Closed days" KPIs count
   sessions, not distinct dates, so a multi-session day inflates them. This is byte-identical to the legacy
   `attendance` collection's per-session storage — **unchanged by the fix**, not a regression it introduces —
   so touching it would be scope-creep on a no-build sync.

**Consequence.** Both INBOX boxes answered underneath and left **unticked** (multi-recipient), grepped back
after writing (one edit failed on a concurrent write and was re-anchored on surrounding text). No `src/`
change, no gate re-run, no ANDROID commit for code. `cgpe-api` should read the attendance reply — it answers
their scoping question.

## 2026-08-12 — Phase 16 BUILT: "My earnings" self-view, scoped to the v1 aggregate the backend returned

**Context.** The boot found the Phase-16 blocker **cleared**: `cgpe-api` shipped `GET /api/payroll/my-earnings`
(backend Phase 28) — the `protect`-only, self-scoped read filed 2026-08-11 and nudged 2026-08-12. It forces
`user_id` to the token, so any authenticated staff reads only their own pay. But the backend chose to return the
**`/compute` RosterRow** (a monthly aggregate) rather than the richer per-day body the 2026-08-10 UI lock proposed
("guarantees your self-view is byte-identical to the admin figure … file it and we'll add" — INBOX). That gap is
the one thing that materially changed the build, so it was put to the owner.

**Decision.**
1. **Owner chose ship-now (v1 aggregate) over re-blocking on the richer body.** Built `src/app/earnings.tsx`
   against what exists: headline `payable`, KPI strip, payable-days `<Meter>`, pay-basis card, 12-month strip,
   provisional pill. Three forced deviations, all documented in `PHASE-16.md` D-1/D-2/D-3: **(D-1)** no per-day
   `<Spine>` list — v1 carries no `breakdown[]`, and a per-day rupee figure would need the forbidden multiply;
   **(D-2)** the locked "Overtime h" KPI → "Worked hours" (v1 has no overtime split); **(D-3)** `EmptyState` in
   place of `characters.tsx`, which **Phase 14 deleted** — reconstructing 7 illustrations would be invented work,
   and `EmptyState` is the app-wide idiom (payroll.tsx precedent).
2. **`getMyEarnings` uses low-level `req()`, not `tryReal`.** `tryReal` does `json?.data ?? json`, which turns a
   `data:null` body into the whole envelope — it cannot tell "no payroll profile" (200, an empty state) from a
   real row. The three outcomes are a discriminated union `{status:'ok'|'empty'|'error'}`: `empty` raises **no
   banner** (the 200 cleared health); `error` raises the banner **except** on 401/403/404/501 answer statuses.
3. **No role gate — the row is ungated in `more.tsx`.** Unlike the admin Payroll roster (Phase 20, gated on the
   real `admin`/`super_admin` role because the backend 403s a leader), `/my-earnings` is `protect`-only and
   self-scoped, so every signed-in member gets the "My earnings" row. If they have no profile, the screen says so.
4. **The app never multiplies (pinned).** Every ₹ figure is the server's, rendered via `inr()`. The only
   on-device arithmetic is `absent = working_days − present_days` (days) and the meter ratio — no `*` on a rate.
   A real profile with all-zero figures shows "No attendance recorded", **not ₹0**, gated so a `base`-segment flat
   salary with no present days still shows its figure.

**Consequence.** Phase 16 moves **Blocked → Built**. 6 files, commit `c77e1ad` (local — push 403s). Gates: `tsc`
0, `npm test` **360/360** (+10), lint 0 errors/12 warnings. **Carried:** the device reconciliation (≥3 real people
vs the payroll sheet — the highest-trust-cost bug), light/dark at 390 px, and **Phase 1 clock-in** as the stated
hard prerequisite (a clock-in dropped on a bad connection under-states pay). If the per-day breakdown is wanted,
re-file `breakdown[]` + the days split to `cgpe-api` — they offered to add it.

## 2026-08-12 — INBOX sync (no build): campaigns count endpoint verified inert; Phase-16 nudge re-filed

**Context.** Third boot of the day, after the app-UI sync (entry below). Board editor-exhausted: Phase 22
(i18n P1 bulk) paused on owner copy, Phase 16 (self-view salary) and Phase 6 (commissions) backend-blocked.
One upstream change was dated today — `cgpe-api` Phase 27 added a PII-free `GET /api/campaigns/audience/count`
and flagged that `cgpe-admin` ships client names+phones to the browser purely to render a count. The item was
addressed `→ cgpe-admin` only. At the owner's direction, the session's single action was to nudge the standing
Phase-16 backend ask.

**Decision.**
1. **Verified the campaigns-count change is a no-op for mobile — did not wire it.** Mobile's
   `getCampaignAudience` (`src/data/api.ts:2013`) is consumed by `campaigns.tsx`, `premium.tsx` and `jobs.tsx`,
   all of which **deliberately render the sample names/messages** as the core campaign-preview feature
   (`src/app/campaigns.tsx:34-41` documents this explicitly). Mobile has no filter-driven auto-refresh-count
   surface that would ship PII merely to display a number — that was the panel-only problem. So mobile
   legitimately needs `/audience` with its sample and gains nothing from the count-only endpoint. Correctly
   addressed `→ cgpe-admin` only; verified against our real call sites, not assumed from the item text.
2. **Re-filed the Phase-16 self-earnings ask as a fresh top-of-queue nudge — not a re-scope.** The 2026-08-11
   ask is already correct and narrow (one self-scoped read of the `payable` `computeRangeSalary()` already
   produces); the only failure was visibility — buried at the foot of a 260 KB file, stale-dated, unanswered.
   Added a self-contained 2026-08-12 `→ cgpe-api` item at the top of `../contracts/INBOX.md` restating the one
   ask + two-option minimal spec (`GET /api/payroll/my-earnings`, or a `req.user.user_id`-forced `buildRoster()`
   path lifted out from under `authorize('admin')`) + the "strictly safer than the admin `/compute`" argument,
   pointing to the old foot item + `PHASE-16.md` for full detail. Left **unticked** (outgoing). Grepped back per
   the concurrent-write rule — survived (1 occurrence, top of queue).

**Consequence.** No `src/` change, no gate re-run. Board unchanged: Phase 22 waits on owner copy, Phase 16 on
`cgpe-api` building the self-scoped route (the nudge is now current-dated and visible at the top), Phase 6 on
the commissions aggregate. The campaigns endpoint is a confirmed no-op for mobile. Push still 403s — the INBOX
nudge lives only on disk (`contracts/` untracked), not in any commit.

## 2026-08-12 — INBOX sync (no build): app-UI closed-envelope verified; i18n paused on owner copy

**Context.** Boot found the board editor-exhausted (the copy-free `common.*` work shipped the same day; entry
below). One INBOX item was open and addressed to this session: **2026-08-12 · from cgpe-api** — backend Phase 11
closed the `GET/PUT /api/rbac/app-ui` `data` envelope, dropping `_id` / `updated_at` / `updated_by`, and asked
`cgpe-mobile` to confirm no code path reads those three fields.

**Decision.**
1. **Verified and answered the app-UI item — confirmed inert on our side.** Three checks: `getAppUiConfig`
   (`src/data/api.ts:2516`) returns `env.data` wholesale, but its only consumer, `normalizeUiConfig`
   (`src/store/appUi.tsx:213`), rebuilds a **fresh** object reading only `role_key`/`label`/`dashboard`/`nav`/
   `features`/`theme` — it never references the three removed keys; the `AppUiConfig` type
   (`src/data/api.ts:2489`) declares no audit field; and a tree-wide grep for `updated_at`/`updated_by` hits
   only unrelated domains (notes, tasks, members, tickets). Replied underneath the item in `../contracts/INBOX.md`,
   box left **unticked** (multi-recipient with `cgpe-admin`), and grepped the reply back per the concurrent-write
   rule. No `src/` change, no gate re-run.
2. **Handed the owner the bounded `common.*` fill-list and paused i18n at their direction.** The copy-free slice
   is exhausted; every remaining net-new `common.*` key (`tryAgain` ×34, `clearSearch`, `refresh`, the outage
   body, the a11y labels) needs human gu/hi/hi-en/gu-en copy (PHASE-19 §4 forbids inventing it). Presented the
   ~16–18-key fill-table (§4.1 net-new set) and asked how to proceed; owner chose **pause** — no translator
   available now. Nothing app-side is buildable until copy lands.
3. **Corrected one stale doc line.** `docs/i18n/SCOPE.md` §4.1 still listed `common.today` under "still to add";
   it shipped 2026-08-12 (parity 75). Removed from the to-add set.

**Consequence.** Board stays editor-exhausted: Phase 22 (i18n P1 bulk) waits on owner copy; Phase 16 (self-view
salary) and Phase 6 (commissions) stay backend-blocked (`my-earnings` reply still not landed at INBOX foot). The
app-UI envelope change is a confirmed no-op for mobile. Push still 403s — commit local.

## 2026-08-12 — Phase 21 P1: `common.*` dedup — wired the copy-free slice only

**Context.** P0 (`t(key, params?)`) shipped (entry below). P1 in `docs/i18n/SCOPE.md` §4.1 is the `common.*`
dedup layer — routing ~25 repeated labels through shared keys so ~1,800 occurrences collapse toward ~1,200.
But its highest-value keys (`Try again` ×34, `Clear search`, `Refresh`, the ~8-variant outage body) are
**net-new** and need human Gujarati/Hindi/Hinglish/Gujlish copy, which PHASE-19 §4 forbids inventing. Phase 16
self-view is still backend-blocked (INBOX `my-earnings` unanswered). At the owner's direction ("full copy-free
dedup"), built the slice that needs **zero** new copy.

**Decision.**
1. **Routed the already-translated labels to existing `common.*` keys across 16 screens** — `Call`→`common.call`,
   `Cancel`→`common.cancel`, `Delete`→`common.delete`, `WhatsApp`→`common.whatsapp`. `Call`/`Cancel`/`Delete`
   now render in Gujarati/Hindi where they were hardcoded English; `WhatsApp` is a trade noun (English in all 5),
   so its wiring is **centralization only, no visible change** — kept for button-row consistency.
2. **Added `common.today`** (parity **74 → 75**, bumped deliberately in `dictionaries.test.ts`) by **lifting the
   existing human copy** from `tab.home`/`tasks.today` (identical `આજે`/`आज`/`Aaj`/`Aaje` in all 5 dicts). This is
   **dedup of already-approved copy, NOT machine translation** — the only net-new `common.*` key whose four
   non-English values already existed under another key. Wired the standalone `Today` eyebrows (`home` ×2,
   `attendance`) and the `reminders` "Today" section title to it.
3. **Wired the `reminders` sibling section titles too** — `Overdue`→`tasks.overdue`, `Upcoming`→`tasks.upcoming`
   (both existing keys) alongside `Today`. Translating only "Today" of the three would leave a visibly
   half-translated group; all three are copy-free.

**What was deliberately NOT wired (needs copy, or would be half-done).**
- **All net-new `common.*` keys** — `tryAgain`, `clearSearch`, `clear`, `saving`, `uploading`, `refresh`,
  `loadMore`, `all`, `yesterday`, `done`, `mobile`, `onDuty`, `signedIn`, `continue`, `goToSignIn`,
  `showResults`, the a11y `Call {name}` / `Open WhatsApp chat with {name}` — need human copy. Deferred to the
  owner; this is the bulk of P1's occurrence count and stays blocked exactly as scoped.
- **The four module-level date helpers** (`calendar.dayTitle`, `reminders.timeFor`, `notifications.dayLabel`,
  `whatsapp/[id].dayLabel`) return `Today`/`Yesterday`/weekday/formatted-date from one function; `t` is not
  reachable there and wiring only the `Today` branch while `Yesterday`/weekdays (no keys, need copy) stay
  English would be half-done. Skipped whole.
- **`task-new` due-date picker "Today"** — one option in a `Today`/`Tomorrow`/… set whose siblings have no keys.
- **`more.tsx` nav-tile "WhatsApp"** — the feature/screen name in the More nav-label set, a separate surface.

**Naming.** In `tickets/index.tsx` (`const t = typeMeta(...)`) and `notes.tsx` (`setTotal((t) => …)`) the local
`t` was already taken, so the translator is bound to **`tr`** there to avoid shadowing; every other screen uses
the app-standard `t = useT()`.

**Consequence.** 16 screens + `src/i18n/index.tsx` + the parity test. Gates: `tsc` 0, `npm test` **350/350**
(unchanged — no new pure logic; parity assertion moved 74→75), `lint` 0 errors/12 warnings (baseline). No dictionary string was
translated by machine; the one added key reuses existing human copy. Push still 403s (commit local). Next
copy-free step is exhausted for `common.*`; further P1 and any Tier-1 wiring now wait on **owner-supplied copy**
— the fill-list is the net-new `common.*` set above.

## 2026-08-11 — Phase 21 P0: extended `t()` to `t(key, params?)` — interpolation + plurals, no copy

**Context.** The i18n widening was scoped (entry below) but not built; its P0 prerequisite — `t()` has no
interpolation — is the one part buildable now with **no** human copy, no backend, and no new dictionary
keys. Phase 16 self-view is still backend-blocked (INBOX `my-earnings` ask unanswered), so this was the
next editor-buildable step per `docs/i18n/SCOPE.md` §3 P0.

**Decision.** Extended `t: (key) => string` to `t(key, params?)` in `src/i18n/index.tsx`, adding **only**:
1. **Named interpolation** — `{name}` tokens filled from `params` by name. A placeholder with no matching
   (non-null) value is left **verbatim** (`{name}`) — a visible gap is a bug you can see, never a silent
   blank or the string `"undefined"`. Only `{word}` tokens are touched, so a stray brace in copy is safe.
2. **Count-aware plurals** — when `params.count` is a number, prefer `key_one` / `key_other`, chosen by the
   **CLDR cardinal rule for the ACTIVE language**: English marks only exactly 1 as `one`; Hindi & Gujarati
   (and their romanized pair) mark **both 0 and 1** as `one`. Falls back to the base `key` when neither
   variant exists. **No string concatenation** anywhere — the whole reason plurals live in the dictionary.
- **Single-arg `t(key)` is byte-identical** to the old implementation (language → English → key), so all
  74 existing keys and every current call site are unchanged.
- **Testability seam:** the pure engine `translate(lang, key, params?, lookup?)` takes an optional
  injected `lookup`, so the plural + interpolation branches are pinned against a **controlled** dictionary
  in `__tests__/format.test.ts` **without adding any real key** (which would trip the hard 74-key parity
  count). `pluralCategory` and `interpolate` are exported and pinned as pure units too.

**Why per-language plural rules, not English-only.** Rendering "0 kaam" with the English `_other` form
would be grammatically wrong in Hindi/Gujarati, which take the singular at 0. The category is computed
from the display language, which is the standard (i18next/CLDR) behaviour and the boring correct one.

**Consequence.** No dictionary key added → `EN_KEYS.length === 74` parity gate untouched and still green.
The mechanism is now in place; a future phase can wire dynamic strings (`{n} of {total}`, `Overdue by {n}
days`, `Namaste {name}`) once human copy exists. Gates: `tsc` 0, `npm test` **350/350** (+20), `lint`
0 errors/12 warnings. Committed `a7a0979` (push still 403s). Next: the `common.*` dedup layer (P1, also
copy-free), then wire one Tier-1 screen and hand the owner its fill-in list.

## 2026-08-11 — i18n `t()` widening: SCOPED, not built (board was blocked)

**Context.** Phase 16 self-view stays backend-blocked (re-verified `routes/payroll.js:22-23` is still
`authorize('admin')`, no `my-earnings` route, INBOX ask unanswered). Nothing else on the board was
editor-buildable without an external input. At the user's "whatever you suggest", the lowest-risk useful
move was the PHASES "Next 3" #3 item — widening the language toggle beyond its 74 wired keys.

**Decision.** **Scoped it, did not build it.** Six parallel read-only extraction passes over ~45 screens
produced `docs/i18n/SCOPE.md` + `inventory/01–06*.md` (screen · line · kind · English · proposed key).
Widening `t()` genuinely needs **human-supplied** Hinglish/Gujlish/Hindi/Gujarati copy (~4,800 non-English
strings) and PHASE-19 §4 forbids machine translation, so building it now would either fabricate copy or
produce untested dead keys. The deliverable is a decision (which tier to wire, whether to do the `t()`
extension first), not code.

**Three prerequisites surfaced (all verified against real code), which is the substance of the decision:**
1. **`t()` has no interpolation** (`t(key)=>string`). ~30% of extracted strings are dynamic; they need a
   `t(key, params)` + count-plural extension and must NOT be string-concatenated (Hindi/Gujarati word
   order differs). This is prerequisite engineering, buildable with no copy.
2. **A `common.*` dedup layer** — "Try again" recurs ~30×, the outage body in ~8 variants; wiring shared
   strings once takes ~1,800 occurrences down to ~1,200 unique keys.
3. **The parity test (`src/i18n/__tests__/dictionaries.test.ts`) has a blind spot.** It hard-codes
   `EN_KEYS.length === 74` (must be bumped deliberately) and its leak check rejects only `value === key`,
   **not** `value === English` — so a Gujarati entry left as the English string passes the suite green.
   The test cannot certify that translation happened; human copy is load-bearing.

**Consequence.** `docs/i18n/` is the durable worklist and plan; nothing in `src/` changed, no dictionary
edited, gates not re-run. The next editor-buildable step (independent of backend/translator) is P0: the
`t(key, params)` interpolation + plural extension and the `common.*` layer. Committed local-only (push
still 403s). Data-derived label maps (`src/data/labels.ts`) are a separate uncounted ~50–100-string surface.

## 2026-08-11 — Phase 20: built an admin-only in-app payroll roster (owner-directed scope change)

**Context.** After the Phase 16 re-eval (below), the user (as product owner) was asked how to handle
salary in the app given the backend is deliberately admin-only. They chose **"Build an admin-only salary
screen in the app."** First the state was re-verified against `cgpe-api`'s real code — not the earlier
read, not the tags: `routes/payroll.js:22-23` still wraps the whole router in `authorize('admin')`,
`middleware/auth.js:73` still 403s every non-admin, and a whole-tree grep (`earnings|my-earnings|/payroll`)
found only the 8 admin routes. So the Phase 16 self-view is genuinely still blocked; the admin surface is
what exists.

**Decision.** Built `src/app/payroll.tsx` on `GET /api/payroll/compute` (admin/super_admin only), as a
**separate** screen from Phase 16 — not a re-scope of it. The Phase 16 UI lock and its filed self-read ask
are untouched.
- **No PII on the phone.** Consumed `/compute`, which omits Aadhaar/PAN/bank (`routes/payroll.js:306`) — not
  `/profiles` or `/export`. This is why the "PII on mobile" concern raised when offering the option shrank:
  the screen shows salary + attendance figures + the server payable, no identity PII.
- **The app never multiplies.** Every `payable` is server-computed; the one on-device sum is the roster
  total, a `reduce(+)` over the server's own payables — an aggregate of computed figures, not a rate
  derivation. A test pins that `payable` is passed through unchanged.
- **Gated on the REAL role, not the tier.** `store/roles.ts` `tierOf()` folds `leader` into the `admin`
  tier, but the backend 403s a leader — so both the More entry row and the screen gate on
  `user.role === 'admin' || 'super_admin'`, never `caps.manageTeam`. A leader never reaches the fetch; a
  stale-role deep-link degrades to the honest "admin-only"/"could not load" states (403 → `tryReal` null),
  never a false ₹0. Two tests pin that 403 is an answer (no banner) and 503 is an outage (banner).

**Consequence.** The app now has an admin payroll view that duplicates a slice of the `cgpe-admin` panel —
an accepted duplication, by owner choice. Phase 16 (self-view for all staff) remains blocked on a
self-scoped backend read that does not exist. If a future session is tempted to point this screen at a
self-read for advisors, that is Phase 16's job and needs the endpoint first. `npx tsc --noEmit` 0;
`npm test` **330** (+7 in `api-payroll.test.ts`); `npm run lint` 0 errors / 12 warnings (baseline). Spec:
`docs/spec/PHASE-20.md`.

## 2026-08-11 — Phase 16 re-eval: backend payroll landed but admin-only; ask narrowed, no build

**Context.** A boot found the backend's Phase 25 payroll cluster (25a profiles / 25b compute / 25c
export) had landed — the endpoints mobile Phase 16 ("My earnings" self-view) was blocked on. The board
tag read "waiting for the backend to create the endpoint (pay field + computed earnings)". The payroll
INBOX notices are addressed to `cgpe-admin`, not mobile, and mobile `[api]` tags have been wrong 5×
(Phases 6/9/10/11/12), so the state had to be verified against the producer's code before acting.

**Decision.** Verified against `cgpe-api`'s real code, filed a narrowed ask, and deliberately built no
`src/` code.
- **The two things Phase 16 asked to be built now EXIST.** Pay field: `payroll_profiles.salary_amount`
  + `segment` (`models/PayrollProfile.js`). Server-side formula: `services/payrollEngine.js`
  `computeRangeSalary()` → a rounded `payable` **number** via `GET /api/payroll/compute` — precisely the
  "compute server-side, the app never multiplies" shape the spec's §Consequence demanded.
- **But it is admin-only, so a mobile self-view still cannot read it.** `routes/payroll.js:22-23` wraps
  the whole router in `router.use(protect); router.use(authorize('admin'))`; `authorize`
  (`middleware/auth.js:73`) 403s anyone not `super_admin`/`admin`. So advisor / learn_advisor / leader /
  payroll_staff — every user Phase 16 targets — get 403 on `/compute`. `?user_id=` is admin-only member
  selection, not a self-scope. `grep -i earnings` over the backend = 0: the proposed
  `GET /api/payroll/my-earnings` was never built, and the engine is reachable ONLY via the two admin
  routes (`/compute`, `/export`). What landed is the *manager-views-salary* surface Phase 16 declared
  OUT OF SCOPE — it belongs to `cgpe-admin`.
- **Narrowed the ask and re-filed to `cgpe-api`** (INBOX, appended + grepped back): one self-scoped read,
  `GET /api/payroll/my-earnings` (`protect` only, own records only, same posture as
  `/time-tracker/stats`) or a self path reusing `buildRoster()` with `user_id = req.user.user_id`. No new
  math. Two original blockers are now moot for this path (recorded so the design doesn't reopen them):
  "app must not multiply" (server returns the number) and the ambiguous-present-days /
  self-writable-`/work-settings` / unscoped-`/attendance/user/:id` trio (the engine reads the member's
  own `daylogs` by `_id` server-side). The only thing left is scoping the READ to the caller.
- **Did NOT build the locked UI against a non-existent endpoint** (it could only render its error/empty
  state — untested dead code; §RISKS makes unfixed clock-in a hard prerequisite), and **did NOT re-scope
  Phase 16 into an in-app admin payroll screen** (that is `cgpe-admin`'s surface; Phase 16 scoped a
  self-view).

**Consequence.** Phase 16 stays blocked, but the surface area of the ask is now **one route, not a
feature** — the pay field and formula are done; only a self-scoped read is missing. No `src/` change, no
gate re-run. Notify `cgpe-api` (done, INBOX). Docs updated: `docs/spec/PHASE-16.md` §"UPDATE 2026-08-11",
`docs/PHASES.md`, `docs/HANDOFF.md`, this file. Commit `21b3be1` local (push 403s). Memory:
`phase16-blocked-on-self-scoped-read`.

## 2026-08-11 — Phase 19 built: 5-language toggle verified + hardened (parity gate + visual walk)

**Context.** Phase 19 asked to verify + harden the *existing* 5-language toggle (English, Gujarati,
Hindi, **Hinglish** = Hindi-in-Latin, **Roman Gujarati/Gujlish** = Gujarati-in-Latin), not build a
new one. Cheapest durable core is a dictionary-parity test that needs no device; the visual pass rides
the Phase 18 harness.

**Decision.** Shipped in two units.
- **Core: a parity Vitest (`src/i18n/__tests__/dictionaries.test.ts`), 18 cases.** Asserts the five
  languages are exactly `[en, gu, hi, hi-en, gu-en]`, English carries the full **74-key** set, every
  dictionary has every English key and no extras, and **no value is blank or identical to its own key**
  (the raw-key-leak class DONE-2 names). TypeScript already owns key parity via
  `Dict = Record<TKey, string>`; this owns the value-quality checks the type system cannot see, and is a
  **permanent gate**. Required one app-side line: `export const DICT` (was module-private) so the test
  can read the dictionaries — nothing under `src/app` imports it; screens still go through `t()`.
- **No dictionary was edited and nothing was machine-translated.** The test passed as-is: the shipped
  dictionaries are already at full parity. Per spec §4 a missing string is a *finding to report*, never
  a gap to fill with a guess — a wrong Hinglish/Gujlish string is worse than an honest English fallback.
- **Visual: `e2e/tests/50-languages.spec.ts`, one test per language.** Drives the **real** Settings
  toggle (clicks the row by its stable **English** label — rows are always English — and confirms the
  `settings.language` heading, the one string distinct in all five languages, both **live** and **after
  a `page.reload()`**: DONE-3 on the web slice). Then walks all 42 screens, screenshots each into
  `languages/<code>/`, and scans for a leaked key (`namespace.word` regex — tight enough that real prose
  never matches). Result: **42/42 render in every language, 0 key leaks.** Drove the toggle rather than
  hand-seeding `cgpe.lang.<user>` because that exercises the real write + `refreshI18nUser` bus +
  reboot-read, which *is* the DONE-3 behaviour (same reasoning `session.ts` signs in via the form).
- **`assertRenders` gained opt-in `{ settleSplash }` (default OFF).** Every `page.goto()` re-shows the
  animated Splash for ~1900ms; without waiting it out, the screenshot AND the returned body the leak
  scan reads were the logo, not the screen. The language walk waits for the Splash tagline to detach
  first. Kept opt-in so the other three specs stay byte-identical — this is the "pixel-clean
  screenshots" thread the Phase 18 handoff explicitly left for Phase 19.

**Consequence.** Dictionary completeness is now a `npm test` gate (**323/323**, +18). The per-language
screenshots exist for the user's naturalness (DONE-4) + layout (DONE-5) review. **Coverage reality,
recorded so it isn't rediscovered:** only the **74 `t()`-wired keys** change with the toggle — much of
the app (Settings body rows, most screen chrome) is **hardcoded English** and stays English in every
language. That is the current app, not a toggle bug; widening `t()` is separate, larger work, out of
this "verify + harden" phase's scope. Gates: `tsc` 0, `npm test` 323/323, `lint` 0 errors/12 warnings.
Push still 403s (commits `433250c`, `2c599c5` local).

## 2026-08-11 — Phase 18 built: Playwright + Expo-web watchable E2E harness, offline & synthetic

**Context.** Phase 18 asked for a *watchable*, A-to-Z, worst-case end-to-end test the user can sit and
watch in a browser, with edge-case injection, touching zero production data. Tooling was pre-approved.

**Decision.** Built it as **Playwright driving the Expo web build**, in a new `ANDROID/e2e/` tree kept
**outside `src/`** and invisible to every gate. Key locked choices:
- **Web boots with NO app guard.** The spec's headline risk (§2 — a module-scope native import
  redboxing web) does not occur: `tracker.ts` guards `expo-task-manager`/`expo-location` behind
  `isNative`, `biometricIdentity.ts` lazy-requires `expo-secure-store` only when `!isWeb`, `AppLock`
  no-ops on web. `expo start --web` bundles 1590 modules clean and login renders. So **no `src/`
  screen was touched** — the only app-side edits are gate isolation (`tsconfig.json` `exclude:["e2e"]`,
  `eslint.config.js` `ignores:["e2e/**"]`).
- **Session mode = the login token prefix.** The harness drives the *real* login form against a mocked
  `/auth/login`; a `demo-` token makes the app run fully offline (degraded rendering), any other token
  makes calls real so mocks/faults apply. Faithful to production and self-checking (no hand-seeding of
  AsyncStorage's web keys).
- **Everything synthetic.** All `**/api/**` traffic is intercepted (CORS + preflight); no request
  reaches a real backend. The healthy mock returns each endpoint's real *shape* but empty contents —
  and object/stat reads are **zero-FILLED, not `{}`**, because several screens deref stat fields
  unguarded and crash on a partial object (the app guards `null`, not `{}` — a real robustness class
  if the backend ever drift-returns `{}`; noted, not fixed here, as this is test infra).
- **Coverage.** 33 tests: web-boot smoke, backbone (login+CORS+deep-link restore), **A-to-Z render of
  all 42 web-reachable screens**, **21 worst-case cases** (500/503/malformed/empty-200/timeout/oversized
  on representative data screens, asserting the shared `<HealthBanner/>` data-health contract), and a
  **bad-input matrix** (login empty/whitespace/refused/network/hostile/double-submit + hostile input on
  search/task-new/claim-new). Worst-case + bad-input run on a **representative** set, not all 47 — the
  banner is app-wide (mounted once, routed through `unavailable`/health), so the contract generalises;
  the selection is stated in `e2e/README.md`, no silent cap.
- **Known cosmetic quirk (documented, not chased).** ~12 More-menu/detail screens show a count=1
  "some data could not load" banner under the *healthy* mock, sourced from the home-dashboard widget
  prefetch that renders underneath a pushed stack screen on cold deep-links (all responses are 200 and
  valid; a timing/fidelity artifact, not a render failure). All 42 screens render; recorded as info.
- **Detail-route realism.** A healthy backend has no record `e2e-1`, so detail-by-id reads return a
  **404** (screens degrade to "not found"), and synthetic detail ids are **24-hex** so `api.ts`
  `healthKey()` collapses `/leads/:id` — otherwise a suppressed 404's key ≠ the `unavailable` key and a
  false banner leaks. `/team/task-overview` etc. are named sub-resources, never treated as detail ids.

**Consequence.** `npm run e2e` opens a headed browser that walks + stresses the app; artifacts (video,
trace, per-screen stills, HTML report, an `OPEN-ME.md` index, and `WHAT-WEB-CANNOT-REACH.md`) land in
`e2e/artifacts/`. Gates green (`tsc` 0, `npm test` 305/305, lint 0 errors/12 warnings). **Phase 19's
visual per-language pass now rides this harness.** The native-only backlog (haptics, background GPS,
biometric lock, native map, cold-start persistence) is unchanged and named in `WEB-LIMITS.md` — a green
web run is the web slice, not the whole app. Push still 403s; commits are local. Memory:
`e2e-harness-phase18`.

## 2026-08-11 — INBOX: legacy `/api/users` identity store deleted (backend Phase 19) — no-op for the app

**Context.** A boot found a new `→ cgpe-admin, cgpe-mobile` notice from `cgpe-api`: the legacy
`/api/users` register/login/list/`:id` endpoints and `models/User.js` were deleted (BREAKING, but
claimed zero-consumer). "Receiving an item is not authorisation" — verify first.

**Decision.** Confirmed a genuine no-op for the app and replied under the item (box left unticked —
multi-recipient). `grep -nE "/api/users|/users/register|/users/login|getUsers" ANDROID/src` → 0, and a
case-insensitive `users` scan of the whole network layer (`src/data/api.ts`) → 0. Auth flows entirely
through `/api/auth` on the real `{ user_id }` staff token, never the dead `{ userId }` shape, so the
now-un-mintable legacy token changes nothing; the struck `enums.md §1.3` `user|admin` vocabulary was
never in `src/`.

**Consequence.** No `src/` change. Reply grep-verified present after writing (INBOX concurrent-write
discipline).

## 2026-08-11 — INBOX sync: backend Phase 17 / 18 FYIs verified as no-ops for the app — no code change

**Context.** A boot re-read of `contracts/INBOX.md` surfaced the two newest `→ cgpe-admin, cgpe-mobile`
notices from `cgpe-api`, both dated 2026-08-11 and both previously answered by `cgpe-admin` only:
Backend **Phase 18** (`/api/leaves` is now a real feature — 8 routes, was a 5-route stub — and
`GET /api/attendance/calendar` + `/day/:date` gained `is_leave` / `leave_type` and a new
`status:'leave'`, precedence `holiday › leave › attendance`) and Backend **Phase 17** (a background
sender now reads the already-stored `report_schedule`; `weekday` pinned `0`=Sun…`6`=Sat; `last_sent`
now written). "Receiving an item is not authorisation" — each verified from our own code before reply.

**Decision.** Confirmed both are genuine no-ops for the app; **no `src/` change**, replies appended
under each item (boxes left unticked — multi-recipient, per protocol). Evidence, each grep-confirmed:
- **Phase 18 — `/api/leaves`:** `grep -niE "leave|/api/leaves" ANDROID/src` returns only prose, the
  `leaveTimer`/`LEAVE_AFTER_DONE`/`LEAVE_AFTER_TRANSFER` identifiers (`task/[id].tsx:64-65`), and one
  "Leave unassigned" UI string — **no `/api/leaves` path and no `createLeave`/`getLeaves`/`approveLeave`
  helper**. The app has no leave-request/list/approval surface, so the stub→real transition lands
  entirely on the backend + panel.
- **Phase 18 — attendance calendar fields:** `grep -nE "is_leave|leave_type" → 0`;
  `grep -nE "attendance/calendar|attendance/day" → 0` (the `/calendar` hits are all
  `router.push('/calendar')` to our own client route). The app's entire attendance read surface is
  `getAttendanceHistory` (`api.ts:1746` → `/time-tracker/history`, `/attendance/history`) and
  `getAgentLocations` (`api.ts:1862+` → `/attendance/user/:id`) — it opens **neither** endpoint Phase 18
  changed. And `attendance.tsx` adapts each row to `Entry = { date, inTime?, outTime?, location? }`
  (`:49`) — **no `status` field, nothing switches on one** — so the new `status:'leave'` enum value is
  inert by construction, not a mis-routing risk.
- **Phase 17 — report scheduler:** `grep -niE "report-schedule|report_schedule|last_sent|/reports|weekly"
  ANDROID/src` → **0 matches**. The app never reads `report_schedule` / `weekday` / `last_sent`, never
  calls `/api/settings/report-schedule` or `/api/reports`, and has no schedule UI — that lives only in
  the panel's Settings. Wiring a sender to stored data is invisible to the app.

**Consequence.** Both FYIs are closed on our side and should not be re-verified next boot. No
contract/`CHANGELOG` change (no shape moved). One forward-looking note recorded under Phase 18: when
mobile **Phase 16** ("My earnings") eventually unblocks, the now-real leave data + attendance
`status:'leave'` day becomes a valid *input* to a "present days / payable days" figure (a leave day is
not an absence) — but Phase 16 stays `cgpe-api`-blocked on a **pay field + salary formula**, which
Phase 18 does not supply (leaves ≠ salary). Board remains editor-exhausted.

## 2026-08-11 — INBOX sync: backend Phase 9 / 10 / 15 FYIs verified as no-ops for the app — no code change

**Context.** After Phase 9 closed, a boot re-read of `contracts/INBOX.md` surfaced three newer
`→ cgpe-admin, cgpe-mobile` notices from `cgpe-api`, all self-described "FYI, nothing to do":
Backend **Phase 9** (attendance watchdog — D9/D7/D11), **Phase 10** (`ux_session_id` unique index on
`location_tracks.session_id`), and **Phase 15** (dead-code sweep — deleted the unmounted
`gujaratiQuestions.js`, removed the shadowed second `/api/health` registration, changed the
catch-all-404 body for unknown paths from `{ error, path, method, availableRoutes }` to
`{ status, message }`). "Receiving an item is not authorisation" — each was verified from our own
code before replying, not trusted.

**Decision.** Confirmed all three are genuine no-ops for the app; **no `src/` change**, replies
appended under each item (boxes left unticked — multi-recipient, per protocol). Evidence, each
grep-confirmed:
- **Phase 9** — `grep -niE "attendance_violations|attendance.*webhook|weekly_summary|N8N_ATTENDANCE"
  ANDROID/src` → 0 hits. The app reads only `/api/attendance/*` (calendar/day/user via
  `attendance.tsx` + `getAgentLocations`); the webhook, the `attendance_violations` collection, and
  the `attendance.weekly_summary` payload are all server-internal.
- **Phase 10** — the app already writes the canonical key: `startTrack`/`postTrackPoints`/`stopTrack`
  (`api.ts:1796/1824/1838`) each `JSON.stringify({ session_id, ... })`, and `api-track.test.ts:88`
  asserts no `sessionId` alias leaks. The unique index reinforces our Phase-7 D5 handling; it decides
  nothing. (The notice's "still-open Phase-12 question" framing conflates it — mobile Phase 12 was
  the `/profiles` role gate, unrelated to the track wire key.)
- **Phase 15** — `grep -niE "gujarati-questions|gujaratiQuestions" ANDROID/src` → 0; no `/api/health`
  caller; `grep -n availableRoutes ANDROID/src` → 0. The one place we read a 404 body reads `message`
  (`api-whatsapp.test.ts:304`), which is the *new* shape, so the change is invisible to us.

**Consequence.** The three FYIs are closed on our side and should not be re-verified next boot. No
contract/`CHANGELOG` change (no shape moved). `cgpe-api` can read the picked-up replies. The board
remains editor-exhausted: Phase 6 commissions and Phase 16 salary stay `cgpe-api`-blocked
(re-confirmed against `CHANGELOG.md` this session — no product aggregate, no pay field).

## 2026-08-11 — Phase 9: reminders persist via `acknowledge` (one-way); task-steps already gone, claim-docs already honest — the `[api]` tag was wrong

**Context.** `docs/PHASES.md` marked Phase 9 ("reminders/checklists persist") **`[api]` / Blocked on
cgpe-api**. A fresh read of the backend at session start found `POST /api/reminders/:id/acknowledge`
(`cgpe-backend-main/routes/reminders.js:419`, `contracts/api.md:914`) has existed since before this
app did — the same "predicted backend dependency was never real" pattern as Phases 6/10/11/12. The
phase names three controls; they have three different truths (see `docs/spec/PHASE-9.md`).

**Decision.** (1) **`toggleReminder`** wired to `POST /reminders/:id/acknowledge`, returning the
server's verdict (`Promise<boolean>`, modelled on `markAllNotificationsRead` — no `reportFailure`, a
single write surfaces inline). `adaptReminder`'s done-regex gained `acknowledg` (case-sensitive; the
wire value is lowercase `acknowledged`) so the persisted state reads back as done. `getReminders`
already reads `GET /reminders` — the **same** Mongoose store scoped by `user_id`, same `_id` space — so
no new read and no id translation. (2) **Completion is one-way**: the backend has no un-acknowledge
(`PUT /:id` takes no `status`; `/:id/cancel` sets `cancelled`, still *done*), so `reminders.tsx`'s
"Reopen" swipe action and done-row undo button were **removed** — a reopen could only revert on the
next refetch, the exact silent-tick lie this phase deletes. The screen now mirrors `tasks.tsx`:
optimistic tick, per-row rollback + warning `Banner` on a refused write, `haptics.success` only on a
confirmed one. (3) **`toggleTaskStep`** was already removed in Phase 1 (no endpoint exists) — the "or
the control is gone" arm is already satisfied; untouched.

**Deviation from the approved plan — `toggleClaimDoc` left as-is, NOT made read-only.** The session
plan (and the question the user approved) said "make the claim-docs control read-only." Reading
`claim/[id].tsx` showed that would be wrong: the checklist **already discloses it does not persist**
(the footer renders "This checklist is a working note on your handset. Ticking a document does not
update the register.", `:416`) and uses `haptics.select`, so it is not the silent-revert harm the phase
targets; and the tick is **load-bearing for the real upload flow** (`:262-270` ticks the doc after a
genuine `/upload`). There is also nothing to wire — the backend `Claim` schema has no persisted
`documents` field (`cgpe-api`'s Phase-8 INBOX notice). Making it read-only would delete honest, working
functionality to fix a lie that is not there. Left untouched; flagged here and in the handoff so the
call is visible and reversible.

**Consequence.** A reminder marked done now stays done across a cold start (device-verify carried,
criterion 4). No contract/`CHANGELOG` change — every endpoint already existed and was documented; the
`[api]` tag is struck. Gates: `npx tsc --noEmit` exit 0; `npm test` **305 tests / 14 files** (+6:
`api-reminders.test.ts` pins the acknowledge request + four outcomes, plus one `adapt.test.ts`
`acknowledged → done` case); `npm run lint` **0 errors / 12 warnings** (baseline unchanged). Push still
403s — commit is local. A "shipped, nothing owed, your `[api]` tag was wrong" INBOX notice to
`cgpe-api`/`cgpe-admin` is the follow-up, in the Phase-10/11/12 shape.

## 2026-08-11 — INBOX Phase-14 (notifications/notices 5xx) verified conformant — no app change

**Context.** Backend Phase 14 (`contracts/INBOX.md`, 2026-08-11 item from `cgpe-api`) changed three
read endpoints — `GET /api/notifications`, `GET /api/notifications/unread-count`,
`GET /api/notices/unread` — to answer **503/500** on a thrown query instead of masking it as
`200 { success:true, data:[] }`. The item asked both clients to grep: "if a client reads the empty-200
as 'empty', branch on `success`/HTTP status so an outage shows 'couldn't load', not 'no
notifications'." The previous handoff flagged this as the one genuinely-buildable carry-item and said
"if clean, tick it; if not, it's a small honesty fix in the Phase-3 class."

**Decision.** Verified clean; **no code change**. Findings, each grep-confirmed:
(1) Of the three endpoints the app calls **only `GET /api/notifications`** (`api.ts` `getNotifications`,
`/notifications?limit=50`). `/notifications/unread-count` and `/notices/unread` have **zero callers**
in `src/` — the unread count is derived client-side from the fetched list (`home.tsx:674`,
`notifications.tsx:139`). So two of the three cannot mislead because they are never read.
(2) `getNotifications` returns rows only under `if (ok && arr)` — it keys on HTTP `ok`, not on
empty-vs-non-empty — so a non-2xx (the new 5xx) falls through to `unavailable('/notifications')`,
which `reportFailure`s and raises the global `<HealthBanner/>`. `healthKey` strips the query
(`api.ts:110`), so the success-clear (`reportSuccess('/notifications')`) and the failure-set share one
banner row and recovery clears it. Before the fix, the empty-200 gave `ok:true, arr:[]` → returned
`[]` with no report → the exact silent false-empty the item warned about; the backend 5xx + our
existing `ok`-keying now surface it together.
(3) `notifications.tsx:286-300` already branches its zero-items empty state on
`useDataHealth().degraded` ("The feed did not load / Try again" vs "You are all caught up").
(4) `getCompanyNotices` reads `GET /notices?limit=60` — a **different** endpoint from the item's
`/notices/unread` — through the reporting `tryEnvelope`, and `notice-board.tsx` has a dedicated
`/notices` outage branch. Honest regardless.
(5) `POST /notices/:id/read` now 404s on a stale id; our one caller (`notice-board.tsx:173`) fires
`markNoticeRead` fire-and-forget with the result ignored (bare `req`, no health report), so a 404 is
silently absorbed as "gone" — matching the backend's guidance. We do not read the new `read_by` field.

**Consequence.** The app inherits the backend honesty fix with zero source change: an outage on the
notifications feed now shows a health banner + "couldn't load / retry", where before Phase 14 it showed
a silent "you're all caught up". Recorded as a reply under the INBOX item; **box left unticked**
because the item is addressed to `cgpe-admin` as well (multi-recipient protocol), and the item itself
asks for no tick. No CHANGELOG entry — nothing changed shape on the app side. No test file — no new
pure logic; the verified behavior is existing `unavailable`/`degraded` plumbing already covered by the
data-health suite. Gates not re-run (no source touched).

## 2026-08-11 — Master/Admin KPI tiles blank to NO_VALUE on a missing org snapshot, gated on `snapshot`-presence (not `useDataHealth().degraded`) — Phase-3 carry-out CLOSED

**Context.** The last open item from Phase 3 (`docs/spec/PHASE-3.md` §2, `docs/PHASES.md` "Next 3"
#3): `src/screens/dashboards.tsx`'s Master KPI grid (`:292-297`) and Admin KPI grid (`:211-213`)
rendered each org figure as `snapshot?.field ?? 0`, so a **partial outage** (roster loads, org
endpoints down → `getOrgSnapshot` returns `null` at `api.ts:393`) still showed "0 clients · ₹0
claims paid" as fact. The hero at `:266` already did the right thing (`snapshot ? … : NO_VALUE`);
only the tile grids fabricated the zeros. The handoff scoped the fix as "the same `NO_VALUE`
treatment the hero has, gated on `useDataHealth().degraded`, **not** to widen types or invent a new
empty shell."

**Decision.** Each fabricating tile now mirrors the hero: `snapshot ? <real value> : NO_VALUE`.
Gated on **`snapshot`-presence, deliberately NOT on the global `degraded` flag** — two reasons, both
verified in code: (1) it is what the hero at `:266` and home's own analytics widget
(`home.tsx:1682`, the app's canonical org-snapshot pattern) already key on, so hero and tiles can
never disagree on the same number (e.g. `total_clients` appears in both); (2) `health.degraded` is
**global** (`health.ts:33`, `= failures.length > 0`, and `PHASE-3.md` L8 keeps it that way, sticky
and app-wide), so gating tile VALUES on it would blank a tile whose data loaded fine whenever *any
unrelated* endpoint failed — introducing exactly the hero/tile inconsistency the fix should avoid.
The outage-vs-loading distinction `degraded` carries is already shown by the global `<HealthBanner/>`
and the hero's "Loading the organisation book" sub, so it does not belong in a tile's number.
Master's "Open tasks" tile keeps its fallback and is left unchanged — `tasks.filter(…).length` is
**genuinely loaded** session data, not a zero conjured from nothing (same shape as the hero's
team-derived minis, which also stay live while the org big reads NO_VALUE).

**Consequence.** With the org endpoints down, both dashboards' org tiles read "-", not "0"/"₹0";
a healthy backend renders the real figures unchanged (a genuine org `0` still shows, because a
present snapshot is trusted). 8 tile expressions changed in one file; no type widened, no shell
invented, hero untouched, no `useDataHealth` import added. No test file — `dashboards.tsx` is
presentational JSX with zero coverage and no RN test renderer in the harness (same untestable-by-
convention class as Phases 8/11/12-note/17); the change is two ternaries per tile. No INBOX item —
nothing crosses a repo boundary. Gates green: `npx tsc --noEmit` exit 0; `npm test` **299/13**
(unchanged — no new pure logic); `npm run lint` **0 errors / 12 warnings** (Phase-15 baseline). This
closes the Phase-3 §2 carry-out and the `docs/PHASES.md` "Next 3" #3 item.

## 2026-08-11 — Phase 6 (partial) BUILT: notes `search`→`q` and LIC `{meta,plans}` unwrap + adapter; the LIC "404 in production" claim was stale

**Context.** Phase 6's two app-side halves (DECISIONS 2026-08-11 "Phase 6 splits"). The LIC half
carried a blocker the handoff flagged explicitly: `api.ts` comments asserted `/api/lic-plans` **404s
in production**, while `contracts/api.md:1187` documents it live — shipping an unwrap for a dead
endpoint would be wasted work.

**Decision.** Settled the disagreement against the producer's real code, not the prose: `app.js:461`
mounts `app.use('/api/lic-plans', require('./routes/licPlans'))`, and `routes/licPlans.js:62-71` GET
returns `{ success:true, data:{ meta, plans } }` with `plans = rows.map(unifiedToLic)`. It is
deployed, mounted code — **live, not 404** (D-1). The "404 in production" comments (`api.ts` two
sites, `lic-plans.tsx` header + empty-state copy) are stale and were corrected (Phase 8
honesty-of-comments precedent). `getLicPlans` now validates `Array.isArray(d.plans)` and maps each
row through the new pure `adaptLicPlan` (D-2): `product_id→id`, `plan_name→name`, `plan_table→code`,
`category_label→type`, `summary→highlight`, `riders→tags`. Entry-age and term stay EMPTY — the wire
carries neither as a plan-level fact (the only `term` is one illustrative value inside
`worked_example.inputs`), so mining one would fabricate a figure. Notes: `getNotes` sends `q` (the
key `noticeBoard.js:93` reads), not the ignored `search`. LIC detail's `tags` pill heading moved
"Sold for"→"Riders" (D-3, tags are riders now) and its empty state branches on
`useDataHealth().degraded` like `kb.tsx` (D-4).

**Consequence.** `getNotes` filters for real; `getLicPlans` renders real plans and no longer raises a
false outage. Gates green: `npx tsc --noEmit` exit 0; `npm test` **299/13** (+18: 6 `adaptLicPlan`
in `adapt.test.ts`, 5 `api-notes.test.ts`, 7 `api-lic.test.ts`); `npm run lint` **0 errors / 12
warnings** (Phase-15 baseline). Commissions stays backend-blocked (D-5) — raw rows, no aggregate,
`target` has no source; the product aggregate endpoint is still pending — so `commissions.tsx` is
untouched and Phase 6 remains **partial**. Device checks (LIC catalogue renders against production,
notes search narrows the list) are **carried** — web/`npm test` cannot exercise the live host. Full
spec: `docs/spec/PHASE-6.md`.

## 2026-08-11 — Phase 12 is app-side: read the roster from `/team/task-overview`, not admin-only `/profiles` (Phase 12, specced, not built)

**Context.** `docs/PHASES.md` tagged Phase 12 `[api]` and framed the fix's dependency as a backend
change. Verification (Phase-4 method: contract row → producer's handler → our code) found that wrong.
The leader's "0 on duty" is caused by a single wrong endpoint: `getAgentLocations()`
(`src/data/api.ts:1855`) enumerates the roster via `GET /api/profiles?limit=60`, which requires
`role ∈ {admin, super_admin, payroll_staff}` (`contracts/api.md:211`) — a **leader 403s**, gets an
empty roster, fires no `/attendance` calls, so every member reads `clockedIn:false` and the Team KPI
/ agent-map say "0 on duty". The attendance fan-out it feeds, `GET /api/attendance/user/:id`, has
**no ownership/role check at all** (`api.md:544`), so it already works for a leader; only the roster
source was admin-gated.

**Decision.** Swap only `getAgentLocations`'s roster source to `GET /api/team/task-overview?scope=all`
— the endpoint `getTeam()` already trusts (`api.ts:340`), readable by any staff and scoped
server-side per role (`api.md:715`). Its members carry `user_id` + `name`, the only two fields the
downstream (`.filter(p=>p.user_id).slice(0,20)`, then `toPin`) consumes; no GPS is at stake (that has
always come from the attendance rows, never the roster). `?scope=all` keeps admin/master org-wide
while the server clamps a leader to their team — **to be verified against
`../cgpe-backend-main/routes/team.js` + `visibilityScope` before the diff is final** (drop `scope=all`
if a leader is not clamped). No `cgpe-api` change; the `[api]` tag on row 12 is removed on ship.

**Consequence.** `getTeam`, `team/index.tsx` and `agent-map.tsx` need **no edit** — the fix is
upstream of all three, so the predicted 3-file list collapses to one source file + a new
`api-agents.test.ts` (same "list shrank" shape as Phase 11/5). A leader's on-duty count becomes real;
`getTrackableMembers` stays on `/profiles` (master-only picker, correctly gated). Built/verified only
at the wire-contract level by test — the DONE-WHEN proper (a real leader token showing a true count)
is a handset + live-backend check, carried. Full spec: `docs/spec/PHASE-12.md`.

## 2026-08-11 — Phase 6 splits: notes + LIC are app-side conformance bugs; only commissions is backend-blocked (Phase 6, re-scoped)

**Context.** Phase 6 was tagged `[api]` with the stated blocker "un-shadow
`GET /api/commissions/team-summary`" — which backend Phase 13 already shipped, and which was the wrong
dependency anyway. Verified all three screens against the live contract.

**Decision / findings.** (1) **Notes** — `getNotes` sends `search=` but `/api/notice-board` reads
**`q`** (`api.md:880`); the filter is silently ignored. Pure app-side, trivial. (2) **LIC plans** —
`getLicPlans` validates `data` as an array (`isArr`) but the server returns `{ meta, plans:[…] }`
(`api.md:1192`), so it never reads `data.plans`; also a field-name gap (server `plan_name/product_code/
category/riders` vs app `name/code/type/tags`, no adapter). App-side, but blocked on a real question:
`api.ts:1966` claims `/api/lic-plans` **404s in production** while `api.md:1192` documents it live —
settle before shipping. (3) **Commissions** — `GET /api/commissions` returns owner-scoped **raw rows**
(`api.md:1163`), not the aggregate the screen wants, and `target` has **no source** in the rows.
Product owner confirmed the server aggregate endpoint is **still pending**, so the commissions third
stays backend-blocked; deriving money figures on-device was rejected (Phase 16 precedent).

**Consequence.** Phase 6's `[api]` framing is stale for two-thirds of it. If picked up: notes + LIC
can ship app-side (LIC pending the 404-vs-live resolution); commissions waits on `cgpe-api`. Not
bundled into Phase 12. `isObj`/`isArr` (`api.ts:256-257`) are strict — `isObj` excludes arrays — which
is why both the commissions (array vs object) and LIC (object vs array) validators silently fail
today and fall through to the empty state, indistinguishable from an outage without this note.

---

## 2026-08-11 — Vendor Leaflet by inlining a bundled string, and "renders offline" means the library, not the tiles (Phase 13, built)

**Context.** `LeafletMap.tsx` built its whole map as one HTML string and handed it to a WebView as
`source={{ html }}`, pulling `leaflet.js` + `leaflet.css` from `unpkg.com` at runtime with no SRI —
so with the network blocked the `<script src>` failed, `onerror` fired, and the *entire* map
rendered "The map could not open". The done-when was "the map renders with the network blocked after
first load", and the Phase 10 handoff explicitly warned it could be misread as "fully offline tile
imagery" and waste the phase.

**Decision.** "Renders" means the Leaflet *library* runs offline (frame, gestures, pins, route,
popups, controls) — **not** the tile imagery, which is the whole world's tiles and cannot be bundled
into an APK. The library is vendored by *inlining* it: `leaflet@1.9.4` is a devDependency,
`scripts/vendor-leaflet.mjs` generates `src/ui/vendor/leaflet-1.9.4.ts` (the dist JS/CSS as escaped
string constants), and `buildHtml` inlines those as `<style>`/`<script>` in place of the two unpkg
tags. Not an `assets/` file: `source={{ html }}` has no base URL, so a `file://`/relative asset can't
resolve and enabling file-origin access is exactly the permission this phase is avoiding. Inlining
also removes the SRI concern entirely — there is no remote fetch left to protect, which is stronger
than a hash on a live request. Tiles stay on `basemaps.cartocdn.com` with the existing "tiles could
not load" banner as the honest offline degrade; a test pins that they are *not* vendored so a later
edit doesn't read "vendor Leaflet" as "vendor the map".

**Consequence.** ~145 KB is added to the JS bundle (the library was that size over the wire anyway),
in exchange for a map that no longer dies offline and no longer trusts an unpinned CDN script. The
`failed` EmptyState is now only reachable via a WebView render-process crash, not a fetch, so its
copy no longer blames the network. The offline-render itself is logically certain but device-only to
observe — carried as an outstanding handset check like Phases 1/4/5/7. Full spec: `docs/spec/PHASE-13.md`.

---

## 2026-08-11 — `more` is unconditional in the tab bar; `nav.more_sections` and `prospects`/`tickets`-as-tabs stay out (Phase 10, built)

**Context.** `nav.tabs` (max 5, enum `home/tasks/clients/leads/claims/prospects/tickets/more`) and
`nav.hidden` were stored and served correctly but read by nothing on device — the documented
`ADMIN_PANEL_SYNC.md` §9 gap. Wiring them raised three questions the phase text didn't answer:
what happens if a config omits or hides `more`; what happens with `prospects`/`tickets`, which have
no physical `Tabs.Screen` in this build; and whether `nav.more_sections` (title/grouping) should
also drive the More screen's group structure.

**Decision.** `more` always renders in the bar, immune to both `nav.tabs` and `nav.hidden` — it is
the only way back to a module that lost its slot and the only place Sign Out lives, so honouring a
config that hides it would strand the session. `prospects`/`tickets` are filtered out of the tab
computation (`resolveTabs` in `appUi.tsx`) since neither route lives inside the `(tabs)` group
today; a config naming either one for a bar slot degrades to "reachable from More" rather than
crashing or silently doing nothing. `nav.more_sections` was not wired into `more.tsx` at all — only
`nav.hidden`, which the contract itself calls "the ONLY control that makes a module unreachable",
was implemented; the existing groups carry curated, role-conditional presentation a generic
`{title, items}` renderer would have flattened for a benefit the phase's own DONE-WHEN never
required.

**Consequence.** Every real config in `ui_rbac_config.json` already lists `more` last, so the
`more`-is-unconditional rule changes nothing for a well-formed document — it only guards a
malformed or adversarial one. Moving `prospects`/`tickets` into the tab group, and wiring
`nav.more_sections`, are both named as separate future mobile-only work in `docs/spec/PHASE-10.md`
§5 and filed as informational (not blocking) to `cgpe-admin` via `contracts/INBOX.md`,
2026-08-11 — no backend or panel change needed either way.

---

## 2026-08-11 — Master tier ships without a live DB check that the role field is actually set (Phase 11, built)

**Context.** `tierOf()` used to grant Master by matching `user.email` against a compiled-in
`shivam@cgpe.in`. `contracts/enums.md` §1.1 documents `Profile.role`'s `super_admin` as the
server's own top rank — passes every `authorize()` gate unconditionally — which is the correct
server-derived replacement. But this repo has no way to query the production database, so there
was no way to confirm from here whether the master account's `Profile.role` is currently set to
`super_admin`. Asked the user directly rather than assuming either way, since getting it wrong
either overclaims (inventing a value that isn't actually stored) or underdelivers (shipping code
that regresses the real Master's experience on next login with no visible cause).

**Decision.** Ship the `role === 'super_admin'` check now. The user chose to confirm/set the
database field themselves rather than have this session file an INBOX item to `cgpe-api` first.

**Consequence.** If the account's `Profile.role` is not `super_admin` at rollout, `tierOf()` falls
through to whatever the role actually is (most plausibly `admin`) — a visible but non-destructive
regression, not a lockout, and self-evident on first login after this ships. A future session
reading "Master tier disappeared" should check this entry before re-diagnosing it as a code bug —
the code is doing exactly what `docs/spec/PHASE-11.md` D-4 says it does.

---

## 2026-08-11 — `distanceText` exported rather than reimplemented (Phase 17, built)

**Context.** Built the plan below exactly as scoped. One thing the planning entry did not
anticipate: `checkGeofence()`'s `message` field, which the clock-in refusal renders verbatim, is
composed specifically for clock-in ("Move about X closer to clock in") and reads as nonsense after
a clock-out has already completed. The clock-out warning needed its own sentence built from
`distance_m` directly.

**Decision.** Export `api.ts`'s private `distanceText()` helper (the same nbsp/km-rounding
function `geo.message` is itself built from) rather than writing a second copy of the same
rounding rule in `home.tsx`. One word changed (`function` → `export function`); no behaviour in
`api.ts` moves. This is why the phase's file list grew from one file to two.

**Consequence.** Distance formatting for both the clock-in refusal and the clock-out warning now
has exactly one implementation. `src/data/api.ts` and `src/app/(tabs)/home.tsx` are the only files
this phase touched; no test file references `generateReport`-shaped fabrication or any new pure
logic, so `npm test` stays at 258 unchanged.

---

## 2026-08-11 — A clock-out fence warning is re-derived client-side, not read from the server (Phase 17, planning)

**Context.** Requested: warn when someone clocks out outside the office fence. Phase 7 deliberately
made clock-out un-blockable by the fence (`home.tsx:780-784`, `timeTracker.js:488-497`) — a field
agent's last call is a client's home, and forcing a return to the office just moves the dishonesty
from "where" to "when". The server already computes `out_of_bounds`/`distance_m` on every clock-out
(`timeTracker.js:498-518`) but never returns them: `contracts/api.md:522` already has this mapped —
`LocationSchema` doesn't declare those fields, so they are stripped before the response is built.

**Decision.** Do not wait on a `cgpe-api` change to expose those fields. `api.checkGeofence()`
already re-derives the identical verdict for clock-in, against the identical fence
(`checkClockGeofence`, `timeTracker.js:319` and `:498` — same function, same global fence). Phase
17 calls it a second time on the clock-out path, for display only, and shows a warning **after** a
clock-out that already succeeded — never gating the write. The one thing this must not do is
re-introduce a client-side refusal on clock-out; Phase 7 removed that on purpose and this request
is explicitly for a warning, not a re-fencing.

**Consequence.** Phase 17 is pure app-side, no `[api]` tag, no INBOX item to wait on. Filing the
dead-field observation to `cgpe-api` (the fields ARE computed and thrown away every clock-out) is
still worth doing, but it is not this phase's blocker and is deferred to whenever Phase 17 is
actually built.

---

## 2026-08-11 — Deleting a fabrication at the source, not just distrusting it at the call site (Phase 8)

**Context.** `generateReport` invented a fixed ₹42,00,000 summary on any failure. Its one caller,
`client/[id].tsx`, already had a `source !== 'demo'` guard and a comment explaining exactly why —
proof the fabricated data had never reached a screen, but only because that one call site
remembered to check. `getDashboardOverview` / `getClaimsSummary` (`api.ts`) were already written
the honest way: return `tryReal`'s result directly, `null` on any failure, no invented fallback.

**Decision.** The fix is at the source, not at the call site. `generateReport` now matches its two
precedents exactly. The caller's now-permanently-true `source !== 'demo'` check and the `source`
field it existed to read are both removed, rather than left in place as a defensive check with
nothing left to defend against — a dead guard reads as "this could still happen" to the next
person who touches the file.

**Consequence.** A second caller of `generateReport` — a future screen, a test — can now trust
`.ok` alone; there is no longer a second thing to remember to check. Same shape as Phase 7's D-2
("an unknown fence is represented as unknown, not as a guess") and Phase 5's D-1 ("a 2xx is not a
success; the body's own verdict is") — fabrication and mistrust of fabrication are both defects;
only removing the fabrication closes the class.

**Also decided:** the adversarial-review convention (Phase 4's rule, held through 5 and 7) scales
down for a small phase. One skeptical pass, not a multi-lens panel, was proportionate here — and it
still caught a real defect: rewriting `config.ts`'s "Backend base URL" paragraph while leaving its
neighbouring numbered list saying the opposite thing 24 lines above. Reviewing scales with risk,
not with habit; a phase this size still gets reviewed, just not at Phase 7's scale.

---

## 2026-08-10 — An INBOX reply is not filed until you have read it back

**Context.** `CLAUDE.md` already warned that `../contracts/INBOX.md` is written concurrently and
that line numbers move. It did not warn that content is **deleted**. During Phase 5's boot the file
went 116,824 → 111,088 bytes in twelve minutes and lost three `cgpe-mobile` Phase-4 replies,
**two of them ticked boxes that reverted to `[ ]`** — the exact state that made `cgpe-api` hold a
phase in Phase 4, arriving this time by overwrite rather than by misfiling. It was noticed only
because two greps minutes apart disagreed.

**Decision.** After writing to `INBOX.md`, grep your own reply back and re-write it if it is gone.
Re-verify rather than re-paste: the evidence is cheap to re-run and a quoted answer that has been
sitting in a deleted file is not evidence of anything. Append rather than rewrite when touching an
item you did not author.

**Consequence.** There is no undo. `CGPE-CURRENT-PROJECT/` is a git repo with zero commits and
`contracts/` is untracked in it, so no previous version of that file exists anywhere. Creating that
first commit is **not** the fix a session should apply unilaterally — it would sweep all three
project trees into one repo.

---

## 2026-08-10 — A 2xx is not a success; the body's own delivery verdict is

**Context.** `POST /api/whatsapp/hub/send` writes its log row *before* it calls the WhatsApp
gateway and answers `200 success:true` whether the gateway took the message or not. The truth is
in a top-level `delivery: { dispatched, configured, note }` object that sits **beside** `data`.
Phase 5 found the app painting a sent tick on the status code alone — and would have carried on
doing so even after the `text`/`message` fix, because the 400 it was getting would have become a
200 that still delivered nothing.

**Decision.** Where an endpoint reports its own outcome in the body, that verdict outranks the
HTTP status, and the client reads it. A helper that unwraps to `data` — `tryReal`, here — cannot
be used on such an endpoint, because the verdict is not inside `data`. Use bare `req()`, as
`addLead` does. Where the verdict is **absent**, that is a contract fault reported to
`data/health`, not an outcome to guess at.

**Consequence.** `sendWaMessage` returns a four-outcome union, not `void` and not a boolean:
`dispatched` · `undelivered` (with `configured`, because it decides whether retrying is worth
offering) · `invalid` · a transport `WriteFailure`. The same shape is owed to
`POST /api/campaigns/send`, which `api.md` records as reporting `success:true` when the webhook is
unset — same disease, different organ, and Phase 8's or a later phase's to fix.

---

## 2026-08-10 — Quote the producer's message, except when it is jargon

**Context.** `cgpe-admin` adopted "render the server's own rejection message rather than compose
our own" for the geofence, and it is a good rule — it stops three clients inventing three
different explanations. Phase 5 applied it to the WhatsApp gateway and produced a banner reading
*"n8n webhook not configured — message logged locally only"* for a field advisor who is reading
the app in Gujarati and has never heard of n8n.

**Decision.** Quote the producer when it knows something we do not — a status code, a distance, a
validation reason. Write our own sentence when we already know exactly what happened and the
server's phrasing names its own internals. The test is not *who wrote it* but *does the reader
learn what to do next*.

**Consequence.** The two `delivery.dispatched: false` cases are worded differently on purpose:
"the gateway refused it" quotes the note (it carries n8n's status code, which exists nowhere else),
"the gateway is switched off" does not (we know the cause, and can say retrying will not help).

---

## 2026-08-10 — A phase is reviewed adversarially before it is called done

**Context.** Phase 4's first commit passed all three gates — `tsc` clean, 185 tests green, lint at
baseline — and was still wrong in eight places. A five-lens review (contract fidelity, runtime
correctness, screens, tests, regression sweep) raised 22 findings; each was then given to two
independent skeptics whose instructions were to **refute** it, defaulting to refuted when
uncertain. Eight survived. One was a real bug the phase itself introduced: `addLead` called
`reportIfOutage`, which leaves a read-once note in `suppressed` for `unavailable` to consume, and
`addLead` never calls `unavailable` — so the next genuine `GET /leads` outage was silently eaten.

**Decision.** Green gates are necessary and not sufficient. The findings worth keeping are the
ones that survive an attempt to kill them; "refuted because it is pre-existing behaviour this
commit neither introduced nor worsened" retired 14 of the 22, which is exactly the noise a review
without a refutation step would have spent the next session on.

**Consequence.** Two corrections to decisions recorded hours earlier, both below: nothing may map
UP into `policy_issued`, and no *permanent* refusal is buffered. Both were written as reasoned
decisions the first time and were still wrong. A decision entry is not a proof.

---

## 2026-08-10 — Nothing may guess a lead UP into a closed sale

**Context.** The first draft of `mapLeadStage` aliased `converted → policy_issued`. It broke this
phase's own "understate, never overstate" rule in the one direction that costs money: guessing a
sale closed removes a lead from the open pipeline *and* adds it to a won figure. It was also a
guess about a token that occurs on no document — `converted` is not a value of any of the four
lead vocabularies; it appears only in the `!converted` query sentinel, which `enums.md:218` records
as unable to match anything.

**Decision.** An alias may resolve a lead DOWN the funnel or not at all. Unknown input lands on
`new_lead`, the schema default. The same rule retired the buffering of permanently-refused
creates: a `403`/`404`/`501` is as final as a `400`, so the record is not held on the device
either — only `network` and `server` failures are.

**Consequence.** A genuinely-converted legacy document would read as New and sit in the open book,
where a human sees it. That is the cheaper error: a wasted call, rather than a sale nobody made.

---

## 2026-08-10 — The app's lead vocabulary is the server's enum, not one of its own

**Context.** Phase 4. `LeadStage` was `new | contacted | meeting | proposal | closed_won |
closed_lost` — six words the app invented. `Lead.status` is enum-enforced to five
(`contracts/enums.md:212`), `stage` is not a path on the schema at all, and `enums.md` §15 lists
two further lead vocabularies (the query-engine dropdown, `queryEngine.js:194`) with the
instruction not to merge them. Keeping the six and translating on write was the smaller diff, but
`contacted` and `proposal` have no target in the enum, so the translation is lossy exactly where
the user can see it: they tap **Contacted**, the server stores `new_lead`, the confirming read
disagrees, and the app reports "not saved" every time.

**Decision.** `LeadStage` **is** `new_lead | meeting_scheduled | docs_shared | policy_issued |
lost`. The app keeps no vocabulary of its own; the property is still called `stage` because that
is internal, and `STAGE_META` supplies the labels (New · Meeting · Docs shared · Policy issued ·
Lost). Unknown input resolves to `new_lead` — the schema's own default, not an invented fallback.

**Consequence.** Nine files, all found by `tsc` because `STAGE_META` is an exhaustive
`Record<LeadStage, …>`; keep it exhaustive for exactly that reason. The funnel is four steps, not
five. Anything that still says `closed_won` is stale — including, per the INBOX item filed on
2026-08-10, the admin panel's Android preview.

---

## 2026-08-10 — On a lead, `status` beats `stage` — the opposite of the backend's own reader

**Context.** Real lead documents can carry both. `contracts/models.md:2138` (drift #5) records
that raw readers use `stage`, and `reports.js:121` reads `l.stage || l.status`. `adaptLead` did
the same. But no endpoint in `api.md` §Leads accepts `stage` in a request body — `status` is the
only one of the two the app can write.

**Decision.** Read `status` first, fall back to `stage`, and say so in the code. A stage-first
reader displays a value nobody can change: a saved move stays invisible and every write reads as
unconfirmed, which is the Phase 4 defect moved rather than fixed.

**Consequence.** A lead moved from the app reads as moved to us and as unmoved to `reports.js`,
on the same document. That is a real divergence, filed to `cgpe-api` as an observation with the
suggestion that a backfill plus one canonical accessor is the honest fix. **We will not write
`stage`** unless `api.md` documents us writing it.

---

## 2026-08-10 — A 400 is a refusal: not an outage, and not a local save

**Context.** Phase 4. `POST /api/leads` requires `phone` and validates it server-side, so a typo
is the likeliest failure the Add-lead sheet will ever see. Routed through `tryReal` it was
reported to the health channel — one user's mistyped number raised "some data could not load" for
the whole app — and the record was then held in the local write buffer as if it had been captured.

**Decision.** `WriteFailure` gains `invalid`. A 400 shows the server's own sentence on the sheet,
raises no banner, and **buffers nothing**: the server has refused this record and will keep
refusing it until the user changes what they typed, so keeping it would be a fabrication. Network
and 5xx failures keep the buffer, which is what it is for.

**Consequence.** No client-side phone rule was added. The server owns that validation
(`isMobilePhone`), and a second regex here would be a second source of truth that drifts.

---

## 2026-08-10 — Not every failure is an outage: 401/403/404/501 are answers

**Context.** Phase 3 taught `tryReal`/`tryEnvelope` to report failures. The naive version — report
every non-2xx — fails the phase's own second acceptance criterion. `GET /profiles` is admin-only
(`contracts/api.md:211`) and `getAgentLocations`/`getTeam` call it unconditionally, so every advisor
would see a permanent "some data could not load" banner against a perfectly healthy backend. A 404
is the same class: `/lic-plans` 404s in production by deployment state, not by fault.

**Decision.** `reportIfOutage` filters 401 (session already ending), 403 (a permission result),
404 and 501 (the endpoint is not there — Phase 1 already named this `unsupported`). Everything else,
including every 5xx **and a 200 whose body fails `validate`**, is reported: the caller's next move is
to render a zeroed shell, and an unlabelled zero is the exact lie the channel exists to prevent.

**Consequence.** The suppression needs a hand-off, because most callers answer `tryReal`'s `null`
with `?? unavailable(...)`, which reports unconditionally and would undo the verdict one line later.
That is what the `suppressed` set in `api.ts` is for, and it is why `healthKey()` exists — producer
and consumer have to meet on one string. **Do not "simplify" either away.**

---

## 2026-08-10 — `degraded` stays global and sticky; per-screen scoping is its own phase

**Context.** Making `reportSuccess` clear per endpoint means `degraded` becomes
`failures.length > 0` and stays true until *that* endpoint recovers. 31 screens read the global flag,
and two endpoints are known-broken until Phase 6 (`/commissions`, `/lic-plans`), so the flag can stick
for a whole session.

**Decision.** Accept it. Checked all 31 consumers first: all but one gate their outage copy on
`degraded && list.length === 0`, so a stuck flag can only mis-speak on a screen that is **genuinely
empty** while a different endpoint is broken. That is strictly narrower than what it replaces — a
real outage rendering "No clients in your book yet."

**Consequence.** A truly per-endpoint `degraded` means touching all 31 screens and is a phase in its
own right. Nobody should attempt it as a drive-by. A TTL was explicitly rejected: it would mean
inventing a timing number that is written down nowhere.

---

## 2026-08-10 — `at` is the outage clock and re-stamps on every failure, repeats included

**Context.** `src/app/search.tsx:489` snapshots `getHealth().at` before its fan-out and compares at
`:508` to decide whether **this** query lost a collection, rather than whether the app has failed at
any point since launch. Meanwhile the banner un-dismissed itself on every `at` change, so once
Phase 3 made ~21 more endpoints report, a screen retrying a dead endpoint would re-open a banner the
user had just closed and the close button would look broken.

**Decision.** `at` keeps its every-failure semantics — including a repeat of an endpoint already in
the list — and `reportSuccess` never moves it. The banner's dismissal was re-keyed onto the failure
**set** instead.

**Consequence.** These two are a matched pair. "Optimising" `reportFailure` to skip the re-stamp for
an already-listed endpoint silently breaks `search.tsx`: a real outage on a retried search would
render as "nothing matched". There is a test pinning both halves in `health.test.ts`.

---

## 2026-08-10 — A phase's file list is a floor when the DONE-WHEN cannot be met without more

**Context.** Phase 3's brief named `tryReal`, `reportSuccess` and `getTeamActivity`. Its DONE-WHEN
required the Master dashboard to stop rendering a plausible all-zero org. Those are not the same
task: `getClientStats` returned a truthy all-zeros object on every path, which made
`getOrgSnapshot`'s outage gate at `api.ts:275` **unreachable dead code**. Fixing only the three named
things would have raised the banner while the dashboard still displayed "0 clients · ₹0 claims paid".

**Decision.** Extend to the bare-`req()` read paths the criterion depends on — `getClientStats`,
`getClientsPage`, `scanRenewals` — and write the reasoning into `docs/spec/PHASE-3.md` §2 rather than
widening quietly. Everything genuinely outside the criterion was named and left
(`src/screens/dashboards.tsx`, `uploadFile`, the Phase 4/5 write paths).

**Consequence.** When a phase's stated files and its stated DONE-WHEN disagree, the DONE-WHEN wins
and the deviation gets written down. That is the same rule `docs/spec/PHASE-2.md` used for its two
deviations.

---

## 2026-08-10 — Tests pin TODAY'S behaviour, bugs included

**Context.** Phase 2 pinned five pure functions that are full of known-wrong behaviour that later
phases will fix: `mapLeadStage('policy_issued')` returns `'new'`, `partial_paid` reads as `settled`,
`not_converted` reads as `closed_won`, the geofence fallback fails closed at 2 km. Writing the
*correct* expectation would have made the suite red on day one.

**Decision.** Every assertion states what the code does today. Cases that freeze a bug say so in the
test name and sit in a `describe` block called *"pinned known bugs — these must be updated
deliberately when fixed"*, with a comment naming the phase that owns the fix.

**Consequence.** When Phase 4 fixes the lead vocabulary or Phase 7 makes the fence fail open, **those
tests going red is the intended signal**. Read the case comment, then change the expectation on
purpose. A future session that "fixes the failing tests" without reading them destroys the signal.

---

## 2026-08-10 — Stub at the module boundary; never refactor source to make testing easier

**Context.** `normalizeUiConfig` is a pure function, but importing `store/appUi.tsx` drags in
`react-native`, AsyncStorage, expo-local-authentication and expo-secure-store — entirely because of
two *value* imports (`import * as api`, `import { useAuth }`) that only `AppUiProvider` uses.
Extracting the normaliser into a dependency-free module would need zero stubs and is the cleaner end
state.

**Decision.** Four resolution-only alias stubs in `vitest.config.mts`, and no source change. Verified
first that no stubbed byte sits between a test and a function under test: `Platform` is dereferenced
only at `constants/config.ts:45` and `api.ts:1277` (`uploadFile`), which none of the five tested
functions touches.

**Consequence.** Phase 2 did not move code it was not asked to move, and `appUi.tsx` stays whole for
Phase 10 to rewrite. **The guard is the stub list:** if a future test needs a fifth stub, or a new
export on an existing one, that is the signal the test has left pure-logic territory — where a green
test starts proving only that the stub behaves as written.

---

## 2026-08-10 — No time expectation is ever written as a UTC literal

**Context.** `scanRenewals` is local-time end to end (`api.ts:651`, `:663-664`) but serialises with
`toISOString()` (`:673`), and `adapt.ts`'s `daysUntil` normalises to local midnight. A hardcoded
`'2026-12-31T18:30:00.000Z'` passes on an IST dev box and fails on a UTC CI box.

**Decision.** Every expected timestamp is constructed in the test with the same local-time
`new Date(y, m, d)` the code uses, and every date fixture uses the `'YYYY-MM-DDTHH:mm:ss'` form,
which ECMAScript parses as local (the date-only form is parsed as UTC and shifts a day west of
Greenwich). `TZ: 'Asia/Kolkata'` is set in the config as belt-and-braces, but **no assertion depends
on it**.

**Consequence.** The suite is timezone-independent by construction rather than by configuration, so
it survives being run on CI, on a laptop that travels, or under a changed `TZ`.

---

## 2026-08-10 — Test files are split by what they stub, not by what they cover

**Context.** `api-geo.test.ts` proves `checkGeofence` reaches its offline fallback by asserting
`fetch` is **never called**. `scanRenewals` lives in the same module and needs a working `fetch`
stub. Vitest isolates per *file*, not per test.

**Decision.** They live in separate files, so the renewals stub cannot silently satisfy a geofence
request that should never happen. `src/data/api.ts` also carries module-level state with no reset
path (`_geoCache` at `:1037`, `sessionReal` at `:46`, the `state` buffer at `:152`), so any file
touching it calls `vi.resetModules()` and re-imports in `beforeEach`.

**Consequence.** A test file's stub surface is part of its contract. Adding a `fetch` stub to
`api-geo.test.ts` would silently void its central assertion.

---

## 2026-08-10 — A failed write returns `{ok:false, reason}`; it does not throw

**Context.** Phase 1 had to give five write functions a way to report failure. `updateTaskStatus`
already returned `{ok:false, forbidden:true}` for a 403; the other four returned a hardcoded
`{ok:true}` and their callers were written around a truthy `res.ok`.

**Decision.** Generalise the existing shape into an exported `WriteFailure` union
(`'network' | 'server' | 'forbidden' | 'unsupported'`) rather than introducing exceptions. The one
exception is `store/auth.tsx`'s `deleteAccount`, which throws — because `app/account.tsx` already
had a correct `try/catch` failure branch and throwing is what reaches it without rewriting the screen.

**Consequence.** Callers branch on `res.ok` and may read `res.reason` for copy. Adding a new write
means returning this shape, not inventing a third convention.

---

## 2026-08-10 — `unsupported` is a distinct failure reason, and it changes the copy

**Context.** `DELETE /api/auth/me` does not exist on the backend, so every deletion attempt 404s.
Treating that as a generic failure would show "Check your connection and try again" — advice that
sends the user round a loop which cannot succeed.

**Decision.** `unsupported` (404/405/501) is its own reason. For it, `account.tsx` shows only the
first sentence of the existing copy: *"The server did not confirm the deletion, so your account is
unchanged."* This narrows locked spec row 9 ("no new user-facing copy") to a **subset** of approved
copy rather than new copy, and was recorded as row 9a in `docs/spec/PHASE-1.md` mid-build rather than
chosen silently.

**Consequence.** Transient faults tell the user to retry; absent endpoints do not.

---

## 2026-08-10 — Dead interactions are removed, not fake-persisted

**Context.** `toggleTaskStep` made no network call and mutated `state.tasks`, which `getTasks`/
`getTask` never populate — so the whole body was dead, the tick reverted on the next focus refetch,
and the screen fired a success haptic over it. There is no backend endpoint for a task step.

**Decision.** Delete the function and render the checklist read-only, rather than keeping a local-only
tick. Same reasoning will apply to `toggleReminder` and `toggleClaimDoc` in Phase 9.

**Consequence.** Users lose an affordance they appeared to have. That is the honest trade: a tick that
silently reverts trains people to distrust every other confirmation in the app. Ship Phase 9 soon and
say so in the release note.

---

## 2026-08-10 — `../contracts/` is the source of truth, not the prose docs

**Context.** Three documents describe the same API: `ADMIN_PANEL_SYNC.md` (1318 lines),
`ADMIN_PANEL_GUIDE.md`, and `../contracts/api.md` (426 endpoints, generated by reading every backend
route file in full). `contracts/CHANGELOG.md` records 15 confirmed drifts where the prose and the
code disagree — including the clock-in fence radius and the `/track/points` body key.

**Decision.** When they disagree, `contracts/` wins, because it was generated from the code.
The prose docs stay useful for *intent* (why the fence is 200 m, why the preview must not fetch).

**Consequence.** Read `contracts/api.md` before hand-writing any request shape. Any breaking change
goes in `contracts/CHANGELOG.md` **before** the code, then into `contracts/INBOX.md`.

---

## 2026-08-10 — Phase 1 is write-path honesty, not the test harness

**Context.** The project has no test runner at all, which normally argues for making that Phase 1.
But five write functions currently report success when the write never reached the server, and three
of them — account deletion, attendance clock-in/out, task completion — are where a false confirmation
costs money or breaks a compliance claim the app makes to the user in writing.

**Decision.** Fix the lies first (Phase 1), add the runner second (Phase 2).

**Consequence.** Phase 1 is verified by hand against `TESTING_GUIDE.md` in airplane mode. Every phase
from 3 onward gets a binary automated check.

---

## 2026-08-10 — The geofence fallback must fail open

**Context.** `getGeofence` substitutes hardcoded Surat coordinates with `radius_m: 2000` and
`enforce: true` whenever `/time-tracker/geofence` cannot be fetched, then caches that for the whole
session. A transient failure therefore locks every staff member outside a 2 km circle out of clocking
in, with a message quoting a radius the server never confirmed.

**Decision.** When the real fence is unknown, allow the clock-in. The server re-validates
independently (`api.ts` already notes this), so failing open costs nothing and failing closed costs a
day's attendance for a whole branch office.

**Consequence.** Phase 7. The same phase drops all "200 m" copy — per `contracts/CHANGELOG.md` D10
the effective server radius is up to 300 m once GPS accuracy credit is applied.

---

## 2026-08-10 — Correcting the fail-open decision above, after building it (Phase 7)

**What the earlier entry got wrong.** It justified failing open with "failing closed costs a day's
attendance for a whole branch office". That cannot happen. There is exactly **one** global fence —
a single `org_settings` document — and `POST /time-tracker/clock-in` re-validates against it on
every request (`routes/timeTracker.js:319-329`, whose own comment says the server is the authority).
A branch office beyond the fence is refused by the server whether the app fails open or not.
Failing open moves the refusal one round trip later and changes the wording.

**The real reason, which is a better one.** The client pre-check exists to save a round trip, not to
be a second authority, and `home.tsx` returns before the write — so anything the client gets wrong
in the *strict* direction is a clock-in the server would have accepted and never hears about.
**Rule: the client pre-check may never refuse what the server would allow.** Every Phase 7 decision
follows from it: an unknown fence allows; the accuracy credit is coerced and clamped, because both
moves only ever allow more; and the server's `accuracy > 300` rejection is deliberately *not*
mirrored, because copying it would duplicate someone else's constant AND make the client refuse.

**Also wrong: "fails closed".** The app's fallback was 2000 m against a server default of 200 m. It
was ten times *wider* than the server at the office pin and absolutely closed everywhere else — not
strict, not lenient, wrong in both directions. That is what a compiled-in copy of somebody else's
database row becomes.

**Consequence.** No fallback fence and no cache at all. A carefully-handled staleness hazard was
replaced by a structurally impossible one, at a cost of one request per clock-in tap.

---

## 2026-08-10 — A phase's own diff is reviewed by skeptics briefed to refute it (Phase 7)

**Context.** Phase 4 introduced the adversarial review; Phase 5 held it. Phase 7 ran it as four
lenses over the committed diff, each finding put to two independent verifiers told to default to
"refuted". 26 findings, 52 verdicts, **four non-refutations**.

**Decision.** Unanimity is the bar for "survives", but a **split vote is a signal, not a dismissal**.
Both real defects this phase shipped a fix for came from findings where one skeptic refuted and one
did not — and the strict rule alone would have discarded both. Read the split votes by hand.

**Consequence.** The review caught a regression the phase itself introduced (any 4xx deleting a
buffered route on a routine token expiry) and a half-fix the phase had congratulated itself on
(caching successes forever). Recorded in `docs/spec/PHASE-7.md` §6 rather than quietly fixed.

---

## 2026-08-10 — Sample data stays deleted

**Context.** An earlier phase deleted the fabricated corpus; `src/data/mock.ts` is `export {}` with a
header forbidding repopulation. But `src/constants/config.ts` still documents the removed fallback in
five places, and `generateReport` still invents a ₹42,00,000 portfolio when its webhook is down.

**Decision.** The no-fabricated-data contract holds. A failed read resolves empty and reports to
`data/health`. `generateReport` becomes the last one removed (Phase 8), and the stale comments are
corrected in the same phase so no future session "restores" a safety net that was deliberately
destroyed.

**Consequence.** `state` in `api.ts` is a write buffer for records the user just typed. Repopulating
it re-introduces fabricated policyholders.

---

## 2026-08-11 — A dead-code sweep deletes only after proving a closed cluster (Phase 14)

**Context.** Phase 14 removed six known-dead modules named in `CLAUDE.md`/`PROJECT_MAP.md` plus the
"orphaned helpers" in `data/tasks.ts` / `data/team.ts`. `kit.tsx`'s own header docstring claimed
"81 import sites across 39 screens" — the exact opposite of `PROJECT_MAP.md`'s "zero importers
despite its docstring." Two authoritative-sounding sources disagreed.

**Decision.** Delete nothing on a list's say-so. A precise `from '@/ui/kit'` grep across the whole
tree returned zero import statements, and `grep`ing every candidate's specifier proved the seven
files formed a *closed* cluster — each imported only by another member of the set or by nothing
(`global.css ← constants/theme.ts ← use-theme.ts`; `use-color-scheme*.ts ← use-theme.ts`; `kit`,
`characters`, `use-theme` unreferenced). `npx tsc --noEmit` exiting 0 is the final proof that no
dangling import survived the deletion. "Orphaned helpers in `data/team.ts`" was read to include the
`teamMembers`/`teamActivityFeed` runtime exports, not just the private date functions: both have
zero consumers (every import site uses `import type`), so they are dead by the same test. Types and
live label maps / `taskProgress` were kept because they *are* consumed.

**Consequence.** A stale docstring is not evidence, and neither is a "dead" list — the grep is. The
one file that looks orphaned but is NOT dead, `src/ui/vendor/leaflet-1.9.4.ts`, was left alone: it is
imported by `LeafletMap.tsx` and only appears unreferenced because eslint ignores it. Lint dropped
46→45 errors (the deleted files carried one), which is the measurable evidence the removed code was
real, not phantom.

---

## 2026-08-11 — Lint to green: fix the one real error, disable three React-Compiler rules with a reason (Phase 15)

**Context.** The clean tree carried 45 lint errors, all from four rules that `eslint-plugin-react-hooks`
v7 promotes to errors *because the React Compiler is enabled* (`app.json` `experiments.reactCompiler:true`,
`babel-plugin-react-compiler@1.0.0` installed): `set-state-in-effect` ×24, `refs` ×11, `immutability`
×9, `purity` ×1. So these are the compiler's own static analysis, not lint noise — but the compiler
**bails out of optimising** a component it can't prove safe rather than miscompiling it, so every
flagged component still runs correctly; it merely forgoes auto-memoisation. Phase 15's DONE-WHEN
allows either `npm run lint` exits 0 **or** every remaining rule is explicitly disabled with a reason.

**Decision.** Split by judgment rather than silence everything. (1) The single `react-hooks/purity`
hit was a genuine minor bug — `useState(Date.now())` in `home.tsx` evaluates the impure `Date.now()`
in the render body on every pass — so it is **fixed at source** with the lazy-initialiser idiom
`useState(() => Date.now())` (identical value, deferred to mount), and the `purity` rule is kept
**on** to catch the next one. (2) The other three fire on patterns that are correct for this codebase
and that the prior handoff explicitly said to disable-with-a-reason rather than rewrite: Reanimated
`sv.value=` writes in worklets/handlers (`immutability`), the RN Animated
`useRef(new Animated.Value()).current` idiom and the latest-value ref pattern (`refs`), and the app's
one documented data-fetch convention — effect → memoised loader → setState (`set-state-in-effect`,
`CLAUDE.md` §Conventions 3). They are turned **off** in `eslint.config.js` in a single override block
whose comment names each rule, its count, and the pattern.

**Consequence.** `npm run lint` exits 0 (0 errors, 12 pre-existing warnings); `tsc` and the 271-test
suite are unchanged; the only source edit in the whole phase is the one-line `home.tsx` initialiser.
The cost is real and named: the three disabled rules no longer guard new code, so a genuinely unsafe
Reanimated/effect pattern added later won't be caught — accepted because they were 44/45 false
positives on this tree and a permanently-red gate is worse. Do not re-enable the three without
rewriting the flagged call sites (a structural change, not a lint pass), and do not silence `purity`
— fix its hits at source. `CLAUDE.md`'s lint line was updated to record all of this so the next
session does not re-diagnose why the rules are off.

## 2026-08-11 — Phase 12 BUILT: read the agent roster from task-overview, not admin-only /profiles

**Context.** `getAgentLocations()` enumerated the roster through admin-only `GET /api/profiles`
(role ∈ {admin, super_admin, payroll_staff}, else 403). A leader (and any advisor) therefore got an
empty roster → no `/attendance` fan-out → no pins → "0 on duty" on every dashboard and an empty agent
map, even with the whole team clocked in. The spec-session (2026-08-11) had already found this and
written `docs/spec/PHASE-12.md`; this session verified the one open assumption and built it.

**Decision.** Swap the roster source in `getAgentLocations()` only, to
`GET /api/team/task-overview?scope=all` — the same endpoint `getTeam()` already trusts, readable by
any staff, whose `/attendance/user/:id` fan-out already has no role check. Validator `isArr` →
`(d) => d && Array.isArray(d.members)`, roster read from `d.members`, outage reported under the
existing `/attendance` health key rather than a competing `/team/task-overview` row (`getTaskOverview`
owns that). No `cgpe-api` change — the `[api]` board tag was wrong (D-1). `getTeam` /
`team/index.tsx` / `agent-map.tsx` untouched: the fix is upstream of all of them (D-4).

**The `?scope=all` question, resolved against the producer's code, not the contract prose (D-2).**
Read `../cgpe-backend-main/utils/scope.js` `visibilityScope` first. The `view==='all'` → `mode:'all'`
return sits **inside** `if (canViewAll)`, and `canViewAll = isSuperAdmin(me) || me.role === 'admin'`.
A leader is neither, so `?scope=all` is ignored and the leader falls through to the `me.role ===
'leader'` branch → `{ mode:'team', userIds:[self,...team] }`. So `?scope=all` is not just safe, it is
*required*: without it, an admin/super_admin defaults to `mode:'own'` and their agent map would show
only themselves (the bare endpoint would silently narrow the master view). The param keeps
admin/master org-wide while a leader stays clamped to their team. A test pins the request carries
`?scope=all` so a later edit cannot quietly drop it and change admin/master breadth.

**Consequence.** A leader's `clockedIn`, the Team screen's "On duty now" KPI, and the agent map are
now correct at the wire; `npx tsc --noEmit` exit 0; `npm test` 281/11 (+10 in `api-agents.test.ts`);
`npm run lint` 0 errors / 12 warnings. Committed `4507d6e` (code+test), `c8a4a79` (board).
**The count against production still needs a handset** (spec criterion 6) — a leader token, a live
backend, someone actually clocked in; none reachable from `npm test`. If a leader unexpectedly sees
the whole company on the agent map after a backend change, the cause is `visibilityScope`'s
`canViewAll` gating having changed so a leader's `?scope=all` widens — filed to `cgpe-api` in INBOX.

## 2026-08-11 — Session close: no build; blockers re-verified real; Phases 18 & 19 planned

**Context.** Boot found the board editor-exhausted (Phases 1-15, 17 done; 6 commissions + 16 salary
backend-blocked). Rather than trust the "blocked" tags — wrong before on Phases 6/9/10/11/12 — this
session re-verified both against `cgpe-api`'s real code, then, at the user's direction, planned two
new phases and queued them ahead of salary.

**Blockers confirmed real (read the producer, not the tag).**
- **Phase 6 commissions.** `../cgpe-backend-main/routes/commissions.js` is the entire commissions
  surface. `GET /` returns raw owner-scoped rows (`amount`/`commission_type`/`status`/`is_paid`);
  `/team-summary` is a per-member rollup gated to leaders/admins. No product-level aggregate and no
  `target` field anywhere. Still blocked. (Also closes the board's open "re-check Phase 6 vs current
  backend" thread — re-checked against the live handler, not just `api.md`; answer unchanged.)
- **Phase 16 salary.** Grep across all backend `models/` and `routes/` for
  `salary|wage|payroll|per_day|ctc|pay_rate|compensation` returns only the role name `payroll_staff`
  and the task department `payroll` — no pay field on any model. Still blocked. Backend Phase 18's
  real `/api/leaves` is leave data, not pay, so it does not unblock this.

**Decision: reason for no build = waiting for the backend to create the endpoint.** Recorded in
HANDOFF/STATUS and filed to `cgpe-api` in INBOX as one consolidated ask (commissions product
aggregate + a computed salary/earnings endpoint).

**Decision: Phase 18 test tooling = Playwright + Expo Web, headed (user pre-approved the choice).**
The user asked to *watch* the app being tested A-to-Z with worst-case edge cases. Chosen because:
(1) it opens a real browser window they watch, with `video:'on'` + `trace:'on'` for frame-by-frame
replay; (2) Playwright `page.route` injects every fault (500/503/empty/malformed/timeout/401/403/
huge list) **deterministically and offline**, so the "worst testing" touches zero production data;
(3) no Android SDK/emulator/JDK needed on this Windows box. Rejected Maestro+emulator as the primary
(heavier Windows setup) — kept as an optional stretch for native-only flows. **Honest cost, written
into the spec:** web cannot exercise haptics, the AsyncStorage `clock.<date>` key, background GPS,
the biometric AppLock, or the `react-native-webview` LeafletMap — those remain handset-only. Phase 18
shrinks the device backlog; it does not replace it. Its first task/risk: `expo start --web` may need
a minimal `Platform.OS !== 'web'` guard around module-scope native imports before it boots.

**Decision: order = Phase 18 (test) → Phase 19 (language) → Phase 16 (salary) / Phase 6
(commissions).** Per the user's explicit sequence ("yeh 2 ho jaaye uske baad salary aur jo baaki
hai"). 18 and 19 are largely buildable now; 19's dictionary-parity Vitest depends on nothing and is
the honest first green thing if the web build proves slow to boot. 16/6 stay backend-blocked.

**Decision: Phase 19 verifies + hardens the *existing* 5-language toggle, and never machine-
translates a gap.** The app already ships English/हिन्दी/ગુજરાતી/Hinglish/Roman-Gujarati (`i18n/
index.tsx`, 5×74 keys). Hinglish = Hindi-in-Latin, Gujlish = Gujarati-in-Latin (user's definition).
A missing key is a *finding to report*, not a gap to fill with a guessed transliteration — a wrong
Hinglish string is worse than an obvious English fallback.

---

## 2026-08-21 — Phase 75 (daily-flow bug cluster: C1 keyboard, A2/A1 overdue-as-today)

**Decision: C1 — fix the dead soft-keyboard in bottom sheets by focusing on `Modal.onShow`, not
`autoFocus`.** On Android an `autoFocus` `TextInput` inside an RN `Modal` requests focus before the modal
window is attached, so the soft keyboard never rises (owner report: Break button → no keyboard). `Field`
and `SearchBar` are now `forwardRef`; `Sheet` fires a new `onShown` on the Modal's `onShow` (50 ms
settle); the break, clock-out-reason (`home.tsx`) and claim client-picker (`claim-new.tsx`) sheets focus
their input there and DROP `autoFocus` — a lingering `autoFocus` would mark the input "focused" with no
keyboard and defeat the `onShown` focus. Deterministic (the OS "shown" signal), reusable for any future
sheet input.

**Decision: A2 — "Today's Progress = 0 / nothing scheduled" is NOT a mobile bug; keep the backend rule
and fix the mobile screen (owner chose Option 2).** The ticket→team_tasks mirror dates a claimed ticket
by `ticket.createdAt` (its own older open date) — the owner's own 2026-08-18 rule
(`../cgpe-backend-main/routes/tickets.js:382`) — so a ticket opened last week but claimed today buckets
Overdue, and the today-only progress read 0. Reversing it would hide genuinely-overdue tickets, so the
owner kept it. New pure `todayWorkload` (due-today ∪ open-overdue ∪ completed-today) drives the Tasks
hero; the 'today' empty state now nudges to Overdue.

**Decision: A1 — "the clock-in location screen" = the Home clock-in hero.** Owner clarified it is the top
of Home (the clock-in button area where today's tasks show). It used the same today-only `todayProgress`,
so the overdue ticket read "nothing scheduled" there too. Switched the Home hero to `todayWorkload`, which
re-unifies Home + the Tasks tab under ONE definition (the "never disagree" invariant is preserved, not
broken); `todayProgress` is retained only as a tested reference. Right sequence: A2 was built Tasks-only
first (to avoid changing the danger-zone Home unasked), then the owner explicitly asked for the Home hero,
so extending it there became correct rather than presumptuous.

**Decision: the "app won't open on some networks" report is LOGGED for on-device triage, not blind-fixed
(§F, HIGH PRIORITY).** The old aggressive 4.5 s `REQUEST_TIMEOUT` is already 12 s + one retry (Phase 55),
and the splash clears on storage-auth + bundled fonts (never the network) with all startup net calls
fail-open — so a network-caused splash-hang is NOT expected from the current code. The report needs the
crash-vs-hang-vs-blank answer + `adb logcat` + the phone-browser `/health` test on the failing network
BEFORE any code change. "Both WiFi AND mobile data" is the key oddity (old APK / DNS-IPv6 / device crash
are the suspects). F2 (systematic loophole hunt) is best as a multi-agent workflow on owner opt-in.

---

## 2026-08-22 — Phase 76: the "app won't open / can't reach server" is a NETWORK-MTU issue, not the app (RESOLVED)

**Decision: "Could not reach the CGPE server" was a path-MTU / IPv6 problem, fixed server-side; there is
no app-side fix and none should be attempted.** Diagnosed on the owner's real device via ADB (platform-tools
downloaded to the session scratchpad; a static aarch64 `curl` pushed for a non-browser test):
- The app OPENS fine (splash + Home chrome render); it is *requests* that fail. The app establishes a real
  TCP+TLS connection to `cgpe.in:443` (seen ESTABLISHED ~14 s in `/proc/net/tcp`, then aborts at the 15 s
  `LOGIN_TIMEOUT`) — so it is **NOT** a connect/DNS/reachability failure. The app **mislabels this timeout**
  as "could not reach the server."
- The backend is healthy and fast for everyone on IPv4 (nginx/1.24.0, every endpoint <0.1 s from a PC; no
  CDN/WAF). The phone's **browser works** (small responses / copes with translation); the app's native
  OkHttp — and a static `curl` on the same device — both time out.
- **Root cause:** the owner's phones are on **IPv6-only mobile networks (interface has only an IPv6 address,
  MTU 1300)**, and **`cgpe.in` is IPv4-only (A record, NO AAAA — re-confirmed via 8.8.8.8)**. So an IPv6-only
  phone reaches the IPv4-only server only through carrier **NAT64/DNS64** (`ping6 cgpe.in` works = the NAT64
  path is live). Over that path at MTU 1300, the server's full-size TLS/response packets don't survive the
  translation → the app's handshake stalls. The same reduced-MTU stall was the earlier "Home loads forever."
- **Fix (server/infra, NOT app):** the owner's senior applied a **TCP MSS clamp** on the droplet
  (`iptables -t mangle -A POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1200`) → the app
  started working immediately, confirming the diagnosis. The **permanent** fix is to **dual-stack `cgpe.in`**
  (assign the droplet an IPv6 address, `listen [::]:443 ssl;`, add an AAAA record) so IPv6-only phones reach
  it natively — filed to `contracts/INBOX.md` (2026-08-22 → cgpe-api/OPS). **No app rebuild fixes this.**

**Decision: shipped 8 of 9 adversarially-confirmed audit defects client-side; #7 is backend-blocked.** The
F2 loophole hunt ran as a multi-agent workflow (24 agents → 12 confirmed → 9 distinct); all fixes are in
`docs/AUDIT-2026-08-21-loophole-hunt.md` with a per-defect commit map, gates green (`tsc` 0 · tests 772 ·
lint 0 new). **#7 (duplicate creates on a lost-ack retry)** needs a client idempotency key — a *contract*
addition — so it was filed to INBOX (2026-08-22 → cgpe-api), not built with an invented field. Paired [api]
ask: `/track/points` session-ownership check (audit #5 defense-in-depth).

## 2026-08-22 — Phase 78: client Idempotency-Key wiring (closes audit #7)

**Decision: wire the `Idempotency-Key` header cgpe-api shipped (Backend Phase 81), generating the key
BEFORE the first online attempt and storing it on the offline draft.** Audit #7 (duplicate-create) was
backend-blocked because the client cannot dedupe a committed-but-unacked create on its own; the owner
picked (AskUserQuestion 2026-08-22) the standard `Idempotency-Key` header and cgpe-api built the
`(creator, key)` dedupe. Mobile now stamps `addLead`/`addTask`/`addNote` with a per-create key
(`idem-<ts36>-<rand>-<rand>`, 8–200 chars).
- **The key is generated once, before the online POST, and threaded into `enqueueWrite`** so the
  reconnect replay re-sends the SAME key. Generating it at enqueue time would have given the replay a
  key the server never saw on the first (committed) attempt — the duplicate would survive. This is the
  load-bearing property, pinned in `api-idempotency.test.ts`.
- **`flushDecision` left untouched.** The idempotency 4xx codes (409 in-progress / 422 conflict / 400
  invalid) are unreachable in correct sequential client operation, so the existing "4xx → drop" is safe;
  documented in `replayWrite` rather than adding a branch that can never fire.
- **Opt-in/additive, `[m]`-only** — live-safe before the backend redeploy (an un-deployed server ignores
  the header); an old draft with no key replays as before. No contract change (pure consumer).
- Gates: `tsc` 0 · `npm test` 787 (+9) · eslint 0 new errors. Commit `0b93985`, pushed `aaziko/Shivam`.
  INBOX reply filed under the cgpe-api ask (2026-08-22), grepped back to survive concurrent writes.

## 2026-08-22 — Owner backlog D3 / B1 / D4 / C2 / D6 ("implement everything, perfectly")
- **C2 clock-out reason threshold = 8h30m of worked time** (owner-locked in chat). Matches the existing
  `MIN_SHIFT_MS` payroll office-hours figure — not a new invented number. Prompt copy reuses the Phase-50
  `clock.reasonEarly` ("clocking out before your shift ends…"), so NO new i18n was needed for C2. Reason
  routes to super_admin (Phase 50). Client pre-check runs before GPS; the sheet's submit re-sends with the reason.
- **D4 replaces the five Tasks status filters** (today/overdue/in_progress/upcoming/done) with four TIME views
  (Today / This week / This month / Calendar, default Calendar) — the owner's explicit request. Not a second
  filter row. Overdue/in-progress tasks stay reachable in the Today view (it includes open-overdue); completed
  tasks appear in their due-period views. Hero's three counts became informational. Week = Monday-start ISO week.
  Calendar strip is current-month only (no prev/next month nav — deferred).
- **D3 target was the Home day-figure boxes**, NOT a team screen — owner clarified (Overdue / In-progress /
  Due-today / Follow-ups / Open-claims / Open-tickets = the `kpi_strip` widget). Hoisted to lead the dashboard.
- **D6d (hide advanced sections) shipped as NO CODE.** The More screen's admin group already renders only when
  `caps.manageTeam` (false for the team tier) and preview-as-team hides it too, so every admin/oversight surface
  (Monitor, Agent-map, Movement, Team-perf, Payroll, Analytics, Campaigns, Notify, Viewing-as) is already hidden
  from team members. The remaining sales↔ops content split (D1/D2) is a per-department **admin-panel config**
  (`nav.hidden`/`nav.tabs`) the app already obeys everywhere — deliberately NOT duplicated with client-side
  department literals (would fight the config architecture + the "role/department = backend, not client literals"
  rule). Owner handed a plain-language relay for the panel instead.
- **INBOX left unedited** this session — it was visibly mid-flux from sibling sessions (content shifted between
  two reads minutes apart). To avoid clobbering their replies, the D1 config ask was handed to the owner as a
  plain-language relay rather than written into `INBOX.md`.
- Gates each phase: `tsc` 0 · `npm test` 797 · eslint 0 errors (1 pre-existing i18n warning). Commits
  `be207a6` (D3), `2cda2d3` (B1), `bf9575a` (D4), `aee594c` (C2), `d4b0471` (D6a/b/c), `2531484` (i18n),
  all pushed `aaziko/Shivam`. Owner supplied 5-language copy same day → 21 new i18n keys, parity 111 → 132.

## 2026-08-22 — Owner backlog B2–B5 (live location)
- Verified all four against real backend code (`cgpe-backend-main/routes/timeTracker.js`,
  `models/DayLog.js`) before editing. `/live-locations` already returns EVERY profile (clocked-in and
  not); `/last-location` serves on- or off-duty last point; `/break-locations` gives orange break pins;
  `clockOutLoc` is stored on the day log but not surfaced by any live-map endpoint.
- **B5 (shipped, `0e2a77b`):** the bug was in `src/app/agent-map.tsx`, not the backend — the roster LIST
  was built from `pins` (`liveOnDutyPins` = clocked-in AND finite GPS) whenever ≥1 pin existed, using the
  full `team` roster only as a zero-pin fallback. One located member therefore hid the whole directory.
  Fix: list = full `team` universe always (fallback to `pins` only on an outage); map still plots only
  `pins`; header shows three honest counts; Off-duty section un-capped. Gates `tsc` 0 · `npm test` 797 ·
  eslint 0. This also cures B4's "member doesn't appear in the list" symptom.
- **B2:** already built (`team/[id].tsx` Live button → `/last-location`) and honest; no code. Real
  off-duty data is a platform/consent/APK matter, not an app bug.
- **B3:** ruled a backend ask — the app already renders red `outLat/outLng` clock-out pins, but the live
  map has no data source until `/live-locations` (or a companion endpoint) surfaces the stored
  `clockOutLoc`. Handed to the owner as a relay; INBOX left untouched (concurrent-write corruption risk,
  per the prior batch's rationale).
- **B4:** map pin is a data question (Pavitra's points may have been dropped: accuracy > 100 m, or a
  session-less batch). List half is fixed by B5. Owner/backend to verify.

## 2026-08-24 — E2 (Generate report): app already correct; ship cause-naming, relay OPS
- **E2 is OPS, not app code.** Verified vs real backend (`routes/clients.js:310`, `reports.js`,
  `services/pdfReport.js`): the mobile report feature already (a) opens the rendered report `viewUrl`/`pdfUrl`
  on success and (b) returns null honestly on failure. "No report generates anywhere" is a prod droplet with
  the n8n render webhook unset → the handler returns `503 not_configured`. Not fixable from here (no droplet
  access; backend push 403).
- **Shipped the one buildable mobile win (`d9656bf`):** `generateReport` reads the server's own status and
  returns a discriminated result (`ReportDoc` | `not_configured` | `no_data` | `unavailable`) rather than
  collapsing every non-2xx to null, so `client/[id].tsx` names the actual cause ("reports not set up on the
  server yet" vs a transient message). `not_configured`/`no_data` are considered answers → no health banner;
  5xx/network still raise it. New `api-report.test.ts` (9) pins the statuses. Gates `tsc` 0 · `npm test` 806
  · eslint 0 new. Pushed `aaziko/Shivam`.
- **OPS unblock handed to the owner (relay):** set `CGPE_REPORT_WEBHOOK_URL` (or `N8N_REPORT_WEBHOOK_URL`) +
  `CGPE_REPORT_SECRET`, wire the n8n `cgpe-report-render` template, restart `:3001`. INBOX left untouched (no
  contract change; concurrent-write-corruption risk, per prior batches).

## 2026-08-24 — E2 report: verified backend "fix" ≠ the fix (Phase 87 is cache, not deployed)
- Owner said backend reported the report task done. Verified against DEPLOYED code, not the claim.
- Backend's 2026-08-24 update = **Phase 87** (`services/reportCache.js`): app+panel share one report cache,
  TTL 24h→7d. It is **only a cache**, and it is on `origin/Shivam` + local, **NOT `origin/main`** (tip still
  `10e1f76`/Phase 79) → **not live on prod**. Prod deploys only `origin/main`.
- The real blocker is unchanged: deployed `routes/clients.js:223` returns `503 not_configured` when the
  render webhook URL is empty; `config/webhooks.js:37` sources `report` from **env only**
  (`N8N_REPORT_WEBHOOK_URL`, no committed URL). Cache never generates a first report → empty cache + unset
  webhook = still no report.
- Decision: app owes nothing (backend confirmed "cgpe-mobile: nothing owed"); did NOT touch app report code.
  Optional `data.cached` hint deferred until Phase 87 is actually deployed. Ticked the INBOX FYI with both
  prod-truth flags for the owner; grep-verified the write survived. No source changed this session.

## 2026-08-24 — A3 attendance present/absent (app-side shape mismatch)
- Symptom: "My attendance" showed every day as "No clock-in recorded", Days-logged/Closed-days 0, on a
  healthy server. Owner: "present/absent not working well."
- Root cause: `getAttendanceHistory` (`src/data/api.ts`) reads `/time-tracker/history` FIRST, which returns
  RAW DayLog documents (`{date, sessions:[{clockIn,clockOut}]}` — times nested in sessions[]). But
  `attendance.tsx` maps `h.clock_in?.time || h.clockIn` — the flat "attendance record" shape that ONLY the
  `/attendance/history` fallback leg emits (backend `dayLogToAttendanceRecords`). Every DayLog row read
  `clock_in === undefined`. The fallback never rescued it because the primary *succeeds* (with the wrong
  shape); the fallback only fires on a network throw. Verified vs deployed `origin/main` `49482e9`.
- Decision: normalise at the api boundary, not the screen. New pure `adaptAttendanceHistory()` in `adapt.ts`
  flattens a DayLog → one record per session (mirrors the backend mapper), passes canonical rows through;
  both legs of `getAttendanceHistory` run through it. `attendance.tsx` untouched.
- Decision: keep `/time-tracker/history` as the primary leg (stable/deployed raw-daylog read) and adapt it
  in-app, rather than swapping to `/attendance/history`, so the fix has zero dependency on backend deploy state.
- Result: app-side only, no backend/INBOX action. Commit `316cd81`, pushed aaziko Shivam. tsc 0 / test 812
  (+6) / eslint 0. Device-unverified (OTA-eligible).

## 2026-08-24 — D5 typo-tolerant search ([m] half)
- Ask: search should still find a record when the query is mistyped ("rajseh"→Rajesh, "jeevn"→Jeevan).
  The existing `search.tsx` scorer was tiered SUBSTRING matching (exact/prefix/contains/compact/token)
  with no edit-distance, so a single wrong or transposed character missed entirely.
- Decision: add a last-resort fuzzy tier, NOT rebuild the scorer. New pure `src/lib/fuzzyMatch.ts`
  (Optimal String Alignment = Levenshtein + adjacent transposition, bounded early-exit) exports
  `osaWithin`/`fuzzyBudget`/`tokenFuzzyHit`; unit-tested (+15). `tierFor` gains one `T_FUZZY = 0.5` tier
  (score 5+weight) below "contains" (10+weight) and above server-only (1), so a typo never outranks a
  real substring hit. Wiring helper `fuzzyMatches(q,value)` splits value on whitespace (keeps Gujarati).
- Decision: EXCLUDE numeric queries from fuzzy — a wrong digit fuzzy-matching a different person's
  phone/policy number is a wrong answer, not a helpful one; the digit path already owns numeric lookups.
- Decision: thresholds locked in `docs/spec/PHASE-D5.md` (query token <4 ineligible, 4-6→1 edit, 7+→2;
  value words <4 not fuzzy targets) — pure + tested so re-tuning is a deliberate edit, not eyeballing.
- Scope: this is the [m] half only. Clients/tickets are SERVER-searched against the ~9k book (exact/
  substring), so a typed typo returns no candidates for the local scorer — whole-book typo tolerance
  needs server-side fuzzy on `?search=` (the [api] half). INBOX untouched (corruption risk); owner relay.
- Result: commit `c1c5489`, pushed aaziko Shivam. tsc 0 / test 827 (+15) / eslint 0. Device-unverified (OTA).

## 2026-08-24 — Owner 12-point backlog: triage-before-build + APK cut
- Ask: owner listed 12 points after analysing the app; wanted each described DEEPLY, added as prioritized
  rows, with highest priority to items needing a human (owner) to unblock, then /handoff.
- Decision: cut ONE preview APK first (`7a384ee3`, git `04c36d6`) so the stranded OTA backlog
  (A3/B5/D3/B1/D4/C2/D6/E2/D5) reaches a phone before any new code. Gates green (tsc 0 / test 827).
- Decision: verify each point against REAL code (app + backend origin/main `49482e9` + contracts) via a
  12-agent Workflow rather than paraphrase — this caught two findings the surface complaint hid: the
  report feature has a real 12s client-timeout bug (backend waits 60s for a 15-40s render), and the
  client book is readable by every team token (backend/data model, not tab visibility).
- Decision: prioritize "human-need-first" both ways — Band 1 = items only the owner can unblock
  (decisions/OPS/relays), Band 2 = client code I can build (OTA unless noted). P0/P1/P2 = team severity.
- Decision: INBOX left untouched (corruption risk); backend/OPS asks given as plain-language relay texts
  in `docs/OWNER-BACKLOG-2026-08-24.md` for the owner to send.
- Result: `docs/OWNER-BACKLOG-2026-08-24.md` + `docs/DEVICE-TESTING-GUIDE-2026-08-24.md` + PHASES rows,
  commits `82548c7`/`e256be0`, pushed aaziko Shivam. No feature code changed — triaged plan only.

## 2026-08-24 — Band 2 #1: report 12 s → 65 s timeout (owner backlog Point 1, [m] half)
- Ask: owner "reports don't generate". Verified root cause was CLIENT-side, not the backend:
  `generateReport` reused the 12 s `REQUEST_TIMEOUT` on a POST the backend holds ~60 s open for a
  15–40 s n8n render → every FRESH report aborted before the server answered (a cached report
  returned fast, masking the bug).
- Decision: add a dedicated `REPORT_TIMEOUT = 65000` in `config.ts` (covers the ~60 s server wait +
  a small TLS/round-trip cushion) and pass it in `generateReport`. Single source of truth alongside
  LOGIN/UPLOAD timeouts. POST → never auto-retried by `req()` (no duplicate render).
- Decision: a report that outruns 65 s is NOT a whole-app outage — it must not flip the global
  `<HealthBanner/>`. The catch splits on `kindForThrown`: our own abort (`'timeout'`) returns a new
  `ReportFailure.reason:'timeout'` and does NOT call `reportFailure`; a genuine network throw
  (`'network'`) still reports → banner, preserving the existing "a dead network is an outage" test.
  Rationale: a 65 s hang (TCP up, no body) is far more likely a slow render than a dead link, and a
  real outage is still caught by the app's other reads via their 12 s timeouts. The screen names the
  timeout cause report-specifically. **Do not collapse the split catch back to one reportFailure.**
- Decision: kept the failure messages hardcoded English (matching the three existing report strings);
  did NOT introduce i18n keys that would owe 5-language copy — out of scope for a timeout fix.
- Scope: [m] half only. Reports still need the OPS half to work on-device (report webhook env +
  n8n live + nginx read-timeout ≥ 60 s + `:3001` restart) — do not report "reports fixed" from code.
- Result: commit `4516dd9`, pushed aaziko Shivam. tsc 0 / npm test 829 (+2) / eslint 0 new errors.
  Device-unverified (OTA-eligible). INBOX untouched (no contract change — additive client behavior).

## 2026-08-24 — Band 2 #3: task-flow mitigations (owner backlog Point 5, [m])
- Decision: **gate every create affordance on the role-derived `capabilitiesOf().assignTasks`, ANDed
  with `can('can_create_task')` — NOT the RBAC flag alone.** Verified: the backend
  (`team.js:384`) allow-lists create to `['admin','leader','super_admin']` by REAL role, and the RBAC
  `can_create_task` flag FAILS OPEN (`SCHEMA_FEATURE_DEFAULTS`=true) when a role config is unseeded
  (Point 6). So a flag-only gate leaves team-tier still invited into the 403. `assignTasks` (true ⟺
  tier admin/master ⟺ that role set; leader folds into admin and IS allowed by the endpoint) is the
  reliable mirror; the flag is ANDed so a future seeded restriction still bites. Applied to the Tasks
  FAB + empty states, **Home** (`:688`, was flag-only — the adversarial review caught it), the
  **Admin/Master dashboard** "Assign task" tiles (prop-drilled from Home), and the task-new **entry
  guard**. One predicate, no drift.
- Decision: **Edit is NOT gated; transfer IS.** The backend `PATCH /team/tasks/:id` has NO ownership
  gate (any staff may edit/reassign any team task), so a member may edit the task assigned to them —
  no client role gate on Edit. Transfer is assign-to-others (RBAC `can_assign_task_to_others:false`
  for team, and they have no roster), so it is gated on `assignTasks`.
- Decision: **new `updateTask()` sends `dueAt` ONLY when the user changes the due date** (edit form
  Due defaults to "Keep"), so an unrelated edit never moves the timestamp; and the **Edit pencil is
  hidden on a DONE task** — a field-PATCH bumps the backend `updatedAt`, which `adaptTeamTask` reads
  as a done task's `completedAt`, so editing a task finished days ago would re-credit it to *today's*
  completed count (`todayWorkload`/`todayProgress`). Correct a done task via Reopen first.
- Decision: **hide the "Workflow" checklist card when `steps.length===0`** rather than showing a "No
  checklist" empty state — real `team_tasks` carry no steps anywhere (backend model + `adaptTeamTask`
  hardcodes `steps:[]`), so the card was *always* empty and read as broken. Kept for the legacy
  `/tasks` path that can carry steps ("hide when empty", not deleted).
- Decision: **the assignee/transfer roster sources the staff DIRECTORY (`/profiles`), not the
  task-derived `getTeam()`** — new `getAssignableTeam()` (directory-first, scoped fallback, sorted by
  name) so a plain admin sees colleagues who have no task yet. Because that enlarges the roster, both
  pickers gained a name **search + render cap + "showing N of M" hint** (shared pure tested
  `filterMembers` in `data/team.ts`) so no colleague past the cap is silently hidden; the sheet's own
  ScrollView already carries `keyboardShouldPersistTaps` so the first tap still lands.
- Decision: **dropped `category` from the Edit screen** (the review found the passed param was dead) —
  a task's server `type` is often not one of the create form's category chips, so a Chips control
  would read as "nothing selected"; edit stays on title/details/client/priority/due. Removed the param
  too, so no dead code.
- Process: two adversarial `Workflow` reviews — a 15-agent full pass found **8 real findings, ALL
  fixed** (incl. the Home-gate miss, the silent picker truncation, the done-task re-credit); a 3-agent
  delta pass on the fixes came back clean (234 k tokens of real investigation, 0 findings).
- Scope owner-owned, NOT built: the create **policy** (may team-tier create their OWN tasks? the
  backend 403s them today, `[decision]`+`[api]`), edit **ownership** scoping (`[api]`), real task
  **checklists** (no backend step endpoint, `[api]`). The app only moves the refusal to the entry.
- Result: commit `af7e492` (+ handoff `af99b82`), pushed aaziko Shivam. tsc 0 / npm test **877** (+14:
  `api-task-edit`, `team`) / eslint 0 new. Device-unverified (OTA-eligible). INBOX untouched (additive,
  no contract change). Spec: `docs/spec/BAND2-3-task-flow.md`.

## 2026-08-24 — Band 2 #4: Calendar month grid (owner backlog Point 4, P2/one-P1-bit, OTA)

- Context: D4's Tasks-tab "Calendar" was a single-month horizontal day RAIL — one month only (no way
  to reach another), a binary "has open work" dot (a 1-task and a 6-task day looked identical), no
  all-done marking. Point 4 asked for a real 7-column month grid with prev/next, a per-day count, and
  all-completed days marked. Backend needs no change (every task endpoint is deployed).
- Decision: **the date-grid maths lives PURE in `data/tasks.ts`, tested** (like `weekRange`/`monthRange`),
  not in the screen. New `monthMatrix(anchor, weekStartsOn=0)` builds a **FIXED 6×7 = 42-cell** grid so
  the grid never changes height between a 5-week and a 6-week month (max leading 6 + 31 days = 37 ≤ 42);
  leading/trailing days from adjacent months fill the rectangle flagged `inMonth:false`. `inMonth`
  compares **year AND month** so a January grid's December leading cells (prior *year*) are correctly
  out-of-month. `MonthCell.ms` is local midnight — the same key `taskCountsByDay`/`tasksInRange` bucket
  on, so a cell's tally is `counts.get(cell.ms)` with no re-derivation.
- Decision: **Sunday-first grid by default** (`weekStartsOn=0`) to match the app's existing Sun-first
  `WD` weekday header on the Tasks/Calendar screens; the param is exposed + tested for a Monday-first
  grid. (Note `weekRange` is Monday-first ISO — different view, different purpose; the grid owns its own
  week-start to match its own header.)
- Decision: **new `taskCountsByDay(list, now)` → `Map<ms, {total,open,done,overdue}>`.** `overdue`
  counts OPEN tasks on a day strictly before today only, so a past day that is fully done is NOT overdue.
  The grid reads `.total` for the count, `total>0 && open===0` as an all-completed (green) day, `.overdue`
  for the danger tint. Undated/invalid excluded, same rule as the other time-view helpers.
- Decision: **ZERO new i18n keys.** The "Today" jump reuses `tasks.today`; the month/year header and
  weekday letters are English by design — consistent with `fmtDate`/`fmtDay`, which render dates in
  English in every language across the whole app (dates are not localised anywhere). Prev/next a11y is
  built from the same English month names (announces the destination month), so no dictionary or
  parity-count change and no owed 5-language copy for the grid itself.
- Decision: **paging preserves the selected day; it does not auto-select.** Browse the grid with the
  arrows, tap a day to change the list below. A compact day heading (`dayHeading(selDay) · count`) names
  the selected day, so a "grid shows September, list shows 24 Aug" state is never ambiguous. Tapping a
  spill-over cell from an adjacent month follows the grid to that month (`pickCell`).
- Decision: **create-gating reused, not re-authored.** `canCreateTask` (Band 2 #3) still gates the
  `<Fab>` and every empty-state "Add task"; this phase did not touch it. The separate
  `can_assign_task_to_others` flag wiring is deferred to Band 2 #8 (role toggles), after the owner's
  role matrix — out of scope here.
- Process: a 4-dimension adversarial `Workflow` (`band2-4-calendar-review`, 6 agents) — the **maths and
  regression dimensions returned 0 findings**; 2 low-severity findings were confirmed and FIXED:
  (1) `todayMs` was a `[]`-memo that froze "today" at first mount while the hero's `todayWorkload(list)`
  re-read the clock on each focus refetch — an internal inconsistency across a midnight crossing; now
  `todayMs` is **state re-stamped on every tab focus** (same value → React bails, no-op on the same day).
  (2) `emptyCalendarBody` said "strip above" — de-staled in **English** ("calendar above"); the four
  translations (gu/hi/hi-en/gu-en) still say "strip" and OWE one human line each — flagged, not
  machine-translated.
- Result: commit `c3c3537` (+ docs `44cd71b`), pushed aaziko Shivam. tsc 0 / npm test **891** (+14) /
  eslint 0 new (the lone i18n `:647` warning is a pre-existing ref-cleanup one). Device-unverified
  (OTA-eligible). INBOX untouched (additive, no contract change). Spec: `docs/spec/BAND2-4-calendar.md`.

---

## 2026-08-24 — Band 2 #5–#7 (Search / Premium-403 / Client access)

- Decision: **Band 2 #5 (Client Search in More) closed as NO-BUILD** (`9121020`). Owner chose "keep global
  search, just rank clients first" via AskUserQuestion — DECLINED the client-only `scope=clients` mode.
  Verified the global search already ranks Clients first for client-shaped queries (`W_ID` fields at the
  strongest tiers; `search.tsx:546` group sort ties-break to Clients `order:0`). Force-pinning Clients above
  a stronger claim/ticket-reference match would REGRESS reference lookups. Recorded in
  `docs/spec/BAND2-5-client-search.md` so it is not rebuilt.

- Decision: **a campaign role-refusal (403) is a COMPLETED job that delivered nothing, never a `failed` one**
  (`fb64734`). Root cause: the background runner honored `needsRole` on the renewal path but DROPPED it on the
  audience path (`store/jobs.tsx`), so birthday/anniversary/maturity refusals were flattened to
  `status:'failed'` → red "Dispatch failed" on `premium.tsx`. Marking it `'done'` alone would have made the job
  monitor show green "100% Send finished". Fix: NEW pure `src/lib/campaignOutcome.ts` (+5 tests) is the single
  rule both send paths share; a typed `Job.needsRole` flag every surface reads; `premium.tsx`/`campaigns.tsx`/
  `job/[id].tsx` all render a refusal as an amber warning, not red/green. Chosen over per-screen message-regex
  matching (fragile) — `campaigns.tsx` kept its `ROLE_REFUSED` regex only as a defensive fallback. Deleted the
  dead `format.ts greeting()` (zero callers). 4-lens adversarial review: 0 findings.

- Decision: **retire the duplicate `/premium` screen** (`9967db3`), owner-chosen. `/campaigns` is a strict
  superset (KPI summary, message preview, live progress, correct 403 handling). Repointed the 3 `/premium`
  entries (Home quick-action, More module, dashboard tile) to `/campaigns`; deleted `app/premium.tsx`. Left the
  `premium.*` i18n keys as harmless orphans (removing them would perturb the `EN_KEYS.length===75` parity test).

- Decision: **client book is MASTER/ADMIN only** (`4575106`), owner-chosen (over own-only / team / whole-book).
  Team-tier sees no clients; this option needs no client-ownership data job. Predicate
  `canViewClients(user,viewAs) = capabilitiesOf(user,viewAs).tier !== 'team'` (+6 tests) — INCLUDES the whole
  admin tier (admin + leader run a branch and own the book, per `roles.ts` module doc) and reads the
  **view-as-aware** tier (a master previewing "team" loses the book, regains it on switch-back). This is
  distinct from the master-only location/perf/monitor gates, which read the REAL role to fold `leader` OUT.

- Decision: **gate `/campaigns` as part of Point 9**, even though the owner said "the Clients section." Its
  audience preview renders whole-book client names/phones/premiums (`scope=all`) — a 4-lens adversarial review
  confirmed it as a HIGH leak (send was already 403'd for team; the preview was not). Closing it *implements*
  the owner's stated decision (team must not reach client PII) rather than being a new one. Reversible.

- Decision: **screen guards use a thin WRAPPER component, not a mid-body early return.** `export default
  function X()` calls `useAuth()` unconditionally then renders `<XScreen/>` or the shared `<RestrictedNotice/>`
  — so the real screen's interleaved hooks are untouched (no conditional-hooks hazard). New shared UI
  `src/ui/RestrictedNotice.tsx` (the payroll early-return pattern, factored out).

- Decision: **left three adjacent client-PII surfaces UNGATED** (flagged for owner): the WhatsApp hub, search's
  Tickets group, and the task-contact sheet (a member contacting the client on their OWN assigned task — a LOW
  review finding). These are the member's own work / a separate collection, not book-browsing.

- Process: filed the **[api] backend-403 relay** to `../contracts/INBOX.md` (top), verified line-by-line against
  the deployed backend (`routes/clients.js:203,604,617`, `utils/scope.js:93,121,161`) before filing, and
  grep-confirmed it persisted. The app gate is defence-in-depth; the server refusal is the real authority
  (owner-owned).

- Result: 4 commits (`9121020`, `fb64734`, `9967db3`, `4575106`), all pushed aaziko Shivam. Final gates:
  tsc 0 / npm test **902** / eslint 0 new errors. Device-unverified (OTA-eligible). Specs:
  `docs/spec/BAND2-5-client-search.md`, `docs/spec/BAND2-7-client-access.md`.

## 2026-08-25 — Role identity model + SALES-advisor client carve-out + Band 2 #8 feature-gates

- Context: owner asked to deeply analyze the merged `staff_unified` collection and define ONE canonical
  identity per person from `role` + `_origRole` + `department`, then finish the paused Band 2 #8 (wire the
  inert RBAC flags). Analysis done against the real backend (`scripts/mergeStaffUnified.js`, `utils/scope.js`,
  `utils/rbac.js`, `routes/auth.js`, `models/Profile.js`) — not the reply.

- Decision: **`role` is AUTHORITATIVE; `_origRole` is a drift-flag only, never a grant.** The merge flattens
  every `team_members` job title (ops/sales/manager/driver…) to `role:advisor`, and `_origRole` keeps the
  original. `identityOf().drift` fires ONLY when `_origRole` is a real enum role that differs from `role`
  (Ved Test: super_admin→admin). Letting `_origRole` set the tier would silently re-promote a demoted account.

- Decision: **the app carries `department`+`origRole` now** (`User` + `adaptUser`). The backend already sent the
  whole row via `toPublicJSON`; `adaptUser` was dropping all but 9 fields. `canonicalizeDepartment` is a faithful
  BY-HAND port of `utils/rbac.js` (must stay in sync — like `SCHEMA_FEATURE_DEFAULTS` mirrors the JSON).
  ⚠️ 4 live dept values (`GENERAL INSURANCE`/`BANKING & COLLECTION`/`DRIVER`/`IT`) canonicalise to null →
  un-siloed; fixing them is the backend's job (kept the port faithful so app+server agree).

- Decision: **role reconciliation finals (owner + senior, in-session).** Only ONE role changes vs live DB —
  **Ankit Shah `advisor → super_admin`** (owner-run `promoteStaffSuperAdmin.js`, ⚠️ merge-revert + no-password
  caveats). All 20 others already match. Recorded to memory `staff-role-reconciliation-2026-08-25`.

- Decision: **the SALES-advisor client carve-out (Q4) mirrors the server's DEPARTMENT rule byte-for-byte.**
  Backend P90/D-117 (`middleware/auth.requireClientBookOrOwn`+`isSalesAdvisor`, `utils/rbac.isSalesDepartment`
  = canonical dept startsWith "SALES") admits a sales advisor to a STRICT own-only view. App added
  `isSalesDepartment`/`isSalesAdvisor`(real role, not view-as)/`canViewOwnClients` (=`canViewClients` OR
  `isSalesAdvisor`). Applied ONLY to the two surfaces the server opens (clients list + detail, plus the search
  that rides the list endpoint); segments/families/campaigns stay on `canViewClients` (server keeps
  `requireClientBook` and 403s a sales advisor). Consequence: Jagdish Bhai (dept SALES-RENEWALS, owner-called
  "ops") counts as a sales advisor for client access — correct, the app MUST match the server.

- Process: **verified DEPLOYMENT before shipping the carve-out** (the standing deploy-gap discipline). On first
  check Phases 88–90 were on `origin/Shivam` but NOT `origin/main` (prod at Phase 87) — held the app change and
  handed the owner a merge+deploy relay. After the owner deployed, re-verified: `origin/main`=`990c660`,
  `merge-base --is-ancestor` exit 0 for P89+P90, `/health` 200 — THEN shipped. Shipping against the undeployed
  server would have re-leaked the whole client book to a sales advisor.

- Decision (Band 2 #8): **5 of 10 inert flags wired via the caps-AND-flag pattern** (`caps.X && (uiReady ?
  can('flag') !== false : true)` — fails open so an app-UI outage never hides an entitled control):
  can_assign_task_to_others (task transfer, AND assignTasks), can_send_campaign (AND runCampaigns),
  can_dispatch_notification (AND manageTeam), can_create_claim + can_claim_ticket (flag-only, default true so
  team keeps them). **5 NOT wired, documented in `appUi.tsx`:** agent-map/movement-paths are already master-only
  via `canSeeLiveLocation` (a fail-open flag can only narrow, never widen — decision A); advance-claim/
  export-data/edit-client have no app affordance (decision B — account.tsx's own-data DPDP export is a privacy
  right, not this admin flag). Behaviour unchanged today; a seeded config can now tighten per role.

- Result: 3 commits (`9f8e47d` identity, `cc4657f` sales carve-out, `6b63a1e` #8 gates), all pushed aaziko
  Shivam. Final gates: tsc 0 / npm test **931** / eslint 0 new errors. Device-unverified (OTA-eligible).
  Still owner-owned: the 3 prod scripts + the on-device sales-advisor Clients check.
