# HANDOFF — CGPE Connect (Android) — Phase 89 (the sibling's undeployed commits, read) — 2026-08-31

> Phase 89 is **shipped and pushed** (`968955e` on `aaziko/Shivam`). It found that **team
> notifications are silently broken on production right now** — a server-side bug, already fixed in
> `cgpe-api`'s undeployed window, that the app cannot detect and owes no code for.
>
> **The next action is the APK, not another phase.** The EAS free-plan quota resets **1 Sep**.
>
> ⚠️ **The voice-track handoff below the rule is ARCHIVED VERBATIM. Do not delete it** — it is still
> the only record of the Skia / Lottie / web-stub traps.

## Done

- **We now know that the "send a notice to the team" button does nothing, and why.** On the backend
  running in production today, dispatching a notification writes each row under the app's `USR-…` id,
  while the read behind every notification bell looks the rows up by the Profile `_id` hex string. The
  two never match. The server inserts the rows, counts them, and tells the app it sent them to N
  people — and not one person can ever see them. Nobody had reported it, because it looks like a
  success from the sending end and like silence from the receiving end.
- **It is already fixed on the backend, and needs no app change** — it is repaired by the pending
  merge and a `:3001` restart alone. Unusually for this queue, that means it helps the ~21 handsets
  **already in the field** without waiting for a new APK.
- **Every other undeployed backend commit was read and cleared, with a reason recorded for each** —
  so the next session does not have to wonder whether the window holds another surprise. Seven
  commits (backend Phases 102–106), every touched route the app actually calls, read as diffs rather
  than from their commit messages.
- **One dead field removed from the app's upload request** — a value the server now stamps itself and
  which the app could only ever have sent empty.
- **Gates, all run live:** `npx tsc --noEmit` **0** · `npm test` **1309 / 77 files** (was 1308, **+1**)
  · cache-free `npx eslint` **0 errors** on all three touched files (2 pre-existing warnings in
  `api.ts` untouched).

## Files changed

- `src/data/api.ts` — `recordFileAttachment` no longer sends `uploaded_by`, and the dead `uploadedBy`
  input is gone from `FileAttachmentInput`. Backend Phase 104 stamps that field from the token and
  ignores the body; on the *deployed* build the handler reads `b.uploaded_by || ''`, and no call site
  here ever set it — so omitting the key stores byte-identically to sending it, on **both** builds.
  The type now carries a warning explaining why adding it back would do nothing.
- `src/app/claim-new.tsx` — comment only. It explained a trade-off ("we chose not to thread the
  signed-in user down from the access-gate wrapper") that **no longer exists**; the server's value is
  now the trustworthy one. Phase-79 rule: a fix is not done while something still says the old thing.
- `src/data/__tests__/api-file-attachments.test.ts` — the whitelist pin drops to 9 keys, plus one new
  test asserting `uploaded_by` is **not** sent. Pinned separately on purpose: re-adding it is the
  tempting "fix" for a file that shows no uploader, and it would change nothing at all.
- `docs/OPS-SERVER-HANDOVER.md` — new **§11** (the deploy repairs team notifications); §5 strengthened
  with the code-level proof that `CORS_STRICT=true` cannot break the app; change log entry.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `CLAUDE.md` — the sweep is recorded as **recurring**, with
  the two rules it earned (below).
- `../contracts/INBOX.md` — two items filed: the dispatch bug, and a per-commit "nothing owed"
  verification so `cgpe-api` does not have to re-derive it. 831,630 → 839,917 bytes, `.bak-p89` taken
  first, both items greped back afterwards.

## Decisions made

- **The undeployed-commit sweep is a recurring step, not a task that completes.** It has returned a
  real finding on **both** of its two runs — Phase 87's found backend Phase 101, Phase 89's found the
  dispatch bug. Both were filed under commit messages that read as internal tidying.
- **When the finding is server-only, the deliverable is the report, not a code change.** Filed under
  the item that blocks, and written into `OPS-SERVER-HANDOVER.md` so the person who runs production
  reads it as a reason to deploy rather than as trivia.
- **Shipped the `uploaded_by` removal as part of the sweep rather than inventing a Phase 90.** It is
  four lines, provably inert on both builds, and it removes a misleading affordance a future session
  would otherwise wire up believing it worked.
- **Did NOT weaken the app's role gates on the strength of backend Phase 102.** That RBAC sweep widens
  `role !== 'admin'` to `!isAtLeast(role,'admin')`, and `ROLE_RANK` keeps `leader` at 2 below `admin`
  at 3 — so the documented leader-403 split our gates depend on is **preserved, not blurred**. Checked
  the rank table rather than trusting the word "sweep".

## Known broken / deliberately skipped

- 🔴 **Nothing in this phase reaches a phone, and neither does anything from Phases 80–88.** The field
  APK is still `093a3b33` (**25 Aug**); ~21 handsets are on it. The EAS free-plan quota resets
  **1 Sep 2026** — that build is now the single highest-value action in the project.
- **The dispatch bug is not fixed by us and cannot be.** It is repaired only by the backend merge to
  `origin/main` + a `:3001` restart. Until then, every team notification sent from the app is written
  and read by nobody. The owner should be told, because it is a live feature that does nothing.
- **The whole backend window is still unshipped** — `origin/main` is `990c660`, **29 commits** behind
  `origin/Shivam`, re-probed today. Storage (`cloudStorageConfigured:false`), presign (404) and the
  voice proxy (404) are all still off, so mobile Phases 86–89 and the entire voice track are inert.
- **Nothing from this phase has run on a handset**, and the one code change is unobservable by design.
- **Untracked repo-root files left alone** (`*.mp3`, `*.txt`, the staff JSON, the store spec,
  `.claude/settings.json`, `.gitignore`) — the owner's local files, unchanged from boot.

## Next session starts here

- **Phase 90: build the APK.** The quota resets 1 Sep; check it *before* promising one (a doomed
  attempt still costs a ~317 MB upload). It carries i18n Phases 80–85, the boundary-attribution fix,
  the version reconcile, the whole voice track, and Phases 86–89. Consider adding **EAS Update (OTA)**
  in the same build to end the rebuild-per-fix cycle.
- **First command:**
  `npx eas-cli build:list --platform android --limit 3 --json --non-interactive`
  (confirms the quota state and the newest build before spending twenty minutes on an upload)
- **Watch out for:** 🔴 **the Windows fingerprint trap** — if the build dies locally at "Computing
  project fingerprint" with an `UNKNOWN: unknown error` on a `react-native-reanimated` file, relaunch
  with `EAS_SKIP_AUTO_FINGERPRINT=1`; the code is fine. Second trap: **a session teardown kills the
  local "waiting for build" process but NOT the remote build** — on resume use `build:view <id>
  --json`, never a relaunch. Third: **Phase Ω must not be started** — device-unverified work exists,
  so that gate is shut.

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
