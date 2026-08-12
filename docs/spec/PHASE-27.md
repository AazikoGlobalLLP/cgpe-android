# Phase 27 — Per-business-department app layouts (`resolveRoleKey` widening) — BACKEND ASK

**Owner-directed (2026-08-12).** Phase 26 made the More tab (and, since Phase 10, the bottom bar)
DB-driven per **resolver key**. But the live resolver only special-cases two departments, so the 6
real business departments cannot get their own layout. The owner asked to open the door for them.
This phase **specs the backend change and files the ask** — it is deliberately **not** a mobile
build. See "Mobile-side impact" (§5): the app already renders any `role_key` the server sends, so
**mobile owes zero `src/` change**; the work is entirely `cgpe-api`'s, coordinated via `contracts/`.

## 1. The problem, precisely

`resolveRoleKey(user)` (`cgpe-backend-main/routes/rbac.js:396`) decides which
`app_role_preferences` document a caller's mobile UI is built from:

```js
function resolveRoleKey(user) {
  const dept = String(user?.department || '').trim().toLowerCase();
  if (dept === 'sales' || dept === 'operations') return dept;   // ← only these two
  return String(user?.role || 'advisor').trim().toLowerCase();  // ← everyone else by ROLE
}
```

Consequences (all verified in code, not tags):
- Only the bare canonical departments **`SALES`** (→ `sales`) and **`Operations`** (→ `operations`)
  get a department layout. Everyone in the other **7** canonical departments resolves by **role**.
- Even the three **SALES sub-departments** miss it: `SALES-CGPE_Tree`, `SALES - RENEWALS & LIC`,
  `SALES - MUTUAL FUNDS & WEALTH` lowercase to `sales-cgpe_tree` etc., which `!== 'sales'`, so they
  fall through to role — despite being Sales.
- So **`HEALTH INSURANCE`, `TATA AIA`, `RECRUITMENT & CALLING`, `MUTUAL FUNDS & WEALTH`,
  `CGPE_Tree`, `RENEWALS & LIC`, `OTHERS`** all render whatever their *role* key carries. A
  department cannot be given a distinct More-tab grouping, tab bar, or dashboard, however much the
  panel/seed writes — because no key ever points at a department doc for them.

The seed script delivered in Phase 26 (`scripts/seedAppRolePreferences.js`) already documents this
limit in its header (lines 38-44): it seeds only the 8 keys the current resolver can emit.

## 2. Source of truth (verified 2026-08-12, in code + contract)

- **9 canonical departments** — `contracts/enums.md` §2.1 / `utils/rbac.DEPARTMENTS`:
  `SALES-CGPE_Tree` · `SALES - RENEWALS & LIC` · `SALES - MUTUAL FUNDS & WEALTH` · `SALES` ·
  `Operations` · `RECRUITMENT & CALLING` · `HEALTH INSURANCE` · `TATA AIA` · `OTHERS`.
  **Spacing/casing are load-bearing.** `Profile.department` is a free String; the 9-value list is
  applied at runtime by **`canonicalizeDepartment(raw)`** (`utils/rbac.js:130`), which does an
  exact case-insensitive match then a fuzzy `includes()` cascade, returning one of the 9 or `null`.
  It is already **exported** from `utils/rbac.js` (`module.exports` line 363-365) and already used
  elsewhere in `routes/rbac.js` (`:255`, `:311`, `:342`) — but **not** by `resolveRoleKey`.
- **`resolveRoleKey` does NOT canonicalize today** — it compares the raw lowercased string. So a
  free-string `"Sales Team"` currently misses even `sales`. Switching to `canonicalizeDepartment`
  would additionally fix free-string variants (a bonus, not the goal).
- **5 stored role defaults** (`ROLE_DEFAULTS`, `routes/rbac.js:289`; `enums.md` §4.1):
  `sales` · `operations` · `admin` · `leader` · `super_admin`. Any key outside these — incl.
  `advisor` and every new department key — has **no server-side default**, so `buildConfig` emits
  `GLOBAL_DEFAULTS` (`dashboard.widgets: []`, `nav.more_sections: []`). This is **fail-open**: the
  20-widget / full-menu default then lives only in the client (`DEFAULT_UI` in `appUi.tsx`).
- **`buildConfig(roleKey, stored)`** (`routes/rbac.js:~414`) = `deepMerge(GLOBAL_DEFAULTS,
  ROLE_DEFAULTS[roleKey] || {}, stored || {})`. A single `findOne({ role_key })` feeds `stored`
  (`GET /app-ui` handler `:438-452`). One key in → one doc looked up.
- **`PUT /app-ui/:roleKey`** (`:475-494`) lowercases the key (`String(...).trim().toLowerCase()`),
  so **the key vocabulary must be lowercase** to round-trip through the panel. `GET /app-ui/roles`
  (`:454-472`) unions `ROLE_DEFAULTS` keys with stored keys for the editor — new dept keys appear in
  the panel automatically once a doc exists.
- **Mobile has no resolver.** `grep resolveRoleKey ANDROID/src` = 0 hits. `normalizeUiConfig`
  (`appUi.tsx:256`) accepts **any** `role_key` string; `arrangeMoreSections` + `resolveTabs` render
  whatever `nav.*` arrives; unknown → `DEFAULT_UI`. So the app renders a brand-new department key
  with **no code change**.

## 3. The requirement (what mobile actually needs)

Give each real business department a **stable, distinct, lowercase `role_key`** so it can carry its
own `app_role_preferences` document (esp. `nav.more_sections`, `nav.tabs`, `nav.hidden`,
`dashboard`), **without regressing any current user** and **without breaking fail-open**. Mobile
does not need a specific mechanism — only the guarantees in §4.

## 4. Proposed backend shape (RECOMMENDED — but `cgpe-api`'s to decide/build)

Mobile proposes the following so `cgpe-api` can build without a round-trip. The **non-regressive
candidate-key chain** is the recommended option because it is the only one that adds department
layouts *without* dropping anyone who has none yet.

### 4.1 Department → key map (canonical name → lowercase slug)

| Canonical `department` | Proposed `role_key` | Note |
|---|---|---|
| `SALES` | `sales` | **exists today — unchanged** (back-compat) |
| `Operations` | `operations` | **exists today — unchanged** (back-compat) |
| `SALES-CGPE_Tree` | `sales_cgpe_tree` | new |
| `SALES - RENEWALS & LIC` | `sales_renewals_lic` | new |
| `SALES - MUTUAL FUNDS & WEALTH` | `sales_mutual_funds` | new |
| `RECRUITMENT & CALLING` | `recruitment_calling` | new |
| `HEALTH INSURANCE` | `health_insurance` | new |
| `TATA AIA` | `tata_aia` | new |
| `OTHERS` | `others` | new |

Derive keys via `canonicalizeDepartment()` → this map (a small constant `DEPT_KEY` beside
`resolveRoleKey`), **not** by raw slugging, so free-string variants normalize. **Collision-free:**
none of the 7 new slugs equals any role key (`advisor learn_advisor leader admin payroll_staff
super_admin`); `sales`/`operations` overlap **on purpose**. Namespacing (`dept:health_insurance`) is
therefore **optional** — mobile does not require it; the 9 canonical depts are collision-free as-is,
and un-namespaced matches the existing `sales`/`operations` convention and the Phase-26 seed keys.

### 4.2 Recommended: a candidate-key **chain** in the `GET /app-ui` handler (non-regressive)

Resolve an ordered candidate list and use the **first key that has a stored doc**; if none is
stored, use the **role key** (today's behavior). Sketch:

```js
// deptKey = DEPT_KEY[canonicalizeDepartment(user.department)]  (or null)
// roleKey = String(user.role || 'advisor').trim().toLowerCase()
const candidates = [deptKey, roleKey, 'advisor'].filter(Boolean);
// findOne({ role_key: { $in: candidates } }), then pick by candidates order;
// buildConfig(chosenKeyThatHadADoc || roleKey, storedOrNull)
```

Why the chain, not a single unconditional `deptKey`:
- **Non-regressive.** A `HEALTH INSURANCE` **leader** resolves to `leader` **until** a
  `health_insurance` doc is seeded — so they keep their current `leader` `ROLE_DEFAULTS` layout
  instead of dropping to bare `GLOBAL_DEFAULTS`. Departments "peel off" onto their own layout
  **incrementally, only when seeded** — no big-bang migration, no blank dashboards.
- **Fail-open preserved.** No dept + no role doc → `advisor` → client `DEFAULT_UI`.
- The simpler single-key form (`return deptKey || roleKey`) is acceptable **only if** every new
  dept key is seeded in the same change; otherwise it regresses unseeded departments. Mobile's
  strong preference is the chain.

## 5. Mobile-side impact — ZERO `src/` change

Verified in §2: the app has no resolver and renders any `role_key`'s document fail-open. So when
`cgpe-api` ships the change and a department doc exists, that department's More tab / tabs /
dashboard change **on the next cold start, no APK, no mobile code**. Mobile's obligations are only:
1. This spec + the `contracts/INBOX.md` ask (filed 2026-08-12).
2. A one-line confirmation, when the backend lands, that a new dept key renders (a device/`e2e`
   check — not editor-buildable here).

There is **nothing to build, no gate to re-run** in this repo for Phase 27.

## 6. Done when

- **This phase (mobile):** `docs/spec/PHASE-27.md` written; the `→ cgpe-api` ask filed in
  `contracts/INBOX.md` and grep-verified durable; board + DECISIONS updated. No `src/` change.
- **The backend deliverable (cgpe-api):** `resolveRoleKey` (or the `GET /app-ui` handler) emits a
  distinct key per canonical business department per §4, preserving §4.2's guarantees (back-compat
  for `sales`/`operations`, non-regressive, fail-open, lowercase, collision-free); `api.md`
  §`/api/rbac/app-ui` + `enums.md` §4.1 updated with the new key vocabulary; `appUi.test.js`
  `resolveRoleKey` suite extended. **Then** the Phase-26 seed script is widened to the new keys and
  run by the owner. Only after all three does a device actually see per-department layouts.

## 7. Decisions

**D-1 — This is a backend ask, not a mobile build.** The resolver lives only in `cgpe-api`; mobile
renders whatever key/doc it is handed. Building anything mobile-side (e.g. a client-side department
map) would duplicate server logic and violate the server-driven-UI contract. So Phase 27's mobile
deliverable is a spec + a contract ask, and the box stays open until `cgpe-api` replies.

**D-2 — Recommend the non-regressive candidate-key chain (§4.2), do not mandate a mechanism.** The
final shape is `cgpe-api`'s call. Mobile only requires the four guarantees: back-compat for the two
existing keys, no regression for unseeded departments, fail-open, and lowercase collision-free keys.

**D-3 — Keys are lowercase snake_case slugs of the canonical names; namespacing is optional.** `PUT
/app-ui/:roleKey` lowercases keys, so the vocabulary must be lowercase to survive a panel save. The
9 canonical departments are collision-free against role keys without a `dept:` prefix (§4.1).

**D-4 — Derive via `canonicalizeDepartment`, not raw slugging.** It already fuzzy-normalizes the
free-string `Profile.department` into one of the 9 (`utils/rbac.js:130`, exported), so
`"health ins"`, `"Health Insurance"`, etc. all land on `health_insurance`. Bonus: it also fixes
free-string variants of `sales`/`operations` that the current raw-lowercase resolver misses.

**D-5 — `resolveRoleKey` widening is necessary but not sufficient.** New keys still need seeded
docs (else they fail open to defaults). The Phase-26 seed script must gain the new keys and be run
by the owner. Per-business-department layouts are live only when resolver **and** docs both exist.

## 8. Not done here / handed off

- **The backend change itself** — `cgpe-api`'s to build (filed).
- **Seed-script widening + run** — follow-up after the resolver lands; owner-run, live-Mongo.
- **`MANDATORY_BY_ROLE` for the new Sales sub-department keys** — flagged to `cgpe-api`: today the
  mandatory-widget guard is keyed `sales`/`operations` only, so a `sales_cgpe_tree` doc would not
  inherit the Sales mandatories. Whether the Sales-family keys should inherit them is a backend
  product decision, not mobile's — raised, not decided.
- **Device confirmation** that a new dept key renders — not editor-buildable.
