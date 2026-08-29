import { describe, it, expect } from 'vitest';
import { partitionShiftPoints } from '@/lib/boundaryAttribution';

/**
 * RELEASE AUDIT 2026-08-29. `tracker.ts` is device-only (no `expo-location` / `expo-task-manager` stub
 * for Node), so the clock-in boundary decision — "does this buffered point belong to the shift, or is it
 * a pre-clock-in off-duty point?" — is lifted into the pure `boundaryAttribution.ts` and pinned here, the
 * same way `staleBuffer.ts` / `watchdog.ts` lifted their decisions out of the untestable native file.
 *
 * The points are tracker's compact PointTuple `[lat, lng, atMs, accuracy, speed, heading]`; the boundary
 * is read from index [2] via the `atOf` accessor, exactly as `ingest` will call it.
 */

type PointTuple = [number, number, number, number | null, number | null, number | null];
const atOf = (t: PointTuple): number => t[2];
/** A point whose only meaningful field for this test is its timestamp. */
const pt = (atMs: number): PointTuple => [21.2, 72.8, atMs, 10, null, null];

const CLOCK_IN = 1_700_000_000_000; // a fixed clock-in instant; the module never reads the real clock
const MIN = 60_000;

describe('partitionShiftPoints — the clock-in boundary split (release audit 2026-08-29)', () => {
  it('files a point recorded 1 minute BEFORE clock-in as pre-shift (off-duty → ambient)', () => {
    const { shift, preShift } = partitionShiftPoints([pt(CLOCK_IN - MIN)], CLOCK_IN, atOf);
    expect(shift).toEqual([]);
    expect(preShift).toEqual([pt(CLOCK_IN - MIN)]);
  });

  it('files a point recorded EXACTLY at clock-in as a shift point (the boundary belongs to the shift)', () => {
    const { shift, preShift } = partitionShiftPoints([pt(CLOCK_IN)], CLOCK_IN, atOf);
    expect(shift).toEqual([pt(CLOCK_IN)]);
    expect(preShift).toEqual([]);
  });

  it('files a point recorded 1 minute AFTER clock-in as a shift point', () => {
    const { shift, preShift } = partitionShiftPoints([pt(CLOCK_IN + MIN)], CLOCK_IN, atOf);
    expect(shift).toEqual([pt(CLOCK_IN + MIN)]);
    expect(preShift).toEqual([]);
  });

  it('splits a batch that straddles clock-in and preserves order within each partition', () => {
    // The exact hourly-cadence case: a batch reconnected after a dead zone holds an hour of off-duty
    // points plus the first shift points. Off-duty movement must NOT be filed under the shift.
    const batch = [
      pt(CLOCK_IN - 55 * MIN),
      pt(CLOCK_IN - 30 * MIN),
      pt(CLOCK_IN - MIN),
      pt(CLOCK_IN),          // boundary → shift
      pt(CLOCK_IN + 20 * MIN),
      pt(CLOCK_IN + 40 * MIN),
    ];
    const { shift, preShift } = partitionShiftPoints(batch, CLOCK_IN, atOf);
    expect(preShift).toEqual([pt(CLOCK_IN - 55 * MIN), pt(CLOCK_IN - 30 * MIN), pt(CLOCK_IN - MIN)]);
    expect(shift).toEqual([pt(CLOCK_IN), pt(CLOCK_IN + 20 * MIN), pt(CLOCK_IN + 40 * MIN)]);
  });

  it('attributes EVERYTHING to the shift when the boundary is unknown (0 / non-finite) — pre-audit behaviour', () => {
    const batch = [pt(CLOCK_IN - MIN), pt(CLOCK_IN + MIN)];
    for (const unknown of [0, -1, NaN, Infinity]) {
      const { shift, preShift } = partitionShiftPoints(batch, unknown, atOf);
      expect(shift).toEqual(batch);
      expect(preShift).toEqual([]);
    }
  });

  it('is a no-op shape for an empty buffer', () => {
    expect(partitionShiftPoints([], CLOCK_IN, atOf)).toEqual({ shift: [], preShift: [] });
  });

  it('keeps a point with a non-finite timestamp WITH the shift (never mis-routes to ambient on a bad clock)', () => {
    // A device clock change can hand back a corrupt timestamp; a shift point is the safe home for it
    // (the shift path is the one with per-point de-dup and the accuracy filter downstream).
    const bad: PointTuple = [21.2, 72.8, NaN, 10, null, null];
    const { shift, preShift } = partitionShiftPoints([bad], CLOCK_IN, atOf);
    expect(shift).toEqual([bad]);
    expect(preShift).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const batch = [pt(CLOCK_IN - MIN), pt(CLOCK_IN + MIN)];
    const copy = [...batch];
    partitionShiftPoints(batch, CLOCK_IN, atOf);
    expect(batch).toEqual(copy);
  });
});
