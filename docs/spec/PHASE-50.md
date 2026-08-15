# PHASE 50 — Dual-office geofence + out-of-range / early-clock-out reason capture → super-admin

**Status: SPEC + `[api]` FILED, no build — 2026-08-15.** New owner request (post-backlog). Mobile-phase
numbering; the backend's own "Phase 50" comment (`timeTracker.js:317`) refers to *their* per-member fence,
which is *our* Phase 43 — different numbering, do not conflate.

---

## 1. The request (owner, 2026-08-15, verbatim intent)

A team member may clock in from **either of two offices**, within **200 m**:
- **Office A** — "9th Floor, Citadel, opp. Star Bazar, Jalaram Society, Adajan Gam, Adajan, Surat, Gujarat 395009"
- **Office B** — "9, Parisar Apartment, Sumul Dairy Rd, Suryapur Gate, Katargam, Surat, Gujarat 395008"

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
- **Out-of-range clock-in/out is ALLOWED** (reverses today's refuse) **but requires a non-empty reason**; the event is
  recorded `out_of_range:true` with `distance_m` + `reason`, and a **super-admin notification** is raised.
- **Early clock-out (before `shiftEnd`) requires a reason**; recorded `early:true` with `reason` + a super-admin
  notification. (Out-of-range AND early can co-occur → one event, both flags, one or two reasons — owner to confirm
  whether that's one combined reason prompt or two.)
- **Reason is mandatory to proceed** when triggered (else the clock action is not completed) — owner to confirm (vs.
  optional). The reason is free text; the super admin sees who / when / distance / which rule / the text — never used
  to *refuse*, only to record + notify (transparent, matches the §5 "loud not silent" posture).

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

## 6. Flagged-open — OWNER decisions (recorded, to confirm; I will not invent these)

1. **Office coordinates** — the two addresses (§1) must be set as pins **in the panel/backend** with their real
   lat/lng (panel geocodes, or owner enters). No client coordinate literal.
2. **"Early" definition** — recommend **before `shiftEnd`** (already in `timeTracker.js:133`); owner to confirm (vs a
   worked-hours threshold like Phase-44's 8 h full-day).
3. **Two offices vs per-member pins** — do the two org offices REPLACE the Phase-43 per-member `start_location`, or is
   in-range = (either office) OR (member pin)? Owner/cgpe-api to decide.
4. **Reason mandatory?** — block the clock action until a reason is given (recommended), or allow skip?
5. **Combined vs separate** — if a clock-out is both out-of-range AND early, one reason prompt or two?

## 7. Done when

Backend ships the two-office fence + reason capture + super-admin notify + the `shiftEnd` early rule (mirrored to
`contracts/`), the two office pins are set in the panel, the owner confirms §6, THEN mobile threads `reason` + builds
the prompt (with supplied 5-language copy) + a device check: clock in/out within 200 m of either office (no prompt);
outside → reason prompt → super admin notified; clock out before `shiftEnd` → reason prompt → super admin notified.
