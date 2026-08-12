# HANDOFF — CGPE Connect (Android) — INBOX sync (no phase) — 2026-08-12

Boot found the board editor-exhausted (Phase 23 MDRT tier BUILT; commissions earned-aggregate
backend-blocked; i18n P1 paused on owner copy). One fresh open item CC'd this session — cgpe-admin's
RECRUITER_MASTER discovery question (their Phase 45) — was answered. **No `src/` change; no gate re-run.**

## Done
- **Answered the RECRUITER_MASTER CC and corrected a factual error in it.** cgpe-admin filed a discovery
  question to `cgpe-api` (blocking their Phase 45), CC'ing `cgpe-mobile` on the premise that we "already
  render RECRUITER_MASTER and may know the endpoint." Verified against our real code that the premise is
  **wrong** and replied so the sibling stops treating mobile as a ground-truth source: `masterListType` /
  `RECRUITER_MASTER` appear in **zero** files under `ANDROID/src` (fresh case-insensitive grep); our
  prospects screen calls `GET /api/prospects` + `GET /api/prospects/segments` and **no `/api/ca-data/*`
  route**; it renders schema-agnostically via `pick(doc, candidateKeys)`, which only *looks* like it
  handles those rows. The endpoint/param/envelope answer is `cgpe-api`'s to give. Not blocking mobile.

## Files changed
- `../contracts/INBOX.md` — reply appended under the `→ cgpe-api · 2026-08-12 · from cgpe-admin`
  RECRUITER_MASTER box (anchored on the item's unique closing text, not a line number). Box left
  **unticked** — item is addressed to `cgpe-api`; mobile only CC'd. Grepped back durable (lines 50–52).
- No `src/` change. No `docs/spec/` file (no phase). Board + DECISIONS updated (this session's record).

## Decisions made
- **Corrected the premise instead of just deflecting.** The item asserted RECRUITER_MASTER "shows up only
  in cgpe-mobile's prospects.tsx." A fresh grep proved that false, so the reply says so explicitly —
  redirecting the discovery to the backend where the ground truth actually lives, rather than letting
  cgpe-api chase mobile for an endpoint mobile doesn't call.
- **Box left unticked.** Standing rule: tick only when the item is addressed to this session alone. This
  one is `→ cgpe-api` with mobile CC'd, so reply underneath and leave the box open.
- **No gate re-run, nothing committed.** INBOX-only reply, no source touched — `tsc`/`npm test`/lint stay
  at the Phase-23 baseline (373 green). `contracts/` is not under version control by anyone and `git push`
  still 403s regardless, so the reply lives only on that disk (hence the grep-back).

## Known broken / deliberately skipped
- **Commissions earned aggregate — still backend-blocked.** Waiting on `cgpe-api` to scope
  `GET /api/commissions/my-summary` (self-scoped earned aggregate + optional `tier` block; filed
  2026-08-12, `contracts/INBOX.md` ~line 67, unanswered). Phase 23 shows the MDRT tier element but NOT the
  earned figures (thisMonth/lastMonth/pending/ytd/history/recent).
- **i18n P1 (Phase 22 bulk) — paused on human copy.** Net-new `common.*` keys (`tryAgain` ×34, etc.) need
  gu/hi/hi-en/gu-en; machine translation forbidden (PHASE-19 §4).
- **Device-check backlog — CARRIED** (Phases 1/4/5/6/7/9/10/12/13/16/23). Phase-23 tier card on a real
  advisor with sales (light/dark, 390 px); Phase-16 earnings reconcile ≥3 people; Phase-1 clock-in is the
  stated hard prerequisite. Not editor-buildable.
- **`git push` still 403s** — `reactjsaaziko` lacks write on `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. All
  commits local. Needs a human to grant access or swap the credential.

## Next session starts here
- Phase <next>: board is editor-exhausted for net-new build. Levers unchanged: **(a)** `cgpe-api` scopes
  `/commissions/my-summary` → unblocks the Phase-6 **earned** figures (watch the INBOX reply); **(b)**
  owner-supplied i18n copy → unpauses Phase 22; **(c)** a handset → the carried device checks. Also watch
  for `cgpe-api`'s answer to the RECRUITER_MASTER thread — if they scope a `masterListType` filter on a
  prospects-adjacent route, check whether mobile's schema-agnostic `prospects.tsx` should surface it.
- First command: `/boot`
- Watch out for: `../contracts/INBOX.md` shifts **mid-session** under concurrent writes and a sibling write
  can DELETE a reply — anchor every edit on surrounding text, never a line number, and **grep your reply
  back** after writing (done this session — reply confirmed durable at lines 50–52).
