# CGPE Connect Android — Reliability / Loophole Audit (round 2)

**Date:** 2026-08-25 · **Follow-up to** `docs/AUDIT-2026-08-21-loophole-hunt.md` (9 defects, 8 fixed + 1 backend-filed).
**Scope:** ONLY code shipped **after** the 2026-08-21 audit (2026-08-22 → 2026-08-25) — the expanded offline
write-queue, the document-upload path (Point 11), the role/identity model + client-book gates (Point 9 / #8),
the payroll roster (Point 13), and the new data mappers. The 9 already-fixed defects were explicitly excluded.
**Method:** multi-agent workflow — 5 concern-finders → adversarial verification (each finding re-checked by an
independent agent instructed to *refute* it) → synthesis. **11 agents, 0 errors.** 6 confirmations → **5 distinct
defects** (the payroll one was found independently by two finders).
**Full per-agent verdicts:** workflow journal `subagents/workflows/wf_f5741735-387/journal.jsonl`.

> **Good news first:** the `shared-handset-auth` finder returned **empty** — the 2026-08-21 consent-key purge,
> 401 cross-attribution, and expiry-latch fixes all **held** through the identity refactor (commit `9f8e47d`).
> No regression there.

---

## Remediation status — 2026-08-25

**All 5 defects fixed client-side, gates green (`tsc` 0 · `npm test` **984** (+6) · `eslint` 0 new errors),**
pushed to `aaziko/Shivam`. All are JS-only / OTA-eligible — they reach the field team on the next over-the-air
update, no reinstall. **Device-unverified.**

| # | Sev | Defect | Fix location | Test |
|---|-----|--------|--------------|------|
| 1 | **HIGH** | `claim-new` client picker had NO client-book guard | `src/app/claim-new.tsx` — thin `canViewOwnClients` wrapper (same as `client/[id]`) | guarded by the existing roles suite |
| 2 | MED | `isEphemeralUrl` missed the prod `/uploads/` fallback | `src/lib/fileUpload.ts` — detect the `/uploads/` route on any host | `fileUpload.test.ts` (flipped the wrong pin + 1) |
| 3 | MED | Poison-cap counter inflated by network throws | `src/data/api.ts` `flushWriteQueue` — bump only on a real 5xx | `api-flush-race.test.ts` (+1) |
| 4 | MED | `409 idempotency_in_progress` dropped instead of kept | `src/lib/writeQueue.ts` `flushDecision` — 409/429 → keep | `writeQueue.test.ts` (+2) |
| 5 | MED | `mergePayrollRoster` byName collision misattributes pay | `src/data/payroll.ts` — name fallback only for drifted + unambiguous rows | `payroll.test.ts` (+2) |

---

## 1. Bottom line (plain read)

One real privacy hole and four data-integrity edge cases, all in the code added since last week. The privacy hole
(**#1**) is the one that matters: the owner's Point-9 decision locked the whole client book to master/admin (and
sales advisors' own clients), and 13 surfaces were gated — but the **New-claim screen's client search was missed**,
so an ordinary team advisor could still type two letters into the claim's client picker and page through every
client's name, mobile number and policy. It is now gated identically to the rest. The other four are narrow
timing/edge cases in the offline queue, the upload "did it really save" check, and the payroll roster — each can
silently show wrong data or lose a user's offline create, but only under specific conditions (a name collision, a
slow-server retry, or extended offline use). All five are pure-JavaScript fixes that ship over the air.

---

## 2. Confirmed defects

### 1. [HIGH] `claim-new` client picker searches the whole client book with no access guard
*(`src/app/claim-new.tsx`, rbac-pii)*
- **Fails when:** a team-tier advisor opens **New claim** (the affordance is shown to every tier — `can_create_claim`
  is a fail-open flag defaulting true) and types ≥2 characters in the client picker. That calls
  `getClientsPage(1, term)` → `GET /clients?scope=all&search=…`, which today returns the whole unowned ~9,000-row
  LIC book to any token (the server role gate is still an owner-relayed INBOX item). So the advisor enumerates every
  client's name / mobile / policy — the exact PII the owner's Point-9 lockdown (`4575106`) closed on 13 other
  surfaces but missed here.
- **Fix:** wrap the screen in the identical `canViewOwnClients(user, viewAs)` guard used by `client/[id].tsx` — a
  thin default-export wrapper that shows `RestrictedNotice` to anyone without book access. Master/admin/leader keep
  the whole-book picker; a **sales-department advisor** passes and the server scopes their picker own-only (P90); a
  plain team member is stopped before any client fetch. Defence-in-depth; the server `GET /clients` gate remains the
  authority (INBOX, owner-relayed).

### 2. [MEDIUM] `isEphemeralUrl` misses the real prod ephemeral fallback → a redeploy-wiped upload shows as durably attached
*(`src/lib/fileUpload.ts`, upload-honesty)*
- **Fails when:** DigitalOcean Spaces is unset on prod (it is, today), so `routes/upload.js` falls back to
  `${BACKEND_URL}/uploads/…` on throwaway droplet disk. `BACKEND_URL` on prod is the **public** domain (it must be —
  the same fallback serves WhatsApp campaign media), so the URL is `https://cgpe.in/uploads/…` — **not** loopback.
  The old guard only flagged loopback hosts, so it returned "durable", the claim screen ticked the checklist and
  toasted "Uploaded", and the file was wiped on the next redeploy — the exact "captures vanish" bug Point 11 built
  the guard to prevent.
- **Fix:** detect the `/uploads/` static route on **any** host (a durable Spaces object never uses it — its key is
  `${folder}/${file}`, host `*.digitaloceanspaces.com`). Kept the loopback checks; flipped the test that had pinned
  the wrong contract.

### 3. [MEDIUM] Poison-cap counter inflated by network throws → an offline create dropped on its first 5xx
*(`src/data/api.ts` `flushWriteQueue`, offline-writequeue)*
- **Fails when:** a genuinely-offline draft replays and throws on several app-foregrounds. The flush loop bumped
  `attempts` on **every** kept outcome, including a network throw — so after ~4 offline foregrounds `attempts` hits
  4, and the moment the network returns with a single transient **5xx**, the draft crosses `MAX_ATTEMPTS` and is
  dropped ("could not be saved and was removed") for work the server never received. This defeated the intent that
  the cap tolerate five *server* 5xx answers. (The pure `flushDecision` throw→keep fix from 2026-08-21 was intact;
  the **orchestration** corrupted the `attempts` field it reads.)
- **Fix:** bump `attempts` only when the kept outcome came from a genuine **server 5xx**; a network throw (and a
  transient 409/429) keeps the draft without counting toward the cap. +regression test.

### 4. [MEDIUM] `409 idempotency_in_progress` on a replay is dropped instead of kept
*(`src/lib/writeQueue.ts` `flushDecision`, offline-writequeue)*
- **Fails when:** a create hits a slow server, the 12 s client timeout aborts (the server is still committing), the
  draft enqueues with its idempotency key, and a foreground/reconnect flush replays the same key **while the first
  request is still in flight** → the server answers **409** `idempotency_in_progress` (contract: "retry shortly; you
  then get the replay"). The old code classified any 4xx as a refusal and **dropped** the draft, raising a false
  "could not be saved" notice for a lead the server *did* commit — and a manual re-create is the very duplicate the
  idempotency key exists to prevent.
- **Fix:** treat **409** (still-committing) and **429** (rate-limited) as transient KEEPs before the 4xx→drop
  branch; they never count toward the cap. Corrected the stale `replayWrite` comment that claimed 409 was
  "unreachable". +2 tests.

### 5. [MEDIUM] `mergePayrollRoster` byName fallback attaches one salary row to multiple members on a name collision
*(`src/data/payroll.ts`, data-integrity)*
- **Fails when:** two active staff share a normalized name and only one has a payroll profile. The name-fallback map
  was built from **all** roster rows with no already-claimed guard, so the profile-less namesake resolved to the
  other member's row → showed a colleague's salary instead of the "Data pending" pill, and `payrollRosterStats`
  double-counted that row in the header total. Latent today (the current 21-staff directory has no normalized-name
  collision) but fires as profiles are seeded — exactly the Point-13 population.
- **Fix:** index the name-fallback map **only** with rows whose id matches no directory member (a real id-drift),
  mark a repeated name ambiguous, and honour a name match only when the directory name is unique too. +2 regression
  tests (a profiled/unprofiled namesake, and one drifted row vs two same-named members).

---

## 3. What remains (not client code)

- **The server-side `GET /clients` role gate** (the real authority behind #1) is already filed to
  `../contracts/INBOX.md` for the owner to relay — the app guard is defence-in-depth. No new INBOX item was added.
- **DigitalOcean Spaces env** (the real fix behind #2's ephemeral uploads) is an owner/OPS switch already in the
  backlog. Until it's set, the app now *correctly* says "the server won't keep it" on any `/uploads/` URL.
- **The document-picker APK** (Point 11 is native → not OTA) still needs a fresh EAS build before the picker reaches
  the team; these five OTA fixes ride whatever the next OTA update is.

_All findings verified against real code before fixing; nothing invented. `contracts/INBOX.md` untouched
(no new cross-session ask)._
