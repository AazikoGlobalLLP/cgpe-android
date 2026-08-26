@AGENTS.md

# CGPE Connect — Android (Expo SDK 57 · RN 0.86 · expo-router · TS strict)

Session name in `../contracts/INBOX.md`: **`cgpe-mobile`**.
Siblings: `../cgpe-backend-main` (`cgpe-api`), `../cgpe-front-main-RECOVERED` (`cgpe-admin`).
Start every session with `/boot`. Map: `docs/PROJECT_MAP.md`. Plan: `docs/PHASES.md`.

## Contracts
- ../contracts/ is the single source of truth for anything crossing frontend ↔ backend ↔ android.
- Never invent a field name, endpoint, status value, or error code. Read ../contracts/ first.
- Changing the contract = edit ../contracts/*, append to CHANGELOG.md, THEN change code.
- If code and contract disagree, the contract wins and the code is a bug.
- Base URL is `https://cgpe.in/internal/api`, so an app path `/leads` is backend `/api/leads`.
- `ADMIN_PANEL_SYNC.md` / `ADMIN_PANEL_GUIDE.md` are prose; where they disagree with `contracts/`,
  contracts wins (`contracts/CHANGELOG.md` lists 15 confirmed drifts).
- **`contracts/` is written concurrently by `cgpe-api` and `cgpe-admin` while you work.** `INBOX.md`
  went 4.7 KB → 25 KB inside one session. **Re-read immediately before editing**, and never conclude
  a file there is missing or empty from one directory listing — check again with an explicit path.
  Confirmed again 2026-08-10: item headings moved between two reads **minutes apart**, so
  **anchor every edit on surrounding text, never on a line number**, and expect an offset-based
  insert to land in the wrong item. `INBOX.md` went 77 KB → 103 KB inside the Phase 4 session
  alone. Answer questions addressed to `cgpe-mobile` even when they are not about your current
  phase — they block the sibling session's phase.
- **Put the answer under the box that is blocking.** Phase 4 found two `cgpe-mobile` boxes still
  open whose answer had been written weeks-equivalent earlier under a *different*, multi-recipient
  item — so `cgpe-api` read "mobile has not answered" and held a phase. Say it twice rather than
  once in the wrong place. Tick a box only when the item is addressed to this session alone;
  otherwise reply underneath and say why the box is left open.
- ⚠️ **A concurrent write can DELETE your replies, not just move them.** On 2026-08-10 `INBOX.md`
  went 116,824 → 111,088 bytes inside one boot, and the ~5.7 KB it lost was three `cgpe-mobile`
  Phase-4 replies — including **two ticked boxes that reverted to `[ ]`**, so `cgpe-api` would have
  read mobile as never having answered. **After writing to `INBOX.md`, grep your own reply back**
  (`grep -c "Phase N]" INBOX.md`) and re-write it if it is gone. There is no undo — see below.
- ⚠️ **`../contracts/` is not under version control by anyone.** The parent directory
  `CGPE-CURRENT-PROJECT/` is a git repo with **zero commits** and `contracts/` is untracked in it,
  so every INBOX reply exists only on that disk. Do not assume it is backed up, and do not create
  that first commit yourself — it would sweep three project trees into one repo.
- 🔴🔴 **NEVER EDIT `INBOX.md` WITH A PYTHON/NODE SCRIPT THAT OPENS IT FOR WRITING. This DESTROYED the
  file on 2026-08-26 (685,032 bytes → 0).** `io.open(p,'w')` / `open(p,'w')` **truncates the file the
  instant it is opened** — so when the very next line (the `.write()`) throws, the file is already
  empty and there is no undo, no git, no VS Code local history, no shadow copy. The specific killer:
  a `UnicodeEncodeError: surrogates not allowed`, caused by writing an emoji into the string as **two
  separate `\uXXXX` escapes** (`"\ud83d\udd34"` is a surrogate PAIR, not a character — Python accepts
  it in a `str` and refuses to encode it). Any exception at all would have done the same damage.
  **The ONLY sanctioned ways to edit `INBOX.md`:** (a) the **Edit tool** with a unique surrounding-text
  anchor (the normal path — the file is >256 KB so `Read` it with `offset`/`limit` around the anchor
  first, e.g. `grep -n "^## Protocol"` then `Read offset=<n-8>`), or (b) **append-only** `cat >> file`.
  If a script is genuinely unavoidable: read as **bytes** (`open(p,'rb')`), build the new bytes, write
  to a **temp file**, assert the temp is LARGER than the original, and only then `shutil.move` it over.
  Never write in place. And **always `cp INBOX.md INBOX.md.bak` first** — it costs nothing.
  After ANY write, grep your own text back (the existing rule above), and also check `wc -c` is
  ≥ the size you started with.
  *(Recovery, if it happens again: the content is reconstructible from the Claude Code transcripts at
  `C:\Users\A\.claude\projects\*CGPE*/*.jsonl` — every session reads INBOX at `/boot`, so scan the
  JSONL for blocks starting `## → cgpe-` and keep the longest copy of each item header. That recovered
  68 items / ~365 KB of the 685 KB. It is NOT byte-perfect: some items are partial and tick marks may
  be stale.)*
- **The owner relays `[api]` asks to the backend and confirms when they are live (proven 2026-08-14, Phase 34).**
  So a *verified* INBOX ask is actionable, not an indefinite block: verify against the real `cgpe-backend-main`
  code FIRST (tags wrong 5×), file the concise ask to `INBOX.md`, **and hand the owner a plain-language copy to
  relay.** This session: mobile filed → owner relayed → `cgpe-api` shipped Phase 40 → mobile verified, all in
  one boot. Do **not** re-describe roadmap `[api]` items (`docs/PLAN-2026-08-14.md`: Phases 37/38/41–45/47/48) as
  "blocked indefinitely." After the owner confirms, re-read the producer's real code before wiring the app side
  — a backend fix can need a `:3001` restart / prod deploy to actually be live, so a device miss ≠ a code bug.
- ⚠️ **"Backend shipped" ≠ live on prod. VERIFY DEPLOYMENT, not just the code (proven 2026-08-19).** The prod backend
  deploys **only `origin/main`** (`cgpe-backend-main/.github/workflows/deploy.yml`), and on 2026-08-19 live `origin/main`
  was `1cad312` (**Phase 38–40**) while every "shipped" backend piece **Phases 41–68** (task-report/perf, break-locations,
  geofence, clock-reason, commissions, the ticket→team_tasks mirror) sat on `shivam`/local `main`, **never merged to
  `origin/main`** — and the ticket-mirror commit `cb3f9de` was on **no remote branch at all** (unpushed). So multiple
  "done" features the owner tested simply **did not run on the device**, and the symptoms read as app bugs but were a
  deploy gap. **Before telling the owner a backend-dependent feature works — or re-diagnosing it as an app bug — confirm
  it is on deployed `origin/main`** (`git -C ../cgpe-backend-main ls-remote origin refs/heads/main`, then
  `git grep <fn> origin/main -- <file>` or `git branch -r --contains <commit>`) and, ideally, that the live endpoint
  answers. Our `git push` is 403-blocked, so **we cannot deploy — file it as an OPS ask and have the owner relay** "push +
  merge to `origin/main` + deploy + restart `:3001`."

## Commands
- `npx expo start --go` — Expo Go. **`--go` is required**; `expo-dev-client` is installed, so a bare
  `expo start` targets the dev build. `--tunnel` for a phone on another network.
- `npx expo start --web` — the only way to reach a localhost backend.
- `npx tsc --noEmit` — a green gate. Run before every commit.
- `npm test` — Vitest, 258 tests over 9 files, ~0.6 s, no network. The second green gate.
  **Run the whole suite with `npm test` — do NOT invoke `npx vitest run <file>` for one file; it fails
  `Vitest failed to find the runner` (the project's runner resolves only through the npm script). To scope to
  one file, pass the path to the script: `npm test -- src/data/__tests__/<file>.test.ts`.**
  Config is `vitest.config.mts`; the four `test/stubs/*` files exist only so native modules
  resolve in Node. **⚠️ NATIVE-MODULE-IN-TEST-GRAPH TRAP (Phase 72/73, 2026-08-20): importing a
  native module WITHOUT a stub — `expo-notifications`, `expo-calendar`, `expo-constants` — from any
  file the Vitest graph reaches breaks Node with `ReferenceError: __DEV__ is not defined` (via
  `expo-modules-core`). `store/auth` IS in the graph (`appUi.test`→`appUi`→`auth`), so it must NOT
  import such a module.** Fix pattern: keep native code in a module ONLY `src/app/_layout.tsx`
  imports (which no test reaches — e.g. `lib/push.ts`, `lib/calendar.ts`, `lib/tracker.ts`) and
  split the non-native slice a test-reached file needs into its own file (`lib/pushToken.ts` holds
  `clearPushRegistration` = storage + a fail-quiet api call, so `auth.tsx` can import IT, not
  `push.ts`). The PURE decision seam always lives in its own tested file (`pushRouting.ts`,
  `calendarSync.ts`, `staleBuffer.ts`, `watchdog.ts`). Add a `test/stubs/*` entry + a
  `vitest.config.mts` alias only if a test genuinely must import through the native module.
  `globals: false`, so every file imports `describe`/`it`/`expect`/`vi` from
  `vitest` explicitly. Some cases deliberately pin **known bugs** and live in `describe` blocks
  saying so — when a phase fixes one, that test going red is the signal, not a regression.
  Phase 3 flipped `api-renewals.test.ts:187` on purpose; Phase 4 flipped two `adapt.test.ts` cases;
  Phase 7 flipped both of `api-geo.test.ts`'s and **deleted that file's now-empty pinned block**.
  The only pinned-bug block left in the suite is `adapt.test.ts`'s `mapClaimStatus` pins.
  `src/lib/tracker.ts` has **no test coverage at all** — there is no `expo-location` or
  `expo-task-manager` stub, so the background recorder is only reachable by hand on a device.
  **A test that touches `src/data/api.ts` must `vi.resetModules()` and `await import('@/data/api')`
  inside `beforeEach`** — that module holds mutable state (`authToken`, `sessionReal`,
  `suppressed`, `state`) with no reset export, so a static import leaks one test into the next.
  `api-leads.test.ts`, `api-whatsapp.test.ts` and `api-renewals.test.ts` are the pattern to copy.
  Timers are faked, so a call that reaches `unavailable()` **must not be awaited directly** — hold
  the promise, `await vi.advanceTimersByTimeAsync(400)`, then await it, or the test times out on
  `wait()`. **⚠️ RETRY-BACKOFF-IN-TEST TRAP (Phase 55, 2026-08-20): `req()` now retries IDEMPOTENT
  reads once** (a bare `req()` = GET; writes pass a method and never retry) **on a throw / 5xx / 429**,
  with a **600 ms backoff `wait()` BEFORE the retry** (`RETRY_ATTEMPTS`/`RETRY_BACKOFF_MS` in
  `config.ts`; pure logic in `src/lib/netResilience.ts`). So a fake-timer test that drives a GET to a
  throw or a 5xx must advance PAST the backoff (`advanceTimersByTimeAsync(2000)`, not 400) or it
  hangs, and a failed-GET `toHaveBeenCalledTimes(1)` is now **2**. Real-timer api tests (api-geo,
  api-commissions, …) pay a real 600 ms per retrying-failure test — the suite went ~0.6 s → ~4 s;
  that's the retry, not a regression. **`501` is EXCLUDED from `isRetryableStatus`** on purpose: it is
  this backend's "endpoint not deployed" quiet answer (like 404), NOT a transient fault — keep it in
  step with `reportIfOutage`. Failure classification now carries a `FailureKind`
  (`timeout`/`network`/`server`) into `data/health`; a kind-less `reportFailure` PRESERVES the last
  kind (the read path reports the same endpoint twice). See `docs/spec/PHASE-55.md`.
- `npm run lint` — **green as of Phase 15 (2026-08-11): 0 errors, 12 warnings.** Rule is still
  **no new errors**. **Takes longer than 120 s**, so it exceeds the default tool timeout — run it in
  the background or raise the timeout, and read the count off the `✖ N problems (…errors, …warnings)`
  line. **`npm run lint` is `expo lint`, which CACHES under `node_modules/.cache` — after you fix a
  warning (e.g. remove an unused import) the stale entry lingers and the count reads one too high.
  Verify a specific file cache-free with `npx eslint <file>`, or the whole tree with `npx eslint src`
  (NOT `npx eslint .` — that pulls in root config files expo ignores and reports phantom errors).
  Phase 41a hit exactly this: a removed `radius` import showed as 13 while cache-free lint confirmed
  12.** The React Compiler is enabled (`app.json` `experiments.reactCompiler:true`), so
  `eslint-plugin-react-hooks` v7 promotes its compiler rules to **errors**; three of them —
  `react-hooks/{immutability,refs,set-state-in-effect}` — are **disabled with a documented reason**
  in `eslint.config.js` because they fire on working Reanimated/Animated code and the app's
  effect→loader→setState data-fetch convention (a rewrite, not a bug). Do **not** re-enable those
  three without rewriting the flagged call sites, and do **not** silence `react-hooks/purity` (kept
  on) — fix its hits at source, as Phase 15 did for the one `Date.now()`-in-render case in `home.tsx`
  (`useState(() => Date.now())`).
  **⚠️ `react-hooks/preserve-manual-memoization` DEP TRAP (loophole-hunt round 3, 2026-08-25): a
  `useCallback`/`useMemo` dep array must match the deps the compiler INFERS, and the compiler infers the
  whole OBJECT a nested read comes from, not the leaf.** If the body reads `user?.id`, the inferred dep is
  `user` — a manual `[user?.id]` is a hard ERROR ("Inferred less specific property than source"). Use
  `[user]`, not `[user?.id]`. This bit twice this session when wiring `attendance.tsx`/`agent-map.tsx` to a
  per-user clock key; `tsc` + `npm test` are BOTH green on the wrong array — only cache-free `npx eslint`
  catches it, so lint the touched screen after adding any hook dep.
- `npm run e2e` — **Phase 18 watchable E2E harness** (Playwright + Expo **web**, lives in `e2e/`,
  outside `src/` so it is invisible to the three gates — `tsconfig` excludes it, eslint ignores
  `e2e/**`, Vitest is scoped to `src/`, EAS never bundles it). Opens a real browser that walks all 42
  web-reachable screens A-to-Z and stress-tests them (injected `500/503/malformed/empty/timeout/
  oversized` + form bad-input), saving video+trace+screenshots to `e2e/artifacts/` (open
  `OPEN-ME.md`). Headed by default (`HEADLESS=1` for CI). Auto-starts/reuses the web server on port
  **8090** (not 8081). ALL traffic is synthetic Playwright mocking — never hits production. The Expo
  web build **boots with no app guard** (native modules already gate themselves for web). Cannot test
  native-only surfaces (haptics, background GPS, biometric lock, native map, cold-start persistence) —
  see `e2e/WEB-LIMITS.md`. `npm run e2e:report` opens the HTML report.
- `eas build -p android --profile preview` — the installable APK (`production` emits an AAB).
- `npx eas-cli build -p ios --profile ios-simulator --non-interactive` — **an iOS build that needs NO
  Apple Developer account** (simulator builds aren't code-signed). Use it to PROVE the iOS native target
  compiles without spending on the Apple account (done Phase 56, build `9649bf51` FINISHED green). The
  artifact is a Mac-only `.app` tarball (`build:view <id> --json` → `.artifacts.applicationArchiveUrl`) —
  it does NOT run on Windows or a phone. A real-iPhone / TestFlight build (`--profile production` /
  `preview`) DOES need the Apple Developer account ($99/yr). Validate iOS app config without any build via
  `npx expo config --type introspect` (runs the config plugins in memory; this is CNG — no `ios/` dir, so
  never hand-edit a plist: `expo-background-task`/`expo-location` inject the iOS background modes for you).
- `npm run reset-project` — **NEVER RUN.** Deletes `src/` and `scripts/`.

**git RESOLVED 2026-08-10 — do not re-diagnose it.** Every git command used to abort with
`detected dubious ownership in repository at 'F:/…/ANDROID'` (the directory is owned by a different
SID than the logged-in user), which is why Phases 1 and 2 went uncommitted for two sessions. The
one-time fix has been applied and is global, so git now works normally here:
`git config --global --add safe.directory F:/Shivam-Aaziko-Dev-MERN/CGPE-CURRENT-PROJECT/ANDROID`.
If it ever reappears (a new machine or a reset global config), re-run exactly that. It is **not** a
corrupt repo, and it is never fixed by re-cloning. Work on branch `Shivam`; never push to `main`.

**✅ PUSH NOW WORKS via a NEW remote (2026-08-20) — do not tell the owner "push is blocked".** The owner
supplied a repo they own and directed pushing `Shivam` there after **every** completed phase (distinct
commit message each time), then `/handoff`. Added as a **separate** remote **`aaziko`** →
`https://github.com/AazikoGlobalLLP/cgpe-android.git`; **`git push aaziko Shivam` succeeds.** Per-phase
workflow: finish a phase → commit with a clear per-phase message → `git push aaziko Shivam` → `/handoff`.
Never push `main`. Never touch/redirect `origin`, rewrite history, or force-push. Do NOT commit the
untracked repo-root `.txt` files or local `.claude/settings.json` unless the owner asks.
**⚠️ The push can be REJECTED `! [rejected] (fetch first)` — the remote now exists on GitHub, so the owner (or the
web UI) can push to `aaziko/Shivam` between sessions (Phase 71, 2026-08-20: a `Update README.md` commit was ahead).
This is NOT the 403 and NOT corruption. `git fetch aaziko`, inspect the divergence
(`git log --oneline aaziko/Shivam..Shivam` and `..aaziko/Shivam`), then integrate with a plain
`git merge aaziko/Shivam --no-edit` and push again. NEVER force-push / rebase / reset to "fix" it — a rebase is
also blocked by the modified `.claude/settings.json` in the tree. Merge only touched README.md; source files stayed
intact. See DECISIONS 2026-08-20.**

**`git push` to `origin` still fails 403 (unchanged) — just don't route through it.** The stored credential
is `reactjsaaziko`; `origin` is `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`, and that account has no write
access. Leave `origin` exactly as it is (the new `aaziko` remote is the working path). `gh` is not installed
here.

**BUT the push-403 does NOT block shipping an APK — EAS cloud build WORKS from here (proven 2026-08-15).**
`npx eas-cli build -p android --profile preview --non-interactive` runs headless: logged in as
`shivam-bhadoriya` (`aazikodevmern23@gmail.com`), the Android keystore already lives on the Expo
server (no credential prompt), and EAS archives the LOCAL working tree, so it ships your local commits
even though `git push` fails. A build takes ~15–20 min (background it). The **installable `preview`
profile emits an APK**; get the **direct `.apk` download URL** with
`npx eas-cli build:view <buildId> --json` → `.artifacts.applicationArchiveUrl` (the plain build-page
URL only shows an Install button when opened ON the Android phone). So when the owner asks for an APK,
you can deliver one — do not tell them shipping is blocked. (`--non-interactive` is required — stdin is
EOF here — and `build:view` does NOT accept `--non-interactive`, only `--json`.)
🔴 **EAS FREE-PLAN BUILD QUOTA IS EXHAUSTED (hit 2026-08-26, Phase 77) — CHECK BEFORE PROMISING AN APK.**
`eas build -p android` now fails with *"This account has used its Android builds from the Free plan this month,
which will reset in 5 days (on Tue Sep 01 2026)"* → `Error: build command failed`, and **no build is created**
(`eas build:list` still tops out at `093a3b33`, 2026-08-25). This is **not** the fingerprint trap below, not a
code fault and not fixable from here — it is **billing, i.e. an OWNER decision**: either wait for the monthly
reset (**1 Sep 2026**) or `eas billing:subscribe starter --account shivam-bhadoriya`. Note the quota is checked
**AFTER** the ~317 MB project archive uploads, so a doomed attempt still costs several minutes — check the plan
first, and tell the owner an APK is blocked rather than saying "shipping works". The editor-side gates
(`tsc`/`npm test`/`eslint`) are unaffected; work can continue, it just cannot reach a phone.
(Consider an `.easignore` at some point — EAS itself flags the 317 MB archive as reducible.)

⚠️ **WINDOWS FINGERPRINT TRAP (2026-08-25, build `093a3b33` v1.10.0):** the build can fail **locally**, BEFORE
queueing, at "Computing project fingerprint" with `UNKNOWN: unknown error, open '…node_modules\react-native-reanimated\
…\index.d.ts.map'` (a Windows file-read error — the build itself is fine, nothing wrong with the code). **Fix:
relaunch with `EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build …`** — the fingerprint is an OPTIONAL local step for
OTA/update matching, which this project does NOT use (no `expo-updates`), so skipping it is safe and the build queues
normally. Also note: **a session teardown kills the local `--non-interactive` "Waiting for build to complete" process,
but NOT the remote build** — it keeps compiling on EAS. On resume, don't relaunch; just `build:view <id> --json` to get
the `status` (`FINISHED`) + the `.apk` URL. **OTA is NOT set up here** — no `expo-updates`/`runtimeVersion`/channel, so
every JS change needs a full APK rebuild; adding EAS Update (baked into a build) is the standing recommendation to end
the rebuild-per-fix cycle.

**ANDROID PUSH / FCM (Phase 74, 2026-08-21) — do not re-derive.** `expo-notifications` is wired; `app.json` has
`android.googleServicesFile: "./google-services.json"` (committed — client config, safe) and the Firebase project is
`com-cgpe-connect`. To make push **deliver**, EAS needs the **FCM V1 SERVICE ACCOUNT key = a JSON** from Firebase Console →
**Service accounts** tab → *Generate new private key* — **NOT** the Web Push / **VAPID** key under Cloud Messaging → Web
config (that's browser push, useless here — the owner grabbed it by mistake once). Keep the Legacy Cloud Messaging API
**DISABLED**; V1 is what Expo uses. The service-account JSON is a **SECRET** — it is gitignored (`*-firebase-adminsdk-*.json`)
and goes ONLY to EAS credentials, never a commit/chat. **`eas credentials` is interactive-only (no non-interactive flag), so
YOU cannot upload it here (stdin EOF)** — the owner runs `npx eas-cli credentials -p android` in a REAL terminal (CLI already
authed as `shivam-bhadoriya` → no expo.dev login/email needed) → Google Service Account → FCM V1 → point at the JSON. If they
hit a Windows "Press any key" loop, that's a terminal keypress quirk → retry in PowerShell, or just verify push by
install+login+create-a-task. The APK itself does NOT need the key (it's server-side at Expo), so build first, upload in
parallel. Push endpoints are LIVE on prod (`/push/register`→401).

**ICON GENERATION — no ImageMagick/sharp here; use jimp in the scratchpad.** The Android **adaptive** icon foreground must be
a **square PNG with the logo padded into the central ~60%** (the launcher mask crops the outer ~33%) — using the raw
`cgpe-logo.png` (827×975, edge-to-edge) as `adaptiveIcon.foregroundImage` gets it cropped/oversized in the app drawer. Fixed
Phase 74 (`5c8ac46`): `assets/images/android-icon-cgpe-foreground.png` (1024² transparent, logo at 60%) +
`android-icon-cgpe.png` (1024² square white main `icon`); splash still uses `cgpe-logo.png`. Regenerate with a jimp script in
the scratchpad (`npm i jimp@0.22.12` there — do NOT add it to the project; `scaleToFit` + `new Jimp(1024,1024,0x00000000)` +
`composite` + `writeAsync`). Do not point the adaptive foreground back at the raw logo.

**⚠️ APPLE ACCOUNT — owner CANNOT buy it (2026-08-21, supersedes the earlier "will get it").** There is NO free
cable-free/permanent/TestFlight/App-Store/iOS-push path — the paid $99/yr Apple Developer Program is the only one, and it's
off the table. Max without paying = a Mac + free Apple ID + cabled `expo run:ios --device` (7-day expiry, ≤3 apps, no push);
for a team of iPhones there is no free scalable route. Do NOT invent a workaround or promise iOS store/push. See
`docs/spec/PHASE-56.md` + memory `phase56-ios-enablement`.

**USB/ADB DEVICE TESTING WORKS FROM HERE (proven 2026-08-19).** The owner can connect the phone by USB and
you can drive it (screenshots, taps, install). `adb` isn't installed → download Google **platform-tools** to
the scratchpad (`.../scratchpad/platform-tools/adb.exe`, a zip, no admin install). The owner must enable
**USB-debugging + authorize the PC + log in themselves** (the app is real-backend-only — no credentials exist
here). Confirm the exact build by **APK hash** (`adb pull` the on-device `base.apk`, its SHA-256 must equal the
EAS artifact — version strings CAN'T tell builds apart: every `preview` build is `v1.10.0` / `versionCode 1`).
**Screen-off drops the ADB session** → `adb shell settings put global stay_on_while_plugged_in 7` while testing,
reset to `0` after. Tap via `uiautomator dump` + parse `bounds`, or screenshot coordinates ×1.17 (device is
1080×2340). **Cannot be driven** (owner-owed, physical): background GPS over a real shift, geofence at a real
place, biometric hardware, real writes (clock-in / WhatsApp send) — those live in
`docs/DEVICE-TESTING-GUIDE-v1.10.0.md`. See DECISIONS 2026-08-19.

**"App doesn't work on WiFi" is almost always the WiFi, NOT the app (validated 2026-08-15).** There is
**no network-type check anywhere in `src/`** (the app never requires mobile data), and the backend is
healthy + fast (HTTP 200, ~40 ms, IPv4-only — verify with `curl -w '%{time_total}' https://cgpe.in/internal/api/health`).
So a WiFi-only failure means that WiFi can't reach `cgpe.in` (captive portal / firewall / no real
internet). The definitive test is the owner opening `https://cgpe.in/internal/api/health` in the phone
browser ON that WiFi. Only if it loads there but the app still fails is it app-side — the
`REQUEST_TIMEOUT` (`src/constants/config.ts`) is **already 12 s + one retry** (Phase 55, 2026-08-20 —
NOT the old 4.5 s), so a timeout bump is NOT the lever. And the splash never waits on the network
(`_layout.tsx` clears it on storage-auth + bundled fonts; startup net calls are fail-open), so a
network-caused splash-hang is not expected — triage on-device first (crash / splash-hang / opens-blank),
see `docs/OWNER-BACKLOG-2026-08-21.md` §F. **Do not rebuild an APK to "fix WiFi" before that on-phone test.**

**⚠️ "Can't reach server" on ALL networks CAN be an IPv6/NAT64 MTU issue — a SERVER fix, not an app bug
(PROVEN on-device 2026-08-22, Phase 76).** Symptom: the app opens fine but every request shows "Could not
reach the CGPE server"; the phone BROWSER loads `cgpe.in` fine; it fails on WiFi AND mobile AND another
hotspot. Do NOT chase it as an app bug or bump timeouts. What it actually is: the app **establishes** a
real TCP+TLS connection to `cgpe.in:443` (visible ESTABLISHED in `/proc/net/tcp`) but the **response never
arrives** and it aborts at `LOGIN_TIMEOUT`/`REQUEST_TIMEOUT` — the app **mislabels a timeout as
"unreachable."** Root cause found via ADB: the owner's phones are on **IPv6-only mobile (interface has only
an IPv6 addr, MTU 1300)** and **`cgpe.in` is IPv4-only (A but NO AAAA)**, so traffic crosses carrier
**NAT64**, and the server's full-size packets get dropped on the reduced-MTU path → the app's TLS stalls
(the browser copes). **Fix is SERVER-side:** clamp the droplet's TCP MSS
(`iptables -t mangle -A POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1200`) — this made
the app work instantly — and the permanent fix is to **dual-stack `cgpe.in` (add an AAAA record + IPv6 on
nginx)**. There is NO clean app-side fix. **ADB device-diagnosis works from here** (proven repeatedly):
`platform-tools` in the session scratchpad; drive the device (screenshots via `exec-out screencap -p`, taps
via `input tap`, dismiss the keyboard with the keyboard's own hide-chevron NOT `keyevent 4` which resets a
form); watch a connection with `cat /proc/net/tcp6 | grep <hex-ip>` (72.61.233.113 = `71E93D48`, :443 =
`01BB`, state 01=ESTABLISHED/06=TIME_WAIT); test path-MTU with `ping -M do -s <size> cgpe.in` (a >1400-byte
DF drop = reduced MTU); a static aarch64 `curl` can be pushed to `/data/local/tmp` (use PowerShell for the
adb push/shell so Git Bash doesn't mangle `/data/...` paths; the static curl can't use Android DNS, so pass
`--resolve cgpe.in:443:72.61.233.113`).

**Write commit messages to a file and use `git commit -F <file>`.** A multi-line `-m` here-string
breaks under PowerShell 5.1 as soon as the message contains a double quote: PowerShell splits it and
git reads the fragments as pathspecs (`error: pathspec 'could' did not match any file(s)`). The body
is left uncommitted and it looks like a git failure when it is a quoting failure.

## Conventions
1. Imports are `@/*` → `./src/*`. Zero `../` imports exist in `src/`; keep it that way.
2. Styling is inline objects off `const c = useTheme()`. `StyleSheet.create` appears exactly once
   (`ui/Splash.tsx`). Never a bare `fontWeight` — use `type()` / `<Txt weight>` / `<Metric>`;
   Android does not synthesise the Geist weights.
3. State is React Context only (`src/store`), fetched with a hand-rolled `let alive = true` or a
   `reqId` guard. No Redux/Zustand/react-query. `useData` exists but one screen uses it — not the norm.
4. A failed request NEVER fabricates data: resolve empty via `unavailable()` in `src/data/api.ts`,
   which reports to `src/data/health.ts` and raises the one global `<HealthBanner/>`. Screens branch
   their empty state on `useDataHealth().degraded` so "no clients" ≠ "could not load clients".
5. New route = drop a file in `src/app`. A new **tab** must be added twice: `<Tabs.Screen>` *and*
   `TAB_META` + `ORDER` in `src/app/(tabs)/_layout.tsx`.
   **⚠️ TYPED-ROUTES TRAP (Phase 67, 2026-08-19): after adding a NEW route file, `tsc` fails on any
   `router.push` to it** — `typedRoutes:true` (app.json) generates the route union into
   `.expo/types/router.d.ts`, which is regenerated **only on `expo start`** (it can be days stale;
   `.expo/` is gitignored). Do NOT `as unknown as Href`-hack it. Regenerate: `npx expo start --offline
   --port 8083` (port 8081 is usually taken by a running dev server → non-interactive mode SKIPS
   rather than prompts, so pass a free `--port`; CI-mode Metro writes the types in ~30 s then you can
   let it exit). Then the clean `router.push({ pathname: '/new-route', params })` typechecks with no cast.
6. **KEYBOARD-SWALLOWS-FIRST-TAP TRAP (Band 2 #2, 2026-08-24).** Any screen with a `SearchBar`/`Field`
   (a `TextInput`) above a **`ScrollView` of tappable rows/buttons** MUST set
   `keyboardShouldPersistTaps="handled"` (and usually `keyboardDismissMode="on-drag"`) on that ScrollView.
   RN's default is `"never"`: while the keyboard is up, the first tap on any child is consumed to dismiss
   the keyboard and **never reaches the child** — the two-tap "feels broken" bug, documented in the code at
   `ui/base.tsx:80-82` and guarded on ~15 screens (`search.tsx:585`, `clients.tsx`, `leads.tsx`,
   `notes.tsx`, login…). `tsc`/`npm test`/`eslint` CANNOT see this — it needs a device or an eye on the
   ScrollView props. The Tasks-tab search shipped missing it and an adversarial review caught it; don't
   repeat the miss.

## Diagnosis discipline (Phase 77, 2026-08-26 — this cost a near-miss)
- ⚠️ **A root cause recorded in `docs/` is a HYPOTHESIS until someone re-reads the code.** Phase 77
  inherited three documents all naming `Appear`'s `cancelAnimation` as the More→Today blank screen,
  and it is **wrong**: `Appear`'s effect deps are constants at every Home call site so its cleanup
  runs only at unmount; react-freeze is OFF (`react-native-screens` ships `ENABLE_FREEZE = false`
  and nothing calls `enableFreeze()`); there is no `unmountOnBlur` and `BottomTabView` only appends
  to `loaded`; and reanimated 4.5's `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS` bakes a settled
  `opacity: 1` into React's committed props within ~1 s. **Shipping the "fix" would have spent an
  APK on a no-op and handed the owner another confident-but-wrong "fixed".** Do not re-file it.
- ⚠️ **A `|| fallback` on a field the BACKEND already defaults is DEAD CODE — check the producer.**
  The LIC "Unnamed" fix was written twice for this reason: `plan_name` is `null` in the seed file,
  but `services/productIngestion.js:121` substitutes `String(d.plan_name || 'Unnamed plan')` on
  ingest, so the wire carries a truthy STRING and `lic-plans.tsx`'s own `|| 'Unnamed plan'` had
  never fired. `tsc` and `npm test` were green on the dead version. **Before writing a fallback for
  "missing" data, grep the sibling backend for what it actually sends** — and verify on deployed
  `origin/main`, not the local checkout.
- **Measure before you believe a size/geometry claim.** Two plausible splash theories died to a
  measurement this session: the "Android 12 circular mask is clipping the logo" theory (the ink's
  minimal enclosing circle is **193 dp** against 192 dp guidance — essentially nothing is clipped),
  and an agent's pixel statistics that did not reproduce. Decoding a PNG is cheap — there is no
  ImageMagick/sharp, but `zlib.inflateSync` in plain node works, and jimp lives in a scratchpad.
- **When a diagnosis cannot be reproduced here, ship the DISCRIMINATOR, not a guess.** For the blank
  screen the deliverable became two zero-build ADB tests that run on the APK already installed
  (`docs/PHASES.md` §"Phase 77 leftovers") — Android's reduce-motion switch takes `Appear` out of
  the picture entirely, and a `uiautomator dump` separates "invisible" from "not rendered".

## Danger zones
- `src/data/api.ts` (1744 lines, 56 importers) — `state` is a write buffer, not seed data.
  `setAuthToken` silently disables all network calls for a token starting `demo-`.
  **⚠️ IN-MEMORY PER-USER STATE MUST BE RESET ON TEARDOWN (loophole round 4, 2026-08-25).** The module
  holds per-user data in JS memory that `store/auth`'s AsyncStorage/SecureStore purge does NOT touch:
  the `state` buffer AND the `clientCache`/`claimCache`/`waThreadCache` Maps. `getClient`/`getClaim`/
  `getWaThread` are **cache-first** (return `clone(cache.get(id))` before any network call or backend
  403), so on a shared handset a cached record leaks to the next user with no server check. The exported
  **`resetApiState()`** empties all of them and is called from `clear()` + `onSessionExpired` (+ the
  `persist()` different-user branch). **If you add another module-scope per-user Map/buffer here, add it
  to `resetApiState()`** — a purge in `store/auth` alone will NOT clear it.
- `src/app/(tabs)/home.tsx` (1915 lines) — the only consumer of `useAppUi()`.
- `src/app/_layout.tsx:18` `import '@/lib/tracker'` is load-bearing; removing it kills background GPS
  on headless wakeups while foreground testing still passes.
- Provider order in `_layout.tsx`: `AppUiProvider` inside `AuthProvider`, `ToastProvider` inside
  `ConfirmProvider` (else `useToast()` is a silent no-op). **Phase 28:** `BrandTheme` sits inside
  `AppUiProvider` and re-provides the department-accented palette via `PaletteProvider` (`theme.tsx`)
  to everything below; the base `ThemeProvider` MUST stay on top. Do **not** "simplify" by moving
  `ThemeProvider` below `AppUiProvider` — it would un-theme the Confirm/Toast overlays. Accent maths
  is pure in `theme/brand.ts` (`deriveBrandPalette`, fail-open by reference). **Phase 29:** `theme.density`
  is now CONSUMED — pure `applyDensity` in `theme/density.ts` (fail-open by reference; `compact` =
  spacing×0.85 / radius×0.90 / font×1.0) is applied by the bridge AFTER accent, and the layout scale now
  lives ON the `Palette` (`useTheme().spacing`/`.radius`/`.font`). But **only MIGRATED code reacts**
  (Phase 29: `(tabs)/clients.tsx`; Phase 30: `(tabs)/tasks.tsx`, `(tabs)/leads.tsx`, `(tabs)/claims.tsx`;
  Phase 31: the shared list primitives `ui/data.tsx` + `ui/identity.tsx` — Pill/StatCard/MetricTile/DataRow/
  ListSection/KpiStrip/ActionTile + PersonRow; **Phase 32: the remaining shared primitives `ui/base.tsx` +
  `ui/controls.tsx` + `ui/feedback.tsx` + `ui/sheet.tsx`** — Button/Field/Card/Banner/Skeleton/Sheet/Segmented
  etc., so those ELEMENTS now tighten on every screen that renders them, though a not-yet-migrated screen's OWN
  layout — its outer padding/gaps — stays comfortable until that screen is migrated too; **Phase 33:
  `(tabs)/home.tsx`** — the danger-zone dashboard, so Home now tightens WHOLE-screen, its own layout included);
  the static `spacing`/`radius`/`font` exports stay = comfortable for the ~68 remaining unmigrated files (no
  single dominant one — the other `ui/` modules `spine`/`swipe`/`Confirm`/… + the ~40 flat stack-route
  screens). Migrate by destructuring the scale off `c` (`const {spacing,radius,font}=c`), stripping the
  static import (`tsc` flags any miss), and handling three non-mechanical shapes as helper/hooks/fallbacks, not
  literals: (a) a **module-scope** scale const → a helper taking the scale (as `data.tsx`'s `PILL_FS`→`pillFs(font)`
  and `controls.tsx`'s `BTN_FS`→`btnFs(font)` did); (b) a **default parameter** that captured the scale (a default
  can't reference the body's `c`) → make the param optional and resolve `?? c.<scale>.<x>` in the body (as
  `Txt`/`Metric` `size`, `Skeleton` `radius`, `SkeletonText` `gap` did); (c) a component with **no `useTheme()` at
  all** → add the hook (as `KpiStrip`/`GlassCard`/`Row`/`ToastProvider` needed) — see `docs/spec/PHASE-33.md` /
  `PHASE-32.md` / `PHASE-29.md` D-2 (a file may need none of the three — `home.tsx` was a straight strip +
  destructure). Do **not** describe `density` as "deferred" again.
- `store/appUi.tsx` `SCHEMA_FEATURE_DEFAULTS` mirrors `ui_rbac_config.json` **by hand** — drifts silently.
  **⚠️ RBAC FLAGS FAIL OPEN — `can('feature')` ALONE cannot restrict an unseeded role (Band 2 #3, 2026-08-24).**
  `canIn()` returns the `SCHEMA_FEATURE_DEFAULTS` value (mostly `true`) when a role config omits a key, and the
  per-role docs are **unseeded** in prod (owner backlog Point 6), so `can('can_create_task')` etc. read **true for
  every tier today**. To actually gate a create/assign/admin affordance FROM a lower tier, AND the flag with the
  role-derived predicate — `capabilitiesOf(user, viewAs).<cap> && (ready ? can('feature') !== false : true)` — the
  caps term is what protects the tier, the flag term lets a future seeded config tighten it. Gating on the flag alone
  is the bug the Home create-affordance had (`home.tsx:688`) and the trap Point 6's "wire the 10 inert toggles" will
  hit. `caps.assignTasks` was verified to equal the backend's own create allow-list `['admin','leader','super_admin']`.
  **⚠️ THE SAME TRAP HIT A DASHBOARD *WIDGET*, NOT JUST A BUTTON (loophole round 4, 2026-08-25).** `DEFAULT_UI`
  (the fallback used when a role config is unseeded — the prod reality) ships the `team_roster` + `analytics`
  widgets `visible:true`, so gating them on the flag alone rendered the team roster + org totals to a TEAM
  advisor's Home with live data. Fix mirrored the Point-9 `bookHidden` filter: pre-derive a scalar caps const
  (`caps.manageTeam`/`caps.orgAnalytics`, view-as-aware), **remove the widget from the `widgets` array** (kills
  the shell AND its deep-link — not just the fetch), AND add the caps term to the fetch gate. When you gate a
  hook dep on `caps.x`, pre-derive a SCALAR const and depend on THAT (`[canRosterCap]`), never `caps.x` in the
  array — same preserve-manual-memoization dep-trap as above.
- `store/roles.ts` `tierOf()` grants Master by `user.role === 'super_admin'` (Phase 11,
  2026-08-11) — no email literal, but that means Master tier now lives entirely in the backend's
  `Profile.role` field. If Master unexpectedly reads as Admin/Team, that is a database row on the
  `cgpe-api` side, not a client bug — check `Profile.role` in `staff_unified` before touching this
  file. See `docs/spec/PHASE-11.md` D-4. **The 2026-08-14 owner backlog (`docs/PLAN-2026-08-14.md`) asks for 3
  phone numbers to be Master and Viewing-as to be kept for one number — those are DB `Profile.role`/capability
  changes, NEVER client phone literals in `src/`. Keep it that way (same reason the email literal was removed).**
  **`tierOf()` folds `leader` INTO the `admin` tier** (so
  `caps.manageTeam` is true for a leader) — but several backend surfaces gated `authorize('admin')`
  **403 a leader** (payroll is the live example: `routes/payroll.js:22-23`). So any mobile surface that
  consumes an admin-only endpoint must gate on the **real** `user.role === 'admin'|'super_admin'`, never
  on `caps`/the tier, or a leader reaches the fetch and gets a 403 blank. Phase 20 (`app/payroll.tsx`)
  does exactly this; copy it. See `docs/spec/PHASE-20.md` D-3.
  **⚠️ CLIENT-BOOK GATE — `canViewClients(user, viewAs)` is a SECURITY INVARIANT (Point 9, 2026-08-24, `4575106`).**
  Owner decision: the client book is MASTER/ADMIN only; TEAM tier sees NO clients. `canViewClients = tier !== 'team'`
  (`store/roles.ts`) — unlike the master-only `canSeeLiveLocation`/`canSeeTeamPerformance`/`canMonitorTeam`/`canViewAs`
  gates (which read the REAL role to fold `leader` OUT), this INCLUDES the whole admin tier (admin + leader own the
  book) and reads the **view-as-aware** tier. It gates the Clients tab (`_layout`), the More clients/segments/families/
  premium modules, the Home segments/families/campaigns widgets + premium quick-action, the global-search client
  fetch, AND screen guards (thin wrapper → `ui/RestrictedNotice`) on `clients`/`client-[id]`/`segments`/`families`/
  **`campaigns`** (campaigns' audience preview leaks whole-book PII — it's gated for that reason, not just as a
  send tool). **Do NOT weaken it or drop a guard — that re-opens client-book PII to team.** The app gate is
  DEFENCE-IN-DEPTH; the real authority is the backend 403 on `GET /clients`+`/:id` (`protect`-only today; team's
  non-strict scope treats the ~9k UNOWNED book as firm-visible) — relay FILED at INBOX top 2026-08-24, owner-owned.
  Spec `docs/spec/BAND2-7-client-access.md`. Left ungated (owner call, flagged): WhatsApp hub, search Tickets group,
  task-contact sheet.
- Dead, do not maintain: `ui/kit.tsx`, `ui/characters.tsx`, `hooks/use-theme.ts`,
  `hooks/use-color-scheme*.ts`, `constants/theme.ts`, `src/global.css`, `data/mock.ts`.
- `HOW_TO_RUN.md` and `TESTING_GUIDE.md` were corrected in Phase 8 (2026-08-11) — they no
  longer describe an offline demo mode or a hand-editable localhost default. Keep them honest
  when `src/constants/config.ts`'s base-URL logic or the login path changes again.
- **⚠️ ADDING A DEPENDENCY MEANS SYNCING `package-lock.json` IN THE SAME COMMIT (Phase 77).** EAS runs
  `npm ci`, which HARD-FAILS on "package.json and package-lock.json are not in sync" — and a package
  already present in `node_modules` as a *transitive* dep (as `expo-file-system` was) does NOT count:
  the lock needs it under the ROOT `packages[""].dependencies`. Fix with
  `npm install --package-lock-only` (no re-install, one-line diff), and commit it with the change.
- **i18n (`src/i18n/index.tsx`) — two traps before adding keys.** **143 keys** exist (was 75 when this line was written; bumped as phases added copy); ~6 files use `t()`
  substantially and — as of **Phase 21 P1 (2026-08-12)** — **16 more screens** wire a handful of shared
  `common.*` labels (`Call`/`Cancel`/`Delete`/`WhatsApp`/`Today`). **RECOUNTED Phase 77: it is ~49 of the
  53 route files that are ~100% hardcoded English, not "~40"** — 32 have ZERO `t()` calls and only 4 have
  five or more (`home` 57, `tasks` 28, `consent` 14, `settings` 8). `claims.tsx` and `search.tsx` are
  permanent bottom tabs with zero. **All net-new `common.*` keys (`tryAgain` — **55 occurrences across 37
  files**, not the 34 this line used to say — `clearSearch` ×15, `refresh` ×6, the outage body (**60
  occurrences in 39 near-identical variants**), the a11y labels) still need human copy — do NOT wire them
  until gu/hi/hi-en/gu-en are supplied (PHASE-19 §4).** The consolidated, batched, fillable ask lives in
  **`docs/i18n/COPY-REQUEST-2026-08-26.md`** — hand the owner that file rather than re-deriving the list.
  ⚠️ **Four ALREADY-WIRED keys are wrong today and the parity test cannot see it** (it rejects only
  `value === key`, never `value === English`): `tab.search` is untranslated in gu+hi, `consent.agree/
  declineButton` are English in hi-en, `tasks.tomorrow`/`tasks.yesterday` are BOTH `कल`/`Kal` in hi+hi-en
  (an overdue header reads identically to an upcoming one), and `tasks.emptyCalendarBody` still says
  "strip" in all four after the day-rail became a month grid. When wiring a shared label, reuse an existing key;
  add a new one only by lifting existing human copy (as `common.today` did from `tab.home`) or with supplied
  copy — never a machine guess. Some screens bind the translator to `tr` (not `t`) where a local `t` already
  exists (`tickets/index.tsx`, `notes.tsx`). (1) `t()` is now `t(key, params?)` (Phase 21 P0, 2026-08-11, `a7a0979`):
  named `{placeholder}` interpolation + count-plurals (`key_one`/`key_other`, CLDR by active language,
  falls back to base key). Use `t(key, {name})` / `t(key, {count})` for dynamic strings — **never string
  concatenation** (Hindi/Gujarati word order). Single-arg `t(key)` is unchanged. Pure seams
  `pluralCategory`/`interpolate`/`translate(…,lookup?)` are exported and tested in `__tests__/format.test.ts`.
  (2) The parity test `src/i18n/__tests__/dictionaries.test.ts` hard-codes the key count — **143 as of
  Phase 77**, not the 75 this line originally said (bump
  it deliberately when adding keys) **and** its leak check rejects only `value === key`, **not**
  `value === English` — so a Gujarati entry left as the English string **passes the suite green**. The
  test cannot certify translation happened; human copy is load-bearing and machine translation is
  forbidden (PHASE-19 §4).

## Done means
`npx tsc --noEmit` clean, `npm test` green, no new lint errors, and the affected rows of
`TESTING_GUIDE.md` walked by hand **on a device** (web does not exercise haptics, AsyncStorage
clock keys, or background GPS — and neither does `npm test`, which covers pure logic only).
