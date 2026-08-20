/**
 * The non-native slice of push (Phase 72). Split out of `lib/push.ts` deliberately: `push.ts`
 * imports `expo-notifications`/`expo-constants`, which cannot resolve under Vitest (they pull in
 * `expo-modules-core`'s `__DEV__`), so anything the test graph reaches — `store/auth` imports this
 * for sign-out unregistration — must NOT go through `push.ts`. The work here is pure storage + a
 * fail-quiet API call, both already test-safe.
 */
import { storage } from '@/lib/storage';
import { unregisterPushToken } from '@/data/api';

/** The Expo push token we last told the server about, on THIS install. Shared with `push.ts` so
 *  the register (in push.ts) and unregister (here) paths agree on one key. */
export const SENT_TOKEN_KEY = 'push.sentToken';

/**
 * Tell the backend to stop pushing to this device, on sign-out. Called from `auth.logout()` BEFORE
 * the auth token is cleared (the unregister call is itself authenticated). Best-effort: the local
 * marker is cleared regardless, so the next user on a shared handset registers cleanly, and a
 * failed unregister never blocks sign-out. A no-op when no token was ever stored (e.g. on web).
 */
export async function clearPushRegistration(): Promise<void> {
  const token = await storage.get(SENT_TOKEN_KEY).catch(() => null);
  if (token) await unregisterPushToken(token);
  await storage.remove(SENT_TOKEN_KEY).catch(() => {});
}
