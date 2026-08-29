# HANDOFF — CGPE Connect (Android) — Phase 85 (i18n) — 2026-08-29

> ⚠️ **A concurrent session committed voice-scaffolding work (Phase 78) into this same checkout ON TOP
> of this session's Phase 85 commits.** History is linear and both sets coexist; local == remote
> `aaziko/Shivam` = `4fb2086`. The voice work (`src/voice/**` + 4 lines of `api.ts`, commits
> `41dffbb`→`4fb2086`) is **NOT this session's** — see memory `voice-scaffolding-2026-08-29`. Nothing
> was overridden either way (verified: my `d9adb5b`/`16ffb2f` are ancestors of HEAD).

## Done

- **Three home-dashboard widget section headers now read in all five languages** — the Prospects, Notes
  and Tickets widgets. Wired by **pure reuse** of byte-exact keys the owner already supplied: no English
  changed, zero new keys added.
- **The claimed "home.tsx nav free win" was proven mostly NOT clean** — a 4-lens adversarial review
  (completeness / convention / exact-match / skeptic + synthesis) wired 3 and correctly refused 6 + the
  shortcut-card table, each filed as owner copy so nothing ships half-translated.

## Files changed

- `src/app/(tabs)/home.tsx` — three one-line header swaps (`'Prospects'`→`t('more.prospectsTitle')`,
  `'Notes'`→`t('more.notesTitle')`, `'Tickets'`→`t('common.tickets')`). Nothing else touched.
- `docs/i18n/COPY-REQUEST-2026-08-26.md` — new **Batch 6g**: the refused home-widget headers + the Team
  footer placeholder + the LINK_WIDGETS subtitle sentences + near-miss titles, all quoted verbatim.
- `docs/PHASES.md`, `docs/HANDOFF.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, `CLAUDE.md` — board +
  the "free win" correction so the next session does not re-chase it as a clean reuse.

## Decisions made

- **WIRE Prospects/Notes/Tickets; REFUSE the rest.** The wiring rule: translate a widget header only
  where the card body has no *translated* chrome for its English peers to clash with (pure data, or
  one-direction English like the shipped flagship `my_tasks`).
- **Team → REFUSE** even though `dash.team` is byte-exact: its card renders translated on/off-duty pills
  beside a hardcoded English `${onDuty} of ${team.length} on duty right now` footer → a translated
  header would be a half-translation island. Needs a `{n} of {total}` placeholder key first.
- **No reworded English, no new keys.** `'Leads pipeline'` left English rather than reuse the near-miss
  `more.leadsTitle` (`'Leads and pipeline'`). `dash.campaigns` is NOT a clean win (keyless subtitle).

## Known broken / deliberately skipped

- **Device-unverified** — `home.tsx` is device-only and no APK can build until the EAS quota resets
  (1 Sep). Display-only, low-risk, but eyeball the 5-language render on a handset during device QA.
- **Batch 6g is owner-owed** — the day-spine / leads / claims / issue-log / team headers and the
  shortcut-card table stay English by design until that copy + one placeholder key arrive.
- **No self-contained i18n free win remains in `home.tsx`** — the residue all needs owner copy.

## Next session starts here

- Phase 86: either **Batch 6b** (41 outage sentences, owner-owed) or, when Batch 6g copy lands, finish
  these home headers + the LINK_WIDGETS table as a whole. (Parallel: the store-deployment track's next
  engineering step is the **1-Sep APK**, carrying this i18n work + the boundary fix, where the boundary
  fix gets device QA.)
- First command: `npm test`
- Watch out for: **a concurrent session is actively committing in this same checkout** — `git fetch
  aaziko` and check ancestry before assuming HEAD is where you left it, and never force-push/reset to
  "tidy" its commits. Also: `home.tsx` is the 2534-line danger-zone file; `t` is in scope in
  `renderWidget` (not memoized → no dep-array trap), but lint any new hook dep cache-free.
