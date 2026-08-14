# HANDOFF — CGPE Connect (Android) — Phase 33 — 2026-08-14

This session did two things: (1) built **Phase 32** (density → the remaining shared primitives
`base`/`controls`/`feedback`/`sheet`) and **Phase 33** (density → the Home dashboard `home.tsx`), finishing the
big density levers; (2) at `/handoff`, scoped the owner's large 2026-08-14 feature backlog into a proper
ordered roadmap (`docs/PLAN-2026-08-14.md`, Phases 34–48) — **planned, not built.**

## Done
- **A department whose config sets `theme.density:"compact"` now renders tighter across every big surface:**
  the four list tabs (Clients/Tasks/Leads/Claims), all the shared UI primitives (status pills, number tiles,
  detail rows, KPI chips, buttons, fields, cards, banners, skeletons, the modal sheet, person rows), **and now
  the whole Home dashboard** — spacing ×0.85, radius ×0.90, type sizes and ≥44 pt touch targets unchanged.
  Renders on the next cold start, no APK. `comfortable`/absent is unchanged (fail-open by reference).
- **Home is now WHOLE-screen compact** (Phase 33): because Home owns its own gutters/hero (not just shared
  primitives), the Phase-31/32 "elements tighten but the screen's own layout stays comfortable" nuance no
  longer applies to it.
- **The owner's backlog is now a real, ordered plan** (`docs/PLAN-2026-08-14.md`) — 15 phases, each with owner
  (mobile / `cgpe-api` / DB / security), dependencies, traps, and open questions.

## Files changed
- `src/ui/base.tsx`, `src/ui/controls.tsx`, `src/ui/feedback.tsx`, `src/ui/sheet.tsx` — Phase 32: static
  `{font,radius,spacing}` import stripped; each component destructures the scale off `c`; `controls.tsx`'s
  module-scope `BTN_FS`→`btnFs(font)` helper; default-param captures (`Txt`/`Metric`/`Skeleton`/`SkeletonText`)
  → optional prop + `?? c.<scale>`; `GlassCard`/`Row`/`SkeletonText`/`SkeletonCard`/`ToastProvider` gained the
  hook. Commit `2b50aaf`.
- `src/app/(tabs)/home.tsx` — Phase 33: static import stripped; 5 scale-using components destructure off `c`
  (`WidgetShell`/`SmallEmpty` gained the hook). No module-scope const, no default-param capture — a straight
  strip. Commit `f754843`.
- `docs/spec/PHASE-32.md`, `docs/spec/PHASE-33.md` (new); `docs/PLAN-2026-08-14.md` (new — the backlog
  roadmap); `docs/PHASES.md` (Now + Next 3 rewritten — backlog is the new driving priority); `docs/DECISIONS.md`
  (Phase 32/33 + planning entries); `docs/STATUS.md`; project `CLAUDE.md` (density note + a backlog pointer).
  Docs commits `2c13e89`, `4f81d6e` (+ this handoff).

## Decisions made
- **Phase 32/33 — reuse the Phase-29 D-2 pattern verbatim; no mechanism change.** Strip the static import,
  destructure off `c`, `tsc` proves completeness. Home had no module-scope const / no default-param capture, so
  it needed neither the helper nor the fallback variant — a straight strip + destructure.
- **Backlog is PLANNED, not started.** `/handoff` says do not start new work; turning the requirements into an
  ordered, dependency-aware roadmap is planning, not building. No feature code was written and no INBOX ask was
  filed (the project rule is verify-against-real-backend-first; file when each phase is picked up).
- **Role-by-identity stays in the DB, never a client literal.** The owner's "these 3 phone numbers are master"
  and "Viewing-as only for this one number" must be a `Profile.role` / capability change in the DB, not
  hard-coded phone strings in `src/` (Phase 11 removed the old email literal for exactly this reason).
- **Salary is a backend formula.** "Strict salary from hours/days" is `cgpe-api`'s payroll engine; the app only
  renders the server's computed amount (the app never multiplies — Phase 16/20/23/25).

## Known broken / deliberately skipped
- **The owner backlog (Phases 34–48) is entirely unbuilt** — by design; this was a `/handoff`, planning only.
- **`git push` still 403s** — stored credential `reactjsaaziko` has no write access to
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; all four commits this session are **local**. Needs a human to grant
  access or swap the credential.
- **Device-verification backlog carried** (Phases 1/4/5/6/7/9/10/12/13/16/23/24/25/28/29/30/31/32 + now 33) —
  no seeded compact-density dept doc exists yet, so the density work is not device-confirmable (Phase-26/27
  seeding backlog).
- **⚠️ SECURITY (carried, unchanged):** `cgpe-backend-main/scripts/seedAppRolePreferences.js` — remove + rotate
  the hardcoded Atlas credential before that file is committed/pushed anywhere. Sibling repo, not touched.
- **`density` still needs a seeded compact doc to be visible**; ~68 files remain on the static scale (the other
  `ui/` modules + the ~40 flat stack-route screens) — background fill, lower priority than the backlog.

## Next session starts here
- **Phase 34 — [audit] the self-created task not showing on the phone.** Reproduce (`super_admin` creates a task
  for himself → not visible), grep the task scope in `cgpe-backend-main`, and write the finding (client filter
  vs backend scope vs assignee/creator mismatch) before any fix. It is the first of three cheap audits (34/35/36)
  that unblock the rest of the backlog. Full plan: `docs/PLAN-2026-08-14.md`.
- **First command:** `/boot`
- **Watch out for:** the two identity traps in the backlog — (1) do **not** hard-code the master phone numbers
  or the Viewing-as number in `src/`; those are DB `Profile.role`/capability changes (Phase 11). (2) do **not**
  compute salary on the device; it is a backend formula. And verify every `[api]` assumption against the real
  `cgpe-backend-main` code before filing or building — the tags have been wrong 5×.
