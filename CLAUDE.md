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
- ⚠️ **AN UNTICKED `cgpe-mobile` BOX CAN BE REAL, UNSTARTED WORK THAT IS ON NO BOARD — GREP `src/`,
  DO NOT TRUST `docs/PHASES.md` (proven 2026-08-29).** The presigned-MinIO item sat open for two days
  with **zero** adoption in `src/` while `## Now` pointed at i18n and voice. **At `/boot`, for every
  open `cgpe-mobile` box, grep the app for the symbols the item names** — a box is unticked either
  because it is blocked (fine) or because nobody started it (not fine), and only the grep tells you
  which. It was the highest-value unblocked work in the project and no board mentioned it.
- ⚠️ **A CONCURRENT SESSION ALSO PUBLISHES ARTIFACTS TO THE OWNER'S ACCOUNT, AND ALSO REWRITES
  `docs/HANDOFF.md` / `## Now` (both seen 2026-08-29).** HEAD moved mid-session and the parallel
  session's handoff landed on disk. **Never overwrite a sibling handoff to satisfy the `/handoff`
  template** — insert above it and archive theirs verbatim; the same goes for `## Now`. And before
  handing the owner a link, run the artifact `list`: a page published this session went **dead within
  minutes**, and a parallel session had already published its own owner-facing page on the same
  subject. Verify the URL is listed, and never overwrite the other session's page.
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
- `npm test` — Vitest, **1068 tests over 66 files**, ~4 s, no network. The second green gate.
  (It said "258 over 9 files, ~0.6 s" for months; recounted 2026-08-27. The ~4 s is the Phase-55
  retry backoff in the real-timer api tests, not a regression — see the retry note below.)
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
⚠️ **"CAN WE JUST SWITCH EXPO ACCOUNTS?" — the owner asked this on 2026-08-27, and the answer has a
trap in it.** Yes, the free quota is **per account**, so a different account can build. **But a new
account issues a NEW ANDROID KEYSTORE, and Android refuses to install an APK signed with a different
key over an existing one** — all 21 handsets would need an uninstall first, losing login, the
AsyncStorage clock keys and the offline queue. The keystore **can** be exported from the old account
and uploaded to the new one, but only through **interactive `eas credentials`, which cannot run from
this session** (stdin is EOF) — it is the owner's job in a real terminal — and `app.json`'s
`extra.eas.projectId` must be re-pointed too. Ranked honestly: **wait for the reset** (same keystore,
₹0) > **pay one month on the existing account** (same keystore, immediate) > **new account WITH the
keystore moved** > **new account without it** (never — it costs every user their session). A local
Gradle build (`expo prebuild` + `run:android --variant release`) needs no EAS at all, but **this
machine has neither a JDK nor the Android SDK** (`java` not found, `ANDROID_HOME` empty, no
`android/` dir — checked 2026-08-27), so it is a multi-GB setup, not a shortcut. Repeatedly farming
free quota with fresh accounts is against Expo's terms — say so rather than proposing it.
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
   `TAB_META` in `src/app/(tabs)/_layout.tsx`. **There is no `ORDER` constant** — this line said so
   until 2026-08-27 and sent readers hunting for a symbol that does not exist. Tab ORDER is simply the
   declaration order of the `<Tabs.Screen>` elements.
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
   `ui/base.tsx:81-83` (the prop itself is applied at `:103`) and guarded on **20** files
  (`search.tsx:606`, `clients.tsx`, `leads.tsx`,
   `notes.tsx`, login…). `tsc`/`npm test`/`eslint` CANNOT see this — it needs a device or an eye on the
   ScrollView props. The Tasks-tab search shipped missing it and an adversarial review caught it; don't
   repeat the miss.

## Diagnosis discipline (Phase 77, 2026-08-26 — this cost a near-miss)
- ⚠️ **A COPY FIX IS NOT DONE UNTIL EVERY PLACE SAYING THE WRONG THING READS THE NEW VALUE (Phase 79).**
  The OTP fix plumbed the server's `channel` through `api.ts` so an emailed code would stop claiming
  it went to WhatsApp — and shipped with the toast fixed and **the very next screen still saying
  "Enter the code from your WhatsApp message."** The new field had **zero consumers**, and `tsc`
  cannot see an unread optional property. **After adding a value for a copy fix, grep the literal you
  were fixing** (`grep -rn "WhatsApp" src/app/(auth)/`) and confirm every hit now branches on it.
  Same class as the Phase-77 dead-`||`-fallback and the Phase-78 dead `common.onDuty` branch.
- ⚠️ **Never write an emoji into a Python string as two `\uXXXX` escapes** — `"🔴"` is a
  surrogate PAIR, and Python accepts it in a `str` then refuses to encode it (`UnicodeEncodeError:
  surrogates not allowed`). This is the same defect that destroyed `INBOX.md` on 2026-08-26, and it
  bit twice more in Phase 79 on `CLAUDE.md` and `PHASES.md` — harmlessly both times, because the
  script wrote to a **temp file and asserted on size first**. Paste the literal emoji character, or
  use the Edit tool. **The write-to-temp-then-assert rule is what makes this a non-event; keep it.**
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

## Native modules: TWO different traps, and the second one is worse

The Vitest trap below (`__DEV__ is not defined`) is documented under `npm test`. This is a
**separate** one, found 2026-08-26 when it nearly shipped:

🔴 **NEVER `import` a native module at the top level of ANY file a ROUTE can reach.** Use a lazy
`require()` inside the try/catch that is meant to handle its absence.
- **Why a top-level import is not equivalent.** `react-native-compressor`'s `Main.js` runs
  `const Compressor = createCompressor();` at **module scope** and throws `LINKING_ERROR` when the
  native side is not linked. A static `import` therefore throws while the MODULE is being evaluated —
  **before any function-body try/catch exists to catch it.** A module that documents itself as
  "fails open" does not fail open if its import can throw.
- **Why it reaches boot.** In development expo-router imports routes **synchronously**
  (`asyncRoutes` is not enabled in `app.json`), so `getRoutesCore.js` runs
  `validateRouteTreeExports` → an **UNGUARDED `node.loadRoute()` on EVERY route file**. One route
  that transitively imports the module takes down `npx expo start --go`, `npx expo start --web` AND
  `npm run e2e` at startup — and with them every unrelated feature on every other screen.
- **A production EAS build is unaffected** (`NODE_ENV=production` skips the validation and the module
  IS linked), which is exactly why nothing local catches it: **`tsc`, `npm test` and `eslint` were
  ALL GREEN on the broken version.** Only reading the library's own source finds it.
- The live example is `src/lib/videoTranscode.ts`; the reasoning is written at the `require` itself.
  **Do not "tidy" it back into an import statement.**
- Corollary for any new native dependency: check whether it does work at module scope before
  importing it, and prefer keeping it behind a lazy require in a module only screens import.

## Verifying the backend WITHOUT guessing (2026-08-26)

- **`GET https://cgpe.in/internal/api/upload` reports the live storage state** —
  `{"success":true,...,"cloudStorageConfigured":false}`. Use it before diagnosing any attachment
  problem; it settles "is storage on in prod?" in one command, with no auth. As of 2026-08-26 it is
  **false**, and `BACKEND_URL` is unset, so every upload lands on droplet disk and returns
  `http://localhost:3001/uploads/...` — which on a phone means the phone. That is the "captures
  vanish" bug, and it is a SERVER gap: the app already detects it (`isEphemeralUrl`) and is honest.
- **A no-auth `curl` distinguishes deployed from not:** `401` = deployed and protected, `404`/`501` =
  not on the deployed build. `POST /api/file-attachments` → **401**, i.e. live (mount is on
  `origin/main` at `app.js:466`).
- ✅ **`entity_id` EXISTS NOW — but read the deploy caveat before believing it (2026-08-27).**
  `cgpe-api`'s **Phase 94 (`fda199c`)** answered our whole upload item: `entity_id` + `entity_type` are
  real persisted fields on `POST /api/file-attachments` (with a `?entity_id=` filter), the four video
  MIME types are allowed, a rejected type now returns **415** instead of a bare 500, and
  `cloudStorage.js` is MinIO-shaped. **The app already sends `entity_id`/`entity_type`** and no longer
  smuggles the claim id into `description`.
  🔴 **NONE OF IT IS DEPLOYED.** `fda199c` is on `origin/Shivam`; prod deploys `origin/main`, which was
  `990c660`. Confirm before claiming any of it works on a phone:
  `git -C ../cgpe-backend-main ls-remote origin refs/heads/main`, then
  `git -C ../cgpe-backend-main merge-base --is-ancestor fda199c origin/main`. Until the owner merges +
  deploys + restarts `:3001`, video uploads still fail and `entity_id` is still dropped. An unknown key
  is ignored by the old build, which is why sending it early is safe.
  ⚠️ **MinIO bucket naming is an OPS CONSTRAINT the app cannot enforce:** storage is path-style, so the
  bucket is the first path segment — a bucket named **`uploads`** would make every durable object look
  like the local-disk fallback to `isEphemeralUrl` and warn users their files will not be kept. The
  host-scoped narrowing was deliberately NOT taken (it would turn a harmless false alarm into a false
  reassurance); the reasoning is written at the function and pinned by a test.
- 🔑 **THE PRESIGNED MinIO FLOW IS THE CONTRACT NOW, AND THE APP HAS NOT ADOPTED IT (open as of
  2026-08-29).** `cgpe-api` Phase 95 (INBOX 2026-08-27) superseded the multipart upload with a
  **three-call presigned flow**: `POST /upload/presign` `{content_type, filename?, folder?}` →
  `{key, url, method:'PUT', headers:{'Content-Type'}, expiresIn:300, maxBytes:10485760}`; **PUT the
  bytes to that url with NO auth header** (the signature is the auth); then `POST /file-attachments`
  with **`storage_key`** and an EMPTY `file_url`. Render later via `GET /upload/download-url?key=…`.
  The `cgpe-mobile` box is **unticked** and `grep -rn "presign\|storage_key\|download-url" src/`
  returns **zero hits** — the app is still on multipart `/upload` + `/file-attachments`. **Do not
  re-derive this contract; read the INBOX item.** Two traps written into the contract itself:
  **(a) persist the KEY, never the URL** — signed URLs expire in 300 s, so a stored URL ships a dead
  link; **(b) the PUT is SIGNED against the exact `Content-Type` `presign` returned** — any other
  value, or omitting the header, **403s at MinIO**. Adopting it early is inert-safe: all three routes
  answer **`503 not_configured`** until OPS sets `S3_*` (still unset — `cloudStorageConfigured:false`
  on 2026-08-29), the same reasoning that made sending `entity_id` early safe.
- **The upload route names its own failure in the BODY.** A rejected type is thrown from multer's
  `fileFilter` and surfaces as a bare **500** on the deployed build — a **415** once Phase 94 ships —
  both carrying `{error:'File type video/mp4 is not allowed'}`;
  `LIMIT_FILE_SIZE` is a **400** carrying `File too large`. `classifyUploadFailureBody`
  (`lib/fileUpload.ts`) reads those words so a PERMANENT rejection is never reported with transient
  "try again" copy. Keep it conservative — an unrecognised body must fall through to the status, or a
  real 5xx gets relabelled as a content problem.

- ⚠️ **THE AUTH ROUTES PUT A MACHINE TOKEN IN `error` AND THE SENTENCE IN `message` (2026-08-27).**
  Everywhere else this backend answers a refusal with prose in `error` (`errorHandler.js` emits
  `{error: <thrown message>}`, and `routes/auth.js` sends e.g. `error:'Your account is inactive…'`).
  But `/auth/login` sends `{"error":"NO_ACCOUNT","message":"No account found with that email…"}` —
  **probed live, not inferred** — and `BAD_PASSWORD`, `OTP_NOT_CONFIGURED`, `OTP_DELIVERY_FAILED` are
  the same shape. Reading `json.error || json.message` therefore printed the bare word `NO_ACCOUNT` on
  the login screen for the commonest failure in the product. **Never read those two fields by hand:
  use `humanApiMessage(json, fallback)` (`lib/apiMessage.ts`)**, which prefers a prose `error`, falls
  back to `message` when `error` is SCREAMING_SNAKE_CASE, and never shows a token. A blanket
  `message`-first flip is a REGRESSION — several routes send only `error`.

## Machine translation: the ban, and the day it was waived (Phase 83, 2026-08-27)

- **PHASE-19 §4 forbids machine translation, and the reason is mechanical, not stylistic:** the
  parity test proves a value EXISTS in five languages, **never that it is CORRECT**. Four
  wrong-but-green keys survived months that way. Assume the ban is ON.
- ⚠️ **THE OWNER WAIVED IT ONCE, IN WRITING, FOR ONE BATCH** — *"translation aap abhi ke liye khud
  se kar lijiye … agar [problem] aaye toh hum solve kar denge."* 135 keys were written by Claude on
  2026-08-27 and are **labelled as such in a header inside `src/i18n/index.tsx`**. Do **NOT** treat
  that as standing permission, and do **NOT** convert owner-supplied copy into that style. Anything
  new needs the same explicit instruction.
- **Three things a translated key still cannot reach**, all of which produce a ZERO-CONSUMER key
  (the defect four phases were spent removing) rather than a translated screen:
  (a) **outside every provider** — `ui/RouteErrorBoundary` renders there, so `useT()` resolves the
  context default `t: (k) => k` and prints the literal key. The 4 `crash.*` keys were dropped for
  this. (b) **non-React modules** — `store/auth`, `data/api`, `lib/biometrics`, `lib/tracker`,
  `constants/config` have no translator at all. (c) **no call site** — a row in the copy request is
  not proof a screen says it (`0 clients in process` came from a code COMMENT;
  `doc.videoStillTooLarge` matched no screen at all).
- 🔑 **RUN `node scripts/i18n-freewins-scan.mjs --orphans` BEFORE COMMITTING A COPY DROP, not after.**
  On 2026-08-27 it caught **three keys the same session had just created** with no reader. Orphans
  finished at **17**, down from 18, after adding 135 keys — that is the bar.
- **A module-scope helper cannot call a hook — pass the translator in.** `dueToken`
  (`client/[id].tsx`) takes it as an argument; `MODES` in `(auth)/login.tsx` moved inside the
  component as a `useMemo` instead. Both are the pattern to copy for a module-scope label table.

## Department layouts: the owner's ops/sales matrix lives in the APP (Phase 83, 2026-08-27)

- `OPS_TEAM_UI` / `SALES_TEAM_UI` / `departmentFallbackUi` in `store/appUi.tsx` encode the owner's
  two verbatim lists. They are consulted **only when the server returns NO config** — a seeded
  `PUT /rbac/app-ui/:roleKey` document still wins — because the per-role docs have never been
  seeded in prod (owner backlog Point 6).
- ⚠️ **Narrowing applies to the TEAM tier only, and to the two NAMED departments only.** An admin in
  Operations keeps everything, and so does every department the owner did not describe — including
  the four live values `canonicalizeDepartment` returns `null` for. **Guessing a layout for an
  undescribed department is how a field agent loses their own work.**
- ⚠️ **"baki kuch bhi nahi" has four exceptions and they are load-bearing:** `settings` (the LANGUAGE
  SWITCH — hiding it strands a user in a script they cannot read), `profile`/`account` (DPDP), and
  `attendance` (the clock record the owner called mandatory). `tickets` for ops is an
  **interpretation** of "processes/operations" — the owner was ASKING what that module is.
- ⚠️ **Emit hidden widgets EXPLICITLY.** `normalizeUiConfig` falls back to the whole `DEFAULT_UI`
  list when the widget array is empty, so "everything off" written by omission silently re-opens the
  dashboard. A test pins the array length.

## Task creation: open to everyone, and the workaround that does NOT work

- **Owner decision 2026-08-27: every team member may create a task for THEMSELVES.** Create is gated
  on `can_create_task` alone; assign-to-others stays on `caps.assignTasks` + `can_assign_task_to_others`,
  and `task-new.tsx` LOCKS the assignee row so a team member's task is self-assigned by construction.
- 🔴 **Do NOT "fix" this by posting to `/tasks`.** That route has no role gate and self-assigns
  already (`routes/tasks.js:189, :210`) — but `GET /team/task-overview` reads **only**
  `db().collection('team_tasks')` (`team.js:77`), and that overview is what the app's list PREFERS
  (`api.ts:536`). A task written to the `tasks` collection is **invisible in the list that created
  it**. The backend ask (allow a self-assigned `team_task` from any authenticated user) is filed at
  the foot of `INBOX.md`. Until it ships, `POST /team/tasks` 403s and `addTask` reports it honestly.

## Voice assistant (built 2026-08-29 — read before touching `src/voice/**` or `src/ui/voice/**`)
- **Architecture: n8n is a PURE TEXT brain; the BACKEND does STT + TTS** (owner overrode the Express-
  fat-registry recommendation). The live brain `https://ai.cgpe.in/webhook/cgpe-voice-brain` takes
  `{transcript, authToken}` → `{success, reply_text, action}` (NO audio, NO confidence). The app records
  audio → `POST /api/voice/ask` (the backend proxy — **STILL TO BE BUILT by cgpe-api**, filed to INBOX,
  brief at `docs/spec/VOICE-BACKEND-PROXY-BRIEF.md`) → the proxy does STT → brain → TTS → returns the
  A1.3 shape. **Do NOT build a run/say registry** and do NOT make the app call the brain directly (the
  webhook secret must never ship in the app).
- **The app parser (`src/voice/response.ts`) treats an ABSENT `confidence` as ACT** (the brain sends
  none), accepts `success` as an alias for `ok`, and a `success:false` is SPEAKABLE (play the reason,
  never navigate). Don't "fix" absent-confidence back to a refusal — it would stop every reply navigating.
- **Writes are DARK** in v1 (`src/voice/dispatch.ts` `VOICE_WRITES_ENABLED=false`) — reads + navigate only.
- **🔴 THE HEAVY UI ADDS THREE NATIVE DEPS behind probes:** `@shopify/react-native-skia`, `expo-blur`,
  `lottie-react-native`. They are loaded ONLY via `hasSkia/hasBlur/hasLottie` (`src/lib/voiceGraphics.ts`)
  + `React.lazy` + an error boundary in `VoiceCharacter`. **Never static-import any of them from a file a
  route/boot reaches** (module-scope-throw trap, above). The always-works fallback is the gradient
  `OrbStatic`.
- **🔴 LOTTIE WEB-BUILD TRAP:** `lottie-react-native`'s web renderer needs `@lottiefiles/dotlottie-react`
  (NOT installed), so ANY web-reachable import of it (even a lazy `require` in the probe) breaks
  `expo export -p web` — the boot-safety gate. It is neutralised by **`src/ui/voice/VoiceMascot.web.tsx`
  + `src/lib/voiceGraphics.web.ts` STUBS** (Metro resolves them on web). **Do NOT delete those stubs.**
  Re-run `npx expo export -p web` after any voice-native change; EXIT 0 = boot-safe.
- **The character is the gradient/Skia ORB** until the owner-commissioned **Lottie mascot** art
  (`assets/voice/mascot-{male,female}.json`) is dropped in and `mascotFor()` requires uncommented — then
  the male/female toggle swaps them with no other change. A hand-authored placeholder looks WORSE than
  the orb; don't ship one.
- Voice mode is a full-screen overlay (`src/ui/voice/VoiceMode.tsx`), AppLock-pattern, mounted in
  `_layout` RootNav at zIndex 50 (< LocationBlock 55 < AppLock 60), back-intercepted. NOT a route (dodges
  the typed-routes trap). Real mic amplitude = `isMeteringEnabled` + `recorder.getStatus().metering`.

## Danger zones
- ⚠️ **`src/app/_layout.tsx` EXPORTS `ErrorBoundary`, and that export is the whole mechanism.**
  expo-router wraps a route in its `Try` boundary **only** if the route module exports
  `ErrorBoundary` (`expo-router/build/useScreens.js:141-158`), and the ROOT route node resolves
  through the same path (`global-state/useStore.js:55`) — so that one export is the app's only error
  containment, covering every screen. Before 2026-08-27 there was none at all: any render-time throw
  unmounted the entire React root, and a release build has no LogBox, so the user got a dead screen
  and the bug report said "it went blank". **Do not delete the export while "tidying imports"** —
  importing the component is not enough. The boundary itself (`ui/RouteErrorBoundary.tsx`) renders
  OUTSIDE every provider, so it must stay on react-native primitives and literal colours. The trap
  there is that **`useTheme()` would NOT throw** outside its provider — `ThemeContext` is created with
  `light` as its default (`theme/theme.tsx:271`), so it silently returns the wrong scheme and a
  dark-mode user gets a white flash. `useColorScheme` (react-native) is the one to trust.
  ⚠️ **The button says "Reload the app", and it must not be reworded into a promise about the failed
  screen.** `Try.retry()` only clears the boundary's error state (`views/Try.js:54-60`); the ROOT
  re-mounts, and `useNavigationBuilder`'s unmount cleanup has already erased the navigation state
  (`react-navigation/core/useNavigationBuilder.js:496-502`), so it falls back to `app/index.tsx` →
  Home or login. **The crashed screen and the whole back stack are gone.** Two tests reject the old
  wording; the reasoning is at `CrashReport.retryLabel`.
- `src/data/api.ts` (**4332 lines**, 56 importers — the line count said 1744 until 2026-08-27, which
  badly understated how much lives in here) — `state` is a write buffer, not seed data.
  `setAuthToken` silently disables all network calls for a token starting `demo-`.
  **⚠️ IN-MEMORY PER-USER STATE MUST BE RESET ON TEARDOWN (loophole round 4, 2026-08-25).** The module
  holds per-user data in JS memory that `store/auth`'s AsyncStorage/SecureStore purge does NOT touch:
  the `state` buffer AND the `clientCache`/`claimCache`/`waThreadCache` Maps. `getClient`/`getClaim`/
  `getWaThread` are **cache-first** (return `clone(cache.get(id))` before any network call or backend
  403), so on a shared handset a cached record leaks to the next user with no server check. The exported
  **`resetApiState()`** empties all of them and is called from `clear()` + `onSessionExpired` (+ the
  `persist()` different-user branch). **If you add another module-scope per-user Map/buffer here, add it
  to `resetApiState()`** — a purge in `store/auth` alone will NOT clear it.
- `src/app/(tabs)/home.tsx` (**2534 lines**) — the LARGEST consumer of `useAppUi()`, not the only one:
  **11** source files call it (`home`, `tasks`, `claims`, `more`, `(tabs)/_layout`, `campaigns`,
  `notify`, `task/[id]`, `task-new`, `tickets/[id]`, `_layout`). Changing the AppUi shape touches all 11.
- ⚠️ **GPS sampling is HOURLY on all three profiles (`motion.ts` `HOURLY_MS`), and that is an OWNER
  decision, not a regression.** 2026-08-26 the owner asked for hourly instead of 60 s for battery and
  mobile data, was shown in writing that a nine-hour shift then records ~9 points and the live map
  draws nine straight hops (the shape of the bug Phase 63 fixed), and confirmed anyway. The owner-#1
  guard test was edited openly and ONLY in its cadence clause. **Do not "fix" it back**, and do NOT
  loosen `distanceInterval: 0` or `accuracy: 'high'` — those lose points OUTRIGHT rather than merely
  spacing them out. Two consequences are documented at the code: attribution slop widened to up to an
  hour, and the 15-min watchdog is now the PRIMARY point source (`STALE_AFTER_MS` 45 min fires before
  a healthy hourly stream), so battery cost belongs to that path.
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
  the static `spacing`/`radius`/`font` exports stay = comfortable for the **57** remaining unmigrated files (no
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
  is the bug the Home create-affordance had (`home.tsx:736` — this said `:688`, which is unrelated widget-merge code)
  and the trap Point 6's "wire the 10 inert toggles" will
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
  **403 a leader** (payroll is the live example: `routes/payroll.js:84` — this said `:22-23`, which is the
  `protect` token gate, not the admin gate). So any mobile surface that
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
- Dead, do not maintain: **`data/mock.ts`** — and that is now the ONLY one. This list also named
  `ui/kit.tsx`, `ui/characters.tsx`, `hooks/use-theme.ts`, `hooks/use-color-scheme*.ts`,
  `constants/theme.ts` and `src/global.css`; **all six were deleted at some point and none exist on
  disk** (checked 2026-08-27). Do not go looking for them.
- `HOW_TO_RUN.md` and `TESTING_GUIDE.md` were corrected in Phase 8 (2026-08-11) — they no
  longer describe an offline demo mode or a hand-editable localhost default. Keep them honest
  when `src/constants/config.ts`'s base-URL logic or the login path changes again.
- **⚠️ ADDING A DEPENDENCY MEANS SYNCING `package-lock.json` IN THE SAME COMMIT (Phase 77).** EAS runs
  `npm ci`, which HARD-FAILS on "package.json and package-lock.json are not in sync" — and a package
  already present in `node_modules` as a *transitive* dep (as `expo-file-system` was) does NOT count:
  the lock needs it under the ROOT `packages[""].dependencies`. Fix with
  `npm install --package-lock-only` (no re-install, one-line diff), and commit it with the change.
- **i18n — BATCH 2 IS SWEPT (2026-08-26, `48b3509`): 118 call sites across 43 files now translate.**
  Do **not** re-file it as outstanding. Two deliberate exclusions that will look like gaps:
  (a) **`common.offlineBody` must NOT replace the 39 EMPTY-STATE sentences** — the copy request called
  it "one canonical replacement for all 39 variants", but **no empty-state site matches it verbatim**
  and each of the 39 names *what* failed ("an empty inbox here is not confirmed"). Collapsing them
  destroys the outage-honesty convention (#4 below). They are now **Batch 6b** (41 distinct / 54
  places), quoted verbatim in the copy request.
  ⚠️ **BUT SEVEN *WRITE-FAILURE* NOTICES DID MATCH IT WORD FOR WORD AND ARE NOW WIRED** (Phase 80,
  2026-08-27, `9074d08`): the clock-in, clock-out and both break failure messages in `home.tsx`. This
  line used to say "zero sites match it verbatim" flatly, which was true of the empty-state family it
  was written about and **false of the app as a whole**. **Both facts are true of different string
  sets — do not "correct" either one by deleting the other.**
  (b) **composed strings stay English** (`On duty (n)`, `${duration} on duty`, `withCount('All', n)`)
  — they need placeholder keys that do not exist, and gluing `t()` into a template literal breaks
  Hindi/Gujarati word order. ⚠️ **BUT THAT IS TRUE ONLY WHERE NO `{placeholder}` KEY WAS SUPPLIED —
  CHECK, DO NOT ASSUME (Phase 81).** `(tabs)/leads.tsx:251` composed
  `` `${lead.name} saved on this device — …` `` while **`sync.savedLocalNamed` = `'{name} saved on
  this device — …'` sat unread in all five languages**, written for exactly that site. **Grep the
  dictionary for a `…Named` / `{placeholder}` variant before excluding a composed string.** The two
  that genuinely lack one (`{pct}% vs last month`, `Send to all {n}`) are now Batch 6e. ✅ **Batch 5 (sign-in) is now EXTRACTED** (2026-08-27): all **47** strings
  are quoted verbatim in `docs/i18n/COPY-REQUEST-2026-08-26.md`, along with a new Batch 5b (the crash
  screen, 4 strings). Nothing on the sign-in screen is a composed string, so it needs no placeholder
  keys — do not invent one. *(Published as 47, corrected to **49** the same day.)*
  ✅ **THE EXTRACTION BACKLOG IS NOW CLEAR (Phase 80, 2026-08-27).** **Batch 6** is written out:
  **6a** (70 — the copy that closes the groups Phase 80 left half-translated), **6b** (41 — the outage
  bodies, formerly "the 39"), **6c** (the More menu + the other module-scope label tables, listed as
  whole units). **Phase 81 added 6d** (13 — the peers of sites it deliberately refused to wire) and
  **6e** (3 the owner has already paid for that the app still cannot use: two need `{pct}`/`{n}`
  variants, one needs only a wording decision). Only Batches **7–9** remain as counts. **Hand the
  owner `docs/i18n/COPY-REQUEST-2026-08-26.md`; do not re-derive any list.**
  🔑 **THE FREE-WINS SCAN IS NOW A COMMITTED SCRIPT — `node scripts/i18n-freewins-scan.mjs`
  (add `--all` for single-word noise, `--orphans` for the other direction). RE-RUN IT AFTER EVERY
  COPY DROP, and only then.** It compares every hardcoded literal in `src/` against the **VALUES** of
  the English dictionary (not the keys): a match is copy the owner already supplied, in all five
  languages, that no screen reads. It found **117** the first time (**73 wired at zero copy cost**),
  and the **near-miss** pass — which normalises case, trailing full stops and **curly-vs-straight
  apostrophes** — found **three more keys with ZERO consumers** that exact matching could not see
  (`it'll` vs `it’ll` is byte-unequal). **Nothing else can see this class of gap** — the parity test
  only proves a key EXISTS in five languages, `tsc` sees a well-typed literal, `npm test` covers pure
  logic. Same defect family as Phase 79's `channel` field with zero consumers.
  ✅ **THE HUNT CLOSES AND REOPENS — it is a cycle, not a one-time job.** `--orphans` audits from
  the dictionary end (for each key, does any file read it?) — a **superset** of the literal scans
  with no template-literal blind spot. Phase 81 ran it and found **18 keys with no consumer, NOT ONE
  a free win:** 2 false positives, 3 blocked, 3 composed without a placeholder key, 10 dead copy for
  surfaces that no longer exist (**there is no `src/app/premium.tsx` any more**, so all four
  `premium.*` keys are for a screen folded into `campaigns`). It then said "only a new copy drop
  reopens this" — **and Phase 82's Batch 6a drop reopened it the very next session, exactly as
  written.** After that drop: **orphans still 18** (every one of the 58 new keys has a reader — no
  new dead copy), but **82 EXACT matches that did not exist before**, because the new keys' English
  also appears hand-written on other screens. Most are the six no-sweep categories or already-filed
  Batch 6d/6f peers — **but that is a triage, not an assumption. RE-RUN BOTH SCANS AFTER EVERY COPY
  DROP, in that order, before concluding anything.** Do not re-read Phase 81's "closed" as permanent.
  ⚠️ **A RUNTIME-ASSEMBLED KEY LOOKS ORPHANED AND IS NOT:** `(tabs)/_layout.tsx:151` does
  `t('tab.' + route.name)`, so every `tab.*` key reads as unused. Check for an assembled key before
  believing an orphan.
  ⚠️ **The literal scan is BLIND TO TEMPLATE LITERALS** — `leads.tsx:251` was found by grepping the
  dictionary's English, not by the script. A clean run does not by itself prove there are no wins.
  Three scan traps, all still live: use a **2-character floor** (a `<4` filter hid `priority.low` =
  "Low"); parse the dictionary with a **tokenizer**, not a line-anchored regex (entries are several
  per line and mix `'` and `"` quoting — a naive regex read 124 of 226 keys and silently
  under-reported); and **filter to multi-word strings** or single-word case-insensitive matching
  buries the list in ~500 identifier hits. **Count swaps from the diff**, not by hand: the first
  commit message said 61 when the diff said 73.
  ⚠️ **A SCAN HIT IS A CANDIDATE, NOT A FIX.** Six sites were correctly refused in Phase 81 because
  their on-screen PEERS have no keys — Home's Portfolio-analytics row has four peer Eyebrows and only
  two have keys, so wiring two would rebuild the very half-translated strip the sweep rule forbids.
  Those peers go to the owner (Batch 6d), not into the code.
  🚫 **SIX CATEGORIES MUST NOT BE SWEPT, and the reasons differ** (decided Phase 80, written into
  `docs/PHASES.md`; do not re-litigate): a value **persisted to AsyncStorage** (`home.tsx` `place`);
  strings that are **backend DATA** (task `CATEGORIES` are sent as `category`, icon-map keys are
  looked up — translating writes Gujarati into the DB and breaks every filter); **module-scope label
  tables** (wiring the 1–2 entries that have keys yields a **navigation menu in two languages**,
  worse than one — translate the WHOLE table or none of it).
  ✅ **PHASE 84 (2026-08-29) TRANSLATED FOUR OF THESE WHOLE, with keys (Batch 6c, `62e9d8c`):**
  `MORE_CATALOGUE` (→ `titleKey`/`subKey`; 6 titles REUSE `tab.clients`/`tab.claims`/`common.tickets`/
  `act.calendar`/`act.contests`/`settings.title`), prospects `STAGE_META` (`stageLabel(k, t)`;
  Meeting/Lost reuse `stage.*`), notice-board `CATEGORY` (`catMeta(key, t)`), and notify options
  (`useMemo([t])`). **Still whole-table English:** campaigns `KIND_LABEL`.
  ⚠️ **A module-scope MENU'S GROUP/SECTION TITLES MAY BE SERVER DATA, not hardcoded — translate the
  rows without them and you ship translated rows under English headers.** `MORE_CATALOGUE`'s content-
  group headings ("The book"/"Day to day"/…) come from `DEFAULT_UI.nav.more_sections` in `store/appUi.tsx`;
  Phase 84 added a `MORE_SECTION_TITLE_KEYS` title→key map + `sectionTitle(raw,t)` in `more.tsx` (custom
  server titles fall through; the "More" catch-all reuses `tab.more`). Check the group titles' SOURCE first.
  🔑 **`home.tsx`'s PARALLEL nav catalogue was PARTLY wired in Phase 85 (`d9adb5b`) — and it is NOT the
  clean "free win" this line used to promise.** Only **3** widget headers had a byte-exact key and were
  wired by reuse (`prospects`→`more.prospectsTitle`, `personal_notes`→`more.notesTitle`, `tickets`→
  `common.tickets`). The rest were REFUSED and filed as **Batch 6g** (owner copy): `day_spine`/
  `leads_pipeline`/`claim_requests`/`issue_logs` have no key (and `'Leads pipeline'`≠`more.leadsTitle`
  `'Leads and pipeline'` — do NOT reword); `team_roster` has a byte-exact `dash.team` but its card
  renders translated `onDuty`/`offDuty` pills beside an English `${onDuty} of ${team.length} on duty
  right now` footer → a translated header = a half-translation island (needs a `{n} of {total}`
  placeholder key); and the `LINK_WIDGETS` shortcut cards are a whole-table-or-none job (7 keyless
  subtitle SENTENCES, `dash.campaigns` NOT a clean win because its subtitle has no key).
  **The rule Phase 85 established: translate a widget header ONLY where the card body has no *translated*
  chrome for its English peers to clash with** (pure-data body, or one-direction English like the shipped
  `my_tasks` which renders hardcoded `Overdue ·` under a translated header). See memory
  `phase85-home-headers-i18n-2026-08-29`. The other module-scope no-sweep reasons stand: **module-scope date formatters**;
  the four strings in `api.ts`/`tracker.ts`/`calendar.ts`/`config.ts` where **there is no non-React
  translator** (the active language lives in provider state); and `ui/LeafletMap.tsx:299` where **`t`
  is a local time string**.
  ⚠️ **A PARTIAL SWEEP LEAVES GROUPS VISIBLY HALF-TRANSLATED — only do it if you extract the closing
  copy in the SAME session.** Two Gujarati tiles beside one English one reads worse than all-English.
  That closing list is Batch 6a.
  ⚠️ **`t()` INSIDE A `useMemo`/`useCallback` REQUIRES `t` IN THE DEP ARRAY.** Five hooks needed it in
  Phase 80 and **`tsc` + all 1069 tests were green without them** — only cache-free
  `npx eslint <file>` catches it. Without the dep, a language switch leaves memoized labels in the old
  language. Same family as the `preserve-manual-memoization` trap above.
  ⚠️ **A local `t` shadows the translator.** Renaming the LOCAL (not the translator) is the fixed
  convention — done for `agent-track` (`t`→`track`), `kb` (`t`→`tag`), `performance` (`t`→`task`);
  `notes.tsx` and `tickets/index.tsx` still bind the translator as `tr`.
- **i18n (`src/i18n/index.tsx`) — the real numbers, recounted 2026-08-27 after Phase 82.**
  **361 keys** exist (this line has said 75, 143, 226, 284 — every one of them stale within a
  session or two; **recount, do not quote this number**). Only **2 of the 53 route files have ZERO
  translator calls** now (`(auth)/_layout`, `index`) — `job/[id]` and `lic-plans` were wired in
  Phase 83. Only **4 of the 53 route files have ZERO `t()` calls**
  (`(auth)/_layout`, `index`, `job/[id]`, `lic-plans`; `task-edit` and `task-new` were on this list
  until Phase 80 wired their Due/Priority controls) — this line used to say
  **32**, and used to claim `claims.tsx` and `search.tsx` were permanent bottom tabs with zero; **both
  call the translator now.** So the app is nowhere near "~49 of 53 files are 100% English" any more;
  what remains is depth (most screens translate a handful of shared words, not their own copy), not
  breadth.
  ⚠️ **DO NOT repeat this file's old instruction "do NOT wire the net-new `common.*` keys until
  gu/hi/hi-en/gu-en are supplied".** The owner supplied that copy on 2026-08-26 and the sweep shipped
  the same day: `common.tryAgain` (55 sites / 37 files), `clearSearch` (×15), `refresh` (×6) and the
  a11y labels are all wired, in all five languages. Following the old instruction would block work
  that is already done. What genuinely still needs copy is listed — batch by batch, with the English
  quoted verbatim — in **`docs/i18n/COPY-REQUEST-2026-08-26.md`**; hand the owner that file rather
  than re-deriving the list. ✅ **Batch 6a (70) WAS SUPPLIED AND IS WIRED — Phase 82, 2026-08-27.**
  Still owed by the owner: **6f** (23 — what wiring 6a itself created, and the only thing that
  unblocks the already-supplied `Agent map`), **5** (sign-in, 49), **6b** (outage, 41), **6c**
  (~70, whole tables), **6d** (13), **6e** (3), **5b** (4), **4b** (4), then 7–9 as counts.
  ⚠️ **A SUPPLIED ROW CAN HAVE NO CALL SITE — grep before adding a key (Phase 82).** Batch 6a's
  `0 clients in process` appears nowhere on screen: the Phase-80 scan lifted it out of a **source
  comment** in `screens/dashboards.tsx:279`. Adding a key for it would have *created* the
  zero-consumer defect Phases 79–81 were spent removing, out of copy the owner had paid for. A row
  in the copy request is not proof a screen says it.
  ⚠️ **A SUB-COMPONENT MAY HAVE NO TRANSLATOR AT ALL, AND ONLY `tsc` SAYS SO.** `search.tsx`'s
  `Resting` (the "Where it looks" table) had no `useT()` — 13 `Cannot find name 't'` errors, with
  `npm test` and eslint both silent. Expect it whenever the string you are wiring lives in a helper
  component rather than the screen body.
  ⚠️ **WHEN TWO OWNER DROPS DISAGREE, THE LATER ONE WINS — AND YOU SAY SO.** `report.generating`
  came back a second time with different Gujarati verb agreement; the newer is live, the older is
  recorded, and the question went back to the owner. Never silently overwrite human copy, and never
  silently keep the stale one either.
  ✅ **The four "already-wired but wrong" keys this file used to list are ALL FIXED** (verified against
  the dictionary 2026-08-27, not the docs): `tab.search` is `શોધો` (gu) / `खोजें` (hi);
  `consent.agreeButton`/`declineButton` are translated in hi-en; `tasks.tomorrow`/`tasks.yesterday` are
  distinct in hi and hi-en (`आने वाला कल` vs `बीता हुआ कल`); and `tasks.emptyCalendarBody` says
  "calendar" in all five. Do not re-file any of them. **The underlying trap is still real** and is why
  they survived so long: the parity test rejects only `value === key`, **never** `value === English`.
  When wiring a shared label, reuse an existing key; add a new one only by lifting existing human copy
  (as `common.today` did from `tab.home`) or with supplied copy — never a machine guess. Some screens
  bind the translator to `tr` (not `t`) where a local `t` already exists (`tickets/index.tsx`,
  `notes.tsx`). (1) `t()` is `t(key, params?)` (Phase 21 P0, `a7a0979`): named `{placeholder}`
  interpolation + count-plurals (`key_one`/`key_other`, CLDR by active language, falls back to the base
  key). Use `t(key, {name})` / `t(key, {count})` for dynamic strings — **never string concatenation**
  (Hindi/Gujarati word order). Pure seams `pluralCategory`/`interpolate`/`translate(…,lookup?)` are
  exported and tested in `__tests__/format.test.ts`.
  (2) The parity test `src/i18n/__tests__/dictionaries.test.ts` hard-codes the key count — **361**
  (bump it deliberately when adding keys; note its own `it(…)` title still says "94-key set" and is
  cosmetic) **and** its leak check rejects only `value === key`, **not**
  `value === English` — so a Gujarati entry left as the English string **passes the suite green**. The
  test cannot certify translation happened; human copy is load-bearing and machine translation is
  forbidden (PHASE-19 §4).

## Done means
`npx tsc --noEmit` clean, `npm test` green, no new lint errors, and the affected rows of
`TESTING_GUIDE.md` walked by hand **on a device** (web does not exercise haptics, AsyncStorage
clock keys, or background GPS — and neither does `npm test`, which covers pure logic only).
