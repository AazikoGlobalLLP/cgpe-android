/**
 * Phase D5 — typo tolerance for search. Pure edit-distance rules, no book, no network.
 * If one of these flips, the fuzzy threshold or the transposition handling changed on
 * purpose — this file is where that decision lives.
 */
import { describe, it, expect } from 'vitest';
import {
  osaWithin,
  fuzzyBudget,
  tokenFuzzyHit,
  FUZZY_MIN,
  FUZZY_LONG,
} from '@/lib/fuzzyMatch';

describe('osaWithin — bounded OSA edit distance', () => {
  it('is 0 for identical strings (within any non-negative budget)', () => {
    expect(osaWithin('rajesh', 'rajesh', 1)).toBe(true);
    expect(osaWithin('', '', 0)).toBe(true);
  });

  it('a zero budget forgives nothing but equality', () => {
    expect(osaWithin('rajesh', 'rajseh', 0)).toBe(false);
    expect(osaWithin('a', 'a', 0)).toBe(true);
  });

  it('counts one substitution / insertion / deletion as distance 1', () => {
    expect(osaWithin('rajesh', 'rejesh', 1)).toBe(true); // substitution
    expect(osaWithin('jeevan', 'jeevn', 1)).toBe(true);  // deletion
    expect(osaWithin('jeevn', 'jeevan', 1)).toBe(true);  // insertion (order-independent)
  });

  it('counts an ADJACENT transposition as distance 1, not 2', () => {
    expect(osaWithin('rajseh', 'rajesh', 1)).toBe(true);
    expect(osaWithin('paetl', 'patel', 1)).toBe(true);
  });

  it('two independent edits need a budget of 2', () => {
    expect(osaWithin('rajseh', 'rejesh', 1)).toBe(false); // transpose + substitute
    expect(osaWithin('rajseh', 'rejesh', 2)).toBe(true);
  });

  it('rejects immediately when the length gap alone exceeds the budget', () => {
    expect(osaWithin('anand', 'anandkumar', 1)).toBe(false);
    expect(osaWithin('anand', 'anandkumar', 5)).toBe(true);
  });
});

describe('fuzzyBudget — length gates the edit budget', () => {
  it('is 0 (ineligible) below the minimum length', () => {
    expect(fuzzyBudget(FUZZY_MIN - 1)).toBe(0);
    expect(fuzzyBudget(1)).toBe(0);
  });

  it('is 1 for a short-but-eligible token', () => {
    expect(fuzzyBudget(FUZZY_MIN)).toBe(1);
    expect(fuzzyBudget(FUZZY_LONG - 1)).toBe(1);
  });

  it('is 2 once the token is long enough to absorb more noise', () => {
    expect(fuzzyBudget(FUZZY_LONG)).toBe(2);
    expect(fuzzyBudget(12)).toBe(2);
  });
});

describe('tokenFuzzyHit — a token against a value’s words', () => {
  it('matches a transposed surname among a name’s words', () => {
    expect(tokenFuzzyHit('rajseh', ['rajesh', 'patel'])).toBe(true);
  });

  it('matches a dropped vowel on a first name', () => {
    expect(tokenFuzzyHit('jeevn', ['jeevan', 'anand'])).toBe(true);
  });

  it('refuses a token too short to be safe, even with an exact word present', () => {
    expect(tokenFuzzyHit('raj', ['raj', 'patel'])).toBe(false);
  });

  it('never targets a word shorter than the minimum', () => {
    // "abcd" is one edit from "abc", but "abc" is too short to be a fuzzy target.
    expect(tokenFuzzyHit('abcd', ['abc'])).toBe(false);
  });

  it('is a miss when every word is more edits away than the budget allows', () => {
    expect(tokenFuzzyHit('rajesh', ['sunita', 'mehta'])).toBe(false);
  });

  it('gives a 7+ character token the room for two edits', () => {
    // "kumarr" (6) → one budget; "kumaresh" mistyped needs the longer allowance.
    expect(tokenFuzzyHit('kumaresh', ['kumraesh'])).toBe(true); // transposition, len 8
  });
});
