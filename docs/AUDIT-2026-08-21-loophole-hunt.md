# CGPE Connect Android — Reliability / Loophole Audit

**Date:** 2026-08-21 · **Phase 76 (§F.F2)** · **Method:** multi-agent workflow — 8 concern-finders → adversarial verification (each finding re-checked by an independent agent instructed to *refute* it) → synthesis.
**Coverage:** 24 agents, 0 errors · **17 raw → 15 unique → 12 adversarially-confirmed** loopholes → **9 distinct defects**.
**Status:** findings only — **no code changed yet.** Line numbers are anchors; confirm surrounding code before editing (project convention — files drift).
**Full per-finding verdicts** (reasoning + refined failure scenarios + corrected fixes): workflow journal `subagents/workflows/wf_7ee06ead-c16/journal.jsonl` (this session).

> **Dedup note:** findings 7/9/11 are the *same* duplicate-create bug seen at three call sites; findings 1/5 are the *same* consent-leak bug (two finders, two path spellings the file+line dedup missed). So the 12 confirmations = **9 distinct defects**.

---

## Remediation status — 2026-08-21 (this session)

**8 of 9 defects fixed client-side, gates green (`tsc` 0 · tests **772** · lint 0 new errors), pushed to `aaziko/Shivam`.** All are OTA-eligible (JS-only) — they reach the field team on the next over-the-air update, no reinstall.

| Defect | Commit | Notes |
|---|---|---|
| #1 clock hang | `f3e0801` | `getFix` bounded — 12 s fresh fix + last-known fallback + 5 s geocode; always settles |
| #6 trapped dead session | `5e34067` | one-line `resetSessionGuard()` on session restore |
| #3 offline-delete-and-blame | `6b8f5fc` | a network throw never counts toward the poison-cap; +test |
| #4 consent-key leak on sign-out | `0304164` | drop `track.ambient`/`notif`/`motion` in `purgeUserScopedCaches` |
| #5 enqueue-during-flush race | `4c065cf` | atomic per-id read-modify-write; +2 tests (in-memory AsyncStorage) |
| #5(401) cross-attribution | `fd59b76` | purge outgoing sid on a different-user sign-in (device-verify) |
| #8 renewals grind | `3e920cf` | 2-consecutive-failure circuit-breaker; +test |
| #9 stale-cache marker | `1a16d5d` | SyncChip on Leads/Reminders/Notifications + honest HealthBanner copy |
| **#7 duplicate creates** | — | **backend-blocked**: the idempotency key is a contract addition → filed to `contracts/INBOX.md` (2026-08-21 → cgpe-api), together with the `/track/points` ownership check for #5. App-side wiring (~3 one-line changes) lands once the backend confirms the field/header name. |

**Device-verify owed** (not provable by tsc / vitest / web): #1 on a real dead-GPS spot, the shared-handset sign-out/handover paths (#4/#5), and the SyncChip/banner render. **Two [api] relays owed** to the owner (INBOX 2026-08-21): the `/track/points` ownership check and the create-endpoint idempotency key.

---

## 1. Bottom line (plain read)

The everyday happy paths are sound; every confirmed problem lives at the two edges you already worry about — **unreliable or blocked networks, and shared handsets passed between field staff.** The three headline risks: (1) in a basement, concrete building, or rural dead zone, **Clock In / Out / Break can spin forever with no error and no recovery** — an agent literally cannot start or end their shift; (2) records typed on a bad network can be **silently lost and blamed on the user, or silently duplicated** in the pipeline; and (3) on a shared phone, one user's **24/7-location consent, session, and GPS can bleed into the next user**, producing false compliance events, unconsented tracking, and shift routes attributed to the wrong person. A few of these write bad data the backend keeps (a false opt-out event, a re-opened shift, a duplicate lead), so those need a paired backend guard to fully close — but **every load-bearing client fix is JavaScript-only and ships over-the-air**, with no new install for the field team. Honest read: **the app is not yet production-safe for a non-technical field team on unreliable networks, but the gap is a focused, mostly small set of fixes — not a rewrite.**

---

## 2. Confirmed defects, ranked by severity

*Within each tier, ordered by how commonly it fires on normal use and how recoverable it is.*

### 1. [HIGH] Clock In / Out / Break spin forever when no GPS fix arrives
*(finding 2 · `src/app/(tabs)/home.tsx:141`)*
- **Fails when:** an agent with location already granted taps Clock In from a fix-starved spot (basement, interior room, dead zone) — `getCurrentPositionAsync` never settles, so the button spins with no error and the shift can't start or end. All four attendance actions share the dead call.
- **Fix:** bound acquisition inside `getFix` — race `getCurrentPositionAsync` against ~12 s (copy the `withTimeout` helper at `tracker.ts:601-609`), fall back to `getLastKnownPositionAsync`, and timeout `reverseGeocodeAsync` at ~5 s. Returning `null` on timeout is already handled on every path, so the `finally` that clears the spinner is always reached.

### 2. [HIGH] Offline flush deletes a never-sent create after 5 offline app-opens, and blames the user
*(finding 3 · `src/lib/writeQueue.ts:111`)*
- **Fails when:** an agent creates a task/lead in a dead zone; opening the app 5 times while still offline bumps the poison-write counter on each network throw until the draft is dropped — "could not be saved and were removed" — for work the server **never received.**
- **Fix:** in `flushDecision`, a network throw means "never reached the server," so `return 'keep'` for every `'threw'` — it must never count toward the drop cap. `req()` only throws on network/timeout, so this is safe; the 4xx client-refusal drop and `MAX_QUEUE` bound stay intact. Pin `flushDecision('threw', 4) === 'keep'` in tests.

### 3. [HIGH] Enqueue-during-flush race silently clobbers a lead the user typed mid-sync
*(finding 4 · `src/data/api.ts:3555`)*
- **Fails when:** a flush is replaying an earlier draft on a slow link; the agent saves a **new** lead while that POST is in-flight; the flush then writes its stale queue snapshot back to disk, overwriting the new draft — gone from storage and screen, no error.
- **Fix:** make each flush step an atomic read-modify-write — re-read the queue from disk **after** each replay's `await` and mutate only that draft by id (`bumpAttempt`/`removeFromQueue` are id-keyed), so a draft enqueued mid-flush survives. Add a regression test for the interleaving.

### 4. [HIGH] 24/7-location consent flag leaks across users on sign-out
*(findings 1 + 5 · `src/store/auth.tsx:208`)*
- **Fails when:** on a shared handset, User A grants 24/7 consent; sign-out purges the tracker's session keys but leaves `track.ambient='1'` and never tears the recorder down. The next user can be **recorded off-duty without consenting**, and the server can log a **false compliance-withdrawal event** under a user who made no such choice (and notify every super-admin).
- **Fix:** in `purgeUserScopedCaches` extend the SecureStore removals to drop `track.ambient`, `track.notif`, and `track.motion`. Clearing `track.ambient` makes the next user read as un-armed — no false-withdrawal POST, no false block, and the next stray batch tears the leftover service down cleanly. **Do NOT static-import tracker into auth.tsx** (its native modules break the test suite with `__DEV__ is not defined`); for immediate teardown use a **dynamic** `import('@/lib/tracker')` in `logout()`. This is a fully client-side close.

### 5. [HIGH] After a 401 expiry + handover, the recorder posts the new user's GPS onto the old user's shift
*(finding 6 · `src/store/auth.tsx:101`)*
- **Fails when:** on a shared phone, A's session expires, A hands the phone to B, B signs in but doesn't clock in; the still-running recorder still holds A's `sid`, so the next OS batch posts B's GPS under B's token onto **A's shift route** — re-opening A's sealed shift and misattributing B's movements to A.
- **Fix:** reconcile the tracker at the login funnel `persist()` (~:149), not via `clear()` (which would break biometric restore). Read stored `USER_KEY`; if the incoming id differs, run `purgeUserScopedCaches()` (drops `track.state`/sid) **before** writing the new token, so a racing batch still sees the dead token and self-heals; a same-user biometric restore skips the purge and keeps an in-progress shift. File an [api] ask so `/track/points` rejects a session the caller doesn't own (defense-in-depth).

### 6. [MEDIUM] Restored session can latch the expiry-detector off, trapping the user in a silently-dead session
*(finding 10 · `src/store/auth.tsx:134`)*
- **Fails when:** an OEM background-kill mid-shift lets a headless watchdog runtime survive with the dead token and `expiring=true`; reopening restores the session into that same runtime without re-arming the guard, so the real 401 is never surfaced — every screen shows false-empty "no tasks / no clients" and the user is stuck until they force-quit.
- **Fix:** add `resetSessionGuard();` in the mount-effect storage-restore branch, right after `api.setAuthToken(token)`, mirroring `persist()`. One line; already imported. A live token stays live; a dead one now correctly fires logout with the "session timed out" notice.

### 7. [MEDIUM] Create duplicated when the server saved it but the reply was lost (no idempotency key)
*(findings 7 + 9 + 11 · `src/data/api.ts:1211 / 3447 / 3517`)*
- **Fails when:** on a weak link, a lead/task/note the server actually committed but whose 201 was lost gets enqueued and **re-sent on reconnect**, creating a second identical record — duplicate leads double-count the pipeline and send two agents after one prospect. Confirmed from three code paths.
- **Fix (partially backend-blocked):** app-side (do now, OTA) — generate one `clientRef` UUID at the **top** of `addLead`/`addTask`/`addNote`, before the first POST, in the same body reused for the replay (the `pending-…` temp id can't serve this — it's minted only after the first POST fired). **Real fix needs backend:** file an [api] ask so POST `/leads`, `/team/tasks`, `/notice-board` upsert/return-existing on `(creator, clientRef)`. Interim guard: existence-probe before replaying a create.

### 8. [MEDIUM] Renewals scan grinds ~38 min with frozen progress and no Stop on a blackhole network
*(finding 8 · `src/data/api.ts:1398`)*
- **Fails when:** an admin's renewals scan commits to ~91 pages, then the link dies; each page hangs ~24.6 s (timeout + retry) and the loop never gives up, freezing the job and blocking the WhatsApp campaign behind it for over half an hour with no abort.
- **Fix:** add a consecutive-failure circuit-breaker to the page loop — mark each page failed in both the non-2xx and catch branches and `break` after 2 consecutive failures (~49 s of proven-dead network), returning the partial result (the outage banner is already up). Optionally thread a Stop control from the job screen.

### 9. [LOW] Stale cached Leads / Reminders / Notifications shown as if live (only Tasks shows a "Synced" chip)
*(finding 12 · `src/app/(tabs)/leads.tsx:95`)*
- **Fails when:** on weak WiFi the cache serves yesterday's list, fully populated and indistinguishable from live data, so an agent calls a lead whose stage silently flipped hours ago. The only signal is a banner that says "blank values are unconfirmed" — but nothing is blank.
- **Fix:** add `<SyncChip>` to Leads/Reminders/Notifications using the **bare** cache keys the `cachedList` calls use (`'leads'`/`'reminders'`/`'notifications'`, **not** the `'/leads'` health keys, or it subscribes to a freshness entry that never fires). Also reword the HealthBanner body (`ui/health-banner.tsx:110`) from "Blank values here are unconfirmed" to e.g. "Some values may be out of date," since the cache now serves populated stale rows.

---

## 3. Recommended fix order

Ship the field-blocking and data-loss fixes first; they map directly to "the app failed and my team is stuck." All are JavaScript-only / OTA unless noted.

1. **#1 — Clock-in/out/break hang** (`home.tsx:141`). The most visceral "app is broken, I'm blocked," fires in normal locations with no recovery, and the fix is a small self-contained timeout. Highest value per line.
2. **#6 — Trapped dead session** (`auth.tsx:134`). A **one-line** `resetSessionGuard()` that unsticks a fully-blocked user staring at false-empty screens. Cheapest high-impact fix in the set.
3. **#2 — Flush deletes never-sent create** (`writeQueue.ts:111`). ~2 lines; stops silently destroying field work *and* stops the app blaming the user for it.
4. **#4 — Consent flag leaks on sign-out** (`auth.tsx:208`). Small key-removal that closes a real privacy/compliance hole on every shared phone (fully client-side). Heed the **no-static-import** caveat.
5. **#3 — Enqueue-during-flush race** (`api.ts:3555`). Still silent loss of a customer record; slightly larger (atomic per-id read-modify-write + test).
6. **#5 — 401 cross-attribution** (`auth.tsx:101`). Do it alongside #4 — both harden the shared-handset sign-out/sign-in path; file the paired [api] ownership check.
7. **#8 — Renewals grind** (`api.ts:1398`). Small circuit-breaker; admin-only and already banner-flagged, so lower urgency than the field-facing items.
8. **#7 — Duplicate creates** (`api.ts:1211/3447/3517`). Ship the app-side `clientRef` now, but **this is the one item not truly closed until the backend honors the key** — file and relay the [api] ask; don't mark it done on the client change alone.
9. **#9 — Stale-data marker** (`leads.tsx:95` + 2 screens + banner). Low harm, but a cheap honesty fix worth bundling into the same release.

**Release guidance:** items 1–6 cover every "agent is blocked" and "field data silently lost" path and are pure client fixes — ship them as the first OTA update. Item 8 (and the optional guards for #4/#5) need a backend change the owner must relay as an [api] ask; only #7 stays open until that lands.

---

## Appendix — the 12 confirmed findings (traceability)

| # | Sev | Distinct defect | Anchor | Finder |
|---|-----|-----------------|--------|--------|
| 1 | HIGH | 24/7 consent flag + service leak on sign-out (= #4) | `src/store/auth.tsx:208` | write-path-honesty |
| 2 | HIGH | Clock-in/out/break hang, no GPS-fix timeout | `src/app/(tabs)/home.tsx:141` | timeout-and-hang |
| 3 | HIGH | Flush counts network throws to poison-cap → deletes never-sent create | `src/lib/writeQueue.ts:111` | offline-queue |
| 4 | HIGH | Enqueue-during-flush race clobbers a mid-flush draft | `src/data/api.ts:3555` | offline-queue |
| 5 | HIGH | `track.ambient` survives logout → next user tracked (= #1) | `src/store/auth.tsx:208` | shared-handset |
| 6 | HIGH | 401 path skips teardown → GPS posts to prev user's shift | `src/store/auth.tsx:101` | shared-handset |
| 7 | MED | Duplicate create on lost-ack, no idempotency key | `src/data/api.ts:1211` | write-path-honesty |
| 8 | MED | scanRenewals ~38 min grind, no cancel | `src/data/api.ts:1398` | timeout-and-hang |
| 9 | MED | Duplicate create (2nd path) | `src/data/api.ts:3517` | offline-queue |
| 10 | MED | Expiry-latch poisoned → sign-out detection disabled | `src/store/auth.tsx:134` | auth-permission |
| 11 | MED | Duplicate create (3rd path) | `src/data/api.ts:3447` | boot-resilience |
| 12 | LOW | Stale cache shown without a per-list "Synced" marker | `src/app/(tabs)/leads.tsx:95` | offline-queue |

*Note: the boot-resilience finder confirmed the boot/splash path itself is network-independent (matching the §F code-side audit) — its one finding (#11) was a duplicate-create instance, not a boot hang.*
