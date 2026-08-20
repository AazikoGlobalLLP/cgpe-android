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

**✅ 2026-08-20 — PHASE 57b BUILT (safe write queue — Notes).** The second half of offline support: a note created while
offline is no longer lost or falsely reported as saved. `addNote` now returns a 3-outcome `AddNoteResult` — **saved** (server
accepted), **queued** (network was down → additive draft held to sync; NO success haptic, "saved on this device" toast), **failed**
(server ANSWERED and refused → NOT queued). Pure tested seam `src/lib/writeQueue.ts` (parse/serialize, cap, `bumpAttempt`,
`flushDecision`: 2xx→sync / 4xx+attempt-cap→drop / 5xx+network→keep); reactive `src/data/pendingWrites.ts` bus + `src/ui/pending.tsx`
(`usePendingWrites`/`useDropNotice`/`PendingBadge`); `flushWriteQueue()` in api.ts (re-entrancy-guarded replay); `QueueFlusher` gate
in `_layout` fires on **sign-in / foreground / health-recovery (next-success)**; queue **persists across logout** (per-user), read
cache does not. `notes.tsx`: pending drafts render on top with a "Pending sync" badge, the composer is available offline, a flushed
draft reconciles (temp-id→server-id via reload), a refused draft drops with a one-time banner. Gates `tsc` 0 · `npm test` **747**
(+18 across 57a+57b) · eslint 0 new. **Deliberate sub-scope: the queue mechanism is kind-generic but only Notes is wired (all 5
acceptance criteria are Notes) — Task-create is the documented remaining 57b piece.** New English strings owe 5-lang copy.
JS-only (OTA-eligible), **device-unverified**. Spec: `docs/spec/PHASE-57.md` (Build log). Commit pending push.

**✅ 2026-08-20 — PHASE 57a BUILT + PUSHED (owner chose Phase 57 offline after Phase 72 re-verified still blocked).** The read-cache
half of offline support: a per-user, versioned AsyncStorage copy of the last SUCCESSFUL list read, so a failed re-fetch shows the last
good rows with a **"Synced <time> · may be out of date"** chip instead of an empty screen — the honest **third state** (live / stale /
could-not-load) beside the degraded banner. Pure tested seam `src/lib/offlineCache.ts` (keys, (de)serialize, 30-day `gcVictims`, the
3-state `decideRead`, `mergeById` = keeps this-session offline creates visible atop an older snapshot); device-only I/O
`src/data/offlineStore.ts` (raw AsyncStorage — SecureStore size limits — failure-swallowing, once-per-session age GC); freshness bus
`src/data/freshness.ts` (sibling to `health.ts`, drives the chip without changing any read's return type); `src/ui/SyncChip.tsx` (+
`useDataFreshness`). `cachedList()` wraps **getTasks / getLeads / getReminders / getNotifications** — write-through on success, serve
cache on failure; **online behaviour byte-identical**. **Row-3 (DPDP): Clients & Claims stay online-only — no client-book PII / ₹ at
rest.** Purged on sign-out (`cache.*` sweep + `resetFreshness`). Chip wired on the Tasks tab (the acceptance screen; the other three
cache rows already, chip is a 1-line follow-up). Gates `tsc` 0 · `npm test` **729** (+15) · eslint 0 new (2 pre-existing api.ts warns).
**⚠️ New "Synced … may be out of date" string is hardcoded ENGLISH (spec row 6) — owes 5-lang HUMAN copy before it becomes
`common.lastSynced` (machine translation forbidden).** JS-only (**OTA-eligible** — AsyncStorage already a dep), **device-unverified**.
Commit `20eb4ed`, pushed `aaziko/Shivam`. Spec: `docs/spec/PHASE-57.md` (locked, owner-approved). **NEXT half = 57b safe write queue.**

**⚠️ 2026-08-20 — PHASE 72 RE-VERIFIED STILL BLOCKED (fresh probe this session).** Backend push code exists in `../cgpe-backend-main`
working tree but is **uncommitted** (`?? routes/push.js`/`models/PushToken.js`/`services/push.js`/`services/taskReminderScheduler.js`,
` M routes/{tasks,leads}.js`/`utils/notify.js`), **absent from `origin/main`** (fetched tip `f65e56a`), and prod `POST /push/register`
= **404** (health 200); FCM/EAS key still unset. cgpe-api's INBOX reply self-flags it "NOT yet committed/deployed." Do NOT cut the APK
or mark 72 done. Unblock = owner relays: backend commit→merge `origin/main`→deploy→restart `:3001` + Firebase/FCM V1 key on EAS.

**✅ 2026-08-20 — PHASE 55 BUILT + PUSHED (owner chose it while Phase 72 stays blocked on backend+Firebase).** The "app doesn't
work on my WiFi / this phone" complaint is fixed on the client side. The single **4.5 s** timeout (which also blocked *sign-in*)
is gone: reads **12 s**, login/OTP **15 s**, uploads **30 s** (owner-locked "Balanced"). An idempotent **read** now **retries once**
(600 ms backoff) on a throw / 5xx / 429 and self-recovers; **writes/uploads never retry** (no double clock-in/send/upload). The
outage banner now **names the failure** (slow-server / can't-reach-network / server-error) via a `FailureKind` threaded into
`data/health`. `uploadFile` gained an **AbortController** (it had none — hung forever). NEW **`testConnection()` + Settings "Test
connection"** verdict tells an app problem from a WiFi problem on-device. Pure tested seam `src/lib/netResilience.ts`.
**⚠️ 501 EXCLUDED from retry** — it is this backend's "not deployed" quiet answer (like 404), not a fault (surfaced by two tests
going red). Gates `tsc` 0 · `npm test` **714** (+24) · eslint 0 new. Commit `941c583`. **Honest limits (spec `docs/spec/PHASE-55.md`):**
device-unverified (JS-only, rides the pending native batch APK); new English strings owe 5-lang copy; suite wall-time ~0.6 s → ~4 s
(real-timer retry tests pay 600 ms each); DNS/captive-portal/firewall stay network-side. `[m]`-only, no contract change.

**✅ 2026-08-20 — PHASE 65 BUILT + PUSHED (owner chose it over waiting on Phase 72's backend).** The last un-built mobile piece
from the 63–69 batch is done: the master's Monitor roster + Agent map now source their people-universe from the deployed
super_admin-gated `/live-locations` (walks EVERY profile) instead of `/team/task-overview` (grouped by `team_tasks` assignee), so
a member with zero team-tasks no longer vanishes — it shows off-duty/zeroed. Pure tested `src/data/roster.ts`; join by NAME (the
two endpoints use different id spaces); non-masters unchanged; NO screen change. `[api]` prereq VERIFIED DEPLOYED (live probe 401)
BEFORE building. Commit `0c4fde1`. Full entry + honest limits below (map "who's out NOW"; possible deactivated-account inclusion →
optional `[api]`). Gates `tsc` 0 · `npm test` **690** · eslint 0.

**⚠️ 2026-08-20 — PHASE 72 "backend done" SIGNAL VERIFIED PREMATURE — do NOT cut the APK or mark 72 done.** Owner said the backend
finished the push work. Per the deploy-gap rule, verified: cgpe-api DID build it (INBOX Phase-72 `[x]`, their Phase 76/D-102) and
the code exists in `../cgpe-backend-main`, BUT it is **uncommitted** (`?? routes/push.js`/`models/PushToken.js`/`services/push.js`;
` M notify.js`/`tasks.js`), **not on `origin/main`** (tip `2531817` = Phase 69), and prod `/push/register` returns **404** (health
200). Firebase/FCM (hard prereq) still unset. So Phase 72 needs: backend commit→deploy→restart `:3001`, owner Firebase+FCM V1 key,
THEN re-verify (probe 401 not 404, token registers, test push arrives) → cut the ONE combined APK (65+70+71+72+73).

**⏸️ 2026-08-20 — PHASE 72 MOBILE HALF BUILT + PUSHED (owner #3), NOW PENDING BACKEND+INFRA — do NOT mark done.** Owner chose
**Tier B real push**. The mobile receiver is built + gated + pushed (`64f1afc`): `expo-notifications@~57.0.12`, token
register/unregister, foreground + tap→deep-link, pure-tested `pushRouting.ts`. It is DORMANT until (a) the backend ships the
device-token store + `/push/register`+`/unregister` + `broadcastToDepartment` + `sendPush` + the 4 trigger wirings (FILED to
INBOX, owner relays) and (b) the owner sets up a **Firebase/FCM project** (hard infra prereq). **OWNER DIRECTIVE: keep 72 PENDING
for the backend dev; EXECUTE/VERIFY this phase only when the owner signals "backend ne kaam kar diya"** — at that point verify the
backend against its real code (the deploy-verification method: fetch + `merge-base --is-ancestor` + a no-auth curl 401/404) and
confirm the app lights up, then fold into the batch APK. Spec: `docs/spec/PHASE-72.md`. Gates at build: `tsc` 0 · `npm test` 656
(+12) · eslint 0.

**✅ 2026-08-20 — PHASE 73 BUILT — owner chose OPTION B (auto-sync).** Assigned tasks/reminders AUTO-add to the member's phone
calendar (not just a manual export). Pure client `[m]` (no `[api]`): `expo-calendar@~57.0.2` + app.json plugin +
`READ/WRITE_CALENDAR`; pure-tested `calendarSync.ts` (`buildSyncItems` skips undated+completed, `planSync` idempotent
create/update/delete reconciliation, `allDayRange`); native `calendar.ts` (dedicated "CGPE Connect" calendar, lazy permission,
SDK-57 object API, sign-out cleanup); `CalendarGate` in `_layout` syncs on sign-in/foreground. Silent (no new i18n copy needed).
Gates `tsc` 0 · `npm test` **669** (+13) · eslint 0. Rides the batch APK (native, not OTA). Defaults (vetoable): both
tasks+reminders, SKIP undated, all-day events, dedicated calendar. Spec: `docs/spec/PHASE-73.md`.

**✅ 2026-08-20 — PHASE 71 BUILT + PUSHED (owner #2 of the 70–73 batch).** The "location doesn't update / background not running /
20 h straight-line route" complaint now has a code-driven fix. Today every route point is OS-delivery-driven and best-effort;
under Doze/OEM-kill the gap between points can far exceed the requested ~60 s cadence, and the ~15-min reliability watchdog only
re-armed/idled/retired the recorder — it captured no point of its own. Phase 71 gives `watchdogTick` a second job: when the newest
recorded point is stale it takes ONE `getCurrentPositionAsync(High)` fix and pushes it through the normal `ingest` path (de-dup,
mock-drop, shift/ambient attribution, delivery all unchanged). Stale decision lifted into a PURE, tested helper
`src/lib/staleBuffer.ts` (`isBufferStale`) — `tracker.ts` has zero test coverage. **Threshold `STALE_AFTER_MS = 60 − 15 = 45 min`,
derived from the owner's 60-min ceiling minus the watchdog interval (NOT the handoff's rough "55", which would overshoot to ~69).**
Bounded 30 s `withTimeout` so a cold fix can't hang the serial chain; `retire` early-returns; `WATCHDOG_INTERVAL_MIN` derived from
the shared ms const. Gates `tsc` 0 · `npm test` **644** (+9) · eslint 0. Adversarial review: no HIGH/MED. Commit `612410f`, pushed
to `aaziko/Shivam` (needed a clean MERGE of a benign remote `Update README.md` commit — no force/rebase — landing as `bdffdef`).
**Honest ceiling: WorkManager is itself Doze-deferred → ≤60 min is best-effort, not a hard real-time guarantee. Pure JS but rides
the native batch APK with 72/73 (not OTA); device-verify a stationary clocked-in phone gets points ≤~60 min apart (DB
`point_count`/`last_point_at`).** Detail: `docs/DECISIONS.md` 2026-08-20 (top).

**✅ 2026-08-20 — PHASE 70 BUILT + PUSHED (owner #1 of the 70–73 batch).** The "app keeps logging me out / re-verifies every
2-3 hours" complaint is fixed on the App-Lock side. Owner confirmed (AskUserQuestion) the "logged out" screen is the **dark
fingerprint overlay** (session alive), NOT the email/OTP login card — so it was the biometric lock re-arming with no grace, never a
token expiry. Built a **5-minute grace window** (owner-chosen): the lock stamps when the app was last backgrounded (in-memory for a
live process, persisted in SecureStore for cold start) and re-prompts **only if the gap exceeds 5 min** — on both the foreground and
cold-start paths. New pure `src/lib/appLock.ts` (`shouldRelock`/`parseLastActive`, fails closed) + `appLock.test.ts` (+10);
`src/ui/AppLock.tsx` wired. Deliberately did NOT touch the quick-unlock default (owner wants the lock) or add silent-restore-on-401
(no real expiry in play). Gates: `tsc` 0 · `npm test` **635** · eslint 0. Commit `cd134ba`. **Pure JS (OTA-eligible) — not yet on a
phone; rides the batch APK with 71/72/73.** **🆕 PUSH NOW WORKS:** new remote `aaziko` → `AazikoGlobalLLP/cgpe-android`,
`git push aaziko Shivam` succeeds (`origin` still 403s, untouched). Owner directive: push after EVERY phase with a distinct commit
message, then `/handoff`.

**⚡ 2026-08-20 — H1 clock-reason Sheet FULLY LOCALIZED (all 5 languages) + fresh APK cut.** Owner supplied 5-language human copy
for the Phase-50 out-of-range / early clock-reason prompt (both the Sheet titles/prompts AND the 2 edge-case "reason needed"
notices). Wired 8 new `clock.reason*` / `clock.reasonNeeded*` keys across all 5 dictionaries (commits `08f3a4f` + `8e9ad46`; i18n
parity 103 → 111; NOT machine-translated). Buttons reuse `common.cancel` / `home.clockIn` / `home.clockOut`; the server's own
`message` still wins, the keys are the fallback. **Fresh EAS APK `b01f4164`** (v1.10.0, gitCommit `8e9ad46`, direct `.apk`
`https://expo.dev/artifacts/eas/4ZaCvftKnI8K2MD--kCCtkii2HRmTYzKYxILWbtqNT8.apk`) — **supersedes `6b76608b`**, bundles the
localized reason Sheet + everything since 63/64/66/67. Gates green (`tsc` 0 · `npm test` **625** · eslint 0). This satisfies the
"reason sheet localized" half of the Phase-50-geofence precondition (the other half = install this APK). Push still 403s (local).

**🚨 NEW OWNER ISSUE BATCH 2026-08-20 → Phases 70–73, all VERIFIED against real mobile + backend code (4 parallel investigators,
file:line cited). NONE built — triaged this session, next session executes.** Owner priority order as reported: session-logout
(70) → location 60-min (71) → team notifications (72) → phone-calendar sync (73).

- **Phase 70 — [m] "App keeps logging me out / re-verifies every 2-3 hours." ✅ BUILT + PUSHED 2026-08-20 (commit `cd134ba`).**
  Owner confirmed via AskUserQuestion it is the **dark fingerprint overlay** (Mechanism 1, session alive) → built the 5-min App-Lock
  grace window only; NO OPS/`JWT_EXPIRE`, NO silent-restore (Mechanism 2 not in play). Original triage retained below for reference.
  TWO independent mechanisms,
  conflated in the report — separating them IS the fix. **(1) The frequent re-verify on every reopen = the biometric App-Lock,
  session INTACT underneath.** `src/ui/AppLock.tsx:69-81` (esp. `:77`) has **NO grace window** — ANY background→foreground
  transition re-locks and fires the prompt; the token is never touched. Quick-unlock defaults ON without opt-in
  (`store/auth.tsx:130`). **Fix = [m]** add an elapsed-time grace window (stamp `Date.now()` on background, only re-lock if elapsed
  > ~5 min; same guard for cold-start `:60-66`). **(2) The genuine "logged out to OTP/login" = a real 401** (`api.ts:196-198`
  `reportAuth` → `expireSession` → `auth.tsx:92-103` clear → `(tabs)/_layout.tsx:178` redirect). Backend access-token TTL default
  is **24h** (`../cgpe-backend-main/routes/auth.js:64-66`, `JWT_EXPIRE || '24h'`) — **nothing in code expires at 2-3h**, so a
  precise 2-3h cadence points at **prod `.env` `JWT_EXPIRE` set short** (OPS, most likely) or `is_active` churn
  (`middleware/auth.js:30`). Phase-48's 30-day biometric re-mint IS wired but **only as a manual login-screen button**
  (`auth.tsx:349-377`, `login.tsx:252-289`) — there is **no silent refresh on 401** anywhere; optional [m] = attempt
  `restoreBiometricSession()` inside `onSessionExpired` before clearing `user`. **NB the app uses a Bearer JWT in SecureStore,
  NOT a cookie** — the owner's "cookie" wording maps to no cookie. **OPEN Qs (owner answer decides the fix): when "logged out",
  is it (A) a dark fingerprint-only overlay [Mech 1, session alive] or (B) the full email/OTP sign-in card, maybe with a blue
  "session ended" banner [Mech 2, real expiry]? What is prod `JWT_EXPIRE`? Does turning Biometric-unlock OFF stop the frequent
  prompts?** The [m] grace window is the near-certain primary fix. · S.
- **Phase 71 — [m]+OPS (+[api]) Guarantee a location point every ≤60 min + fix "bg location not running". ✅ BUILT + PUSHED
  2026-08-20 (commit `612410f`, `aaziko/Shivam`).** `watchdogTick` now forces one `getCurrentPositionAsync(High)` fix through
  `ingest` when `state.lastAt` is stale (>45 min = 60 − 15-min watchdog); pure tested helper `src/lib/staleBuffer.ts`
  (`isBufferStale`) + `staleBuffer.test.ts` (+9); bounded 30 s `withTimeout`; `retire` early-returns; `WATCHDOG_INTERVAL_MIN`
  derived from the shared const. Gates `tsc` 0 · `npm test` **644** · eslint 0; adversarial review no HIGH/MED. Honest ceiling:
  WorkManager is Doze-deferred → best-effort, not hard real-time. JS-only but rides the batch APK (not OTA). **Remaining:**
  device-verify + the optional `[api]` >100 m relax (Phase-63's, already filed). Original triage retained below for reference.
  Today every point is
  **OS-delivery-driven, best-effort — there is NO code-driven time guarantee.** `tracker.ts:469-501`: `timeInterval:60000` +
  `distanceInterval:0` is a *request* to the fused provider, and `deferredUpdatesInterval:60000` lets the OS defer; under Doze /
  OEM-kill the gap can far exceed 60 min. **The watchdog captures NO point** — it only re-arm/idle/retire (`tracker.ts:592-611` ×
  `watchdog.ts:36-47`). **Fix = [m] JS-only:** in `watchdogTick` (`tracker.ts:592-611`) add a forced
  `Location.getCurrentPositionAsync({accuracy:High})` when the newest buffered point is > ~55 min old → buffer + `deliver`;
  reuses the already-installed `expo-background-task` (WorkManager, 15-min floor) + the existing upload path. **Honest ceiling:
  WorkManager is itself Doze-deferred** (typical ≤15 min, can slip in deep Doze; a hard real-time guarantee needs a native
  exact-alarm module the app lacks). **"bg not running" most-likely causes, ranked:** (1) the installed APK predates the Phase-41
  native modules (bg service never ran — NOT OTA-fixable); (2) the profile only applies at service (re)start
  (`tracker.ts:462-466`), so a member must **clock out + clock in** to pick up the Phase-63 profile; (3) OEM battery-kill; (4)
  permission ≠ "Allow all the time". **Confirm on-device via APK SHA-256 + the persistent "Recording…" notification + the DB
  session `point_count`/`last_point_at`.** · [m] JS-only but needs a native APK rebuild to reach field phones; the [api] >100m
  accuracy-drop relax is belt-and-braces (verify live). · M.
- **Phase 72 — [api]+[m]+OPS Team-targeted notifications (e.g. a new Sales task → notify the Sales team).** **Real push exists
  NOWHERE** — mobile has no `expo-notifications`/FCM (`package.json`, `app.json`: no `POST_NOTIFICATIONS`, no google-services),
  the backend has no `firebase-admin`/`expo-server-sdk` and **no device-token store**; today's notifications are an **in-app pull
  feed** seen only on app-open (`notifications.tsx`, `notify.tsx` → `/notifications*`). Tasks DO carry a **free-text
  `department`** (`../cgpe-backend-main/models/Task.js:31-34`; only `'payroll'` proven in code — taxonomy unnormalized), and
  task-create (`routes/tasks.js:223`) is the clean trigger point but **fires no notification today.** **TWO tiers (owner must
  choose):** **Tier A — in-app only, NO rebuild** (add `broadcastToDepartment` to `utils/notify.js`, call it from task-create →
  writes a bell row to each dept member; small [api], ~0 [m]; does NOT buzz a closed phone). **Tier B — real push** (Tier A +
  `expo-notifications` + `POST_NOTIFICATIONS` + push-token registration on mobile [native rebuild]; backend device-token store +
  `firebase-admin`/`expo-server-sdk` + a `sendPush` service; FCM google-services + EAS creds [OPS/infra]). **OPEN Qs: in-app or
  real push? which departments exist + exact labels (use `Profile.department` or the `TeamStructure` model)? which events trigger
  (only new tasks, or reminders/leads/reassignment)? include or exclude the assignee/creator? iOS too (separate APNs)? tap →
  deep-link to the task? does the admin panel create tasks via a route other than `POST /tasks`?** Biggest of the four. · Tier A
  S · Tier B L.
- **Phase 73 — [m]+native-rebuild Merge assigned tasks/reminders into the member's PHONE calendar + a one-click export.**
  **`expo-calendar` is NOT installed** (`package.json`, `app.json`: no module, no `WRITE_CALENDAR`) → needs `expo install
  expo-calendar` + the config plugin + permission + a **new APK** (native, not OTA — same pattern as expo-location). **No [api] —
  pure client:** employee X's own app already holds X's assigned tasks via `getTasks(ownOnly=true)` (`api.ts:446-457`, filters
  `/team/task-overview` to the caller) + `getReminders()` (`api.ts:1256-1265`); the merge is on-device, no server relay. **TWO
  asks, very different cost:** **(a) one-click bulk EXPORT** — simple, ship first: iterate the loaded tasks/reminders that have a
  valid date → find-or-create a dedicated "CGPE Connect" calendar → `createEventAsync` (title, due date, id in notes); a clean UI
  slot already exists (`Header right?` prop, `ui/base.tsx:113-114`, unused on `tasks.tsx`). **(b) AUTO-add-on-assign** — harder:
  a sync-on-fetch pass + **strict idempotency** (persist an `id → calendarEventId` map in AsyncStorage, else every refresh
  duplicates events). **Edge cases: undated tasks carry `dueDate:''` (Phase-53, Invalid-Date-safe) — SKIP or make all-day, NEVER
  coerce → now; timezone; permission-denied honesty (Banner, never silent success); delete/reschedule staleness.** New
  `common.*` i18n label needs **human copy** (no machine translation). **OPEN Qs: tasks-only or +reminders(+leads)? undated =
  skip or all-day? event shape (all-day vs a timed block; an alarm?)? ship (a) then (b)? dedicated calendar vs the user's
  default? lifecycle updates on complete/reassign?** · [m] + native rebuild, no [api] · export S · auto-sync M.


EAS build **`6b76608b`** (v1.10.0, commit `da9e5a9`, direct `.apk`
`https://expo.dev/artifacts/eas/K5bRx6VlgAUC2xxViT-NJHnnbuSMvNHqCGgrAeVN1WA.apk`, supersedes `8f3238fa`) and was **driven on the
owner's real Samsung A54 over USB/ADB as the Master account** — Monitor on-duty **1/3 (not 0)**, Live-location honest last-known,
payroll-detail, Esri satellite/points, team-perf 75/100, outage-banner honesty + recovery all GREEN. A parallel 13-agent code
audit found 16 issues; the **1 HIGH + 3 MEDIUM are FIXED**: **H1** (`dfa10f2`, home.tsx — clock-in/out `needsReason` → reason
`Sheet` → re-send; was a FALSE "server could not be reached" that permanently blocked an out-of-range/early clock-out),
**M1/M2/M3** (`95b0da2` — claims-403 classify / matured premium-due guard / stale on-duty pin). Gates green each. **⚠️ DO NOT
enable the Phase-50 office geofence until this APK is installed AND the H1 reason sheet is localized (owner's 5-lang copy) —
until the fence is configured H1 is latent and untestable end-to-end.** LOW/cosmetic list + full detail:
`docs/DEVICE-TEST-FINDINGS-2026-08-19.md`; DECISIONS 2026-08-19 (top two).

**🚨🚨 NEW OWNER ISSUE BATCH 2026-08-19 → Phases 63–69, all VERIFIED against real mobile + backend code** (5 parallel
investigators, file:line cited). Full grounded spec: `docs/spec/ISSUES-2026-08-19.md`. Owner priority: **background location
(63) is #1.** **🧭 OWNER DIRECTIVE: build ALL of 63–69 editor-side first, then cut ONE final APK + test together — no
per-phase APKs.** **Phase 63 `[m]` BUILT + reviewed (`9033e88`+`26d011d`); Phase 64 `[m]` BUILT + reviewed
(getBreakLocations 404/501 quiet-answer, `wf_f9a30b90` 0 findings, commit `3d5c4f8`); Phase 67 `[m]` BUILT + reviewed
(payroll-detail screen, `wf_0829f800` caught 1 real bug → fixed); Phase 66 `[m]` BUILT + reviewed (master Live-location
last-known readout, `wf_aae29582` caught 2 real honesty bugs → fixed by dropping the misleading map pin). Backend Phase 69
(the 5 `[api]` asks) VERIFIED code-correct (6 investigators). **Mobile-buildable batch work is DONE: 63/64/66/67 built +
reviewed; 65 (`[m]` full-staff roster) is the one un-built mobile piece; 68/69 OPS-only.**

**✅ DEPLOY GAP CLOSED (verified 2026-08-19, end of session).** The systemic blocker below is RESOLVED: `git fetch` shows
`origin/main` = `2531817` which **contains Phase 69 (`f0eac8e`)**, and live prod probes confirm it is DEPLOYED —
`/time-tracker/last-location` and `/team/task-report` now return **401** (route present) where they were **404** (absent)
earlier today; `/health` 200. So all of Phases 41–69 run on `:3001`. Asks 1/2/3 (shift accuracy, attendance coords,
/live-locations) now work with ZERO app change; the app-side Phases 63/64/66/67 need the ONE final APK to reach the device.
DECISIONS 2026-08-19 (top). **NEXT = cut the final APK.**

**⚠️ (HISTORICAL — now resolved) SYSTEMIC ROOT CAUSE found this batch — the prod backend was ~28 phases behind the code.**
Deployed `origin/main` was `1cad312` (Phase 38–40) all session; Phases 41–69 lived on `deploy-phases-41-69`/local `main`,
never merged to `origin/main`, so prod ran old code — the cause of the "0 on duty / server did not answer / straight-line
GPS" symptoms. The owner had the backend team merge to `origin/main` + deploy + restart `:3001` at session end (verified
above). Kept here as the reference example of "backend done ≠ live on prod — verify deployment."

- **Phase 63 — [m]+[api]+OPS Background location (owner #1, the "Pavitra" 20h/8km-straight case). `[m]` HALF BUILT
  + adversarially reviewed — 2026-08-19 (commits `9033e88` + `26d011d`, local; push 403s).** Three stacked causes:
  route records at `Balanced` (~100m) but backend **drops every shift point >100m** (`timeTracker.js:1671` × `tracker.ts:394`);
  `distanceInterval:30` means a **stationary phone records nothing** + a "still" reading stretches to **5-min** cadence
  (`motion.ts:52/65`); and the 8km straight line = **the background service wasn't running** (installed APK predates the
  Phase-41 native modules OR OEM battery-killed it — device/DB check needed).
  **`[m]` BUILT (motion.ts + tracker.ts):** SHIFT profile now `distanceInterval 0` (a point every ~60s **even when
  stationary**) + `accuracy High` (~10m, **survives** the >100m server drop); the STILL 5-min stretch is neutralised
  (STILL == MOVING, guard-locked). A 4-lens adversarial review (`wf_98aa7dfa`) then caught + fixed real regressions the
  first commit introduced: the 24/7 **off-duty** path had inherited the aggressive profile (continuous ~10m home
  recording — privacy + battery) → NEW coarser `AMBIENT_PROFILE` selected by shift `sid`; the **iOS** firehose
  (`distanceInterval 0` removes iOS's only throttle — `timeInterval` is Android-only) → iOS keeps a non-zero distance
  filter; the **untested `accuracyOf` crux** ('high'→`Accuracy.High`) → a tsc-completeness `Record` map; and the
  **offline buffer** shrank 5× at the new cadence → `MAX_POINTS 240→720` (~12h; SecureStore has no hard size limit on
  Android, verified). Gates: `tsc` 0 · `npm test` **606** (+2) · eslint 0 new. **⚠️ NOT a full fix on this commit
  alone (review, HIGH):** `High` is a *target* — indoor/poor-signal fixes can still report >100m and are still dropped
  until the **`[api]` relax** lands on deployed `origin/main`; and the profile only applies at service **(re)start**, so
  a device test must **clock out+in** (or reinstall) to pick it up. **Remaining:** `[api]` relax the >100m drop (filed,
  owner relays) + a **native APK build** (JS-only but the profile rides a build, not OTA) + OPS (confirm APK≥v1.9.0 /
  battery-unrestricted, query her DB session) + device/battery verification. Honest ceiling: ~15-min gaps after an OEM
  kill are unavoidable; a >12h continuous-offline shift still needs upload chunking (follow-up); iOS bg is Phase 56. · L.
- **Phase 64 — [api]+[m]+OPS Monitor "on duty 0 / live field status 0" + map "server did not answer". `[m]` BUILT +
  adversarially reviewed — 2026-08-19.** A restart alone will NOT fix the zeros: `routes/attendance.js
  dayLogToAttendanceRecords` (`:38-57`) **drops the clock-in coordinates** the map requires (`api.ts:2577`), so
  `getAgentLocations` returns `[]` for everyone even on a healthy server → 0/0. `[api]` ~5-line fix to surface `clockInLoc`
  lat/lng — **filed (INBOX #2, owner relays); mobile CANNOT fix the zeros.** The map banner is the deploy gap
  (break-locations 404). **`[m]` BUILT:** `getBreakLocations` (`api.ts`) now delegates its whole `!ok` branch to the single
  classifier `reportIfOutage` — a **404/501** (endpoint not on the deployed prod build — the deploy gap) is a **quiet empty
  answer**, no longer a false "server did not answer" banner; only a real 5xx/network fault banners. Replaces the drifted
  hard-coded `=== 403`-only guard (which let a 404 fall through). Gates: `tsc` 0 · `npm test` **609** (+3: 404/501 quiet
  lock, 5xx banner boundary, network-catch banner) · eslint 0 new. 4-lens adversarial review `wf_f9a30b90` → 0 findings. JS-
  only → ships in the final 63–69 APK. **Remaining: [api] coordinate fix + OPS deploy `origin/main` + `:3001` restart — both
  filed, owner relays.** The banner-clear (restart) will NOT fix the zeros; those need the coordinate fix. · S–M.
- **Phase 65 — [m] Every team member appears in agent-locations (not only after they "open the app"). ✅ BUILT + PUSHED
  2026-08-20 (commit `0c4fde1`, `aaziko/Shivam`).** The roster was built from **`team_tasks` assignees** (`team.js:128`), so
  anyone with no assigned task never appeared. Fixed: for a master, `getTeam`/`getAgentLocations` source the universe from the
  now-deployed super_admin-gated `/live-locations` (iterates EVERY profile) left-joined with the task-overview stats — a
  never-active member shows off-duty/zeroed instead of vanishing. **Join by NORMALIZED NAME** (the two endpoints use different
  id spaces: live→`profile._id`, task-overview→`user_id`; `/profiles/:id` accepts both so nav still works). Pure tested
  `src/data/roster.ts` (`mergeRoster`/`liveOnDutyPins`); `getLiveLocations` quiet-on-403/404; non-masters (403→[]) unchanged;
  NO screen change. `[api]` prereq VERIFIED DEPLOYED first (live probe 401 + Phase-69 ObjectId fix present). Gates `tsc` 0 ·
  `npm test` **690** (+21) · eslint 0 new. **Honest limits (spec):** map shows "who's out NOW" (drops clocked-out-earlier-today
  grey pins when anyone's on duty); `/live-locations` `.find({})` could surface a deactivated account → optional `[api]`
  `is_active` follow-up (not filed). JS-only → rides the batch APK; device-unverified. Spec: `docs/spec/PHASE-65.md`. · M.
- **Phase 66 — [api]+[m]+[sec] "Live location" button (master → member X's last-known location, on/off duty). `[m]` BUILT +
  adversarially reviewed — 2026-08-19.** No current-location endpoint exists; deliverable = **last-known** (real-time ping
  needs FCM the project doesn't have). `[api]` `GET /last-location?user_id=X` — **VERIFIED in real code (Backend Phase 69),
  NOT yet on deployed `origin/main`.** `[sec]` `/live-locations` gate — also in Backend Phase 69 (super_admin gate + ObjectId
  fix), verified. **`[m]` BUILT:** `getLastLocation(userId)` (three-outcome `ok`/`none`/`error`, mirrors `getTaskReport`;
  403/404/501 quiet, 5xx banners; `mapLastLocation` rejects non-finite **and the (0,0) no-fix sentinel** → never a fabricated
  pin) + a master-only "Live location" card on `team/[id]` (gated `canSeeLiveLocation` = real super_admin) → a Sheet with an
  HONEST last-known readout: freshness (`timeAgo`), real duty state, accuracy, copyable coordinates. A 4-lens review
  (`wf_aae29582`) caught 2 real honesty bugs from an initial `LeafletMap` single-pin embed — a green "Clocked in at …" pin for
  an OFF-duty member (LeafletMap ignores `onDuty`), and a (0,0) point surfaced as `ok` while the map dropped it — **both fixed
  by dropping the misleading map pin** for the readout (a neutral single-pin `LeafletMap` mode is a scoped follow-up; the map
  is a danger zone agent-map depends on). Gates: `tsc` 0 · `npm test` **625** (+13) · eslint 0. JS-only → final APK.
  **Remaining: `[api]` deploy (relayed); device pass; optional neutral-pin in-app map.** Ceiling: off-duty works only for
  consented members with bg-permission; a real-time ping is a separate FCM build. · M.
- **Phase 67 — OPS+[m]+[api] Payroll: show ALL employees + tap one → pay breakdown + activity. `[m]` BUILT + adversarially
  reviewed — 2026-08-19.** Only 1 shows because `buildRoster` iterates **`payroll_profiles`** (`payroll.js:325`) and only ONE
  exists — **OPS: create each employee's payroll profile + set its `segment`** (the mobile list is already multi-member,
  no code fix). `[api]` `hourly_rate` (+ `days/sundays/holidays`) added to `computeRangeSalary months[]` — **VERIFIED in real
  code (Backend Phase 69), NOT yet on deployed `origin/main`.** **`[m]` BUILT:** NEW `src/app/payroll-detail.tsx` — tap a
  roster row → per-member **pay breakdown** (segment, hourly/per-day rate, office+worked hours, the server's working-days
  derivation, payable — rendered verbatim, the app never multiplies/recomputes; only `absent = working − present` days) +
  a master-only **completed-tasks activity** list (via the proven `getTaskReport({scope:'all'})` + client-side member pick,
  gated `canSeeTeamPerformance`); `PayrollMonth` type gained the additive fields (defensive, absent pre-deploy). Double-gated
  like `payroll.tsx` (admin for pay, super_admin for activity; a leader deep-link gets an honest refusal). A 4-lens review
  (`wf_0829f800`) caught a real bug — a FAILED task-report (5xx/timeout/**the silent deploy-gap 404**) rendered as a confident
  "No completed tasks" (empty≠could-not-load) — **fixed** with a distinct `ActivityState` error branch (mirrors
  `performance.tsx`). Gates: `tsc` 0 · `npm test` **612** (+3) · eslint 0. JS-only → final APK. **Remaining: OPS create the
  payroll profiles + `[api]` deploy (both relayed); device pass.** · M.
- **Phase 68 — OPS Team performance "report service could not be reached".** App + backend code both correct; the endpoint
  (`/team/task-report`, Phase 53 `bfea1f5`) isn't on deployed `origin/main`. **OPS deploy + restart** (see systemic note),
  then verify `GET …/team/task-report?month=2026-08&scope=all` → 200. No code change. · trivial-once-deployed.
- **Phase 69 — OPS "I'll handle this" ticket STILL doesn't become a task (owner re-report 2026-08-19).** VERIFIED (hard git
  evidence): the mirror `syncTicketTaskMirror` (commit `cb3f9de`) is **local-only, unpushed, absent from `origin/main`** —
  so prod has no mirror code. Mobile is already correct + tested (`0b64be8`); **OPS: push + deploy + restart** and it works
  with zero app change. The clearest proof of the deploy gap. · trivial-once-deployed.

**⚡⚡ v1.10.0 APK CUT (2026-08-18) — EAS build `0c648a0c`, FINISHED.** Bundles Phase 51 (map satellite/points toggles +
green/red pins) + Phase 52 (Break feature + orange break pins) on the same native base as v1.9.0 (all JS-only on top).
Direct APK: `https://expo.dev/artifacts/eas/ls-3QFiTrj-GuDt-6ot-Q7dQOuYkDcMLlt2InWDuf0s.apk`. Owner has the device-test
checklist: `docs/spec/PHASE-51-52-DEVICE-CHECK.md`. **Orange break pins (§C) need the backend `:3001` restart on Backend
Phase 66 to show.** `git push` still 403s — every commit local.

**⚡⚡ NEW OWNER ISSUE BATCH 2026-08-18 → Phases 53–58, all VERIFIED against real code** (workflow `wf_d89dc600-86e`,
6 parallel investigators, file:line cited). Full grounded spec: `docs/spec/ISSUES-2026-08-18.md`. Owner priorities:
**tasks (#1)** + **iOS (mandatory)**. NONE built yet — this session scoped them; next session executes.
- **Phase 53 — [m]+[api] Task mismatch (owner #1). 53b (mobile) BUILT `46b061e`; 53a (backend) FILED.** (a) claiming a
  ticket writes only the tickets doc, never mirrors into `team_tasks`, so it never shows in the task list → **[api]** mirror
  ticket-assign into `team_tasks` (`routes/tickets.js` PUT, pattern `routes/tasks.js:225-258`) — **filed to `cgpe-api`
  (INBOX), owner relays; mobile can't build this half.** (b) reopen re-buckets undated tasks by touch-time + the "today"
  denominator counted done tasks → **[m] BUILT:** `adaptTeamTask` now keeps an undated `dueDate` **`''`** (not `updated_at`;
  Invalid-Date-safe → `dueBucket` sorts 'upcoming', renders '-'); the "today" count is ONE shared unit-tested helper
  `todayProgress` (due-today ∪ completed-today) that **both** Home and Tasks call so they can't drift and a reopen shifts
  only the numerator; optimistic complete/reopen stamps/clears `completedAt` (with rollback); `completedAt`/`createdAt` read
  both snake+camel casings; animated numerator clamped to the total so a reopen never flashes "2 / 1". Gates: `tsc` 0 ·
  `npm test` **603** (+12) · eslint 0 new. Adversarially reviewed (`wf_5f13f693-c88`). **Undated tasks now live under
  Upcoming (honest — no due date), a deliberate behavior change.** Remaining: device visual pass + 53a ships. Spec:
  `docs/spec/ISSUES-2026-08-18.md` §53; DECISIONS 2026-08-18 (top).
- **Phase 54 — [api] Lead "could not be opened" (403).** `GET /leads/:id` strict self-check (`leads.js:266`) 403s the
  teammate/firm leads the LIST returns for a leader/member — the leader-tier trap. Fix: detail uses the same
  `visibilityScope/canSee` as the list (`utils/scope.js`), + parity on `PUT /:id:455`. **Mobile zero-change** (Lead has
  no `advisor_id`). Scope backend · S · quick. (Also corrects a stale `api.ts:908` comment.)
- **Phase 55 — [m] Network resilience** (the "doesn't work on my WiFi/phone" complaint). **✅ BUILT + PUSHED 2026-08-20
  (commit `941c583`, `aaziko/Shivam`).** The 4.5 s timeout is gone (reads 12 s / login 15 s / upload 30 s, owner-locked
  "Balanced"); idempotent reads retry once (600 ms backoff, throw/5xx/429 — 501 excluded as the "not-deployed" quiet
  answer; writes/uploads never retry); `FailureKind` (timeout/network/server) threaded into `data/health` → kind-aware
  banner; `uploadFile` AbortController; NEW `testConnection()` + Settings "Test connection" verdict. Pure seam
  `src/lib/netResilience.ts`. `tsc` 0 · `npm test` **714** (+24) · eslint 0 new. Spec `docs/spec/PHASE-55.md`. **Remaining:**
  device pass on a slow/flaky handset; 5-lang copy for the new strings; DNS/captive-portal/firewall stay network-side
  (test `/health` in the phone browser). Original triage retained below. `req()` had a **4.5 s** hard
  timeout (`config.ts:65`), **zero retry**, no error-kind, no self-test; `login()` used the same 4.5 s so a slow net
  couldn't sign in; `uploadFile` had no AbortController. Scope mobile · M.
- **Phase 56 — [m] iOS enablement (owner priority).** App IS buildable (plist via config plugins, `bundleIdentifier`
  set) but **never built for iOS**; missing = `eas.json` ios profile + an **Apple Developer account ($99/yr, hard
  prereq)**. Honest 24/7: iOS is first-class for login/data/map/Face ID + on-duty background route while the app runs,
  but **cannot** match Android always-on after force-quit/reboot (no foreground service; BGTaskScheduler opportunistic).
  Scope mobile (gated on Apple account) · L.
- **Phase 57 — [m] Offline support** (read cache + safe write-queue). Built from zero (real-backend-only today). (a)
  AsyncStorage read cache, versioned/per-user, "Last synced <time>" label (3 states: live/stale/empty); (b) additive-
  draft write queue; (c) clock-in/WhatsApp/monitoring/search/login stay online-only. Scope mobile · XL · design-first.
- **Phase 58 — createdAt/updatedAt "" — premise NOT reproduced.** The app stamps real ISO locally + omits timestamps
  on POST (server stamps); the only `''` are read-path sub-field fallbacks in `adapt.ts`. Needs the owner to name one
  concrete screen+record; likely a display placeholder or a non-app writer (import/n8n/panel), NOT a create-path fix.

**⚡ LATEST (owner, 2026-08-17, end of session):** owner re-prioritised again — **the app-closed (background) location
bug is now #1**. Diagnosed as the Phase-41 native-build gap (installed APK predated the modules); cut a fresh **v1.9.0**
EAS APK (build `86c1406c`) + device checklist → **owner is testing it on a handset.** Also captured **6 new feature
requests** (satellite toggle, red/green on/off-duty, app-installed view, map points + in/out-path toggles) — triaged in
[[owner-backlog-2026-08-17-map-and-app-presence]] and `## Next 3`. Phase 50's mobile data-layer is now BUILT (below);
its home reason-prompt UI + 5-lang copy remain.

**⚡ PHASE 51 BUILT (2026-08-18) — map satellite-view toggle + show/hide-points toggle + event-typed pin colours.**
Pure-mobile, no contract change, commit `8eb4858` (local — push 403s). `src/ui/LeafletMap.tsx` gains a **hybrid satellite**
base (Esri World Imagery + Esri label overlay, no API key) togglable against the CartoDB street tiles, a **show/hide
points** toggle (hides the marker layer; route line + arrows stay), and a 3-button top-right control stack; `agent-map.tsx`
**pin colours** are now event-typed (clock-in **green** `c.success`, clock-out **red** `c.danger`), legend updated.
Satellite/points state lives in the outer `LeafletMap` so it survives a theme flip; re-asserted on the ready handshake.
Honest ceiling: Apple/Google tiles need paid SDK/keys — Esri is the best key-free source ("Imagery © Esri" credit in
satellite mode). Gates: `tsc` 0 · `npm test` **576** · eslint 0 errors on touched files. **JS-only → rides the next
build/OTA, no separate APK** (deliberately not cutting one mid-v1.9.0 background-location device test). Spec:
`docs/spec/PHASE-51.md`. **⚡ PHASE 52 BUILT (2026-08-18) — Break button + 8h30m gate + optional-reason sheet + 5-lang copy.** Owner supplied
the break copy same day, so the whole client flow shipped: `8da2fb8` (data layer `api.startBreak`/`stopBreak` +
`api-break.test.ts` +11 → 587; 9 `break.*` keys in all 5 langs, parity 94→103) + `b1cea19` (`home.tsx`: after clock-in the
hero shows **Break + Clock out** — **End break** while on break, from `getClockState().isOnBreak`; Break at ≥8h30m worked
shows a `useConfirm` gate first, under it goes straight to an optional-reason `Sheet`; clocking out while on break ends the
break FIRST so its duration+location are recorded, else `DayLog.clockOut` discards it). Honest write path throughout.
Gates: `tsc` 0 · `npm test` **587** · eslint 0 errors on touched files. JS-only → next build/OTA. **UPDATE — cgpe-api
shipped Backend Phase 66 (`6ef26f0`), VERIFIED field-for-field → both backend pieces DONE and CONSUMED (`53ba448`):**
(B1) `reason` now **stored** (`breakSchema.reason`, no mobile change — `startBreak` already sent it); (B2) **orange break
pins** wired — NEW `getBreakLocations()` (403-for-others = quiet empty, never fabricates) → `LeafletMap` draws break
points **ORANGE** (`c.warning`), `agent-map` legend now green/orange/red. `npm test` **591** (+4 break-location tests).
**Phase 52 now COMPLETE — only OPS (`:3001` restart on the Phase-66 build) + a device visual pass remain.** Spec:
`docs/spec/PHASE-52.md`.

**PRIORITY (owner, 2026-08-17):** **Phase 50 (dual-office geofence + out-of-range / early-clock-out reason →
super-admin) is #1.** **cgpe-api SHIPPED it (Backend Phase 64, 2026-08-17) — VERIFIED against their real code** (all 6
owner points; both mobile recommendations taken). **Mobile data-layer BUILT + tested** (commit `6b2da6f`): `getGeofence`
consumes the additive `offices[]`; `checkGeofence` now measures the **NEAREST** office (fixes a real office-B pre-check
lockout — the old single-pin check refused someone standing at office B, which the server allows); `clockIn`/`clockOut`
thread an optional `reason` + map the new `REASON_REQUIRED` (400) to a distinct `needsReason`/`outOfRange`/`early`
outcome, kept apart from the 403 `blocked`. Gates green (`tsc` 0 · `npm test` **576** (+19, NEW `api-clock.test.ts`) ·
eslint 0 errors). **REMAINING (2 gates, neither blocking the sibling sessions):** (1) the `home.tsx` **reason-prompt UI**
+ its **5-language HUMAN copy** (machine translation forbidden — owner to supply, like the consent copy) + a device
check; (2) **owner/ops for go-live:** set the two office pins via `PUT /geofence` `offices[]`, set
`N8N_ATTENDANCE_WEBHOOK_URL`, `:3001` restart. Detail: Phase 50 entry below + `docs/spec/PHASE-50.md`.
**Phase 62** is BUILT + go-live-verified and sits **PENDING its on-device visual pass** — walk
`docs/spec/PHASE-62-DEVICE-CHECK.md` on a real advisor handset; **do NOT mark it passed until the owner personally
confirms "testing pass hai".** **Phase 41 on-device verification stays LAST / least-priority** (owner: "pending, do it
last") — editor-complete, needs only a handset, blocks nothing; walk `docs/spec/PHASE-41-DEVICE-CHECKLIST.md` (or the
plain-language guide) whenever the phones are available.

**Phase 62 — [m] Commissions screen consumes `/my-summary` `target` (MDRT tier) + `byProduct`. BUILT — owner #1, 2026-08-17.**
`cgpe-api` shipped **Backend Phase 62** (2026-08-17): `GET /api/commissions/my-summary` now additive-returns **`target`**
(the advisor's next-MDRT-tier premium `{current,next,next_premium,to_next,achieved_premium,basis}` or `null`) and
**`byProduct`** (`[{product,amount,count}]`, this-year earned, `Σ amount === ytd`). Owner flagged mobile **#1**.
**Verified against real code first** (rule 5, tags wrong 5×): `routes/commissions.js` `/my-summary` (target `:338-345`,
byProduct `:322-330`), `utils/fyc.js`, `utils/mdrtTiers.js`, and `api.md` `/my-summary` row + CHANGELOG 2026-08-17 — all
match. **Built (4 files):** `types.ts` — `Commission.target` is now `CommissionTarget|null` (was scalar `0`) + new
`CommissionProduct`/`Commission.byProduct`; `api.ts` `getCommissionSummary` maps both defensively (odd/absent `target`→
`null`, absent `byProduct`→`[]`; dropped the stale `target:0`); `commissions.tsx` drives the **MDRT tier card off the
summary's `target`** and **drops the second `getMdrtTier`/`/advisor/performance` call** (shared FYC basis → one call),
keeps the advisor/`learn_advisor` gate (a non-advisor with FYC=0 never sees a meaningless "₹0 · 0% to Quarter MDRT"),
removes the always-blank scalar "Monthly target" meter, and adds a **"This year by product"** section (each bar = the
row's share of `ytd`; the app renders, never re-sums — rule 2); `MdrtTierProgress`→pure `MdrtTierCard(tier)`.
`getMdrtTier` stays exported + tested (a legitimate `/advisor/performance` reader), just no longer called here. **No
contract change** (pure consumer). Gates: `tsc` 0 · `npm test` **557** (+5 in `api-commissions.test.ts`) · eslint 0 errors
(2 pre-existing `api.ts` warnings). Commit `fc92573` (local — push 403s). INBOX Phase-62 item replied (box left for
`cgpe-admin`, multi-recipient). Also **Phase 61** (QA-sweep 500→4xx + 1000/page cap) verified **mobile-unaffected**
(status-branching already honest; all lists ≤500/page) — no `src/` change. **GO-LIVE VERIFIED 2026-08-17:**
owner confirmed `cgpe-api` is now running on `:3001`; the contract was re-verified **field-for-field against the
live backend's real code on both sides** (`routes/commissions.js` `/my-summary` `:319-352` + `utils/mdrtTiers.js`
vs mobile `api.ts:1342-1364` + `types.ts:140-163` + `commissions.tsx`) — `target`/`byProduct` shapes match,
`next_premium` preserved `null` at TOT, product bars render `amount/ytd` (no re-sum), second `/advisor/performance`
call gone; gates re-run green (`tsc` 0 · `npm test` **557/557** · `fc92573` intact). **Only remaining = the
on-device visual pass** (native, no advisor token in editor): a real advisor sees the tier card + per-product
bars and `Σ byProduct === ytd`; a non-advisor sees neither. A device miss would be an account/role issue, not a
client bug (see DECISIONS 2026-08-17, top).

**Owner bug fix — matured policies read "Matured", not "In force" (+ no false premium-due). BUILT & SHIPPED in an APK — 2026-08-15.**
Owner sent a Client 360 screenshot: a policy with maturity **Mar 2023** still read "In force". Root cause: `adaptClient`
(`src/data/adapt.ts`) hard-coded `status:'in_force'` on EVERY policy. Fixed: status is now **derived from the maturity
date** — past ⇒ `'matured'` (an existing contract status/label), else `'in_force'`; `lapsed`/`paid_up` untouched (no data
to infer). Owner-confirmed via AskUserQuestion; also **hid the "Premium due / X days late" indicator on matured policies**
(KPI + "Next premium" row) so the screen isn't self-contradictory (an in-force overdue policy still shows its reminder).
Gates green: `tsc` 0 · `npm test` **553** (+4) · eslint 0. Commits `390f7ab` + `588a90d` (local — push 403s). **No
contract change** (pure client-side inference). Caveat: a missing/garbage maturity date stays "In force" — a DATA issue,
not code. Details: DECISIONS 2026-08-15 (top).

**Installable APK cut (EAS build works from here despite the push-403) + web E2E 33/33 green — 2026-08-15.**
Handed the owner an installable preview APK **twice** via `npx eas-cli build -p android --profile preview --non-interactive`
(logged in as `shivam-bhadoriya`, keystore on the Expo server; direct `.apk` URL from `eas build:view <id> --json` →
`.artifacts.applicationArchiveUrl`). Latest = build `7cdc351d` (v1.8.0) with the matured-policy fix. Ran the watchable
web E2E suite (`00/01/10/30/40`) — **33/33 passed (5.8 m)**: all 42 screens render, worst-case backend states keep the
HealthBanner honest, forms survive hostile input (73 screenshots + video under `e2e/artifacts/`). The `50-languages`
matrix (~15 m) was offered, not run. **WiFi "network error" diagnosed as ENVIRONMENTAL** (backend proven 200/~40 ms,
IPv4-only; NO mobile-data requirement in `src/`) — awaiting the owner's on-phone `health`-URL test before any app-side
change. Details: DECISIONS 2026-08-15.

**Phase 50 — [api]+[m] Dual-office geofence + out-of-range / early-clock-out REASON capture → super-admin. Owner CONFIRMED §6 → cgpe-api SHIPPED (Backend Phase 64) → VERIFIED → mobile data-layer BUILT; home UI + 5-lang copy + device remain — 2026-08-17.**
**UPDATE 2026-08-17:** owner confirmed all §6 (nearest-office auto, reason MANDATORY, 15-min early buffer, immediate mark,
n8n→super_admin-only). `cgpe-api` shipped **Backend Phase 64**, VERIFIED field-for-field against their real
`utils/geofence.js` (`getOfficeGeofences`/`getMemberOffices`/`checkNearestGeofence`) + `routes/timeTracker.js`
(clock-in/out `REASON_REQUIRED`, `EARLY_CLOCKOUT_GRACE_MIN=15`, `alertMastersClockFlag` n8n+in-app super_admin-only with
coordinates asserted-absent, `GET /geofence` additive `offices[]`) — all 6 points match. **Mobile data-layer BUILT +
tested** (commit `6b2da6f`, local — push 403s, no contract change): `getGeofence` reads `offices[]`; `checkGeofence`
measures the NEAREST office (fixes the office-B pre-check lockout); `clockIn`/`clockOut` thread `reason` + map
`REASON_REQUIRED`→`needsReason`. `tsc` 0 · `npm test` **576** (NEW `api-clock.test.ts` + nearest-of-two cases) · eslint 0
errors. **Remaining:** (1) `home.tsx` reason-prompt UI + 5-language HUMAN copy + device check; (2) owner/ops — set the two
office pins via `PUT /geofence` `offices[]`, set `N8N_ATTENDANCE_WEBHOOK_URL`, `:3001` restart. Original filing below.

**Phase 50 (original filing) — SPEC + `[api]` FILED, no build — 2026-08-15.**
New owner request (post-backlog): a member may clock in/out from **either of two Surat offices** (Adajan / Katargam), 200 m
each; an **out-of-range** clock-in OR clock-out is **allowed but must carry a reason** → **super_admin notified**; an
**early** clock-out (before shift end) must **also** carry a reason → super_admin. **Verified real code (both trees, not
tags):** today the backend **REFUSES** out-of-range clock-in (`timeTracker.js:259` → `403`), knows only **one** office
(`utils/geofence.js`), stores **no reason**, and raises **no** such alert — so this **reverses the refuse model** and is
**backend-first** (the server 403s before a reason could be captured; mobile can't do it alone, same posture as Phase 43).
Office pins go in the **panel/DB**, never client literals (Phase 7 removed exactly that). **"early" has a grounded meaning:
before `shiftEnd`, already in `timeTracker.js:133`.** Wrote `docs/spec/PHASE-50.md` and filed a top-of-queue
`→ cgpe-api · from cgpe-mobile` INBOX ask (grepped back durable) recommending a **list of ≥2 org offices** + `in_range` =
within radius of ANY + accept a `reason` on clock-in/out + a new `metadata.kind` super-admin notify (reusing Phase-43's
per-master pattern), with **5 open points FLAGGED as the owner's calls** (the two office coordinates → panel; "early" =
before shiftEnd?; two-offices-replace-vs-add per-member pins; reason mandatory?; combined-vs-separate prompt). **No `src/`
change → no gate re-run** (baseline `tsc` 0 / `npm test` 552 / eslint 0). **Live only when cgpe-api ships it + the pins are
set + the owner confirms the 5 points** — then mobile threads `reason` + builds the prompt UI (needs 5-language human copy)
+ a device check. Full path: `docs/spec/PHASE-50.md`; DECISIONS 2026-08-15 (top).

**Phase 41d — [m][sec] anti-circumvention (§5). ALL 4 parts BUILT/FILED in the editor — app-block SCREEN now wired (owner copy landed) — 2026-08-15.**
**UPDATE 2026-08-15 (app-block SCREEN BUILT):** the last editor-buildable 41d piece is done. The owner's 5-language copy
landed (`translation-v.01.txt` → `consent.blockedTitle`/`blockedBody`/`blockedAction`, already in the dictionary; the
simpler `consent.blocked*` set supersedes the spec's earlier `block.*` proposal), and the trigger was already LOCKED
(any-of-3-off = non-null `locationBlockReason`). Built `tracker.evaluateLocationBlock()` (fail-open) +
`openLocationSettings(reason)` + NEW `src/ui/LocationBlock.tsx` (full-screen overlay modeled on `AppLock`, re-checks on
foreground, swallows Android back, `zIndex 55` below AppLock, native + signed-in only), mounted before `<AppLock/>`.
Composition with the withdrawal signal is **spec-literal** (owner-chosen, AskUserQuestion 2026-08-15): permission-revoke
keeps routing through withdrawal (master alert + disarm) + the `/consent` wall on next open, so the block settles on
device-Location-OFF. Gates: `tsc` 0 · `npm test` **552/552** (unchanged — device-only + presentational) · eslint 0 errors
(2 pre-existing `_layout` warnings). No contract/dep/i18n-key change. Commit `dd6a4c3` (local — push 403s).
**DEVICE-UNVERIFIED** (rolls into the aggregate Phase-41 native build). **Remaining in 41d: cgpe-api's gap-detector +
on-device verification.** Details: DECISIONS 2026-08-15 (top); `docs/spec/PHASE-41.md` §8 (41d). Original 41d filing below.

**Phase 41d (original filing) — [m][sec] anti-circumvention (§5). 3 of 4 parts BUILT/FILED; only the app-block SCREEN awaited owner copy — 2026-08-15.**
The last Phase-41 sub-phase (§5). Owner approved pursuing all remaining parts (AskUserQuestion 2026-08-15). Verified
feasibility against real code (not tags): `expo-location.LocationObject.mocked` exists (SDK 57), `setLocationConsent`
exists, Phase-43 withdrawal-notify is live (`timeTracker.js:1425`), cgpe-backend has **no** gap-detector. Delivered:
**✅ mock-location rejection** — pure `dropMocked` in NEW `src/lib/antiCircumvention.ts`, wired into `tracker.ts` `ingest`
so a fake-GPS `mocked:true` fix never enters the record (chose **drop** over **label** — self-enforcing: dropped points
show as a GAP to the backend detector). Commit `08dd00f`. **✅ consent-withdrawal auto-signal** — NEW
`syncConsentWithPermission()` + native-only `PermissionMonitor` (mounted beside `ConsentGate` in `_layout.tsx`): a
consented 24/7 user who revokes OS background location → `setLocationConsent(false)` (Phase 43 notifies every master, a
loud opt-out) + `stopAmbientTracking`; **fail-safe** (`armed`-gated, skips a failed permission read so it never spam-alerts
masters on uncertainty, fires once per revocation). Commit `5fe05bc`. **✅ gap-detector `[api]` FILED** to cgpe-api
(grounded in its real `locationRetention` scheduler + master-notify patterns; recommends a periodic
`kind:'location_gap'` master alert with the **threshold + expected-window flagged as the owner's numbers to set** —
Phase-45 pattern; grepped back durable). **🔨 app-block — BRAIN built** (pure `locationBlockReason`, tested) **but the
SCREEN awaits owner 5-language copy** (machine translation forbidden) + a trigger confirmation; wiring it behind
`PermissionMonitor` is then a small follow-up. Pure §5 logic pinned in `antiCircumvention.test.ts` (+12 total). Gates:
`tsc` 0 · `npm test` **552/552** · eslint 0 errors (2 pre-existing `_layout` warnings). 41d added **no dep/permission/
contract change**. **DEVICE-UNVERIFIED** (fake-GPS drop; revoke-permission→master-alert). **Remaining in 41d: (1) the
owner's app-block copy → wire the screen; (2) cgpe-api ships the gap-detector.** Full path: `docs/spec/PHASE-41.md` §8
(41d); DECISIONS 2026-08-15 (top two).

**Phase 41c — [m] motion-adaptive GPS sampling (expo-sensors classifier). BUILT IN EDITOR, DEVICE-UNVERIFIED — 2026-08-15.**
The next Phase-41 sub-phase after 41b (§3/§4): "sparse when still, denser when moving." **Owner chose the activity
SOURCE via AskUserQuestion (2026-08-15): `expo-sensors` Accelerometer classifier now** (over a pure-seam-only build
and over the native Google-AR module — accepting it's coarser + device-unverifiable). **Read the SDK-57 accelerometer
docs first (AGENTS.md):** `{x,y,z}` in g, so the **rotation-invariant magnitude std-dev** is a clean still/moving
signal and the plain Accelerometer needs **no permission** (`ACTIVITY_RECOGNITION` deliberately NOT added — it's only
for the step-counter / Google-AR path, so no permission-creep). Built: (a) `expo-sensors` 57.0.2 (no plugin/permission
change). (b) NEW pure `src/lib/motion.ts` + `motion.test.ts` (+16): `classifyMotion`, `samplingProfile` (**MOVING** =
today's Balanced/60s/30m cadence unchanged; **STILL** lengthens only the time intervals to 5 min), `debounceMotion`
(anti-churn hysteresis), `resolveMotion` (**a stale `still` fails safe to `moving`** so an old reading never
under-samples + drops a route). (c) `tracker.ts` — the classifier runs alongside the recorder, started/stopped at the
SAME `startService`/`stopUpdates` chokepoints as the 41b watchdog; persists only confirmed transitions to
`track.motion`; `startService` reads it to choose the profile. **SCOPE (honest):** profile applied at each service
(re)start, **NOT mid-session** (would fight 41b + flicker the notification); accelerometer **pauses in background**, so
`still` rarely fires for a pocketed phone — true background adaptivity needs the native AR source (§4 option 3). **Per
§12.8 this is the lever to MEASURE on-device before investing more.** **NUMBERS = PROPOSED DEFAULTS pending owner lock**
(spec fixes none): STILL 5 min, threshold 0.05 g — each one named constant. Gates green: `tsc` 0 · `npm test`
**540/540** (+16) · eslint 0 on touched files. Commit `25d3d5b` (local — push 403s). **No contract change.** **Needs a
native APK build** (new module, NOT OTA). **DEVICE-UNVERIFIED:** the §3 battery measurement over a real day on 3+
handsets is the acceptance gate + decides whether to escalate. Full path: `docs/spec/PHASE-41.md` §8 (41c); DECISIONS
2026-08-15 (top). Next Phase-41 sub-phase: 41d (anti-circumvention) — not started.

**Phase 41b — [m] reliability watchdog (re-arm after OEM kill + reboot). BUILT IN EDITOR, DEVICE-UNVERIFIED — 2026-08-15.**
The next Phase-41 sub-phase after 41a (§8). Keeps the 24/7 recorder alive against the two things the foreground
service alone can't survive: an aggressive-OEM Doze kill (§2.4) and a reboot (expo-location's task doesn't survive
one, §2.3). **Read the SDK-57 `expo-background-task` docs first (AGENTS.md):** a registered periodic task is
**restored by WorkManager after a reboot**, so **ONE watchdog covers BOTH cases — no hand-written native
`BootReceiver`** (deviation from §2.3's literal recommendation, owner may veto; re-arm lands within ~15 min of boot,
not seconds — DECISIONS 2026-08-15). Built: (a) `expo-background-task` 57.0.10 (WorkManager on Android), its config
plugin auto-added to `app.json`; `RECEIVE_BOOT_COMPLETED` added. (b) `tracker.ts` — `WATCHDOG_TASK` at module scope +
`watchdogTick` (headless, storage-driven: re-arm / idle / retire), `ensureWatchdog`/`retireWatchdog` **paired to the
`startService`/`stopUpdates` chokepoints** so the watchdog's lifetime tracks the recorder's (retire when nothing to
record → stops waking the device, §3 battery). (c) NEW pure `src/lib/watchdog.ts` + `watchdog.test.ts` (+11) pinning
the one safety invariant — **re-arm iff a live shift OR 24/7 armed** (never resurrect un-consented off-shift
recording; never miss a silent kill) — because `tracker.ts` is device-only (no expo-location/task-manager stub). Gates
green: `tsc` 0 · `npm test` **524/524** (+11) · eslint 0 on touched files. Commit `71d15a3` (local — push 403s). **No
contract change** (pure mobile reliability layer over the shipped Phase 43 backend). **Needs a native APK build** (new
module + permission, NOT OTA — compounds with the expo-intent-launcher build already due from 41a part 2).
**DEVICE-UNVERIFIED acceptance gate (on a handset):** OEM task-kill → watchdog re-arms within ~one interval; reboot →
restored + re-arms; off-shift+un-armed → retire stops the wakeups; and the extra periodic task's battery cost stays in
the §3 budget (measured over a real day on 3+ handsets). Full path: `docs/spec/PHASE-41.md` §8 (41b); DECISIONS
2026-08-15 (top). Next Phase-41 sub-phases: 41c (battery + activity), 41d (anti-circumvention) — not started.

**Phase 48 UPDATE — cgpe-api SHIPPED (Backend Phase 58) → VERIFIED against real code → mobile restore flow BUILT + tested — 2026-08-15.**
`cgpe-api` shipped the filed ask as **Backend Phase 58**: PUBLIC `POST /api/auth/refresh-biometric` + a 30-day
device-bound `refresh_token` allow-list (`models/RefreshToken`) issued at login/verify-otp + revoke-on-logout.
**Verified against their real `routes/auth.js` + `models/RefreshToken.js` line by line (not the summary):** public
(no `protect`), `jwt.verify` WITHOUT `ignoreExpiration` (>30d refused at the JWT layer), **`typ:'refresh'` refuses a
replayed access token** (`:1388`), allow-list must exist + un-revoked + not-past-expiry, **rotate-on-use** (`:1424`),
**reuse of a revoked token revokes the whole chain** (`:1401`), flat `401 INVALID_REFRESH` / `400` missing / `503`
DB-down, token never logged, 30d TTL index. cgpe-api chose the refresh-token model (not the weaker sliding-session)
precisely for the server-side revocation D-2 needs. **Mobile BUILT (5 files, no contract change, no native dep):**
(a) `lib/biometricIdentity.ts` now seals the **30-day refresh token** not the 24h access token (`RECORD_VERSION` 1→2
orphans v1 records fail-closed; all install-scope/reinstall hardening untouched); (b) `data/api.ts` NEW
`refreshBiometricSession()` (three-outcome `ok`/`declined`/`error` over public `req()`, requires a rotated
credential on 200 else `error`, 400/401→declined with NO expiry cascade since no bearer is sent) + `serverLogout()` +
`login`/`verifyOtp` thread `refresh_token` additively; (c) `store/auth.tsx` re-seals the refresh token on every auth,
NEW `restoreBiometricSession()`/`canBiometricRestore()`, `logout()` revokes server-side before `clear()`, silent
expiry still keeps the binding (D-2); (d) `app/(auth)/login.tsx` a gated "Unlock with fingerprint" affordance →
restore → home / honest fallback; (e) NEW `api-refresh-biometric.test.ts` (18). Gates green: `tsc` 0 · `npm test`
**513/513** (+18) · eslint 0 errors (3 pre-existing warnings, none new). Commit local (push 403s). **No contract
change** (pure consumer of Phase 58). **DEVICE + SECURITY REVIEW CARRIED** (native-only + needs cgpe-api's `:3001`
restart): restore after a real >24h expiry; explicit logout blocks restore (binding gone AND server refresh revoked);
>30d refused; cross-device rejection; enrolment-change fail-closed; + the [sec] review against the running server.
JS-only, so it stays OTA-eligible for Phase 49. Full path: `docs/spec/PHASE-48.md` §6; DECISIONS 2026-08-15 (top).

**Phase 48 — [sec][m]+[api] Biometric-only session restore after logout. VERIFIED gap → owner-locked model → FILED to cgpe-api; no mobile build yet — 2026-08-15.**
The next editor-actionable owner-backlog item (PLAN §Phase 48, Group H "do last"). Scenario: return 2 days later
logged-out → back into your OWN account with fingerprint/face only, no id/OTP. **First step was verification + owner
lock, NOT code** ([sec], rule 5). **Verified both trees (tags wrong 5×):** mobile's sealed `(userId,token)` WRITE half
is wired (`biometricIdentity.ts` + `auth.tsx`) but the READ/restore half (`resolveBoundIdentity`) has **ZERO callers**;
today's login "biometric" is only a **liveness gate before a full id+password login**, not a restore; explicit logout
**destroys** the binding on purpose, silent `onSessionExpired` does **not**. Backend: access tokens expire at **24h**
(`auth.js:61-65`), and `POST /auth/refresh` exists but is `protect`-gated so `jwt.verify` **throws 401 on the expired
token** (`middleware/auth.js:16,39-45`) — **it cannot resurrect a 2-day-old token.** No refresh-credential / device
re-auth route exists. So restore needs an **`[api]`** re-mint endpoint; it is NOT a pure `[m]` wire-up. **Owner-locked
via AskUserQuestion (2026-08-15):** (D-1) **restore** the sealed session, not create a new account; (D-2) **only after
a SILENT 24h expiry — never after an explicit "Log out"** (keep destroy-on-logout; explicit logout forces a full login,
enforced server-side via revoke); (D-3) a **bounded ~30-day** re-entry window, then a full login. Wrote the
security-reviewed spec `docs/spec/PHASE-48.md` and filed a top-of-queue `→ cgpe-api · from cgpe-mobile` INBOX ask
(grepped back durable): recommended a device-bound `refresh_token` (30d, allow-list, rotate-on-use) issued at login +
a PUBLIC `POST /auth/refresh-biometric` (not `protect`-gated) + revoke-on-logout; offered a simpler
`ignoreExpiration:true` sliding-session alternative and flagged it lacks server-side revocation (won't enforce D-2).
Mechanism is `cgpe-api`'s call. **No mobile code** (building the restore flow against a non-existent endpoint = untested
404 dead code — Phase 43/45 file-first pattern). **No `src/` change → no gate re-run** (baseline: `tsc` 0, `npm test`
495/495, lint 0 errors / 12 warnings). **Live only when cgpe-api ships the re-mint endpoint + contract**, then the
`[m]` build (seal the refresh token, bump `RECORD_VERSION` 1→2, `refreshBiometricSession()` + test, wire
`resolveBoundIdentity` on the login screen, keep D-2's destroy+revoke on logout / no-clear on silent expiry) + a device
& security review. Full path: `docs/spec/PHASE-48.md`; DECISIONS 2026-08-15 (top).

**Phase 47 — [m][sec] "Viewing as" is Master-only. BUILT 2026-08-15.** The next editor-actionable owner-backlog
item (PLAN §Phase 47). **First step was verification, not code** (spec-mandated, same DB-not-phone-literal trap as
Phase 38): read the real code and confirmed "Viewing as" is **pure client-side state** (`auth.tsx:56`, never
persisted, reset on logout) driving a **downward-only preview** (`capabilitiesOf` clamps the previewed tier `≤` the
real tier at `roles.ts:100`, so it can never escalate). Its row lived in More's fixed Personal tail gated on
`realCaps.manageTeam` — true for the whole admin tier, into which `tierOf()` folds `leader` — so **every admin and
leader saw it**. The owner backlog says "except one number" (`9106988376`), but rule 1 forbids a phone literal and
that number is one of the THREE Phase-38 masters, so a truly-one-account gate would need a NEW per-profile backend
capability flag (`[api]`). **Owner-locked via AskUserQuestion (2026-08-15): gate on the real `super_admin` role** —
the pure-`[m]`, ship-today option, accepting the trade-off that all three masters keep it while every admin/leader
loses it (chosen over filing a new backend flag). Built NEW pure `canViewAs(user)=user?.role==='super_admin'` in
`store/roles.ts` (parallel to `canSeeLiveLocation`/`canSeeTeamPerformance`/`canMonitorTeam`, all four `super_admin`,
kept separate so they can't drift); `more.tsx` gates the Personal-tail row on `canViewAs(user)` (the REAL role, not
the preview `caps`, so the row stays visible while a master previews a lower tier and can switch back). The preview
sheet/pills/`applyView` are unchanged — only reachable once `viewAs` is set, which now only a master can do; `realCaps`
still drives the sheet's option filter (`more.tsx:425`) so it is not orphaned. NEW `roles.test.ts` cases pin
`canViewAs` across all 6 roles + null (admits only `super_admin`, refuses admin AND leader specifically, agrees with
`tierOf()==='master'`). Gates green: `tsc` 0 · `npm test` **495/495** (+4) · `eslint` on the touched files 0 errors
(1 pre-existing `more.tsx:129` `c`-unused warning). Commit local (push 403s). **No contract change, no `[api]` ask**
(pure `[m]` gate). **DEVICE CHECK CARRIED** (native + Phase-38-live-gated): a real admin + a real leader find the
"Viewing as" row gone; a real `super_admin` still previews Admin/Team and switches back. Full path:
`docs/spec/PHASE-47.md`; DECISIONS 2026-08-15 (top).

**Phase 39 — [m][sec] Master-only monitoring surface ("the main side"). BUILT 2026-08-15.** The owner-backlog
Group-C centrepiece (`PLAN §Phase 39`), now that its deps are all built (38 master role · 40 location gate · 44
salary · 45 performance). **Verified first: every lens already exists as its own screen and is already gated in
More's Master-control group** — they were just scattered (`/agent-map`+`/agent-track` location, `/performance?view=team`
scores, `/payroll` salary, `/team`→`/team/[id]` activity). So Phase 39 adds **no new data path** — it is a
**consolidated master landing**. Owner-locked via AskUserQuestion (2026-08-15): **shape = a monitoring HUB** (not a
per-member unified card — that would need per-member location/payroll deep-links that don't exist, i.e. new backend)
reached **pushed from More** (not a bottom tab — `nav.tabs` is DB-driven, a master-only tab needs an `[api]`/RBAC
change). Built NEW `src/app/monitor.tsx` — gate → a 2×2 lens grid (**Locations first — the owner's "most important"** —
Movement, Performance, Payroll, each `router.push` to its existing screen) → the team roster (`getTeam()`, on-duty
KPIs + an in-the-field summary, rows tap to `/team/[id]`). **NO task UI** (explicit owner constraint). **Gated on the
REAL `super_admin`** via NEW pure `canMonitorTeam(user)` in `store/roles.ts` (parallel to `canSeeLiveLocation`/
`canSeeTeamPerformance`, all three `super_admin`, kept separate so they can't drift) — the hub bails to an honest
"Owner access only" `EmptyState`, waiting for `ready` so a real master isn't flashed the refusal on restore; **each
destination screen keeps its own gate** (the hub is a convenience entry, not the authority). More wiring: a fixed
master-only **"Monitor"** row at the TOP of the Master-control group (no `navKey` — not a server nav module, like
Payroll). **The hub invents nothing** — no scores/salary of its own (server-owned on the destinations), only roster
identity + live duty (already a real cross-reference in `getTeam()`), honest on outage via `useDataHealth()`. NEW
`roles.test.ts` cases pin `canMonitorTeam` across all 6 roles + null (admits only `super_admin`, refuses admin+leader,
agrees with `tierOf()==='master'`). Gates green: `tsc` 0 · `npm test` **491/491** (+4) · `eslint` on the new/touched
files 0 errors (1 pre-existing `more.tsx` `c`-unused warning). Commit local (push 403s). **No contract change** (pure
`[m]` over existing endpoints). **DEVICE CHECK CARRIED** (native + backend-live-gated): a real `super_admin` opens
More → Monitor and reaches the hub; the four lenses open; the roster lists members and a tap opens the detail; a real
admin + a real leader find the tile gone and a deep-link to `/monitor` shows "Owner access only". Full path:
`docs/spec/PHASE-39.md`; DECISIONS 2026-08-15 (top).

**Phase 46 — [m] Tasteful time-of-day emoji in the Home greeting header. BUILT 2026-08-15.** The next
editor-actionable owner-backlog item after Phase 45 — small, self-contained, no backend/contract/i18n-dictionary
touch. Added a time-of-day glyph beside the greeting: 🌅 morning (`hour < 12`) / ☀️ afternoon (`< 17`) / 🌆 evening
(else), chosen off the greeting's **own existing hour cutoffs** (no invented copy). **Avoided the i18n trap
head-on:** the greeting renders in 5 languages via `greet.*` keys, so the emoji is derived as `greetEmoji` beside
`greet` and rendered as its **own standalone `<Txt>` element** after `{greet},` in the header row — NOT appended to
the English dictionary string (would leave 4 languages without it) and NOT string-concatenated onto the translated
word (would risk Hindi/Gujarati word order — the standing no-concatenation rule). One glyph therefore serves all
five languages. Wrapped in a `View` with `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`
so a screen reader announces the greeting, not "sunrise" (the `Txt` primitive does not forward a11y props, so the
wrapper carries the hint — `tsc` caught the first attempt that put them on `Txt`). ONE file: `src/app/(tabs)/home.tsx`.
Gates green: `tsc` 0 · `npm test` **487/487** (unchanged — presentational) · `eslint src/app/(tabs)/home.tsx` clean.
Commit `153ecc6` (local — push still 403s). **No contract change.** **Device visual check carried** (native-only:
emoji renders + vertically aligns with the greeting, light/dark at 390px). Full path: `docs/spec/PHASE-46.md`;
DECISIONS 2026-08-15 (top).

**Phase 45 — [api]+[m] Per-member completed-tasks report + performance score. VERIFIED gap (genuinely new) → score LOCKED with owner → FILED to cgpe-api; no mobile build yet — 2026-08-15.**
Owner backlog Phase 45 (Group F): a per-member report of **what they completed, when, how much** + a **performance
score**, counting **only manager-assigned AND actually-completed** tasks — NOT reminders, NOT self-created, NOT
cancelled. **Verified against real code first (tags wrong 5×): nothing computes this.** `GET /team/task-overview`
(`team.js:27`) is close but its `done` counts `cancelled` (`DONE`, `:23`) and its denominator includes self-created
tasks + reminders; `StaffScore` (`staffScores.js`) is **manually typed** by an admin, not derived; `reports.js`/
`dashboard.js`/`tasks.js` compute no per-member score. The raw data IS in `team_tasks` (`assigneeName`,
`createdBy`/`createdById`, `type`, `priority`, `status`, `dueAt`, and `statusHistory:[{status,at,by}]` at `:240` →
**when** completed). **Score LOCKED with owner (AskUserQuestion, 2026-08-15) — not invented:** (1) importance +
timeliness — `score = round(100 × earned/possible)`, per task `possible = P1:3/P2:2/P3:1`, `earned = ×1.0` on time /
`×0.5` late / `0` unfinished, **null when no tasks (never 0%)**; (2) **cancelled ≠ completed** (dropped from both sets);
(3) **only manager-assigned** — self-created never counts (recommended test `creator ≠ assignee`, justified by
`tasks.js:241` stamping `assigneeName = actor`); (4) **per calendar month**; (+ exclude reminders/Unassigned; on-time =
completion `<= dueAt`, no due date ⇒ on time). Filed a top-of-queue `→ cgpe-api · from cgpe-mobile` INBOX ask (grepped
back durable, 1 hit) with the locked defs + a recommended `GET /team/task-report?month=YYYY-MM` shape; flagged **one
open definition point** (which date stamps the month — recommend due-month) for cgpe-api + owner to confirm. **No `src/`
change → no gate re-run** (baseline: `tsc` 0, `npm test` 467/467, lint 0 errors / 12 warnings). Live only when cgpe-api
ships the aggregate (+ `api.md`/`models.md`) and a later `[m]` phase renders it (`getTaskReport` + a per-member surface
feeding Phase 39) + a device check. Full path: `docs/spec/PHASE-45.md`; DECISIONS 2026-08-15 (top).

**Phase 45 UPDATE — cgpe-api SHIPPED (Backend Phase 53) → VERIFIED against real code → owner confirmed due-month → mobile READER built + tested — 2026-08-15.**
`cgpe-api` shipped `GET /api/team/task-report?month=YYYY-MM[&scope=all|own][&user_id=…]` (Backend Phase 53, 16 tests,
suite 798). **Verified against their real `routes/team.js` (not the summary):** every owner-locked def honoured
exactly — `COMPLETED` excludes `cancelled` (`:31`), `selfCreated → continue` (`:307-311`), reminders + Unassigned
dropped (`:293`/`:298-300`), `score = round(100×earned/possible)` weights P1:3/P2:2/P3:1 + on-time ×1.0 / late ×0.5,
`possible===0 → null` (`:349`), IST due-month bucket (`:314`). **The one flagged open point (month basis) is now
OWNER-CONFIRMED = due-month** (AskUserQuestion, 2026-08-15) — exactly what shipped, no change. Mobile verification
recorded under the (cgpe-api-owned) INBOX item, grepped durable. **Built the mobile data reader:** `getTaskReport(month,
{scope,userId})` in `src/data/api.ts` + pure `mapTaskReport` — two-outcome `req()` posture (403 for the wrong role = a
quiet answer, 5xx/network/shape-drift = banner), server owns every count/score (rule 2 — the app never recomputes),
`score:null` ("no tasks") kept distinct from `score:0`, empty `members[]` on a healthy 200 is a valid `ok`. Pinned by
NEW `api-task-report.test.ts` (16). Gates green: `tsc` 0 · `npm test` **483/483** (+16) · lint 0 errors (2 pre-existing
warnings unrelated). Commit local (push 403s). **No contract change** (pure consumer of shipped Phase 53).
**Remaining = the RENDER (a device phase, feeds Phase 39):** the reader has no UI consumer yet — the per-member
report/score surface + who-can-see-it gating (master/admin only, the Phase-40 role-gating class) is the next build,
plus a device check once cgpe-api's `:3001` restart lands. Full path: `docs/spec/PHASE-45.md`; DECISIONS 2026-08-15 (top).

**Phase 45 RENDER BUILT — the `performance.tsx` screen (self + master-only team) + More-tab wiring + gate. Owner-locked visibility. 2026-08-15.**
Owner locked visibility (AskUserQuestion, 2026-08-15): **every member sees their OWN score; only `super_admin` sees
the whole team.** Built NEW `src/app/performance.tsx` — one screen, two views by `?view=` param: **self** (`/performance`,
`getTaskReport(month,{scope:'own'})`, no gate — server self-scopes to the token) renders the caller's score hero
(0–100 + Meter) + Assigned/Completed/On-time/Late KPIs + their completed-tasks list; **team** (`/performance?view=team`,
`{scope:'all'}`) renders the ranked roster (score badge + counts per member, tap to expand completed tasks) + team
totals, **gated on the REAL `super_admin` role** via NEW pure `canSeeTeamPerformance(user)` in `store/roles.ts`
(parallel to `canSeeLiveLocation` — never the folded tier, so an admin/leader can't see everyone's score; waits for
`ready` before the "Owner access only" refusal so a real master isn't flashed it). **The app renders, never recomputes**
(rule 2): `score:null` → em dash + "no tasks", never a fabricated 0%; only the server's on-time/late fact is coloured.
More-tab wiring: master-only **"Team performance"** tile in the Master-control group (beside Agent locations, same
real-role authority) + **"My performance"** tile in the Personal tail (beside My earnings, ungated). NEW `roles.test.ts`
cases pin `canSeeTeamPerformance` across all 6 roles + null (admits only `super_admin`, refuses admin+leader). Gates
green: `tsc` 0 · `npm test` **487/487** (+4) · lint 0 errors (1 pre-existing more.tsx warning). Commit local (push
403s). **No contract change** (pure consumer of Phase 53). **DEVICE CHECK CARRIED** (native-only + backend-live-gated):
a real member sees only their own score; a real `super_admin` sees the ranked roster; a real admin/leader deep-linking
`?view=team` gets "Owner access only", never a roster — once cgpe-api's `:3001` restart lands so the endpoint returns
live data. Full path: `docs/spec/PHASE-45.md`; DECISIONS 2026-08-15 (top).

**Phase 44 — [api]+[m] Strict salary from working hours/days. VERIFIED — ALREADY SATISFIED end to end; owner confirmed the live formula as-is; ZERO change — 2026-08-15.**
Owner backlog Phase 44 (Group F): salary computed **from actual working hours/days**, shown as **one amount**
(rule 2 — a backend payroll-engine formula; the app never multiplies). **Verified against real code (both trees):
the strict hours/days engine already exists, is owner-locked, and is live** — Backend **Phase 25b** (locked
2026-08-11). `services/payrollEngine.js`: `base` = flat; `day_wise` = `(salary/working_days)×present_days`;
`hourly` = `(salary/working_days/office_hours[8.5])×worked_hours`; `working_days = days − Sundays − holidays`
(Sat works, Sun only weekly off); full precision, `payable` rounded to **₹1**. `services/payrollAttendance.js`
reduces the **live `daylogs`** to the inputs with **owner-locked fixed cutoffs** (spec row 15): worked ≥8h → full
day (1.0), ≥4h → half (0.5), <4h → absent (0); `worked_hours` = actual seconds/3600. `routes/payroll.js`
`buildRoster()` joins daylogs by the member's Profile **ObjectId `_id`** (`:335`, the correct join, does not
replicate the attendance-calendar string/ObjectId bug), buckets per month. Exposed via `GET /payroll/my-earnings`
(**self**: `protect`-only above `authorize('admin')`, `user_id` forced to token, `:41/:50/:84`) and
`GET /payroll/compute` (**admin**) — both reuse the same engine, so no second formula. **Mobile already renders
it:** `earnings.tsx` (Phase 16/28) shows `payable` + present/working days + worked hours + segment + office hours,
never multiplying (`earnings.tsx:27-30`); `payroll.tsx` (Phase 20) shows per-member present/working days + the
server `payable` + a roster total (a sum of server payables). **Owner shown the exact live formula via
AskUserQuestion (2026-08-15) → chose "correct as-is."** So: **no `[api]` ask** (nothing missing — the plan text
predates Backend Phase 25b shipping), **do NOT invent an alternative** cutoff/rate (a future change = a new `[api]`
ask with the owner's exact numbers), **no mobile build**. **No `src/` change → no gate re-run** (baseline: `tsc`
0, `npm test` 467/467, lint 0 errors / 12 warnings). Only the existing carried payroll-screen device check remains
(not new to Phase 44). Full path: `docs/spec/PHASE-44.md`; DECISIONS 2026-08-15 (top).

**Phase 43 — [api]+[m] Per-member set location + 200 m clock-in enforcement. FILED → cgpe-api SHIPPED (Backend Phase 50) → VERIFIED same-day; mobile owes ZERO change, device check only — 2026-08-14.**
`cgpe-api` shipped the filed ask the same day as **Backend Phase 50**, all five points as recommended, and it is
**verified against their real code** (courier re-read, not the summary): `getMemberGeofence(userId)`
(`utils/geofence.js:91-112`, member `payroll_profiles.start_location` → office → default, centre-only, org
radius/enforce kept, `+source`); clock-in enforces it (`routes/timeTracker.js:322-323`), clock-out too
(`:504-505`, non-blocking); `checkClockGeofence(...,fence?)` backward-compatible, `min(acc,100)`/`>300 m` rules
unchanged; `GET /geofence` returns the caller's own fence, **shape unchanged** + additive `source` (`:1274-1277`);
set-pin via existing `PUT /payroll/profiles/:userId`; the flagged `PUT /geofence` 2000→200 default bug fixed
(`:1296-1298`). **Mobile inert:** `getGeofence`/`checkGeofence` (`src/data/api.ts:1707/1788`) map the fixed shape
and ignore `source`, so the caller's own fence flows through with the 403 verbatim — **no `src/` change, no gate
re-run** (baseline: `tsc` 0, `npm test` 467/467, lint 0/12). RE-VERIFIED note filed under the (cgpe-api-owned,
already-ticked) INBOX item, grepped back durable. **Remaining: device check only** — member inside pin clocks in,
~201 m away refused with the measured distance — once an admin sets a `start_location` + the `:3001` restart lands.
Full path: `docs/spec/PHASE-43.md` §8; DECISIONS 2026-08-14 (top).

**Phase 43 (original filing) — VERIFIED + FILED to `cgpe-api`, no mobile build — 2026-08-14.**
Owner backlog Phase 43 (Group E): each team member has their OWN set location; clock-in only within 200 m of that
pin, not the single shared office fence. **Verified against real code + `contracts/` (both trees, not tags):**
clock-in enforces ONE global office fence keyed to nobody — `checkClockGeofence(lat,lng,accuracy)` has no
user/profile param (`utils/geofence.js:80`), default **200 m** (`geofence.js:24-30`) + 100 m accuracy credit
(`:93-94`, coarser-than-300 m rejected `:89-91`), and `GET /geofence` (`routes/timeTracker.js:1267`) serves that
same fence to everyone. The two per-member fields that exist **do not drive clock-in**: `Profile.attendanceRules.geo`
(break-fence-only via `validateLocation`, null for everyone, m-vs-km conflict) and `PayrollProfile.start_location`
— documented `models.md:824` as *"the clock-in pin"* but read only by `routes/payroll.js`. No CHANGELOG/api.md
entry specifies per-member clock-in fencing, so this is a **new contract change and an entirely backend-owned
enforcement gap** (per-member fence field + caller-keyed `checkClockGeofence` + non-regressive fallback + set +
self-read endpoints). **Mobile = ZERO change:** `getGeofence`/`checkGeofence` (`src/data/api.ts:1707/1788`) read
the fence shape-agnostically and `POST /clock-in` is the authority (403 `message`+`distance_m` verbatim), so a
per-member fence served through the existing `GET /geofence` just works — the Phase 27/38 "pure backend, mobile
fail-open consumes" pattern. The 200 m + 100 m-credit → ~300 m effective rule the roadmap asked us to confirm is
confirmed (§1) and already mirrored by the Phase-7 pre-check. Filed a top-of-queue `→ cgpe-api · from cgpe-mobile`
INBOX ask (grepped back durable, 1 hit) + a plain-language owner-relay copy; recommended (not dictated)
`PayrollProfile.start_location` as the source field + a member-pin→office→default fallback (mechanism is
`cgpe-api`'s call). **No `src/` change → no gate re-run** (baseline: `tsc` 0, `npm test` 467/467, lint 0 errors /
12 warnings). Live only when `cgpe-api` ships enforcement + a panel way to set each member's pin + a device check.
Full path: `docs/spec/PHASE-43.md`; DECISIONS 2026-08-14 (top).

**Phase 41a-iii-b (part 2) BUILT IN EDITOR — the unified 24/7 recorder wired (`tracker.ts` + triggers + native config). Gates green, DEVICE-UNVERIFIED. 2026-08-14.**
The owner chose (AskUserQuestion) "write it all now" so the on-device session is pure build-and-verify. Built the
full PHASE-41 §12 slice: (a) **`src/lib/tracker.ts` — ONE unified recorder** (§12.1). `ingest` now attributes each
batch by the shift `sid` at flush time: present ⇒ `deliver` (`/track/points`, unchanged); absent + 24/7 armed ⇒
NEW `deliverAmbient`→`postAmbientPoints` (`off_duty`); absent + NOT armed ⇒ the exact PHASE-7 unattributable
teardown, preserved. `startTracking`/`stopTracking` are repurposed to only set/clear the shift `sid` and
ensure/keep the single service (never stop it) when armed — so **clock-in/out no longer start/stop the service,
they flip attribution**; the service stays up across clock-out and records ambient. NEW exports
`startAmbientTracking({prompt,notif})` / `stopAmbientTracking()`; NEW persisted markers `track.ambient` (armed),
`track.notif` (resolved neutral notification, captured at arm time — a headless restart has no i18n, §12.4),
`track.batteryOptAsked` (once-per-install). (b) **Battery-opt step** in `ensureBackgroundPermission`
(§12.2/§12.3): Android-only `IntentLauncher.startActivityAsync(REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)`, best-effort,
never flips `granted`, fires at most once. (c) **Wiring** (§12.5): `consent.tsx` onAgree →
`startAmbientTracking({prompt:true, notif})` before Home; `_layout.tsx` ConsentGate boot-arm →
`startAmbientTracking({prompt:false, notif})` on `ok+granted` (**fail-open: `error` arms nothing**); `home.tsx`
clock-in/out **unchanged**. (d) **`app.json`** gains `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`; **`expo-intent-launcher`
57.0.1** installed (top-level import, web-safe `{}` shim). **Non-consented path is byte-identical** (§12.1
graceful degradation) — 24/7 is purely additive. Deliberate §12 reconciliations in DECISIONS 2026-08-14 (top):
fresh-storage `ambientArmed()` read (not a once-per-start flag — avoids a headless race), `notif` param on
`startAmbientTracking` (tracker has no i18n), once-per-install battery-opt flag, boundary-batch slop accepted for
v1, `isTracking()` now "service running (shift OR 24/7)" but has **zero consumers** (verified). Gates: `tsc` 0 ·
`npm test` **467/467** (unchanged — `tracker.ts` has no stub, wiring is presentational) · lint **0 errors / 12
warnings** (baseline). **No contract change** (pure consumer of shipped Phase 43). Commit local (push 403s).
**DEVICE-UNVERIFIED — the whole acceptance gate is on a handset (§12.7):** a fresh EAS/dev-client build (new
native module + permission), then the matrix — ambient `off_duty` points off-shift, attribution flips on
clock-in/out without the service stopping, app-swipe survival, battery-opt prompt once, withdrawal→403→stop+drop,
fail-open boot arms nothing, and **battery drain measured over a real working day on 3+ handsets** (the §3 hard
gate). `stopAmbientTracking` is exported but not yet wired to sign-out/withdrawal (self-heals via the next flush;
a later slice). Full path: `docs/spec/PHASE-41.md` §8/§12; DECISIONS 2026-08-14 (top).

**Phase 41a-iii-b (part 1) BUILT — the consent BOOT GATE (redirect). Pure decision seam + `_layout.tsx` wiring; `tracker.ts` device pieces still deferred. 2026-08-14.**
The editor-verifiable half of 41a-iii-b. Re-checked the backend first: `909b117` (backend Phases 43-46 —
consent + ambient + retention) is now **committed + live on `:3001`** (cgpe-admin INBOX re-verify), so the
Phase-34 "don't wire before backend is live" OPS trap no longer holds. Built the boot gate that makes
`/consent` actually mandatory: (a) NEW pure `needsConsentGate(read)` in `src/data/api.ts` beside
`getLocationConsent` — redirect ONLY on a confirmed `ok`+non-granted (`pending`/`withdrawn`); `granted`→no;
**`error`→no (FAIL OPEN)** so an outage/legacy-backend/dead-network can never bounce staff to the wall.
Extracted as a predicate so that one load-bearing safety property is pinned by a test, not buried in an
effect. (b) NEW headless `ConsentGate` in `src/app/_layout.tsx`, mounted in `RootNav` beside `AppLock`/
`JobPill` (the live nav context): fires **once per signed-in session** (a `checked` ref, reset only on
sign-out) so it can't loop; the consent screen's own Agree→`replace('/(tabs)/home')` never re-triggers it;
**native-only** (the gate enables the native recorder — web has none, and the e2e web harness must keep
reaching every screen); no `let alive` guard because it's process-lifetime like AppLock and does no setState,
only a one-shot `router.replace('/consent' as Href)` (cast like `attendance.tsx`'s `/earnings` until
`expo start` regenerates route types). Runs at `_layout.tsx` level (survives Expo's restored-route cold
start), NOT `index.tsx` (only mounts at `/`). Gates: `tsc` 0 · `npm test` **467/467** (+3, `needsConsentGate`
branches) · lint 0 errors / 12 warnings (baseline; the two touched `src` files add 0 new). **No contract
change** (pure consumer of the documented Phase 43 contract) → no INBOX/CHANGELOG. Commit local (push 403s).
**Still device-only, owed on a handset (41a-iii-b part 2):** the redirect's UX check (no Home
flash-then-bounce, no loop, restored-route survival) AND the whole `tracker.ts` slice — the battery-opt step
in `ensureBackgroundPermission`, the ambient recorder calling `postAmbientPoints` on grant, and the neutral
24/7 foreground notification (`consent.serviceTitle`/`serviceBody`, copy already landed in 41a-ii). Full
path: `docs/spec/PHASE-41.md` §8; DECISIONS 2026-08-14 (top).

**Phase 41a-iii-a BUILT — `getLocationConsent()` boot-gate READ (fail-open + fully silent). Wiring + device pieces deferred to 41a-iii-b (one device pass). 2026-08-14.**
The editor-buildable, testable slice of 41a-iii. NEW `getLocationConsent()` in `src/data/api.ts` reads
`GET /rbac/config` `me.location_consent` and returns `ok`(granted/withdrawn/pending) / `error` — the input the
boot gate will use to decide whether to show `/consent` and start the ambient recorder. **A genuinely new read
path:** nothing read `/rbac/config` before (the layout comes from `/rbac/app-ui` via `normalizeUiConfig`, which
drops unknown fields), and `me` is **TOP-LEVEL** on this envelope (`{ success, config, me }`, `routes/rbac.js:79`),
so it reads `json.me.location_consent`, NOT `json.data`. **Fail-open + fully SILENT by design** (deliberately
unlike `getMdrtTier`): absent block (Phase 43 not yet deployed) / non-2xx / dead network all collapse to
`{status:'error'}` (the gate treats it as "don't redirect"), and it **never touches the health channel** — it runs
every cold start and drives an invisible gate, so a banner would be the permanent-outage anti-pattern
(`/rbac/app-ui`'s boot fetch reports config health). **Adding the function alone changes zero runtime behavior**
(no caller yet) — a dormant, tested capability until the gate wires it. Pinned by NEW `api-consent-read.test.ts`
(10): the `json.me` (not `.data`) unwrap, all three enum states, absent/odd fields → null, silent fail-open on
legacy-body / 5xx / 403 / network. Gates: `tsc` 0 · `npm test` **464/464** (+10) · lint 0 errors/12 warnings
(baseline). Commit `8e76bbe` (local — push 403s). **No contract change** (pure consumer of the documented Phase 43
contract → no INBOX/CHANGELOG). **41a-iii-b remains (device-only + backend-live-gated):** the `_layout.tsx` boot
redirect + `tracker.ts` ambient recorder/battery-opt/24-7 notification — NOT until cgpe-api commits + `:3001`-
restarts Phase 43. Full path: `docs/spec/PHASE-41.md` §8; DECISIONS 2026-08-14 (top).

**Phase 41a BUILT — consent data layer + 5-language copy + consent screen. Backend Phase 43 (consent+ambient) + Phase 45 (retention) SHIPPED & VERIFIED (both uncommitted). 41a-iii (boot-gate + tracker wiring) is device-only, next — 2026-08-14.**
41a built end to end this session: (a) NEW `src/data/api.ts` `setLocationConsent(granted,version?)` (POST /consent)
+ `postAmbientPoints(points,date?)` (POST /track/ambient — token-attributed, NO session; 403 `consent_required`
⇒ stop+drop buffer; silent like `postTrackPoints`; never fabricates a granted state), pinned by NEW
`api-ambient.test.ts` (19); (b) 19 `consent.*` i18n keys in all 5 languages (owner copy `translation-v.01`, NOT
machine-translated), parity gate 75→94; (c) NEW `src/app/consent.tsx` — mandatory (no back/skip), Agree→
`setLocationConsent(true,'v.01')`→Home, Decline→honest "can't continue", reachable at `/consent` (web-demoable),
**not yet auto-gated** (the app doesn't read the `me` block from `/rbac/config` yet). **Verified cgpe-api Phase 45
retention in real code** (`services/locationRetention.js`: 90d soft-delete `deleted_at` / 180d hard-delete, both
shift+ambient, keyed on `started_at`; reads exclude soft-deleted at `timeTracker.js:1496-1521`) — matches the
filed ask, **zero mobile change**. Gates: `tsc` 0 · `npm test` **454/454** (+19) · lint 0 errors/12 warnings.
Commits local (push 403s). **41a-iii remains (device-only):** `me.location_consent` boot read + redirect-to-
`/consent` gate + `tracker.ts` ambient recorder/battery-opt step/24-7 foreground notification. NOT live until
cgpe-api commits + `:3001`-restarts Phase 43/45. Full path: `docs/spec/PHASE-41.md` §8; DECISIONS 2026-08-14 (top).

**Phase 41 (plan) — 24/7 location + activity: transparent · consented · mandatory · robust · battery-smart. FINAL PLAN LOCKED; backend Phase 43 SHIPPED (fits); retention SHIPPED (Phase 45) — 2026-08-14.**
Owner-escalated to #1 (PLAN §41). **First step was policy, not code (rule 5).** The model moved through three
owner positions this session — consent+withdrawal → an interim "mandatory/hidden/evade-the-scan" ask (**declined**;
one INBOX write proposing the consent-strip was also blocked by the safety classifier and NOT re-sent) → the
owner's **final correction: "chupa ke kuch nahi — bata ke, puch ke"**: **transparent + consented + mandatory**,
close the loophole so staff can't *bypass* it (done transparently, not covertly), and **no battery drain**.
Internal side-loaded team app. **Two hard lines kept (now moot because transparent): no OS-notification/indicator
suppression, no security-review evasion.** During the session **cgpe-api independently shipped backend Phase 43** —
a consent-based off-duty ingest (`POST /track/ambient` consent-gated + token-attributed, `Profile.location_consent`,
`me.location_consent`, `off_duty`/`dropped` on the track reads; verified in `timeTracker.js:1390-1481`) — which
**fits the final transparent model exactly**, so the consent gate STAYS (not stripped). Wrote the full plan
`docs/spec/PHASE-41.md` (§0-§11): consent required to *use* the app (informed + non-negotiable); OS-kill
reliability = foreground service (present) + battery-opt exemption + boot-receiver config plugin + watchdog;
battery-first motion-adaptive low-accuracy batched sampling; anti-circumvention by **transparent detection**
(permission-off/mock-GPS/service-kill/point-gap → master alert + app-block); master-only visibility (Phase 40);
retention **90-day soft-delete / 180-day hard-delete**. Filed the ONE remaining backend ask (**retention job**;
consent design accepted as-is) + flagged a later "silent-user" gap-detector. **No `src/` change, no `contracts/*`
edit → no gate re-run** (baseline: `tsc` 0, `npm test` 435/435, lint 0 errors / 12 warnings). **NOT live** until
cgpe-api ships retention + commits/restarts Phase 43, the owner supplies the 5-language consent copy + provisions
device battery/auto-start, then mobile builds **41a** (consent + ambient wiring) → **41b** (reliability) → **41c**
(battery + activity) → **41d** (anti-circumvention), each device-checked (`tracker.ts` is device-only, no tests).
Full path: `docs/spec/PHASE-41.md`; DECISIONS 2026-08-14 (top). Next: owner copy + cgpe-api retention → mobile 41a;
Phase 42 (green/red colouring) consumes the `off_duty` split.

**Phase 40 — [m][sec] Live-location visibility = Master only. BUILT 2026-08-14.** The first mobile-buildable
step of the master chain after Phase 38 (PLAN §Phase 40). Only the **Master** (real `super_admin`) may see
where the field physically is — the two coordinate-bearing screens `agent-map` (live pins) and `agent-track`
(movement replay). **Verified the gap in code first:** `agent-track` was already master-gated (via the
`capabilitiesOf().tier` caps indirection), but **`agent-map` had NO gate at all** — any signed-in user reaching
`/agent-map` fetched `getTeam()`+`getAgentLocations()`, and its entry points (`more.tsx` admin-oversight group
gated `caps.manageTeam`, the Admin dashboard) are **true for admin AND leader**, so an admin/leader could open
the live map. Gated on the **REAL `user.role === 'super_admin'`**, never the folded tier (`tierOf()` folds
`leader`→admin and `seeAgentMap` is true for the whole admin tier, so a tier/caps gate would leak location to
every admin and leader — the Phase-20 trap). **6 files:** (a) NEW shared pure predicate
`canSeeLiveLocation(user)=user?.role==='super_admin'` in `store/roles.ts` — the ONE gate both screens share, so
they can't drift; (b) `app/agent-map.tsx` — `load()` bails before the fetch when not master + an honest
`ready && !isMaster` "Master access only" `EmptyState` (waits for `ready` so a real master isn't flashed the
refusal on session restore), placed **before** the loading skeleton; (c) `app/agent-track.tsx` — swap the caps
gate → `canSeeLiveLocation` (same result, explicit real-role), drop the unused `capabilitiesOf` import; (d)
`app/(tabs)/more.tsx` — move the "Agent locations" tile into the existing `caps.tier==='master'` branch beside
"Movement paths" (both location tiles now Master-only; the tile stays viewAs-aware — an affordance — while the
SCREEN's real-role gate is the security authority); (e) `screens/dashboards.tsx` — drop the "Agent map" quick
action from the **Admin** dashboard (the **Master** dashboard keeps map+movement, it renders for master only);
(f) NEW `store/__tests__/roles.test.ts` (5) — pins the invariant across all 6 roles + null: admits `super_admin`,
refuses every other role, refuses **admin AND leader** specifically (the folded trap), refuses null, agrees
exactly with `tierOf()==='master'`. **Scope boundary (verified):** `getTeam()` uses `getAgentLocations()` only
to derive a **duty boolean** (`clockedIn`) and discards coordinates — so on/off duty counts on the roster/
dashboards are NOT a location read and stay open (not gated); `getTrackableMembers()` (notify recipient picker)
carries no location. **No `[api]` ask, no contract change** — pure `[m]` gate over existing endpoints. Gates
green: `tsc` 0, `npm test` **435/435** (+5), lint 0 errors / 12 warnings (baseline). Commit local (push still
403s). **Device check carried** (native-only: a real `super_admin` sees the map; a real admin + a real leader
find the tiles gone and a deep-link shows "Master access only", never a blank map; light/dark at 390 px) — needs
Phase 38's DB promotion for a live master account, though the gate holds regardless. Full path:
`docs/spec/PHASE-40.md`; DECISIONS 2026-08-14 (top). Next mobile step: **Phase 39** (the master monitoring surface).

**Phase 38 — [db]+[sec] Master for the 3 numbers via `Profile.role` (NOT client literals). VERIFIED + FILED, no code — 2026-08-14.**
The head of the master-role chain (PLAN §Phase 38). Owner-confirmed via AskUserQuestion (2026-08-14): "master" is
**exactly the `super_admin` role** — the `Profile.role` enum (`cgpe-backend-main/models/Profile.js:28`) has no
separate monitor-only rank — and the owner chose **full `super_admin`** (org-wide power) over a narrower
monitor-only role (which would be a NEW backend capability, not taken). **Verified the whole login→role→tier chain
against real code (both trees, not tags):** phone-OTP login matches the profile by the **last 10 digits**
(`findStaffByIdentifier`, `routes/auth.js:869`) and returns `data.user = profile.toPublicJSON()` incl. `role`
(`:1015`); mobile maps it straight through (`adaptUser`, `adapt.ts:157`) and `tierOf()` returns `master` iff
`role==='super_admin'` (`store/roles.ts:42`) — **no phone literal in `src/`, by design (rule 1)**; `authorize()`
then lets `super_admin` pass every gate (`middleware/auth.js:57,73`). So promoting the 3 accounts is a **pure DB
data change** that makes them read as Master with **zero `src/` change** — nothing for mobile to build, and no
backend *code* change either. Filed a verified `→ cgpe-api · from cgpe-mobile` INBOX ask (grepped back durable, 2
hits) + a plain-language owner-relay copy (courier workflow): promote `9099032033`/`9825135034`/`9106988376` to
`staff_unified.role='super_admin'` via the panel (User Management → Role → Super Admin) or a phone-safe
`updateOne({phone:/…$/},{$set:{role}})` (the `makeSuperAdmin.js` script takes `user_id|email`, **not** a phone).
**Three preconditions surfaced (they decide whether phone login even works):** (P1) **exactly one active profile
per phone** — phone login is REFUSED on >1 active match (`auth.js:871`) and 404s on 0 (`:870`), so confirm
`countDocuments({phone:/<last10>$/,is_active:true})===1`; (P2) **sign out + back in** on each device after
promotion (the app restores the cached `user` on cold start, only refreshing `role` on a fresh login/OTP); (P3)
**[sec]** super_admin = full org-wide power (edit/promote any user, all PII), reversible by resetting the role —
owner accepted (PLAN rule 5). **No `src/` change → no gate re-run** (baseline stands: `tsc` 0, `npm test` 430/430,
lint 0 errors / 12 warnings). Deliverable is the owner's DB change + an on-device check (each number signs in →
lands on Master). Next mobile-buildable step is **Phase 40** (gate location on the real role). Full path:
`docs/spec/PHASE-38.md`; DECISIONS 2026-08-14 (top).

**Phase 37 — [m] notification mark-as-read (per-item) + clear the bell dot. BUILT 2026-08-14.** The first
feature off the owner backlog after the three audits (PLAN §Phase 37). **Verified the backend FIRST (grep, not
tags):** the per-item persist endpoint already EXISTS — `PUT /api/notifications/:id/read` (`protect`,
ownership-checked: 404 if missing, 403 if not the caller's, else `markAsRead()` sets `read:true`/`read_at:now`),
already documented at `contracts/api.md:878`. So — unlike the WhatsApp inbox (no read endpoint, `unread` never
clears) — this is a **pure `[m]` wire-up: no contract change, no `[api]` ask**. And Phase 36 already proved there
is **no hardcoded notification data to strip** (feeds are 100% DB-driven), so this is purely the feature. Three
files + a new test: (a) `api.ts` gains `markNotificationRead(id):Promise<boolean>` — the per-item companion to
`markAllNotificationsRead`, same `req()` posture + boolean contract (returns whether the SERVER accepted it);
reporting mirrors `reportIfOutage` so a **403/404 is an ANSWER** (quiet, the screen rolls back) while a
5xx/malformed-4xx/dead-network is a fault that raises the banner (`healthKey` collapses the 24-hex `_id` →
`/notifications/:id/read`). (b) `notifications.tsx` — tapping an **unread** row marks it read via the existing
`SpineRow` `onPress` (read rows take no press); **verified, not assumed** like mark-all: optimistic (functional
`setItems`, so two quick taps don't clobber), and on a refusal the **single** row goes back to unread + the
shared Banner explains — never a cleared row the server never agreed to; per-item does NOT refetch the feed (a
single PUT is authoritative), mark-all keeps its verify-refetch; the screen's own unread Pill + bottom bar track
`unread` and the bar hides when the last clears; rows still **do not navigate** (no target id). (c) `home.tsx` —
the bell lives here and `/notifications` is a **pushed route** (Home stays mounted, mount `load()` never re-runs
on return), so a `useFocusEffect` re-reads **just the feed** on every RE-focus (skipping the first, so no cold-open
double-fetch); **outage-guarded** — an empty result during `getHealth().degraded` (read LIVE after the await)
keeps the last count rather than forging a "0 unread" bell (convention 4); a genuinely empty feed on a healthy
backend still clears. (d) NEW `api-notifications.test.ts` (13) pins the read-state wire contract (403/404 = no
banner; 5xx/network/200-`success:false` = banner; empty-id/demo = no request; +`markAllNotificationsRead` and
`getNotifications` incl. the `is_read` alias and outage→empty+degraded). Gates green: `tsc` 0, `npm test`
**430/430** (+13), lint 0 errors / 12 warnings (baseline). Commit local (push still 403s). **Device check
carried** (native-only pushed-route focus lifecycle + haptics + real bell: tap-to-read, bell clears on return,
airplane-mode rollback + no false-zero) — PHASE-37 §5. Full path: `docs/spec/PHASE-37.md`; DECISIONS 2026-08-14
(top).

**Phase 36 — [audit] hardcoded-vs-DB data sweep (notifications first, then app-wide). DONE (inventory, no code change) 2026-08-14.**
The third of the three roadmap audits (PLAN §Phase 36). Deliverable was an **inventory** separating (a) real
fabrication to remove, (b) legitimate synthesis to keep, (c) static config. **Finding: bucket (a) is EMPTY —
there is nothing to delete.** No runtime path fabricates domain data: `mock.ts` is `export {}` (0 importers),
`api.ts` `state` starts every collection empty, **all 30** `unavailable(endpoint, X)` calls pass an empty `X`
(`state.*`/`[]`/`undefined`/`EMPTY_*` shells with `data:[]`), and a failed read resolves empty **and** reports
to `health.ts` so screens fork "could not load" vs. "genuinely empty" (never a fabricated zero). Prior phases
already removed every historical fabrication (Phase 8 generateReport ₹42L; lic-plans "benefit estimator";
Add-Lead invented `'warm'`; Phase 7 Surat geofence pin; the old "invented client counts") — do NOT re-flag
them. **Notifications first (the stated priority) = clean:** `notifications.tsx`/`notify.tsx`/`notice-board.tsx`
are 100% DB-driven and refuse to invent state (notice-board deliberately shows **no** unread badges because the
backend returns no per-user read state) → **Phase 37 has no hardcoded notification data to remove.** Bucket (b)
kept & catalogued (adapt.ts claim-timeline/lead-notes/segments, prospects `pick()`, write-buffer optimistic
records = the user's own typed data, computed KPIs/deltas over real fetches, relative-time labels; one minor:
adapters fill a **missing** wire timestamp with `now`). Bucket (c) = label/tone/icon maps, option lists,
i18n copy, fail-open `DEFAULT_UI` config, `segments.tsx` `FALLBACK_FLAGS` control-vocab, editable form defaults
("LIC of India"). Method: 2 read-only Explore sweeps (data-layer agent died mid-run on an API error; its
territory re-covered directly) + whole-`src` greps (`₹`/big numbers, `^const X=[`, `useState([{` → 0 seeded
state, `Math.random`, self-labeled `dummy|fake|sample|hardcoded` → every hit documents a *removed* fabrication
or a hardcoded colour/coordinate). **No `src/` change → no gate re-run** (baseline stands: `tsc` 0, `npm test`
417/417, lint 0 errors / 12 warnings). Full path: `docs/spec/PHASE-36.md`; DECISIONS 2026-08-14 (top).

**Phase 35 — [audit] intermittent touch-freeze, esp. the AppLock "Unlock" button. FIXED 2026-08-14.** The
second of the three roadmap audits (PLAN §Phase 35), and unlike Phase 34 it was fixed the same phase — `[m]`,
one file, no contract change. **Root cause is NOT a pointer-absorbing overlay** (the plan's three suspects —
opacity-0 View absorbing touches à la `sheet.tsx`, the gesture-handler root, a lingering full-screen overlay —
were all investigated and **disproven**, PHASE-35 §3: AppLock's `zIndex:60` overlay captures its own touches,
`JobPill`/`HealthBanner` return `null` when idle, `Splash` sits below at `zIndex:50` and unmounts cleanly; and
`disabled={trying}` can't stick because `authenticateBiometric` fails closed). **The real bug is a re-entrant
biometric race:** `attempt()` fired from three unguarded places (cold-start, every foreground return, the Unlock
button); because the app passes `disableDeviceFallback:false`, tapping "Use PIN" launches Android's separate
Confirm-Device-Credential activity → app goes `background → active` → the foreground `AppState` listener read
that as "the user returned" and fired a **second** `attempt()` over the first (OEM/Samsung fingerprint sheets
bounce AppState too). Android rejects a concurrent `authenticateAsync` ("already in progress");
`authenticateBiometric` swallows it to a plain `false` → the tap showed no prompt and never unlocked. **Fix
(`src/ui/AppLock.tsx` only):** an `inFlight` ref serialises attempts (one prompt at a time) + `try/finally`
guarantees `trying`/`inFlight` reset (also kills a latent "button stuck disabled" trap) + `!inFlight.current`
gates the foreground listener so the prompt's own AppState churn can't spawn a competing prompt; a genuine
foreground return still re-locks. Gates green: `tsc` 0, `npm test` **417/417** (unchanged — AppLock is
native-only, no stub, untestable in Vitest/web), lint 0 errors / 12 warnings (baseline). Commit `2fc683b`
(local — push still 403s). **Device check CARRIED** (native-only: cold-start unlock, "Use PIN" round-trip,
repeated Unlock taps, background→foreground re-lock, ideally on Samsung/One UI) — PHASE-35 §6. Full path:
`docs/spec/PHASE-35.md`; DECISIONS 2026-08-14 (top).

**Phase 34 — [audit] self-created task not visible. RESOLVED (backend, `cgpe-api` Phase 40) 2026-08-14.** The
first of the three roadmap audits (PLAN §Phase 34). Traced end to end: the phone's task list is
`GET /team/task-overview` (the `team_tasks` collection), **never** `GET /api/tasks` (that fallback is dead — an
empty `{members:[]}` is a valid response). The overview's own/team scope kept a task if you were its assignee
OR creator, but the creator match compared `team_tasks.createdBy` (stored as a NAME) against a set of user_ids
— it could never fire — so a `super_admin`'s self-created task (esp. one left `assigneeName:'Unassigned'`)
belonged to nobody in scope and was dropped. **NOT a client filter, NOT an app-ui problem.** Wrote the finding
(`docs/spec/PHASE-34.md`), filed a verified `→ cgpe-api` INBOX ask; the owner relayed it and `cgpe-api` shipped
the fix (their Phase 40): stamp `createdById` (user_id) on every `team_tasks` write + match the creator by
`createdById ∈ allowedUids` (new rows) AND `createdBy(name) ∈ allowedNames` (legacy rows). Verified against
their source + `auth.phase40.test.js` (9 cases, 590 green). **Mobile code unchanged** — it already consumes the
endpoint correctly; the task now shows in the owner's DEFAULT own-scope (his task, not the whole board). The
mobile `?scope=all` fix (Phase 34b) is **deferred** — not needed for the owner's bug; revisit only if an admin
should see the whole team's board on the ordinary Tasks tab (vs. the master surface, Phase 39). ⚠️ OPS: the
backend change needs a `:3001` restart / prod deploy before it shows on device. No gate re-run (no `src/`
change). Full path: `docs/spec/PHASE-34.md`; DECISIONS 2026-08-14 (top).

**Phase 33 — density rollout: migrate the Home dashboard (`(tabs)/home.tsx`). BUILT 2026-08-14.** The last
big single-file lever (PHASE-32 §6): the 1915-line Home screen — 62 scale refs, `AppUiProvider`'s only
consumer, a documented danger zone — migrated on its own. Same D-2 pattern, no mechanism/contract/copy change:
strip the static `{ font, radius, spacing }` import, destructure **exactly** the scale each of the five
scale-using components needs off `c`; `tsc` proves completeness (all 62 refs resolve). `WidgetShell` +
`SmallEmpty` had **no `useTheme()` call at all** and gain `const { spacing } = useTheme()`; `LinkCard` →
`{ radius, spacing, font }`; `HomeSkeleton` → `{ spacing, radius }`; `Home` (default export) →
`{ spacing, radius, font }`, which `renderWidget` and all the dashboard JSX close over. **Unlike the Phase-32
primitives, this file had no module-scope scale const and no default-param scale capture** — a straight strip
+ destructure, six lines. `ClockRing` uses colours only — untouched; providers in `_layout.tsx` untouched.
Because Home owns its **whole** layout (its own gutters/hero, not just shared primitives), the entire Home
surface now tightens under `theme.density:"compact"` (spacing ×0.85 / radius ×0.90 / font ×1.0), type sizes and
≥44pt targets unchanged, on the next cold start — the "elements tighten but the screen's own layout stays
comfortable" nuance no longer applies to Home. Gates green: `tsc` 0, `npm test` **417/417** (unchanged —
presentational; density numbers pinned by `density.test.ts`), lint 0 errors / 12 warnings (baseline; `home.tsx`
itself 0/0). Commit `f754843` (local — push still 403s). **Device check carried** (a seeded
`theme.density:"compact"` dept config showing a tighter Home, light/dark at 390 px) — not editor-buildable (no
seeded compact doc yet). Remaining density targets: no single dominant one left — the other `ui/` modules
(`spine`/`swipe`/`Confirm`/…) and the ~40 flat stack-route screens, batchable by area. Full path:
`docs/spec/PHASE-33.md`; DECISIONS 2026-08-14 (top).

**Phase 32 — density rollout: migrate the remaining shared primitives (`ui/base.tsx` + `ui/controls.tsx` +
`ui/feedback.tsx` + `ui/sheet.tsx`). BUILT 2026-08-14.** The next high-leverage lever after the list
primitives (PHASE-31 §6): the base building blocks nearly every screen renders — buttons, fields, cards,
banners, skeletons, the modal sheet — so migrating them lifts `theme.density:"compact"` onto those ELEMENTS
app-wide. Same D-2 pattern, no mechanism/contract/copy change: strip the static `{ font, radius, spacing }`
import from each file, destructure **exactly** the scale each component uses off `c`; `tsc` proves
completeness. Three non-mechanical shapes handled as helper/hooks/fallbacks, not literals (D-3): (a)
`controls.tsx`'s module-scope `BTN_FS` const → a `btnFs(font)` helper (like `data.tsx`'s `pillFs`); (b)
**default parameters** that captured the scale (`base.tsx` `Txt`/`Metric` `size`, `feedback.tsx` `Skeleton`
`radius` + `SkeletonText` `gap`) — made optional and resolved in the body as `?? c.<scale>` (a default-param
can't reference the body's `c`); (c) components with **no `useTheme()` at all** (`base.tsx` `GlassCard`/`Row`,
`feedback.tsx` `SkeletonText`/`SkeletonCard`/`ToastProvider`) gain the hook. `Grad`/`Screen`/`KeyboardScroll`/
`Eyebrow` (base), `IconBtn` (controls), `FillBar`/`ProgressBar` (feedback) use no scale tokens and are
untouched. A department with `theme.density:"compact"` now renders these primitives' elements tighter (spacing
×0.85 / radius ×0.90 / font ×1.0, applied by `applyDensity`) wherever they appear, on the next cold start; an
unmigrated screen's own outer layout stays comfortable until that screen is migrated too (static exports
unchanged) — non-regressive. Gates green: `tsc` 0, `npm test` **417/417** (unchanged — presentational
migration, no new pure logic; the density numbers are already pinned by `density.test.ts`), lint 0 errors / 12
warnings (baseline). Commit `2b50aaf` (local — push still 403s). **Device check carried** (a seeded
`theme.density:"compact"` dept config showing tighter base primitives, light/dark at 390 px; other screens'
own layout stays comfortable) — not editor-buildable (no seeded compact doc yet). Next density target:
`home.tsx` (62 refs, danger zone) on its own, then the other `ui/` modules (`spine`/`swipe`/`Confirm`/…) that
still import the static scale. Full path: `docs/spec/PHASE-32.md`; DECISIONS 2026-08-14 (top).

**Phase 31 — density rollout: migrate the shared list primitives (`ui/data.tsx` + `ui/identity.tsx`).
BUILT 2026-08-12.** The highest-leverage lever after the list tabs (PHASE-29 §6, PHASE-30 "Next density
targets"): rather than one screen per phase, migrating the two shared primitive modules lifts
`theme.density:"compact"` onto the ELEMENTS they render — `Pill`/`StatCard`/`MetricTile`/`DataRow`/
`ListSection`/`KpiStrip`/`ActionTile` (`data.tsx`) and `PersonRow`/`Avatar` (`identity.tsx`) — on **every**
screen that renders them at once. Same D-2 pattern, no mechanism/contract/copy change: strip the static
`{ font, radius, spacing }` import from each file, destructure **exactly** the scale each component uses off
`c`; `tsc` proves completeness. Two non-mechanical cases handled as helpers/hooks, not literals (D-3):
`data.tsx`'s module-scope `PILL_FS` const → a `pillFs(font)` helper (like `clients.tsx`/`leads.tsx`'s
`sepInset`), and `KpiStrip` — which had **no `useTheme()` call at all** — gains one before its early return.
`Sparkline`/`Label`/`Avatar`/`AvatarStack` use no scale tokens and are untouched. A department with
`theme.density:"compact"` now renders those elements tighter (spacing ×0.85 / radius ×0.90 / font ×1.0,
applied by `applyDensity`) wherever they appear, on the next cold start; an unmigrated screen's own outer
layout stays comfortable until that screen is migrated too (static exports unchanged) — non-regressive.
Gates green: `tsc` 0, `npm test` **417/417** (unchanged — presentational migration, no new pure logic; the
density numbers are already pinned by `density.test.ts`), lint 0 errors / 12 warnings (baseline). Commit
`2dd37fe` (local — push still 403s). **Device check carried** (a seeded `theme.density:"compact"` dept
config showing tighter primitives, light/dark at 390 px; other screens' own layout stays comfortable) — not
editor-buildable (no seeded compact doc yet). Next density targets: the remaining primitives
(`base.tsx`/`controls.tsx`/`feedback.tsx`/`sheet.tsx`), then `home.tsx` (62 refs, danger zone) on its own.
Full path: `docs/spec/PHASE-31.md`; DECISIONS 2026-08-12 (top).

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

**CURRENT next 3 (2026-08-20 — the 70–73 batch AND Phase 65 are now BUILT + PUSHED on the mobile side. Detail: `docs/PHASES.md`
§Now, `docs/DECISIONS.md` 2026-08-20):**

Phases **65** (`0c4fde1`), **70** (`cd134ba`), **71** (`612410f`), **72 mobile** (`64f1afc`), **73** (`aa8469f`) are all built +
pushed to `aaziko/Shivam`. `git push aaziko Shivam` works; the remote can be ahead (web-UI README) → fetch + **merge**, never force.
All five ride ONE combined native APK (72/73 force a rebuild) — not yet cut. **There is no un-built mobile piece left in the
63–73 batches.**

1. **Phase 72 — EXECUTE ONLY ON A *VERIFIED* "backend live" SIGNAL (not a claim).** The owner's 2026-08-20 "backend done" signal
   was checked and is PREMATURE: the backend push code is uncommitted in `../cgpe-backend-main`, not on `origin/main`, and prod
   `/push/register` → **404**; Firebase/FCM unset. Two owner-owed pieces remain: the backend (commit→merge `origin/main`→deploy→
   restart `:3001`) and a **Firebase/FCM project** (hard infra prereq). When BOTH are claimed live: re-verify (fetch +
   `merge-base --is-ancestor` + a no-auth curl — 401=live, 404=not) and that FCM is configured, confirm a test token registers +
   a test push arrives — THEN this phase completes.
2. **Cut the ONE combined APK (65+70+71+72+73)** — only AFTER #1 is verified live, so it ships with working push, not a dormant
   half (owner's "build the batch, then one APK" rule). `npx eas-cli build -p android --profile preview --non-interactive`; direct
   `.apk` URL via `build:view <id> --json` → `.artifacts.applicationArchiveUrl`. Then the combined device-test pass.
3. **Owner physical device-test pass** on the current/next APK: bg-GPS over a real shift (Phase 71 ≤60-min point), geofence after
   go-live (Phase 50), biometric App-Lock grace (Phase 70), calendar auto-sync (Phase 73), and Phase 65's full-staff roster
   showing a never-assigned member. Optional: if a device test surfaces deactivated accounts in the roster, file the Phase-65
   `is_active` `[api]` note.

**Also standing (lower priority):**
Phases 54/56 from the 2026-08-18 batch (lead-open `[api]`; iOS gated on an Apple account). **Phase 55 (network resilience) BUILT +
PUSHED `941c583`** (device pass + 5-lang copy remain). **Phase 57 (offline support) BUILT + PUSHED — 57a read cache `20eb4ed`, 57b
write queue (Notes) `e318e06`; REMAINING = Task-create queue wiring (small, uses the existing mechanism) + 5-lang copy + a device
pass.** Phase 41 on-device verification (owner: do last). Owner physical pass on `b01f4164` still owed (bg-GPS, geofence after
go-live, biometric, break-gate) on ≥2 phone brands.

**⚠️ Phase 56 (iOS) is an owner PRIORITY but gated on a decision:** it needs an **Apple Developer account ($99/yr)** before any
iOS build is possible. Ask the owner to buy it + pick TestFlight vs ad-hoc, then it's an L mobile-only phase. iOS reliability
is confirmed first-class EXCEPT the guaranteed-24/7-after-force-quit/reboot tracker (Android-only). Phase 57 (offline, XL) and
Phase 58 (createdAt, needs owner repro) sit after.

---

**SUPERSEDED (2026-08-17 next-3, all now done/stale — kept for history):**
**Old next 3 (2026-08-17 late handoff):**
1. **Phase 41 app-closed location — NOW #1 (owner, 2026-08-17). Fresh APK cut; DEVICE TEST owed by owner.** Diagnosed:
   the 24/7 recorder was written but the installed APK predated its native modules. Cut a fresh EAS preview APK **v1.9.0**
   (build `86c1406c`, direct `.apk` `https://expo.dev/artifacts/eas/eUcZu5h738F4LbqmNqUHK7k2RZxE7FqlY14A6DY_VXk.apk`) +
   handed the owner a device checklist (Location=Allow-all-the-time, Battery=Unrestricted + accept the once-per-install
   popup, Auto-start ON). **A miss here is usually the OEM battery/auto-start settings, not code.** When the owner reports
   the result, that's the acceptance gate (background records; swipe-away gaps up to ~15 min then the watchdog re-arms).
2. **Phase 50 — home reason-prompt UI + 5-language copy (data-layer already BUILT `6b2da6f`).** Backend Phase 64 shipped
   & verified; `clockIn`/`clockOut` thread `reason` and map `REASON_REQUIRED`; `checkGeofence` is nearest-of-offices. Left:
   turn the `home.tsx:835` hard-refuse into a Sheet prompt that re-sends with the reason (consume `needsReason`), with
   owner-supplied 5-language HUMAN copy, + a device check. **Go-live also needs owner/ops:** set the two pins via
   `PUT /geofence` `offices[]` (Adajan `21.208267,72.839960` · Katargam `21.187084,72.797604`), set
   `N8N_ATTENDANCE_WEBHOOK_URL`, `:3001` restart. n8n behaviour spec already handed to the owner.
3. **New owner backlog (2026-08-17) — see [[owner-backlog-2026-08-17-map-and-app-presence]].** ✅ **DONE (Phase 51,
   2026-08-18):** satellite-view toggle + points show/hide toggle + event-typed pin colours (commit `8eb4858`, above).
   ✅ **Phase 52 (Break button) BUILT 2026-08-18** (`8da2fb8`+`b1cea19`) — owner supplied the break copy same day; 2 buttons
   after clock-in (Break + Clock-out), 8h30m confirm gate, optional-reason sheet, in=green/out=red pins. **Pending backend
   (owner relaying):** `[api]` B1 (store the `reason`) + `[api]` B2 (per-member break-location read → the **orange** break
   pins). Still **backend-first** (file after verifying real code): **app-installed view** (signal =
   **recent location points**, owner choice) and an **off-duty (ambient) points READ** — the app has none today, the
   blocker for the **red/green on-duty/off-duty colouring (old Phase 42)** and the **per-employee clock-in/out path toggle**.

**Phase 62 on-device visual pass — still PENDING** (contract GO-LIVE VERIFIED; build `fc92573`; walk
`docs/spec/PHASE-62-DEVICE-CHECK.md`; do NOT mark passed until the owner confirms "testing pass hai").
**Phase 49 — final APK → OTA-only** still GATED on the `git push` 403 + device checks clearing.

_History below is retained for context; where it lists 41b–41d / 47 / 48 as pending, those are now editor-done (see `## Now`)._

---

**⭐ NEW DRIVING PRIORITY — owner backlog 2026-08-14. Full roadmap: `docs/PLAN-2026-08-14.md` (Phases 34–48).**
The owner handed a concrete feature backlog: per-member 200 m clock-in geofence; strict salary from
hours/days; completed-tasks report + performance score (assigned-and-completed only, not reminders); a
**Master-only** monitoring side (performance + location + salary, no tasks) for 3 specific phone numbers;
guaranteed 24/7 background location on any device with green(in-shift)/red(outside) route colouring;
Master-only location visibility; a self-created-task-not-visible bug; a touch-freeze/AppLock bug; notification
mark-read + bell-dot clear + a hardcoded-vs-DB audit; Viewing-as restricted to one number; greeting emojis; and
biometric-only session restore after logout. **These are PLANNED, not built.** Cross-cutting rules baked into
the plan (do not violate): role-by-identity = DB `Profile.role`, **never** a client phone literal (Phase 11);
the app **never computes money** (salary is a backend formula); **verify the real backend before filing**
(tags wrong 5×); never invent numbers/fields; flag security-sensitive items. **The three audits, the first
feature, the head of the master chain, the location gate, the consent layer AND the per-member geofence are now
DONE — Phases 34 (backend-fixed, `cgpe-api` Phase 40), 35 (AppLock touch-freeze, mobile-fixed), 36 (hardcoded-vs-DB
sweep — bucket-a EMPTY, no code change), 37 (notification mark-read + bell dot, `[m]` only), 38 (master role via DB
`Profile.role`, VERIFIED + filed, zero code), 40 (live-location visibility gated to real `super_admin`, `[m]`
only), **41a** (consent data layer + 5-lang copy + screen + boot gate) + **41a-iii-b part 2** (unified 24/7
recorder, EDITOR-BUILT / DEVICE-UNVERIFIED, `16e75ae`), **43** (per-member 200 m clock-in fence — filed →
`cgpe-api` SHIPPED same-day as Backend Phase 50 → VERIFIED against real code, mobile ZERO change), and **44**
(strict salary from hours/days — VERIFIED already-satisfied by Backend Phase 25b, owner-confirmed as-is, ZERO
code), and **45** (completed-tasks report + performance score — filed → `cgpe-api` SHIPPED same-day as Backend
Phase 53 → VERIFIED against real code → mobile READER + RENDER built: `performance.tsx` self + master-only team,
owner-locked visibility) — see `## Now`, AND **39** (Master monitoring HUB `monitor.tsx` — DONE 2026-08-15,
commit `2750794`). What remains is **device verification** (41 part-2, 43, 45, 46, 39), **Phase 41's on-device
build** (owner's #1), **47** (Viewing-as → one number, needs an owner/backend flag decision), **48** (biometric),
and finally **49** (final APK + one-click link → OTA-only updates, the very last step). Owner marked **Phase 41
#1** (2026-08-15) — but its remainder is device/build-gated, not editor code.**

**🔺 OWNER ESCALATION — Phase 41 (24/7 background location) is #1. RE-CONFIRMED 2026-08-15 (Phase 39 now done).**
⚠️ **Phase 41's remaining work is DEVICE + EAS-BUILD-GATED, NOT editor-buildable** — the editor half (41a + 41a-iii-b
parts 1 & 2) is already built and device-unverified (`16e75ae`). So "#1 priority" here means the next **on-device**
session (fresh EAS/dev-client build + the §12.7 acceptance matrix on a real handset), not more editor code. If working
editor-only, the next editor-actionable item is **Phase 47** (Viewing-as → one number, needs the owner/backend flag
decision first). The owner asked whether
member location is tracked 24/7; it is NOT — today's `lib/tracker.ts` records only a **clocked-in shift**
(`startTracking(sid)` on clock-in → `stopTracking` on clock-out; it survives app-close/background during the
shift via the Android foreground service, but records nothing between shifts and refuses any fix it can't
attribute to a session). The owner wants continuous capture, so Phase 41 is pulled ahead of the master surface
(39). Dependency-consistent: 41 depends on nothing and 39's location element consumes 41/42 anyway.

1. **Phase 41a-iii-b part 2 (→41b/c/d, →42) — the `tracker.ts` device pieces (a build-and-device session).**
   41a-iii-**a** (the `getLocationConsent()` read) AND **41a-iii-b part 1** (the `_layout.tsx` boot-gate
   redirect + pure `needsConsentGate`, fail-open, tested) are now BUILT — see `## Now`. **Next = the device
   remainder**, which is NOT editor-buildable: `expo-intent-launcher` is not installed and
   `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`/`RECEIVE_BOOT_COMPLETED` are absent from `app.json`, so it needs a
   fresh EAS build + a handset. **Follow the decision-complete plan `docs/spec/PHASE-41.md` §12** (architecture
   LOCKED: ONE unified 24/7 recorder — `sid`⇒shift `/track/points`, no `sid`⇒ambient `postAmbientPoints`
   `off_duty`; graceful-degrade to shift-only when un-consented; battery-opt step; persisted-i18n
   notification). Then 41b (boot-receiver plugin + watchdog), 41c (battery/activity), 41d
   (anti-circumvention). ⚠️ `tracker.ts` has NO test coverage (device-only — "looks fine in foreground, breaks
   only after a process kill"); the boot redirect changes app entry for EVERY user (verify on a handset).
   Backend Phase 43/45 is now committed + LIVE on `:3001` (`909b117`), so the Phase-34 "don't wire before live"
   trap is CLEARED — part 2 is device/build-gated only. Original audit
   scope below still applies — `lib/tracker.ts` (module-scope task, `_layout.tsx:18` load-bearing import) + the
   "Allow all the time" background-permission flow + the SecureStore buffer + delivery to `/track/points`
   (Phase 7 flagged the server silently DROPS
   fixes with accuracy > 100 m while the app records at `Accuracy.Balanced` ~100 m — likely an `[api]` fix).
   ⚠️ **The current shift-bound design is deliberate** (attributability, battery, and — critically — privacy):
   a route is tied to a session so one person's location can't land on another, and off-shift fixes are dropped.
   **True 24/7 (tracking staff during personal/off-duty time) is a policy + DPDP-consent decision the owner must
   make explicitly** (rule 5 — security-sensitive) before it is built; it is NOT a pure code change. First step:
   confirm with the owner what "24/7" means — (a) reliably capture the WHOLE shift even when the app is killed on
   any handset (Samsung/Xiaomi aggressive battery killers included), or (b) literally always-on beyond shifts —
   and the consent/notice model. Then `tsc`/`test` green + a real multi-device check (`tracker.ts` has NO test
   coverage — device-only). See `docs/PLAN-2026-08-14.md` §Phase 41/42.
2. **Phase 39 — the master surface. ✅ DONE 2026-08-15 (commit `2750794`, local).** Built the Master-only monitoring
   HUB `src/app/monitor.tsx` (owner-locked shape, pushed from More) — a lens grid (Locations/Movement/Performance/
   Payroll, each opening its existing master-gated screen) over the `getTeam()` roster, no task UI, gated on the REAL
   `super_admin` via new pure `canMonitorTeam`. Reused the Phase-40 location screens + Phase-45 `performance.tsx`
   rather than rebuilding. Gates green (491/491). Device check carried. See `## Now` + `docs/spec/PHASE-39.md`.
   **Next editor-actionable is Phase 47** (Viewing-as → one number — needs owner/backend flag decision).
3. **Phase 49 — [build][ops] final APK + one-click link, then OTA-only — the LAST phase, but GATED, not
   editor-buildable.** ALL feature phases (34–48) are now built editor-side. Phase 49 pre-flight (all must be true
   FIRST): every carried device-verification check cleared on a real handset, AND the **`git push` 403 resolved**
   (a production build must ship from pushed, backed-up code, not local-only commits). Until those hold there is no
   new editor code — the remaining work is on-device verification + the ops fixes (push access + the signing key +
   acknowledging that OTA covers only JS/asset updates; Phase 41 already added a native module, so ≥1 more native
   APK build is due before the "final" one). See `docs/PLAN-2026-08-14.md` §Phase 49.
   **Phase 48 (biometric-only restore) is DONE editor-side — see `## Now`.**

**Every feature phase 34–48 is now built editor-side.** Phase 47 (Viewing-as → Master-only) DONE; Phase 48
(biometric-only restore) DONE editor-side — cgpe-api shipped the re-mint endpoint (Backend Phase 58), verified +
mobile restore flow built (513/513). **What remains is entirely GATED, not editor code:** the device-verification
backlog on a real handset — **41 part-2** (24/7 recorder), **43** (per-member geofence), **45** (both performance
screens), **46** (emoji alignment), **48** (biometric restore + security review) — several needing cgpe-api's
`:3001` restart for live data; and the **`git push` 403 fix**. Only after ALL of that: **Phase 49** (final APK →
OTA). Full dependency order + `cgpe-api`/owner-DB asks per phase in `docs/PLAN-2026-08-14.md`.

---

**Background fill (density rollout) — the big levers are done; what's left batches by area.** Phase 29 shipped the
`theme.density` mechanism + migrated `(tabs)/clients.tsx`; Phase 30 the three other list tabs
`tasks`/`leads`/`claims` (commit `d70da17`); Phase 31 the shared list primitives `ui/data.tsx` +
`ui/identity.tsx` (commit `2dd37fe`); Phase 32 the remaining shared primitives `ui/base.tsx` +
`ui/controls.tsx` + `ui/feedback.tsx` + `ui/sheet.tsx` (commit `2b50aaf`); **Phase 33 (2026-08-14) migrated the
Home dashboard `(tabs)/home.tsx`** (commit `f754843`) — the last big single-file lever. The four list tabs,
all the shared primitives and Home now react to compact. **~68 files remain** — no single dominant one left:
the other `ui/` modules (`spine`/`swipe`/`Confirm`/`JobPill`/`health-banner`/`AppLock`/`Splash`) and the ~40
flat stack-route screens (`client/[id]`, `lead/[id]`, `attendance`, `search`, `settings`, …), each still
rendering its own layout comfortable until migrated. Each migration is a ≤8-file phase using the PHASE-29
**D-2** pattern — `const { spacing, radius, font } = c`, strip the static import (`tsc` flags any miss), and
handle three non-mechanical shapes as helper/hooks/fallbacks: **module-scope** scale consts (make a helper, as
`data.tsx`'s `pillFs`/`controls.tsx`'s `btnFs` did), **default parameters** that captured the scale (optional
prop + `?? c.<scale>`, as `Txt`/`Skeleton` did), and components with **no `useTheme()` at all** (add the hook,
as `KpiStrip`/`GlassCard`/`Row` needed). These can be batched by area (all detail screens, all settings-family
screens). No backend, no copy — buildable today. See `docs/spec/PHASE-33.md` + `docs/spec/PHASE-29.md`.

**Also still available (lower priority than the owner backlog above):**

- **Phase 27 — per-business-department layouts (`resolveRoleKey` widening). ANSWERED by `cgpe-api` —
   SHIPPED as their Phase 34 (2026-08-12); mobile verification now editor-buildable.** A pure backend change
   (mobile has no resolver, renders any `role_key` fail-open — **nothing mobile-side to build**). `cgpe-api`
   shipped exactly the recommended non-regressive candidate-key chain `candidateRoleKeys = [deptKey, role,
   'advisor']` (first key with a stored doc wins) + a `canonicalizeDepartment`-derived `DEPT_KEY` map
   (`HEALTH INSURANCE→health_insurance`, …; `sales`/`operations` byte-identical), all four mobile guarantees
   met, contracts (`api.md` §`/app-ui` + `enums.md` §4.1) updated; INBOX box `[x] answered`. **Next
   (editor-buildable now):** verify the shipped mechanism against their real `routes/rbac.js`
   (`candidateRoleKeys`/`chooseAppUiKey`), confirm a new dept key renders fail-open on device with zero
   `src/` change, then widen the Phase-26 seed script to the new keys for the owner to run. See DECISIONS
   2026-08-12 (Phase 27) + the answered INBOX item.

- **Phase 26 — More-tab grouping DB-driven (`nav.more_sections`). BUILT 2026-08-12 (part b); a device
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
| 47 | "Viewing as" is Master-only | **Built** 2026-08-15 — owner-locked (AskUserQuestion): gate the More tier-preview row on the REAL `super_admin` role, not `realCaps.manageTeam` (which leaked it to every admin+leader) and not a phone literal (rule 1). NEW pure `canViewAs` in `roles.ts` (4th `super_admin` predicate); `more.tsx` swap; +4 `roles.test.ts` cases. `tsc` 0 · `npm test` **495/495** (+4) · eslint 0 errors. Pure `[m]`, no `[api]`/contract. Commit `3baf05d` (local). Device check carried (admin+leader lose row, master keeps it) |
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
