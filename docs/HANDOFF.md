# HANDOFF — CGPE Connect (Android) — Phases 64/66/67 `[m]` built + Backend Phase 69 deploy VERIFIED LIVE — 2026-08-19

The 2026-08-19 owner batch is now **mobile-complete for every buildable phase (63/64/66/67)**, each adversarially reviewed,
and — the big change this session — **the backend deploy gap is CLOSED and verified live on prod.** The only thing standing
between the owner and testing everything is **cutting the ONE final APK** (their standing directive: build all of 63–69
first, then one combined APK).

## Done
- **The deploy gap is resolved (verified, not assumed).** `origin/main` is now `2531817` and contains Phase 69 (`f0eac8e`);
  live prod probes confirm it is DEPLOYED: `GET /time-tracker/last-location` and `/team/task-report` now return **401**
  (route present, auth required) where they returned **404** before, and `/health` is 200. So all of Phases 41–69 run on
  `:3001` now — the "server did not answer / 0 on duty / straight-line GPS" symptoms were the deploy gap and are cleared
  server-side.
- **Backend Phase 69's 5 `[api]` fixes VERIFIED code-correct** (6 investigators, file:line): shift accuracy `<=1000m`;
  `dayLogToAttendanceRecords` folds clock-in coords (the 0/0 fix); `/live-locations` super_admin gate + ObjectId fix; new
  `GET /last-location`; payroll `hourly_rate` + `days/sundays/holidays`.
- **Mobile built + reviewed this session (all local, push 403s):**
  - **Phase 64** — `getBreakLocations` treats 404/501 as a quiet answer (no false "server did not answer" banner). `3d5c4f8`.
  - **Phase 67** — NEW `payroll-detail` screen: tap a roster member → pay breakdown (rendered verbatim, never multiplied) +
    master-only completed-tasks activity. `2d18eb5`.
  - **Phase 66** — master "Live location" (last-known) on `team/[id]`: honest readout (freshness, real duty, accuracy,
    copyable coords), NOT the misleading clock-in map pin. `46a1dee`.
- Gates on the final tree: `tsc` 0 · `npm test` **625** · eslint 0 new.

## Files changed (this session)
- `src/data/api.ts` — `getBreakLocations` 404-hardening; NEW `getLastLocation`/`mapLastLocation` (three-outcome, rejects the
  (0,0) no-fix); `PayrollMonth` gained additive `hourly_rate`/`days`/`sundays`/`holidays`.
- `src/app/payroll-detail.tsx` — NEW per-member pay breakdown + activity screen.
- `src/app/payroll.tsx` — roster rows tap through to `payroll-detail`.
- `src/app/team/[id].tsx` — master-only "Live location" card + Sheet with the honest last-known readout.
- `src/data/__tests__/{api-break,api-payroll,api-lastlocation}.test.ts` — +3/+3/+13 wire-contract tests.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md` — status.

## Decisions made
- **Verify deployment, not just "pushed".** "Backend pushed" was verified to mean, this time, merged-to-`origin/main` AND
  deployed AND answering live (401 probes) — the full chain, not just a push. This is how to confirm the gap is truly closed.
- **Phase 66 shows an honest readout, not a map pin.** The review found reusing `LeafletMap`'s `AgentPin` (a clock-in
  concept) mislabels an off-duty point green "Clocked in" and drops a (0,0) fix while the labels assert a location. So no
  map pin; a neutral single-pin map is a scoped follow-up (LeafletMap is a danger zone agent-map depends on).
- **Phase 67 failed-activity ≠ "no tasks".** The review caught a failed task-report rendering as a confident empty; fixed
  with a distinct `ActivityState` error branch (mirrors `performance.tsx`).

## Known broken / deliberately skipped
- **No APK cut yet** — owner directive is ONE final APK after the whole 63–69 batch. Phases 63/64/66/67 are app-side code and
  need that build to reach the device (the installed v1.10.0 predates them). **This is the next action.**
- **Phase 65 mobile wiring not built** — "every member appears in agent-locations" needs the app's roster pointed at the now-
  live `/live-locations` (full-staff left-join). The `[api]` half is deployed; the `[m]` half is the one remaining mobile
  build in this batch. A never-assigned member is still invisible until that lands.
- **`git push` still 403s** — every commit (`3d5c4f8`, `2d18eb5`, `46a1dee`) is local only.
- **Device pass outstanding** for the whole batch — happens on the combined APK.

## Next session starts here
- **Cut the ONE final APK** (owner directive), then hand over one combined device-test checklist for 63/64/66/67 + confirm
  asks 1/2/3 now work live (On-duty pins populate, GPS route fills in, payroll detail + Live-location resolve).
- **First command:** `npx eas-cli build -p android --profile preview --non-interactive` (then the direct `.apk` URL via
  `npx eas-cli build:view <buildId> --json` → `.artifacts.applicationArchiveUrl`). Background it (~15–20 min).
- **Watch out for:** decide up front whether to build **Phase 65 mobile** (full-staff roster) BEFORE the final APK — the
  owner asked for "every member visible", and only that `[m]` piece is unbuilt; if it goes in this APK it saves a second build.
