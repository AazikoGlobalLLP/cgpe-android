import { describe, it, expect } from 'vitest';
import { watchdogAction, type WatchdogAction } from '@/lib/watchdog';

/**
 * PHASE 41b. `tracker.ts` is device-only (no expo-location / expo-task-manager stub), so the one
 * load-bearing decision is lifted into the pure `watchdog.ts` and pinned here — the same way the
 * consent gate lifted `needsConsentGate` out of an effect so a test could hold it.
 */
describe('watchdogAction — the re-arm decision (PHASE-41 §2.3/§2.4)', () => {
  // Every combination of (armed, hasShift, running). The full table IS the invariant.
  const table: { armed: boolean; hasShift: boolean; running: boolean; want: WatchdogAction }[] = [
    { armed: false, hasShift: false, running: false, want: 'retire' },
    { armed: false, hasShift: false, running: true, want: 'retire' },
    { armed: false, hasShift: true, running: false, want: 'rearm' },
    { armed: false, hasShift: true, running: true, want: 'idle' },
    { armed: true, hasShift: false, running: false, want: 'rearm' },
    { armed: true, hasShift: false, running: true, want: 'idle' },
    { armed: true, hasShift: true, running: false, want: 'rearm' },
    { armed: true, hasShift: true, running: true, want: 'idle' },
  ];

  for (const { armed, hasShift, running, want } of table) {
    it(`armed=${armed} hasShift=${hasShift} running=${running} → ${want}`, () => {
      expect(watchdogAction({ armed, hasShift, running })).toBe(want);
    });
  }

  // The two semantic guarantees, stated directly rather than read off the table.

  it('NEVER re-arms when neither a shift nor 24/7 is active (privacy: no un-consented recording)', () => {
    // Whatever the running state, nothing-to-record must not resume recording.
    expect(watchdogAction({ armed: false, hasShift: false, running: false })).not.toBe('rearm');
    expect(watchdogAction({ armed: false, hasShift: false, running: true })).not.toBe('rearm');
  });

  it('ALWAYS re-arms when recording should be live but the service was killed (reliability)', () => {
    // The whole point of 41b: a killed/rebooted-away service comes back.
    expect(watchdogAction({ armed: true, hasShift: false, running: false })).toBe('rearm');
    expect(watchdogAction({ armed: false, hasShift: true, running: false })).toBe('rearm');
  });

  it('retires (stops waking the device) only when there is nothing to record', () => {
    expect(watchdogAction({ armed: false, hasShift: false, running: false })).toBe('retire');
    // A single live source is enough to keep watching.
    expect(watchdogAction({ armed: true, hasShift: false, running: true })).not.toBe('retire');
    expect(watchdogAction({ armed: false, hasShift: true, running: true })).not.toBe('retire');
  });
});
