# PHASE 19 — Language toggle: verify + harden all 5 languages (incl. Hinglish / Gujlish)

Session `cgpe-mobile`. Requested 2026-08-11 (Hinglish, verbatim intent):

> "Ek row add kijiye jahan language toggle daalna hai — koi Gujlish / Hinglish mein bhi application
> ko kar sake. **Hinglish** = message English letters mein but Hindi pronunciation. Same for
> **Gujlish**. Yeh 2 ho jaaye uske baad salary aur jo baaki hai woh complete karte hain."

Status: **PLANNED — path laid, not built.** Note: the app **already ships** all five dictionaries
(`src/i18n/index.tsx`: English, हिन्दी, ગુજરાતી, **Hinglish**, **Roman Gujarati/Gujlish** — 5 × 74
flat keys, per `docs/PROJECT_MAP.md` §2.6). So this phase is **verify + harden the existing toggle**,
not build a new one. Its cheapest, most durable core (a dictionary-parity test) is **buildable at a
desk today**, no handset required.

---

## Definitions (locked, from the user)

- **Hinglish** = Hindi words / pronunciation written in the **Latin** alphabet.
  e.g. *"Aapke aaj ke tasks"*, not *"Your tasks today"* and not *"आपके आज के टास्क"*.
- **Gujlish / Roman Gujarati** = Gujarati words / pronunciation in the **Latin** alphabet.
- The two native-script dictionaries (हिन्दी Devanagari, ગુજરાતી Gujarati) are separate and already
  present — this phase verifies all **five**, not only the two romanised ones.

## The one-sentence goal

A user can switch the app into any of the 5 languages from the settings toggle, the choice persists
across a cold start, and **every screen renders fully in that language** — no raw i18n key leaking,
no English fallback where a translation should exist, no layout break — with Hinglish and Gujlish
reading naturally to a human.

## DONE WHEN (binary)

1. **Dictionary parity (editor-buildable now):** a Vitest asserts all 5 dictionaries expose the
   **exact same key set** (currently 74), with **no empty / missing / placeholder** values in any
   language. A key present in English but absent/blank in Hinglish is a failure the test names.
2. **No key leak at runtime:** on every screen, in every language, no on-screen string equals its own
   i18n key (the "untranslated key showed through" failure). Asserted via the Phase 18 harness.
3. **Toggle works + persists:** switching language in `settings.tsx` updates the UI live
   (`refreshI18nUser()` bus) and survives a cold start (per-user persistence). Asserted on web via
   the Phase 18 harness; the AsyncStorage-persistence-across-real-cold-start check is a handset item
   (carried, like the other storage-key checks).
4. **Hinglish + Gujlish read naturally:** a human (the user, or a reviewer) reviews the per-screen
   screenshots (produced by Phase 18 in each language) and confirms the romanised strings are Hindi/
   Gujarati pronunciation, not machine-transliterated English or leftover English.
5. **Layout holds:** no text clipping / overflow / overlap on the key screens when the longer scripts
   (Devanagari/Gujarati often taller, romanised often longer) replace English — checked at 390 px.
6. `npx tsc --noEmit`, `npm test` (now including the parity test), `npm run lint` stay green.

---

## 1. What exists today — verify before changing anything

- `src/i18n/index.tsx` — the whole system in one file: 5 dictionaries, 74 flat keys, per-user
  persistence, `refreshI18nUser()` bus. Language is a **per-user** setting, **not** part of the role
  document (`PROJECT_MAP.md` §2.6).
- The toggle UI: locate it (likely `settings.tsx`) and confirm all 5 options are offered and labelled
  in-language.
- **Do not invent a sixth language or rename the five.** Read the dictionary object keys first.

## 2. The core deliverable is a pure-logic test (do this first, it needs nothing)

A `src/i18n/__tests__/dictionaries.test.ts` (Vitest, same harness as the 305-test suite):
- Import the 5 dictionaries.
- Compute the union of all keys; assert each dictionary has **every** key (report the missing set per
  language).
- Assert **no** value is `''`, `undefined`, or identical to the key string.
- Optionally assert no value still contains an obvious English placeholder for a romanised dict (a
  soft heuristic, low confidence — human review in §DONE-4 is the real gate; do not fail the build on
  a heuristic).

This alone closes the most common i18n regression (a key added in English and forgotten in the other
four) and is a **permanent gate**, not a one-time pass. It is the honest "buildable now" half of this
phase.

## 3. The visual half rides Phase 18's harness

Once Phase 18's headed harness exists, parameterise its walkthrough over the 5 languages: for each
language, set it, walk the §4 screen inventory, screenshot each screen. Output a per-language folder
the user reviews for naturalness (DONE-4) and layout (DONE-5). No new harness — just a loop over the
language dimension.

## 4. Out of scope / do not do

- **Machine-translating or auto-transliterating** any missing string. If a key is missing in a
  dictionary, that is a **finding to report**, not a gap to fill with a guess — a wrong Hinglish
  string is worse than an obvious English fallback. Fixes to real gaps are a follow-on, scoped from
  the parity test's output, with human-supplied copy.
- Adding a new language.
- Changing where the toggle lives or its persistence mechanism.
- RTL — none of the five are RTL; no bidi work.

## 5. Sequencing

Runs **after** Phase 18 (it reuses the harness for the visual half) and **before** Phase 16 (salary)
/ Phase 6 (commissions), per the user's order. The parity test (§2) can technically land before the
Phase 18 harness exists — it depends on nothing — so if the web build in Phase 18 proves slow to
boot, ship §2 independently as the first green thing.
