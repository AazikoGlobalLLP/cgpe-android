# Owner backlog — 2026-08-21 — triaged (mobile / backend / admin / data-OPS)

Owner walkthrough after installing the push-enabled APK (`0d68ac07`, commit `ce9b1e6`). Every item below is
classified by OWNER of the fix. **`[m]`** = cgpe-mobile (this repo). **`[api]`** = cgpe-backend-main. **`[admin]`** =
cgpe-front-main-RECOVERED. **`[data/ops]`** = owner/DB/infra, no code. **`[verify]`** = must confirm against real code
before building. Nothing here is built yet — this is the triage the owner asked for.

Deploy reality (verified this session): backend deploy gap is CLOSED — `origin/main` = `10e1f76`, all Phase 41–79
endpoints live on prod (401 = live). The ticket→team_tasks mirror `cb3f9de` IS on origin/main. So most "not working"
items are NOT a deploy gap; they are real mobile-render or backend-data or config issues.

---

## A. Tasks / clock-in / progress

| # | Item | Owner | Note |
|---|---|---|---|
| A1 | Ticket "I'll handle this" → task shows in **Home/Today** but NOT on the **clock-in location screen** | **[m]** `[verify]` | Home hero and the clock-in card read different task sources. Find which list the clock-in widget queries vs Home; the ticket-mirrored `team_tasks` row is live (`cb3f9de`). |
| A2 | Tasks tab **"Today's Progress = 0 / nothing scheduled"** despite the task existing | **[m]** `[verify]` | `dueBucket`/`taskProgress` in `(tabs)/tasks.tsx` likely buckets the mirrored task as unscheduled (missing due/schedule field). Check the backend `team_tasks` shape vs the app's Today filter. |
| A3 | **Present/absent** attendance not working well | **[m]+[api]** `[verify]` | Verify `/attendance/history` data (backend sources `daylogs`) and `attendance.tsx` rendering. Could be data or render. |

## B. Master monitoring / live location / map  (the hardest cluster)

| # | Item | Owner | Note |
|---|---|---|---|
| B1 | **Master detailed breakdown** — master panel shows an overview, owner wants it in DETAIL | **[m]** | `screens/dashboards.tsx` (Master dashboard) is presentational — expand to a detailed per-member breakdown. |
| B2 | **Live button for an OFF-DUTY (not-clocked-in) person** — can we see their live location now? where/how? | **[m]+[api]+[data/ops]** | Off-duty tracking = Phase 41 (24/7 CONSENTED location). It only works if that person GRANTED always-on bg-location consent AND the bg tracker runs (needs the new native APK + their permission). "No recent location … needs consent and bg permission" is HONEST/by-design, not a bug. To actually see it: (a) person consents + grants bg permission, (b) app bg-tracker active, (c) backend serves their last point (gated to super_admin). Verify the backend endpoint returns off-duty last-location for a consented user. |
| B3 | Map can't distinguish **BREAK-time vs OUT-time** location (in-time maybe shows) | **[m]+[api]** `[verify]` | Break pins exist (Phase 52 orange via `getBreakLocations`). "OUT time" (after clock-out) has no distinct layer. Verify what the backend stores post-clock-out; add a distinct map layer/legend. |
| B4 | **Pavitra** member — nothing shows though they went out WITH clock-in | **[api]+[m]** `[verify]` | Data question first: did Pavitra's track points upload to the backend? (accuracy>100 m are dropped server-side; a session-less batch is discarded.) Then the Phase 65 roster join-by-NAME — a name mismatch would hide them. Verify backend has their points before touching the app. |
| B5 | Agent-locations shows **"1 on duty, 1 tracked"** — owner wants **ALL members + all locations** | **[m]+[api]** `[verify]` | Phase 65 already left-joins full staff into the roster. Two truths: (i) a member with NO shared location has nothing to plot (you can't show a location they never sent); (ii) the roster LIST should still show everyone. Verify why only 2 appear — is `/live-locations` returning all staff, or is the app filtering to those with points? |

**B-summary:** live/off-duty location is genuinely cross-cutting — backend endpoint + mobile consent/render + a device
running the bg tracker (new APK) + each person's consent. It is NOT a one-file mobile fix.

## C. Clock-in / break / clock-out flow

| # | Item | Owner | Note |
|---|---|---|---|
| C1 | **Break** button → keyboard does not appear (reason Sheet) | **[m]** | `autoFocus`/focus-on-mount bug in the break-reason `Sheet` TextInput (Phase 52). Mobile-only fix. |
| C2 | **Clock-out** doesn't ask a reason when the shift is short (owner: "< [X] hours → ask reason") | **[m]** | Phase 50's clock-out reason PROMPT UI was the documented remaining mobile piece (backend reason endpoint already shipped, Backend Phase 64). Wire the prompt in `home.tsx`. Confirm the hour threshold with owner (earlier spec = 8h30m break gate + 15-min early-clock-out buffer). |

## D. Roles / navigation / cleanup

| # | Item | Owner | Note |
|---|---|---|---|
| D1 | **Role-based sections** — operational person must NOT see sales (leads/prospects); sales must NOT see operational (claims/tickets) | **[admin]+[api]+[m]** | Mobile ALREADY honors `nav.hidden`/`nav.tabs`/`more_sections` per department (Phases 10/26). So this is mainly a CONFIG job: set the per-department UI-RBAC in the **admin panel** (writes `PUT /rbac/app-ui/:roleKey`), backend enforces module access. Verify leads/prospects/claims/tickets are all gateable modules; then it's data, not app code. |
| D2 | **Remove Clients section** for team members; global search shows a client ONLY when searched (no full client book to team); global search includes everything | **[m]+[api]** | Hide the Clients tab per-department (config, D1). "Only searched clients" = mobile search UX + the client list endpoint scope. Global search "include everything" = extend `search.tsx` collections. Partly config, partly mobile, partly backend scope. |
| D3 | **Move "Overdue & quick-info"** options above, in the team-members screen | **[m]** | UI reorder in `team/index.tsx`. Mobile-only. |
| D4 | **Tasks in CALENDAR view** with toggles (today / this week / this month / calendar), default = calendar | **[m]** | New task-view feature in `(tabs)/tasks.tsx` (+ maybe reuse `calendar.tsx` date-spine). Mobile-only, sizeable. |
| D5 | **Typo-tolerant / fuzzy** global + master client search | **[m]+[api]** | `search.tsx` already has a client-side fuzzy scorer for leads/claims/tasks; clients/tickets are SERVER-searched, so typo-tolerance there = backend fuzzy/`$text`/Atlas-search. Mixed. |
| D6 | **Clean, simple UX for non-tech team members** — remove clutter, easy adoption without hesitation | **[m]** | Broad mobile design pass (spec-lock with the owner on exactly what to hide/simplify — undefined-adjective request, needs numbers/criteria first). |

## E. Data / OPS / reports  (NOT mobile code)

| # | Item | Owner | Note |
|---|---|---|---|
| E1 | **Remove test data** from EACH AND EVERY DB collection | **[data/ops]+[api]** | Backend/owner DB operation. ⚠️ Data-safety: this is destructive and touches the LIVE book — must be done deliberately by whoever owns the DB, with a backup first. NOT a mobile task; the app fabricates no data (verified — `mock.ts` is empty by policy). |
| E2 | **Generate report** — no report generates anywhere | **[api]+[data/ops]** `[verify]` | `reports/monthly` is live (401) but on-demand `POST /reports/pdf` needs the droplet env `CGPE_REPORT_RENDER_URL` + `CGPE_REPORT_SECRET` + the n8n `cgpe-report-render` template. Almost certainly the render webhook/env is unset on prod, not an app bug. Verify env + n8n; the app's `generateReport` returns null honestly on failure. |

---

## Owner-facing summary (who does what)

- **Mobile (my work), buildable now:** A1, A2, B1, B3(render), C1, C2, D3, D4, D6, and the app-side of B5/D1/D2/D5. Several
  are real features/phases, not quick fixes — especially D4 (calendar tasks), D6 (UX overhaul), B1 (master detail).
- **Backend (cgpe-api), owner relays:** A3(data), B2/B4/B5 endpoints, B3(data), D5 server-fuzzy, E2 report env, and enforcing D1.
- **Admin panel (cgpe-admin):** D1 — set each department's visible modules in the UI-RBAC screen (this is the lever that
  makes "operational hides sales / sales hides operational" real; mobile already obeys it).
- **Data/OPS/owner:** E1 (test-data cleanup — destructive, do with a backup), E2 report env, B2 off-duty consent + the
  new native APK, and the still-pending **FCM key upload** for push delivery.

## Not-yet-decided (needs owner spec-lock before building)
- C2 exact hour threshold for the clock-out reason.
- D6 exact list of what to hide/simplify for team members.
- B2/B5 owner's expectation vs the platform reality that a location can only be shown if the person consented + shared it.

---

## F. Reliability — "the app won't open on some networks" + the hidden-loophole hunt ⚠️ HIGH PRIORITY (owner, 2026-08-21)

Owner report: on **his home WiFi AND his mobile data**, the app does not open / work. He believes several
WiFi/networks are **blocking the app**, and that there are **many more loopholes we haven't found yet** —
all to be found and solved. Flagged **high priority**.

**What is ALREADY true (so the next session does NOT re-derive it):**
- The old aggressive **4.5 s** timeout is GONE — Phase 55 raised `REQUEST_TIMEOUT` to **12 s**,
  `LOGIN_TIMEOUT` to 15 s, and added one auto-retry for idempotent reads (`src/constants/config.ts`).
- There is **no network-type check anywhere in `src/`** — the app never requires WiFi or mobile data;
  native always targets `https://cgpe.in/internal/api`.
- The **splash does NOT wait on the network**: `_layout.tsx` clears it on `ready` (auth token loaded from
  *storage*) + `fontsReady` (bundled faces) + the animated splash — all local. Every startup network call
  (`/rbac/app-ui`, consent, push-register, calendar, queue-flush) is **fail-open / best-effort** and cannot
  hang the splash. So "splash spins forever because the network is down" is NOT expected from the current
  code — which is exactly why the report needs a real on-device look rather than a blind timeout bump.
- Backend is healthy, **IPv4-only**, ~40 ms (`curl https://cgpe.in/internal/api/health`).

**THE ONE QUESTION THAT SPLITS THE DIAGNOSIS (get from the owner / a device FIRST):** when it "doesn't
open", does the app (a) **crash/close** immediately, (b) **hang on the splash/logo** forever, or (c) **open
but every screen is empty with the red outage banner**?
- (a) crash → launch-time native/JS error, likely device/OS-specific and **network-INDEPENDENT** →
  capture `adb logcat` on the failing device (USB/ADB works from here — see CLAUDE.md).
- (b) splash hang → something in boot IS awaiting the network despite the above, or a font/asset/storage
  read stalls → repro with `adb logcat`; hunt an un-timed `await` in the boot path.
- (c) opens-but-blank → the network genuinely can't reach `cgpe.in` → **definitive test: open
  `https://cgpe.in/internal/api/health` in the phone browser ON that WiFi/data.** If it fails there too it's
  the network/ISP/DNS/captive-portal/droplet, not the app — but the app should still fail *gracefully*.

**Why "both WiFi AND mobile data" is the key oddity:** mobile data reaching no public HTTPS host is
unusual. Suspects to rule out before touching `src/`: an **old/broken installed APK** (confirm the
on-device `base.apk` SHA-256 vs the EAS artifact — every `preview` build is `v1.10.0`, so version strings
can't tell builds apart), a **DNS/IPv6 issue** (backend is IPv4-only — an IPv6-only data APN could fail
name/route), or a **device-specific launch crash**.

**F1 = [m] + [verify]** — needs an on-device diagnosis pass (USB/ADB `logcat` + the browser health test on
each failing network) BEFORE any code change. Do NOT rebuild an APK to "fix WiFi" before that on-phone test.

### F1 — CODE-SIDE AUDIT DONE (Phase 76, 2026-08-21) — read this before touching `src/`

The boot path was re-audited line-by-line (not assumed from the earlier prose). Findings are conclusive:

- **The splash gate `!ready || !fontsReady || !splashDone` is 100 % network-INDEPENDENT.** A dead or slow
  network CANNOT hang the splash — hypothesis (b) is ruled out by the code:
  - `auth.ready` flips true after **local** SecureStore/AsyncStorage reads only (`store/auth.tsx` mount effect;
    `setReady(true)` sits in the `finally`) — no network call in the path.
  - `fontsReady` is bundled Geist TTFs; `useFonts` returns `loaded || !!error` (`theme/fonts.ts:37-40`), so it
    resolves true even if a face fails to decode. No network.
  - `splashDone` is an **unconditional** `setTimeout(onDone, 1900)` (`ui/Splash.tsx:34`) — fires regardless.
  - `AppUiProvider` **always renders its children** (`store/appUi.tsx:535`); it never withholds `RootNav`
    behind the `/rbac/app-ui` fetch. Every root gate (Consent/Push/Calendar/QueueFlusher/PermissionMonitor) is
    `void`-ed / best-effort and fires AFTER first paint, so none can block boot.
- **Login on a dead network is honest and bounded** — POST, single attempt, aborts after `LOGIN_TIMEOUT`
  15 s → throws `NetworkError` → login screen clears the spinner (`(auth)/login.tsx:156`) and shows an
  "offline" Banner + Retry. It does NOT spin forever.
- **Reads on a dead network** retry once (600 ms) then throw → `tryReal` reports the outage → empty result +
  the red `<HealthBanner/>` (the honest option (c)).

**So "won't open" reduces to only two code-consistent shapes:** (a) a launch **crash** — which is
network-INDEPENDENT, so it would fail on EVERY network, fitting only an old/broken installed APK (confirm by
`base.apk` SHA-256 vs the EAS artifact) or the fact he only ever uses those two networks; or (c) the app
**opens but cannot reach `cgpe.in`** on those networks (signed-in → empty screens + red banner; signed-out →
login shows the offline banner). In case (c) the app is already failing gracefully — the fault is the network,
not the app, which is exactly why a blind APK rebuild fixes nothing.

**NEW LEADING HYPOTHESIS for "mobile data too" → [api]/OPS, not [m]:** `cgpe.in` has an **A record but NO
AAAA record** (verified 2026-08-21 via Google 8.8.8.8; `curl -6 https://cgpe.in/...` → "could not resolve
host"; IPv4 `72.61.233.113` answers 200 in ~40-190 ms). An **IPv6-only carrier APN** (common on Jio in India)
with no NAT64/DNS64 cannot route to an IPv4-only host, while every dual-stack app keeps working — a clean fit
for "his mobile data fails but other apps are fine." **Fix is server-side: add an AAAA record + enable IPv6 on
the droplet/nginx (or confirm the carrier path has NAT64).** CONFIRM with the browser test below before filing.

**THE ONE OWNER TEST THAT SETTLES IT (do this FIRST, no code):** on each failing network, open
`https://cgpe.in/internal/api/health` in the **phone browser**. Fails there too → it's the
network/DNS/IPv6/captive-portal/ISP (not the app) → the IPv6/AAAA fix above or a different network. Loads there
but the app still fails → THEN it's app-side → connect USB and capture `adb logcat` at launch. Also get the
crash-vs-splash-hang-vs-empty-banner answer (a/b/c) — but note (b) is already ruled out by the audit above.

**F2 — the systematic loophole hunt ("many more we can't find").** A proactive sweep for hidden edge cases:
every write path's failure honesty, every empty-vs-outage branch, timeout/retry on a slow network,
offline-queue correctness, permission-denied paths, shared-handset leakage, cold-start/route-restore. Best
run as a **multi-agent review workflow** (parallel finders per module → adversarial verify) — this needs the
owner to opt in ("use a workflow" / "ultracode") since it spawns many agents; until then it is a manual,
module-by-module audit.
