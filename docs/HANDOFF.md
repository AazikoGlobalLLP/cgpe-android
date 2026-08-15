# HANDOFF — CGPE Connect (Android) — Phase 43 — 2026-08-14

Filed the per-member clock-in geofence ask to `cgpe-api`, they **shipped it the same day** (Backend Phase 50), and
this session **verified their real code** and confirmed mobile owes **zero change**. A pure `[api]` phase for
mobile end to end — no `src/` change, gates untouched. The courier workflow (verify → file → owner relays →
`cgpe-api` ships → mobile verifies) ran to completion inside the day, for the second time.

## Done
- **Each team member can now clock in only within 200 m of their OWN assigned location**, not one shared office
  fence — enforced server-side (`cgpe-api` Backend Phase 50), and the mobile app already consumes it with **no
  code change** (it reads whatever fence the server serves and the server is the clock-in authority).
- Verified in `cgpe-api`'s real source (not the summary): `getMemberGeofence(userId)` resolves the caller's fence
  (member `payroll_profiles.start_location` → global office → default, **centre-only**, org radius/enforce kept);
  clock-in enforces it; `GET /geofence` returns the caller's own fence with the **unchanged**
  `{lat,lng,radius_m,label,enforce}` shape + an additive `source`; the flagged `PUT /geofence` 2000→200 default
  bug is fixed.
- Confirmed the mobile side is inert: `getGeofence`/`checkGeofence` map the fixed shape and ignore `source`; the
  `label`→"Your assigned location" is inert (our clock-in copy is distance-based).

## Files changed
- `docs/spec/PHASE-43.md` — NEW: the finding, the backend gap, recommended design, and §8 (SHIPPED + VERIFIED).
- `docs/PHASES.md` — `## Now` Phase 43 entry (filed → shipped → verified, mobile zero-change).
- `docs/DECISIONS.md` — two entries (the pure-`[api]` decision; the same-day-ship verification).
- `docs/STATUS.md` — manager-facing: per-person clock-in location delivered + verified; device check remains.
- `contracts/INBOX.md` (outside the git repo) — filed the `→ cgpe-api` ask, then a `cgpe-mobile RE-VERIFIED`
  note under `cgpe-api`'s answer. Both grepped back durable.
- **No `src/` change.** Commits: `1a880f0` (filing docs), `2f55d85` (verification docs) — **local only, push 403s**.

## Decisions made
- **Phase 43 for mobile is pure `[api]`, build nothing** — clock-in is already server-authoritative and the app
  reads the fence shape-agnostically, so a per-member fence served through the existing `GET /geofence` just
  works. The Phase 27/38 "pure backend, mobile fail-open consumes" pattern. (DECISIONS 2026-08-14.)
- **Verify the producer's real code before concluding, even on a "SHIPPED" claim** — tags/summaries have been
  wrong 5×; read `utils/geofence.js` + `routes/timeTracker.js` and confirmed all five points + the flagged bug.
- **Recommended but did not dictate the source field** — `PayrollProfile.start_location` (the contract's own
  "clock-in pin"); `cgpe-api` took the recommendation, kept the radius as the single shared org knob (centre-only
  per-member), non-regressive fallback. Mechanism was theirs.

## Known broken / deliberately skipped
- **Phase 43 device check is CARRIED** — not editor-verifiable: a member standing at their assigned pin clocks
  in; ~201 m away is refused with the measured distance. Needs an admin to set a member `start_location` + a
  `cgpe-api` `:3001` restart, then a handset. Until a pin is set, a member falls back to the office fence (never
  locked out).
- **Phase 41a-iii-b part 2 is EDITOR-BUILT but DEVICE-UNVERIFIED** (commit `16e75ae`, prior session) — the unified
  24/7 recorder in `tracker.ts`; its acceptance gate is the §12.7 handset matrix (EAS build + 3+ OEMs + battery
  over a real day). `tracker.ts` has no test stub. Untouched this session.
- **`git push` still 403s** — commits `1a880f0`, `2f55d85`, and the earlier `16e75ae` are local only (human-owned
  credential swap). `.claude/settings.json` + two untracked `.txt` files are pre-existing and deliberately left
  unstaged.

## Next session starts here
- Two live tracks, both device-gated for building but the board has editor-actionable verify-and-file work:
  **Phase 44** (strict salary from hours/days — a `cgpe-api` payroll-engine formula; the app never multiplies)
  and **Phase 45** (completed-tasks report + performance score) are the next editor-actionable `[api]` filings;
  the build phases (41a-iii-b part 2 device matrix, 42 route-colouring) need a handset / 41 live.
- First command: `/boot`
- Watch out for: **do not "build" a per-member fence, a salary formula, or a per-day rate on the phone** — Phase
  43 needed zero mobile code and salary is a backend formula (rule 2, the app never multiplies). And for Phase
  44/45, verify the real `cgpe-backend-main` before filing (tags wrong 5×) — `payroll_profiles.salary_amount` +
  the `computeRangeSalary` engine exist, but there was no strict hours/days formula last check.
