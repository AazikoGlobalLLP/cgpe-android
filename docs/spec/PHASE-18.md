# PHASE 18 — Watchable, A-to-Z, worst-case end-to-end test pass

Session `cgpe-mobile`. Requested 2026-08-11 (Hinglish, verbatim intent):

> "app ko complete test karna hai and muje dikhe aese — browser open hoke ya koi different way se
> jahan mobile ki koi screen open ho aur main **har action dekh saku**. Sab kuch A-to-Z. Ek dum
> worst testing — all unexpected edge cases. Path pehle hi bana lijiye. Jo bhi tool use karna hai,
> aap kar sakte — I approve."

Status: **PLANNED — path laid, not built.** The user pre-approved the tooling choice. This is
editor-/desk-buildable (no handset needed) for everything that renders on the **web** build; the
native-only surfaces stay on the device backlog and are named in §5.

---

## The one-sentence goal

The user can **watch** an automated harness drive every reachable screen of the app, A-to-Z, in a
real browser window (and re-watch a recording afterwards), including forced worst-case / edge-case
states, and get back a per-screen pass/fail with a screenshot or video clip for each.

## DONE WHEN (binary)

1. Running one command opens a **visible** (headed) browser that walks the app end-to-end while the
   user watches; a **video + trace** of the whole run is saved and replayable afterward.
2. Every screen reachable on the web build (see §4 inventory) is visited and asserted to render —
   not a blank/white screen, not a red error boundary — in its **normal** state.
3. Each screen is also exercised in its **worst-case** states via deterministic network injection:
   `500`, `503 + Retry-After`, empty `{data:[]}`, malformed/short body, request timeout/abort,
   `401` mid-session (auth expiry), `403` RBAC denial, an oversized list, and slow-network. The
   `<HealthBanner/>` / degraded empty-state behaviour is asserted where the app claims it (CLAUDE.md
   convention 4: "could not load" ≠ "nothing here").
4. Bad-input / boundary testing on every form (login, task-new, claim-new, lead create, WhatsApp
   composer, search): empty submit, whitespace-only, over-length, emoji/RTL/script text, injection-y
   strings, duplicate rapid taps (double-submit), back-navigation mid-write.
5. The run produces a single artifact folder the user can open — one screenshot/clip per checked
   state — plus a short pass/fail table. Nothing in the run creates or deletes **real** backend
   records (edge states are synthetic via mocking; the read walkthrough uses a disposable/staging
   session or the offline `demo-` token — see §3).
6. `npx tsc --noEmit`, `npm test`, `npm run lint` stay green (the harness lives outside `src/`; any
   `src/` guard added to make web boot must not regress the three gates).

---

## 1. Tooling decision (pre-approved by the user)

**Chosen: Playwright driving the Expo **Web** build (`npx expo start --web`) in headed Chromium.**

Why this and not Maestro/emulator:
- It literally **"opens a browser"** the user watches — exactly the acceptable path they named.
- Playwright `page.route(...)` makes **worst-case injection deterministic**: we synthesise the
  500/503/empty/malformed/timeout/401/403/huge-list responses ourselves, so "ek dum worst testing"
  needs no cooperating backend and **touches zero production data**.
- Headed mode + `video: 'on'` + `trace: 'on'` = the user watches live **and** gets a frame-by-frame
  replay ("har action dekh saku") after the fact.
- Runs on this Windows box with **no Android SDK / emulator / JDK** setup. Lowest friction to a
  first watchable pass.

Config intent (in a new `e2e/` folder, **not** under `src/`, so it is invisible to `tsc`/Vitest/EAS):
- `playwright.config.ts`: `headless: false`, `video: 'on'`, `trace: 'on'`, `screenshot: 'on'`,
  `baseURL` = the Expo web dev server, a single Chromium project, `webServer` optionally auto-starting
  `expo start --web`.
- Artifacts written to `e2e/artifacts/<run-timestamp>/` (git-ignored) so the user opens one folder.
- A tiny `expect(page).toRenderScreen()`-style helper: asserts no error-boundary text, no bare i18n
  key, and a known anchor element per route.

**Optional stretch (flagged, NOT committed here): Maestro + an Android emulator** for the native-only
flows in §5 that the user can also watch on an emulator window. Heavier setup; schedule only if the
web pass proves insufficient. Do not let it absorb Phase 18's scope.

## 2. First task is a real risk, name it up front

The app may **not boot cleanly on web today.** `src/app/_layout.tsx:18`'s module-scope
`import '@/lib/tracker'` registers an `expo-task-manager` background task at load; several screens
import native-only modules (`expo-local-authentication`, `expo-secure-store`, `react-native-webview`
for `LeafletMap`). On web these can be no-ops or can throw at module load.

**Step 1 of the phase is: get `npx expo start --web` to render `/(auth)/login` without a redbox.**
The honest possible outcomes:
- It already works (Metro resolves `.web.tsx`/`Platform.OS` guards) → proceed.
- It needs a small number of **web-safe guards** (a `Platform.OS !== 'web'` around a module-scope
  native registration, or a `.web.ts` shim) → make the **minimum** guard, gated by the three green
  gates, and record each as a decision. Do **not** rewrite screens to suit web.
- A screen genuinely cannot run on web (native map, biometric lock) → it moves to §5, not forced.

This step decides how much of the "A-to-Z" is reachable in a browser vs. must stay on the handset.

## 3. Backend target — three modes, never production writes

- **Navigation / render walkthrough:** point at a **staging/disposable** backend with a seeded test
  account, **or** use the offline `demo-` token (CLAUDE.md danger zone: `setAuthToken` disables all
  network for a token starting `demo-`) for a pure-UI pass that exercises empty/degraded rendering
  with no backend at all.
- **Real-data read pass (optional):** a read-only signed-in session against staging — no create/
  update/delete of real records.
- **Edge-case pass:** **Playwright network mocking only** — every fault is synthetic. This is where
  the "worst testing" lives; it is fully offline and deterministic.

**Never** run the write/edge suite against `https://cgpe.in/internal/api` production.

## 4. Screen inventory to walk (from `docs/PROJECT_MAP.md` §3 — 47 screens)

Auth + tabs: `login`, `(tabs)/{home,tasks,clients,claims,more,leads}`.
Flat stack: `account, agent-map, agent-track, analytics, attendance, calendar, campaigns,
claim-new, claim/[id], client/[id], commissions, contests, families, job/[id], kb, lead/[id],
lic-plans, notes, notice-board, notifications, notify, premium, profile, prospects, reminders,
search, segments, settings, task-new, task/[id], team, team/[id], tickets, tickets/[id], whatsapp,
whatsapp/[id]`, plus `screens/dashboards.tsx` (Admin/Master, props-driven from home).

For each: normal render → the applicable edge states from §DONE-WHEN 3 → forms get §DONE-WHEN 4.

## 5. Deliberately out of scope for the web harness (→ stays on the device backlog)

Web cannot exercise these; they remain handset-only (the carried backlog from Phases 1/4/5/6/7/9/
10/12/13) and Phase 18 **shrinks** that backlog, it does not replace it:
- Haptics (`lib/haptics.ts` is a no-op on web).
- The AsyncStorage `clock.<date>` key + SecureStore biometric seal (`biometricIdentity.ts`, `AppLock`).
- Background GPS / `expo-task-manager` route recording (`lib/tracker.ts`).
- `expo-local-authentication` app-lock prompt.
- `LeafletMap` (`react-native-webview`) — native WebView; the map screens (`agent-map`,
  `agent-track`) degrade or blank on web.
- The native base-URL branch (web origin decides localhost vs prod; native always prod).

State this in the run's summary so a green web pass is **not** read as "the whole app is verified."

## 6. Acceptance artifacts the user reviews

- A headed run they watch live.
- `e2e/artifacts/<run>/` with a video, a Playwright trace (`npx playwright show-trace`), and per-state
  screenshots.
- `e2e/artifacts/<run>/report.html` (Playwright HTML report) — green/red per screen per state.
- A one-page "what web could not reach" note (the §5 list) appended to the run.

## 7. Sequencing

Phase 18 is the **harness + walkthrough**. Phase 19 (language toggle) **reuses this harness** to
screenshot every screen in all 5 languages. Both land **before** Phase 16 (salary) and Phase 6
(commissions), which stay blocked on the backend regardless — per the user's stated order:
"pehle test + language, uske baad salary aur jo baaki hai."
