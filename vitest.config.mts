/**
 * Vitest — PHASE 2. The project's first automated gate.
 *
 * This file is read by Vitest ONLY. Metro never sees it: there is no metro.config.js and no
 * babel.config.js in this repo, the app's `@/*` alias comes from Expo's Metro integration
 * reading tsconfig.json directly, and nothing under `src/app` imports `test/`. So the aliases
 * below cannot leak into a bundle.
 *
 * WHY `.mts` AND NOT `.ts`: this package is CommonJS (no `"type": "module"` — adding one would
 * break Metro), so Vite loads a `.ts` config through its CJS loader and warns, on every single
 * run, that the ESM syntax in it is unsupported by the config loader that becomes the default in
 * a future Vite major. `.mts` is unambiguously ESM, so the warning is gone for the right reason
 * rather than suppressed. A matching `.mts` glob was added to tsconfig.json `include` so this
 * file is still covered by `npx tsc --noEmit`.
 *
 * Full spec and the reason for every choice: docs/spec/PHASE-2.md.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Absolute, forward-slashed. Vite's alias replacement is plain string substitution and
 * fileURLToPath hands back backslashes on Windows, which breaks resolution downstream.
 */
const abs = (rel: string) => fileURLToPath(new URL(rel, import.meta.url)).replaceAll('\\', '/');

export default defineConfig({
  test: {
    // Nothing under test renders. checkGeofence and scanRenewals need fetch and
    // AbortController, which Node has natively. jsdom would be machinery for nothing.
    environment: 'node',

    // MUST stay scoped to src/. The repo vendors 50+ real *.test.ts files under
    // .agents/skills/gstack/test/ that Vitest's default include would happily collect.
    include: ['src/**/__tests__/**/*.test.ts'],

    // Explicit imports from 'vitest'; no ambient globals leaking into app type-checking.
    globals: false,

    // src/data/api.ts holds module-level mutable state with no reset export — _geoCache
    // (api.ts:1037), sessionReal (:46), the `state` buffer (:152), three Maps. Per-file
    // isolation is the floor; each api test also calls vi.resetModules() itself.
    isolate: true,

    restoreMocks: true,
    unstubGlobals: true,

    // Belt-and-braces only. scanRenewals is local-time end to end (api.ts:651, :663-664) and
    // serialises to UTC (:673), so a hardcoded UTC literal would pass in IST and fail in UTC.
    // NO assertion depends on this being applied: every expected timestamp is constructed with
    // the same local-time Date the code uses, which is TZ-independent by construction.
    env: { TZ: 'Asia/Kolkata' },
  },

  resolve: {
    // ORDER MATTERS — evaluated top-down, first match wins.
    alias: [
      // Native modules that cannot load in plain Node. See test/stubs/* for why each one.
      { find: /^react-native$/, replacement: abs('./test/stubs/react-native.ts') },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: abs('./test/stubs/async-storage.ts') },
      { find: /^expo-local-authentication$/, replacement: abs('./test/stubs/expo-local-authentication.ts') },
      { find: /^expo-secure-store$/, replacement: abs('./test/stubs/expo-secure-store.ts') },

      // tsconfig.json:5-12 paths, mirrored by hand. '@/assets/' MUST precede '@/' or an
      // asset import resolves to ./src/assets/.
      { find: /^@\/assets\//, replacement: abs('./assets/') },
      { find: /^@\//, replacement: abs('./src/') },
    ],
  },
});
