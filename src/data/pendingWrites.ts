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
 * A one-time "N draft(s) couldn't be saved and were removed" message, set by the flush when the
 * server REFUSED a draft (a 4xx / attempt-cap drop — spec row 11). A screen shows it once and calls
 * `setDropNotice(null)`. Held here (not per-screen) so a drop that happens while the notes screen is
 * closed is still surfaced the next time it opens.
 */
let dropNotice: string | null = null;
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
  dropNotice = null;
  emit();
}

export function getDropNotice(): string | null {
  return dropNotice;
}

/** Set (or clear, with null) the one-time drop notice a screen shows after a refused flush. */
export function setDropNotice(msg: string | null): void {
  dropNotice = msg;
  emit();
}

export function subscribePending(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
