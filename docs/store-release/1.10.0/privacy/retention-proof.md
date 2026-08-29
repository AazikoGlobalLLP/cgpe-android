# Retention proof — 90-day hidden / 180-day deleted

The consent notice and privacy policy promise location history is **hidden after 90 days** and **permanently
deleted after 180 days**. This is a production data-governance commitment, and it is **implemented and deployed**.

## Implementation (verified in `cgpe-backend-main`)

- `services/locationRetention.js` — `COLLECTION = 'location_tracks'`, `SOFT_DELETE_DAYS = 90`,
  `HARD_DELETE_DAYS = 180`, tick every 6h.
  - `tick()` hard-deletes rows with `started_at < now − 180d` (`deleteMany`), then stamps `deleted_at` on rows
    aged 90–180d that are not already stamped (`updateMany` where `deleted_at: null`).
- Wired at `server.js:205` (`startLocationRetentionScheduler()`), started **after** the DB connects, with a loud
  error log if it fails to start.
- Reads exclude soft-deleted rows, so >90-day history is hidden: `GET /track/sessions` and `GET /track/:id`
  filter `deleted_at: null` (a soft-deleted session reads as 404); last-location + gap-detector reads do the same.
- Covered by tests (`__tests__/auth.phase45.test.js`).

## Deployment state (verified 2026-08-29)

- `origin/main` tip = `990c660`.
- `services/locationRetention.js` is **PRESENT on `origin/main`**.
- `startLocationRetentionScheduler()` is wired in `server.js:205` **on `origin/main`**.
- Prod deploys `origin/main`, so the code is on the deployed branch. ✅

## Still to confirm at runtime (owner/ops)

- [ ] Prod process is actually running the `990c660` (or later) build — check the startup log for
      `[locationRetention] scheduler active` (and the absence of the `FAILED TO START` error).
- [ ] The `started_at` + `user_id`/`deleted_at` indexes exist (`utils/ensureIndexes.js`).
- [ ] A periodic sample audit proves records older than 180 days are gone from the active DB, and 90–180-day
      records are no longer returned by any Master/manager read path.
- [ ] Backup lifecycle is documented separately (if backups retain data longer than prod, the privacy policy
      must describe that).
- [ ] Purge covers derived copies / caches / exports if any exist.

## App side

The mobile app holds **no** age-based retention logic (by design) — only a device-local offline buffer cap
(`MAX_POINTS = 720`, cleared on every successful upload) and a full per-user cache purge on logout / silent-401 /
user-switch (`resetApiState()` + `purgeUserScopedCaches()`). Retention is entirely a backend responsibility.
