# Decisions — CGPE Connect (Android)

Append-only. Newest first. One entry per decision that a future session would otherwise re-litigate.

Format: `## YYYY-MM-DD — <decision>` / **Context** / **Decision** / **Consequence**.

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
