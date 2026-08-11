# HANDOFF — CGPE Connect (Android) — Phase 19 BUILT (language toggle: verified + hardened) — 2026-08-11

Phase 19 is built and green. The five-language toggle (English, ગુજરાતી, हिन्दी, **Hinglish**,
**Roman Gujarati/Gujlish**) now has a **permanent regression gate** for dictionary completeness, and
a **per-language visual walk** on the Phase 18 harness that drives the real toggle and screenshots
every screen in every language for a human naturalness/layout review. No dictionary was edited — the
five shipped dictionaries were already complete; this phase **proves** that and makes it stay true.

## Done
- **Dictionary parity is now a gate (`npm test`).** A new Vitest asserts all 5 dictionaries expose the
  exact same 74-key set with **no blank, missing, or key-identical value**. It passes today: the
  shipped dictionaries are already at full parity — no holes, no raw keys. This is the durable core
  and the honest "buildable at a desk" half (DONE-1). `npm test` is now **323/323** (was 305).
- **Every screen renders in every language, with no raw key leaking (DONE-2).** A new Playwright spec
  drives the **real Settings toggle** into each of the 5 languages, confirms the switch takes effect
  **live** and **survives a reload** (DONE-3, web slice), then deep-links all 42 web-reachable screens
  and screenshots each into `e2e/artifacts/screens/languages/<code>/`. Result: **42/42 render in all
  five languages, 0 raw key leaks anywhere.**
- **Screenshots are now legible.** Fixed the Phase-18-flagged "pixel-clean screenshots" issue: the
  walk waits for the animated Splash overlay to dismiss before the shot, so the per-language stills (and
  the key-leak scan) show the real screen, not the logo. The user can now review `languages/hi-en/` and
  `languages/gu-en/` for naturalness (DONE-4) and `languages/*` for layout (DONE-5).
- **Gates green:** `npx tsc --noEmit` exit 0; `npm test` **323/323** (15 files, +18); `npm run lint`
  **0 errors / 12 warnings** (Phase-15 baseline, unchanged).

## Files changed
- **`src/i18n/index.tsx`** — one line: `export const DICT` (was private), so the parity test can reach
  the five dictionaries. Nothing under `src/app` imports it; screens still read strings via `t()`.
- **`src/i18n/__tests__/dictionaries.test.ts`** — new, 18 cases. The parity + value-quality gate.
- **`e2e/tests/50-languages.spec.ts`** — new. One test per language: drive toggle → assert live +
  persisted → walk 42 screens → screenshot per language → assert no key leak.
- **`e2e/helpers/render.ts`** — `assertRenders` gains opt-in `{ settleSplash }` (default **off**, so
  the other 3 specs are behaviourally unchanged) that waits out the Splash before body-read + shot.
- **`e2e/helpers/teardown.ts`, `e2e/README.md`, `e2e/WEB-LIMITS.md`** — document the language walk, the
  74-key coverage reality, and the real-cold-start persistence handset caveat.
- **Docs:** this file, `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md`.
- Commits: `433250c` (parity-test core), `2c599c5` (visual half). Both **local** — push still 403s.

## Decisions made
- **Ship the parity test first, as its own green thing.** It depends on nothing and is a permanent
  gate; the visual half rides Phase 18. Two commits, two units (spec §5 sequencing).
- **Drive the real toggle, don't hand-seed the language key.** Clicking the Settings row exercises the
  actual write + `refreshI18nUser` live-update + reboot-read — which *is* DONE-3 — and mirrors how
  `session.ts` signs in via the form. Selected by the row's **English label** (rows are always English)
  and confirmed by the `settings.language` heading, the one string distinct in all five languages.
- **No dictionary was edited and nothing was machine-translated.** The parity test passed as-is; per
  spec §4 a missing string would be a *finding to report*, never a gap to fill with a guess.
- **`settleSplash` is opt-in, not a global change to `assertRenders`.** Keeps the other three specs
  byte-identical in behaviour; only the language walk needs the real screen for its screenshots + scan.

## Known broken / deliberately skipped
- **Only the 74 keys wired to `t()` change with the toggle.** Large parts of many screens (e.g. the
  Settings body rows — "Biometric unlock", "Push notifications" — most screen chrome) are **hardcoded
  English** and stay English in every language. This is the *current app*, not a toggle bug. Widening
  `t()` coverage is separate, larger work; it is **not** what Phase 19 scoped ("verify + harden the
  existing toggle"). Visible in `languages/*/settings.png`. Flag for the user to decide if they want it.
- **Naturalness of Hinglish/Gujlish (DONE-4) is a human call** — the screenshots exist; a machine must
  not (and by spec does not) fail the build on a transliteration guess. Awaiting the user's eyes.
- **Real cold-start persistence (DONE-3 tail)** — a web `page.reload()` is a fresh boot from the same
  localStorage, not the OS killing the process on a SecureStore handset. Carried to the device backlog
  (`e2e/WEB-LIMITS.md`), like the clock-key check.
- **Salary (Phase 16) & commissions (Phase 6) — still backend-blocked** (unchanged): waiting for the
  backend pay field + computed earnings endpoint and the commissions product aggregate.
- **`git push` still 403s** — credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. Both commits this session are local. Needs a human.

## Next session starts here
- **Phase 16 — "My earnings" salary + Phase 6 commissions — both backend-blocked.** Nothing app-side
  until the backend creates the endpoints (re-verified real against `cgpe-api`'s code this week; filed
  to INBOX). Deriving money on-device stays rejected. If still blocked, the next buildable item is the
  **device-verification backlog** (handset-only acceptance from Phases 1/4/5/6/7/9/10/12/13) — or, if
  the user wants it, **widening `t()` coverage** so more of the app actually translates (scoped from
  what the language screenshots show is still English).
- **First command:** `/boot`, then (optional) `npm run e2e -- -g "Hinglish"` to re-watch one language,
  or open `e2e/artifacts/screens/languages/` to review the per-language stills.
- **Watch out for:** the language walk is ~3 min/language (~15 min for all five) because of the
  Splash-settle wait — run **one language at a time** with `-g "<Language>"` while iterating, not the
  full matrix each time. And remember only `t()`-wired strings change: judge coverage from the
  screenshots, not from the toggle "working."
