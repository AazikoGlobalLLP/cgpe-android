/**
 * TEST-ONLY STUB for @react-native-async-storage/async-storage@2.2.0.
 * Reached only through the alias in vitest.config.ts.
 *
 * WHY: the real package is compiled JS so it parses, but its module graph reaches the React
 * Native TurboModule registry, which has no native side in a Node process.
 *
 * Default export, matching `import AsyncStorage from '...'` at src/store/auth.tsx:3,
 * src/lib/storage.ts:2 and src/lib/biometricIdentity.ts:2. The surface is exactly the five
 * methods used anywhere in src/. All five are called INSIDE functions, never at module scope,
 * so none of these bodies runs during a normalizeUiConfig test — they exist so the import
 * resolves.
 *
 * Everything answers "empty" so that a stray call can never fabricate a signed-in state.
 */

const AsyncStorage = {
  getItem: async (_k: string): Promise<string | null> => null,
  setItem: async (_k: string, _v: string): Promise<void> => {},
  removeItem: async (_k: string): Promise<void> => {},
  getAllKeys: async (): Promise<string[]> => [],
  multiRemove: async (_ks: string[]): Promise<void> => {},
};

export default AsyncStorage;
