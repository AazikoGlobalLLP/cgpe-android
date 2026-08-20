# PHASE 56 — iOS enablement

**Status:** editor-side prep BUILT + config-validated (2026-08-20). **Owner-gated on an Apple
Developer Program account ($99/yr)** before a real-iPhone / TestFlight build can be signed. An
**Apple-account-free iOS Simulator build is buildable right now** (proves the native iOS target
compiles).

Session `cgpe-mobile`. `[m]` only — **no contract change**, no `../contracts/` edit.

---

## 1. What this phase is

The app has always *targeted* iOS (`ios.bundleIdentifier = com.cgpe.connect`, permission strings via
config plugins) but has **never been built for it** — there was no `ios` build profile in `eas.json`
and iOS signing needs Apple credentials EAS does not have. The owner set iOS as **mandatory** (issues
batch 2026-08-18). This phase does every piece that does **not** require the Apple account, and hands
the owner an exact runbook for the piece that does.

This is a **CNG project** (no `ios/` or `android/` directory in the tree — verified). All native
Info.plist / entitlement wiring is produced by the config plugins at prebuild time; we never hand-edit
a plist.

## 2. What was built (editor-side, this phase)

All three changes were validated against `npx expo config --type introspect` (runs every config plugin
in memory and emits the final native config) — the resolved iOS config is correct.

1. **`eas.json` — new `ios-simulator` build profile** (`distribution: internal`, `ios.simulator: true`).
   An iOS Simulator build needs **no Apple Developer account and no code-signing** (SDK-57 docs,
   build-reference/simulators). This is the profile that is buildable *today* and proves the iOS native
   target compiles with the whole native module set (reanimated, webview, secure-store,
   local-authentication, location, background-task, notifications, sensors, calendar).
   - `preview` (`distribution: internal`) is unchanged — for Android it still emits the APK the owner
     relies on; for iOS it means an **ad-hoc device** build once credentials exist (each iPhone UDID
     must be registered).
   - `production` is unchanged — `distribution` defaults to `store` → the **TestFlight / App Store**
     path once credentials exist. `appVersionSource: remote` + `autoIncrement` manage `CFBundleVersion`.

2. **`app.json` `ios.config.usesNonExemptEncryption: false`** — the documented Expo field; it stamps
   `ITSAppUsesNonExemptEncryption = false` in the Info.plist (confirmed in the introspected config).
   The app uses **only standard TLS/HTTPS** (no custom/proprietary cryptography), which is the Apple
   "exempt" case, so `false` is factually correct and it removes the manual export-compliance question
   App Store Connect otherwise asks on **every** TestFlight upload. Not a guess — grounded in what the
   network layer actually does (`src/data/api.ts` is HTTPS `fetch` only).

3. **`app.json` `ios.icon` → `./assets/images/ios-icon.png`** (NEW asset). The previous value
   (`./assets/expo.icon`) was the **default Expo template icon** (a blue arrow on a grid) — it would
   have shipped as the iOS app icon. `ios-icon.png` is a generated **1024×1024, opaque** icon: the
   real CGPE brand mark (`assets/images/cgpe-logo.png`) centered on `#ffffff` — the *same* white the
   Android adaptive icon (`android.adaptiveIcon.backgroundColor`) and the splash screen already use, so
   iOS matches Android. It is opaque (no alpha) because Apple rejects alpha in app icons; the brand
   source is 827×975 with transparency and could not be used directly. Generated with:
   `cgpe-logo.png` alpha-composited onto a 1024² white canvas at ~78% scale (clear of the iOS corner
   mask), LANCZOS resample, saved RGB. Reversible; no existing asset was overwritten.

**Gates:** `tsc` 0 · `npm test` **763** · eslint 0 (no `src/` change — TypeScript is untouched, so the
three code gates are unaffected; `expo config --type introspect` is the gate that matters here and it
passed clean).

## 3. Honest iOS 24/7 limits — DO NOT promise Android parity

iOS is a **first-class app** for login, all data screens, the WKWebView map, Face ID unlock, and it
**records the on-duty field route while the app is alive or backgrounded** ('Always' location
permission, the blue status indicator). It **cannot** match Android's always-on tracker:

- After a **force-quit**, iOS stops delivering background location updates until the app is reopened —
  there is no equivalent to Android's foreground service that keeps running.
- After a **reboot**, recording stays off until the app is opened once (no `RECEIVE_BOOT_COMPLETED`
  equivalent that can silently re-arm).
- The reliability watchdog is **opportunistic** — iOS `BGTaskScheduler` decides *when* a background
  task runs (battery, network, usage patterns); the interval is a *minimum delay*, not the ~15-min
  WorkManager cadence Android gives. **iOS Simulator cannot run Background Tasks at all** — that path
  is physical-device only.

`src/lib/tracker.ts` is architected around Android's foreground service (`isAndroidForegroundServiceEnabled`)
which iOS ignores; `expo-intent-launcher` (battery-optimisation deep-links) is Android-only and every
call site is already `Platform.OS === 'android'`-guarded, so it degrades cleanly on iOS. **The correct
owner message: make iOS reliable for everything EXCEPT the guaranteed-after-force-quit-or-reboot
tracking, which is an Android-only capability.**

Coarse iOS mitigations exist if the owner wants them later (significant-location-change + region
monitoring can wake a force-quit app near a geofence; APNs silent-push can nudge it — that one touches
the backend). Out of scope for this phase; noted for the decision.

## 4. OWNER RUNBOOK — to ship to a real iPhone

**Prerequisite (only the owner can do this):** enrol in the **Apple Developer Program** (~$99/yr) at
developer.apple.com. EAS is logged into an Expo account only; iOS signing needs Apple credentials.

Then pick a path:

**A — TestFlight (recommended for a team).** No per-device UDID registration.
1. `npx eas-cli build -p ios --profile production` — when prompted, let **EAS manage credentials**
   (it creates the distribution cert + provisioning profile under the owner's Apple account).
2. `npx eas-cli submit -p ios --profile production` — provide the Apple ID / App Store Connect app id /
   Apple Team id when prompted (or fill `submit.production.ios` in `eas.json`). Uploads to TestFlight.
3. Testers install the **TestFlight** app and accept the invite. iOS updates arrive like the Android
   APK does.

**B — Ad-hoc (a few known iPhones, no TestFlight).**
1. Register each tester's iPhone **UDID** in the Apple Developer portal (or let EAS collect it).
2. `npx eas-cli build -p ios --profile preview` (iOS `distribution: internal` = ad-hoc) → an install
   URL that works only on the registered devices.

**C — Simulator (no Apple account, available NOW; runs on a Mac only).**
- `npx eas-cli build -p ios --profile ios-simulator --non-interactive` → a `.app` that runs in the
  **iOS Simulator on a macOS machine** (`eas build:run -p ios`). It does **not** run on Windows or on a
  physical iPhone. Its only purpose is to prove the iOS build compiles and to smoke-test the UI on a
  Mac. **Background Tasks / real GPS do not work in the simulator** (§3).

## 5. Open decisions for the owner

1. **Buy the Apple Developer membership?** (hard blocker for any real-device build — paths A and B).
2. **TestFlight (A) or ad-hoc (B)?** TestFlight scales to a team without collecting UDIDs; ad-hoc is
   fine for 2–3 known phones.
3. **Accept the honest iOS 24/7 limit (§3)**, or later invest in the coarse mitigations
   (significant-location-change / region monitoring / APNs silent-push)?
4. **iPad:** `supportsTablet: true` is left as-is (the app is portrait phone UI); it runs on iPad but is
   not iPad-optimised. Leave, or set `false` to keep it iPhone-only? (No code change either way.)

## 6. Remaining / not done here

- **Real-device build + on-iPhone verification** — blocked on the Apple account (§4). Verify Face ID
  unlock, the WKWebView map, and the on-duty background route on a physical iPhone.
- **Push on iOS is out of scope** — APNs is a separate setup from the Android FCM (Phase 72), and
  Phase 72 itself is still backend/Firebase-blocked. iOS push is a later, separate piece.
- **Optional Info.plist copy polish:** the plugins inject *generic* Apple-default strings for
  `NSMotionUsageDescription` (expo-sensors, used by the Phase-63 motion classifier),
  `NSRemindersUsageDescription`, and `NSMicrophoneUsageDescription`. They pass a build; App Store
  review prefers specific copy. If/when submitting to the App Store, add truthful custom strings under
  `app.json` `ios.infoPlist`. Not a blocker for TestFlight or a build.
- **iOS Simulator EAS build** — the account-free compile proof; cut it to confirm the native target
  builds before the owner spends on the Apple account.
