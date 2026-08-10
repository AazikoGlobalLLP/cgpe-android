# HANDOFF — CGPE Connect (Android) — Phase 4 — 2026-08-10

Five commits on `Shivam`: `5c08872` (code) · `4fd9b72` (docs) · `06641b1` (what the review found) ·
`f05ef09` (handoff) · `edc373c` (the last stale comments).
**The branch is NOT pushed — `git push` still returns 403. See Known broken.**
Gates: `npx tsc --noEmit` exit 0 · `npm test` **188 passed / 7 files** · `npm run lint` 46 errors
(byte-identical to baseline).

## Done

- **Tapping a lead opens it, with data.** `GET /leads/:id` answers `{ data: { lead } }` and the app
  validated against `data`, so the detail screen had **never** rendered a real lead in any run.
- **A stage change persists across a cold start.** The app sent `{ stage }` — not a path on the
  Lead schema, so Mongoose strict mode dropped it and the server answered 200 with the record
  unchanged. **No stage change from this app had ever been saved.** It sends `{ status }` now.
- **A `policy_issued` lead renders as won.** It matched no arm of the old mapper and fell through
  to "New", so a closed sale looked identical to a fresh lead on every screen showing a stage.
- **A newly created lead shows its real name**, not "Lead" with the id `"undefined"`.
- **A mistyped mobile number no longer raises an app-wide outage banner**, and no longer leaves a
  lead in the local buffer that the server has refused and will keep refusing.
- **An advisor without the `sales` module no longer gets a permanent outage banner** on Leads.
- **One genuine outage stopped being swallowed** — found by review, not by the phase.

## Files changed

- `src/data/types.ts` — `LeadStage` is `Lead.status`'s five enforced values, verbatim.
- `src/data/labels.ts` — `STAGE_META` re-keyed: New · Meeting · Docs shared · Policy issued · Lost.
- `src/data/adapt.ts` — `mapLeadStage` is an exact `Record` lookup plus a two-entry `Map` instead of
  five unanchored regexes; `status` is read before the raw `stage` key; `insurance_need` reaches the
  Interest line for the first time.
- `src/data/api.ts` — `getLeads` classifies its own 403; `getLead` unwraps `data.lead`;
  `setLeadStage` sends `{ status }` and returns the server's updated lead; `addLead` sends a Lead
  document, unwraps the 201, and classifies 400/403/404 itself. `WriteFailure` gains `invalid`.
- `src/app/(tabs)/leads.tsx` · `src/app/lead/[id].tsx` — four-step funnel, one-round-trip commit,
  refusal banner, corrected copy and headers.
- `src/app/(tabs)/home.tsx` · `src/app/search.tsx` — the same vocabulary, found by the compiler.
- `src/data/__tests__/adapt.test.ts` — two pinned cases flipped **on purpose** and moved out of the
  pinned-bugs block, which now holds only the `mapClaimStatus` pins.
- `src/data/__tests__/api-leads.test.ts` **(new, 21 tests)** — the wire contract: request bodies and
  response envelopes, mutation-checked three times.
- `docs/spec/PHASE-4.md` **(new)** — 11 locked decisions, 9 acceptance criteria, out-of-scope list.
- `TESTING_GUIDE.md` rows 3–5 — they named stage chips that no longer exist, so the hand-test that
  "Done means" requires could not be walked.
- `CLAUDE.md`, `docs/{PHASES,PROJECT_MAP,DECISIONS}.md`, `../contracts/INBOX.md`.

## Decisions made

- **The app's lead vocabulary IS `Lead.status`** — keeping the app's six words and translating on
  write is the smaller diff and the worse answer, because `contacted` has no target in the enum, so
  the user taps it, the server stores something else, and the app reports "not saved" every time.
- **`status` beats `stage` on read**, the opposite of the backend's own `reports.js:121`, because
  `status` is the only one of the two any endpoint will write.
- **A 400 is a refusal** — not an outage, not a local save. Widened after review to every permanent
  refusal (403/404/501); only `network` and `server` failures keep the typed record.
- **Nothing may guess a lead UP into `policy_issued`** — an alias may resolve down the funnel or
  not at all, because a guessed sale removes a lead from the open book and adds to a money figure.
- **The confirming `GET` after a write is deleted** — `PUT` returns the updated document and, unlike
  `GET /:id`, has no ownership check, so the old read-back reported "not saved" for writes that had
  saved on any lead the advisor does not own.
- **A phase is reviewed adversarially before it is called done.** Green gates are necessary, not
  sufficient: 22 findings raised, 8 survived two skeptics each, all 8 fixed.

## Known broken / deliberately skipped

- **The branch is not pushed — `git push` returns 403** — because the stored credential is
  `reactjsaaziko` and the remote is `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`, which that account
  cannot write to. Retried once today; unchanged. **Needs a human**, and it is now four phases of
  work sitting locally.
- **`../contracts/` is under no version control** — because the parent directory is a git repo with
  zero commits and `contracts/` is untracked in it. Today's INBOX replies exist only on this disk.
  Not fixed here: creating that first commit would sweep three project trees into one repo.
- **Phase 4 acceptance criteria 7–9 are unverified** — because they need a handset and a live
  backend: open a lead, move it and cold-start, add one with a real mobile number.
- **Phase 1 acceptance criteria 1–6 are still unverified** — because haptics, an AsyncStorage clock
  key and background GPS need a handset in airplane mode. Four phases have not covered them.
- **`src/screens/dashboards.tsx:292-297` still shows all-zero Master KPI tiles on a partial outage**
  — because it is not in any phase's file list yet. Specified in Phase 3's notes.
- **`getOrgSnapshot`'s "Active leads" counts closed leads too** — because it is pre-existing and out
  of this phase's scope; the master dashboard and the Leads header now disagree by the
  policy-issued count.
- **`getLeads` asks for 500 and ignores `data.pagination`** — because paging the list is its own
  piece of work; above 500 leads the book is truncated with no banner.
- **A `requireModule('sales')` 403 still reads "No leads in your pipeline yet"** — because saying
  "your department has no access" needs a fourth error envelope read (`{ code, module, message }`,
  no `error` key) that is worth doing once, everywhere.
- **`sendWaMessage`, `addTask`, `reassignTask` still fabricate success** — because they are Phases
  5 and 9.

## Next session starts here

- Phase 5: send WhatsApp messages that actually arrive — `text` not `message`, the phone resolved
  from `waThreadCache` rather than the always-empty `state.waThreads`, and a failure that reaches
  the composer instead of painting a sent tick.
- First command: `npm test`
- Watch out for: **`../contracts/INBOX.md` grew 77 KB → 103 KB *during* the last session** and
  every line number in it moved. Re-read it immediately before writing, anchor edits on surrounding
  text, and put an answer under the box that is blocking even if that means saying it twice — two
  boxes sat open for a phase because the answer had been written under a different item.
