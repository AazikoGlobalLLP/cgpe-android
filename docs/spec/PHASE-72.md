# PHASE 72 — Team-targeted push notifications (Tier B, real push)

**Owner batch 2026-08-20, item #3.** Owner-locked decisions (AskUserQuestion, 2026-08-20):

- **Tier B — real push** that wakes a closed phone (not just the in-app bell).
- **Triggers (all four):** new department task · task reassign/transfer · new lead for the team ·
  task due/overdue reminder.
- **Recipients:** everyone in the target department, **including the assignee and the creator**.
- **Departments:** the 9 canonical RBAC departments (`utils/rbac.js DEPARTMENTS`) + the org-role
  catalog; the owner cleaned up the 8 staff role/dept records in the DB first so `Profile.department`
  is now trustworthy for fan-out.

Transport chosen (mobile's call, "aapke according"): **Expo Push** (`getExpoPushTokenAsync` on the
app + `expo-server-sdk` on the backend) over raw `firebase-admin` — least backend code, standard
Expo path, still rides FCM underneath.

---

## Architecture (3 trees + infra)

```
 task/lead/reminder event (backend)
        │
        ▼
 broadcastToDepartment(dept, payload)         ← utils/notify.js  [api]
        │  ├── writes 1 Notification bell row per active dept member   (Tier A, already the pattern)
        │  └── collects their push tokens → sendPush(tokens, payload)  ← services/push.js [api]
        ▼
 Expo Push service ──(FCM V1 creds)──▶ device        ← Firebase project [OPS/infra]
        ▼
 expo-notifications receives → app shows/【tap】→ routeForPush → tab   ← lib/push.ts [m, BUILT]
```

---

## Mobile — BUILT this session (`[m]`, rides the batch APK; NOT OTA — new native module)

- **Dep:** `expo-notifications@~57.0.12` (via `npx expo install`). `app.json`: added the
  `expo-notifications` config plugin (`color #155DFB`, `defaultChannel "default"`) + the
  `POST_NOTIFICATIONS` Android-13 runtime permission.
- **`src/lib/pushRouting.ts` (PURE, tested):** `routeForPush(data)` → `/tasks` | `/leads` |
  `/notifications`, and `shouldReRegister(prev, next)`. Tasks/leads are TABS (no per-item detail
  route yet), so a task push lands on the Tasks tab where the new row appears; anything unmapped
  falls back to the always-correct feed — never a navigate-on-a-guess. An explicit `data.url` is
  honoured ONLY if it is a known-safe in-app route, so the backend can start sending deep-link urls
  before the app grows the matching screens.
- **`src/lib/push.ts` (native, fail-quiet):** permission request (channel created first, per
  Android 8+), Expo-token acquisition (`getExpoPushTokenAsync({projectId})`, projectId from
  `extra.eas.projectId`), foreground handler (banner+sound while open), and the tap listener +
  cold-start `getLastNotificationResponse()` (opened-from-killed). Web is a no-op throughout.
- **`src/lib/pushToken.ts` (non-native slice):** `SENT_TOKEN_KEY` + `clearPushRegistration()`.
  Split out of `push.ts` **on purpose** — `store/auth` imports it for sign-out unregistration and is
  in the Vitest graph, so it must never reach `expo-notifications`/`expo-constants` (they pull
  `expo-modules-core`'s `__DEV__`, which breaks Node tests).
- **`src/data/api.ts`:** `registerPushToken(token, platform)` + `unregisterPushToken(token)` —
  best-effort + **silent** (never raise the health banner; a 404/501 from the not-yet-deployed
  endpoint quietly no-ops). A 401 still ends the session via the shared `reportAuth`, like every call.
- **Wiring:** a root-level `PushGate` in `_layout.tsx` (beside `PermissionMonitor`) registers on
  sign-in + routes taps; `store/auth.logout()` calls `clearPushRegistration()` **before** the token
  is cleared (the unregister is itself authenticated).
- **Register only when the token changed** (`shouldReRegister`) so a normal reopen is a no-op.

**Gates:** `tsc` 0 · `npm test` **656** (+12 in `pushRouting.test.ts`) · eslint 0 errors.

---

## Backend — FILED to `cgpe-api` INBOX (`[api]`, owner relays)

1. **Device-token store** — a `push_tokens` collection `{ user_id (Profile _id hex), token (unique),
   platform, updated_at }`, upsert-by-token.
2. **`POST /api/push/register`** `{ token, platform }` (`protect`) → upsert; **`POST
   /api/push/unregister`** `{ token }` (`protect`) → delete this user's row for that token.
3. **`broadcastToDepartment(department, {title,message,type,metadata,data}, {excludeUserIds?})`** in
   `utils/notify.js` — canonicalize the dept (reuse `utils/rbac.canonicalizeDepartment`), find active
   Profiles in it, write the bell rows (as `broadcastToAllActive` does), collect their tokens →
   `sendPush`. Default recipients = **everyone in the dept** (owner's choice); `excludeUserIds` kept
   for future opt-out.
4. **`services/push.js`** — `expo-server-sdk`: chunk tokens, send, read receipts, prune
   `DeviceNotRegistered` tokens from the store.
5. **Trigger wiring:** task-create (`routes/tasks.js`), task transfer-accept/reassign, lead-create,
   and a scheduled due/overdue job (cron). Each calls `broadcastToDepartment` with the right dept +
   a `data:{type,id}` the app routes on (`type ∈ task|lead|reminder|...`).

**Push `data` contract the app consumes:** `{ type: 'task'|'lead'|'reminder'|'system', id?, url? }`.

---

## Infra / OPS — owner-owed HARD PREREQUISITE (nothing delivers without it)

- A **Firebase project** for `com.cgpe.connect` → **FCM V1 service-account key** uploaded to EAS
  (`eas credentials` → Android → FCM V1). Until this exists, `getExpoPushTokenAsync` throws and the
  app simply holds no token (honest degradation, no crash).
- Deploy the backend to `origin/main` + `:3001` restart (the usual courier step).
- A **new APK** (native module → not OTA), bundled with the 70/71/73 batch per the owner directive.

## Honest ceilings
- iOS is a **separate** APNs setup (not in scope here; Phase 56 tracks iOS).
- The bell row is delivered even if push fails, so an app-open user always sees the event; the real
  push is the "closed phone" add-on and depends on the FCM prerequisite above.
- Notification icon is currently the app logo silhouette; a proper monochrome notification icon is a
  cosmetic follow-up the owner can supply.

## Remaining
Backend build + deploy (relayed) · Firebase/FCM setup (owner) · batch APK · on-device verify
(a dept task created for team X buzzes an X member's closed phone and the tap opens the Tasks tab).
