# HANDOFF — CGPE Connect (Android) — Phase 9 (reminders persist) — 2026-08-11

Built this session: **Phase 9**. Its `[api]` / "Blocked on cgpe-api" tag was **wrong** — the backend
endpoint existed all along, so this was pure app-side work (same pattern as Phases 6/10/11/12). One
local commit, `bff1971`; **push still 403s**, so it — and every commit back through `7c11c82` — is
local only.

Gates all green: `npx tsc --noEmit` exit 0; `npm test` **305 tests / 14 files** (+6); `npm run lint`
**0 errors / 12 warnings** (Phase-15 baseline, unchanged).

## Done

- **A reminder marked done is now a real, server-confirmed write, and it sticks.** `toggleReminder`
  used to flip an in-process buffer that a live session never reads back, so the tick reverted on the
  next refetch and the screen deliberately fired `haptics.tap` (not success) because "the API never
  gives an acknowledgement." It now POSTs `/reminders/:id/acknowledge` (which persists
  `status:'acknowledged'`), returns whether the server accepted it, and `adaptReminder` reads
  `acknowledged` back as done — so a completed reminder survives a cold start.
- **A refused completion no longer lies.** `reminders.tsx` now mirrors `tasks.tsx`: the tick is
  optimistic, but if the write fails the row is put back and a warning `Banner` says so; only a
  server-confirmed write earns `haptics.success`.
- **Completion is one-way and the UI says so by omission.** The backend has no un-acknowledge, so the
  "Reopen" swipe action and the done-row undo button were removed — a reopen could only silently
  revert. A done reminder shows a static success check, no action.

## Files changed

- `src/data/api.ts` — `toggleReminder` → `Promise<boolean>`, POSTs `/reminders/:id/acknowledge`
  (`markAllNotificationsRead` shape; no `reportFailure` — a single write surfaces inline).
- `src/data/adapt.ts` — `adaptReminder`'s done-regex gained `acknowledg` (case-sensitive; wire value
  is lowercase `acknowledged`).
- `src/app/reminders.tsx` — optimistic-write-with-rollback (notice `Banner`), reopen affordances
  removed, header comment + empty-state copy corrected.
- `src/data/__tests__/api-reminders.test.ts` — **new**, 6 cases: the acknowledge request shape + the
  four return outcomes + the no-session no-network case.
- `src/data/__tests__/adapt.test.ts` — added the `acknowledged → done:true` assertion.
- `docs/spec/PHASE-9.md` — **new**, the spec (goal, §1 verification, 5 locked decisions, deviation).
- `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md` — status updated.
- `../contracts/INBOX.md` — "shipped, nothing owed, `[api]` tag was wrong" notice to
  `cgpe-api`/`cgpe-admin` (grep-verified it survived a concurrent write).

## Decisions made

- **`toggleClaimDoc` left as-is — a deliberate deviation from the approved plan (D-3).** The plan said
  "make the claim-docs control read-only." Reading `claim/[id].tsx` showed that would delete honest,
  working code: the checklist already discloses it does not persist (footer at `:416` — *"This
  checklist is a working note on your handset. Ticking a document does not update the register."*), so
  it is not the silent-revert harm Phase 9 targets, and its tick is load-bearing for the real upload
  flow (`:262-270`). There is also no `documents` field on the backend `Claim` to wire. Flagged to the
  user; easily reversible if they still want the manual tap gone.
- **Completion is one-way; reopen removed, not faked (D-2).** `PUT /reminders/:id` takes no `status`
  and `/:id/cancel` sets `cancelled` (still *done*), so the backend cannot move a reminder back to
  pending. A reopen control would be exactly the silent-revert lie this phase deletes.
- **No contract/`CHANGELOG` change (D-4).** Every endpoint already existed and was documented; the
  `[api]` tag was stale. The cross-boundary note is the INBOX item, not an `api.md` edit.

## Known broken / deliberately skipped

- **`git push` still 403s** — `bff1971` and everything back through `7c11c82` are unpushed. Credential
  `reactjsaaziko` has no write access to `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. Needs a human. Not
  retried.
- **Cold-start persistence for reminders is code-complete but device-unverified** — criterion 4 needs
  a handset + live backend + a signed-in staff account (complete a reminder, kill/reopen the app,
  confirm it is still done). Carried, like every other handset criterion.
- **No in-app un-complete for reminders** — one-way by backend design. Reopening a mistakenly-completed
  reminder would need a `cgpe-api` un-acknowledge (or `PUT` accepting `status:'pending'`). Filed as a
  non-request in the INBOX notice; not this phase's.
- **Phase 6 commissions and Phase 16 salary — re-verified genuinely `cgpe-api`-blocked this session.**
  `routes/commissions.js` has no *product* aggregate and no `target` source; no backend model has any
  `salary`/`per_day`/`wage`/`ctc`/`pay_rate` field. Nothing app-side to build until those land.

## Next session starts here

- **No editor-buildable phase remains that is confirmed unblocked.** With Phase 9 done, the board is:
  Phase 6 commissions and Phase 16 salary are `cgpe-api`-blocked (re-verified), and everything else is
  a handset-only acceptance check (Phases 1/4/5/6/7/9/10/12/13). Next is either a **device-verification
  pass** or a **`cgpe-api` unblock landing** (then build Phase 6 commissions / 16).
- **First command:** `/boot`
- **Watch out for:** don't re-run the reminders wire — it's done and green. And **do not trust a
  phase's `[api]`/"blocked" tag without grepping the sibling backend first** — it has now been wrong
  for Phases 6, 9, 10, 11 and 12. Before concluding a phase is backend-blocked, read
  `../cgpe-backend-main/routes/*` for the endpoint; the tag is a hypothesis, not a fact.
