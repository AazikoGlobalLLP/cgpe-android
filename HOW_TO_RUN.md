# CGPE Connect — how to open it on your phone (Expo Go)

The app is real-backend-only. There is no offline mode and nothing is ever invented to
fill a screen: every screen either shows live data from the CGPE backend or an honest
"could not load" state. To see anything populated you need a reachable backend and a
real advisor account.

## Run it — pick one

**Browser (fastest review + live data):**
```bash
cd ANDROID
npx expo start --web
```
Opens `http://localhost:8081`. Narrow the window / use the browser phone view.

**Phone, same Wi-Fi:**
```bash
cd ANDROID
npx expo start --go
```
Scan the QR with **Expo Go**. `--go` matters — a dev-client is installed, so without it
the QR targets the dev build.

**Phone, different network / office Wi-Fi:**
```bash
cd ANDROID
npx expo start --go --tunnel
```

> If Expo Go says "SDK 57 unsupported", update Expo Go from the Play Store, or use your
> EAS dev build with `npx expo start --dev-client`.

See **TESTING_GUIDE.md** for a full module-by-module verification checklist.

## Log in

There is no offline path: `login.tsx` throws a `NetworkError` (a neutral "could not reach
the server" banner, not a fallback session) whenever the backend is unreachable, and a
wrong password or code is refused by the server, not accepted locally. **You need a real
advisor email/password or a real mobile number for OTP**, and a reachable backend (see
"Live data" below) — there is nothing to sign in with otherwise.

## What's in the app (all interactive, against a real backend)

- **Today** — GPS clock-in/out (asks location permission), live stats, follow-ups, hot leads, quick actions
- **Leads** — pipeline filter, add a lead, open a lead, tap stages to advance, call / WhatsApp
- **Clients** — search + smart segments, Client 360 with policies & renewals
- **Claims** — filter by status, **new claim**, **capture a document with the camera**, tick the checklist, advance status
- **More** → Commissions (chart), Reminders, Calendar, WhatsApp Hub (open a chat & send), LIC Plans + estimator, Contests, Search, Settings (biometric unlock toggle), Account & privacy (**account deletion flow**)

## Live data

Every path in the app is real-backend-only — there is no other mode. What decides
whether a screen shows anything is only whether the app can **reach** the backend:

- **Native (this Expo Go app, or the APK)** always points at the production backend,
  `https://cgpe.in/internal/api` — a phone on any network already reaches it over HTTPS,
  so `npx expo start --go` / `--go --tunnel` work as-is with a real advisor login.
- **Web via `npx expo start --web`** resolves to `http://localhost:3001/api` automatically
  when the browser's own origin is `localhost` — i.e. run it on the same PC as the backend.
  On any other web origin it points at production instead.

If a call cannot reach its target — wrong backend, backend down, expired session — the
screen shows its empty/"could not load" state and the global outage banner, never
invented data. `src/constants/config.ts` explains the exact resolution rules if you need
to point a build at a different backend; it is a code change to the base-URL logic there,
not a value to hand-edit per run. The data layer (`src/data/api.ts`) speaks the CGPE REST
shape (`{ success, data }`) and sends `Authorization: Bearer <token>`.
