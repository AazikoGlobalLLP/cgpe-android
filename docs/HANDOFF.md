# HANDOFF — CGPE Connect (Android) — Phase 4 — 2026-08-10

Commits: `5c08872` (the code) · `4fd9b72` (docs + decisions) · `06641b1` (what the review found).
**Branch `Shivam` is still NOT pushed — see Known broken.**
Gates: `npx tsc --noEmit` exit 0 · `npm test` **188 passed / 7 files** · `npm run lint` 46 errors
(byte-identical to baseline).

## Done

- **Tapping a lead opens it.** `GET /leads/:id` answers `{ data: { lead } }` and the app validated
  against `data`, so the detail screen had **never** rendered a real lead in any run of this app.
- **A stage change persists.** The app was sending `{ stage }` — not a path on the Lead schema, so
  Mongoose strict mode dropped it and the server answered 200 with the record unchanged. **No
  stage change from this app had ever been saved.** It sends `{ status }` now.
- **A won lead reads as won.** `policy_issued` and `docs_shared` matched no arm of the old mapper
  and fell through to "New", so a closed sale looked identical to a fresh lead everywhere.
- **A new lead shows its real name**, instead of "Lead" with the id `"undefined"` — the 201
  envelope was unwrapped one level too few, and the POST body was the app's own object, eight of
  whose eleven keys the schema silently discards.
- **The app has no lead vocabulary of its own.** `LeadStage` is `Lead.status`'s five enforced
  values verbatim. The old six included three words that exist nowhere on the server.
- **A mistyped mobile number no longer raises an app-wide outage banner**, and no longer leaves a
  lead in the local buffer that the server has refused and will keep refusing.
- **One real outage stopped being swallowed** — found by the review, not by the phase: `addLead`
  left a "this was an answer" note in `suppressed` that the next `GET /leads` failure consumed.

## Files changed

- `src/data/types.ts` · `src/data/labels.ts` — the five-value union and its labels
  (New · Meeting · Docs shared · Policy issued · Lost).
- `src/data/adapt.ts` — `mapLeadStage` is an exact `Record` lookup plus a two-entry `Map`, not five
  unanchored regexes; `status` is read before the raw `stage` key; `insurance_need` finally reaches
  the Interest line.
- `src/data/api.ts` — `getLeads` classifies its own 403; `getLead` unwraps `data.lead`;
  `setLeadStage` sends `{ status }` and returns the server's updated lead; `addLead` sends a Lead
  document, unwraps the 201, and classifies 400/403/404 for itself. `WriteFailure` gains `invalid`.
- `src/app/(tabs)/leads.tsx` · `src/app/lead/[id].tsx` · `src/app/(tabs)/home.tsx` ·
  `src/app/search.tsx` — the funnel is four steps; the confirmation is the write's own reply.
- `src/data/__tests__/adapt.test.ts` — the two pinned cases flipped **on purpose** and moved out of
  the pinned-bugs block, which now holds only the `mapClaimStatus` pins.
- `src/data/__tests__/api-leads.test.ts` **(new, 21 tests)** — the wire contract: request bodies and
  response envelopes, mutation-checked three times.
- `docs/spec/PHASE-4.md` **(new)** — 11 locked decisions, 9 acceptance criteria, out-of-scope list.
- `TESTING_GUIDE.md` rows 3–5, `docs/{PHASES,PROJECT_MAP,DECISIONS}.md`, `../contracts/INBOX.md`.

## Decisions made

Three appended to `docs/DECISIONS.md` in full. In short:

- **The app's lead vocabulary IS `Lead.status`.** Keeping the app's six words and translating on
  write is the smaller diff and the worse answer: `contacted` has no target in the enum, so the
  user taps it, the server stores something else, and the app reports "not saved" every time.
- **`status` beats `stage` on read** — the opposite of the backend's own `reports.js:121`, because
  `status` is the only one of the two any endpoint will write. Filed to `cgpe-api` as an
  observation, with the note that a lead moved from the app now reads as unmoved to `reports.js`.
- **A 400 is a refusal**, not an outage and not a local save. Extended after review to every
  permanent refusal (403/404/501).

## Known broken / deliberately skipped

- **The branch is not pushed — `git push` still returns 403.** Re-tried once today: the stored
  credential is `reactjsaaziko`, the repo is `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`, that account
  has no write access. **Needs a human**, and it is now four phases of work sitting locally.
- **`../contracts/` is not under version control at all.** The parent directory is a git repo with
  **zero commits** and `contracts/` is untracked in it, so the INBOX replies filed today exist only
  on this disk. Worth telling the other two sessions.
- **Phase 4 acceptance criteria 7–9 are unverified on a device** — they need a handset and a live
  backend: open a lead, move it and cold-start, add a lead with a real mobile number.
- **Phase 1 acceptance criteria 1–6 are STILL unverified** — haptics, an AsyncStorage clock key and
  background GPS need a handset in airplane mode. Four phases have now not covered them.
- **`src/screens/dashboards.tsx:292-297`** still shows all-zero Master KPI tiles on a partial
  outage. Carried from Phase 3, still specified there, still not done.
- **`getOrgSnapshot`'s "Active leads" counts closed leads too**, so the master dashboard and the
  Leads header disagree by the policy-issued count. Pre-existing, now easier to notice.
- **`getLeads` asks for 500 and ignores `data.pagination`** — above 500 leads the book is truncated
  with no banner.
- **A `requireModule('sales')` 403 renders as "No leads in your pipeline yet."** The banner is
  correctly suppressed; the copy is not yet honest. The RBAC denial body has **no `error` key** —
  it is `{ code, module, message }`, a fourth error envelope.
- **Write-path fabrications remain** — `setLeadStage` and `addLead` are now honest;
  `sendWaMessage`, `addTask`, `reassignTask` are not. Phases 5 and 9.

## Next session starts here

- **Phase 5: WhatsApp send** — send `text` (not `message`), resolve the phone from `waThreadCache`
  (not the empty `state.waThreads`), and let a failure reach the composer.
- **First command:** `npm test` (expect 188 / 7 files).
- **Watch out for:** `../contracts/INBOX.md` grew from 77 KB to 103 KB *during* this session and
  every line number in it moved — anchor edits on surrounding text, never on a line number, and
  re-read immediately before writing. Phase 4's method is worth repeating: read the contract row,
  then read the producer's handler, then assert the envelope in a test that fails if the shape
  moves. Doing that turned "unwrap an envelope" into four defects, one of which meant no stage
  change had ever saved.
