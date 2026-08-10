# HANDOFF — CGPE Connect (Android) — Phase 3 — 2026-08-10

## Done

- **The data-health channel now tells the truth in both directions.** It was broken both ways:
  silent for ~21 endpoints that failed, and raising a false alarm on every Team screen mount.
- **`git works again, and Phases 1 and 2 are committed.`** They never were — git was
  permission-denied for two sessions. `git config --global --add safe.directory F:/…/ANDROID`
  fixed it. Phase 1+2 are `123db30`; Phase 3 is `e0b0b2c`. Branch `Shivam`, pushed.
- **`npm test` is 164 tests over 6 files, ~0.5 s.** `npx tsc --noEmit` exits 0. `npm run lint` is
  61 problems / 46 errors / 15 warnings — byte-identical to the baseline.

### What actually changed

- `tryReal` / `tryEnvelope` report failures. They used to return `null` three different ways and
  say nothing, so **18 of 32 `tryReal` call sites failed invisibly**.
- **Not every failure is an outage.** 401/403/404/501 are answers, not faults, and stay quiet.
  A **200 with an unusable body IS** reported — the caller renders a zeroed shell next.
- `reportSuccess(endpoint)` clears one endpoint instead of wiping the whole list. `degraded` is
  now derived (`failures.length > 0`).
- `getTeamActivity` returns `[]` silently instead of `unavailable('/activity', [])` — a path the
  backend has **never had**, which raised a banner on every Team mount.
- `getClientStats` returns `null` when neither request answered; `getClientsPage` and
  `scanRenewals` report their failures.

## Three findings the phase text did not predict

1. **A `tryReal`-only fix could not have met the DONE-WHEN.** `getClientStats` returned a truthy
   all-zeros object on *every* path, so `getOrgSnapshot`'s outage gate at `api.ts:275` was
   **unreachable dead code**. The all-zero Master dashboard was not a rendering choice — it was a
   dead branch. The bare-`req()` paths had to be in scope.
2. **Reporting 403 would have broken the second acceptance criterion.** `GET /profiles` is
   admin-only (`contracts/api.md:211`), so the naive "report every failure" fix gives **every
   advisor a permanent outage banner on a healthy backend**. Hence `reportIfOutage` and the
   `suppressed` hand-off — without which `?? unavailable(...)` would undo the suppression one
   line later.
3. **`clone(undefined)` threw a SyntaxError**, so `unavailable()` *rejected* for all six
   single-record lookups (`getClient`, `getLead`, `getTeamMember`, `getTicket`, `getFamily`,
   `getKbArticle`). Those "could not load" empty states had never rendered either. Pre-existing,
   found because a new test walked into it, fixed in one line.

## Decisions made

- **`degraded` stays global and is now sticky, deliberately** (`docs/spec/PHASE-3.md` L8). Once an
  endpoint fails it stays listed until *it* recovers. 31 screens read the global flag, but all but
  one gate it as `degraded && list.length === 0` — so the residual imprecision is a genuinely empty
  screen reading "could not load" while a *different* endpoint is broken. Strictly narrower than
  what it replaces. Making it per-endpoint means touching all 31 screens; that is its own phase.
- **`at` keeps its every-failure semantics, including repeats.** `src/app/search.tsx:489` snapshots
  it before a fan-out and compares at `:508` to scope an outage to one query. Suppressing the
  re-stamp would turn a real outage on a retried search into "nothing matched". The banner's
  dismissal moved off `at` and onto the failure **set** instead, so a retry cannot re-open a
  banner the user just closed.
- **A shared health key for deliberate fallback chains.** `getAttendanceHistory` tries
  `/time-tracker/history` then `/attendance/history`; both report under one key, so the second
  leg's success clears the first leg's entry and no banner appears on a screen that got its data.
- **Banner copy is now "could not be completed", not "did not reach the server"** — the latter is
  false for a 200 with a bad body, and sends the user chasing a network problem they do not have.

## Known broken / deliberately skipped

- **Phase 1 acceptance criteria 1–6 are STILL UNVERIFIED.** Haptics, an AsyncStorage clock key and
  background GPS. They need a handset in airplane mode. Three phases have now not covered them.
- **Phase 3's own criteria 5–7 are unverified on a device.** They need a killed backend and a
  non-admin account. Everything machine-checkable (1–4) is green.
- **`src/screens/dashboards.tsx:292-297` still renders all-zero KPI tiles on a PARTIAL outage.**
  If the roster loads but the org endpoints are down, `snapshot` is `null` and the tiles read
  `snapshot?.total_clients ?? 0` → "0 clients · ₹0 claims paid" as fact. **The fix is specified and
  small:** the hero directly above at `:266` already uses the file's own `NO_VALUE` placeholder;
  the tile grid needs the same. Left out because `dashboards.tsx` is not in Phase 3's file list and
  the phase's DONE-WHEN (a *fully* dead backend → `team.length === 0` → honest empty state) is met.
- **`uploadFile` (`api.ts:1283`) bypasses `req()` entirely** — a raw multipart `fetch`, so a 401 on
  upload never expires the session, breaking the invariant the file header claims. Not health, not
  fixed, logged here.
- **Write-path fabrications remain** — `setLeadStage`, `addLead`, `addTask`, `reassignTask`,
  `sendWaMessage` all return locally-minted objects as if the server accepted them. Phases 4 and 5.
- **`.agents/` is now gitignored** rather than committed (91 files of agent tooling, not source).

## Contracts

- **Filed to `cgpe-api`:** `GET /api/dashboard/activity` returns `[]` for every role because
  `utils/activity.js:22-28` writes `actor.id` while `routes/dashboard.js:229` filters
  `actor.user_id`. Also asked them to stop swallowing the query error, since a broken feed and a
  quiet day are currently indistinguishable on the wire.
- **Answered `cgpe-api`'s blocking question** on the 31 endpoints about to go behind `protect`:
  **the app calls none of them** (verified by two greps, both quoted in the item). Phase 4 on their
  side is safe to ship and needs nothing from mobile.
- **`INBOX.md` was rewritten by `cgpe-api` twice while this session ran** — item headings moved
  between two reads minutes apart. Re-read immediately before editing, and anchor edits on text,
  never on a line number.

## Next session starts here

- **Phase 4 — the leads contract.** Unwrap the `{ lead }` envelope on GET/POST, send `status` with
  the server's own enum, teach `mapLeadStage` the real vocabulary.
- **First command:** `npm test` — confirm 164 before touching anything.
- **Watch out for:** two tests in `adapt.test.ts` are pinned to today's wrong `mapLeadStage` and
  **are supposed to go red** when Phase 4 lands. Read the case comment, then update the expectation
  on purpose. Same convention as `api-renewals.test.ts:187`, which this phase flipped.
- **Also worth 20 minutes:** the `dashboards.tsx` tile placeholder above. It is the last confident
  all-zero surface in the app and the fix is a one-file mirror of what that file already does.
