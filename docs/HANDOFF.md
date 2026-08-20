# HANDOFF — CGPE Connect (Android) — Phase 71 (≤60-min location heartbeat) built + pushed — 2026-08-20

Owner's #2 of the 70–73 batch is done. The background recorder no longer relies purely on the OS to
deliver points on time: the ~15-min reliability watchdog now **forces one location fix** whenever the
newest recorded point has gone stale, so a clocked-in member's route can't sit with a long flat gap
even under Doze / an OEM battery-kill (the "20 h / 8 km straight line" symptom). Committed and pushed
to the owner's `aaziko` repo.

## Done
- **A live shift now records a point at least about every 60 minutes, code-driven — not just "if the
  OS feels like it".** Previously every point was OS-delivery-driven and best-effort; under Doze the
  gap between points could stretch far past the requested ~60 s cadence. Now, each time the watchdog
  wakes (~15 min), if the newest recorded point is older than 45 min it takes one `getCurrentPosition`
  fix (High accuracy, so it survives the backend's >100 m shift-point drop) and posts it through the
  normal ingest path. On a fresh shift where the service somehow records nothing at all, the very
  first watchdog tick forces a point instead of leaving a hole.
- Gates green: `tsc` **0** · `npm test` **644** (was 635, +9 new) · eslint **0** on the touched files.
- Committed `612410f`; pushed to `aaziko/Shivam` (as merge `bdffdef` — see Decisions).

## Files changed
- `src/lib/staleBuffer.ts` — **NEW** pure helper: `isBufferStale(lastAtMs, nowMs, staleAfterMs?)` +
  `MAX_POINT_GAP_MS` (60 min), `WATCHDOG_INTERVAL_MS` (15 min), `STALE_AFTER_MS` (= 60 − 15 = 45 min).
  Zero native imports → unit-testable, exactly like `lib/watchdog.ts` / `lib/appLock.ts`. Fails toward
  "take a fix" on no-point-yet / corrupt / clock-skew.
- `src/lib/__tests__/staleBuffer.test.ts` — **NEW** (+9): threshold boundary, fresh-shift `lastAt=0`,
  negative/corrupt timestamp, custom threshold, and the ≤60 derivation + worst-case-gap guarantee.
- `src/lib/tracker.ts` — `captureForcedPoint()` (one `getCurrentPositionAsync(High)` → `ingest`) wrapped
  in a bounded `withTimeout` (30 s, so a cold-GPS fix can't hang the serial chain); `watchdogTick` now
  forces a fix when `isBufferStale(state.lastAt)`; `retire` early-returns (nothing to attribute to);
  `WATCHDOG_INTERVAL_MIN` is now derived from the shared ms constant so cadence and threshold can't drift.
- Commit `612410f` on `Shivam`, pushed (via merge `bdffdef`) to `aaziko/Shivam`.

## Decisions made
- **Threshold = ceiling − watchdog-interval = 45 min, NOT the handoff's rough "~55 min".** With a
  15-min watchdog, triggering at 55 would let a tick that saw 54 min do nothing and the next tick act
  at ~69 min — overshooting the owner's 60-min ceiling. 45 = 60 − 15 keeps the idealized worst-case gap
  at 60 min. Derived from the owner's real requirement, not invented.
- **Reuse `ingest`, don't hand-roll a post.** The forced point flows through the same de-dup, mock-drop,
  shift/ambient attribution and delivery as an OS-delivered point — one honest write path, no new
  attribution logic to get wrong. Adversarial review confirmed the "unattributable → teardown" branch
  is unreachable from the forced path (retire early-returns before it).
- **Honest ceiling, stated in code + commit:** WorkManager is itself Doze-deferred, so ≤60 min is a
  best-effort ceiling, not a hard real-time guarantee (that would need a native exact-alarm module the
  app lacks). Real gap = 60 min + fix-acquisition latency + any Doze slippage of the watchdog itself.
- **Push needed a merge, not a force.** `aaziko/Shivam` had a benign `Update README.md` commit ahead
  (added via the GitHub web UI). Merged it in (`bdffdef`, ort strategy, only README.md touched — my
  source files, the unrelated `.claude/settings.json` and the repo-root `.txt` files all untouched),
  then pushed. No rebase, no force, no discard — per the data-safety rule.

## Known broken / deliberately skipped
- **Not yet on any field phone.** Pure JS (OTA-eligible in isolation) but 72/73 both need a native
  rebuild, so — per the owner's standing "build the batch, then cut ONE APK" directive — no APK/OTA was
  cut this session. Device verification is owner-owed once the batch APK ships: confirm a stationary
  clocked-in phone gets points ≤~60 min apart (DB `point_count`/`last_point_at`), and that the "bg not
  running" report is the APK predating the native modules or needing a clock-out+in, not a code bug.
- **`src/lib/tracker.ts` still has ZERO test coverage** (no expo-location/task-manager stub). The new
  decision is tested only through the pure `staleBuffer.ts`; the wiring itself is device-only.
- **Phases 72 & 73 still need owner decisions** before a sane build (72 = in-app Tier A vs real-push
  Tier B; 73 = export-first vs auto-sync, which entities, undated=skip-or-all-day).

## Next session starts here
- Phase **72** — team-targeted notifications. First get the owner decision: **Tier A** (in-app bell
  only, no rebuild, small `[api]`) vs **Tier B** (real push — `expo-notifications` + FCM + a backend
  device-token store + infra). Do not build until that's chosen. (Phase 73 and the un-built Phase 65
  full-staff roster also await.)
- First command: `/boot`
- Watch out for: **`git push aaziko Shivam` can reject** if the remote is ahead (someone edits it via
  the web UI) — fetch, inspect the divergence, and **merge** (never force/rebase/reset); this session it
  was a one-file README commit. And when you DO build 72/73, remember the batch-APK directive — one
  final APK, not a per-phase one.
