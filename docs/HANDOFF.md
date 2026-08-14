# HANDOFF — CGPE Connect (Android) — Phase 41a-iii-b — 2026-08-14

Two things this session: **built** the editor-verifiable half (part 1, the consent **boot gate**) and
**wrote the device execution plan** for the rest (part 2, the `tracker.ts` pieces) after confirming part 2
needs a native build + a handset, not an editor. First it re-checked the backend and found the old blocker
gone.

## Done
- A signed-in user who has **not** granted 24/7-location consent is now redirected to the mandatory
  `/consent` notice on cold start — the gate that makes `/consent` non-negotiable. It is **fail-open** (a
  config outage / pre-Phase-43 backend / dead network leaves everyone on their normal Home, never trapped),
  **fires once per session** (can't loop), and is **native-only**.
- Backend re-verified LIVE: `909b117` (backend Phases 43-46 — consent + ambient + retention) is committed and
  serving on `:3001` (cgpe-admin INBOX re-verify). The prior "uncommitted / not restarted" hard-block is gone.
- A decision-complete **device execution plan for part 2** exists (`docs/spec/PHASE-41.md` §12) so the handset
  session is execution, not design.

## Files changed
- `src/data/api.ts` — NEW pure `needsConsentGate(read)` beside `getLocationConsent`; the gate's fail-open
  decision, isolated so its one safety property is unit-tested rather than buried in an effect.
- `src/app/_layout.tsx` — NEW headless `ConsentGate` + its mount in `RootNav`; redirects a not-yet-consented
  signed-in user to `/consent` (`as Href`, once-per-session ref guard, native-only, no `let alive` guard).
- `src/data/__tests__/api-consent-read.test.ts` — +3 cases pinning `needsConsentGate` (incl. `error→false`,
  the fail-open invariant).
- `docs/spec/PHASE-41.md` — §8 split into part 1 (built) / part 2 (device); NEW §12 device execution plan.
- `docs/PHASES.md` · `docs/DECISIONS.md` · `docs/STATUS.md` — this phase.

## Decisions made
- **Split 41a-iii-b into part 1 (redirect, editor-verifiable, built) and part 2 (`tracker.ts`, device).** Same
  testable-slice split every prior 41a step used; the redirect gates green, the recorder does not.
- **Extracted the gate decision as a pure predicate** — a one-liner that, if its `error` branch were wrong,
  would trap every staff member behind the wall; that earns a pinned test.
- **No `let alive` guard in `ConsentGate`** — it's process-lifetime like `AppLock` and does no setState, only
  a one-shot `router.replace`; an `alive` flag would swallow the redirect under StrictMode's dev double-mount.
- **Part 2 architecture LOCKED: ONE unified 24/7 recorder** (not two tasks) with per-batch attribution —
  `sid` present ⇒ shift `/track/points`, absent ⇒ ambient `postAmbientPoints` (`off_duty`); degrades to
  today's shift-only behaviour when un-consented, so it can't regress a non-consenting user. Full spec: §12.

## Known broken / deliberately skipped
- **41a-iii-b part 2 is UNBUILT** — because it needs `expo-intent-launcher` (not installed),
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` in `app.json` (absent), a fresh EAS build, and a handset, and
  `tracker.ts` has no test stub. It is designed (§12) but not editor-buildable. No longer backend-gated.
- **Part 1's on-device UX is unverified** — no test stub reaches boot navigation, so "no Home
  flash-then-bounce / no loop / survives restored-route cold start" needs a handset.
- **`git push` still 403s** — commits `73de551` + `600628f` are local only (human-owned credential swap).

## Next session starts here
- Phase 41a-iii-b part 2: build + wire the `tracker.ts` 24/7 recorder on a real device, following the locked
  plan in `docs/spec/PHASE-41.md` §12 (unified recorder + battery-opt step + persisted-i18n notification), and
  fold in part 1's on-device UX check.
- First command: `/boot`
- Watch out for: `tracker.ts` is the danger zone — it "looks fine in foreground, breaks only after a process
  kill," so verify AFTER swiping the app away, and measure battery over a real day on 3+ handsets (the §3/§12.7
  hard acceptance gate). It's a build-and-device session — you cannot verify any of it from the editor.
