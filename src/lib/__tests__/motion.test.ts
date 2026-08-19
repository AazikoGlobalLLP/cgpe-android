import { describe, it, expect } from 'vitest';
import {
  magnitudeStdDev,
  classifyMotion,
  samplingProfile,
  debounceMotion,
  resolveMotion,
  MOVING_PROFILE,
  STILL_PROFILE,
  MOTION_DEBOUNCE,
  MOTION_FRESH_MS,
  type MotionState,
} from '@/lib/motion';

/** All variation on z so magnitude == |z| — a controlled, deterministic motion signal. */
const z = (...vals: number[]) => vals.map((v) => ({ x: 0, y: 0, z: v }));

// A phone at rest: magnitude ~1 g with only sensor noise.
const STILL = z(1.0, 1.01, 0.99, 1.0, 1.02, 0.98, 1.0, 1.01, 0.99, 1.0, 1.01, 0.99);
// A phone in motion: magnitude swinging well beyond the noise floor.
const MOVING = z(0.6, 1.4, 0.7, 1.5, 0.5, 1.3, 0.65, 1.45, 0.55, 1.35, 0.6, 1.4);

describe('magnitudeStdDev', () => {
  it('is ~0 for a still window and large for a moving one', () => {
    expect(magnitudeStdDev(STILL)).toBeLessThan(0.05);
    expect(magnitudeStdDev(MOVING)).toBeGreaterThan(0.3);
  });
  it('is rotation-invariant: the same movement on a different axis reads the same', () => {
    const onX = MOVING.map((s) => ({ x: s.z, y: 0, z: 0 }));
    expect(magnitudeStdDev(onX)).toBeCloseTo(magnitudeStdDev(MOVING), 6);
  });
  it('returns 0 when there are too few samples to have a spread', () => {
    expect(magnitudeStdDev([])).toBe(0);
    expect(magnitudeStdDev(z(1.0))).toBe(0);
  });
});

describe('classifyMotion', () => {
  it('reads a rest window as still and a motion window as moving', () => {
    expect(classifyMotion(STILL)).toBe('still');
    expect(classifyMotion(MOVING)).toBe('moving');
  });
  it('returns null (no decision) on insufficient samples', () => {
    expect(classifyMotion([])).toBeNull();
    expect(classifyMotion(z(1.0))).toBeNull();
  });
  it('honours a custom threshold', () => {
    // Force the still window to read as moving by dropping the bar below its tiny spread.
    expect(classifyMotion(STILL, 0.0001)).toBe('moving');
  });
});

describe('samplingProfile', () => {
  it('maps each state to its profile', () => {
    expect(samplingProfile('moving')).toBe(MOVING_PROFILE);
    expect(samplingProfile('still')).toBe(STILL_PROFILE);
  });
  it('MOVING records every ~60 s even when stationary, at High accuracy (PHASE 63)', () => {
    expect(MOVING_PROFILE).toEqual({
      accuracy: 'high', // ~10 m — survives the backend accuracy<=100 m shift-point drop
      timeInterval: 60000, // ~60 s cadence
      distanceInterval: 0, // 0 = deliver on the time interval even when the phone has not moved
      deferredUpdatesInterval: 60000,
    });
  });
  it('STILL is neutralised — identical to MOVING so no point is dropped when stationary (PHASE 63)', () => {
    // Motion adaptivity is off until the owner locks a battery number: the "sparse when still" economy
    // conflicts with owner #1 (retain every point), so STILL must not under-sample vs MOVING.
    expect(STILL_PROFILE).toEqual(MOVING_PROFILE);
    expect(STILL_PROFILE.distanceInterval).toBe(0);
    expect(STILL_PROFILE.timeInterval).toBe(MOVING_PROFILE.timeInterval);
    expect(STILL_PROFILE.accuracy).toBe('high');
  });
  it('neither profile can silently regress to a distance-throttled or coarse config (owner #1 guard)', () => {
    for (const p of [MOVING_PROFILE, STILL_PROFILE]) {
      expect(p.distanceInterval).toBe(0); // never gate a fix on movement again (the stationary-no-points bug)
      expect(p.accuracy).toBe('high'); // never coarse enough to be dropped by the >100 m server filter
      expect(p.timeInterval).toBeLessThanOrEqual(60000); // ~60 s or tighter, never the old 5-min stretch
    }
  });
});

describe('debounceMotion (anti-churn hysteresis)', () => {
  it('does nothing while the reading matches the committed state', () => {
    expect(debounceMotion('moving', 'moving', 0)).toEqual({ state: 'moving', streak: 0, changed: false });
  });
  it('a null reading holds the state and resets the streak', () => {
    expect(debounceMotion('moving', null, 2)).toEqual({ state: 'moving', streak: 0, changed: false });
  });
  it('needs MOTION_DEBOUNCE consecutive differing readings before it flips', () => {
    let state: MotionState = 'moving';
    let streak = 0;
    let changedAt = -1;
    for (let i = 0; i < MOTION_DEBOUNCE; i++) {
      const r = debounceMotion(state, 'still', streak);
      state = r.state;
      streak = r.streak;
      if (r.changed) changedAt = i;
    }
    expect(changedAt).toBe(MOTION_DEBOUNCE - 1); // flips exactly on the Nth consecutive reading
    expect(state).toBe('still');
  });
  it('a single opposite blip mid-streak does not flip', () => {
    const r = debounceMotion('moving', 'still', 0);
    expect(r.changed).toBe(false);
    expect(r.state).toBe('moving');
    expect(r.streak).toBe(1);
  });
});

describe('resolveMotion (fail-safe freshness)', () => {
  const now = 1_000_000_000;
  it('moving is always moving, however old', () => {
    expect(resolveMotion('moving', 0, now)).toBe('moving');
    expect(resolveMotion('moving', now, now)).toBe('moving');
  });
  it('a fresh still stays still', () => {
    expect(resolveMotion('still', now - 1000, now)).toBe('still');
    expect(resolveMotion('still', now - MOTION_FRESH_MS, now)).toBe('still'); // exactly at the edge
  });
  it('a stale still degrades to moving so we never under-sample on an old reading', () => {
    expect(resolveMotion('still', now - MOTION_FRESH_MS - 1, now)).toBe('moving');
  });
});
