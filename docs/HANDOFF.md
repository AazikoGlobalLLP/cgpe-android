# HANDOFF — CGPE Connect (Android) — Phase 84 — 2026-08-29

## Done

**i18n Batch 6c — the More menu and its three sibling label tables now read in all five
languages.** These are the module-scope "tables" (one list in the code supplies a whole menu or
every status chip on a screen) that were deferred for two sessions because wiring only their few
pre-existing keys would have produced a navigation menu half in one language. They are translated
as **whole units** now, under the owner's 2026-08-27 machine-translation waiver — **labelled
provisional at the code** (a native reader can change any line without a rebuild).

- **The More menu (`MORE_CATALOGUE`, 22 rows)** — every title and subtitle now carries an i18n
  KEY, resolved with `t()` where the Entry is built. Six titles **reuse existing exact-match keys**
  (`tab.clients` / `tab.claims` / `common.tickets` / `act.calendar` / `act.contests` /
  `settings.title`) so the menu label stays in step with the tab bar and quick actions instead of
  inventing a second word for the same noun.
- **The content-group section headings** ("The book", "Day to day", "Board", "Reference", "You")
  are **server data** (`DEFAULT_UI.nav.more_sections`), not hardcoded — so translating the rows
  alone would leave English headers over translated rows. A `MORE_SECTION_TITLE_KEYS` title→key map
  + `sectionTitle(raw, t)` translates them; an unrecognised (custom server) title falls through
  untranslated, and the "More" catch-all reuses `tab.more`.
- **The Tickets row's dynamic "N open" hint** is translated via `more.openCount` (`{count} open`).
- **Prospect pipeline stages (`prospects.tsx STAGE_META`, 13)** — keyed; Meeting/Lost reuse
  `stage.meeting` / `stage.lost`; `stageLabel(k, t)` now takes the translator.
- **Notice-board categories (`notice-board.tsx CATEGORY`, 5 chip labels + 5 headings)** —
  `catMeta(key, t)` resolves them, threaded to all five call sites.
- **Notify priorities + audiences** — Low/Normal/Urgent + Whole team/Choose people, built
  in-component via `useMemo([t])` like login's MODES. Normal/Urgent are deliberately NOT the task
  `priority.medium` / `priority.high` words.

**+69 dictionary keys × 5 languages (parity 361 → 430). Nothing here rewords any English.**
Gates: `tsc` **0** · `npm test` **1076** (unchanged — no new logic) · `npx eslint` cache-free
**0 errors** (2 warnings, both proven pre-existing) · `node scripts/i18n-freewins-scan.mjs
--orphans` **17, unchanged** — every one of the 69 new keys has a consumer. Device-unverified;
**no APK before 1 Sep 2026.**

## Files changed

- `src/i18n/index.tsx` — +69 keys × 5 (a labelled "Batch 6c" block at the end of each of the five
  dictionaries). `__tests__/dictionaries.test.ts` — parity count 361 → **430**.
- `src/app/(tabs)/more.tsx` — `MORE_CATALOGUE` now holds `titleKey`/`subKey`; added
  `MORE_SECTION_TITLE_KEYS` + `sectionTitle()`; the `moduleGroups` builder resolves keys with `t()`.
- `src/app/prospects.tsx` — `STAGE_META` holds `key` not `label`; `stageLabel(k, t)`; 4 call sites.
- `src/app/notice-board.tsx` — `CATEGORY` holds `labelKey`/`groupKey`; `catMeta(key, t)`; `t` added
  to `NoticeLine`, `NoticeSheet` and the `groups` useMemo deps.
- `src/app/notify.tsx` — `PRIORITY_OPTIONS`/`AUDIENCE_OPTIONS` hold `labelKey`; translated arrays
  built in-component; the "Urgent" preview Pill keyed.

Commit `62e9d8c`, pushed to `aaziko/Shivam`.

## Decisions made

*(Full text in `docs/DECISIONS.md` under 2026-08-29 (Phase 84).)*

- **The waiver, not a new grant.** Batch 6c is the continuation of the same 2026-08-27 waiver that
  produced Phases 82–83; the owner said "go" on a plan that named the waiver explicitly. The new
  keys sit in a labelled provisional block; a native reader is asked to review.
- **Reuse over duplication for exact-match nouns.** Six More titles reuse `tab.*`/`act.*`/`common.*`/
  `settings.title` rather than minting `more.*` duplicates — this is what keeps the owner's flagged
  "two Gujarati words for one noun" problem from spreading. `premium.title` was NOT reused (its
  English is "Premium & Greetings", the menu is "Premium and greetings" — reuse would reword English).
- **The group section titles had to be translated too, or the rows are half-translated.** They are
  server data, so a title→key map was the smallest correct fix; custom server titles fall through.
- **The fixed admin/Personal/About chrome stays English on purpose.** It is not part of 6c's ~70
  and is a separate non-catalogue construct (PHASE-26 D-2/D-3). Translating it would mean threading
  `t()` through role-gated conditional row logic — a different change, deferred and documented.

## Known broken / deliberately skipped

- **The More screen's fixed admin oversight group, the Personal group and the About section stay
  English.** They render below the (now-translated) content groups, so an admin/master sees a mixed
  screen and a team member sees an English "Personal"/"About" tail. Deliberate — out of 6c scope.
- **Batch 6b (41 outage sentences, 54 places) is NOT done** — the next real i18n chunk.
- 🔴 **Backend still not deployed / storage still off / `cgpe.in` still no AAAA record** — unchanged
  from Phase 83, not re-verified this session (no code touched them). **No APK until 1 Sep.**
- **Task creation still needs the filed backend change** to work on a phone (unchanged).

## Next session starts here

- **Phase 85: Batch 6b — the 41 outage sentences (54 places).** Each names *what* failed, so they
  are translated individually, never collapsed into `common.offlineBody` (CLAUDE.md #4). **OR** take
  the free win the exact-match scan surfaced first: **`home.tsx` has a parallel module-scope nav
  catalogue** (the widget quick-nav tiles ~L320-330, and `w.title ?? 'Prospects'` etc.) with labels
  IDENTICAL to `MORE_CATALOGUE` — "Families", "Commissions", "My attendance", "Prospects", "Notice
  board", "Knowledge base", "Campaigns" — all wire-able by **reusing the new `more.*` keys**. Do NOT
  wire the `api.ts` "New Lead"/"in progress" exact hits — those are backend data.
- **First command: `/boot`**
- **Watch out for:** ⚠️ **when translating a module-scope menu table, its GROUP/SECTION titles may
  be SERVER data** (`nav.more_sections`), not hardcoded — translate the rows without a title→key map
  and you ship translated rows under English headers. ⚠️ **`home.tsx` is the 2534-line danger-zone
  file** — peer-check before touching its catalogue. ⚠️ Re-run
  `node scripts/i18n-freewins-scan.mjs --orphans` **before** committing any copy drop (still 17).
