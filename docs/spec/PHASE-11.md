# PHASE 11 — Server-derived tier

Session `cgpe-mobile`. Written 2026-08-11, before a line changed, from a full read of
`src/store/roles.ts` (the only file with an email literal), `src/data/types.ts`, `src/store/auth.tsx`,
and `contracts/enums.md` §1.1 (`Profile.role`).

---

## The one-sentence goal

`tierOf()` stops granting Master by string-matching `shivam@cgpe.in` and instead reads the server's
own top rank, `Profile.role === 'super_admin'` — so the Master experience is a property of the
account the server says holds it, not of one email address compiled into every APK.

## DONE WHEN (from `docs/PHASES.md`'s Phase 11 section)

1. No email address literal remains in `src/`.
2. The master experience survives that person changing address.

---

## 1. What is actually true today — verified, with citations

`src/store/roles.ts:16` declared `export const MASTER_EMAIL = 'shivam@cgpe.in'`, and `tierOf()`
(`:37-42`) granted `'master'` when `user.email` matched it, case-insensitively, ahead of any role
check. Grepped: `MASTER_EMAIL` had exactly one export site and no importers anywhere else in
`src/` — nothing outside `roles.ts` itself referenced the constant, so the blast radius of removing
it is contained to this one file.

**The server already has the right field for this.** `contracts/enums.md` §1.1: `Profile.role`'s
enum is `payroll_staff · advisor · learn_advisor · leader · admin · super_admin`, and
`super_admin`'s own row says it "**passes every `authorize()` gate unconditionally**"
(`middleware/auth.js:63`). That is the server's own definition of the top rank — not a value this
phase invents. `contracts/api.md:181` confirms `GET /api/auth/me` returns the full profile
"incl. `role`", and `:48` confirms `POST /api/auth/login`'s response shape is `{ user_id, role, … }`
— so `role` is already on every login/refresh response this app receives, unwrapped by
`adaptUser()` (`api.ts:126`: `role: raw.role || 'advisor'`) with no filtering that would drop
`'super_admin'` before it reaches `User`.

**`Role` (`data/types.ts:3`) did not include `'super_admin'`.** Adding it is what makes
`user.role === 'super_admin'` type-check at all — TS strict rejects a literal comparison against a
union it isn't a member of ("this comparison appears to be unintentional"). Grepped for every other
consumer of the `Role` type: `types.ts`'s own declaration and `roles.ts`'s `tierOf()` are the only
two call sites in `src/`. No label map or exhaustive switch is keyed by `Role` elsewhere, so widening
the union has no other call site to update.

**Everything downstream of `tierOf()`/`capabilitiesOf()` already consumes the tier generically.**
`home.tsx`, `more.tsx`, `agent-track.tsx`, `notify.tsx`, `tasks.tsx`, `dashboards.tsx` all import
`capabilitiesOf`/`Tier`/`TIER_THEME` from `roles.ts` and branch on `caps.tier === 'master'` or the
booleans it derives — none of them read `MASTER_EMAIL` or `user.email` for gating. So the phase's
predicted file list (`roles.ts`, `auth.tsx`, `api.ts`, `more.tsx`) turned out to need exactly one
file changed for the tier logic itself, plus `types.ts` for the union — same shape as Phase 5's
"one file listed turned out to need nothing."

## 2. Locked decisions

**D-1. `super_admin` is the signal, not a new field.** No `cgpe-api` contract change is needed —
the enum value, its "passes every gate" semantics, and its presence on the login/`/auth/me`
response all already exist and are documented. This phase is pure app-side, matching its absence
of an `[api]` tag on the status board.

**D-2. `MASTER_EMAIL` is deleted, not deprecated.** Phase 11's own done-when criterion is "no email
address literal remains in `src/`" — keeping a fallback that still contains the literal would fail
the phase's own acceptance test. There is exactly one call site to update (`tierOf`), so there is no
migration window that a kept-around constant would be bridging.

**D-3. Rank order among the three checks is unchanged.** `super_admin` is checked first, then
`admin`/`leader`, else `team` — same shape as the email check used to sit ahead of the role check,
just swapped for a role comparison instead of an identity comparison. `viewAs`'s "preview a lower
tier" rule in `capabilitiesOf()` is untouched; it operates on `Tier`, not on how `Tier` was derived.

**D-4. This ships without a live-database confirmation that the account currently holds
`role: 'super_admin'`.** Verified from static code and contracts that the enum value and its
semantics exist; **not** verifiable from this repo whether any specific `Profile` document's `role`
field is set to it today — that is production data, not code. Asked the user rather than guessing;
they chose to proceed and confirm/set the field themselves. If the account is not yet provisioned
with `super_admin` at rollout, the fallback is not a lockout — `tierOf()` still resolves to whatever
tier the account's actual role implies (most plausibly `admin`, if the role is `admin`/`leader`)
until the field is set. Recorded here so a future session does not re-diagnose "why did Master
disappear" as a code bug.

## 3. Files

| File | Change |
|---|---|
| `src/store/roles.ts` | delete `MASTER_EMAIL`; `tierOf()` checks `user.role === 'super_admin'` instead of an email match; doc comment updated to match |
| `src/data/types.ts` | `Role` union gains `'super_admin'` — required for the comparison above to type-check under strict mode |

`src/store/auth.tsx`, `src/data/api.ts`, `src/app/(tabs)/more.tsx` were in the phase's predicted
file list and needed no change: `role` already flows through `adaptUser()` unfiltered, and every
consumer of tier already goes through `capabilitiesOf()`/`Tier`, not through the email or the raw
role directly.

## 4. Acceptance criteria

1. `npx tsc --noEmit` and `npm test` stay green (258 tests, 9 files — this phase changes a single
   predicate inside an already-tested-elsewhere function; no test file covers `tierOf` itself today,
   so no count changes).
2. `npm run lint` stays at the 46-error baseline.
3. `grep -rn "shivam@cgpe.in" src/` returns nothing.
4. `grep -rn "MASTER_EMAIL" src/` returns nothing.
5. `tierOf({ ...user, role: 'super_admin' })` returns `'master'` regardless of `email`;
   `tierOf({ ...user, role: 'admin', email: 'shivam@cgpe.in' })` returns `'admin'`, not `'master'` —
   proving the email no longer grants anything by itself.

## 5. Deliberately out of scope

- **Confirming or setting the `super_admin` role on any specific account in the production
  database.** Data, not code; not reachable from this repo. See D-4.
- **A test file for `tierOf`/`capabilitiesOf`.** `roles.ts` has zero coverage today and this phase
  does not add a test harness for it — same class of gap as `toggleClock` before Phase 17. Worth a
  future phase: `tierOf` is pure and trivially testable (four inputs, four branches), unlike most of
  this app's untested surface which is imperative write-path code.
- **`viewAs` preview semantics, `TIER_THEME`, `TIER_RANK`.** Untouched; they operate on the `Tier`
  output, not on how it was derived.
