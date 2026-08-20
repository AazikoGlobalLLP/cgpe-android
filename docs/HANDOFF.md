# HANDOFF — CGPE Connect (Android) — Phase 57 (offline support, a+b) built & pushed — 2026-08-20

Owner re-verified Phase 72 (team push) is **still blocked** on the backend + Firebase, then chose to build
**Phase 57 (offline support)** — spec-locked, approved, and built in two pushed slices: **57a read cache** and
**57b safe write queue (Notes)**. `[m]`-only, **no contract change** (offline is pure client-side — the backend
never learns the app was offline). JS-only and **OTA-eligible** (AsyncStorage was already a dependency), so it does
NOT need the pending native APK.

## Done
- **A failed list re-fetch now shows the last good rows, not an empty screen.** Tasks / Leads / Reminders /
  Notifications serve their last SUCCESSFUL read from a per-user cache when the network drops, with a **"Synced
  <time> · may be out of date"** chip (wired on Tasks) beside the existing "couldn't reach server" banner. No prior
  load → the honest "could not load" empty state (zero fabricated rows). Client-book PII + ₹ figures (Clients/Claims)
  are deliberately NOT cached (DPDP). Cache is purged on sign-out.
- **A note jotted while offline is no longer lost or falsely reported as saved.** `addNote` now has three honest
  outcomes — **saved** / **queued** (network down → additive draft, "Pending sync" badge, no success buzz, "saved on
  this device" toast) / **failed** (server answered and refused → NOT queued). The draft survives an app kill, renders
  on top of the board, and auto-syncs on sign-in / foreground / reconnect; a server-refused draft drops with a
  one-time notice (no infinite retry). The composer is now available offline. Clock-in / WhatsApp / search never queue.
- Gates green: `tsc` 0 · `npm test` **747** (+18: `offlineCache` 15, `writeQueue` 14, `api-notes-queue` 4 — net of shared) ·
  eslint 0 new errors (pre-existing warnings only).

## Files changed
- `src/lib/offlineCache.ts` — **NEW** pure seam (57a): keys, (de)serialize, 30-day `gcVictims`, 3-state `decideRead`, `mergeById`.
- `src/lib/writeQueue.ts` — **NEW** pure seam (57b): parse/serialize, `MAX_QUEUE` cap, `bumpAttempt`, `flushDecision`.
- `src/data/offlineStore.ts` — **NEW** device-only AsyncStorage I/O for both cache (writeList/readList/GC/purge) and queue (loadQueue/saveQueue).
- `src/data/freshness.ts` — **NEW** bus (sibling to `health.ts`) driving the stale chip without changing any read's return type.
- `src/data/pendingWrites.ts` — **NEW** reactive bus for queued drafts + a one-time drop notice.
- `src/data/api.ts` — `cachedList()` wraps getTasks/getLeads/getReminders/getNotifications; `addNote`→3-outcome `AddNoteResult`; `enqueueWrite`/`noteDraftToBoardNote`/`flushWriteQueue`; `setCurrentUser` loads the queue into the bus.
- `src/ui/SyncChip.tsx` — **NEW** stale chip + `useDataFreshness`. `src/ui/pending.tsx` — **NEW** `usePendingWrites`/`useDropNotice`/`PendingBadge`.
- `src/app/_layout.tsx` — **NEW** `QueueFlusher` gate (flush on sign-in / foreground / health-recovery).
- `src/app/(tabs)/tasks.tsx` — SyncChip wired. `src/app/notes.tsx` — pending drafts + badge + offline composer + reconcile-on-flush + drop-notice banner.
- `src/store/auth.tsx` — sign-out sweep now drops `cache.*` + `resetFreshness()`; the write QUEUE persists (per-user).
- `docs/spec/PHASE-57.md` — **NEW** locked spec + Build log. `docs/spec/GLOSSARY.md` — read-cache / 3-state / freshness terms.

## Decisions made
- **Cache operational lists only; EXCLUDE client-book PII + ₹** (owner row 3). No sensitive plaintext at rest in AsyncStorage.
- **Reconnect = next-success + foreground** (owner row 10) — JS-only, OTA-eligible; no NetInfo native module.
- **Enqueue ONLY on a network throw; a server refusal (4xx/5xx) is never queued** — replaying a rejected write is wrong.
- **57b wired for NOTES only** (mechanism is kind-generic). All 5 acceptance criteria are Notes; this bounds the UI blast radius.
- **Pure seams in `lib/`, device I/O split out** — the Vitest AsyncStorage stub is a no-op, so every decision is unit-tested and only the thin storage calls are device-only (same pattern as `netResilience`/`staleBuffer`).

## Known broken / deliberately skipped
- **Task-create queue wiring** — the documented remaining 57b piece: add `'task'` to `QueueKind`, an enqueue in `addTask`'s network-catch, a `replayWrite` branch, a Tasks-list pending row. No new mechanism needed.
- **Device-unverified** — AsyncStorage round-trip only proves out on a handset (the test stub is a no-op). OTA-eligible.
- **New English strings owe 5-language human copy** — "Synced … may be out of date", "Pending sync", the queued toast, the drop notice. Machine translation forbidden; not yet i18n keys.
- **Notes has no read cache** (only its write queue) — notes can carry sensitive dictation; excluded on the same PII principle.
- **Phase 72 (team push) STILL blocked** — re-verified this session: push code uncommitted in `../cgpe-backend-main`, absent from `origin/main` (tip `f65e56a`), prod `/push/register` → 404, FCM unset. Do NOT cut the APK or mark it done.

## Next session starts here
- Phase 57 finish: wire **Task-create** into the write queue (small, uses the existing mechanism) — OR pick up Phase 72 only if the backend+Firebase are *verifiably* live, or Phase 56 (iOS, needs an Apple Developer account decision).
- First command: `/boot`
- Watch out for: **the backend repo is `CGPE-CURRENT-PROJECT/cgpe-backend-main`, NOT `Shivam-Aaziko-Dev-MERN/cgpe-backend-main`** — a `cd 2>/dev/null` to the wrong path silently runs git in the ANDROID repo and gives false "backend" answers. Use `git -C /f/Shivam-Aaziko-Dev-MERN/CGPE-CURRENT-PROJECT/cgpe-backend-main` and confirm with the prod curl (401=live, 404=not).
