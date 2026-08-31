# HANDOFF — CGPE Connect (Android) — Phase 86 (presigned MinIO upload) — 2026-08-31

> The presigned upload contract that had been sitting open for four days is **built, tested and
> pushed**. The owner also mandated a **new final phase (Phase Ω)** — the production/server
> developer's message — which is gated to run only after every other phase is Done.
>
> ⚠️ **The voice-track handoff below the rule is ARCHIVED VERBATIM. Do not delete it** — it is still
> the only record of the Skia / Lottie / web-stub traps.

## Done

- **The app is on the presigned MinIO flow** (`cgpe-api` Phase 95 / D-122, filed 2026-08-27, adopted
  today). Attaching a document now goes: `POST /upload/presign` → a signed `PUT` **straight to
  MinIO** → `POST /file-attachments` with `storage_key` and an empty `file_url`. The bytes no longer
  pass through the API server and the app never holds storage credentials.
- **The claim screen now shows what the register actually holds.** `claim/[id].tsx` lists the
  documents recorded against the claim and opens each through a **freshly signed URL, per tap** —
  so the read half of the contract has a real consumer instead of a helper nobody calls.
- **Gates, all run live:** `npx tsc --noEmit` **0** · `npm test` **1289 / 77 files** (was 1254, +35)
  · cache-free `npx eslint` **0 errors** on every touched file · `npx expo export -p web` **exit 0**
  (the boot-safety gate — a native `require` was added, so this mattered).
- **Both `cgpe-mobile` INBOX boxes closed**, each with a reply underneath explaining the reasoning,
  and both grepped back after writing (the file grew 814,049 → 819,033 bytes; a `.bak` was taken first).
- **The server-side dependency list is now a single maintained file** —
  `docs/OPS-SERVER-HANDOVER.md` — with every live value re-probed today, not quoted.

## Files changed

- `src/lib/binaryUpload.ts` — **NEW.** The native binary `PUT` behind one seam. `fetch` cannot stream
  a `file://` body on React Native, so this wraps `expo-file-system`'s upload task; it also exists so
  the path is testable at all (see Decisions).
- `src/lib/fileUpload.ts` — the pure seam: `parsePresignTarget` / `classifyPresignResponse` /
  `classifyPutStatus` / `parseDownloadUrl`, plus a new `'not_linked'` failure and its copy.
- `src/data/api.ts` — presign-first `uploadFile` with the legacy fallback; `recordFileAttachment`
  sends `storage_key` with an empty `file_url`; new `listAttachments` + `getAttachmentDownloadUrl`.
- `src/app/claim/[id].tsx` — the register's document list + open-via-signed-URL; the record is
  **awaited** on the presigned path; the "cannot link a file to a claim yet" caption is now
  conditional, because the list below it would otherwise contradict it.
- `src/app/claim-new.tsx` — the same await/report rule on the presigned path.
- `src/data/__tests__/api-resilience.test.ts`, `api-file-attachments.test.ts`,
  `src/lib/__tests__/fileUpload.test.ts` — +35 tests.
- `docs/OPS-SERVER-HANDOVER.md` — **NEW.** The running list for the production server developer.
- `docs/PHASES.md` — Phase 86 in `## Now`; **Phase Ω** added, gated. `CLAUDE.md` — presign marked
  adopted; the lazy-`require` trap written up as the third native-module trap.

## Decisions made

- **A missing route is not a failure.** `presign` answering **404 / 501 / 503** falls back to the
  legacy multipart path, unchanged. That is what makes shipping ahead of the backend deploy inert
  rather than a field outage — production is **404 today**, so every upload still takes the old path.
  A **415 deliberately does not fall back**: a rejected type can only fail again.
- **A `403` on the PUT is `'server'`, never `'unauthorized'`.** That request carries no session at
  all, so a 403 means a signature mismatch or an expired 300 s window — which a retry fixes.
  `'unauthorized'` copy would have sent the user to their branch admin for nothing.
- **The `/file-attachments` write is awaited and reported on the presigned path** (new
  `'not_linked'`), and stays fire-and-forget on the legacy path. The reasoning inverts between them:
  legacy has a durable URL already, so a failed record must not read as a failed upload; with
  presign that row is the **only** thing naming the object, so a silent failure would be an
  unreachable file wearing a green tick.
- **`?entity_id=` is filtered twice.** The server-side filter is backend Phase 94 and is not
  deployed, so an older build answers with the **whole collection**. Filtering again on the value the
  server echoes back yields an honestly-empty list instead of one claim showing another claim's
  documents. **Keep the client-side filter after the deploy lands.**
- **The native call went behind our own module rather than a test stub.** A lazy `require()` resolves
  through **Node, not Vite** — so a `vitest.config.mts` alias cannot redirect it and `vi.mock()`
  cannot intercept it. Both were tried and backed out; a probe proved the `require` reaches the real
  `node_modules` copy. Now in `CLAUDE.md` as the third native-module trap.
- **Phase Ω exists and is blocked by design** (owner instruction, 2026-08-31): the production
  developer's message is written **only** when no phase is pending, blocked, or built-but-unverified.

## Known broken / deliberately skipped

- **Nothing from this phase has run on a handset.** The EAS free-plan quota still blocks any APK, so
  the whole flow is code-verified only. The list, the signed-URL open and the `'not_linked'` path all
  need a device walk-through in the next build.
- **It is inert in the field until OPS acts** — `S3_*` and `BACKEND_URL` are unset and the backend
  deploy is **29 commits behind**, so presign 404s and uploads still land on droplet disk. That is
  expected, not a regression.
- **`docs/OPS-SERVER-HANDOVER.md` is the list, not the message.** It is written in our vocabulary and
  must not be sent as-is; Phase Ω turns it into something a server developer can act on.
- **One pre-existing lint warning** on `claim/[id].tsx` (`nonce` dep) left alone — it predates this
  work and touching it is unrelated churn.
- **Untracked repo-root files left alone** (`*.mp3`, `*.txt`, the staff JSON, the store spec,
  `.claude/settings.json`) — the owner's local files.

## Next session starts here

- **Phase: voice go-live** — still blocked on `cgpe-api` building `POST /api/voice/ask` (**404**
  probed today). If it is still 404, the next unblocked work is the i18n residue, all of which needs
  the owner's copy: hand over `docs/i18n/COPY-REQUEST-2026-08-26.md`.
- **First command:** `npm test` (expect **1289** green), then
  `grep -n "voice/ask" ../contracts/INBOX.md` for the `cgpe-api` reply.
- **Watch out for:** **Phase Ω must not be started early.** It is the message that goes to the person
  who runs production, they will act on it once, and a message sent while work is still moving is
  stale the next day. Check every phase is Done first — "built but device-unverified" is **not** Done.
  Second trap: after the backend deploy lands, do **not** remove the client-side `entity_id` filter.

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
