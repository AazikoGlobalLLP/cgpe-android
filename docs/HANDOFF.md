# HANDOFF — CGPE Connect (Android) — Phase 53 built + Phases 63–69 scoped — 2026-08-19

Owner #1 (the task bug) was **finished end-to-end** this session, and a new 6-issue owner batch (monitoring, payroll,
background location) was **investigated against real code and scoped into Phases 63–69**. The session's biggest finding is
**systemic and OPS, not code**: the "shipped" backend work of Phases 41–68 is **not live on prod** (and some of it is
**unpushed**), which is why several "done" features don't work on the owner's phone.

## Done
- **Phase 53b (mobile) BUILT + verified** (`46b061e`). The "today" task count no longer animates wrong on reopen: an
  undated task keeps `dueDate ''` (sorts to *Upcoming*, never a false *Today/Overdue*), and one shared unit-tested helper
  `todayProgress` (due-today ∪ completed-today) drives **both** Home and the Tasks tab so their counts can't drift.
- **Phase 53a (backend ticket→task mirror) VERIFIED + consumed** (`0b64be8`). cgpe-api's `syncTicketTaskMirror` + the
  follow-up `dueAt = ticket.createdAt` were read line-by-line; the app consumes it with **zero code change** and it's
  pinned by a test (a claimed ticket → a *dated* task, Today if claimed today / Overdue if older). **Correct in code — but
  see Phase 69: it is not deployed to prod, so it doesn't work on the device yet.**
- **Owner batch 2026-08-19 → Phases 63–69 scoped** (5 parallel real-code investigators, file:line cited). Full grounded
  spec: `docs/spec/ISSUES-2026-08-19.md`. 5 discrete `[api]`/`[sec]` asks + the OPS blocker filed to `contracts/INBOX.md`.

## Files changed
- `src/data/api.ts` — `adaptTeamTask`: undated `dueDate` → `''` (not `updated_at`); `completedAt`/`createdAt` read both casings.
- `src/data/tasks.ts` — NEW shared exported `dueBucket(t, now?)` + `todayProgress(list, now?)` (single source of truth).
- `src/app/(tabs)/tasks.tsx` + `home.tsx` — use the shared helpers; optimistic complete/reopen stamps/clears `completedAt`; numerator clamped to total.
- `src/data/__tests__/tasks.test.ts` + `api-team-tasks.test.ts` — pins (reopen-stability, undated→'', the ticket-mirror consumption). Suite 591 → **604**.
- `docs/spec/ISSUES-2026-08-19.md` (NEW) + `PHASES.md` + `DECISIONS.md` — the batch scoping. `contracts/INBOX.md` (untracked) — the OPS blocker + 5 asks.

## Decisions made
- **Undated task → `''`, not `created_at`** — `''` is Invalid-Date-safe (Upcoming, renders '-'); `created_at` would reproduce the bug.
- **Extract one shared `todayProgress` helper** — the only durable way to guarantee Home and Tasks never drift.
- **Scope the batch from real code before writing rows** — same discipline as the 2026-08-18 batch; each root cause is cited.
- **Name the systemic deploy gap explicitly** — several "backend done" items are un-deployed / unpushed; the ticket-mirror commit `cb3f9de` is on no remote at all.

## Known broken / deliberately skipped
- **🚨 Prod backend is ~28 phases behind.** Deployed `origin/main` = `1cad312` (Phase 38–40); Phases 41–68 never merged to
  `origin/main`. This is why Phase 68 (performance) and Phase 69 (ticket→task) "don't work" — the code is correct but not
  live. **Owner must have the backend team push + merge to `origin/main` + deploy + restart `:3001`.** Mobile can't (push 403s).
- **Phases 63–69 are SCOPED, not built** — next session executes and relays the asks.
- **Phase 64 monitor zeros are a REAL backend bug** (`attendance.js` drops clock-in coords) — a `:3001` restart alone won't fix them.
- **Background tracking (63)** needs a native APK build to ship the fix + a device/DB check to confirm the "service wasn't running" hypothesis.
- `git push` still 403s — every commit (`46b061e`…`d598787`) is local only.

## Next session starts here
- **Phase 63 (owner #1): background location.** Fix `src/lib/motion.ts` (`distanceInterval 0`, `High` accuracy, kill the
  5-min still-stretch), relay the `[api]` accuracy-drop, and get the owner to do the OPS checks (APK build / battery / DB
  session query). **But first, chase the owner on the deploy blocker** — it unblocks 64/66/68/69 for free.
- **First command:** `/boot`
- **Watch out for:** the **deploy gap** — do NOT re-diagnose "shipped" backend features (ticket-mirror, perf, break pins) as
  app bugs. They are correct in code and blocked purely on the backend deploying `origin/main`. Verify a backend feature is
  **live on prod**, not just present in the repo, before calling it done.
