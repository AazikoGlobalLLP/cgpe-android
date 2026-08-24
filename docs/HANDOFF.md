# HANDOFF — CGPE Connect (Android) — A3 attendance present/absent fix — 2026-08-24

## Done
- **My attendance** history now renders present/absent correctly. On a healthy server the primary
  `/time-tracker/history` leg returns raw DayLog documents (clock times nested in `sessions[]`); the
  screen mapped the flat `clock_in.time` "attendance record" shape that only the `/attendance/history`
  fallback emits, so every day read `clock_in === undefined` and rendered "No clock-in recorded" with
  Days-logged / Closed-days both 0. A new pure adapter flattens DayLog → per-session canonical records,
  so real clock-in/out times, worked hours, and the closed/open/no-entry state now show per day.
- Verified against **deployed `origin/main`** (tip `49482e9`, Phase 87 now merged) that both endpoints
  return the shapes assumed — fix is 100% app-side, no backend change or deploy needed.

## Files changed
- `src/data/adapt.ts` — new pure `adaptAttendanceHistory()` (+ `AttendanceRecord` type): flattens a
  DayLog into one record per session (mirrors backend `dayLogToAttendanceRecords`), passes an
  already-canonical row through; defensive on non-arrays/junk. Nothing invented — a missing time stays missing.
- `src/data/api.ts` — `getAttendanceHistory` now runs BOTH legs through `adaptAttendanceHistory`; imported it.
- `src/data/__tests__/adapt.test.ts` — +6 cases pinning the flatten, open-session omit, drop-no-clockIn,
  canonical pass-through, legacy-flat tolerance, and non-array defence.

## Decisions made
- **Normalise in the api boundary, not the screen.** `attendance.tsx` was left untouched; the shape
  translation lives in `adapt.ts` (project convention: adapters are pure + tested) so api.ts always hands
  the screen one canonical shape regardless of which leg answered.
- **Keep `/time-tracker/history` as the primary leg** (don't swap to `/attendance/history`). The primary
  is the stable/deployed raw-daylog read; adapting it in-app avoids any dependency on backend deploy state.
- **One record per session** (multi-session days expand), matching the backend's authoritative
  `/attendance/history` behaviour; a daylog with zero clocked-in sessions yields nothing (same as backend).

## Known broken / deliberately skipped
- **Location string still blank per day** — neither real leg stores a human place name (DayLog sessions
  carry only lat/lng); the screen's `location` line was already empty and stays empty. Not invented.
- **Device-unverified.** JS-only ⇒ OTA-eligible, but no phone has run it. Needs the next APK (or an OTA
  push) with real daylog data to confirm on-device.
- Accumulated OTA work (B5, D3/B1/D4/C2/D6, Phases 77/78, E2 cause-naming, **A3**) still needs one APK to reach a phone.
- Reports remain OPS-blocked (prod render webhook env unset + n8n template) — not code, unchanged this session.

## Next session starts here
- Next backlog (owner's pick): **D5** (typo-tolerant client/ticket search — mixed `[m]+[api]`) — or **cut
  ONE APK** to land all accumulated OTA work (now including A3) on a device.
- First command: `/boot`
- Watch out for: **shape drift between the two attendance legs.** Any future change to `/time-tracker/history`
  (still raw DayLogs) or `/attendance/history` (canonical records via `dayLogToAttendanceRecords`) must keep
  `adaptAttendanceHistory` covering both — it's the only thing making the screen shape-agnostic.
