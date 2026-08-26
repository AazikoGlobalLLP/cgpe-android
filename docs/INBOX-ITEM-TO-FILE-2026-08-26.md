# INBOX item — ready to paste into `../contracts/INBOX.md`

**Status: NOT YET FILED.** I could not write it — the permission classifier blocked writes to
`contracts/` after this session truncated `INBOX.md` (see `docs/HANDOFF.md` → Known broken).
**Paste the block below into `../contracts/INBOX.md`, immediately above the `## Protocol` heading**
(or grant the permission and ask me to file it).

---

## → cgpe-api, cgpe-admin · 2026-08-26 · from cgpe-mobile
**Owner is building a VOICE ASSISTANT through n8n. Mobile needs ONE new n8n webhook with a strict contract, plus 4 smaller fixes. Full detail: `ANDROID/docs/PLAN-2026-08-26-VOICE-N8N-AND-BUGS.md`.**

**(1) `[api]` NEW n8n webhook — `POST https://ai.cgpe.in/webhook/cgpe-voice`** (name it; we read it from `N8N_VOICE_WEBHOOK_URL`, never hardcoded in the APK).
Mobile sends `multipart/form-data`: `audio` (.m4a AAC mono 16 kHz, max 15 s / ~1 MB), `lang` (`hi-IN`/`gu-IN`/`en-IN`/`auto`), `session_id`, `request_id` (uuid — **idempotent: the same id must return the first answer**, else a repeated clock-in double-fires), `screen`, `history` (last 3 turns, text only). Headers: `X-CGPE-Token` (the USER's JWT), `X-CGPE-Request-Id`, `X-CGPE-App-Version`, `X-CGPE-Webhook-Secret`.
Must return **HTTP 200 + JSON, never an empty body**: `{ok, request_id, transcript, lang_detected, reply_text (max 200 chars, in the user's language), action:{type:'none'|'navigate'|'confirm_write', route, params, intent_id, args, confirm}, audio:{mode:'url'|'base64'|'none', url, mime}, confidence (0-1), error}`. On failure still 200 with `ok:false` + `error.code` in `stt_failed|llm_failed|tts_failed|forbidden|unknown`. **Always include `transcript`** — the app shows the user what was heard. Target **3 s or less**, hard ceiling **8 s** (we abort after that).
⚠️ **Two things we verified that this must not repeat:** `routes/assistant.js:5-8` documents that the existing chat-shaped synchronous n8n webhook **returns an empty body today**, and other synchronous n8n calls run **15–40 s** (`N8N_PDF_TIMEOUT_MS` default 120000). Voice needs a different budget.
🔴 **NON-NEGOTIABLE:** for any read/write the workflow must call `https://cgpe.in/internal/api/...` **with the `X-CGPE-Token` JWT**, NOT the Mongo connection. n8n bypasses `protect`/`visibilityScope`, so a direct Mongo read lets a TEAM advisor voice-pull the whole ~9k client book — the exact Point-9 gate. Calling the REST API costs nothing and inherits every existing permission.
Also: `config/webhooks.js` resolves `whatsapp, hub, campaign, claim, chat, email, report, escalation, attendance, generic` — **there is no `voice` entry**; add one or we use `generic`.

**(2) `[api]`+`[ops]` FILE UPLOAD — owner reports "Couldn't reach the server" on every attach.** We probed live: `POST /internal/api/upload` returns **401**, so the route IS deployed. Prime suspect is **`BACKEND_URL` unset on prod**: `routes/upload.js:122` builds `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/${bucket}/${fileName}`, so every locally-stored file gets a `localhost:3001` URL the phone can never load. **Please set `BACKEND_URL=https://cgpe.in` regardless of the MinIO work.** Owner is standing up **MinIO**; it is S3-compatible and `services/cloudStorage.js` already uses `@aws-sdk/client-s3`, but: `forcePathStyle` is hardcoded `false` (`cloudStorage.js:18`) and **MinIO needs `true`**; and the public URL `${DO_SPACES_ENDPOINT}/${fileKey}` (`cloudStorage.js:67,122`) must include the bucket for path-style (`${endpoint}/${bucket}/${fileKey}`). Also `ACL:'public-read'` (`cloudStorage.js:50`) — MinIO prefers an anonymous bucket policy; tell us public-read or presigned (we recommend **presigned** for claim/KYC documents).

**(3) `[data]` LIC PLANS SHOW "Unnamed" — not an app bug.** `cgpe-backend-main/data/lic_plans_library.json` has `plan_name: null` for `plan_table` 102, 113, 122, 165, 172, 180, 181, 195 (owner also lists 058, 369, 04). The app correctly falls back to "Unnamed plan". Needs the real names filled plus a re-seed — note `ensureSeeded()` only runs when the collection is EMPTY, so an existing `insurance_products` will NOT pick up edits; plan the migration.

**(4) `[api]`+`[admin]` ON-DEMAND LIVE LOCATION (owner request).** Super Admin clicks "Show" on a team member and that member's phone returns its CURRENT location, **with no notification to the member**. Needs a silent **FCM data-only push** → app wakes → one high-accuracy fix → POST → panel reads. Mobile builds the device half; we need the push-trigger endpoint plus a store/read endpoint. Flagging honestly: silently locating staff is a **DPDP consent** matter — existing consent copy covers *clocked-in* tracking only, so this needs its own line and a new consent version. Honest limit: if the app is force-quit or battery-optimised it may not answer.

**(5) `[admin]` THREE PANEL-SIDE ITEMS (mobile verified these are NOT app bugs):**
  - The **"Assign Task" button reads "Create Task"** — panel label.
  - **Admin can see location.** Mobile is already correct: `canSeeLiveLocation()` returns true ONLY for the real `super_admin` role (`ANDROID/src/store/roles.ts:72-74`, 20 tests). If an admin sees location, the gate is missing in the **panel**.
  - **Role-wise Operations/Sales views** — mobile ALREADY honours `nav.tabs` / `nav.hidden` / `nav.more_sections` per department (Phases 10/26). Owner wants Operations = reminders/claims/maturity/tickets/tasks/clock, Sales = leads/prospects/tasks/clock. **This is config seeding in the panel**, not app code. (Two sub-asks DO need mobile work and we own them: a Claims widget on Home, and active Claims inside the Tasks tab.)

Status: [ ] picked up
