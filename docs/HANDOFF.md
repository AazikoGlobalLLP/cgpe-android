# HANDOFF — CGPE Connect (Android) — Phase 88 (the legacy upload path stops persisting an expiring URL) — 2026-08-31

> Phase 88 is **shipped and pushed** (`eb9760f` + docs `554fd6d` on `aaziko/Shivam`). **Phase 89 is
> written up and NOT started** — it is the resume point, and it is the same kind of sweep that found
> Phase 88 in the first place.
>
> ⚠️ **The voice-track handoff below the rule is ARCHIVED VERBATIM. Do not delete it** — it is still
> the only record of the Skia / Lottie / web-stub traps.

## Done

- **An ordinary document upload will no longer save a link that expires.** Backend Phase 101 turned
  the legacy upload route's `url` into a **short-lived signed link** and put the durable handle in
  `storage_key` beside it. The app read only the url and wrote it down as the attachment's permanent
  address — so on the day storage is switched on, every attachment made through that path would have
  become unopenable once the signature lapsed. The app now keeps the **key** and re-signs a fresh link
  each time the file is opened.
- **It needed no change on either claim screen.** A "signed" answer is reported with an empty url and
  a key, which is exactly the shape the presigned flow already produces — so the existing plumbing
  (write the key, leave the url empty, await the row, re-sign per render) took over unchanged.
- **The "this file will not be kept" warning still works.** The droplet-disk fallback returns neither
  new field, so it is untouched by the fix; a test pins it, because quietly losing that warning would
  have been a worse bug than the one being fixed.
- **The `cgpe-api` box was answered under the item that is blocking**, with what we built and why, and
  an explicit note that the tick does **not** mean the deploy-day window is closed.
- **Gates, all run live:** `npx tsc --noEmit` **0** · `npm test` **1308 / 77 files** (was 1297, **+11**)
  · cache-free `npx eslint` **0 errors** on all six touched files (3 pre-existing warnings untouched).

## Files changed

- `src/lib/fileUpload.ts` — new pure `parseLegacyUploadResult` + `LegacyUploadResult`. The **only**
  place that decides whether the legacy route's `url` is disposable. The two-part discriminator and
  its reasoning are written at the function.
- `src/data/api.ts` — `uploadFile`'s legacy branch reads the body through that seam and reports
  `storageKey` with an empty `url` when the server signed it. Three stale doc-comments corrected:
  `UploadOutcome.url`, `UploadOutcome.storageKey` (it said "presign-only", which is now false), and
  the "PATH 2 — legacy multipart, **unchanged**" header.
- `src/app/claim/[id].tsx`, `src/app/claim-new.tsx` — **comments only, no behaviour change.** Both
  explained their await-vs-fire-and-forget branch in terms of *which path ran*; they now say the test
  is the `storageKey` **field**, because the legacy path can produce one now.
- `src/lib/__tests__/fileUpload.test.ts` — +8 (all six body shapes: signed, signing-failed,
  pre-Phase-101, key-without-TTL, NaN/numeric-string, key-without-url, unwrapped, unusable).
- `src/data/__tests__/api-resilience.test.ts` — +3 wiring tests (the fix, the signing-failure
  fallback, and the ephemeral warning surviving).
- `../contracts/INBOX.md` — reply filed under the blocking item; 828,750 → 831,630 bytes, `.bak`
  taken first, reply greped back afterwards.
- `docs/PHASES.md`, `CLAUDE.md`, `docs/OPS-SERVER-HANDOVER.md` §2b, `docs/DECISIONS.md`,
  `docs/STATUS.md`.

## Decisions made

- **The discriminator is TWO-PART and must stay that way.** `storage_key` alone is not enough: Phase
  101's documented signing-failure branch **still sets it** while falling back to the public URL with
  `url_expires_in: null` — and there the url is the durable thing, while the signer that just failed
  is the one a later re-sign would need. Keying on the key alone would discard the only working link
  in exactly the case where signing is broken. `Number.isFinite`, not `typeof === 'number'`, so a
  `null`, a `NaN` or a numeric *string* all fall back to today's behaviour.
- **Shipped without waiting for `cgpe-api`'s answer.** The question of which field to key on is still
  open at the top of `INBOX.md`. Building to our own proposed reading was the right call because it is
  a one-line change in one function if they disagree, and holding the phase would have left a known
  data-loss defect unfixed over a confirmation.
- **Verified the producer before building, not after.** The fix only works if a key minted by the
  *legacy* route survives `mayAccessKey` + the Phase 104 HeadObject confirm. It does — Phase 101
  passes `ownerTag` into `cloudStorage.uploadFile`. Had it not, this "fix" would have converted a
  silent expiry into a loud "not attached" on **every** upload.
- **`ephemeral: false` on the new branch is a fact, not an assumption** — those two fields are set
  only inside Phase 101's `cloudStorage.isConfigured()` branch, so the bytes are in a real bucket.

## Known broken / deliberately skipped

- 🔴 **THIS DOES NOT REACH THE PHONES, and that is the honest headline.** The field APK is still
  `093a3b33` (**25 Aug**), which predates Phase 86 and has **no `storage_key` handling at all**; ~21
  handsets are on it. Until a new APK is installed, a deployed Phase 101 + `S3_*` still means expiring
  links **from those builds**. `OPS-SERVER-HANDOVER.md` §2b now says so explicitly, so "the app fixed
  it" cannot be read as "the window is closed".
- **Nothing from Phase 88 has run on a handset**, and it is inert in production anyway — presign is
  404 and `cloudStorageConfigured` is `false`, so the new branch cannot fire there yet.
- **Six `cgpe-api` commits are still unread** (Phases 102–106) — that is Phase 89, not a defect.
- **Untracked repo-root files left alone** (`*.mp3`, `*.txt`, the staff JSON, the store spec,
  `.claude/settings.json`, `.gitignore`) — the owner's local files, unchanged from boot.

## Next session starts here

- **Phase 89: read the sibling's six undeployed commits and find the next Phase 101.** `e3156d2`
  (**Phase 102, admin-TIER RBAC** — the likeliest to touch us), `c6b00bc` + `ccae449` (security),
  `d4fad85` (Phase 104), `ca4db88` (Phase 105 — client phone search), `d9d9d85`/`85d55c5` (CORS/CI).
  **Open the diff for every route the app calls — the commit message is not enough**, which is the
  entire lesson of Phase 88 (`9a74c9a` was filed as "finish MinIO").
- **First command:**
  `git -C ../cgpe-backend-main log --oneline origin/main..origin/Shivam`
- **Watch out for:** 🔴 **the EAS quota resets 1 Sep — today or tomorrow — and that APK is now the
  highest-value action in the project.** It is the only way Phases 80–88 reach the ~21 phones.
  Consider adding EAS Update (OTA) in the same build to end the rebuild-per-fix cycle. Second trap:
  **Phase Ω must not be started** — Phase 89 is open and device-unverified work exists, so the gate
  is shut.

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
