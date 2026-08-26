# Plan — Voice (n8n route) + the 9 reported problems — 2026-08-26

**Owner decision recorded:** proceed with the **n8n approach** for speed. The architecture doc
(`VOICE-ARCHITECTURE-DECISION-2026-08-26.md`) recommended Express; the owner has re-affirmed n8n after
reading it. **That is the owner's call and this plan follows it** — with ONE non-negotiable mitigation
carried over (§A1.4: n8n must act *as the user*, never touch Mongo directly for voice).

Every root cause below was **verified against the real code this session**. Nothing here is guessed.

---

# PART A — VOICE ASSISTANT (n8n)

## A1. The n8n contract — this is what I will build against

I need **one** n8n webhook. Everything else is my side.

### A1.1 The URL I expect

```
POST  https://ai.cgpe.in/webhook/cgpe-voice
```

- `ai.cgpe.in` already resolves to the same droplet (72.61.233.113) — verified.
- Give me the **exact production URL** (and the test URL if different). I will put it in the backend
  `.env` as `N8N_VOICE_WEBHOOK_URL`. **It will never be hardcoded in the APK.**
- It must be **HTTPS with a valid certificate**. A self-signed cert fails on Android with no useful error.
- `config/webhooks.js` already has resolvers for `whatsapp, hub, campaign, claim, chat, email, report,
  escalation, attendance, generic` — **there is no `voice` entry.** Add one, or I use `generic`.

### A1.2 What I will SEND (request)

`Content-Type: multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `audio` | file | `.m4a` (AAC), mono, 16 kHz, **max 15 s / ~1 MB**. I cap this on the phone. |
| `lang` | string | `hi-IN` / `gu-IN` / `en-IN` / `auto` — from the user's app language setting |
| `session_id` | string | stable per conversation, so you can do multi-turn |
| `request_id` | string (uuid) | **idempotency** — if you see the same id twice, return the first answer. Prevents a double clock-in |
| `screen` | string | current route, e.g. `/(tabs)/tasks` — context for the model |
| `history` | JSON string | last 3 turns, **text only** |

**Headers:**

| Header | Value | Why |
|---|---|---|
| `X-CGPE-Token` | the signed-in user's **JWT** | **the mitigation — see A1.4** |
| `X-CGPE-Request-Id` | same uuid | tracing |
| `X-CGPE-App-Version` | e.g. `1.11.0` | so you can branch on old clients |
| `X-CGPE-Webhook-Secret` | shared secret | so the webhook is not open to the internet |

I do **not** send the user's role as an authority. If you include it, treat it as a hint only.

### A1.3 What I expect BACK (response)

**HTTP 200, `application/json`, always this shape.** An empty body breaks the app —
note that the one existing chat-shaped n8n webhook (`routes/assistant.js:5-8`) is documented as
returning an empty body today, so this is a real failure mode to avoid.

```json
{
  "ok": true,
  "request_id": "the same uuid",
  "transcript": "aaj mere kitne task hai",
  "lang_detected": "hi-IN",
  "reply_text": "Aaj aapke 4 kaam hai, 1 late hai.",
  "action": {
    "type": "none",
    "route": null,
    "params": {},
    "intent_id": "tasks.today.count",
    "args": {},
    "confirm": null
  },
  "audio": { "mode": "url", "url": "https://.../reply.mp3", "mime": "audio/mpeg" },
  "confidence": 0.93,
  "error": null
}
```

**Field rules:**

| Field | Rule |
|---|---|
| `transcript` | **always** return it, even on failure. I show it on screen — the user must see what was heard. |
| `reply_text` | the sentence to display AND speak. Already in the user's language. Keep it **under 200 characters**. |
| `action.type` | `none` (just an answer) / `navigate` (I move the screen) / `confirm_write` (I show a confirm card first) |
| `action.route` | an app route exactly as the app spells it: `/(tabs)/tasks`, `/(tabs)/home`, `/client/[id]`, `/attendance`. I will **reject an unknown route** rather than guess. |
| `action.confirm` | required when `type = confirm_write`: `{ "title": "...", "rows": [{"label":"Name","value":"Ramesh"}], "confirmText": "Haan, save karo" }` |
| `audio.mode` | `url` **(preferred)** / `base64` / `none`. A URL keeps the response small on weak networks. |
| `audio.url` | must be reachable **without** auth, and live for at least 10 minutes |
| `confidence` | 0–1. Below **0.55** I will not act — I show the transcript and ask. |
| `error` | `null`, or `{"code":"stt_failed","message":"..."}` — codes: `stt_failed`, `llm_failed`, `tts_failed`, `forbidden`, `unknown` |

**Failure:** still return **HTTP 200** with `"ok": false` and a filled `error`. A non-200 is treated as an
outage. **Never return an empty body.**

**Timing:** target **3 s or less**, hard ceiling **8 s** — after that the app aborts and shows the transcript
with a retry. Note the measured reality: existing synchronous n8n calls in this system take **15–40 s**
(`N8N_PDF_TIMEOUT_MS` defaults to 120000). **The voice workflow must be built to a different budget.**

### A1.4 The one non-negotiable mitigation

> **For any data read or write, the n8n workflow must call the CGPE REST API using the `X-CGPE-Token`
> JWT I send — NOT the Mongo connection directly.**

Reason (verified): n8n holds full MongoDB credentials and bypasses `protect` and `visibilityScope`
entirely. Reading Mongo directly means a **team advisor could voice-pull the whole ~9,000-client book**,
which is the exact gate locked in Point 9. Calling `https://cgpe.in/internal/api/...` with the user's own
token makes every existing permission apply for free — and costs you nothing in n8n.

This is not a re-litigation of the n8n decision. It is the one line that keeps it safe.

### A1.5 What I build on the app side

`src/voice/` — registry of allowed routes/intents, confidence gate, confirm-card renderer, transcript
display, session/multi-turn state (wired into `resetApiState()` so it cannot leak across users on a shared
handset), audio record/play, and the avatar. Plus a thin `POST /api/voice/ask` proxy on Express whose only
job is to attach the secret and forward to n8n — **so the n8n URL and secret never ship inside the APK.**

---

## A2. ElevenLabs — what I need, and should you buy premium now?

### A2.1 Answer: **buy Creator ($22/mo, $11 first month). Do NOT buy premium yet.**

| Plan | Verdict |
|---|---|
| Free | **No commercial licence** — legally unusable in a company app |
| **Creator $22** | **Buy this now.** Commercial licence + full API + streaming. ~121,000 credits covers all development, the voice bake-off, and a pilot with real advisors. |
| Pro $99 | Later, only if measured usage needs it |
| Scale $299 / Business $990 | **Do not buy.** Business is ~5x more than 21 staff can consume. |

You can upgrade any month. Buying big now spends money before we know the real per-day command volume —
and the biggest cost lever (default-to-text-only) is not even switched on yet.

**Before paying anything beyond the $11, read two numbers off the live billing dashboard** (both are
undocumented publicly): (1) does the model bill **0.5 or 1.0 credits per character**, and (2) does **Scribe
STT draw from the same credit pool**. Both change which plan is correct.

### A2.2 What I need from you (exact list)

| # | Item | Notes |
|---|---|---|
| 1 | **API key** | Goes into **n8n credentials only**. Never in the app, never in git, never pasted in chat. |
| 2 | **Male `voice_id`** | Pick from the ElevenLabs voice library and send me the ID string |
| 3 | **Female `voice_id`** | Same |
| 4 | **Model id** | Use one that supports **Gujarati**. **Flash v2.5 does NOT support Gujarati** — do not pick it for speed. |
| 5 | **Output format** | Recommend `mp3_22050_32` for mobile — good enough, much smaller on weak networks |
| 6 | URL or base64 for the audio | URL preferred |

### A2.3 The honest caveat on Gujarati (already verified)

ElevenLabs **does** speak Gujarati, and there is **no Gujarati price penalty**. But its Gujarati voices are
**not native Gujarati speakers** — the library offers English-named voices (Jessica, Laura, Alice, Bill,
Brian) and ElevenLabs' own page says the voice *"retains its unique characteristics and accent."*

**Do this before locking the voice:** generate the same 10 Gujarati + 5 Gujlish sentences on ElevenLabs
**and** Sarvam Bulbul (₹100 free credits) **and** Google Chirp 3 HD (1M free chars/month), play them to 5
real advisors without telling them which is which, and ask: *"kaunsi awaaz client ke saamne bajaana theek
lagega?"* That test is worth more than any spec.

---

## A3. THE CHARACTER — the #1 priority

Owner requirement: *"jo bhi character screen me visible hoga woh bahut bahut extraordinary chahiye… UI
bahut important hai, ek dum aesthetic… proper agent lage… ek male aur ek female agent."*

### A3.1 My call: **half-body (shoulders-up bust), not full body**

| | Half-body (chosen) | Full body |
|---|---|---|
| Face size on a 6" phone | **Large — expression is readable** | Small; the face is where all the personality is |
| Space needed | Fits a bottom sheet with the transcript + confirm card | Needs most of the screen; pushes the actual answer off |
| Feels like | **a video call with an assistant** | a game character |
| Asset weight | lighter | heavier |

A voice assistant is a **conversation**, and a conversation is carried by a face. Full body wastes the
pixels on legs nobody looks at. Half-body also leaves room for the thing that actually matters — the
transcript and the answer.

### A3.2 The visual system

```
+-------------------------------------+
|              .-------.              |   <- aura ring: reacts to mic amplitude
|          .---|  bust |---.          |      (listening) / TTS envelope (speaking)
|          |   '-------'   |          |
|           \   glow      /           |   <- soft brand-gradient halo behind the head
|            '-----------'            |
|                                     |
|   "aaj mere kitne task hai"         |   <- transcript, always visible, EDITABLE
|                                     |
|   Aaj aapke 4 kaam hai, 1 late.     |   <- the answer, always on screen as TEXT
|                                     |
|        [  hold to speak  ]          |
+-------------------------------------+
```

**Six states**, one component:

| State | Character | Aura | Haptic |
|---|---|---|---|
| `idle` | slow blink, subtle breathing | still, dim | — |
| `listening` | attentive, head slight tilt | **pulses with your voice level** | `heavy()` on press |
| `thinking` | eyes glance up, small nod | slow orbital sweep — **never a spinner** | — |
| `speaking` | mouth movement driven by audio envelope | waveform ring | `tap()` at start |
| `error` | small apologetic shake | one red pulse | `error()` |
| `muted` | calm, closed-mouth smile | flat ring + mute glyph | — |

Male and female = **two asset sets behind one interface**, switchable live in Settings:

```
<VoiceAvatar persona="male"|"female" state={...} level={0..1} muted />
```

### A3.3 How we actually get "extraordinary" — you must pick one

**This is the one place where quality depends on an ASSET, not on code.** Three honest options:

| Option | What it is | Looks | Cost / time | New native dep? |
|---|---|---|---|---|
| **1. Coded avatar** (Reanimated) | Geometric/abstract stylised head + aura, all in code | Clean, premium, *abstract* — not a human character | **Ships fastest, ₹0** | **None** — Reanimated already installed |
| **2. Lottie character** (recommended) | Real illustrated bust, animated per state | **This is the "extraordinary" one** — a designed character | Asset needed: buy on LottieFiles, or commission (~₹5–15k for both genders), 3–7 days | `lottie-react-native` (+1 rebuild) |
| **3. Rive** | State-machine character, best interactivity | Excellent, smoothest transitions | Asset + a designer who knows Rive | `rive-react-native`, least common in Expo — hardest to debug |

**My recommendation: Option 2 (Lottie), with Option 1 shipped first as the fallback shell.**

I build `<VoiceAvatar>` with the coded version now so nothing is blocked; when the Lottie files arrive, they
drop in behind the **same interface** with no rewrite. That way "extraordinary" does not delay the feature,
and the feature does not lock us into an abstract blob forever.

**What I need from you:** either (a) approve commissioning 2 Lottie character sets (male + female, 6 states
each), or (b) say "coded only for now."

Because there is **no OTA**, every avatar asset change today costs a full APK rebuild + reinstall on ~21
phones. **This is a strong argument for adding EAS Update in the same build** (Phase 78).

### A3.4 Assistant Mode — the lockdown

Owner requirement: *"agar assistant mode koi enable kare to us app ko koi bhi operate na kar sake except the
assistant."*

**How it works:**
- A full-screen route that takes over the app. Bottom tabs **hidden**, not just disabled.
- Android hardware back + predictive back gesture **intercepted** (`predictiveBackGestureEnabled` is already
  `false` in `app.json` — verified, so this is straightforward).
- Every navigation goes through the assistant. Deep links are queued, not followed.
- **Exit** = one explicit, always-visible control (`Exit assistant mode`). Optionally PIN-protected — tell me
  if you want the PIN.
- Persisted per user, so it survives an app restart.

**Honest limit I will not oversell:** this is a **UX lock, not a security lock.** A person can still
force-quit the app or use the phone's app switcher — Android does not let a normal app prevent that (only a
device-owner / kiosk-provisioned app can, which would change how the phones are managed). If you need true
kiosk, that is a separate Android Enterprise decision.

---

# PART B — THE 9 REPORTED PROBLEMS (verified root causes)

| # | Problem | Verified root cause | Owner | Fix type |
|---|---|---|---|---|
| 1 | Admin panel "Assign Task" shows "Create Task" | Label lives in the **admin panel repo**, not this app | `[admin]` | 1-line label |
| 2a | Admin can see location | **Mobile is ALREADY correct** — `canSeeLiveLocation()` returns true only for real `super_admin` (`roles.ts:72-74`), covered by 20 tests. If an admin sees location, it is the **panel** | `[admin]` | panel gate |
| 2b | On-demand "Show" pulls member's live location, no notification | **New feature.** Needs silent FCM data-push, app wakes, one high-accuracy fix, POST, panel reads | `[m]+[api]+[admin]` | real feature |
| 3 | File attach gives "Couldn't reach the server" | Endpoint is **LIVE** (probed: `POST /upload` returns **401**, so deployed). Three real candidates, all verified in code — see §B1 | `[api]+[ops]+[m]` | config + 2 small code fixes |
| 4 | App 63 MB grows to 125 MB after use | **Map tile cache.** `LeafletMap` loads CartoDB + **Esri satellite** tiles in a WebView; WebView caches to disk without a cap | `[m]` | cache cap + "Clear cache" |
| 5 | Splash layout broken, text invisible | Two different splashes. The **native** one (`expo-splash-screen`, white bg, `imageWidth:190`) is **logo-only by design — it has no text**. The JS one (`ui/Splash.tsx`) does have the tagline "Khushiyo Ka Financial Planner" at 13 px in `c.muted` | `[m]` | redesign both |
| 6 | LIC plans 102/113/122/165/172/180/181/195 show "Unnamed" | **DATA, not a bug.** `plan_name` is literally `null` in `cgpe-backend-main/data/lic_plans_library.json` for those plans. The app correctly falls back to "Unnamed plan" | `[data]+[m]` | fill names + better fallback |
| 7 | Deploy to Play Store + App Store today | See §B2 — **Apple is blocked**, Play is possible but not same-day | `[ops]+[m]` | see §B2 |
| 8 | More, then back to Today, goes black/empty | **Prime suspect:** `Appear`'s cleanup `cancelAnimation(progress)` (`ui/motion.tsx:104`) freezes opacity at whatever value it reached. Cancelled at 0 means the element stays invisible. Matches "kuch dikhta hai, baaki empty" exactly | `[m]` | animation fix |
| 9 | Role-wise views (Operations vs Sales) | **Mobile already supports this** — `nav.tabs` / `nav.hidden` / `nav.more_sections` / widgets are all driven per-department by `GET /rbac/app-ui`. Mostly a **config seeding** job; two parts need real app work | `[admin]` config + `[m]` | see §B3 |

## B1. File upload — the three candidates, and the MinIO answer

**Verified:** `POST https://cgpe.in/internal/api/upload` returns **401** without auth, so the route is
deployed and reachable. "Couldn't reach the server" is **not** a missing endpoint.

**Candidate A — the returned URL is unreachable (most likely).** When cloud storage is not configured, the
backend saves to local disk and builds the URL as
`${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/${bucket}/${fileName}` (`routes/upload.js:122`).
**If `BACKEND_URL` is unset on prod, every uploaded file gets a `localhost:3001` URL the phone can never
load.** The app already detects this and marks it `ephemeral`.

**Candidate B — the network path.** A multipart POST of a 2–5 MB photo over the IPv6/NAT64 reduced-MTU path
(the Phase-76 issue) stalls and hits `UPLOAD_TIMEOUT` (30 s). The iptables MSS clamp applied then does
**not survive a reboot** — worth re-checking.

**Candidate C — rejected file.** The route enforces a **10 MB limit** and a **MIME whitelist**; a rejected
type throws inside multer and can surface as a generic error.

### MinIO — exactly what I need from you

Good news: the backend already uses `@aws-sdk/client-s3`, and **MinIO is S3-compatible**, so most of it
already works. Send me these six values (to the droplet `.env`, **not** to chat):

| Env var | Example | Notes |
|---|---|---|
| `DO_SPACES_ENDPOINT` | `https://minio.cgpe.in` | **must be HTTPS with a valid cert** |
| `DO_SPACES_KEY` | access key | |
| `DO_SPACES_SECRET` | secret key | |
| `DO_SPACES_BUCKET_NAME` | `cgpe` | create the bucket first |
| `DO_SPACES_REGION` | `us-east-1` | MinIO ignores it but the SDK requires a value |
| `BACKEND_URL` | `https://cgpe.in` | **set this too** — it fixes Candidate A even if MinIO is delayed |

**Plus two small backend code changes I will specify (MinIO differs from DigitalOcean here):**

1. `forcePathStyle` is hardcoded `false` (`cloudStorage.js:18`). **MinIO needs `true`** unless you set up
   virtual-host-style DNS. Make it env-driven.
2. The public URL is built as `${DO_SPACES_ENDPOINT}/${fileKey}` (`cloudStorage.js:67,122`) — for
   path-style MinIO the bucket must be in the path: `${endpoint}/${bucket}/${fileKey}`.
3. Also confirm: `ACL: 'public-read'` (`cloudStorage.js:50`) — MinIO usually prefers an **anonymous bucket
   policy** over per-object ACLs. Either set a public read policy on the bucket, or tell me to switch to
   presigned URLs.

**Tell me which you want: public bucket (simple, files are world-readable by URL) or presigned URLs
(private, links expire).** For claim/KYC documents I would recommend **presigned**.

## B2. Store deployment — the honest position

### Apple App Store — cannot be submitted today

- It requires the **Apple Developer Program at $99/year**. Recorded decision (2026-08-21): the owner
  **cannot purchase it**. There is **no** free path to TestFlight or the App Store — none.
- Without it we cannot even produce a signed device build; only an unsigned simulator build (already proven
  green, build `9649bf51`).
- If the account is purchased, add: Apple ID + D-U-N-S (for a company account, which itself takes days),
  App Store Connect setup, then review (typically 24–72 h, sometimes longer for a first submission).

**I will still write the complete word-by-word Apple guide** (Phase 79) so the day the account exists,
nothing is unknown. But **"aaj hi submit"** for Apple is not achievable, and I will not pretend otherwise.

### Google Play Store — possible, but not same-day approval

What is needed, all owner-side:

1. **Play Console account — $25 one-time.** Choose **Organization**, not Personal, if you can.
2. **A *personal* developer account created after Nov 2023 must run a closed test with 12 testers for 14
   continuous days before it may go to production.** An **organization** account is exempt. This single
   choice decides whether you launch in ~2 days or ~3 weeks.
3. **A production AAB** — I build this (`eas build -p android --profile production`). Note `versionCode` is
   currently **1** and must increment on every upload.
4. **Privacy Policy URL** (public page) — mandatory.
5. **Data Safety form** — this app collects **location, files, and personal info**; every item must be
   declared honestly.
6. **`ACCESS_BACKGROUND_LOCATION` declaration.** This app tracks location 24/7. Google requires a written
   justification **plus a demo video** showing the in-app prominent-disclosure screen and the user granting
   permission. **This is the single most common rejection reason for apps like this.** The app already has a
   versioned consent screen, which is exactly the evidence Google wants — that helps a lot.
7. Store listing: title, short + full description, **screenshots**, 512x512 icon, 1024x500 feature graphic,
   content rating questionnaire, target audience.

**Realistic timeline:** listing + AAB + declarations can be prepared **today**. Review for a brand-new
account with background location is typically **several days**, and can be longer if the location
declaration is queried. I can have everything submitted quickly once the account exists — approval is not in
our control.

## B3. Role-wise views — what is config vs what is code

**Already supported (config only — set in the admin panel per department):**

- Operations: show `tickets`, `claims`, `reminders`, tasks, clock-in/out; hide `leads`, `prospects`
- Sales: show `leads`, `prospects`, tasks, clock-in/out; hide `claims`, `tickets`
- This drives the bottom tabs, the More menu groups, and the Home widgets. No app change needed.

**Needs real app work:**

- **"Today tab me bhi Claims dikhne chahiye"** — a claims widget on Home for the Operations department
- **"Task tab ke andar active Claims show hone chahiye"** — a claims section/filter inside the Tasks tab
- "Maturity", "Operation Process", "Reminders Process" — **I need you to tell me exactly what these are.**
  There is no `maturity` module in the app today (there is a `maturity_soon` figure in the campaign summary).
  **This needs spec-lock** (Phase 82).

---

# PART C — THE PHASES

Ordered so nothing blocks on something later, and the APK rebuilds are batched (there is **no OTA**, so
every native change means a full reinstall on ~21 phones).

| Phase | Title | Contents | Needs APK? | Blocked on |
|---|---|---|---|---|
| **77** | **Quick visible fixes** | #8 More/Today black screen · #5 splash redesign (native + JS) · #6 LIC "Unnamed" better fallback + supply names · #4 app-size cache cap + "Clear cache" in Settings | yes, one APK at the end | nothing — **start here** |
| **78** | **Voice v1 (n8n)** | The `src/voice/` core · `POST /api/voice/ask` proxy · `<VoiceAvatar>` (coded shell, Lottie-ready) · Assistant Mode lockdown · male/female persona switch · mic + `expo-audio` + `RECORD_AUDIO` + consent version bump · **add EAS Update in this same build** | yes | **n8n webhook URL + contract (A1) · ElevenLabs key + 2 voice IDs (A2.2) · avatar asset decision (A3.3)** |
| **79** | **Play Store submission** | production AAB · listing copy · screenshots · privacy policy page · Data Safety form · background-location declaration + demo video · **complete word-by-word Apple guide** (for when the account exists) | yes (AAB) | **Play Console account (owner)** |
| **80** | **Files / MinIO** | `BACKEND_URL` fix · `forcePathStyle` env · path-style URL fix · public-vs-presigned decision · app-side upload error copy | mostly backend/ops | **MinIO credentials (B1)** |
| **81** | **On-demand live location** | silent FCM data-push, wake, single fix, POST · panel "Show" button · super-admin-only · consent/DPDP copy update | yes | spec-lock on the privacy notice |
| **82** | **Role-wise views** | Operations/Sales config documents · Claims widget on Home · active Claims inside Tasks tab | config + small app work | **spec-lock: what are "Maturity", "Operation Process", "Reminders Process"?** |
| **83** | **Voice v2** | more intents · streaming · multi-turn slots · Lottie character drop-in | yes | Phase 78 in real use |

**`[admin]` items (different repo, not this app):** #1 "Assign Task" label · #2a admin location gate ·
the per-department RBAC config seeding. Tell me if you want me to work in the admin panel repo too.

## Where spec-lock is required

| Item | Why it cannot be built from the description alone |
|---|---|
| **Avatar look** (A3.3) | "Extraordinary" and "aesthetic" are undefined adjectives. Needs: half/full (I chose half), art style, 2 personas, 6 states, and **who supplies the asset** |
| **Assistant Mode** | Exit method (button only, or PIN?), what happens to notifications/calls, whether it survives restart |
| **"Maturity" / "Operation Process" / "Reminders Process"** | These modules **do not exist** in the app today. I need the exact fields, source endpoint, and who sees them |
| **On-demand location** | Silently locating staff is a **DPDP consent** matter. The existing consent copy covers *clocked-in tracking*; an on-demand pull needs its own line and a new consent version |
| **Voice intent list** | Which ~30 commands ship in v1, and which writes require confirmation |

---

# PART D — WHAT I NEED FROM YOU (blocking)

1. **n8n voice webhook URL** (prod + test) and confirmation the workflow returns the §A1.3 JSON.
2. **Confirm A1.4** — the workflow will call the CGPE API with the user's JWT, not Mongo directly.
3. **ElevenLabs:** buy **Creator $22**, then send the **API key** (to the server, not chat), **male voice_id**,
   **female voice_id**, and the **model id** (must support Gujarati — **not Flash v2.5**).
4. **Avatar decision:** commission 2 Lottie character sets, or ship the coded avatar first?
5. **MinIO:** the six env values in §B1, and **public bucket or presigned URLs?**
6. **Play Console:** create the account — **Organization if at all possible** (avoids the 12-tester /
   14-day rule).
7. **LIC plan names** for 102, 113, 122, 165, 172, 180, 181, 195, 058, 369, 04 — I will not invent LIC
   product names.
8. **Define** "Maturity", "Operation Process", "Reminders Process".
9. **Assistant Mode exit:** plain button, or PIN-protected?

---

# PART E — THINGS I WILL NOT PRETEND

- **Apple App Store today is not possible** — no Developer account, and there is no free route.
- **Play Store approval today is not in our control** — background location triggers a manual review.
- **The n8n path is the owner's choice** and I am building it, but the RBAC mitigation (A1.4) is not
  optional — without it a team member can voice-read the whole client book.
- **"Extraordinary" character quality depends on an asset**, not on my code. The coded avatar will look
  clean and premium but abstract; a real illustrated character needs a Lottie/Rive file.
- **Assistant Mode is a UX lock, not a kiosk.** A user can force-quit.
- **Everything here is device-unverified** until walked on a real phone — `tsc`, `npm test` and lint cannot
  see a microphone, a splash screen, or a tile cache.
