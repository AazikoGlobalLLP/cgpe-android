# CGPE Voice — who does what: Backend vs n8n (the Gemini-brain model)

**Read this first — it replaces the STT/TTS parts of `N8N-VOICE-DEV-BRIEF.md`.**

You (the owner) are right: **n8n gives us only TEXT, and the voice conversion happens at the backend.**
This is the cleaner design and it matches your WhatsApp brain exactly. So the split is:

- **Backend (CGPE server)** does the VOICE: speech-to-text on the way in, text-to-speech on the way out.
- **n8n** is a pure **TEXT brain (Gemini)** — the same kind of brain already inside your WhatsApp
  workflow. It receives text, understands the query, reads the data, and writes a natural, systematic
  answer in text. It never touches audio.

---

## 1. The flow (corrected)

```
 PHONE                         BACKEND (cgpe.in)                          n8n (Gemini brain)
 ─────                         ─────────────────                          ──────────────────
 record audio ──POST /api/voice/ask──▶
                               1. STT  (Sarvam)  audio → transcript text
                               2. send { transcript, user_token, context } ──▶  3. Gemini reads the
                                                                                    query, calls the
                                                                                    CGPE API with the
                                                                                    user_token, writes
                                                                                    a systematic answer
                               5. TTS  (ElevenLabs → Sarvam)  ◀── 4. { reply_text, action } ──┘
                                  text → audio (mp3)
                               6. assemble the reply and return it
        ◀──── { transcript, reply_text, audio, action, confidence } ────
 show text + play audio
```

**The phone side does not change.** The app already sends the audio and expects back
`{ transcript, reply_text, audio, action, confidence }`. All that changed is WHERE the voice is made
(backend, not n8n). The app is already built and needs no change for this.

---

## 2. What the BACKEND does (CGPE server)

1. Receive the audio from the app (`POST /api/voice/ask`, with the user's login token).
2. **Speech-to-text (STT):** Sarvam `saaras:v3`, `mode=translit` → the transcript (in Latin letters).
3. Call the **n8n** webhook with `{ transcript, user_token, session_id, request_id, screen, history }`.
4. Get back `{ reply_text, action }` (text only) from n8n.
5. **Text-to-speech (TTS):** ElevenLabs → (if out) Sarvam → (if both out) mark `audio.fallback:true`.
6. Assemble and return `{ transcript, reply_text, audio, action, confidence }` to the app.

**Keys the backend needs** (all in the backend `.env`, never in the app, never in n8n):
- **Sarvam key** — for STT (and Sarvam TTS fallback). *This is the minimum to make voice work.*
- **ElevenLabs key + one voice_id** — OPTIONAL. If not given, the backend uses the **Sarvam voice
  only** (native Gujarati/Hindi — perfectly fine). If given, ElevenLabs is the primary voice.

---

## 3. What n8n does (the Gemini text brain)

> **Integrate the same Gemini brain you already have in the WhatsApp workflow.** For voice, it works
> text-in / text-out: it receives the transcript, understands the query, reads the data from the CGPE
> API **with the user's token**, and writes ONE systematic, natural answer — as if it is talking to
> the person.

- **Input:** `{ transcript, user_token, session_id, request_id, screen, history }` (all text).
- **Output (HTTP 200, JSON):**
  ```json
  { "reply_text": "Aaj aapke 4 kaam hai, 3 tickets open hai, 2 naye leads aaye hai. Aaj 29 August hai, koi naya event nahi hai.",
    "action": { "type": "none", "route": null, "params": {}, "intentId": null } }
  ```
  `action.type` is `none` for an answer, or `navigate` with a `route` from the list in
  `N8N-VOICE-DEV-BRIEF.md` §8 when the user asks to open a screen. **No audio field — the backend adds
  the voice.**
- **Security (unchanged, non-negotiable):** read the data ONLY through the CGPE REST API using the
  `user_token` — never MongoDB directly (§7 of the other brief).

### 3a. Multi-part queries — this is the important one

A user will say several things in one breath. Example:

> *"Mere aaj ke task batao, kitne total open tickets hai wo batao, naye leads kya aaye hai, aaj ki
> date kya hai, aur koi naya event update hai ki nahi."*

**The Gemini brain must handle ALL of it in one answer.** It should:
1. Understand every part of the query (tasks + open tickets + new leads + date + events).
2. Call **each** relevant endpoint (see §4) with the user's token.
3. Compose **one** natural, systematic spoken answer that covers every part, in order — the way a
   helpful person would reply. Example: *"Aaj aapke 4 kaam hai. Open tickets 3 hai. Do naye leads
   aaye — Ramesh aur Suresh. Aaj 29 August hai. Abhi koi naya event nahi hai."*
4. If one part fails (an endpoint is down), answer the other parts honestly and say which one it
   couldn't fetch — never make up a number.

This is exactly why the Gemini-brain model is used instead of a rigid one-command-at-a-time system:
the brain reads the whole sentence and answers the whole sentence.

*(Optional, later: the brain can also return a small structured list the app shows on screen as a
checklist the member can scan — a v2 nicety. For v1, the spoken + written `reply_text` covering
everything is enough.)*

---

## 4. Command → endpoint list (all LIVE on production today)

n8n calls these with the user's token (`Authorization: Bearer <user_token>`). Every one of these is an
endpoint the app already calls daily, so they exist and are deployed.

| What the user asks | Endpoint (GET) |
|---|---|
| my tasks today / how many tasks / overdue | `GET /api/team/task-overview` (the member's own rows are filtered from this) |
| open tickets / count | `GET /api/tickets?status=open` |
| new leads / pipeline | `GET /api/leads?limit=500&scope=all` |
| claims pending | `GET /api/claims/stats/summary` |
| today's follow-ups / reminders | `GET /api/reminders?limit=100` |
| unread notifications / new messages | `GET /api/notifications?limit=50` |
| am I clocked in / clock status | `GET /api/time-tracker/current` |
| attendance this month | `GET /api/time-tracker/history?limit=30` |
| commission this month | `GET /api/commissions/my-summary` |
| my salary / earnings | `GET /api/payroll/my-earnings?month=YYYY-MM` |
| contests | `GET /api/contests` |
| new events / notice board | `GET /api/notice-board` |
| today's date / time | **no endpoint — n8n computes it** (server time) |

Base URL: `https://cgpe.in/internal/api`. So `/api/team/task-overview` → `https://cgpe.in/internal/api/team/task-overview`.

---

## 5. Answers to the two things n8n asked

**(a) "ElevenLabs key + voice-id (warna sirf Sarvam voice)"**
→ **n8n does NOT need the ElevenLabs key** in this model — the **backend** does the voice. So:
- Give the **Sarvam key to the backend** (this alone makes voice work, with a native Gujarati/Hindi voice).
- ElevenLabs is **optional**: if you want the ElevenLabs voice, rotate the key, pick one `voice_id`
  (model **v3**), and give both to the **backend** — NOT to n8n. If you skip it, you get the Sarvam
  voice, which is honestly a good fit for a Gujarati team.

**(b) "cgpe.in/internal/api endpoints ready hain? + kaunsa command → kaunsa endpoint"**
→ **Yes, all ready and deployed** (the app uses them every day). The full command → endpoint list is
§4 above. n8n calls them with the user's token.

---

## 6. What to hand over now

- **To the n8n dev:** this file + `N8N-VOICE-DEV-BRIEF.md` §8 (the navigate route list). Tell them:
  *"Build a Gemini text brain like the WhatsApp one; text in, text out; call these endpoints with the
  user's token; answer multi-part queries fully and systematically."* They send back the **webhook URL
  + secret**.
- **To the backend dev:** *"Do STT (Sarvam) before n8n and TTS (ElevenLabs→Sarvam) after; forward the
  user's token to n8n; assemble the `{transcript, reply_text, audio, action}` reply."* Give them the
  **Sarvam key** (and optionally ElevenLabs key + voice_id).
- **ElevenLabs:** optional right now — Sarvam-only works.

*The phone app is already built to this contract and needs no change.*
