# HANDOFF — CGPE Connect (Android) — Phase 63 `[m]` built + adversarially reviewed — 2026-08-19

Owner #1 (background location, the "Pavitra" 20h/8km-straight case) had its **mobile half built, reviewed by a 4-lens
adversarial workflow, hardened against the regressions that review found, and committed.** The owner set a clear
process directive for this whole batch: **finish ALL of Phases 63–69 editor-side first, then cut ONE final APK and test
everything together in a single pass — no per-phase APK builds.**

## Done
- **Background route recording now captures a point every ~60 s even when the phone is stationary, at ~10 m accuracy**
  (was: nothing recorded while still, and ~100 m fixes silently dropped by the server). Concretely, in `src/lib/motion.ts`
  the clocked-in profile is `distanceInterval 0` + `accuracy 'high'`, and the "sparse when still" 5-min economy is
  neutralised and test-locked.
- **Off-duty (24/7 ambient) recording stays coarse** — a distinct `AMBIENT_PROFILE` (Balanced + distance-gated) so the
  fix did NOT accidentally turn on continuous 10 m recording of an off-duty user's home (privacy + battery). This was a
  real regression the first commit introduced; the review caught it and it's fixed + pinned by a test.
- **iOS is guarded** against a `distanceInterval:0` firehose; **the `'high'→Accuracy.High` crux** is a tsc-enforced map
  (a typo can't silently revert the fix); **offline buffer raised** `MAX_POINTS 240→720` (~12 h) to offset the faster
  cadence. Gates: `tsc` 0 · `npm test` **606** (+2) · eslint 0 new.

## Files changed
- `src/lib/motion.ts` — SHIFT `MOVING`/`STILL` profiles → `distanceInterval 0` + `accuracy 'high'`; STILL neutralised to
  equal MOVING; NEW `AMBIENT_PROFILE` (coarse off-duty) + `'high'` in the accuracy type; honest comment reconciliation.
- `src/lib/tracker.ts` — `startService` picks shift-vs-ambient profile by `sid`; iOS distanceInterval guard; `accuracyOf`
  → `Record<accuracy, Accuracy>` map; `MAX_POINTS 240→720`; `isAndroid` flag.
- `src/lib/__tests__/motion.test.ts` — new profiles pinned + owner-#1 shift guard + `AMBIENT_PROFILE` invariant (606).
- `src/data/api.ts` — comment only: fixed the stale backend line ref for the accuracy filter (`1350`→`1671`).
- `docs/PHASES.md`, `docs/DECISIONS.md` — Phase 63 status + two decision entries.

## Decisions made
- **SHIFT captures every point; OFF-DUTY does not.** The aggressive High/60s/distanceInterval-0 profile is scoped to the
  clocked-in shift (owner #1). The 24/7 ambient path keeps a separate coarser profile — off-duty battery/privacy economy
  lives in `AMBIENT_PROFILE`, not in a STILL re-tune (the shift guard forbids that). Reason: `startService` is shared, so
  without the split the fix would have upgraded off-duty home tracking to continuous 10 m.
- **Review before "done".** Ran a 4-lens adversarial workflow on the first commit; it found the ambient regression, an
  iOS firehose, an untested crux line, and a 5× buffer shrink — all fixed in the follow-up commit. This is why there are
  two commits, not one.
- **No APK this session (owner directive).** Cut ONE final APK after all of 63–69 are complete, then test together.

## Known broken / deliberately skipped
- **Not a complete fix on these commits alone** — `High` is a *target*, not a guarantee. Indoors / weak signal, fixes can
  still report `>100 m` and are **still dropped** by the server until the filed **`[api]` relax** of the `>100 m`
  shift-point drop (`timeTracker.js:1671`) lands on deployed `origin/main`. Do NOT tell the owner it's fixed pre-`[api]`.
- **The straight-line / "8 km" symptom is primarily OPS** (the background service wasn't running most of the day — old
  APK predating the Phase-41 native modules, or OEM battery-kill). This JS change does not address that; the final APK +
  battery/auto-start settings + a DB session check do.
- **Device test needs a clock out+in (or reinstall)** — the profile only applies at service (re)start; testing on an
  already-open shift shows the OLD behaviour.
- **`git push` still 403s** — every commit (`9033e88`, `26d011d`, `9cbb372`) is local only.
- **Phases 64–69 not started.** The 41c motion classifier now runs for no behavioural effect (accepted minor overhead);
  a >12 h continuous-offline shift still evicts oldest (needs upload chunking); iOS bg tuning is Phase 56.

## Next session starts here
- **Phase 64 (+65): the master Monitor "on duty 0 / live field status 0" + map banner.** Relay the `[api]` coordinate-
  surfacing fix (`attendance.js dayLogToAttendanceRecords` drops `clockInLoc` — a real backend bug a restart won't fix)
  and harden `getBreakLocations` to treat a 404 as a quiet answer. **First, chase the owner on the deploy gap** — it
  clears Phases 68/69 for free. Keep building 63–69 editor-side; **do NOT cut an APK until the whole batch is done.**
- **First command:** `/boot`
- **Watch out for:** the **deploy gap** — do NOT re-diagnose "shipped" backend features (ticket-mirror, perf, break pins,
  the `>100 m` relax when it lands) as app bugs; verify a feature is **live on deployed `origin/main`**, not just present
  in the repo, before calling it done.
