# Decisions — CGPE Connect (Android)

Append-only. Newest first. One entry per decision that a future session would otherwise re-litigate.

Format: `## YYYY-MM-DD — <decision>` / **Context** / **Decision** / **Consequence**.

---

## 2026-08-11 — Deleting a fabrication at the source, not just distrusting it at the call site (Phase 8)

**Context.** `generateReport` invented a fixed ₹42,00,000 summary on any failure. Its one caller,
`client/[id].tsx`, already had a `source !== 'demo'` guard and a comment explaining exactly why —
proof the fabricated data had never reached a screen, but only because that one call site
remembered to check. `getDashboardOverview` / `getClaimsSummary` (`api.ts`) were already written
the honest way: return `tryReal`'s result directly, `null` on any failure, no invented fallback.

**Decision.** The fix is at the source, not at the call site. `generateReport` now matches its two
precedents exactly. The caller's now-permanently-true `source !== 'demo'` check and the `source`
field it existed to read are both removed, rather than left in place as a defensive check with
nothing left to defend against — a dead guard reads as "this could still happen" to the next
person who touches the file.

**Consequence.** A second caller of `generateReport` — a future screen, a test — can now trust
`.ok` alone; there is no longer a second thing to remember to check. Same shape as Phase 7's D-2
("an unknown fence is represented as unknown, not as a guess") and Phase 5's D-1 ("a 2xx is not a
success; the body's own verdict is") — fabrication and mistrust of fabrication are both defects;
only removing the fabrication closes the class.

**Also decided:** the adversarial-review convention (Phase 4's rule, held through 5 and 7) scales
down for a small phase. One skeptical pass, not a multi-lens panel, was proportionate here — and it
still caught a real defect: rewriting `config.ts`'s "Backend base URL" paragraph while leaving its
neighbouring numbered list saying the opposite thing 24 lines above. Reviewing scales with risk,
not with habit; a phase this size still gets reviewed, just not at Phase 7's scale.

---

## 2026-08-10 — An INBOX reply is not filed until you have read it back

**Context.** `CLAUDE.md` already warned that `../contracts/INBOX.md` is written concurrently and
that line numbers move. It did not warn that content is **deleted**. During Phase 5's boot the file
went 116,824 → 111,088 bytes in twelve minutes and lost three `cgpe-mobile` Phase-4 replies,
**two of them ticked boxes that reverted to `[ ]`** — the exact state that made `cgpe-api` hold a
phase in Phase 4, arriving this time by overwrite rather than by misfiling. It was noticed only
because two greps minutes apart disagreed.

**Decision.** After writing to `INBOX.md`, grep your own reply back and re-write it if it is gone.
Re-verify rather than re-paste: the evidence is cheap to re-run and a quoted answer that has been
sitting in a deleted file is not evidence of anything. Append rather than rewrite when touching an
item you did not author.

**Consequence.** There is no undo. `CGPE-CURRENT-PROJECT/` is a git repo with zero commits and
`contracts/` is untracked in it, so no previous version of that file exists anywhere. Creating that
first commit is **not** the fix a session should apply unilaterally — it would sweep all three
project trees into one repo.

---

## 2026-08-10 — A 2xx is not a success; the body's own delivery verdict is

**Context.** `POST /api/whatsapp/hub/send` writes its log row *before* it calls the WhatsApp
gateway and answers `200 success:true` whether the gateway took the message or not. The truth is
in a top-level `delivery: { dispatched, configured, note }` object that sits **beside** `data`.
Phase 5 found the app painting a sent tick on the status code alone — and would have carried on
doing so even after the `text`/`message` fix, because the 400 it was getting would have become a
200 that still delivered nothing.

**Decision.** Where an endpoint reports its own outcome in the body, that verdict outranks the
HTTP status, and the client reads it. A helper that unwraps to `data` — `tryReal`, here — cannot
be used on such an endpoint, because the verdict is not inside `data`. Use bare `req()`, as
`addLead` does. Where the verdict is **absent**, that is a contract fault reported to
`data/health`, not an outcome to guess at.

**Consequence.** `sendWaMessage` returns a four-outcome union, not `void` and not a boolean:
`dispatched` · `undelivered` (with `configured`, because it decides whether retrying is worth
offering) · `invalid` · a transport `WriteFailure`. The same shape is owed to
`POST /api/campaigns/send`, which `api.md` records as reporting `success:true` when the webhook is
unset — same disease, different organ, and Phase 8's or a later phase's to fix.

---

## 2026-08-10 — Quote the producer's message, except when it is jargon

**Context.** `cgpe-admin` adopted "render the server's own rejection message rather than compose
our own" for the geofence, and it is a good rule — it stops three clients inventing three
different explanations. Phase 5 applied it to the WhatsApp gateway and produced a banner reading
*"n8n webhook not configured — message logged locally only"* for a field advisor who is reading
the app in Gujarati and has never heard of n8n.

**Decision.** Quote the producer when it knows something we do not — a status code, a distance, a
validation reason. Write our own sentence when we already know exactly what happened and the
server's phrasing names its own internals. The test is not *who wrote it* but *does the reader
learn what to do next*.

**Consequence.** The two `delivery.dispatched: false` cases are worded differently on purpose:
"the gateway refused it" quotes the note (it carries n8n's status code, which exists nowhere else),
"the gateway is switched off" does not (we know the cause, and can say retrying will not help).

---

## 2026-08-10 — A phase is reviewed adversarially before it is called done

**Context.** Phase 4's first commit passed all three gates — `tsc` clean, 185 tests green, lint at
baseline — and was still wrong in eight places. A five-lens review (contract fidelity, runtime
correctness, screens, tests, regression sweep) raised 22 findings; each was then given to two
independent skeptics whose instructions were to **refute** it, defaulting to refuted when
uncertain. Eight survived. One was a real bug the phase itself introduced: `addLead` called
`reportIfOutage`, which leaves a read-once note in `suppressed` for `unavailable` to consume, and
`addLead` never calls `unavailable` — so the next genuine `GET /leads` outage was silently eaten.

**Decision.** Green gates are necessary and not sufficient. The findings worth keeping are the
ones that survive an attempt to kill them; "refuted because it is pre-existing behaviour this
commit neither introduced nor worsened" retired 14 of the 22, which is exactly the noise a review
without a refutation step would have spent the next session on.

**Consequence.** Two corrections to decisions recorded hours earlier, both below: nothing may map
UP into `policy_issued`, and no *permanent* refusal is buffered. Both were written as reasoned
decisions the first time and were still wrong. A decision entry is not a proof.

---

## 2026-08-10 — Nothing may guess a lead UP into a closed sale

**Context.** The first draft of `mapLeadStage` aliased `converted → policy_issued`. It broke this
phase's own "understate, never overstate" rule in the one direction that costs money: guessing a
sale closed removes a lead from the open pipeline *and* adds it to a won figure. It was also a
guess about a token that occurs on no document — `converted` is not a value of any of the four
lead vocabularies; it appears only in the `!converted` query sentinel, which `enums.md:218` records
as unable to match anything.

**Decision.** An alias may resolve a lead DOWN the funnel or not at all. Unknown input lands on
`new_lead`, the schema default. The same rule retired the buffering of permanently-refused
creates: a `403`/`404`/`501` is as final as a `400`, so the record is not held on the device
either — only `network` and `server` failures are.

**Consequence.** A genuinely-converted legacy document would read as New and sit in the open book,
where a human sees it. That is the cheaper error: a wasted call, rather than a sale nobody made.

---

## 2026-08-10 — The app's lead vocabulary is the server's enum, not one of its own

**Context.** Phase 4. `LeadStage` was `new | contacted | meeting | proposal | closed_won |
closed_lost` — six words the app invented. `Lead.status` is enum-enforced to five
(`contracts/enums.md:212`), `stage` is not a path on the schema at all, and `enums.md` §15 lists
two further lead vocabularies (the query-engine dropdown, `queryEngine.js:194`) with the
instruction not to merge them. Keeping the six and translating on write was the smaller diff, but
`contacted` and `proposal` have no target in the enum, so the translation is lossy exactly where
the user can see it: they tap **Contacted**, the server stores `new_lead`, the confirming read
disagrees, and the app reports "not saved" every time.

**Decision.** `LeadStage` **is** `new_lead | meeting_scheduled | docs_shared | policy_issued |
lost`. The app keeps no vocabulary of its own; the property is still called `stage` because that
is internal, and `STAGE_META` supplies the labels (New · Meeting · Docs shared · Policy issued ·
Lost). Unknown input resolves to `new_lead` — the schema's own default, not an invented fallback.

**Consequence.** Nine files, all found by `tsc` because `STAGE_META` is an exhaustive
`Record<LeadStage, …>`; keep it exhaustive for exactly that reason. The funnel is four steps, not
five. Anything that still says `closed_won` is stale — including, per the INBOX item filed on
2026-08-10, the admin panel's Android preview.

---

## 2026-08-10 — On a lead, `status` beats `stage` — the opposite of the backend's own reader

**Context.** Real lead documents can carry both. `contracts/models.md:2138` (drift #5) records
that raw readers use `stage`, and `reports.js:121` reads `l.stage || l.status`. `adaptLead` did
the same. But no endpoint in `api.md` §Leads accepts `stage` in a request body — `status` is the
only one of the two the app can write.

**Decision.** Read `status` first, fall back to `stage`, and say so in the code. A stage-first
reader displays a value nobody can change: a saved move stays invisible and every write reads as
unconfirmed, which is the Phase 4 defect moved rather than fixed.

**Consequence.** A lead moved from the app reads as moved to us and as unmoved to `reports.js`,
on the same document. That is a real divergence, filed to `cgpe-api` as an observation with the
suggestion that a backfill plus one canonical accessor is the honest fix. **We will not write
`stage`** unless `api.md` documents us writing it.

---

## 2026-08-10 — A 400 is a refusal: not an outage, and not a local save

**Context.** Phase 4. `POST /api/leads` requires `phone` and validates it server-side, so a typo
is the likeliest failure the Add-lead sheet will ever see. Routed through `tryReal` it was
reported to the health channel — one user's mistyped number raised "some data could not load" for
the whole app — and the record was then held in the local write buffer as if it had been captured.

**Decision.** `WriteFailure` gains `invalid`. A 400 shows the server's own sentence on the sheet,
raises no banner, and **buffers nothing**: the server has refused this record and will keep
refusing it until the user changes what they typed, so keeping it would be a fabrication. Network
and 5xx failures keep the buffer, which is what it is for.

**Consequence.** No client-side phone rule was added. The server owns that validation
(`isMobilePhone`), and a second regex here would be a second source of truth that drifts.

---

## 2026-08-10 — Not every failure is an outage: 401/403/404/501 are answers

**Context.** Phase 3 taught `tryReal`/`tryEnvelope` to report failures. The naive version — report
every non-2xx — fails the phase's own second acceptance criterion. `GET /profiles` is admin-only
(`contracts/api.md:211`) and `getAgentLocations`/`getTeam` call it unconditionally, so every advisor
would see a permanent "some data could not load" banner against a perfectly healthy backend. A 404
is the same class: `/lic-plans` 404s in production by deployment state, not by fault.

**Decision.** `reportIfOutage` filters 401 (session already ending), 403 (a permission result),
404 and 501 (the endpoint is not there — Phase 1 already named this `unsupported`). Everything else,
including every 5xx **and a 200 whose body fails `validate`**, is reported: the caller's next move is
to render a zeroed shell, and an unlabelled zero is the exact lie the channel exists to prevent.

**Consequence.** The suppression needs a hand-off, because most callers answer `tryReal`'s `null`
with `?? unavailable(...)`, which reports unconditionally and would undo the verdict one line later.
That is what the `suppressed` set in `api.ts` is for, and it is why `healthKey()` exists — producer
and consumer have to meet on one string. **Do not "simplify" either away.**

---

## 2026-08-10 — `degraded` stays global and sticky; per-screen scoping is its own phase

**Context.** Making `reportSuccess` clear per endpoint means `degraded` becomes
`failures.length > 0` and stays true until *that* endpoint recovers. 31 screens read the global flag,
and two endpoints are known-broken until Phase 6 (`/commissions`, `/lic-plans`), so the flag can stick
for a whole session.

**Decision.** Accept it. Checked all 31 consumers first: all but one gate their outage copy on
`degraded && list.length === 0`, so a stuck flag can only mis-speak on a screen that is **genuinely
empty** while a different endpoint is broken. That is strictly narrower than what it replaces — a
real outage rendering "No clients in your book yet."

**Consequence.** A truly per-endpoint `degraded` means touching all 31 screens and is a phase in its
own right. Nobody should attempt it as a drive-by. A TTL was explicitly rejected: it would mean
inventing a timing number that is written down nowhere.

---

## 2026-08-10 — `at` is the outage clock and re-stamps on every failure, repeats included

**Context.** `src/app/search.tsx:489` snapshots `getHealth().at` before its fan-out and compares at
`:508` to decide whether **this** query lost a collection, rather than whether the app has failed at
any point since launch. Meanwhile the banner un-dismissed itself on every `at` change, so once
Phase 3 made ~21 more endpoints report, a screen retrying a dead endpoint would re-open a banner the
user had just closed and the close button would look broken.

**Decision.** `at` keeps its every-failure semantics — including a repeat of an endpoint already in
the list — and `reportSuccess` never moves it. The banner's dismissal was re-keyed onto the failure
**set** instead.

**Consequence.** These two are a matched pair. "Optimising" `reportFailure` to skip the re-stamp for
an already-listed endpoint silently breaks `search.tsx`: a real outage on a retried search would
render as "nothing matched". There is a test pinning both halves in `health.test.ts`.

---

## 2026-08-10 — A phase's file list is a floor when the DONE-WHEN cannot be met without more

**Context.** Phase 3's brief named `tryReal`, `reportSuccess` and `getTeamActivity`. Its DONE-WHEN
required the Master dashboard to stop rendering a plausible all-zero org. Those are not the same
task: `getClientStats` returned a truthy all-zeros object on every path, which made
`getOrgSnapshot`'s outage gate at `api.ts:275` **unreachable dead code**. Fixing only the three named
things would have raised the banner while the dashboard still displayed "0 clients · ₹0 claims paid".

**Decision.** Extend to the bare-`req()` read paths the criterion depends on — `getClientStats`,
`getClientsPage`, `scanRenewals` — and write the reasoning into `docs/spec/PHASE-3.md` §2 rather than
widening quietly. Everything genuinely outside the criterion was named and left
(`src/screens/dashboards.tsx`, `uploadFile`, the Phase 4/5 write paths).

**Consequence.** When a phase's stated files and its stated DONE-WHEN disagree, the DONE-WHEN wins
and the deviation gets written down. That is the same rule `docs/spec/PHASE-2.md` used for its two
deviations.

---

## 2026-08-10 — Tests pin TODAY'S behaviour, bugs included

**Context.** Phase 2 pinned five pure functions that are full of known-wrong behaviour that later
phases will fix: `mapLeadStage('policy_issued')` returns `'new'`, `partial_paid` reads as `settled`,
`not_converted` reads as `closed_won`, the geofence fallback fails closed at 2 km. Writing the
*correct* expectation would have made the suite red on day one.

**Decision.** Every assertion states what the code does today. Cases that freeze a bug say so in the
test name and sit in a `describe` block called *"pinned known bugs — these must be updated
deliberately when fixed"*, with a comment naming the phase that owns the fix.

**Consequence.** When Phase 4 fixes the lead vocabulary or Phase 7 makes the fence fail open, **those
tests going red is the intended signal**. Read the case comment, then change the expectation on
purpose. A future session that "fixes the failing tests" without reading them destroys the signal.

---

## 2026-08-10 — Stub at the module boundary; never refactor source to make testing easier

**Context.** `normalizeUiConfig` is a pure function, but importing `store/appUi.tsx` drags in
`react-native`, AsyncStorage, expo-local-authentication and expo-secure-store — entirely because of
two *value* imports (`import * as api`, `import { useAuth }`) that only `AppUiProvider` uses.
Extracting the normaliser into a dependency-free module would need zero stubs and is the cleaner end
state.

**Decision.** Four resolution-only alias stubs in `vitest.config.mts`, and no source change. Verified
first that no stubbed byte sits between a test and a function under test: `Platform` is dereferenced
only at `constants/config.ts:45` and `api.ts:1277` (`uploadFile`), which none of the five tested
functions touches.

**Consequence.** Phase 2 did not move code it was not asked to move, and `appUi.tsx` stays whole for
Phase 10 to rewrite. **The guard is the stub list:** if a future test needs a fifth stub, or a new
export on an existing one, that is the signal the test has left pure-logic territory — where a green
test starts proving only that the stub behaves as written.

---

## 2026-08-10 — No time expectation is ever written as a UTC literal

**Context.** `scanRenewals` is local-time end to end (`api.ts:651`, `:663-664`) but serialises with
`toISOString()` (`:673`), and `adapt.ts`'s `daysUntil` normalises to local midnight. A hardcoded
`'2026-12-31T18:30:00.000Z'` passes on an IST dev box and fails on a UTC CI box.

**Decision.** Every expected timestamp is constructed in the test with the same local-time
`new Date(y, m, d)` the code uses, and every date fixture uses the `'YYYY-MM-DDTHH:mm:ss'` form,
which ECMAScript parses as local (the date-only form is parsed as UTC and shifts a day west of
Greenwich). `TZ: 'Asia/Kolkata'` is set in the config as belt-and-braces, but **no assertion depends
on it**.

**Consequence.** The suite is timezone-independent by construction rather than by configuration, so
it survives being run on CI, on a laptop that travels, or under a changed `TZ`.

---

## 2026-08-10 — Test files are split by what they stub, not by what they cover

**Context.** `api-geo.test.ts` proves `checkGeofence` reaches its offline fallback by asserting
`fetch` is **never called**. `scanRenewals` lives in the same module and needs a working `fetch`
stub. Vitest isolates per *file*, not per test.

**Decision.** They live in separate files, so the renewals stub cannot silently satisfy a geofence
request that should never happen. `src/data/api.ts` also carries module-level state with no reset
path (`_geoCache` at `:1037`, `sessionReal` at `:46`, the `state` buffer at `:152`), so any file
touching it calls `vi.resetModules()` and re-imports in `beforeEach`.

**Consequence.** A test file's stub surface is part of its contract. Adding a `fetch` stub to
`api-geo.test.ts` would silently void its central assertion.

---

## 2026-08-10 — A failed write returns `{ok:false, reason}`; it does not throw

**Context.** Phase 1 had to give five write functions a way to report failure. `updateTaskStatus`
already returned `{ok:false, forbidden:true}` for a 403; the other four returned a hardcoded
`{ok:true}` and their callers were written around a truthy `res.ok`.

**Decision.** Generalise the existing shape into an exported `WriteFailure` union
(`'network' | 'server' | 'forbidden' | 'unsupported'`) rather than introducing exceptions. The one
exception is `store/auth.tsx`'s `deleteAccount`, which throws — because `app/account.tsx` already
had a correct `try/catch` failure branch and throwing is what reaches it without rewriting the screen.

**Consequence.** Callers branch on `res.ok` and may read `res.reason` for copy. Adding a new write
means returning this shape, not inventing a third convention.

---

## 2026-08-10 — `unsupported` is a distinct failure reason, and it changes the copy

**Context.** `DELETE /api/auth/me` does not exist on the backend, so every deletion attempt 404s.
Treating that as a generic failure would show "Check your connection and try again" — advice that
sends the user round a loop which cannot succeed.

**Decision.** `unsupported` (404/405/501) is its own reason. For it, `account.tsx` shows only the
first sentence of the existing copy: *"The server did not confirm the deletion, so your account is
unchanged."* This narrows locked spec row 9 ("no new user-facing copy") to a **subset** of approved
copy rather than new copy, and was recorded as row 9a in `docs/spec/PHASE-1.md` mid-build rather than
chosen silently.

**Consequence.** Transient faults tell the user to retry; absent endpoints do not.

---

## 2026-08-10 — Dead interactions are removed, not fake-persisted

**Context.** `toggleTaskStep` made no network call and mutated `state.tasks`, which `getTasks`/
`getTask` never populate — so the whole body was dead, the tick reverted on the next focus refetch,
and the screen fired a success haptic over it. There is no backend endpoint for a task step.

**Decision.** Delete the function and render the checklist read-only, rather than keeping a local-only
tick. Same reasoning will apply to `toggleReminder` and `toggleClaimDoc` in Phase 9.

**Consequence.** Users lose an affordance they appeared to have. That is the honest trade: a tick that
silently reverts trains people to distrust every other confirmation in the app. Ship Phase 9 soon and
say so in the release note.

---

## 2026-08-10 — `../contracts/` is the source of truth, not the prose docs

**Context.** Three documents describe the same API: `ADMIN_PANEL_SYNC.md` (1318 lines),
`ADMIN_PANEL_GUIDE.md`, and `../contracts/api.md` (426 endpoints, generated by reading every backend
route file in full). `contracts/CHANGELOG.md` records 15 confirmed drifts where the prose and the
code disagree — including the clock-in fence radius and the `/track/points` body key.

**Decision.** When they disagree, `contracts/` wins, because it was generated from the code.
The prose docs stay useful for *intent* (why the fence is 200 m, why the preview must not fetch).

**Consequence.** Read `contracts/api.md` before hand-writing any request shape. Any breaking change
goes in `contracts/CHANGELOG.md` **before** the code, then into `contracts/INBOX.md`.

---

## 2026-08-10 — Phase 1 is write-path honesty, not the test harness

**Context.** The project has no test runner at all, which normally argues for making that Phase 1.
But five write functions currently report success when the write never reached the server, and three
of them — account deletion, attendance clock-in/out, task completion — are where a false confirmation
costs money or breaks a compliance claim the app makes to the user in writing.

**Decision.** Fix the lies first (Phase 1), add the runner second (Phase 2).

**Consequence.** Phase 1 is verified by hand against `TESTING_GUIDE.md` in airplane mode. Every phase
from 3 onward gets a binary automated check.

---

## 2026-08-10 — The geofence fallback must fail open

**Context.** `getGeofence` substitutes hardcoded Surat coordinates with `radius_m: 2000` and
`enforce: true` whenever `/time-tracker/geofence` cannot be fetched, then caches that for the whole
session. A transient failure therefore locks every staff member outside a 2 km circle out of clocking
in, with a message quoting a radius the server never confirmed.

**Decision.** When the real fence is unknown, allow the clock-in. The server re-validates
independently (`api.ts` already notes this), so failing open costs nothing and failing closed costs a
day's attendance for a whole branch office.

**Consequence.** Phase 7. The same phase drops all "200 m" copy — per `contracts/CHANGELOG.md` D10
the effective server radius is up to 300 m once GPS accuracy credit is applied.

---

## 2026-08-10 — Correcting the fail-open decision above, after building it (Phase 7)

**What the earlier entry got wrong.** It justified failing open with "failing closed costs a day's
attendance for a whole branch office". That cannot happen. There is exactly **one** global fence —
a single `org_settings` document — and `POST /time-tracker/clock-in` re-validates against it on
every request (`routes/timeTracker.js:319-329`, whose own comment says the server is the authority).
A branch office beyond the fence is refused by the server whether the app fails open or not.
Failing open moves the refusal one round trip later and changes the wording.

**The real reason, which is a better one.** The client pre-check exists to save a round trip, not to
be a second authority, and `home.tsx` returns before the write — so anything the client gets wrong
in the *strict* direction is a clock-in the server would have accepted and never hears about.
**Rule: the client pre-check may never refuse what the server would allow.** Every Phase 7 decision
follows from it: an unknown fence allows; the accuracy credit is coerced and clamped, because both
moves only ever allow more; and the server's `accuracy > 300` rejection is deliberately *not*
mirrored, because copying it would duplicate someone else's constant AND make the client refuse.

**Also wrong: "fails closed".** The app's fallback was 2000 m against a server default of 200 m. It
was ten times *wider* than the server at the office pin and absolutely closed everywhere else — not
strict, not lenient, wrong in both directions. That is what a compiled-in copy of somebody else's
database row becomes.

**Consequence.** No fallback fence and no cache at all. A carefully-handled staleness hazard was
replaced by a structurally impossible one, at a cost of one request per clock-in tap.

---

## 2026-08-10 — A phase's own diff is reviewed by skeptics briefed to refute it (Phase 7)

**Context.** Phase 4 introduced the adversarial review; Phase 5 held it. Phase 7 ran it as four
lenses over the committed diff, each finding put to two independent verifiers told to default to
"refuted". 26 findings, 52 verdicts, **four non-refutations**.

**Decision.** Unanimity is the bar for "survives", but a **split vote is a signal, not a dismissal**.
Both real defects this phase shipped a fix for came from findings where one skeptic refuted and one
did not — and the strict rule alone would have discarded both. Read the split votes by hand.

**Consequence.** The review caught a regression the phase itself introduced (any 4xx deleting a
buffered route on a routine token expiry) and a half-fix the phase had congratulated itself on
(caching successes forever). Recorded in `docs/spec/PHASE-7.md` §6 rather than quietly fixed.

---

## 2026-08-10 — Sample data stays deleted

**Context.** An earlier phase deleted the fabricated corpus; `src/data/mock.ts` is `export {}` with a
header forbidding repopulation. But `src/constants/config.ts` still documents the removed fallback in
five places, and `generateReport` still invents a ₹42,00,000 portfolio when its webhook is down.

**Decision.** The no-fabricated-data contract holds. A failed read resolves empty and reports to
`data/health`. `generateReport` becomes the last one removed (Phase 8), and the stale comments are
corrected in the same phase so no future session "restores" a safety net that was deliberately
destroyed.

**Consequence.** `state` in `api.ts` is a write buffer for records the user just typed. Repopulating
it re-introduces fabricated policyholders.
