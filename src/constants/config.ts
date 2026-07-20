import { Platform } from 'react-native';

/**
 * CGPE Connect — configuration.
 *
 * REAL DATA
 * ---------
 * The app is real-backend-first and falls back to sample data per-call so a screen
 * is never empty. To show LIVE MongoDB data the app must be able to REACH your
 * backend. Your production backend is served same-origin behind nginx at
 * `/internal/api` on your droplet (cgpe.in) — there is no separate public API host.
 *
 * So real data works in exactly these cases:
 *   1. NATIVE app (this APK / dev build) pointed at a reachable HTTPS backend URL
 *      (native apps have no browser CORS/mixed-content limits). Set API_BASE_URL below.
 *   2. WEB build deployed to the SAME origin as the backend (your cgpe.in droplet),
 *      where the relative `/internal/api` resolves — same as your existing frontend.
 *   3. Running `npx expo start --web` on the PC that runs the backend (localhost).
 *
 * The hosted preview at *.expo.app is a DIFFERENT origin from your backend and cannot
 * reach it, so it always shows sample data. That is expected — use the native APK for
 * a real, full-screen, real-data experience.
 */
export const APP = {
  name: 'CGPE Connect',
  tagline: 'Khushiyo Ka Financial Planner',
  org: 'C.G.P.E LLP',
  since: 'Since 1989',
  version: '1.1.0',
};

/** true = always sample data; false = real-backend-first with graceful fallback. */
export const FORCE_DEMO = false;

/**
 * Backend base URL.
 *  - NATIVE (APK / Expo Go): set your reachable HTTPS backend, e.g. https://cgpe.in/internal/api
 *    (or your PC's LAN IP for local testing: http://192.168.1.8:3001/api).
 *  - WEB deployed same-origin as the backend: leave the relative '/internal/api'.
 */
export const API_BASE_URL =
  Platform.OS === 'web'
    ? (typeof window !== 'undefined' && /^https?:\/\/localhost/.test(window.location.origin)
        ? 'http://localhost:3001/api'          // local web dev on the backend PC
        : '/internal/api')                      // same-origin deploy (falls back to sample on *.expo.app)
    : 'https://cgpe.in/internal/api';           // NATIVE build → your public backend (change if different)

/** Per-request timeout (ms) before falling back to sample data. */
export const REQUEST_TIMEOUT = 4500;

/** Simulated latency for sample-data responses so loading states are visible. */
export const MOCK_LATENCY = 260;
