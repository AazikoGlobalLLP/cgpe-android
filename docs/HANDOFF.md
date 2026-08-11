# HANDOFF — CGPE Connect (Android) — session close (Phases 18 & 19 planned, no build) — 2026-08-11

No `src/` code was written this session. This was a **boot → re-verify the blockers → plan two new
phases** session, at the user's direction. The reason nothing shipped is simple and worth stating
plainly: **the only remaining feature work (salary, commissions) is waiting for the backend to
create the endpoints** — re-confirmed against `cgpe-api`'s real code this session, not trusted from a
tag. So instead of forcing a non-existent phase, the user asked to lay the path for a full test pass
and a language-toggle pass, and to queue those **ahead of** salary.

## Done
- **Re-verified both remaining blockers are real, against the sibling backend's actual code** (the
  discipline CLAUDE.md + memory demand — Phases 6/9/10/11/12 all had wrong `[api]` tags):
  - **Phase 6 commissions** — `../cgpe-backend-main/routes/commissions.js` is the whole surface.
    `GET /` returns raw owner-scoped rows; `/team-summary` is a per-member rollup for leaders/admins.
    **No product-level aggregate, no `target` field anywhere.** Still blocked. This also closes the
    board's one open editor thread ("re-check Phase 6 vs current backend" — INBOX line ~2341);
    re-checked against the live handler, answer unchanged.
  - **Phase 16 salary** — grep across all backend `models/` and `routes/` for
    `salary|wage|payroll|per_day|ctc|pay_rate|compensation` returns **only** the role name
    `payroll_staff` and the task department `payroll`. **No pay field exists.** Still blocked.
  - Newest contract entry is Backend Phase 18 (`/api/leaves`) — real leave data, but leaves ≠ pay,
    so it unblocks neither.
- **Planned two new phases and wrote their specs (the "path" the user asked for first):**
  - **Phase 18 — watchable, A-to-Z, worst-case end-to-end test pass** (`docs/spec/PHASE-18.md`).
  - **Phase 19 — language toggle: verify + harden all 5 languages incl. Hinglish/Gujlish**
    (`docs/spec/PHASE-19.md`).
- **Filed one consolidated INBOX ask to `cgpe-api`** making the two blocking endpoints explicit and
  durable (commissions product aggregate + a computed salary/earnings endpoint). Grep-verified
  present after writing.

## Files changed
- `docs/spec/PHASE-18.md` — **new.** Full path for the watchable E2E pass: Playwright driving the
  Expo **web** build in headed Chromium, video+trace, deterministic edge-case injection via network
  mocking, A-to-Z screen inventory, and an honest list of native-only surfaces web can't reach.
- `docs/spec/PHASE-19.md` — **new.** Full path for the 5-language verification: a dictionary-parity
  Vitest (buildable now, no device) as the durable core, plus a visual per-language pass riding the
  Phase 18 harness. Defines Hinglish (Hindi-in-Latin) / Gujlish (Gujarati-in-Latin) per the user.
- `docs/PHASES.md` — added Phase 18 + Phase 19 (status board rows + full sections); rewrote `## Now`
  and `## Next 3` to put testing ahead of salary; recorded the blockers as re-verified.
- `docs/DECISIONS.md` — appended this session's decisions (tool choice, ordering, reason).
- `docs/STATUS.md` — rewritten for a manager (no jargon).
- `../contracts/INBOX.md` — one new `→ cgpe-api` item (outside the ANDROID git repo).

## Decisions made
- **Reason for no build = waiting for the backend to create the endpoint.** Both remaining features
  (salary, commissions) need a backend endpoint that does not exist; re-verified in `cgpe-api`'s code
  this session. Not an app-side gap.
- **Test tooling (user pre-approved "whatever you use"): Playwright + Expo Web, headed.** It opens a
  real browser the user watches, records video+trace for replay, and — critically — lets us inject
  every worst-case response (`500/503/empty/malformed/timeout/401/403/huge list`) **deterministically
  and offline**, touching **zero production data**. Chosen over Maestro/emulator because it needs no
  Android SDK on this Windows box and makes edge-case injection trivial. Honest cost: **web cannot
  exercise haptics, the AsyncStorage clock key, background GPS, biometric lock, or the native
  WebView map** — those stay on the handset backlog; Phase 18 shrinks that backlog, it doesn't
  replace it.
- **Order: Phase 18 (test) → Phase 19 (language) → Phase 16 (salary) / Phase 6 (commissions).**
  Per the user's explicit sequence. 18 and 19 are largely buildable now (19's parity test needs
  nothing); 16 and 6 stay backend-blocked.
- **Phase 19 will not machine-translate missing strings.** A wrong Hinglish/Gujlish string is worse
  than an obvious English fallback; gaps are reported, not guessed.

## Known broken / deliberately skipped
- **Salary (Phase 16) & commissions (Phase 6) — backend-blocked.** Waiting for the backend to create
  the endpoints (a computed earnings endpoint + a pay-rate field; a commissions *product* aggregate
  with a `target` source). Filed to `cgpe-api` this session.
- **`git push` still 403s** — credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. Every local commit is unpushed. Needs a human.
- **Web build may not boot as-is** — Phase 18's first task is getting `expo start --web` to render
  login without a redbox (module-scope native imports like `@/lib/tracker` may need a web guard).
  This is a known risk, written into the spec, not a surprise.
- **Device-verification backlog** — unchanged; handset-only checks from Phases 1/4/5/6/7/9/10/12/13.
  Phase 18 covers the web-reachable subset; the native-only remainder still needs a phone.

## Next session starts here
- **Phase 18:** build the watchable end-to-end test harness — get the Expo web build to boot, stand
  up headed Playwright with video+trace, walk all 47 screens A-to-Z, then inject the worst-case edge
  states. Full path: `docs/spec/PHASE-18.md`.
- **First command:** `/boot` (then, when building: `npx expo start --web` to confirm the web build
  renders `/(auth)/login` before writing any Playwright test — this is Phase 18 step 1 and its main
  risk).
- **Watch out for:** the app may not run on web without a small `Platform.OS !== 'web'` guard around
  module-scope native registrations (`_layout.tsx:18` `import '@/lib/tracker'`, biometric/secure-store,
  the WebView map). Make the **minimum** guard, keep the three gates green, record each as a decision
  — do **not** rewrite screens to please web, and do **not** run the write/edge suite against
  production (`https://cgpe.in/internal/api`).
