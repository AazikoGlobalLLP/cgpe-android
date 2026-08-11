# What this web harness CANNOT verify (native-only surfaces)

A green run of this harness means every **web-reachable** screen renders and behaves under normal,
worst-case, and bad-input conditions. It is **not** a claim that the whole app is verified. The
Expo **web** build cannot exercise the following — they stay on the **device backlog** and still
need a handset (the carried backlog from Phases 1/4/5/6/7/9/10/12/13). Phase 18 **shrinks** that
backlog; it does not replace it.

| Surface | Why web can't reach it |
|---|---|
| Haptics | `lib/haptics.ts` is a no-op on web — no vibration to assert. |
| AsyncStorage `clock.<date>` key + cold-start persistence | Attendance/clock persistence across a real app kill needs a device; the browser reload is not the same lifecycle. |
| SecureStore biometric seal (`biometricIdentity.ts`) + `AppLock` | `expo-secure-store` / `expo-local-authentication` have no web implementation; the app-lock is a no-op on web. |
| Background GPS / route recording (`lib/tracker.ts`) | `expo-task-manager` / `expo-location` background tasks + the foreground service exist only on the device; headless wake-ups can't be simulated in a browser. |
| Biometric unlock prompt | No `LocalAuthentication` on web. |
| The native map (`LeafletMap` via `react-native-webview`) | `react-native-webview` is native-only; the `agent-map` / `agent-track` map tiles degrade or blank on web. |
| The native base-URL branch | On web the origin decides localhost-vs-prod; native always resolves to prod. Only the web branch is exercised here. |

**How to close these:** run `TESTING_GUIDE.md`'s device rows by hand on a real Android handset
(the project's `Done means` bar). Phase 18 covers the web-reachable slice; this list is the
remainder.
