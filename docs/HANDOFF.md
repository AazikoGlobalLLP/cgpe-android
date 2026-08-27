# HANDOFF — CGPE Connect (Android) — Phase 81 — 2026-08-27

## Done

Boot reported the truth — Phase 81 (Batch 6a) needs copy that has not arrived and Phase 82 (the APK)
is quota-blocked until 1 Sep — so this phase went after the one thing that was still findable
without the owner, a device or a merge: **more copy the owner had already paid for that no screen
was reading.**

- **Three keys supplied in all five languages had ZERO consumers, and four screens hand-wrote the
  English instead.** They are now wired: the offline-save toasts on Notes, New-task and Leads, and
  the Generate-report button on the client screen. Same defect family as Phase 79's zero-consumer
  `channel` field.
- **Phase 80's scan could not see them, for one reason: apostrophes.** The source types `it'll`; the
  supplied copy has `it’ll`. Byte-unequal, same sentence. This phase normalises case, trailing full
  stops and curly-vs-straight quotes before matching.
- **The client-screen button was half-translated inside a single ternary** — its idle state already
  called `t('report.generate')` while its loading state hand-wrote English on the same button.
- **The hunt is now CLOSED, not merely advanced.** The audit was re-run from the dictionary end —
  for each of the 226 keys, does any file read it? **18 have no consumer and not one is a free win.**
  There are no more free wins to find; the next run belongs after the next copy drop.
- **Both scans are committed as `scripts/i18n-freewins-scan.mjs`**, with their traps and their one
  real blind spot written at the top, so this is repeatable rather than a scratchpad one-off.

Gates: `tsc` **0** · `npm test` **1069** (unchanged — no logic added) · `eslint` **0 errors / 12
warnings** (baseline, verified cache-free with `npx eslint src`). Device-unverified. **No APK is
possible until 1 Sep 2026**, so none of Phases 77–81 is on a phone.

## Files changed

- `src/app/notes.tsx`, `src/app/task-new.tsx` — the offline-save toast now reads `sync.savedLocal`.
  **`notes.tsx` binds the translator as `tr`** (a local `t` is a `setState` accumulator there), and
  its `saveNote` `useCallback` gained `tr` in the dep array.
- `src/app/(tabs)/leads.tsx` — the named variant, `t('sync.savedLocalNamed', { name: lead.name })`;
  its `onAdded` `useCallback` gained `t`.
- `src/app/client/[id].tsx` — the Generate-report button's loading branch now reads
  `t('report.generating')`, closing the pair.
- `src/app/commissions.tsx`, `src/app/notifications.tsx` — two wired by key reuse
  (`tasks.viewMonth`, `stage.new`).
- `scripts/i18n-freewins-scan.mjs` *(new)* — the exact/near-miss scan plus `--orphans`, the audit
  from the dictionary end. Traps and the template-literal blind spot documented in the file.
- `docs/i18n/COPY-REQUEST-2026-08-26.md` — **Batch 6d** (13 peers that must not be wired alone) and
  **Batch 6e** (3 the owner has already paid for that the app still cannot use).
- `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md`.

Commits `c4ad3e5` · `9d3f6d2`, pushed to `aaziko/Shivam`.

## Decisions made

*(Full text in `docs/DECISIONS.md` under 2026-08-27 (later still). The four that will bite someone:)*

- **"Composed strings stay English" is TRUE ONLY where no `{placeholder}` key was supplied.** Phase
  80 excluded them on the reasoning that the keys do not exist — but `sync.savedLocalNamed` is
  `'{name} saved on this device — …'`, written for exactly that call site. **Grep for a `…Named`
  variant before excluding a composed string.**
- **A runtime-assembled key looks orphaned and is not.** `(tabs)/_layout.tsx:151` does
  `t('tab.' + route.name)`, so every `tab.*` key reads as unused. Two of the twenty "orphans" were
  this. Check for an assembled key before believing the audit.
- **Six candidate sites were deliberately NOT wired**, because their on-screen peers have no keys.
  Home's Portfolio-analytics row has four peer Eyebrows and only two have keys — wiring two would
  produce exactly the broken-looking strip Phase 80 warned about. They went to the owner as Batch 6d.
- **The Home follow-ups widget was left alone even though it looks like a win.** Its title, See-all
  and Try-again already translate, so its English empty state stands out — but its subtitle and its
  `'Open follow-ups'` button have no keys, and `home.noFollowups` words the message differently from
  the screen. Adopting different English is the owner's call, so it became a one-line question in
  Batch 6e rather than a change.

## Known broken / deliberately skipped

- 🔴 **Backend Phase 94 is still not deployed** — prod `origin/main` was `990c660` at boot and
  `fda199c` is not an ancestor. Video upload and the claim↔file link still fail on a phone.
- 🔴 **Storage is still off** (`cloudStorageConfigured:false`). **Do not name the MinIO bucket
  `uploads`.**
- 🔴 **No APK until 1 Sep 2026** — EAS free-plan quota. Nothing from Phases 77–81 is on a phone.
- ⚠️ **Several groups remain visibly half-translated** — the accepted cost of Phase 80's sweep.
  **Batch 6a (70 strings) is exactly the copy that closes them.** Batch 6d adds 13 more peers.
- ❌ **Bug #8 is still open and the owner has deferred it.** The tab bar staying visible excludes a
  root unmount; it does **not** prove native screen detach. **The discriminator is still unmade** —
  `bash scripts/diagnose-blank-screen.sh` runs it on the installed APK in about a minute and needs
  only a plugged-in phone. **Do not ship `detachInactiveScreens={false}` without it.**
- **No `contracts/` change was needed** — this phase is app-only and touches no wire shape, no
  endpoint and no field name. `INBOX.md` was not written to. **No sibling session needs notifying.**

## Next session starts here

- **Phase 82: wire Batch 6a the moment the copy arrives** (70 strings), then 6d (13), 5 (49,
  sign-in), 6b (41, outage), 6c (the menus), 6e (3, two of which need `{pct}`/`{n}` variants and one
  only a wording decision). **The APK is Phase 83, on or after 1 Sep 2026.** Both are owner-gated.
  **If neither has moved, say so plainly rather than inventing a phase** — Phase 81 closed the last
  self-contained thread, and the orphan audit proves it rather than assuming it.
- **First command: `/boot`**
- **Watch out for:** ⚠️ **do not re-run the free-wins hunt hoping for more — it is closed.** Run
  `node scripts/i18n-freewins-scan.mjs` (and `--orphans`) **after the next copy drop**, not before.
  ⚠️ **adding `t()` inside a `useMemo`/`useCallback` needs the translator in the dep array**; `tsc`
  and all 1069 tests stay green without it and only cache-free `npx eslint <file>` catches it — it
  bit twice more this phase, exactly as predicted. ⚠️ **do not "correct" either half of the
  `common.offlineBody` record** — the 39 empty-state sentences and the 7 write-failure notices are
  different string sets and both notes are right.
