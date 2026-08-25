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
 *    help, tell the user once); a 5xx or a network throw is `keep` (transient — try again next time).
 *  - A `keep` bumps an attempt counter; past `MAX_ATTEMPTS` a draft that keeps getting a 5xx ANSWER
 *    is dropped as a poison-write backstop. A network THROW never counts toward that cap — it never
 *    reached the server, so it is never a poison write (the MAX_QUEUE bound still limits growth).
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
  /**
   * PHASE 78 — the `Idempotency-Key` generated ONCE when this create was first attempted and reused
   * on every replay, so a create the server COMMITTED before its ack was lost dedupes on retry
   * instead of inserting a second row (server keys on `(creator, key)`; `contracts/api.md`
   * §Idempotency-Key). Optional so a draft persisted BEFORE this field existed still parses — it just
   * replays without the header, exactly as it did before (no worse than the old behaviour).
   */
  idempotencyKey?: string;
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
    typeof o.attempts === 'number' &&
    (o.idempotencyKey === undefined || typeof o.idempotencyKey === 'string')
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
 *   - 409 / 429                   → keep   (transient — still committing / rate-limited; retry, no count)
 *   - other 4xx                   → drop   (server refused; retry won't help — notify once)
 *   - network throw               → keep   (never reached the server — NOT a poison write, retry)
 *   - 5xx under the cap           → keep   (transient server fault — try again next reconnect)
 *   - 5xx at/over the cap         → drop   (poison-write backstop — a server that keeps 5xx-ing)
 */
export function flushDecision(
  result: { ok: boolean; status: number } | 'threw',
  attempts: number,
): FlushOutcome {
  if (result !== 'threw' && result.ok) return 'synced';
  // A TRANSIENT 4xx means "retry", not "refused", so it must NOT drop the user's create. `409`
  // `idempotency_in_progress` is the server still committing THIS exact idempotent create — the
  // contract guarantees the retry replays its stored 2xx (`contracts/api.md` §Idempotency-Key) — and
  // `429` is rate-limiting. Dropping either raised a false "could not be saved" notice for a create
  // that WILL succeed, and a manual re-create is the very duplicate idempotency exists to prevent
  // (loophole audit 2026-08-25). Keep + retry on the next reconnect; these never count toward the cap.
  const transient = result !== 'threw' && (result.status === 409 || result.status === 429);
  if (transient) return 'keep';
  const clientRefusal = result !== 'threw' && result.status >= 400 && result.status < 500;
  if (clientRefusal) return 'drop';
  // A network THROW never reached the server, so it is not a poison write and must NEVER count
  // toward the drop cap — else a genuinely-offline draft is silently deleted after MAX_ATTEMPTS
  // offline flushes and the user is falsely told it "could not be saved" (audit 2026-08-21, #3).
  // req() only throws on a dead network / timeout abort; a server ANSWER is always {ok,status}, so
  // 'threw' unambiguously means "never transmitted". The MAX_QUEUE bound still limits growth.
  if (result === 'threw') return 'keep';
  // A server-ANSWERED 5xx that keeps failing IS a poison write — drop it past the cap.
  return attempts + 1 >= MAX_ATTEMPTS ? 'drop' : 'keep';
}
