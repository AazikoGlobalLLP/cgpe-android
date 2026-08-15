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

/**
 * PHASE 41d §5 — consent-withdrawal signal. True when a consented 24/7 user has had the OS background
 * location permission revoked: the app should treat that as WITHDRAWING consent — tell the server (Phase
 * 43 notifies every super_admin, so the opt-out is loud, not silent) and stop the recorder. Gated on
 * `armed` so a user who never consented is never signalled, and so it fires only for the 24/7 case.
 */
export function shouldSignalWithdrawal(input: { armed: boolean; bgGranted: boolean }): boolean {
  return input.armed && !input.bgGranted;
}

/**
 * PHASE 41d §5 — permission-monitor / app-block reason. `null` = the app may run; otherwise the reason
 * the app must be blocked behind a "turn location back on" screen (whose copy is owner-supplied in 5
 * languages — the SCREEN is not wired until that copy lands; this decision is the copy-independent brain).
 * Ordered most-fundamental first: services off ⇒ nothing else matters. Only a consented (`armed`) user is
 * ever blocked. Battery-opt exemption is intentionally absent — it is unreadable from JS (§12.3), so it
 * cannot gate the block.
 */
export type BlockReason = 'services_off' | 'foreground_denied' | 'background_denied' | null;

export function locationBlockReason(input: {
  armed: boolean;
  servicesEnabled: boolean;
  fgGranted: boolean;
  bgGranted: boolean;
}): BlockReason {
  if (!input.armed) return null;
  if (!input.servicesEnabled) return 'services_off';
  if (!input.fgGranted) return 'foreground_denied';
  if (!input.bgGranted) return 'background_denied';
  return null;
}
