# CGPE Voice Assistant — n8n Workflow Build Spec

**For:** the n8n developer · **From:** the mobile app team (`cgpe-mobile`) · **Date:** 2026-08-29
**Status:** build-ready contract. Everything below is verified against the real app + backend code.

> **One-line summary:** Build ONE n8n workflow that receives a short audio clip + the user's login
> token, turns it into speech-to-text → understands it → (if it's a question) reads the answer from
> our normal API using **that user's token** → speaks the answer back, and returns a **fixed JSON
> shape**. The hard rules are: (1) always return that JSON, never an empty body; (2) never touch the
> database directly — only our REST API with the user's token; (3) answer in ≤ 3 seconds.

---

## 0. What I need back from you (the whole point of this document)

Send me these **six things** and the app can go live:

| # | Item | Notes |
|---|---|---|
| 1 | **The production webhook URL** | e.g. `https://ai.cgpe.in/webhook/cgpe-voice`. **Not** the WhatsApp one. HTTPS with a **valid** certificate (a self-signed cert fails silently on Android). |
| 2 | **The test/staging webhook URL** | if different, so I can test without touching production. |
| 3 | **The webhook secret** | a long random string the workflow checks on every call (so the webhook isn't open to the whole internet). I put it on our server only, never in the app. |
| 4 | **Confirmation it returns the exact JSON in §4** | one working example response for the sentence *"aaj mere kitne task hai"*. |
| 5 | **Confirmation of the security rule in §8** | the workflow reads/writes data ONLY through our REST API with the user's token — never MongoDB directly. |
| 6 | **Confirmation of the TTS fallback in §6** | ElevenLabs first, Sarvam if ElevenLabs is out, and the "both down" behaviour. |

That's it. Everything else in this document exists so you can produce those six with no back-and-forth.

---

## 1. The big picture

```
  PHONE (the app)                OUR SERVER (cgpe.in)             YOUR n8n workflow            VENDORS
  ───────────────                ────────────────────             ─────────────────            ───────
 ┌────────────────┐
 │ user holds a   │
 │ button, speaks │
 │ ~6 s of audio  │
 └───────┬────────┘
         │ POST /api/voice/ask
         │ (multipart: the audio + a few fields)
         │ Authorization: <the user's login token>
         ▼
                    ┌──────────────────────────┐
                    │ thin proxy (we build it): │  ── attaches the webhook secret ──►  ┌─────────────────┐
                    │ checks the login token,   │                                      │  YOUR WEBHOOK   │
                    │ forwards audio + the       │  ◄──────── your JSON reply ──────────│  cgpe-voice     │
                    │ user's token to your n8n  │                                      └────────┬────────┘
                    └───────────┬──────────────┘                                                │
         ◄──────────────────────┘  (relays your JSON back to the phone)                          │
                                                                                                 ▼
                                            1. Speech-to-text  ───────────────────────────►  SARVAM  (STT)
                                            2. Understand it   ───────────────────────────►  CLAUDE  (NLU)
                                            3. Read the answer ──► OUR REST API (with the user's token)
                                            4. Text-to-speech  ───────────────────────────►  ELEVENLABS → SARVAM (TTS)
                                            5. Build the JSON reply and return it
```

**Two pieces are built by two different people:**
- **The thin proxy** on `cgpe.in` (`POST /api/voice/ask`) — **our backend team builds this** (see §11). Its only job is to check the user's login token, attach your webhook secret, and forward the audio to you. You do **not** build this.
- **The n8n workflow** — **you build this.** It's everything in §5. This document is mostly about it.

**Why a proxy in the middle?** So your webhook URL and secret never ship inside the phone app (where anyone could extract them), and so the phone only ever talks to `cgpe.in`, which it already trusts.

---

## 2. The webhook

| | |
|---|---|
| **Method** | `POST` |
| **URL** | you give it to me (item 1). Pattern: `https://ai.cgpe.in/webhook/cgpe-voice` |
| **Auth** | our proxy sends header `X-CGPE-Webhook-Secret: <the secret you give me>`. Reject any call without it. |
| **Content-Type of the request** | `multipart/form-data` (it carries an audio file) |
| **Content-Type of your reply** | `application/json` |

> ⚠️ **Add a dedicated env var, don't reuse an existing webhook.** Our backend registry
> (`config/webhooks.js`) has slots for `whatsapp, hub, campaign, claim, chat, email, report,
> escalation, attendance, generic` — **there is no `voice` slot yet.** Our backend team will add
> `N8N_VOICE_WEBHOOK_URL`. Do **not** route voice through the existing `cgpe-whatsapp` workflow — it
> has a completely different job and (verified in our code, `routes/assistant.js:7-8`) it **returns an
> empty body today**, which is exactly the failure this workflow must avoid.

---

## 3. What your workflow RECEIVES (the request)

`multipart/form-data` with these fields:

| Field | Type | Meaning |
|---|---|---|
| `audio` | file | `.m4a` (AAC), mono, ~16 kHz, **max 15 s / ~1 MB**. The phone already caps this. |
| `lang` | text | one of `hi-IN`, `gu-IN`, `en-IN`, or `auto`. The user's app language. Use it as the STT language. |
| `session_id` | text | stable per conversation. Use it to remember the last turn (multi-turn). |
| `request_id` | text (uuid) | **idempotency key.** If you ever see the same `request_id` twice, return the FIRST answer again — do not process it twice. This prevents a double action. |
| `screen` | text | the screen the user is on, e.g. `/(tabs)/tasks`. Context for the model. |
| `history` | JSON text | the last up-to-3 turns, **text only**. Context for multi-turn ("aur uska number?"). |

**Headers your workflow receives (from our proxy):**

| Header | Meaning |
|---|---|
| `X-CGPE-Token` | **the signed-in user's login token (JWT).** This is the key to everything: use it to call our REST API so the answer is scoped to who is actually asking. See §8. |
| `X-CGPE-Request-Id` | same uuid as `request_id`, for tracing. |
| `X-CGPE-App-Version` | e.g. `1.11.0`. So you can branch on old app versions if ever needed. |
| `X-CGPE-Webhook-Secret` | the shared secret. Reject the call if it's missing or wrong. |

> Do **not** trust any "role" or "user id" you might find in the body as an authority — the only
> authority is the `X-CGPE-Token`. Our REST API reads the real identity out of that token.

---

## 4. What your workflow MUST RETURN (the reply) — the most important section

**Always HTTP 200. Always this exact JSON. Never an empty body. Never a non-200 for a normal failure.**

```json
{
  "ok": true,
  "request_id": "the same uuid you received",
  "transcript": "aaj mere kitne task hai",
  "lang_detected": "hi-IN",
  "reply_text": "Aaj aapke 4 kaam hai, 1 late hai.",
  "action": {
    "type": "none",
    "route": null,
    "params": {},
    "intentId": "tasks.today.count",
    "args": {},
    "confirm": null
  },
  "audio": { "mode": "url", "url": "https://.../reply.mp3", "mime": "audio/mpeg", "fallback": false },
  "confidence": 0.93,
  "error": null
}
```

**Field-by-field rules:**

| Field | Rule |
|---|---|
| `ok` | `true` on success, `false` on a handled failure (still HTTP 200 — see the failure block below). |
| `request_id` | echo back exactly what you received. |
| `transcript` | **ALWAYS return it, even on failure.** The app shows it on screen so the user sees what was heard. If STT failed, return `""`. |
| `lang_detected` | `hi-IN` / `gu-IN` / `en-IN`. |
| `reply_text` | the sentence to **show on screen AND speak**. Already in the user's language. **Keep it under 200 characters.** This is the answer — get the numbers right (see §5 step 4). |
| `action.type` | `none` (just an answer) · `navigate` (the app moves to a screen) · `confirm_write` (the app shows a confirm card first). **For v1, use only `none` and `navigate`** — see §10. |
| `action.route` | ONLY for `type:"navigate"`. Must be one of the exact routes in §10.1. The app **rejects an unknown route** rather than guess, so use the exact spelling. |
| `action.params` | for a route with an id, e.g. `{ "id": "abc123" }` for `/client/[id]`. |
| `action.intentId` | a short stable id for what the user asked, e.g. `tasks.today.count`. Informational; keep it consistent. |
| `action.confirm` | only for `confirm_write` (v2). Shape: `{ "title": "...", "rows": [{"label":"Name","value":"Ramesh"}], "confirmText": "Haan, save karo" }`. |
| `audio.mode` | `url` **(preferred)** / `base64` / `none`. A URL keeps the reply small on weak networks. |
| `audio.url` | the mp3 URL (for `mode:"url"`) or the base64 string (for `mode:"base64"`). Must be reachable **without auth** and live for **at least 10 minutes**. |
| `audio.mime` | e.g. `audio/mpeg`. |
| `audio.fallback` | `true` **only** when BOTH TTS engines failed and you're returning text with no audio — see §6. Otherwise `false`. |
| `confidence` | 0–1. How sure the understanding is. **Below 0.55 the app will not act** — it just shows the transcript and asks. |
| `error` | `null` on success. On failure: `{ "code": "...", "message": "..." }`. Codes: `stt_failed`, `llm_failed`, `tts_failed`, `forbidden`, `unknown`. |

**Failure reply (still HTTP 200):**

```json
{
  "ok": false,
  "request_id": "…",
  "transcript": "aaj mere kitne task hai",
  "reply_text": "",
  "action": { "type": "none", "route": null, "params": {}, "intentId": null, "args": {}, "confirm": null },
  "audio": { "mode": "none", "url": null, "mime": null, "fallback": false },
  "confidence": 0,
  "error": { "code": "stt_failed", "message": "Could not understand the audio." }
}
```

> **The two rules that matter most:** (a) **never return an empty body** — the app treats that as the
> service being down; (b) **a non-200 status = the app treats it as an outage.** So a normal "couldn't
> understand" is `HTTP 200` + `ok:false` + a filled `error`, **not** an HTTP 500.

---

## 5. What happens inside the workflow (step by step)

```
receive audio + X-CGPE-Token
   │
   ├─ 0. check X-CGPE-Webhook-Secret → wrong/missing? 401, stop.
   │
   ├─ 1. STT  ─────►  Sarvam saaras:v3, mode=translit, language_code = <lang>
   │                  → transcript (in Latin script — see the note below)
   │
   ├─ 2. NLU  ─────►  Claude: transcript + the small tool list → { intent_id, args, confidence }
   │                  (the model picks the VERB ONLY; it does NOT write the answer or see client data)
   │
   ├─ 3. DATA ─────►  call OUR REST API with the user's token (NEVER MongoDB):
   │                  GET https://cgpe.in/internal/api/<the endpoint for that intent>
   │                  Authorization: Bearer <X-CGPE-Token>
   │
   ├─ 4. ANSWER ───►  build reply_text from a fixed per-intent template + the data
   │                  (e.g. "Aaj aapke {n} kaam hai, {late} late hai.")  ← the numbers come from step 3
   │
   ├─ 5. TTS  ─────►  ElevenLabs → (if out) Sarvam → (if both out) audio.fallback:true  (see §6)
   │
   └─ 6. RETURN the §4 JSON
```

**Notes that will save you time:**

- **Step 1 — use `mode=translit`.** Sarvam's `translit` mode returns the transcript in **Latin
  letters** (`mera phone number hai...`) instead of Devanagari/Gujarati script. This is **required**,
  because our staff names are all stored in Latin letters and our name-matching breaks on native
  script. Pass `language_code` from the `lang` field (`hi`/`hi-en` → `hi-IN`, `gu`/`gu-en` → `gu-IN`).
- **Step 2 — the model picks the verb, not the answer.** Send Claude the transcript + a short list of
  the allowed intents; get back `{intent_id, args, confidence}`. **Do not** let the model write the
  spoken sentence or read a rupee amount — that's step 4, from real data, so a wrong number is
  impossible. This also means **no client name / phone / amount is ever sent to the LLM.**
- **Step 3 — this is where the money/permissions live.** Because you call our REST API with the
  user's own token, every permission rule we already enforce applies for free: a team member simply
  cannot pull the whole client book, an admin can, etc. **This is non-negotiable — see §8.**
- **Step 4 — templates, one per intent, in all the user's languages.** Keep them under 200 chars.
- **Multi-turn:** use `session_id` + `history` so "aur uska number?" works without re-naming the
  person. Keep it simple: remember the last person the user asked about, for a couple of minutes.

---

## 6. The TTS fallback chain (owner requirement)

Speak the answer with this order of preference. **Never let a TTS failure fail the whole request** —
the user should always at least get the text answer, and some audio.

```
   reply_text ready
       │
       ├─ TRY 1:  ElevenLabs  (voice + model in §7)
       │            success → audio.mode="url", audio.url=<mp3>, audio.fallback=false   ✅ done
       │            out of quota / error / timeout ↓
       │
       ├─ TRY 2:  Sarvam Bulbul v3  (same text, matching language/voice)
       │            success → audio.mode="url", audio.url=<mp3>, audio.fallback=false   ✅ done
       │            error / timeout ↓
       │
       └─ BOTH DOWN:  return the real reply_text (so the screen still shows the answer),
                      audio.mode="none",  audio.fallback=true
                      → the APP then plays a short pre-recorded "service is temporarily down" clip
                        that is BUNDLED IN THE APP (so it works even if your workflow is unreachable).
```

- **You handle Try 1 → Try 2** (ElevenLabs → Sarvam). This is the automatic failover the owner asked
  for: when the ElevenLabs monthly quota is exhausted (HTTP `401`/`402`/`429`) or it errors, switch to
  Sarvam with no user impact.
- **The "both down" clip is on the app side, not yours** — it's a fixed message ("voice is briefly
  down, please read the answer on screen") that the app carries inside itself, so it plays even if
  n8n or the network is down. You only need to **set `audio.fallback:true` and `audio.mode:"none"`**
  and still return the real `reply_text`. (The message text the owner will record is in Appendix A.)
- If STT or NLU itself failed (not just TTS), return `ok:false` with the right `error.code` — the app
  handles that separately.

---

## 7. Vendor settings

### 7.1 STT — Sarvam
- Model **`saaras:v3`** (pin v3 explicitly), endpoint `/speech-to-text`, **`mode=translit`**.
- `language_code` from `lang`. Sarvam is India-hosted (data stays in India — good for us).

### 7.2 NLU — Claude
- One call, transcript + the intent list → `{intent_id, args, confidence}`. Verb only.
- Cache the system prompt / tool list (it's the same every call) to keep it fast and cheap.

### 7.3 TTS — ElevenLabs (primary)
Your current settings (from the owner's screenshots) and my recommendation for a **mobile app on
rural 4G**:

| Setting | Owner's screenshot | Recommended for this app | Why |
|---|---|---|---|
| **Voice** | Devi / Liam / Viraj (still being chosen) | **owner locks ONE `voice_id`** | ears decision; send me the id string |
| **Model** | Multilingual v2 (v3 in the recordings) | **Eleven v3** | **v2 does NOT support Gujarati; v3 does.** Decisive for a Gujarati team. |
| **Output format** | MP3 44.1 kHz 128 kbps | **`mp3_22050_32`** | ~4× smaller — much faster on weak networks; quality is fine for speech |
| Speed | 1.07–1.13 | ~1.0–1.05 | very fast speech is harder to follow for non-native listeners |
| Stability | high / 100 | ~50–70 | max stability can sound flat/robotic |
| Speaker boost | on | on | fine |

> ⚠️ **ElevenLabs has NO native Gujarati voices** (the owner's screenshot search returned "No voices
> found" for Gujarati). Devi/Liam/Viraj are Hindi/English voices. With v3 they *can speak Gujarati
> text*, but with a non-Gujarati accent. The owner has accepted this for now; a blind listening test
> against Sarvam Bulbul's native Gujarati voices is still worth doing before locking it.

### 7.4 TTS — Sarvam Bulbul (fallback)
- Model **`bulbul:v3`**, matching `gu-IN`/`hi-IN` voice. India-hosted, native Indian voices.

> **Both vendors' API keys live ONLY in n8n's credential store** — never in the app, never in git,
> never in a chat message. If the ElevenLabs key was ever pasted somewhere, **regenerate it.**

---

## 8. Security — the one non-negotiable rule

> **For every data read (and later, write), call our REST API using the `X-CGPE-Token` you received —
> NEVER connect to MongoDB directly.**

Why this is not optional: n8n has full database credentials and can bypass every permission rule the
app enforces. If voice read the database directly, a junior team member could say *"show me all
clients"* and pull the entire ~9,000-person book — a boundary we deliberately lock. Calling
`https://cgpe.in/internal/api/...` with the **user's own token** makes every existing permission apply
automatically, and costs you nothing extra in n8n.

Also: check the `X-CGPE-Webhook-Secret` on every call and reject anything without it.

---

## 9. Idempotency, timing, errors

- **Idempotency:** if the same `request_id` arrives twice, return the first answer — don't redo it.
- **Timing:** target **≤ 3 seconds**, hard ceiling **8 seconds** (after that the app gives up and shows
  the transcript with a retry). ⚠️ Note: our existing synchronous n8n calls take **15–40 s**
  (`N8N_PDF_TIMEOUT_MS` defaults to 120000) — **the voice workflow must be built to a much tighter
  budget than those.** Streaming STT and starting TTS early both help.
- **Errors:** always HTTP 200 + `ok:false` + `error.code` (`stt_failed`/`llm_failed`/`tts_failed`/
  `forbidden`/`unknown`). Never an empty body, never a raw 500 for a normal failure.

---

## 10. v1 scope — keep it small and safe

**v1 = questions and navigation only.** That covers most of the value with almost none of the risk:

- **`type:"none"`** — spoken/written answers: *how many tasks today, what's overdue, my commission this
  month, my attendance, how many leads, unread notifications, someone's phone number,* etc.
- **`type:"navigate"`** — "open attendance", "show WhatsApp", "go to tasks" → the app moves screen.

**Writes (create a task, clock in, etc.) are v2** and are handled specially by the app (they run the
app's own confirm + safety flows, e.g. clock-in must run the geofence check). So **do not emit
`confirm_write` in v1** — just answer or navigate. The `confirm_write` shape is documented in §4 only
so you can build the workflow once and grow into it.

### 10.1 The exact routes you may put in `action.route`

Use these spellings **exactly** (the app rejects anything else):

```
/(tabs)/home   /(tabs)/tasks   /(tabs)/claims   /(tabs)/search   /(tabs)/more
/(tabs)/leads  /(tabs)/clients
/attendance  /calendar  /reminders  /notifications  /notes  /notice-board
/commissions  /earnings  /contests  /kb  /lic-plans  /campaigns  /prospects
/segments  /families  /analytics  /agent-map  /agent-track  /monitor  /performance
/payroll  /team  /whatsapp  /tickets  /settings  /profile  /account  /notify  /task-new
```

With an id: `/client/[id]`, `/lead/[id]`, `/claim/[id]`, `/task/[id]`, `/team/[id]`,
`/tickets/[id]`, `/whatsapp/[id]` — put the id in `action.params.id`.

---

## 11. The Express proxy (our backend team builds this — here so you see the whole chain)

A small route `POST /api/voice/ask` on `cgpe.in` that:
1. Validates the user's login token (`protect`), so only signed-in users can use voice.
2. Reads `N8N_VOICE_WEBHOOK_URL` from the server `.env` (never hardcoded).
3. Forwards the multipart audio + fields to your webhook, adding `X-CGPE-Token` (the user's JWT) and
   `X-CGPE-Webhook-Secret`.
4. Relays your JSON straight back to the app, with an **8-second timeout**.

We'll file this to our backend team. You don't build it — but it's why your workflow receives the
user's token in a header.

---

## 12. How we'll both know it works (test cases)

| Say | Expect back |
|---|---|
| "aaj mere kitne task hai" | `ok:true`, `reply_text` with the real count from the API, `action.type:"none"`, audio present |
| "attendance kholo" | `action.type:"navigate"`, `action.route:"/attendance"` |
| (silence / noise) | `ok:false`, `error.code:"stt_failed"`, `transcript:""` |
| a team member: "saare clients dikhao" | the API returns their permitted scope only — voice must NOT expose the whole book |
| ElevenLabs quota exhausted | audio still returned, via Sarvam, `audio.fallback:false` |
| both TTS down | `reply_text` present, `audio.mode:"none"`, `audio.fallback:true` |
| same `request_id` twice | the same answer both times, action done once |

---

## Appendix A — the "service temporarily down" message (owner to record on ElevenLabs)

This is the short clip the **app** plays when both TTS engines are down. Record it once per language
on ElevenLabs (the chosen voice) and send me the files; the app bundles them. It should tell the user
the voice service is briefly down and to read the answer on screen / try again shortly.

| Lang | Text to record |
|---|---|
| **Hindi (hi)** | "अभी आवाज़ सेवा थोड़ी देर के लिए बंद है। जवाब स्क्रीन पर लिखा है — थोड़ी देर बाद फिर कोशिश कीजिए।" |
| **Hinglish (hi-en)** | "Abhi awaaz seva thodi der ke liye band hai. Jawab screen par likha hai — thodi der baad phir koshish kijiye." |
| **Gujarati (gu)** | "અત્યારે વૉઇસ સેવા થોડી વાર માટે બંધ છે. જવાબ સ્ક્રીન પર લખેલો છે — થોડી વાર પછી ફરી પ્રયત્ન કરો." |
| **Roman Gujarati (gu-en)** | "Atyare voice seva thodi vaar mate bandh chhe. Jawab screen par lakhelo chhe — thodi vaar pachhi fari prayatn karo." |
| **English (en)** | "The voice service is briefly unavailable. Your answer is shown on screen — please try again shortly." |

*(These are provisional translations by the app team; a native reader should confirm the Gujarati/Hindi
before recording, per the app's translation policy.)*

---

## Appendix B — the whole thing in one paragraph (for a quick read)

Build one n8n webhook at `https://ai.cgpe.in/webhook/cgpe-voice`. It receives a short `.m4a` clip plus
the user's login token in the `X-CGPE-Token` header. It runs Sarvam speech-to-text (`saaras:v3`,
`mode=translit`), asks Claude which command it is (verb only), reads the answer from our REST API
**using that user's token** (never MongoDB), fills a fixed sentence template, and speaks it with
ElevenLabs — falling back to Sarvam if ElevenLabs is out, and to a text-only reply (`audio.fallback:
true`) if both are down. It always returns HTTP 200 with the exact JSON in §4, in under 3 seconds,
and never an empty body. Send me the URL, the test URL, and the webhook secret, and confirm the
security rule and the fallback behaviour.
