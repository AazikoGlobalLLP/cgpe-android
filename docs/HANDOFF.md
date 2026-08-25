# HANDOFF — CGPE Connect (Android) — Loophole hunt round 4 — 2026-08-25

## Done
- **A fourth adversarial loophole hunt** (4 independent finder agents, each candidate re-verified by
  hand against the real code) over the surfaces rounds 1–3 never audited: **boot / route-restore /
  session-lifecycle, tab-nav RBAC, i18n honesty, theme / density**. **5 real defects fixed, gate-green,
  pushed** (`6736ede`, `aaziko Shivam`) — every fix JS-only / OTA-eligible / **device-unverified**.
- **[HIGH] Shared-handset in-memory PII bleed sealed.** `data/api.ts`'s module-scope write buffer
  (`state`) and the `clientCache` / `claimCache` / `waThreadCache` lookup Maps survived logout / silent
  401 expiry / user-switch (round 3 sealed only the on-disk caches). Because `getClient` / `getClaim` /
  `getWaThread` are **cache-first** (they return before any network call or backend 403), the outgoing
  user's client-book / claim / phone PII was served to the next person on a shared handset with no
  server check; a read-outage also handed over the previous user's buffered offline-creates. New
  exported `resetApiState()` now runs from `clear()` **and** `onSessionExpired` (+ the `persist()`
  different-user branch). `onSessionExpired` also now nulls the current user like `clear()` did.
- **[MED, live today] A team-tier advisor's Home no longer renders the team roster + org-analytics
  widgets.** They were gated only on the fail-open RBAC flags, and `DEFAULT_UI` (the fallback used when
  a role config is unseeded — the current prod state) ships both widgets `visible:true`, so a team
  advisor's Home showed colleague names/duty + org-wide totals with live data. Now filtered on
  view-as-aware `caps.manageTeam` / `caps.orgAnalytics`, mirroring the Point-9 `bookHidden` pattern
  (removes the shell + its `/team|/analytics` deep-link), with the fetch gate ANDed too.
- **[MED] `/team`, `/team/[id]`, `/analytics` now carry an in-screen role guard** — they previously
  rendered colleague premium figures + org totals to any signed-in token (deep-linkable). Added the
  `RestrictedNotice` ready-gated early-return the sibling monitoring screens use.
- **[MED] Confirm primary button + AppLock unlock button/icons no longer hardcode `#fff`** on the brand
  accent — they use `c.onPrimary`, so a light department accent no longer makes the main confirm CTA or
  the biometric-unlock button invisible.
- Gates: `tsc` 0 · `npm test` **993** (+2, `api-reset.test.ts`) · `eslint` 0 new errors.
  `contracts/` / INBOX untouched (every fix maps to an already-decided rule — no cross-repo ask).

## Files changed
- `src/data/api.ts` — new exported `resetApiState()` (empties `state.*` + clears the 3 PII Maps).
- `src/store/auth.tsx` — call `resetApiState()` + `setCurrentUser(null,null)` from `onSessionExpired`,
  `clear()`, and the `persist()` different-user branch.
- `src/app/(tabs)/home.tsx` — pre-derive `canRosterCap`/`canAnalyticsCap` (view-as caps); filter the
  `team_roster` + `analytics` widgets on them; AND the fetch gate; add them to the memo deps (scalars,
  to dodge the preserve-manual-memoization trap).
- `src/app/team/index.tsx`, `src/app/team/[id].tsx`, `src/app/analytics.tsx` — `RestrictedNotice`
  early-return gated on `caps.manageTeam` / `caps.orgAnalytics`, ready-guarded.
- `src/ui/Confirm.tsx`, `src/ui/AppLock.tsx` — `c.onPrimary` on accent-backed foregrounds (white kept
  only on the always-red danger button and the accent-immune `gradientHero` title).
- `src/data/__tests__/api-reset.test.ts` (new) — proves the cache stops short-circuiting after teardown.
- `docs/AUDIT-2026-08-25-loophole-hunt-round4.md` (new) — the full round-4 report.

## Decisions made
- **Ran the hunt with the Agent tool, not a billed Workflow** — the user said "go" to the boot plan,
  which is not the explicit multi-agent-orchestration opt-in that Workflow requires; 4 finders + manual
  verification was cheaper and sufficient.
- **Fixed only findings that map to an already-decided rule** (Point-9 client-book policy, the
  shared-handset teardown pattern, the `onPrimary` convention, RBAC-fail-open danger-zone). No new
  product call was made.
- **Home fix removes the widget shell, not just the fetch** — mirroring `bookHidden`, so the team user
  never sees the shell OR its deep-link, and `has('team_roster')` then reads false which also zeroes the
  fetch. View-as-aware, so a master previewing "view as team" also loses them (the correct preview).
- **Four items left document-only** — the Hindi/Hinglish `कल` tomorrow=yesterday collision and the
  hardcoded "Clocked in {time}" both need **human translation copy** (machine translation forbidden);
  the accent-contrast clamp and accent==danger items would **override the admin's chosen accent**.

## Known broken / deliberately skipped
- **Device-unverified** — the auth/tracker/RBAC/theme paths can't be exercised by `tsc`/`npm test`/web;
  reasoned against real code, mirroring already-working sibling paths.
- **The team-RBAC leak was live today** under the unseeded-config prod state — now closed in the app;
  the real authority is still the backend (a team account should also be 403'd server-side on
  `/team/*` and org aggregates — not filed as it is a pre-existing broader item, and the client gate is
  defence-in-depth).
- **Four document-only items** (above) are unfixed by design — they need owner copy or a product call.
- **Nothing new reaches devices yet** — this commit is OTA-eligible but rides the next OTA / the pending
  Point-10 native APK.

## Next session starts here
- Phase: **owner/OPS follow-through** (no self-contained OTA `[m]` client item is outstanding), OR — if
  the owner wants — supply the human copy for the two i18n document-only items so they can be wired.
- First command: `/boot`
- Watch out for: **do not tell the owner any of these 5 fixes are "verified working"** — they are
  code-verified and gate-green but **device-unverified**; and when adding any RBAC affordance, remember
  the flag alone FAILS OPEN — always AND it with the role-derived `caps.*` (that was the Home leak).
