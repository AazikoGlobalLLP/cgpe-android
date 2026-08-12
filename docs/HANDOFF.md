# HANDOFF — CGPE Connect (Android) — Phase 24 — 2026-08-12

Built the one fresh editor-buildable lever after the board went editor-exhausted: surfaced the
backend's new response-only per-client `coverage_score` on the Smart segments screen. `src/` changed;
all three gates re-run green; commit local (push still 403s).

## Done
- **Smart segments now shows each client's/household's coverage adequacy as a percentage.** A row whose
  server record carries `coverage_score` shows `· NN%` beside the ₹ cover (e.g. `₹5L cover · 62%`); the
  detail sheet shows a labelled **Coverage** row (`NN%`), toned green at 100 and amber below — the
  server's own `100 ⟺ well_insured / <100 ⟺ underinsured` invariant, the same tones as the existing
  underinsured/well_insured flag Pills. A `null` (no cover on file) shows **no** coverage line — never a
  fabricated `0%`; a floored real `0` (a tiny cover) correctly shows `0%`.

## Files changed
- `src/app/segments.tsx` — added `coverageScore` to `RowView` + a guarded `asNum(o.coverage_score)` read
  in `toRowView`; appended `· NN%` to the row cover readout; added a **Coverage** `DataRow` to the detail
  sheet's `ListSection`. All four edits guarded, no on-device math, no rupee benchmark asserted.
- `docs/spec/PHASE-24.md` — new spec (goal, source-of-truth cites, the 5 decisions, deliberate cuts).
- `docs/DECISIONS.md` — appended the 2026-08-12 Phase-24 entry (top).
- `docs/PHASES.md` — `## Now` entry + board row 24 + `## Next 3` #2 (device backlog now includes Phase 24).
- `contracts/INBOX.md` — two writes, both grepped back durable: (1) **replied under the fresh `cgpe-api`
  Phase-31 landing** that shipped `GET /api/commissions/my-summary` — verified the shape matches our filing,
  left **unticked** (build owed next session); (2) filed a brief "second consumer on record" FYI to `cgpe-api`
  that mobile now renders `coverage_score`. No contract/CHANGELOG change — mobile only reads already-shipped,
  already-documented fields.

## Decisions made
- **`null` hidden, real `0` shown.** The contract's `null` = "no cover on file" (already told by the
  `no_coverage` flag), so a `null` draws no coverage line — never `0%`. A floored real `0` is legitimate
  low-coverage data and shows `0%`. `asNum` keeps the two distinct (the file's own doctrine).
- **Tone = the server's invariant, not a client cutoff.** `success` ≥100 / `warning` <100 is exactly the
  documented invariant; no threshold invented. No rupee benchmark ("of ₹1cr") on the row — mobile doesn't
  read `thresholds.coverage`, and CLAUDE.md forbids asserting a number that isn't in front of us.
- **No new test; gates green.** Guarded mapper passthrough + presentational JSX — the untested class of
  Phases 8/11/17 (`toRowView` is private to the screen; a screen import pulls RN in with no renderer).
  tsc 0, `npm test` **373/373** (unchanged), lint 0 errors / 12 warnings (baseline). Commit local.

## Known broken / deliberately skipped
- **Commissions earned aggregate — UNBLOCKED mid-handoff; build owed.** A concurrent write landed
  `GET /api/commissions/my-summary` (Backend Phase 31) while this session ran — the exact self-scoped earned
  aggregate mobile filed (`thisMonth/lastMonth/pending/ytd/history/recent`; `tier` omitted by design, read
  from `/advisor/performance/:advisorId` as Phase 23 already does). Shape verified against the shipped item;
  INBOX box left unticked. **This is next session's Phase 25** (see below) — no code written this session
  (handoff, no new work). `commissions.tsx` still renders `blank` until then.
- **i18n P1 (Phase 22 bulk) — paused on human copy.** Net-new `common.*` keys (`tryAgain` ×34, etc.) need
  gu/hi/hi-en/gu-en; machine translation forbidden (PHASE-19 §4).
- **Device-check backlog — CARRIED** (Phases 1/4/5/6/7/9/10/12/13/16/23/**24**). Phase-24 coverage % against
  real production data, light/dark at 390 px. Phase-1 clock-in remains the stated hard prerequisite. Not
  editor-buildable.
- **`git push` still 403s** — `reactjsaaziko` lacks write on `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. All
  commits local (this session: `7785d8a`). Needs a human to grant access or swap the credential.

## Next session starts here
- **Phase 25 — build the commissions EARNED aggregate against the just-landed `GET /api/commissions/my-summary`
  (Backend Phase 31).** The board is no longer editor-exhausted: this is a real, buildable, no-blocker phase.
  Add `getCommissionSummary()` in `src/data/api.ts` (low-level `req()`, three-state posture copied from
  `getMyEarnings`/`getMdrtTier`: 200-zeros = empty/no-banner, 503 = error+banner), wire it into
  `commissions.tsx`'s ledger (`thisMonth/lastMonth/pending/ytd/history/recent`), add `api-commissions.test.ts`
  pinning the envelope, then **tick the INBOX box**. `tier` is NOT in this endpoint — leave Phase 23's
  `getMdrtTier` element as-is (it reads `/advisor/performance/:advisorId`). Full shape: the `→ cgpe-mobile ·
  from cgpe-api` Phase-31 item at the TOP of `contracts/INBOX.md`; spec context `docs/spec/PHASE-6.md` D-5.
- Other levers if Phase 25 stalls: owner-supplied i18n copy → unpauses Phase 22; a handset → the carried
  device checks (now incl. Phase 24 coverage %).
- First command: `/boot`
- Watch out for: `../contracts/INBOX.md` shifts **mid-session** under concurrent writes — this session proved
  it, the Phase-31 landing appeared between boot and handoff. Anchor every edit on surrounding text, never a
  line number, and **grep your reply back** after writing (done this session — both replies confirmed durable).
