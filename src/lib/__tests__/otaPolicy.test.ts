import { describe, it, expect } from 'vitest';
import {
  FOREGROUND_CHECK_INTERVAL_MS,
  shouldCheckOnForeground,
  shouldOfferRestart,
} from '@/lib/otaPolicy';

/**
 * The decision half of over-the-air updates. The `expo-updates` calls themselves live behind a lazy
 * `require` in `lib/ota.ts` and cannot be mocked (Phase 86), so everything worth pinning is here.
 */
describe('shouldCheckOnForeground', () => {
  const now = 1_700_000_000_000;

  it('checks when it has never checked before', () => {
    expect(shouldCheckOnForeground(null, now)).toBe(true);
    expect(shouldCheckOnForeground(undefined, now)).toBe(true);
  });

  it('does not check again inside the throttle window', () => {
    expect(shouldCheckOnForeground(now - 1000, now)).toBe(false);
    expect(shouldCheckOnForeground(now - (FOREGROUND_CHECK_INTERVAL_MS - 1), now)).toBe(false);
  });

  it('checks once the window has elapsed', () => {
    expect(shouldCheckOnForeground(now - FOREGROUND_CHECK_INTERVAL_MS, now)).toBe(true);
    expect(shouldCheckOnForeground(now - FOREGROUND_CHECK_INTERVAL_MS - 1, now)).toBe(true);
  });

  it('twenty foregrounds in an hour cost one check, not twenty — the point of the throttle', () => {
    let last: number | null = null;
    let checks = 0;
    for (let i = 0; i < 20; i++) {
      const t = now + i * 60_000; // one foreground a minute for twenty minutes
      if (shouldCheckOnForeground(last, t)) { checks++; last = t; }
    }
    expect(checks).toBe(1);
  });

  it('treats a BACKWARD device clock as stale rather than blocking checks until time catches up', () => {
    // The user set their clock back a day. A naive `now - last >= interval` would go negative and
    // refuse every check until real time caught up — potentially for days.
    expect(shouldCheckOnForeground(now + 86_400_000, now)).toBe(true);
  });

  it('honours a caller-supplied interval', () => {
    expect(shouldCheckOnForeground(now - 5000, now, 10_000)).toBe(false);
    expect(shouldCheckOnForeground(now - 15_000, now, 10_000)).toBe(true);
  });
});

describe('shouldOfferRestart', () => {
  const base = { enabled: true, pending: true, dismissed: false, outage: false };

  it('offers when an update is downloaded and waiting', () => {
    expect(shouldOfferRestart(base)).toBe(true);
  });

  it('never offers where updates cannot run — Expo Go, a dev build, web', () => {
    expect(shouldOfferRestart({ ...base, enabled: false })).toBe(false);
  });

  it('does not offer before anything has downloaded', () => {
    expect(shouldOfferRestart({ ...base, pending: false })).toBe(false);
  });

  it('stays shut once dismissed', () => {
    expect(shouldOfferRestart({ ...base, dismissed: true })).toBe(false);
  });

  it('yields the slot to the outage banner — they both float in the same place', () => {
    expect(shouldOfferRestart({ ...base, outage: true })).toBe(false);
  });

  it('comes back after the outage clears, because the update is still pending', () => {
    expect(shouldOfferRestart({ ...base, outage: true })).toBe(false);
    expect(shouldOfferRestart({ ...base, outage: false })).toBe(true);
  });
});
