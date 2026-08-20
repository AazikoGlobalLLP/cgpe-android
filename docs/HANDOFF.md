# HANDOFF — CGPE Connect (Android) — Phase 55 built & pushed — 2026-08-20

Owner chose to build **Phase 55 (network resilience)** while Phase 72 stays blocked on the backend +
Firebase. Phase 55 is built, gated, committed (`941c583`), and pushed to `aaziko/Shivam`. It is the
"app doesn't work on my WiFi / this phone" fix. **Phase 72 is still PENDING** — re-verified premature at
the start of this session (prod `/push/register` 404, backend push code uncommitted / not on `origin/main`,
Firebase unset).

## Done
- **A slow / loaded network no longer fails the app the way it did.** The single aggressive **4.5 s**
  timeout (which also blocked *sign-in*) is gone: reads now wait **12 s**, login/OTP **15 s**, uploads
  **30 s**. A dropped SYN / stalled handshake on an idempotent **read** is now **retried once** (600 ms
  backoff) and self-recovers, so a transient blip never reaches the user. **Writes and uploads are never
  retried** (no double clock-in / send / upload).
- **The outage banner now names the failure** — "The server is responding slowly" vs "Can't reach the
  network" vs "The server had a problem" — instead of one generic line.
- **`uploadFile` no longer hangs forever** on a stalled socket (it had NO AbortController); it now fails
  cleanly at 30 s.
- **New Settings → "Test connection"** pings `/health` and gives a plain verdict, so the owner can tell an
  **app** problem from a **WiFi** problem on the phone itself, on-site.
- Gates green: `tsc` 0 · `npm test` **714** (+24: `netResilience` 12, `api-resilience` 12) · eslint 0 new
  errors (3 warnings all pre-existing).

## Files changed
- `src/constants/config.ts` — owner-locked "Balanced" knobs: `REQUEST_TIMEOUT` 4500→**12000**, new
  `LOGIN_TIMEOUT` 15000 / `UPLOAD_TIMEOUT` 30000 / `RETRY_ATTEMPTS` 1 / `RETRY_BACKOFF_MS` 600 / `HEALTH_PATH`.
- `src/lib/netResilience.ts` — **NEW** pure seam: `isIdempotentMethod` / `isRetryableStatus` (⚠️ 501
  EXCLUDED — it is this backend's "not deployed" quiet answer, not a fault) / `kindForThrown` / `backoffMs`.
- `src/data/api.ts` — `req()` bounded-retry loop (idempotent reads only); `login`/`sendOtp`/`verifyOtp`/
  `refreshBiometric` pass `LOGIN_TIMEOUT`; `uploadFile` gains an AbortController; NEW `testConnection()`;
  failure-kind threaded into `reportIfOutage`/`tryReal`; stale "4.5 s" comments corrected.
- `src/data/health.ts` — `HealthState.kind` + optional `kind` on `reportFailure` (a kind-less report
  PRESERVES the last kind so the `tryReal`→`unavailable` double-report can't erase it).
- `src/ui/health-banner.tsx` — kind-aware headline (falls back to generic when kind is null).
- `src/app/settings.tsx` — "Connection" section + "Test connection" row → plain app-vs-WiFi verdict.
- `src/lib/__tests__/netResilience.test.ts` (**NEW**, +12) · `src/data/__tests__/api-resilience.test.ts`
  (**NEW**, +12: retry/no-retry/kind/testConnection/upload-abort). Six existing test files updated for the
  new retry timing/counts (fake-timer advances bumped past the 600 ms backoff; api-geo 2→3, api-renewals
  1→2 fetch; health resetHealth gains `kind:null`) — none weakened.
- `docs/spec/PHASE-55.md` — **NEW** spec (owner numbers, honest limits, the 501 decision).

## Decisions made
- **501 is NOT retryable** even though it is a 5xx. In this backend 501 = "endpoint not on the deployed
  build", which `reportIfOutage` already treats as a quiet ANSWER like 404 — retrying it is pointless and
  would break that quiet-answer contract. Surfaced by two tests going red; the fix is in `isRetryableStatus`.
- **Retry lives in `req()` and applies to idempotent reads only** (a bare `req()` is a GET; every write
  passes a method). This is where the spec says to put it; the cost is a real test tax (see below).
- **A kind-less `reportFailure` preserves the last kind** rather than nulling it — kinds only ever come from
  the classifiers, so preserving one can never introduce a wrong one, and it survives the read path's
  double-report.
- **Balanced numbers + full phase** were owner-locked via AskUserQuestion (no p95 data existed, so the exact
  seconds were a judgement call).

## Known broken / deliberately skipped
- **Device-unverified** — JS-only (OTA-eligible) but rides the pending native batch APK (70/71/72/73), which
  bring native modules. Real proof needs a slow/flaky handset (sign-in succeeds where 4.5 s failed; a blip
  self-recovers; the banner names the kind; Test connection gives the right verdict).
- **New on-screen English strings** (Settings "Connection"/"Test connection" + 3 verdict messages + 3 banner
  titles) ship as English now and still owe **5-language human copy** (machine translation forbidden).
- **Suite wall-time rose ~0.6 s → ~4 s** — real-timer api tests that exercise a retryable GET failure now
  pay one real 600 ms backoff each. Correct, just slower; a future cleanup could fake-timer those files.
- **`Retry-After` on a 429 is ignored** (fixed exponential backoff). Immaterial for a single bounded retry.
- **DNS / captive-portal / firewall-blocked-`cgpe.in`** stay network-side — no client change fixes them;
  Test connection + the on-phone browser `/health` check is how you confirm it's the network.
- **Phase 72 (team push) still PENDING** — do NOT cut the APK or mark it done until the backend + Firebase
  are verifiably live.

## Next session starts here
- **No un-built mobile piece remains in the 63–73 batch.** Two real candidates: (a) **Phase 72** — execute
  ONLY on a *verified* "backend live" signal (re-probe: `git -C ../cgpe-backend-main fetch` + check the push
  files are committed/on `origin/main` + no-auth `curl .../push/register` → **401** not 404; and FCM set up),
  then cut the ONE combined APK (65+70+71+72+73); or (b) **Phase 56 (iOS)** — owner priority but gated on an
  **Apple Developer account ($99/yr)** decision. Phase 54 (`[api]` lead-open), 57 (offline, XL), 58 (needs
  owner repro) also stand.
- First command: `/boot`
- Watch out for: **do NOT trust "backend done" for Phase 72 — probe prod (401=live, 404=not) and check
  `git status` in `../cgpe-backend-main` before cutting an APK or marking it done.** And if you touch `req()`
  again, remember retry now adds a 600 ms backoff `wait()` to read-failure tests (fake-timer tests must
  advance past it) and 501 must stay out of `isRetryableStatus`.
