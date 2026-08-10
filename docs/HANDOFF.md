# HANDOFF — CGPE Connect (Android) — Phase 3 — 2026-08-10

Commits: `123db30` (Phase 1+2, finally committed) · `e0b0b2c` (Phase 3) · `ee21087` + `<docs>`.
**Branch `Shivam` is NOT pushed — see Known broken.**
Gates: `npx tsc --noEmit` exit 0 · `npm test` **164 passed / 6 files** · `npm run lint` 46 errors
(byte-identical to baseline).

## Done

- **Killing the backend and opening the Master dashboard now raises the banner and shows
  "Organisation figures did not load"** instead of a confident "0 clients · ₹0 claims paid".
- **Opening Team against a healthy backend raises no banner.** It used to raise one on *every*
  mount, for an endpoint the backend has never had.
- **An advisor (non-admin) opening Team raises no banner either**, despite `GET /profiles` 403ing.
- **A dropped connection on the client list now says so** — previously an agent with a 9,000-client
  book was told "No clients in your book yet".
- **A renewal scan that loses a page says so** — it used to look identical to "nobody is due", on
  the list that decides who gets called about a lapsing policy.
- **The banner counts correctly and is dismissible.** It used to undercount (usually to "One
  request") and was order-dependent inside a `Promise.all` fan-out.
- **Six detail-screen "could not load" states can render at all now** — `clone(undefined)` threw, so
  `unavailable()` had been *rejecting* for every single-record lookup.
- **git works again.** Phases 1 and 2 had never been committed; they are now.

## Files changed

- `src/data/health.ts` — `reportSuccess(endpoint)` clears one endpoint instead of wiping the list;
  `degraded` is now derived from `failures.length`.
- `src/data/api.ts` — `healthKey()` normaliser, `reportIfOutage()` classifier, `suppressed` hand-off;
  `tryReal`/`tryEnvelope` report; `getTeamActivity` returns `[]` silently; `getClientStats` returns
  `null` when nothing answered; `getClientsPage`/`scanRenewals` report; `getAttendanceHistory`'s two
  legs share one key; `clone` is undefined-safe; two redundant `reportSuccess()` calls removed.
- `src/ui/health-banner.tsx` — dismissal keyed on the failure set, not `at`; copy is now "could not
  be completed" (true for a 200 with a bad body, which "did not reach the server" was not).
- `src/app/team/index.tsx` — removed a dead `.catch()` and a comment that was wrong twice.
- `src/data/__tests__/health.test.ts` **(new, 24 tests)** — the ledger, the classifier, the 403 case,
  the DONE-WHEN, and the key normaliser.
- `src/data/__tests__/api-renewals.test.ts` — `:187` flipped deliberately; it was written to go red.
- `docs/spec/PHASE-3.md` **(new)** — 10 locked decisions, 7 acceptance criteria, out-of-scope list.
- `docs/{PHASES,PROJECT_MAP,STATUS,DECISIONS}.md`, `CLAUDE.md` — see Decisions.
- `.gitignore` — `.agents/` ignored (91 files of agent tooling, not project source).
- `../contracts/INBOX.md` — one item filed, one blocking question answered.

## Decisions made

Four appended to `docs/DECISIONS.md` in full. In short:

- **401/403/404/501 are answers, not outages** — reporting 403 would have given every advisor a
  permanent banner on a healthy backend. Needs the `suppressed` hand-off, because
  `?? unavailable(...)` would otherwise undo the verdict one line later.
- **`degraded` stays global and sticky** — checked all 31 consumers first; nearly all gate on
  `degraded && list.length === 0`, so the residual imprecision is far narrower than what it replaced.
  A TTL was rejected: it would mean inventing a timing number written down nowhere.
- **`at` re-stamps on every failure, repeats included** — `search.tsx:489` measures against it. The
  banner's dismissal moved onto the failure set instead. Matched pair; a test pins both halves.
- **A phase's file list is a floor when its DONE-WHEN needs more** — the bare-`req()` paths had to be
  in scope, and the reasoning is written into the spec rather than the scope widened quietly.

## Known broken / deliberately skipped

- **The branch is not pushed — `git push` returns 403.** The stored credential is `reactjsaaziko`;
  the repo is `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. That account has no write access. Nothing was
  discarded and all commits are local and intact. **Needs a human:** grant that account write access,
  or swap the credential in Windows Credential Manager. `gh` is not installed on this machine.
- **`src/screens/dashboards.tsx:292-297` still shows all-zero Master KPI tiles on a PARTIAL outage**
  (roster loads, org endpoints down) — because `dashboards.tsx` is not in Phase 3's file list and the
  DONE-WHEN is met without it. **The fix is specified:** mirror the `NO_VALUE` placeholder the same
  file already uses at `:266`. This is the last confident all-zero surface in the app.
- **Phase 3 acceptance criteria 5–7 are unverified on a device** — they need a killed backend and a
  non-admin account. Criteria 1–4 (the machine-checkable ones) are green.
- **Phase 1 acceptance criteria 1–6 are STILL unverified** — haptics, an AsyncStorage clock key and
  background GPS need a handset in airplane mode. Three phases have now not covered them.
- **`uploadFile` (`api.ts:1283`) bypasses `req()`** — raw multipart `fetch`, so a 401 on upload never
  expires the session, breaking the invariant the file header claims. Named, not fixed; not health.
- **Write-path fabrications remain** — `setLeadStage`, `addLead`, `addTask`, `reassignTask`,
  `sendWaMessage` return locally-minted objects as if the server accepted them. Phases 4 and 5.

## Next session starts here

- **Phase 4: the leads contract** — unwrap the `{ lead }` envelope on GET/POST, send `status` with
  the server's own enum, and teach `mapLeadStage` the real vocabulary.
- **First command:** `npm test`
- **Watch out for:** two tests in `adapt.test.ts` are pinned to today's **wrong** `mapLeadStage` and
  are **supposed to go red** when Phase 4 lands. Read the case comment, then change the expectation
  on purpose — do not "fix the failing tests". Phase 3 flipped `api-renewals.test.ts:187` the same
  way. Second trap: `../contracts/INBOX.md` was rewritten by `cgpe-api` twice mid-session, so anchor
  any edit there on text, never on a line number.
