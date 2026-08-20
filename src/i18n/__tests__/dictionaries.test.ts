/**
 * PHASE 19 — dictionary parity, the permanent gate.
 *
 * The whole i18n system is 5 dictionaries × 107 flat keys (`src/i18n/index.tsx`). The single most
 * common i18n regression is a key added to English and forgotten in one of the other four, which
 * ships as an English string leaking into a Gujarati screen. TypeScript already stops the crudest
 * form of this — `Dict = Record<TKey, string>` makes a MISSING or MISSPELLED key a compile error —
 * but the type system cannot see three failures a human still can:
 *
 *   1. an EMPTY or whitespace-only value (`''` is a valid `string`), which renders as blank UI;
 *   2. a value left IDENTICAL to its own key (`'tab.home'` instead of a translation), the classic
 *      "the raw i18n key showed through" bug DONE-2 names;
 *   3. — and, because a future refactor could widen `Dict` or add a sixth language — that the set
 *      of languages and the key set itself stay exactly what the app ships.
 *
 * So this is belt-and-braces for key parity (tsc owns that) and the ONLY gate for value quality.
 * It is pure data: it imports the dictionaries and asserts, no rendering, no network, no device.
 *
 * WHAT THIS TEST DELIBERATELY DOES NOT DO: judge whether Hinglish/Gujlish read NATURALLY. That is
 * a human's call on the per-language screenshots (PHASE-19 DONE-4), and the spec is explicit that a
 * heuristic must never fail the build — a wrong romanised string is worse than an honest English
 * fallback, so a guess dressed as a green test would be the exact harm this phase exists to avoid.
 */
import { describe, expect, it } from 'vitest';
import { DICT, LANGS } from '@/i18n';
import type { Lang } from '@/i18n';

const CODES = LANGS.map((l) => l.code);

/** English is the source of truth; every other dictionary is measured against its key set. */
const EN_KEYS = Object.keys(DICT.en);

/** Values that are legitimately the same across languages stay in English trade vocabulary
 *  ('WhatsApp', 'Pipeline', 'Calendar', …). None of those equal a KEY string, so the
 *  key-identity check below never trips on them — the assertion is safe as written. */
const isBlank = (v: string) => v == null || v.trim() === '';

describe('i18n dictionaries — parity and value quality', () => {
  it('exposes exactly the five shipped languages, no more, no fewer', () => {
    expect(CODES).toEqual(['en', 'gu', 'hi', 'hi-en', 'gu-en']);
    expect(Object.keys(DICT).sort()).toEqual([...CODES].sort());
  });

  it('English carries the full 94-key set (guards against a silent key deletion)', () => {
    // A hard count so removing a key without updating this file is caught, not absorbed.
    // Bumped 74 → 75 for `common.today` (Phase 21 P1, 2026-08-12) — a dedup key lifted from
    // the existing `tab.home`/`tasks.today` human copy, not a new translation.
    // Bumped 75 → 94 for the 19 `consent.*` keys (Phase 41a-ii, 2026-08-14) — human copy supplied
    // in all 5 languages (translation-v.01; docs/i18n/PHASE-41-CONSENT-COPY.md), not machine-translated.
    // Bumped 94 → 103 for the 9 `break.*` keys (Phase 52, 2026-08-18) — owner human copy in all 5
    // languages (docs/i18n/PHASE-52-break-copy-REQUEST.md), not machine-translated.
    // Bumped 103 → 107 for the 4 `clock.reason*` keys (Phase 50 H1 localization, 2026-08-20) — owner
    // human copy in all 5 languages (supplied in-chat), not machine-translated.
    expect(EN_KEYS.length).toBe(107);
    // No duplicate keys collapsed by the object literal.
    expect(new Set(EN_KEYS).size).toBe(EN_KEYS.length);
  });

  // One describe per language so a failure NAMES the language in the test title, per DONE-1.
  for (const code of CODES) {
    describe(`${code}`, () => {
      const dict = DICT[code as Lang] as Record<string, string>;
      const keys = Object.keys(dict);

      it('has every English key and no extra keys', () => {
        const missing = EN_KEYS.filter((k) => !(k in dict));
        const extra = keys.filter((k) => !EN_KEYS.includes(k));
        expect({ code, missing, extra }).toEqual({ code, missing: [], extra: [] });
      });

      it('has no empty or whitespace-only value', () => {
        const blank = EN_KEYS.filter((k) => isBlank(dict[k]));
        expect({ code, blank }).toEqual({ code, blank: [] });
      });

      it('has no value left identical to its own key (raw key leak)', () => {
        const leaked = EN_KEYS.filter((k) => dict[k] === k);
        expect({ code, leaked }).toEqual({ code, leaked: [] });
      });
    });
  }

  it('every key is translated in every language (union has no holes)', () => {
    // The cross-cut of the per-language checks above, stated once as the DONE-1 headline:
    // the union of all keys equals English, and every dictionary covers the union.
    const union = new Set<string>();
    for (const code of CODES) Object.keys(DICT[code as Lang]).forEach((k) => union.add(k));
    expect([...union].sort()).toEqual([...EN_KEYS].sort());
    for (const code of CODES) {
      const holes = [...union].filter((k) => isBlank((DICT[code as Lang] as Record<string, string>)[k]));
      expect({ code, holes }).toEqual({ code, holes: [] });
    }
  });
});
