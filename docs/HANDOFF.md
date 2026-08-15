# HANDOFF — CGPE Connect (Android) — Phase 41d app-block SCREEN — 2026-08-15

This session wired the **last editor-buildable piece of Phase 41**: the 41d anti-circumvention
app-block screen. Its blocker (owner 5-language copy) had already been resolved — the copy landed in
`translation-v.01.txt` and was in the i18n dictionary — so the "still blocked" note in the previous
handoff was **stale**. With both gates satisfied (copy + locked trigger), the screen is now built.
**All four 41d parts, and all of Phase 41, are now editor-complete. Nothing more is editor-buildable
in Phase 41 — what's left is a native build + on-device verification.**

## Done (observable behavior)
- **A consented 24/7 user who turns device Location OFF is blocked** behind a full-screen "Turn
  location back on to use CGPE Connect" notice, in their own language, with an **Open settings**
  button that lands on the right page. It clears the moment they return with location back on, and the
  Android back button cannot escape it.
- **Permission-revoke still behaves as before** (spec-literal, owner-chosen): it routes through the
  shipped withdrawal signal (every master notified + recorder stopped) and the `/consent` wall on next
  open — the block screen settles on the device-Location-OFF case.

## Files changed
- `src/ui/LocationBlock.tsx` (new) — the full-screen block overlay, modeled on `AppLock`; owner copy,
  Open-settings CTA, re-checks on foreground, swallows Android back, `zIndex 55` (below AppLock), native
  + signed-in only.
- `src/lib/tracker.ts` — `evaluateLocationBlock()` (native reads → the pure tested `locationBlockReason`,
  fail-open to `null`) + `openLocationSettings(reason)` (services-off → device Location page; permission →
  `Linking.openSettings()`); imports `locationBlockReason`/`BlockReason` + `Linking`.
- `src/app/_layout.tsx` — mounts `<LocationBlock/>` before `<AppLock/>`.
- `docs/spec/PHASE-41.md`, `docs/PHASES.md`, `docs/DECISIONS.md` — 41d marked fully editor-complete.

## Decisions made
- **Built against the WIRED `consent.blocked*` keys, not the spec §8 draft's `block.*` proposal.** The
  owner supplied a simpler single-body version (title/body/action, no services-vs-permission split, no
  "I've turned it on" button — recheck is automatic on foreground). The wired copy is the human-approved
  reality; the proposal was superseded.
- **Composition with the withdrawal signal = spec-literal (owner-chosen, AskUserQuestion 2026-08-15).**
  Permission-revoke keeps routing through withdrawal (master alert + disarm) + `/consent` on next open;
  the block gates on `locationBlockReason` (armed), which disarm clears — so the block lands durably on
  device-Location-OFF. Chosen over a durable-marker gate (blocks permission-off immediately too, but more
  state + double-fire) and over re-firing `/consent` on foreground (touches ConsentGate's once-per-session
  invariant). See DECISIONS 2026-08-15.
- **No new tests, no i18n-key change.** `tracker.ts`/UI are device-only (no stub, like the rest of the
  module); the pure brain is already pinned in `antiCircumvention.test.ts`; the keys already existed, so the
  parity count is untouched.

## Known broken / deliberately skipped
- **ALL of Phase 41 is DEVICE-UNVERIFIED** — needs a native EAS/dev-client APK (two modules from 41b/41c:
  `expo-background-task` + `expo-sensors` + `RECEIVE_BOOT_COMPLETED` → **NOT OTA**), then the §12.7 matrix +
  §3 battery over a real day on 3+ handsets, plus the app-block overlay device check.
- **Accepted gap (owner signed off):** a mid-session permission-revoke shows no block until the next app
  open (the withdrawal path handles it meanwhile).
- **Two `[api]`s still need the owner to relay to cgpe-api:** the §5 silent-user gap-detector, and Phase 50.
- **`git push` still 403s** — this session's commits are local-only (`dd6a4c3` code, `2ea183c` docs). Needs a
  human credential swap. Blocks Phase 49.

## Next session starts here
- Phase 41: **device-verify the whole thing** — cut a native APK, walk the §12.7 matrix (+ app-block
  overlay check), measure battery. No editor code left; do NOT cut the "final" APK (Phase 49) while checks
  are unverified or the push is broken.
- First command: `/boot`
- Watch out for: **a boot "blocker" can be stale** — this session's blocker (app-block copy) was already
  resolved; verify blockers against the real files (`src/i18n`, `translation-v.01.txt`) before trusting the
  handoff/memory. And **Phase 41 added TWO native modules — a native build is mandatory; OTA cannot carry it.**
