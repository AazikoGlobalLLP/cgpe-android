/**
 * Phase 57b — PURE offline write-queue logic.
 *
 * The safe write queue (spec `docs/spec/PHASE-57.md` rows 8-12) holds ADDITIVE, user-owned creates
 * that could not reach the server because the network was down, so they are not lost and are
 * replayed on reconnect. Like `offlineCache.ts`, every decision lives here (unit-tested) and the
 * device I/O + orchestration live in `data/offlineStore.ts` / `data/pendingWrites.ts` / `api.ts`.
 *
 * HARD RULES this encodes:
 *  - Enqueue ONLY on a network failure (a thrown request — dead network / timeout abort). A server
 *    ANSWER that refuses the write (a 4xx/5xx) is NOT queued: retrying a rejected write is wrong.
 *  - On flush: a 2xx is `synced` (remove); a 4xx is `drop` (the server refused — retrying can't
 *    help, tell the user once); a 5xx or a fresh throw is `keep` (transient — try again next time).
 *  - A `keep` bumps an attempt counter; past `MAX_ATTEMPTS` the draft is dropped as a safety
 *    backstop so a permanently-failing write can't sit in the queue forever.
 */

export const QUEUE_PREFIX = 'queue.v1.';

/** Cap the queue so an offline burst can't grow AsyncStorage without bound. Oldest drop first. */
export const MAX_QUEUE = 100;

/** A draft kept-failing this many times is dropped (with a notice) — a poison-write backstop. */
export const MAX_ATTEMPTS = 5;

/** The kinds of create the queue can replay. Notes + Tasks + Leads (57b/57c). Extensible. */
export type QueueKind = 'note' | 'task' | 'lead';

export type QueuedWrite = {
  /** Client temp id (e.g. `pending-<ts>-<rand>`). Replaced by the server id once flushed. */
  id: string;
  kind: QueueKind;
  /** The exact request body the create endpoint expects (e.g. `{ text, category, tags }`). */
  payload: Record<string, unknown>;
  /** ISO time the user made the draft — shown as "created <ago>", and the replay order. */
  createdAt: string;
  /** Failed-flush counter; a draft is dropped once it exceeds MAX_ATTEMPTS. */
  attempts: number;
};

export function queueKey(userId: string): string {
  return `${QUEUE_PREFIX}${userId}`;
}

export function isQueueKey(key: string): boolean {
  return key.startsWith(QUEUE_PREFIX);
}

const KINDS: QueueKind[] = ['note', 'task', 'lead'];

function isQueuedWrite(o: any): o is QueuedWrite {
  return (
    o && typeof o === 'object' &&
    typeof o.id === 'string' &&
    KINDS.includes(o.kind) &&
    o.payload && typeof o.payload === 'object' && !Array.isArray(o.payload) &&
    typeof o.createdAt === 'string' &&
    typeof o.attempts === 'number'
  );
}

/** Parse a stored queue. Drops any malformed ITEM rather than failing the whole queue. */
export function parseQueue(raw: string | null | undefined): QueuedWrite[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isQueuedWrite);
  } catch {
    return [];
  }
}

export function serializeQueue(list: QueuedWrite[]): string {
  return JSON.stringify(list);
}

/** Append a draft, keeping at most MAX_QUEUE (oldest dropped first). */
export function addToQueue(list: QueuedWrite[], draft: QueuedWrite): QueuedWrite[] {
  return [...list, draft].slice(-MAX_QUEUE);
}

export function removeFromQueue(list: QueuedWrite[], id: string): QueuedWrite[] {
  return list.filter((d) => d.id !== id);
}

/** Return a new list with `attempts` incremented for one draft (immutable). */
export function bumpAttempt(list: QueuedWrite[], id: string): QueuedWrite[] {
  return list.map((d) => (d.id === id ? { ...d, attempts: d.attempts + 1 } : d));
}

export type FlushOutcome = 'synced' | 'drop' | 'keep';

/**
 * Decide what a single replay attempt means (spec row 11). `result` is the request outcome:
 * `{ ok, status }` when the server answered, or `'threw'` when the network failed. `attempts` is
 * the draft's count BEFORE this attempt.
 *   - 2xx                         → synced (remove)
 *   - 4xx                         → drop   (server refused; retry won't help — notify once)
 *   - 5xx / threw, under the cap  → keep   (transient — try again next reconnect)
 *   - anything, at/over the cap   → drop   (poison-write backstop)
 */
export function flushDecision(
  result: { ok: boolean; status: number } | 'threw',
  attempts: number,
): FlushOutcome {
  if (result !== 'threw' && result.ok) return 'synced';
  const clientRefusal = result !== 'threw' && result.status >= 400 && result.status < 500;
  if (clientRefusal) return 'drop';
  // 5xx or a network throw: transient — keep, unless we've already tried too many times.
  return attempts + 1 >= MAX_ATTEMPTS ? 'drop' : 'keep';
}
