# SPEC LOCK — Phase 1: Write-path honesty

Status: **APPROVED 2026-08-10 (`go`) · BUILT.** `npx tsc --noEmit` exits 0; `npm run lint` reports
61 problems / 46 errors / 15 warnings — byte-identical to the pre-change baseline, so no new errors.
**Acceptance criteria 1–6 are NOT yet verified** — they need a real handset in airplane mode.

## The problem in one sentence

Five write functions in `src/data/api.ts` resolve success when the write never reached the server,
and the screens above them fire success haptics, print confirmations, persist local state and
navigate away — while carefully-written error branches sit unreachable underneath.

| # | Function | What it does today | Evidence |
|---|---|---|---|
| 1 | `deleteAccount` | Discards its only network call's result, returns hardcoded `{ ok: true }`. `DELETE /auth/me` **does not exist** on the backend. | `api.ts:481-485`; no `router.delete` in `routes/auth.js` |
| 2 | `clockIn` | `} catch { return { ok: true }; }` | `api.ts:1038` |
| 3 | `clockOut` | `} catch { return { ok: true }; }` | `api.ts:1049` |
| 4 | `updateTaskStatus` | Returns failure **only** for HTTP 403; 500/404/timeout/offline all reach `return { ok: true }` | `api.ts:298-310` |
| 5 | `toggleTaskStep` | Makes **no network call at all**; mutates `state.tasks`, which is permanently empty | `api.ts:318-328` |

Downstream consequences that are already written and currently dead code:
`account.tsx:81-86` ("The server did not confirm the deletion…"), `home.tsx:837-844`
("Attendance could not be recorded"), `task/[id].tsx:202-213` ("Status was not saved").

## SPEC LOCK — Phase 1

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | What shape does a failed write return? | `{ ok: false, reason: 'network' \| 'server' \| 'forbidden' \| 'unsupported' }` — never a throw | `updateTaskStatus` already returns `{ok:false, forbidden:true}`; this generalises the existing shape rather than inventing one |
| 2 | `deleteAccount` with no backend endpoint | Return `{ ok: false, reason: 'unsupported' }`. Do **not** sign the user out. Show the existing `account.tsx` copy verbatim. File an INBOX item to `cgpe-api` for `DELETE /api/auth/me` | Signing out after a failed delete is the current bug: it looks like it worked. The user's data is untouched, so the session must be too |
| 3 | Clock-in failure behaviour | No local `clock.<date>` write, no `startTracking()`, no `haptics.heavy()`. Banner from `home.tsx:837-844` | A tracking session with `sessionId: undefined` attaches a whole shift's GPS to nothing — worse than no tracking |
| 4 | Clock-out failure behaviour | Leave `in: true`, no `haptics.success()`, same Banner | A shift left open on the server must stay visibly open on the device |
| 5 | Task status failure behaviour | `setTask(before)` rollback + the existing "Status was not saved" notice; **no** `leaveShortly()` navigation | Navigating away hides the failure; the rollback path already exists for 403 |
| 6 | `toggleTaskStep` with no endpoint | Render the checklist **read-only** and remove `haptics.success()`. Do not fake persistence | A tick that reverts on the next focus refetch is worse than a tick you cannot make. Wiring it is Phase 9, `[api]` |
| 7 | Timeout that counts as failure | The existing `REQUEST_TIMEOUT = 4500` ms AbortController | Already the app-wide value; introducing a second timeout would drift |
| 8 | Does a failed write report to `data/health`? | **No** in Phase 1 — writes report inline at the call site. Read-path health reporting is Phase 3 | Keeps Phase 1 to five functions; mixing in the health-bus rewrite makes it unreviewable |
| 9 | Copy for the new `unsupported` reason | Reuse the exact existing strings in `account.tsx` / `home.tsx` / `task/[id].tsx`. No new user-facing copy | Those strings were written for exactly this case and are currently unreachable; this phase's job is to reach them |
| 9a | **Added during build.** Row 9 taken literally would tell a user whose deletion is `unsupported` to "Check your connection and try again" | For `unsupported` only, show the **first sentence alone**: *"The server did not confirm the deletion, so your account is unchanged."* All other reasons keep the full two-sentence string | The route does not exist, so retrying can never succeed — that half-sentence is false for this case. This is a **subset** of already-approved copy, not new copy, so it holds row 9's intent. Flagged rather than chosen silently, per spec-lock |

## OUT OF SCOPE (will NOT build)

- `toggleReminder` and `toggleClaimDoc` — same no-op family, but they need backend endpoints. Phase 9.
- Read-path health reporting (`tryReal` never calls `reportFailure`). Phase 3.
- The `DELETE /api/auth/me` endpoint itself — that is `cgpe-api`'s work.
- Any refactor of `api.ts`'s structure. Five functions and their call sites only.

## ACCEPTANCE CRITERIA (binary, testable — device in airplane mode)

- [ ] Clock-in shows the "Attendance could not be recorded" Banner, fires no haptic, writes no
      `clock.<toDateString()>` key to AsyncStorage, and calls no `startTracking()`.
- [ ] Clock-out leaves the hero in the on-duty state and fires no success haptic.
- [ ] Marking a task done shows "Status was not saved", restores the previous status, and leaves the
      user on `task/[id]`.
- [ ] Account deletion shows "The server did not confirm the deletion, so your account is unchanged."
      and the user is **still signed in** afterwards.
- [ ] The task step checklist renders with no tappable affordance.
- [ ] With the network restored, all five flows behave exactly as they do today.
- [ ] `npx tsc --noEmit` exits 0. `npm run lint` reports no *new* errors (baseline: 46).
- [ ] An INBOX item for `DELETE /api/auth/me` exists in `../contracts/INBOX.md`.

## RISKS

- **`{ok:false}` is a wider return type than some call sites expect.** Cheapest check: `tsc --noEmit`
  catches every one, because `strict: true` is on and these functions are typed.
- **Clock-in is the app's most-used control** — a regression here is felt by everyone the same morning.
  Cheapest check: acceptance rows 1, 2 and 6 walked on a real handset before the APK goes out, not on web.
- **Read-only checklist may read as a regression to users** who currently see it tick. Mitigate by
  shipping Phase 9 soon after, and say so in the release note.

---

Reply `go` to build all of it, or `change 2,6` with your values.
