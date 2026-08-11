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
 *   1. NATIVE app (this APK / dev build) pointed at a reachable HTTPS backend URL
 *      (native apps have no browser CORS/mixed-content limits). Set API_BASE_URL below.
 *   2. WEB build deployed to the SAME origin as the backend (your cgpe.in droplet),
 *      where the relative `/internal/api` resolves — same as your existing frontend.
 *   3. Running `npx expo start --web` on the PC that runs the backend (localhost).
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
  version: '1.8.0',
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
 *  - WEB deployed same-origin as the backend (or `--web` on `localhost`) resolves the
 *    relative/local address automatically — see the ternary below.
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

/** Per-request timeout (ms) before a call is treated as unreachable. */
export const REQUEST_TIMEOUT = 4500;

/** Delay (ms) `unavailable()` waits before resolving its empty result, so a fast failure
 *  doesn't flash a loading skeleton for a few ms. Pacing for the empty path, not fake data. */
export const MOCK_LATENCY = 260;
