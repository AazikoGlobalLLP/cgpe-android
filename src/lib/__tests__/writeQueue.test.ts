import { describe, it, expect } from 'vitest';
import {
  QUEUE_PREFIX,
  MAX_QUEUE,
  MAX_ATTEMPTS,
  queueKey,
  isQueueKey,
  parseQueue,
  serializeQueue,
  addToQueue,
  removeFromQueue,
  bumpAttempt,
  flushDecision,
  type QueuedWrite,
} from '@/lib/writeQueue';

/**
 * PHASE 57b. The write queue's device I/O (`offlineStore`) and orchestration (`api.flushWriteQueue`)
 * are only exercisable on a device (the AsyncStorage stub is a no-op), so every DECISION lives here
 * and is pinned — the same pure-seam discipline as `offlineCache.ts` / `netResilience.ts`.
 */
const draft = (over: Partial<QueuedWrite> = {}): QueuedWrite => ({
  id: 'pending-1',
  kind: 'note',
  payload: { text: 'hi', category: 'note', tags: [] },
  createdAt: '2026-08-20T00:00:00.000Z',
  attempts: 0,
  ...over,
});

describe('queue keys', () => {
  it('namespaces per user under the versioned prefix', () => {
    expect(queueKey('u1')).toBe(`${QUEUE_PREFIX}u1`);
  });
  it('isQueueKey matches queue keys and not cache keys', () => {
    expect(isQueueKey('queue.v1.u1')).toBe(true);
    expect(isQueueKey('cache.v1.u1.leads')).toBe(false);
    expect(isQueueKey('clock.u1')).toBe(false);
  });
});

describe('parse / serialize', () => {
  it('round-trips a queue', () => {
    const list = [draft(), draft({ id: 'pending-2' })];
    expect(parseQueue(serializeQueue(list))).toEqual(list);
  });
  it('returns [] for malformed input — a corrupt queue must never crash a create', () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue('')).toEqual([]);
    expect(parseQueue('not json')).toEqual([]);
    expect(parseQueue('{"not":"an array"}')).toEqual([]);
  });
  it('drops only the malformed ITEMS, keeping the valid ones', () => {
    const raw = JSON.stringify([
      draft({ id: 'good' }),
      { id: 'no-kind', payload: {}, createdAt: 'x', attempts: 0 },     // missing kind
      { id: 'bad-kind', kind: 'reminder', payload: {}, createdAt: 'x', attempts: 0 }, // unknown kind
      { kind: 'note', payload: {}, createdAt: 'x', attempts: 0 },      // missing id
      draft({ id: 'good2' }),
    ]);
    expect(parseQueue(raw).map((d) => d.id)).toEqual(['good', 'good2']);
  });
  it('accepts the note, task AND lead kinds (57b/57c), still rejecting others', () => {
    const raw = JSON.stringify([
      draft({ id: 'a-note', kind: 'note' }),
      draft({ id: 'a-task', kind: 'task' }),
      draft({ id: 'a-lead', kind: 'lead' }),
      { id: 'a-reminder', kind: 'reminder', payload: {}, createdAt: 'x', attempts: 0 },   // unknown → dropped
    ]);
    expect(parseQueue(raw).map((d) => d.id)).toEqual(['a-note', 'a-task', 'a-lead']);
  });
});

describe('mutations', () => {
  it('addToQueue appends', () => {
    expect(addToQueue([draft({ id: 'a' })], draft({ id: 'b' })).map((d) => d.id)).toEqual(['a', 'b']);
  });
  it('addToQueue caps at MAX_QUEUE, dropping the OLDEST', () => {
    const full = Array.from({ length: MAX_QUEUE }, (_, i) => draft({ id: `d${i}` }));
    const next = addToQueue(full, draft({ id: 'newest' }));
    expect(next).toHaveLength(MAX_QUEUE);
    expect(next[0].id).toBe('d1');                 // d0 (oldest) dropped
    expect(next[next.length - 1].id).toBe('newest');
  });
  it('removeFromQueue removes by id', () => {
    expect(removeFromQueue([draft({ id: 'a' }), draft({ id: 'b' })], 'a').map((d) => d.id)).toEqual(['b']);
  });
  it('bumpAttempt increments only the matching draft, immutably', () => {
    const list = [draft({ id: 'a', attempts: 0 }), draft({ id: 'b', attempts: 2 })];
    const next = bumpAttempt(list, 'b');
    expect(next[1].attempts).toBe(3);
    expect(next[0].attempts).toBe(0);
    expect(list[1].attempts).toBe(2);              // original untouched
  });
});

describe('flushDecision — spec row 11', () => {
  it('2xx → synced (remove)', () => {
    expect(flushDecision({ ok: true, status: 200 }, 0)).toBe('synced');
    expect(flushDecision({ ok: true, status: 201 }, 4)).toBe('synced');   // success wins over the cap
  });
  it('4xx → drop (server refused; retry cannot help)', () => {
    expect(flushDecision({ ok: false, status: 400 }, 0)).toBe('drop');
    expect(flushDecision({ ok: false, status: 403 }, 0)).toBe('drop');
    expect(flushDecision({ ok: false, status: 422 }, 0)).toBe('drop');
  });
  it('409 idempotency_in_progress → keep, NEVER drop (the server is still committing THIS create; the retry gets the stored 2xx — loophole audit 2026-08-25)', () => {
    expect(flushDecision({ ok: false, status: 409 }, 0)).toBe('keep');
    // Regression pin: 409 used to fall into the 4xx→drop branch, raising a false "could not be saved"
    // notice for a lead the server DID commit — and a manual re-create is the very duplicate the
    // idempotency key exists to prevent. It is transient, so it must keep even past the attempt cap.
    expect(flushDecision({ ok: false, status: 409 }, MAX_ATTEMPTS + 5)).toBe('keep');
  });
  it('429 rate-limited → keep (slow down; do not drop the user\'s create)', () => {
    expect(flushDecision({ ok: false, status: 429 }, 0)).toBe('keep');
    expect(flushDecision({ ok: false, status: 429 }, MAX_ATTEMPTS + 5)).toBe('keep');
  });
  it('5xx under the attempt cap → keep (transient)', () => {
    expect(flushDecision({ ok: false, status: 500 }, 0)).toBe('keep');
    expect(flushDecision({ ok: false, status: 503 }, 1)).toBe('keep');
  });
  it('a network throw is ALWAYS kept — it never reached the server, so never counts toward the cap (audit #3)', () => {
    expect(flushDecision('threw', 0)).toBe('keep');
    // Regression pin: this was 'drop', the bug that silently DELETED a never-sent create after
    // MAX_ATTEMPTS offline flushes and told the user it "could not be saved".
    expect(flushDecision('threw', MAX_ATTEMPTS - 1)).toBe('keep');
    expect(flushDecision('threw', MAX_ATTEMPTS + 10)).toBe('keep');
  });
  it('a server-ANSWERED 5xx past MAX_ATTEMPTS is DROPPED (poison-write backstop)', () => {
    expect(flushDecision({ ok: false, status: 500 }, MAX_ATTEMPTS - 1)).toBe('drop');
    expect(flushDecision({ ok: false, status: 503 }, MAX_ATTEMPTS)).toBe('drop');
  });
});
