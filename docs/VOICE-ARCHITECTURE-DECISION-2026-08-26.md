# CGPE Connect — Voice Assistant: Final Recommendation

**For:** the owner · **Date:** 2026-08-26 · **Status:** decision document, no code written yet
**Basis:** 4 research reports + adversarial verification of each. Where a verifier corrected a researcher, the verifier wins. Every codebase claim below was re-checked against the real files this session. Every price is marked **verified** or **unverified**.

---

## 1. Seedha jawab (the direct answer)

- **n8n mein voice ka round-trip mat daaliye. Express backend mein banaiye.** n8n jahan hai wahin rahega — WhatsApp, campaigns, OTP, PDF reports, alerts. Reason speed nahi hai (n8n sirf +0.15–0.75 s add karta hai). Reason ye hai ki **n8n ke paas seedha MongoDB ka full access hai aur woh app ke saare permission rules bypass kar deta hai.** Ek "kuch bhi kar sakne wala" voice assistant aisi cheez ke upar nahi bana sakte jo ye hi nahi jaanti ki poochh kaun raha hai.
- **Aapka n8n wala instinct galat nahi tha** — n8n **aaj bhi production mein aapke team ke Gujarati voice notes transcribe kar raha hai** (`routes/noticeBoard.js:6` — *"n8n transcribes the Gujarati into `transcript`"*). Woh knowledge rakhiye. Jo n8n mein **kabhi** nahi jaana chahiye woh hai *decision + permission* ka hissa.
- **STT (transcript) = Sarvam AI `saaras:v3`, `mode=translit`, REST, backend se call.** Ye akela engine hai jo output **Latin script** mein deta hai (`mera phone number hai...`), aur aapka database saare naam Latin mein rakhta hai (18/18 staff names — 0 Devanagari/Gujarati characters). Native script aaya toh naam-matching chup-chaap toot jaayegi.
- **TTS (bolne wali awaaz) = Sarvam Bulbul v3, default.** Native Gujarati/Hindi voices, India-hosted (DPDP clean), ElevenLabs se ~40% sasta, aur **same vendor as STT** = ek adapter kam, ek India PoP.
- **ElevenLabs plan: sirf Creator, $22/mahina ($11 pehla mahina), ek mahine ke liye — sirf blind listening test ke liye.** Pro/Scale/Business abhi mat khareediye. ElevenLabs ka Gujarati **kaam karta hai but uski voices native Gujarati speakers nahi hain** (Jessica, Laura, Alice, Bill, Brian — ElevenLabs ki apni page kehti hai voice *"retains its unique characteristics and accent"*). Quality aapki #1 priority hai, aur ye **kaan se decide hone wali cheez hai, spreadsheet se nahi.**
- **NLU (samajhne wala dimaag) = Claude, backend se, ek call mein.** Model sirf **verb** chunta hai (`{intent, args}`); **jawab ka sentence app khud banata hai** human-written template se. Isse ₹ ka figure ya client ka naam galat bolna **structurally impossible** ho jaata hai, ek LLM call bachti hai, aur **koi client PII kabhi LLM vendor tak jaati hi nahi.**
- **Monthly cost (expected use, 21 staff): ≈ ₹6,000/mahina ≈ $63 ≈ ₹288 per user.** Sasta variant ₹4,300. Premium variant ₹10,300. Full breakdown §9 mein.
- **Sabse pehla kaam koi build nahi hai — ek 10-minute test hai.** Ek asli Gujarati clip Sarvam ko `mode=translit` ke saath bhejiye aur dekhiye output Latin script mein aata hai ya Gujarati script mein. **Sarvam ki kisi bhi page par `translit` ka Gujarati example nahi hai — sirf Hindi ka.** Agar Gujarati script aaya, poori architecture ka aadha hissa badalna padega. Ye test ₹0 ka hai.

---

## 2. Aapka plan vs mera plan

### Aapka plan (fairly restated)

> App voice record karega → n8n ko bhejega → n8n process karke **text** return karega → woh text ElevenLabs ko denge → ElevenLabs speech dega → UI mein ek **character/avatar** usse bolega.

**Ye plan achhe reasoning par khada hai, aur uske teen hisse bilkul sahi hain:**

1. **n8n already Gujarati transcribe kar raha hai — production mein, aaj.** Verified in two places. Ye ek asli, chalta hua asset hai. Aapka "jo chal raha hai use dobara mat banao" wala instinct engineering ka sahi instinct hai.
2. **Text ko ElevenLabs se bolwana** — plain TTS API use karna (ElevenLabs ka bhaari "Agents Platform" nahi) — **bilkul sahi call hai.** Agents Platform per-**minute** bill karta hai (soch-vichaar aur silence bhi), jo short commands ke liye **~5× mehnga** hai, aur usme LiveKit WebRTC ka poora native stack aata hai — aapki app already ek 24/7 background-location foreground service uthaa rahi hai. Aur uski documentation saaf kehti hai: *"Language selection is fixed for the duration of the call — users cannot switch languages mid-conversation"* — jo Gujlish bolne walon ke liye disqualifying hai.
3. **Avatar/character** — team ko ye bataane ke liye ki app sun rahi hai / soch rahi hai / bol rahi hai, ye achha idea hai (§6).

### Kya KEEP karna hai, kya CHANGE

| Aapke plan ka hissa | Faisla | Kyun |
|---|---|---|
| App voice record karegi | **KEEP** | Push-to-talk, no wake word. Sahi. |
| **Audio n8n ko bhejna** | **🔴 CHANGE → Express backend** | n8n ke paas full Mongo write access hai; woh `protect` aur `visibilityScope` bypass karta hai. Ek team advisor bolke poora 9,000-client book nikaal sakta hai — woh gate aapne khud lock kiya tha. |
| **n8n text wapas dega** | **🔴 CHANGE** | Aaj is system mein n8n ka **ek hi** chat-jaisa synchronous webhook hai aur woh **khaali body return karta hai** — ye backend ke apne code comment mein likha hai (`routes/assistant.js:5-8`). Baaki har synchronous n8n call **15–40 second** leti hai. Voice ko 2 second chahiye. |
| Text → ElevenLabs → speech | **KEEP the shape, CHANGE the vendor (probably)** | Plain TTS API sahi hai. Lekin Gujarati ke liye Sarvam Bulbul v3 pehle test kijiye — native Indian voices, India-hosted, sasta. ElevenLabs ko blind test se jeetne dijiye, assumption se nahi. |
| UI mein character bolega | **KEEP, simplify** | Reanimated se bana ek "orb" — koi nayi native dependency nahi, koi APK size nahi, aur **bina rebuild ke tune ho sakta hai**. Mascot chahiye toh Lottie baad mein ek dependency door hai. |
| n8n stays for WhatsApp/campaigns/reports | **KEEP — bilkul mat chhediye** | Ye n8n ka sahi kaam hai. |

### Ek baat jo insaaf ke liye kehni zaroori hai

Jo dalil main n8n ke khilaaf de raha hoon (*"jo cheez permission nahi jaanti woh actions perform na kare"*), **wahi dalil ElevenLabs ke Agents Platform ke khilaaf bhi jaati hai** — aur donon ke liye barabar. Main aapke plan ko koi chhoot nahi de raha. Rule ek hi hai, dono par lagta hai:

> **Speech ko kahin bhi route kar sakte hain. Authorization ko sirf wahin route kar sakte hain jahan pehle se rules likhe hain.**

---

## 3. The recommended architecture

### End-to-end flow

```
   PHONE (Expo / RN 0.86)                 DROPLET (Express, cgpe.in)            VENDORS
   ─────────────────────                  ──────────────────────────            ───────
  ┌──────────────────────┐
  │ 1. Press & hold      │  haptic <100 ms, local, no network
  │    <VoiceSheet/>     │
  │ 2. Record ~6 s AAC   │  hard cap 15 s, countdown ring
  └──────────┬───────────┘
             │  POST /api/voice/interpret   (multipart, ~30 KB)
             │  Authorization: <the USER's own JWT>
             ▼
                             ┌──────────────────────────────┐
                             │ 3. protect → role from JWT   │
                             │    (never from the body)     │
                             └──────────────┬───────────────┘
                                            │ audio ─────────────────►  SARVAM saaras:v3
                                            │                            mode=translit
                                            │ ◄──── Latin-script text ──  (India-hosted)
                             ┌──────────────▼───────────────┐
                             │ 4. filter tool catalogue      │
                             │    by THIS user's role        │
                             └──────────────┬───────────────┘
                                            │ transcript + ~30 tools ──►  CLAUDE
                                            │   (cached prefix)           ONE call
                                            │ ◄── {intentId,args,conf} ─  no PII sent
             ┌──────────────────────────────┘
             │  { transcript, intentId, args, confidence }
             ▼
  ┌──────────────────────────────────────────────┐
  │ 5. registry[intentId]  → unknown = REFUSE     │
  │ 6. GATE re-check (live user + viewAs + can)   │  ← 2nd independent filter
  │ 7. entity resolve via search() + searchScore  │
  │ 8. WRITE?  → confirm card, needs a TAP        │
  │    READ?   → execute now                      │
  │ 9. run() through the EXISTING src/data/api.ts │  ← inherits RBAC, idempotency,
  │    → GET/POST https://cgpe.in/internal/api/*  │    offline queue, honest failures
  │ 10. render answer from a TEMPLATE (5 langs)   │  ← the LLM never writes this
  └──────────────┬───────────────────────────────┘
                 │  POST /api/voice/speak  { text, lang }
                 ▼
                             ┌──────────────────────────────┐
                             │ 11. TTS proxy (key stays here)│──►  SARVAM bulbul:v3
                             └──────────────┬───────────────┘◄──  audio (India-hosted)
                 ┌──────────────────────────┘
                 ▼
  ┌───────────────────────────────────────────────┐
  │ 12. TEXT on screen (always) + speak (if unmuted)│
  │     <VoiceAvatar state="speaking"/>            │
  └───────────────────────────────────────────────┘

   SLOW WORK BRANCH (reports, campaigns, bulk WhatsApp):
   step 9 fires the EXISTING n8n webhook and returns immediately
   → "Report ban rahi hai, WhatsApp par aa jayegi" → tracked by the app's
     existing JobsProvider + <JobPill/>  (already used for the 9k-client renewal scan)
```

### Where every key lives

| Secret | Lives | Never |
|---|---|---|
| Sarvam STT + TTS key | Droplet `.env`, read only by the Express process | never in the APK, never in git, never in n8n |
| Anthropic (Claude) key | Droplet `.env` | never in the APK |
| MongoDB credentials | Express only, already scoped by `protect` + `visibilityScope` | voice never touches Mongo directly |
| App → backend auth | The **user's own JWT** (`protect`), not a shared internal secret | — because the whole point is that the answer depends on who is asking |

**Two existing security items to close regardless of voice** (both already logged): rotate the n8n shared secret that was committed to git history and later removed from source, and replace `N8N_WEBHOOK_AUTH_TOKEN=CGPE-Test-9f3k2j8s` with a real high-entropy secret. Neither is caused by voice; both get worse if more traffic flows through n8n.

### Latency budget

Clock starts when the user **releases** the button. Every row is either cited or marked `[A]` = assumption.

| Step | Best | Weak rural 4G |
|---|---|---|
| Haptic + "listening" state | *(fires before release — local, <100 ms)* | |
| Encode + finalise audio `[A]` | 50 ms | 150 ms |
| TCP + TLS to droplet `[A]` (measured desktop→droplet: 38–76 ms fresh) | 60 ms | 600 ms |
| Upload ~30 KB `[A]` | 150 ms | 500 ms |
| **Sarvam STT** (REST, ≤30 s clip — Sarvam publishes no latency) `[A]` | 400 ms | 1,200 ms |
| **Claude intent JSON** (Haiku-class TTFT ~1.0 s on the first-party API — third-party benchmark, **unverified by us**) | 900 ms | 1,500 ms |
| Gate + data read via existing service fns | 60 ms | 300 ms |
| Answer composition | **0 ms** — templated, no 2nd LLM call | 0 ms |
| **TTS → first audio** (Sarvam publishes no TTS latency) `[A]` | 300 ms | 700 ms |
| Download + buffer reply audio | 250 ms | 600 ms |
| **TOTAL, non-streaming (v1)** | **≈ 2.2 s** | **≈ 5.6 s** |
| **TOTAL, with streaming STT + streamed TTS + warm connection (v2)** | **≈ 1.7 s** | **≈ 3.5–4.0 s** |
| *n8n surcharge if routed through it* | *+140 ms* | *+750 ms* |

**Honest targets for THIS product** (push-to-talk command-and-response, not a live phone call — the industry's "<800 ms" bar describes full-duplex conversation and is **not achievable** here with cloud STT + cloud LLM + cloud TTS on rural 4G):

| Bar | Target | Why |
|---|---|---|
| Haptic + "listening" | **<100 ms** | Local. Non-negotiable — this stops the user pressing twice. |
| **Transcript visible on screen** | **<1.2 s after release** | This is the one that decides whether it *feels* fast. |
| Spoken reply starts | ≤2.5 s good / ≤4 s weak | Realistic. |
| Hard ceiling | 5 s, then a visible progress state | Beyond this, fall back to text. |

**The winning move is hiding latency, not shaving 200 ms off a hop.** Instant haptic, transcript on screen while the LLM is still thinking, streamed speech. That is why the n8n surcharge is *not* the reason to reject n8n.

---

## 4. Why not n8n for the voice round-trip

### The trade-off table

| | **n8n-mediated (aapka plan)** | **Direct Express code** | Winner |
|---|---|---|---|
| **Kaun poochh raha hai, ye pata hai?** | 🔴 **Nahi.** n8n has full direct MongoDB credentials, writes collections directly (it even owns its own TTL index — that requires DB access, not an API), and bypasses `protect` + `visibilityScope` entirely | ✅ Runs inside the caller's own JWT; calls the **same service functions** the REST API calls, so every existing gate applies for free | **Direct — non-negotiable** |
| **Galti hone par wapas laa sakte hain?** | 🔴 Community edition = **last 24 hours of workflow history only.** No git, no tests, no code review, live production, multiple editors | ✅ `git revert`, forever. 993 Vitest tests as a gate | **Direct, decisively** |
| **Track record for this exact shape** | 🔴 The **one** chat-shaped synchronous n8n webhook in this system **returns an empty body today** — stated in the backend's own comment. Every other sync n8n call takes **15–40 s** (`N8N_PDF_TIMEOUT_MS` defaults to 120,000) | ✅ Express uptime = API uptime | **Direct** |
| **Errors ka matlab samajh aata hai?** | 🔴 `postWebhook()` **never throws** — designed for fire-and-forget alerts, not for a user waiting for an answer. A workflow error arrives as an opaque non-200 or an empty body | ✅ The app's existing honest vocabulary applies: `WriteFailure = 'network' \| 'server' \| 'forbidden' \| 'unsupported' \| 'invalid'` — voice can truthfully say *"server ne mana kiya"* vs *"server tak nahi pahuncha"* | **Direct** |
| **Debug kaise karenge?** | Open the n8n UI and squint at an execution list. The WhatsApp brain workflow is ~550 KB of JSON that could not be read in a dev session | One line of timing in the route; errors land in the existing logger; fully greppable | **Direct** |
| **Blast radius of one bad edit** | 🔴 Shared instance — a voice mistake or a voice traffic spike can degrade **login OTP and WhatsApp delivery** | Contained to one route | **Direct** |
| **Extra network hops** | `ai.cgpe.in` and `cgpe.in` **both resolve to 72.61.233.113** — the same droplet. Going out and coming back is a pointless loopback | None | **Direct** |
| **Speed** | +0.15 s best / +0.75 s typical | baseline | Direct — **but this is NOT the deciding factor** |
| **How fast can you fix it?** | ✅ **Seconds.** Save in the UI, it's live | 🟠 commit → PR → merge to `origin/main` → deploy → possibly restart `:3001`. This team has been bitten by a **deploy gap** before: features marked "done" sat on unmerged branches and simply did not run on the phone | **n8n — the one row it wins** |
| **Cost** | Free (already running); prunes executions by default (14 d / 10k) so DB growth is bounded | Marginal — one more route | Tie |

**Score: 9 of 10 dimensions favour direct code. The only row n8n wins is deploy speed** — and §11 addresses that directly (add a build stamp to `/api/health` so anyone can confirm in one second which commit is actually live).

### The verdict in one sentence

> **n8n excellent hai us kaam mein jo woh kar raha hai. Voice woh kaam nahi hai.** Ek asynchronous, fire-and-forget, din mein ek baar chalne wali, 15–40 second lene wali automation pipe ko ek synchronous, per-user, permission-sensitive, 2-second conversational turn ka raasta banana — ye tool ka galat istemaal hai.

### The hybrid split — what STAYS in n8n

**Bilkul mat chhediye:**

| Workload | Why it belongs there |
|---|---|
| Meta WhatsApp inbound receiver + the Gemini agent + `wa_chat_memory` | Async by design; Meta demands an instant 200 |
| Outbound WhatsApp: OTP, campaigns, hub 1:1, claim notifications, monthly content | Delivery-shaped, not answer-shaped |
| PDF report rendering (`cgpe-generate-report`, `cgpe-report-render`) | 15–40 s, cached, proven end-to-end |
| Attendance alerts, escalations, location-gap alerts, email fallback | Cron / fire-and-forget |
| **The Gujarati voice-note transcription for the notes board** | It works. Leave it. |

**Must be direct Express code:** `POST /api/voice/interpret` (the synchronous turn), the intent→permission table, every read/write the voice layer performs, and the STT/LLM/TTS vendor adapters.

**The bridge — voice HANDS OFF to n8n for slow work.** This is where your existing investment keeps paying:

> **User:** *"Mujhe Ramesh ka monthly report bhejo."*
> **App (in ~1.5 s):** *"Report ban rahi hai, WhatsApp par aa jayegi."* → fires the existing `cgpe-generate-report` webhook in the background and returns immediately, tracked by the app's existing `JobsProvider` + `<JobPill/>`.

**Rule of thumb, yaad rakhne layak:**
> **Agar jawab seconds mein bolna hai → Express. Agar result baad mein milega, ya kisi aur ko milega, ya WhatsApp par milega → n8n.**

*One build note:* `config/webhooks.js` has resolvers for `whatsapp, hub, campaign, claim, chat, email, report, escalation, attendance, generic` — **there is no `voice` resolver.** The *pattern* exists; the named entry does not. Add one (`N8N_VOICE_WEBHOOK_URL`) or use `generic`.

---

## 5. The transcript layer (STT)

### Recommendation

**Sarvam AI `saaras:v3`, `mode=translit`, `/speech-to-text` REST endpoint, called from the backend. Pin the version explicitly.**

**The decisive reason is your own database, not a vendor benchmark.** Verified this session:

- `cgpe-connect.staff_unified.json` = **21 records, 18 with names, 0 containing a single Devanagari or Gujarati character.** All Latin: `Rameshbhai`, `C.G Patel`, `Priyanka Gamit`, `Jagdish Bhai`, `Hemaben Padhiar`.
- The app's typo matcher (`src/lib/fuzzyMatch.ts`, `osaWithin()`) is character-level edit distance. It is **script-blind**: `राकेश` vs `Rakesh` — every character differs, so it scores a total miss.
- **Therefore native-script STT output silently breaks name matching on every voice command that names a person.** That is the hardest constraint in this layer, and almost every vendor fails it.
- Your app already ships `hi-en` (Hinglish) and `gu-en` (Roman Gujarati) as first-class UI languages (`src/i18n/index.tsx:39`). Latin-script STT output is consistent with a decision you already made.

Sarvam is the **only** engine of the ten examined that offers a romanization mode:

| `mode` | Output for the same Hindi audio |
|---|---|
| `transcribe` (default) | `मेरा फोन नंबर है 9840950950` |
| `translate` | `My phone number is 9840950950` |
| **`translit`** ← **use this** | **`mera phone number hai 9840950950`** |
| `codemix` | `मेरा phone number है 9840950950` |

### Comparison

| | **Sarvam Saaras v3** | ElevenLabs Scribe v2 | Google Chirp 3 | OpenAI gpt-4o-transcribe |
|---|---|---|---|---|
| Gujarati | ✅ `gu-IN` | ✅ | 🟠 **Preview only** | ✅ (badly) |
| **Latin-script output** | ✅ **`mode=translit`** | ❌ none at any tier | ❌ | only via translation |
| Code-mix documented | ✅ explicit | ❌ silent (has "smart language detection", which is not the same) | ❌ | ❌ |
| **Real-world Gujarati WER** | **12.8** *(as "Sarvam Audio" — see caveat)* | **21.2** | not in the benchmark | **295.9** ← disqualifying |
| Real-world Hindi WER | 5.0 | 7.7 | Gemini 3 Pro 6.0 | 19.6 |
| Price | **₹30/hr, billed per second** | $0.22/hr (≈₹21) | $0.016/min (≈₹92/hr, Standard) | $0.006/min |
| Streaming | ✅ `saaras:v3-realtime` | ✅ | ✅ | limited |
| **India data residency** | ✅ **all tiers**; zero data retention; not used for training; DPDPA Significant Data Fiduciary | ❌ Enterprise-only, and *"processing may nevertheless occur outside"* | 🟠 `asia-south1` (Mumbai) exists, in **Preview** | ❌ |
| Rate limit | Starter 60 req/min (ample for 21 staff) | — | — | — |

*Prices verified from vendor docs 2026-08-26. WER figures verified digit-for-digit against **arXiv 2604.19151v2, "Voice of India"** — 306,230 utterances, 536 hours, 36,691 speakers, unscripted **telephonic** conversations on low-end phones in low-bandwidth rural environments. Submitted 21 Apr 2026 (v2 3 Jul 2026).*

### Honest Gujarati accuracy expectation

**Vendor marketing overstates real-world Gujarati accuracy by roughly 7×.**

- ElevenLabs' Gujarati page headlines **3.1% WER on FLEURS**. FLEURS is clean, read, studio speech. The independent field benchmark measures **21.2%** for the same product family. That is a **~6.8× overstatement.**
- **Plan for roughly 12–20% WER on Gujarati in the field.** Roughly **one word in six** will be wrong on a bad connection in a noisy Surat market.
- The same benchmark shows accuracy degrades **monotonically with audio quality** (ElevenLabs Scribe: 15.31% → 25.20% between best and worst quartiles) and that **short utterances are penalised** — and voice *commands* are short utterances.

**Two things I must flag rather than paper over:**

1. **The benchmark's "Sarvam Audio" row is not confirmed to be Saaras v3.** The paper names no model ID, and "Saarika 2.5" appears *separately* at 14.0 — so "Sarvam Audio" is some other Sarvam product. What the data *does* support: **Sarvam's family leads Indic real-world ASR, and ElevenLabs/OpenAI trail badly on Gujarati.** Saaras v3's own specific field Gujarati WER is **unmeasured by any third party.** Sarvam's self-reported figure is ~19% on a different benchmark.
2. **🔴 `mode=translit` is nowhere demonstrated for Gujarati.** Every published Sarvam example is Hindi/Devanagari. Gujarati is a listed supported language, so it is *plausible* — it is **not documented.** Also, Sarvam's own docs **contradict each other** on whether `mode` works on `saaras:v4` (two pages say v3-only, one says both). **Pin v3.**

### Mitigations — this is what makes 15% WER shippable

Your commands are a small, closed set. Design for the error rate:

1. **Test `translit` on Gujarati before writing any code.** One clip, `language_code=gu-IN`, read the output script. ₹0, ten minutes. **This is decision #1 in §13.**
2. **Assert the transcript is Latin-script and fail loudly if it isn't.** A silent v3→v4 drift or a model retirement would otherwise present as *"search stopped finding people"* — a bug nobody would trace back to STT.
3. **Never auto-execute a write on a raw transcript.** Read back the parsed intent; one confirm tap. Reads execute directly — a wrong read costs nothing.
4. **Always show the transcript on screen, editable.** Your own code already does this and says why: *"THE TRANSCRIPTION CAN BE WRONG"* (`src/app/notes.tsx:41-43`).
5. **Constrain entity resolution to a candidate list.** Never let the model free-form a client name. Resolve the transcribed name against the real book. ⚠️ **Use `src/lib/searchScore.ts`, not `fuzzyMatch.ts` directly** — the "don't fuzzy-match phone digits" rule lives at `searchScore.ts:133` (`if (!q.numeric && fuzzyMatches(...))`), not in the matcher itself. Importing the matcher alone would fuzz-match phone numbers.
6. **Pass `language_code` explicitly** from the app's existing i18n setting (`hi`/`hi-en` → `hi-IN`, `gu`/`gu-en` → `gu-IN`). Auto-detect is a fallback, not a default — it costs accuracy on short clips.
7. **Reject bad audio locally.** <1 s or silent → *"thoda lamba boliye"*, no API call.
8. **Log every transcript + resolved intent + whether the user corrected it** (transcript only — no user id, no entity). Within a month you will know your real WER and your top 20 misrecognised terms. Insurance vocabulary (`policy`, `premium`, `maturity`, `endowment`, `nominee`) is where errors will cluster.

### Not recommended

- **OpenAI** — disqualified. **295.9 WER** on Gujarati for mini. That is not "poor", it is catastrophic hallucination producing three times more errors than there are words.
- **Google Chirp 3** — Gujarati is **Preview**, India region (`asia-south1`) is also **Preview** (public preview since 13 Nov 2025 — so the "audio leaves India" objection you may have heard is **wrong**), and there is **no romanization**, which is decisive on its own.
- **ElevenLabs Scribe** — cheaper than Sarvam, but 21.2 real-world Gujarati WER, **no romanization at any tier**, and no code-switching claim anywhere in its docs.
- **Bhashini/ULCA** — technically respectable, India-sovereign, free for non-commercial. But commercial ASR pricing is **not published** (enterprise contact only), there is no `translit` equivalent, and access is via a pipeline-config indirection. Keep as a sovereign fallback, not a primary. ⚠️ Note: **every fallback vendor outputs native script**, so a fallback is not a drop-in — it would need its own romanization step.

---

## 6. The voice + character UI (TTS)

### The honest answer on ElevenLabs Gujarati

**Gujarati works — but on a caveat that matters more than the price.**

| Model | Latency | Gujarati? | API rate |
|---|---|---|---|
| Eleven v3 | not stated; not positioned for real-time | ✅ | $0.10 / 1k chars |
| **Eleven v3 Conversational** | **~280 ms** *(excluding application & network latency)* | **✅** | **$0.05 / 1k chars — same price as Flash** |
| Multilingual v2 | not stated | ❌ | $0.10 / 1k |
| Flash v2.5 | ~75 ms | ❌ **no Gujarati** | $0.05 / 1k |

*All verified at elevenlabs.io/pricing/api and /docs/models, 2026-08-26.*

**Correction to a claim you may have heard: there is NO Gujarati price penalty.** v3 Conversational does Gujarati at the same per-character rate as the cheap fast model. The cost of Gujarati is **latency (~280 ms vs ~75 ms), not money.**

**But here is the argument that survives, and it is the one that matters given quality is your #1 priority:**

> 🔴 **The Gujarati voices are not native Gujarati speakers.** elevenlabs.io/text-to-speech/gujarati offers Jessica, Laura, Alice, Bill, Brian — English-named multilingual voices — and the page states the voice *"retains its unique characteristics and accent."* That means a Gujarati sentence spoken with a non-Gujarati voice identity. ElevenLabs' own India page claims *"12 Indian languages and accents"* and **never names Gujarati.** (In fairness, the same Gujarati page also claims it *"can adapt to various regional Gujarati accents"* — marketing, unverifiable.)

**For non-technical Gujarati field advisors in Surat, that is a real product risk — and it is exactly what Sarvam Bulbul solves.**

### TTS comparison — Gujarati

| | **Sarvam Bulbul v3** | **Google Chirp 3 HD** | **ElevenLabs v3 Conversational** |
|---|---|---|---|
| Gujarati | ✅ `gu-IN` first-class | ✅ `gu-IN` (Google's own docs list 11 Indian locales) | ✅ |
| **Native Indian voices** | ✅ **30+** | ✅ locale voices | ❌ English-named, accent retained |
| Price / 1M chars | **₹3,000 ≈ $31** | **$30 (+1M chars/mo free — third-party sourced)** | **$50** |
| Latency | **not published — unverified** | not published — unverified | ~280 ms *excl. network* |
| India-hosted | ✅ **all tiers** | region-configurable | ❌ Enterprise-only, processing may still leave |
| Char limit/request | 2,500 | — | 5,000 |
| Language coverage | **11 languages** (⚠️ vs Saaras STT's 22) | 11 Indian locales | 70+ |
| Free to try | ₹100 free credits | 1M chars/mo free | 10k credits (**no commercial licence**) |

### Verdict

**Default to Sarvam Bulbul v3.** Reasons in order: native Gujarati voices, India-hosted (DPDP-clean for a product that already runs a versioned consent gate), ~40% cheaper than ElevenLabs, and **one vendor + one India PoP for both STT and TTS** — which removes an adapter and materially cuts round-trip time versus a US-hosted TTS.

**But decide with your ears, not this table.** Spend **$11** and run a blind A/B.

### Which ElevenLabs plan should he buy? (Q4)

> **Buy Creator — $22/month, $11 for the first month — for ONE month, to run the test. Nothing else, yet.**

| Why Creator | |
|---|---|
| Includes the **commercial licence** | The Free tier does **not** — Free is legally unusable in a company app |
| 121,000 credits | ~240,000 characters at the half-price tier ≈ **1,600 spoken replies** — far more than a bake-off needs |
| Full API + streaming | Concurrency 5/10 — never a constraint for 21 people |
| $11 first month | The cheapest way to answer the only question that actually matters |

**After the test:**

| Outcome | Buy |
|---|---|
| **Sarvam wins (my expectation)** | **Cancel ElevenLabs.** Keep Sarvam for both halves. |
| ElevenLabs wins on Gujarati | Use the **published ElevenAPI rate card at $0.05/1k chars** — at expected volume that is **≈₹5,670/mo**, which is *cheaper* than the Pro subscription (₹9,504/mo). ⚠️ **Whether you can buy at the rate-card price without a subscription is unverified — check the billing page before paying.** |
| ElevenLabs wins and you prefer a subscription | **Pro $99/mo covers expected volume ONLY IF v3 Conversational bills at 0.5 credits/char.** That is **inferred from the rate card, not documented.** And whether STT also draws from the same credit pool is **unverified** (third-party sources claim ~330 credits/min, which would change everything). **Read both numbers off the live dashboard before buying.** |

**Do NOT buy Business ($990/mo)** — 6M credits is ~5× what 21 field staff generate. **Do NOT buy Enterprise for India data residency** — ElevenLabs' own docs say *"processing may nevertheless occur outside the selected location"*; only the EU gets a processing restriction. It would not buy you what you want.

**Add Google Chirp 3 HD as a free third arm** — its 1M free chars/month makes it free to test and it covers your entire Light scenario at ₹0.

### The avatar / character — RN & Expo implementation

| Option | New native dep? | APK cost | Verdict |
|---|---|---|---|
| **Reanimated-driven vector "orb"** (Views + `react-native-reanimated`, **already installed**) | **none** | **0 KB** | ✅ **launch with this** |
| Lottie (`lottie-react-native`) | yes | binary + JSON (measure) | ✅ upgrade path |
| Rive | yes | larger | ❌ least common in Expo; you cannot debug it |
| Sprite sheet (`<Image>` + Animated) | none | PNG frames | fallback if a real mascot is wanted with no new dep |
| SVG morph | ⚠️ **`react-native-svg` is NOT installed** — verified | — | ❌ |

**Ship the orb.** It uses a library you already have, it costs nothing in APK size, `useTheme()` gives it your department accent for free, and — crucially — **it is JS-only, so it can be tuned without shipping a new APK.** Given there is no OTA, every native dependency you add now is a dependency you cannot tune later without reinstalling on ~21 phones. If you still want a mascot after using it, Lottie is one dependency and one rebuild away behind an unchanged `<VoiceAvatar>` interface.

```
<VoiceAvatar state="idle"|"listening"|"thinking"|"speaking"|"error" level={0..1} muted />
```

| State | Motion | Haptic (existing verbs) |
|---|---|---|
| `idle` | still, dim | — |
| `listening` | ring pulses with mic amplitude | `heavy()` on press-in |
| `thinking` | slow sweep — **never a spinner**, which reads as "loading data" | — |
| `speaking` | waveform tracks the TTS envelope | `tap()` at start |
| `error` | one shake, danger accent | `error()` |

Amplitude drives a Reanimated shared value on the UI thread — no `setState` per frame.

### Mute + accessibility — not optional

- **Text is the primary channel; speech is an enhancement.** Every spoken line appears on screen verbatim, at body size, selectable. This one rule delivers accessibility, weak-network usability, deaf/HoH access, noisy-field usability, and the "transcription can be wrong" requirement at once.
- **A persistent mute toggle** in the voice sheet header *and* in `/settings`, defaulting to **on-screen-text-only until the user opts into speech.** Field staff are often sitting in front of clients; an app that starts talking is an app that gets uninstalled. *(This is also a real cost lever — see §9.)*
- Muting silences TTS; it never suppresses the answer and never disables the mic.
- Respect `AccessibilityInfo.isReduceMotionEnabled()` → the orb becomes a static state chip.
- Push-to-talk button ≥44×44 pt, with `accessibilityLabel`/`accessibilityHint`/`accessibilityRole="button"`, and `accessibilityLiveRegion="polite"` on the answer text so TalkBack announces it.
- Tapping the orb while it is speaking stops TTS immediately.
- **The avatar must never be the only indicator of an error** — errors go through the existing `useToast()` tones and `<HealthBanner/>`.

⚠️ **Native-module trap (mandatory):** all audio/TTS imports live in **one** file (`src/lib/voiceAudio.ts`) imported **only** by `src/ui/VoiceSheet.tsx`, which no test reaches. Importing a native module without a stub from any file the Vitest graph reaches breaks Node with `ReferenceError: __DEV__ is not defined`. Same pattern as the existing `lib/push.ts` / `lib/calendar.ts` / `lib/tracker.ts`.

---

## 7. "Voice can do anything" — the system design

### The one decision everything hangs off

> **The model picks the verb. The app writes the sentence.**

The LLM's only job is `transcript → {intent_id, args, confidence}`. It never sees client data, never composes the spoken answer, never touches an endpoint. The app fetches through the existing `src/data/api.ts` and renders the reply from a **deterministic per-intent template in the user's language.**

| | Model writes the answer | **App writes the answer (recommended)** |
|---|---|---|
| Wrong ₹ figure or wrong count spoken | possible, silent | **structurally impossible** |
| LLM calls per turn | 2 | **1** |
| Client PII sent to an LLM vendor | yes, every read | **never** |
| Hindi/Gujarati phrasing quality | model's guess | human copy, reviewed once per intent |
| Latency | 2 round trips | 1 |

DPDP alone justifies it: with templated answers, **no client name, phone number, or premium amount ever leaves the droplet for an LLM vendor.** Only the raw transcript does — and the transcript is leaving for STT regardless.

*Escape hatch:* a tiny `explain` family (KB questions, *"yeh plan kya hai"*) where the model **is** allowed to write prose, because there is no number to get wrong. Keep it under 5 intents, marked `narrated: true`.

### The registry — one file, the only place a voice verb is declared

`src/data/api.ts` is **4,220 lines** with ~101 exported functions and ~53 screens. "Expose everything" is the wrong target — 3 functions have zero consumers, ~12 are internal plumbing, `getTeamActivity()` returns `[]` unconditionally, and ~20 are paged list readers that are **one** voice verb, not one-per-parameter.

**Ninety-odd functions collapse to ~30 launch intents. The curated allow-list is a feature** — it is what stops a new internal helper from silently becoming voice-reachable.

```ts
export type VoiceIntent = {
  id: IntentId;                 // 'tasks.today.count' — stable, never renamed
  kind: 'read' | 'write' | 'navigate';
  gate: Gate;                   // structurally cannot be flag-only (below)
  args: Schema;                 // becomes the tool's input_schema, strict:true
  confirm?: (args, resolved) => ConfirmSpec;   // REQUIRED when kind === 'write'
  say: Record<Lang, (data) => string>;         // fresh / stale / degraded, 5 languages
  run: (args, ctx) => Promise<Outcome>;        // a DIRECT import of the api.ts fn
  offline: 'cache' | 'queue' | 'refuse' | 'local';
};
```

`run` holds a **direct import**, so `tsc --noEmit` (already a green gate) breaks the moment someone renames `getCommissionSummary`.

**Drift guard for *new* functions** — a test in the suite that already runs on every commit:

> New feature → add the function → `npm test` goes red → either add a registry entry, **or** add one line to `NOT_VOICE_EXPOSED` with a written reason.

### Where each piece runs

| Layer | Runs on | Holds |
|---|---|---|
| Tool catalogue (JSON schemas + system prompt) | **Backend**, versioned, generated from the app registry | canonical; filtered per-request by the JWT's role |
| NLU call | **Backend** — `POST /api/voice/interpret` | the Anthropic key never enters the APK |
| Guard table | **Both** — server filters the catalogue, phone re-checks before dispatch | defence in depth |
| Execution — **reads AND writes** | **Phone**, via existing `src/data/api.ts` | see below |
| Answer rendering | **Phone**, templates | |
| TTS synthesis | Backend proxy (key protection) + phone playback | |

**Why the phone executes writes too** — this is the load-bearing defence:

1. **Every gate already lives on the phone** (`canViewClients`, `canViewOwnClients`, `isSalesAdvisor`, `capabilitiesOf`, the four real-role master predicates). A backend executor would reimplement all of it in a second language, kept in step by hand. This project already carries **two** such hand-mirrors and both are documented as drifting silently. Do not add a third, on the security path.
2. **`api.ts` is not a thin HTTP client — it is a policy layer.** Executing through it inherits for free: retry rules (**writes get exactly one attempt**, so a spoken clock-in cannot double-fire), `Idempotency-Key` per logical create, the offline write queue, `reportIfOutage` honesty (401/403/404/501 are *answers*, not outages), typed outcomes, and `resetApiState()` shared-handset teardown.
3. **Token scope.** The NLU proxy needs **no data authority at all** — it takes a transcript and returns a verb. Its blast radius if compromised is *"can suggest a wrong verb"*, not *"can read the book"*.

*Honest trade-off:* an intent needing 3 collections does 3 round trips. If one becomes visibly slow, add **one** backend composite read endpoint for it — a normal API addition — not a general server-side executor.

### RBAC — three layers

| # | Layer | Enforces | If it alone existed |
|---|---|---|---|
| 1 | **Catalogue filter, server-side, from the JWT** | the model never *sees* a tool the user may not run, so it cannot propose it | phone could lie about role |
| 2 | **Phone-side gate, pre-dispatch, live `user` + `viewAs` + `can()`** | the app's owner-locked predicates | bypassable by a modified APK |
| 3 | **Backend endpoint 403** | the actual authority | — |

Layer 1 matters more than it looks: it is what stops a team advisor from even *learning* that a client book exists by asking.

⚠️ **Layer 3 is currently ABSENT for the highest-PII intents.** `src/store/roles.ts:150-155` records that the backend's `GET /clients` and `/clients/:id` have **no role gate today** and leak the unowned book to every token (already filed to INBOX, owner-owned). **Voice widens the attack surface on an already-open endpoint.** Say this out loud in the build plan; do not describe the defence as three-deep when it is two-deep for the intents that matter most.

### Making the fail-open flag trap structurally impossible

The trap, restated: `canIn()` falls back to `SCHEMA_FEATURE_DEFAULTS`, and to `DEFAULT_UI`'s all-true on a total outage — and per-role docs are **unseeded in prod**. Verified this session: **4 of 14 flags default `true`** (`can_clock_in`, `can_create_task`, `can_create_claim`, `can_claim_ticket`); **10 default `false`.** This has already bitten twice — a Home create button, and two whole *widgets* that rendered the team roster and org totals to a team advisor.

Fix it in the type system:

```ts
export type Gate =
  | { kind: 'self';       flag?: FeatureKey }   // any signed-in user, on their OWN data
  | { kind: 'caps';       cap: CapKey; flag?: FeatureKey }  // cap is REQUIRED; flag can only NARROW
  | { kind: 'clientBook'; scope: 'own' | 'whole' }          // the owner-locked Point 9 invariant
  | { kind: 'realMaster' }                                   // reads the REAL role (leader folded OUT)
  | { kind: 'realAdmin' };                                   // payroll: the endpoint 403s a leader
```

**There is no `{ kind: 'flag' }` variant.** A developer who wants to gate on a flag alone must pick `self` and name it — a reviewable decision, not an accident.

🔴 **Critical fix the research got wrong and the verifier caught.** The naive narrowing helper —
```ts
const flagOk = (f?) => !f || !ready || can(f) !== false;
```
— **silently kills two of its own intents.** `can_view_team_roster` and `can_dispatch_notification` both default **`false`**, and prod role configs are unseeded, so `team.onduty` and every `notify.*` intent would be **refused for master and admin too** — and would only work during a *total config outage*, i.e. the feature works when the network is down and fails when it is up. `tsc` and `npm test` cannot see this. Correct form:

```ts
const flagOk = (f?) => !f || !ready || config.features?.[f] === undefined || can(f) !== false;
```

### Read path vs write path

**Reads execute directly. Every write requires a tap. No exceptions at launch.**

Each read intent has **three** answer variants, not one — carrying the app's existing honesty rule (`useDataHealth().degraded` — *"no clients"* ≠ *"could not load clients"*) into speech:

| Variant | Spoken |
|---|---|
| fresh | *"Aaj 4 kaam hai, 1 late hai."* |
| stale (from cache) | *"Aaj 4 kaam — 10:40 ka data, abhi net nahi hai."* |
| degraded | *"Abhi pata nahi chal raha."* — **never a zero** |

**Write sequence, exactly:**

1. Model returns a write intent. **Nothing is sent anywhere.**
2. Gate check → refused = speak the refusal, stop, render nothing.
3. Missing required arg → one targeted slot-fill question. Never a guess.
4. **Confirmation card** (a `Sheet`, not `Alert` — `Alert.alert` doesn't fire callbacks on web) showing: the verb as a question in the user's language; **every resolved field as its own row with the display name, not an id**; the **raw transcript in small grey text at the bottom, tappable to edit**; two buttons `Haan, save karo` / `Cancel`. Destructive verbs never get a primary-coloured button.
5. **Spoken line = the one-sentence question only.** Never read the whole card aloud.
6. User taps. `haptics.tap()`.
7. Execute → **speak the typed outcome:**

| Outcome | Haptic | Spoken (hi-en) |
|---|---|---|
| `saved` | `success()` | "Ho gaya — task ban gaya." |
| `queued` (note/task/lead only) | `success()` | "Net nahi hai. Save kar liya — network aate hi bhej denge." |
| `forbidden` (403) | `warn()` | "Aapko iski permission nahi hai." |
| `invalid` (400) | `warn()` | the server's own message, spoken |
| `unsupported` (404/501) | `warn()` | "Yeh abhi server pe chalu nahi hai." |
| `network` / `server` | `error()` | "Server tak nahi pahuncha — **kuch save nahi hua**." |

> **"Ho gaya" is reserved for `saved`.** That single rule is most of the quality of a voice assistant in the field.

⚠️ **One real code change this needs:** `WriteFailure` (verified at `api.ts:118`) is `'network' | 'server' | 'forbidden' | 'unsupported' | 'invalid'` — **there is no `timeout` member.** The Phase-76 NAT64 bug was invisible for weeks because the app mislabelled a TLS stall as "could not reach the server." Voice must not repeat it: *"Jawab time pe nahi aaya"* ≠ *"Server tak nahi pahuncha."* Extending that union is a real edit to a 4,220-line danger-zone file — budget for it, do not assume it is free.

**Special-cased writes:** `clock.in`/`clock.out` must run the **existing** home-screen flow (geofence via `checkGeofence`, the out-of-range mandatory-reason sheet, the <8h30m early-clock-out reason) — voice supplies the *intent*, never a bypass of a compliance prompt that reports to super_admin. `reminder.ack` is **one-way with no un-acknowledge**, so the card must say *"Ye wapas nahi ho sakta."*

### Ambiguity, errors, multi-turn

**Five outcomes. There is no sixth, and no "best guess".**

| Outcome | Trigger | UX |
|---|---|---|
| Resolved | known intent, gate ok, slots filled, one match, confidence ≥ T | execute |
| **Disambiguate** | 2+ entity matches | `useConfirm().choose()` sheet — **already exists**, `Confirm.tsx:37` |
| Slot-fill | required arg missing | one targeted question, re-open the mic |
| Low confidence | conf < T | show transcript, *"Aapne yeh kaha?"*, offer edit + 3 nearest intents |
| Unknown | no tool, or an unknown intent id | honest refusal + fall back to global search |

**Names are tapped, never re-spoken.** Repeating a name the STT already misheard produces the same mishearing. That is why disambiguation is visual.

**Degradation ladder for unknown requests** — copy `pushRouting.ts`'s posture verbatim (*"we never navigate on a guess"*): (1) transcript has a searchable noun → run search and **say so**: *"Samajh nahi aaya, isliye search kar diya."* (2) nothing searchable → *"Yeh main abhi nahi kar sakta. Aap yeh keh sakte ho: …"* with **two** examples from this user's own permitted set. (3) log `{transcript, lang, topCandidate, confidence}` — transcript only, no user id, no entity.

**Multi-turn is required, not a nice-to-have.** *"aur uska number?"* is how Hindi and Gujarati are actually spoken; a one-shot assistant forces every utterance to re-name the person — exactly the step STT gets wrong.

Keep it **minimal, in memory, on the phone**: last 6 turns (text only) + one entity slot + last intent id. Sent to the NLU: **last 3 turns + `slot.kind` and `slot.label`** — never the id, never a phone number, never a ₹ figure. **Pronoun resolution happens on the phone**, not in the model. **The slot is re-gated on use** (a master who switches "view as" to Team mid-session must lose a client slot). Cleared on: 90 s idle · sheet closed · backgrounded >5 min · sign-out · silent-401 · view-as change. **Never persisted**, and **wired into `resetApiState()` in the same commit that creates it, with a test** — this is a documented danger zone; the module already holds per-user Maps that a storage purge does not touch.

### Offline — four tiers

On rural links this is the dominant path, not an edge case.

| Tier | What | Covers |
|---|---|---|
| **1. Local navigation, zero network** | An on-device table mapping the 5-language labels already in `MORE_CATALOGUE` (**20 keys**, verified) onto routes, matched with the existing scorer | *"attendance kholo"*, *"WhatsApp"*, *"notes"* — plus the **top 8 read phrases as exact-phrase shortcuts**, so *"aaj kitne kaam hai"* works with no network at all |
| **2. Cached reads** | Exactly four reads are cached: `getTasks`, `getLeads`, `getReminders`, `getNotifications` | tasks / leads / reminders / notifications — **must** carry the staleness timestamp in the spoken reply |
| **3. Queued writes** | `QueueKind` is `'note' \| 'task' \| 'lead'` **and nothing else** (verified: exactly three `enqueueWrite` call sites) | only on a *thrown* network failure — a server refusal is never queued |
| **4. Honest refusal** | **Every write except note, task and lead** fails hard offline | *"Net nahi hai, clock-in nahi ho payega."* **Never queue a clock-in** — a timestamp written 40 minutes late is a payroll error, not a recovery |

**Audio on a weak link:** cap recordings at ~15 s with a visible countdown; low-bitrate mono; **upload once, never retry** (a silently retried voice command is a double clock-in waiting to happen); make `/voice/interpret` a **POST** so it inherits the existing no-retry rule for writes.

### The launch intent table

**READ — 14**

| Intent | Example | Calls (real `api.ts` fn) | Gate | Offline |
|---|---|---|---|---|
| `tasks.today.count` | "aaj kitne kaam hai" | `getTasks(true)` + `todayWorkload` | self | cache |
| `tasks.today.list` | "aaj ke tasks batao" | `getTasks(true)` | self | cache |
| `tasks.overdue` | "kya late hai" | `getTasks(true)` | self | cache |
| `person.phone` | "Ramesh ka number" | `search(q)` | **clientBook:own** for clients; self for leads/team | refuse (clients) |
| `clock.status` | "main clock-in hu?" | `getClockState()` | self | refuse |
| `attendance.summary` | "is mahine kitne din" | `getAttendanceHistory()` | self | refuse |
| `commission.summary` | "is mahine ka commission" | `getCommissionSummary()` *(server self-scopes to the token — voice cannot ask for someone else's)* | self | refuse |
| `earnings.my` | "meri salary" | `getMyEarnings(month)` | self | refuse |
| `reminders.today` | "aaj ke follow-up" | `getReminders()` | self | cache |
| `notifications.unread` | "koi naya message" | `getNotifications()` | self | cache |
| `leads.pipeline` | "kitne leads hai" | `getLeads()` | self | cache |
| `claims.pending` | "kitne claim pending" | `getClaimsSummary()` | self | refuse |
| `client.detail` | "Ramesh ki policy" | `getClient(id)` | **clientBook:own** | refuse |
| `team.onduty` | "kaun duty pe hai" | `getTeam()` | caps:manageTeam + flag *(see the `flagOk` fix)* | refuse |

**WRITE — 9, all tap-confirmed**

| Intent | Example | Calls | Gate | Offline | Card shows |
|---|---|---|---|---|---|
| `note.add` | "note likho — Ramesh ne call kiya" | `addNote` | self | **queue** | full text + transcript |
| `task.add` | "Priya ko kal renewal ka task do" | `addTask` | caps:assignTasks + flag | **queue** | title, assignee, due |
| `lead.add` | "naya lead — Suresh, 98…" | `addLead` | self | **queue** | name, phone, source |
| `clock.in` | "clock in karo" | `checkGeofence` → `clockIn` | self + `can_clock_in` | refuse | office, distance, reason if out of range |
| `clock.out` | "clock out" | `clockOut` | self + `can_clock_in` | refuse | hours worked; reason if <8h30m |
| `break.start` / `.stop` | "break pe ja raha hu" | `startBreak` / `stopBreak` | self | refuse | current state |
| `task.done` | "yeh task complete" | `updateTaskStatus(id,'done')` | self | refuse | task title |
| `reminder.ack` | "yeh ho gaya" | `toggleReminder(id)` | self | refuse | **"wapas nahi ho sakta"** |
| `claim.add` | "naya claim register karo" | `addClaim` | **clientBook:own** + `can_create_claim` | refuse | client, type, ref |

**NAVIGATE + OS handoff — 7**

| Intent | Example | Target | Gate | Offline |
|---|---|---|---|---|
| `nav.module` | "attendance kholo" | `MORE_CATALOGUE[key].href` (**20 keys**) | **the destination screen's own gate, per key** | **local** |
| `nav.admin` | "payroll kholo" | ⚠️ **separate table** — `payroll`/`monitor`/`agent-map`/`team`/`analytics`/`campaigns`/`notify` are **deliberately NOT in `MORE_CATALOGUE`** (verified) | `realAdmin` / `realMaster` per target | local |
| `nav.search` | "Ramesh dhundo" | `/search?q=` | self | local |
| `nav.task` | "wo task kholo" | `/task/[id]` | self | local |
| `nav.client` | "Ramesh ki file kholo" | `/client/[id]` | **clientBook:own** | refuse |
| `act.call` | "Ramesh ko call karo" | `lib/actions.ts` `call(phone)` — `Linking.openURL` | gate of the entity's source | refuse |
| `act.whatsapp` | "Ramesh ko WhatsApp karo" | `lib/actions.ts` `whatsapp(phone,msg?)` | gate of the entity's source | refuse |

**A navigate intent is gated identically to its screen** — otherwise voice becomes a deep-link bypass around the **9** in-screen `<RestrictedNotice>` guards (verified count: 9, not 13). And the server-side catalogue filter **removes disallowed keys from the enum**, so the model cannot even name them. `act.call`/`act.whatsapp` are OS handoffs — the irreversible step stays in a human thumb — but they still get a confirm card showing name **and number**, because the failure mode is calling the wrong Ramesh.

**NOT in the launch registry** (listed in `NOT_VOICE_EXPOSED` with a written reason): `sendWaMessage` *(a real message to a real client — v2, once the confirm card is proven)*, `sendCampaign` *(bulk fan-out)*, `dispatchNotification` *(broadcast)*, `deleteNote`, `deleteAccount`, `setLocationConsent` *(consent must be given on the consent screen, never by voice)*, `uploadFile`, `reassignTask`, `updateTicket`, `generateReport` *(15–40 s n8n render — belongs on the Jobs pattern)*.

### Model choice and call shape (verified against current API docs)

| Model | Input $/1M | Output $/1M | Notes for a classifier |
|---|---|---|---|
| **Claude Haiku 4.5** (`claude-haiku-4-5`) | **$1.00** | **$5.00** | Standard fit for short-transcript→JSON. **Omitting `thinking` = no thinking = fastest.** ⚠️ `output_config.effort` **errors** on Haiku 4.5 — do not send it. |
| Claude Sonnet 5 (`claude-sonnet-5`) | $2.00 | $10.00 | Premium variant |
| Claude Opus 5 (`claude-opus-5`) | $5.00 | $25.00 | The library default. ⚠️ **Thinking is ON by default** — omitting `thinking` runs adaptive, a silent latency and cost surprise on a latency-critical route |

**The model tier is your call, not mine** — §9 prices all three. Call shape either way: **one** call, `strict: true` + `additionalProperties: false` on every tool schema (guarantees `tool_use.input` validates exactly), the catalogue as a **stable cached byte-prefix** (render order is `tools` → `system` → `messages`, so a frozen tool list caches cleanly; cache read ≈ **0.1×** base, write ≈ **1.25×**, default TTL **5 minutes**).

**Do NOT use tool search / deferred loading at launch.** It is a real current feature and the right answer at 100–1,000 tools; at ~30 it *adds* a search round-trip and a failure mode (search misses → tool never loads → *"I can't do that"* for something the app can do). Revisit if the registry grows past ~80 entries — that threshold is a judgement call, not a published number.

⚠️ **Measure the catalogue, don't estimate it.** Run `client.messages.countTokens({ model, messages, system, tools })` on the real catalogue once and put the number in the spec. *(Note `messages` is required — omitting it 400s.)* The caching discount only pays on a **hit**, and with 21 people issuing sporadic commands the 5-minute cache will often be **cold**. State your assumed hit rate; do not assume 90% savings.

---

## 8. Multi-language handling

| Layer | What it does | What comes out |
|---|---|---|
| **1. App** | Sends `language_code` from the user's existing i18n setting: `hi`/`hi-en` → `hi-IN`, `gu`/`gu-en` → `gu-IN`. Auto-detect (omit the code) is the fallback for "any Indian language" | — |
| **2. STT (Sarvam `saaras:v3`, `mode=translit`)** | Covers **23 languages** (22 scheduled Indian + English). Handles code-mixed input as a designed feature, not an accident | **Latin script, always.** `"aaje na tasks batao"`, `"mera naya lead add karo"` |
| **3. Latin-script assert** | Rejects anything containing Devanagari/Gujarati characters and fails loudly | guards against a silent model/version regression |
| **4. NLU (Claude)** | Sees Latin-script Gujlish/Hinglish — the **same script as the tool names and few-shot examples**, which is the easy case for an LLM, not the hard one. Give it real Gujlish examples in the system prompt, not translated English | `{intent_id, args, confidence}` |
| **5. Entity resolution** | Latin-script name vs Latin-script database, via the existing scorer. A misheard name is a typo; the matcher already grants **2 edits at ≥7 characters** | resolved id, or 0/1/many |
| **6. Answer** | **Templated, human-written, per language**, through the existing `t(key, params)` (named `{placeholder}` interpolation + CLDR plurals, Phase 21 P0) | correct Hindi/Gujarati word order |
| **7. TTS (Bulbul v3)** | Speaks it in a **native Indian voice** | audio |

**Never build a spoken sentence by string concatenation** — Hindi and Gujarati word order will break it. Use `t(key, {name})` / `t(key, {count})`.

**Machine translation is forbidden in this project (PHASE-19 §4) and that rule applies here.** Every new spoken string owes **five languages of human copy**. There is already an unpaid backlog of these. **Budget the copy as part of the feature, not as an afterthought** — at ~30 intents × 3 answer variants × 5 languages, this is real work and it is the single most under-estimated line in the whole plan.

⚠️ **One asymmetry to know now:** Saaras STT covers **22 Indic languages**; Bulbul **v3 TTS covers 11**. Gujarati, Hindi and English are all in both — so your primary case is safe. But if a Marathi or Bengali speaker joins, **the app will understand them and may not be able to speak back.** Fall back to text-only for an unsupported TTS language rather than speaking the wrong one.

---

## 9. THE MONEY — full calculation

### Assumptions — stated explicitly, all of them

| Input | Value | Basis |
|---|---|---|
| Team size | **21** | `staff_unified.json` = 21 records (5 super_admin, 2 admin, 14 advisor). 18 carry a name; 2 of those are not humans (`Ved Test`, `CGPE Operations Office-2`) → **~16 real people.** Sized at 21 for headroom, so every figure below is a slight **over**-estimate |
| Working days/month | 25 | assumption |
| Avg audio in | **6 seconds** per command | assumption |
| Avg spoken reply out | **150 characters** | assumption |
| LLM tokens per turn | ~4,200 in (catalogue + system + transcript + 3 turns), ~80 out | **assumption — MUST be measured with `countTokens` before you budget** |
| Cache hit rate | **50%** blended (5-min TTL, sporadic traffic) | assumption; the no-cache worst case is also shown |
| FX | **₹96 = US$1** | USD/INR ≈ 95.7 on 2026-08-25 (TradingEconomics / BookMyForex) |

### Volumes

| | commands/user/day | interactions/mo | STT hours | TTS characters |
|---|---|---|---|---|
| **Light** | 5 | 2,625 | 4.4 | 393,750 |
| **Expected** | 15 | 7,875 | 13.1 | 1,181,250 |
| **Heavy** | 40 | 21,000 | 35.0 | 3,150,000 |

### A. RECOMMENDED — Sarvam Saaras v3 STT + Claude Haiku 4.5 NLU + Sarvam Bulbul v3 TTS

*Unit prices: STT ₹30/hr **billed per second** (verified). TTS ₹30 per 10,000 chars (verified, v3 beta). Haiku 4.5 $1.00/$5.00 per 1M tokens (verified).*

| | STT | LLM *(no cache)* | LLM *(50% cache)* | TTS | **Total/mo** *(50% cache)* | **Per user/mo** |
|---|---|---|---|---|---|---|
| **Light** | ₹131 | ₹1,159 | ₹706 | ₹1,181 | **₹2,018 ≈ $21** | **₹96** |
| **Expected** | ₹394 | ₹3,478 | ₹2,117 | ₹3,544 | **₹6,055 ≈ $63** | **₹288** |
| **Heavy** | ₹1,050 | ₹9,274 | ₹5,645 | ₹9,450 | **₹16,145 ≈ $168** | **₹769** |

*Worst case, zero cache hits: Light ₹2,471 · **Expected ₹7,416 (≈$77, ₹353/user)** · Heavy ₹19,774.*
**Platform fee: ₹0.** n8n is self-hosted and already running; the droplet is already paid for.

### B. CHEAPER VARIANT — same, but **Bulbul v2** TTS (₹15/10k chars, verified)

| | **Total/mo** | **Per user/mo** |
|---|---|---|
| Light | **₹1,428 ≈ $15** | ₹68 |
| **Expected** | **₹4,283 ≈ $45** | **₹204** |
| Heavy | **₹11,420 ≈ $119** | ₹544 |

*Trade-off: v2 has fewer/older voices than v3's 30+. Include both in the listening test — if advisors can't tell them apart, take the 30% saving.*

### C. PREMIUM VARIANT — Sarvam STT + **Claude Sonnet 5** NLU + **ElevenLabs v3 Conversational** TTS

*ElevenLabs at the published ElevenAPI rate card $0.05/1,000 chars = $50/1M. **⚠️ Whether you can buy at that rate without a subscription is unverified.***

| | STT | LLM (50% cache) | TTS | **Total/mo** | **Per user/mo** |
|---|---|---|---|---|---|
| Light | ₹131 | ₹1,411 | ₹1,890 | **₹3,432 ≈ $36** | ₹163 |
| **Expected** | ₹394 | ₹4,234 | ₹5,670 | **₹10,298 ≈ $107** | **₹490** |
| Heavy | ₹1,050 | ₹11,290 | ₹15,120 | **₹27,460 ≈ $286** | ₹1,308 |

### If you buy an ElevenLabs SUBSCRIPTION instead of the rate card

| Plan | $/mo | ₹/mo | Credits/mo | Covers Expected volume (1.18M chars)? |
|---|---|---|---|---|
| Creator | $22 | ₹2,112 | 121,000 | ❌ — test only |
| **Pro** | $99 | **₹9,504** | 600,000 | **⚠️ Only if v3 Conversational bills at 0.5 credits/char — inferred from the rate card, NOT documented** |
| Scale | $299 | ₹28,704 | 1,800,000 | ✅ with room |
| Business | $990 | ₹95,040 | 6,000,000 | ~5× overkill — **do not buy** |

**Note the finding buried in this:** subscription credits are worth roughly **1.65× less per character** than the published rate card. At Expected volume the rate card (₹5,670) beats Pro (₹9,504). **Two numbers must be read off the live dashboard before you pay anything:** (1) does v3 Conversational bill 0.5 or 1.0 credits/char, and (2) **does Scribe STT draw from the same credit pool?** One third-party source says ~330 credits/minute, which would add ~260,000 credits/month at Expected volume and change the answer. Both are **login-gated and unverified.**

### One-time and free

| Item | Cost |
|---|---|
| Sarvam free credits | **₹100** — enough for the `translit` test and a first bake-off batch |
| **ElevenLabs Creator, 1 month, for the blind A/B** | **$11 (≈₹1,056)** ← this is the only thing to buy today |
| Google Chirp 3 HD, third bake-off arm | **₹0** — 1M free chars/month *(third-party sourced)* covers the entire Light scenario |
| ElevenLabs Free tier | ❌ **no commercial licence** — legally unusable in a company app |

### Cost levers, in order of size

1. **Default to mute (text-only) until the user opts into speech.** If half of turns are silent, **TTS halves** — the largest single line at Expected volume in the cheaper variants. This is also the right *product* default (§6).
2. **Make prompt caching actually hit.** Freeze the tool list byte-for-byte, keep volatile content after the last breakpoint, and verify with `usage.cache_read_input_tokens`. If it reads zero across repeated requests, a silent invalidator is at work. Worth **~₹1,360/mo** at Expected volume on Haiku.
3. **Model tier.** Haiku 4.5 → Sonnet 5 doubles input and output cost. Opus 5 is 5×.
4. **Shorter templated replies.** 150 chars → 100 chars is a straight 33% TTS cut, and shorter answers are *better* answers for field staff.

**Every price above is from a vendor page fetched 2026-08-26 except: the ElevenLabs PAYG per-credit rate (login-gated), whether v3 Conversational is 0.5 credits/char, whether Scribe draws credits, Google's free-tier size (third-party), and Sarvam's TTS latency (unpublished). Confirm each before purchase.**

---

## 10. Quality plan

**Quality aapki #1 priority hai — toh yeh saaf kehna zaroori hai ki quality kahan se aati hai.**

### What actually drives quality here (ranked)

| # | Driver | Why it dominates |
|---|---|---|
| 1 | **STT accuracy on Gujarati/Gujlish** | Everything downstream is built on the transcript. 12–20% field WER is the ceiling, and no vendor choice escapes it. |
| 2 | **Entity resolution** | *"Ramesh"* → the right Ramesh. Constrained matching against the real book beats a better model. |
| 3 | **Never lying about an outcome** | *"Ho gaya"* when it means *"tried"* destroys trust in one week. Everything else is recoverable. |
| 4 | **Perceived latency** | Transcript on screen at ~1.2 s matters more than shaving 300 ms off the total. |
| 5 | **The spoken copy itself** | Human 5-language templates. A model-written Gujarati sentence is a guess. |
| 6 | Vendor choice for the voice | Real, but decided by ears, not docs — and last in this list, not first. |

### The concrete measures

1. **Show the transcript, always, editable.** Your own code already does this and already explains why.
2. **Confirm-before-write on every write, without exception.** Reads execute directly.
3. **Three answer variants per read** — fresh / stale / degraded. *"Koi task nahi hai"* when the request actually **failed** is worse than useless to a field advisor.
4. **The typed-outcome vocabulary**, spoken exactly (§7). `say` must be a **total function** over the outcome union so the compiler refuses a missing branch.
5. **Streaming, once v1 is proven** — streaming STT while the user is still speaking, streamed TTS starting on the first chunk. Worth ~1.5 s on the weak-network path.
6. **Fallbacks that never lie:** if TTS fails, the text answer still renders. Speech is never a hard dependency of an answer.

### Measure accuracy BEFORE rollout — the test set

**Build a 100-utterance test set from your own 21 staff, before writing the NLU prompt.** Record them saying real commands, in the field, on their own phones, on their own networks. Roughly:

| Segment | Count |
|---|---|
| Gujarati (pure) | 25 |
| Gujlish (Gujarati + English mixed) | 25 |
| Hindi / Hinglish | 25 |
| Noisy environment / on a scooter / weak signal | 15 |
| Deliberately ambiguous ("Ramesh ko call karo" with 3 Rameshes) | 10 |

**Measure the two numbers that matter — and note they are NOT word error rate:**

| Metric | Target before rollout |
|---|---|
| **Intent accuracy** — did it pick the right verb? | **≥95%** |
| **Entity accuracy** — did it pick the right person/record? | **≥90%** |
| Wrong-write rate (a write executed that the user did not want) | **0** — the confirm tap should make this structurally impossible; if it isn't 0, the design is broken |

WER can be 18% and intent accuracy still 96%, because the verb words (`banao`, `dikhao`, `kholo`, `karo`) are short, high-frequency, and few. **That is the whole reason this is shippable at 15% WER.** Measure the thing you actually care about.

*Cost note: the offline eval set can run through the **Batches API at 50% cost** — it is not latency-sensitive.*

### The blind TTS test — the single highest-value thing you can do this week

Generate **the same 10 Gujarati sentences and 5 Gujlish sentences** on:

- **Sarvam Bulbul v3** (₹100 free credits)
- **Google Chirp 3 HD** (1M free chars/month — free)
- **ElevenLabs v3 Conversational** ($11 Creator)

Play them to **5 real advisors** without telling them which is which. Ask one question: *"Kaunsi awaaz aapke client ke saamne bajaana theek lagega?"*

> **That test is worth more than this entire document.** Everything above is docs and price cards.

---

## 11. Phased build plan

**Constraint that shapes everything: there is NO OTA.** Verified: `expo-updates` is absent from `package.json`, **there is zero audio dependency of any kind** (no `expo-audio`, no `expo-av`, no `expo-speech`), and `app.json` has **no `RECORD_AUDIO` permission**. So the voice feature needs **at least 2–3 new native modules and a new permission**, and every change to them means a **full APK rebuild and a manual reinstall on ~21 handsets.**

| Phase | Delivers | Rough effort | Native rebuild? |
|---|---|---|---|
| **v0 — the pure core, no microphone** | `voice/registry.ts` (~30 intents), `guards.ts` (the `Gate` union + the `flagOk` fix), `resolve.ts` (via `searchScore.ts`), `answer.ts` (templates), `dispatch.ts`, `localIntents.ts`. Backend `POST /api/voice/interpret`. Drive it with a **text box**, not a mic. Fully testable in `npm test` and on Expo web. Plus: extend `WriteFailure` with `timeout`; add a **build/version stamp to `GET /api/health`** so anyone can confirm in one second which commit is live | **the largest phase** — but it is where all the risk lives, and it costs **zero** APK cycles | **❌ NO** |
| **v0.5 — the 5-language copy** | ~30 intents × 3 answer variants × 5 languages of **human** copy. Runs in parallel with v0. This is the most under-estimated line in the plan | real, and non-negotiable | ❌ NO |
| **v1 — the microphone** | `expo-audio` (record + play) + `RECORD_AUDIO` + the DPDP consent version bump + `VoiceAvatar` (Reanimated orb) + `VoiceSheet` + the Sarvam adapters. **Ship ~12 read intents + the 3 queueable writes.** ⚠️ **Add EAS Update in this SAME rebuild** | medium | **✅ YES — one APK** |
| **v2 — the rest** | Remaining intents, streaming STT over a WebSocket (⚠️ **the app has no socket/WS client today — that is another native dependency**), streamed TTS, multi-turn slots, `sendWaMessage` once the confirm card is proven | medium | ✅ likely one more |

### The sequencing rule that saves you

> **Build and test the ENTIRE pure core against typed transcripts with zero audio. Prove it in `npm test` and on the web. Add the mic LAST — one APK, one rebuild.**

The failure mode to avoid: everything is built, then found to be un-shippable because audio is native and there is no OTA.

### 🔴 Add EAS Update — this is the standing recommendation and voice makes it urgent

Adding EAS Update **is itself a native change** (it gets baked into a build), so it must ride along in the v1 APK. Do it, because:

- The NLU prompt, the intent examples, the spoken templates, and the confidence threshold **will all need many iterations** after real advisors use it.
- Without EAS Update, **every one of those iterations costs a full rebuild + a manual reinstall on ~21 phones.**
- With it, the JS half of the voice layer is fixable in minutes.

*(EAS Update's own pricing tier is **unverified** — check it against your current EAS plan.)*

### Gates before anything ships

`npx tsc --noEmit` clean · `npm test` green (including new `coverage.test.ts` + `guards.test.ts`) · cache-free `npx eslint src/voice src/ui/Voice*` (watch the `preserve-manual-memoization` dep trap — a hook reading `user?.id` infers `user`) · and the affected `TESTING_GUIDE.md` rows walked **on a real device**, because none of the three gates can see a microphone, a keyboard-swallowed tap, or a spoken Gujarati sentence.

**And confirm the backend is actually deployed** before telling anyone it works: prod deploys **only `origin/main`**, and this team has already lost weeks to features that were "shipped" onto unmerged branches and simply did not run on the phone.

---

## 12. Risks + what could go wrong

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **`mode=translit` may not work for Gujarati.** No Sarvam page demonstrates it — every published example is Hindi | 🔴 **build-stopping** | **Test it first, before any code.** ₹0, 10 minutes. If it returns Gujarati script, the entity-resolution half of the design must be redesigned |
| 2 | **The Gujarati accuracy ceiling.** Plan for **12–20% field WER**, not the 3.1% on vendor pages. Roughly one word in six on a bad connection | 🔴 high, **unavoidable** | Confirm-before-write, visible editable transcript, constrained entity matching, and a measured test set. Design for the error rate — don't pretend it away |
| 3 | **"Sarvam Audio" in the independent benchmark is not confirmed to be Saaras v3.** Saarika 2.5 appears separately, so it is some *other* Sarvam product | 🟠 medium | Saaras v3's field Gujarati WER is **unmeasured by any third party.** Your own 100-utterance test set is the only real answer |
| 4 | **Cost drift — the LLM is the dominant line, not the voice.** Token count is an assumption and the cache may rarely hit on sporadic traffic | 🟠 medium | Measure with `countTokens` before budgeting; verify `cache_read_input_tokens` is non-zero; cap the catalogue; default to mute |
| 5 | **n8n coupling creeps back in.** "Just this one thing through n8n" is how the authorization boundary erodes | 🟠 medium | The rule is one sentence: *speech can route anywhere; authorization routes only where the rules already live.* Voice hands off to n8n **only** for slow, delivery-shaped work |
| 6 | **Layer 3 of the RBAC defence does not exist for the highest-PII intents.** `GET /clients` + `/clients/:id` have **no server-side role gate today** — already filed, owner-owned | 🔴 high | **Voice widens an already-open endpoint.** Close the backend 403 before shipping `client.detail` / `person.phone` / `nav.client` |
| 7 | **The fail-open flag trap silently kills two intents** — `can_view_team_roster` and `can_dispatch_notification` default `false`; `tsc` and `npm test` cannot see it | 🔴 high (verifier-caught) | Use the corrected `flagOk` (§7). Add a test asserting `team.onduty` is allowed for a master with an unseeded config |
| 8 | **A navigate intent becomes a deep-link bypass** around the 9 in-screen guards | 🟠 medium | Gate `nav.*` on the destination's own gate; strip disallowed keys from the model's enum server-side |
| 9 | **Conversation state survives a user switch on a shared handset** — the slot holds resolved client PII | 🔴 high | Wire the session into `resetApiState()` in the **same commit** that creates it, with a test |
| 10 | **The assistant says "ho gaya" for a `queued` or `network` outcome** | 🔴 high | Make `say` a total function over the typed outcome union so the compiler refuses a missing branch. And extend `WriteFailure` so a timeout isn't reported as unreachable |
| 11 | **The 5-language copy backlog.** ~30 intents × 3 variants × 5 languages, and machine translation is forbidden | 🟠 medium, **under-estimated** | Start the copy in parallel with v0. It is not a finishing task |
| 12 | **No OTA → every JS fix costs a rebuild + reinstall on ~21 phones** | 🟠 medium | Add EAS Update in the same v1 APK. Non-negotiable given how much prompt tuning voice needs |
| 13 | **Language asymmetry: Saaras STT = 22 languages, Bulbul v3 TTS = 11** | 🟡 low today | Fall back to text-only for an unsupported TTS language rather than speaking the wrong one |
| 14 | **DPDP: microphone is a new consent purpose** | 🟠 medium | New consent version, same versioned system that already gates 24/7 location. Not a technicality — this is why India-hosted vendors matter |
| 15 | **ElevenLabs Gujarati voices are not native speakers** | 🟠 medium if chosen | The blind listening test is the whole answer |
| 16 | **Backend deploy gap** — "shipped" ≠ live on `origin/main`; this has bitten before | 🟠 medium | Add a build/version stamp to `/api/health` in v0. It kills the entire class of bug |
| 17 | **Vendor lock-in on Sarvam.** Its own docs contradict each other on `mode` across v3/v4 | 🟡 low | Pin `saaras:v3`. Assert Latin-script output and **fail loudly**, so a silent model retirement presents as an error, not as *"search stopped finding people."* Note that **every fallback vendor outputs native script**, so a fallback needs its own romanization step |

---

## 13. Decisions the owner must make

**Before any code is written:**

1. **Run the `translit` Gujarati test.** Send one real Gujarati clip to Sarvam `saaras:v3` with `mode=translit` and `language_code=gu-IN`; read the output script. ₹0, 10 minutes. **If it comes back in Gujarati script, stop and re-plan.** Everything else waits on this.
2. **Approve the architecture: voice round-trip in Express, n8n stays where it is** (WhatsApp, campaigns, OTP, reports, alerts) and receives hand-offs for slow work. This is the answer to your main question.
3. **Buy ElevenLabs Creator — $22/mo ($11 first month) — for exactly one month**, to run the blind listening test. Nothing else. Do not buy Pro, Scale, or Business yet.
4. **Set up a Sarvam account** (₹100 free credits) and a Google Cloud TTS account (1M free chars/month) as the other two bake-off arms.
5. **Record the 100-utterance test set** from your own 21 staff — in the field, on their phones, on their networks. Segments in §10.
6. **Run the blind TTS A/B with 5 advisors** and pick the voice vendor from that, not from this document.
7. **Choose the NLU model tier** — Haiku 4.5 (₹6,055/mo at expected), Sonnet 5 (~₹8,200/mo), or Opus 5 (higher). **This is your cost/quality call, not mine.**
8. **Approve the monthly budget.** Recommended stack at expected use: **≈₹6,000/month ≈ $63 ≈ ₹288 per user.** Cheaper variant ₹4,283. Premium ₹10,298.
9. **Approve adding EAS Update** in the same APK as the microphone. Without it, every prompt tweak costs a reinstall on 21 phones.
10. **Commission the 5-language copy** (~30 intents × 3 answer variants) as a parallel workstream starting now. Human copy only.
11. **Decide the mute default.** Recommendation: **text-only until the user opts into speech** — better for advisors sitting in front of clients, and it roughly halves the TTS bill.
12. **Approve the launch intent list** in §7 — specifically the 9 writes and the 7 exclusions (`sendWaMessage`, `sendCampaign`, `dispatchNotification`, `deleteNote`, `deleteAccount`, `setLocationConsent`, `generateReport`). Say now if any belongs on the other side.
13. **OPS: close the backend `GET /clients` 403 gap** before voice ships `client.detail` / `person.phone` / `nav.client`. Already filed; voice makes it urgent.
14. **OPS: rotate the two n8n secrets** — the one that reached git history, and `N8N_WEBHOOK_AUTH_TOKEN=CGPE-Test-9f3k2j8s`. Unrelated to voice; worse if voice traffic grows.
15. **Before paying ElevenLabs anything beyond the $11:** log in and read two numbers off the live billing dashboard — (a) does v3 Conversational bill 0.5 or 1.0 credits/char, and (b) does Scribe STT draw from the same credit pool. Both are undocumented and both change the plan recommendation.
16. **Approve a new DPDP consent version** for the microphone purpose.

---

### Everything below is UNVERIFIED — do not treat as fact

ElevenLabs pay-as-you-go per-credit price (login-gated) · whether v3 Conversational bills 0.5 credits/char · whether Scribe STT draws from the TTS credit pool · ElevenLabs Agents per-LLM token pricing (no published table) · Sarvam's TTS latency (unpublished) · Sarvam's REST STT latency (unpublished) · whether `mode=translit` works for Gujarati (no example exists) · whether Sarvam `mode` works on `saaras:v4` (Sarvam's own docs contradict each other) · whether "Sarvam Audio" in the Voice of India benchmark is Saaras v3 · Google Cloud TTS free-tier size (third-party sourced) · Claude Haiku 4.5 real-world TTFT (~1.0 s, third-party benchmark) · rural-India 4G upload speeds (Ookla publishes no rural-4G upload median) · n8n per-execution overhead on your droplet (no published figure — measure it with 20 timed runs) · the LLM token-per-turn estimate (~4,200 in / ~80 out — **measure with `countTokens`**) · the 50% cache-hit assumption · EAS Update pricing on your current plan · the droplet's real `.env` values and whether nginx `proxy_read_timeout` was ever raised.