# HANDOFF — CGPE Connect (Android) — Phase 62 (go-live VERIFIED against live :3001) — 2026-08-17

Verification-only session. The owner confirmed `cgpe-api` is now running on `:3001` (Backend Phase 62
live) and asked to verify everything, then hand off. No `src/` change — Phase 62's build was already
committed (`fc92573`) last session; this session proved the cross-repo contract matches the now-live
backend field-for-field and re-confirmed the green gates.

## Done
- **Phase 62 is verified go-live-ready against the live backend.** With `cgpe-api` up on `:3001`
  (health 200 · ~160 ms · IPv4), the two additive `/commissions/my-summary` keys the Commissions
  screen consumes — `target` (MDRT tier) and `byProduct` — were confirmed to match the mobile mapping
  **field-for-field against the real code on both sides**, so a real advisor account will see the tier
  card + "This year by product" bars drive off one call with no shape drift.
- **Gates re-run green on the exact committed tree:** `tsc --noEmit` clean · `npm test` **557/557** ·
  commit `fc92573` intact, `src/` unchanged.
- **The one drift-risk was checked and is correct:** `next_premium` maps via `numOrNull` (preserves
  `null` at the TOT top tier), NOT `fin`, so a top-tier advisor never sees a fake "0% to Quarter MDRT";
  `target === null` / legacy scalar `0` collapses whole-object-to-null; product bars render
  `p.amount / ytd` (server numbers, never re-summed — rule 2); the second `/advisor/performance` fetch
  is gone (only comment references remain).

## Files changed
- None in `src/` — verification-only session.
- `docs/HANDOFF.md`, `docs/DECISIONS.md`, `docs/PHASES.md` — this handoff (status + records only).

## Decisions made
- **Verified the Phase 62 go-live via cross-repo code-read, not a live authed call** — no advisor token
  is available in this environment, so the meaningful, rule-5 verification is field-for-field between
  `cgpe-backend-main/routes/commissions.js` (+`utils/mdrtTiers.js`) and mobile `api.ts`/`types.ts`/
  `commissions.tsx`. That contract is confirmed correct; only the on-device visual pass remains.

## Known broken / deliberately skipped
- **On-device visual confirmation still owed** — a real advisor login on a handset (tier card + bars
  render; `Σ byProduct === ytd`; a non-advisor sees neither). Not doable from the editor; the contract
  underneath it is now verified, so this is a low-risk visual check.
- **`git push` still 403s** — `fc92573` + the two prior docs commits are local only. Blocks Phase 49
  (a production build must ship from pushed, backed-up code), not the Phase 62 go-live. Needs a human
  to fix the `reactjsaaziko` credential's write access.
- **Phase 50** (dual-office geofence + out-of-range/early-clock-out reason) — backend-first; the two
  `[api]` asks are filed in `contracts/INBOX.md` but need the owner to relay them to `cgpe-api` and
  confirm the 5 flagged owner-decisions before any mobile build.
- **Phase 41 on-device verification** — parked LAST (owner); editor-complete, APK `7cdc351d` ready.

## Next session starts here
- Phase 62: on a real advisor handset, confirm the tier card + "This year by product" bars render and
  `Σ byProduct === ytd`, and a non-advisor sees neither — then Phase 62 is fully closed.
- First command: `/boot`
- Watch out for: **no advisor token exists in the editor** — the go-live check is a device-only visual
  pass; do not try to "verify" it with an unauthenticated call. The contract is already proven correct
  against live `:3001`, so a device miss would be an account/role issue, not a client bug.
