# CGPE Voice Assistant — n8n Developer Brief

**This document is only for the n8n developer. It describes the ONE n8n workflow to build — nothing else.**

You build a single webhook. It receives a short audio clip plus the signed-in user's login token,
turns it into text, understands it, reads the answer from the CGPE REST API **as that user**, speaks it
back, and returns a **fixed JSON shape** — always, in under 3 seconds.

---

## 0. What to send back (the deliverables)

1. The **production webhook URL** — e.g. `https://ai.cgpe.in/webhook/cgpe-voice`. HTTPS with a **valid** certificate (a self-signed cert fails silently on Android).
2. The **test/staging URL** (if different).
3. The **webhook secret** — a long random string the workflow checks on every call.
4. One **example response** (the §3 JSON) for the sentence *"aaj mere kitne task hai"*.
5. Confirmation of the **security rule** (§7): data is read/written ONLY via the CGPE REST API with the user's token — never MongoDB.
6. Confirmation of the **TTS fallback** (§5): ElevenLabs → Sarvam → text-only.

---

## 1. The webhook

| | |
|---|---|
| **Method** | `POST` |
| **URL** | you provide it. Pattern: `https://ai.cgpe.in/webhook/cgpe-voice` |
| **Auth** | the caller sends header `X-CGPE-Webhook-Secret`. Reject any call without the correct secret. |
| **Request body** | `multipart/form-data` (carries an audio file) |
| **Response body** | `application/json` |

> The request does not come from the phone directly — it comes from the CGPE server, which forwards
> the audio and adds the user's token in a header. You only deal with this one webhook.

---

## 2. What you RECEIVE (the request)

`multipart/form-data`:

| Field | Type | Meaning |
|---|---|---|
| `audio` | file | `.m4a` (AAC), mono, ~16 kHz, max 15 s / ~1 MB. |
| `lang` | text | `hi-IN` / `gu-IN` / `en-IN` / `auto`. Use as the STT language. |
| `session_id` | text | stable per conversation — for multi-turn memory. |
| `request_id` | uuid | **idempotency key.** Same id twice → return the first answer, do not reprocess. |
| `screen` | text | the screen the user is on, e.g. `/(tabs)/tasks`. Context. |
| `history` | JSON string | the last up-to-3 turns, text only. Context for follow-ups. |

Headers:

| Header | Meaning |
|---|---|
| `X-CGPE-Token` | **the signed-in user's JWT.** Use it to call the CGPE API (§7). |
| `X-CGPE-Request-Id` | same uuid, for tracing. |
| `X-CGPE-App-Version` | e.g. `1.11.0`. |
| `X-CGPE-Webhook-Secret` | the shared secret — reject if missing/wrong. |

Do **not** trust any role/user-id in the body as authority. The only authority is `X-CGPE-Token`.

---

## 3. What you MUST RETURN (the response)

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

| Field | Rule |
|---|---|
| `ok` | `true` on success, `false` on a handled failure (still HTTP 200). |
| `request_id` | echo back exactly. |
| `transcript` | **ALWAYS return it**, even on failure (empty string if STT failed). The app shows it. |
| `lang_detected` | `hi-IN` / `gu-IN` / `en-IN`. |
| `reply_text` | shown AND spoken; already in the user's language; **under 200 characters**. |
| `action.type` | `none` (answer) · `navigate` (move screen) · `confirm_write` (later). **v1: use only `none` and `navigate`.** |
| `action.route` | only for `navigate` — an **exact** route from §8. Unknown routes are rejected by the app. |
| `action.params` | for a route with an id: `{ "id": "abc123" }`. |
| `action.intentId` | a short, stable id for what was asked (e.g. `tasks.today.count`). Keep it consistent. |
| `audio.mode` | `url` (preferred) · `base64` · `none`. |
| `audio.url` | mp3 URL (reachable **without auth**, live ≥ 10 min) or the base64 string. |
| `audio.mime` | e.g. `audio/mpeg`. |
| `audio.fallback` | `true` **only** when both TTS engines failed and you return text with no audio (§5). Else `false`. |
| `confidence` | 0–1. Below **0.55** the app will not act — it shows the transcript and asks. |
| `error` | `null`, or `{ "code": "...", "message": "..." }`. Codes: `stt_failed`, `llm_failed`, `tts_failed`, `forbidden`, `unknown`. |

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

**The two rules that matter most:** never return an empty body, and never return a non-200 for a normal
failure — a "couldn't understand" is `200` + `ok:false` + a filled `error`.

---

## 4. Inside the workflow (the pipeline)

```
receive audio + X-CGPE-Token
  0. check X-CGPE-Webhook-Secret     → wrong/missing? 401, stop.
  1. STT   → Sarvam saaras:v3, mode=translit, language_code = <lang>   → transcript (Latin script)
  2. NLU   → Claude: transcript + the intent list → { intent_id, args, confidence }  (verb only)
  3. DATA  → call the CGPE REST API with the user's token (NEVER MongoDB):
             GET https://cgpe.in/internal/api/<endpoint>   Authorization: Bearer <X-CGPE-Token>
  4. ANSWER→ fill a fixed per-intent template with the data  (e.g. "Aaj aapke {n} kaam hai, {late} late hai.")
  5. TTS   → ElevenLabs → (out) Sarvam → (both out) audio.fallback:true   (see §5)
  6. RETURN the §3 JSON
```

Notes:
- **Step 1 — `mode=translit` is required.** It returns the transcript in **Latin letters**
  (`mera phone number hai...`), which the app's name-matching needs. Pass `language_code` from `lang`.
- **Step 2 — the model picks the verb, not the answer.** Send Claude the transcript + a short list of
  the allowed intents; get `{intent_id, args, confidence}`. Do **not** let the model write the spoken
  sentence or read a rupee amount — that is step 4, from real data. (No client PII goes to the LLM.)
- **Step 3 — this is where permissions live.** Calling the API with the user's token means every
  existing permission rule applies automatically (§7).
- **Step 4 — templates, one per intent, in the user's language.** Keep under 200 chars.
- **Multi-turn** — use `session_id` + `history` so "aur uska number?" works without re-naming the person.

---

## 5. TTS fallback chain (required)

Speak the answer in this order. **Never let a TTS failure fail the whole request.**

```
reply_text ready
  TRY 1  ElevenLabs (voice + model in §6)
           ok → audio.mode="url", url=<mp3>, fallback=false          ✅ done
           out of quota (401/402/429) / error / timeout ↓
  TRY 2  Sarvam Bulbul v3 (same text, matching language/voice)
           ok → audio.mode="url", url=<mp3>, fallback=false          ✅ done
           error / timeout ↓
  BOTH DOWN → return the real reply_text, audio.mode="none", audio.fallback=true
              (the APP plays its own bundled "service is briefly down" clip — you don't host it)
```

If STT or NLU itself failed (not just TTS), return `ok:false` with the right `error.code` instead.

---

## 6. Vendor settings

- **STT — Sarvam** `saaras:v3` (pin v3), `/speech-to-text`, `mode=translit`, India-hosted.
- **NLU — Claude** one call, transcript + intent list → `{intent_id, args, confidence}`. Cache the system prompt / tool list.
- **TTS primary — ElevenLabs** — use **Eleven v3** (v2 does NOT support Gujarati). Output `mp3_22050_32`
  (much smaller on weak networks). Voice id: the owner will give you one. Speed ~1.0–1.05, stability ~50–70.
- **TTS fallback — Sarvam Bulbul** `bulbul:v3`, native `gu-IN`/`hi-IN` voices.

All vendor API keys live **only in n8n's credential store** — never in git, never in a chat message.

---

## 7. Security — not optional

> For every data read (and later, write), call the CGPE REST API using the `X-CGPE-Token` you received
> — **never connect to MongoDB directly.**

n8n has full database credentials and can bypass every permission rule. Reading the DB directly would
let a junior member voice-pull the entire ~9,000-client book — a boundary the app deliberately locks.
Calling the API with the **user's own token** makes every permission apply for free. Also check the
`X-CGPE-Webhook-Secret` on every call.

---

## 8. Routes allowed in `action.route` (for `type:"navigate"`)

Use these spellings **exactly** — the app rejects anything else:

```
/(tabs)/home  /(tabs)/tasks  /(tabs)/claims  /(tabs)/search  /(tabs)/more
/(tabs)/leads  /(tabs)/clients
/attendance /calendar /reminders /notifications /notes /notice-board
/commissions /earnings /contests /kb /lic-plans /campaigns /prospects
/segments /families /analytics /agent-map /agent-track /monitor /performance
/payroll /team /whatsapp /tickets /settings /profile /account /notify /task-new
```

With an id (put it in `action.params.id`): `/client/[id]`, `/lead/[id]`, `/claim/[id]`, `/task/[id]`,
`/team/[id]`, `/tickets/[id]`, `/whatsapp/[id]`.

---

## 9. Timing & idempotency

- Target **≤ 3 s**, hard ceiling **8 s** (after that the app aborts to the transcript + a retry).
  Note: other sync n8n calls in this system take 15–40 s — the voice workflow must be built to a much
  tighter budget.
- Same `request_id` twice → return the first answer, do not act twice.

---

## 10. Test it with these

| Say | Expect back |
|---|---|
| "aaj mere kitne task hai" | `ok:true`, real count in `reply_text`, `type:"none"`, audio present |
| "attendance kholo" | `type:"navigate"`, `route:"/attendance"` |
| silence / noise | `ok:false`, `error.code:"stt_failed"`, `transcript:""` |
| a team member: "saare clients dikhao" | the API returns their permitted scope only — never the whole book |
| ElevenLabs quota exhausted | audio still returned via Sarvam, `fallback:false` |
| both TTS down | `reply_text` present, `audio.mode:"none"`, `fallback:true` |
| same `request_id` twice | the same answer both times, action done once |

---

## Appendix — the "service temporarily down" clip (record on ElevenLabs)

Not part of the workflow — this is a fixed clip the owner records once per language and the app bundles.
Provided here only so you have the copy in one place.

| Lang | Text |
|---|---|
| Hindi | अभी आवाज़ सेवा थोड़ी देर के लिए बंद है। जवाब स्क्रीन पर लिखा है — थोड़ी देर बाद फिर कोशिश कीजिए। |
| Hinglish | Abhi awaaz seva thodi der ke liye band hai. Jawab screen par likha hai — thodi der baad phir koshish kijiye. |
| Gujarati | અત્યારે વૉઇસ સેવા થોડી વાર માટે બંધ છે. જવાબ સ્ક્રીન પર લખેલો છે — થોડી વાર પછી ફરી પ્રયત્ન કરો. |
| Roman Gujarati | Atyare voice seva thodi vaar mate bandh chhe. Jawab screen par lakhelo chhe — thodi vaar pachhi fari prayatn karo. |
| English | The voice service is briefly unavailable. Your answer is shown on screen — please try again shortly. |
