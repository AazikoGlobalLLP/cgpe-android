# HANDOFF — CGPE Connect (Android) — Phase 15 — 2026-08-11

Two commits on `Shivam`: `292610b` (the fix + rule disables) and `f69e814` (the PHASES.md board +
Phase 15 section). **The branch is NOT pushed — `git push origin Shivam` still 403s**, re-tested
non-interactively this session: `Permission to Dev-Shivam-05/CGPE-ANDROID-APPLICATION.git denied to
reactjsaaziko`. Unchanged for several sessions; needs a human to grant write access or swap the
credential in Windows Credential Manager. The remote was NOT changed and history was NOT rewritten.
Fifteen phases now sit locally (14 done + Phase 1 code-complete-but-device-unverified).
Gates: `npx tsc --noEmit` exit 0 · `npm test` **271 passed / 10 files** · `npm run lint`
**exit 0 — 0 errors / 12 warnings** (was 45 errors / 12 warnings; all 12 warnings are pre-existing).

## Done

- **`npm run lint` now exits 0 on a clean tree.** It used to fail with 45 errors, so the second
  green gate (alongside `tsc`) is now genuinely green rather than "no *new* errors on a known-red
  tree". The 12 warnings that remain are all pre-existing and unchanged; no new ones were added.
- **The one genuine bug among the 45 is fixed, not hidden.** `home.tsx` initialised a re-render
  clock with `useState(Date.now())`, which evaluates the impure `Date.now()` in the render body on
  every pass (`react-hooks/purity`). It is now `useState(() => Date.now())` — a lazy initialiser
  that runs once at mount with an identical value. The `purity` rule stays **on**.

## Files changed

- `src/app/(tabs)/home.tsx` — one line: `useState(Date.now())` → `useState(() => Date.now())`, with
  a two-line comment saying why. No logic change; the clock's initial value is identical. This is the
  only source edit in the phase.
- `eslint.config.js` — added one override block turning **off** `react-hooks/immutability`,
  `react-hooks/refs`, and `react-hooks/set-state-in-effect`, with a ~20-line rationale comment naming
  each rule, its error count, and the pattern it fires on. `react-hooks/purity` is left on.
- `docs/PHASES.md` — board row 15 → Done; `## Now` gains the Phase 15 entry; `## Next 3` drops
  Phase 15 and records that every remaining coding phase is `[api]`-blocked; Phase 15 section marked
  DONE with a Result.
- `docs/DECISIONS.md`, `docs/STATUS.md`, `CLAUDE.md` (lint line) — updated (see below).

## Decisions made

- **Fix the one real error at source; disable the other three rules with a documented reason.** This
  is what Phase 15's DONE-WHEN explicitly allows ("`npm run lint` exits 0, **or** every remaining
  rule is explicitly disabled with a reason") and what the previous handoff directed. See
  `docs/DECISIONS.md` (2026-08-11, Phase 15) for the full rationale.
- **The disable is honest, not blind — the React Compiler is genuinely enabled.** `app.json` sets
  `experiments.reactCompiler:true` and `babel-plugin-react-compiler@1.0.0` is installed, so these
  `eslint-plugin-react-hooks` v7 rules are the compiler's own static analysis, not lint noise. The
  compiler **bails out of optimising** a flagged component rather than miscompiling it, so the code
  is safe as written; the cost of the disable is that those components forgo auto-memoisation, not
  correctness. That trade-off is stated in the config comment and in DECISIONS.
- **Did not rewrite 20+ screens to satisfy `set-state-in-effect`.** The flagged pattern is the app's
  single documented data-fetch convention (`CLAUDE.md` §Conventions 3: effect → memoised loader →
  setState), and the files include the 1915-line `home.tsx`, all with zero test coverage. A
  lint-only phase is the wrong place for an unverifiable structural rewrite.

## Known broken / deliberately skipped

- **The branch is not pushed — 403, re-confirmed this session.** Needs a human (write access or a
  credential swap). Do NOT change the remote URL, rewrite history, or re-clone to work around it.
- **12 lint warnings remain, by policy.** They are all pre-existing (unused vars, two `require()`
  imports, an `Array<T>` style nit, two `exhaustive-deps` advisories, a duplicate-import warning).
  Phase 15's DONE-WHEN is about **errors**; warnings were never in scope and none are new.
- **The three disabled rules no longer guard new code.** If someone writes a genuinely unsafe
  Reanimated/effect pattern in future, these rules won't catch it. Accepted: they were 44/45 false
  positives on this tree, and the alternative (leaving the gate red forever) is worse.
- **Everything carried from Phases 1, 4, 5, 7, 10, 13's handset-only criteria remains unverified** —
  no device work happened this session (haptics, the AsyncStorage clock key, background GPS, the
  master route replay, airplane-mode behaviour, the offline map render). Phase 15 is pure
  compiler/lint work, fully verified by `tsc` + `npm test` + `npm run lint`.

## Next session starts here

- **Every remaining *coding* phase for this session (6, 9, 12, 16) is blocked on `cgpe-api`.** The
  honest next work is either (a) re-check whether `cgpe-api` has shipped the dependency for
  **Phase 12** (`/profiles` role gate) or **Phase 6** (commissions/LIC/notes envelope shapes —
  re-read the `contracts/api.md` `/commissions` row first; team-summary being un-shadowed does NOT
  by itself unblock Phase 6), or (b) the **device-verification backlog** (handset-only criteria from
  Phases 1, 4, 5, 7, 10, 13 — needs a real Android device, not an editor).
- First command: `npm test` (re-run once if the first cold-start run spuriously fails the whole
  suite with `Cannot read properties of undefined (reading 'config')`), then re-read
  `../contracts/INBOX.md` fresh at boot.
- Watch out for: **there is no `docs/spec/PHASE-6/9/12/16` device-independent shortcut** — each of
  those needs the backend contract confirmed before code. Do not start one on the assumption it is
  unblocked; verify the `api.md` row and the producer's handler first (Phase 4's method). And as
  always: `../contracts/INBOX.md` is written concurrently — re-read immediately before editing and
  grep your own reply back afterwards.
