# Android permissions — merged-manifest map (1.10.0)

`app.json` declares 10 permissions, but the final merged AndroidManifest carries **~20**. Config plugins and
native-module manifests inject the rest. **Google Play Data Safety and the sensitive-permission review must
account for every row below, not just the 10 in `app.json`.** Confirm the exact final union from the EAS build
log (`android/merged-manifest.txt`) once the production AAB builds.

## Declared in `app.json` (10)

| Permission | Feature it serves |
|---|---|
| `ACCESS_COARSE_LOCATION` | Location (approximate) — office confirm + ambient |
| `ACCESS_FINE_LOCATION` | Location (precise) — shift field-route |
| `ACCESS_BACKGROUND_LOCATION` | 24/7 background collection (the sensitive one — needs the Play declaration) |
| `FOREGROUND_SERVICE` | Keep the recorder alive while backgrounded |
| `FOREGROUND_SERVICE_LOCATION` | FGS type = location (Android 14+) |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Ask OEM Doze to exempt the recorder (once per install) |
| `RECEIVE_BOOT_COMPLETED` | Watchdog re-arms recording after reboot (WorkManager) |
| `POST_NOTIFICATIONS` | Android 13+ push + the FGS notification |
| `READ_CALENDAR` / `WRITE_CALENDAR` | Auto-add assigned tasks/reminders to the phone calendar |

## Injected by plugins / native modules (~10) — the spec omitted these

| Permission | Source | Feature |
|---|---|---|
| `CAMERA` | expo-image-picker | Capture claim/KYC documents + evidence photos/video |
| `RECORD_AUDIO` | expo-image-picker (because `microphonePermission` is set) | Sound on evidence video |
| `READ_EXTERNAL_STORAGE` (`maxSdkVersion=32`) | expo-image-picker / expo-file-system | Legacy media access (pre-Photo-Picker) |
| `WRITE_EXTERNAL_STORAGE` (`maxSdkVersion=32`) | expo-image-picker / expo-file-system | Legacy file writes |
| `INTERNET` | expo-file-system / expo-image | Network |
| `ACCESS_NETWORK_STATE` | expo-image | Connectivity checks |
| `VIBRATE` | expo-haptics | Haptic feedback |
| `ACTIVITY_RECOGNITION` | expo-sensors | Accelerometer motion classifier (adaptive GPS sampling) |
| `USE_BIOMETRIC` | expo-local-authentication | Biometric app unlock |
| `USE_FINGERPRINT` | expo-local-authentication | Legacy fingerprint unlock |

## Very likely transitive (confirm from the build) — UNVERIFIABLE from source

| Permission | Source |
|---|---|
| `WAKE_LOCK` | firebase-messaging (via expo-notifications) |
| `com.google.android.c2dm.permission.RECEIVE` | firebase-messaging |

## Review notes / decisions

- **`ACTIVITY_RECOGNITION`** is a sensitive Play permission and there is no user-facing "activity" feature — it
  exists only to drive adaptive GPS sampling. Decide before submission: keep it (declare "used to optimise
  location-sampling frequency") or strip via `android.blockedPermissions` if the classifier can run without it.
  Do NOT strip blindly — verify the accelerometer still works, since the motion classifier depends on it.
- On iOS the same module chain emits a generic `NSMotionUsageDescription` — give it accurate copy or suppress it,
  or Apple review may query a motion permission with no disclosed feature.
- Every other injected permission maps to a real, disclosed feature and is defensible as-is.
