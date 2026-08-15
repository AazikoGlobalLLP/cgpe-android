# Phase 43 — Per-member set location + 200 m clock-in enforcement `[api]`+`[m]`

**Session:** `cgpe-mobile` · **Date:** 2026-08-14 · **Status:** VERIFIED + FILED to `cgpe-api`, no mobile build.
Roadmap: `docs/PLAN-2026-08-14.md` §Phase 43 (Group E). Owner backlog item.

## 0. What the owner asked
> Each team member has their **own set location**; clock-in is only allowed within **200 m** of that
> location (not a single shared office fence).

## 1. Verified current state (real code + contract, both trees read this session)

Clock-in is enforced against **one global office fence**, keyed to nobody:

- **Enforcement.** `POST /api/time-tracker/clock-in` calls `checkClockGeofence(lat,lng,accuracy)`
  (`cgpe-backend-main/routes/timeTracker.js:321`), which reads a SINGLE fence via `getOfficeGeofence()`
  (`utils/geofence.js:48`, `:80`) — **no `userId`/`profile` parameter**, so every caller is checked against
  the same circle. The handler's own comment says so (`timeTracker.js:317-320`): *"global office geofence
  (global org config). This replaces the per-user attendanceRules.geo (which was unset for everyone…)."*
- **Radius + accuracy credit.** Default **200 m** (`utils/geofence.js:24-30` `DEFAULT_OFFICE.radius_m`),
  overridable by the org doc. Up to **100 m of GPS accuracy is credited** (`geofence.js:93-94`,
  `Math.min(acc,100)`), so the *effective* fence is up to **~300 m**; a fix coarser than **300 m** accuracy
  is rejected outright (`geofence.js:89-91`); missing coords rejected (`:85-87`); `enforce:false` passes open
  (`:82`). Contract agrees: `enums.md` §10 (lines 493-495), `api.md:489`.
- **Data.** The global fence is `org_settings` doc `_id:'office_geofence'` (`geofence.js:53-56`, written by
  `PUT /geofence` super-admin-only at `timeTracker.js:1277-1294`; `models.md:1774-1783`).
- **Read endpoint.** `GET /api/time-tracker/geofence` (`timeTracker.js:1267`) returns that ONE fence
  `{ lat, lng, radius_m, label, enforce }` to any authed caller — **not keyed to the caller** (`api.md:500`).

**Per-member location fields that already exist but DO NOT drive clock-in:**

1. `Profile.attendanceRules.geo {lat,lng,radius}` (`models/Profile.js:182-195`; `models.md:287-290`) — used
   **only** by the break start/stop fence via the inferior `validateLocation` (`timeTracker.js:595-602`,
   `693-700`), **null for everyone**, and carries a documented **metres-vs-km unit conflict**
   (`models.md:290` says metres, `api.md:491/523` says km).
2. `PayrollProfile.start_location {lat,lng}` (`models.md:824`) — documented verbatim as
   *"geofence origin for this member (the clock-in pin)"*, **but read only by `routes/payroll.js`** (the
   salary engine), never by the clock-in geofence check.

**No contract / CHANGELOG entry specifies a per-member clock-in fence.** Recent location work (backend Phases
43/45 — consent + ambient + retention) left the global-fence model untouched. So this is a **new contract
change**, and the enforcement gap is **entirely backend-owned**.

## 2. The gap (backend `[api]`+`[db]`)

To make clock-in enforce "within 200 m of the member's OWN pin," the backend must add:

1. **A per-member clock-in fence** (data). Pick the source field (recommended below).
2. **Enforcement keyed to the caller.** `checkClockGeofence` must accept the member's fence (the clock-in
   handler already loads `userProfile` at `timeTracker.js:281`, so it can pass it — the util just has no
   parameter/branch for it today).
3. **A fallback policy** for a member with no pin set (recommended: fall back to the existing global office
   fence — non-regressive, so nobody is locked out before pins are assigned).
4. **An admin set endpoint** to assign a member's clock-in location from the panel, writing the field clock-in
   actually reads. (`PUT /admin/rules/:userId` writes `attendanceRules.geo`, which clock-in ignores — so as-is
   it does nothing for clock-in.)
5. **`GET /geofence` returns the caller's OWN effective fence** (their pin, or the global fallback), so the app
   pre-checks against the right circle.

Keep the accuracy-credit logic (`min(accuracy,100)` tolerance, `>300 m` reject) unchanged — it is fence-agnostic.

## 3. Recommended design (mechanism is `cgpe-api`'s call; flagged, not locked)

- **Source field:** reuse **`PayrollProfile.start_location`** — the contract already names it "the clock-in
  pin," so the intent was pre-earmarked. Add a per-member `radius_m` (default **200**) or treat 200 m as a
  fixed org constant + the existing 100 m accuracy credit. If instead `Profile.attendanceRules.geo` is chosen,
  resolve the metres-vs-km unit conflict first. **This is a product/architecture decision for `cgpe-api`.**
- **Fallback:** member pin → else global `office_geofence` → else `DEFAULT_OFFICE`. First-with-a-value wins
  (same non-regressive philosophy as Phase 27's candidate-key chain — a member peels onto their own fence only
  when assigned).
- **Radius:** owner said **200 m**; recommend fixed 200 m default unless a per-member radius is explicitly
  wanted. Confirm whether the effective ceiling stays 200 m + 100 m credit = ~300 m (unchanged from today).
- **Tangential bug flagged (not this ask):** `PUT /geofence`'s default is **2000 m** while the code default is
  200 m, so a save without `radius_m` widens the global fence 10× (`api.md:501`). Left for `cgpe-api`.

## 4. What mobile does: NOTHING to build (pure consumer, server-authoritative)

Mobile clock-in is **already fully server-authoritative** and **fence-shape-agnostic**:

- `getGeofence()` (`src/data/api.ts:1707`) reads `GET /time-tracker/geofence` into `{lat,lng,radius_m,label,
  enforce}` and validates the shape — it does not care whether the served fence is global or per-member.
- `checkGeofence()` (`api.ts:1788`) is a client pre-check whose one rule is "never refuse what the server would
  allow"; `POST /clock-in` re-validates and is the authority (`api.ts:1819-1840`), and a **403 returns the
  server's own `message` + `distance_m` verbatim** (`api.ts:1829`).

So the moment the backend serves the caller's own fence through `GET /geofence` and enforces clock-in against
it, **the app pre-checks against the right circle and renders the right refusal with zero `src/` change** — the
same Phase 27 / Phase 38 "pure backend, mobile fail-open consumes" outcome. The DONE-WHEN criterion ("clock-in
only within 200 m of the member's own location") is met entirely by the backend change.

Nothing to build ⇒ **no gate re-run** (baseline stands). The 200 m + accuracy-credit rule the roadmap told us to
"confirm against the contract" is confirmed above (§1): 200 m default, +100 m credit → ~300 m effective, coarser
than 300 m rejected — and the mobile pre-check already mirrors it correctly (Phase 7).

## 5. Deliverable

A verified `→ cgpe-api · from cgpe-mobile` INBOX ask (per-member clock-in fence: data field, caller-keyed
enforcement, non-regressive fallback, admin-set + self-read endpoints) **plus a plain-language owner-relay copy**
(the courier workflow — owner relays `[api]` asks). Necessary-but-not-sufficient: per-member fencing is live only
when `cgpe-api` ships the enforcement + a panel/admin way to set each member's pin + an on-device check (a member
inside their pin clocks in; 201 m away is refused with the measured distance).

## 6. Decisions
- **D-1: nothing mobile-side to build** — enforcement is server-authoritative and the app is fence-agnostic, so
  a per-member fence served through the existing endpoint just works. Do not invent a mobile fence or UI.
- **D-2: recommend but do not dictate the source field.** `PayrollProfile.start_location` is the contract's own
  "clock-in pin," but the field/unit/radius choice is `cgpe-api`'s. File the four mechanism-agnostic guarantees
  (caller-keyed enforcement / non-regressive fallback / 200 m + accuracy credit confirmed / a way to SET a pin).
- **D-3: fallback must be non-regressive** — a member with no pin keeps clocking in against the global office
  fence, never blocked, until an admin assigns their location. No big-bang lockout.

## 7. Done when
`cgpe-api` enforces clock-in against the caller's own 200 m fence with a global fallback, exposes a set + a
self-read path, and a device check confirms a member is allowed inside their pin and refused outside it with the
measured distance. No mobile code required unless the served fence shape changes.

## 8. SHIPPED by `cgpe-api` (Backend Phase 50) + VERIFIED — 2026-08-14

Filed same day; `cgpe-api` shipped it the same day as **Backend Phase 50**, implementing all five points as
recommended. **Verified against their real code** (not the summary), and mobile owes **zero change** — confirmed:

- `getMemberGeofence(userId)` (`utils/geofence.js:91-112`) — member `payroll_profiles.start_location` → global
  `office_geofence` → `DEFAULT_OFFICE`; **centre-only** per-member, org `radius_m`/`enforce` kept (one radius
  knob, no invented number); returns the same shape `+source ∈ member|office`.
- **Clock-in enforces the caller's fence** — `getMemberGeofence(userProfile.user_id)` →
  `checkClockGeofence(lat,lng,acc,memberFence)` (`routes/timeTracker.js:322-323`); clock-out likewise
  (`:504-505`, still non-blocking per Phase 7). `checkClockGeofence(...,fence?)` is backward-compatible and the
  `min(acc,100)` tolerance / `>300 m`-reject logic is unchanged (`:122-145`).
- **`GET /geofence`** returns the caller's own effective fence, **shape unchanged** `{lat,lng,radius_m,label,
  enforce}` + additive `source` (`:1274-1277`).
- **Set the pin:** the existing admin `PUT /api/payroll/profiles/:userId {start_location:{lat,lng}}` — no new
  endpoint. (`attendanceRules.geo`, written by `PUT /admin/rules/:userId`, is a different field and still drives
  only the break fence.)
- **Flagged bug fixed:** `PUT /geofence` default `radius_m` is now `DEFAULT_OFFICE.radius_m` (200), no more
  2000 m 10× widening (`:1296-1298`).

**Mobile confirmed inert:** `getGeofence`/`checkGeofence` (`src/data/api.ts:1707/1788`) map the fixed
`{lat,lng,radius_m,label,enforce}` shape and **ignore `source`**; the caller's own fence flows through and the
403 `message`/`distance_m` renders verbatim — **no `src/` change**. The `label`→"Your assigned location" is also
inert (our clock-in copy is distance-based, not label-based). **Remaining: a device check only** — a member
inside their pin clocks in; ~201 m away is refused with the measured distance — after an admin sets a member's
`start_location` and the `:3001` restart lands. INBOX box is `cgpe-api`'s (already ticked); mobile RE-VERIFIED
note filed underneath (grepped back durable).
