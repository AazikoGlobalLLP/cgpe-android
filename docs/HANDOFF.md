# HANDOFF — CGPE Connect (Android) — Phase 16 (My earnings self-view) — 2026-08-12

Blocker cleared and phase shipped the same session. `cgpe-api` landed `GET /api/payroll/my-earnings`
(backend Phase 28, `protect`-only, self-scoped); built the self-view against it. All three gates green;
commits local (push still 403s).

## Done
- A signed-in member can open **More → My earnings** (or tap through from Attendance) and see **their own**
  attendance-derived pay for any of the last 12 months: the payable amount (count-up), Present / Payable days /
  Absent / Worked hours, a payable-days meter, a pay-basis card, and a **"so far this month"** pill on the
  current month.
- The screen is honest in every state: **no pay profile** → "no pay profile yet" (200 `data:null`, no banner);
  **server down** → "couldn't load" + Retry + HealthBanner (503); **all-zero month** → "no attendance recorded",
  never ₹0. Every ₹ figure is the server's — the app performs no multiplication.
- `npm test` **350 → 360**; `tsc` exit 0; `lint` 0 errors / 12 warnings (all verified on the committed state).

## Files changed
- `src/data/api.ts` — `+getMyEarnings(month)` + `MyEarnings` union; uses low-level `req()` (not `tryReal`) so
  `ok` / `empty` / `error` stay distinct; sends no `user_id` (server forces it). Reuses `PayrollRow`.
- `src/app/earnings.tsx` — **new** route: the self-view screen.
- `src/app/(tabs)/more.tsx` — +1 **ungated** "My earnings" row in the Account group (self-scoped → every member).
- `src/app/attendance.tsx` — +1 link card to `/earnings` (+`Href` import).
- `src/data/__tests__/api-earnings.test.ts` — **new**, 10 cases (self-scope, three states, outages-vs-answers).
- `docs/spec/PHASE-16.md` (BUILT + D-1/D-2/D-3), `docs/PHASES.md` (Now, Next 3, board), `docs/DECISIONS.md`,
  `docs/STATUS.md`, this file. `../contracts/INBOX.md` — box ticked + reply (disk-only, untracked).
- **Commits (local, branch `Shivam`):** `c77e1ad` (code + test), `60c4f5f` (docs). `.claude/settings.json`
  deliberately excluded (pre-existing unrelated change).

## Decisions made
- **Shipped the v1 aggregate, not the richer per-day body** (owner's call, asked before coding). Three forced
  deviations: **D-1** no per-day `<Spine>` (v1 has no `breakdown[]`; a per-day ₹ would need the forbidden
  multiply); **D-2** locked "Overtime h" KPI → "Worked hours" (no OT split in v1); **D-3** `EmptyState` not
  `characters.tsx` — that file was **deleted in Phase 14**, so the UI-lock's "revive it" was stale.
- **No role gate** — the route is `protect`-only + self-scoped, so the row is ungated for everyone (contrast
  Phase 20's admin roster, gated on the real `admin`/`super_admin` role because the backend 403s a leader).
- **`req()` over `tryReal`** — the only way to tell "no payroll profile" (200 `data:null`) from a real row,
  because `tryReal`'s `json?.data ?? json` collapses a null `data` into the envelope.

## Known broken / deliberately skipped
- **Phase 16 device check — CARRIED** (highest-trust-cost) — reconcile **≥3 real people's** months against the
  payroll sheet by hand on a phone; check light/dark at 390 px. `npm test`/web cannot do this. **Phase 1
  clock-in is the stated hard prerequisite** — a clock-in dropped on a bad connection under-states pay.
- **Phase 22 (i18n P1 bulk) — paused on human copy** — net-new `common.*` keys need gu/hi/hi-en/gu-en; machine
  translation forbidden (PHASE-19 §4). `earnings.tsx` copy is hardcoded English like the other ~40 screens.
- **Phase 6 (commissions) — backend-blocked** — no product aggregate, no `target` source. Unchanged.
- **`git push` still 403s** — `reactjsaaziko` lacks write access; all commits local-only. Needs a human.

## Next session starts here
- Phase <next>: board is editor-exhausted for net-new build (Phase 6 backend-blocked, Phase 22 copy-paused) —
  the one concrete step is the **Phase 16 device verification** on a handset; otherwise re-file `breakdown[]` +
  the days split to `cgpe-api` only if the per-day list is wanted (they offered).
- First command: `/boot`
- Watch out for: `../contracts/INBOX.md` shifts **mid-session** (a Phase-43 item was inserted above the
  my-earnings box between two reads minutes apart) — anchor every edit on surrounding text, never a line
  number, and grep your reply back after writing.
