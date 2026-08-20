/**
 * PHASE 71 — the "has the route buffer gone stale?" decision, kept as a PURE function so the one
 * guarantee the owner asked for ("a location point every ≤60 min") is pinned by a test. `tracker.ts`
 * itself is device-only and untestable in Node/web (there is no `expo-location` / `expo-task-manager`
 * stub — see `test/stubs/`), so this seam lives in its own module with zero native imports, exactly
 * like `lib/watchdog.ts` and `lib/appLock.ts` do for their own decisions.
 *
 * WHY THIS EXISTS (PHASE 71). Every route point today is OS-delivery-driven and best-effort: the
 * fused provider is *asked* for a fix on a ~60 s cadence (`distanceInterval: 0` since PHASE 63), but
 * that is a request, not a guarantee. Under Doze or an aggressive OEM battery-kill the real gap
 * between delivered points can stretch far past 60 s — a member's route shows a long flat stretch
 * with no points (the "8 km straight line" report). The watchdog already wakes every ~15 min to keep
 * the recorder ALIVE; PHASE 71 gives it a second job: if the newest recorded point is older than the
 * trigger threshold, take ONE fix right now so a live shift never goes a full hour with no point.
 *
 * HONEST CEILING. WorkManager is itself Doze-deferred — its ~15 min is a floor, and in deep Doze a
 * tick can slip later — so ≤60 min is a best-effort ceiling, NOT a hard real-time guarantee. A hard
 * guarantee would need a native exact-alarm module, which this app does not have. What this DOES buy:
 * as long as the watchdog fires on roughly its interval, the gap between points stays under 60 min
 * (see `STALE_AFTER_MS` below for why the threshold sits a whole interval under the ceiling).
 */

/**
 * The point-gap ceiling the owner cares about: a live shift should never go longer than this without
 * a recorded point. This is the owner's requirement (60 min), not a value invented here.
 */
export const MAX_POINT_GAP_MS = 60 * 60 * 1000; // 60 minutes

/**
 * The watchdog cadence, in ms. MUST match `WATCHDOG_INTERVAL_MIN` in `tracker.ts` (15 min — the
 * Android floor for a periodic `expo-background-task`). Duplicated here rather than imported the
 * other way because `tracker.ts` pulls in the native modules that would break this module's
 * pure/testable property; instead `tracker.ts` imports THIS constant and derives its minutes from
 * it, so the two cannot drift.
 */
export const WATCHDOG_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Trigger a forced fix one whole watchdog interval BEFORE the ceiling, so the FOLLOWING tick still
 * lands at ~60 min. Derived, not guessed: if we only acted at 55 min (the handoff's rough estimate),
 * a tick that saw age 54 min would take no action and the next tick — up to a full interval later —
 * would act at ~69 min, well past the ceiling. Setting the threshold to `ceiling − interval`
 * (60 − 15 = 45 min) makes the worst-case idealized gap `threshold + interval = 60 min` when the
 * watchdog fires exactly on its interval (see the guarantee test in `__tests__/staleBuffer.test.ts`).
 * In reality the gap is 60 min PLUS the fix-acquisition latency (up to `FORCED_FIX_TIMEOUT_MS`) and
 * PLUS any Doze slippage of the watchdog itself — which is why 60 min is a best-effort ceiling, not a
 * hard bound (see the module header). A tighter sub-60 hard bound would need a native exact-alarm.
 */
export const STALE_AFTER_MS = MAX_POINT_GAP_MS - WATCHDOG_INTERVAL_MS; // 45 minutes

/**
 * Whether the route buffer is STALE — the newest recorded point (`lastAtMs`, epoch ms) is old enough
 * that the watchdog should take one fix now. `lastAtMs` is `state.lastAt` from the persisted buffer:
 * the timestamp of the newest point ever recorded this session, which survives a delivery that clears
 * `pts` (so it is the right "when did we last capture a point?" signal, not "what is still buffered").
 *
 * Returns TRUE (take a fix) when:
 *   - there is no recorded point yet — `lastAtMs` is 0 / null / undefined / non-finite. On a fresh
 *     shift this is the "service running but capturing nothing" case (the straight-line bug): we would
 *     rather force an immediate point than wait to discover the stream is dead.
 *   - the newest point is OLDER than `staleAfterMs`.
 *   - the elapsed age is NEGATIVE (the device clock moved backwards) — take a fix rather than trust a
 *     skewed clock and skip one; `ingest` de-dupes / re-baselines the fix safely either way.
 *
 * Returns FALSE only for a valid, recent timestamp within the threshold — the common healthy case
 * where the OS stream is delivering points and the watchdog needs to do nothing.
 */
export function isBufferStale(
  lastAtMs: number | null | undefined,
  nowMs: number,
  staleAfterMs: number = STALE_AFTER_MS,
): boolean {
  if (lastAtMs == null || !Number.isFinite(lastAtMs) || lastAtMs <= 0) return true;
  const age = nowMs - lastAtMs;
  if (!Number.isFinite(age) || age < 0) return true; // clock skew → take a fix rather than trust it
  return age > staleAfterMs;
}
