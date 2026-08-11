# HANDOFF — CGPE Connect (Android) — Phase-3 carry-out (dashboards KPI tiles) — 2026-08-11

Built and committed locally on branch `Shivam` as `3ef5539`. This closes the **last
editor-buildable item on the board**: the carried-out Phase-3 partial-outage tile. `git push` still
403s (unchanged — credential `reactjsaaziko` has no write access to
`Dev-Shivam-05/CGPE-ANDROID-APPLICATION`; needs a human). `3ef5539` and every earlier commit back
through `7c11c82` / `4507d6e` / `c8a4a79` are all **local only**.

Gates, all green after the change: `npx tsc --noEmit` exit 0; `npm test` **299 tests / 13 files**
(unchanged — presentational JSX change, no new pure logic to pin); `npm run lint` **0 errors / 12
warnings** (the Phase-15 baseline, nothing new).

## Done

- **A partial outage no longer lies on the Master/Admin dashboards.** With the roster loaded but the
  org endpoints down (`getOrgSnapshot` returns `null`), the Master KPI grid and Admin KPI grid used
  to render "0 clients · ₹0 claims paid" as fact. Every fabricating tile now shows `NO_VALUE` ("-")
  when the snapshot is absent, exactly like the hero above them already did. A healthy backend
  renders the real figures unchanged, and a genuine org `0` (present snapshot) still shows as `0`.

## Files changed

- `src/screens/dashboards.tsx` — 8 tile expressions: Master grid (5 of 6 tiles) and Admin grid (all
  3) changed from `snapshot?.field ?? 0` to `snapshot ? <value> : NO_VALUE`. Master's "Open tasks"
  tile left unchanged (its `tasks.filter(…).length` fallback is real loaded data, not a fabricated
  zero). Two `WHY` comments added above the grids.
- `docs/DECISIONS.md` — the decision entry (top, newest-first): why snapshot-presence, not the global
  `degraded` flag.
- `docs/PHASES.md` — new `## Now` entry; `## Next 3` #3 struck through as done; the Phase-3 carry-out
  blockquote marked CLOSED.
- `docs/PROJECT_MAP.md` — §5 Health-channel row: the remaining tile gap is now closed.

## Decisions made

- **Gated the tiles on `snapshot`-presence, deliberately NOT on `useDataHealth().degraded`** (the
  handoff suggested `degraded`). Two code-verified reasons: (1) snapshot-presence is what the hero at
  `dashboards.tsx:266` and home's own analytics widget (`home.tsx:1682`, the app's canonical
  org-snapshot pattern) already key on, so hero and tiles can never disagree on the same number; (2)
  `health.degraded` is **global and sticky** (`health.ts:33` / `PHASE-3.md` L8), so gating tile
  *values* on it would blank a tile whose data loaded fine whenever *any unrelated* endpoint failed.
  The outage-vs-loading distinction `degraded` carries is already shown by the global `<HealthBanner/>`
  and the hero's "Loading the organisation book" sub, so it does not belong in a tile's number. Full
  rationale: DECISIONS 2026-08-11 (top entry).
- **No test file, on purpose.** `dashboards.tsx` is presentational JSX with zero coverage and the
  harness has no React-Native renderer (the `test/stubs/*` exist only for module resolution) — same
  untestable-by-convention class as Phases 8/11/17. The change is two ternaries per tile.
- **No INBOX/contracts entry** — nothing crosses a repo boundary; this is a purely app-side display
  honesty fix.

## Known broken / deliberately skipped

- **`git push` still 403s** — `3ef5539` (and all earlier commits) are local only. A human must grant
  write access or swap the Windows-credential-manager credential. Did not retry; did not touch the remote.
- **Master's "Open tasks" tile and the Admin hero's `done/total`** still fall back to the loaded
  `tasks` list when the snapshot is absent — left alone on purpose: that is **real** session data, not
  a fabricated zero, and blanking it would exceed this fix's scope.
- **The non-null *partial* snapshot edge is unchanged** — if one of the three org legs answers and
  another fails, the snapshot is truthy and a failed leg's field is `0`. Fixing that per-field would
  mean widening `OrgSnapshot` to nullable fields (a new empty shell), which the handoff explicitly
  ruled out and which home's own analytics widget also does not do. The specified bug (all org legs
  down → snapshot `null`) is fully fixed.
- **Four 2026-08-11 backend FYI notices to `cgpe-mobile` are unticked in `INBOX.md`** — Phase 9
  (attendance watchdog), Phase 10 (`location_tracks` unique index), Phase 14 (notifications/notices
  now 5xx on error, not empty-200), Phase 15 (dead-code sweep). All reviewed; none affect the app.
  Not ticked because they are multi-recipient (`cgpe-admin` + `cgpe-mobile`) and each says "no tick
  needed unless you want the audit trail" — and editing `INBOX.md` for no functional reason invites
  the documented concurrent-write data loss. Only **Phase 14** is worth a grep (see below).

## Next session starts here

- **No editor-buildable phase remains.** Phases 6 (commissions) / 9 / 16 are `cgpe-api`-blocked;
  everything else on the board is a **handset-only** acceptance check (Phases 1/4/5/6/7/10/12/13).
- **The one genuinely-buildable next item** is the INBOX Phase-14 grep: backend now returns **5xx**
  (not `200 { data:[] }`) when `GET /api/notifications`, `/notifications/unread-count`, or
  `/notices/unread` error. Confirm the app's `notifications.tsx` / notice reads route those through
  `tryReal`/`unavailable` and do **not** paint an empty-200 as "nothing to show". If clean, tick the
  Phase-14 item; if not, it's a small honesty fix in the same class as Phase 3.
- **First command:** `/boot`
- **Watch out for:** `health.degraded` is **global and sticky**, not per-endpoint. Gate empty-state
  *copy* on it (as `lic-plans.tsx`/`kb.tsx` do), but gate an individual *value* on its own data's
  presence — otherwise one unrelated failure blanks a surface whose data loaded fine. This is the
  exact trap this session's tile fix was written to avoid.
