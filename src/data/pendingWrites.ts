/**
 * Pending-writes bus — the reactive half of the offline write queue (Phase 57b).
 *
 * Holds the SIGNED-IN user's queued creates in memory so a screen can render a "Pending sync" row
 * and react when a draft is enqueued or flushed — without any screen polling storage. The durable
 * copy lives in AsyncStorage (`offlineStore` / `writeQueue`); this bus is loaded from it on sign-in
 * (`api.setCurrentUser`) and kept in step by enqueue/flush in `api.ts`.
 *
 * Pure — NO React (mirrors `health.ts` / `freshness.ts`). The hook `usePendingWrites` lives in
 * `src/ui/pending.tsx`. Reset (not cleared from disk) on sign-out: the queue PERSISTS across a
 * logout (spec row 12) — only the in-memory mirror is dropped so the next user starts clean.
 */
import type { QueuedWrite, QueueKind } from '@/lib/writeQueue';

type Listener = () => void;

let list: QueuedWrite[] = [];
/**
 * A one-time COUNT of drafts a flush REFUSED-and-removed (a 4xx / attempt-cap drop — spec row 11).
 * A screen shows it once, rendering the translated `sync.dropped{One,Many}` message, then calls
 * `setDropCount(0)`. The count (not a pre-formatted string) lives here because the flush that sets it
 * is in the non-React api layer with no translator, and this "your work was removed" notice must
 * reach a Hindi/Gujarati field agent in their own language. Held here (not per-screen) so a drop that
 * happens while the notes screen is closed is still surfaced the next time it opens.
 */
let dropCount = 0;
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

/** Replace the whole in-memory queue (called after every load / enqueue / flush step). */
export function setPending(next: QueuedWrite[]): void {
  list = next;
  emit();
}

export function getPending(): QueuedWrite[] {
  return list;
}

export function getPendingByKind(kind: QueueKind): QueuedWrite[] {
  return list.filter((d) => d.kind === kind);
}

/** Drop the in-memory mirror only (the stored queue survives sign-out — spec row 12). */
export function resetPending(): void {
  list = [];
  dropCount = 0;
  emit();
}

export function getDropCount(): number {
  return dropCount;
}

/** Record how many drafts a refused flush removed (0 clears it). A screen shows the notice once. */
export function setDropCount(n: number): void {
  dropCount = n;
  emit();
}

export function subscribePending(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
