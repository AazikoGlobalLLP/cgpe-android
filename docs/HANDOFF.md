# HANDOFF — CGPE Connect (Android) — Phase 97 (SCOPED, no code) — 2026-09-01

> **Nothing was built this session. It was orientation plus one cross-repo verification, and the
> verification changed what the phase is.**
>
> The owner's instruction was *"clients ka data `clients` collection se `client` collection karo —
> har jagah, everywhere, aur naye fields UI mein integrate karo."*
>
> 🔑 **Half of that ask is not app work at all, and is already built by `cgpe-api`. The other half is
> real, is ours, and nobody has filed it.** Doing the literal find-and-replace would have broken every
> client endpoint in the app for no gain.

## Done

- **Established that the collection rename is entirely backend-side and already done.** The app never
  sends or receives a Mongo collection name — `grep -rn "collection" src/` returns only comments and
  UI copy. It calls `/api/clients*`, whose URLs, request bodies and response shapes `cgpe-api` states
  are byte-identical. Their Phase 118 (`644ff2b`) routes all 14 call sites through
  `utils/clientCollection.js` → `CLIENT_COLLECTION = process.env.CLIENT_COLLECTION || 'client'`.
  Their INBOX item says "cgpe-mobile — read; **nothing owed**".
- **Established that Phase 118 is NOT deployed.** Prod deploys `origin/main` = `0324dfc`; `644ff2b`
  exists only on `origin/Shivam`. Production still serves the OLD `clients` book today. So the new
  data is not on any phone and cannot be device-verified yet.
- **Found the part that IS ours, which their "nothing owed" line does not cover.** The wire *shape* is
  identical; the *documents* are not. The owner's sample carries merged LIXXX columns that
  `adaptClient` (`src/data/adapt.ts:139-199`) has no reader for:
  - `Area` → the app derives city from `raw.address.city || raw.city`. The new doc has neither.
    **City renders blank for the whole book.**
  - `E_mail` → the app reads `raw.email`. **Email renders blank.**
  - `groupName` / `Group Head` → the app reads `raw.familyName || raw.family`. **Family renders blank.**
  - `annual_premium_sum` (3,642) vs `premium` (1,821, the half-yearly instalment) → `totalPremium`
    currently shows the **instalment, not the annual figure**, for every non-yearly policy.
  - Unread entirely: `Sex`, `Marriage Date` (anniversary), `No of Policies`, `Customer_Code`,
    `Telephone(Residence)`/`(Office)`, `ppt`, `ecs`, `fprDate`, `lastPremiumPayingDate`, `dataAnalysis`.
  - `AadhaarNo` / `PANNo` are present in the documents and are **PII — deliberately out of scope**.
- **Confirmed those columns actually reach the app**, rather than assuming it. The list route projects
  with `LIST_HEAVY_EXCLUDE` (an *exclusion* projection, so everything else flows) and `GET /clients/:id`
  returns the full document. Non-schema fields survive the read — proven by the fact that `policyNo`
  and `sumAssured` are absent from `models/Client.js` yet the app reads them today.
- 🔎 **Found a real bug in the sibling's own code, by their own rule, and filed it.**
  `greetingEngine.normalizeClient:195` was updated for the new book and now reads `c.Area` as a city
  fallback — but `clientFlags.DERIVED_PROJECTION:329` and `DIRECTORY_FACET_PROJECTION:1124` still
  project only `'address.city'` and `city`, **not `Area`**. That projection's own header says *"⚠️ If
  you add a field (or a new alternate name) to normalizeClient, ADD IT HERE TOO"*. Their completeness
  test (`auth.phase77.test.js`) carries no `Area` fixture, so it stays green. Consequence after the
  deploy: **city is empty for the entire book on every derived read** — the person/household grouping
  key (`clientFlags.js:268`), the directory city sort (`:1274`) and the search score (`:755`). The app
  calls `/clients/segments`, so this reaches us too.

## Files changed

- `docs/HANDOFF.md` — this entry, **inserted above** the Phase 96 handoff, which is preserved verbatim.
- `docs/PHASES.md` — `## Now` and `## Next 3` rewritten; **new row added** for Phase 97 as the owner asked.
- `docs/DECISIONS.md` — appended D-1 … D-4 for this session.
- `../contracts/INBOX.md` — one item appended (append-only `cat >>`, grepped back, size checked).
- `CLAUDE.md` — the durable lesson, so the next session does not re-derive any of this.
- **No file under `src/` was touched.** `tsc`, `npm test` and `eslint` are unchanged from Phase 96 and
  were not re-run, because nothing could have changed them.

## Decisions made

- **Refused the literal find-and-replace.** `clients` → `client` across `src/` would rewrite
  `/api/clients` request paths and 404 the entire client book. The owner's intent — "the app should
  use the new data" — is served by reading the new fields, not by renaming a URL.
- **Did not tick the Phase 118 box.** It is addressed to three recipients, so per the protocol the
  reply goes underneath and the box stays open.
- **Filed the `Area` projection gap rather than working around it app-side.** A client cannot detect
  it (the response is a valid 200 with an empty string) and cannot fix it — only the producer can.
- **Left `AadhaarNo` / `PANNo` out of scope.** They are on the documents; putting government ID on a
  shared-handset screen is an owner decision under DPDP, not a UI detail to slip into a field sweep.

## Known broken / deliberately skipped

- 🔴 **Nothing was built. The phase is scoped, not started.** No `src/` change exists to verify.
- 🔴 **Phase 118 is undeployed**, so even once built, the new fields stay absent on production and the
  work is inert until the owner merges `origin/Shivam` → `origin/main`, deploys and restarts `:3001`.
- **The owner must run the preflight before that deploy** (`cgpe-api`'s ask, still unticked):
  `MONGODB_URI="<atlas uri>" node scripts/preflight-client-collection.js`. It checks the two failures
  that hide themselves — a book with no `advisor_id` (every advisor's "My clients" returns zero while
  an admin sees everything and it all looks fine), and `policy_number: null` duplicates that break the
  unique index build.
- **The voice items from Phase 96 are untouched and still open** — the probe output has not been read,
  build 6 + OTA is not started, and the committed production `JWT_SECRET` is still unrotated.

## Next session starts here

- **Phase 97: make `adaptClient` read the new columns, then show them.** `Area`→city, `E_mail`→email,
  `groupName`/`Group Head`→family, `annual_premium_sum`→`totalPremium`, plus gender / anniversary /
  policy count on the detail screen. Pin the owner's exact sample document as a test fixture.
- **First command:**
  `npx tsc --noEmit && npm test -- src/data/__tests__/adapt.test.ts`
  (establish the green baseline before touching `src/data/adapt.ts`.)
- **Watch out for:** **`totalPremium` is a money figure on the dashboard.** Switching it from
  `premium` to `annual_premium_sum` doubles a half-yearly client's number and multiplies a monthly
  one by twelve. That is the *correct* value — `annual_premium_sum` is a PERSON aggregate the backend
  warms, while `premium` is one instalment on one policy row — but it will read as a regression to
  anyone watching the totals, and `annual_premium_sum` is **absent until the row has been warmed**.
  Fall back to `premium × annualFactor(mode)`, never to a bare `premium`, and say the change out loud
  before it ships.

---

# HANDOFF — CGPE Connect (Android) — Phase 96 — 2026-09-01 (later)

> **The mic crash is GONE — confirmed on the owner's handset.** Build 5 (`a9583d51`) opens voice
> mode and holds the mic without exiting. The `'worklet'` diagnosis was right.
>
> **What replaced it were two REAL bugs, both ours, both now fixed** — and the owner's own screenshots
> named them. No APK was built this session: the fixes are in `src/`, device-unverified, waiting on a
> voice test the owner can now run in one command.
>
> 🔑 **The lesson of the day: three separate times the answer was "read the producer's real code, stop
> guessing" — and twice the guesser was me.** The Expo Go failure, the login field and the brain
> header were all settled by opening someone else's source, never by reasoning from this repo.
>
> ⚠️ **Do not delete the handoffs below this one.** Phases 92–95 and the archived parallel voice-track
> handoff are still the only record of the Skia / Lottie / web-stub traps.

## Done

- **The mic crash is confirmed fixed on a real phone.** Voice mode opens, the orb renders, the mic
  holds. Two APKs died there; build 5 does not.
- **The recorder can no longer outlive the press.** `finishCapture` gated on React `state`, but on the
  first press `startCapture` is parked on the Android permission dialog and has not called
  `setState` yet — so the release did nothing, and when the user tapped "Allow", recording began
  **with no finger on the button and nothing left to stop it.** That is the green mic dot in the
  owner's 2:40 PM screenshot, still lit at 2:42. The next press then hit `expo-audio`'s own guard
  (`AudioRecorder.kt:84`) and reported *"AudioRecorder has already been prepared"*.
- **The 15-second recording cap is actually enforced.** `VOICE.MAX_RECORD_MS` had **zero consumers** —
  the contract specified a hard cap and nothing anywhere applied it, so a capture that lost its
  release grew without bound. That is the likeliest cause of the second screenshot's status-less
  `network` failure.
- **A build can finally be identified on the phone.** The owner's MIUI *App info* shows only
  "Version: 1.10.0" — no build number — and the app's own Settings row showed a hard-coded string
  identical in every build ever made. **Nothing on the handset could tell build 3 from build 5**,
  which is exactly the question the whole day turned on. Settings now reads `1.10.0 (6)`.
- **A failed voice turn names its own cause.** `askVoice`'s `catch` discarded the exception, so the
  owner's second screenshot explained itself with the single word "network".
- **Voice can now be tested from a terminal with only a login** — no phone, no APK, no build, and
  **no server secret**. `scripts/voice-probe.mjs` signs in, prints `GET /voice/status` (which legs the
  server has configured), and runs eight spoken clips through the real STT → brain → TTS chain.
  `scripts/make-voice-clips.ps1` generates those clips with Windows' built-in speech engine — free,
  local, no vendor and no credits.
- **The brain's REAL wire shape is pinned as tests** (`brainShapes.test.ts`, 6 tests), transcribed
  verbatim from a live probe rather than imagined.

## Files changed

- `src/ui/voice/useVoiceTurn.ts` — the lifecycle rewrite: `heldRef`/`liveRef` refs instead of React
  state, one idempotent `teardown()` on every exit path, permission pre-warmed when voice mode opens,
  an already-prepared recorder reclaimed by stopping first, `MAX_RECORD_MS` enforced.
- `src/voice/recorderError.ts` + test — the pure `isAlreadyPreparedError`, split out because
  `useVoiceTurn` is native and the suite cannot reach it.
- `src/voice/client.ts` / `cause.ts` — a thrown fetch keeps its message; `describeTransport` shows it.
- `src/voice/__tests__/brainShapes.test.ts` — real captured responses.
- `src/voice/__tests__/client.test.ts` — one test deliberately updated: it pinned the old discarding shape.
- `src/lib/buildInfo.ts` + test, `src/app/settings.tsx` — the real native build number.
- `package.json` / `package-lock.json` — `expo-application`, lock synced in the same commit.
- `scripts/voice-probe.mjs`, `scripts/make-voice-clips.ps1` — the terminal test path.
- `docs/TESTING-WITHOUT-A-BUILD.md` — Expo Go vs OTA, with the limits of each.
- `docs/OPS-SERVER-HANDOVER.md` §13, `../contracts/INBOX.md` — the nginx questions.
- `.gitignore` + `.easignore` — `e2e/voice-probe/`, both in the same commit.

## Decisions made

- **Did NOT build an APK.** The owner asked for "no more errors" and a voice test first. Building
  before the voice chain has been exercised once would repeat the day's mistake.
- **Did NOT upgrade the 24 drifting SDK-57 packages** to make Expo Go work. `react-native` and
  `reanimated` are in that list, and reanimated is where today's crash came from. Upgrading them for
  a dev tool, on the day the release build finally stabilised, is the wrong trade.
- **Did not file a backend priority-1 task**, because nothing proved a backend fault. Screenshot 1
  never left the phone; screenshot 2 returned no status. Filed two cheap nginx questions instead —
  and `cgpe-api` has **already acted**: `GET /voice/status` now reports `budget_ms`, citing our item.
- **Used Windows' speech engine rather than a paid TTS** to make test audio — free, local, and the
  backend's upload filter already accepts `.wav`.
- **Told the owner plainly that "multiple commands in one query" is a contract limit**, not something
  to loop on: one reply carries one `action`. Pinned by a test so nobody reads it as a parser bug.

## Known broken / deliberately skipped

- 🔴 **The two voice fixes are DEVICE-UNVERIFIED.** They are JS-only and there is still no OTA, so
  they reach a phone only in the next APK.
- 🔴 **Voice has never been observed working end to end by anyone.** The owner says the two server
  keys are set; `GET /voice/status` sits behind `protect` and this session holds no credentials, so
  it could not be confirmed. **The probe answers this in one command.**
- **Expo Go does not work here and was abandoned.** First it was a client-version mismatch (the phone
  needed Expo Go ≥ 57.0.9); after updating, the tunnel failed to deliver the 15 MB bundle
  (`java.io.IOException: Failed to download remote update`). LAN mode works but needs the same WiFi.
  **Expo Go could never have proven release safety anyway** — it runs a dev bundle with LogBox, so
  today's fatal worklet error would have been a dismissible red box.
- **Hindi/Hinglish voice clips cannot be generated here** — this machine has only en-US voices. The
  probe tests the English half of the battery; the Hinglish staff actually speak still needs a Hindi
  voice pack or a human recording.
- **`exceedsAudioCap` still has no consumer.** The duration cap bounds clips to ~250 KB, so it is not
  urgent, but the byte check remains dead code.
- **The committed production secrets (`JWT_SECRET`) are still unrotated** — owner-owned, unchanged.

## Next session starts here

- **Phase 97: read the probe output, then build.** If `ready: true` and the clips navigate correctly,
  build 6 with the voice fixes **+ EAS Update (OTA)** — the owner has asked for OTA three times, and
  the baseline is now known-good, which is what was missing when it was last deferred.
- **First command:** ask the owner for the `node scripts/voice-probe.mjs` output (they have it
  queued), or if they have already pasted it, read `e2e/voice-probe/voice-status.json`.
- **Watch out for:** **guessing another producer's wire format.** This session got the brain header,
  the login field and the Expo Go failure wrong by reasoning instead of reading, three times in a row.
  Second trap: **do not "fix" Expo Go by upgrading reanimated.**

---

# HANDOFF — CGPE Connect (Android) — Phases 92–95 — 2026-09-01

> **Four APKs shipped today. The first three were the story: `372cd790` (vc2) and `577a4ec5` (vc3)
> both EXITED THE APP when the mic was pressed, `2cb0e667` (vc4) shipped with voice switched off,
> and `a9583d51` (vc5) ships the actual fix with voice back on.**
>
> 🔑 **The lesson that outranks everything else here: `tsc` + `npm test` + `eslint` +
> `expo export -p web` were ALL GREEN on both crashing builds, and always would have been.** The
> fault was a missing `'worklet'` directive — a UI-thread runtime rule no gate in this project can
> see. **A build carrying a surface that has never run on a handset must be treated as unverified,
> and said so out loud before the build is spent.**
>
> **THE BACKEND ALSO DEPLOYED TODAY** (`origin/main` `990c660` → `0324dfc`), which changed live app
> behaviour and surfaced a production secret leak. See "Known broken" — it is not ours to fix.
>
> ⚠️ **The voice-track handoff below the rule is ARCHIVED VERBATIM from a parallel session. Do not
> delete it** — it is still the only record of the Skia / Lottie / web-stub traps.

## Done

- **The mic-button crash has a NAMED CAUSE and it is fixed.** `OrbStatic`'s `clamp01` had no
  `'worklet'` directive while being called from a `useDerivedValue` body, which runs on the **UI
  thread**. Reanimated cannot call a plain JS function from there; in a release build (no LogBox)
  that is **fatal** and the process exits, which to a user is indistinguishable from a native crash.
  **No React error boundary can catch it** — which is exactly why Phase 93's `FeatureBoundary`
  changed nothing.
- **The evidence is an asymmetry, not a hunch.** The identical helper in the sibling `OrbSkia.tsx:27`
  has always carried the directive, and `VoiceWaveform`'s `Bar` sidesteps it by inlining its clamp.
  Only this copy was plain, and it is the **only** such call site in the app (`'worklet'` appears
  exactly once in `src/`; every other animated style is self-contained). **It explains BOTH crashing
  builds with one cause** — `OrbStatic` renders as the Skia orb's `Suspense`/boundary fallback *and*
  as the sole character once Skia is off — which no earlier theory did.
- **The dashboard no longer prints a failed read as a real zero.** Backend Phase 110 answers 200 with
  `partial:true` + `degraded:[…]` and the KPIs zeroed; the app read neither field, so "0 claims,
  ₹0 settled" appeared on the master dashboard as though true. It now raises the outage banner.
- **A failed voice turn now says what actually failed.** Every path used to `catch { fail(…) }`
  without binding the exception, and the banner hard-coded one sentence as both title and message —
  so a screenshot carried zero diagnostic information. `src/voice/cause.ts` puts the real reason on
  screen; the title is now the sentence the failure produced; and the retry action is withheld when
  no retry can help.
- **Voice mode no longer constructs a native audio recorder on every app boot.** `useVoiceTurn` →
  `useAudioRecorder` sat *above* `if (!isOpen) return null`. `VoiceMode` is now a shell reading one
  context value plus an inner component holding every other hook.
- **Builds can be told apart on the phone.** `preview` gained `autoIncrement`; versionCode went
  1 → 2 → 3 → 4 → 5. Previously every build was versionCode 1 and only an APK hash distinguished them.
- **The `.easignore` fix is verified against real builds** — four archives uploaded at ~7 MB (was
  347 MB), with no keystore, no plaintext passwords and no Firebase key.
- **The backend's whole 29-commit window was swept against every route the app calls** (Phases
  107–112). One app-side finding (the `partial` flag above); everything else verified as owed nothing.

## Files changed

- `src/data/api.ts` — `getDashboardOverview` re-reports to `data/health` when `partial === true`.
- `src/data/__tests__/api-dashboard-partial.test.ts` — 4 tests, incl. a body with no `partial` key.
- `src/ui/voice/OrbStatic.tsx` — **the fix**: `'worklet'` on `clamp01` *and* the derived value clamps
  inline, so the worklet calls nothing at all. Either alone suffices; both together survive an edit.
- `src/voice/enabled.ts` — new `VOICE_ENABLED` master switch (currently `true`), carrying the whole
  crash history and the one-line kill instruction.
- `src/lib/voiceGraphics.ts` / `.web.ts` — `VOICE_HEAVY_GRAPHICS_ENABLED = false`: Skia, blur and
  Lottie stay off. **They were never the cause, but they were never device-proven either.**
- `src/voice/cause.ts` + `__tests__/cause.test.ts` — the diagnostic breadcrumb, 7 tests.
- `src/ui/voice/useVoiceTurn.ts` — `cause`/`permanent` state; the exception is kept; the recorder
  retries with the vendor's unmodified `HIGH_QUALITY` preset if ours is refused.
- `src/ui/voice/VoiceMode.tsx` — shell/inner split; banner title/message fixed; async event handlers
  `.catch()`-ed (a boundary covers neither handlers nor promise rejections).
- `src/ui/VoiceLauncher.tsx` — respects `VOICE_ENABLED`.
- `src/ui/FeatureBoundary.tsx` — contains a JS **render** failure to one feature. Kept, with its real
  limits written at the file.
- `src/ui/voice/GlassCards.tsx` — `blurMethod` (the `experimental` prop is deprecated in expo-blur 57).
- `eas.json` — `autoIncrement` on `preview`.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, `../contracts/INBOX.md` (one reply + one
  ticked box, both grepped back; 948,532 → 954,539 B).

## Decisions made

- **Fixed the worklet bug twice over** — directive *and* inline clamp — so a future edit to one cannot
  reintroduce it.
- **Re-enabled voice, but left Skia/blur/Lottie off.** They are decoration, were never proven on a
  handset, and the fixed `OrbStatic` is the character. Turning them on is a separate device test.
- **Switched voice off entirely for vc4 rather than guess a third time**, because it *also* cannot
  work today (server keys unset) — so hiding it cost the user nothing. Had voice been working, that
  would have been the owner's call, not mine.
- **Did NOT add EAS Update (OTA) to any of today's builds**, though the owner asked for it twice. It
  adds a native module and changes the boot path, and these were the builds fixing a crash. **It is
  the agreed next step once a build is confirmed good on a phone.**
- **Measured the quota instead of quoting it:** 15 Android builds/month (Aug ran 15 then refused; Jul
  13). Four used today, **11 left**.
- **Did not guess at the "view as preview" report.** `applyView` (`more.tsx:188`) only sets state and
  toasts; without a log it was left explicitly unexplained.

## Known broken / deliberately skipped

- 🔴 **The fix is DEVICE-UNVERIFIED, like the two crashing builds before it.** This is the third
  attempt; the first two were containment and both failed. The diagnosis is strong (it explains both
  builds with one cause) but **only a handset settles it**. If it crashes again:
  `VOICE_ENABLED = false` in `src/voice/enabled.ts` — one line — and **do not spend another build on
  a new guess** without a device or the crash dialog's "View summary".
- 🔴 **PRODUCTION SECRETS ARE COMMITTED AND PUSHED** in `Aaziko1Market1/cgpe-backend` at
  `docs/OPS-ENV-HANDOVER.md` (`1624f8a`) — on `origin/main`, `origin/Shivam` *and* `origin/ved`.
  21 real values including **`JWT_SECRET` (64 chars)**, which signs every session token: it mints a
  valid token for any user, super_admin included, with no password. **Deleting the file does not fix
  it (git history) — these must be ROTATED**, and rotating `JWT_SECRET` signs everyone out, so the
  owner picks the moment. **Owner-owned, unanswered, and the most serious open item in the project.**
- **Voice cannot ANSWER until OPS sets `SARVAM_API_KEY` + `N8N_VOICE_BRAIN_URL` and restarts `:3001`.**
  `/api/voice/ask` answers `503 not_configured` (`voiceConfig()` needs `ready = stt && brain`).
  **We could not verify the env from here** — `GET /api/voice/status` reports exactly this (names
  only, never values) but sits behind `protect`, and this session holds no credentials. The n8n brain
  itself **is** live and correctly rejects a bad secret (probed). The backend's own handover doc parks
  both keys under *"Group 2 — can wait; the owner is arranging these"*, so they are probably unset.
- **The owner declined USB debugging**, so `adb logcat` is unavailable. `platform-tools` is in the
  session scratchpad if that changes.
- **Never confirmed which build was installed** when vc3 was reported as still crashing. The owner
  reported the APK link opening in a browser on some handsets, which makes re-installing an older
  file easy. **Ask for `Settings › Apps › CGPE Connect → 1.10.0 (N)` before believing a bug report.**
- **The "view as preview" crash report is unexplained** (see Decisions).
- **Everything since 25 Aug remains device-unverified**, which is what keeps Phase Ω shut.

## Next session starts here

- **Phase 96: confirm vc5 on a real handset, then add EAS Update (OTA).** OTA is what the owner has
  asked for twice — after it, a fix like today's ships in seconds with no rebuild and no quota.
- **First command:**
  `npx eas-cli build:list --platform android --limit 3 --json --non-interactive`
  (confirm `a9583d51` / versionCode 5 is newest), then ask the owner what the mic button did.
- **Watch out for:** **treating a green gate chain as evidence.** It was green on both crashing
  builds. The only evidence about this class of fault is a phone. Second trap: **do not re-enable
  Skia/blur/Lottie** while chasing something else — they are off deliberately and are still unproven.
---
---

# ARCHIVED — the parallel session's handoff (voice assistant track, 2026-08-29)

> Preserved verbatim. This is the only record of the Skia / Lottie / web-stub traps. Do not delete.

# HANDOFF — CGPE Connect (Android) — Voice assistant track — 2026-08-29

> This session built the **voice assistant** end-to-end on the app side, produced the n8n + backend
> specs, and then **totally redesigned the voice UI to be "heavy"** (Skia glossy orb + frosted glass +
> Lottie-ready + male/female toggle). Everything is pushed to `aaziko/Shivam`; gates green throughout;
> **no APK built (owner: build ONE at the very end, after the backend proxy + all tasks).**
>
> ⚠️ **A PARALLEL session did the i18n Phase 85 work** (home-dashboard header translations) in this same
> checkout — see memory `phase85-home-headers-i18n-2026-08-29` and `docs/PHASES.md`. History is linear;
> both coexist; nothing overridden. This HANDOFF is the voice track's snapshot.

## Done (observable)
- **The whole voice app-side works in code**: hold the floating mic → full-screen voice mode opens →
  record → POST to the backend proxy → show transcript + speak the reply → navigate on command. All the
  decision logic (`src/voice/*`) is unit-tested (**npm test 1254**).
- **The voice mode is the heavy redesign**: a full-screen immersive surface (not a bottom sheet), a
  **glossy Skia liquid orb** that pulses with the real mic, **real frosted-glass** cards (expo-blur), a
  **male/female toggle** (persisted), a mic-reactive waveform, five animated states, department + persona
  colours, and a reduced-motion + non-Skia fallback (gradient orb). Boot-safe: web export prerenders all
  46 routes clean after every native add.
- **The app is aligned to the LIVE n8n brain contract** — the brain sends `{success, reply_text, action}`
  (no `confidence`); the parser now treats absent confidence as *act*, accepts `success`, and speaks a
  `success:false` reason without navigating.
- **The backend task is filed** — `POST /api/voice/ask` (STT → brain → TTS) is in `contracts/INBOX.md`
  (top, to `cgpe-api`) with the full brief at `docs/spec/VOICE-BACKEND-PROXY-BRIEF.md`.
- **Deliverables handed to the owner**: the n8n dev brief, the backend proxy brief, and two visual
  artifacts (voice-mode preview + the n8n spec page).

## Files changed
- `src/voice/*` — the tested pure core: gate/resolve/session/response/routes/request/client/registry/dispatch.
- `src/ui/voice/*` — **NEW** heavy UI: VoiceMode, useVoiceTurn, VoiceCharacter, OrbSkia, OrbStatic, GlassCards, VoiceWaveform, PersonaToggle, VoiceModeContext, VoiceMascot(+`.web`), mascots.ts, voiceVisual.ts (+tests).
- `src/lib/voiceGraphics.ts` (+`.web`) — Skia/blur/lottie probes; `src/lib/voiceAudio.ts` — metering.
- `src/app/_layout.tsx` — mount VoiceModeProvider + `<VoiceMode/>`; `src/ui/VoiceLauncher.tsx` — opens voice mode.
- `src/voice/response.ts` (+test) — aligned to the live brain. Removed superseded `VoiceSheet.tsx` + `VoiceAvatar.tsx`.
- `package.json`/`package-lock.json` — `@shopify/react-native-skia 2.6.2`, `expo-blur ~57.0.2`, `lottie-react-native ~7.3.8` (+~10-16 MB; native rebuild).
- `src/i18n/index.tsx` (+test) — voice.* keys (parity 446).
- `docs/spec/{N8N-VOICE-DEV-BRIEF,VOICE-BUILD-SPLIT,VOICE-BACKEND-PROXY-BRIEF,N8N-VOICE-WORKFLOW-SPEC}.md` — voice specs.
- `contracts/INBOX.md` — the `/api/voice/ask` backend ask.

## Decisions made
- **Voice architecture = n8n text brain + backend STT/TTS** (owner overrode the Express-fat-registry recommendation for speed). Confirmed live: the brain is text-in/text-out.
- **Full heavy UI** (Skia + expo-blur + Lottie), **light glassmorphic aesthetic**, **Lottie + male/female toggle now**. **Mascot ART is owner-commissioned** — the premium orb is the character until the `.json` drops into `assets/voice/`.
- **Writes stay DARK** in v1 (`VOICE_WRITES_ENABLED=false`) — reads + navigate only.
- **No APK yet** — one build at the very end, after the backend proxy + all other tasks.

## Known broken / deliberately skipped
- **Voice does not round-trip yet** — the backend proxy (`/api/voice/ask`) is not built (filed to cgpe-api). Until it's up, the app records but has nothing to talk to.
- **The character is an orb, not a drawn mascot** — bespoke art is owner-commissioned; the Lottie slot + toggle are wired.
- **All visuals are device-unverified** — Skia/blur/metering/back-intercept need a real APK (EAS quota resets 1 Sep; existing account cannot build before then).
- **EAS Update (OTA) not added** — recommended; owner build decision.
- **The `vbk_` brain webhook secret was pasted in chat** — must stay server-side only; worth rotating.

## Next session starts here
- **Phase — voice go-live:** confirm the backend proxy is built (INBOX top ask), then wire the pre-1-Sep test APK OR the 1-Sep final build (existing account, same keystore).
- **First command:** `npm test` (expect 1254 green), then re-read `contracts/INBOX.md` for the cgpe-api reply on `/api/voice/ask`.
- **Watch out for:** the **lottie web-build trap** — `lottie-react-native`'s web renderer needs `@lottiefiles/dotlottie-react` (not shipped); it is neutralised by `VoiceMascot.web.tsx` + `voiceGraphics.web.ts` stubs. **Do not delete those stubs** or the web export (boot-safety gate) breaks. And never static-import Skia/blur/lottie from a route/boot file — they load only via the `hasSkia/hasBlur/hasLottie` probes + `React.lazy`.
