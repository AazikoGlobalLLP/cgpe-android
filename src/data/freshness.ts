/**
 * Freshness bus — the visible half of the read cache (Phase 57a).
 *
 * `data/health` answers "could this endpoint be reached?" This sibling bus answers a different
 * question the cache introduces: "the rows on screen — are they LIVE, or a stale copy served
 * because the re-fetch failed, and if stale, from when?" (GLOSSARY "Freshness bus".)
 *
 * It is a separate channel, not a field on `HealthState`, for one reason: it must carry
 * information WITHOUT changing any read function's return type. `getTasks` still returns
 * `Task[]`; it just also calls `markFresh`/`markStale` on the way out, and a screen reads the
 * verdict with `useDataFreshness(key)` to decide whether to render the "Synced <time>" chip.
 * No union types, no 33-screen ripple — the exact reasoning `health.ts` gives for its own shape.
 *
 * Pure — NO React here (mirrors `health.ts`). The hook `useDataFreshness` lives in
 * `src/ui/SyncChip.tsx`, the same way `useDataHealth` lives in `ui/health-banner.tsx`.
 */

export type FreshnessEntry = {
  /** True when the rows currently shown for this endpoint came from the cache, not a live fetch. */
  stale: boolean;
  /** ms timestamp the shown rows were last successfully fetched. On a live read, `Date.now()`. */
  syncedAt: number;
};

type Listener = () => void;

const map = new Map<string, FreshnessEntry>();
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // A throwing subscriber must not stop the others from learning about the change.
    }
  });
}

/** A live read landed: the shown rows are fresh as of now. Clears any stale mark for this key. */
export function markFresh(key: string): void {
  map.set(key, { stale: false, syncedAt: Date.now() });
  emit();
}

/** A read failed but the cache served rows: mark them stale, stamped with the cache's own write time. */
export function markStale(key: string, syncedAt: number): void {
  map.set(key, { stale: true, syncedAt });
  emit();
}

export function getFreshness(key: string): FreshnessEntry | null {
  return map.get(key) ?? null;
}

/** Drop all freshness marks. Called on sign-out so the next session starts clean (like `resetHealth`). */
export function resetFreshness(): void {
  map.clear();
  emit();
}

export function subscribeFreshness(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
