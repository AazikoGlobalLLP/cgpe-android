/**
 * TEST-ONLY STUB for expo-local-authentication@57.0.1.
 * Reached only through the alias in vitest.config.ts.
 *
 * WHY: the real entry (build/LocalAuthentication.js:1) imports expo-modules-core, whose "."
 * export resolves to RAW TypeScript at src/index.ts inside node_modules — which Vite
 * externalises rather than transforms.
 *
 * Namespace-imported at src/store/auth.tsx:4. Surface = the three functions used in src/.
 * hasHardwareAsync and isEnrolledAsync answer FALSE so that any accidental biometric path is
 * disabled rather than silently succeeding; authenticateAsync mirrors that.
 */

export const hasHardwareAsync = async (): Promise<boolean> => false;
export const isEnrolledAsync = async (): Promise<boolean> => false;
export const authenticateAsync = async (): Promise<{ success: boolean; error?: string }> =>
  ({ success: false, error: 'test-stub' });
