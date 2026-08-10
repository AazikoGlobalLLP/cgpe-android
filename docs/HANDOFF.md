# HANDOFF — CGPE Connect (Android) — Phase 5 — 2026-08-10

Three commits on `Shivam`: `95f1ccb` (code + spec + tests) · `1184e57` (what the review found, and
the record) · `111183b` (one CLAUDE.md warning, see Known broken).
**The branch is NOT pushed — `git push` still returns 403. Five phases now sit locally.**
Gates: `npx tsc --noEmit` exit 0 · `npm test` **219 passed / 8 files** · `npm run lint` 46 errors
(byte-identical to baseline).

## Done

- **A WhatsApp message typed into the composer actually goes out.** It never had. The app sent
  `message` where the handler reads `text`, with a phone taken from an array that is empty for the
  life of the process — so the server refused every send with a 400 and the app painted a tick.
- **A send that did not reach the gateway says so**, in one of four sentences, and puts the words
  back in the composer. A `200` is no longer read as success: the endpoint writes its log row
  *before* it calls the gateway, so only `delivery.dispatched` means the message left.
- **A message the gateway only simulated keeps its tick and says the customer has not received it.**
- **A chat opened cold — a deep link, an app restart — can send at all**, and its call and
  "Open in WhatsApp" buttons work, because the number is recovered from the thread id.
- **A contract drift in that response now raises the outage banner** instead of being read as
  "sending is switched off".
- **Three deleted `cgpe-mobile` replies were restored to `contracts/INBOX.md`** — see Known broken.

## Files changed

- `src/data/api.ts` — `sendWaMessage` rewritten on bare `req()` (not `tryReal`, which unwraps to
  `data` and would destroy the top-level `delivery`), returning a four-outcome `SendWaResult`;
  new `waPhoneFromThreadId` + `last10`; `getWaThread`'s cold-cache stub carries a phone.
- `src/app/whatsapp/[id].tsx` — consumes the union: a tick only on a real dispatch, `failureNotice`
  for the four failures, the simulated-send note. The module docstring's claim about what the tick
  meant was false and is corrected.
- `src/data/__tests__/api-whatsapp.test.ts` **(new, 31 tests)** — the request body and the
  `delivery` envelope, mutation-checked three times.
- `docs/spec/PHASE-5.md` **(new)** — 14 locked decisions, 10 acceptance criteria, out-of-scope list.
- `docs/{PHASES,PROJECT_MAP,DECISIONS,STATUS}.md`, `CLAUDE.md`, `../contracts/INBOX.md`.
- **`src/data/adapt.ts` was in the phase's file list and needed nothing** — `adaptWaMessage` already
  maps the shape the send returns, and `normInbound` sets `direction:'inbound'` explicitly, so the
  `fromMe` default is not the bug it looks like.

## Decisions made

- **A 2xx is not a success; the body's own delivery verdict is.** Where an endpoint reports its
  outcome in the body, that outranks the status code — and a helper that unwraps to `data` cannot
  be used on it, because the verdict is not inside `data`.
- **A *missing* `delivery` object is a contract fault, not a non-delivery.** Reporting it as
  undelivered would make the screen say "sending is switched off", which we would not know.
- **Quote the producer's message, except when it is jargon.** The refusal branch keeps the server's
  note (it carries n8n's status code, which exists nowhere else); the not-configured branch does
  not (its note names an internal service to an advisor reading the app in Gujarati).
- **The thread-id phone match is strict on purpose** — `<prefix>:<exactly 10 digits>` or a bare ten
  digits, never digit-stripping. The lenient reading turns a Mongo `_id` hex into a plausible
  Indian mobile and sends a customer's message to a stranger.
- **`name` is sent; `language` is not.** The thread upsert is unconditional (`clientName: name || ''`),
  so omitting the name wipes it for the panel too. The only language this app knows is the
  *advisor's* UI preference, which says nothing about the customer.
- **A phase is reviewed adversarially before it is called done** (Phase 4's rule, held). Reviewing
  this diff produced the two decisions above; both were shipped in `1184e57`.

## Known broken / deliberately skipped

- **The branch is not pushed — `git push` returns 403** — because the stored credential is
  `reactjsaaziko` and the remote is `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`, which that account
  cannot write to. Retried today; unchanged. **Needs a human**, and it is now five phases of work.
- **`contracts/INBOX.md` silently deleted three of our Phase-4 replies during this session's boot**
  — 116,824 → 111,088 bytes between 16:23 and 16:35, taking **two ticked boxes back to `[ ]`**, so
  `cgpe-api` would have read mobile as never having answered. Both were re-verified from scratch
  and re-written, and an integrity notice is filed for both siblings. Not fixed: the file has no
  version control, and creating the parent's first commit would sweep three project trees into one
  repo. `CLAUDE.md` now says to grep your own reply back after writing it.
- **Is the n8n hub webhook configured in production?** Unknown from here, and it decides whether
  "the app can send" or "the app can now correctly say nothing can send". Asked of `cgpe-api` in
  the INBOX. If it is unset, every WhatsApp message from every client is logged and never sent.
- **Phase 5 acceptance criteria 9–10 are unverified** — they need a handset: a message appearing in
  the panel's Hub thread, and airplane mode returning the text to the composer with no tick.
- **Phase 1 acceptance criteria 1–6 are still unverified** — haptics, an AsyncStorage clock key and
  background GPS need a handset in airplane mode. Five phases have not covered them.
- **`POST /whatsapp/hub/send` has no role gate and no scope check** — any staff token can message
  any number in India. Filed as an observation; it is `cgpe-api`'s to close, and closing it in a
  hurry would break the panel.
- **`POST /api/campaigns/send` has the same disease** — `api.md` records it reporting
  `success:true` when the webhook is unset. Eight screens away from this composer; not this phase.
- **`src/screens/dashboards.tsx:292-297` still shows all-zero Master KPI tiles on a partial outage**
  — still in no phase's file list. Carried since Phase 3.
- **The WhatsApp inbox ignores `total`/`totalPages`** above 100 threads, and **`unread` never
  clears** because no endpoint marks a thread read. Removing the fake local clear was in scope;
  inventing a read receipt was not.
- **`addTask`, `reassignTask`, `toggleReminder`, `toggleTaskStep`, `toggleClaimDoc` still fabricate
  success** — Phase 9. **`generateReport` still invents ₹42,00,000** — Phase 8.

## Next session starts here

- Phase 7: geofence and tracking correctness — adopt INBOX **D5** (`/track/points` reads
  `session_id`, not `sessionId`) and **D10** (the effective fence is up to 300 m, not a flat
  200 m), and make the geofence fallback fail **open** so an unreachable `/geofence` stops locking
  a whole branch office out of clocking in. **Both D5 and D10 are open INBOX boxes addressed to
  this session** — Phase 7 is what closes them.
- First command: `npm test`
- Watch out for: **`../contracts/INBOX.md` deletes content, not just moves it.** It lost 5.7 KB
  mid-boot today. Re-read immediately before editing, anchor every edit on surrounding text rather
  than a line number, put the answer under the box that is blocking even if that means saying it
  twice — and **grep your own reply back after you write it.**
