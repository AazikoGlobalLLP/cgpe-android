# HANDOFF — CGPE Connect (Android) — Phase 6 commissions re-eval + INBOX sync (no build) — 2026-08-12

Board is editor-exhausted for net-new build (Phase 16 BUILT/device-check-only, Phase 22 paused on human copy).
This session found ONE fresh open `cgpe-mobile` INBOX item (backend Phase 29), verified it, and — at the owner's
direction — **filed a self-scoped commissions-aggregate shape to `cgpe-api`**. **No `src/` change**, so no ANDROID
code commit and no gate re-run. Only `docs/` + `contracts/INBOX.md` were touched.

## Done
- **Verified backend Phase 29 in `cgpe-api`'s real code** (not the notice): `utils/mdrtTiers.js`
  `classifyMdrtTier()` → `{current,next,next_premium,to_next}`, six thresholds ₹3.75L…₹90L confirmed;
  `GET /api/advisor/performance/:advisorId` (`advisor.js:23`, `protect`-only) is **self-safe** — an `advisor`
  reading any id but their own gets 403 (`:28`), a `leader` is team-scoped — and returns `performance.total_premium`
  + `performance.mdrt_tier`.
- **Established Phase 29 does NOT unblock `commissions.tsx`**, for two reasons recorded to `cgpe-api`:
  1. The screen's real blocker is the **earned aggregate** — `{ thisMonth, lastMonth, pending, ytd, history[],
     recent[] }` per the `Commission` type. `getCommission()` reads `/api/commissions`, which returns owner-scoped
     **raw rows**, so `isObj` misses and the screen resolves the empty shell — it has never shown real data (Phase-6
     D-5). Phase 29 ships **no** commissions aggregate.
  2. `next_premium` is an **annual cumulative-FYC-premium** tier goal (≥ ₹3.75L); the screen's meter is
     `thisMonth / target` labelled **"Monthly target"** (`commissions.tsx:209`) — a different unit. Feeding
     `next_premium` in would read ~0% forever and mislabel a career goal as a monthly quota. Deliberately not done.
- **Filed a concrete shape** (owner-directed) as a fresh top-of-queue `→ cgpe-api · 2026-08-12 · from cgpe-mobile`
  item: `GET /api/commissions/my-summary`, `protect`-only, token-forced self-scope (same posture as the
  `/payroll/my-earnings` that unblocked Phase 16). Body = the earned aggregate the `Commission` type needs, **plus
  an OPTIONAL `tier` block** (`total_premium/next/next_premium/to_next` from `classifyMdrtTier`) that mobile would
  render as a **separate** MDRT-tier-progress element — never the monthly meter. Flagged the earned aggregate as the
  blocker and `tier` as a nice-to-have.

## Files changed
- `../contracts/INBOX.md` — (1) the new `→ cgpe-api` filing at the queue top; (2) a reply under the Phase-29 box,
  left **unticked** (multi-recipient — `cgpe-admin` also addressed). Both grepped back after writing (durable:
  filing at line 36, reply at line 76). Disk-only/untracked — not committed.
- `docs/HANDOFF.md`, `docs/DECISIONS.md`, `docs/PHASES.md` — this session's record.

## Decisions made
- **No `src/` change.** Phase 29 was verified inert-as-an-unblock, not propagated. The commissions screen stays
  backend-blocked; the target source narrows Phase-6 D-5 but does not close it.
- **Chose "file the aggregate" over building a tier-progress view now** (owner decision). A standalone tier view
  against `/api/advisor/performance/:advisorId` is buildable and remains available, but it's a new/narrow surface
  that would leave the commissions earned figures blank — so it was not built this session.
- **Did not fold `next_premium` into the monthly-target meter** — unit mismatch (annual premium vs monthly
  commission). If a tier element is later built, it must be labelled as a premium/tier goal, separate from the
  monthly meter.

## Known broken / deliberately skipped
- **Phase 6 commissions — still backend-blocked.** Waiting on `cgpe-api` to scope `GET /api/commissions/my-summary`
  (or at minimum the earned aggregate). `next_premium`/`to_next` now exist as a *target/tier* source but supply
  neither the earned figures nor a monthly target.
- **Phase 16 device check — CARRIED** (highest-trust-cost). Reconcile ≥3 real people's months against the payroll
  sheet by hand on a phone; light/dark at 390 px. **Phase 1 clock-in is the stated hard prerequisite.** Not
  editor-buildable.
- **Phase 22 (i18n P1 bulk) — paused on human copy.** Net-new `common.*` keys (`tryAgain` ×34, etc.) need
  gu/hi/hi-en/gu-en; machine translation forbidden (PHASE-19 §4).
- **`git push` still 403s** — `reactjsaaziko` lacks write access; all prior commits local-only. Needs a human.

## Next session starts here
- Phase <next>: board is editor-exhausted for net-new build. Concrete levers: **(a)** `cgpe-api` scopes
  `/commissions/my-summary` → unblocks the Phase-6 commissions screen (watch the INBOX reply); **(b)** owner-supplied
  i18n copy → unpauses Phase 22; **(c)** a handset → the Phase-16 device check + the carried device backlog; or
  **(d)** build a standalone MDRT-tier-progress element against `/api/advisor/performance/:advisorId` if the owner
  wants a shippable slice before the aggregate lands. No net-new editor build is otherwise unblocked.
- First command: `/boot`
- Watch out for: `../contracts/INBOX.md` shifts **mid-session** under concurrent writes — anchor every edit on
  surrounding text, never a line number, and **grep your reply back** after writing.
