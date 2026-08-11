# PHASE 9 — Make reminders (and checklists) persist, or remove the control

Session `cgpe-mobile`. Written 2026-08-11, before a line changed, from a full read of
`src/data/api.ts` (`toggleReminder`, `getReminders`, `toggleClaimDoc`, and the `toggleTaskStep`
tombstone), `src/data/adapt.ts` (`adaptReminder`), `src/app/reminders.tsx`,
`src/app/claim/[id].tsx`, and — on the producer's side — `cgpe-backend-main/routes/reminders.js`,
`cgpe-backend-main/models/Reminder.js`, and `contracts/api.md` §`/api/reminders`.

---

## The one-sentence goal

A reminder ticked done stays done after a cold start (wired to the server), and the two other
"silent tick" controls the phase named are each resolved honestly — one is already gone, one
already tells the user it does not persist.

## DONE WHEN (from `docs/PHASES.md` Phase 9)

> A completed reminder is still complete after a cold start, or the control is gone.

Read per-control, because the phase names three (`toggleReminder`, `toggleTaskStep`,
`toggleClaimDoc`) and they have three different dispositions — see §2.

---

## 1. What is actually the case — verified, with citations

### 1.1 `toggleReminder` never reached the server, and the backend endpoint has existed all along

`api.ts:1064` (pre-fix):
```ts
export async function toggleReminder(id: string): Promise<void> {
  const r = state.reminders.find((x) => x.id === id);
  if (r) r.done = !r.done;
  await wait(100);
}
```
No network call. It mutates `state.reminders`, the in-process write buffer, which for a real
session is only ever the *failure fallback* of `getReminders` (`api.ts:1054-1062` returns
`unavailable('/reminders', state.reminders)` only when the real read fails). On a healthy session
`getReminders` returns freshly-mapped server rows, so the flipped buffer entry is never read and
the tick reverts on the next focus refetch. `reminders.tsx:49-52` already documented this and
correctly fired `haptics.tap`, not `haptics.success`, "which would be claiming an acknowledgement
the API never gives."

**The `[api]` tag on this phase was wrong — the endpoint exists.** The board marked Phase 9
"Blocked on cgpe-api", but `POST /api/reminders/:id/acknowledge` (`routes/reminders.js:419-443`,
`contracts/api.md:914`) has existed since before this app did. It sets `status:'acknowledged'`,
`acknowledged_at`, `acknowledged_by`, returns `{ success:true, data:Reminder }`, and 404s on an id
that is not the caller's own reminder. Same "predicted `[api]` dependency was never real" outcome
as Phases 6 (LIC/notes), 10, 11 and 12.

### 1.2 The read side already lines up — same store, same id space

- `getReminders` reads `GET /reminders?limit=100` → `routes/reminders.js:195-231`, the **Mongoose
  `Reminder`** list (`api.md:932` calls this out as one of two parallel reminder stores; the app
  only ever touches this one), scoped `user_id: req.user.id`, `data` is an array of docs each
  carrying `_id`.
- `adaptReminder` (`adapt.ts:357-371`) maps `id` from `raw._id`.
- `POST /reminders/:id/acknowledge` operates on the **same** model, `{ _id, user_id }`.

So the `id` the app already holds is exactly the `:id` `acknowledge` wants. No new read, no id
translation, no contract change.

### 1.3 `adaptReminder`'s done-vocabulary does not include the word the server writes

`adapt.ts:360`:
```ts
const done = /done|complete|sent|dismiss|cancel/.test(String(raw.status || ''));
```
The server's "this reminder is finished" status is **`acknowledged`** — which matches none of
those substrings. So without a change, a reminder we successfully acknowledge would still read back
`done:false` on the next load, and the fix would look broken end to end. One word closes it.

### 1.4 `toggleTaskStep` was already removed, deliberately, in Phase 1

`api.ts:465-473` is a tombstone comment, not code: the function made no network call, mutated
`state.tasks` (never populated for tasks — `getTasks`/`getTask` build from `/team/task-overview`
and return directly), the tick reverted on refetch, and `task/[id].tsx` fired a success haptic
over it. It was deleted; the checklist renders read-only. There is no task-step endpoint on the
backend to wire, so **for this control the "or the control is gone" arm of the done-when is
already satisfied.** Nothing to do here.

### 1.5 `toggleClaimDoc` is a local working note that already says so

`api.ts:1046-1051` mutates `state.claims` with no network call. But unlike the reminder toggle,
the claim screen **does not pretend the tick persists** — `claim/[id].tsx:44-56` documents "THE
CHECKLIST IS LOCAL", fires `haptics.select` (not `haptics.success`), and renders the disclosure
verbatim to the user at `claim/[id].tsx:416`:

> "This checklist is a working note on your handset. Ticking a document does not update the register."

Two facts make "wire it or remove it" the wrong move here:
1. **There is nothing to wire.** The backend `Claim` schema has no persisted `documents` field —
   `cgpe-api`'s own Phase-8 INBOX notice (2026-08-11) states `models/Claim.js` declares no
   `documents`/`claimant`/`timeline`, so a `POST /intake`'s doc list survives only as a
   non-persisted in-memory property and reads back empty. No endpoint records a per-document
   received flag against a claim.
2. **The tick is load-bearing for a real write.** The upload flow (`claim/[id].tsx:262-270`) ticks
   the first pending document *after a genuine `/upload` succeeds*, as the local record of "I sent
   this". Making the checklist read-only would sever that.

The harm Phase 9 exists to stop is a tick that **silently** reverts. This one reverts *loudly* — it
tells the user, in the footer, that it is a handset-only note. That disclosure is the honest
resolution the phase's own text endorses ("a tick that silently reverts is worse than no tick");
the claim checklist is already on the right side of that line. See D-3.

---

## 2. Per-control disposition

| Control | Disposition | Why |
|---|---|---|
| `toggleReminder` | **Wire it** → `POST /reminders/:id/acknowledge`; persists across cold start | Endpoint exists (§1.1), id space matches (§1.2) |
| `toggleTaskStep` | **Already gone** (Phase 1) | No endpoint; control removed (§1.4) |
| `toggleClaimDoc` | **Leave as-is** — already disclosed as non-persisting, and load-bearing for uploads | No endpoint to wire; not a silent revert (§1.5, D-3) |

---

## 3. Locked decisions

**D-1. `toggleReminder` becomes a real write that returns the server's verdict — one-way.**
New shape `toggleReminder(id): Promise<boolean>`, modelled on `markAllNotificationsRead`
(`api.ts:1298`): `!sessionReal || FORCE_DEMO → false` (nothing persisted, so claim nothing);
`POST /reminders/${id}/acknowledge`; `false` on `!ok` or `json.success === false` or a throw;
`true` only on a server-confirmed acknowledge (and mirror `done:true` into `state.reminders` so the
offline fallback is consistent, as `updateTaskStatus` mirrors `state.tasks`). It does **not**
`reportFailure` — a single user-initiated write surfaces inline on the screen, not through the
global read-outage banner (same choice as `updateTaskStatus`).

**D-2. `acknowledge` is one-way, so completion is one-way — the reopen control is removed, not
faked.** The backend has no un-acknowledge: `PUT /reminders/:id` (`routes/reminders.js:321-392`)
accepts no `status` field and refuses a `sent` reminder, and `POST /:id/cancel` sets
`status:'cancelled'` (which `adaptReminder` also reads as *done*, not reopened). So there is no way
to move a reminder back to pending on the server. `reminders.tsx`'s "Reopen" swipe action
(`:303`) and the done-row undo `IconBtn` (`:332-337`) would therefore be exactly the silent-revert
lie this phase removes — they are deleted. A done reminder shows a static, non-interactive check.
This is the "remove the control" arm applied to the *reopen* direction while the *complete*
direction is genuinely wired — the honest reflection of a one-way backend. The accidental-complete
cost is real and named in §6; it is strictly better than a reopen that reverts.

**D-3. `toggleClaimDoc` and `claim/[id].tsx` are not touched — this is a deviation from the
original plan, made after reading the code.** The phase's session plan (and the approving
question) said "make the claim-docs control read-only." Reading the screen showed that (a) the
checklist already discloses it does not persist (`:416`), so it is not the silent-revert harm the
phase targets, and (b) the tick is load-bearing for the real upload flow (`:262-270`), so removing
it would break a genuine write's local record. Making it read-only would delete honest, working
functionality to fix a lie that is not there. Left as-is; recorded here and in the handoff so the
call is visible and reversible. If the product still wants the manual tap gone, it is a small
follow-up — but the upload-driven tick must stay.

**D-4. No contract change, no `api.md`/`CHANGELOG.md` edit, no INBOX item to `cgpe-api`.** Every
endpoint used already exists and is already documented; the `[api]` tag was stale. An INBOX notice
to `cgpe-api`/`cgpe-admin` is filed *after* shipping, in the "shipped, nothing owed, your tag was
wrong" shape used for Phases 10/11/12 — not a request.

**D-5. `adaptReminder` gains `acknowledg` (substring, case-sensitive), nothing else.** The regex
stays case-sensitive — the backend writes lowercase `acknowledged`, and flipping the documented
case-sensitivity pin (`adapt.test.ts:620-626`) is a *different* bug outside this phase. The
`not_completed` false-positive pin (`:628-630`) is likewise untouched. Only the true "done"
vocabulary is extended.

---

## 4. Files

| File | Change |
|---|---|
| `src/data/api.ts` | `toggleReminder` → `Promise<boolean>`, POSTs `/reminders/:id/acknowledge` (D-1); update the section comment |
| `src/data/adapt.ts` | add `acknowledg` to `adaptReminder`'s done regex (D-5) |
| `src/app/reminders.tsx` | optimistic-write-with-rollback mirroring `tasks.tsx` (notice `Banner`, revert on failure, `haptics.success`/`warn`); remove reopen affordances (D-2); correct the header comment + "Reopen one…" empty-state copy |
| `src/data/__tests__/api-reminders.test.ts` | **new** — pins the acknowledge request + the four outcomes |
| `src/data/__tests__/adapt.test.ts` | add the `acknowledged → done:true` case |

`src/app/task/[id].tsx` and `src/app/claim/[id].tsx` are **not** touched (§1.4, D-3).

## 5. Acceptance criteria

1. `toggleReminder(id)` issues exactly one `POST /reminders/${id}/acknowledge` and returns the
   server's verdict; a non-2xx, `success:false`, a throw, or no session returns `false` and the
   screen reverts the optimistic tick with a warning notice. (Pinned in `api-reminders.test.ts`.)
2. `adaptReminder({ status:'acknowledged' }).done === true`. (Pinned in `adapt.test.ts`.)
3. `npx tsc --noEmit` clean; `npm test` green; no new lint errors.
4. **On a device against a live backend (carried):** completing a reminder, then killing and
   reopening the app, shows the reminder still complete (it read back `acknowledged`). A completing
   tap made offline reverts with the notice, does not stick, and fires no success haptic. There is
   no reopen control.

## 6. Deliberately out of scope / known costs

- **Un-completing a reminder.** One-way by backend design (D-2). A reminder completed by mistake
  cannot be reopened in-app. Filing a backend "un-acknowledge" (or teaching `PUT` to accept
  `status:'pending'`) would be a `cgpe-api` change; not this phase's, and not requested.
- **The `reminders` "calendar" store and `daily-clients`** (`api.md:932`) — a separate collection,
  id space and status vocabulary the app has never called. Untouched.
- **The claim checklist** (D-3) and **task steps** (§1.4).
- **The device walkthrough** of criterion 4 is the `CLAUDE.md` "Done means" obligation and is
  carried, as it is for every phase whose acceptance needs a handset + live backend.
