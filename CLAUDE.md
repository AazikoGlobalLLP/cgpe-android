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
**AFTER** the project archive uploads, so a doomed attempt still costs the upload — check the plan
first, and tell the owner an APK is blocked rather than saying "shipping works". The editor-side gates
(`tsc`/`npm test`/`eslint`) are unaffected; work can continue, it just cannot reach a phone.
**RE-CONFIRMED 2026-08-31 (Phase 90):** the quota was **still exhausted** on 31 Aug — the attempt
failed with *"will reset in 18 hours (on Tue Sep 01 2026)"* and **no build was created**; the newest
build is still `093a3b33`. So "resets 1 Sep" means **1 Sep, not the evening of 31 Aug** — do not
re-attempt on the 31st expecting it to have rolled over. The one good outcome of that attempt was
finding the 347 MB archive bug below; a refused attempt now costs a **5.9 MB** upload, not 320 MB.
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
✅ **THE 317 MB ARCHIVE IS FIXED — 347 MB → 5.9 MB, 2026-08-31 (`4a12899`). This line used to say
"consider an `.easignore` at some point"; there has been one since the FIRST COMMIT (7 Aug) and that
was the whole problem.** 🔴 **`.easignore` REPLACES `.gitignore` for the build archive — it does not
add to it.** `eas-cli`'s `vcs/local.js` `initIgnoreAsync` **early-returns the moment `.easignore`
exists**, so all 32 rules in `.gitignore` were never consulted, and `e2e/artifacts/` — gitignored,
but absent from `.easignore` — shipped **338 MB of Playwright videos and traces in every single
build**. A doomed attempt therefore cost minutes and the archive was **347.1 MB / 820 files** for a
project whose own source is ~6 MB. `e2e/`, `test-results/`, `playwright-report/`, `.playwright/` and
the root `*.mp3` scratch files are now listed; excluding `e2e/` wholesale is safe and is what the
harness already documents (tsconfig excludes it, eslint ignores `e2e/**`, Vitest is scoped to `src/`,
never bundled). **If you add anything to `.gitignore` that is large, add it HERE too or it uploads.**
🔴 **AND THE SAME RULE APPLIES TO EVERY SECRET — THIS WAS LIVE, NOT HYPOTHETICAL (2026-08-31,
`954a0a4`).** Phase 90 committed the size half of this finding and left the rule **one-sided**: it
never occurred to anyone that `.gitignore`'s *secret* rules were equally dead for the archive. A
re-measure the next morning found **five gitignored files in the 297-file archive, four of them
secret and all four sitting on disk since 29 Aug**: `credentials/android/keystore.jks` **and**
`@shivam-bhadoriya__ANDROID.bak.jks` (the Android app-signing keystore, twice),
`credentials.json` (its keystore **and key passwords, in plaintext** — `eas credentials` writes them
that way), and `com-cgpe-connect-firebase-adminsdk-*.json` (the **FCM V1 service-account private
key**). The keystore plus its passwords is the ability to sign an APK that Android accepts as an
update to CGPE Connect **on all 21 handsets**; the Firebase key grants push + admin on the project
and is **not** something EAS holds in this form — it belongs only inside `eas credentials`. All the
secret patterns are now mirrored into `.easignore` (`credentials.json`, `credentials/`, `*.jks`,
`*.p8`, `*.p12`, `*.key`, `*.pem`, `*.mobileprovision`, `*-firebase-adminsdk-*.json`,
`google-service-account*.json`, `.env*.local`). **`google-services.json` is the CLIENT config and
must KEEP shipping** — check any new `*.json` pattern against it. ⚠️ **A gitignored secret is NOT
protected from the upload. When you add a secret rule to `.gitignore`, add it to `.easignore` in the
same commit.**
**Measure, do not assume** — three plausible theories (Windows backslashes in `path.relative`, CRLF
rules, a sub-`.gitignore` hijack) all died to one measurement. Replicate the real filter:
`Ignore.createForCopyingAsync()` from eas-cli's own `build/vcs/local.js`, walk the tree, sum the
files that survive it. That is how 347.1 → 5.9 MB was verified, along with a companion check that
**zero build-essential files** (`app.json`, `package-lock.json`, `google-services.json`, `tsconfig`,
`src/`, `assets/`, `public/`, `scripts/`) were excluded.

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
- ⚠️ **EVERY SOURCE FILE IN THIS TREE IS CRLF — a scripted splice that anchors on `
`-joined
  text WILL find nothing (Phase 88, 2026-08-31).** The first attempt at every edit this session failed
  its `anchor in src` assertion for this reason alone, on a string copied verbatim out of the file.
  Normalise the anchor to the file's own line ending first (`nl = '
' if '
' in src else '
'`,
  then `anchor.replace('
', nl)`) — or just use the Edit tool, which handles it. The
  write-to-a-temp-file-and-assert-it-is-larger rule is what makes a failure here a **no-op instead of
  damage**; keep it on every scripted write, not only on `INBOX.md`.
- ℹ️ **A docs edit in this CRLF tree shows up as a WHOLE-FILE diff, and that is cosmetic.** The Edit
  tool writes LF, so git rewrites the file's line endings and `--stat` reports something like
  `CLAUDE.md | 1915 +++----`. Before assuming you clobbered something, run
  `git diff HEAD~1 HEAD --ignore-cr-at-eol --stat` — Phase 89's 1116/959 collapsed to the **167/10**
  that was actually intended. Check the line COUNT too (`git show HEAD~1:<f> | wc -l`), which is the
  cheap proof nothing was lost.
- ⚠️ **A root cause recorded in `docs/` is a HYPOTHESIS until someone re-reads the code.** Phase 77
  inherited three documents all naming `Appear`'s `cancelAnimation` as the More→Today blank screen,
  and it is **wrong**: `Appear`'s effect deps are constants at every Home call site so its cleanup
  runs only at unmount; react-freeze is OFF (`react-native-screens` ships `ENABLE_FREEZE = false`
  and nothing calls `enableFreeze()`); there is no `unmountOnBlur` and `BottomTabView` only appends
  to `loaded`; and reanimated 4.5's `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS` bakes a settled
  `opacity: 1` into React's committed props within ~1 s. **Shipping the "fix" would have spent an
  APK on a no-op and handed the owner another confident-but-wrong "fixed".** Do not re-file it.
- ⚠️ **AND THE CROSS-REPO CASE IS WORSE, BECAUSE ANOTHER TEAM PAYS FOR IT — VERIFY AN `[admin]` /
  `[api]` ITEM AGAINST THE SIBLING'S REAL SOURCE IMMEDIATELY BEFORE FILING IT (Phase 91, 2026-08-31).**
  Three `[admin]` items had sat on our board since 2026-08-26. Re-read against the sibling's actual
  code, **two of the three did not survive**: *"an admin can see staff live location"* was **already
  fixed end-to-end** (the app was always right, the backend 403s a non-`super_admin` at
  `routes/timeTracker.js:1008` **on deployed `origin/main`**, and `cgpe-front-main-RECOVERED` has **no
  live-location view at all** — its only staff coordinates are the payroll geofence *anchor* input at
  `Payroll.tsx:447-451`), and *"the Assign Task button shows Create Task"* names a button that **does
  not exist** (it is a label in `TeamTasks.tsx`, whose assign-to-others dialog says "New task" /
  "Create task" at `:260`/`:365`/`:391` while carrying an "Assign to" field at `:372`). Filing all
  three as written would have sent `cgpe-admin` chasing a screen they do not have **and left an
  already-closed security item open on the board.** A board entry is exactly as stale as the day it
  was written, and one `grep` in the sibling repo settles it. **Two of three is not a good hit rate —
  check every time, and say plainly which items you are CLOSING rather than filing.** State the
  caveat you cannot resolve, too: we read `cgpe-front-main-RECOVERED`, so "no such view exists" is
  only true of the checkout we can see.
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

⚠️ **AND A THIRD, SMALLER TRAP THE LAZY REQUIRE CREATES: IT IS UNTESTABLE (Phase 86, 2026-08-31).**
A lazy `require()` resolves through **Node**, not through Vite — so a `vitest.config.mts` alias
**cannot** redirect it (the alias only rewrites Vite's own module graph) and a `vi.mock()` factory
**cannot** intercept it either (Vitest's module mocking is ESM-only). Both were tried; a probe test
proved the `require` reaches the real `node_modules` copy and dies on
`Stripping types is currently unsupported for files under node_modules`. So the code path behind
the require is reachable in tests **only as a caught throw** — which looks green and pins nothing.
**The fix is a seam, not a stub: put the native call in its own tiny module that exposes a plain
function, and let callers `import` THAT.** `vi.mock('@/lib/<seam>')` then works normally, and the
module's own top level stays native-free so the Vitest graph is still safe. The live example is
`src/lib/binaryUpload.ts` (the presigned PUT — `fetch` cannot stream a `file://` body on RN), and
the reasoning is written in its header. **Do not add a `test/stubs/*` entry for a module reached by
`require` — it will silently do nothing.**

## 🔴 THE FOURTH TRAP, AND IT COST FOUR APKs IN ONE DAY: a UI-thread worklet (2026-09-01)

**A plain JS function called from a Reanimated worklet body KILLS THE APP IN RELEASE.**
`useAnimatedStyle` / `useDerivedValue` / `useAnimatedProps` bodies run on the **UI thread**.
Reanimated cannot call a non-`'worklet'` function from there — it raises *"Tried to synchronously
call a non-worklet function on the UI thread"* — and a **release build has no LogBox, so an
unhandled JS error is reported as FATAL and the process exits.** The user sees *"CGPE Connect keeps
stopping"*, which is **indistinguishable from a native crash** and sends you hunting native modules.

The live example: `OrbStatic`'s `clamp01` was missing its directive while
`useDerivedValue(() => … clamp01(level.value))` called it. Two APKs (`372cd790`, `577a4ec5`) exited
the moment voice mode opened.

- ⚠️ **NO GATE IN THIS PROJECT CAN SEE IT, AND NONE EVER WILL.** `tsc` types it fine, `npm test`
  never renders it, `eslint` has no rule for it, and `expo export -p web` passes because the web
  build does not drive Reanimated's UI thread this way. **All four were green on both crashing
  builds.** Only a handset finds it.
- ⚠️ **NO ERROR BOUNDARY CATCHES IT.** See the next section — this is not a render-phase throw.
- 🔎 **HOW TO AUDIT IT IN ONE COMMAND:** `grep -rn "'worklet'" src/` should account for **every**
  function called from a worklet body. As of 2026-09-01 the answer is: `OrbSkia.tsx:27` and
  `OrbStatic.tsx:34`, and **every other animated style in the app is self-contained** (only `Math.*`
  built-ins and Reanimated's own `interpolate`, which are safe). **If you add a worklet that calls a
  local helper, the helper needs the directive** — or inline the maths, which is what
  `VoiceWaveform`'s `Bar` does and is the bulletproof option. `OrbStatic` now does **both**, on
  purpose, so an edit to one cannot reintroduce the fault.
- 🔑 **The general rule: an ASYMMETRY between sibling files is evidence.** The identical helper
  existed in three places — workletized in `OrbSkia`, hand-inlined in `VoiceWaveform`, and plain in
  `OrbStatic`. That inconsistency was the whole diagnosis, and it was visible from a `grep`.
- 🔑 **And a fallback runs more often than the thing it backs.** `OrbStatic` renders as the Skia
  orb's `Suspense`/boundary fallback **and** as the sole character once Skia is off — which is why
  switching Skia off (twice) changed nothing. **When a component fails, read what its FALLBACK does
  before blaming the component.**

## What a React error boundary does NOT catch — checked before relying on one (2026-09-01)

`_layout.tsx`'s exported `ErrorBoundary` (whole-app) and `ui/FeatureBoundary.tsx` (one subtree) both
cover **render and commit only**. They do **not** cover:
- **event handlers** — `onPress={…}`, and this app calls `async` handlers **unawaited**
  (`VoiceMode`'s `onPressIn`/`onPressOut` now `.catch()` explicitly for exactly this reason);
- **promise rejections** — anything after an `await`;
- **UI-thread worklets** — the trap above;
- **native aborts** — a `.so` that kills the process before any JS runs.

⚠️ **Phase 93 added a boundary around voice and reported it as containment. It could not have helped
with any of the four.** Adding a boundary is not a reliability answer on its own — **say which phase
the failure occurs in first.** `ui/FeatureBoundary.tsx` is still correct for render-phase faults in
an optional feature (it removes the feature instead of unmounting the React root and erasing the
back stack) and its limits are written at the file. Do not widen the claim.

## Testing voice WITHOUT a phone, an APK, or a server secret (2026-09-01, Phase 96)

`node scripts/voice-probe.mjs` — needs only `CGPE_EMAIL` + `CGPE_PASSWORD` in the shell. It signs in,
prints **`GET /voice/status`** (which legs the server has configured — the definitive answer to "are
the voice keys set?", names only, never values), then runs every clip in `e2e/voice-probe/audio/`
through the real **STT → brain → TTS** chain and prints what was heard, which screen would open, and
what it said back. Generate the clips first, free and locally:
`powershell -ExecutionPolicy Bypass -File scripts\make-voice-clips.ps1`.
- 🔑 **The audio path needs NO `CGPE_VOICE_SECRET`** — the backend holds the brain secret and makes
  that call itself. The secret only unlocks the extra text-only battery straight to the brain.
- **Windows' `System.Speech` writes the test clips for nothing** (no vendor, no credits), and the
  backend's own filter already accepts `.wav` (`routes/voice.js:47`). ⚠️ This machine has only en-US
  voices, so it tests the ENGLISH half; the Hinglish staff speak needs a voice pack or a human.
- ⚠️ **Multi-command in one query is a CONTRACT limit, not a bug** — one reply carries one `action`
  (`voice/response.ts`), and writes are dark in v1. Pinned by `brainShapes.test.ts`; do not "fix" it.
- `src/voice/__tests__/brainShapes.test.ts` holds responses **transcribed verbatim from the wire**,
  with the capturing command beside each. `response.test.ts` proves we handle JSON we *imagined* —
  a weaker claim, since parser and fixtures share an author. Add real captures here, not there.

🔴 **EXPO GO IS A DEAD END HERE — do not spend a session on it again.** Two independent failures on
2026-09-01: the phone's client was older than SDK 57 (needs Expo Go Android **≥ 57.0.9**, confirmed
against `https://api.expo.dev/v2/versions/latest`), and after updating, the tunnel could not deliver
the 15 MB bundle (`java.io.IOException: Failed to download remote update`). LAN mode works but needs
the same WiFi. **And it could never prove release safety anyway**: Expo Go runs a DEV bundle with
LogBox, so the fatal worklet error that cost four APKs would have been a dismissible red box.
⚠️ **`expo install --check` reports 24 packages behind the SDK-57 patch set, and upgrading them is the
obvious "fix" — DON'T.** `react-native` and `react-native-reanimated` are on that list, and reanimated
is where the crash came from. Do not trade a known-good release baseline for a dev tool. Full
write-up, with the honest limits of each route: `docs/TESTING-WITHOUT-A-BUILD.md`.

## React state cannot gate a handler that races an `await` (2026-09-01, Phase 96)

`finishCapture` opened with `if (state !== 'listening') return`. On the **first** press that is always
false, because `startCapture` is parked on the Android microphone permission dialog and has not
reached `setState('listening')`. The release did nothing; the permission then resolved and recording
began **with no finger on the button and nothing left to stop it** — a microphone left open for
minutes, and the next press dying on `expo-audio`'s own guard (`AudioRecorder.kt:84`,
*"AudioRecorder has already been prepared"*).
- **Any handler that must undo work an `await`ed sibling started has to read a REF, not state.**
  `useVoiceTurn` now uses `heldRef` (button down *now*) + `liveRef` (recorder needs teardown) and one
  **idempotent `teardown()` reachable from every exit path** — released button, thrown prepare,
  `close()`, unmount. There was previously no single place that guaranteed teardown, so every path
  that did not go through `finishCapture` simply leaked.
- **Ask for a permission when the SURFACE OPENS, not on first use.** The dialog is modal and eats the
  gesture, which is why the owner's very first hold never worked.
- ⚠️ **A recovery path must separate a STATE failure from a CONFIGURATION one.** The preset-fallback
  re-prepare is right when the encoder refuses our mono/metering options and **useless** for
  "already prepared", where nothing changed and the second throw is identical. `isAlreadyPreparedError`
  (`src/voice/recorderError.ts`, pure + tested) routes them apart. Keep it narrow — an unrecognised
  error must fall through to the options fallback.
- ⚠️ **`VOICE.MAX_RECORD_MS` had ZERO consumers** until this phase: a documented "hard cap" that
  nothing enforced, so a leaked capture grew without bound. Same family as the Phase-79 `channel`
  field. **`exceedsAudioCap` is STILL unconsumed** — know that before relying on it.

## Voice: two switches, and why both are where they are (2026-09-01)

- **`VOICE_ENABLED`** (`src/voice/enabled.ts`) — the whole feature. `false` means `VoiceLauncher`
  renders **no button** and `VoiceModeInner` never mounts, so `expo-audio`, the Reanimated voice
  surfaces and every voice import never load. **This is the one-line kill switch if voice crashes
  again — use it instead of guessing.**
- **`VOICE_HEAVY_GRAPHICS_ENABLED`** (`src/lib/voiceGraphics.ts`) — Skia orb, `expo-blur`, Lottie.
  **`false`, and they were NOT the crash.** They stay off because they are decoration that has never
  run on a handset; re-enabling is a separate decision needing its own device test. **Do not flip it
  as a side effect of unrelated work.**
- ⚠️ **`VoiceMode` is a SHELL + `VoiceModeInner`.** The shell reads one context value so the inner
  hooks never run while closed. Before this split, `useVoiceTurn` → `useAudioRecorder` sat **above**
  `if (!isOpen) return null`, so a native recorder was constructed on **every app boot**. Keep the
  split; do not "simplify" it back into one component.
- **A failed turn now reports its real cause** (`src/voice/cause.ts` → the banner's message line),
  because every path used to `catch { fail(…) }` and discard the exception, leaving a screenshot with
  zero diagnostic value. **When you write a `catch` that shows a friendly sentence, keep the real one
  too.** The banner title is now the sentence the failure produced (it used to be hard-coded, so an
  unconfigured server read "Something went wrong, please try again" **above** "Voice is not switched
  on for this server yet"), and the retry action is withheld when `permanent`.

## Builds are now identifiable, and the quota is a measured number (2026-09-01)

- ✅ **`eas.json`'s `preview` profile carries `autoIncrement`.** versionCode went 1 → 2 → 3 → 4 → 5 on
  2026-09-01. Before that **every** preview build was versionCode 1 and only an APK SHA-256 could
  tell two builds apart. **The next build is versionCode 6 — never describe it as fixed.**
- ⚠️ **ASK WHICH BUILD IS INSTALLED BEFORE BELIEVING A BUG REPORT — but ask INSIDE THE APP, at
  `Settings › Version`, NOT in Android's App info.** 🔴 **This line used to send you to
  `Settings › Apps › CGPE Connect → 1.10.0 (N)`, and on the owner's Redmi that screen prints NO BUILD
  NUMBER AT ALL — just "Version: 1.10.0" (screenshot, 2026-09-01).** MIUI hides `versionCode`. Worse,
  the app's own Settings row showed `APP.version`, a **hard-coded string identical in every build ever
  made**, so on the one day the entire question was "is the fix installed?", *nothing on the handset
  could answer it* and a whole debugging round was unfalsifiable. Fixed in `9ecaa9e`:
  `src/lib/buildInfo.ts` reads `expo-application`'s `nativeBuildVersion` behind a lazy require (native
  module — the module-scope-throw trap) with the pure, tested `formatBuild` beside it, so **Settings
  now reads `1.10.0 (6)`**. Keep that row working; it is the only build discriminator a user can read.
  🔑 **General rule this bought: an instruction that cannot be executed on the user's actual device is
  not a process. If you write "ask the user to check X", confirm X exists on THEIR phone.**
- 📊 **THE FREE-PLAN QUOTA IS 15 ANDROID BUILDS PER MONTH — measured, not quoted.** August ran
  **15** and then refused; July ran 13 and did not. Four were used on 1 Sep. **The old "quota is
  precious" anxiety was out of proportion — but the discipline it produced is still right for a
  better reason: the real cost of a bad build is 21 handsets on a broken app, not a build credit.**
- ✅ **EAS UPDATE (OTA) IS INSTALLED AND CONFIRMED WORKING ON A REAL HANDSET — Phase 98, 2026-09-02
  (`11eff09`; build 6 = `80df5c5a`). This line used to say it was NOT installed; do not re-file it.**
  The owner ran the full round trip: install → the banner appeared unprompted → tap → restart →
  `Settings › Version` gained the `· u…` suffix. **Device-verified, not merely built** — which also
  incidentally proved the banner's press handler survives a release build, where an unhandled throw
  is fatal (the `'worklet'` trap that cost four APKs). `expo-updates@~57.0.21`, `updates.url` + `runtimeVersion` in `app.json`,
  `channel` on every `eas.json` profile. **Publish a JS fix with
  `npx eas-cli update --channel preview --message "<what changed>"`** — no rebuild, no quota, ~30 s
  to reach a phone. `checkAutomatically: ON_LOAD` applies it at the next cold start on its own; the
  `UpdateBanner` offers a one-tap restart so it does not have to wait that long.
  🔴 **ONLY BUILD 6 AND LATER CAN RECEIVE AN UPDATE.** Builds 1–5 and the 25-Aug field APK have no
  `expo-updates` native side, so **no OTA can ever reach them** — those handsets need one manual APK
  install to get onto the update train, and after that never again. Say this plainly to the owner;
  "we can fix it over the air now" is false for every phone still on an older build.
  🔴 **`runtimeVersion` IS THE `fingerprint` POLICY, AND THAT MAKES `eas.json` / `.easignore` /
  `.gitignore` LOAD-BEARING FOR OTA.** Measured, not assumed: those three files are hashed as
  fingerprint *sources*, so **editing any of them changes the runtime version and an update
  published afterwards will silently not match build 6** — `eas update` succeeds, and nobody
  receives it. The failure is a no-op rather than a crash (which is the direction you want), but it
  reads as "OTA is broken". **Before publishing, run
  `npx expo-updates fingerprint:generate --platform android` and confirm the hash still matches the
  build's**; `eas update` also warns when a branch has no compatible builds — do not skip past it.
  ⚠️ **The Windows fingerprint trap did NOT reproduce** (`36864e87` → `067cf142`, exit 0, twice).
  `EAS_SKIP_AUTO_FINGERPRINT=1` remains the escape hatch if it returns — **but do not use it now**:
  under this policy the fingerprint is the runtime version, not an optional local nicety.
  ⚠️ **`fallbackToCacheTimeout` is 0 and must stay 0** (introspect: `EXUpdatesLaunchWaitMs: 0`). Any
  other value makes the splash wait on `u.expo.dev` before the app renders, which on this project's
  documented IPv6/NAT64 stall means a 12-second hang on a network where the app otherwise works.
  ⚠️ **Nothing in `lib/ota.ts` reports to `data/health`, on purpose.** Convention #4 is about the
  BACKEND. `u.expo.dev` is a different host holding none of the user's data, so an unreachable update
  server is a non-event — reporting it would raise the outage banner and tell the user their data
  could not be loaded while every list on the phone is fine.
  ⚠️ **The app OFFERS a restart; it never performs one.** `reloadAsync()` erases the navigation stack
  (the same mechanism documented at `CrashReport.retryLabel`), so an unasked reload would destroy the
  user's in-progress form to fix a bug they had not noticed. Do not "improve" this into an auto-apply.
- 🔴 **OTA SILENTLY BREAKS THE BUILD DISCRIMINATOR, AND THE REPAIR IS PART OF THE SAME COMMIT.**
  `9ecaa9e` put the native build number in `Settings › Version` because "ask which build is
  installed" was impossible to follow on MIUI. The moment updates ship, **`1.10.0 (6)` is true of
  build 6 running ANY of its updates**, so the one field-readable identifier in the app stops
  identifying anything and every bug report becomes unfalsifiable again — the exact hole 9ecaa9e was
  written to close, re-opened from the other side. `formatVersionLine` (`lib/buildInfo.ts`, pure +
  tested) now renders **`1.10.0 (6) · u3f9c1a`**, and **the ABSENCE of the `· u…` suffix is itself
  information: that handset has taken no update.** Ask for the whole string, not the version.
  🔑 **The general rule this is the second instance of: when you add a mechanism that changes what a
  displayed value MEANS, the display is part of the change.** Same family as the Phase-79 `channel`
  field and the Phase-96 `MAX_RECORD_MS` — a value nobody re-read after the thing beneath it moved.

## `GET /dashboard/overview` can answer 200 with numbers that are not real (2026-09-01)

Backend Phase 110 replaced `.catch(() => [])` with a `softRead`: a failed source read now returns
**200** with that source's KPIs **zeroed** and `partial:true` + `degraded:['claims', …]` **inside
`data`**. The app read neither field, so the master dashboard printed "0 claims, ₹0 settled" as
though true — convention #4's exact failure mode on the most trusted surface in the app.
`getDashboardOverview` now re-reports to `data/health` when `partial === true` (kind `'server'`).
🔑 **A client cannot detect this class at all** — the status is fine, the body is valid, there is
nothing to retry. **The producer is the only party who knows.** Same argument as the Phase-89
notification id-kind bug, from the opposite direction. *(`routes/claims.js` also uses the word
`partial` for a partly-settled claim — unrelated; do not conflate them.)*

## Read the sibling's UNDEPLOYED commits, not just the items addressed to you (2026-08-31)

⚠️ **A backend change to a route THE APP ALREADY USES can land with no INBOX item at all.** Phase 87's
handoff sweep ran `git -C ../cgpe-backend-main log --oneline origin/main..origin/Shivam` — 29 commits —
and found **Phase 101 (`9a74c9a`)**, which changed what the legacy `POST /api/upload` returns: a
**short-lived presigned GET** as `url`, plus `key`/`storage_key`/`url_expires_in`. The app reads only
`data.url` (`src/data/api.ts:3640-3642`) and records it as `file_url`, so on the day that deploys **and**
`S3_*` is set, every legacy upload persists a link that expires — the exact trap D-122 warned about.
**Nobody filed it to us**, because from `cgpe-api`'s side it was a bug fix to their own route, not a
contract change. `INBOX.md` alone would never have surfaced it.
- **So at `/boot` and at `/handoff`, list the sibling's undeployed commits and read any that touch a
  route the app calls.** The commit list is cheap; the commit MESSAGE is not enough (Phase 101's says
  "finish MinIO", which reads as internal). Open the diff for the routes you consume.
- **The same sweep is how you find undeployed SECURITY work** — that window also held a `password_hash`
  leak fix, an unauthenticated arbitrary file read, and an AI-query exfiltration path, none of them
  running in production. Worth naming to the owner, since "written" reads as "done" on every board.
- **A deploy can therefore be a REGRESSION RISK for builds already on phones**, not just an
  improvement. The newest field APK is `093a3b33` (25 Aug); a fix shipped in `src/` today does not
  reach it. When a backend change would break an installed build, say so, and give the sibling the
  ordering choice rather than assuming they know.
- ⚠️ **THE SWEEP IS RECURRING, NOT A ONE-OFF — it has found something on BOTH runs.** Phase 87's found
  Phase 101; **Phase 89's found that `POST /api/notifications/dispatch` is broken on production right
  now**: it stamps rows `user_id: r.user_id` (the app `USR-…` id) while `GET /notifications` filters
  `user_id: req.user.id` (the Profile `_id` hex), so every team notice an admin sends is written,
  counted, reported back as delivered — and read by **nobody**. Fixed in `d4fad85`, undeployed.
- 🔑 **THAT CLASS OF BUG IS UNDETECTABLE FROM THE APP, WHICH IS THE ARGUMENT FOR THE SWEEP.** The write
  returns 201 and the reader is a *different query* — there is no response to inspect, no status to
  branch on, and no honest-empty-state convention that helps. `tsc`, `npm test`, `eslint` and a device
  walk-through are all blind to it. **Only reading the producer's diff finds it.**
- 🔎 **A DELETED ROUTE IS A FREE LIVE DISCRIMINATOR FOR "WHICH BUILD IS RUNNING".** Backend Phase 105
  deletes `GET /api/users/test`; it still answers **200** on prod, so the deployed build predates it —
  one no-auth `curl`, no token, no guessing. Reuse the trick: pick a route the pending window *removes*
  and probe it, rather than inferring the deploy state from a commit graph alone.

## The client book moved to the `client` collection — and the app's job is the FIELDS, not a rename (2026-09-01)

🔴 **"Change `clients` to `client` everywhere" is NOT an app task, and a find-and-replace of `src/`
would 404 the entire client book.** The app contains **no Mongo collection name at all** — `grep -rn
"collection" src/` returns only source comments and the search screen's own copy. It calls the REST
path `/api/clients*`, which did not move. `cgpe-api` did the whole job in their **Phase 118**
(`644ff2b`): 14 call sites now route through `utils/clientCollection.js` →
`CLIENT_COLLECTION = process.env.CLIENT_COLLECTION || 'client'`, every URL / body / response shape
**byte-identical**, rollback without redeploy by setting the env var back to `clients`.
- ✅ **THE APP-SIDE ADOPTION IS DONE — Phase 97, 2026-09-02 (`acfcc46`). This entry used to describe
  it as outstanding; do NOT re-file it.** Their INBOX item said "cgpe-mobile — nothing owed", which
  was right about the SHAPE and wrong about the DATA: the wire did not change, the **documents** did.
  `adaptClient` now reads `Area`→city, `E_mail`→email, `groupName`/`Group Head`→family,
  `annual_premium_sum`→`totalPremium`, plus `Sex`→gender, `Marriage Date`→wedding anniversary and
  `No of Policies`→the policy-count KPI. Every chain **APPENDS** the LIXXX name — an existing value
  still wins, the same rule the merge used ("fill current blanks only").
  🔑 **The owner's sample document is pinned verbatim at `docs/spec/PHASE-97-sample-client.json`** and
  drives the tests. It is a **Compass extended-JSON** dump (`{$oid}` / `{$date}`); the wire carries a
  plain hex `_id`, so the test fixture gives `_id` as the app really receives it — pinning `{$oid}`
  would pin `String(...)` = `"[object Object]"` as the client id.
  ⚠️ **`annualFactor` (exported from `adapt.ts`) mirrors the backend's CHAIN, not one function.**
  `normalizeMode()` repairs `halg-yearly`/`hamf-yearly` **before** `clientFlags.annualFactor()` sees
  them, and the app never normalises `mode` (it writes the raw string into `Policy.frequency`), so
  those two spellings are folded into our factor. Without them a typo'd row annualises ×1 in the app
  and ×2 in the panel and one client carries two different annual premiums. `MLY`-style codes fall
  through to ×1 on BOTH sides — imprecise, and kept matching on purpose. `cgpe-api` has recorded this
  in their `models.md` and will file an INBOX item before changing either function.
  ⚠️ **The household label is SUPPRESSED when it equals the client's own name.** `groupName` /
  `Group Head` carry the HEAD's name, so on the head's own record it merely repeats the title above
  it; it is kept for every other member, which is the only place it says anything.
  **Still unread, deliberately:** `Customer_Code`, `Telephone(Residence)` (the backend's own
  `pickPhone` does not read it either), `ppt`, `ecs`, `fprDate`, `lastPremiumPayingDate`,
  `dataAnalysis`, and the LIXXX `Premium` (a second annual figure whose semantics one sample cannot
  settle — `annual_premium_sum` is the one the merge audit reconciles).
  ✅ **The money path was checked, not assumed:** the renewal reminder builds its figure from
  `raw.premium` directly (`api.ts` `scanRenewals`), so no WhatsApp message tells a half-yearly client
  to pay the annual sum. Only the "Annual premium" KPI and the list metric moved — and that KPI's
  label has always said "Annual premium" in all five languages while showing an instalment.
- 🔴 **`AadhaarNo` / `PANNo` are on these documents. Do NOT surface them** in a field sweep —
  government ID on a shared handset is an owner decision under DPDP, and the client book already has
  a tighter audience by design (`canViewClients`, Point 9).
- ⚠️ **`annual_premium_sum` is a PERSON aggregate the backend WARMS, and is absent until it has.**
  `clientScoreWarmer` treats its presence as the "this row is warmed" marker. Never fall back to a
  bare `premium` (an instalment) — fall back to `premium × annualFactor(mode)`. And **say the change
  out loud**: switching `totalPremium` to the annual figure doubles a half-yearly client and ×12s a
  monthly one, which reads as a regression on a dashboard money tile even though it is correct.
- ✅ **Those columns DO reach the app — verified, not assumed.** The list route projects with
  `LIST_HEAVY_EXCLUDE` (an *exclusion* projection) and `GET /clients/:id` returns the full document.
  Non-schema fields survive the read: `policyNo` and `sumAssured` appear nowhere in `models/Client.js`
  yet the app reads both today.
- ✅ **BOTH `[api]` ITEMS WE FILED ARE SHIPPED — do not re-file either (verified in their repo
  2026-09-02, not read off the board).**
  **(a) The `Area` projection gap → their Phase 119 (`0179bc0`).** `Area: 1` is now in
  `DERIVED_PROJECTION` **and** `DIRECTORY_FACET_PROJECTION`, and the directory city sort resolves the
  same `address.city → city → Area` chain instead of its own copy of the rule, with `Branch N` kept
  as the last resort. The rule is a test now, not a comment.
  **(b) `dataAnalysis` riding on every list row → their Phase 120.** We measured it at **3,620 of
  5,021 bytes — 72.1%** of the owner's sample row, with no reader in either repo. **We asked for one
  key and it needed four:** `LIST_HEAVY_EXCLUDE` was the only site visible from an app, but grepping
  the *shape* rather than the name found `campaigns.js AUDIENCE_EXCLUDE` (up to 20,000 rows),
  `services/reportData.js CLIENT_HEAVY_EXCLUDE` and an inline one in `routes/userPortal.js`, both
  whole-book. **`GET /clients/:id` is deliberately unchanged and still returns the full audit.**
  🔑 **The transferable half: a grep for one spelling of a thing is not a survey.** Two of those files
  even claimed in comments to use "the SAME exclusion projection" and did not.
  ℹ️ Open, and owner-held: whether `dataAnalysis` is also on the LEGACY book (present on both ⇒ we are
  paying the cost today; only on `client` ⇒ it is a deploy-day regression). `cgpe-api` refused to
  guess and shipped **section 6 of `scripts/preflight-client-collection.js`** to answer it; it needs
  `MONGODB_URI`, which we do not have.
- 🔴 **`advisor_id` is on ZERO rows of BOTH books** (measured by `cgpe-api`, not inferred). So the
  **P90 SALES-advisor carve-out (D-117)**, which is strict own-only *by design*, returns an **empty
  client book** for that tier — today, on the legacy collection. **Do not weaken the carve-out to
  hide it and do not file it as a backend bug**; it is the owner's data decision (stamp ownership, or
  accept the book is admin-tier-only). Triage a "sales advisor sees no clients" report as this.
- 🔴 **Deploy state RE-VERIFIED 2026-09-02: STILL NOT DEPLOYED, and the window has grown.**
  `origin/main` is **unchanged at `0324dfc`** (the 1 Sep release, through their Phase 111 — confirmed
  live by `GET /api/users/test` → 404 and `cloudStorageConfigured: true`). Phases **118–123** —
  the collection move, the `Area` fix, the `dataAnalysis` fix, monthly-content scheduling, the
  advisor OTP sign-in — are all on `origin/ved` (`1515f8d`) and on no deployed branch. So **every
  field this app now reads is still absent from production**, ours and theirs alike. Adopting the
  names early is **inert-safe** (they are simply not there on the old book), but do not tell the
  owner it fixes anything they can see until the merge + deploy + `:3001` restart. Their preflight
  has **already been run** (0 blockers); do not re-ask for it.

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
  🔴 **BUT THAT RULE IS ONLY TRUE AT A TOP-LEVEL MOUNT, AND IT MISLED THIS SESSION (2026-09-02).**
  Under a router that blanket-protects (`router.use(protect)`), **every path 401s — including paths
  that do not exist** — so a `401` there proves the ROUTER is mounted and says nothing about the
  route. Measured: `GET /campaigns/localities` (added in their undeployed Phase 120) answered `401`,
  which reads as "deployed"; the control
  `GET /campaigns/definitely-not-a-route-xyz` answered `401` too, and so did
  `GET /clients/zzz-not-a-route`. **ALWAYS probe a deliberately impossible sibling path first.** If
  the control 401s, the probe is worthless and **the git refs are the only authority**
  (`git ls-remote origin refs/heads/main`, then `merge-base --is-ancestor <sha> origin/main`).
  The rule held for `/upload/presign` and `/voice/ask` because those answer from the app's own 404
  handler, not from behind a protected router — that is the difference, not luck.
- ℹ️ **`GET /api/users/test` now answers `404`, so it is SPENT as a discriminator.** CLAUDE.md used to
  say it answered 200 and therefore proved prod predated backend Phase 105; the 1 Sep release shipped
  that deletion, so the 404 now only confirms **prod is the 1 Sep release (through Phase 111)**. It
  cannot distinguish the pending 118–123 window, and no cheap live probe found so far can — see the
  control-probe trap above.
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
- ✅ **THE PRESIGNED MinIO FLOW IS ADOPTED — Phase 86, 2026-08-31 (`4d1c31a`). This entry used to say
  the app had NOT adopted it; it has.** `src/lib/binaryUpload.ts` + the pure seam in
  `lib/fileUpload.ts` (`parsePresignTarget`/`classifyPresignResponse`/`classifyPutStatus`/
  `parseDownloadUrl`), wired through `uploadFile`/`recordFileAttachment`/`listAttachments`/
  `getAttachmentDownloadUrl` and consumed by both claim screens. **Three decisions not to
  re-litigate:** a `presign` answering **404/501/503 falls back to the legacy multipart path**
  (which is why shipping ahead of the deploy is inert — prod is 404 today), a **415 does not**;
  a **`403` on the PUT is `'server'`, never `'unauthorized'`** (no session on that request — it is
  a signature mismatch or an expired 300 s window, which a retry fixes); and the
  `/file-attachments` write is **awaited and reported** on the presigned path (`'not_linked'`)
  because that row is the ONLY thing naming the object, while staying fire-and-forget on the
  legacy path where the file already has a durable URL. `?entity_id=` is **filtered again on the
  client** — the server-side filter is undeployed, so an old build returns the whole collection;
  keep the second filter after the deploy. The contract below is retained as the reference:
- ✅ **THE LEGACY PATH ALSO RETURNS A KEY NOW, AND THE APP READS IT — Phase 88, 2026-08-31
  (`eb9760f`). THE TWO PATHS ARE NO LONGER "KEY" vs "URL".** Backend Phase 101 (`9a74c9a`,
  `routes/upload.js:174-196`) made the legacy multipart `POST /api/upload` return a **short-lived
  presigned GET** as `url` plus `key`/**`storage_key`**/**`url_expires_in`**, because the public-style
  URL 403s against the now-private bucket. The app read only `data.url` and wrote it to `file_url`, so
  once that deploys **and** `S3_*` is set it would have persisted a link that expires — trap (a) of
  D-122 arriving through the one path the contract did not cover. `parseLegacyUploadResult`
  (`lib/fileUpload.ts`) now decides, and a "signed" answer is reported as `storageKey` with an
  **empty** `url`, which reuses the presigned plumbing with no call-site change.
  🔴 **DO NOT SIMPLIFY THE DISCRIMINATOR TO "`storage_key` IS PRESENT".** Phase 101's documented
  signing-failure branch **still sets `storage_key`** but falls back to the public URL with
  **`url_expires_in: null`** — there the URL is the durable thing and the signer that just failed is
  the one a re-sign would need, so keying on the key alone **throws away the only working link**. It
  must be `storage_key` **AND** a **finite** `url_expires_in` (`Number.isFinite`, not
  `typeof === 'number'` — NaN is a number). Six shapes are pinned by tests.
  ⚠️ **Branch on the `storageKey` FIELD, never on which path you think ran** — three comments said
  "presigned path" where they meant "has a key", and building on them would reintroduce the bug.
  The legacy key IS reachable: Phase 101 passes `ownerTag` into `cloudStorage.uploadFile`, so the
  proxy path builds the same owner-scoped key as the presigned one and passes `mayAccessKey`
  (`services/cloudStorage.js:78-89, 188-206`) — verified, not assumed.
- 🔑 **THE CONTRACT ITSELF (`cgpe-api` Phase 95, INBOX 2026-08-27).** `cgpe-api` Phase 95 (INBOX 2026-08-27) superseded the multipart upload with a
  **three-call presigned flow**: `POST /upload/presign` `{content_type, filename?, folder?}` →
  `{key, url, method:'PUT', headers:{'Content-Type'}, expiresIn:300, maxBytes:10485760}`; **PUT the
  bytes to that url with NO auth header** (the signature is the auth); then `POST /file-attachments`
  with **`storage_key`** and an EMPTY `file_url`. Render later via `GET /upload/download-url?key=…`.
  The `cgpe-mobile` box is now **ticked** with a full reply underneath. **Do not re-derive this
  contract; read the INBOX item.** Two traps written into the contract itself:
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
- ⚠️ **`VOICE.CEILING_MS` IS 80 s AND THAT IS DERIVED, NOT A TYPO — DO NOT "FIX" IT BACK TO 8 s (Phase 87,
  2026-08-31).** The proxy is three sequential vendor calls whose own timeouts are STT 30 + brain 20 +
  TTS 30 (`cgpe-backend-main/services/voiceService.js:54-56` at `a926650`), so 80 s is the SERVER's
  declared worst case. The old 8 s ceiling aborted healthy turns on a working server, showed "try
  again", and made the user re-record — **re-running the whole billed vendor chain while the first was
  still in flight**. `tsc`/`npm test`/`eslint` were all green on it and prod 404s, so no gate and no
  device could have caught it; only reading the producer's real code did. The 8 s lives on as
  `SLOW_MS`, which shows a hint and keeps waiting. **General rule: a client timeout must be sized to
  the producer's real timeouts, never to a UX wish.** An ask to tighten the server budget is filed.
- **A voice `404`/`501`/`503-with-`not_configured`` is `transport:'unconfigured'`, NOT `'server'`**
  (`isPermanentVoiceOutage`) — it must never show retry copy, because no retry can switch the service
  on. **A bare 503 stays transient**, and an unrecognised body falls through to `'server'`; keep it
  conservative in that direction. `voice.notSetUp`/`voice.stillWorking` ship in **English in all five
  dictionaries on purpose** (the `tab.search` precedent, not machine translation) — copy is owed as
  Batch 6h.
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
  `canIn()` returns the `SCHEMA_FEATURE_DEFAULTS` value when a role config omits a key, and the
  per-role docs are **unseeded** in prod (owner backlog Point 6), so `can('can_create_task')` etc. read **true for
  every tier today**. ⚠️ **This line said "mostly `true`" until 2026-08-31; counted against
  `appUi.tsx:96-112` it is 4 true / 10 false** — `can_clock_in`, `can_create_task`, `can_create_claim`,
  `can_claim_ticket` are the `true` ones (plus `global_search_scopes`, which defaults to the four
  scopes `clients`/`leads`/`claims`/`tasks`, **not** to none). The fail-open warning is unchanged and
  still correct — the four that matter for create affordances are exactly the `true` ones — but do not
  reason from "mostly true" about a flag you have not looked up. **The same fact bites the ADMIN PANEL
  from the other side:** a saved document that merely *omits* a key shows as OFF in its editor and is
  ON on the handset, which is why the panel was asked to save every key explicitly (INBOX
  `→ cgpe-admin · 2026-08-31`). To actually gate a create/assign/admin affordance FROM a lower tier, AND the flag with the
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

## The server handover — append to it as you go (owner-mandated 2026-08-31)

- **`docs/OPS-SERVER-HANDOVER.md` is the RUNNING LIST of everything the production server developer
  owes us** — deploys, `.env`, nginx, DNS, storage. **Every phase that discovers a server-side
  dependency appends to it**, so the final message is assembly, not archaeology. Rules written in the
  file: never write an item from memory (each line traces to a probe or a named file), **re-probe the
  "Live state" table whenever you touch it**, append rather than rewrite, and **variable NAMES only —
  no secrets, ever**.
- **`docs/PHASES.md` → "Phase Ω" is the MESSAGE, and it is BLOCKED BY DESIGN.** It may start only when
  **no phase is planned, blocked, or "built but device-unverified"** — that last one explicitly, since
  it is the status most of this project's work sits in and it is **not** Done. The person who runs
  production acts on that message **once**; a half-true instruction to production is worse than none,
  and one written while work is still moving is stale the next day. **Do not start it early**, and do
  not send `OPS-SERVER-HANDOVER.md` itself — it is written in our vocabulary, for us.
- 🔴 **The one item in it that must never be lost: the MinIO bucket must NOT be named `uploads`.**
  Storage is path-style, so the bucket is the first path segment, and `isEphemeralUrl` would then read
  every durable object as the local-disk fallback and warn users their evidence will not be kept. The
  app cannot fix this, and the obvious narrowing was refused on purpose (it would trade a harmless
  false alarm for a dangerous false reassurance).

## Done means
`npx tsc --noEmit` clean, `npm test` green, no new lint errors, and the affected rows of
`TESTING_GUIDE.md` walked by hand **on a device** (web does not exercise haptics, AsyncStorage
clock keys, or background GPS — and neither does `npm test`, which covers pure logic only).
