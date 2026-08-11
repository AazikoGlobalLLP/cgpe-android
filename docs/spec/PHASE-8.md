# PHASE 8 — Delete the last fabricated-data path, and the stale docs

Session `cgpe-mobile`. Written 2026-08-11, before a line changed, from a full read of
`src/data/api.ts`'s `generateReport` and its one caller, `src/constants/config.ts`,
`src/data/tasks.ts`, `src/data/team.ts`, `HOW_TO_RUN.md`, `TESTING_GUIDE.md`, and
`src/app/(auth)/login.tsx` (to verify what login actually does today).

---

## The one-sentence goal

`generateReport` stops inventing a ₹42,00,000 cover figure when the report service cannot be
reached, and the two run/test docs stop describing an offline demo mode and a sample-data
fallback that were deleted phases ago.

## DONE WHEN (from `docs/PHASES.md:249-255`)

1. `grep -rn "source: 'demo'" src/` returns nothing.
2. No doc in the repo describes sample data.

---

## 1. What is actually broken — verified, with citations

### 1.1 `generateReport` fabricates a report on every failure

`api.ts:1894-1904` (pre-fix):
```ts
export async function generateReport(clientName: string): Promise<any | null> {
  const real = await tryReal<any>('/clients/generate-report', { method: 'POST', body: JSON.stringify({ clientName }) }, isObj);
  if (real) return real;
  // demo fallback: a representative summary so the flow is visible offline
  await wait(700);
  return {
    ok: true, familyHead: clientName, source: 'demo',
    summary: { total_policies: 2, life_cover: 4200000, annual_premium: 186000, members: 1 },
    viewUrl: null, pdfUrl: null,
  };
}
```
Any failure — offline, timeout, 4xx, 5xx, a malformed body — returns a **fixed, invented**
summary: 2 policies, ₹42,00,000 life cover, ₹1,86,000 annual premium, 1 member. `ok: true` is
also fabricated; nothing about the request succeeded.

### 1.2 The one caller already distrusts it, and says why

`client/[id].tsx:107-125`, unchanged by this phase, already refuses to show the fabricated
figures:
```ts
const r: ReportPayload | null = await api.generateReport(client.name);
setReporting(false);
// The report service falls back to an illustrative summary when it cannot be reached.
// Those figures must never reach the screen: an advisor reading an invented life cover
// to a real customer is the exact failure this app is built to avoid.
if (r?.ok && r.source !== 'demo') {
  setReport(r); setReportOpen(true); haptics.success(); return;
}
haptics.error();
setFailure('The report service did not answer, so nothing was generated. No figures are shown.');
```
So the fabricated data has never reached a screen — the caller was already written to gate on
`source !== 'demo'`, treating the API layer as untrusted. That gate does not make the
fabrication safe: it makes it *redundant with a single call site's memory*. Any second caller
(a future screen, a test) that awaits `generateReport` and checks only `.ok` would render an
invented life-cover figure to a real customer. Deleting the fabrication at the source is what
makes that impossible rather than merely unlikely — the same shape of fix as Phase 7's D-2
("an unknown fence is represented as unknown, not as a guess") and Phase 5/D-1 ("a 2xx is not a
success; the body's own verdict is").

### 1.3 `config.ts`'s docstring describes a fallback that does not exist

Five comments, verified against the current file:

| Line(s) | Claim | Why it is false |
|---|---|---|
| 8 | "falls back to sample data per-call so a screen is never empty" | `src/data/mock.ts` is `export {}`; a failed call resolves via `unavailable()` to an honest empty value (`[]`, `undefined`, a locally-known `state` record) and raises the outage banner, per `src/data/health.ts`. Nothing is invented. |
| 20-22 | the hosted `*.expo.app` preview "always shows sample data" | Same reason — it shows the empty/degraded state, not sample data. |
| 32 | `FORCE_DEMO`: "true = always sample data" | `FORCE_DEMO` (hardcoded `false`, never flipped in a shipped build) short-circuits reads straight to `unavailable()`'s honest-empty value and a handful of writes to a stub `{ ok: true }` — see §5. Neither fabricates business data. |
| 49-51 | on a CORS-blocked hosted-web origin, "the app falls back to sample data" | Same as row 1 — it shows the outage banner. |
| 57 | `MOCK_LATENCY`: "Simulated latency for sample-data responses" | It is the delay inside `unavailable()` (`api.ts:521`, `await wait()` with no argument), i.e. pacing for the *empty*-result path, not for any fabricated response. |

### 1.4 The two run/test docs describe a login and a config that no longer exist

`HOW_TO_RUN.md:3-4`: *"The app runs 100% offline with realistic demo data, so you can show it to
your seniors without the backend running."* — `login.tsx:21-22`'s own docstring: **"THERE IS NO
OFFLINE PATH ANY MORE. `api.login` / `api.verifyOtp` throw `NetworkError` when the backend
cannot be reached, and nothing here mints a local session to paper over it."** Confirmed by
reading the file: no pre-filled credentials, no demo-token issuance, both password and OTP
submit to the real backend and surface `NetworkError` as a neutral "could not reach the server"
banner, not a fallback session.

`HOW_TO_RUN.md:36` ("Any credentials work — the email/password are pre-filled") and
`TESTING_GUIDE.md:47` (the same claim) are both false for the same reason.

`HOW_TO_RUN.md:53-57` and `TESTING_GUIDE.md:99-103` both tell the reader to open
`src/constants/config.ts` and "change" `API_BASE_URL`'s "default" to a phone's LAN IP. That
default does not exist: `API_BASE_URL` (`config.ts:44-52`) is a computed expression —
`PROD_API` on native unconditionally, `PROD_API` on any non-localhost web origin, and
`http://localhost:3001/api` only on web when the browser's own origin is localhost. A native
build ignores whatever a reader edits into a "default" that is not read on that platform; the
instruction as written would not change what a phone connects to.

`TESTING_GUIDE.md:5-7`: *"Verified by an automated end-to-end run (Chrome headless)... 24/24
steps passed."* That run is undated and unreproducible as described — there is no login path
left that does not require a real advisor credential and a reachable backend, so a headless run
with no stated account is either a historical artifact of the deleted demo mode or cannot be
re-run as written. Left as a claim about the past only if it can be dated; otherwise removed
rather than repeated as a standing guarantee (see §2).

---

## 2. Locked decisions

**D-1. `generateReport` returns `null` on any failure, full stop.** Same shape as
`getDashboardOverview` / `getClaimsSummary` (`api.ts:360`, `:415`) — both nullable single-object
endpoints that return `tryReal`'s result directly with no invented fallback. `generateReport`
becomes the same one-line shape, not a new pattern.

**D-2. No `unavailable()` wrapper is added.** `unavailable(endpoint, value)` exists to supply an
honest *non-null* fallback (an empty array, a locally-known `state` record) and to consume the
`suppressed` marker so a 403/404 does not double-report. A generated report has no such
honest non-null fallback — there is nothing locally known to show in its place — so `null` is
already the correct value, and `tryReal` has already reported the failure through the normal
channel (`reportIfOutage` / `reportFailure`) before returning it. Matches D-1's precedent
exactly; adding a wrapper here would be a new pattern for no behavioural gain.

**D-3. `client/[id].tsx`'s dead `source` check is removed, its comment corrected.** Once the API
layer cannot return `source: 'demo'`, the `r.source !== 'demo'` clause is permanently true and
the `source` field is permanently `undefined` — a defensive check with nothing left to defend
against, and a comment describing a fallback that no longer exists. This is a two-line
simplification of the exact code this phase's fix makes redundant, not a new file entering
scope: `client/[id].tsx` is not touched anywhere else.

**D-4. `config.ts`'s docstring is rewritten to state what the code does now**, not what it used
to do: no sample data exists at any layer; a failed call resolves empty and raises the outage
banner; `FORCE_DEMO` and `MOCK_LATENCY` are described by their actual current effect (§1.3).

**D-5. `HOW_TO_RUN.md` and `TESTING_GUIDE.md` are corrected in place, not rewritten from
scratch.** The parts that remain true — the three `npx expo start` invocations, the
module-by-module screen checklist (each row describes UI presence, not a data source) — stay.
What changes: the offline/demo framing, the login description (real credentials, password or
OTP, `NetworkError` vs. refusal), and the config section (native and hosted-web both resolve to
the production backend; there is no LAN-IP default to hand-edit for a phone build — a phone on
the same network as the production backend already reaches it over HTTPS, and a phone that needs
a *local* backend needs a code change to the base-URL logic, not a config value).

**D-6. The stale "24/24 automated run" claim is removed rather than repeated.** It cannot be
re-run as written now that every path requires a real credential and a reachable backend, and
CLAUDE.md's own rule is not to assert a number that is not currently true. The module checklist
below it stands on its own as a manual walkthrough.

---

## 3. Files

| File | Change |
|---|---|
| `src/data/api.ts` | `generateReport` — delete the fabricated fallback; return `tryReal`'s result directly |
| `src/app/client/[id].tsx` | drop the now-dead `source` field and `r.source !== 'demo'` check (D-3) — the only file not in the phase's original list, forced by D-1/D-3, not new scope |
| `src/constants/config.ts` | rewrite the five comments named in §1.3 |
| `src/data/tasks.ts` | correct the file header's "Types + sample data" claim (no fabricated array remains — see §5) |
| `src/data/team.ts` | correct the file header's "types + sample data" claim, same reason |
| `HOW_TO_RUN.md` | remove the offline-demo framing, correct the login description, correct the config/LAN-IP section |
| `TESTING_GUIDE.md` | same three corrections, plus remove the stale "24/24 automated" claim (D-6) |

## 4. Acceptance criteria

1. `grep -rn "source: 'demo'" src/` returns nothing.
2. `generateReport` has no code path that returns a summary object without a successful
   `tryReal` call underneath it.
3. Killing the backend (or signing in with an unreachable API) and requesting a report on any
   client shows "The report service did not answer, so nothing was generated. No figures are
   shown." — not a report sheet.
4. `grep -rniE "sample data|demo data|offline demo" *.md HOW_TO_RUN.md TESTING_GUIDE.md` returns
   nothing.
5. Neither doc instructs a reader to edit `API_BASE_URL` for a phone build.
6. `npx tsc --noEmit` and `npm test` stay green; no test currently asserts the deleted fallback
   (confirmed: no test file references `generateReport`).

## 5. Deliberately out of scope

- **`uploadFile`'s `if (!sessionReal || FORCE_DEMO) { ...; return { url: 'demo://uploaded/' + name } }`**
  (`api.ts:1908`) and the handful of `if (FORCE_DEMO) { await wait(N); return { ok: true }; }`
  write-side stubs (`deleteAccount` `:642`, two more at `:1641`/`:1661`). All four are gated on
  `FORCE_DEMO`, a hardcoded `false` never flipped in a shipped build — `!sessionReal` alone gates
  `uploadFile`'s branch too, but that only fires before any session exists. None of the four
  invents a business figure the way `generateReport` did; the phase text names ONE remaining
  fabricated-data path, and it is this one. Left alone.
- **The orphaned `d()` / `iso()` / `at()` date helpers in `tasks.ts` / `team.ts`.** Explicitly
  Phase 14's ("Dead-code sweep"), named there by file. This phase corrects only the false header
  comment on each file, not their contents.
- **`docs/HOW_TO_RUN.md` / `TESTING_GUIDE.md`'s screen-by-screen feature claims** (§3 of the
  testing guide) are left as-is where they describe UI presence rather than a data source —
  re-verifying all 24 by hand is Phase 8's "Done means" device-walkthrough obligation from
  `CLAUDE.md`, not a rewrite obligation.

---

## 6. What the adversarial review found

One independent pass over the committed diff (D-nothing new locked; this phase is small enough
that one skeptical read, not a multi-lens panel, was proportionate). Five of six checks came
back clean — `generateReport`'s new body matches its cited precedent exactly, nothing else in
`src/` still references `.source` on a report or constructs the fabricated ₹42,00,000 shape, and
`HOW_TO_RUN.md`/`TESTING_GUIDE.md` were verified line-by-line against `login.tsx`'s own
`NetworkError` handling.

**One real defect: `config.ts` was not internally consistent after its own rewrite.** The
docstring's numbered list (originally lines 15-20, untouched by the first pass) still told a
reader to "Set API_BASE_URL below" for native and described the web-same-origin case as
resolving "the relative `/internal/api`" — both written before this phase's rewrite of the
"Backend base URL" paragraph 24 lines below, which says the opposite: native always resolves to
`PROD_API` with nothing to hand-edit, and the ternary never produces a relative URL, only the
absolute `PROD_API` or an absolute `localhost` address. Rewriting one paragraph and leaving its
neighbour's contradicting claim in place would have been the exact class of defect this phase
exists to close, one paragraph later. Fixed; the file now agrees with itself end to end.
