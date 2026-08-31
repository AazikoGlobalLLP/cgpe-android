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
| Voice proxy | `POST /internal/api/voice/ask` | **404** | The voice backend proxy is **not deployed** (and not yet built). |
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
- `POST /api/voice/ask` (speech-to-text → the n8n brain → text-to-speech) **does not exist yet**; the
  brief is `docs/spec/VOICE-BACKEND-PROXY-BRIEF.md` and the ask is filed at the top of `contracts/INBOX.md`.
  The app records audio and has nothing to talk to until it is built and deployed.
- The n8n brain webhook secret (`vbk_…`) **was pasted into a chat window** and should be **rotated**. It
  must live server-side only — it must never ship inside the app.
- The speech keys for that proxy are owed by the owner, not by the server developer.

### 10. Per-role UI config is unseeded in production
- The per-role documents (`PUT /rbac/app-ui/:roleKey`) have **never been seeded**. The app therefore
  falls back to its built-in defaults, and RBAC feature flags **fail open** — which is why several
  gates in the app are written as `capability AND flag` rather than on the flag alone.
- Not urgent, and **not** a blocker for anything shipped. Listed so it is a known state, not a surprise.

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

- **2026-08-31** — created, at the owner's instruction, after mobile Phase 86 (the presigned upload
  adoption) made the storage items app-blocking rather than theoretical. Live state re-probed the same
  day. Items drawn from `contracts/INBOX.md` (D-122, D-128, D-135, D-136), `CLAUDE.md`, and this
  session's own probes — nothing quoted from memory.
