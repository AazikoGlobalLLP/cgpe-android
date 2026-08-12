# HANDOFF — CGPE Connect (Android) — Phase 16 BUILT (My earnings self-view) — 2026-08-12

The Phase-16 blocker cleared and the phase shipped the same session. `cgpe-api` landed
`GET /api/payroll/my-earnings` (backend Phase 28) — a `protect`-only, self-scoped read — and this session
built the self-view "My earnings" screen against it. All three gates green; commit local (push still 403s).

## Done
- **Built Phase 16 — `src/app/earnings.tsx`, the self-view "My earnings" screen.** Every signed-in member
  sees **their own** attendance-derived pay for any of the last 12 months: headline `payable` (server-computed,
  rendered via `inr()` with a count-up), a KPI strip (**Present · Payable days · Absent · Worked hours**), a
  payable-days `<Meter>`, a pay-basis card (segment / monthly salary / per-day rate / office & worked hours), a
  12-month strip, and a **"so far this month"** provisional pill on the current month.
- **`getMyEarnings(month)` in `src/data/api.ts`** — uses low-level `req()` (not `tryReal`, which collapses
  `data:null`) so the **three states stay distinct**: `ok` (row) · `empty` (200 `data:null` → "no pay profile",
  **no banner**) · `error` (5xx/network/shape → banner + Retry, except 401/403/404/501 answers). Sends **no
  `user_id`** (the server forces it). Reuses the Phase-20 `PayrollRow`/`PayrollMonth` types.
- **Two entry points.** An **ungated** "My earnings" row in `more.tsx`'s Account group (self-scoped → every
  member, unlike the admin-only Payroll roster which gates on the real role), and a link card on `attendance.tsx`.
- **10 new tests** (`api-earnings.test.ts`) pin the self-scope (no `user_id`), the three states, payable
  passthrough, and outages-vs-answers. `npm test` **350 → 360**.
- **The app never multiplies (verified).** Every ₹ figure is the server's; the only on-device math is
  `absent = working_days − present_days` (days) and the meter ratio. No `*` on a rate in `earnings.tsx`.
- **INBOX:** ticked the `→ cgpe-mobile` my-earnings LANDED box `[x]` with a full reply (shipped, what we
  consumed = the v1 aggregate, nothing owed, the two-consumers heads-up). Grepped back — survived.

## Files changed
- `src/data/api.ts` — `+getMyEarnings` + `MyEarnings` discriminated union (after `getPayrollRoster`).
- `src/app/earnings.tsx` — **new** route.
- `src/app/(tabs)/more.tsx` — +1 ungated Account-group row (`/earnings`).
- `src/app/attendance.tsx` — +1 link card to `/earnings` (+`Href` type import).
- `src/data/__tests__/api-earnings.test.ts` — **new**, 10 cases.
- `docs/spec/PHASE-16.md` (BUILT section + D-1/D-2/D-3), `docs/PHASES.md` (Now + board row 16),
  `docs/DECISIONS.md` (top entry), `docs/STATUS.md`, this file.
- `../contracts/INBOX.md` — ticked the my-earnings box + reply (outside the repo, untracked, disk-only).
- **Not** `.claude/settings.json` — pre-existing unrelated change, left out of every commit as before.
- **Commits (local, branch `Shivam`):** `c77e1ad` (code + test). Docs commit follows.

## Decisions made (full detail: DECISIONS 2026-08-12 top, PHASE-16.md D-1/D-2/D-3)
- **Shipped the v1 aggregate, not the richer per-day body** — the owner's call (asked before coding). The
  backend returned the `/compute` `RosterRow` (monthly aggregate), so three forced deviations: **D-1** no
  per-day `<Spine>` (v1 has no `breakdown[]`; a per-day ₹ would need the forbidden multiply); **D-2** locked
  "Overtime h" KPI → "Worked hours" (no OT split in v1); **D-3** `EmptyState` not `characters.tsx` (Phase 14
  deleted it — reconstructing it would be invented work; `EmptyState` is the app-wide idiom).
- **No role gate** — the route is `protect`-only + self-scoped, so the row is ungated for every member. Contrast
  Phase 20's admin roster, which gates on the real `admin`/`super_admin` role because the backend 403s a leader.
- **`req()` over `tryReal`** — the only way to tell "no payroll profile" (200 `data:null`, an empty state) from
  a real row or a fault, because `tryReal`'s `json?.data ?? json` collapses a null `data` into the envelope.

## Known broken / deliberately skipped
- **Phase 16 device check — CARRIED (highest-trust-cost).** Reconcile **≥3 real people's** months against the
  payroll sheet by hand before wide trust; render check light/dark at 390 px. Neither `npm test` nor web can do
  this. **Phase 1 clock-in is the stated hard prerequisite** — a clock-in silently dropped on a bad connection
  under-counts present days and under-states pay; Phase 1 is code-complete but handset-verification is still open.
- **Phase 22 (i18n P1 bulk) — paused on human copy.** Net-new `common.*` keys (`tryAgain` ×34, etc.) need
  gu/hi/hi-en/gu-en; machine translation forbidden (PHASE-19 §4). `earnings.tsx` copy is hardcoded English like
  the other ~40 screens — no new i18n keys added. Fill-list: `docs/i18n/SCOPE.md` §4.1.
- **Phase 6 (commissions) — backend-blocked.** No product aggregate, no `target` source. Unchanged.
- **`git push` still 403s** — `reactjsaaziko` has no write access to `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`.
  All commits local-only. Needs a human to fix the credential or grant access.
- **Device-verification backlog** — handset-only acceptance carried from Phases 1/4/5/6/7/9/10/12/13, now +16.

## Next session starts here
- Board is again editor-exhausted for *net-new* build: Phase 6 backend-blocked, Phase 22 paused on copy.
  `/boot`, then check whether either cleared: `grep -n "target\|team-summary\|from cgpe-api" ../contracts/INBOX.md | tail -20`
  (Phase 6 commissions aggregate), and ask the owner whether i18n copy is now available (Phase 22).
- **If a handset is available** → walk the Phase 16 device check: reconcile ≥3 real people's months vs the
  payroll sheet, confirm light/dark at 390 px, and that `data:null` / 503 / all-zero states render as specified.
- **If the owner wants the per-day breakdown** → re-file `breakdown[]` + the `days.{half,holiday,weekly_off}`
  split to `cgpe-api` (they offered), then extend `earnings.tsx` with the `<Spine>` day list (PHASE-16.md D-1).
- **If neither** → nothing net-new is editor-buildable; do not fabricate work or invent copy.
- First command: `/boot`
- Watch out for: `../contracts/INBOX.md` shifted **mid-session** again (a Phase-43 item was inserted above the
  my-earnings box between two reads minutes apart) — anchor every edit on surrounding text, grep replies back.
