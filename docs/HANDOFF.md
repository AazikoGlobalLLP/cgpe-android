# HANDOFF — CGPE Connect (Android) — Phase 21 (i18n P0) BUILT — 2026-08-11

Phase 16 self-view is **still backend-blocked** (INBOX `my-earnings` ask unanswered — re-verified below),
so the board's editor-buildable path was the i18n widening's P0 prerequisite: extend `t()` to support
interpolation + plurals. That is now **built, tested, and committed local** (push still 403s). It adds only
the mechanism — **no screen wired, no string translated, no dictionary key added.**

## Done
- **`t()` now takes params.** `t(key, params?)` fills named `{placeholder}` tokens (an unmatched token is
  left **verbatim** — a visible gap, never a silent blank or `"undefined"`) and does **count-aware plurals**:
  `params.count` (a number) selects `key_one`/`key_other` by the CLDR cardinal rule for the **active
  language** (English: only 1 is `one`; Hindi & Gujarati and their Roman pair: **both 0 and 1** are `one`),
  falling back to the base key when no variant exists. **No string concatenation.**
- **Single-arg `t(key)` is byte-identical** to before (language → English → key), so all 74 existing keys
  and every current call site are unchanged, and the hard `EN_KEYS.length === 74` parity gate is untouched.
- **Gates green:** `npx tsc --noEmit` exit 0; `npm test` **350/350** (+20); `npm run lint` 0 errors/12 warnings.

## Files changed
- `src/i18n/index.tsx` — extended `t` to `t(key, params?)`; added three pure exported seams
  (`pluralCategory`, `interpolate`, `translate(lang, key, params?, lookup?)`); header doc updated. The
  `lookup` param is injected **only** so tests can pin plural/interpolation against a controlled dictionary
  without adding a real key.
- `src/i18n/__tests__/format.test.ts` — **new**, 20 cases pinning interpolation, per-language CLDR plurals,
  the composed `translate` (via injected lookup), and `translate` against the real shipped dictionaries.
- `docs/PHASES.md` — new `## Now` entry, Next-3 #3 rewritten (P0 done), status board row 21.
- `docs/DECISIONS.md` — top entry (per-language-plural rationale + the testability seam).
- `docs/i18n/SCOPE.md` — §3 P0 marked BUILT, §8 status updated.
- `CLAUDE.md` — i18n trap (1) refreshed: `t()` is now `t(key, params?)`.
- Commits (local only, push 403s): `a7a0979` (code+tests), `42985a2` (docs).

## Decisions made
- **Built P0 only, not P1 or any wiring.** P0 (`t()` extension) is the single part of the i18n widening
  buildable with **no** human copy, no backend, and no new dictionary keys. Wiring screens or translating
  copy needs the human-supplied Hinglish/Gujlish/Hindi/Gujarati (PHASE-19 §4 forbids machine translation).
- **Per-language plural rules, not English-only.** Rendering "0 kaam" with the English `_other` form is
  grammatically wrong in Hindi/Gujarati (they take the singular at 0). Category is computed from the display
  language — the standard i18next/CLDR behaviour, and the boring-correct one.
- **Unmatched placeholder left verbatim** (`{name}`), not dropped or rendered `"undefined"` — a visible bug
  is honest; a silent blank is the exact i18n failure mode this project polices elsewhere.
- **Injected `lookup` seam over adding demo keys.** Testing plural/interpolation end-to-end needs a
  dictionary with `_one`/`_other` and `{placeholder}` strings; adding those to the real dicts would bump the
  74-key parity count and demand copy in 4 languages. A defaulted `lookup` param (production callers never
  pass it) keeps the real dictionaries at 74 keys while pinning every branch.

## Known broken / deliberately skipped
- **No screen wired, no string translated.** This phase is the mechanism only. Next copy-free step is P1
  (the `common.*` dedup layer). Wiring a Tier-1 screen still waits on human copy.
- **Phase 16 self-view — still backend-blocked.** `routes/payroll.js:22-23` is still `authorize('admin')`;
  no `GET /api/payroll/my-earnings`; the narrowed self-earnings ask (INBOX ~line 3311–3356) has **no
  `cgpe-api` reply**. Do not build the earnings screen against a non-existent endpoint.
- **Phase 6 commissions — unchanged, still blocked** (no product aggregate / no `target`).
- **`git push` still 403s** — credential `reactjsaaziko` has no write access; both commits are **local
  only**. Needs a human to fix the credential (Windows Credential Manager) or grant access.
- **Device-verification backlog** — unchanged; still needs a handset.

## Next session starts here
- **Phase 21 P1 (i18n):** build the `common.*` dedup layer — wire the ~25 repeated labels ("Try again" ×~30,
  the ~8-variant outage body) to shared `common.*` keys once, per `docs/i18n/SCOPE.md` §4.1. Still **copy-free**
  (the `common.*` keys not already present need copy — check §4.1 against the current dict; only the *net-new*
  keys need translation). If instead a `cgpe-api` reply to the `my-earnings` ask has landed, build the Phase
  16 self-view per its preserved UI lock (do **not** point `payroll.tsx` at it — that's the admin roster).
- **First command:** `/boot`, then re-read `../contracts/INBOX.md` foot (~line 3356) for a `cgpe-api` reply
  before assuming Phase 16 is buildable.
- **Watch out for:** adding real keys (P1 or any wiring) **bumps** the parity test's hard
  `EN_KEYS.length === 74` — update it deliberately — and its leak check will **not** catch an English string
  left in a non-English dict, so a `common.*` key filled with English in `gu`/`hi` passes the suite green.
  Human copy is load-bearing.
