# PHASE 57 — Offline support (read cache + safe write queue)

**Status:** spec locked 2026-08-20 (owner approved `go`). Build order: **57a read cache first**, then 57b write queue.
Scope **mobile**, effort **XL**, **no contract change** (pure client-side; the backend never knows the app was offline).

Grounded triage: `docs/spec/ISSUES-2026-08-18.md` §57. Integrates with the honesty channel
(`src/data/health.ts`) and the write-buffer (`src/data/api.ts` `state`, `WriteFailure`).

---

## Locked decisions

| # | Decision | Locked value | Why |
|---|---|---|---|
| 1 | Storage backend | **Raw AsyncStorage** (not SecureStore) | SecureStore ~2KB/value + no bulk enumerate; AsyncStorage already a dep (`storage.ts`) |
| 2 | Key namespace | Read `cache.v1.<userId>.<endpointKey>` → `{at:number,data:[]}`; Queue `queue.v1.<userId>` → `[]` | Per-user (shared-handset privacy) + versioned (shape change ⇒ clean invalidation), mirrors `clock.<userId>.<date>` |
| 3 ★ | **What gets cached** | **Operational lists only** — Tasks, Reminders, Notifications, Leads. **EXCLUDE** client-book PII (names/phones/DOB/policy#) + ₹ figures ⇒ **Clients & Claims stay online-only** | DPDP: no plaintext PII/₹ at rest. (Change = "cache everything incl. clients") |
| 4 | Three display states | **live** (fresh fetch) / **stale** (cache shown + sync chip + degraded banner) / **could-not-load** (empty + banner, zero fabricated rows) | Extends the existing `useDataHealth().degraded` two-state model |
| 5 | Stale trigger | A **failed read when a cache entry exists** (no TTL gate); the real sync time is always shown | A timestamp is honest at any age |
| 6 | "Last synced" copy | English **hardcoded** in `SyncChip`: `Synced <time> · may be out of date`. **Owes 5-lang human copy** → then promote to i18n key `common.lastSynced` | i18n rule: machine translation forbidden; a fake-translated key passes the parity test dishonestly, so ship English until copy lands (like the ~40 still-English screens) |
| 7 | Cache size bound | GC entries **>30 days** on write; soft cap **~4 MB**, LRU-evict oldest | Android AsyncStorage ~6 MB ceiling |
| 8 | Write-queue scope (57b) | **Additive creates only**: Notes + Tasks (Leads optional). **NO** edits/deletes/status/reorders | Additive ⇒ no conflict/ordering hazard |
| 9 | Enqueue condition (57b) | Only on a **`network`** `WriteFailure` (not server/invalid/forbidden); row shows "Pending sync"; **no success haptic** | Upholds "never fake a write" |
| 10 ★ | **Reconnect / flush (57b)** | **Next-success** (piggyback health channel — JS-only, **OTA-eligible**) + on app-foreground | No new native module. (Change = NetInfo, needs APK rebuild) |
| 11 | Flush outcome (57b) | 2xx ⇒ dequeue + swap temp-id → server id; 400/403 ⇒ drop + one-time notice; network ⇒ keep | No poison-draft infinite retry |
| 12 | Persistence across logout | **Write queue survives** (per-user); **read cache purged on logout** (privacy) | Extends `purgeUserScopedCaches` (auth.tsx:186) to sweep `cache.v1.<user>.*` |
| 13 | Online-only, never cached/queued | clock-in/out + geofence, WhatsApp send, live monitoring/agent-map/live-location, global search, login/OTP/biometric restore, payroll/commission writes | Real-time or non-additive; honest failure is correct |
| 14 | Pure tested seam | `src/lib/offlineCache.ts` (+ `__tests__`) — keys, (de)serialize, 3-state read decision, GC, queue reconcile | Matches `netResilience.ts`/`staleBuffer.ts`; AsyncStorage stub is a no-op so I/O stays device-only |
| 15 | Build order | **57a read cache** (own commit, OTA) → **57b write queue** | Ship the higher-value half first |

## Out of scope
- Offline edits/deletes/status-changes; conflict resolution/merge (additive creates only).
- Background sync while app closed (flush is foreground, on next-success).
- Full offline client book unless row 3 changed.
- iOS-specific offline (rides Phase 56).

## Acceptance criteria (binary)

**57a — read cache**
- [ ] After one online load of Tasks, going offline and reopening Tasks shows the prior rows + a "Synced <time>" chip **and** the degraded banner.
- [ ] With no prior load, the offline Tasks screen shows the "could not load" empty state (zero fabricated rows) + banner.
- [ ] A later successful online load overwrites the cache and removes the chip.
- [ ] After sign-out, AsyncStorage holds no `cache.v1.<thatUser>.*` keys.
- [ ] `npm test` green (new `offlineCache` tests), `tsc` 0, eslint 0 new.

**57b — write queue**
- [ ] A note created offline shows a "Pending sync" badge and fires **no** success haptic.
- [ ] On the next successful request the note POSTs; on 2xx the badge clears and the temp id is replaced by the server id.
- [ ] A 400 on flush drops the draft + shows a one-time notice (no infinite retry).
- [ ] Killing/reopening the app offline still shows the pending draft.
- [ ] Clock-in, WhatsApp send, and search never enqueue.

## Risks
- Row 3 = "cache everything" ⇒ PII/₹ at rest; mitigate via per-user namespace + purge-on-logout + biometric App-Lock.
- Next-success flush can strand a draft if the user never triggers a successful read; also flush on foreground; add NetInfo (57c) if it bites.
- AsyncStorage ~6 MB ceiling; row 7 cap + GC; measure after a full load.

## Implementation notes (57a)
- Cached read fns (`api.ts`): `getTasks` (key `tasks:own`/`tasks:all`), `getReminders` (`reminders`), `getNotifications` (`notifications`), `getLeads` (`leads`). Write-through at each success branch; cache-fallback at the `unavailable(...)` branch.
- `src/data/freshness.ts` — pub/sub keyed by endpointKey (`markFresh`/`markStale`/`useDataFreshness`), sibling to `health.ts`.
- `src/data/offlineStore.ts` — thin AsyncStorage I/O over `offlineCache.ts` pure fns (device-only; stub no-ops in tests).
- `src/ui/SyncChip.tsx` — renders only when stale; wired into `(tabs)/tasks.tsx` (+ `reminders.tsx` if clean).
