# CGPE Voice — Backend proxy brief (connects the app to the LIVE n8n brain)

**For:** the CGPE backend developer · **Date:** 2026-08-29 · **Status:** the n8n brain is LIVE; this is
the one backend endpoint left to build.

The n8n "voice brain" is built and live. It is a **pure text brain**: text in → text + action out. The
**backend** does everything around it — the mic audio, speech-to-text (STT), and text-to-speech (TTS) —
and calls the brain in the middle. The **app** already records audio and expects the reply below; you
build the **one proxy endpoint** that ties them together.

---

## The flow

```
 APP  ──POST /api/voice/ask (multipart: audio + the user's JWT)──▶  BACKEND
                                                                     1. STT (Sarvam)   audio → transcript
                                                                     2. POST the brain { transcript, authToken: JWT }
                                                                                        ◀── { success, reply_text, action }
                                                                     3. TTS (ElevenLabs→Sarvam)  reply_text → mp3
                                                                     4. return the JSON below
        ◀──────────── { ok, transcript, reply_text, audio, action } ─────────────
 APP: shows transcript + reply, plays audio, navigates on action
```

---

## 1. The endpoint you build: `POST /api/voice/ask`

- Protect it with the normal `protect` middleware (only signed-in users; you get `req.user` + the JWT).
- **Request from the app** — `multipart/form-data`:
  | field | meaning |
  |---|---|
  | `audio` | `.m4a` (AAC), mono, ~15 s max. Run STT on this. |
  | `lang` | `hi-IN` / `gu-IN` / `en-IN` / `auto` — the STT language. |
  | `session_id` | stable per conversation (optional to use). |
  | `request_id` | uuid — **use it for idempotency** (same id twice → return the first result; don't re-run STT/brain/TTS). |
  | `screen`, `history` | context (optional to forward). |
  - The user's JWT arrives as `Authorization: Bearer <jwt>` (and also header `X-CGPE-Token`). **This is
    the token you forward to the brain** (see §3).

---

## 2. Step 1 — Speech-to-text (Sarvam)

- Sarvam `saaras:v3`, `mode=translit` (returns Latin script — required), `/speech-to-text`,
  `language_code` from `lang`. → `transcript` (a plain string).
- If STT fails: skip the brain and return the failure shape (§5) with `reply_text` = a short "could not
  hear you" line so the app can speak it.
- Key: `SARVAM_API_KEY` in the server `.env`.

---

## 3. Step 2 — Call the LIVE brain (verbatim contract from the n8n dev)

```
POST https://ai.cgpe.in/webhook/cgpe-voice-brain
Headers:
  Content-Type: application/json
  X-CGPE-Webhook-Secret: <the vbk_… secret — put it in the server .env, NEVER in the app>
Body:
  { "transcript": "<from STT>", "authToken": "<the SAME user JWT the app sent>" }
```

**Response (always HTTP 200):**
```json
{
  "success": true,
  "reply_text": "Aaj team ke total 5 tasks hain, jisme 1 overdue hai. Aapke 20 open tickets hain.",
  "action": { "type": "navigate" | "none", "route": "/attendance", "params": {}, "intentId": "…" }
}
```
- **Forward EACH user's own JWT** — the brain reads their role-scoped data with it. Never a shared token.
- On `success:false` the body still has a `reply_text` (a short reason) — speak it, but **do not navigate**.
- Timeout: the brain takes ~2–6 s (2 AI calls). Set the HTTP timeout to **~20 s**.
- Key/secret: `CGPE_VOICE_SECRET` (the `vbk_…` value) in `.env` — **server only**. (It has been shared in
  chat, so consider rotating it with the n8n dev.)

---

## 4. Step 3 — Text-to-speech (ElevenLabs → Sarvam)

- Turn `reply_text` into an mp3. Try **ElevenLabs** first (voice_id + model **v3**, output `mp3_22050_32`
  for small size); on quota-exhausted (`401/402/429`) or error, fall back to **Sarvam Bulbul v3**.
- If **both** TTS engines fail: return the reply with `audio.mode:"none"` — the **app plays its own
  bundled "voice temporarily down" clip**, so you don't need to host one.
- Keys: `ELEVENLABS_API_KEY` (+ voice_id) optional; `SARVAM_API_KEY` covers TTS too. **Sarvam alone is
  enough** (native Gujarati/Hindi voice) — ElevenLabs is optional.

---

## 5. Step 4 — What you return to the APP (this exact shape)

**Always HTTP 200.** The app already parses this (it accepts `success` OR `ok`, treats a missing
`confidence` as confident, and never navigates on a `success:false`).

```json
{
  "ok": true,
  "success": true,
  "transcript": "aaj mere kitne task hai",
  "reply_text": "Aaj team ke total 5 tasks hain, 1 overdue. Aapke 20 open tickets hain.",
  "lang_detected": "hi-IN",
  "action": { "type": "navigate", "route": "/attendance", "params": {}, "intentId": "tasks+tickets" },
  "audio": { "mode": "url", "url": "https://…/reply.mp3", "mime": "audio/mpeg", "fallback": false }
}
```

Rules:
- `ok`/`success` — pass the brain's `success` through (either field name works for the app).
- `transcript` — from your STT (the app shows it, editable).
- `reply_text` — the brain's, verbatim (the app shows AND speaks it).
- `action` — the brain's `action`, unchanged. The app validates `route` against its allow-list and only
  navigates on `type:"navigate"` + `success:true`.
- `audio` — `{ mode:"url", url, mime }` (a URL reachable **without auth**, live ≥ 10 min) is preferred;
  `mode:"base64"` (payload in `url`) or `mode:"none"` (+ `fallback:true`, app plays its clip) are fine.
- **`confidence` is optional** — omit it (the app treats absence as confident). Only send a low value if
  you deliberately want the app to ask instead of act.

**On any failure (STT/brain/TTS), still HTTP 200:** `{ "ok": false, "transcript": "<or ''>",
"reply_text": "<short reason to speak>", "audio": {"mode":"none","fallback":true}, "action":{"type":"none"} }`.
The app speaks `reply_text` (if any), shows the transcript, and does not navigate. Never an empty body,
never a non-200 for a normal failure (the app treats a non-200 as an outage).

---

## 6. Keys / env (server `.env` only — never the app)

| var | for |
|---|---|
| `SARVAM_API_KEY` | STT (and Sarvam TTS) — the minimum to make voice work |
| `CGPE_VOICE_SECRET` | the `vbk_…` brain webhook secret |
| `ELEVENLABS_API_KEY` + voice_id | optional TTS primary (v3, Gujarati-capable) |
| `N8N_VOICE_BRAIN_URL` | `https://ai.cgpe.in/webhook/cgpe-voice-brain` (env-driven, not hardcoded) |

---

## 7. Test it end to end

| Say (into the app) | Expect |
|---|---|
| "aaj mere kitne task hai aur open tickets kitne hai" | one spoken reply covering both; `action.type:"none"` |
| "attendance kholo" | `action.type:"navigate"`, `route:"/attendance"` → app moves screen |
| a team member: "saare clients dikhao" | brain returns only their scope (it reads with their token) |
| a forbidden ask | `success:false` + a spoken reason; app speaks it, does NOT navigate |
| ElevenLabs quota out | audio via Sarvam; `audio.fallback:false` |
| both TTS down | `reply_text` present, `audio.mode:"none"`, `fallback:true` (app plays its clip) |

That's the whole backend piece. STT + TTS are yours; the transcript→answer is the brain's; the app is
already built to this contract.
