# i18n coverage — scope & worklist (t() widening)

**Produced:** 2026-08-11 (scoping only — no code changed, no dictionary edited, no string translated).
**Why this exists:** PHASES.md "Next 3" #3 — only the **74** `t()`-wired keys change with the language
toggle; most of the app is hardcoded English and stays English in all 5 languages. This document scopes
the work to widen that, and the `inventory/` files are the exact string list, ready for a human to
supply copy into. **No machine translation** — PHASE-19 §4: a gap is a finding to report, never a guess
to fill.

How it was produced: six parallel read-only extraction passes over ~45 screens, each listing the
user-facing hardcoded strings (titles, headers, buttons, empty/error/toast/confirm copy, placeholders,
a11y labels) that are **not** already inside a `t('…')` call, with a proposed key per string following
the existing `domain.meaning` convention.

---

## 1. Coverage today — 6 of ~48 screens touch `t()` at all

| Screen | `t()` calls | Reality |
|---|---|---|
| `(tabs)/home.tsx` | ~32 | Partial — 1915 lines; ~155 strings still hardcoded (>80% of the app's most-seen screen) |
| `(tabs)/tasks.tsx` | ~14 | Partial — ~22 still hardcoded |
| `premium.tsx` | ~12 | Partial — ~44 still hardcoded (~65%) |
| `(tabs)/more.tsx` | ~4 | ~90 still hardcoded (~95%) |
| `settings.tsx` | ~2 | ~37 still hardcoded (~95%) — only the language picker + title are wired |
| `(tabs)/_layout.tsx` | ~1 | Tab-bar labels |
| **~40 other screens** | **0** | **100% hardcoded English** |

The 74 wired keys cover roughly the home dashboard spine, the tab bar, the tasks list, and the
premium/greetings screen. **Everything else** — login, every detail screen, every form, every list,
account, settings body, WhatsApp, analytics, claims, leads, clients — renders English in all 5 languages.

## 2. The numbers

- **~1,800 hardcoded string occurrences** across ~45 screens (per-file counts in each `inventory/` file).
- After collapsing the shared `common.*` layer (§4.1) and de-duplicating repeats, roughly
  **~1,200–1,400 unique keys** to add.
- The dictionary today is **74 keys × 5 languages**. Widening to ~1,270 keys means
  **~1,200 new keys × 4 non-English languages ≈ ~4,800 human translations** to supply
  (English is the source of truth — that column is already written, it's the extracted string itself).
- This is a **multi-week effort that is gated on a human translator**, not an editor task. This document
  exists so that work can be scoped, prioritised and started deliberately — not so it can be rushed.

## 3. Three prerequisites — do these before any copy is useful

### P0. `t()` has no interpolation. It must be extended first. — ✅ BUILT 2026-08-11 (`a7a0979`)
**Done.** `t` is now `t(key, params?)` in `src/i18n/index.tsx`: named `{placeholder}` fill (unmatched token
left verbatim) + count-aware `key_one`/`key_other` plurals selected by the CLDR rule for the active language
(English: only 1 is `one`; Hindi/Gujarati: 0 and 1 are `one`), falling back to the base key. Single-arg
`t(key)` is byte-identical to before; **no dictionary key was added** so the 74-key parity count is untouched.
Pinned in `__tests__/format.test.ts` (20 cases) via the pure exported seams `pluralCategory` / `interpolate`
/ `translate(…, lookup?)`. Gates green (`tsc` 0, `npm test` 350/350, `lint` 0 errors). Next copy-free step: P1.
Original problem statement, still accurate, below.

Today `t: (key: string) => string`. **~30% of the extracted strings are dynamic** template literals —
`{n} of {total}`, `{present}/{working} days`, `Moved to {stage}`, `Overdue by {n} days`, `Namaste {name}`.
These **cannot be wired** to the current `t()`. And they must **not** be wired by string concatenation:
Hindi and Gujarati word order differs from English (`"{n} leads"` → `"{n} leads"` in Hinglish but the
possessive/verb placement flips elsewhere), so `t('a') + count + t('b')` produces broken grammar.
- **Recommended:** extend to `t(key, params?)` with named `{placeholder}` substitution, plus a
  count-aware plural (`key_one` / `key_other`, selected by `params.count`). Small, self-contained,
  and testable in `src/i18n/`. This is the first unit of work ("Phase 21a") before any dynamic string
  can be translated.

### P1. A `common.*` shared layer — wire the repeats once.
~25 labels recur across many screens (`Try again` appears **~30 times**; `Call`, `WhatsApp`,
`Clear search`, `Refresh`, `Load more`, `Try again`, `Mobile`, `On duty`, `Today`/`Yesterday`, the
`Namaste {name}` prefill, the `Call {name}` / `Open WhatsApp chat with {name}` a11y labels). Wiring these
to `common.*` keys once — not per screen — is what takes ~1,800 occurrences down to ~1,200 unique keys.
The near-identical **outage body** (`"The server did not answer, so nothing here is confirmed. …"`)
appears in ~8 slight variants across screens; unify those during wiring. Proposed `common.*` set in §4.1.

### P2. The parity test is a hard gate — and it has a blind spot.
`src/i18n/__tests__/dictionaries.test.ts` enforces (verified against the real file):
- **`expect(EN_KEYS.length).toBe(74)`** — a hard count. Adding keys **fails this test** until the
  number is bumped to the new total. Update it deliberately, same as the "pinned known bug" convention.
- Every non-English dict must carry **every** key, **no blank / whitespace value**, and **no value equal
  to its own key**.
- ⚠️ **Blind spot:** the key-leak check rejects only `value === key`, **not** `value === English`. So a
  Gujarati entry left as the English string (`'Try again'` in the `gu` dict) **passes the test silently**
  — because trade vocabulary (`'WhatsApp'`, `'Pipeline'`) legitimately stays English and the test can't
  tell lazy-English from legitimate-English. **Consequence:** the test cannot certify that translation
  actually happened; the human-supplied copy is load-bearing and cannot be shortcut with an
  English-placeholder pass. Decide the staged-rollout policy up front (see §6).

## 4. Scope decisions to confirm

### 4.1 Proposed `common.*` keys (dedup layer)
Already in the dictionary: `common.signIn/signOut/cancel/send/call/whatsapp/seeAll/search/pipeline/delete/save`.
Add: `common.tryAgain`, `common.clearSearch`, `common.clear`, `common.saving`, `common.uploading`,
`common.refresh`, `common.loadMore`, `common.all`, `common.today`, `common.yesterday`, `common.done`,
`common.mobile`, `common.onDuty`, `common.signedIn`, `common.continue`, `common.goToSignIn`,
`common.showResults`, `common.whatsappGreeting` (`Namaste {name}`), `common.a11yCall` (`Call {name}`),
`common.a11yWhatsapp` (`Open WhatsApp chat with {name}`). In the inventory these strings already carry
`common.*` proposed keys wherever they recur.

### 4.2 What to include / exclude — confirm before wiring
- **a11y labels (INCLUDED):** screen-reader users hear them, so they are translatable UI. ~10% of rows,
  marked `(a11y)`. Confirm you want them in scope, or defer them to a later pass.
- **Outbound WhatsApp / share copy (FLAG — probably OUT):** `Namaste {name}` prefills and the client-report
  share text are what **the customer receives**, not app chrome. They should follow the *customer's*
  language (which the app doesn't know), not the advisor's UI language — so they likely belong with the
  `src/lib/messages.ts` templates, **not** the UI dictionary. Recommend excluding from this worklist and
  handling separately. They are marked `other`/`(WhatsApp prefill)` in the inventory.
- **Trade vocabulary stays English** inside the romanized strings (existing rule, `src/i18n/index.tsx`
  header): policy, premium, claim, lead, WhatsApp, KYC, renewal, maturity, target, commission, report.
- **Data-derived label maps are a SEPARATE surface, not counted here.** `STAGE_META`, `SEG_META`,
  `CLAIM_STATUS`, `PRIORITY_TONE`, task categories etc. live in `src/data/labels.ts` / `src/data/tasks.ts`,
  not in the screens — the extraction excluded them. They are another ~50–100 user-facing English strings
  that also need wiring for a screen to fully translate. Scope them as a small separate task.

## 5. Priority tiers — what to translate first

Translating all ~1,200 keys at once is neither necessary nor wise. Wire in exposure order; each tier is a
shippable increment (given P0/P1/P2 are done).

- **Tier 1 — every advisor, every session (the spine):** `login`, `(tabs)/home`, `(tabs)/tasks`,
  `(tabs)/more`, `settings`, `notifications`, `search`, `reminders`, and the tab lists `leads`, `clients`,
  `claims`, `whatsapp/index`. ~12 screens; the ones a daily user stares at.
- **Tier 2 — frequent detail & action screens:** `lead/[id]`, `client/[id]`, `claim/[id]`, `task/[id]`,
  `task-new`, `claim-new`, `whatsapp/[id]`, `calendar`, `attendance`, `notes`, `premium`, `campaigns`.
- **Tier 3 — role-specific / occasional:** `team/*`, `agent-map`, `agent-track`, `dashboards`, `analytics`,
  `commissions`, `payroll`, `tickets/*`, `notify`, `notice-board`, `kb`, `lic-plans`, `segments`,
  `families`, `prospects`, `contests`, `profile`, `account`, `job/[id]`.

## 6. How to supply copy

For each key in the `inventory/` files you (or a translator) supply **four** strings — Gujarati (`gu`),
Hindi (`hi`), Hinglish (`hi-en`, Hindi-in-Roman), Roman Gujarati (`gu-en`, Gujarati-in-Roman). The
English column is the extracted string itself. Follow the per-language voice documented in
`src/i18n/index.tsx` (Hinglish uses Hindi vocabulary in Roman; Roman Gujarati uses Gujarati vocabulary in
Roman; both keep trade nouns English).

Suggested working format once a tier is chosen: a CSV/sheet with columns
`key | kind | dynamic? | english | gu | hi | hi-en | gu-en`, generated from the chosen tier's inventory
rows. **Staged-rollout note (from P2):** because the parity test won't catch English-filled placeholders,
either (a) fill all four languages per key before the key is added to the dictionaries, or (b) if you must
land keys ahead of translation, add a *separate* test that flags non-`en` values equal to the `en` value
for the new key ranges, so untranslated leakage turns the suite red instead of shipping silently.

## 7. Line numbers are indicative
The `inventory/` files cite line numbers as extracted on 2026-08-11. Per the project's standing rule,
**anchor edits on surrounding text, not line numbers** — screens shift. Re-confirm each string at wiring
time (a `grep` for the English literal is the reliable handle).

## 8. Status
**P0 built (2026-08-11, `a7a0979`)** — the `t(key, params?)` interpolation + plural extension exists and is
tested; see §3 P0. **Still scoping-only for everything else:** no dictionary touched, no string translated,
no tier wired. The open decision is unchanged: **which tier (if any) to wire, and whether to do P1 (the
`common.*` dedup layer, also copy-free) next** before any human copy is supplied. See `inventory/` for the
full string list.
