# HANDOFF — CGPE Connect (Android) — Phase 77 — 2026-08-26

## Done

Three of the owner's four Phase-77 bugs are fixed. The fourth was **reopened**, because its recorded
cause turned out to be provably wrong and shipping the "fix" would have burned an APK on a no-op.

- **The splash no longer jumps or hides its text.** The logo used to grow ~50% the instant the JS
  splash took over — the plugin fits the 827×975 logo into an `imageWidth:190` **square**, so the
  native mark is 161×190 dp, while `ui/Splash.tsx` redrew it at ~242 dp and scaled it in from 0.9. It
  now renders at the native size, does not animate, and is centred on the **screen** rather than as
  part of a column, so it does not shift during the native view's 400 ms cross-fade. The tagline went
  from a measured **3.92:1** (below WCAG AA at 13 px) to **14.42:1**. In dark mode the whole thing was
  worse — the logo is dark-ink artwork on what became a near-black ground, after a hard white→black
  flash — so both splashes are now white in both schemes.
- **LIC plans no longer read as a wall of identical "Unnamed".** Affected rows now show their real LIC
  table number, e.g. **"LIC Plan 102"**. It is **11 rows, not the 8 reported** (also 5, 836, 904).
- **Settings › Storage › "Clear cached downloads" exists and actually frees space.** It clears the
  WebView map-tile cache, expo-image's disk cache, and — the part that matters for everyone — the
  picked-file copies the document/photo pickers have been leaving in the cache directory forever. It
  reports a partial clear as partial, and never claims a number of megabytes.
- **A LARGE i18n copy drop landed and is wired.** The owner supplied Batches 1–4 of
  `docs/i18n/COPY-REQUEST-2026-08-26.md` in one go — human copy in all five languages. The dictionary
  went **133 → 226 keys** and four things users could *see* being wrong are fixed:
  `tab.search` was the literal word "Search" in Gujarati and Hindi on a permanent bottom tab; the
  consent buttons were English in Hinglish on the mandatory first-run screen; **"Tomorrow" and
  "Yesterday" were both `कल`/`Kal`**, so a Tasks overdue header read identically to an upcoming one;
  and `tasks.emptyCalendarBody` still named the "strip" the calendar grid replaced. The 24 status
  words (lead stages, claim statuses, segments, task statuses, priorities) now translate everywhere
  they render, and every shared component — connection banner, Confirm, app lock, offline/sync,
  attach-document, filters, controls, map — reads its copy through `t()`.
- **The record was corrected where this session proved it wrong** — four triage rows in
  `docs/PLAN-2026-08-26-VOICE-N8N-AND-BUGS.md` said things that do not survive reading the code.

Gates: `tsc` **0** · `npm test` **1005** (was 993) · `eslint` **0 errors / 12 warnings** (the
documented baseline, unchanged). Everything below is **device-unverified**.

## Files changed

- `src/ui/Splash.tsx` — rewritten as a continuation of the native splash: native-size static logo,
  screen-centred, fixed white ground, tagline at the logo's own ink `#252357` 15 px/600, free to wrap.
- `src/data/adapt.ts` — `adaptLicPlan` recognises the backend's `'Unnamed plan'` **sentinel** (not a
  falsy name) and derives "LIC Plan <table>". Fixed in the adapter so every consumer benefits.
- `src/ui/motion.tsx` — `Appear`'s cleanup settles at 1 instead of freezing wherever it stood. Latent
  hardening; the comment states at length that this is **not** the fix for the blank screen, and why.
- `src/lib/appCache.ts` *(new)* — the pure outcome logic; returns an i18n **key**, never a sentence,
  and documents which of the three growth sources affects whom.
- `src/ui/CacheCleaner.tsx` *(new)* — the native clearing. Mounts a throwaway 1×1 WebView only while
  clearing, because `clearCache` exists **only** as an instance method (the cache is per-application,
  so any instance clears everything), then deletes `<cache>/DocumentPicker` and `<cache>/ImagePicker`.
- `src/app/settings.tsx` — the Storage section, confirm and toasts, all through `t()`.
- `src/i18n/index.tsx` + `src/i18n/__tests__/dictionaries.test.ts` — **83 new keys × 5 languages**,
  parity assertion **133 → 226**, plus the Batch 1 corrections to already-shipping values. `TKey` is
  now exported so the label maps type against the real key set. `Cancel` reuses `common.cancel`.
- `src/data/labels.ts` + `src/data/tasks.ts` — `label` **renamed** to `labelKey`. The rename is the
  point: swapping the value in place would have type-checked silently and shipped raw keys as visible
  text, whereas the rename turned all 31 call sites into compile errors.
- 12 `src/ui/*` and screen files gained a translator hook; 5 hooks gained `t` in their dep arrays.
- `src/lib/__tests__/appCache.test.ts` *(new)*, `src/data/__tests__/adapt.test.ts` — +12 tests net.
- `package.json` + `package-lock.json` — `expo-file-system` promoted to a **declared** dependency; the
  lock had to be synced in the same commit or EAS's `npm ci` fails "not in sync".
- `docs/PHASES.md`, `docs/PLAN-2026-08-26-VOICE-N8N-AND-BUGS.md`, `docs/DECISIONS.md`, `CLAUDE.md`.

## Decisions made

- **Disproving a diagnosis beats shipping a fix for it.** A 12-agent adversarial review ran over all
  four root causes before any was trusted. It caught the LIC fallback being **dead code** and refuted
  the `Appear` fix outright. Two of its own findings were then rejected after checking — one proposed
  patch `require()`d an asset that does not exist, and its "Android's circular splash mask is clipping
  the logo" theory died when the ink's enclosing circle measured 193 dp against 192 dp guidance.
- **Fix data mappings in the adapter, not the screen** — one edit, every consumer.
- **`app.json` was deliberately left alone.** `imageWidth: 190` already puts the ink at the edge of
  Android's splash-icon guidance; changing it needs an ADB measurement, not arithmetic off a number
  that lives in a Gradle AAR nobody here can read.
- **No megabyte figure, in any language.** None of the three clearing calls reports bytes, so the copy
  points at Settings › Apps › CGPE Connect › Storage instead of inventing one.
- **Two supplied strings were not wired, and that was stated rather than done silently:**
  `nothing_to_clear_*` has no state to attach to (an absent picker directory counts as success), and
  the Storage footer now uses the owner's shorter description, which drops the "install size is not
  affected" sentence. That caveat is listed back to the owner rather than machine-translated in.

## Known broken / deliberately skipped

- 🔴 **The APK is blocked on BILLING, not code.** The batched build was attempted and refused: the EAS
  free plan's **monthly Android quota is exhausted, resetting 1 Sep 2026**, and no build was created.
  The newest APK is still `093a3b33` (2026-08-25), which carries **none** of this — nor the Search tab.
  There is no OTA. Owner's call: wait, or `eas billing:subscribe starter --account shivam-bhadoriya`.
  It only reports the refusal *after* uploading a ~317 MB archive, so do not retry casually.
- ❌ **More→Today blank screen (#8) is UNDIAGNOSED.** The prime suspect is ruled out (see below). Two
  zero-build device tests decide it in a minute and **run on the APK already installed** — see
  `docs/PHASES.md` § "Phase 77 leftovers".
- **Owner owes the 11 real LIC plan names** for `cgpe-backend-main/data/lic_plans_library.json`.
  "LIC Plan 102" is honest, but it is not a name.
- **Batch 2's call sites are NOT swept.** Its 19 keys are translated and in the dictionary, but ~170
  hardcoded English strings across 37 screen files still ignore them. Needs no owner input — see
  "The i18n state, precisely" below.
- **Batches 5–9 copy is not supplied, and cannot be asked for yet** — the copy-request doc lists only
  counts for those, not the exact English strings. Extract the sign-in literals verbatim first.
- **Everything here is device-unverified** — the `Directory.delete()` path, the splash timing against
  the real native cross-fade, and the throwaway-WebView `clearCache` all need a phone.
- **The `[admin]` items are untouched** — a different repo (`cgpe-front-main-RECOVERED`).

## The i18n state, precisely

**Done and on the branch:** Batches 1, 3 and 4 — corrected, wired, gate-green.
**Half-done:** Batch 2. Its 19 shared words exist in all five languages, but their **~170 hardcoded
English call sites across 37 screen files** are untouched. `Try again` alone is **55 copies in 37
files**, and the "server did not answer" sentence is **60 occurrences in 39 near-identical wordings**
that all collapse into one key. **This needs no further copy from the owner** — it is a mechanical
sweep, and it is the single biggest visible-English win left.
**Not started:** Batch 5 onward. The copy-request doc lists only counts and screen groups for those,
not the exact English source strings, so the sign-in literals must be extracted verbatim into the doc
BEFORE asking the owner for four more languages — otherwise they would be translating strings nobody
has quoted.

**Two traps recorded for whoever does the sweep.** The parity test proves a key *exists* in all five
languages; it CANNOT see a value left as the English string — that blind spot is exactly how Batch 1's
four gaps survived. And any hook that builds a translated string needs `t` in its dependency array or
it keeps the OLD language's text after a language switch; five hooks needed that this session, and
only cache-free `eslint` catches it (`tsc` and `npm test` are green either way).

## Next session starts here

- **Phase 77 leftover then Phase 78.** First close #8 with the two zero-build ADB tests (they need no
  build); then Phase 78 — Voice v1 on the n8n route — which is blocked on the owner for the webhook
  URL, the ElevenLabs key + two voice IDs, and the avatar asset decision.
- First command: `/boot`
- **Watch out for: do not re-file `Appear`/`cancelAnimation` as the cause of the blank screen.** It is
  written into `src/ui/motion.tsx`, `docs/PHASES.md` and the plan doc that it is ruled out, with the
  evidence: `Appear`'s effect deps are constants at every Home call site so its cleanup runs only at
  unmount; react-freeze is off; there is no `unmountOnBlur`; and reanimated bakes a settled
  `opacity: 1` into React's committed props within ~1 s. Second trap: **check the EAS build quota
  before promising anyone an APK.**
