# PHASE 41 — [m]+[api]+[db][sec] 24/7 off-duty background location (consented)

**Status:** SPEC + POLICY LOCKED + `[api]`/`[db]` FILED — no mobile code yet — 2026-08-14.
Owner-escalated to #1 (`docs/PLAN-2026-08-14.md` §Phase 41; DECISIONS 2026-08-14, top). Mirrors the
Phase-38 shape: verified against real code, filed to `cgpe-api`, owner-relay copy handed over. The
mobile build waits on the backend endpoints below **and** on human-translated notice copy.

---

## 1. What the owner decided (locked, AskUserQuestion 2026-08-14)

Two policy forks were put to the owner before any code. Both are now locked:

1. **Scope = truly 24/7, every day.** Record location at all hours — including off-duty, nights,
   weekends — whenever the phone is on. (Not the narrower "whole shift, any handset" reading, and not
   the "working-window" middle ground.)
2. **Consent model = DPDP-safe consent + withdrawal.** On first login the member sees a plain-language
   notice and must tap **Agree**; consent is stored server-side with a timestamp. The member can
   **withdraw** in Settings; withdrawal stops off-duty tracking and **alerts the manager/master** (so the
   owner knows who opted out).

Visibility is unchanged from **Phase 40**: only the **Master** (`super_admin`) can see the map/path.

**Honest legal flag (rule 5), already given to the owner:** continuous off-duty tracking of staff is the
most sensitive category under India's **DPDP Act 2023**; employee consent can be challenged as not
"freely given" because of the power imbalance. The owner accepted this and chose the consent+withdrawal
posture, which is the defensible path. A withdrawal switch means "always-on" is **not 100 % guaranteed
for a member who opts out** — that is the deliberate legal trade-off the owner picked.

## 2. Current state (verified in real code, both trees — not tags)

**Mobile (`src/lib/tracker.ts`, `src/app/(tabs)/home.tsx`, `src/data/api.ts`):**
- Tracking is **strictly shift-bound.** `startTracking(sessionId)` fires on clock-in
  (`home.tsx:924`, from the server's `res.sessionId`); `stopTracking()` on clock-out (`home.tsx:867`).
- Off-duty records **nothing**, by design: any fix with no session id is refused (`unattributable`) and
  the service tears itself down and clears state (`tracker.ts:272-283`). Phase 7 made this deliberate —
  a route that cannot be attributed to a shift is worse than none (battery, a notification nobody can
  explain, and on a shared handset one person's fixes landing on another's day).
- Within a shift it already survives the app being closed (Android foreground service,
  `killServiceOnDestroy:false`, `tracker.ts:412-421`; task defined at module scope, load-bearing import
  `_layout.tsx:18`). It **already requests "Allow all the time"** and gates clock-in on it
  (`ensureBackgroundPermission`, `tracker.ts:308-353`; `home.tsx:800-813`).

**Backend (`cgpe-backend-main/routes/timeTracker.js`):**
- `POST /api/time-tracker/track/points` is **hard session-bound**: it resolves `session_id` from the body
  or the caller's active DayLog session; with none it returns **400 "No active session — clock in
  first."** (`timeTracker.js:1339-1340`). **Off-duty points cannot be ingested today.**
- Points with **accuracy > 100 m are silently dropped** and the call still 200s with `{added:0}`
  (`.filter(… p.accuracy <= 100)`, `timeTracker.js:1350`). Phase 7 flagged this; it matters more for 24/7
  because a battery-friendly ambient fix is coarser.
- `location_tracks` is **"one doc per shift session"**, keyed by `session_id` (`timeTracker.js:1301,1306`).
  There is no per-user / off-duty keying.
- **No staff-consent concept exists** (grep `consent|off-duty|ambient` over the backend = only the
  web-visitor tracker `routes/track.js` and unrelated files). But `routes/track.js` already models
  visitor consent as `consent: { status: 'pending'|'accepted'|'declined', decidedAt }` — a **precedent**
  the backend can mirror for staff.

**Net:** the core of 24/7 (off-duty ingest + consent storage + withdrawal-alert) is entirely
backend-side. Mobile cannot make it work without new endpoints, and inventing an endpoint violates the
contract rule. So Phase 41 files the backend asks first and builds the client only once they land.

## 3. Proposed contract (filed to `cgpe-api` — mechanism is theirs; mobile states the guarantee)

### A. Staff location-consent store + read/write — `[api]`+`[db]`
- Persist per staff, mirroring the `routes/track.js` precedent:
  `location_consent: { status: 'pending'|'granted'|'withdrawn', decided_at, version }`.
- **Read** on `GET /api/rbac/config` `me.location_consent` (the app already fetches this on boot — same
  place backend Phase 41 put `can_approve_content`), or a dedicated `GET /api/time-tracker/consent`.
- **Write** `POST /api/time-tracker/consent { granted: boolean, version }` → sets `granted` /
  `withdrawn` + `decided_at`. On **withdrawal**, create a Notification to the master/manager
  ("<name> turned off location sharing"). `version` lets a materially-changed notice force re-consent.

### B. Off-duty (ambient) point ingest — `[api]`+`[db]`
- **Guarantee mobile needs:** the client can post off-duty points attributed to the **authenticated
  user** (no shift session), and the server stores them **only if** that user's
  `location_consent.status === 'granted'`; otherwise it answers a **distinct refusal** (e.g. 403
  `consent_required`) so the client stops recording and drops its buffer.
- **Recommended shape (their call):** `POST /api/time-tracker/track/ambient { points }` → attribute to
  `req.user`, store as a per-user/day off-duty track (e.g. `location_tracks` with
  `session_id = 'ambient:<userId>:<date>'` + `off_duty: true`, or a sibling collection). Keeping it
  **distinct** from the shift `/track/points` keeps shift routes clean and lets the master tell duty from
  off-duty apart — which is exactly what **Phase 42** (green inside a shift, red outside) needs.

### C. Accuracy for ambient fixes — `[api]`
- Do **not** apply the shift path's `<= 100 m` drop to ambient points. 24/7 uses coarser, battery-
  friendly accuracy; the shift filter would discard almost every ambient fix. Accept coarser ambient
  points (or raise the cap materially) — and separately, re-flag the **shift**-path silent drop from
  Phase 7 (surface a `dropped` count in the 200 instead of dropping invisibly).

### D. Master read of off-duty path — `[api]` (Phase 39/42 dependency, flagged not built here)
- The master monitoring surface (Phase 39) and route-colouring (Phase 42) will need the off-duty track in
  the session list / path reads. Called out so the ingest is designed read-compatible; the read build is
  39/42's, not 41's.

**No `contracts/api.md` edit from mobile.** Per the project pattern (Phase 38/34/27), the backend writes
the contract when it ships these; mobile files the verified ask and wires afterward.

## 4. DPDP notice — content the owner must supply (blocks the consent screen)

The first-login notice must state, in **all five app languages** (human copy — machine translation is
forbidden, i18n rule / PHASE-19 §4):
- **What** is collected: precise location, continuously, 24/7 including off-duty.
- **Why:** field-force management / attendance.
- **Who** sees it: the employer's Master account only (Phase 40).
- **Retention:** how long location history is kept — **owner must set a value** (no default invented).
- **How to withdraw:** in Settings, any time; withdrawal stops off-duty tracking.
- **Grievance / contact** point (DPDP requirement).

Until this copy exists in en/gu/hi/hi-en/gu-en, the consent screen cannot be finalised — same block the
i18n phases hit.

## 5. Mobile plan (built ONLY after §3 A/B land and §4 copy is supplied)

1. **Consent notice screen** — shown on first login (and on a bumped `version`) when
   `me.location_consent.status !== 'granted'`; **Agree** → `POST …/consent {granted:true}`. Decline →
   off-duty tracking never starts (shift tracking is separate and unaffected).
2. **Settings withdrawal row** → `POST …/consent {granted:false}` → stops ambient tracking, drops the
   buffer, backend alerts the master.
3. **`src/lib/tracker.ts` ambient mode** — a 24/7 recorder **independent of the shift**: starts at app
   boot after auth when consent is `granted` (not on clock-in), posts to the ambient endpoint, and stops
   + clears on withdrawal or a `consent_required` refusal. New 24/7 foreground-service wording ("CGPE
   Connect is sharing your location with your employer" — **not** "clock out to stop", which is
   shift-only). Coarser accuracy than the shift recorder for battery. The existing shift recorder stays
   as-is; the two coexist (a clocked-in member has both a shift route and ambient coverage).
4. **Battery/OEM reality (device-only):** Android needs the ongoing notification (legal + technical) and
   likely a battery-optimisation-exemption prompt for Samsung/Xiaomi/OnePlus; iOS needs "Always" + an App
   Store justification. All only verifiable on real handsets — `tracker.ts` has **no test coverage and is
   device-only** (no `expo-location`/`expo-task-manager` stub).

## 6. Decisions

- **D-1: policy locked by the owner before any code** (§1) — 24/7 truly-always + consent-with-withdrawal.
  Recorded so a future session does not re-open the "what does 24/7 mean / is off-duty ok" question.
- **D-2: backend-first, file don't invent.** Off-duty ingest + consent store + withdrawal-alert do not
  exist and are the backend's to build (verified §2); mobile files the ask and wires after (Phase 38/27
  precedent). No client code and no `contracts/*` edit this phase.
- **D-3: ambient is a SEPARATE recorder, not a change to the shift path.** The shift-bound design is
  correct and Phase-7-hardened; 24/7 is added alongside it, keeping duty vs off-duty distinguishable for
  Phase 42. The `unattributable`-drop guard stays for the shift path.
- **D-4: consent read rides `GET /rbac/config` `me`** (recommended) so the app learns consent state on the
  boot fetch it already does — no extra round trip on every cold start.
- **D-5: withdrawal wins over "guaranteed always-on."** The owner chose the DPDP-safe posture; a member
  who withdraws is not tracked off-duty. This is intended, not a gap.

## 7. Done means (this phase)

Spec written, policy locked with the owner, backend asks **verified against real code and filed** to
`contracts/INBOX.md` with an owner-relay copy — **all met**. No `src/` change, so no gate re-run
(baseline stands: `tsc` 0, `npm test` 435/435, lint 0 errors / 12 warnings).

**Necessary-but-not-sufficient for a working feature:** cgpe-api ships §3 A/B/C, the owner supplies §4
notice copy in five languages and a retention value, then a **later mobile phase** builds §5 and it is
checked on real multi-handset devices. Until then 24/7 off-duty tracking is **not live**.

## 8. Next

- **cgpe-api** builds §3 (consent store + read on `me`, ambient ingest, ambient accuracy). Owner relays
  the filed ask.
- **Owner** supplies the §4 DPDP notice copy (5 languages) + a retention period.
- **Then** the mobile build phase (§5), device-checked. Phase 42 (green/red route colouring) consumes the
  off-duty vs shift distinction this ingest creates.
