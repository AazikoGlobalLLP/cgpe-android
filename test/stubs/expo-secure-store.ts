/**
 * TEST-ONLY STUB for expo-secure-store@57.0.1, whose real entry (build/SecureStore.js:8) reads
 * `ExpoSecureStore.AFTER_FIRST_UNLOCK` off a native module at MODULE SCOPE.
 *
 * CAVEAT — THIS ALIAS IS PROBABLY NEVER LOADED, AND THAT IS FINE. It is reached only via
 * `require('expo-secure-store')` at src/lib/storage.ts:17 and src/lib/biometricIdentity.ts:103.
 * Vite's transform rewrites `import`, not `require`, so in those modules `require` is undefined
 * -> ReferenceError -> swallowed by the surrounding try/catch -> `Secure = null`. Four lines of
 * insurance against a future runner that injects a CJS require shim; it is NOT load-bearing.
 *
 * Do not write a test that depends on this resolving.
 *
 * NAMED exports, because the consumers call `Secure.getItemAsync(...)` on the module object.
 */

export const getItemAsync = async (_k: string): Promise<string | null> => null;
export const setItemAsync = async (_k: string, _v: string): Promise<void> => {};
export const deleteItemAsync = async (_k: string): Promise<void> => {};
export const isAvailableAsync = async (): Promise<boolean> => false;
export const canUseBiometricAuthentication = (): boolean => false;
