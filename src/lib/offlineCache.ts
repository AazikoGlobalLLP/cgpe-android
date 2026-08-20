/**
 * Phase 57a — PURE offline read-cache logic.
 *
 * This file holds every DECISION the read cache makes and imports nothing native. The thin
 * AsyncStorage I/O that these functions drive lives in `src/data/offlineStore.ts` — kept apart
 * on purpose: the Vitest AsyncStorage stub is a no-op (`test/stubs/async-storage.ts` answers
 * "empty" to everything), so a round-trip through real storage can't be unit-tested. The logic
 * that CAN be tested lives here and is, the same split `netResilience.ts` / `staleBuffer.ts` use.
 *
 * WHAT THE CACHE IS, AND IS NOT (see GLOSSARY "Read cache (Phase 57a)"). It is a per-user,
 * versioned copy of the last SUCCESSFUL list read, served ONLY when a re-fetch fails and an
 * entry exists — the "stale" state. It is NOT `state` in `api.ts` (that is unsent user input),
 * and it is NEVER a fallback for a healthy-but-empty read: a live 200 with zero rows overwrites
 * the cache with zero rows. Nothing here fabricates a record.
 */

/** All read-cache keys share this prefix so the logout sweep and GC can find them in one pass. */
export const CACHE_PREFIX = 'cache.v1.';

/** Entries older than this are evicted on the next write (spec row 7). 30 days in ms. */
export const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type CacheEntry<T = unknown> = { at: number; data: T };

/** The stable AsyncStorage key for one user's copy of one endpoint's list. */
export function cacheKey(userId: string, endpointKey: string): string {
  return `${CACHE_PREFIX}${userId}.${endpointKey}`;
}

/** True if `key` is any Phase-57 read-cache key. Used by GC and the (all-users) purge. */
export function isCacheKey(key: string): boolean {
  return key.startsWith(CACHE_PREFIX);
}

/**
 * True if `key` belongs to THIS user's cache. The logout purge is per-user (spec row 12): user
 * Y signing in must not wipe user X's cache, and X's PII must not survive X's own sign-out.
 */
export function isUserCacheKey(key: string, userId: string): boolean {
  return key.startsWith(`${CACHE_PREFIX}${userId}.`);
}

/**
 * Serialize rows + a write timestamp. `at` is passed IN (never read from a clock here) so this
 * stays pure and deterministic under test — the caller stamps `Date.now()`.
 */
export function serializeEntry<T>(data: T, at: number): string {
  const entry: CacheEntry<T> = { at, data };
  return JSON.stringify(entry);
}

/**
 * Parse a stored entry. Returns null on ANYTHING malformed — a truncated write, a value from an
 * older shape, or a hand-corrupted row must degrade to a cache miss, never crash the read that
 * a field agent is waiting on.
 */
export function parseEntry<T>(raw: string | null | undefined): CacheEntry<T> | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === 'object' && typeof o.at === 'number' && 'data' in o) {
      return { at: o.at, data: o.data as T };
    }
  } catch {
    /* fall through to null — corrupt cache is a miss */
  }
  return null;
}

/** GC predicate: an entry stamped more than `maxAgeMs` before `now` is eligible for eviction. */
export function isEntryExpired(at: number, now: number, maxAgeMs = CACHE_MAX_AGE_MS): boolean {
  return now - at > maxAgeMs;
}

/**
 * Given the cache keys currently on disk paired with their write time, return the keys to evict:
 * anything past the max age. Pure so the GC policy is testable without AsyncStorage.
 */
export function gcVictims(
  entries: { key: string; at: number }[],
  now: number,
  maxAgeMs = CACHE_MAX_AGE_MS,
): string[] {
  return entries.filter((e) => isEntryExpired(e.at, now, maxAgeMs)).map((e) => e.key);
}

/**
 * Merge cached rows with any this-session unconfirmed creates (the `api.ts` `state` buffer) that
 * an older cached snapshot predates. Cached rows win on id collision; an `extra` row with a NEW id
 * is appended — so a lead/task the user just created offline is never hidden under a stale cache,
 * which is what the pre-cache failure path (`unavailable(endpoint, state.xxx)`) already showed.
 * Order is preserved (cached first, then the new creates), and no row is duplicated.
 */
export function mergeById<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  if (!extra.length) return primary;
  const seen = new Set(primary.map((r) => r.id));
  const additions = extra.filter((r) => !seen.has(r.id));
  return additions.length ? [...primary, ...additions] : primary;
}

export type ReadState = 'live' | 'stale' | 'empty';

/**
 * The three-state read decision (spec row 4, GLOSSARY "Three read states"). Given whether the
 * live fetch produced usable rows and the cached entry (if any):
 *   - fetch OK                    → LIVE  (use fetched rows; caller refreshes the cache)
 *   - fetch failed + cache hit    → STALE (use cached rows; chip shows `syncedAt`)
 *   - fetch failed + no cache     → EMPTY (use the caller's empty fallback)
 * There is deliberately no fourth state: stale data is always shown WITH its timestamp, never as
 * if it were live.
 */
export function decideRead<T>(
  fetchOk: boolean,
  fetched: T[],
  cached: CacheEntry<T[]> | null,
): { state: ReadState; rows: T[]; syncedAt: number | null } {
  if (fetchOk) return { state: 'live', rows: fetched, syncedAt: null };
  if (cached && Array.isArray(cached.data)) {
    return { state: 'stale', rows: cached.data, syncedAt: cached.at };
  }
  return { state: 'empty', rows: fetched, syncedAt: null };
}
