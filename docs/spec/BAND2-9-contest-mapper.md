# Band 2 #9 — Contest mapper fix (owner backlog Point 7, latent bug)

**Status:** SHIPPED (editor-side; device-unverified, OTA-eligible — pure JS, no native dep).
**Owner dependency:** none. Self-contained client bug.

## The bug

`GET /api/contests` (deployed `origin/main` `49482e9`, verified byte-identical to local
`cgpe-backend-main/routes/contests.js` + `models/Contest.js`) returns raw Contest **documents**
inside the standard `{success, data:[…]}` envelope, each annotated per-caller with `user_progress`,
`is_participating`, and a top-5 `leaderboard`. Its field names are:

| wire field | app `Contest` field it should feed |
|---|---|
| `_id` | `id` |
| `title` | `name` |
| `reward_description` | `reward` |
| `user_progress` / `target_goal` | `progress` (0..1) |
| `target_unit` (+ the two numbers) | `metric` (meter label) |
| `end_date` | `ends` |
| `leaderboard[].rank` where `user_id === me` | `rank?` |

`getContests` was reading the array **straight into `Contest[]`** with only an `isArray` check — no
adapter. So every app field resolved to `undefined`: blank name, no reward, a `NaN → 0%` meter, no
metric label, no countdown (missing `ends`), no rank. **Any real contest rendered as an empty card.**
It never surfaced because no live contest has been created yet (Point 7: no admin UI to make one),
so it was a latent bug waiting on the first real contest.

## The fix

- New pure `adaptContest(raw, userId?)` in `src/data/adapt.ts` maps the wire shape → `Contest`.
  - `progress = clamp01(user_progress / target_goal)`; a `0`/missing target yields `0` (no
    `NaN`/`Infinity` meter).
  - `metric = "<user_progress> of <target_goal> <target_unit>"` (unit defaults to `points`); falls
    back to the bare unit when there is no target.
  - `rank` is set **only** when the signed-in user's `user_id` appears in the (top-5) `leaderboard`
    — never inferred from a progress tie, so an absent rank is honest silence, not a fabricated `#0`.
- `getContests` (`src/data/api.ts`) now fetches `any[]`, keeps the `unavailable()` outage fallback,
  and maps each row through `adaptContest(r, currentUserId)` (the id already tracked via
  `setCurrentUser`, backend `user_id`).
- `src/app/contests.tsx` unchanged — it was already a correct consumer of the `Contest` shape; the
  only fault was the data never arriving in that shape.

## Tests

`src/data/__tests__/adapt.test.ts` — new `adaptContest` describe block, 8 cases: real-field mapping,
own-share progress, over-target clamp, zero/missing-target guard, rank-from-own-leaderboard-row,
rank-omitted-when-absent, unit default, null-row safety. Suite 902 → **910**.

## Gates

`tsc` 0 · `npm test` 910 · `eslint` 0 errors (2 pre-existing warnings in `api.ts` untouched).
