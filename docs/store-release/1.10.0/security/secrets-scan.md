# Secrets scan — 1.10.0 (source)

Source-level scan of the mobile repo (excluding `node_modules`). Backend secrets live in the separate
`cgpe-backend-main` repo and are out of scope here.

## Result: no secrets in the app bundle ✅

| Check | Result |
|---|---|
| JWT signing secret in app | None |
| DB credentials in app | None |
| OTP-provider API key in app | None |
| Cloud/service-account private key in app | None |
| Privileged API key in JS bundle | None |
| Committed `.env` with production secrets | None (`git ls-files` shows no `.env`; none on disk) |
| High-signal patterns (`mongodb://`, `sk_live_`, `AKIA`, `-----BEGIN`, `JWT_SECRET`) | No values in `src/` |
| `google-services.json` | Committed — **client** Firebase config (package-restricted `AIza…` key), safe |
| Backend secret **names** in docs | Present as prose only (names, no values) |
| Production transport | **HTTPS-only** → `https://cgpe.in/internal/api` (`src/constants/config.ts`); the only `http://` is `localhost:3001` on web dev |

## Release-binary scan (⏳ do at build time)

- [ ] Run a string/secret scan over the release AAB/IPA (not just source) once built — confirm no key leaked via a
      transitive dep or a build-time inline.
- [ ] Confirm the JS bundle in the artifact contains no privileged key.

## Authorization / other security items (spec §32) — status

- [x] Location endpoints enforce user/session identity (shift by `session_id`, ambient by token; server 403s
      un-consented ambient).
- [x] Admin/Master location reads are role-gated (real `super_admin`) at fetch **and** render.
- [x] Secure local storage for tokens + GPS buffer (SecureStore/Keychain via `lib/storage`).
- [x] Per-user cache reset on logout / silent-401 / user-switch (no cross-user data on a shared handset).
- [x] Biometrics = local unlock only; no raw biometric collected.
- [ ] Formal IDOR test pass across private endpoints (backend, owner-owed).
- [ ] Dependency audit (`npm audit`) reviewed before release; known critical/high triaged.
- [ ] TLS certificate validity confirmed on prod at submission time.
