# HANDOFF — CGPE Connect (Android) — Band 2 #1: report timeout fix — 2026-08-24

## Done
- **Fresh reports no longer die at 12 s.** `generateReport` was aborting a POST that the backend holds
  ~60 s open for a 15–40 s n8n render, using the ordinary 12 s read timeout — so every *first-time*
  report was killed client-side before the server could answer (a cached one returned fast, which
  masked it). It now gets a dedicated **65 s** ceiling. Observable: tapping "Generate report" on a
  fresh client now waits for the render instead of failing after 12 s.
- **A slow report no longer lies about the whole app.** If a report still outruns 65 s it is named
  report-specifically ("taking longer than usual — try again") and does **NOT** raise the global
  outage banner — one slow heavy endpoint is not a whole-app outage. A genuinely dead network still
  raises the banner exactly as before.
- Gates green: `tsc` 0 · `npm test` **829** (+2) · `eslint` 0 new errors. Commit `4516dd9`, pushed
  `aaziko/Shivam`. OTA-eligible; device-unverified.

## Files changed
- `src/constants/config.ts` — new `REPORT_TIMEOUT = 65000` (server wait + a small TLS/round-trip
  cushion). POST, so `req()` never auto-retries it (no duplicate render).
- `src/data/api.ts` — `generateReport` passes `REPORT_TIMEOUT`; its catch splits on `kindForThrown`:
  our own 65 s abort → new `reason: 'timeout'` (no health-banner report); a real network throw →
  `'network'` → `reportFailure` → banner, as before. `ReportFailure` union + docs gained `'timeout'`.
- `src/app/client/[id].tsx` — added the `timeout` branch to the failure message so the cause reads
  "taking longer than usual" instead of "the service did not answer".
- `src/data/__tests__/api-report.test.ts` — +2 tests: one drives the real `AbortController` to pin it
  does NOT abort at 12 s but does by 65 s and stays quiet; one pins abort→`timeout` + no banner + no
  POST retry.

## Decisions made
- **65 s ceiling** (covers the backend's ~60 s wait + cushion). Constant lives in `config.ts` as the
  single source of truth, matching `LOGIN_TIMEOUT`/`UPLOAD_TIMEOUT`.
- **A report timeout is NOT a whole-app outage** — it must not flip the global `<HealthBanner/>`. This
  is deliberate: the timeout-vs-network split in the catch is load-bearing. Do NOT collapse it back to
  one `reportFailure(key, kindForThrown(e))`. A genuinely dead network is still an outage (a 65 s hang
  where TCP connected but no body arrived is far more likely a slow render than a dead link; and if the
  network really is down, the app's other reads flip the banner independently via their 12 s timeouts).
- **Kept the report messages hardcoded English**, consistent with the three existing report-failure
  strings — did NOT add i18n keys (they would owe 5-language copy; out of scope for a timeout fix).

## Known broken / deliberately skipped
- **Reports still won't generate on a phone until the OPS half lands** — this commit is the `[m]`
  half only. The owner must set the report webhook env on the server (`CGPE_REPORT_WEBHOOK_URL` +
  `CGPE_REPORT_SECRET`), confirm the n8n `cgpe-report-render` workflow is live, ensure nginx
  read-timeout ≥ 60 s, and restart `:3001`. **Do NOT tell the team "reports are fixed" from code
  alone** — both halves are required.
- The 2026-08-24 `cgpe-api` INBOX note (report path now shares the panel's 7-day cache) means a
  subject the panel already rendered returns instantly, but a truly-fresh first render still needs
  both this timeout fix AND the OPS env. That cache is not on `origin/main` yet regardless.
- Device-unverified (OTA) — walk the report row on a device once the OPS env is set.

## Next session starts here
- Phase: **Band 2 #2 — Tasks-tab local search** (P2, OTA). The Tasks tab has no search box; add an
  in-memory filter over the already-loaded list (instant, typo-forgiving) — reuse the `search.tsx`
  matcher / `lib/fuzzyMatch.ts`. Then Band 2 #3 = task-flow mitigations (hide the always-empty
  checklist card, gate "Add task" on `can_create_task`, add an Edit-task screen, fix the empty assign
  roster). Authoritative worklist: `docs/OWNER-BACKLOG-2026-08-24.md` (Point 2, then Point 5).
- First command: `/boot`
- Watch out for: the backend search is a single whole-phrase regex ("patel rajesh" ≠ "Rajesh Patel"),
  so the *true* word-order fix is the `[api]` tokenize relay (owner-relayed, same as the owed D5
  whole-book ask) — the Tasks local search only helps the already-loaded list. Don't over-promise it
  as fixing tickets/clients server search. And extracting `search.tsx`'s matcher into a shared
  `lib/searchScore.ts` must keep all existing search tests green.
