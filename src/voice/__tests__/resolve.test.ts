/**
 * Pins the resolver's precedence — the "no sixth outcome, no best guess" rule. The order of the
 * checks is a security property (a low-confidence guess must not reveal a forbidden verb), so each
 * branch AND each precedence boundary is tested.
 */
import { describe, it, expect } from 'vitest';
import { decideOutcome, type ResolveInput } from '@/voice/resolve';
import { VOICE } from '@/voice/constants';

/** A fully-resolvable base input; each test overrides one field to drive one outcome. */
const ok: ResolveInput = { intentKnown: true, gateOk: true, confidence: 0.9 };

describe('unknown wins over everything', () => {
  it('an unknown intent id is unknown even at full confidence and passing gate', () => {
    expect(decideOutcome({ ...ok, intentKnown: false }).kind).toBe('unknown');
  });
});

describe('low confidence is checked BEFORE the gate — a misheard command must not leak a refusal', () => {
  it('conf < T with a FAILED gate reports lowConfidence, not forbidden', () => {
    expect(decideOutcome({ ...ok, confidence: 0.4, gateOk: false }).kind).toBe('lowConfidence');
  });
  it('the threshold boundary is inclusive: conf === T resolves', () => {
    expect(decideOutcome({ ...ok, confidence: VOICE.CONFIDENCE_MIN }).kind).toBe('resolved');
  });
  it('just below the threshold is lowConfidence', () => {
    expect(decideOutcome({ ...ok, confidence: VOICE.CONFIDENCE_MIN - 0.001 }).kind).toBe('lowConfidence');
  });
  it('a custom threshold is honoured', () => {
    expect(decideOutcome({ ...ok, confidence: 0.7, threshold: 0.8 }).kind).toBe('lowConfidence');
    expect(decideOutcome({ ...ok, confidence: 0.85, threshold: 0.8 }).kind).toBe('resolved');
  });
});

describe('forbidden is checked before slots and entities', () => {
  it('a failed gate reports forbidden even with a missing slot', () => {
    expect(decideOutcome({ ...ok, gateOk: false, missingSlots: ['name'] }).kind).toBe('forbidden');
  });
});

describe('slot-fill asks for the FIRST missing arg', () => {
  it('reports slotFill with the first missing slot name', () => {
    const out = decideOutcome({ ...ok, missingSlots: ['month', 'year'] });
    expect(out).toEqual({ kind: 'slotFill', slot: 'month' });
  });
  it('no missing slots does not trigger slot-fill', () => {
    expect(decideOutcome({ ...ok, missingSlots: [] }).kind).toBe('resolved');
  });
});

describe('entity resolution — 0 notFound, 2+ disambiguate, 1 resolves', () => {
  it('a required entity with no match is notFound', () => {
    expect(decideOutcome({ ...ok, entity: { required: true, matchCount: 0 } }).kind).toBe('notFound');
  });
  it('a required entity with 2+ matches disambiguates', () => {
    expect(decideOutcome({ ...ok, entity: { required: true, matchCount: 2 } }).kind).toBe('disambiguate');
    expect(decideOutcome({ ...ok, entity: { required: true, matchCount: 9 } }).kind).toBe('disambiguate');
  });
  it('a required entity with exactly one match resolves', () => {
    expect(decideOutcome({ ...ok, entity: { required: true, matchCount: 1 } }).kind).toBe('resolved');
  });
  it('a non-required entity is ignored regardless of matchCount', () => {
    expect(decideOutcome({ ...ok, entity: { required: false, matchCount: 0 } }).kind).toBe('resolved');
  });
});

describe('the happy path', () => {
  it('known + gate ok + confident + slots filled + one match → resolved', () => {
    expect(decideOutcome({ ...ok, entity: { required: true, matchCount: 1 } }).kind).toBe('resolved');
  });
});
