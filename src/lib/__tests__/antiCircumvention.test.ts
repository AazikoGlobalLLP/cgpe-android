import { describe, it, expect } from 'vitest';
import { dropMocked, shouldSignalWithdrawal, locationBlockReason } from '@/lib/antiCircumvention';

/**
 * PHASE 41d §5. `ingest` is device-only (no expo-location stub), so the anti-spoof rule lives in the
 * pure `dropMocked` and is pinned here: a mock-provider fix must never reach the record.
 */
describe('dropMocked (anti-spoof, PHASE-41 §5)', () => {
  const real = (n: number) => ({ id: n, mocked: false });
  const spoof = (n: number) => ({ id: n, mocked: true });

  it('keeps genuine fixes untouched', () => {
    const fixes = [real(1), real(2), real(3)];
    expect(dropMocked(fixes)).toEqual(fixes);
  });

  it('drops mock-provider fixes but keeps the real ones in the same batch', () => {
    expect(dropMocked([real(1), spoof(2), real(3)])).toEqual([real(1), real(3)]);
  });

  it('drops every fix when the whole batch is spoofed', () => {
    expect(dropMocked([spoof(1), spoof(2)])).toEqual([]);
  });

  it('treats a missing/undefined mocked flag as genuine (iOS has no mock flag)', () => {
    const ios = [{ id: 1 }, { id: 2, mocked: undefined }];
    expect(dropMocked(ios)).toEqual(ios);
  });

  it('only true drops — a falsy-but-not-true value is kept', () => {
    // Defensive: only an explicit true is a mock verdict.
    const odd = [{ id: 1, mocked: false }, { id: 2, mocked: undefined }];
    expect(dropMocked(odd)).toEqual(odd);
  });

  it('is safe on a non-array input', () => {
    // @ts-expect-error — guarding the headless path where a bad payload could arrive.
    expect(dropMocked(null)).toEqual([]);
  });
});

describe('shouldSignalWithdrawal (consent-withdrawal signal, PHASE-41 §5)', () => {
  it('signals only when a consented user has lost background permission', () => {
    expect(shouldSignalWithdrawal({ armed: true, bgGranted: false })).toBe(true);
  });
  it('never signals for a user who never consented (armed=false), whatever the permission', () => {
    expect(shouldSignalWithdrawal({ armed: false, bgGranted: false })).toBe(false);
    expect(shouldSignalWithdrawal({ armed: false, bgGranted: true })).toBe(false);
  });
  it('does not signal while permission is still granted', () => {
    expect(shouldSignalWithdrawal({ armed: true, bgGranted: true })).toBe(false);
  });
});

describe('locationBlockReason (app-block brain, PHASE-41 §5)', () => {
  const ok = { armed: true, servicesEnabled: true, fgGranted: true, bgGranted: true };

  it('does not block when everything is on', () => {
    expect(locationBlockReason(ok)).toBeNull();
  });
  it('never blocks a non-consented user, whatever is off', () => {
    expect(locationBlockReason({ armed: false, servicesEnabled: false, fgGranted: false, bgGranted: false })).toBeNull();
  });
  it('reports the most-fundamental failure first', () => {
    // Services off dominates even when permissions are also missing.
    expect(locationBlockReason({ ...ok, servicesEnabled: false, fgGranted: false, bgGranted: false })).toBe('services_off');
    expect(locationBlockReason({ ...ok, fgGranted: false, bgGranted: false })).toBe('foreground_denied');
    expect(locationBlockReason({ ...ok, bgGranted: false })).toBe('background_denied');
  });
});
