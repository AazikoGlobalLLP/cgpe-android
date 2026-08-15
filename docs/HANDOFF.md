# HANDOFF — CGPE Connect (Android) — Phase 45 — 2026-08-15

Phase 45 (completed-tasks report + performance score) went **filed → backend-shipped → verified → built**, all in
one session. Filed the owner-locked score spec to `cgpe-api`; they shipped `GET /api/team/task-report` the same day
(Backend Phase 53); verified it line-by-line against the locked rules (matches exactly); confirmed the one open
point (month basis = due-month) with the owner; then built both the data reader and the on-device screens. Same
verify-first discipline as Phases 38/43/44 — but this one WAS a genuine gap, so it got built rather than closed as
already-satisfied. **Everything below is editor-green; the two screens carry a device check.**

## Done
- **The staff performance score exists end to end.** Each member has a **My performance** screen (More → Personal)
  showing their own monthly score (0–100), a completed/on-time/late breakdown, and their completed tasks. The
  **owner** has a **Team performance** screen (More → Master control) showing the whole team ranked by score,
  tap-to-expand per member. It is locked to the real `super_admin` role — a manager or team member cannot see other
  people's scores (a wrong-role deep-link shows "Owner access only", never the roster).
- The score is **computed server-side** to your locked rules (only manager-assigned + actually-completed tasks;
  importance × timeliness; cancelled/reminders/self-created excluded; per due-month). The app **renders, never
  recomputes** — "no tasks" shows a dash, never a fabricated 0%.
- Verified cgpe-api's real code matches the spec exactly; recorded mobile's verification in the shared inbox.

## Files changed
- `src/data/api.ts` — NEW `getTaskReport(month,{scope,userId})` + pure `mapTaskReport`; two-outcome `req()` posture
  (403 = quiet answer, outage = banner); server owns every count/score; `score:null` distinct from `0`.
- `src/app/performance.tsx` — NEW. One screen, two views by `?view=` param: self (ungated, `scope:own`) + team
  (master-only, `scope:all`). Score hero + Meter + KPIs + completed-tasks list; ranked roster with expand.
- `src/store/roles.ts` — NEW pure `canSeeTeamPerformance(user)` (real `super_admin`, never the folded tier).
- `src/app/(tabs)/more.tsx` — two tiles: master-only "Team performance" + ungated "My performance".
- `src/data/__tests__/api-task-report.test.ts` — NEW (16). `src/store/__tests__/roles.test.ts` — +4 (the new gate).
- `contracts/INBOX.md` — filed the Phase-45 `[api]` ask + recorded mobile's verification (durable, grepped back).
- `docs/spec/PHASE-45.md` (NEW), `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md` — the phase record.

## Decisions made
- **Visibility owner-locked (AskUserQuestion, 2026-08-15): each member sees their OWN score; only `super_admin`
  sees the whole team.** So: self view ungated (server self-scopes), team view gated on the REAL role — never the
  folded tier, or performance data leaks to every admin/leader (the Phase-40 rule).
- **Month basis = due-month** (owner-confirmed) — a task counts in the month it was due, which is what cgpe-api
  shipped. No completion-month switch needed.
- **Score weights were NOT invented** — importance (P1:3/P2:2/P3:1) × timeliness (on-time ×1 / late ×0.5), monthly,
  `100 × earned/possible`, null when no tasks — all locked with the owner before filing.

## Known broken / deliberately skipped
- **Both performance screens are DEVICE-UNVERIFIED** — native UI, so they need a real phone: own score for a member,
  ranked roster for a real `super_admin`, "Owner access only" for a real admin/leader deep-linking `?view=team`.
  **cgpe-api also needs its `:3001` restart** before the endpoint returns live data (their reply flagged this).
- **`git push` still 403s** — commits `5dc5eab`, `6e6033a`, `32158bb` are local only (credential `reactjsaaziko`
  has no write access). Needs a human credential swap.
- Carried from before: Phase 41 part-2 (24/7 recorder) + Phase 43 (per-member geofence) device checks.

## Next session starts here
- Phase 46: add tasteful emojis to the greeting copy — small, self-contained, no backend/contract touch.
- First command: `/boot`
- Watch out for: **the i18n trap** — greetings render in 5 languages, so do NOT hand-add an emoji to only the
  English string. Put it where all languages share it (append in the render, or add to each dictionary's greeting
  key with human copy — never a machine translation). And if you touch Phase 39 (master surface) instead, reuse
  the Phase-45 `getTaskReport` reader + `performance.tsx` rather than rebuilding — it is already master-gated.
