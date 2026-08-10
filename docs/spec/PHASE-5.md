# PHASE 5 — WhatsApp send

**Session:** `cgpe-mobile` · **Written:** 2026-08-10 · **Spec read before code, as in Phase 4.**

Sources, all re-read today before a line was written:
`contracts/api.md` §`/api/whatsapp` (the `POST /api/whatsapp/hub/send` row and the slice notes),
`cgpe-backend-main/routes/whatsapp.js:816-898` (the handler itself) and `:678-707`
(`normMessage` / `normInbound`), against `src/data/api.ts:1071-1116`, `src/data/adapt.ts:297-319`
and `src/app/whatsapp/[id].tsx`.

## The one-sentence goal

Make a message typed into the chat composer actually reach the WhatsApp gateway — and make a send
that did **not** reach it say so, instead of painting a tick.

## DONE WHEN (from `docs/PHASES.md:158-163`)

> a sent message reaches the gateway; a rejected send returns the text to the composer instead of
> painting a sent tick.

## 1. What is actually broken — verified, with citations

`sendWaMessage` is four lines and every one of them is wrong in a different way
(`src/data/api.ts:1105-1116`).

1. **The field name.** It sends `{ phone, message }`. The handler destructures
   `{ phone, name, text, purpose, language }` (`routes/whatsapp.js:818`) and `message` is not a
   key it reads. `text` arrives `undefined`, `body` becomes `''`, and because `purpose` is also
   unsent it defaults to `'custom'` — which is the exact condition on line 824 that returns
   **400 `'Message text is required.'`**. Every send from this app is refused by the server.
2. **The phone is always `undefined`.** It reads `state.waThreads.find(...)`, and `state.waThreads`
   is `[]` for the life of the process — nothing in `src/` ever pushes to it (grep: four reads, zero
   writes). The real thread list lives in `waThreadCache` (`api.ts:1071`), which `getWaThreads`
   populates. So `phone` is `undefined`, `onlyDigits(undefined)` is `''`, and line 821 returns
   **400 `'A valid 10-digit phone is required.'`** — which fires *before* the text check, so that
   is the 400 the app actually gets.
3. **The failure is swallowed.** The call is wrapped in `tryReal(..., () => true)`. A validator of
   `() => true` cannot fail, and `tryReal` turns every non-2xx into `null` — which
   `sendWaMessage` discards, returning `void`. The screen's `catch` at
   `whatsapp/[id].tsx:237-246` — which puts the words back in the composer, fires `haptics.error()`
   and raises the "Message not sent" banner — is **unreachable code**. It has never run.
4. **It then fabricates the send locally.** Lines 1110-1114 push the message into
   `state.waThreads`, set `lastMessage`/`lastAt` and clear `unread` — on an array that is always
   empty, so even the fabrication is a no-op. Phase 4's rule applies: a failed write does not edit
   the buffer.

**Net effect:** the composer paints a tick on a message the server refused with a 400, and the
health banner never mentions it. This is the same class of defect as Phase 1's write paths and
Phase 3's `getTeamActivity` — a carefully written error branch that nothing can reach.

### The thing the phase text did not say: a 200 is not a send

`POST /hub/send` answers **`200 success:true` for a message it never dispatched.** The handler
writes an optimistic row into `wa_comm_messages` *first* (`:834-857`), then tries the n8n webhook
(`:869`), and returns 200 regardless of what the webhook did. The only honest signal is the
**top-level `delivery` object** (`:888-896`):

| `configured` | `dispatched` | What actually happened |
|---|---|---|
| `false` | `false` | `WA_*` webhook env not set. "message logged locally only." It will never be delivered, and retrying cannot change that. |
| `true` | `false` | n8n was called and did not accept it. "logged locally." |
| `true` | `true` | n8n accepted it. `data.simulated` says whether it was really sent or dev safe-mode simulated it. |

`delivery` sits **beside** `data`, not inside it — the slice notes call this out as unique in the
whole WhatsApp/campaigns surface. That single fact decides the shape of the fix: `tryReal` returns
`json?.data ?? json` (`api.ts:235`), so **routing this call through `tryReal` throws `delivery`
away** and there is no way to tell a dispatched send from a logged one. `sendWaMessage` must use
`req()` directly, the way `addLead` does.

## 2. Locked decisions

**D1 — The body is `{ phone, name, text, purpose }`.** Exactly the keys the handler reads, no
others. `text` is the fix; `phone` and `purpose` are covered below; `name` is D3.

**D2 — `purpose: 'custom'` is sent explicitly, not left to the default.** The contract documents
the default as `'custom'`, so this changes nothing on the wire — but the server's "text is
required" check only fires *when* `purpose === 'custom'`, and our own empty-text guard has to mean
the same thing the server's does. Relying on a default to keep two validations aligned is how they
drift apart.

**D3 — `name` is sent only when we hold a real one; otherwise the empty string, deliberately.**
The thread upsert is unconditional: `$set: { clientName: name || '' }` (`:860`). So omitting `name`
does not leave the stored name alone — it **wipes it**, for the panel too. We therefore send the
cached thread's name, except when that name is `adaptWaThread`'s placeholder `'WhatsApp user'`
(`adapt.ts:302`), which we only hold when the server's own `name`/`clientName` were both already
empty. Sending `''` in that case is provably lossless; sending the placeholder would write junk
into a shared record.

**D4 — `language` is NOT sent.** The server defaults it to `'hinglish'`. The only language this app
knows is the *advisor's* UI language (`src/i18n`), which is a per-user preference of the sender and
says nothing about the customer. Tagging a customer's thread Gujarati because their advisor reads
Gujarati would be inventing a fact about someone else.

**D5 — The phone comes from `waThreadCache`, and falls back to the 10 digits in the thread id.**
A hub thread's id *is* its `thread_ref`, which the backend itself constructs as
`` `custom:${pl10}` `` (`:829`) and parses back with `last10()`. So the digits are recoverable from
the id alone, which is what makes a send work on a **cold start straight into a chat** — the case
where `waThreadCache` is empty because `getWaThreads` has not run. This is the producer's own
convention, not a guess.

**D6 — If ten digits cannot be produced, no request is made.** We already know the server's answer
(400 line 821) and can say something truer than it can: *this chat has no phone number*, rather
than *a valid 10-digit phone is required*. A round trip whose outcome is certain is not worth the
user's connection.

**D7 — `delivery.dispatched === false` is NOT a sent message, and gets no tick.** This is the
phase's DONE-WHEN read literally. The row is in the server's database either way, so "it saved" is
true and irrelevant: the customer's phone did not ring.

**D7b — A *missing* `delivery` object is a contract fault, not a non-delivery.** Added by the
review pass. `api.md` documents it as always present, so its absence means the shape moved:
reporting it as `undelivered` would make the screen say *"WhatsApp sending is switched off on this
server"*, which we would have no evidence for. It reports to `data/health` and returns `server`,
which is Phase 3's rule for a 200 with an unusable body.

**D8 — The three non-dispatch cases get three different sentences**, because the user's next
action differs. Not configured → nothing to retry, tell them and hand them "Open in WhatsApp".
Gateway refused → worth one retry. Refused by validation (400) → change what you typed.

**D8b — Only one of those quotes the server's own note.** Also from the review. For "the gateway
refused it" the note is the only place the reason exists (it carries n8n's status code), so it is
rendered rather than invented. For "not configured" the server's sentence is *"n8n webhook not
configured — message logged locally only"* — an internal service name, shown to a field advisor
reading the app in Gujarati, explaining nothing they can act on. We know exactly what happened in
that case, so we say it in their terms instead. Quoting the producer is the house rule
(`cgpe-admin` adopted it for the geofence rejection); it is not a rule to quote jargon.

**D9 — A 400 is `invalid`, not an outage.** Phase 4's `WriteFailure` classification, unchanged and
reused: `invalid` for 400, `forbidden` for 403, `unsupported` for 404/501, `server` for 5xx and a
2xx with an unusable body, `network` for a throw or the 4.5 s abort. Only `network` and `server`
are real outages, so only they reach `data/health`. A write path must clear its own `suppressed`
note (Phase 4's `addLead` bug, found by review) — this one does too.

**D10 — `simulated` is surfaced, not hidden.** `data.simulated` true means n8n accepted the message
and deliberately did not deliver it (dev safe-mode). The tick's documented meaning on this screen
is "this app handed it over", which is still true — so the tick stands, plus a plain note that the
customer has not received it. Silently treating a simulated send as a real one is the same lie in a
smaller font.

**D11 — The local-buffer write is deleted, not repaired.** `state.waThreads` is never populated, so
lines 1110-1114 are a fabrication that happens to be a no-op. Phase 4 settled the rule for the case
where it would not be: a failed write does not edit the buffer.

**D12 — Reconciliation by counted text is left exactly as it is.** `whatsapp/[id].tsx:161-181`
matches pending messages against the server's echo by text, counted rather than set-matched, and
the reason is written above it: sending "ok" twice must leave two bubbles. Adopting the server's
message id would be a second mechanism for the same job. The one thing the screen now takes from
the response is the server's **timestamp**, so a sent bubble carries the server's clock and not the
handset's.

## 3. Files

| File | Change |
|---|---|
| `src/data/api.ts` | `sendWaMessage` rewritten on `req()` with a `SendWaResult` union; `waPhoneFromThreadId` helper; `getWaThread`'s cold-cache stub gets a phone. |
| `src/app/whatsapp/[id].tsx` | Consume the union: tick only on a real dispatch, text back in the composer otherwise, three banner sentences, the simulated note. |
| `src/data/__tests__/api-whatsapp.test.ts` **(new)** | The wire contract: request body, the `delivery` envelope, and every failure classification. |
| `docs/spec/PHASE-5.md` **(new)** | This file. |
| `docs/{PHASES,PROJECT_MAP,DECISIONS}.md`, `../contracts/INBOX.md` | Record. |

`src/data/adapt.ts` was in the phase's planned file list and **needs no change**: `adaptWaMessage`
already maps the `normMessage` shape the send response returns, and `normInbound` sets
`direction: 'inbound'` explicitly (`:699`), so the `fromMe` default is not the bug it looked like.

## 4. Acceptance criteria

1. `sendWaMessage` sends `text`, never `message`. **(test)**
2. The body carries a 10-digit `phone` resolved from `waThreadCache`. **(test)**
3. With a cold cache, the phone is recovered from the `custom:<last10>` thread id. **(test)**
4. A thread id with no 10 digits makes **no** request and returns `invalid`. **(test)**
5. `200` + `delivery.dispatched:false` resolves **not ok**, and raises no health failure; a `200`
   with **no** `delivery` object resolves `server` and **does** raise one. **(test)**
6. `200` + `delivery.dispatched:true` resolves ok and carries the server's message and
   `simulated`. **(test)**
7. 400/403/404/500/throw each map to `invalid`/`forbidden`/`unsupported`/`server`/`network`, and
   only the last two reach `data/health`. **(test)**
8. No send path writes to `state.waThreads`. **(test)**
9. **On a device, against the live backend:** a message typed in the composer appears in the panel's
   WhatsApp Hub thread — i.e. it reached `wa_comm_messages` with `messageText` set, which is the
   half of "reaches the gateway" this app can observe.
10. **On a device:** with the phone in airplane mode, sending returns the text to the composer,
    shows the "did not go out" banner and paints **no** tick.

1–8 are `npm test`. 9–10 need a handset; 9 additionally needs the n8n webhook configured on the
droplet to be a full end-to-end proof — if `delivery.configured` is false in production, criterion 9
is met by the message appearing in the Hub with the "not configured" banner shown, and the gateway
half is `cgpe-api`'s to enable.

## 5. Deliberately out of scope

- **`POST /api/whatsapp/hub/send` has no scope check** — any staff token can message any number
  (`api.md` slice notes, "Auth inconsistency"). Real, not ours to fix from the client, and filing it
  is `cgpe-api`'s call to act on.
- **Campaign sends** (`campaigns.tsx`, `premium.tsx`, `useJobs().startCampaign`) go through
  `/api/campaigns/send`, a different endpoint with its own `result.skipped` dishonesty
  (`api.md`: "reports `success:true` when the n8n webhook is unset"). Same disease, different
  organ, and eight screens away from this composer.
- **`getWaThreads` ignores `total`/`totalPages`** and asks for 100. Paging the inbox is its own
  piece of work, exactly as `getLeads`' 500 is.
- **The unread count is never cleared server-side.** `unread` comes from the thread row and no
  endpoint marks a thread read; the old code cleared it locally, which was fiction. Removing that
  fiction is in scope; adding a real read-receipt is not — there is no endpoint for it.
