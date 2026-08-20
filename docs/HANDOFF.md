# HANDOFF — CGPE Connect (Android) — Phase 57b finished (Task-create in the offline write queue) — 2026-08-20

Phase 57 offline support is now **fully built**: 57a read cache, 57b write queue for **Notes**, and — this session — the
documented remaining 57b piece, **Task-create**. `[m]`-only, **no contract change** (the backend never learns the app was
offline). JS-only and **OTA-eligible** (AsyncStorage was already a dependency), so it does NOT need the pending native APK.
Committed `eb81a04`, pushed `aaziko/Shivam`.

## Done
- **A task created while offline is no longer lost or falsely reported as saved.** `addTask` now has four honest outcomes —
  **saved** (server accepted, real id) / **queued** (network was down → additive draft held to sync, temp id, "Pending sync"
  badge, NO success buzz, "saved on this device" toast) / **forbidden** (403) / **failed** (any other server refusal → NOT
  queued). The queued draft survives an app kill, renders pinned at the top of the Tasks tab, is inert (no swipe / complete /
  tap) until it flushes, and auto-syncs on the next successful request (sign-in / foreground / recovery) — swapping its temp
  id for the real server task via a reconcile-on-flush refetch. A server-refused draft drops with a one-time notice.
- Gates green: `tsc` 0 · `npm test` **755** (+8: `api-task-queue` 7, writeQueue task-kind 1) · eslint 0 new errors.

## Files changed
- `src/lib/writeQueue.ts` — `'task'` added to `QueueKind` + the `KINDS` runtime guard (pure seam).
- `src/data/api.ts` — `addTask` rewritten to the 4-outcome `AddTaskResult`; shared `taskCreateBody()` builds the `/team/tasks`
  POST for BOTH first attempt and offline replay (can't drift); `taskDraftToTask()` = draft→display Task; `replayWrite` gained
  a `task` branch; drop-notice reworded kind-agnostic ("offline change(s)").
- `src/data/tasks.ts` — `Task` gains an optional `pending` flag (offline-queued, inert, badged).
- `src/app/task-new.tsx` — the caller now branches all four outcomes (success haptic only on `saved`; `queued` → neutral toast
  + navigate to the Tasks tab; `failed` → honest "not created" notice).
- `src/app/(tabs)/tasks.tsx` — pending task drafts pinned above the server-confirmed filtered list; "Pending sync" badge on
  the card; one-time drop-notice banner; reconcile-on-flush effect (refetch when the queue shrinks).
- `src/data/__tests__/api-task-queue.test.ts` — NEW, the 4-outcome contract pinned (mirrors `api-notes-queue.test.ts`).
- `src/lib/__tests__/writeQueue.test.ts` — a case that both `note` and `task` kinds parse, others still rejected.
- `docs/spec/PHASE-57.md` / `docs/PHASES.md` — Build log + board updated.

## Decisions made
- **Pending tasks are pinned as a separate section, NOT merged into the filtered list** — so a not-yet-on-server draft can't
  distort the hero "today" progress or the overdue/upcoming counts, which must reflect only confirmed tasks.
- **`taskCreateBody()` is resolved ONCE at enqueue time and shared by first-attempt + replay** — a replay hours later must send
  a byte-identical body (e.g. can't re-derive a different assignee from a since-changed `currentUserName`).
- **A 403 is its own `forbidden` outcome, kept apart from `failed`** — "you may not create tasks" is an explainable role
  condition (an inline role notice), not a transient error, and like every 4xx it is never queued.
- **A 200 without a server id is treated as a refusal (drop), not a success** — mirrors the Notes replay's `success:false` guard.

## Known broken / deliberately skipped
- **Leads-create is the only additive create still unqueued** — optional, not in the owner's acceptance criteria; the mechanism
  is kind-generic if it's ever wanted (add `'lead'` to `QueueKind`, an enqueue + a `replayWrite` branch).
- **Device-unverified** — the Vitest AsyncStorage stub is a no-op, so the round-trip only proves out on a handset. OTA-eligible.
- **New English strings owe 5-language human copy** — "Pending sync", the queued toast, "not created", the drop notice.
  Machine translation forbidden; not yet i18n keys.
- **Phase 72 (team push) STILL blocked** (unchanged) — backend push code uncommitted in `../cgpe-backend-main`, absent from
  `origin/main`, prod `/push/register` → 404, FCM unset. Do NOT cut the APK or mark it done.

## Next session starts here
- **Phase 57 is done.** Pick from: wire **Leads-create** into the queue (small, same mechanism) — OR **Phase 56 (iOS)**, which
  needs an Apple Developer account decision from the owner — OR pick up **Phase 72** only if the backend + Firebase are
  *verifiably* live (fetch `origin/main` + no-auth curl `/push/register` returns 401 not 404).
- First command: `/boot`
- Watch out for: **the backend repo is `CGPE-CURRENT-PROJECT/cgpe-backend-main`, NOT `Shivam-Aaziko-Dev-MERN/cgpe-backend-main`** —
  a `cd 2>/dev/null` to the wrong path silently runs git in the ANDROID repo and gives false "backend" answers. Use
  `git -C /f/Shivam-Aaziko-Dev-MERN/CGPE-CURRENT-PROJECT/cgpe-backend-main` and confirm with the prod curl (401=live, 404=not).
