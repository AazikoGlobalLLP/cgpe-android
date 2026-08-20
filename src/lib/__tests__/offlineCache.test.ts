import { describe, it, expect } from 'vitest';
import {
  CACHE_PREFIX,
  CACHE_MAX_AGE_MS,
  cacheKey,
  isCacheKey,
  isUserCacheKey,
  serializeEntry,
  parseEntry,
  isEntryExpired,
  gcVictims,
  decideRead,
  mergeById,
} from '@/lib/offlineCache';

/**
 * PHASE 57a. `offlineStore.ts` is device-only (the Vitest AsyncStorage stub is a no-op, so a real
 * round-trip can't be tested), so every DECISION the read cache makes lives here and is pinned —
 * the same pure-seam split `netResilience.ts` / `staleBuffer.ts` use.
 */
describe('cache keys', () => {
  it('namespaces per user and per endpoint under the versioned prefix', () => {
    expect(cacheKey('u1', 'tasks:own')).toBe(`${CACHE_PREFIX}u1.tasks:own`);
    expect(cacheKey('u1', 'leads')).toBe('cache.v1.u1.leads');
  });

  it('isCacheKey matches any read-cache key and nothing else', () => {
    expect(isCacheKey('cache.v1.u1.leads')).toBe(true);
    expect(isCacheKey('clock.u1.2026-08-20')).toBe(false);
    expect(isCacheKey('track.state')).toBe(false);
    expect(isCacheKey('cgpe.token')).toBe(false);
  });

  it('isUserCacheKey is strict to ONE user (a shared handset must not cross users)', () => {
    expect(isUserCacheKey('cache.v1.u1.leads', 'u1')).toBe(true);
    expect(isUserCacheKey('cache.v1.u1.leads', 'u2')).toBe(false);
    // A user id that is a prefix of another must not match (u1 vs u10).
    expect(isUserCacheKey('cache.v1.u10.leads', 'u1')).toBe(false);
  });
});

describe('serialize / parse round-trip', () => {
  it('round-trips rows and the write timestamp', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const parsed = parseEntry<typeof rows>(serializeEntry(rows, 1234));
    expect(parsed).toEqual({ at: 1234, data: rows });
  });

  it('preserves an empty array (a healthy empty read is a real answer, not a miss)', () => {
    const parsed = parseEntry(serializeEntry([], 5));
    expect(parsed).toEqual({ at: 5, data: [] });
  });

  it('parseEntry returns null for every malformed input — a corrupt cache is a miss, never a crash', () => {
    expect(parseEntry(null)).toBeNull();
    expect(parseEntry(undefined)).toBeNull();
    expect(parseEntry('')).toBeNull();
    expect(parseEntry('not json {')).toBeNull();
    expect(parseEntry('123')).toBeNull();               // a bare number is not an entry
    expect(parseEntry('{"data":[]}')).toBeNull();        // missing `at`
    expect(parseEntry('{"at":1}')).toBeNull();           // missing `data`
    expect(parseEntry('{"at":"x","data":[]}')).toBeNull(); // `at` not a number
  });
});

describe('GC by age', () => {
  const NOW = 1_700_000_000_000;

  it('the exact max age is NOT expired; one ms past it is', () => {
    expect(isEntryExpired(NOW - CACHE_MAX_AGE_MS, NOW)).toBe(false);
    expect(isEntryExpired(NOW - CACHE_MAX_AGE_MS - 1, NOW)).toBe(true);
  });

  it('gcVictims returns only the keys past the max age', () => {
    const entries = [
      { key: 'cache.v1.u1.a', at: NOW - 1000 },                    // fresh
      { key: 'cache.v1.u1.b', at: NOW - CACHE_MAX_AGE_MS - 1 },    // stale
      { key: 'cache.v1.u1.c', at: 0 },                             // ancient / unparseable
    ];
    expect(gcVictims(entries, NOW)).toEqual(['cache.v1.u1.b', 'cache.v1.u1.c']);
  });
});

describe('decideRead — the three read states (row 4)', () => {
  it('LIVE: a successful fetch uses the fetched rows and needs no chip', () => {
    const fetched = [{ id: 'x' }];
    expect(decideRead(true, fetched, { at: 1, data: [{ id: 'old' }] }))
      .toEqual({ state: 'live', rows: fetched, syncedAt: null });
  });

  it('STALE: a failed fetch WITH a cache serves the cached rows + the cache timestamp', () => {
    const cached = { at: 999, data: [{ id: 'cached' }] };
    expect(decideRead(false, [], cached))
      .toEqual({ state: 'stale', rows: cached.data, syncedAt: 999 });
  });

  it('EMPTY: a failed fetch with NO cache returns the empty fallback (could-not-load, no chip)', () => {
    expect(decideRead(false, [], null))
      .toEqual({ state: 'empty', rows: [], syncedAt: null });
  });

  it('EMPTY: a failed fetch whose cached entry holds a non-array is treated as a miss (never crashes a map)', () => {
    // A corrupt entry that parsed but whose `data` is not a list must not reach a screen as rows.
    const corrupt = { at: 5, data: { not: 'an array' } } as unknown as { at: number; data: unknown[] };
    expect(decideRead(false, [], corrupt))
      .toEqual({ state: 'empty', rows: [], syncedAt: null });
  });
});

describe('mergeById — stale cache must not hide this-session offline creates', () => {
  it('returns the cached rows unchanged when there are no new creates', () => {
    const cached = [{ id: 'a' }, { id: 'b' }];
    expect(mergeById(cached, [])).toBe(cached);   // same reference — no needless copy
  });

  it('appends a create whose id the cache predates, cached rows first', () => {
    const cached = [{ id: 'a' }, { id: 'b' }];
    const buffer = [{ id: 'z' }];   // a lead created offline this session
    expect(mergeById(cached, buffer)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'z' }]);
  });

  it('never duplicates a create the cache already contains (confirmed then re-cached)', () => {
    const cached = [{ id: 'a' }, { id: 'b' }];
    const buffer = [{ id: 'b' }, { id: 'c' }];
    expect(mergeById(cached, buffer)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });
});
