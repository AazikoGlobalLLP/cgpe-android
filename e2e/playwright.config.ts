import { defineConfig } from '@playwright/test';
import path from 'node:path';

/**
 * PHASE 18 — watchable, A-to-Z, worst-case end-to-end harness.
 *
 * This config lives OUTSIDE `src/`, on purpose: it must be invisible to `tsc --noEmit`,
 * Vitest and EAS (the three green gates + the build). It has its own `tsconfig.json` in
 * this folder so Playwright type-checks the specs without dragging them into the app's
 * strict project. Nothing here is bundled into the APK.
 *
 * WHAT THE USER WATCHES. Default is HEADED (`headless:false`) because the whole point of
 * the phase — "browser open hoke … main har action dekh saku" — is a real Chromium window
 * the user watches drive every screen live. Set `HEADLESS=1` for an unattended/CI run
 * (that is how the harness verifies itself); the artifacts are identical either way.
 *
 * WHAT THEY RE-WATCH. `video`, `trace` and `screenshot` are all 'on', so every run leaves
 * a replayable film + a frame-by-frame Playwright trace + per-state stills under
 * `e2e/artifacts/`, which is git-ignored.
 *
 * PORT. Defaults to 8090, NOT Expo's 8081 — so the harness never collides with a hand-run
 * `expo start` a developer already has open, and never accidentally drives a *different*
 * app that happens to be on 8081. Override with `E2E_PORT`.
 */

const PORT = Number(process.env.E2E_PORT ?? 8090);
const BASE = `http://localhost:${PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: './tests',
  outputDir: './artifacts/test-results',
  // After the whole run, make the artifact folder self-explanatory (index + web-limits note).
  globalTeardown: './helpers/teardown.ts',
  // A-to-Z is one long guided walk; running specs in parallel would fight over the single
  // dev server and make the watched run jump around. One worker, in file order.
  fullyParallel: false,
  workers: 1,
  // The web build's first paint waits on fonts + the fail-open RBAC config (up to 3.5 s),
  // and Metro can be slow to serve a cold route chunk, so per-test budget is generous.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['html', { outputFolder: 'artifacts/report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: BASE,
    headless: !!process.env.HEADLESS,
    // Phone-shaped so it reads as "a mobile screen", but NOT full touch-device emulation:
    // React-Native-Web Pressables respond to click, and touch-only emulation would force
    // every interaction through tap() for no benefit on a walkthrough.
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    video: 'on',
    trace: 'on',
    screenshot: 'on',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: 'chromium-mobile' }],
  webServer: {
    // BROWSER=none: Playwright launches the Chromium the user watches; the dev server must
    // not also pop a tab. CI=1: non-interactive, so Metro never blocks on the port prompt.
    command: `npx expo start --web --port ${PORT}`,
    cwd: PROJECT_ROOT,
    env: { CI: '1', BROWSER: 'none' },
    url: BASE,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
