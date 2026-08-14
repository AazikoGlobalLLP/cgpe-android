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

## 8. Mobile build order (each is a device-checked sub-phase; nothing built yet)

- **41a — consent + wiring:** consent screen (needs §1 copy) + battery-opt step in the permission ladder +
  ambient recorder wired to `POST /track/ambient` + neutral 24/7 foreground notification. Depends on: §1
  copy + Phase 43 live.
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
