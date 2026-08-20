# HANDOFF — CGPE Connect (Android) — Phase 56 (iOS enablement) — 2026-08-20

Owner chose Phase 56 after Phase 57 completed. All the iOS work that does **not** need an Apple Developer account is done,
and the iOS build is **proven to compile** (a free EAS iOS-Simulator build finished green). `[m]`-only, **no contract change**.
Commits `49bb951` (config) + `ee8df2b` (docs), pushed `aaziko/Shivam`.

## Done
- **The iPhone build of the app now provably compiles.** An Apple-account-free EAS **iOS-Simulator build FINISHED green** —
  build `9649bf51-ca6e-4359-90a8-d3b4c5a80f30`, profile `ios-simulator`, SDK 57.0.0, from git `49bb951` — so the whole native
  iOS target builds with the full module set (reanimated, webview, secure-store, local-auth, location, background-task,
  notifications, sensors, calendar). Artifact (Mac-only `.app` tarball):
  `https://expo.dev/artifacts/eas/52sqyiyIWBy73eNMCZXV1IsPt9TmHMIbBA5oImmgIzg.tar.gz`.
- **`eas.json` can now build for iOS.** New `ios-simulator` profile (no Apple account needed); `preview` = Android APK / iOS
  ad-hoc and `production` = TestFlight/App Store are ready for the moment credentials exist.
- **The iOS app icon is the CGPE brand, not the Expo placeholder.** `ios.icon` was still `./assets/expo.icon` (the default
  blue-arrow grid); it now points at a generated 1024² opaque CGPE mark on `#ffffff` (matching the Android adaptive icon).
- **The App-Store export-compliance prompt is pre-answered** (`ios.config.usesNonExemptEncryption:false` — the app is
  HTTPS-only, so this is factually correct and removes a per-upload question).
- Whole iOS native config validated with `npx expo config --type introspect`: `UIBackgroundModes:[processing,location,fetch]`
  + `BGTaskSchedulerPermittedIdentifiers` auto-injected by the plugins, all CGPE permission strings resolve.

## Files changed
- `eas.json` — added the `ios-simulator` build profile (`distribution:internal`, `ios.simulator:true`).
- `app.json` — `ios.config.usesNonExemptEncryption:false`; `ios.icon` → `./assets/images/ios-icon.png`.
- `assets/images/ios-icon.png` — NEW: generated opaque 1024² CGPE icon (cgpe-logo composited on white; brand source is
  827×975 with alpha, unusable directly as an iOS icon).
- `docs/spec/PHASE-56.md` — NEW: spec + plain-language owner runbook (TestFlight vs ad-hoc vs simulator) + honest iOS limits.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md` — board + decisions + manager status.

## Decisions made
- **`ios-simulator` profile is the account-free compile proof** — a simulator build needs no Apple credentials (SDK-57 docs),
  so the iOS target could be built and verified BEFORE the owner spends on the Apple account. It ran green.
- **Regenerated the iOS icon rather than reuse an existing asset** — `icon.png` is the Expo default (wrong brand) and
  `cgpe-logo.png` is non-square + alpha (invalid iOS icon). Compositing the brand mark on the already-written-down `#ffffff`
  is grounded (not an invented colour) and mirrors Android; written to a NEW file so nothing was overwritten.
- **`usesNonExemptEncryption:false` is correct, not a guess** — `src/data/api.ts` uses only standard TLS/HTTPS `fetch`, the
  Apple "exempt" case.
- **Did NOT hand-add iOS background-mode / BGTaskScheduler plist keys** — the `expo-background-task` plugin injects them via
  CNG prebuild (verified in the introspected config). This is a CNG project (no `ios/`/`android/` dir).
- **Honest iOS 24/7 limit is documented, not papered over** — iOS records the on-duty route while alive/backgrounded, but
  stops after force-quit and stays off after reboot until reopened (Apple platform rule). Do NOT promise Android parity.

## Known broken / deliberately skipped
- **No real-iPhone / TestFlight build yet** — blocked on the Apple Developer account ($99/yr). Owner confirmed 2026-08-20 they
  WILL get it. Nothing more is buildable for a physical iPhone until it exists.
- **iOS push (APNs) is out of scope** — separate from the Android FCM work (Phase 72), which is itself still backend-blocked.
- **Generic Apple-default Info.plist strings** for `NSMotionUsageDescription` / `NSReminders*` / `NSMicrophone*` — pass a
  build; tighten to specific copy only if/when submitting to the App Store (not a blocker).
- **316 MB upload archive** — add an `.easignore` (exclude `e2e/artifacts`, etc.) before doing repeated iOS builds.

## Next session starts here
- **No un-owned mobile-buildable phase remains.** Phase 56 is done; Phase 57 is done; Phases 65/70/71/73 built; Phase 72 is
  backend/Firebase-blocked. Either (a) resume Phase 56 the moment the owner has the Apple account — build TestFlight per
  `docs/spec/PHASE-56.md` §4 and verify Face ID / map / background route on a real iPhone — or (b) take a new owner request.
- First command: `/boot`
- Watch out for: **do NOT re-run the iOS simulator build to "check" — it's already proven green (`9649bf51`, git `49bb951`).**
  The only iOS work left needs the Apple account. And the backend repo is `CGPE-CURRENT-PROJECT/cgpe-backend-main`, NOT
  `Shivam-Aaziko-Dev-MERN/cgpe-backend-main` (a `cd` to the wrong path silently runs git in ANDROID).
