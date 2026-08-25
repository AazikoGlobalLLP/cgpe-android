# HANDOFF — CGPE Connect (Android) — Loophole hunt rounds 2 & 3 — 2026-08-25

## Done
- **Two adversarial loophole hunts** (multi-agent workflows) over the code shipped since the
  2026-08-21 audit, then over the modules that audit never touched. **13 real defects found,
  verified, fixed, and pushed** across two commits — every fix JS-only / OTA-eligible.
- **Round 2 (`2f07a1e`) — 5 fixes** in the post-2026-08-21 code:
  - **[HIGH] `claim-new` client picker** now carries the same client-book guard as every other
    client surface — a team advisor could previously enumerate the whole ~9k book through the
    claim's client search (Point-9 gated 13 surfaces, missed this one).
  - `isEphemeralUrl` now catches the real prod ephemeral upload (`https://cgpe.in/uploads/…`),
    so a redeploy-wiped upload is no longer recorded as durably attached.
  - The offline poison-cap no longer counts network throws, so an offline create isn't dropped
    on its first transient 5xx.
  - A `409 idempotency_in_progress` on a queue replay is kept+retried, not dropped with a false
    "could not be saved".
  - `mergePayrollRoster` no longer attaches one salary row to a same-named member.
- **Round 3 (`c6ea5ec`) — 8 fixes** in the previously-unaudited modules:
  - **[HIGH] Silent 401 token expiry** now runs the full per-user teardown (tracker + push) that
    logout does — previously the next user on a shared handset had their GPS post to the previous
    user's shift and received the previous user's pushes.
  - **[HIGH] Out-of-range clock-in** is no longer silently blocked — a field agent away from the
    office now gets the Phase-50 reason prompt instead of being unable to record attendance.
  - Off-duty ambient location no longer records at High (~10 m) accuracy; the clock marker key is
    now shared per-user (a clocked-in day no longer shows "absent"); the campaign "sent" count no
    longer claims the whole audience when zero were dispatched; `getNotifications`/`getReminders`
    no longer flip a false org-wide outage banner on a 403/404; search and calendar-sync no longer
    misread an outage as "empty".
- Gates green on both: `tsc` 0 · `npm test` **991** (round 2 → 984, round 3 → 991) · `eslint`
  0 new errors. **Device-unverified.** `contracts/INBOX.md` untouched (no cross-repo ask).

## Files changed
- `docs/AUDIT-2026-08-25-loophole-hunt.md` (new) — round-2 report (5 defects).
- `docs/AUDIT-2026-08-25-loophole-hunt-round3.md` (new) — round-3 report (8 fixes).
- Round 2: `src/app/claim-new.tsx` (client-book guard), `src/lib/fileUpload.ts` (`/uploads/`
  ephemeral detection), `src/data/api.ts` (flush poison-cap), `src/lib/writeQueue.ts` (409/429
  keep), `src/data/payroll.ts` (name-collision) + their tests.
- Round 3: `src/store/auth.tsx` (expiry teardown), `src/app/(tabs)/home.tsx` (clock-in reason
  fall-through), `src/lib/tracker.ts` (ambient accuracy), `src/lib/clockKey.ts` (new shared key
  builder) + `src/app/attendance.tsx` + `src/app/agent-map.tsx` (use it), `src/lib/campaignOutcome.ts`
  + `src/data/api.ts` (campaign count; notifications/reminders classify), `src/app/search.tsx`
  (cached-bulk outage), `src/lib/calendar.ts` (no delete on outage) + tests.

## Decisions made
- **Every fix maps to an existing spec/rule, not a new product call** — Point-9 client-book policy,
  the 2026-08-21 shared-handset teardown pattern, the Phase-50 allow-with-reason clock contract, the
  `reportIfOutage` honesty classifier, the no-fabrication rule. So the hunts hardened decided
  behavior; they did not decide anything new.
- **Fixed only adversarially-CONFIRMED findings** (each re-checked by an independent refuter). The
  `shared-handset-auth` finder in round 2 returned empty — the 2026-08-21 consent/session fixes held
  through the identity refactor, so nothing was changed there.
- **`contracts/INBOX.md` deliberately not touched** — no fix needed a backend/contract change that
  wasn't already filed (the server `GET /clients` gate and the Spaces env are pre-existing owner/OPS
  relays).

## Known broken / deliberately skipped
- **Device-unverified** — the auth/tracker/clock/campaign paths can't be exercised by `tsc`/`npm test`
  or web; they were reasoned against the real code and mirror already-working sibling paths.
- **Two round-3 HIGH fixes are dormant until an owner/OPS action:** the clock-in fix (#3) activates
  when the owner seeds the two office geofence pins; the push half of the expiry fix (#8) only matters
  once the FCM V1 key is on EAS. Both are in place ahead of those.
- **Lower-risk surfaces not yet audited:** boot/route-restore, i18n, theme/density, tab-nav RBAC.
- **Nothing new shipped to devices** — both commits are OTA-eligible but still ride the next
  over-the-air update / the pending Point-11 native APK.

## Next session starts here
- Phase: **owner/OPS follow-through, OR a round-4 hunt over the lower-risk surfaces** (boot/route-restore,
  i18n, theme, tab-nav RBAC) — confirm the direction with the owner; there is no self-contained OTA `[m]`
  backlog item outstanding.
- First command: `/boot`
- Watch out for: **do not tell the owner any of these 13 fixes are "verified working" — they are
  code-verified and gate-green but device-unverified**, and two of the round-3 HIGH fixes only take
  effect after an owner/OPS step (office pins / FCM key).
