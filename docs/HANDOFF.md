# HANDOFF — CGPE Connect (Android) — Phase 77 (timeout-vs-unreachable honesty fix) — 2026-08-22

The big outcome: **sign-in now tells the user the truth about WHY it failed.** A stalled request —
the server was reached but the reply never arrived in time (the IPv6/NAT64-MTU symptom) — used to
say *"Could not reach the CGPE server. Check your connection"*, which is the wrong instruction: the
connection is up, the round-trip just timed out. It now says *"The server is taking too long"* and
never tells the user to check a connection that is fine.

## Done
- **A login TIMEOUT and a truly-unreachable server are now worded differently.** `NetworkError`
  carries a `kind` (`'timeout' | 'network'`): a fired abort (OUR `AbortController` at `LOGIN_TIMEOUT`)
  or an error message naming a timeout → `'timeout'` (*"The CGPE server is taking too long to
  respond…"* + a clock icon + Try again); anything else `fetch` throws → `'network'` (the existing
  *"Could not reach… check your connection"*). A server REFUSAL (401/etc.) is unchanged — it was never
  a `NetworkError`. This is the small honesty fix that was "offered, not built" at the end of Phase 76.
- Gates green: `tsc` 0 · `npm test` **778** (was 772, +6) · lint **0 new errors**.

## Files changed
- `src/data/api.ts` — `NetworkError` gains `readonly kind` + a kind-appropriate default message; new
  `unreachableKind(e)` helper; the three auth throw sites (`login`/`sendOtp`/`verifyOtp`) pass the
  classified kind instead of a bare `new NetworkError()`.
- `src/app/(auth)/login.tsx` — `Failure` kind widened to `'network' | 'timeout' | 'refused'`;
  `describe()` maps `NetworkError.kind`; the offline-toned banner now also renders for a timeout with a
  clock icon (`time-outline`) and its own honest title, never the "check your connection" copy.
- `src/data/__tests__/api-login-failure.test.ts` (NEW) — 6 tests pinning the timeout/network/refusal
  split across `login`/`sendOtp`/`verifyOtp`.

## Decisions made
- **A timeout is NOT "unreachable."** The app opens a real TCP+TLS socket and sends the request; a
  timeout means the reply was slow or dropped, not that the network is down. Telling the user to
  "check your connection" over a timeout sends them chasing a problem they don't have — so the two are
  now split at the `NetworkError` boundary and worded oppositely. (`[m]` only, no contract change.)
- **Only the auth paths were touched.** The in-app `<HealthBanner/>` has distinguished
  timeout/network/server since Phase 55; the remaining gap was the LOGIN screen, which is exactly where
  the owner saw the misleading copy. Data-read paths were left alone.

## Known broken / deliberately skipped
- **Device-unverified** — the timeout banner only appears on a real slow/stalled sign-in; not
  reproducible in tests or on web. Verify on-device by signing in while the server path is degraded.
- **OTA-eligible, not in an APK yet** — JS-only change; rides the next OTA/APK, no native rebuild.
- **Push still doesn't deliver** — owner still owes the FCM V1 service-account key upload to EAS (Phase 74).
- **#7 duplicate-create** — still backend-blocked on a client idempotency key (INBOX → cgpe-api).
- **Permanent network fix** — dual-stacking `cgpe.in` (AAAA + IPv6) is still owed (INBOX → cgpe-api/OPS);
  the MSS clamp is the interim fix already applied.

## Next session starts here
- **Resume the owner-backlog build.** Highest-value open mobile items (owner picks): **B1** master
  detail · **D4** tasks calendar view · **C2** clock-out reason (needs a 2-line hour-threshold
  spec-lock BEFORE building) · **D3** team-screen reorder · **D6** UX simplification.
- First command: `/boot`
- Watch out for: **C2 needs a spec-lock first** (the exact hour threshold + who sees the reason) — do
  not invent the number. And if "can't reach server" recurs it is the **MTU/IPv6 server-path** issue,
  NOT an app bug (confirm `cgpe.in` has an AAAA + the MSS clamp is still in place); ADB device-driving
  works from here (platform-tools + a static aarch64 curl are in the session scratchpad).
