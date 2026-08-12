# HANDOFF — CGPE Connect (Android) — Phase 21 P1 (i18n common.* dedup, copy-free slice) BUILT — 2026-08-12

Owner directed "full copy-free dedup" for the `common.*` layer. Built the slice that needs **zero** new
human copy: routed the already-translated repeated labels to existing `common.*` keys across **16 screens**,
and added **one** net-new key (`common.today`) by **lifting** existing human copy. The copy-dependent bulk of
P1 (`Try again` ×34, `Clear search`, `Refresh`, the outage body, a11y labels) is untouched and still waits on
the owner. Phase 16 self-view is **still backend-blocked** (INBOX `my-earnings` ask still unanswered — the last
`cgpe-mobile` entry, ~line 3352–3397, has no `cgpe-api` reply).

## Done
- **Routed existing-key repeats across 16 screens** to `t('common.*')`: `Call`→`common.call`,
  `Cancel`→`common.cancel`, `Delete`→`common.delete`, `WhatsApp`→`common.whatsapp`. `Call`/`Cancel`/`Delete`
  now translate in Gujarati/Hindi where they were hardcoded English. `WhatsApp` is a trade noun (English in
  all 5) → **centralization only, no visible change**, kept so button rows are consistent.
- **Added `common.today`** — the only net-new key added, by **lifting** the identical human copy already in
  `tab.home`/`tasks.today` (`આજે`/`आज`/`Aaj`/`Aaje`). **Dedup of approved copy, not machine translation.**
  Parity bumped **74→75** in `dictionaries.test.ts` (deliberate). Wired the standalone `Today` eyebrows
  (`home` ×2, `attendance`) and the `reminders` "Today" section title; also routed the sibling
  `reminders` titles `Overdue`→`tasks.overdue` and `Upcoming`→`tasks.upcoming` (existing keys) so the group
  is not half-translated.
- **Gates green:** `npx tsc --noEmit` exit 0; `npm test` **350/350** (unchanged — no new pure logic, the
  parity assertion just moved 74→75); `npm run lint` **0 errors / 12 warnings** (baseline, no new issues).

## Files changed (18 src + 4 docs)
- **i18n core:** `src/i18n/index.tsx` (+`common.today` in all 5 dicts), `src/i18n/__tests__/dictionaries.test.ts`
  (parity 74→75 + note).
- **16 screens:** `(tabs)/home.tsx`, `(tabs)/leads.tsx`, `(tabs)/clients.tsx`, `(tabs)/tasks.tsx`,
  `attendance.tsx`, `calendar.tsx`, `families.tsx`, `notes.tsx`, `notify.tsx`, `prospects.tsx`, `reminders.tsx`,
  `segments.tsx`, `task/[id].tsx`, `team/[id].tsx`, `tickets/index.tsx`, `whatsapp/index.tsx`. Each added
  `import { useT }` + `const t = useT()` (or `tr` where a local `t` existed) in the relevant component.
- **Docs:** `docs/DECISIONS.md` (top entry, 2026-08-12), `docs/i18n/SCOPE.md` (§3 P1 / §4.1 / §8),
  `docs/PHASES.md` (new `## Now` entry, board row 22, Next-3 #3), `CLAUDE.md` (i18n trap refreshed: 75 keys,
  `=== 75`, `tr` naming note, do-not-wire-net-new-without-copy warning).
- Commit: local only (push 403s, credential `reactjsaaziko` has no write access — human fix needed).
- Note: `.claude/settings.json` shows modified but is a **pre-existing** unrelated change from session start —
  **not** part of this work and **not** in the commit.

## Decisions made
- **Only the copy-free slice was built.** Every other net-new `common.*` key (`tryAgain` ×34 — the biggest
  single win, `clearSearch`, `clear`, `saving`, `uploading`, `refresh`, `loadMore`, `all`, `yesterday`,
  `done`, `mobile`, `onDuty`, `signedIn`, `continue`, `goToSignIn`, `showResults`, the a11y `Call {name}` /
  `Open WhatsApp chat` labels) needs human gu/hi/hi-en/gu-en copy. Machine translation is forbidden
  (PHASE-19 §4), so these stay blocked on the owner. This is the bulk of P1's occurrence count.
- **`common.today` by lifting, not translating.** It is the only net-new label whose four non-English strings
  already existed under another key, so it is dedup, not a guess. No other net-new key qualifies.
- **Skipped the 4 module-level date helpers** (`calendar.dayTitle`, `reminders.timeFor`,
  `notifications.dayLabel`, `whatsapp/[id].dayLabel`) — each returns `Today`/`Yesterday`/weekday/date from one
  function; `t` isn't reachable and wiring only `Today` while `Yesterday`/weekdays (no keys, need copy) stay
  English would be half-done. Skipped whole.
- **Skipped `task-new`'s "Today" picker option** (siblings `Tomorrow`/… have no keys) and **`more.tsx`'s
  nav-tile "WhatsApp"** (feature/screen-name surface, separate).
- **`tr` vs `t`.** `tickets/index.tsx` (`const t = typeMeta(...)`) and `notes.tsx` (`setTotal((t)=>…)`) already
  use `t` locally, so the translator is bound to `tr` there to avoid shadowing; every other screen uses `t`.

## Known broken / deliberately skipped
- **The copy-free `common.*` work is exhausted.** Nothing more on P1 (or any Tier-1 screen wiring) is
  buildable without owner-supplied copy. The fill-list is the net-new `common.*` set in `docs/i18n/SCOPE.md`
  §4.1 — for each key, supply Gujarati / Hindi / Hinglish / Roman-Gujarati (English is the extracted string).
- **The parity test still can't catch English-in-a-non-English dict** (it rejects only `value === key`). When
  net-new keys land with real copy, consider the §6(b) leak-guard test so an English placeholder turns the
  suite red.
- **Phase 16 self-view — still backend-blocked.** `routes/payroll.js:22-23` still `authorize('admin')`, no
  `GET /api/payroll/my-earnings`, INBOX ask (~line 3352–3397) still unanswered by `cgpe-api`. Do not build the
  earnings screen against a non-existent endpoint. Phase 20 admin roster is the only payroll surface in the app.
- **Phase 6 commissions — unchanged, still blocked** (no product aggregate / no `target`).
- **`git push` still 403s** — both this and prior commits are **local only**. Needs a human to fix the
  credential (Windows Credential Manager) or grant `Dev-Shivam-05/CGPE-ANDROID-APPLICATION` write access.
- **Device-verification backlog** — unchanged; the `common.*` label toggle (renders + switches language on a
  real handset, light/dark) joins the handset-only checks. `npm test` covers pure logic only; JSX label
  changes aren't exercised by the suite.

## Next session starts here
- **If the owner has supplied `common.*` copy:** add the net-new keys to all 5 dicts (bump parity per key),
  wire the repeats they cover (`Try again` ×34 first — biggest win; then `Clear search`, `Refresh`, unify the
  ~8-variant outage body), and add the §6(b) leak-guard test. Recon map of every hardcoded occurrence is in
  `docs/i18n/inventory/01–06*.md` (anchor edits on the English literal, not line numbers).
- **If no copy yet:** hand the owner the fill-list (`docs/i18n/SCOPE.md` §4.1 net-new set) and pick which
  Tier-1 screen (SCOPE §5) to translate first so the copy request is bounded. Do **not** wire anything needing
  a translation you'd have to invent.
- **If a `cgpe-api` reply to `my-earnings` has landed:** build the Phase 16 self-view per its preserved UI
  lock (do **not** point `payroll.tsx` at it — that's the admin roster).
- **First command:** `/boot`, then re-read `../contracts/INBOX.md` foot (~line 3352) for a `cgpe-api` reply.
- **Watch out for:** adding real keys bumps the parity test's hard `EN_KEYS.length === 75`; and the leak check
  still won't flag an English string left in `gu`/`hi` — human copy is load-bearing.
