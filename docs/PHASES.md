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

**✅ 2026-08-27 (evening) — PHASE 82: THE COPY ARRIVED AND IS WIRED THE SAME DAY — ELEVEN
HALF-TRANSLATED GROUPS ARE NOW WHOLE.** Gates: `tsc` **0** · `npm test` **1069** (unchanged — no new
pure logic) · `eslint` **0 errors / 12 warnings** (baseline; the two on touched files were proven
pre-existing by re-linting a stash). Device-unverified.
- **Phase 81 ended saying there was no self-contained work left — it all needed copy, a device, a
  merge or a decision. The owner sent the copy.** 70 rows → **58 keys** (dictionary **226 → 284**),
  **68 of the 70 rows now render** in all five languages.
- **The eleven groups Phase 80's sweep left visibly half-translated are closed**: Claims register
  stats + filter chips, the Clients filter sheet, Home's needs-attention strip, the More
  quick-action tiles, the Search "Where it looks" table, the Campaigns and Analytics stat tiles,
  Client 360's KPI strip, the Lead pipeline caption, both task forms' Due/Priority controls, the
  team-member stat strip, and the Admin dashboard. **More's "Quick actions" eyebrow came free** —
  Phase 81 refused it only because the tiles under it had no copy, and that reason is gone.
- **🔴 A SUPPLIED ROW HAD NO CALL SITE, AND WRITING A KEY FOR IT WOULD HAVE BEEN THE DEFECT.**
  `0 clients in process` appears nowhere on screen — the Phase-80 scan lifted it out of a **source
  comment** in `screens/dashboards.tsx:279`. No key was added. Same family as Phase 79's
  zero-consumer `channel` and Phase 81's three unread keys, except this one would have been
  **created by us**, from copy the owner paid for. **Grep for the call site before adding a key.**
- **Row 65 `Agent map` is supplied and still unusable** — its only site is the Master controls row,
  where five of six buttons have no copy. Wiring one of six rebuilds the exact strip this batch
  removed. Its neighbours are Batch 6f.
- **Three judgement calls the owner delegated, all reversible in a line or two.** (1)
  `report.generating` adopts the **newer** of two conflicting Gujarati drops — a *language*
  judgement, flagged for a native reader. (2) **The tab bar was NOT rewritten**, so the app now says
  `ત્લાયન્ટ્સ`-vs-`ગ્રાહકો` on two screens on purpose — both are the owner's words,
  and rewriting the most-seen text in the app on our judgement cascades through four languages.
  (3) Home's follow-ups widget stays English rather than one-of-three translated.
- **Four apparent wins were refused** on the peer rule (Client 360's follow-up tag, the
  client-report summary rows, the Lead close-out section, the Master dashboard grid + controls) and
  became **Batch 6f — 23 strings**, which is what wiring 6a itself created.
- **⚠️ THE FREE-WINS HUNT IS REOPENED, exactly as its own rule predicted.** Phase 81 closed it with
  "only a new copy drop reopens this", and the re-run after this drop paid: **orphans are still 18**
  (so all 58 new keys have readers — no new dead copy), but **82 exact matches now exist that did
  not before.** Mostly the six no-sweep categories and already-filed 6d/6f peers — **but not
  verified one by one. That triage is Phase 83.**
- **A sub-component can have no translator at all**: `search.tsx`'s `Resting` had no `useT()`, and
  only `tsc` said so — 13 `Cannot find name 't'` errors that `npm test` and eslint were silent on.

---

## Superseded — Now, as of 2026-08-27 (after Phase 81)

**🔎 2026-08-27 (later still) — PHASE 81: THE NEAR-MISS SCAN — THREE SUPPLIED KEYS HAD *ZERO*
CONSUMERS WHILE FOUR SCREENS HAND-WROTE THE ENGLISH.** Gates: `tsc` **0** · `npm test` **1069**
(unchanged — no logic added) · `eslint` **0 errors / 12 warnings** (baseline, verified cache-free
with `npx eslint src`). Device-unverified.
- **WHY THERE WAS ANYTHING LEFT TO FIND.** Phase 80's scan matched hardcoded literals against
  dictionary **values** with **exact** string equality. This one **normalises both sides first** —
  case, trailing full stops, and **curly-vs-straight apostrophes** — and that last one alone hid
  three keys. `'Saved on this device — it'll sync…'` in the source uses a straight `'`; the
  dictionary entry uses a curly `’`. Byte-unequal, same sentence, invisible to Phase 80.
- **THE FIND: `sync.savedLocal`, `sync.savedLocalNamed` and `report.generating` existed in all five
  languages with NOT ONE consumer** — the exact defect family as Phase 79's zero-consumer `channel`
  field and Phase 77's dead `||` fallback. Four call sites rendered the English by hand:
  `notes.tsx:226`, `task-new.tsx:201` (offline-save toasts), `(tabs)/leads.tsx:251` (the **named**
  variant) and `client/[id].tsx:284`.
- **⚠️ `leads.tsx` DISPROVES A STANDING EXCLUSION, NARROWLY.** Phase 80 excluded composed strings
  because "they need placeholder keys that do not exist". For this one **the placeholder key DOES
  exist** — `sync.savedLocalNamed` is `'{name} saved on this device — …'`, built for exactly this
  site. So the composed-string rule holds **only where no `{placeholder}` key was supplied**;
  before excluding a composed string, **grep the dictionary for a `…Named` variant first.**
- **`client/[id].tsx:284` was half-translated INSIDE ONE TERNARY** —
  `label={reporting ? 'Generating report' : t('report.generate')}`. The idle state spoke Gujarati
  and the loading state spoke English, on the same button. Wiring it closes the pair; there is no
  half-translation risk because both branches now have copy.
- **Two further sites wired by key reuse:** `commissions.tsx:224` (`tasks.viewMonth` — "This month"
  is adverbial in gu/hi, so it carries to a period heading unchanged) and `notifications.tsx:360`
  (`stage.new` on the unread Pill — **the same UI element** as the lead-stage Pill it was written
  for, and the dictionary already uses the standalone form `नया`/`નવું` there rather than agreeing
  with `लीड`, so this is consistency, not a new guess).
- **✋ WHAT WAS FOUND AND DELIBERATELY *NOT* WIRED — the half-translated-group rule doing its job.**
  Home's Portfolio-analytics tile row has **four** peer Eyebrows and only **two** have keys
  ("Claims open" and "Tickets" do not), so wiring two of four would have produced exactly the
  broken-looking strip Phase 80 warned about. Same call for `more.tsx:392` ("Quick actions" over
  tiles that are 6c menu tables), `lic-plans.tsx:163`, `clients.tsx:71`'s restricted notice,
  `job/[id].tsx`, `dashboards.tsx:441` and `notify.tsx:321`. **All 13 are now written out as
  Batch 6d** in `docs/i18n/COPY-REQUEST-2026-08-26.md` — they are the peers, not the wins.
- **DEP-ARRAY TRAP HIT TWICE AGAIN**, as predicted: `notes.tsx`'s `saveNote` and `leads.tsx`'s
  `onAdded` are both `useCallback`s, so `tr` / `t` had to join their dep arrays. **`tsc` and all
  1069 tests were green without them**; only cache-free `npx eslint <file>` catches it.
  `notes.tsx` binds the translator as **`tr`** — a local `t` is a `setState` accumulator there.
- **✅ THE QUESTION IS NOW CLOSED, NOT JUST ADVANCED — `--orphans` AUDITS THE OTHER DIRECTION.**
  The literal scans can only find copy whose English a screen happens to hand-write, and they are
  blind to template literals. So the audit was re-run **from the dictionary**: for each of the 226
  keys, does any file under `src/` reference it? **18 have no consumer, and after triage NOT ONE is
  a free win.** Two were `tab.home`/`tab.tasks`, which are **false positives** — `(tabs)/_layout.tsx:151`
  does `t('tab.' + route.name)`, so a runtime-assembled key looks orphaned and is not (the script
  now guards on the prefix). Three are blocked (`sync.droppedOne`/`droppedMany` in `api.ts`, which
  has no non-React translator; `task.followUp`, backend data). Three are composed strings whose
  `{placeholder}` key was never supplied. **The rest is dead copy for surfaces that no longer
  exist — there is no `src/app/premium.tsx` any more**, so all four `premium.*` keys are for a
  screen that was consolidated into `campaigns`. **So: there are no more free wins. Do not re-run
  this hunt hoping for more; run it after the next COPY DROP.**
- **THE THREE THAT ARE OWED WENT TO THE OWNER AS BATCH 6e** — `home.vsLast` and `premium.sendAll`
  need `{pct}`/`{n}` variants (Commissions reads "+12% vs last month", Campaigns "Send to all 42",
  and gluing words onto a number breaks Hindi/Gujarati word order), and Home's follow-ups empty
  state needs only a **wording decision** — `home.noFollowups` says the same thing as the screen's
  `'No follow-up is pending'` in different words, so no new translation is required. **That widget
  was NOT wired**: its title, See-all and Try-again already translate, but its subtitle and its
  `'Open follow-ups'` button have no keys, so swapping the empty title alone would half-translate
  it again — and adopting differently-worded English is the owner's call, not ours.
- **THE SCAN IS WORTH KEEPING.** Re-run the near-miss variant (not just the exact one) after every
  copy drop. Two traps carried over from Phase 80 and both still bite: parse the dictionary with a
  **tokenizer** (a line-anchored regex read 124 of 226 keys), and use a **2-character floor**. New
  third trap: matching **case-insensitively on single words** produces ~500 hits of pure identifier
  noise — **filter to multi-word strings** to read the near-miss list at all.

**🌍 2026-08-27 (later) — PHASE 80: 73 CALL SITES WIRED FROM COPY THE OWNER HAD ALREADY SUPPLIED · BATCH 6 EXTRACTED · THE OWNER RELAY SHEET.**
Commits `9074d08` · `d746d39`, pushed to `aaziko/Shivam`. Gates: `tsc` 0 · `npm test` **1069**
(unchanged — this phase adds no logic) · `eslint` **0 errors / 12 warnings** (baseline, verified
cache-free with `npx eslint src`). Device-unverified; no APK is possible until 1 Sep 2026.
**The owner said "no APK now — finish everything first", so this phase is the everything that could
be finished without them.**
- **🔎 THE FINDING: 117 PLACES IN THE APP SHOWED ENGLISH THAT WAS ALREADY TRANSLATED.** A scan
  compared every hardcoded literal in `src/` against the shipped English dictionary and matched on
  EXACT text. The copy existed in gu/hi/hi-en/gu-en — supplied weeks earlier — and **no screen ever
  read it**. **73 sites are now wired across 42 keys.** The parity test cannot see this class of gap
  (it only proves a key EXISTS in all five languages), and neither can `tsc` or `npm test`.
- **⏰ THE BIGGEST ONE IS THE CLOCK-IN FLOW.** Seven failure notices in `home.tsx` matched
  `common.offlineBody` **word for word** — clock-in, clock-out and both break paths — so the screen
  every advisor touches every day answered a failed punch in English to a Gujarati user.
  ⚠️ **This does NOT contradict the Phase-78 note that "zero sites match `common.offlineBody`
  verbatim".** That was true of the **39 empty-state** sentences it was written about, and it is
  still true of them. These seven are **write-failure** notices — a different set of strings. Both
  statements are correct; the copy request now says so explicitly so nobody "corrects" either one.
- **🚫 WHAT WAS DELIBERATELY NOT SWAPPED, and each reason is load-bearing:**
  (a) **`place: 'On duty'` (`home.tsx:845`) is PERSISTED to AsyncStorage** — translating it bakes
  today's language into stored state and strands a user who switches. (b) **task-new's `CATEGORIES`
  and the icon maps in `search.tsx`/`data/tasks.ts` are DATA** — category strings are sent to the
  backend and map keys are looked up, not displayed; translating them would write Gujarati into the
  database. (c) **Module-scope label tables** (`MORE_CATALOGUE`, prospects `STAGE_META`,
  notice-board `CATEGORY`, segments' fallback flags, campaigns `KIND_LABEL`, notify options) need a
  `labelKey` refactor **plus copy for every entry** — wiring the one or two that have keys would
  produce a **navigation menu in two languages**, which is worse than one. (d) **Module-scope date
  formatters** (`calendar` `dayTitle`, `notifications` `dayLabel`, `reminders` `timeFor`) cannot
  reach the translator without threading it, and carry untranslated month names anyway.
  (e) **`api.ts`/`tracker.ts`/`calendar.ts`/`config.ts` — there is NO non-React translator**: the
  active language lives in provider state, so a module-scope caller cannot read it. Adding that seam
  is its own job and would buy 4 strings. (f) **`LeafletMap:299` binds `t` to a local time string** —
  the fixed convention is to rename the LOCAL, but that is a separate change.
- **🧮 THE FIRST SCAN UNDERCOUNTED AND THE FIRST COMMIT MESSAGE WAS WRONG.** The scan filtered out
  values shorter than 4 characters, which hid `priority.low` = "Low" — so the task Priority control
  looked 2-of-3 translatable when it is 3-of-3. Re-scanned at a 2-character floor. Separately the
  commit claimed **61** sites; the real count from the diff is **73** across 42 keys, and the message
  was corrected before pushing. **Count from the diff, not from arithmetic in your head.**
- **⚠️ FIVE HOOK DEP ARRAYS NEEDED `t` ADDING** (`home.tsx` ×2, `campaigns`, `client/[id]`,
  `team/[id]`). `tsc` and all 1069 tests were **green without them** — only cache-free `npx eslint`
  caught it, exactly as the CLAUDE.md dep-trap note says. Without the dep, a language switch leaves
  memoized labels in the old language.
- **📋 BATCH 6 EXTRACTED — the extraction backlog is now CLEAR.** 111 strings quoted verbatim plus
  ~70 more as whole tables: **6a (70)** closes the groups this phase left half-translated — the
  direct, visible consequence of the sweep, and the highest-value copy in the document; **6b (41
  distinct / 54 places)** is the outage sentences, deferred four sessions running, still asked for
  **individually** because each names *what* failed; **6c** is the More menu (22 rows) and the other
  label tables, listed as whole units. **Both tables were generated by script from source, not
  transcribed** — the Phase-79 lesson that "quoted exactly" ≠ "complete".
- **📄 `docs/OWNER-ACTIONS-2026-08-27.md` — one page, plain language, everything that needs the
  owner.** Backend deploy state and storage state were **re-verified live this morning**, not copied
  from older notes: prod `origin/main` is still `990c660`, Phase 94 (`fda199c`) is **not** an
  ancestor of it, and `cloudStorageConfigured` is **still `false`**.

**🔑 2026-08-27 — PHASE 79: THE LOGIN SCREEN STOPS SHOWING MACHINE TOKENS · BACKEND PHASE 94 CONSUMED · THE APP GETS ITS FIRST ERROR BOUNDARY · CLAUDE.md CORRECTED.**
Commits `0833707` · `3508d9f` · `2c04eb7` · `2d3cafc` · `dc589cd` · `fcd21aa` · `f768186` · `ddeaa9f`,
pushed to `aaziko/Shivam`. Gates: `tsc` 0 · `npm test` **1069** (was 1037) · `eslint` 0 errors / 12
warnings (baseline). Device-unverified (EAS quota until 1 Sep 2026).
- **🔴 SIGN-IN WAS SHOWING USERS THE RAW WORDS `NO_ACCOUNT` AND `BAD_PASSWORD`, on production, today.**
  Probed live: `POST /auth/login` answers `{"error":"NO_ACCOUNT","message":"No account found with
  that email or mobile number…"}`. The app read `json.error || json.message`, so the two commonest
  failures in the whole product printed a machine token under the heading "Sign in refused" while the
  sentence that tells the user what to do sat unread one field away. Fixed via a new pure seam
  `lib/apiMessage.ts` — **not** a blanket `message`-first flip, which would REGRESS the many routes
  whose only human copy is in `error` (`'Your account is inactive…'`, `'The code has expired…'`).
  `error` still wins unless it is SCREAMING_SNAKE_CASE. Same bug leaked `OTP_NOT_CONFIGURED` /
  `OTP_DELIVERY_FAILED`. Also: the OTP toast always said "Code sent to your **WhatsApp** number" even
  when the code was emailed — it now reads the server's own `channel`.
- **✅ BACKEND PHASE 94 (`fda199c`) CONSUMED — the claim↔file link is real.** `entity_id` +
  `entity_type` are now sent; the claim id is out of `description`. The **415** they added needed **no
  app change** — the body match already runs before the status fallback, and a test now pins 415 and
  500 producing identical outcomes. 🔴 **It is NOT deployed** (`origin/Shivam` only; `origin/main` is
  `990c660`), so video and linking still fail on a phone. Filed as an OPS ask.
  ⚠️ **New ops constraint filed: do not name the MinIO bucket `uploads`** — storage is now path-style,
  so the bucket is the first path segment and would collide with the local-disk fallback signature.
  The host-scoped narrowing was rejected on purpose: it trades a harmless false alarm for a false
  reassurance (the 2026-08-25 audit's exact defect). Reasoning is at the code, pinned by a test.
- **🛡️ THE APP HAD NO REACT ERROR BOUNDARY AT ALL — it has one now.** expo-router wraps a route in
  `Try` only if the module exports `ErrorBoundary` (`useScreens.js:141-158`) and **no file in `src/`
  did**, so any render throw unmounted the whole React root with no LogBox in release: a dead screen
  and an unactionable "it went blank" report. Exported from `_layout.tsx`, which covers every screen
  (`useStore.js:55`). **This is NOT filed as the #8 fix** — a root unmount kills the tab bar too,
  and #8 is described as still navigable. Verified by actually booting: `expo start --web` bundled all
  1821 modules and served a rendered page, zero errors.
- **🌍 i18n Batch 5 EXTRACTED** — all **47** sign-in strings quoted verbatim into
  `docs/i18n/COPY-REQUEST-2026-08-26.md`, plus a new Batch 5b (the 4 crash-screen strings). Nothing on
  that screen is a composed string, so it needs no placeholder keys. Ready to hand to the owner.
- **📖 CLAUDE.md was wrong in ~20 places and two of them were BLOCKING.** It still ordered "do NOT wire
  the net-new `common.*` keys until copy is supplied" (supplied and wired on 2026-08-26), and listed
  four already-fixed keys as still wrong. Also: 143 keys → **226**; 258 tests/9 files → **1068/66**;
  api.ts 1744 → **4332** lines; home.tsx "the only consumer of `useAppUi()`" → **11** files; a `ORDER`
  constant that does not exist; five "dead" files that are not on disk; and four wrong line anchors.
- **🔍 A 15-AGENT ADVERSARIAL REVIEW CAUGHT 3 DEFECTS IN THIS PHASE'S OWN WORK** (`f768186`), all
  invisible to the three gates, and **two of them were untruths written while fixing other untruths**.
  (1) The crash button said "Try this screen again" — `Try.retry()` re-mounts the ROOT and the
  navigation state has already been erased, so it lands on Home/login and the crashed screen and back
  stack are gone; now "Reload the app", pinned by tests. (2) The OTP channel fix was HALF shipped —
  the toast said "Code sent to your email" and the very next screen still said "Enter the code from
  your WhatsApp message"; the `channel` plumbed through for exactly that had **zero consumers**, which
  `tsc` cannot see on an optional property. (3) The Batch 5 extraction was missing a string while
  claiming to be complete — it is **49**, not 47. Two further findings were reported and **killed on
  inspection**, recorded so nobody re-files them: dropping `Claim <id>` from `description` loses
  nothing today (that call is unreachable on prod — `up.ephemeral` returns first while
  `cloudStorageConfigured:false`), and the claim checklist ticks are not held in the `api.ts` state
  buffer that finding assumed.
- **🧹 `.claude/settings.json` was swept into a commit by `git add -u` and reverted FORWARD**
  (`ddeaa9f`) — it is the owner's local machine config. Backed up first, restored on disk untouched,
  no history rewrite and no force push.
- **📮 INBOX: a stale reply of OURS was correcting-worthy.** The GPS item still told `cgpe-api` the two
  shift profiles were NOT changed and asked the owner two questions they had already answered — all
  three profiles have been hourly since `97f2d13`. Corrected and ticked.

**🌍 2026-08-26 (latest) — PHASE 78: i18n BATCH 2 SWEPT · GPS NOW HOURLY (owner reversal) · STORAGE BUG PROVEN ON PROD · VIDEO EVIDENCE SHIPPED.**
Commits `48b3509` · `97f2d13` · `8e249bb` · `ba534b1` · `ad2fd5a` · `ab391ca` · `4cad297`, pushed to `aaziko/Shivam`.
Gates: `tsc` 0 · `npm test` **1037** (was 1005) · `eslint` 0 errors. Device-unverified.
- **✅ i18n Batch 2 wired** — 118 hardcoded English strings across **43 files** now call keys that
  already held human copy (`Try again` alone was 54 copies in 41 files). Run as a 7-group sweep +
  7-group adversarial review. **`common.offlineBody` was deliberately NOT swept:** zero sites match
  it verbatim and each of the 39 outage sentences names *what* failed, so collapsing them would
  destroy the outage-honesty convention (CLAUDE.md #4). Composed strings (`On duty (n)`,
  `${dutyFor} on duty`) left English — they need placeholder keys that do not exist. The review
  caught a **dead-code swap** in `home.tsx` (the `common.onDuty` branch is unreachable because
  `elapsed` is always truthy when clocked in) — same trap as the Phase-77 LIC fallback.
- **⚠️ GPS sampling is now HOURLY on all three profiles** (`motion.ts` `HOURLY_MS`), **deliberately
  reversing Phase 63 / owner #1.** Owner asked via INBOX, was shown that a nine-hour shift becomes
  ~9 points and ~9 straight hops on the live map, and confirmed. The guard test was edited on
  purpose; `distanceInterval: 0` + `accuracy: 'high'` were **kept** (they lose points outright,
  not merely space them). Two effects recorded at the code: **attribution slop widened to up to an
  hour**, and the **watchdog is now the primary point source**, not a backstop.
- **🔎 The file-capture failure is diagnosed and it is NOT the app** —
  `docs/MINIO-AND-CAPTURE-AUDIT-2026-08-26.md`. The backend `.env` has 13 keys and **no storage
  key**, and `BACKEND_URL` is unset, so every upload lands on the droplet's disk and comes back as
  `http://localhost:3001/uploads/...` — a URL that on a phone means the phone. Setting `BACKEND_URL`
  is a one-line fix. MinIO needs **4 real code changes** (forcePathStyle, bucket-missing-from-URL,
  ACL-vs-bucket-policy, and a failed-cloud-upload that 500s instead of falling back), plus 6 values
  and one public-vs-signed-links decision from the owner. **Video is blocked in three places** and
  the 10 MB cap is the real obstacle.
- **🧪 `scripts/diagnose-blank-screen.sh`** — the two zero-build #8 discriminators, runnable on the
  APK already installed. Restores animation scale + stay-awake on any exit; records the APK sha256.
  **Not yet run — no device was attached this session.**
- **🎥 VIDEO EVIDENCE SHIPPED (app side)** — `ad2fd5a` + `4cad297`. Record or pick a clip; it is
  compressed on the phone from 40-80 MB to **~9.5 MB** with a live percentage, to fit the EXISTING
  10 MB cap. **Owner chose compress-to-fit over raising the limit**, so the backend needs NO size
  change and nginx needs nothing — **only the four video MIME strings**, which is the single gate.
  Photo/PDF/document paths are provably untouched (pinned by test). `expo-image-picker` cannot do
  this alone: `videoQuality` is `@platform ios` and `videoMaxDuration` on Android "depends on the
  installed camera app", hence `react-native-compressor`.
- **🔴 A 5-lens adversarial review caught a BOOT-BREAKING bug that tsc + 1037 tests + eslint were all
  green on.** A top-level `import { Video } from 'react-native-compressor'` throws at
  MODULE-EVALUATION time, and expo-router's dev-mode `validateRouteTreeExports` calls an **unguarded
  `loadRoute()` on EVERY route file** — so `expo start --go`, `--web` and `npm run e2e` would all
  have died at boot, taking the everyday photo/PDF path with them. Plus 6 more real defects
  (audio budget mis-modelled for long clips, dead `stillTooLarge`, unwired progress, re-tappable
  button during a 20 s encode, wrong permission message for video, a test made vacuous by the
  feature itself). All fixed in `4cad297`.

**🔧 2026-08-26 (later) — PHASE 77: 3 OF 4 OWNER BUGS FIXED · #8 REOPENED · APK BLOCKED ON EAS BILLING.**
Commits `ff31376` · `c32e29f` · `ea7b8bf` · `877c689`, pushed to `aaziko/Shivam`.
Gates: `tsc` 0 · `npm test` **1005** (was 993) · `eslint` 0 errors / 12 warnings (baseline). Device-unverified.
- **✅ Splash (#5)** — the mark used to grow ~50% at the handover (the plugin fits the 827×975 logo into an
  `imageWidth:190` **square** → native 161×190 dp, while the JS splash redrew it at ~242 dp and scaled it in).
  Now native-size, static, and centred on the **screen** so it does not shift during the native 400 ms
  cross-fade. Tagline 3.92:1 → **14.42:1** (`#252357`, the logo's own ink), free to wrap. White in both
  schemes: the logo is dark-ink art (0% of opaque pixels above 0.75 luminance), so dark mode was mud plus a
  white→black flash. **`app.json` deliberately untouched** — the ink's enclosing circle is 193 dp vs Android's
  192 dp guidance, already at the limit; changing `imageWidth` needs an ADB measurement.
- **✅ LIC "Unnamed" (#6)** — the first fix was **dead code**: the app never sees the null, because
  `productIngestion.js:121` substitutes the literal `'Unnamed plan'` (verified on deployed `origin/main`
  990c660). Now keyed on the sentinel → "LIC Plan 102", fixed in `adaptLicPlan` so every consumer benefits.
  **11 rows, not 8** (also 5, 836, 904). Owner owes the 11 real names.
- **✅ App size (#4)** — Settings › Storage › "Clear cached downloads". The obvious suspect was the smaller
  half: both `LeafletMap` mounts are behind `canSeeLiveLocation`, so an advisor never downloads a tile. The
  **every-user** leak is the picker copies (`copyToCacheDirectory: true` → `<cache>/DocumentPicker` +
  `/ImagePicker`, never deleted). Clears all three legs; reports partial as partial; **never claims a
  megabyte figure** — nothing underneath reports one. `expo-file-system` promoted to a declared dependency
  (lockfile synced, or EAS `npm ci` fails).
- **✅ i18n** — owner supplied gu/hi/hi-en/gu-en for the whole Storage flow in-chat; **133 → 143** keys, none
  machine-translated. `describeCacheClear` returns a KEY, not a sentence, so it cannot drift back to English.
- **❌ #8 More→Today blank — REOPENED, prime suspect RULED OUT.** See "Phase 77 leftovers" below.
- **🔴 APK blocked on billing** — EAS free-plan monthly Android quota exhausted, resets **1 Sep 2026**; no
  build was created. Newest APK is still `093a3b33` (2026-08-25) and carries none of this, nor the Search tab.

**🗣️ 2026-08-26 (earlier) — SEARCH TAB SHIPPED · VOICE ARCHITECTURE DECIDED (owner chose n8n) · 9 OWNER PROBLEMS TRIAGED.**
Three things happened this session, none of them a bug-fix phase.
(1) **Search replaced Clients in the bottom bar** (`ba622af`) — bar is now Today · Tasks · 🔍 Search · Claims · More,
Search glyph enlarged to 26 px, Clients moved into More where it is already master/admin-gated (Point 9). Route path
`/search` unchanged (moved into the `(tabs)` group, so no typed-routes regen and both callers still work). New
`tab.search` key in all 5 dictionaries; i18n parity 132 → **133**. Gates green (`tsc` 0 · `npm test` **993** ·
`eslint` 0 errors). **On no APK yet — no OTA exists.**
(2) **Voice assistant decided with an 11-agent adversarially-verified workflow** →
`docs/VOICE-ARCHITECTURE-DECISION-2026-08-26.md` (`952cf59`, 875 lines). Verdict was **Express, not n8n** — not for
speed (n8n adds only ~0.15–0.75 s) but because n8n holds direct Mongo credentials and bypasses `protect`/
`visibilityScope`; plus the one chat-shaped sync n8n webhook returns an empty body today (`routes/assistant.js:5-8`)
and other sync n8n calls take 15–40 s. Stack: Sarvam `saaras:v3` `mode=translit` STT (only engine emitting **Latin
script**, decisive because `staff_unified` is 18/18 Latin names and `fuzzyMatch.ts` is script-blind) + Claude
verb-only NLU with app-rendered templated answers + Sarvam Bulbul v3 TTS. ≈**₹6,055/mo** for 21 staff.
**The owner then chose the n8n route anyway, for speed — recorded as their call; the plan follows it** with one
non-negotiable mitigation: the workflow must call the REST API with the user's JWT, never Mongo directly.
(3) **The owner's 9 reported problems were triaged against real code** → `docs/PLAN-2026-08-26-VOICE-N8N-AND-BUGS.md`
(`2db724f`) — full n8n contract, ElevenLabs asks, character + Assistant Mode spec, and **phases 77–83**.
**Three of the nine are not app bugs:** LIC "Unnamed" is null `plan_name` in the backend seed data; the
admin-must-not-see-location rule is already enforced on mobile (`roles.ts:72-74`, 20 tests) so it is a panel issue;
and role-wise Operations/Sales views are already supported by `nav.tabs`/`nav.hidden`/`more_sections` (config work).
Upload was probed live — `POST /upload` → **401**, so the route IS deployed; candidates are an unset `BACKEND_URL`
(making files resolve to `localhost:3001`), the NAT64/MTU stall, or the 10 MB/MIME limit. **Nothing was fixed this
session by design** — Phase 77 is where fixing starts.


## Next 3

**SUPERSEDED by the list below — kept because its items are still accurate, just re-ordered.**

## Next 3 — as of 2026-08-27 (after Phase 82)

**One blocker moved: the copy arrived and is wired.** The other three did not — all re-verified
live this session, not copied from notes. Hand the owner `docs/OWNER-ACTIONS-2026-08-27.md`.

1. **Phase 83 — triage the 82 exact-match scan hits. THIS IS REAL, SELF-CONTAINED WORK AND IT
   EXISTS BECAUSE OF THIS DROP.** Do not repeat Phase 81's "the residue is empty" — that was true of
   the dictionary as it stood, and the dictionary changed. Run
   `node scripts/i18n-freewins-scan.mjs`, then apply the peer rule to each hit: wire the ones whose
   group completes, file the peers of the ones that do not, and skip the six forbidden categories on
   sight (persisted values, backend data, module-scope label tables, module-scope date formatters,
   the four non-React strings, `LeafletMap`'s local `t`). Expect most to be exactly those. **Then
   `--orphans`** — it is still 18 and must not grow.
2. **Wire the copy the moment it lands**, in this order: **6f** (23 — what wiring 6a created, and
   what unblocks the already-supplied `Agent map`) → **5** (49, sign-in) → **6b** (41, outage) →
   **6c** (~70, whole tables) → **6d** (13) → **6e** (3) → **5b** (4) → **4b** (4). All quoted
   verbatim in `docs/i18n/COPY-REQUEST-2026-08-26.md`; hand over that file, do not re-derive it.
   **Three owner answers are pending inside 6f** — the Gujarati verb agreement on
   `report.generating`, whether one word should win for Clients/Claims/Tasks across the tab bar and
   the Search table, and the follow-ups wording.
3. **Relay the two server asks — unchanged, both re-verified live at Phase 82:** prod `origin/main`
   = `990c660` and `fda199c` is **not** an ancestor; `cloudStorageConfigured:false`. A third is now
   verified alongside them: **`cgpe.in` still has no AAAA record** (checked against 8.8.8.8), so the
   IPv6/NAT64 fix is still the droplet's MSS clamp only — **confirm it survives a reboot.**
   **Do not name the bucket `uploads`.**

**Phase 84 is the APK, on or after 1 Sep 2026** (or `eas billing:subscribe starter --account
shivam-bhadoriya`). `eas build:list` still tops out at `093a3b33`, 25 Aug — **nothing from Phases
77–82 is on a phone.** **Strongly consider adding EAS Update in that same build.** ⚠️ **An Expo
account switch WOULD get past the quota, but a new account issues a NEW KEYSTORE, and an APK signed
with a different key cannot install over the existing app** — all 21 handsets would need an
uninstall, losing login and local clock data. The keystore can be exported and re-uploaded, but only
through interactive `eas credentials`, which cannot run from this session.

---

## Superseded — Next 3 as of 2026-08-27 (after Phase 81)

**Nothing has moved on the three blockers, and Phase 81 closed the last self-contained thread —
this time with proof rather than an assumption.** The orphan audit enumerated all 226 dictionary
keys and found no remaining free win. Hand the owner `docs/OWNER-ACTIONS-2026-08-27.md`.

1. **Relay the two server asks** — unchanged, and both were re-verified live at Phase 80: prod
   `origin/main` = `990c660`, `fda199c` is not an ancestor, `cloudStorageConfigured:false`.
   **Re-verify before repeating either claim.** **Do not name the bucket `uploads`.**
2. **Phase 82 — wire the copy the moment it lands.** Order: **6a** (70, closes the
   half-translated groups) → **6d** (13, the peers Phase 81 found and deliberately did not wire) →
   **5** (49, sign-in) → **6b** (41, outage) → **6c** (the menus) → **6e** (3 — two need `{pct}` /
   `{n}` variants, one needs only a wording decision). All quoted verbatim in
   `docs/i18n/COPY-REQUEST-2026-08-26.md`; hand over that file, do not re-derive the list. Wiring is
   fast; the copy is the long pole. **After the drop, re-run
   `node scripts/i18n-freewins-scan.mjs` and `--orphans`** — a new drop can introduce new
   zero-consumer keys, which is the only thing that reopens this hunt.
3. **Phase 83 — the APK, on or after 1 Sep 2026** (or `eas billing:subscribe starter --account
   shivam-bhadoriya`). First build to carry the Search tab and Phases 77–81. Check the quota BEFORE
   promising a date — a doomed attempt still uploads ~317 MB before refusing. **Strongly consider
   adding EAS Update in that same build** to end the rebuild-per-fix cycle.

⚠️ **There is NO self-contained app-side work left.** Phase 80 was the last of the sweeping and
Phase 81 proved the residue is empty. **Say so plainly rather than inventing a phase.** Bug #8
remains open and owner-deferred; it needs a plugged-in phone and about a minute
(`bash scripts/diagnose-blank-screen.sh`), not more code reading.

---

## Superseded — Next 3 as of 2026-08-27 (after Phase 80)

**Hand the owner `docs/OWNER-ACTIONS-2026-08-27.md` — that page IS items 1, 2 and 3 in plain
language.** Every remaining item needs a merge, a cable, a decision or a payment. There is no
longer any self-contained app-side work that does not first need copy or a device.

1. **Relay the two server asks.** (a) merge + deploy + restart, which unblocks video and the
   claim↔file link; (b) the one address setting that repairs today's unopenable attachments on its
   own, then the storage details and the signed-vs-public decision. **Do not name the bucket
   `uploads`.** Both states re-verified live 2026-08-27: prod `origin/main` = `990c660`, `fda199c`
   is not an ancestor, `cloudStorageConfigured:false`. Re-verify before repeating either claim.
2. **Phase 81 — wire Batch 6a the moment the copy lands (70 strings).** It closes the groups Phase 80
   left visibly half-translated, then Batch 5 (49, sign-in), then 6b (41, outage), then 6c (the
   menus). All quoted verbatim in `docs/i18n/COPY-REQUEST-2026-08-26.md` — hand over that file, do
   not re-derive the list. **Wiring is fast once copy lands**; the copy is the long pole. **The owner
   has said they will start 6a later** — so this is queued, not blocked on us.
3. **Phase 82 — the APK, on or after 1 Sep 2026** (or `eas billing:subscribe starter --account
   shivam-bhadoriya`). First build to carry the Search tab and Phases 77–80, and video is native so
   it cannot reach a phone any other way. Check the quota BEFORE promising a date — a doomed attempt
   still uploads ~317 MB before refusing. **Strongly consider adding EAS Update in that same build**
   to end the rebuild-per-fix cycle.

⚠️ **If none of the three has moved, there is NO self-contained app-side work left that does not
first need copy, a device, a merge or a decision.** Phase 80 was the last of it. Say so plainly
rather than inventing a phase.

**🔎 BUG #8 — THE OWNER HAS NOW ANSWERED, AND IT NARROWS THINGS (2026-08-27): "buttons dikhte hain"
— the bottom tab bar IS still visible while the screen is blank.**
- **What it settles:** the **React root did not die.** A root unmount takes the tab bar with it, so a
  whole-app crash, a root remount and the `ErrorBoundary` path are all **excluded**. This is now a
  direct owner observation rather than the second-hand "reported as still navigable" the docs had
  been resting on, and it **independently confirms Phase 79's reasoning** that the new error boundary
  is not the #8 fix.
- **What it does NOT settle:** it does **not** prove native screen detach. Detach is simply the last
  hypothesis left standing after Phase 79 ruled out a stuck `loading`/`uiReady` and showed `home.tsx`
  cannot render an empty body in either fork. **Do NOT ship `detachInactiveScreens={false}` on the
  strength of this one answer.**
- **The discriminator that actually splits paint-from-render is STILL unmade** — `uiautomator dump`
  while the screen is blank: widget text nodes **present** ⇒ a paint/opacity/native-view problem;
  **absent** ⇒ a React render/data problem. `bash scripts/diagnose-blank-screen.sh` runs it on the
  installed APK in about a minute, and needs only that the phone is plugged in.
- **The owner has deferred this** ("baad mein yeh screen wala"), along with starting Batch 6a.

**When copy arrives, the wiring notes are already written** — Phase 80's commit message and the
PHASES entry above list exactly which sites were skipped and why, so nobody re-litigates the
persisted-value, data-value, module-scope-table or no-non-React-translator decisions.

---

## Superseded — Next 3 as of 2026-08-27 (after Phase 79)

**Everything self-contained on the app side is now done. All three remaining items need someone
else: a phone plugged in, a merge, or a decision.**

1. **Relay the OPS asks — this is the biggest unblock and none of it is code.** All filed at
   `../contracts/INBOX.md`:
   (a) **merge `cgpe-backend-main` `Shivam` → `origin/main`, deploy, restart `:3001`.** Backend
   Phase 94 is written and tested but runs nowhere: video uploads still fail on a phone and
   `entity_id` is still dropped. Verify with
   `git -C ../cgpe-backend-main merge-base --is-ancestor fda199c origin/main`.
   (b) **set `BACKEND_URL`** — one line, and it repairs today's unopenable attachments with or
   without MinIO. Then the storage env, where **`S3_BUCKET_NAME` is now mandatory** (the silent
   default was removed, so omitting it fails silently to "storage off").
   (c) **do not name the MinIO bucket `uploads`** — it would make every durable object look
   ephemeral to the app. Any other name needs nothing from us.
   (d) the public-vs-presigned decision for KYC/claim docs (mobile recommends presigned; cgpe-api
   agrees it must be signed **on read**).
   Verify the whole thing landed with `curl https://cgpe.in/internal/api/upload` — it must stop
   saying `cloudStorageConfigured:false`.

2. **Hand the owner `docs/i18n/COPY-REQUEST-2026-08-26.md`.** Batches **5** (sign-in, 47 strings),
   **5b** (crash screen, 4) and **4b** (video, 4) are extracted verbatim and ready to fill in. This
   needs nothing from us until the copy comes back, and it is the largest remaining chunk of visible
   English in the app.

3. **Phase 80 — the APK, on or after 1 Sep 2026** (or `eas billing:subscribe starter --account
   shivam-bhadoriya`). It will be the first build carrying the Search tab, Phases 77, 78 and 79, and
   the video feature — and video is native, so it cannot reach a phone any other way. **Check the
   quota BEFORE promising a date:** a doomed attempt still uploads ~317 MB before it refuses.
   Strongly consider adding EAS Update in that same build to end the rebuild-per-fix cycle.

**Still open, needs a device (~1 minute, no build):** bug #8, the More→Today blank screen.
`bash scripts/diagnose-blank-screen.sh` runs both discriminators on the APK already installed.
**Phase 79 narrowed it on paper:** a stuck `loading`/`uiReady` is now ruled out (there is exactly one
`setLoading` call and it passes `false`; `uiReady` is derived from monotonic inputs), and home.tsx
cannot render an empty body in either fork (the skeleton always paints and every widget has a visible
fallback). What survives is **native screen detach** — `detachInactiveScreens` really does default to
`true` on Android and expo-router really does forward it, verified in the installed source, so
`<Tabs detachInactiveScreens={false}>` is a genuine one-line A/B — but it is armed, not proven, and
must not be shipped as a fix without a repro. **The single cheapest observation, and nobody has made
it yet: is the bottom tab bar still visible while the screen is blank?** Bar visible ⇒ only Home's
screen is empty. Bar gone ⇒ the whole root died. Ask the owner; it costs one sentence.

---

## Superseded — Next 3 as of 2026-08-26 (after Phase 78)

**Almost everything worth doing is now blocked on the
owner or on the 1 Sep build quota — so the ONE unblocked item goes first, because it needs no build:**

1. **Phase 79 — run the two device tests and close #8 (the More→Today blank screen).**
   `bash scripts/diagnose-blank-screen.sh` runs both discriminators on the APK **already installed**,
   restores every device setting it touches (including on Ctrl-C), and records the APK's sha256 so
   there is no doubt which build was tested. It needs **only that the owner plugs the phone in** —
   no build, no quota, ~1 minute. Test 1 (animations off) rules `Appear` in or out for good;
   test 2 (hierarchy dump while blank) says whether it is a paint problem or a render/data problem,
   which decides which half of the app to look in. **Do NOT re-file `Appear`/`cancelAnimation` as
   the cause without a device repro — Phase 77 disproved it and the disproof is written at the code.**

2. **Relay the backend asks and get the storage switched on.** All filed at the top of
   `../contracts/INBOX.md` (2026-08-26, from cgpe-mobile), and none can be pushed from here:
   (a) **4 video MIME strings** — the single gate on the video feature just shipped;
   (b) **`entity_id` on `POST /api/file-attachments`** — without it a file cannot be tied to a claim;
   (c) the **failed-cloud-upload 500** that pretends to be a fallback;
   (d) the **4 MinIO code fixes** (`forcePathStyle`, bucket-missing-from-URL, ACL, plus (c)).
   **OPS/owner:** set `BACKEND_URL` — one line, and it makes existing attachments openable again
   whether or not MinIO ever happens — plus the six storage values and the public-vs-presigned
   decision. Verify with `curl https://cgpe.in/internal/api/upload`: it must stop saying
   `cloudStorageConfigured:false`.

3. **Phase 80 — the APK, on or after 1 Sep 2026.** The quota resets then (or
   `eas billing:subscribe starter --account shivam-bhadoriya`). It will be the first build carrying
   the Search tab, all of Phase 77, all of Phase 78 and the video feature — **and video is native, so
   it cannot reach a phone any other way; there is no OTA.** Strongly consider adding EAS Update in
   that same build to end the rebuild-per-fix cycle. Check the quota BEFORE promising anyone a date:
   a doomed attempt still uploads ~317 MB before it refuses.

**Then:** Phase 81 voice v1 (owner-blocked: n8n webhook URL, ElevenLabs key + 2 voice IDs, avatar
decision) · Phase 82 Play Store submission (owner-blocked: Play Console account) · Phase 83 role-wise
views (needs spec-lock) · the i18n Batch 5 sign-in extraction, which needs no owner input to START
(extract the literals verbatim into the copy request BEFORE asking for four more languages).

---

## Superseded — previous Next 3 (2026-08-26, before Phase 78)

**(the driving worklist was `docs/PLAN-2026-08-26-VOICE-N8N-AND-BUGS.md`,
phases 77–83. The owner's 13-point backlog is fully shipped app-side):**

1. **Phase 77 — Quick visible fixes. ✅ THREE OF FOUR SHIPPED 2026-08-26; #8 REOPENED AS UNDIAGNOSED.**
   Splash (logo no longer jumps ~50% between the two splashes, tagline lifted from a measured
   3.92:1 to 14.42:1, dark-mode white→black flash gone) · LIC "Unnamed" (the app never saw a null —
   the BACKEND substitutes the literal string, so the first fix was dead code; now keyed on the
   sentinel, **11** rows not 8) · Storage / "Clear cached downloads" in Settings (the every-user
   leak is the never-deleted picker copies, NOT map tiles — tiles are master/admin-only).
   ❌ **More→Today blank screen is NOT fixed and the recorded prime suspect is now RULED OUT.**
   `Appear`'s `cancelAnimation` cleanup cannot be it: at every Home call site its effect deps are
   constants, so the cleanup runs only at unmount; react-freeze is off (`ENABLE_FREEZE = false`,
   `enableFreeze()` called nowhere), there is no `unmountOnBlur`, `BottomTabView` only appends to
   `loaded`, and reanimated 4.5 bakes a settled `opacity: 1` into React's committed props within
   ~1 s. **Two zero-build device tests decide it in a minute** — see "Phase 77 leftovers" below.
   🔴 **THE APK IS BLOCKED ON BILLING, NOT ON CODE.** The batched build (these fixes + the Search
   tab) was attempted and refused: the **EAS free plan's monthly Android build quota is used up**,
   resetting **1 Sep 2026**. No build was created — the newest APK is still `093a3b33`
   (2026-08-25, commit `4be1c26`), which carries none of this. Owner's call: wait for the reset, or
   `eas billing:subscribe starter --account shivam-bhadoriya`. There is no OTA, so nothing here
   reaches a phone until a build runs.
2. **Phase 78 — Voice v1 (n8n route).** `src/voice/` core + `POST /api/voice/ask` proxy (so the n8n URL
   and secret never ship in the APK) + `<VoiceAvatar>` half-body coded shell (Lottie-ready) +
   Assistant Mode lockdown + male/female personas + mic (`expo-audio`, `RECORD_AUDIO`, consent version
   bump). **Add EAS Update in this same build** — voice needs many prompt iterations and without OTA
   each one costs a reinstall. **Blocked on the owner:** n8n webhook URL honouring the §A1 contract,
   ElevenLabs Creator key + male/female `voice_id`s + a **Gujarati-capable** model (NOT Flash v2.5),
   and the avatar asset decision (commission Lottie, or coded-only for now).
3. **Phase 79 — Play Store submission.** Production AAB (`versionCode` is still **1** and must
   increment), listing copy, screenshots, privacy-policy page, Data Safety form, and the
   `ACCESS_BACKGROUND_LOCATION` justification + demo video. **Blocked on the owner creating a Play
   Console account — Organization if at all possible**, because a *personal* account created after
   Nov 2023 must run a 12-tester / 14-day closed test before production. **Apple is blocked outright**
   (no $99/yr Developer account; no free route exists) — the word-by-word Apple guide still gets
   written so nothing is unknown when an account appears.

### Phase 77 leftovers — the More→Today blank screen (#8)

**Status: undiagnosed. The prime suspect is ruled out, and no replacement is confirmed.** Do not
re-file `Appear`/`cancelAnimation` as the cause without a device repro — the disproof is written
into `src/ui/motion.tsx` at the cleanup itself so the next reader cannot miss it.

**Two zero-build tests decide it in a minute, and BOTH run on the APK already on the phone.** ADB
works from here (platform-tools into the scratchpad); the owner only has to plug the phone in.

1. **Animation-off test — rules `Appear` in or out completely.**
   `adb shell settings put global transition_animation_scale 0`, force-stop, cold-start, then
   More → Today. Android's `isReduceMotionEnabled` reads exactly that setting
   (`AccessibilityInfoModule.kt:101-106,157`), so `useReducedMotion()` returns true, `Appear` takes
   its reduced branch and never animates at all. **If the screen STILL blanks with animations off,
   `Appear` is definitively not the cause.** Restore with `… transition_animation_scale 1`.
2. **Hierarchy test — says which half of the app to look in.** While the screen is blank,
   `adb shell uiautomator dump /sdcard/w.xml && adb pull /sdcard/w.xml`. Widget text nodes
   **present** ⇒ a paint/opacity/native-view problem. **Absent** ⇒ a React render/data problem, and
   every opacity theory is irrelevant.
   (Free extra: pull-to-refresh while blank. Home's `RefreshControl` is bound to `load()`; if the
   content comes back, a settled `opacity: 0` in React state is impossible by construction.)

**Then investigate in this order — all unconfirmed, none to be presented as a root cause first:**
(a) the `loading || !uiReady` fork on `home.tsx` — the header renders OUTSIDE it, so a stuck
`loading` gives exactly "some things show, the rest empty" with no animation involved (note
`HomeSkeleton` normally paints visible shimmer, so this predicts "skeletons forever", not blank —
unless `hero: 'none'` and an empty widget list make it render nothing);
(b) native screen detach/re-attach — `detachInactiveScreens` defaults to **true** on Android, and a
blank-after-tab-switch is a known shape for it; the one-line A/B is
`<Tabs detachInactiveScreens={false} …>` in `(tabs)/_layout.tsx`, but verify expo-router forwards
the prop before trusting it, and note it trades memory;
(c) memory pressure from the map tile cache — if the blank only reproduces after a session that
opened a map, then #8 and #4 are the same bug and the cache work is the fix.

**Then:** Phase 80 files/MinIO (needs the six env values + public-vs-presigned decision) · Phase 81
on-demand live location (silent FCM pull; needs a DPDP consent line of its own) · Phase 82 role-wise
views (needs spec-lock: what exactly are "Maturity", "Operation Process", "Reminders Process"?) ·
Phase 83 voice v2.

**`[admin]` items — different repo (`cgpe-front-main-RECOVERED`), not touched here:** the "Assign Task"
button showing "Create Task", the admin-panel location gate, and the per-department RBAC config seeding.

---

## Superseded — previous Next 3 (2026-08-25)

**CURRENT next 3 (2026-08-25 — backlog is `docs/OWNER-BACKLOG-2026-08-24.md`, now 13 points; the authoritative
worklist. These three are the immediate lane:**

0. **✅ LOOPHOLE HUNTS ROUNDS 2, 3 & 4 DONE (18 defects fixed, `2f07a1e` + `c6ea5ec` + `6736ede`).** Adversarial
   multi-agent hunts over the post-2026-08-21 code, then the modules round 1 never touched (location/tracker, geofence,
   campaigns, outage-honesty, push/calendar), then (round 4) the lower-risk surfaces — boot/route-restore, tab-nav RBAC,
   i18n, theme/density. All OTA-eligible, gate-green, device-unverified. **The four candidate round-4 surfaces are now
   audited; there is no obvious un-audited surface left.** **Next-session direction:** owner/OPS follow-through — there is
   NO self-contained OTA `[m]` backlog item outstanding. Dormant-until-owner: round-3 clock-in #3 → seed the office
   geofence pins; round-3 push #8 → FCM V1 key on EAS. **Round-4 document-only (need OWNER input):** two i18n items need
   human Hindi/Hinglish copy (the `कल` tomorrow=yesterday collision + a `{time}` placeholder for "Clocked in"); two theme
   items are harden-only (would override the admin's chosen accent).
1. **Band-2 shipped so far:** ✅ report 12 s fix (`4516dd9`), ✅ Tasks local search (`c47be1b`), ✅ task-flow
   mitigations (`af7e492`), ✅ calendar grid (`c3c3537`), ✅ #5 Client Search **CLOSED no-build** (`9121020`),
   ✅ #6 premium-403 fix + dead-code (`fb64734`), ✅ #6b retire /premium (`9967db3`), ✅ #7 client-access
   master/admin-only (`4575106`), ✅ **#9 Contest mapper (`9793327`)**, ✅ **role identity model (`9f8e47d`)**,
   ✅ **#7-refinement SALES-advisor own-only client view / owner Q4 (`cc4657f`, backend P90 verified live first)**,
   ✅ **#8 wire the inert RBAC feature-gates (`6b63a1e`)**, ✅ **Point 13 Payroll whole-team roster + master-only
   bank panel (`9ac8c18`, `7a49774`; owner decided bank=master/masked, Aadhaar/PAN off the phone)**, ✅ **#10
   Document picker CLIENT HALF (`a4e6dd0`; source sheet photo/gallery/file + honest upload errors; NATIVE → not OTA)**.
   **Every self-contained OTA `[m]` Band-2 item AND Point 13 are now shipped — there is no OTA client item left.** What
   remains for **#10** is owner/OPS only: cut a NEW APK (native module), set the DigitalOcean Spaces env, and decide the
   durable claim↔file link (`[api]`+`[decision]`, `routes/fileAttachments.js` unwired). **Owner-owned to land shipped work on device:** run the 3 prod
   scripts (`promoteStaffSuperAdmin.js` / `addGeneralInsuranceDept.js --commit` / `seedAppRolePreferences.js`), do
   the on-device sales-advisor Clients check, AND **the Point 13 DATA job — create `payroll_profiles` for the rest
   of the team** (until then the team reads "data pending" — the honest state, not a bug). **Also open (owner
   call):** gate the WhatsApp hub / search-Tickets group / task-contact sheet for team too, or leave them?
2. **Owner Band-1 actions (in parallel — mostly plain-language relays in the backlog doc):**
   3 OPS switches (report webhook env / DigitalOcean Spaces env / WhatsApp n8n live-send mode); **P9 client-access
   DECIDED (master/admin only) and the backend-403 `[api]` relay is now FILED at the top of `../contracts/INBOX.md`
   — owner relays it + confirms the `:3001` deploy** (the app gate is defence-in-depth, not the authority); the
   per-role/department access matrix (P6, blocks #8); the task-create policy (P5); and the backend `[api]`
   tokenized-search relay (P2). None can be pushed from this session (push 403 to origin; `aaziko` works for our
   branch, but backend deploy is owner-owned).
3. **Document upload (P11) — client half SHIPPED (`a4e6dd0`), now needs its APK + OPS.** The picker + honest-error
   work is done and pushed but is native (not OTA), so it reaches the team only in a fresh EAS build, paired with the
   owner's Spaces-env OPS switch. Then (owner decision) wire the durable claim↔file link. No client work is pending.

**Earlier standing relays still owed** (handed as plain-language relays, NOT INBOX): **B3 clock-out map layer** —
   ask cgpe-api to surface the stored `DayLog.clockOutLoc` on `GET /live-locations` (or a companion) so
   the master live map can draw its red "Clock-out" layer (app already renders red pins); **B4 data
   check** — confirm Pavitra's track points uploaded (accuracy > 100 m are dropped server-side).
   Plus the standing relays: **the D1/D2 sales↔ops split** — in the admin
   panel's UI-RBAC screen, hide `leads`+`prospects` for Operations and `claims`+`tickets` for Sales (the
   app already enforces `nav.hidden`); **dual-stack `cgpe.in`** (AAAA + IPv6) — the
   permanent fix for the IPv6-only-mobile network path (an MSS clamp is the live stopgap); the backend
   **droplet redeploy + `:3001` restart** so the shipped idempotency dedupe (Backend Phase 81) and the
   `/track/points` ownership check actually run on prod; and the **FCM V1 service-account key** upload to
   EAS (Phase 74) before push delivers; and the **report render webhook (E2)** — on the droplet set
   `CGPE_REPORT_WEBHOOK_URL` (or `N8N_REPORT_WEBHOOK_URL`) + `CGPE_REPORT_SECRET`, wire the n8n
   `cgpe-report-render` template, restart `:3001`. Then the app generates + opens reports with zero change
   (the app now names this exact gap on-device as of `d9656bf`). **NOTE (2026-08-24):** the backend's
   Phase 87 "report cache" is NOT this fix and is NOT on `origin/main` yet — merging it only adds cross-person
   cache reuse (7-day TTL); it does nothing until the render-webhook env above is set.
3. **Device-verify the 8 shipped audit fixes** on the fresh APK (EAS `a03e64cb`) — native GPS timeout on a
   dead-GPS spot (#1), shared-handset sign-out/handover (#4/#5), SyncChip/banner render (#9). Backend/data
   backlog (A3, B2/B4/B5, D5, E1, E2, D1 enforcement) via the owner-relay INBOX; **D1** is mostly an
   admin-panel RBAC-config job.

**Superseded (2026-08-20 next-3 — the 70–73 batch AND Phase 65 are BUILT + PUSHED; those now ride the Phase-74 push APK):**

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
Phase 54 from the 2026-08-18 batch (lead-open `[api]`). **Phase 56 (iOS) is BUILT + compile-proven — see its ✅ entry below.**
**Phase 55 (network resilience) BUILT +
PUSHED `941c583`** (device pass + 5-lang copy remain). **✅ Phase 57 (offline support) FULLY COMPLETE + PUSHED — 57a read cache
`20eb4ed`, 57b write queue Notes `e318e06` + Task-create `eb81a04` + Lead-create `00aee55`; EVERY additive create (Notes/Tasks/
Leads) is now queued. REMAINING = 5-lang copy for the new English strings + a device pass.** Phase 41 on-device verification (owner: do last). Owner
physical pass on `b01f4164` still owed (bg-GPS, geofence after go-live, biometric, break-gate) on ≥2 phone brands.

**✅ Phase 56 (iOS) — editor-side prep BUILT + compile-PROVEN, now purely owner-gated on the Apple account (2026-08-20).**
Commits `49bb951` (config) + `ee8df2b` (docs), pushed `aaziko/Shivam`. `eas.json` `ios-simulator` profile + `app.json`
export-compliance flag + a real CGPE iOS icon; validated via `expo config --type introspect`. **Apple-account-free EAS
iOS-Simulator build `9649bf51` FINISHED green (SDK 57.0.0, git `49bb951`)** — the native iOS target compiles with the full
module set. **Remaining = owner-owed only:** owner confirmed 2026-08-20 they WILL buy the **Apple Developer account ($99/yr)**;
when it exists, cut a TestFlight (recommended) or ad-hoc build per `docs/spec/PHASE-56.md` §4 and verify Face ID / map /
background route on a real iPhone. iOS reliability is first-class EXCEPT the guaranteed-24/7-after-force-quit/reboot tracker
(Android-only, documented). iOS push (APNs) is a separate, later piece. Phase 58 (createdAt, needs owner repro) still open.

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

⚠️ **THIS TABLE STOPPED BEING MAINTAINED AT PHASE 26 (plus a stray row 47) AND IS NOT THE CURRENT
STATE.** Roughly fifty phases since — 27 through 80 — are recorded in `## Now` above and in
`docs/DECISIONS.md`, not here. **Read `## Now` for what is actually done**; this table is kept only
because rows 1–26 carry per-phase detail (test counts, commit hashes, device-check debts) that is not
duplicated elsewhere. Do not infer from a missing row that a phase did not happen, and do not spend a
session back-filling it — the information already exists in a better-maintained place.

| # | Phase | Status |
|---|---|---|
| 77–80 | see `## Now` | **Built** 2026-08-26/27 — splash + LIC + storage-clear; i18n Batch 2 sweep + hourly GPS + video evidence; sign-in token leak + error boundary + backend Phase 94 consumed; the i18n free-wins sweep (73 sites) + Batch 6 extraction + the owner relay sheet. All device-unverified — no APK possible until 1 Sep 2026 |
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
