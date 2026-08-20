import { describe, it, expect } from 'vitest';
import { shouldRelock, parseLastActive, APP_LOCK_GRACE_MS } from '@/lib/appLock';

/**
 * PHASE 70. `ui/AppLock.tsx` is device-only (it drives AppState / BackHandler /
 * expo-local-authentication, none stubbed for Node), so the one load-bearing decision — "should
 * reopening the app re-prompt for biometrics?" — is lifted into the pure `appLock.ts` and pinned
 * here, the same way `watchdog.ts` lifted its re-arm decision out of `tracker.ts`.
 */
describe('shouldRelock — the App-Lock grace window (PHASE 70)', () => {
  const NOW = 1_700_000_000_000; // a fixed "now"; the module never reads the real clock

  it('does NOT re-lock a brief trip well inside the grace window (the owner\'s complaint)', () => {
    // Away 30 s — a glance at another app. This is exactly what used to fire a fingerprint wall.
    expect(shouldRelock(NOW - 30_000, NOW)).toBe(false);
  });

  it('re-locks once the absence exceeds the grace window', () => {
    // Away 6 min with a 5-min grace — the phone has been set down; lock it.
    expect(shouldRelock(NOW - 6 * 60_000, NOW)).toBe(true);
  });

  it('treats the exact boundary as still within grace (elapsed === grace → no prompt)', () => {
    expect(shouldRelock(NOW - APP_LOCK_GRACE_MS, NOW)).toBe(false);
    // One millisecond past the boundary re-locks.
    expect(shouldRelock(NOW - APP_LOCK_GRACE_MS - 1, NOW)).toBe(true);
  });

  it('fails closed when there is no stored timestamp (first launch / process killed before stamping)', () => {
    expect(shouldRelock(null, NOW)).toBe(true);
  });

  it('fails closed on a corrupt / non-positive timestamp', () => {
    expect(shouldRelock(NaN, NOW)).toBe(true);
    expect(shouldRelock(0, NOW)).toBe(true);
    expect(shouldRelock(-1, NOW)).toBe(true);
    expect(shouldRelock(Infinity, NOW)).toBe(true);
  });

  it('fails closed when the clock moved backwards since backgrounding (negative elapsed)', () => {
    // lastActive is in the future relative to now → we cannot trust the gap → lock.
    expect(shouldRelock(NOW + 60_000, NOW)).toBe(true);
  });

  it('honours a caller-supplied grace window', () => {
    const twoMin = 2 * 60_000;
    expect(shouldRelock(NOW - 90_000, NOW, twoMin)).toBe(false); // 1.5 min < 2 min
    expect(shouldRelock(NOW - 3 * 60_000, NOW, twoMin)).toBe(true); // 3 min > 2 min
  });
});

describe('parseLastActive — tolerant read of the persisted stamp (PHASE 70)', () => {
  it('parses a normal stringified timestamp', () => {
    expect(parseLastActive('1700000000000')).toBe(1_700_000_000_000);
  });

  it('returns null for a missing key (null / undefined)', () => {
    expect(parseLastActive(null)).toBe(null);
    expect(parseLastActive(undefined)).toBe(null);
  });

  it('returns null for garbage or a non-positive value, so shouldRelock reads it as "unknown → lock"', () => {
    expect(parseLastActive('not-a-number')).toBe(null);
    expect(parseLastActive('')).toBe(null);
    expect(parseLastActive('0')).toBe(null);
    expect(parseLastActive('-5')).toBe(null);
    // The round-trip a corrupt store would take: parse → null → shouldRelock locks.
    expect(shouldRelock(parseLastActive('garbage'), 1_700_000_000_000)).toBe(true);
  });
});
