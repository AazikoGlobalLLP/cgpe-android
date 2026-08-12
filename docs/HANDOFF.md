# HANDOFF — CGPE Connect (Android) — Phase 22 (i18n P1) — paused on owner copy + INBOX sync — 2026-08-12

Short session. The board was editor-exhausted at boot (the copy-free `common.*` slice shipped earlier the same
day). One INBOX item was open and addressed here — verified it's a no-op for mobile and answered it. Then handed
the owner the bounded `common.*` fill-list; owner chose to **pause** i18n (no translator available now). No
`src/` changed, no gate re-run. Docs committed local-only (`3f2eb4a`, push still 403s).

## Done
- **Answered the one open INBOX item** (2026-08-12 · from `cgpe-api`): backend Phase 11 closed the
  `GET/PUT /api/rbac/app-ui` `data` envelope, dropping `_id` / `updated_at` / `updated_by`, and asked mobile to
  confirm it reads none of the three. **Verified inert on our side and replied.** The app reads none of them:
  `getAppUiConfig` (`src/data/api.ts:2516`) hands its response straight to `normalizeUiConfig`
  (`src/store/appUi.tsx:213`), which rebuilds a **fresh** object from only `role_key`/`label`/`dashboard`/
  `nav`/`features`/`theme`; the `AppUiConfig` type (`src/data/api.ts:2489`) declares no audit field; a tree-wide
  `updated_at`/`updated_by` grep hits only unrelated domains (notes, tasks, members, tickets). Reply written
  under the item in `../contracts/INBOX.md`, box left **unticked** (multi-recipient with `cgpe-admin`), and
  grepped back per the concurrent-write rule (survived).
- **Handed the owner the bounded `common.*` fill-list** (SCOPE §4.1 net-new set — `tryAgain` ×34, `clearSearch`,
  `refresh`, the outage body, the a11y labels) and asked how to proceed. Owner chose **pause i18n** — nothing
  app-side is buildable until human gu/hi/hi-en/gu-en copy lands (PHASE-19 §4 forbids machine translation).

## Files changed
- `docs/DECISIONS.md` — new top entry (2026-08-12, 2nd): the INBOX verification + the pause decision.
- `docs/PHASES.md` — new `## Now` note ("INBOX sync (no phase) — 2026-08-12 (2nd)"); Next-3 #3 tagged paused.
- `docs/STATUS.md` — refreshed for a manager: waiting on translation copy; app-UI change confirmed harmless.
- `docs/i18n/SCOPE.md` — §4.1 fix: removed `common.today` from the "still to add" set (it shipped 2026-08-12).
- `docs/HANDOFF.md` — this file.
- `../contracts/INBOX.md` — reply under the 2026-08-12 app-UI item (outside the ANDROID repo, untracked — not
  in the commit; lives only on disk, as all INBOX replies do).
- **Not** `.claude/settings.json` — it shows modified but is a pre-existing unrelated change from before this
  session; deliberately left out of the commit.

## Decisions made
- **The app-UI envelope removal is a confirmed no-op for mobile** — the response is rebuilt by
  `normalizeUiConfig` from documented keys only, so `_id`/`updated_at`/`updated_by` were never reachable by a
  screen. No code change, no gate re-run.
- **Paused i18n at the owner's direction** rather than push a partial wire — the copy-free `common.*` work is
  exhausted, and inventing translation copy is forbidden. Building against invented copy would ship text that
  reads badly to customers and passes the parity test silently (its leak check only rejects `value === key`,
  not `value === English`).

## Known broken / deliberately skipped
- **Phase 22 (i18n P1 bulk) — blocked on human copy.** The net-new `common.*` keys need gu/hi/hi-en/gu-en. The
  fill-list is `docs/i18n/SCOPE.md` §4.1; per-screen strings are in `docs/i18n/inventory/01–06*.md`. Anchor
  every wiring edit on the English literal (grep), never a line number.
- **Phase 16 (self-view salary) — still backend-blocked.** `routes/payroll.js:22-23` still `authorize('admin')`;
  `GET /api/payroll/my-earnings` still does not exist; the INBOX ask at the file foot (~line 3396–3474) is
  **still unanswered** by `cgpe-api`. Do not build the earnings screen against a non-existent endpoint.
- **Phase 6 (commissions) — still backend-blocked.** No product aggregate, no `target` source.
- **`git push` still 403s** — this commit (`3f2eb4a`) and all prior are local-only. Needs a human to fix the
  Windows-Credential-Manager credential (`reactjsaaziko` has no write access) or grant
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION` write.
- **Device-verification backlog** — unchanged; handset-only acceptance carried from Phases 1/4/5/6/7/9/10/12/13.

## Next session starts here
- Phase 22 (i18n P1 bulk): **if the owner has supplied `common.*` copy**, add the net-new keys to all 5 dicts
  (bump the `EN_KEYS.length` parity gate per key), wire `tryAgain` ×34 first, then the rest, and add the §6(b)
  leak-guard test so an English-left-in-`gu` value turns the suite red. **If no copy yet**, the board is
  editor-exhausted — re-check the INBOX foot for a `cgpe-api` `my-earnings` reply (unblocks Phase 16); otherwise
  there is nothing app-side to build.
- First command: `/boot`, then `grep -n "my-earnings\|from cgpe-api" ../contracts/INBOX.md | tail -20` to check
  whether the Phase-16 self-read reply has landed.
- Watch out for: adding real i18n keys bumps the hard `EN_KEYS.length === 75` parity gate (bump deliberately per
  key), and that gate **cannot** catch an English string left in a non-English dict — human copy is load-bearing.
