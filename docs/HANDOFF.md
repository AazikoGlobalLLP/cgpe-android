# HANDOFF — CGPE Connect (Android) — Phase 57 finished (Lead-create in the offline write queue) — 2026-08-20

Phase 57 offline support is now **fully complete**: 57a read cache, and 57b write queue for **all three** additive creates the
app has — **Notes**, **Task-create**, and — this session — **Lead-create**. `[m]`-only, **no contract change** (the backend never
learns the app was offline). JS-only and **OTA-eligible** (AsyncStorage was already a dependency), so it does NOT need the pending
native APK. Committed `00aee55`, pushed `aaziko/Shivam`.

## Done
- **A lead created while offline is no longer lost or held only in memory.** A dropped connection now queues the lead to the
  **persistent** write queue (survives an app kill) instead of the ephemeral `state.leads` buffer. The queued lead renders pinned
  at the top of the Leads tab with a **"Pending sync"** badge, is inert (not tappable, no swipe) until it flushes, and auto-syncs
  on the next successful request (sign-in / foreground / recovery) — the reconcile-on-flush refresh swaps the temp draft for the
  real server lead. `addLead` keeps its three honest outcomes; only a genuine **network throw** enqueues — every server *answer*
  (400 invalid / 403 forbidden / 404-501 unsupported / 5xx-or-2xx-without-a-lead) is NOT queued (replaying a rejected write is wrong).
- The Add-lead sheet's copy now splits the three cases: **queued** → a neutral "saved on this device — it will sync when you're
  back online" toast (no success haptic); **server-held** → "pull to refresh and check"; **hard refusal** → "nothing was saved".
- Gates green: `tsc` 0 · `npm test` **763** (+8: NEW `api-lead-queue` 8; `writeQueue` lead-kind case updated) · eslint 0 new.

## Files changed
- `src/lib/writeQueue.ts` — `'lead'` added to `QueueKind` + the `KINDS` runtime guard (pure seam).
- `src/data/types.ts` — `Lead` gains an optional `pending` flag (offline-queued, inert, badged).
- `src/data/api.ts` — `addLead` network path rewired: a throw on a real session enqueues a persistent `'lead'` draft (stored as the
  exact `/leads` request body) and returns it as `reason:'network'` with `pending:true`; a successfully-queued write no longer raises
  the outage banner on its own. New `leadDraftToLead()` (body→display Task-equivalent); `replayWrite` gained a `lead` branch.
- `src/app/(tabs)/leads.tsx` — pending lead drafts pinned above the pipeline (never distort the counts/meter); "Pending sync" badge
  on each (new `PendingLeadRow`); one-time drop-notice banner; reconcile-on-flush effect; `onAdded` copy split three ways.
- `src/data/__tests__/api-lead-queue.test.ts` — NEW, the classify-and-queue contract pinned (mirrors `api-task-queue.test.ts`).
- `src/lib/__tests__/writeQueue.test.ts` — lead is now a valid kind; the two "unknown kind → dropped" fixtures switched to `reminder`.
- `docs/spec/PHASE-57.md` / `docs/PHASES.md` — Build log + board updated.

## Decisions made
- **`addLead` was NOT rewritten to the 4-outcome `status` union that `addTask`/`addNote` use** — it keeps its existing 3-outcome
  `AddLeadResult` (`ok`/`reason`). Rewiring only the `network` branch to enqueue is minimal, preserves the pinned wire contract in
  `api-leads.test.ts`, and avoids a ripple through the richer Add-lead sheet. The queue is still fully kind-generic.
- **The stored payload is the exact `/leads` request body (schema field names), resolved once at enqueue time** — a replay hours
  later is byte-identical (can't re-derive a since-changed field), and `replayWrite('lead')` POSTs it directly like the Notes branch.
- **Only a genuine throw enqueues; a `server` (5xx / 2xx-without-a-lead) answer stays in the ephemeral in-memory buffer, NOT the
  persistent queue** — a server that answered and refused should not be retried automatically (spec row 9).
- **A successfully-queued lead does NOT raise the global outage banner on its own** — matches the Notes/Tasks queue paths; the
  "saved on this device" toast is the per-write signal, and a concurrent failed read still raises the banner honestly.

## Known broken / deliberately skipped
- **Every additive create is now queued (Notes, Tasks, Leads).** There is no remaining un-queued create; edits/deletes/status
  changes/reorders are deliberately out of scope (additive-only, no conflict hazard — spec rows 8/59-61).
- **Device-unverified** — the Vitest AsyncStorage stub is a no-op, so the offline round-trip only proves out on a handset. OTA-eligible.
- **New English strings owe 5-language human copy** — "Pending sync", the queued toast, the drop notice. Machine translation forbidden.
- **Phase 72 (team push) STILL blocked** (unchanged) — backend push code uncommitted in `../cgpe-backend-main`, absent from
  `origin/main`, prod `/push/register` → 404, FCM unset. Do NOT cut the APK or mark it done.

## Next session starts here
- **Phase 57 is done.** Pick from: **Phase 56 (iOS)** — needs an Apple Developer account ($99/yr) decision from the owner — OR pick
  up **Phase 72** only if the backend + Firebase are *verifiably* live (fetch `origin/main` + no-auth curl `/push/register` returns
  401 not 404). No mobile-buildable phase is un-owned right now; ask the owner which of the pending owner batches to take.
- First command: `/boot`
- Watch out for: **the backend repo is `CGPE-CURRENT-PROJECT/cgpe-backend-main`, NOT `Shivam-Aaziko-Dev-MERN/cgpe-backend-main`** —
  a `cd 2>/dev/null` to the wrong path silently runs git in the ANDROID repo and gives false "backend" answers. Use
  `git -C /f/Shivam-Aaziko-Dev-MERN/CGPE-CURRENT-PROJECT/cgpe-backend-main` and confirm with the prod curl (401=live, 404=not).
