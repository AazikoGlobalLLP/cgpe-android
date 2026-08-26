# Voice assistant — research + recommendation (2026-08-26)

**Owner ask:** "research and recommend a voice assistant" for CGPE Connect.
**Status:** research done; **no code written yet.** This is a recommendation + a set of decisions
the owner must lock before any build (voice is a big feature — it goes through spec-lock first).

Grounded against the real app (Expo SDK 57, RN 0.86, expo-router). Library/pricing facts are current
as of research; treat exact prices as directional, not contractual.

---

## 0. Top-line recommendation (the short version)

Build a **push-to-talk voice assistant** (a mic button the user taps and holds — NOT an always-listening
"Hey CGPE" wake word), that:

1. **Records** a short clip on the phone → sends it to **our own backend** (`cgpe.in`), which calls a
   cloud speech-to-text engine and returns the text. The audio is never stored.
2. **Understands** the text with a **two-layer** approach: a fast on-device keyword matcher for the
   ~10 most common commands (works offline, instant, free), and a **Claude** call on the backend for
   anything harder or code-mixed (Gujlish/Hinglish).
3. **Acts** by navigating the app or pre-filling a form — and **always asks the user to confirm before
   it writes anything** (never auto-creates a lead or auto-clocks-in from one sentence).
4. **Replies** mostly on screen (navigate + a toast + a haptic buzz); spoken replies only where a
   voice actually exists on the device.

**Recommended engines:** **Sarvam AI** for speech-to-text (best Gujarati + Hinglish, hosted in India,
~₹0.5/min), **Claude (Sonnet 5)** for the understanding layer, **expo-speech** for the few spoken
confirmations. **No wake word** — it's expensive, drains battery, and is a hard privacy story on top of
the 24/7 location tracking already running.

**Why this shape:** it matches what the app already is — Gujarati-first, used on weak rural networks,
DPDP-sensitive, with an existing consent system and an offline write-queue, and a Notes feature that
*already* transcribes Gujarati voice memos and always shows the user "this is what we heard, it may be
wrong." The assistant should inherit exactly that honesty.

---

## 1. What already exists in the app (so we don't rebuild it)

- **No in-app microphone / audio / speech today.** No `expo-av`/`expo-audio`, no `RECORD_AUDIO`
  permission. Adding voice is genuinely from-scratch on the phone side.
- **A "voice note" feature already exists — but it's server-side.** In Notes, WhatsApp voice memos are
  transcribed by n8n (usually from Gujarati) and shown with the raw transcript beside the cleaned text,
  labelled *"As dictated on WhatsApp"* because the transcription can be wrong. **This is the design
  precedent to copy:** show what was heard, confirm before acting.
- **Consent system (Phase 41):** a mandatory, versioned, DPDP-style consent gate already exists for
  24/7 location (`src/app/consent.tsx`). A microphone / audio-to-cloud consent screen should be a
  near-copy — versioned constant, owner-supplied copy in all 5 languages, honest "you can't continue"
  decline state.
- **Offline write-queue (Phase 57):** additive creates (notes, tasks, leads) already queue when the
  network is down and flush on reconnect. Any voice-created lead/task should ride this same queue.
- **5 languages, 3 scripts** (English, Gujarati, Hindi, Hinglish, Roman-Gujarati). Human copy is
  load-bearing; machine translation is forbidden. Any keyword tables / spoken strings need owner copy
  in all five, same as every other string.
- **RBAC is real and matters for voice:** the client book is master/admin-only. A team-tier user must
  never be voice-navigated into Clients/Segments/Families. Voice dispatch must run through the **same**
  role gates as the tab bar (`canViewClients`, `capabilitiesOf`).
- **Custom native modules are allowed** (`expo-dev-client` is installed) — but there is **no OTA**
  (`expo-updates` isn't set up), so anything touching native (a microphone) needs a **full APK
  rebuild**. See §7.

---

## 2. Speech-to-Text (STT) — the engine that hears

**Recommendation: cloud STT via Sarvam AI, called through our backend** (not the phone calling Sarvam
directly — the key stays server-side, the data path stays DPDP-controlled, and we can swap providers
without an app update).

| Engine | Gujarati | Hinglish/code-mix | ~Price | Hosted | Verdict |
|---|---|---|---|---|---|
| **Sarvam AI** (Saarika) | **Yes** | **Yes — explicit code-switching** | **~₹0.5/min** | **India** (ISO 27001, SOC 2, DPDP) | **Recommended.** Best Gujarati + code-mix + residency + price. |
| Bhashini / ULCA (Govt of India) | Yes | Varies | Free for PoC; commercial = contact them | India | **Sovereign fallback** if cost/gov-hosting is a hard rule; weaker SLA/latency. |
| Google Cloud STT | Yes | No | ~$0.016/min | US (region-configurable) | Solid but data leaves India; pricier. |
| OpenAI Whisper / gpt-4o-transcribe | Weak on Gujarati | No | ~$0.006/min | US | **Weak on short Gujarati commands** — poor fit. |
| Deepgram | **No Gujarati** | Hindi only | — | US | **Drop.** |
| On-device (Android `SpeechRecognizer` / `expo-speech-recognition`) | **Inconsistent/absent** on low-end phones; Gujarati offline not guaranteed | Poor | Free | On-device | Great for privacy/offline, but **can't be trusted for Gujarati across a fleet.** Keep as a v2 Hindi/English-only offline fallback. |

**The #1 risk lives here: Gujarati STT accuracy** on rural accents + field noise. Sarvam is the best
available but still imperfect. Mitigation = the app's own rule: **show the transcript, confirm before
acting.**

---

## 3. Text-to-Speech (TTS) — the voice that replies

Most replies should be **visual** (navigate + toast + haptic), which sidesteps the Gujarati-voice gap
entirely. Where we do speak:

- **Start with `expo-speech`** (free, offline, on-device) for short **Hindi/English** confirmations,
  and **feature-detect Gujarati** — if the phone has no `gu-IN` voice, show text instead of speaking.
- **Add Sarvam Bulbul TTS** later only if natural spoken Gujarati becomes a real requirement (keeps
  everything on one India-hosted vendor).

---

## 4. Wake word / always-listening — **recommend against (for now)**

Technically possible (Picovoice Porcupine, on-device), but a bad fit here:

- **Cost:** Picovoice's free tier is 3 monthly users; a whole team = undisclosed enterprise pricing.
- **Battery + reliability:** always-listening needs a second persistent microphone foreground service
  **on top of** the heavy 24/7 location service already running — worse battery drain and OEM-kill
  fragility.
- **Privacy:** an always-on mic *plus* 24/7 location is a hard trust/DPDP story for field staff.
- Its on-device intent engine doesn't support Gujarati/Hindi anyway.

**Use push-to-talk** (a visible mic button). Cheaper, more private, kinder to the battery, and clearer
for non-technical users — they can *see* when it's listening.

---

## 5. Understanding the command (NLU)

Turn a transcript like *"aaj mere kitne tasks hai"* or *"naya lead add karo, Ramesh, 98…"* into a
structured action. **Recommended: a hybrid.**

- **Layer 1 — on-device keyword fast-path** for the top ~10 nav/query commands. Instant, offline,
  free. Owner-supplied keyword lists per language (same discipline as i18n).
- **Layer 2 — Claude on the backend** when the fast-path is unsure *and* the network is up. Claude
  reads code-mixed Gujlish/Hinglish natively and extracts entities (name, phone, date). The backend
  endpoint takes `{transcript, uiLang, userRole}` and returns a **constrained intent schema** via
  strict tool-calling — never free text.
  - **Model:** **`claude-sonnet-5`** (strong multilingual, cheap at $2 / $10 per 1M tokens) with
    `strict: true` structured outputs. Evaluate **`claude-haiku-4-5`** ($1 / $5) to cut cost if quality
    holds; reserve a bigger model only for hard cases. (Utterances are tiny, so per-call cost is
    fractions of a paisa; the real cost driver is call volume.)

**Candidate intents (grounded in the app's real routes):**
- *Navigate* (role-gated): tasks, home, leads, claims, attendance, reminders, calendar, notifications,
  whatsapp, more; **clients/earnings/payroll gated** — refuse politely for team tier, don't show a blank
  guarded screen.
- *Query (read):* today's task count, overdue, reminders today, my earnings.
- *Act (write — always confirm, always via the offline queue):* create lead, create task, dictate a
  note, clock-in/out/break (**must route into the existing geofence + reason UI, never bypass it**),
  global search, call/WhatsApp a contact.

**Hard rules:** RBAC-aware dispatch; confirm before every write; always show the transcript;
low-confidence → fall back to the search screen with the raw text, never guess a destructive action.

---

## 6. Phased rollout

**v0 — command-only (prove the loop). ~1.5–2.5 weeks.**
- Push-to-talk mic on Home/search; record with **`expo-audio`** (SDK 57's module — `expo-av` is gone).
- New thin backend endpoint `POST /voice/transcribe` → Sarvam → returns text; audio discarded.
- Keyword NLU (5-lang tables) for ~10 nav + 2–3 read intents, dispatched through RBAC. **No writes.**
- Visual responses + optional `expo-speech` Hindi/English confirmation.
- New **microphone consent screen** (copied from `consent.tsx`, 5-lang copy).
- **Needs a new native APK** (microphone permission + `expo-audio`).

**v1 — understanding + safe writes. ~2–3 weeks.**
- Backend Claude NLU fallback (`/voice/interpret`) for code-mix + entity extraction.
- Voice create-lead / create-task / dictate-note with a mandatory confirm step, riding the offline
  write-queue. Optional Sarvam Bulbul TTS.
- Mostly JS + backend (still needs a rebuild — no OTA).

**v2 — reach + resilience (optional).**
- On-device Hindi/English STT as a nav-only offline fallback; streaming STT for lower latency; more
  workflows. Wake word only if a concrete hands-free need is proven and budgeted.

**Weak-network behaviour (explicit):** cloud STT needs a connection. On a dead network, voice capture is
**disabled with an honest message** ("voice needs a connection") and the user types instead (which
already queues). Never fabricate a transcript — same discipline as the app's `unavailable()` path.

---

## 7. Cost + the OTA point

- **Per-use cost is small:** ~₹0.5/min STT + a fraction of a paisa per Claude call. The driver is
  *team × commands/day*; the keyword fast-path keeps most commands free.
- **Strong recommendation:** because voice forces a native rebuild anyway, **add EAS Update
  (`expo-updates`) in the same build.** After that, keyword/NLU tuning and most JS fixes ship
  over-the-air with no rebuild — ending the current "every fix = new APK" cycle the owner dislikes.

---

## 8. Honest limitations

1. **Gujarati STT will misfire** in noisy field conditions — the transcript-and-confirm rule is the
   safety net, not perfect accuracy.
2. **Code-mixed Latin-script speech** is handled well only by Sarvam + the Claude layer; generic
   engines don't.
3. **Voice is effectively an online feature** in v0/v1; true offline needs on-device models (weak for
   Gujarati). Offline = fall back to typing.
4. **Privacy/DPDP:** audio is personal data. Prefer India-hosted engines, route through our backend,
   keep audio ephemeral, gate behind versioned consent.
5. **Battery:** push-to-talk avoids stacking a second always-on service on the existing location one.

---

## 9. Decisions the owner must make before we build (spec-lock inputs)

1. **Scope of v0** — is a *command/navigation* assistant ("open my tasks", "search Ramesh", "how many
   tasks today") the right first cut, or do you want *dictation-to-create* (make a lead/task by voice)
   from day one? (I recommend command-only first.)
2. **Which languages at launch** — all 5, or start with Gujarati + Hindi + Hinglish?
3. **STT engine** — Sarvam (recommended) vs Bhashini (free/government-hosted) vs Google. Any hard rule
   that data must stay in India? (Yes → Sarvam or Bhashini.)
4. **Spoken replies or screen-only** for v0? (Recommend screen-only + optional Hindi/English speech.)
5. **Budget comfort** — a rough monthly ceiling for STT/LLM usage so we size the fast-path vs cloud
   split.
6. **Confirm-before-write** — confirmed as mandatory for every voice-created record? (Strongly
   recommended.)
7. **Bundle EAS Update** into the voice build to end rebuild-per-fix? (Recommended yes.)

Once these are answered, the next step is a spec-lock (`/spec-lock`) that pins exact intents, copy,
confirm-flows, and acceptance criteria — then a build.
