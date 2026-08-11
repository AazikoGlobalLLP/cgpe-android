# HANDOFF — CGPE Connect (Android) — Phase 8 — 2026-08-11

Two commits on `Shivam`: `e5b57ef` (code + spec + docs) · `4e12688` (the review fix).
**The branch is NOT pushed — `git push` still returns 403. Eight phases now sit locally.**
Gates: `npx tsc --noEmit` exit 0 · `npm test` **258 passed / 9 files** · `npm run lint` 46 errors
(byte-identical to baseline).

## Done

- **`generateReport` no longer invents a ₹42,00,000 report.** Any failure — offline, timeout,
  4xx, 5xx, a malformed body — used to return a fixed, fabricated summary with `ok: true`. It now
  returns `tryReal`'s result directly: `null` on any failure, the same one-line shape as
  `getDashboardOverview` and `getClaimsSummary`.
- **The one caller's dead safety net is gone too.** `client/[id].tsx` had a `source !== 'demo'`
  guard specifically written to distrust the fabricated data — proof it had never reached a
  screen, but only because that one call site remembered to check. With the fabrication deleted
  at the source, the guard and the `source` field it read are both permanently dead and are
  removed rather than left as a defensive check with nothing left to defend against.
- **`config.ts`'s five comments claiming a sample-data fallback are corrected** to say what the
  code does now: no fallback exists anywhere, a failed call resolves empty and raises the outage
  banner, and `FORCE_DEMO`/`MOCK_LATENCY` are described by their actual effect.
- **`HOW_TO_RUN.md` and `TESTING_GUIDE.md` no longer describe an offline demo mode or pre-filled
  credentials.** Both were rewritten to match `login.tsx`'s own reality — no offline path exists,
  a real advisor login is required, and `API_BASE_URL` is a computed value with nothing to
  hand-edit for a phone build, not a "default" you patch.
- **`tasks.ts` / `team.ts`'s file-header comments no longer say "sample data"** — both files' seed
  arrays were already removed in an earlier phase; only the stale header claim remained.
- **grep for `source: 'demo'` across `src/` returns nothing.** No fabricated data remains anywhere
  in the app.

## Files changed

- `src/data/api.ts` — `generateReport` reduced to a `tryReal` passthrough, no fallback.
- `src/app/client/[id].tsx` — the dead `source` field and its guard removed (forced by the fix
  above, not originally in the phase's file list — see the spec's D-3).
- `src/constants/config.ts` — the five stale comments corrected, plus a follow-up fix (the review
  caught the header's numbered list still contradicting the paragraph 24 lines below it).
- `src/data/tasks.ts`, `src/data/team.ts` — file-header comments corrected.
- `HOW_TO_RUN.md`, `TESTING_GUIDE.md` — offline-demo framing, login description and the
  config/LAN-IP section all corrected; `TESTING_GUIDE.md`'s stale "24/24 automated run" claim
  removed as unreproducible under the current real-backend-only login.
- `docs/spec/PHASE-8.md` **(new)** — six locked decisions, six acceptance criteria, what the
  review found, out-of-scope list.
- `docs/{PHASES,PROJECT_MAP,DECISIONS}.md`, `CLAUDE.md`. `docs/STATUS.md` is untouched — it is
  rewritten only on `/handoff`, not at every phase's docs-close commit.

## Decisions made

- **Delete a fabrication at the source, not just distrust it at the call site.** The caller's
  `source !== 'demo'` guard proved the fabricated data had never reached a screen, but a second
  caller checking only `.ok` would have shown an invented life-cover figure to a real customer.
  Same shape as Phase 7's D-2 and Phase 5's D-1: fabrication and mistrust of fabrication are both
  defects, and only removing the fabrication closes the class.
- **No `unavailable()` wrapper for `generateReport`.** There is no honest non-null fallback value
  for a generated report the way there is for a list or a cached record — `null` already is that
  value, and `tryReal` already reports the failure through the normal channel.
- **Adversarial review scales with phase size, not with habit.** One skeptical pass, not a
  multi-lens panel, was proportionate for a phase this small — and it still caught a real defect
  (see Known broken, first item).
- **`uploadFile`'s demo-URL fallback and the FORCE_DEMO-gated `{ ok: true }` write stubs are left
  alone.** All are gated on `FORCE_DEMO`, hardcoded `false` and never flipped in a shipped build;
  none invents a business figure the way `generateReport` did. The phase text named ONE remaining
  fabricated-data path and this was it.

## Known broken / deliberately skipped

- **The branch is not pushed — `git push` returns 403** — unchanged, now eight phases of local
  work. Needs a human to grant `Dev-Shivam-05/CGPE-ANDROID-APPLICATION` write access or swap the
  credential in Windows Credential Manager.
- **The review caught `config.ts` contradicting itself** — a paragraph rewritten by the first
  commit left its neighbouring numbered list saying the opposite thing 24 lines above. Fixed in
  `4e12688`; recorded here as a reminder that rewriting one paragraph of a stale doc without
  reading its neighbours is exactly the failure mode this phase exists to close.
- **The orphaned `d()` / `iso()` / `at()` date helpers in `tasks.ts` / `team.ts` are untouched** —
  explicitly Phase 14's ("Dead-code sweep"), named there by file. This phase corrected only the
  false header comment on each file.
- **Phase 8 added no new test file.** `generateReport`'s fixed shape is an untested one-line
  `tryReal` passthrough, matching its precedents `getDashboardOverview` / `getClaimsSummary`,
  which are also untested. Consistent with sibling code, not a new gap.
- **Phase 1 acceptance criteria 1–6 are still unverified** — haptics, an AsyncStorage clock key
  and background GPS need a handset in airplane mode. Eight phases have not covered them.
- **Phase 7 acceptance criteria 10–11 are still unverified** — a shift's route appearing under the
  master's replay, and airplane mode reaching "could not be recorded" rather than "Too far to
  clock in". Both need a handset.
- **`src/screens/dashboards.tsx:292-297` still shows all-zero Master KPI tiles on a partial
  outage** — still in no phase's file list. Carried since Phase 3.
- **`addTask`, `reassignTask`, `toggleReminder`, `toggleTaskStep`, `toggleClaimDoc` still fabricate
  success** — Phase 9, blocked on `cgpe-api`.

## Next session starts here

- **Phase 17 is the recommended next pick** — requested 2026-08-11, right after this handoff:
  warn (never block) when someone clocks out outside the office fence. Fully scoped already, no
  code written yet. It needs no `cgpe-api` change: the server computes `out_of_bounds`/`distance_m`
  on every clock-out but never returns them (`contracts/api.md:522`), so the plan is to re-derive
  the same verdict client-side with `api.checkGeofence()` — the exact function Phase 7 already
  built for clock-in, against the exact same fence. **Must not re-introduce a client-side refusal
  on clock-out** — Phase 7 deliberately removed that; this is a warning, not a re-fencing.
- **Files:** `src/app/(tabs)/home.tsx` only, per the current plan. Full writeup, the citations that
  ground it, and what's deliberately out of scope: `docs/PHASES.md`'s Phase 17 section.
- **Done when:** clocking out from outside the fence still succeeds exactly as today, plus a
  warning naming the measured distance (never a quoted radius — same D-5/D-6 convention as Phase
  7); clocking out from inside the fence shows nothing new.
- Phase 11 (server-derived tier) is the next pick after that if Phase 17 is skipped — `store/
  roles.ts` grants the top privilege tier by string-matching a personal email address compiled into
  every APK.
- First command: `npm test`.
- Watch out for: **`../contracts/INBOX.md` deletes content, not just moves it** — re-read
  immediately before editing, anchor every edit on surrounding text rather than a line number, and
  grep your own reply back after you write it. Nothing is currently open against this session, but
  a sibling can add an item mid-session — Phase 8 touched no shared contract, so INBOX was not
  re-checked mid-phase; re-read it fresh at the next boot regardless. Phase 17 also touches no
  shared contract, by design (see above) — no INBOX filing needed to build it.
