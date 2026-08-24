/**
 * Band 2 #2 (2026-08-24) — the shared search scorer, extracted from `src/app/search.tsx` into
 * `@/lib/searchScore` so the global Search screen and the Tasks tab score identically. These
 * tests pin the tier ordering, the phone-tail path, out-of-order matching, the weight tie-break
 * and `rank`'s cap — the behaviour the global search relied on but that lived, untested, inside a
 * screen component. If one flips, a scoring rule changed on purpose.
 *
 * `@/lib/searchScore` imports only `@/lib/fuzzyMatch` (both pure), so this needs no stub.
 */
import { describe, expect, it } from 'vitest';
import {
  buildQuery, tierFor, bestHit, matchesFields, rank,
  compactOf, digitsOf,
  T_EXACT, T_PREFIX, T_CONTAINS, T_FUZZY,
  W_ID, W_SECOND, W_TEXT, SERVER_ONLY_SCORE, GROUP_CAP,
  type Field,
} from '@/lib/searchScore';

describe('compactOf / digitsOf', () => {
  it('compactOf lowercases and strips everything but a-z0-9', () => {
    expect(compactOf('CLM-2024/8891')).toBe('clm20248891');
    expect(compactOf('Rajesh Patel')).toBe('rajeshpatel');
  });
  it('digitsOf keeps only digits', () => {
    expect(digitsOf('+91 98765 43210')).toBe('919876543210');
    expect(digitsOf('no digits here')).toBe('');
  });
});

describe('buildQuery', () => {
  it('tokenises on whitespace and lowercases', () => {
    const q = buildQuery('  Rajesh   Patel ');
    expect(q.lower).toBe('rajesh   patel');
    expect(q.tokens).toEqual(['rajesh', 'patel']);
  });
  it('flags a digits-only query as numeric', () => {
    expect(buildQuery('9876543210').numeric).toBe(true);
    expect(buildQuery('+91 98765 43210').numeric).toBe(true); // compact === digits
    expect(buildQuery('rajesh').numeric).toBe(false);
    expect(buildQuery('').numeric).toBe(false);
  });
});

describe('tierFor — the five tiers', () => {
  it('EXACT for a whole-string or compact match', () => {
    expect(tierFor(buildQuery('rajesh'), 'Rajesh')).toBe(T_EXACT);
    expect(tierFor(buildQuery('clm 2024 8891'), 'CLM-2024/8891')).toBe(T_EXACT); // compact equal
  });
  it('PREFIX when the value (or one of its words) starts with the query', () => {
    expect(tierFor(buildQuery('raj'), 'Rajesh Patel')).toBe(T_PREFIX);
    // a word start anywhere counts: "anand" reaches "Jeevan Anand" as a prefix
    expect(tierFor(buildQuery('anand'), 'Jeevan Anand')).toBe(T_PREFIX);
  });
  it('CONTAINS for a mid-word substring', () => {
    expect(tierFor(buildQuery('eev'), 'Jeevan')).toBe(T_CONTAINS);
  });
  it('CONTAINS for out-of-order multi-word: "patel rajesh" finds "Rajesh Patel"', () => {
    expect(tierFor(buildQuery('patel rajesh'), 'Rajesh Patel')).toBe(T_CONTAINS);
  });
  it('FUZZY for a transposed/typo token, ranked below a real substring', () => {
    expect(tierFor(buildQuery('rajseh'), 'Rajesh Patel')).toBe(T_FUZZY);
    expect(T_FUZZY).toBeLessThan(T_CONTAINS);
  });
  it('MISS (0) when nothing matches', () => {
    expect(tierFor(buildQuery('zzzz'), 'Rajesh')).toBe(0);
  });
});

describe('tierFor — numeric / phone lookups', () => {
  it('matches a phone by its TAIL (>= 4 digits) as a prefix-strength hit', () => {
    expect(tierFor(buildQuery('8891'), '9876588891')).toBe(T_PREFIX);
  });
  it('matches the full number exactly', () => {
    expect(tierFor(buildQuery('9876588891'), '98765-88891')).toBe(T_EXACT);
  });
  it('does NOT fuzzy-match a wrong digit — a near-miss on a number is a wrong answer', () => {
    // "8892" is one edit from "…8891" but must never pull back a different person's number.
    expect(tierFor(buildQuery('8892'), '9876588891')).toBe(0);
  });
  it('a 3-digit tail is too short for a SUFFIX match — only a plain substring, never a clean miss trick', () => {
    // '891' is below MIN_SUFFIX_DIGITS(4), so the endsWith suffix path is skipped; it still lands
    // as an ordinary substring (CONTAINS), NOT the stronger suffix hit (PREFIX). Lowering the
    // minimum to 3 would make endsWith fire and return PREFIX, breaking this exact assertion.
    expect(tierFor(buildQuery('891'), '9876588891')).toBe(T_CONTAINS);
    // A too-short run that is nowhere in the number is a clean miss (0), never a suffix hit.
    expect(tierFor(buildQuery('123'), '9876588891')).toBe(0);
  });
});

describe('bestHit — strongest field, tier over weight', () => {
  const fields = (arr: [string, string, number][]): Field[] =>
    arr.map(([key, value, weight]) => ({ key, value, weight }));

  it('scores as tier*10 + weight', () => {
    const hit = bestHit(buildQuery('rajesh'), fields([['name', 'Rajesh', W_ID]]));
    expect(hit).toEqual({ score: T_EXACT * 10 + W_ID, field: { key: 'name', value: 'Rajesh', weight: W_ID } });
  });
  it('an EXACT hit on a weak field beats a CONTAINS hit on a strong field (tier dominates)', () => {
    const hit = bestHit(buildQuery('raj'), fields([
      ['weak', 'raj', W_TEXT],       // exact  -> 3*10 + 1 = 31
      ['strong', 'suraj', W_ID],     // contains -> 1*10 + 3 = 13
    ]));
    expect(hit?.field.key).toBe('weak');
  });
  it('breaks a same-tier tie towards the heavier field', () => {
    const hit = bestHit(buildQuery('raj'), fields([
      ['light', 'raj', W_TEXT],
      ['heavy', 'raj', W_ID],
    ]));
    expect(hit?.field.key).toBe('heavy');
  });
  it('skips empty-valued fields and returns null on no match', () => {
    expect(bestHit(buildQuery('raj'), fields([['x', '', W_ID]]))).toBeNull();
    expect(bestHit(buildQuery('zzz'), fields([['name', 'Rajesh', W_ID]]))).toBeNull();
  });
});

describe('matchesFields — filter sugar over bestHit', () => {
  const f: Field[] = [{ key: 'name', value: 'Rajesh Patel', weight: W_SECOND }];
  it('true when any field matches (incl. typo)', () => {
    expect(matchesFields(buildQuery('patel'), f)).toBe(true);
    expect(matchesFields(buildQuery('rajseh'), f)).toBe(true);
  });
  it('false when nothing matches', () => {
    expect(matchesFields(buildQuery('sunita'), f)).toBe(false);
  });
});

describe('rank — sort, keepServerMatched, cap', () => {
  type Row = { name: string };
  const fieldsOf = (r: Row): Field[] => [{ key: 'name', value: r.name, weight: W_ID }];

  it('sorts by score descending (exact before prefix)', () => {
    const out = rank([{ name: 'Rajesh Patel' }, { name: 'Rajesh' }], buildQuery('rajesh'), fieldsOf);
    expect(out.map((r) => r.item.name)).toEqual(['Rajesh', 'Rajesh Patel']);
  });
  it('drops non-matches by default, keeps them (scored last) when keepServerMatched', () => {
    expect(rank([{ name: 'Zzz' }], buildQuery('rajesh'), fieldsOf)).toEqual([]);
    const kept = rank([{ name: 'Zzz' }], buildQuery('rajesh'), fieldsOf, true);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ hit: null, score: SERVER_ONLY_SCORE });
  });
  it('caps the returned rows at GROUP_CAP', () => {
    const many = Array.from({ length: GROUP_CAP + 5 }, () => ({ name: 'Rajesh' }));
    expect(rank(many, buildQuery('rajesh'), fieldsOf)).toHaveLength(GROUP_CAP);
  });
});
