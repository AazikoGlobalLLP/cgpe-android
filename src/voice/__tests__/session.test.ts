/**
 * The voice session holds per-user context in JS memory, so it is a documented shared-handset danger
 * zone. These tests pin the memory cap, the idle expiry, the DPDP slot redaction, and — the one that
 * matters most — that `api.ts#resetApiState()` tears it down, so it cannot leak across users.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordUserTurn, recordAssistantTurn, setSlot, clearSlot, currentSlot, slotForNlu,
  setLastIntent, lastIntentId, historyForNlu, isIdleExpired, expireIfIdle, reset,
} from '@/voice/session';
import { VOICE } from '@/voice/constants';

beforeEach(() => reset());

describe('turns — capped at HISTORY_KEEP, most recent kept', () => {
  it('keeps only the last HISTORY_KEEP turns', () => {
    for (let i = 0; i < VOICE.HISTORY_KEEP + 3; i++) recordUserTurn(`t${i}`, i + 1);
    const sent = historyForNlu();
    expect(sent).toHaveLength(VOICE.HISTORY_SEND);
    // The last turn sent is the most recent recorded.
    expect(sent[sent.length - 1].text).toBe(`t${VOICE.HISTORY_KEEP + 2}`);
  });
  it('historyForNlu returns the last HISTORY_SEND turns, as copies', () => {
    recordUserTurn('a', 1);
    recordAssistantTurn('b', 2);
    recordUserTurn('c', 3);
    recordAssistantTurn('d', 4);
    const sent = historyForNlu();
    expect(sent.map((t) => t.text)).toEqual(['b', 'c', 'd'].slice(-VOICE.HISTORY_SEND));
    // mutating the returned copy must not affect the store
    sent[0].text = 'MUT';
    expect(historyForNlu()[0].text).not.toBe('MUT');
  });
});

describe('slot — kept with its id on the phone, redacted for the NLU', () => {
  it('currentSlot exposes the id (for on-phone pronoun resolution)', () => {
    setSlot({ kind: 'client', label: 'Ramesh', id: 'c123' }, 100);
    expect(currentSlot()).toEqual({ kind: 'client', label: 'Ramesh', id: 'c123' });
  });
  it('slotForNlu exposes kind+label ONLY — never the id', () => {
    setSlot({ kind: 'client', label: 'Ramesh', id: 'c123' }, 100);
    const forNlu = slotForNlu();
    expect(forNlu).toEqual({ kind: 'client', label: 'Ramesh' });
    expect(forNlu && 'id' in forNlu).toBe(false);
  });
  it('clearSlot removes it', () => {
    setSlot({ kind: 'client', label: 'Ramesh', id: 'c123' }, 100);
    clearSlot();
    expect(currentSlot()).toBeNull();
    expect(slotForNlu()).toBeNull();
  });
});

describe('last intent id', () => {
  it('round-trips', () => {
    setLastIntent('tasks.today.count');
    expect(lastIntentId()).toBe('tasks.today.count');
  });
});

describe('idle expiry — time is an explicit argument, never a clock', () => {
  it('no activity is never expired', () => {
    expect(isIdleExpired(999_999_999)).toBe(false);
  });
  it('within the idle window is not expired; past it is', () => {
    recordUserTurn('x', 1000);
    expect(isIdleExpired(1000 + VOICE.SESSION_IDLE_MS)).toBe(false); // boundary is inclusive-alive
    expect(isIdleExpired(1000 + VOICE.SESSION_IDLE_MS + 1)).toBe(true);
  });
  it('expireIfIdle clears the session when idle and reports it', () => {
    setSlot({ kind: 'client', label: 'R', id: 'c1' }, 1000);
    expect(expireIfIdle(1000 + VOICE.SESSION_IDLE_MS + 1)).toBe(true);
    expect(currentSlot()).toBeNull();
  });
  it('expireIfIdle is a no-op when still fresh', () => {
    setSlot({ kind: 'client', label: 'R', id: 'c1' }, 1000);
    expect(expireIfIdle(1001)).toBe(false);
    expect(currentSlot()).not.toBeNull();
  });
});

describe('reset clears everything', () => {
  it('turns, slot and last intent are gone', () => {
    recordUserTurn('x', 1);
    setSlot({ kind: 'client', label: 'R', id: 'c1' }, 1);
    setLastIntent('tasks.today.count');
    reset();
    expect(historyForNlu()).toEqual([]);
    expect(currentSlot()).toBeNull();
    expect(lastIntentId()).toBeNull();
  });
});

describe('🔴 shared-handset teardown — resetApiState() clears the voice session', () => {
  it('a resolved slot is gone after resetApiState()', async () => {
    vi.resetModules();
    const sess = await import('@/voice/session');
    const api = await import('@/data/api');
    sess.setSlot({ kind: 'client', label: 'Ramesh', id: 'c1' }, 1000);
    expect(sess.currentSlot()).not.toBeNull();
    api.resetApiState();
    expect(sess.currentSlot()).toBeNull();
  });
});
