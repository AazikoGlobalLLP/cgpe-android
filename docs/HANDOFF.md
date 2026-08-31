# HANDOFF — CGPE Connect (Android) — Phase 87 (voice timeout + unconfigured-server honesty) — 2026-08-31

> Phase 87 is **shipped and pushed** (`fd28c70`). Two backend items were then filed to
> `contracts/INBOX.md`, one of which is a **deploy-day warning that affects phones already in the
> field**. **Phase 88 is written up and NOT started** — it is the resume point.
>
> ⚠️ **The voice-track handoff below the rule is ARCHIVED VERBATIM. Do not delete it** — it is still
> the only record of the Skia / Lottie / web-stub traps.

## Done

- **A voice question no longer dies before the server can answer it.** The app aborted every turn at
  **8 s**; the proxy is three sequential vendor calls whose own timeouts total **80 s**. On a healthy,
  fully-configured server any turn past 8 s was killed, shown as "something went wrong, please try
  again", and the user would re-record — **re-running the whole billed vendor chain while the first
  was still in flight.** The ceiling is now sized to the server; the old 8 s shows a "Still working…"
  hint and keeps waiting.
- **A server with voice switched off stops telling people to try again.** `404 / 501 /
  503-with-not_configured` now reads as *"Voice is not switched on for this server yet. Ask your admin
  to turn it on."* **This is what every user sees today**, because production answers 404.
- **`cgpe-api`'s two disclosures were verified against their real code and both cost us nothing** —
  `audio.mode:"base64"` was already parsed; their 503 is now a first-class case.
- **Gates, all run live:** `npx tsc --noEmit` **0** · `npm test` **1297 / 77 files** (was 1289, +8) ·
  cache-free `npx eslint` **0 errors** on every touched file · `npx expo export -p web` **exit 0** ·
  i18n orphan scan **18, unchanged**, at **448** keys — zero dead copy added.
- **Two backend items filed** to `contracts/INBOX.md` (819,033 → 828,750 bytes; `.bak` taken before
  each write, both greped back afterwards).

## Files changed

- `src/voice/constants.ts` — `CEILING_MS` 8 s → **80 s, derived** (STT 30 + brain 20 + TTS 30, cited at
  the constant); the old 8 s becomes `SLOW_MS`, a hint threshold that does **not** abort.
- `src/voice/client.ts` — new pure `isPermanentVoiceOutage()`; a non-2xx body is now read so a
  permanent gap can be told apart from a transient fault; new `transport:'unconfigured'`.
- `src/ui/voice/useVoiceTurn.ts` — the "Still working…" toast at `SLOW_MS`, and the third failure
  branch. `clearTimeout` in the existing `finally`.
- `src/voice/__tests__/client.test.ts` — +8 tests (the permanent/transient matrix, both 503 spellings,
  the conservative fall-through, a body that will not parse). Two stale "8 s" titles corrected.
- `src/i18n/index.tsx` + `__tests__/dictionaries.test.ts` — `voice.notSetUp` / `voice.stillWorking`,
  parity **446 → 448**.
- `docs/OPS-SERVER-HANDOVER.md` — **§9 corrected** (it said the voice proxy "does not exist yet" — it
  exists, it is undeployed) + new **§2b**, the deploy-day ordering note.
- `docs/PHASES.md` — Phase 87 recorded; **Phase 88 written up as the resume point**.
- `CLAUDE.md` — the 80 s derivation and the `unconfigured` rule, so neither gets "fixed" back.

## Decisions made

- **A client timeout must be sized to the PRODUCER's real timeouts, never to a UX wish.** 80 s is
  derived from `services/voiceService.js:54-56`, not chosen. 80 s is a bad wait, but that is a
  **server budget** problem — filed as an ask — and waiting beats discarding an answer already paid for.
- **A bare 503 stays transient.** Only a 503 whose body names `not_configured` is permanent; an
  unrecognised body falls through to `'server'`. The conservative direction merely over-offers a
  retry; the other tells someone to give up on a service that was about to come back.
- **The two new keys ship in ENGLISH in all five dictionaries.** Not machine translation — the
  2026-08-27 waiver covered one batch and is not standing permission, and PHASE-19 DONE-4 says an
  honest English fallback beats a wrong romanised guess. Same precedent as `tab.search`; filed as
  **Batch 6h** with translator notes.
- **The Phase 101 finding was filed, not fixed.** It is app-side work (Phase 88) and the session's
  remaining instruction was to file backend asks and hand off.

## Known broken / deliberately skipped

- 🔴 **PHASE 88 IS NOT STARTED, and it is a real defect.** `cgpe-api`'s Phase 101 (`9a74c9a`) made the
  legacy `POST /api/upload` return a **short-lived** `url` plus a durable `storage_key`. Our legacy
  path reads only `data.url` (`src/data/api.ts:3640-3642`) and records it as `file_url` — so once
  Phase 101 deploys **and** `S3_*` is set, legacy uploads persist a link that expires. Phase 86's
  presigned path is already correct; only the fallback is wrong.
- ⚠️ **Shipping that fix does not fix the phones.** The newest APK in the field is **`093a3b33`
  (25 Aug)**, which predates Phase 86 entirely; ~21 handsets are on it. This is fixed by getting a
  **new APK out**, which the EAS quota gates until **1 Sep**.
- **Nothing from Phase 87 has run on a handset**, and it is inert in production anyway — `/voice/ask`
  is 404 until the backend deploys.
- **Untracked repo-root files left alone** (`*.mp3`, `*.txt`, the staff JSON, the store spec,
  `.claude/settings.json`, `.gitignore`) — the owner's local files, unchanged from boot.
- **One pre-existing lint warning** in `src/i18n/index.tsx` (a ref in an effect cleanup, line ~2392)
  left alone — it predates this work.

## Next session starts here

- **Phase 88: stop the legacy upload path persisting a URL that expires** — in `uploadFile`'s legacy
  branch, when `storage_key` is present **and `url_expires_in` is a number**, return it as `storageKey`
  so the existing presigned plumbing takes over. **Check `contracts/INBOX.md` first**: the exact field
  to key on is an open question to `cgpe-api` at the top of the file — build to their answer if it has
  arrived, and to the two-part discriminator if it has not.
- **First command:** `npm test` (expect **1297** green), then
  `grep -n "url_expires_in" ../contracts/INBOX.md` for the `cgpe-api` reply.
- **Watch out for:** **the EAS quota resets 1 Sep — that APK is now the highest-value action in the
  project.** It carries i18n Phases 80–85, the boundary fix (which still owes a device walk-through),
  the version reconcile, the whole voice track, Phase 86's upload flow and Phase 87 — and it is the
  only way the Phase 88 fix reaches the ~21 phones. Consider adding EAS Update (OTA) in that same
  build. Second trap: **Phase Ω must not be started** — Phase 88 is open, so the gate is shut.

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
