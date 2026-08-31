# HANDOFF — CGPE Connect (Android) — Phases 90a + 91 — 2026-08-31

> **The APK still does not exist, and Phase 90 is still the resume point.** The EAS free-plan quota
> resets on **1 Sep** and this session ran on **31 Aug**, so no build was attempted — the refusal the
> day before said "resets in 18 hours", and re-attempting only burns the upload again.
>
> Two phases were completed instead, both of which make that build safer: **90a** pre-flighted the
> tree the APK will upload and **found the archive was shipping the app's signing keys**; **91** filed
> the owner's cross-repo requests, and found that two of the three items we were about to send another
> team were not real.
>
> **No `src/` file was touched in either phase.** The app is byte-identical to Phase 89's.
>
> ⚠️ **The voice-track handoff below the rule is ARCHIVED VERBATIM. Do not delete it** — it is still
> the only record of the Skia / Lottie / web-stub traps.

## Done

- **The build is verified ready, on the exact tree it will upload.** Four gates re-run live:
  `npx tsc --noEmit` **0** · `npm test` **1309 / 77 files** · cache-free `npx eslint src` **0 errors,
  12 warnings** (the documented baseline) · `npx expo export -p web` **exit 0**. `package.json` ↔
  `package-lock.json` root deps confirmed **in sync**, so EAS's `npm ci` will not hard-fail. The three
  voice native deps were re-checked against the module-scope-throw rule and are correctly behind
  `React.lazy` + probes.
- **🔴 The build archive was uploading both Android signing keystores, their plaintext passwords, and
  the Firebase push key — and it is now fixed.** Phase 90 discovered that `.easignore` *replaces*
  `.gitignore` for the archive and applied that only to the 338 MB of test video. The rule was left
  one-sided, so every **secret** `.gitignore` protects was still being uploaded. Four secret files,
  all sitting on disk since 21/29 Aug, were in the next build's archive.
- **We know it already happened.** The archive uploads *before* the quota check refuses, so the 31 Aug
  attempt shipped all four, and the 25 Aug build (`093a3b33`) shipped the Firebase key.
- **The admin panel's Relationship map now has a written, evidenced defect list.** The owner reported
  it as unreadable; seven defects were filed, and the first is objective rather than taste — every
  section heading counts one array while the body renders two, so on the owner's own screenshot
  "Navigation · 5 tabs" sits above 7 chips and "Features · 5 enabled" above 11.
- **Two of the three `[admin]` items we had been carrying for another team were not real, and saying
  so was the more valuable half.** The "admin can see staff location" report is **fixed end-to-end and
  now closed** — the app was always correct, the backend 403s a non-`super_admin` **on deployed
  `origin/main`**, and the panel has no live-location view at all. "Assign Task" is real but is a
  label in `TeamTasks.tsx`, not a button.
- **A provably wrong line in `CLAUDE.md` was corrected**: `SCHEMA_FEATURE_DEFAULTS` is **4 true / 10
  false**, not "mostly `true`". The fail-open warning that line supports is unchanged and still right.

## Files changed

- `.easignore` — mirrors `.gitignore`'s secret patterns (`credentials.json`, `credentials/`, `*.jks`,
  `*.p8`, `*.p12`, `*.key`, `*.pem`, `*.mobileprovision`, `*-firebase-adminsdk-*.json`,
  `google-service-account*.json`, `.env*.local`) under a header saying why `.gitignore` alone is not
  enough. **`google-services.json` is the client config and deliberately still ships.**
- `CLAUDE.md` — the secrets half of the `.easignore` trap, and the `SCHEMA_FEATURE_DEFAULTS`
  correction.
- `docs/PHASES.md` — `## Now` + `## Next 3` rewritten; Phase 90a and 91 entries; a superseded note on
  the three `[admin]` items so the two dead ones are never re-filed.
- `docs/DECISIONS.md` — appended (Phase 90a, Phase 91).
- `docs/STATUS.md` — rewritten for the 31 Aug position.
- `../contracts/INBOX.md` — **two new items to `cgpe-admin`** (839,917 → 850,279 B, 151 headers, both
  replies grepped back, `.bak-p91` taken first). Not version-controlled by anyone.
- **No `src/` change. No test change. No contract-shape change.**

## Decisions made

- **Did not re-attempt the build on 31 Aug.** The refusal said "resets in 18 hours" and CLAUDE.md
  already records that "1 Sep" does not mean the evening of the 31st. A refused attempt is cheap now
  (~6 MB) but still pointless.
- **Rotate the Firebase key; do NOT rotate the keystore.** The Firebase service-account key can be
  regenerated in one click with no user impact, and it is the one credential EAS has no legitimate
  reason to hold. Rotating the *signing* keystore would force all 21 handsets to uninstall before
  updating — losing login, clock keys and the offline queue — and the exposure is to Expo's own
  storage under the owner's account, which already legitimately holds that exact keystore.
  **Owner's call; recorded, not taken.**
- **Left `expo-env.d.ts` in the archive.** It is the fifth gitignored file found, but it is generated
  and harmless; excluding files that are not secrets only adds risk to a build that matters.
- **Filed one admin item instead of three, and closed one outright.** Re-reading the sibling's real
  code before sending was what caught it. Filing all three as written would have sent another team on
  two wild-goose chases and left a fixed bug open on the board.
- **Filed nothing new backend-side.** Every server ask is already assembled and ordered in
  `docs/OPS-SERVER-HANDOVER.md` §1–11; duplicating it into `INBOX.md` would be noise.
- **Did not start Phase Ω.** Its gate is shut by its own rule — device-unverified work exists. Whether
  to send §1 (merge + deploy) early, as a standalone instruction, is **an open owner question asked at
  the end of the session and not yet answered.**

## Known broken / deliberately skipped

- 🔴 **THE APK STILL DOES NOT EXIST.** The field build is `093a3b33` (**25 Aug**). Phases 80–91 reach
  **no phone** until it is built. The quota is the only blocker and it is billing, not engineering.
- 🔴 **The two signing keystores and the Firebase key have already been uploaded at least once** — the
  fix prevents future uploads, it cannot recall past ones. See the rotation decision above.
- **The `.easignore` change is still unverified against a real build** (now doubly so — two commits
  touch it). Verified only by replicating eas-cli's filter: 301 → 297 files, exactly four secrets
  removed, zero newly included, every build-essential path intact. **If tomorrow's build fails on a
  missing file, `.easignore` is the first suspect**; `git revert 954a0a4` then `4a12899`.
- **The whole backend window is still unshipped** — `origin/main` still `990c660`, 29 commits behind.
  Mobile Phases 86–89 and the entire voice track stay inert, and **team notifications remain silently
  broken in production**.
- **Item 1 of the admin sweep and all 7 map defects are unacknowledged** — filed today, no reply yet.
- **The `cgpe-front-main-RECOVERED` caveat is stated in the INBOX item, not hidden:** if the deployed
  panel is built from a newer tree, "no live-location view exists" is only true of the checkout we can
  see.
- **Untracked repo-root files left alone** (`*.mp3`, the `.txt` files, the staff JSON, the store spec,
  `.claude/settings.json`) — the owner's local files. The secret files were **not deleted**, only
  excluded from the upload; removing an owner's keystore is not ours to do.

## Next session starts here

- **Phase 90 (unchanged): build the APK.** The quota should have reset on 1 Sep.
- **First command:**
  `npx eas-cli build:list --platform android --limit 3 --json --non-interactive`
  (confirms the rollover and that `093a3b33` is still newest), then
  `EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build -p android --profile preview --non-interactive`
- **Watch out for:** the single biggest trap is **treating a session teardown as a build failure** — it
  kills the local "waiting for build" process but **NOT** the remote build, so on resume use
  `build:view <id> --json`, never a relaunch. Then, in order: if it dies locally at "Computing project
  fingerprint" with an `UNKNOWN: unknown error` on a `react-native-reanimated` file, that is the
  Windows trap and `EAS_SKIP_AUTO_FINGERPRINT=1` is already in the command; and if it fails on a file
  it cannot find, suspect this session's `.easignore` edit first.

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
