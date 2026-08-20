/**
 * Offline read-cache — device I/O (Phase 57a).
 *
 * The thin AsyncStorage half of the read cache. Every DECISION (key shape, (de)serialization,
 * GC policy) lives in the pure, unit-tested `src/lib/offlineCache.ts`; this file only performs
 * the storage calls those decisions drive. That split is why `offlineCache.ts` is testable and
 * this file is not: the Vitest AsyncStorage stub (`test/stubs/async-storage.ts`) answers "empty"
 * to everything, so a real round-trip can only be walked on a device.
 *
 * RAW AsyncStorage, not SecureStore (spec row 1): SecureStore caps values at ~2 KB and has no
 * bulk-enumerate, both fatal for a cache of list responses. Every call is failure-swallowing —
 * a cache write that throws must never break the live read it shadows, and a purge that throws
 * must never block sign-out (same posture as `lib/storage.ts`).
 *
 * Only the five AsyncStorage methods the app already uses appear here (getItem/setItem/
 * getAllKeys/multiRemove) so the test stub's surface stays honest.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cacheKey, isCacheKey, isUserCacheKey, serializeEntry, parseEntry, gcVictims,
  type CacheEntry,
} from '@/lib/offlineCache';

/** Write-through: store one endpoint's freshly-fetched rows for this user, stamped now. */
export async function writeList<T>(userId: string, endpointKey: string, rows: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(userId, endpointKey), serializeEntry(rows, Date.now()));
  } catch {
    // A cache write must never break the read it shadows.
  }
  void gcOnce();
}

/** Read one endpoint's cached rows for this user, or null on a miss / corrupt / storage error. */
export async function readList<T>(userId: string, endpointKey: string): Promise<CacheEntry<T[]> | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId, endpointKey));
    return parseEntry<T[]>(raw);
  } catch {
    return null;
  }
}

/**
 * Drop every read-cache entry belonging to ONE user (spec row 12, called from the sign-out
 * sweep). Per-user so signing out user X never wipes user Y's cache on a shared handset — and so
 * X's cached rows do not survive X's own sign-out.
 */
export async function purgeUser(userId: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter((k) => isUserCacheKey(k, userId));
    if (doomed.length) await AsyncStorage.multiRemove(doomed);
  } catch {
    // Purge must never block sign-out.
  }
}

/**
 * Age-based GC (spec row 7): once per app session, evict any cache entry older than the max age.
 * Runs opportunistically off the first write so it never sits on a read's critical path. An
 * entry whose value won't parse is treated as ancient (`at:0`) and evicted — the cache self-heals
 * a corrupt row rather than carrying it forever.
 */
let gcDone = false;
async function gcOnce(): Promise<void> {
  if (gcDone) return;
  gcDone = true;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(isCacheKey);
    if (!keys.length) return;
    const now = Date.now();
    const entries: { key: string; at: number }[] = [];
    for (const key of keys) {
      const parsed = parseEntry(await AsyncStorage.getItem(key));
      entries.push({ key, at: parsed ? parsed.at : 0 });
    }
    const victims = gcVictims(entries, now);
    if (victims.length) await AsyncStorage.multiRemove(victims);
  } catch {
    // GC is best-effort — a failure here is invisible to the user and retried next session.
  }
}
