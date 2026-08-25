# CGPE Connect Android — Reliability / Loophole Audit (round 3)

**Date:** 2026-08-25 · **Follow-up to** rounds 1 (`AUDIT-2026-08-21-loophole-hunt.md`, 9 fixed) and 2
(`AUDIT-2026-08-25-loophole-hunt.md`, 5 fixed).
**Scope:** the five high-stakes modules rounds 1–2 never audited — background **location/tracker**, the
**geofence clock-in/break/clock-out** flow, **WhatsApp/campaign dispatch**, the **outage-honesty** layer, and
**push/calendar**. All 14 prior defects were excluded.
**Method:** multi-agent workflow — 5 concern-finders → adversarial verification → synthesis. **15 agents, 0
errors.** 10 raw → **9 confirmed** → **8 distinct fixes** (findings #1 and #8 share one root cause).
**Full per-agent verdicts:** workflow journal `subagents/workflows/wf_79db5eda-c09/journal.jsonl`.

---

## Remediation status — 2026-08-25

**All 8 fixes applied client-side, gates green (`tsc` 0 · `npm test` **991** (+7) · `eslint` 0 new errors),**
pushed to `aaziko/Shivam`. All JS-only / OTA-eligible. **Device-unverified.**

| # | Sev | Defect | Fix | Test |
|---|-----|--------|-----|------|
| 1+8 | **HIGH** | Silent 401 expiry skipped the per-user teardown → next user's GPS on prev user's shift (#1) AND next user gets prev user's pushes (#8) | `store/auth.tsx` — `onSessionExpired` now runs `purgeUserScopedCaches()` + `clearPushRegistration()` like logout | (reasoned; native path) |
| 3 | **HIGH** | Out-of-range clock-IN silently blocked, defeating Phase-50 allow-with-reason | `home.tsx` — hard-block only the undeterminable-location case; a measured out-of-range falls through to the server's `needsReason` prompt | (screen path) |
| 2 | MED | Watchdog forced-fix used High accuracy for off-duty ambient (privacy escalation) | `tracker.ts` — `captureForcedPoint(hasShift)`: Balanced when no shift sid | (native path) |
| 4 | MED | `attendance.tsx`/`agent-map` read the old device-scoped clock key → present shown absent | new `lib/clockKey.ts` shared builder; Home + both readers use it | `clockKey.test.ts` (+3) |
| 5 | MED | Campaign "sent" count fell back to whole audience on an explicit `count:0` → false "Dispatched to N" | `campaignOutcome.ts` + `api.ts sendCampaign` — distinguish absent vs explicit 0 | `campaignOutcome.test.ts` (flipped + 1) |
| 6 | MED | `getNotifications`/`getReminders` misclassified 403/404/501 as a global outage → false org-wide banner on Home | `api.ts` — `reportIfOutage(status, …)` like `getLeads` | `api-notifications.test.ts` (+3) |
| 7 | LOW | `search.tsx` missed a still-failed cached bulk → real outage rendered as "found nothing" | `search.tsx` — also fail the run when a bulk collection is known-down | (screen path) |
| 9 | LOW | Calendar sync deleted mirrored events on an outage-empty fetch | `calendar.ts` — skip the removes when `/tasks` or `/reminders` is known-down | (native path) |

---

## 1. Bottom line

Three HIGH findings, all in the shared-handset / field-attendance / location machinery that carries the most
real-world risk:

- **The session-expiry teardown gap (#1 + #8)** is the headline. The 2026-08-21 audit hardened the *explicit
  logout* path against a shared handset bleeding one user's tracker session and push token into the next — but a
  **silent 401 token expiry** (routine on the 24 h token) takes a *different*, partial teardown path that nulls
  the token without purging those per-user artifacts, and it deletes `USER_KEY` first so the `persist()`
  different-user guard can't fire either. Result: the next person to sign in on that handset has their GPS posted
  onto the previous user's shift, and receives the previous user's push notifications. One fix — run the same
  teardown `logout()` does — closes both. (Push isn't exploitable *today* because FCM creds aren't on EAS yet, but
  the code defect is real and must be fixed before push ships.)
- **Out-of-range clock-in (#3)** silently blocks a field agent from recording attendance once the owner sets the
  office pins — the exact opposite of the Phase-50 "allowed with a reason" contract the server already honors. The
  client pre-check hard-returned instead of routing to the reason prompt.

The four MEDIUMs are an off-duty privacy escalation (#2), a clock-key drift that shows a clocked-in day as absent
(#4), a false "sent to everyone" campaign count (#5), and a false org-wide outage banner (#6). The two LOWs are
narrow outage-honesty edges (#7, #9). Every fix aligns with an existing spec or honesty rule — none is a new
product decision.

## 2. Notes on the fixes

- **#1/#8** mirror `clear()`'s teardown in `onSessionExpired`; `clearPushRegistration` was already imported for
  logout, and `purgeUserScopedCaches` drops `track.*`/`clock.*`/`cache.*`.
- **#3** reuses the existing `res.needsReason` handler (the same one the clock-OUT path uses) rather than adding a
  parallel flow; only the truly-undeterminable location (`distance_m == null` → "Enable location") still hard-blocks.
- **#4** introduces `lib/clockKey.ts` as the single key builder so the writer (Home) and readers
  (attendance, agent-map) can never drift again.
- **#5/#6** are the same class as prior fixes: a value that was collapsing two distinct signals (`0 || total`;
  a dropped `status`). Both flip a test that had pinned the wrong behavior.

## 3. What remains (not client code)

- The **server-side `GET /clients` role gate** and **DigitalOcean Spaces env** (from round 2) are unchanged — still
  owner/OPS.
- **Push (#8) only matters once the FCM V1 key is on EAS**; the fix is in place ahead of that.
- **#3 activates when the owner seeds the two office pins** (geofence `enforce:true`); until then it's dormant, but
  the fix is in place so it behaves correctly the moment they do.

_All findings verified against real code before fixing; nothing invented. `contracts/INBOX.md` untouched._
