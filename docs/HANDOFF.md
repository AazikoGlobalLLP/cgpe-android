# HANDOFF — CGPE Connect (Android) — Phase 47 — 2026-08-15

Phase 47 ("Viewing as" restricted to the owner) built as one small, self-contained `[m]` change: the
tier-preview row in More is now gated on the **real `super_admin` role** instead of `realCaps.manageTeam`,
so every admin and leader loses it while the master keeps it. No backend, no contract, no i18n change.
**Owner locked the mechanism first (AskUserQuestion): role-based, not a per-account backend flag, not a
phone literal.**

## Done
- **"Viewing as" (the tier-preview row in More → Personal) is now Master-only.** A real admin and a real
  leader no longer see the row; a real `super_admin` still opens the preview sheet, previews the Admin /
  Team sides, and switches back. The row reads the REAL role (not the preview `caps`), so it stays visible
  while a master is mid-preview — they can always get back to their own view.
- The gate is a NEW pure predicate `canViewAs(user) = user?.role === 'super_admin'`, the fourth of the
  `super_admin`-only predicate family (`canSeeLiveLocation`/`canSeeTeamPerformance`/`canMonitorTeam`),
  pinned on its own across all 6 roles + null.

## Files changed
- `src/store/roles.ts` — NEW pure `canViewAs(user)`, parallel to the three Phase 39/40/45 gates (kept
  separate so they can't drift). Doc comment records the folded-tier reasoning + owner lock.
- `src/app/(tabs)/more.tsx` — Personal-tail "Viewing as" row gated on `canViewAs(user)` (was
  `realCaps.manageTeam`); import + comment updated. `realCaps` still drives the sheet's option filter
  (`:425`), so it is not orphaned.
- `src/store/__tests__/roles.test.ts` — +4 cases pinning `canViewAs` across all 6 roles + null.
- `docs/spec/PHASE-47.md` — NEW spec. `docs/PHASES.md` — Phase 47 "Now" block + status board row.
  `docs/DECISIONS.md` — 2026-08-15 Phase 47 entry.

## Decisions made
- **Gate on the real `super_admin` role, owner-locked via AskUserQuestion (2026-08-15).** The backlog
  says "one number only" (`9106988376`), but rule 1 forbids a phone literal and that number is one of the
  THREE Phase-38 masters, so a truly-one-account gate would need a NEW per-profile backend capability flag
  (`[api]`). The owner chose the pure-`[m]`, ship-today option, accepting that all three masters keep the
  row. No `[api]` ask, no contract change.
- **New named predicate rather than an inline `role ===` check** — the file's existing convention keeps
  each `super_admin` gate separate "so they can't drift" and pins each one; `canViewAs` follows it exactly.
- **Read the REAL role, not the preview `caps`** — a master previewing a lower tier must still see the row
  to switch back, and (like the sibling gates) a preview must never be able to climb back up.

## Known broken / deliberately skipped
- **Truly-one-account restriction is NOT built** — that needs a per-profile backend capability flag
  (`[api]`, Phase-38 courier shape) + an owner DB set on one account; the owner declined it for role-based.
  If they change their mind, file the flag and swap `canViewAs` to read `user.<flag>` — the seam is a single
  predicate.
- **Device check CARRIED for Phase 47** (native + Phase-38-live-gated): a real admin + leader find the row
  gone; a real `super_admin` still previews Admin/Team and switches back. Needs Phase 38's DB promotion for
  a live master, though the gate holds regardless.
- **`git push` still 403s** — this commit (`3baf05d`) + all prior Phase-45/46/49 commits are local-only;
  credential `reactjsaaziko` has no write access. Needs a human credential swap. **This blocks Phase 49.**
- Carried device/backend checks unchanged: 41 part-2 (24/7 recorder), 42 (route colouring, blocked on 41),
  43 (geofence), 45 (both performance screens, needs cgpe-api `:3001` restart), 46 (emoji alignment). All
  native/backend-live-gated, not editor-buildable.

## Next session starts here
- **Phase 48 — [sec][m]+[api] biometric-only session restore after logout — is the next editor-actionable
  item** (PLAN §Phase 48), but it is a security-sensitive phase: spec it carefully first (the scenario is
  "return 2 days later logged-out → back into your OWN account with fingerprint/face only, no id/OTP").
  Verify the real backend before filing (tags wrong 5×) and confirm the identity-binding model — the
  `biometricIdentity.ts` write half is already wired but the read/restore half is not.
- **Phase 41 (24/7 background location) remains the owner's #1 priority but is device/EAS-build-gated** —
  do NOT "build" it in the editor again; it needs a fresh EAS/dev-client build on a real handset + the
  §12.7 acceptance matrix. The editor half (41a + 41a-iii-b) is already built and device-unverified.
- First command: `/boot`
- Watch out for: **every commit is local (push 403s)** — flag the push as the blocker for Phase 49; and
  **Phase 48 is `[sec]` — do not write code before the identity-binding model is spec-locked and the
  backend gate is verified in real code.**
