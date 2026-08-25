# Loophole hunt — round 4 (2026-08-25)

Adversarial multi-agent sweep over the **lower-risk surfaces the first three rounds never audited**:
boot / route-restore / session-lifecycle, tab-nav & RBAC gating, i18n honesty, and theme / density.
Four independent finder agents, each candidate then re-verified by hand against the real code before
any change. **5 defects fixed** (all JS-only / OTA-eligible, device-unverified); 4 more are
**document-only** (need human translation copy, or would override an admin's chosen accent).

Gates: `tsc` 0 · `npm test` **993** (+2, `api-reset.test.ts`) · `eslint` 0 new errors.
No contract / INBOX change (every fix maps to an already-decided rule).

---

## Fixed

### 1 — [HIGH] Shared-handset PII bleed: the api.ts in-memory buffer + 3 PII caches survived a user switch
`src/data/api.ts`, `src/store/auth.tsx` (+ `src/data/__tests__/api-reset.test.ts`)

Round 3 sealed the AsyncStorage / SecureStore / push teardown, but `data/api.ts` also holds per-user
data **in JS memory** that no teardown touched: the module-scope `state` write buffer and the
`clientCache` / `claimCache` / `waThreadCache` Maps. Two concrete cross-user leaks on a shared handset:

- **Authz bypass (the sharp one).** `getClient` / `getClaim` / `getWaThread` are **cache-first** —
  they `return clone(cache.get(id))` *before* any network call or backend 403. A record the outgoing
  user loaded was served to the next user with **no server check at all** (book PII, claim PII, a
  counterparty phone number).
- **Buffer bleed.** `unavailable('/claims', state.claims)` (and `/leads`) hands the previous user's
  **own** buffered offline-create records — client name, phone, policy number, amount — to the next
  user during any read outage.

**Fix.** New exported `resetApiState()` empties `state.*` and clears the three Maps. Called from
**both** `clear()` (explicit logout) and `onSessionExpired` (silent 401), plus the `persist()`
different-user branch — mirroring the round-3 shared-handset teardown. New test proves the cache stops
short-circuiting after teardown (forces the read onto the network where the 403 is the authority).

### 2 — [LOW, folded in] `onSessionExpired` did not null the current user
`src/store/auth.tsx`

`clear()` calls `api.setCurrentUser(null, null)`; the silent-401 path did not, leaving api.ts pointing
at the outgoing user (ownership / assignedBy defaults, and their reactive write-queue) until the next
login. Added the paired call alongside `resetApiState()`.

### 3 — [MED→HIGH in practice] A team-tier advisor's Home rendered the team roster + org analytics
`src/app/(tabs)/home.tsx`

The two leadership widgets — **team roster** (colleague names / roles / live-duty, each row →
`/team/[id]`) and **portfolio analytics** (org-wide client / premium / claim totals) — were gated only
on the fail-open RBAC flags `can_view_team_roster` / `can_view_org_analytics`, with **no role/caps
AND-term** (unlike the sibling `canCreateTask` one line up). Because `DEFAULT_UI` ships both widgets
`visible:true` and is the fallback when a role config is unseeded (**the current prod reality**), a
real team advisor's Home rendered both **with live data today**. Same class as the Point-9 client-book
leak.

**Fix.** Filter both widgets out of the dashboard for anyone without the role-derived capability
(view-as-aware `caps.manageTeam` / `caps.orgAnalytics`), exactly as the `bookHidden` filter does for
the client tiles — this removes the widget shell *and* its `See all → /team|/analytics` deep-link.
Also ANDed the fetch gate (`canRoster` / `canOrgAnalytics`) with the caps term as defence-in-depth.

### 4 — [MED] `/team`, `/team/[id]`, `/analytics` had no in-screen role guard
`src/app/team/index.tsx`, `src/app/team/[id].tsx`, `src/app/analytics.tsx`

Every other monitoring/admin surface re-gates in-screen (monitor/agent-map/performance/payroll), but
these three rendered colleague premium (MTD) figures and org-wide totals to **any** signed-in token —
reachable by deep-link (and, before fix #3, from the fail-open Home widgets). The Band-2 invariant is
"guards must be IN the screen, not only the tab bar."

**Fix.** Added the `RestrictedNotice` early-return each sibling uses, waiting on `ready` so a real
manager is not flashed the refusal during session restore. `/team` + `/team/[id]` gate on
`caps.manageTeam`, `/analytics` on `caps.orgAnalytics` (view-as-aware, matching the Home affordance).

### 5 — [MED] Confirm button + AppLock unlock button hardcoded white on the brand accent
`src/ui/Confirm.tsx`, `src/ui/AppLock.tsx`

`deriveBrandPalette` computes `onPrimary` (dark ink under a light accent) precisely so labels on the
accent stay readable, but the **primary Confirm button** and the **AppLock unlock button + icons**
(on `gradientBrand`) hardcoded `#fff`. Under a light department accent the main confirmation CTA and
the only affordance on the biometric-lock screen render an invisible label.

**Fix.** Use `c.onPrimary` on the accent-backed foregrounds. Confirm keeps white only for the
**destructive** button (always on red `c.danger`); AppLock keeps white for the title/subtitle (on the
accent-immune `gradientHero`).

---

## Document-only (not code-fixable here)

- **[i18n MED] `tomorrow` and `yesterday` collide in Hindi/Hinglish** (`कल` / `Kal`) — the Tasks
  day-group headers for overdue vs upcoming become identical. Needs **distinct human copy** (e.g.
  "बीता कल" / "आने वाला कल"); machine translation is forbidden. **Owner copy item.**
- **[i18n LOW] "Clocked in {time}" is hardcoded English** on the Home hero (`home.tsx`), defeating the
  supplied `home.clockedIn` translation. Fixing properly needs a `{time}` placeholder added to that
  key in all 5 languages (human copy). Meaning is preserved → accepted gap for now.
- **[theme MED] accent-as-foreground has no minimum-contrast clamp** (ghost/secondary labels, field
  focus ring, stepper icons) — a pathological light accent in light mode makes them near-invisible.
  A contrast clamp would **alter the admin's chosen accent**; flagged as a harden recommendation, not
  auto-applied. Dormant under the default azure and any reasonable brand color.
- **[theme LOW] an accent equal to danger-red** collapses the destructive-vs-normal color coding in
  Confirm/choose dialogs (label text still differs). Edge case; not worth overriding the accent.

## Clean (verified, not assumed)
Auth-race, RECORD_VERSION migration (fail-closed), route-restore-across-tier (no route persistence
exists), provider order; client-book surfaces (all guarded, incl. the round-2 claim-new catch);
master-only gates fold `leader` out correctly; payroll leader-into-admin trap; view-as escalation;
sales-advisor own-only carve-out; density scaling; theme crash/NaN/gamut; HealthBanner legibility.

## Not verified
Device-unverified — the auth/tracker/RBAC/theme paths can't be exercised by `tsc` / `npm test` / web.
Reasoned against the real code and mirror already-working sibling paths. Two fixes have owner/OPS
preconditions unrelated to correctness (accent contrast only bites on a misconfigured department
accent; the team-RBAC leak is live today under the unseeded-config prod state).
