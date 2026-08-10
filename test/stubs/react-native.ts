/**
 * TEST-ONLY STUB — never bundled. Nothing under `src/` imports this file; it is reached only
 * through the `react-native` alias in vitest.config.ts.
 *
 * WHY IT EXISTS: node_modules/react-native/index.js:27 is
 * `import typeof * as ReactNativePublicAPI from './index.js.flow';` — Flow syntax that esbuild
 * cannot parse, so importing src/data/api.ts fails at TRANSFORM time, before any test runs.
 *
 * THE SURFACE IS DELIBERATELY TINY: only the two named exports the modules under test actually
 * import. `Platform` (src/constants/config.ts:1, src/data/api.ts:27, src/store/auth.tsx:2,
 * src/lib/storage.ts:1, src/lib/biometricIdentity.ts:1) and `AppState` (src/i18n/index.tsx:2).
 * Anything else must fail loudly rather than quietly answer undefined.
 *
 * Verified across the reachable graph: `Platform.OS` is the ONLY member dereferenced
 * (config.ts:45, api.ts:1277, auth.tsx:23, storage.ts:11, biometricIdentity.ts:93) and
 * `Platform.select` appears nowhere. If a future test needs more than this, that is a signal the
 * test has left pure-logic territory — read docs/spec/PHASE-2.md before widening it.
 */

export const Platform = {
  /**
   * 'android', not 'web'. This keeps src/constants/config.ts:44-52 on the PROD_API branch and
   * src/data/api.ts:1277 (uploadFile) on its native branch — the code paths the app ships.
   */
  OS: 'android' as 'android' | 'ios' | 'web',
};

export const AppState = {
  currentState: 'active',
  /** Only reached from src/i18n/index.tsx:320, inside an effect no test mounts. */
  addEventListener: (_type: string, _handler: (state: string) => void) => ({ remove: () => {} }),
};
