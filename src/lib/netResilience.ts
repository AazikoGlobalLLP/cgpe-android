/**
 * Network-resilience decisions — the pure seam (Phase 55).
 *
 * `src/data/api.ts`'s `req()` is device/environment code (real `fetch`, real timers). The
 * DECISIONS it makes on a failure — is this request safe to retry, is this failure the kind
 * worth retrying, how long to wait, and what to CALL the failure for the user — are pure and
 * live here so they can be unit-tested without a network. `req()` imports these and stays a
 * thin transport shell. No app imports beyond the owner-locked constant, so this file is a leaf.
 *
 * The rules encode the spec (`docs/spec/ISSUES-2026-08-18.md` §55) exactly:
 *   - retry IDEMPOTENT reads only (a bare `req()` is a GET) — never a write/upload;
 *   - retry only a THROW (dead network / our abort) or a transient server status (5xx / 429) —
 *     never a 4xx, which is an answer the server will give again;
 *   - a bounded number of retries with exponential backoff.
 */
import { RETRY_BACKOFF_MS } from '@/constants/config';

/**
 * What a failure IS, for honest user-facing wording (Phase 55). The old channel collapsed
 * timeout / DNS / TLS / server-error into one generic "could not load", which sent a user
 * chasing a network problem they did not have (or vice-versa).
 *   - 'timeout' : OUR AbortController fired — the server did not answer in time (slow link/server).
 *   - 'network' : `fetch` itself threw — no route to host (DNS / TLS / connection refused / offline).
 *   - 'server'  : the server answered, but with a fault (5xx / 429, or a 200 whose body is unusable).
 */
export type FailureKind = 'timeout' | 'network' | 'server';

/**
 * A request is safe to auto-retry only if it is idempotent. `req()` defaults to a GET when no
 * method is given, so an absent method is idempotent. Everything the app sends as a write
 * (POST/PUT/PATCH/DELETE) is NOT — a retried clock-in, WhatsApp send, or upload could double-fire.
 * HEAD is idempotent too (unused today, included for correctness).
 */
export function isIdempotentMethod(method?: string): boolean {
  if (!method) return true;
  const m = method.toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

/**
 * Transient server-side statuses worth one more try: 429 (rate-limited — back off and retry) and a
 * 5xx (the server is temporarily unwell). A 4xx is a considered answer (bad request, not found,
 * forbidden) — retrying gets the identical reply, so it is deliberately NOT retryable.
 *
 * ⚠️ 501 is EXCLUDED even though it is a 5xx. In this backend 501 is the "endpoint not on the
 * deployed build" signal — `src/data/api.ts`'s `reportIfOutage` treats it as a QUIET ANSWER exactly
 * like a 404, not as a fault. It is permanent (the route is absent), so retrying it is pointless and
 * would break that quiet-answer contract. Keeping this in step with `reportIfOutage` is deliberate.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599 && status !== 501);
}

/**
 * Classify a THROWN `fetch` failure. Our own timeout aborts the controller, which surfaces as an
 * `AbortError`; anything else `fetch` throws is a transport failure (DNS/TLS/refused/offline).
 */
export function kindForThrown(e: any): FailureKind {
  return e && e.name === 'AbortError' ? 'timeout' : 'network';
}

/**
 * Exponential backoff before a retry. `retryIndex` is 0-based (0 = the wait before the FIRST
 * retry), so the delays are base, 2·base, 4·base … Clamped at index 0 so a negative can't shorten it.
 */
export function backoffMs(retryIndex: number, base: number = RETRY_BACKOFF_MS): number {
  return base * Math.pow(2, Math.max(0, retryIndex));
}
