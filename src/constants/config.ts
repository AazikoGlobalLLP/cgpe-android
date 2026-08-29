import { Platform } from 'react-native';

/**
 * CGPE Connect — configuration.
 *
 * REAL DATA ONLY
 * ---------------
 * The app is real-backend-only. There is no sample-data fallback: a call that cannot
 * reach the backend, times out, or gets back an unusable body resolves to an empty
 * result and raises the outage banner (`src/data/health.ts`) — it never invents one.
 * To show LIVE MongoDB data the app must be able to REACH your backend. Your production
 * backend is served same-origin behind nginx at `/internal/api` on your droplet
 * (cgpe.in) — there is no separate public API host.
 *
 * So real data works in exactly these cases:
 *   1. NATIVE app (this APK / dev build / Expo Go) — always resolves to `PROD_API` below,
 *      with no config to set (native apps have no browser CORS/mixed-content limits).
 *   2. WEB build deployed to the SAME origin as the backend (your cgpe.in droplet) —
 *      also resolves to `PROD_API`, same as your existing frontend.
 *   3. Running `npx expo start --web` on the PC that runs the backend (localhost) —
 *      resolves to the backend's local port instead. See `API_BASE_URL` below.
 *
 * The hosted preview at *.expo.app is a DIFFERENT origin from your backend and cannot
 * reach it, so every screen shows its empty state with the outage banner raised. That
 * is expected — use the native APK, or the web build on the production origin, for a
 * real, full-screen, real-data experience.
 */
export const APP = {
  name: 'CGPE Connect',
  tagline: 'Khushiyo Ka Financial Planner',
  org: 'C.G.P.E LLP',
  since: 'Since 1989',
  // Must match app.json `expo.version` (the store marketing version). This is the string the in-app
  // About/Settings screen shows; it read '1.8.0' while app.json shipped 1.10.0, so the app told the
  // user a different version than the build it was running (release-audit 2026-08-29).
  version: '1.10.0',
};

/** true = skip every network call and resolve straight to each call's honest-empty result
 *  (a compile-time kill switch, never flipped in a shipped build); false = always attempt
 *  the real backend. Neither value fabricates data — see `src/data/api.ts`'s `unavailable`. */
export const FORCE_DEMO = false;

/**
 * Backend base URL.
 *  - NATIVE (APK / Expo Go) always resolves to `PROD_API` below — there is no per-build
 *    "default" to hand-edit for a phone on a different network; a phone already reaches
 *    the production backend over HTTPS. Pointing a native build at a *local* backend
 *    needs a code change to the ternary below, not a config value.
 *  - WEB on `localhost` (running `--web` on the same PC as the backend) resolves to the
 *    backend's local port instead; any other web origin resolves to `PROD_API` too — see
 *    the ternary below.
 */
/** Confirmed live production backend (verified: /health -> 200, environment: production). */
export const PROD_API = 'https://cgpe.in/internal/api';

export const API_BASE_URL =
  Platform.OS === 'web'
    ? (typeof window !== 'undefined' && /^https?:\/\/localhost/.test(window.location.origin)
        ? 'http://localhost:3001/api' // local web dev on the backend PC
        // Hosted web is a different origin, so the browser will CORS-block this and every
        // call resolves empty with the outage banner raised. It starts working the moment
        // the app's origin is added to the backend CORS allow-list — no rebuild needed.
        : PROD_API)
    : PROD_API; // NATIVE (APK / Expo Go) — no CORS limits, real data + real auth

/**
 * Network resilience knobs (Phase 55, owner-locked "Balanced" 2026-08-20).
 *
 * The old single 4.5 s timeout was too aggressive for a weak cell / loaded WiFi — a cold TLS
 * handshake alone can eat 2–5 s, Home fans out ~6 parallel reads, and login used the same 4.5 s
 * so a slow network could not even sign in. These are the owner-approved replacements. The exact
 * seconds are a judgement call (no p95 measurement of the failing networks exists) — change them
 * HERE, they are the single source of truth for `src/data/api.ts`.
 */
/** Per-READ timeout (ms) before a call is aborted and treated as unreachable. */
export const REQUEST_TIMEOUT = 12000;
/** Login / OTP timeout (ms). Longer than a read: it is a single call the user is actively waiting
 *  on, and a failed sign-in strands them completely. It is a POST, so it is never auto-retried. */
export const LOGIN_TIMEOUT = 15000;
/** File-upload timeout (ms). Uploads are large and slow; this replaces "no AbortController at all"
 *  (which hung forever on a stalled socket). A multipart POST — never auto-retried (no double-upload). */
export const UPLOAD_TIMEOUT = 30000;
/**
 * Report-generation timeout (ms). A POST to `/clients/generate-report` fires an n8n render that takes
 * ~15–40 s, and the backend itself waits up to ~60 s for it (`cgpe-backend-main/routes/clients.js`).
 * Reusing the ordinary 12 s read timeout aborted every FRESH report before the server could answer —
 * so the owner saw "reports never generate" (docs/OWNER-BACKLOG-2026-08-24 Point 1). This ceiling covers
 * the full server wait plus a small TLS/round-trip cushion. A CACHED report returns fast and never
 * approaches it. It is a POST, so `req()` never auto-retries it (no duplicate render). */
export const REPORT_TIMEOUT = 65000;

/**
 * Auto-retry for IDEMPOTENT reads only (a bare `req()` is a GET). A single dropped SYN / stalled
 * handshake used to fail a read permanently; one bounded retry recovers the common transient.
 * NEVER applied to writes/uploads (non-idempotent) or to 4xx answers — see `src/lib/netResilience.ts`.
 */
/** Number of RETRIES after the first attempt (1 ⇒ up to 2 tries total). */
export const RETRY_ATTEMPTS = 1;
/** Base backoff (ms) before a retry; exponential per retry index (600, 1200, …). */
export const RETRY_BACKOFF_MS = 600;

/** Unauthenticated health probe path used by the in-app "Test connection" diagnostic. */
export const HEALTH_PATH = '/health';

/** Delay (ms) `unavailable()` waits before resolving its empty result, so a fast failure
 *  doesn't flash a loading skeleton for a few ms. Pacing for the empty path, not fake data. */
export const MOCK_LATENCY = 260;
