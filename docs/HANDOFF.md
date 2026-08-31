# HANDOFF — CGPE Connect (Android) — Phase 90 (the post-quota APK) — 2026-08-31

> **The APK was NOT built. The EAS free-plan quota was still exhausted on 31 Aug** — it resets on
> **1 Sep**, and "1 Sep" does not mean the evening of the 31st. Nothing is wrong with the code; the
> gates were green going in. **Phase 90 is unfinished and stays the next phase.**
>
> The attempt was not wasted: chasing why it cost a 320 MB upload found that **every EAS build ever
> made has uploaded 338 MB of Playwright run output**. Fixed and pushed — tomorrow's upload is ~6 MB.
>
> ⚠️ **The voice-track handoff below the rule is ARCHIVED VERBATIM. Do not delete it** — it is still
> the only record of the Skia / Lottie / web-stub traps.

## Done

- **We now know the build archive was 58x bigger than it needed to be, and it is fixed.** Every EAS
  build this project has ever made uploaded the entire Playwright test-output folder — 338 MB of
  screen recordings and traces that have nothing to do with the app. The upload is now **5.9 MB
  instead of 347.1 MB**. This does not change the app; it makes every future build start faster and
  makes a refused attempt cheap instead of costly.
- **The reason it happened is now written down**, because it is genuinely counter-intuitive and would
  otherwise be re-discovered the hard way: the `.easignore` file **replaces** `.gitignore` for the
  build upload rather than adding to it, so the project's ordinary ignore rules were never applied.
  That file has existed since the project's first commit on 7 Aug, which is why nobody looked at it.
- **A secret-protection rule that was sitting uncommitted is now committed.** `eas credentials` writes
  the Android signing key *and its passwords* into `credentials.json` in plain text; the rule keeping
  that out of git existed only in the local working copy.
- **Nothing reached a phone, and nothing in the app changed.** No `src/` file was touched this phase.
- **Gates, run live before the attempt:** `npx tsc --noEmit` **0** · `npm test` **1309 / 77 files**.
  Unchanged by this phase — no source file was modified.

## Files changed

- `.easignore` — adds `e2e/`, `test-results/`, `playwright-report/`, `.playwright/` and root `/*.mp3`,
  with a header explaining that this file **replaces** `.gitignore` for the archive. Excluding `e2e/`
  wholesale is safe and is what the harness already documents: tsconfig excludes it, eslint ignores
  `e2e/**`, Vitest is scoped to `src/`, and it is never bundled into the APK.
- `.gitignore` — commits the pre-existing but uncommitted `credentials.json` / `credentials/` rule.
- `CLAUDE.md` — two lines corrected because they were provably wrong, not merely stale: "consider an
  `.easignore` at some point" (one has existed all along, and was the cause) and the "~317 MB upload"
  cost quoted in the quota section. Adds the measurement recipe.
- `docs/PHASES.md` — `## Now` records the refused attempt, the resume command, and the open OTA
  decision; a new `## Next 3` supersedes the 2026-08-29 one.
- `docs/DECISIONS.md` — appended (D-123, D-124).
- **No `src/` change, no test change, no contract change.**

## Decisions made

- **Did NOT add EAS Update (OTA) to the tree ahead of this build.** It is the standing recommendation
  and it would end the rebuild-per-fix cycle, but it adds a native module and changes the boot path,
  and the build it would ride on is the one that finally reaches 21 handsets after six days. The free
  quota resets **monthly, not once**, so shipping the known-good APK first and OTA in a second build
  costs nothing. **Owner's call, recorded as open rather than taken quietly.**
- **Excluded the whole of `e2e/` rather than just `e2e/artifacts/`.** The specs are ~40 KB, so
  narrowing buys nothing measurable, and a rule that names the directory the harness lives in is
  harder to get wrong later than one that names a subfolder created at runtime.
- **Committed the `.gitignore` secret rule rather than leaving it as a local-only change.** It only
  adds ignore rules, and leaving a keystore-password guard uncommitted is a real risk on any other
  clone. Called out explicitly since it was the owner's uncommitted edit.
- **Reported the refusal as a blocked phase rather than re-attempting or working around it.** Switching
  Expo accounts would issue a new keystore and cost all 21 users their session; that trap is already
  documented and was not re-litigated.

## Known broken / deliberately skipped

- 🔴 **THE APK STILL DOES NOT EXIST.** The field build is `093a3b33` (**25 Aug**). Phases 80–89 — the
  i18n work, the presigned upload path, the boundary-attribution fix, the version reconcile and the
  entire voice track — reach **no phone** until it is built.
- **The quota is the only blocker and it is billing, not engineering.** Wait for 1 Sep (zero cost, same
  keystore) or `eas billing:subscribe starter --account shivam-bhadoriya`.
- **The archive fix is unverified against a real build** — it was verified by replicating eas-cli's own
  `Ignore.createForCopyingAsync` filter (347.1 MB / 820 files → 5.9 MB / 302 files) plus a check that
  zero build-essential files are excluded, but no actual build has consumed it. If tomorrow's build
  fails on a missing file, `.easignore` is the first suspect and `git revert 4a12899` is the fallback.
- **The whole backend window is still unshipped** — re-probed today: `origin/main` still `990c660`,
  `cloudStorageConfigured:false`, `/upload/presign` **404**, `/voice/ask` **404**, and
  `GET /api/users/test` still **200** (the route backend Phase 105 deletes — the live discriminator
  proving prod predates the merge). So mobile Phases 86–89 and the voice track remain inert.
- **Team notifications are still silently broken in production** (Phase 89's find). Repaired only by
  the backend merge + a `:3001` restart. Unchanged today.
- **Untracked repo-root files left alone** (`*.mp3`, the `.txt` files, the staff JSON, the store spec,
  `.claude/settings.json`) — the owner's local files, unchanged from boot. The two `.mp3`s are now
  excluded from the *upload* but remain on disk untouched.

## Next session starts here

- **Phase 90 (unchanged): build the APK.** The quota should have reset. Everything else is ready.
- **First command:**
  `npx eas-cli build:list --platform android --limit 3 --json --non-interactive`
  (confirms the rollover and that `093a3b33` is still the newest), then
  `EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build -p android --profile preview --non-interactive`
- **Watch out for:** 🔴 **do not re-attempt before 1 Sep** — the refusal on the 31st said "resets in 18
  hours", so an early retry just burns the attempt again. Then the three known build traps, in order of
  likelihood: **(1)** if it dies locally at "Computing project fingerprint" with an `UNKNOWN: unknown
  error` on a `react-native-reanimated` file, that is the Windows trap — `EAS_SKIP_AUTO_FINGERPRINT=1`
  is already in the command above; **(2)** a session teardown kills the local "waiting for build"
  process but **NOT** the remote build — on resume use `build:view <id> --json`, never a relaunch;
  **(3)** if the build fails on a file it cannot find, suspect this phase's `.easignore` change first.
  And **Phase Ω must not be started** — device-unverified work exists, so that gate is shut.

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
