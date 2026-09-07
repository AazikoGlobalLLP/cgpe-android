# Phase 100 — Account deletion requests and status

Status: implemented and locally verified, 2026-09-07; production and native-device verification remain open. The owner asked to complete all established pending work. This adopts the September 7 backend contract; backend Phase 24 is not the mobile phase number. Mobile Phase 99 remains the owner-held fleet rollout.

## Locked behavior

| Decision | Value and reason |
|---|---|
| Submission | POST `/auth/me/deletion-request` with an empty JSON object. The optional reason field is omitted in this small adoption; no subject, review status, or policy is supplied by the client. |
| Confirmation | One explicit confirmation explains that this submits a request for review, does not erase/deactivate the account, and keeps the person signed in. The old double confirmation promised irreversible erasure that this service cannot perform. |
| Accepted response | Require HTTP 202, `success:true`, a nonempty `request_id`, and `pending`, `under_review`, or `rejected`. A replay returns the existing status; rejected requests cannot be resubmitted. |
| Status | GET the same self-only route on opening the screen and via a refresh control. Display pending / under review / rejected and any reviewer notes. GET 404 means no request returned; do not infer whether an older deployment has the route. |
| Failure | A malformed/unknown success response is unconfirmed. POST 404/405/501 reports unavailable on this server; network/5xx says submission could not be confirmed and offers a status refresh. A failed GET never displays an authoritative empty state. 401 retains the existing global session-expiry behavior; 403 does not log out. |
| Session safety | Submission never calls the old deletion cleanup, clears credentials/biometrics/drafts, or navigates to login. Remove the unused destructive account-deletion API/context method. Guard duplicate submission across the confirm and network awaits. |
| Identity/lifecycle | Render the signed-in account content keyed by real user id, discard late async results after unmount/account change, and keep status reads from overwriting a newer submission. Do not persist request/reviewer data on disk. |
| UI | Reuse existing Card, Banner, Button, Skeleton, theme spacing/type, and confirm components. Screen copy describes request/review only. No erasure deadline, completed state, legal fulfillment guarantee, or admin review UI. |
| Languages | Account/privacy copy is wired in all five languages under the owner's 2026-09-07 pending-scope approval: 32 new keys and two existing supplied keys reused. Five voice/update fallback keys are translated under the same approval. Existing supplied copy remains unchanged. |

## Acceptance

- [x] Fresh account with no request can confirm one POST and sees its returned status.
- [x] Pending, under-review, and rejected responses remain request statuses, never deletion completion.
- [x] Refresh displays status/reviewer notes; failure/malformed/undeployed responses are honest and recoverable.
- [x] Ref guards and keyed lifecycle prevent duplicate submission and stale status; delayed responses are covered by identity tests. A delayed old 401 cannot expire a newly signed-in user.
- [x] Submission/replay has no credential, biometric or draft cleanup. Browser submission/refresh/reload preserves the session; native storage behavior remains a handset check.
- [x] 32 wire-contract tests cover accepted/replayed/malformed/permission/network/unsupported paths with synthetic responses.
- [x] Four browser scenarios pass against mocked APIs, with splash-settled screenshots; the under-review layout was visually inspected at 402 px.
- [x] TypeScript passes, full unit suite passes (1,422 before the additional dictionary-placeholder guard; that guard separately passes), touched-file lint has zero errors. Four warnings include pre-existing API/i18n warnings and the intentional mutable read-generation ref.
- [ ] Production endpoint deployment and real-handset acceptance. These cannot be inferred from the local checks.

## Sources and limits

`../contracts/api.md`, `models.md`, `enums.md`, `CHANGELOG.md` — September 7 account-deletion request sections; the full September 7 INBOX thread; `../cgpe-backend-main/services/accountDeletion.js` and registered auth routes.

Actual deletion/retention policy and fulfillment remain owner/server work. Deployment is separate from source implementation. No production writes are used for verification.

## Final integration recheck — 7 September 2026

All four account browser scenarios pass again after the shared-copy integration.
Final TypeScript passes; the full suite passes 1,494 tests across 92 files; lint has
zero errors and 12 existing warnings. Production/policy/handset gates remain open.
