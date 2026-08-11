/**
 * PHASE 21 (i18n P0) — t(key, params): interpolation + plurals.
 *
 * The dictionaries still carry only the 74 static keys (parity gate unchanged) — this phase adds
 * the MECHANISM that lets a future phase wire dynamic strings without string concatenation. So the
 * plural + interpolation paths are pinned against a CONTROLLED lookup injected into `translate`,
 * which is exactly why `translate` takes an optional `lookup`: no real key is added here, yet every
 * branch is exercised. Pure data — no React, no storage, no network, no device.
 */
import { describe, expect, it } from 'vitest';
import { interpolate, pluralCategory, translate, type TParams } from '@/i18n';

/** A fake dictionary that stands in for the shipped one, so plural/interpolation are testable
 *  without adding real keys (which would trip the hard 74-key parity count in dictionaries.test). */
const fake = (table: Record<string, string>) => (k: string): string | undefined => table[k];

describe('interpolate — named placeholder fill', () => {
  it('substitutes a single named placeholder', () => {
    expect(interpolate('Namaste {name}', { name: 'Asha' })).toBe('Namaste Asha');
  });

  it('substitutes several placeholders, repeated ones included', () => {
    expect(interpolate('{n} of {total} ({n} done)', { n: 3, total: 5 })).toBe('3 of 5 (3 done)');
  });

  it('stringifies numbers, and 0 is a value not a blank', () => {
    expect(interpolate('{count} left', { count: 0 })).toBe('0 left');
  });

  it('leaves an unmatched placeholder verbatim so the gap is visible', () => {
    expect(interpolate('Moved to {stage}', {})).toBe('Moved to {stage}');
  });

  it('treats a null/undefined param as missing, not as the string "null"', () => {
    // `undefined` cannot be typed into TParams, but a runtime hole must degrade to the token.
    expect(interpolate('Hi {name}', { name: undefined as unknown as string })).toBe('Hi {name}');
  });

  it('returns a template with no placeholders unchanged', () => {
    expect(interpolate('All clear!', { unused: 'x' })).toBe('All clear!');
  });

  it('does not touch a lone brace that is not a {word} token', () => {
    expect(interpolate('Save 50% { off', { off: 'now' })).toBe('Save 50% { off');
  });
});

describe('pluralCategory — CLDR cardinal, two forms', () => {
  it('English: only exactly 1 is "one"; 0 and 2+ are "other"', () => {
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 0)).toBe('other');
    expect(pluralCategory('en', 2)).toBe('other');
    expect(pluralCategory('en', 99)).toBe('other');
  });

  it('Hindi & Gujarati: BOTH 0 and 1 are "one"; 2+ is "other"', () => {
    for (const lang of ['hi', 'gu', 'hi-en', 'gu-en'] as const) {
      expect(pluralCategory(lang, 0)).toBe('one');
      expect(pluralCategory(lang, 1)).toBe('one');
      expect(pluralCategory(lang, 2)).toBe('other');
    }
  });

  it('uses the magnitude, so a negative count picks the same form as its absolute', () => {
    expect(pluralCategory('en', -1)).toBe('one');
    expect(pluralCategory('en', -3)).toBe('other');
  });
});

describe('translate — composed resolve + plural + interpolate (injected lookup)', () => {
  const dict = fake({
    'greet.hi': 'Namaste {name}',
    'tasks.left_one': '{count} task left',
    'tasks.left_other': '{count} tasks left',
    'plain.base': 'Overdue by {n} days',
  });
  const tr = (key: string, params?: TParams) => translate('en', key, params, dict);

  it('interpolates params into a resolved string', () => {
    expect(tr('greet.hi', { name: 'Asha' })).toBe('Namaste Asha');
  });

  it('selects the plural variant by params.count and fills {count}', () => {
    expect(tr('tasks.left', { count: 1 })).toBe('1 task left');
    expect(tr('tasks.left', { count: 4 })).toBe('4 tasks left');
  });

  it('picks the Hindi plural category for a Hindi lang (0 → "one")', () => {
    // count 0: English would want _other, Hindi wants _one — proving the category is lang-driven.
    expect(translate('hi', 'tasks.left', { count: 0 }, dict)).toBe('0 task left');
    expect(translate('en', 'tasks.left', { count: 0 }, dict)).toBe('0 tasks left');
  });

  it('falls back to the base key when no plural variant exists', () => {
    expect(tr('plain.base', { count: 2, n: 2 })).toBe('Overdue by 2 days');
  });

  it('interpolates without pluralizing when params carry no count', () => {
    expect(tr('greet.hi', { name: 'Ravi' })).toBe('Namaste Ravi');
  });

  it('ignores a non-numeric count for plural selection but still interpolates it', () => {
    // count as a string is not a valid plural selector; the base key is used and {count} filled.
    expect(tr('plain.base', { n: 3, count: '9' as unknown as number })).toBe('Overdue by 3 days');
  });

  it('returns the key itself when nothing resolves (never-blank contract, unchanged)', () => {
    expect(tr('no.such.key')).toBe('no.such.key');
    expect(tr('no.such.key', { name: 'x' })).toBe('no.such.key');
  });
});

describe('translate — against the real shipped dictionaries (default lookup)', () => {
  it('reads the active language, with the single-arg call byte-identical to the old t()', () => {
    expect(translate('en', 'tab.home')).toBe('Today');
    expect(translate('gu', 'tab.home')).toBe('આજે');
  });

  it('falls back to the key for an unknown lookup', () => {
    expect(translate('hi', 'definitely.not.a.key')).toBe('definitely.not.a.key');
  });

  it('leaves a plain static key untouched even when params are passed', () => {
    // No static key contains {placeholders}, so params are inert on them — proves no regression.
    expect(translate('en', 'tasks.title', { count: 5 })).toBe('My Tasks');
  });
});
