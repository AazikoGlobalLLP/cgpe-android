/**
 * PHASE 19 — dictionary parity, the permanent gate.
 *
 * The whole i18n system is 5 dictionaries × 111 flat keys (`src/i18n/index.tsx`). The single most
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
    // Bumped 107 → 111 for the 4 `clock.reasonNeeded*` keys (Phase 50 edge-case notices, 2026-08-20) —
    // owner human copy in all 5 languages (supplied in-chat), not machine-translated.
    // Bumped 111 → 132 for the 21 D4 `tasks.view*`/`tasks.empty*`/`tasks.tomorrow`/`tasks.yesterday` +
    // D6b `guide.*` keys (2026-08-22) — owner human copy in all 5 languages (supplied in-chat), not
    // machine-translated.
    // Bumped 132 → 133 for `tab.search` (2026-08-26) — the new bottom-tab label. Shipped as the
    // English trade-vocab word 'Search' in ALL five (the same sanctioned fallback as 'WhatsApp'
    // etc.; it is also the natural word in Hinglish/Roman-Gujarati). Native gu/hi script copy is
    // owner-owed if desired — NOT machine-translated here.
    // Bumped 133 → 143 for the 10 Phase 77 `storage.*` keys (2026-08-26) — Settings › Storage and
    // the clear-cache flow. Owner human copy in all 5 languages, supplied in-chat, NOT machine-
    // translated. `Cancel` reuses the existing `common.cancel` rather than adding an 11th key.
    // Bumped 143 → 226 for the Phase 77 copy drop (2026-08-26): Batch 2 the shared-word layer (19),
    // Batch 3 the shared components (38), Batch 4 the status words (24), plus `storage.installNote`
    // and `home.clockedInAt`. Owner human copy in all 5 languages, supplied in one batch, NOT
    // machine-translated. Adding a key is inert until a screen calls it, so the copy is captured
    // here first and the ~170 hardcoded call sites are replaced in stages.
    // Bumped 226 → 284 for the Batch 6a drop (2026-08-27): the 70 strings that CLOSE the groups
    // Phase 80's sweep left half translated. Owner human copy in all 5 languages, NOT machine-
    // translated; the table is recorded verbatim in `docs/i18n/BATCH-6A-RECEIVED-2026-08-27.md`.
    // 70 supplied rows → 58 keys, because six rows resolved to copy already here
    // (`tab.search`, `common.whatsapp`, `common.all`, `report.generating`), one key is read by two
    // screens (`home.openTickets`), rows 13/14 and 47–53 share keys, and one supplied row —
    // `0 clients in process` — was extracted from a source COMMENT and has NO call site, so it
    // deliberately got no key rather than a zero-consumer one.
    // Bumped 361 → 430 for the Batch 6c drop (2026-08-29, Phase 84): the More menu (MORE_CATALOGUE
    // 16 titles + 21 subtitles + `more.openCount` + 5 group headings), the prospect stages (11,
    // Meeting/Lost reuse stage.*), the notice-board categories (10) and the notify priorities +
    // audiences (5). CLAUDE-TRANSLATED under the 2026-08-27 waiver (labelled at the code); each
    // table is wired as a WHOLE unit. Six More rows reuse existing exact-match keys and add none.
    // Bumped 430 → 444 for the 14 `voice.*` keys (2026-08-29): the voice-assistant sheet. PROVISIONAL
    // CLAUDE translations under the 2026-08-27 waiver (labelled in the code); owner to confirm the
    // gu/hi/hi-en/gu-en copy. `Cancel`/`Confirm`/`Try again` reuse the existing common.* keys.
    // Bumped 444 → 446 for `voice.female`/`voice.male` (2026-08-29): the voice-mode persona toggle.
    expect(EN_KEYS.length).toBe(446);
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
