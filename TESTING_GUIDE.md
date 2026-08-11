# CGPE Connect — Testing & Verification Guide

Everything you need to open the app and independently verify each module works.

The app is real-backend-only: there is no offline mode and nothing is ever invented to
fill a screen. Every check below needs a reachable backend and a real advisor login —
see §2 and §4.

---

## 1. How to open it (3 ways)

### A) Web browser — easiest, best for a quick review + live data
```bash
cd ANDROID
npx expo start --web
```
Opens `http://localhost:8081` in your browser. Resize the window narrow (or use the
browser's device toolbar / phone view) to see it as a phone. **This is the fastest way
to review** and the only way to get **live backend data** (see §4), because a browser on
your PC can reach `localhost:3001`.

### B) Phone via Expo Go — same Wi-Fi
```bash
cd ANDROID
npx expo start --go
```
Scan the QR with **Expo Go**. The `--go` flag matters (a dev-client is installed, so
without it the QR targets the dev build).

### C) Phone via tunnel — when phone & PC are on different networks / office Wi-Fi blocks LAN
```bash
cd ANDROID
npx expo start --go --tunnel
```
This routes through Expo's tunnel (ngrok) so the phone can reach Metro from anywhere.
First run may install `@expo/ngrok`. Scan the QR with Expo Go.

> The earlier white-screen / `ExpoSecureStore … is not a function` crash was a
> **web-only** issue (secure storage has no web build) and is now fixed — storage uses
> Keychain/Keystore on the phone and localStorage on web automatically.

---

## 2. Login

- There is no offline path. An unreachable backend surfaces a neutral "could not reach
  the server" banner (`login.tsx`'s own `NetworkError` handling), not a fallback session;
  wrong credentials are refused by the server, not accepted locally.
- **Enter a real advisor email + password** (or a real mobile number for OTP) with your
  backend running and reachable (see §4). There is nothing to sign in with otherwise.
- Biometric unlock: on a phone, enable it in **More → Settings → Biometric unlock**,
  then sign out and back in — it prompts for fingerprint/face. (No-op on web.)

Expected: you land on the **Today** home screen with the gradient commission card.

---

## 3. Module-by-module verification

| # | Module | How to test | Expected result |
|---|--------|-------------|-----------------|
| 1 | **Today / Home** | Open after login | Gradient "This month's commission" card with ₹ figure, growth %, target bar; clock-in card; Hot leads / Open claims / Renewals stats; pastel quick actions; avatar contact row; today's follow-ups; hot leads |
| 2 | **GPS attendance** | Tap **Clock in** | Asks location permission → shows "Clocked in · <time> · <place>". Tap **Clock out** to reverse. Persists for the day |
| 3 | **Leads pipeline** | Tab **Leads** | Your real leads and the ₹ pipeline total; filter chips **All / New / Meeting / Docs shared / Policy issued / Lost** update the list with counts. *(Phase 4: these five are `Lead.status` — the app no longer has Contacted or Proposal stages, because the server cannot store them.)* |
| 4 | **Add lead** | Leads → **Add lead** (FAB) | Bottom sheet form. A **valid 10-digit mobile is required by the server**: submit without one and the sheet stays open with the server's own refusal in a red banner and nothing is added. With a valid one → the lead appears at top **under the name you typed** |
| 5 | **Lead 360 + stage** | Tap any lead | Profile, Call/WhatsApp/SMS, **pipeline stepper** — tap a stage (e.g. Docs shared) and it advances; notes list. **Force-quit and reopen: the new stage is still there.** A lead belonging to another advisor will not open — the server refuses it, and the screen says so rather than claiming it was removed |
| 6 | **Call / WhatsApp** | Tap the phone / WhatsApp icons | Opens the dialer / WhatsApp with the number (on a phone). On web, opens `wa.me` |
| 7 | **Clients + segments** | Tab **Clients** | Search box + segment chips (Renewal due / Maturity / Birthday / Cross-sell); list with avatars, cover, segment pills |
| 8 | **Client 360** | Tap a client | Profile, summary (cover/premium/policies), policy cards with sum assured, premium, maturity, **renewal countdown** (red if ≤7 days) |
| 9 | **Claims** | Tab **Claims** | Status filter chips; claim cards with type, ₹ amount, status pill, age, **document progress bar** |
| 10 | **New claim** | Claims → **New claim** (FAB) | Type selector → auto-generates a document checklist → **Create claim** → opens the new claim |
| 11 | **Claim detail** | Tap a claim | Status, ₹ amount, **AI-Ops summary**, document checklist (tap to toggle received), timeline, **Advance status** |
| 12 | **Document capture** | Claim → **Capture / upload document** | Opens camera (or photo library) → captured doc marks the next pending item received + adds a timeline entry |
| 13 | **Commissions** | More → **Commissions** | Gradient hero, last-month/pending/YTD stats, 6-month **bar chart**, recent payouts |
| 14 | **Reminders** | More → **Reminders** | Grouped Today / Upcoming / Completed; tap the circle to complete; WhatsApp shortcut |
| 15 | **Calendar** | More → **Calendar** | 14-day strip (dots = events); tap a day → agenda of that day's follow-ups |
| 16 | **WhatsApp Hub** | More → **WhatsApp Hub** | Chat list with unread badges; open a chat → message bubbles → type & **send** (appends); "open in WhatsApp" |
| 17 | **LIC Plans + estimator** | More → **LIC plans** | Benefit **estimator** (age/term/sum assured → premium + maturity); searchable plan library |
| 18 | **Contests** | More → **Contests** | Contest cards with reward, **progress bar**, rank, days left |
| 19 | **Global search** | Home bell area → **Search** (or More → Search) | Type a name/number → grouped Clients / Leads / Claims results → tap to open |
| 20 | **Notifications** | Home → bell icon | List with unread dots; **Mark all** clears them; badge on home updates |
| 21 | **Settings** | More → **Settings** | Toggle biometric (phone), push, WhatsApp alerts; pick language (English/ગુજરાતી/हिन्दी) |
| 22 | **Account & privacy** | More → **Account & privacy** | Export data, privacy policy, and **Delete account** (double-confirm → signs out) — the store-required deletion flow |
| 23 | **Profile** | Home avatar / More → profile | Gradient profile header, contact rows, yearly snapshot |
| 24 | **Sign out** | More → **Sign out** | Confirms → returns to the login screen |

---

## 4. Reaching the backend

The app is **real-backend-only** — there is no other mode, and nothing is invented to
fall back to. What decides whether a screen is populated is only whether the app can
reach the backend and whether the signed-in session is real:

- **Web via `npx expo start --web`**, opened on the **same PC** the backend runs on,
  resolves to `http://localhost:3001/api` automatically — the browser's own origin
  being `localhost` is what triggers it (`src/constants/config.ts`).
- **Native — Expo Go on a phone, or the built APK** — always points at the production
  backend, `https://cgpe.in/internal/api`, over HTTPS. A phone on any network already
  reaches it; there is no LAN-IP address to configure.
- Either way, **sign in with a real advisor email + password (or OTP).** On success,
  every screen pulls live MongoDB data.

`FORCE_DEMO` in [`src/constants/config.ts`](src/constants/config.ts) is a compile-time
kill switch (hardcoded `false`) that, if flipped, skips every network call and shows
each screen's empty state immediately — it never invents anything either way.
Pointing a build at a backend other than the two above (e.g. a different LAN host) is a
code change to `API_BASE_URL`'s resolution logic, not a value to hand-edit per run.

> If a live screen shows blank fields, the backend's response shape for that endpoint
> differs from the app's model — tell me the endpoint and I'll map the fields. If a
> screen shows its empty state with the outage banner raised, the call failed or timed
> out — that is the honest failure path, not a bug in what you're looking at.

---

## 5. What "passing" looks like

- No red error screen or blank white screen at any point.
- Every tab and every More item opens a populated screen.
- Buttons do something visible (navigate, toggle, open dialer/WhatsApp, advance a stage).
- The back arrow returns you to the previous screen.

If anything deviates, note the screen + action and I'll fix it.
