# HANDOFF — CGPE Connect (Android) — Owner backlog E2 (Generate report) — 2026-08-24

Owner picked **E2** ("Generate report — no report generates anywhere"). Verified first against the
**real** backend (`cgpe-backend-main/routes/clients.js:310`, `routes/reports.js`, `services/pdfReport.js`):
the mobile report feature was **already complete and honest** — the real blocker is a **server OPS gap**
(the n8n render webhook is unset on prod), not app code. The one genuine mobile win — naming that cause
on-device — shipped. Gates green (`tsc` 0 · `npm test` **806** · eslint 0 new), committed, pushed
`aaziko/Shivam` (`d9656bf`). JS-only / OTA-eligible; **device-unverified**.

## Done
- The client report screen now **names why a report failed** instead of one vague sentence. A server with
  reports switched off (503 `not_configured`) shows "Report generation is not set up on the server yet —
  ask your admin to enable it, then try again"; a bad name/seed shows "No report could be built…"; a real
  outage keeps the transient message. Success is unchanged (opens `viewUrl`/`pdfUrl`).
- A config-gap / no-data answer no longer raises the global health banner (nothing is "down"); a 5xx /
  dead network still does.
- New wire-contract test `api-report.test.ts` (9 tests) pins the handler's statuses.

## Files changed
- `src/data/api.ts` — `generateReport` rewritten: reads the server's own status and returns a
  discriminated `GenerateReportResult` (`ReportDoc` | reason `not_configured` | `no_data` | `unavailable`)
  instead of collapsing every non-2xx to `null`. New exported types `ReportDoc` / `ReportFailure`.
- `src/app/client/[id].tsx` — `doReport` branches the failure message on the reason; `ReportPayload.familyHead`
  widened to `string | null`; `subtitle` coerces `null → undefined`.
- `src/data/__tests__/api-report.test.ts` — NEW. Asserts 200 / 503-not_configured / 502 / 422 / 400 and
  that not_configured/no_data are NOT outages.

## Decisions made
- **App is already right; E2 is OPS.** The success path (opens the rendered report URL) and the honest
  null-on-failure were already built. The only buildable mobile improvement was distinguishing the (very
  likely) permanent config gap from a transient outage, so the owner's own on-device test names the fix.
- **`not_configured` is a considered answer, not an outage** — like a 404/501. It stays quiet (no banner),
  because retrying can never help and nothing is actually down. Only 5xx / network faults raise the banner.
- **INBOX left untouched.** No contract changed; the OPS unblock was handed to the owner in plain language
  (the proven relay path), consistent with the prior batches' concurrent-write-corruption rationale.

## Known broken / deliberately skipped
- **Reports still do not generate on prod** — because the droplet env is unset. NOT an app bug and NOT
  fixable from here (no droplet access; backend `git push` is 403). Owner/OPS must: set
  `CGPE_REPORT_WEBHOOK_URL` (or `N8N_REPORT_WEBHOOK_URL`) + `CGPE_REPORT_SECRET`, wire the n8n
  `cgpe-report-render` template, restart `:3001`. Then the existing app works with zero further change.
- **New English strings owe 5-language copy** — the screen is already all-English, so this is consistent,
  not a regression; wire gu/hi/hi-en/gu-en when the owner supplies copy.
- **Device-unverified** — OTA-eligible (JS-only); no new APK cut. Accumulated OTA work (B5 + D3/B1/D4/C2/D6
  + Phases 77/78 + this) still needs one APK to reach a phone.

## Next session starts here
- Next backlog cluster (owner's pick): **A3** (attendance) · **D5** (fuzzy search) — or **cut one APK** to
  land all accumulated OTA work on a device for a real test.
- First command: `/boot`
- Watch out for: **E2's fix is server-side.** Do not "fix reports" in the app again — verify the droplet
  env + n8n template are set (a live `/clients/generate-report` should stop returning 503) before touching
  any mobile report code.
