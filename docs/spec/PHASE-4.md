# PHASE 4 — The leads contract

**Session:** `cgpe-mobile` · **Written:** 2026-08-10 · **Baseline commit:** `b3c298d`
**Gates at baseline:** `npm test` 164 passed / 6 files · `npx tsc --noEmit` exit 0 ·
`npm run lint` 46 errors / 15 warnings

---

## The one-sentence goal

The Leads screens must speak the vocabulary the server actually enforces, so that a lead can be
opened, a stage change survives a cold start, and a created lead is the record the server made.

## DONE WHEN (from `docs/PHASES.md:119-126`)

> Tapping a lead opens its detail screen with data; a stage change persists across a cold start;
> a `policy_issued` lead renders as won, not New; a newly created lead shows its real name.

---

## 1. What is actually broken — verified, with citations

Every row was read at the cited line in both repos, and cross-checked against `contracts/`.

| # | Defect | Where | User-visible consequence |
|---|---|---|---|
| D1 | `getLead` validates against the wrong envelope | `src/data/api.ts:662` | **the detail screen has never rendered a real lead.** `tryReal` unwraps to `json.data`, which is `{ lead: {…} }`; the validator tests `d.name \|\| d._id \|\| d.leadId` at the top level, fails, reports a fault and returns `undefined` |
| D2 | `setLeadStage` PUTs `{ stage }` | `src/data/api.ts:666` | `stage` is **not a path on the Lead schema** (`models/Lead.js:3-103`), so Mongoose strict mode drops it. The server answers `200` with the record unchanged and writes no timeline row. **No stage change has ever persisted.** |
| D3 | the write is validated with `() => true` | `src/data/api.ts:666` | any `2xx` counts as a save, including the `200` above |
| D4 | the read-back needs the endpoint D1 broke | `leads.tsx:78-82`, `lead/[id].tsx:67-71` | `commitStage` → `getLead` → `undefined` → **every** stage change reports *"That move was not saved"* |
| D5 | `mapLeadStage` does not know the server's words | `src/data/adapt.ts:146-154` | `policy_issued` and `docs_shared` match no arm and fall through to `new` — a **won lead is indistinguishable from a brand-new one** |
| D6 | `mapLeadStage` substring-matches unanchored | `src/data/adapt.ts:148,152` | `not_converted` contains `convert` → **won**; `unqualified` contains `qualif` → **contacted** |
| D7 | `adaptLead` prefers `stage` over `status` | `src/data/adapt.ts:174` | the field the API cannot write shadows the field it enforces — see L2 |
| D8 | `addLead` POSTs an app-shaped object | `src/data/api.ts:673-683` | eight of eleven keys are not schema paths and are dropped; `notes: []` is sent to a `String` path; the `201 { data:{ lead } }` reply is fed to `adaptLead` **unwrapped**, so the new lead is called **"Lead"** with id `"undefined"`, and the read-back of `/leads/undefined` 404s |
| D9 | `adaptLead` never reads `insurance_need` | `src/data/adapt.ts:176` | the only field the server stores for "what they want" is not rendered; the Interest column is blank for every real lead |
| D10 | a POST rejected for a bad phone raises the outage banner | `src/data/api.ts:680` via `tryReal` | `400 Validation failed` is not in the suppressed set (`api.ts:124`), so a user's typo is reported to the whole app as *"some data could not load"* |

### Why this is one phase and not four

D1 and D2 are the same defect wearing two hats: **the app invented a vocabulary and an envelope
and never checked either against the contract.** Fixing the envelope without the vocabulary gives
a detail screen that renders a won lead as New; fixing the vocabulary without the envelope leaves
the screen empty. D4 means neither is observable until both are done.

---

## 2. The vocabulary, from the contract

`contracts/enums.md:212` · `contracts/models.md:147` · `models/Lead.js:29-34` — **enforced**:

```
new_lead · meeting_scheduled · docs_shared · policy_issued · lost      (default new_lead)
```

There are **four** lead vocabularies in this system and `enums.md` §15 says in terms: do not
merge them.

| # | Vocabulary | Where it lives | Writable by the app? |
|---|---|---|---|
| 1 | `new_lead meeting_scheduled docs_shared policy_issued lost` | `Lead.status`, enum-enforced | **yes — the only one** |
| 2 | `new contacted meeting_scheduled docs_shared` | query-engine option list, `enums.md:586` | no — a panel filter dropdown |
| 3 | `active new_lead docs_shared lost policy_issued` | `services/queryEngine.js:194` | no — `active` matches nothing |
| 4 | `new contacted meeting proposal closed_won closed_lost` | **this app**, `src/data/types.ts:18` | no — three of its six words exist nowhere on the server |

A fifth field muddies it: the raw `leads` collection carries a **`stage`** key that non-Mongoose
readers use (`contracts/models.md:2138`, drift #5 — `reports.js:121` reads `l.stage || l.status`).
No endpoint in `api.md` §Leads accepts `stage` in a request body.

---

## 3. Locked decisions

**L1 — The app adopts vocabulary #1 verbatim. `LeadStage` becomes the five enforced values.**
Rejected: keep the six-value union and translate on write. `contacted` and `proposal` have no
target in the enum, so the translation is lossy *where the user can see it* — they tap
**Contacted**, the server stores `new_lead`, the confirmation read disagrees, and the app reports
"not saved" every single time. A vocabulary the server cannot store is exactly the invented status
value `CLAUDE.md` forbids. Cost: nine files, all found by `tsc` because `STAGE_META` is an
exhaustive `Record<LeadStage, …>`.

**L2 — On read, `status` wins over `stage`.** `adaptLead` reads `raw.status || raw.stage`, the
reverse of today (`adapt.ts:174`) and the reverse of the backend's own `reports.js:121`. Reason:
`status` is the only one of the two the app can write. A document carrying both would otherwise
display its stale `stage` forever and every save would look unconfirmed — the D2 symptom, moved
rather than fixed. Filed to `cgpe-api` in `contracts/INBOX.md` as an observation, not a request.

**L3 — Legacy `stage: 'contacted'` maps to `new_lead`, and nothing maps UP.** It is vocabulary #2
and has no counterpart in the enum. Understating a lead's progress is the safe direction:
overstating it to `meeting_scheduled` would invent a meeting nobody recorded.
✏️ **Corrected during review, before this phase closed.** The first draft also aliased
`converted → policy_issued`, which broke this rule in the one direction that costs money: a guess
that a sale closed removes a lead from the open pipeline *and* adds it to a won figure. It was
also a guess about a token that does not occur — `converted` is not a value of any lead
vocabulary; it appears only in the `!converted` query sentinel (`routes/leads.js:109-111`) which
`enums.md:218` records as unable to match anything. The alias is gone and a test pins that
`converted` now lands on the default like any other unknown.

**L4 — The mapper is an exact table plus a short anchored alias list.** No substring ladder
(D6). Unknown input resolves to `new_lead`, which is the **schema default**
(`models/Lead.js:32`) rather than an invented fallback.

**L5 — The `{ lead }` envelope is required, not tolerated.** GET `/:id`, POST `/` and PUT `/:id`
all answer `data.lead` (`api.md:368-370`). The validators require it. If that shape ever changes,
the health channel raises it — Phase 3's rule that *a 200 with an unusable body is reported*.

**L6 — `setLeadStage` returns the server's own updated lead, and the confirmation GET is deleted.**
`PUT /:id` runs `findByIdAndUpdate(…, { new: true })` and returns the post-update document
(`routes/leads.js:404-435`), so its own response is the strongest confirmation available — and it
costs one round trip instead of two. It also fixes a case the old read-back gets wrong: `PUT` has
**no ownership check** while `GET /:id` has a strict one, so for an *unowned* lead — which the list
deliberately shows (`api.md:366`, `utils/scope.js:121-126`) — the write succeeds and the
confirmation read 403s, reporting "not saved" for a change that saved.

**L7 — A failed stage write no longer mutates the local buffer** (`api.ts:668-669`). The screen
rolls the stage back and says so; leaving the buffer holding the new value would make the list
disagree with the message the user just read.

**L8 — The POST body carries only fields `Lead` declares.** `name`, `phone`, `insurance_need`,
`address.city`, `expected_premium`, `status`, and `source` only when the caller supplies one.
Dropped: `id`, `stage`, `interest`, `potential`, `city`, `priority`, `createdAt`, `lastActivity`
— all silently discarded by strict mode today — and `notes: []`, which is sent to a `String` path.
`status: 'new_lead'` is sent explicitly because the Add sheet promises in writing *"It starts at
the New stage"*; the schema default agrees, but the promise should not depend on it.

**L9 — `priority: 'warm'` is not sent** (`leads.tsx:664`). It is invented at the call site: the
sheet never asks the user, the server has no `priority` path, and the field `adaptLead` derives
priority *from* is `probability`, whose schema default is `10` → **cold**. Sending a probability
chosen to make the badge say "warm" would be inventing a number. Every existing real lead already
reads as cold for the same reason, so this is consistent, not a regression.
✏️ **Corrected during review:** the *locally held* record was still being built with `'warm'`, so
the same lead wore a different badge depending on whether the POST landed. It is now `'cold'` —
what the server's own default would produce.

**L10 — `400 Validation failed` is an answer, not an outage, and not a local save.** `addLead`
stops using `tryReal` and classifies for itself: `201` → created; `400` → `invalid`, the server's
own message is shown in the sheet and **the record is not buffered** (a lead the server refused
does not exist and never will, so keeping it would be a fabrication); anything else → the existing
outage path and the local buffer. `WriteFailure` gains `'invalid'` (`api.ts:85`).
✏️ **Extended during review.** The same reasoning covers every *permanent* refusal, not just
`400`: a `403` (no `sales` module) and a `404`/`501` cannot be fixed by trying again either, so
those are no longer buffered — only `network` and `server` are. The sheet's caller receives the
reason and picks copy accordingly, because "we are holding it, pull to refresh" and "this lead
does not exist and nothing is holding it" are opposite instructions.
⚠️ **And one real bug the review caught in this same branch.** `reportIfOutage` leaves a note in
`suppressed` for `unavailable` to consume; `addLead` never calls `unavailable`, so after a `403`
the note sat there until the **next** `GET /leads` failure ate it — one genuine outage, silently
unreported. A write path has to clear its own note. Pinned by a test that fails without the fix.

**L11 — No client-side phone rule is added.** The server owns it (`isMobilePhone`,
`routes/leads.js:287-290`) and the app renders the server's refusal. Writing a second regex here
would be a second source of truth that drifts.

---

## 4. Files

The phase's file list in `docs/PHASES.md` names four. The union change is compile-checked, so the
true blast radius is nine — the same "file list is a floor" rule Phase 3 recorded.

| File | Change |
|---|---|
| `src/data/types.ts` | `LeadStage` → the five enforced values |
| `src/data/labels.ts` | `STAGE_META` re-keyed; labels **New · Meeting · Docs shared · Policy issued · Lost** |
| `src/data/adapt.ts` | `mapLeadStage` rewritten (L2–L4); `insurance_need` added to the interest chain (D9) |
| `src/data/api.ts` | `getLead` envelope; `setLeadStage` → `{ status }`, returns `Lead \| null`; `addLead` body + envelope + 400 classification |
| `src/app/(tabs)/leads.tsx` | `STAGE_ORDER`, `NEXT_STAGE`, `isOpen`, `byStage`, one-round-trip commit, close-out copy, Add sheet |
| `src/app/lead/[id].tsx` | `FLOW`, `NEXT_STAGE`, won/lost predicates, picker rows, commit |
| `src/app/(tabs)/home.tsx` | `:965` closed-stage filter, `:970` the four-open-stage tuple |
| `src/app/search.tsx` | `:603` `?? STAGE_META.new` → `.new_lead` |
| `src/data/__tests__/adapt.test.ts` | two pinned cases flipped **deliberately**; the correct-behaviour block updated |
| `src/data/__tests__/api-leads.test.ts` | **new** — the wire contract: request bodies and response envelopes |
| `TESTING_GUIDE.md` | rows 3–5 named stage chips that no longer exist, so the hand-test "Done means" requires could not be walked |

---

## 5. Acceptance criteria

Machine-checkable:

1. `getLead` returns an adapted lead from `{ success:true, data:{ lead } }`, and returns
   `undefined` **and reports** if the envelope is absent.
2. `setLeadStage` sends exactly `{"status":"<enum value>"}` — asserted on the captured request
   body — and resolves to the server's own updated lead.
3. `adaptLead({ status:'policy_issued' }).stage === 'policy_issued'`, whose label is **Policy
   issued**; `docs_shared`, `meeting_scheduled`, `lost` likewise; `not_converted` and
   `unqualified` no longer invert.
4. `addLead` sends only schema fields, unwraps `{ lead }`, and a `400` neither buffers the record
   nor raises the banner.
5. No value of `LeadStage` exists that `PUT /api/leads/:id` would reject.
6. Gates: `npx tsc --noEmit` exit 0 · `npm test` green · `npm run lint` still 46 errors.

Needs a device and a live backend (carried, as Phases 1 and 3 were):

7. Tapping a lead opens the detail screen with data.
8. Moving a lead to Docs shared, force-quitting and reopening shows it still at Docs shared.
9. Adding a lead with a valid mobile number shows that person's name in the list.

---

## 6. Deliberately out of scope

- **The `sales` module 403.** Every `/api/leads` route is behind `requireModule('sales')`
  (`api.md:362`), so a user whose department lacks that module gets `403` on the list and reads
  *"No leads in your pipeline yet"* — a Phase-3-class lie that Phase 3's own rule (403 is an
  answer, so no banner) makes silent. It also needs a different error reader: the RBAC denial body
  has **no `error` key**, only `code` / `module` / `message` (`middleware/rbacGuard.js:24-29`),
  which `enums.md` §15 lists as a system-wide envelope drift. Named here, not fixed.
- **`GET /leads/:id` 403 for an unowned lead.** L6 removes it from the write path. On the read
  path the app still cannot tell a `403` from a `404` — `getLead` resolves `undefined` for both —
  so the detail screen now names **both** possibilities instead of asserting the wrong one; it
  used to say "It may have been reassigned or removed", which is a guess, and after the envelope
  fix it became the *only* thing an advisor sees for a lead the list showed them. Distinguishing
  the two properly means `getLead` carrying the status out, which is a signature change this
  phase did not need.
- **`/leads/:id/notes` and `/leads/:id/timeline`.** Both exist and are documented; the app
  synthesises notes from the free-text `notes` string instead. A real Phase.
- **`GET /leads` pagination.** The app asks for `limit=500` and ignores `data.pagination`. Wrong
  above 500 leads, unchanged by this phase.
- **The three dead bulk routes** (`api.md:381,383,384`) — the app calls none of them.
