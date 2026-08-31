# Server / production handover — the running list

**Purpose.** Everything the app side needs from the person who runs the **production server** —
deploys, `.env`, nginx, DNS, storage. This file is the **accumulator**: every phase that discovers a
server-side dependency appends to it, so that at the very end one message can be written for the
production developer without re-deriving anything.

> **This file is a LIST, not the message.** The message itself is written by the FINAL phase
> (`docs/PHASES.md` → "Phase Ω"), which runs only after every other phase is Done. Do not send this
> file as-is — it is written for us, in our vocabulary.

**Rules for maintaining it**
1. **Never write an item from memory.** Every line here must be traceable to a probe, a file, or an
   INBOX item — and must say which. If it cannot be traced, it does not go in.
2. **Re-verify the "Live state" table at the top of every session that touches this file.** These
   values change without anyone telling us; a stale one turns the final message into a lie.
3. **Append, do not rewrite.** A closed item moves to "Closed" with the date and the evidence, so the
   final message can say what was already done as well as what is outstanding.
4. **Nothing secret goes in this file.** Variable NAMES only — never a key, password or URL with a
   credential in it. (`.env.example` on the backend follows the same rule.)

---

## Live state — verified by probe on 2026-08-31

| What | Command | Answer today | Means |
|---|---|---|---|
| API health | `GET /internal/api/health` | **200 in ~37 ms** | The backend is up and fast. Nothing here is an outage. |
| Object storage | `GET /internal/api/upload` | **`cloudStorageConfigured: false`** | `S3_*` is **unset**. Every upload falls back to droplet disk. |
| Presigned upload | `POST /internal/api/upload/presign` | **404** | Backend Phase 95 is **not deployed**. |
| Presigned download | `GET /internal/api/upload/download-url` | **404** | Same. |
| Voice proxy | `POST /internal/api/voice/ask` | **404** | The voice backend proxy is **built** (`a926650`) but **not deployed**. Re-probed 2026-08-31. |
| Deployed code | `git ls-remote origin refs/heads/main` | **`990c660`** ("Merge Shivam into main: Phases 88-90") | Production auto-deploys `origin/main` ONLY. |
| Deploy gap | `rev-list --count origin/main..origin/Shivam` | **29 commits** | 29 commits of backend work are written, CI-green, and **not running**. |

*A `404` from a route we know exists in the code is the signature of "not deployed", not of a bug.
A `401` would mean deployed-and-protected. That distinction is how every line above was decided.*

---

## OPEN — what the production developer has to do

### 1. 🔴 Merge and deploy the backend — this unblocks the most
- Production auto-deploys **`origin/main` only** (`cgpe-backend-main/.github/workflows/deploy.yml`).
  `origin/main` is `990c660`; `origin/Shivam` is **29 commits ahead**.
- Not running today: the **presigned MinIO upload flow** (backend Phase 95), the `entity_id` claim↔file
  link (Phase 94), `POST /api/voice/ask`, the query-engine fixes, and every security fix in that window.
- ⚠️ **Do not merge `ved` instead.** Per `cgpe-api` (INBOX 2026-08-29), `ved` was **2 commits behind
  `Shivam`**, missing `85d55c5` (CI fix) and `d9d9d85` (CORS fix) — a `ved → main` merge ships without them.
- After deploying: **restart the `:3001` process.** Several values are read at module load, not per request.

### 2. 🔴 Object storage — the `S3_*` block (this is the "documents vanish" fix)
- Set on the server `.env`, **append-only**: `S3_ENDPOINT` · `S3_KEY` · `S3_SECRET` · `S3_BUCKET_NAME` ·
  `S3_REGION`. Names from `contracts/INBOX.md` (D-122) and `cgpe-backend-main/.env.example`.
- `forcePathStyle` stays **true**. New backend dependency `@aws-sdk/s3-request-presigner`. No index, no migration.
- Until this is set, all three presign routes answer `503 not_configured`, uploads land on droplet
  disk, and files are wiped on the next redeploy. **That is the field complaint "documents vanish".**

### 2b. ⏱️ Deploy-day ORDERING for storage — worth one minute of thought (added 2026-08-31)
- Backend **Phase 101** made the ordinary upload route return a **short-lived** link plus a durable
  key. The app builds currently on phones (**25 Aug**) save the short-lived link as if it were
  permanent, so once the code is deployed **and** `S3_*` is set, those phones record attachments whose
  links stop working after the signature expires.
- **Deploying Phase 101 on its own is safe** — with `S3_*` unset, the new branch is never reached.
  The exposure begins only when **both** are done.
- **This is a judgement call, not a blocker.** Doing it after the next app release removes the window.
  Doing it sooner is still defensible: a file with an expiring link is better than one written to
  throwaway disk that a redeploy wipes, which is the situation today. **Either is fine — just make it
  a decision.**
- **UPDATE 2026-08-31 — the app-side fix is BUILT (mobile Phase 88), and it does not change the line
  above.** New app builds now save the durable key instead of the link. But the phones in the field
  are still on the **25 Aug** build, which cannot be patched from here, so **the window described
  above is about the installed builds and it is still real** until a new APK is installed on those
  handsets. Nothing extra is needed from you — this note exists so "the app fixed it" is not read as
  "the window is closed".

### 3. 🔴🔴 THE BUCKET MUST NOT BE NAMED `uploads` — the single most important line here
- Storage is **path-style**, so the bucket name becomes the **first path segment** of every object URL.
- The app treats a URL whose path starts `/uploads/` as the **local-disk fallback** (`isEphemeralUrl`,
  `src/lib/fileUpload.ts`) and warns the user their file **will not be kept**.
- So a bucket literally named `uploads` makes every perfectly durable file look throwaway, and users
  are told their evidence is not saved when it is.
- **This cannot be fixed in the app**, and the obvious narrowing was refused on purpose: keying it to
  the API host would trade a harmless false alarm for a **dangerous false reassurance** — a genuinely
  wiped file reading as safely stored. Over-warning is recoverable; under-warning loses evidence.
- Also: **do not serve MinIO from the API's own host under an `/uploads/` path**, for the same reason.

### 4. `BACKEND_URL` on the droplet
- Currently unset. Pre-existing and **not** MinIO-gated (INBOX, D-122 §OPS).
- With it unset the local-disk fallback now **refuses loudly** rather than returning an unresolvable
  `localhost` link (backend D-128) — which is correct, but it means that path is dead until it is set.

### 5. CORS — sequencing matters, and getting it wrong takes the panel down
- From `cgpe-api`, INBOX 2026-08-29 (D-135): the running code pushes `CORS_ORIGIN` into the allowlist
  **whole** while comma-splitting only `CORS_ORIGINS` (plural). Production sets
  `CORS_ORIGIN=<two origins in one variable>`, so the allowlist holds one entry no real `Origin` can equal.
- **Keep `CORS_ORIGINS` (plural) SET until the backend deploy lands.** After the deploy it is redundant
  but harmless.
- **Do not turn on `CORS_STRICT=true` before that deploy** — it would refuse both panel origins. It would
  also be nasty to debug: `routes/auth.js` splits both origins correctly, so **login would keep working
  while every other route failed.**
- No action for the mobile app either way — React Native sends no `Origin` and enforces no CORS.
  **Confirmed at the code, not assumed (mobile Phase 89, 2026-08-31):** `originAllowed` in `app.js`
  short-circuits on `!origin`, so a request carrying no `Origin` header is allowed *even in strict
  mode*. Expo web (our test harness, port 8090) sends `http://localhost:8090`, which `isLocalOrigin`
  allows. **`CORS_STRICT=true` is safe for the app once the deploy has landed.**

### 6. Two env vars that are DEAD CONFIG — do not set them
- `N8N_CLAIM_WEBHOOK_URL` — **zero callers** repo-wide. `N8N_WEBHOOK_URL` — **zero callers**.
  (`cgpe-api`, D-136.) Nobody should hold a line "pending activation" for these.
- `N8N_ESCALATION_WEBHOOK_URL` **is** live, but is read at **module load** in
  `services/escalationService.js` — so it needs a **process restart**, not just an env write.

### 7. nginx — body size, for campaign media
- `client_max_body_size` **≥ 200 MB** on the server/location block that proxies to `localhost:3001`.
- The public prefix is **`/internal/api/`**, not `/api` (per `deploy-backend.sh`).
- `sudo nginx -t`, then `sudo nginx -s reload`. Without it a >1 MB upload 413s before it reaches multer.

### 8. 🔴 The network fix that made the app work at all — keep it, then make it permanent
- **Proven on-device 2026-08-22.** Symptom was "can't reach server" on every network while the phone's
  browser loaded `cgpe.in` fine. Cause: the phones are on **IPv6-only mobile (MTU 1300)** and `cgpe.in`
  is **IPv4-only (A record, no AAAA)**, so traffic crosses carrier **NAT64** and full-size packets are
  dropped — the app's TLS stalls and it times out.
- The clamp that fixed it instantly:
  `iptables -t mangle -A POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1200`
  **Confirm this survived reboots / rebuilds — it is not persistent by default.**
- **The permanent fix is to dual-stack `cgpe.in`:** add an **AAAA record** and enable **IPv6 on nginx**.
  There is no clean app-side fix for this; please do not send it back to the app team.

### 9. Voice assistant — server-side, not app-side
> **Corrected 2026-08-31 (mobile Phase 87).** This section previously said the proxy "does not exist
> yet". That is **no longer true** and would have sent the wrong instruction: it was **built** on
> 2026-08-29 and is waiting on the same deploy as everything else in §1.

- `POST /api/voice/ask` (speech-to-text → the n8n brain → text-to-speech) **is built** — `cgpe-api`
  Phase 99, commit `a926650`, with `GET /api/voice/status` alongside it for OPS. It is **not
  deployed**: `a926650` is on `origin/Shivam`, and `merge-base --is-ancestor a926650 origin/main`
  fails. Probed live 2026-08-31: `POST /api/voice/ask` → **404**, `GET /api/voice/status` → **404**.
  So this needs **no new work** — it needs §1.
- **Env the proxy reads (names only):** `SARVAM_API_KEY` · `CGPE_VOICE_SECRET` · `N8N_VOICE_BRAIN_URL` ·
  optional `ELEVENLABS_API_KEY` (+ its voice id). Values are the **owner's** to supply, not the server
  developer's to invent. Until they are set the route answers `503 not_configured` naming the missing
  keys — and the app now says "voice is not switched on yet, ask your admin" instead of "try again",
  so an unconfigured server is honest rather than confusing.
- ⚠️ **The three stage timeouts are worth a look while deploying** (`services/voiceService.js`,
  env-overridable): `VOICE_STT_TIMEOUT_MS` 30 s + `VOICE_BRAIN_TIMEOUT_MS` 20 s +
  `VOICE_TTS_TIMEOUT_MS` 30 s = an **80 s** worst case for one spoken question. The app now waits the
  full 80 s rather than abandoning an answer the server is still producing, but 80 s is not a
  usable voice experience. Tightening these is a server-side `.env` change; the ask is filed to
  `cgpe-api` (INBOX 2026-08-31).
- The n8n brain webhook secret (`vbk_…`) **was pasted into a chat window** and should be **rotated**. It
  must live server-side only — it must never ship inside the app.

### 10. Per-role UI config is unseeded in production
- The per-role documents (`PUT /rbac/app-ui/:roleKey`) have **never been seeded**. The app therefore
  falls back to its built-in defaults, and RBAC feature flags **fail open** — which is why several
  gates in the app are written as `capability AND flag` rather than on the flag alone.
- Not urgent, and **not** a blocker for anything shipped. Listed so it is a known state, not a surprise.

### 11. ⚠️ The deploy REPAIRS a feature that is silently broken today — team notifications (added 2026-08-31)
- **This is not a new task. It is a reason §1 is worth doing this week, and something the owner should
  be told before someone else notices.**
- On the code running in production right now, `POST /api/notifications/dispatch` — the "send a notice
  to the team" button — writes each row keyed by the app `USR-…` id, while the read every notification
  bell uses filters on the Profile `_id` hex string. The two never match. **So a notice is written,
  counted, reported back to the sender as delivered to N people, and seen by nobody.**
- The app has been faithfully reporting the server's own count, which is why nothing looked wrong. There
  is **no app-side fix and no app-side symptom** — the write succeeds and the reader is a different query.
- `cgpe-api` already fixed it in the undeployed window (Phase 104, `d4fad85`). **Nothing to configure —
  it is repaired by the §1 merge + restart alone**, and unlike most of that window it helps the ~21
  handsets **already in the field** without waiting for a new app build.
- One question is with `cgpe-api` (INBOX 2026-08-31): whether to leave the already-written unreadable
  rows alone, or re-key them — in which case a backlog of old notices appears on the day of the deploy.

---

## NOT for the server developer — tracked here only so it is not confused with the above

- **EAS build quota** (free plan, exhausted) and the **FCM V1 service-account key** upload — these are
  the app owner's, in an interactive terminal. No server access is involved.
- **Apple Developer Program** — owner decision, currently off the table.
- **Store assets, public `cgpe.in/privacy` and `/delete-account` pages** — owner/web, not the API server.

---

## CLOSED — already done, with the evidence

- **Report / PDF keys + strict CORS + the nginx `/internal/uploads/` block** — applied on production by
  the owner's server engineer on **2026-08-29**; `cgpe-api` reports every PDF button works again and
  campaign media serves 200 with correct headers. (INBOX 2026-08-29 §3.)
- **The MSS clamp** — applied and proved on-device 2026-08-22. Kept in the OPEN list above **only**
  because its persistence across reboot has not been confirmed and the permanent AAAA fix is still owed.

---

## Change log for this file

- **2026-08-31 (later still, mobile Phase 89)** — new **§11**: the deploy repairs team notifications,
  which are silently broken on production today (backend `d4fad85` fixes it; no configuration needed).
  §5 strengthened with the code-level confirmation that `CORS_STRICT=true` cannot break the app. Live
  state re-probed: unchanged — `origin/main` still `990c660`, still **29 commits** behind `origin/Shivam`,
  `cloudStorageConfigured:false`, presign and `/voice/ask` still 404, and `GET /api/users/test` still
  **200** (a route backend Phase 105 deletes — a cheap live proof of which build is running).
- **2026-08-31 (later, mobile Phase 87)** — §9 corrected: the voice proxy is BUILT (`a926650`), not
  missing, and its blocker is the §1 deploy. Added the env-var names it reads and the 80 s stage-timeout
  budget. Live state re-probed the same day (`/voice/ask` 404, `/voice/status` 404, `/upload/presign` 404,
  `cloudStorageConfigured:false`, `origin/main` still `990c660`) — the table above is unchanged as a result.
- **2026-08-31** — created, at the owner's instruction, after mobile Phase 86 (the presigned upload
  adoption) made the storage items app-blocking rather than theoretical. Live state re-probed the same
  day. Items drawn from `contracts/INBOX.md` (D-122, D-128, D-135, D-136), `CLAUDE.md`, and this
  session's own probes — nothing quoted from memory.
