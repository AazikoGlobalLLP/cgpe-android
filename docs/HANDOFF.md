# HANDOFF — CGPE Connect (Android) — Band 2 #9 (Contest mapper) + backlog Point 13 (Payroll) — 2026-08-25

## Done
- **A real contest now renders instead of a blank card.** `GET /api/contests` returns raw contest
  documents whose field names don't match the app's `Contest` shape, so the screen was mapping every
  field to `undefined` — blank name, no reward, a 0% meter, no metric, no countdown, no rank. A new
  adapter maps the real shape, so a live contest shows its name, reward, the user's own progress
  toward the goal, a metric line, a days-left countdown, and the user's rank **only** when they're in
  the leaderboard (never a guessed `#0`). This was a latent bug — it never bit only because no live
  contest has been created yet.
- **A new, verified worklist row (Point 13) was added** explaining why Payroll shows only one member
  and how to fix it — investigated against the real backend, no code shipped for it this session.
- Gates on the final state: `tsc` 0 · `npm test` **910** (+8) · `eslint` 0 new errors. Contest fix is
  device-unverified (OTA-eligible, pure JS). Both commits pushed to `aaziko Shivam`.

## Files changed
- `src/data/adapt.ts` — NEW pure `adaptContest(raw, userId?)`: maps the backend contest doc
  (`title`/`reward_description`/`target_goal`/`target_unit`/`end_date` + per-caller `user_progress`
  + top-5 `leaderboard`) → the app `Contest`; progress = clamp01(user_progress/target_goal), rank
  only from the user's own leaderboard row.
- `src/data/api.ts` — `getContests` now maps each wire row through `adaptContest(r, currentUserId)`
  and keeps the `unavailable()` outage fallback (was reading raw rows as `Contest[]`).
- `src/data/__tests__/adapt.test.ts` — +8 `adaptContest` cases (field mapping, clamp, zero-target
  guard, rank-from-own-row, rank-omitted, unit default, null-row safety).
- `docs/spec/BAND2-9-contest-mapper.md` — NEW decision/spec record.
- `docs/OWNER-BACKLOG-2026-08-24.md` — NEW Point 13 (payroll): master-table row + deep section.

## Decisions made
- **Contest `rank` is shown only when the signed-in user appears in the (top-5) leaderboard** — never
  inferred from a progress tie. An absent rank is honest silence, not a fabricated `#0`.
- **Contest `metric` label = "`<progress>` of `<target>` `<unit>`"** (unit defaults to `points`); a
  zero/missing target yields progress 0, never a NaN/Infinity meter.
- **Point 13 is triage-only this session** (owner asked to *describe* it, not build it). The row records
  that "only Pavitra shows" is a **data-seeding gap** (only one `payroll_profiles` row exists), plus a
  product decision the owner is now making (put bank/essential PII on the phone), not a compute bug.

## Known broken / deliberately skipped
- **Point 13 (Payroll) is not built** — deliberately. It needs an owner decision (show bank/Aadhaar/PAN
  on a field phone? which role? masked?) and an owner/OPS data job (create payroll profiles for the rest
  of the team). No code makes a profile-less member show pay.
- Contest fix is **device-unverified** — no live contest exists to see it render on a phone (OTA-eligible).
- Pre-existing, untouched: `api.ts:912`/`:1338` two unused-var lint **warnings** (not introduced here);
  the 4 non-English `emptyCalendarBody` copies still say "strip" (owe one human line each).

## Next session starts here
- Phase: **Band 2 #8 — wire the 10 inert role toggles** (P1, but needs the owner's Point 6 role matrix
  first) **OR the Claims document picker** (P1, NOT OTA — `expo-document-picker` is native → a new APK,
  plus the OPS Spaces env). **OR, if the owner has decided on Point 13**, build the payroll roster merge +
  "data pending" warnings + bank/essential-details panel (OTA). Every self-contained OTA Band-2 item is
  now shipped, so the remaining client work depends on an owner decision or a native build.
- First command: `/boot`
- Watch out for: **Point 13's bank/essential-details half reverses the standing "NO PII ON THE PHONE"
  rule** (`payroll.tsx:29-31`). Do not put Aadhaar/PAN/account numbers on the phone until the owner has
  explicitly chosen the role + masking — recommend master-only + last-4 masked, Aadhaar/PAN off entirely.
