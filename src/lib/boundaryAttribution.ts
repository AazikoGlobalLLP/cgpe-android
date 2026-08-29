/**
 * RELEASE AUDIT 2026-08-29 — the clock-in boundary split, kept as a PURE function so the one
 * correctness property (a point is attributed to the shift ONLY if it was recorded after clock-in)
 * is pinned by a test. `tracker.ts` itself is device-only and untestable in Node/web (there is no
 * `expo-location` / `expo-task-manager` stub — see `test/stubs/`), so this seam lives in its own
 * module with zero native imports, exactly like `lib/staleBuffer.ts` and `lib/watchdog.ts` do.
 *
 * WHY THIS EXISTS. `tracker.ts` attributes a flushed batch of GPS points to whatever shift session id
 * is current AT FLUSH TIME (`ingest`), not by each point's own timestamp. At a ~60 s cadence that was a
 * one-minute rounding error. PHASE 78 made the cadence HOURLY (`motion.ts` HOURLY_MS, owner-locked),
 * which widened it to UP TO AN HOUR: a 24/7-armed member who is recording ambient (off-duty) points and
 * then clocks in keeps those already-buffered pre-clock-in points in the same buffer, so the whole batch
 * — including up to an hour of OFF-DUTY movement — was filed under the shift. That is a privacy/data
 * correctness problem for the shift-vs-ambient separation the app promises: `tracker.ts:906-914` documents
 * it and says the split is "NOT done here". This is the split.
 *
 * SCOPE (deliberately the clock-IN direction). This partitions a buffer at the clock-in instant so the
 * pre-clock-in points route to the ambient (off-duty) dataset and only genuine shift points route to the
 * shift. The reverse clock-OUT spill — a few trailing shift points landing as ambient when the final flush
 * fails inside a dead zone (`tracker.ts:964-971`) — is a smaller, rarer effect (a handful of points, not
 * an hour of movement) and is left as documented residual; it needs the shift session id retained across
 * clock-out, a heavier change to the recorder lifecycle. See `docs/store-release/`.
 *
 * BACK-COMPAT / SAFETY. When the boundary instant is unknown (`sidStartedAt` 0 / non-finite — a resumed
 * shift written before this field existed, or a non-24/7 shift whose buffer is always cleared at clock-in
 * so it holds no pre-clock-in points anyway) EVERYTHING is attributed to the shift, i.e. the exact
 * pre-audit behaviour. So the split changes attribution ONLY for a 24/7-armed member's pre-clock-in
 * points, and is a no-op for every non-24/7 user.
 */

/**
 * Split a buffer of points into the ones that belong to the shift and the ones recorded BEFORE clock-in.
 *
 * @param points       the buffered points, in order (order is preserved within each partition)
 * @param sidStartedAt epoch ms of the clock-in that opened the current shift, or 0 / non-finite if unknown
 * @param atOf         reads a point's own epoch-ms timestamp (tracker's PointTuple keeps it at index [2])
 *
 * A point with `at >= sidStartedAt` is a SHIFT point (the boundary instant itself belongs to the shift).
 * A point with a finite `at < sidStartedAt` is a PRE-SHIFT point (off-duty; route to ambient).
 * A point whose `at` is non-finite is kept with the shift — never mis-routed to ambient on a bad timestamp.
 * When `sidStartedAt` is 0 / non-finite the boundary is unknown, so every point is a shift point.
 */
export function partitionShiftPoints<T>(
  points: readonly T[],
  sidStartedAt: number,
  atOf: (p: T) => number,
): { shift: T[]; preShift: T[] } {
  if (!Number.isFinite(sidStartedAt) || sidStartedAt <= 0) {
    return { shift: [...points], preShift: [] };
  }
  const shift: T[] = [];
  const preShift: T[] = [];
  for (const p of points) {
    const at = atOf(p);
    if (Number.isFinite(at) && at < sidStartedAt) preShift.push(p);
    else shift.push(p);
  }
  return { shift, preShift };
}
