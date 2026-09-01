# Testing without building an APK

**Why this file exists.** On 2026-09-01 five APKs were spent in one day chasing one bug. Each build is
15–20 minutes, comes out of a 15-per-month quota, and has to be installed by hand on ~21 handsets. The
owner asked for a way to test changes without that loop. There are two answers and they solve
different halves of the problem — **use both**.

| | Expo Go | EAS Update (OTA) |
|---|---|---|
| Cost to start | **nothing** | one APK build |
| Speed of a change | instant (save the file) | ~30 seconds |
| Who can use it | whoever holds the phone next to the dev machine | **all 21 handsets, in the field** |
| Proves a release build works | **NO — see the warning** | **yes** (it *is* the release build) |

---

## Option A — Expo Go: test a change in seconds, today, for free

### On the machine

```
npx expo start --go --tunnel
```

`--go` is required (this project has `expo-dev-client` installed, so a bare `expo start` targets a dev
build instead). `--tunnel` lets the phone connect **from any network** — it does not have to be on the
same WiFi.

⚠️ **`--tunnel` failed on 2026-09-01** with `CommandError: failed to start tunnel / remote gone away`.
That is **ngrok's** service, not this project — `@expo/ngrok` 4.1.3 is installed and nothing local is
misconfigured. Check <https://status.ngrok.com/> and otherwise **use LAN mode**, which is faster anyway:

```
npx expo start --go --port 8085
```

**Verified working 2026-09-01** on this machine: Metro answered `200` on both `localhost:8085` and the
LAN address, served an Expo Go manifest (`runtimeVersion: exposdk:57.0.0` — i.e. genuinely targeting
Expo Go, not the dev build), and **the whole app bundled clean for Expo Go: HTTP 200, 15.4 MB, 24 s.**
So there is no native import blocking this route; the app really does run there.

Non-interactive shells do not print the QR code, so read the machine's LAN IP
(`Get-NetIPAddress -AddressFamily IPv4`) and type the address into Expo Go by hand — it looks like
`exp://<LAN-IP>:8085`. The phone must be on the same network as the PC. If a firewall prompt appears
for Node on first run, allow it on private networks or the phone cannot reach port 8085.

### On the phone

1. Install **Expo Go** from the Play Store (one time).
2. Scan the QR code the command prints, or open the `exp://…` link it shows.
3. The app loads over the network. **Edit a file, save, and the phone reloads by itself.**

### What Expo Go runs perfectly well here

Everything the voice feature needs: `expo-audio` (the recorder, the microphone permission flow, the
metering), Reanimated, `expo-linear-gradient`, the whole navigation tree, and the **real production
backend** — Expo Go signs in against `cgpe.in` exactly like the APK, so login, tasks, clients, claims
and clock-in are all genuinely exercised.

### 🔴 What Expo Go CANNOT tell you — read this before trusting a green result

- **It cannot prove a release build is safe, and this project has already been burned by exactly
  that.** Expo Go runs a DEVELOPMENT bundle with LogBox: a JS error shows a red screen you can dismiss.
  The **same** error in a release build has no LogBox, is reported as fatal, and **exits the process**.
  The 2026-09-01 worklet crash — four APKs — would have shown a red box in Expo Go and looked survivable.
  **A feature that works in Expo Go still needs one real APK before it reaches the field.**
- **`react-native-compressor` is not in Expo Go**, so on-phone video compression for claim evidence
  fails open. Video capture will behave differently. (It is behind a lazy `require` for this reason, so
  it degrades rather than crashing — see `src/lib/videoTranscode.ts`.)
- **Background GPS, background tasks and the boot watchdog do not run the same way.** Anything in
  `lib/tracker.ts` needs a real build.
- **Push notifications** are limited and arrive as Expo Go, not as CGPE Connect.
- **Permissions belong to Expo Go**, not to the app (`host.exp.exponent`). So if you want to re-test the
  first-time microphone prompt, revoke it under *Settings › Apps › Expo Go › Permissions*, not under
  CGPE Connect.
- **The app icon, splash, adaptive icon and versionCode are Expo Go's**, so nothing about
  identity/branding can be checked here.

**In one line: Expo Go is for "does this flow work?", never for "is this build safe to ship?".**

---

## Option B — EAS Update (OTA): the permanent fix, one build away

`expo-updates` is **not installed yet**. Once it is, and once ONE APK carrying it is on the handsets,
every future JavaScript change ships to all 21 phones in about 30 seconds with `eas update` — no build,
no quota, no reinstall, no download link.

**It covers JS only.** A change that adds or upgrades a native module (a new `expo-*` package, a new
permission, an `app.json` native setting) still needs a real build. In practice almost every fix this
project has shipped has been JS.

**Sequencing that has already been agreed, and the reason for it:** OTA adds a native module and
changes the boot path, so it must not be introduced in the same build as a fix for a crash — otherwise
a failure cannot be attributed. Ship the pending fix first, confirm it on a handset, then add OTA in
the next build.

---

## The recommended loop

1. **Expo Go** while the change is being written — instant, free, catches logic and flow bugs.
2. **One APK** to confirm it in a release build, because of the warning above.
3. **After OTA is installed**, step 2 becomes `eas update` for anything JS — seconds instead of a day.
