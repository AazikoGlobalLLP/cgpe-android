# HANDOFF — CGPE Connect (Android) — Phase 76 (§F network diagnosis + F2 loophole audit + fixes) — 2026-08-22

The big outcome: **the "app won't open / can't reach server" was diagnosed on a real device (ADB) as a
NETWORK-PATH problem, not an app bug — and the app now works** after the owner's senior applied the
server-side fix. Separately, a deep reliability audit fixed 8 real defects, and a fresh APK was cut.

## Done
- **The app now OPENS AND WORKS on the owner's networks.** Root cause (proven via ADB on the owner's
  Samsung A54): the phones are on **IPv6-only mobile networks (MTU 1300)** but **`cgpe.in` is IPv4-only
  (no AAAA)**, so traffic must cross carrier **NAT64**, and the server's full-size packets get dropped on
  the reduced-MTU path → the app's TLS handshake stalls → 15 s timeout → "could not reach server". The
  app itself was fine (it opened a real TLS connection and sent its request; the reply never arrived,
  while the same server answers a PC in 40 ms and the phone's browser copes). The owner's senior applied
  the **server-side fix (TCP MSS clamp → smaller packets)** and the app started working instantly — no
  app rebuild. The app *mislabels* a timeout as "could not reach server."
- **Deep reliability ("loophole") audit — 12 adversarially-confirmed defects (9 distinct), 8 fixed
  client-side, all pushed, all OTA-eligible.** Every one lives at the two edges the owner named (bad
  networks + shared handsets). Full report + per-defect commit map: `docs/AUDIT-2026-08-21-loophole-hunt.md`.
- **A fresh APK was cut** — EAS `a03e64cb`, v1.10.0, git `15f679e`, direct `.apk`
  `https://expo.dev/artifacts/eas/DEhZRl-mB0t-DeZ9NR05qNOO_guK-SvKDMrKjFS8YJY.apk` — carrying all 8 audit
  fixes + the Home parallel-load perf fix.

## Files changed
- `src/app/(tabs)/home.tsx` — bounded `getFix` (GPS 12 s timeout + last-known fallback + 5 s geocode) so
  clock-in/out/break can't spin forever (audit #1); merged Home's 3 sequential fetch phases into ONE
  parallel batch so the dashboard waits for the slowest read, not the sum (perf, for Master accounts).
- `src/store/auth.tsx` — `resetSessionGuard()` on session restore (audit #6); drop `track.ambient/notif/
  motion` on sign-out (audit #4); purge outgoing user's tracker sid on a different-user sign-in (audit #5/401).
- `src/lib/writeQueue.ts` (+`__tests__`) — a network throw never counts toward the poison-write cap (audit #3).
- `src/data/api.ts` (+`__tests__/api-flush-race.test.ts`) — atomic per-id read-modify-write in
  `flushWriteQueue` (audit #5); consecutive-failure circuit-breaker in `scanRenewals` (audit #8).
- `src/app/(tabs)/leads.tsx` · `app/reminders.tsx` · `app/notifications.tsx` · `ui/health-banner.tsx` —
  SyncChip on stale cache + honest outage copy (audit #9).
- `docs/AUDIT-2026-08-21-loophole-hunt.md` (audit + remediation status) · `docs/OWNER-BACKLOG-2026-08-21.md`
  §F (the network diagnosis) · `contracts/INBOX.md` (OPS ask + 2 [api] asks).

## Decisions made
- **"Could not reach server" is a NETWORK-MTU issue, not the app.** IPv6-only mobile + IPv4-only cgpe.in
  → NAT64 + MTU 1300 stalls the app's TLS; the browser copes. Fix is server-side: **MSS clamp now**
  (`iptables ... TCPMSS --set-mss 1200`), **dual-stack cgpe.in (add AAAA + IPv6)** for the permanent fix.
  There is no clean app-side fix — the app is failing gracefully. (My original 2026-08-21 IPv6/AAAA lead
  was right; I wrongly set it aside when the owner said the browser worked.)
- **Audit fixes shipped in priority order** with per-fix commits + gates green (`tsc` 0 · tests **772** ·
  lint 0 new). #7 (duplicate creates) is **backend-blocked** — it needs a client idempotency key, a
  contract addition, so it was filed (INBOX), not built with an invented field.

## Known broken / deliberately skipped
- **App-side timeout copy** still says "could not reach the server" for a slow/stalled response — a small
  honesty fix ("the server is taking too long") was offered but not built (awaiting owner go).
- **Push still doesn't deliver** — owner still owes the FCM V1 service-account key upload to EAS (Phase 74).
- **#7 duplicate-create** — waiting on the backend idempotency key (INBOX 2026-08-21 → cgpe-api).
- **Device-verify still owed** for the 8 audit fixes (native GPS / shared-handset / SyncChip render).
- **Permanent network fix**: the MSS clamp is applied; **dual-stacking cgpe.in (AAAA + IPv6) is still owed**
  as the robust permanent fix (INBOX 2026-08-22 → cgpe-api/OPS).

## Next session starts here
- **Resume the remaining owner-backlog phases** (owner confirmed the app works and wants to continue the
  build). Highest-value open mobile items: **B1** master detail · **D4** tasks calendar view · **C2**
  clock-out reason (needs the hour-threshold spec-lock) · **D3** team-screen reorder · **D6** UX
  simplification. Plus the tiny "timeout vs unreachable" message honesty fix.
- First command: `/boot`
- Watch out for: if "can't reach server" recurs, it is the **MTU/IPv6 server-path** issue (confirm
  cgpe.in has an AAAA + the MSS clamp is still in place), **NOT an app bug**. ADB device-driving works
  from here (platform-tools + a static aarch64 curl are in the session scratchpad) — use it to diagnose
  on-device issues rather than guessing.
