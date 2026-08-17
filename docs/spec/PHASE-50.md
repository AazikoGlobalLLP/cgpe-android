# PHASE 50 — Dual-office geofence + out-of-range / early-clock-out reason capture → super-admin

**Status: SPEC + `[api]` FILED; owner CONFIRMED all §6 decisions 2026-08-17 (buffer 15 min, reason mandatory, immediate
mark, n8n → super_admin-only). Still BACKEND-FIRST — no mobile build until cgpe-api ships + the two office pins are set.**
New owner request (post-backlog). Mobile-phase
numbering; the backend's own "Phase 50" comment (`timeTracker.js:317`) refers to *their* per-member fence,
which is *our* Phase 43 — different numbering, do not conflate.

---

## 1. The request (owner, 2026-08-15, verbatim intent)

A team member may clock in from **either of two offices**, within **200 m**. **Exact pins owner-supplied 2026-08-17**
(set in the panel/DB via `PUT /geofence` `offices[]`, NOT client literals):
- **Office 01 (Adajan)** — lat `21.208267`, lng `72.839960` — 9th Floor, Citadel, opp. Star Bazar, Jalaram Society, Adajan Gam, Adajan, Surat 395009
- **Office 02 (Katargam)** — lat `21.187084`, lng `72.797604` — 9, Parisar Apartment, Sumul Dairy Rd, Suryapur Gate, Katargam, Surat 395008

Three new rules:
1. **Out-of-range clock-IN or clock-OUT** (outside 200 m of *both* offices) is **allowed**, but the member is
   **asked for a reason**, and the reason **goes to the super admin**.
2. **Early clock-OUT** (leaving before the shift end) — the member is **asked why**, and that reason **also goes
   to the super admin**.

## 2. Verified current state (real code, both trees — not tags)

- **Single fence, REFUSE model (backend-enforced).** `routes/timeTracker.js` clock-in (`:259`) resolves
  `getMemberGeofence(userId)` and, on `checkClockGeofence` failure, returns **`403`** with `message` + `distance_m`
  (`:326-330`). So an out-of-range clock-in is **rejected today**, not allowed-with-reason.
- **One office coordinate + per-member centre.** `utils/geofence.js`: `DEFAULT_OFFICE { radius_m:200, enforce:true }`;
  a seeded office doc holds the org coordinate; `getMemberGeofence` moves the CENTRE to `PayrollProfile.start_location`
  when set, keeping the org radius/enforce (`:91-106`). **There is no concept of a *second* office.**
- **Clock-out is unfenced (warn-only).** Mobile checks the fence *after* a successful clock-out purely to warn,
  naming the measured distance (`home.tsx:830-886`); the backend does not block clock-out on distance.
- **No reason capture anywhere.** Neither clock-in nor clock-out accepts or stores a free-text reason; there is no
  "out-of-range" or "early-leave" super-admin notification (the only location→master alert is Phase-43 consent
  withdrawal, `timeTracker.js:1425`).
- **Shift window exists.** Clock-in already validates `shiftStart`/`shiftEnd` (`:133`) — so **"early" has a
  code-grounded meaning: clocking out before `shiftEnd`.**
- **Mobile shapes.** `clockIn(coords)`/`clockOut(coords)` (`api.ts:2020/2040`) send `{lat,lng,accuracy,city}` and
  read back `{ok, blocked, message, distance_m, …}`. No `reason` field on either.

**Conclusion: this is a BACKEND contract change first.** The server currently 403s the out-of-range clock-in before
any reason could be captured, stores no reason, knows no second office, and sends no such alert. Mobile cannot do this
alone (same posture as Phase 43: enforcement is server-owned).

## 3. Desired behaviour (the change)

- **`in_range` = within 200 m of EITHER office** (min distance to the two org offices ≤ 200 m). Radius stays one org
  knob (200 m), unchanged.
- **Out-of-range clock-in/out is ALLOWED** (reverses today's refuse) **but requires a non-empty reason**; the
  attendance **marks IMMEDIATELY** (never held/queued), recorded `out_of_range:true` with `distance_m` + `reason`, and
  a **super-admin alert is raised via n8n** (§6.5).
- **Early clock-out = before `shiftEnd` MINUS a 15-minute grace buffer** (owner-locked, §6.2) requires a reason;
  recorded `early:true` with `reason` + the same n8n super-admin alert. Out-of-range AND early can co-occur → one
  event, both flags; mobile shows ONE combined reason prompt (§6 recommendation).
- **Reason is MANDATORY to proceed** when triggered (the clock action does not complete without it) — §6.3. The reason
  is free text; the super admin sees who / when / distance / which rule / the text — never used to *refuse*, only to
  record + notify (transparent, matches the §5 "loud not silent" posture).

## 4. Backend changes needed — `[api]` (filed to cgpe-api 2026-08-15)

Recommend (mechanism is cgpe-api's call): (a) support **a list of org offices** (≥2) with the existing 200 m/enforce
knobs, set in the **panel/DB** (NOT client literals — Phase 7 removed exactly that); (b) `checkClockGeofence` returns
`in_range` = within radius of ANY office + the min `distance_m`; (c) clock-in/out accept an optional **`reason`** and
stop REFUSING out-of-range — instead record `out_of_range`/`early` + `reason` and **notify every super_admin**
(reuse the Phase-43 per-master notification with a new `metadata.kind`, e.g. `clock_out_of_range` / `clock_early`);
(d) require the reason server-side when a flag is set (or accept the client's enforcement — owner to confirm); (e) mirror
`api.md` + `models.md` + `CHANGELOG.md`.

## 5. Mobile changes needed (after the backend ships — no build yet)

- Thread an optional **`reason`** through `clockIn`/`clockOut` (`api.ts`) and read the new `in_range`/`out_of_range`/
  `early` flags.
- **Reason-prompt UI** on the clock-in/out flow (`home.tsx`): when the (pre-check or server) says out-of-range, or the
  clock-out is before `shiftEnd`, prompt for a reason (a `Sheet`/`Confirm`-style input) and send it. Never fabricate a
  reason; an empty reason blocks the action (per §3).
- **i18n copy (5 languages, HUMAN)** for the prompt(s) — the same copy blocker as the 41d app-block: net-new keys need
  gu/hi/hi-en/gu-en (machine translation forbidden, PHASE-19 §4). List when built.

## 6. OWNER DECISIONS — CONFIRMED 2026-08-17 (was flagged-open; now locked)

1. **Nearest office, auto** — the member is checked against BOTH offices; `in_range` = within 200 m of the **nearer**
   one (backend returns `in_range` + the **min** `distance_m`). The app shows/attributes the nearest office. No client
   coordinate literal — the two office pins (§1 addresses) are set in the **panel/DB** by the owner (still pending).
2. **"Early" = clock-out before `shiftEnd` MINUS a 15-minute grace buffer** (owner-locked **15 min**, 2026-08-17).
   Clocking out within the last 15 min of the shift is NOT early (no reason). Earlier than `shiftEnd − 15 min` →
   `early:true` → reason required. The 15 is one named config/constant (backend + mobile), not scattered.
3. **Reason is MANDATORY** — an out-of-range clock-in/out **or** an early clock-out cannot complete without a
   non-empty reason. Mobile blocks the button; backend also requires it server-side when a flag is set (can't bypass).
4. **Out-of-range attendance marks IMMEDIATELY** — never held/queued/rejected. The clock event is recorded right away
   with `out_of_range:true` + `distance_m` + `reason`; the attendance is valid and the reason is recorded alongside.
5. **Alert delivery = n8n, recipients = super_admin ONLY (the 3 promoted accounts).** On either flag the super-admin
   alert goes **through n8n** (same pattern as the campaign/WhatsApp n8n webhooks), not only an in-app DB notification,
   to `role:'super_admin'` profiles only (the 3 Phase-38 masters — DB `Profile.role`, no phone literals). It carries
   who / when / which rule / `distance_m` / the reason text — **never coordinates.**

**Recommendations still flagged for cgpe-api (not owner-blocking):**
- **Two offices vs per-member `start_location`** — recommend in-range = within 200 m of EITHER org office, keeping the
  Phase-43 per-member pin as a fallback when unset. cgpe-api's call whether to keep the member pin in the OR.
- **Combined vs separate reason** — if a clock-out is BOTH out-of-range AND early, mobile shows ONE combined reason
  prompt and sends one `reason` with both flags set (least friction). cgpe-api to say if it wants two.

## 7. Done when

Backend ships the two-office fence + reason capture + super-admin notify + the `shiftEnd` early rule (mirrored to
`contracts/`), the two office pins are set in the panel, the owner confirms §6, THEN mobile threads `reason` + builds
the prompt (with supplied 5-language copy) + a device check: clock in/out within 200 m of either office (no prompt);
outside → reason prompt → super admin notified; clock out before `shiftEnd` → reason prompt → super admin notified.
