# Phase 48 — [sec][m]+[api] Biometric-only session restore after logout

**Status: BUILT (editor-side). cgpe-api SHIPPED the re-mint endpoint (Backend Phase 58) → VERIFIED
against their real code → mobile restore flow wired + tested. Device + security review carried
(needs the `:3001` restart). 2026-08-15.**

> **UPDATE 2026-08-15 (later) — cgpe-api shipped Backend Phase 58; mobile BUILT.** Verified every
> security property against their real `routes/auth.js` + `models/RefreshToken.js` (not the summary):
> `POST /auth/refresh-biometric` is PUBLIC (no `protect`), body `{ refresh_token, device_id? }` →
> `{ user, token, refresh_token }`; `jwt.verify` WITHOUT `ignoreExpiration` (a >30d token is refused
> at the JWT layer too); a **`typ:'refresh'` check refuses a replayed access token** (`:1388`); the
> allow-list row must exist + be un-revoked + not past expiry; **rotate-on-use** (`:1424`); **reuse of
> a revoked token revokes the whole chain** (`:1401`); flat `401 INVALID_REFRESH` on every failure,
> `400` missing / `503` DB-down; login/verify-otp issue `refresh_token` **additively**; logout revokes
> it server-side, scoped to `{ jti, user_id }`; token never logged; `refresh_tokens` has a 30d TTL
> index. It matches the ask exactly, and cgpe-api chose the refresh-token model (not the weaker
> sliding-session) precisely for the server-side revocation D-2 needs. Mobile build below (§6).

Owner backlog Phase 48 (Group H, "security-sensitive, do last"). Scenario, verbatim from the owner:
a user logs in, closes the app, returns **2 days later logged-out**, and should get back into **their
own account** with **fingerprint/face only** — no id / password / OTP.

This is a security-review phase: a biometric that re-mints a bearer token is an auth surface. First
step was verification + owner-locking the model, NOT code (rule 5).

---

## 1. Verified findings (real code, both trees — not tags, which have been wrong 5×)

### Mobile (`ANDROID/src`)
- `lib/biometricIdentity.ts` seals `(userId, token)` behind an install-scoped, biometric-gated
  SecureStore entry. The **write/clear** half (`saveBoundIdentity` / `clearBoundIdentity`) is wired in
  `store/auth.tsx`: sealed on every successful login (`persist`, `:130-136`) and on toggle-on
  (`setBiometric`, `:246-256`); destroyed on logout/delete/toggle-off.
- The **read/restore** half (`resolveBoundIdentity`, `getLastResolveOutcome`, `isBiometricPoolIntact`)
  is fully implemented and hardened but has **ZERO app callers** (grep 2026-08-15). This is the gap.
- Today's login "biometric" is only a **liveness gate before a full id+password login**
  (`app/(auth)/login.tsx:126-136`, button "Unlock and sign in"): the user still types credentials, then
  biometric is checked on top. It does **not** restore a session from the sealed identity.
- **Logout destroys the binding on purpose.** `clear()` (`auth.tsx:174-187`) calls
  `clearBoundIdentity()` — the documented reason is "Leaving it would let the next person on this
  handset biometric-unlock straight back into the account that just signed out."
- **Silent session-expiry does NOT destroy the binding.** The `onSessionExpired` handler
  (`auth.tsx:65-76`) removes `TOKEN_KEY` + `USER_KEY` and nulls the user, but never calls
  `clearBoundIdentity()`. So after a silent token expiry the sealed record **survives** — holding a
  now-stale token.

### Backend (`cgpe-backend-main`)
- **Access tokens expire at 24h** — `generateToken` = `jwt.sign({ user_id }, JWT_SECRET, { expiresIn:
  JWT_EXPIRE || '24h' })` (`routes/auth.js:61-65`). So "return 2 days later" ⇒ the sealed token **is
  expired**.
- `POST /api/auth/refresh` **exists** (`routes/auth.js:1272`) but is `protect`-gated. `protect` runs
  `jwt.verify(token, …)` (`middleware/auth.js:16`), which **throws `TokenExpiredError` on an expired
  token → 401** (`:39-45`). **So the existing refresh endpoint CANNOT resurrect a 2-day-old token** —
  it only rotates a still-valid one.
- No `refresh_token` collection, no long-lived refresh credential, no biometric/device re-auth route
  exists today (grep `refresh`/`refreshToken`/`refresh_token` over the tree — only the `protect`-gated
  `/refresh` above and unrelated portal/analytics tokens).

**Conclusion.** The mobile read-half can restore `(userId, staleToken)`, but that token is dead after
24h and there is **no backend path** to mint a fresh token from a biometric-proven-but-expired
identity. Phase 48 therefore needs an **`[api]`** change. It cannot be a pure `[m]` wire-up.

---

## 2. Owner-locked model (AskUserQuestion, 2026-08-15)

- **D-1 — Restore, don't create.** "khud ka account create ho jana chahiye" = **restore the existing
  sealed session** (the same account), NOT mint a new account. (The literal-signup reading was offered
  and declined.)
- **D-2 — Only after a SILENT expiry, never after an explicit logout.** Keep the current
  destroy-on-logout behaviour. "Returned 2 days later logged-out" = the 24h token quietly expired, the
  binding survived, fingerprint restores. If the user **deliberately tapped "Log out"**, the binding is
  gone and they must type id/password/OTP again. This is the safest posture on shared handsets and it
  keeps the existing security invariant intact.
- **D-3 — Bounded ~30-day re-entry window.** Fingerprint-only re-entry works for up to ~30 days of
  inactivity; after that a **full login is required**. The powerful sealed credential auto-expires (the
  "refresh token" posture), rather than living forever (declined) or a tighter 7 days (declined).

---

## 3. Design (what will be built once the backend ships)

### 3.1 The `[api]` ask — a device-bound refresh credential (recommended; mechanism is `cgpe-api`'s call)
The server must be able to mint a fresh 24h access token for user U given proof that expires in ~30
days. The biometric is invisible to the server, so from the wire's view the proof is *possession of a
credential previously issued to U*. Recommended shape (filed to INBOX, not dictated):

- **At login** (`/auth/login` + `/auth/verify-otp`), additionally issue a **`refresh_token`** — a
  distinct long-lived credential (`{ user_id, typ:'refresh', jti }`, `expiresIn:'30d'`), ideally backed
  by a server-side **allow-list row** (`{ jti, user_id, device_id?, issued_at, expires_at, revoked }`)
  so it can be revoked. Returned alongside the 24h access token.
- **New PUBLIC endpoint** `POST /api/auth/refresh-biometric` — **NOT `protect`-gated** (the access
  token is dead). Body `{ refresh_token }`. Server verifies the refresh JWT (30d, real expiry), checks
  the allow-list row is present + not revoked + the profile is active, then **mints a fresh 24h access
  token AND rotates the refresh token** (revoke old `jti`, issue new). Returns `{ token, refresh_token,
  user }`. A revoked / expired / unknown refresh token ⇒ **401** (an honest answer, not a fault).
- **Revoke on explicit logout** — `/auth/logout` (or a new `/auth/refresh-biometric/revoke`) marks the
  presented refresh `jti` revoked, so D-2 is enforced **server-side**, not only by the client clearing
  its keystore. This server-side revocation is the property that makes "explicit logout must force a
  full login" real across the wire.

**Simpler alternative to offer them** (weaker, far less backend work): a `POST /auth/refresh-biometric`
that accepts the **expired access token** verified with `ignoreExpiration:true`, rejecting it when
`now - exp > 30d`. A sliding session on the same JWT — no new collection, but **no server-side
revocation** (a captured expired token is a 30-day credential), so it does not enforce D-2 across the
wire. Recommend the refresh-token model for the revocation property; flag the trade-off and let
`cgpe-api` choose.

### 3.2 Mobile side (the build phase, after the endpoint ships/documents)
- **Seal the refresh credential, not the access token.** `BindingRecord` stores the `refresh_token`
  (adopting whichever field the shipped contract names); bump `RECORD_VERSION` 1→2 to orphan every v1
  record (they hold an access token the new flow can't use). `saveBoundIdentity`/`persist`/`setBiometric`
  pass the refresh token.
- **Wire the read half on the login screen.** On mount, when `isBiometricPoolIntact()` and a binding
  exists, offer a prominent "Unlock with fingerprint" affordance. On tap: `resolveBoundIdentity()` →
  `(userId, refreshToken)` → `POST /auth/refresh-biometric { refresh_token }` → on 200 `persist(user,
  freshAccessToken)` + re-seal the rotated refresh token → `router.replace('/(tabs)/home')`. On 401 /
  revoked / >30d / any doubt → fall through to manual login with an honest, `getLastResolveOutcome()`-
  worded message ("Please sign in" vs "Try again"). Never a synthesised session.
- **Keep D-2 intact on the client:** `clear()` still `clearBoundIdentity()` on explicit logout AND
  should call the server revoke so the wire agrees. `onSessionExpired` still must NOT clear the binding
  (that is what makes silent-expiry restore possible).
- **New data-layer fn** `refreshBiometricSession(refreshToken)` in `data/api.ts` — two-outcome `req()`
  posture (401 = quiet answer → manual login; 5xx/network/shape-drift = banner), pinned by a new
  `api-refresh-biometric.test.ts`. The app never fabricates a granted state.

---

## 4. Done when
Backend ships `/auth/refresh-biometric` + the 30-day refresh credential (+ `api.md`/`models.md`), then a
later `[m]` build seals the refresh token, wires the login-screen restore, and passes a **device +
security review**:
1. Sign in → close app → wait past 24h (or force-expire) → open app → **fingerprint alone** returns to
   the SAME account, no id/OTP. (D-1)
2. Explicit **Log out** → fingerprint does NOT get back in; a full login is required (client binding
   gone AND server refresh revoked). (D-2)
3. After ~30 days of inactivity, fingerprint restore is refused and a full login is required. (D-3)
4. A refresh token captured off one device cannot restore on a **different** install (install-scoped
   binding + `WHEN_UNLOCKED_THIS_DEVICE_ONLY`); an added fingerprint invalidates the sealed key
   (fail-closed).
5. Gates: `tsc` 0 · `npm test` green (+ the new refresh test) · no new lint errors.

**Security review focus:** the refresh token is a 30-day bearer credential. Confirm server-side
revocation on logout works, rotation-on-use prevents replay, the allow-list row ties it to the user (and
ideally the device), and nothing logs the token. A biometric that restores a bearer token is only as
strong as the keystore seal (already hardened in `biometricIdentity.ts`) AND the server's willingness to
re-mint — both must hold.

---

## 5. Deliberately NOT in this phase
- **No change to the silent-expiry vs explicit-logout invariant beyond D-2** — the existing
  destroy-on-logout is deliberate and stays.
- **No `expo-crypto` / CSPRNG for the install marker** — unchanged; the marker is a same-install
  correlator, never trusted on its own (the compared value lives inside the encrypted record).
- **No auto-restore at cold start** — restore is offered on the LOGIN screen (a tapped affordance),
  not fired silently before the user sees it. A cold start with a stale access token still flashes
  home then bounces to login on the first 401 (existing behaviour); the restore is offered there.
- **No new native module / permission** — this build is JS-only (no `app.json` change), so it stays
  OTA-eligible for Phase 49 (unlike the Phase-41 tracker).

---

## 6. Mobile build record (2026-08-15)
Five files, no contract change (pure consumer of shipped Backend Phase 58), no new native dep.
- **`lib/biometricIdentity.ts`** — the sealed value is now the **30-day refresh token**, not the
  24h access token (`BoundIdentity.refreshToken`, `BindingRecord.refreshToken`); `RECORD_VERSION`
  bumped **1→2** so every v1 record (holding a dead access token) is orphaned fail-closed. All the
  install-scope / reinstall / enrolment-change hardening is untouched — only the sealed secret changed.
- **`data/api.ts`** — NEW `refreshBiometricSession(refreshToken, deviceId?)`: three-outcome result
  (`ok` / `declined` / `error`) over low-level `req()` (public call, no bearer, no health side effect);
  requires BOTH a fresh access token AND a rotated refresh credential on a 200 (a partial body → `error`,
  never a session); 400/401 → `declined` (an answer, no cascade — verified no bearer means `reportAuth`
  can't trip expiry), 5xx/network → `error` (retryable). NEW `serverLogout(refreshToken?)` (best-effort
  revoke). `login`/`verifyOtp` now thread `refresh_token` out additively.
- **`store/auth.tsx`** — `persist(u, token, refreshToken?)` stores the plaintext refresh copy (revoke-only)
  + **re-seals the refresh token on every auth** (login OR restore — it rotates, so a stale seal fails
  closed); NEW `restoreBiometricSession()` (resolve binding → exchange → persist, or clear the dead binding
  on `declined`) + `canBiometricRestore()` (cheap, never prompts); `logout()` **revokes server-side** before
  `clear()`; `clear()` drops `REFRESH_KEY`; `setBiometric` seals the refresh token and no longer refuses the
  toggle when a session has none (app-lock only needs a live fingerprint). Silent expiry still does NOT clear
  the binding (that is what makes restore possible).
- **`app/(auth)/login.tsx`** — a prominent **"Unlock with fingerprint"** affordance (+ "or sign in"
  divider) shown only when `canBiometricRestore()`; tap → `restoreBiometricSession()` → home on `ok`,
  honest wording + drop the affordance on `declined`/`unavailable`, retryable banner on `error`.
- **`data/__tests__/api-refresh-biometric.test.ts`** (18) — pins the request shape (public, no bearer),
  the three outcomes, the partial-200→error rule, the 401-no-cascade property, `serverLogout`, and the
  additive `refresh_token` threading on `login`/`verifyOtp`.

Gates: `tsc` 0 · `npm test` **513/513** (+18) · eslint 0 errors (3 pre-existing warnings on the touched
files, none new). Commit local (push 403s).

**DEVICE + SECURITY REVIEW CARRIED** (native-only + needs cgpe-api's `:3001` restart for the live
endpoint): §4 acceptance 1-5 on a real handset — restore after a real >24h expiry, explicit logout blocks
restore (binding gone AND server refresh revoked), >30d refused, cross-device rejection, enrolment-change
fail-closed; plus the [sec] review of rotation/revoke/no-logging against the running server.
