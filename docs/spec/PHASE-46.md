# Phase 46 — Tasteful time-of-day emoji in the Home greeting

**Status:** BUILT 2026-08-15 (commit `153ecc6`, local — push 403s). `[m]` only, one file.
**Owner backlog:** Phase 46 (Group G — polish). "Add tasteful emojis to the greeting copy."

## 1. Goal
Add a small, tasteful emoji to the greeting shown in the Home header — without breaking the
five-language i18n, and without inventing copy.

## 2. What the greeting is
The Home header (`src/app/(tabs)/home.tsx`) shows a greeting derived from the hour:
```
const greet = hour < 12 ? t('greet.morning') : hour < 17 ? t('greet.afternoon') : t('greet.evening');
```
`greet.morning`/`afternoon`/`evening` are i18n keys with human copy in all five dictionaries
(en / ગુજરાતી / हिन्दी / Hinglish / Roman Gujarati), `src/i18n/index.tsx:67,118,163,213,263`.
There is also a separate English-only `greeting()` in `src/lib/format.ts:148` — NOT used by the
Home header, so it was left untouched (changing it would only ever affect English callers).

## 3. The i18n trap (the whole reason this needs a spec)
Two obvious-but-wrong approaches, both forbidden by the standing i18n rules:
- **Append the emoji to the English `greet.morning` string.** Leaves the other four languages
  without it — the parity test passes (it only rejects `value === key`), so the miss is silent.
- **String-concatenate the emoji onto the translated word** (`t('greet.morning') + ' 🌅'`). Risks
  Hindi/Gujarati word order; the codebase rule is *never string-concatenate translated copy*
  (CLAUDE.md i18n note; use `t(key, params)` for dynamic strings).

## 4. Decision — render the emoji as its own element
- Derive a time-of-day glyph off the **same existing hour cutoffs** the greeting already uses
  (no new copy, no invented numbers): `🌅` (`hour < 12`) / `☀️` (`< 17`) / `🌆` (else).
- Render it as a **standalone `<Txt>` element** in the header row, immediately after `{greet},`.
  Because it is a separate element (not part of any translated string), the one glyph serves all
  five languages and no word order is touched.
- **Accessibility:** the emoji is decorative — it carries no meaning the greeting text doesn't
  already convey — so it is hidden from assistive tech. The `Txt` primitive does NOT forward a11y
  props, so the hint goes on a wrapping `View`:
  `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`.
  (`tsc` caught the first attempt that put `accessibilityElementsHidden` directly on `Txt`.)

## 5. Files changed
- `src/app/(tabs)/home.tsx` — added `const greetEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌆';`
  beside `greet`; rendered `<View aria-hidden><Txt size={font.sub}>{greetEmoji}</Txt></View>`
  after the `{greet},` Txt in the top-bar row.

## 6. Gates
- `tsc --noEmit`: 0 errors.
- `npm test`: **487/487** (unchanged — presentational; no new pure logic to pin).
- `eslint src/app/(tabs)/home.tsx`: clean (0 errors / 0 warnings for the touched file).
- No contract change → no INBOX/CHANGELOG entry, no sibling session to notify.

## 7. Done means (carried)
- **Device visual check (native-only):** on a real handset, the emoji renders and vertically
  aligns with the greeting text; light/dark at 390px; morning/afternoon/evening all show the right
  glyph. Web/tests don't exercise native emoji rendering.
