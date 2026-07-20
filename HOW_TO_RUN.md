# CGPE Connect — how to open it on your phone (Expo Go)

The app runs 100% offline with realistic demo data, so you can show it to your
seniors without the backend running.

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

Any credentials work — the email/password are pre-filled. Just tap **Sign in**.

## What you can demo (all interactive)

- **Today** — GPS clock-in/out (asks location permission), live stats, follow-ups, hot leads, quick actions
- **Leads** — pipeline filter, add a lead, open a lead, tap stages to advance, call / WhatsApp
- **Clients** — search + smart segments, Client 360 with policies & renewals
- **Claims** — filter by status, **new claim**, **capture a document with the camera**, tick the checklist, advance status
- **More** → Commissions (chart), Reminders, Calendar, WhatsApp Hub (open a chat & send), LIC Plans + estimator, Contests, Search, Settings (biometric unlock toggle), Account & privacy (**account deletion flow**)

## Live data

The app is **real-backend-first**: sign in with a real advisor account while your
backend runs on the **same machine** (open the app with `--web` so the browser can reach
`localhost:3001`) and every screen pulls live MongoDB data. If a call is unreachable it
falls back to sample data for that call, so nothing is ever empty.

Config in `src/constants/config.ts`:
```ts
export const FORCE_DEMO = false;                         // true = always sample data
export const API_BASE_URL = 'http://localhost:3001/api'; // phone: use your PC's LAN IP
```
The data layer (`src/data/api.ts`) already speaks the CGPE REST shape (`{ success, data }`)
and sends `Authorization: Bearer <token>`.
