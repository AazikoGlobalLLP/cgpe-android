/**
 * Session integrity — the security spine.
 *
 * THE PROBLEM THIS SOLVES. Before this module the app trusted a stored JWT forever. If the
 * server revoked it, the staff account was disabled, RBAC was narrowed, or the token simply
 * expired, every request came back 401 and each screen quietly showed its fallback. The user
 * stayed "logged in", looking at data they were no longer authorised to see, with no way to
 * discover the session was dead short of force-quitting. That is both a security defect and
 * the single worst class of data bug, because it is invisible.
 *
 * THE FIX. `api.ts` reports every authenticated response here. A 401 or 403-with-invalid-token
 * fires `expire()`, which notifies `AuthProvider`, which clears the keychain and returns the
 * user to the login screen with a stated reason. One code path, no screen can opt out.
 *
 * WHY AN EVENT BUS AND NOT A DIRECT IMPORT. `store/auth.tsx` already imports `data/api.ts`.
 * Having api.ts import auth.tsx back would be a require cycle, which Metro resolves by handing
 * one module a half-initialised copy of the other — the failure is intermittent and only shows
 * up in release builds. A module neither side owns breaks the cycle.
 *
 * IDEMPOTENCY MATTERS HERE. A dashboard fans out six requests at once; all six will 401
 * together. Without the `expiring` latch the user would be logged out six times and the
 * reason banner would race. The latch is cleared by `reset()` on a successful login.
 */

export type ExpiryReason = 'expired' | 'revoked' | 'forbidden';

type Listener = (reason: ExpiryReason) => void;

const listeners = new Set<Listener>();
let expiring = false;

/**
 * Subscribe to session death. `AuthProvider` is the only intended subscriber; returns an
 * unsubscribe function for the effect cleanup.
 */
export function onSessionExpired(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * Called by the API layer when the server rejects our credentials. Safe to call from many
 * concurrent requests: only the first one in a burst propagates.
 */
export function expireSession(reason: ExpiryReason = 'expired'): void {
  if (expiring) return;
  expiring = true;
  listeners.forEach((fn) => {
    try {
      fn(reason);
    } catch {
      // A throwing listener must not prevent the others from clearing state.
    }
  });
}

/** Called after a successful login so the next expiry can fire. */
export function resetSessionGuard(): void {
  expiring = false;
}

/** True while an expiry is being processed — lets the API layer skip doomed retries. */
export function isSessionExpiring(): boolean {
  return expiring;
}

export const EXPIRY_MESSAGE: Record<ExpiryReason, string> = {
  expired: 'Your session timed out. Please sign in again.',
  revoked: 'You were signed out because your access changed. Please sign in again.',
  forbidden: 'Your permissions changed. Please sign in again.',
};
