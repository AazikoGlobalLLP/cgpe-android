import { describe, it, expect } from 'vitest';
import { dropMocked } from '@/lib/antiCircumvention';

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
