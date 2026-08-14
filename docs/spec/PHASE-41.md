# PHASE 41 — 24/7 Location & Activity: transparent · consented · mandatory · robust · battery-smart

**Status:** FINAL PLAN LOCKED — backend Phase 43 SHIPPED (consent-based, fits) · retention ask filed ·
mobile build sequenced (not yet built) — 2026-08-14. Owner-escalated to #1
(`docs/PLAN-2026-08-14.md` §41; DECISIONS 2026-08-14, top). Internal side-loaded team app (not a store app).

---

## 0. Locked principles (owner, 2026-08-14 — the rails everything else obeys)

1. **Transparent, never hidden.** Staff are told and asked — a clear consent notice + "Allow all the
   time". The app does NOT conceal that it collects location; the OS notification/indicator stay.
2. **Consented + mandatory.** Consent is required to *use* the work app (grant or you can't proceed), so it
   is both informed AND non-negotiable — no "quietly opt out and slack".
3. **No loophole — enforced transparently.** Staff must not be able to *bypass/disable* tracking to dodge
   it. We close loopholes by **detecting** tampering (permission revoked, location off, service killed,
   mock location) and **alerting the master + blocking the app** until fixed — never by secret force and
   never by hiding. Staff always know it is on; they just can't silently defeat it.
4. **Battery-first.** The app must NOT be a visible battery drain. Adaptive, motion-aware, low-accuracy,
   batched sampling — measured on real devices.
5. **Master-only visibility** (Phase 40, shipped) and **retention 90-day soft-delete / 180-day
   hard-delete** (owner-set).
6. **Two hard lines that remain (now aligned with the owner):** no suppression of the OS
   notification/indicator, and no security-review evasion. Both are unnecessary here because the model is
   transparent, and the foreground notification is technically required for reliability anyway (§3).

## 1. Consent & onboarding (transparent — the "bata ke, puch ke" part)

- **First-login consent screen** (all 5 app languages — **human copy owed**, machine translation forbidden,
  PHASE-19 §4): what is collected (precise location + activity, 24/7 incl. off-duty), why (field-force
  management), who sees it (Master only), retention (90/180), and that it is a condition of the app.
  **"I Agree" is required to continue** — decline ⇒ can't use the app (mandatory), not a silent skip.
- On Agree → `POST /api/time-tracker/consent {granted:true}` (backend Phase 43, shipped).
- **Permission ladder** (order matters — Android auto-denies background before foreground):
  foreground → background ("Allow all the time") → **battery-optimisation exemption** prompt. All already
  half-built in `ensureBackgroundPermission` (`tracker.ts:308`); extend with the battery-opt step.

## 2. 24/7 capture engine — reliability against OS background-kill (★ the owner's core question)

Layered defence, Android (present levers noted; the rest is the build). All device-only, untestable in
Vitest/web (`tracker.ts` has no stub).

1. **Foreground service — primary anti-kill (PRESENT).** Reuse the shift recorder's service
   (`killServiceOnDestroy:false`, `tracker.ts:412`). Requires the ongoing notification — **transparent,
   neutral wording** ("CGPE Connect — location on for work"). Survives app-swipe + normal Doze.
2. **Battery-optimisation exemption (NEW).** Add `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`; prompt via
   `expo-intent-launcher`. OEM auto-start (Samsung Device Care / MIUI Autostart / Oppo-Vivo-Realme) set at
   **device provisioning** since devices are mandatory/managed. Ref: dontkillmyapp.com.
3. **Reboot persistence (NEW — the one genuinely-new native piece).** expo-location's task does NOT
   survive a reboot. Add `RECEIVE_BOOT_COMPLETED` + a small **config plugin** with a native `BootReceiver`
   that re-arms `startLocationUpdatesAsync`. (Read SDK-57 docs first — AGENTS.md.)
4. **Watchdog re-arm (NEW).** `expo-task-manager` + `expo-background-task` periodic (~15 min min) checks
   `hasStartedLocationUpdatesAsync()` and restarts if killed.

**Honest ceiling:** even fully configured, a few aggressive OEMs kill exempted services; ~100 % on every
handset is not softwarely guaranteed. iOS cannot do true continuous 24/7 (best: Always + significant-change
+ region monitoring). Fleet is Android-first, so this is a documented limit, not a blocker.

## 3. Battery efficiency (owner priority — "battery speed me na ghate")

- **Motion-adaptive sampling.** Use activity recognition (§5) to go **sparse when still** (e.g. one fix
  every few min / on significant-change) and **denser when moving/driving**. Stationary staff cost almost
  nothing.
- **Low/Balanced accuracy**, `distanceInterval` (no fix without real movement), `deferredUpdatesInterval`
  batching (already 60 s) — GPS is the battery cost; minimise fixes, not coverage.
- **Batched, backed-off uploads** (already batched in `tracker.ts`); coalesce, retry with backoff, never
  spin on a dead network.
- **Target + proof:** measure % drain over a real day on 3+ handsets; tune until it's a small single-digit
  overhead. This is a device-only acceptance gate.

## 4. Activity tracking (owner also asked — scoped as 41c)

`ACTIVITY_RECOGNITION` permission + a motion source (`expo-sensors` Pedometer/Accelerometer, or Google
Activity Recognition via a native module). Classifies still / walking / driving — **doubles as the battery
adaptivity input** (§3). Its own permission + design; does not block the location core.

## 5. Anti-circumvention — "loophole nahi dhundhne dena" (transparent enforcement, 41d)

Staff know tracking is required; they must not be able to *silently* defeat it. All of this is visible/
honest, never covert:

- **Permission & services monitor** — on every app open + periodically, verify foreground+background
  location, location-services-on, and battery-opt exemption. Any off ⇒ **block the app** behind a "Turn
  location back on to use CGPE Connect" screen **and** flag the master (backend).
- **Mock-location detection** — reject/label `isFromMockProvider` fixes so a fake-GPS app can't spoof a
  location.
- **Service-liveness + gap detection** — the watchdog re-arms; the **backend** flags a user who sends no
  points for > X hours during expected windows (a force-stopped app leaves a gap) → master alert.
- **Consent-withdrawal signal** — if the OS permission is revoked, the app can send
  `POST /consent {granted:false}`, which (Phase 43) notifies every super_admin. So an opt-out is loud, not
  silent.

## 6. Data, privacy & visibility

- **Master-only** map/replay (Phase 40, shipped) — off-duty location is even more sensitive, so this gate
  is load-bearing.
- **Retention:** 90-day **soft-delete** (hidden from all reads incl. master), 180-day **hard-delete**
  (purge). Backend job — filed (§7). Applies to shift AND ambient tracks.
- **Off-duty vs on-duty** stays distinguishable (`off_duty` flag, Phase 43) → Phase 42 green/red colouring.

## 7. Backend status (cgpe-api)

- ✅ **SHIPPED — backend Phase 43** (verified in real code): `Profile.location_consent`,
  `POST /consent` (+ super_admin notify on withdrawal), `me.location_consent` on `GET /rbac/config`,
  `POST /track/ambient` (consent-gated, token-attributed, `ambient:<uid>:<date>`, `off_duty:true`),
  ambient skips the ≤100 m drop, both track routes return `dropped` + carry `off_duty`. **This fits our
  transparent-consent model exactly** — no change to the gate needed (the earlier "strip consent" idea is
  dropped; consent is now a feature, not an obstacle).
- ⏳ **Filed (retention):** soft-delete > 90 d / hard-delete > 180 d job. Owner relays.
- ⏳ **Flagged for the anti-circ layer (§5):** a backend "silent user" gap-detector → master alert (design
  later, pairs with the master surface Phase 39).
- ⚠️ Phase 43 is uncommitted / needs `:3001` restart (their own note) before it is live.

## 8. Mobile build order (each is a device-checked sub-phase)

- **41a — consent + wiring.** Split into a testable data layer (done) and the copy/device-blocked UI:
  - ✅ **41a-i — data layer BUILT (2026-08-14).** Two additive, fully-tested `src/data/api.ts` wire
    functions against the shipped-and-verified Phase 43 contract (`api.md` §`/api/time-tracker` Phase 43
    block) — no invented values, no copy needed, green-gateable in Vitest (unlike device-only `tracker.ts`):
    - `setLocationConsent(granted, version?)` → `POST /time-tracker/consent`; 3-outcome posture
      (`ok`/`refused`/`error`) mirroring `getMyEarnings`/`getMdrtTier`; never fabricates a granted state.
    - `postAmbientPoints(points, date?)` → `POST /time-tracker/track/ambient`; token-attributed (NO
      `session_id`), returns `{outcome, added, dropped}` where **`consent-required`** (403) means stop +
      drop buffer; silent like `postTrackPoints` (a background recorder never raises the outage banner).
    - Pinned by NEW `src/data/__tests__/api-ambient.test.ts` (19): the request bodies, the 200 `added`/
      `dropped` handling, the no-`session_id` invariant, and every failure branch incl. 403→stop and the
      quiet-vs-banner health classification. Gates: `tsc` 0 · `npm test` **454/454** (+19).
  - ✅ **41a-ii — consent copy + screen BUILT (2026-08-14).** Owner supplied the 5-language copy
    (translation-v.01), unblocking both:
    - **i18n:** 19 `consent.*` keys landed in all five dictionaries (human copy, not machine-translated);
      parity gate bumped 75 → 94; `tsc` proves every dictionary carries all 19. `docs/i18n/PHASE-41-CONSENT-COPY.md`.
    - **Screen:** NEW `src/app/consent.tsx` — mandatory (no back / no skip), renders the notice in the
      active language, Agree → `setLocationConsent(true, 'v.01')` → on a real 200 proceeds to Home (never
      claims consent it did not record; a failure keeps the user on the notice with a retry Banner),
      Decline → an honest "you cannot continue" sub-state. Version `'v.01'` tracks the owner's copy version.
    - Gates: `tsc` 0 · `npm test` **454/454** · lint 0 errors / 12 warnings (baseline).
  - ✅ **41a-iii-a — consent READ (the boot-gate input) BUILT (2026-08-14).** `getLocationConsent()`
    in `src/data/api.ts` reads `GET /rbac/config` `me.location_consent` and returns `ok`(granted/
    withdrawn/pending) / `error`. A **genuinely new read path** — nothing read `/rbac/config` before
    (the layout comes from `/rbac/app-ui` via `normalizeUiConfig`, which drops unknown fields), and `me`
    is **TOP-LEVEL** on this envelope (`{ success, config, me }`), so it reads `json.me.location_consent`,
    NOT `json.data`. **Fail-open + fully SILENT by design:** absent block (Phase 43 not yet deployed) /
    non-2xx / dead network all collapse to `error`, which the gate treats as "don't redirect", and the
    read never touches the health channel (it runs every cold start and drives an invisible gate — a
    banner would be the permanent-outage anti-pattern; `/rbac/app-ui`'s boot fetch reports config health).
    Pinned by NEW `src/data/__tests__/api-consent-read.test.ts` (10): the `json.me` (not `.data`) unwrap,
    all three enum states, absent/odd fields → null, and the silent fail-open on legacy-body / 5xx / 403 /
    network. Gates: `tsc` 0 · `npm test` **464/464** (+10) · lint 0 errors / 12 warnings (baseline;
    unchanged). Green-gateable — the read is editor-testable even though its consumer (the gate) is not.
  - ✅ **41a-iii-b (part 1) — the consent BOOT GATE (redirect) BUILT (2026-08-14).** The signed-in →
    `/consent` redirect is wired, editor-verifiable and gate-green; only its on-device UX check remains.
    - **Pure decision:** NEW `needsConsentGate(read)` in `src/data/api.ts` beside `getLocationConsent` —
      redirect ONLY on `ok` + non-granted (`pending`/`withdrawn`); `granted`→no; **`error`→no (FAIL OPEN)**.
      Extracted so the fail-open invariant (an outage/legacy-backend/dead-network must never bounce every
      user to the wall) is pinned by a test, not buried in an effect. +3 cases in `api-consent-read.test.ts`.
    - **Wiring:** NEW headless `ConsentGate` in `src/app/_layout.tsx`, mounted in `RootNav` beside
      `AppLock`/`JobPill` (the live nav context — JobPill navigates from there). Fires **once per signed-in
      session** (a `checked` ref, reset only on sign-out) so it can't loop; the consent screen's own success
      path `replace`s to Home and never re-triggers it. **Native-only** (the gate enables the native recorder;
      web has none, and the e2e web harness must keep reaching every screen). No `let alive` guard — the
      component is process-lifetime (like AppLock) and does no setState, only a one-shot `router.replace`
      (`/consent` cast `as Href`, matching `attendance.tsx:240`'s `/earnings`, until `expo start` regenerates
      the route types). Runs at `_layout.tsx` level, NOT `index.tsx` (which only mounts at `/`), so it
      survives Expo's restored-route cold start.
    - Backend unblock confirmed: `909b117` (backend Phases 43-46) is **committed + live on `:3001`**
      (cgpe-admin INBOX re-verify), so the Phase-34 OPS trap no longer holds.
    - Gates: `tsc` 0 · `npm test` **467/467** (+3) · lint 0 errors / 12 warnings (baseline). No contract
      change → no INBOX/CHANGELOG. Commit local (push 403s).
    - **Device-only check still owed:** that a non-granted user lands on `/consent` with no Home
      flash-then-bounce and no loop, and survives a restored-route cold start (no test stub reaches boot nav).
  - 🔨 **41a-iii-b (part 2) — the `tracker.ts` device pieces BUILT IN EDITOR, DEVICE-UNVERIFIED (2026-08-14).**
    Owner chose "write it all now" (AskUserQuestion) so the handset session is pure build-and-verify. Shipped the
    full §12 code: the ONE unified recorder in `tracker.ts` (§12.1 — `ingest` attributes by shift `sid` at flush,
    `deliverAmbient`→`postAmbientPoints` for off-duty, `start/stopTracking` repurposed to flip attribution not
    stop the service); NEW exports `startAmbientTracking`/`stopAmbientTracking`; the battery-opt step in
    `ensureBackgroundPermission` (§12.3, once-per-install); the neutral 24/7 notification persisted at arm time
    and read back at `startLocationUpdatesAsync` (§12.4); the two start triggers wired (§12.5) — `consent.tsx`
    onAgree (prompt) + `_layout.tsx` boot gate (no prompt, fail-open). `app.json` +
    `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`; `expo-intent-launcher` 57.0.1 installed. Non-consented path is
    byte-identical (§12.1). Gates green (`tsc` 0 · `npm test` 467/467 · lint 0/12) but **none of it is
    device-verified** — `tracker.ts` has no stub and the file "looks fine in foreground, breaks only after a
    process kill." The §12.7 matrix on a fresh EAS build + 3+ handsets is the acceptance gate. Deliberate §12
    reconciliations: DECISIONS 2026-08-14 (top). **Not yet wired:** `stopAmbientTracking` → sign-out/withdrawal
    (self-heals via the next flush; later slice). The consent screen + read + gate render/resolve standalone;
    `/consent` stays web-demoable.
- **41b — reliability:** boot-receiver config plugin + watchdog task (§2).
- **41c — battery + activity:** motion-adaptive sampling + activity recognition (§3/§4).
- **41d — anti-circumvention:** permission/mock/gap detection + app-gating + master alerts (§5).
- Gates each: `tsc` 0 · `npm test` green · no new lint errors · **on-device** matrix
  (Samsung/Xiaomi/OnePlus/Pixel + one iPhone; battery-drain measured).

## 9. Owner action items

1. **Relay the retention ask** (§7) to cgpe-api.
2. **Supply consent-notice copy** in all 5 languages (§1) — the only thing blocking 41a's screen.
3. **Provision devices** (battery-opt exemption + OEM auto-start) since tracking is mandatory — this is
   what makes §2 reliable in the field.

## 10. Honest limits (so nothing is over-promised)

100 % on every OEM is not softwarely guaranteed; iOS is not truly continuous; the foreground notification
cannot be removed. Within those, this plan gets a mandatory, transparent, robust, low-battery 24/7 tracker
that staff cannot silently disable — the outcome the owner asked for.

## 11. Decisions

- **D-1: transparent + consented + mandatory** (§0.1-0.2) — consent required to use the app; informed, not
  hidden. Reverses the interim "covert/no-consent" idea; aligns with backend Phase 43.
- **D-2: no-loophole = transparent detection + enforcement** (§5), never secret force or concealment.
- **D-3: battery-first is a hard acceptance gate** (§3), measured on device.
- **D-4: backend Phase 43 fits as-is** (§7); only the retention job is owed + the anti-circ gap-detector
  later. No consent-strip.
- **D-5: honest ceilings documented** (§10) — not sold as a guarantee.
- **D-6: two hard lines remain** (§0.6) — no notification/indicator suppression, no security-review
  evasion. Now moot because the model is transparent.

---

## 12. Device execution plan — 41a-iii-b part 2 (the `tracker.ts` device pieces)

Written 2026-08-14 so the on-device session is **execution, not design**. Everything below is a locked
decision unless flagged "device call". Nothing here is editor-*verifiable* — see §12.0.

> **STATUS 2026-08-14: the code below is now WRITTEN in the editor** (see §8's 41a-iii-b part-2 bullet and
> DECISIONS 2026-08-14 top for the exact reconciliations). Gates are green but **nothing here is
> device-verified**. This section stays as the execution/verification checklist for the handset session — walk
> §12.7 against the built code, don't re-author it. Note the code diverges from the plan in a few flagged,
> safer ways: `track.ambient` is read fresh from storage per attribution (not a once-per-JS-start module flag);
> `startAmbientTracking` takes the resolved `notif` strings as a param; the battery-opt prompt is gated to
> once-per-install; `expo-intent-launcher` is a top-level import (web-safe `{}` shim).

### 12.0 Why this is a build-and-device session, not an editor one
- **New native surface → a fresh EAS/dev-client build is required (not Expo Go).** `expo-intent-launcher`
  is **not installed**; `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` and `RECEIVE_BOOT_COMPLETED` are **not** in
  `app.json` (only `ACCESS_FINE/COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_LOCATION` are). Adding a native module + permissions changes the native project.
- **`tracker.ts` has no test stub** (no `expo-location`/`expo-task-manager`/`expo-intent-launcher` mocks) —
  every change is provable only on a handset, and the file's own header warns a mistake "looks fine in
  foreground, breaks only after a process kill." So `tsc`/lint green ≠ working here.
- Backend is LIVE (`909b117`, Phases 43-46 on `:3001`), so this is device/build-gated only, not backend-gated.

### 12.1 Architecture (LOCKED): ONE unified 24/7 recorder, per-batch attribution
Do **not** run a second location task for ambient. Reasons: §2.1 ("reuse the shift recorder's service"),
§3 battery (one GPS stream, not two — a second task doubles the drain that §3 exists to minimise), and one
Android location foreground-service/notification. Design:
- The single `ROUTE_TASK` service runs **continuously while (consent granted AND background permission)**.
  Clock-in/out **no longer start/stop it** — they only **set/clear the shift `sid`** in persisted state,
  which flips per-batch attribution.
- **Attribution rule (in `ingest`, at each flush):** `state.sid` present ⇒ **shift** (existing `deliver` →
  `POST /track/points`); absent ⇒ **ambient** (new `deliverAmbient` → `postAmbientPoints`, `off_duty` on the
  server). The whole batch is attributed by the `sid` at flush time; a batch straddling a clock-in/out
  boundary mis-attributes at most one `deferredUpdatesInterval` (~60 s). **Device call:** accept that for v1
  (documented), or split the batch by timestamp against the clock event — not worth the complexity for v1.
- **Graceful degradation (LOCKED):** if consent is **not** granted, keep today's exact shift-only behaviour
  (service starts on clock-in, stops on clock-out, `/track/points` only). The 24/7 mode is additive and
  only engages under granted consent, so a not-yet-consented user is never worse off, and a consent read
  that fails open (`error`) never starts 24/7 recording blindly.

### 12.2 `tracker.ts` changes (precise)
- **New persisted marker** `track.ambient='1'`, set when 24/7 mode is armed (consent granted), cleared on
  withdrawal/sign-out. The module reads it once per JS start (beside the existing `running` hydration) to
  know whether it may run 24/7 after a headless wake.
- **New export `startAmbientTracking({ prompt }: { prompt: boolean })`** — idempotent. `prompt:true` (from
  the consent-grant tap) runs `ensureBackgroundPermission()` (which now includes the battery-opt step,
  §12.3) and only proceeds if background permission is granted; `prompt:false` (from boot when already
  granted) starts the service **only if** background permission is already held, never prompting. On
  proceed: set `track.ambient='1'`, **persist the resolved notification strings** (§12.4), and start
  `ROUTE_TASK` if not already running (same `startLocationUpdatesAsync` options as the shift recorder, but
  the neutral 24/7 notification).
- **New export `stopAmbientTracking()`** — on consent withdrawal or sign-out: flush any buffered points
  (ambient), `stopUpdates()`, clear `STATE_KEY` + `track.ambient`.
- **Repurpose `startTracking(sid)` / `stopTracking()`** to mean "begin/end SHIFT attribution", not
  "start/stop the service":
  - `startTracking(sid)` — if `track.ambient` armed: set `state.sid=sid` + `api.startTrack(sid)` and ensure
    the service is running (start it if, exceptionally, it is not), but do **not** restart a running
    service. If not armed: today's behaviour unchanged.
  - `stopTracking()` — if `track.ambient` armed: flush shift points via `deliver`, `api.stopTrack(sid)`,
    clear `state.sid` (attribution drops to ambient) but **leave the service running**. If not armed:
    today's behaviour (flush, `stopUpdates`, clear) unchanged.
- **`ingest` routing** — replace the single `deliver(state.sid, state.pts)` with: `state.sid` ⇒ `deliver`
  (unchanged); else ⇒ **`deliverAmbient(state.pts)`**:
  - Rehydrate the token first (reuse `deliver`'s pattern — `postAmbientPoints` checks `sessionReal` and does
    NOT read storage, so a headless context has no token otherwise).
  - Call `api.postAmbientPoints(toPoints(pts), localDate())` — pass local `YYYY-MM-DD` so the server keys
    `ambient:<uid>:<date>` correctly across midnight.
  - Map outcomes (from `AmbientDelivery`): `sent` ⇒ drop buffer; **`consent-required` ⇒ consent was
    withdrawn server-side → `stopAmbientTracking()` + drop** (loud opt-out already reached the master, §5);
    `signed-out` ⇒ stop + drop (like the shift path); `refused` (other 4xx) ⇒ drop (won't improve on retry);
    `retry` (5xx/429/network) ⇒ keep for the next wake.

### 12.3 `ensureBackgroundPermission` — the battery-opt step
- `npm i expo-intent-launcher` (SDK-57-compatible). Add `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` to
  `app.json` → `expo.android.permissions`.
- After background permission is granted, **Android only**, launch the exemption request:
  `IntentLauncher.startActivityAsync('android.settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  { data: 'package:com.cgpe.connect' })`, wrapped in try/catch, **best-effort and non-blocking** — it never
  flips `granted` to false. **Known limit (device call):** JS cannot read `PowerManager.isIgnoringBattery
  Optimizations` without a native module, so we can't confirm the exemption was accepted from JS; a tiny
  native module could report it later (41b/41d), not now.
- Keep the existing foreground/background location gating exactly as-is; battery-opt is a reliability
  booster layered after, not a new hard gate.

### 12.4 The neutral 24/7 foreground notification
- Use the already-landed copy `consent.serviceTitle` / `consent.serviceBody` (41a-ii, all 5 languages).
- **Persist the RESOLVED strings** (`storage.set('track.notif', JSON.stringify({title,body}))`) at the
  moment 24/7 is armed in-app (i18n is available then), and read them back in the `foregroundService`
  config at `startLocationUpdatesAsync`, falling back to a neutral English default if absent. Rationale: a
  headless service restart (41b boot-receiver) has **no i18n context**, exactly as the current hardcoded
  shift strings note — so the language must be captured at arm-time, not resolved at start-time.

### 12.5 Wiring the start triggers (integration surface)
- **`src/app/consent.tsx`** `onAgree` success: after `setLocationConsent(true,…)` returns `ok`, call
  `startAmbientTracking({ prompt: true })` **before** `router.replace('/(tabs)/home')` (so the permission +
  battery-opt ladder runs at the grant moment, the one place a dialog belongs).
- **Boot (already-granted users):** extend the boot gate — when `getLocationConsent()` returns
  `ok`+`granted`, call `startAmbientTracking({ prompt: false })` (start the service if permission is already
  held; never prompt on a cold start). This can live in `ConsentGate` (rename its intent to "consent gate +
  recorder arm") or a sibling effect; keep the once-per-session guard.
- **`src/app/(tabs)/home.tsx`** clock-in/out: no call-site change — it keeps calling
  `ensureBackgroundPermission()`/`startTracking(sid)`/`stopTracking()`; the new semantics live inside
  `tracker.ts` (§12.2).

### 12.6 Native build steps
1. `npm i expo-intent-launcher`. 2. `app.json`: add `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (note:
`RECEIVE_BOOT_COMPLETED` + the boot-receiver config plugin are **41b**, not this sub-phase).
3. `eas build -p android --profile preview` → install the APK. `tsc`/lint must still pass, but they do not
prove the recorder.

### 12.7 Device verification matrix (the acceptance gate)
1. Grant consent → the 24/7 service notification appears with **neutral wording in the user's language**.
2. Off-duty (not clocked in), phone pocketed, move → points land as **ambient / `off_duty:true`** (confirm
   via the master surface or DB); coarse fixes are kept (no ≤100 m drop on ambient).
3. Clock in → same service, points now attributed to the **shift** (`/track/points`); clock out → shift is
   sealed (`stopTrack`) and recording **drops back to ambient without the service stopping**.
4. Swipe the app away → the service survives and keeps recording in whichever mode applies.
5. Battery-opt prompt appears **once** after the background grant; accepting it makes the service more
   kill-resistant on aggressive OEMs.
6. Withdraw consent server-side → the next ambient flush gets `403 consent_required` → the service **stops**
   and the buffer is dropped (no un-consented recording).
7. **FAIL-OPEN:** a consent read `error` on boot starts **no** 24/7 recording and gates nobody.
8. **Battery drain measured over a real working day on 3+ handsets** (Samsung/Xiaomi/OnePlus/Pixel) — the §3
   hard acceptance gate; target a small single-digit %. If it exceeds that, motion-adaptive sampling (41c)
   is the mitigation, not shipping as-is.

### 12.8 Open questions to resolve on-device (flagged, not blocking the plan)
- Boundary-batch attribution (§12.1) — accept the ~1-interval slop, or split by timestamp.
- Whether running the foreground service 24/7 (vs shift-only today) is within the §3 battery budget on the
  worst OEM — the §12.7.8 measurement decides; 41c (motion-adaptive) is the lever if not.
- Battery-opt acceptance is unreadable from JS (§12.3) — leave as best-effort now; a native reporter later.
