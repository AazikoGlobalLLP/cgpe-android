# Phase 55 — Network resilience ("the app doesn't work on my WiFi / this phone")

**Status:** BUILT (editor) 2026-08-20 · gates green · device-unverified (JS-only, OTA-eligible).
**Type:** `[m]` mobile-only. No `[api]`, no contract change, no new native module.
**Owner decisions (locked 2026-08-20, AskUserQuestion):** timeout preset **"Balanced"**; scope **"full phase"**
(include the Test-connection button + kind-aware banner).

## The complaint
Owner reports the app "doesn't work on my WiFi / this phone". Verified there is **no network-type check
anywhere in `src/`** (the app never requires mobile data) and the backend is healthy (`/health` 200,
~40 ms). So the failing networks are partly environmental — BUT the client made it worse than it had to:

1. **A single 4.5 s timeout** (`config.ts` `REQUEST_TIMEOUT`) for **every read AND login**. A cold TLS
   handshake on a weak/loaded link can eat 2–5 s; Home fans out ~6 parallel reads; and `login()` used the
   same 4.5 s, so a slow network **could not even sign in**.
2. **Zero retry.** One dropped SYN / stalled handshake failed the call permanently.
3. **No error-kind.** timeout / DNS / TLS / server-error all collapsed to one generic "could not load",
   sending a user to "check your connection" over a slow *server*, or the reverse.
4. **`uploadFile` had no AbortController** → it hung forever on a stalled socket.

## What was built (owner-locked "Balanced" numbers)
All tunables live in `src/constants/config.ts` (single source of truth):

| Knob | Old | New | Note |
|---|---|---|---|
| `REQUEST_TIMEOUT` (reads) | 4500 | **12000** | |
| `LOGIN_TIMEOUT` (login/OTP/biometric-refresh) | (4500) | **15000** | longer; a single call the user waits on |
| `UPLOAD_TIMEOUT` | ∞ (none) | **30000** | was: hung forever |
| `RETRY_ATTEMPTS` | 0 | **1** | 1 retry ⇒ up to 2 tries |
| `RETRY_BACKOFF_MS` | – | **600** | exponential per retry index |

- **Bounded retry inside `req()`** — `src/lib/netResilience.ts` (pure, tested) decides: retry **idempotent
  reads only** (a bare `req()` is a GET; every write/upload passes a method and gets one attempt so a
  clock-in / send / upload can never double-fire), and only on a **throw** (dead network / our abort) or a
  **transient status** (5xx / 429). ⚠️ **501 is EXCLUDED** even though it is a 5xx: in this backend 501 is
  the "endpoint not on the deployed build" signal that `reportIfOutage` treats as a **quiet answer** (like
  404), not a transient fault — retrying it is pointless and would break that quiet-answer contract.
- **Failure kind → `data/health`.** `req()`/`tryReal`/`reportIfOutage` now pass a `FailureKind`
  (`timeout` | `network` | `server`) into `reportFailure`. A kind-less report **preserves** the last kind
  (the common read path reports the same endpoint twice — `tryReal` with a kind, then `unavailable`
  without — and kinds only ever come from the classifiers, so preserving can never introduce a wrong one).
  `HealthBanner` names the failure: "The server is responding slowly" / "Can't reach the network" / "The
  server had a problem"; `null` falls back to the old generic title. The "blank values are unconfirmed"
  honesty line stays regardless.
- **`uploadFile` AbortController** — a stalled upload now fails at `UPLOAD_TIMEOUT` (returns `null`, exactly
  like any failure) instead of hanging. Single attempt (multipart POST, non-idempotent).
- **`testConnection()` + Settings "Test connection" row** — pings the unauthenticated `/health` (its own
  timeout, **no retry** — a diagnostic reports the first result honestly) and renders a plain verdict so the
  owner can tell an **app** problem from a **WiFi** problem on-site: reachable-but-a-screen-is-empty →
  data/sign-in; timeout → very slow link; throw → the WiFi can't reach `cgpe.in` (with the definitive
  browser check to confirm).

## Gates
`tsc` 0 · `npm test` **714** (+24: `netResilience` 12, `api-resilience` 12; existing retry-affected tests
updated for the new timing/counts, none weakened) · eslint 0 new errors (3 warnings all pre-existing).

## Honest limits / not done
- **Retry backoff is fixed exponential and ignores `Retry-After`** on a 429. A single bounded retry makes
  this immaterial; honoring `Retry-After` is a refinement, not built.
- **DNS-can't-resolve / captive-portal / firewall-blocked-`cgpe.in` stay network-side.** No client change
  can fix them; `testConnection` + the on-phone browser `/health` check is how you confirm it's the network.
- **New on-screen English strings** (Settings "Connection"/"Test connection" + the 3 verdict messages, and
  the 3 banner titles) ship as **English now** — owner accepted (full phase); they need 5-language human
  copy later (machine translation forbidden), like the other pending copy.
- **Suite wall-time rose ~0.6 s → ~4 s.** Real-timer api tests that exercise a retryable GET failure now
  pay one real 600 ms backoff each. Correct, just slower; a future cleanup could fake-timer those files.
- **Device-unverified.** JS-only (OTA-eligible), but rides the pending native batch APK (70/71/72/73) since
  those bring native modules. The real proof is a slow/flaky handset: sign-in succeeds where 4.5 s failed,
  a transient blip self-recovers, the banner names the kind, and Settings → Test connection gives the right
  verdict on a bad network.

## Open (`[api]`, optional, not filed)
Backend could add a short `Retry-After` on its 429s; not required for this phase.
