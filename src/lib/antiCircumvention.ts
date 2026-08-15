/**
 * PHASE 41d — anti-circumvention (§5), the editor-buildable, testable slice. Kept PURE (no native
 * imports) so the anti-spoof rule is pinned by a test even though `tracker.ts`'s `ingest` is
 * device-only (no expo-location stub). Same pure-seam pattern as `watchdog.ts` / `motion.ts`.
 *
 * WHY DROP MOCK FIXES. Android's fused provider stamps `mocked:true` on any fix that came from a
 * fake-GPS app (Developer Options → "Select mock location app"). Recording those would let a staff
 * member sit at home and paint a believable route. We drop them at ingest so no spoofed coordinate
 * ever enters the buffer or reaches the server. This is TRANSPARENT enforcement, not covert: a spoofer
 * whose fixes are all dropped simply stops sending points, which surfaces as a coverage GAP to the
 * backend silent-user detector (§5, filed to cgpe-api) → master alert. iOS has no mock-provider flag,
 * so `mocked` is undefined there and the fix is kept (nothing to detect).
 */

/** Return only the genuine fixes, dropping any the OS flagged as coming from a mock-location provider. */
export function dropMocked<T extends { mocked?: boolean }>(fixes: T[]): T[] {
  if (!Array.isArray(fixes)) return [];
  return fixes.filter((f) => f?.mocked !== true);
}
