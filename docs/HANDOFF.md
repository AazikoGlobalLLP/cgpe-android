# HANDOFF — CGPE Connect (Android) — Phase 23 (MDRT tier element) + layout-source verification — 2026-08-12

Built the buildable slice of the Phase-6-blocked commissions screen (HANDOFF option d) and, at the owner's
request, verified end-to-end whether the app's layout is DB-driven or hardcoded. One `src/` change (Phase 23),
committed locally; the verification was read-only.

## Done
- **Phase 23 — MDRT tier-progress element on Commissions.** An advisor (or learn_advisor) opening
  Commissions now sees a real, server-authoritative **MDRT/COT/TOT tier card**: their first-year-premium
  figure, the tier they've reached, and a progress meter to the next tier (TOT shows "the highest tier").
  It renders even while the earned ledger below it is blank, because it reads a **different** endpoint. It
  never appears for roles it 403s or is meaningless for (leader/admin/payroll), and shows nothing on a real
  outage (the global banner already speaks once).
- **Verified: the app layout is a HYBRID — structure is DB-driven, rendering is hardcoded.** Traced the full
  chain in the real code (see the verification section below). The *what/where/order* comes from a per-role
  MongoDB document; the *pixels* are hardcoded React.

## Files changed
- `src/data/api.ts` — new `getMdrtTier(advisorId)` + `MdrtTier`/`MdrtTierResult`, reading the verified
  Phase-29 `GET /advisor/performance/:advisorId`. `req()` three-state posture (copied from `getMyEarnings`).
- `src/app/commissions.tsx` — new `MdrtTierProgress` card + `TierSkeleton`; role-gated mount above the
  ledger's loading/blank fork; imports `useAuth` + the `MdrtTier` type.
- `src/data/__tests__/api-mdrt.test.ts` — new, 13 cases pinning the wire contract.
- `docs/spec/PHASE-23.md` (new), `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, this file — record.
- Commit `a167370` on branch `Shivam` (local only — push still 403s). `.claude/settings.json` was a
  pre-existing unstaged change; left untouched and out of the commit.

## Decisions made
- **Consumed the existing endpoint; no contract change, no new INBOX ask.** Phase 29 was already verified in
  `cgpe-api`'s real code; this reads it directly. The `/commissions/my-summary` earned-aggregate filing stands.
- **A SEPARATE element, never the monthly meter.** `next_premium` is an annual FYC-premium goal, a different
  unit than the `thisMonth / target` monthly meter — so it gets its own card + meter and is never fed in.
- **Mounted above the ledger fork.** `getCommission` still resolves the empty shell (screen is always
  `blank`), so a tier card inside the non-blank branch would never show. Above the fork, it shows real data.
- **Role-gated to advisor/learn_advisor reading own id; silent on error.** Backend 403s any other case; a
  403 is an answer (no banner). Full rationale: `docs/spec/PHASE-23.md` D-1…D-5, DECISIONS 2026-08-12 (top).

## Layout-source verification (owner ask: "layout DB se aa raha hai ya hardcoded?")
**Answer: hybrid — the layout STRUCTURE is DB-driven; the RENDERING is hardcoded.**
- **DB-driven (per-role document, fetched every cold start):** `GET /api/rbac/app-ui` reads the caller's role
  document from MongoDB collection **`app_role_preferences`** (`cgpe-backend-main/routes/rbac.js:248,438,442`),
  written by the Admin Panel via `PUT /app-ui/:roleKey` (`:474`). The app fetches it (`api.ts:2627`
  `getAppUiConfig`), sanitises untrusted JSON and **fails open to the built-in `DEFAULT_UI`** on any outage
  (`store/appUi.tsx:99,213,464`). From that document the app drives: the **home dashboard** widget set + order
  + hero mode (`home.tsx:506,575,588`), the **bottom-tab bar** membership/order (`(tabs)/_layout.tsx:55` via
  `resolveTabs`, `nav.tabs`/`nav.hidden`), **More-menu row/quick-action visibility** (`more.tsx:96,256-268`
  `isHidden`), **feature capability gates** (`can(...)`), and **theme** accent/badge/density.
- **Hardcoded (never from the DB):** every screen's actual visual layout, components and styling (inline off
  `useTheme()`); the tab **icons** and the physical `<Tabs.Screen>` set (`_layout.tsx:33` `TAB_META`,
  `:182-189`); the More-menu **group titles/structure/order** — built from a hardcoded `rawGroups` via
  `capabilitiesOf()`, **`nav.more_sections` is deliberately NOT consumed** (`more.tsx:256`, Phase 10 D-3);
  the route tree itself; and `SCHEMA_FEATURE_DEFAULTS` mirrors `ui_rbac_config.json` **by hand** (drifts).
- **So:** a role's *dashboard cards, their order, which tabs show, what's hidden, and what capabilities are on*
  come from the database and are editable in the Admin Panel without an app release. The *screen designs and
  the pixels* do not — they ship in the app. If the config server/DB is down, the app shows the maximal
  hardcoded `DEFAULT_UI`, not a blank screen. This matches `docs/PROJECT_MAP.md` §4; no code change made.

## Known broken / deliberately skipped
- **Commissions earned aggregate — still backend-blocked.** Waiting on `cgpe-api` to scope
  `GET /api/commissions/my-summary` (filed 2026-08-12, `contracts/INBOX.md` line ~27, unanswered). Phase 23
  shows the tier element but NOT the earned figures (thisMonth/ytd/pending/history/recent).
- **Phase 23 device check — CARRIED.** Render the tier card on a real handset for a real advisor with sales;
  light/dark at 390 px. Not editor-buildable.
- **Phase 16 device check + the handset backlog — CARRIED** (Phases 1/4/5/6/7/9/10/12/13/16). Phase-1 clock-in
  is the stated hard prerequisite for the earnings/attendance checks.
- **Phase 22 (i18n P1 bulk) — paused on human copy.** Net-new `common.*` keys need gu/hi/hi-en/gu-en; machine
  translation forbidden (PHASE-19 §4).
- **`git push` still 403s** — `reactjsaaziko` lacks write on `Dev-Shivam-05/CGPE-ANDROID-APPLICATION`. All
  commits (incl. `a167370`) are local. Needs a human to grant access or swap the credential.

## Next session starts here
- Phase <next>: board is editor-exhausted for net-new build again. Concrete levers: **(a)** `cgpe-api` scopes
  `/commissions/my-summary` → unblocks the Phase-6 **earned** figures on the commissions screen (watch the
  INBOX reply); **(b)** owner-supplied i18n copy → unpauses Phase 22; **(c)** a handset → the Phase 23 + Phase
  16 + carried device checks. No net-new editor build is otherwise unblocked.
- First command: `/boot`
- Watch out for: `../contracts/INBOX.md` shifts **mid-session** under concurrent writes — anchor every edit on
  surrounding text, never a line number, and **grep your reply back** after writing. (No INBOX write this
  session — Phase 23 used an existing endpoint.)
