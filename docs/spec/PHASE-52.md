# PHASE-52 — Break button + 8h30m gate + optional reason + orange break pins

**Owner batch 2026-08-17** (bundled into the map-toggle answer, 2026-08-18). Session `cgpe-mobile`.
Status: **COMPLETE 2026-08-18.** Owner supplied the 5-language copy → Break UI + client flow shipped
(`8da2fb8` data layer + i18n, `b1cea19` home UI). `cgpe-api` then shipped **Backend Phase 66** (commit
`6ef26f0`) — VERIFIED field-for-field against real code — so both backend pieces are done: (B1) the `reason`
is now **stored** (`breakSchema.reason`, echoed on `/break/start`); (B2) the **orange break pins** are wired
from the NEW master-gated `GET /break-locations` (`53ba448`). **Only remaining = OPS (a `:3001` restart on
the Phase-66 build) + an on-device visual pass.** Gates: `tsc` 0 · `npm test` **591** · eslint 0 new errors.

## Verified against real backend code (rule 5 — tags wrong 5×)

- `routes/timeTracker.js` **already** has `POST /break/start` (`:772`) and `POST /break/stop` (`:870`):
  both take `{lat,lng,accuracy,source,city,region,country,timezone}`, validate against
  `attendanceRules.geo` (null for everyone → passes), require `activeSessionId` (clocked in), reject a
  double start / stop-when-not-on-break, and record the location via `dayLog.startBreak/endBreak`.
  **Neither accepts a `reason` field** → **B1**.
- `GET /time-tracker/current` → `getClockState()` already returns `isOnBreak`, `currentSessionTime`
  (seconds, breaks deducted) and `since` (clock-in ISO). So the toggle state and the 8h30m gate are
  computable client-side today — no new read for the button itself.
- No map-facing read exposes per-member **break locations** → **B2** (ties to the off-duty ambient read).

## Locked decisions

| # | Decision | Locked value |
|---|----------|--------------|
| 1 | Buttons after clock-in | `home.tsx` shows **[Break] + [Clock out]**; while on break, **[End break] + [Clock out]**. Driven by `getClockState().isOnBreak`. |
| 2 | "8:30 hour" gate | Elapsed since clock-in (`now - since`) **≥ 8h30m = 30,600 s** → confirm sheet before starting break; **< 8h30m → no confirm, straight to reason**. 8.5h = the payroll office-hours number (grounded, not invented). |
| 3 | Confirm copy (needs human 5-lang) | "You've completed your 8h30m minimum. Take a break, or clock out?" → [Take break] / [Cancel]. |
| 4 | Reason | **Optional** text sheet before break starts; sent as `reason` in `/break/start`; **skippable**. |
| 5 | End break | Direct `/break/stop`; no reason, no confirm. |
| 6 | Clock-out while on break | End the break first (`stopBreak`), then `clockOut`. Device-verify. |
| 7 | Break pin colour | **Orange** on the map (needs B2 before it can render). |

## api.ts (to build once unblocked)

`startBreak(coords, reasonText?)` / `stopBreak(coords)` — POST `/time-tracker/break/start|stop`, same
honest write-path posture as `clockIn`/`clockOut` (never fabricate success; 403 `LOCATION_RESTRICTION`
= blocked; network/5xx = failure). `reason` sent additively (harmless until B1 persists it).

## Blockers

- **Copy:** ~9 visible strings (`break.start`, `break.end`, `break.reasonTitle`, `break.reasonPlaceholder`,
  `break.reasonSkip`, `break.minDoneTitle`, `break.minDoneBody`, `break.minDoneConfirm`, `common.cancel`
  if not present) in all 5 languages (en, gu, hi, hi-en, gu-en). Machine translation forbidden (PHASE-19 §4).
- **B1** `[api]`: `/break/start` accept + persist optional `reason`, expose on reads.
- **B2** `[api]`: per-member break-location read for the orange pins (verify DayLog break storage first).

## Acceptance (binary, once unblocked)

- [ ] After clock-in, home shows Break + Clock-out; on break shows End break + Clock-out.
- [ ] Break at ≥8h30m shows the confirm first; <8h30m does not.
- [ ] Reason sheet is skippable; a skipped break still starts.
- [ ] Break pins render orange once B2 ships.
- [ ] `tsc` 0 · `npm test` green · no new lint errors; 5-language parity test bumped deliberately.
