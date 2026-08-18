# HANDOFF — CGPE Connect (Android) — Phases 51 & 52 SHIPPED + Phases 53–58 SCOPED — 2026-08-18

Two features shipped end-to-end (map toggles + the Break feature, incl. consuming backend Phase 66), a **v1.10.0 APK**
was cut, and a new **7-item owner issue batch** was investigated against the real code and turned into grounded
Phases 53–58. Owner priorities for next: **tasks (#1)** and **iOS (mandatory)**.

## Done
- **Phase 51 — map upgrades (commit `8eb4858`).** Both maps now have a top-right control stack: a **satellite** toggle
  (Esri World Imagery + Esri labels, hybrid, no API key), a **show/hide points** toggle (hides markers; route line +
  arrows stay), and the fit button. Pins are event-coloured: clock-in **green**, clock-out **red**; legend matches.
  State survives a theme flip. JS-only.
- **Phase 52 — Break feature (commits `8da2fb8`, `b1cea19`, `53ba448`).** After clock-in, Home shows **Break + Clock
  out** (End break while on break). Break at ≥8h30m worked asks a confirm first; under it, an **optional-reason** sheet.
  Clocking out while on break **ends the break first** (else the in-progress break is silently dropped). All break text
  in **5 languages** (owner copy). Consumed **backend Phase 66** (verified field-for-field): the `reason` is now stored,
  and **orange break pins** are drawn on the master map from the new `GET /break-locations` (green/orange/red legend).
- **v1.10.0 APK cut** (EAS build `0c648a0c`) bundling Phases 51+52 on the same native base as v1.9.0 (all JS-only).
  Direct APK: `https://expo.dev/artifacts/eas/ls-3QFiTrj-GuDt-6ot-Q7dQOuYkDcMLlt2InWDuf0s.apk`. Device checklist:
  `docs/spec/PHASE-51-52-DEVICE-CHECK.md`.
- **7-item owner issue batch investigated + scoped into Phases 53–58** (all verified against real code, file:line cited;
  full spec `docs/spec/ISSUES-2026-08-18.md`). Two backend `[api]` asks filed (lead-scope, ticket→team_tasks mirror).

## Files changed
- `src/ui/LeafletMap.tsx` — satellite/labels tile layers + `__cgpeTiles`/`__cgpePoints` bridges + `breaks` prop → orange markers.
- `src/app/agent-map.tsx` — 3-colour legend; fetches `getBreakLocations()` and passes break points to the map.
- `src/data/api.ts` — `startBreak`/`stopBreak`; `getBreakLocations()` (403-for-others = quiet empty, never fabricates).
- `src/app/(tabs)/home.tsx` — Break/End-break + Clock-out buttons, 8h30m `useConfirm` gate, optional-reason `Sheet`, clock-out-ends-break-first.
- `src/i18n/index.tsx` + `__tests__/dictionaries.test.ts` — 9 `break.*` keys × 5 langs (parity 94→103).
- `src/data/__tests__/api-break.test.ts` — NEW, startBreak/stopBreak/getBreakLocations (591 total).
- `app.json` — version 1.9.0 → 1.10.0.
- `docs/` — PHASE-51/52 specs, PHASE-51-52-DEVICE-CHECK, ISSUES-2026-08-18, PHASES board, DECISIONS.
- `contracts/INBOX.md` (untracked) — 2 new `[api]` asks (lead-scope, ticket-mirror) + Phase-66 verify reply.

## Decisions made
- **Satellite = Esri hybrid, not Apple/Google** (paid SDK/keys) — honest ceiling set to the owner.
- **Break 8h30m gate = `MIN_SHIFT_MS`** (the payroll office-hours figure, not invented); reason optional + sent
  additively; clock-out ends the break first because `DayLog.clockOut` discards an in-progress break otherwise.
- **Verify the code, not the tick** — the owner's "backend done" first pointed at Phase 65 (gap-detector, NOT break);
  only a re-check found Phase 66 (break) actually shipped.
- **Scope the 7 new issues from real code before writing rows** (workflow) — so each is grounded, not guessed.
- **createdAt/updatedAt "" is NOT a create-path bug** — the app already stamps real ISO + omits timestamps on POST; the
  only `''` are read-path sub-field fallbacks. Needs an owner repro, not a code change.

## Known broken / deliberately skipped
- **Orange break pins go live only after the backend `:3001` restart** on the Phase-66 build (ops, owner to confirm).
- **Phases 53–58 are SCOPED, not built** — this session investigated + defined them; next session executes.
- **iOS (Phase 56) is blocked on an Apple Developer account ($99/yr)** — a hard external prereq before any iOS build.
- **iOS 24/7 background location cannot match Android** (no foreground service; BGTaskScheduler is opportunistic) — the
  honest limit; everything else on iOS is first-class.
- **`git push` still 403s** — every commit (`8eb4858`…`0a391fc`) is local only. Needs a human to fix the credential.

## Next session starts here
- **Phase 53 (owner #1): Task mismatch.** Build the mobile half now (stop bucketing undated tasks by `updated_at` in
  `adaptTeamTask` `api.ts:306`; stabilise the "today" denominator in `tasks.tsx:214` + `home.tsx:1107`), and relay the
  filed `[api]` (mirror ticket-assign → `team_tasks`). Then Phase 54 (lead-open `[api]`, mobile zero-change) + Phase 55
  (network resilience, mobile-only). **Ask the owner about the Apple Developer account for iOS (Phase 56).**
- **First command:** `/boot`
- **Watch out for:** the **leader-tier trap** — `tierOf()` folds `leader` into admin client-side, but the backend gates
  on the real `Profile.role` and `leader ∉ {admin,super_admin}`; that is the exact cause of the lead-open 403, and any
  admin-gated surface can 403 a leader. And **never fabricate a server timestamp** for Phase 58.
