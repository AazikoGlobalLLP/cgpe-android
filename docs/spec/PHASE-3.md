# PHASE 3 — Repair the data-health honesty channel

**Session:** `cgpe-mobile` · **Written:** 2026-08-10 · **Baseline commit:** `123db30`
**Gates at baseline:** `npm test` 140 passed / 5 files · `npx tsc --noEmit` exit 0 · `npm run lint` 46 errors

---

## The one-sentence goal

A failed read must be distinguishable from an empty one, on every screen, without the app
either under-reporting (today) or crying outage when nothing is wrong.

## DONE WHEN (from `docs/PHASES.md`)

> Killing the backend and opening the Master dashboard raises the banner (today it renders a
> plausible all-zero org silently), and opening Team against a healthy backend raises none.

---

## 1. What is actually broken — verified, with citations

Every row below was read at the cited line, not inferred.

| # | Defect | Where | User-visible consequence |
|---|---|---|---|
| D1 | `tryReal` never reports a failure | `src/data/api.ts:118-128` | 18 of 32 call sites resolve `null`/`[]` with the health channel untouched |
| D2 | `tryEnvelope` never reports a failure | `src/data/api.ts:1350-1359` | 3 of 9 call sites, same |
| D3 | `reportSuccess()` wipes the **whole** failure list | `src/data/health.ts:74-78` | banner is order-dependent in a `Promise.all` fan-out, and undercounts |
| D4 | `reportSuccess()` has no endpoint identity to clear by | `src/data/api.ts:109,114` | `reportAuth(status, sentToken)` — `path` is in scope at `req()` but never passed |
| D5 | `getTeamActivity` fabricates an outage for a path that never existed | `src/data/api.ts:1008-1010` | every Team mount raises a false banner at t≈0 |
| D6 | `getOrgSnapshot`'s outage gate is dead code | `src/data/api.ts:275` | **the DONE-WHEN defect.** See §2. |
| D7 | `getClientsPage` fails completely silently | `src/data/api.ts:588-607` | a 9,000-client book renders "No clients in your book yet" |
| D8 | `getClientStats` returns a truthy all-zeros object | `src/data/api.ts:610-625` | defeats the `!stats` outage gate at `src/app/analytics.tsx:289` |
| D9 | `scanRenewals` swallows a failed page | `src/data/api.ts:655` | an outage-caused empty renewal audience reads as "nobody is due" |
| D10 | the `.catch()` on the activity feed is dead code | `src/app/team/index.tsx:50` | `unavailable()` always resolves; the comment at `:46-47` is wrong twice |

### 2. Why D6 is the phase, and why a `tryReal`-only fix does not close it

`getClientStats` (`src/data/api.ts:610-625`) returns an **object literal on every path** once
`sessionReal` is true: `total` falls back to `0` through the swallowed `catch` at `:616`, and
each remaining field is `agg?.x ?? 0`. So `stats` is always truthy, `!stats` at `:275` is never
true, and `if (!dov && !stats && !ov) return null` **can never fire for a signed-in user**.

The Master dashboard therefore receives a zeroed-but-truthy snapshot, `orgReady` is `true`
(`src/app/(tabs)/home.tsx:1062`), and the already-written honest empty state at
`src/app/(tabs)/home.tsx:1918-1935` has never rendered in any run of this app — contradicting
the comment one line above it at `:1061`: *"Leadership figures are real or absent. All-zero org
tiles are worse than no tiles."*

Fixing `tryReal` alone would raise the banner (via `getDashboardOverview` / `getTaskOverview`)
while the dashboard still displayed "0 clients · ₹0 claims paid" as fact. That is half a fix.
**D8 is therefore in scope**, and with it the two other bare-`req()` read paths, D7 and D9.

---

## 3. Locked decisions

**L1 — Not every failure is an outage.** `tryReal`/`tryEnvelope` classify before reporting:

| Condition | Reported? | Why |
|---|---|---|
| network error / `AbortError` (4.5 s timeout) | **yes** | this is what "could not reach the server" means |
| HTTP 5xx | **yes** | the server is failing |
| HTTP 200 with a body that fails `validate` | **yes** | the screen would otherwise show a zeroed shell as fact |
| HTTP 401 | **no** | `reportAuth` already ends the session (`src/data/api.ts:110-112`) |
| HTTP 403 | **no** | a permission result, not an outage — see L2 |
| HTTP 404 / 501 | **no** | the endpoint is absent; retrying never helps — see L3 |
| `!sessionReal` / `FORCE_DEMO` short-circuit | **no** | no request was attempted |

**L2 — 403 must never raise the banner.** `GET /profiles` is admin-only
(`contracts/api.md:211`) and `getAgentLocations` calls it unconditionally at
`src/data/api.ts:1228`. Reporting 403 would give **every advisor a permanent outage banner on a
healthy backend**, failing the DONE-WHEN's second clause outright.

**L3 — 404 reuses Phase 1's existing vocabulary, and invents nothing.** `src/data/api.ts:70-72`
already defines `unsupported` as *"not a transient fault: the endpoint is not there, and
retrying will never help."* The read path adopts the same distinction. This also stops
`/lic-plans` — documented at `src/data/api.ts:1340-1342` as 404-in-production — from pinning
the banner open for the whole session.

**L4 — `degraded` becomes derived: `failures.length > 0`.** It can no longer be assigned
independently or it drifts from the count the banner renders at `src/ui/health-banner.tsx:50`.

**L5 — `reportSuccess` must NOT re-stamp `at`, and `reportFailure` MUST keep re-stamping it.**
`src/app/search.tsx:489` snapshots `getHealth().at` before its fan-out and compares at `:508` to
decide whether *this* search lost a collection. The comment at `:486-488` states the dependency
explicitly: *"`health.at` is stamped by every reported failure."* Suppressing the re-stamp for an
already-listed endpoint would make a second identical failure invisible to that check and turn
"check your connection" back into a false "nothing matched".

**L6 — the banner's dismissal is re-keyed off the failure set, not `at`.** Because L5 keeps `at`
ticking on every repeat, `src/ui/health-banner.tsx:46` would otherwise re-open a banner the user
just dismissed, on every retry of a dead endpoint. Reset `dismissed` only when an endpoint that
is *new to the list* appears.

**L7 — the banner subtitle must be true for every kind it now reports.** It currently says
"N requests did not reach the server" (`src/ui/health-banner.tsx:78-79`), which is false for a
200-with-a-bad-body. Reworded to cover both.

**L8 — `degraded` stays global and therefore sticky, and that is accepted.** Once an endpoint
fails it stays in `failures` until *that endpoint* succeeds. 31 screens read the global flag, but
all but one gate it as `health.degraded && list.length === 0`, so a stuck flag can only mis-speak
on a screen that is **genuinely empty** while a different endpoint is broken. That is strictly
narrower than today's failure mode, where a real outage renders "No clients in your book yet".
Making `degraded` per-endpoint would touch all 31 screens and is its own phase.

**L9 — `getTeamActivity` returns `[]` and reports nothing.** No `/api/activity` exists in
`contracts/api.md` (all 61 routers are `###` headings; there is no such section). The real feed
is `GET /api/dashboard/activity` (`contracts/api.md:1272`), but it is **server-side broken**: the
writer sets `actor.id` while the reader filters `actor.user_id` (`contracts/models.md:1881`,
`:2149`), so it returns `[]` for every role including admin. Calling it would buy an empty
section, a 4.5 s timeout on the Team critical path, and a new outage risk. An INBOX item is filed
to `cgpe-api` instead.

**L10 — a deliberate fallback chain must not report its first leg.** `getAttendanceHistory`
(`src/data/api.ts:1155-1161`) tries `/time-tracker/history` then `/attendance/history`. Reporting
the first leg would raise a banner on a screen that successfully got its data from the second.

---

## 4. Out of scope — named so they are not quietly adopted

- **`getGeofence`'s `FALLBACK_GEOFENCE`** (`src/data/api.ts:1036`) — the last fabricated *number*
  reaching a user, but `docs/PHASES.md` assigns the geofence to **Phase 7** (INBOX D5/D10).
- **`setLeadStage`, `addLead`, `addTask`, `reassignTask`, `sendWaMessage`** — write-path defects
  owned by Phases 4 and 5. Touching them here collides with those phases.
- **`uploadFile`** (`src/data/api.ts:1283`) — a raw multipart `fetch` that bypasses `req()`
  entirely, so a 401 on upload does not expire the session. Real, logged, not this phase.
- **Per-endpoint `degraded` for all 31 screens** — see L8.
- **A "your role cannot see this" third state** — the honest end state for L2's 403s, but it is
  new copy in ~10 empty states.

---

## 5. Acceptance criteria

Binary. 1–4 are machine-checkable; 5–7 need a handset or a killed backend.

1. `npx tsc --noEmit` exits 0.
2. `npm test` is green, with `src/data/__tests__/api-renewals.test.ts:187` **deliberately
   flipped** to `true` and its test name and comment rewritten to say Phase 3 closed it.
3. `npm run lint` reports no *new* errors against the 46-error baseline.
4. New `src/data/__tests__/health.test.ts` covers: per-endpoint clear leaves other failures
   standing; `degraded === (failures.length > 0)`; `reportSuccess` does not move `at`;
   `reportFailure` does move `at` on a repeat (the `search.tsx` contract, L5).
5. With the backend unreachable, the Master dashboard raises the banner **and** shows its
   "Organisation figures did not load" state rather than a zeroed org.
6. With a healthy backend, opening Team raises **no** banner.
7. An advisor (non-admin) opening Team against a healthy backend raises **no** banner, despite
   `GET /profiles` returning 403.

## 6. Files

`src/data/health.ts` · `src/data/api.ts` · `src/ui/health-banner.tsx` ·
`src/app/team/index.tsx` · `src/data/__tests__/api-renewals.test.ts` ·
`src/data/__tests__/health.test.ts` *(new)* · `docs/spec/PHASE-3.md` *(this file)* ·
`../contracts/INBOX.md` *(one item filed to `cgpe-api`)*
