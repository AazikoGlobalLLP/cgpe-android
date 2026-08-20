import { describe, it, expect } from 'vitest';
import {
  isBufferStale,
  STALE_AFTER_MS,
  WATCHDOG_INTERVAL_MS,
  MAX_POINT_GAP_MS,
} from '@/lib/staleBuffer';

/**
 * PHASE 71. `tracker.ts` is device-only (no `expo-location` / `expo-task-manager` stub for Node),
 * so the one decision behind the "a location point every ≤60 min" guarantee — "is the buffer stale
 * enough that the watchdog should force a fix now?" — is lifted into the pure `staleBuffer.ts` and
 * pinned here, the same way `watchdog.ts` / `appLock.ts` lifted their decisions out of the untestable
 * native files.
 */
describe('isBufferStale — the ≤60 min freshness trigger (PHASE 71)', () => {
  const NOW = 1_700_000_000_000; // a fixed "now"; the module never reads the real clock

  it('is NOT stale for a fresh point well inside the threshold (healthy stream → watchdog does nothing)', () => {
    // A point five minutes ago — the OS stream is delivering; no forced fix needed.
    expect(isBufferStale(NOW - 5 * 60_000, NOW)).toBe(false);
  });

  it('treats the exact threshold as NOT yet stale, one ms past it as stale', () => {
    expect(isBufferStale(NOW - STALE_AFTER_MS, NOW)).toBe(false);
    expect(isBufferStale(NOW - STALE_AFTER_MS - 1, NOW)).toBe(true);
  });

  it('is stale once the newest point is older than the trigger threshold', () => {
    // 50 min old with a 45-min threshold — the stream has been starved (Doze); force a fix.
    expect(isBufferStale(NOW - 50 * 60_000, NOW)).toBe(true);
  });

  it('is stale when there is no recorded point yet (fresh shift, service capturing nothing)', () => {
    // lastAt starts at 0 on a new shift; a service that records nothing leaves it there. That is
    // exactly the straight-line bug — force an immediate fix rather than wait to discover the gap.
    expect(isBufferStale(0, NOW)).toBe(true);
    expect(isBufferStale(null, NOW)).toBe(true);
    expect(isBufferStale(undefined, NOW)).toBe(true);
  });

  it('is stale for a corrupt / non-finite / negative timestamp', () => {
    expect(isBufferStale(NaN, NOW)).toBe(true);
    expect(isBufferStale(Infinity, NOW)).toBe(true);
    expect(isBufferStale(-1, NOW)).toBe(true);
  });

  it('is stale when the clock moved backwards (point timestamp is in the future)', () => {
    // Negative age — we cannot trust the gap, so take a fix; ingest de-dupes / re-baselines it safely.
    expect(isBufferStale(NOW + 60_000, NOW)).toBe(true);
  });

  it('honours a caller-supplied threshold', () => {
    const tenMin = 10 * 60_000;
    expect(isBufferStale(NOW - 8 * 60_000, NOW, tenMin)).toBe(false); // 8 min < 10 min
    expect(isBufferStale(NOW - 12 * 60_000, NOW, tenMin)).toBe(true); // 12 min > 10 min
  });
});

describe('the ≤60 min guarantee — threshold derivation (PHASE 71)', () => {
  it('sets the trigger a whole watchdog interval below the ceiling', () => {
    expect(STALE_AFTER_MS).toBe(MAX_POINT_GAP_MS - WATCHDOG_INTERVAL_MS);
    expect(STALE_AFTER_MS).toBe(45 * 60_000);
    expect(MAX_POINT_GAP_MS).toBe(60 * 60_000);
    expect(WATCHDOG_INTERVAL_MS).toBe(15 * 60_000);
  });

  it('worst-case gap stays under the 60 min ceiling when the watchdog fires on its interval', () => {
    const NOW = 1_700_000_000_000;
    // Worst case: a tick sees the point right AT the threshold and takes no action...
    const lastAt = NOW - STALE_AFTER_MS;
    expect(isBufferStale(lastAt, NOW)).toBe(false);
    // ...the next tick is up to one full interval later, and by then it IS stale (fix taken)...
    const nextTick = NOW + WATCHDOG_INTERVAL_MS;
    expect(isBufferStale(lastAt, nextTick)).toBe(true);
    // ...and the gap between the old point and that forced fix is still within the ceiling.
    expect(nextTick - lastAt).toBeLessThanOrEqual(MAX_POINT_GAP_MS);
  });
});
