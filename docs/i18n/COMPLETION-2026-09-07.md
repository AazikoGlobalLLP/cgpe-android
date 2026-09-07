# Pending translation implementation — 7 September 2026

The owner authorized completion of the established pending scope, including generated
Gujarati, Hindi, Hinglish and Gujlish translations. Phases 102–119 implement that scope.
Existing supplied translations retain precedence. Generated copy is implemented and
remains provisional for human naturalness review; automated checks cannot grant that acceptance.

## Delivered coverage

| Phase | Surfaces |
|---|---|
| 102 | Home, role dashboards, More and profile |
| 103 | Task list, creation, editing and detail |
| 104 | Clients, leads, claims and search |
| 105 | Settings, notifications, reminders and calendar |
| 106 | Client, lead and claim forms/details |
| 107 | Tickets, notes and WhatsApp list |
| 108 | WhatsApp thread, attendance, earnings and commissions |
| 109 | Analytics, payroll, payroll detail and performance |
| 110 | Team list/detail, monitor and agent map |
| 111 | Agent tracking, campaigns, notice board and notification composition |
| 112 | Families, LIC plans, prospects and segments |
| 113 | Contests, job detail, knowledge base and shared map text |
| 114 | Login, authentication notices and biometric prompts |
| 115 | API-authored failures, upload failures and their UI consumers |
| 116 | Calendar synchronization, tracker notifications and native permission copy |
| 117 | Root crash boundary and provider-independent recovery copy |
| 118 | Locally generated model defaults, projections and job progress/logs |
| 119 | Relative times, roles, app-layout defaults, voice state and persistent notices |

The merged dictionaries contain **2,246 keys in each of five languages**. The approved
new copy lives in `src/i18n/generated/phase102.ts` through `phase119.ts`. The original
dictionary stays in `src/i18n/index.tsx`. Eighteen unused proposed keys were removed;
historical keys were preserved. The earlier account/privacy and voice/update changes
are recorded in Phase 100.

## Rules for future edits

- Translate complete messages with named parameters. Preserve the same parameter names
  in all languages and keep numeric/currency formatting in the existing helpers.
- Keep canonical enums, IDs, routes, request bodies, storage keys, recipient-facing
  WhatsApp templates, report contents and backend/user-authored prose unchanged.
  Calendar dates, month names, weekdays and clock formatting retain the existing
  English-format decision; relative descriptions use the chosen language.
- For an app-authored fallback in a data model, keep the existing raw value and attach
  optional serializable `LocalCopy` metadata only at the branch that creates it.
  Render with `resolveCopy`. Do not infer provenance by comparing English strings:
  a customer's actual name `Customer` must remain that name in every language.
- Preserve metadata through local projections, cached records and pickers. Explicit
  API body allowlists omit presentation metadata. The lead offline replay payload
  remains unchanged because it is sent verbatim. Adapters do not accept server-supplied
  copy metadata as local authority.
- Store `CopyText` for persistent local notices and job messages; resolve it at render.
  Native/server diagnostic text stays raw. A language switch must not replay a write,
  restart a job, reset a form, reacquire a push token or restart a recorder.
- Default More headings carry local keys. Server-provided headings remain authored
  text, including text equal to an English default. Navigation rows allow wrapping.
- Pure helpers take an explicit translator or resolved copy. The crash boundary reads
  an immutable, dependency-free language snapshot, so it works without its provider.

## Ownership and native reconciliation

Jobs are owned by the signed-in account. Switching accounts unmounts the outgoing
runner, cancels its timers, clears its visible jobs and ignores delayed results before
another dispatch. Changing only language rerenders the same job and its existing logs.

Calendar work is serialized and coalesces the latest language for the same owner.
Changing owner invalidates the old generation; returned native IDs are journaled and
old events are cleaned before the next owner can create events. A failed cleanup stays
in the journal for retry. Title and notes participate in updates without changing IDs.
Storage readback detects swallowed writes. Native/storage operations cannot form one
crash-atomic transaction; this is not proof against every process-kill timing window.

Tracker copy snapshots are tied to the owner and distinguish ambient/shift mode. Late
permission responses cannot overwrite a newer language or relabel one owner's text
as another's. Starting a recorder reads the latest appropriate snapshot. Updating the
snapshot does not stop/start an active recorder or request permission. **Text already
shown by the OS may remain until a natural recorder restart.** Device verification is
still required. Push channel names are updated through a separate serialized path;
the channel ID and token registration flow remain unchanged.

## Final local results

TypeScript and web export pass. The full suite passes **1,494 tests in 92 files**;
lint has **zero errors and 12 existing warnings**. The final combined browser run
passes **17 tests**, including **48 routes × 5 languages = 240 renders** with zero
raw keys, caught crashes or outage banners. Two additional injected-outage checks
(500 and timeout) pass. Native and human acceptance below remain open.

QA also corrected a roster fetch before session restore and rejected malformed
family statistics before formatting. The healthy harness now uses contract-valid
family, segment, payroll, commission and task responses. Its crash/outage detector
recognizes all languages; it does not treat a translated error screen as a success.

## Verification and evidence limits

The final verification totals and browser results are recorded in the current
`docs/HANDOFF.md` entry. Durable regression coverage includes:

- Dictionary key/value and placeholder parity, encoding-loss checks and nested copy
  resolution with language changes.
- Adapter fallback provenance, raw server text, projection forwarding, serialization
  and API-authored versus server-authored failure messages.
- Four calendar concurrency/journal scenarios and five full-module tracker scenarios
  with only native/storage/API boundaries mocked.
- Five-language populated-record browser checks distinguishing missing local defaults
  from raw server names; route screenshots and key-leak checks in all five languages.
- Active-job language changes and account switching with delayed synthetic responses.
- The account-request browser regression checks from Phase 100.

All browser API traffic uses the synthetic interception harness. Local tests/export
do not verify native process-death persistence, physical permission/biometric dialogs,
OS notification text, actual calendar writes, production configuration or rollout.
Screenshot artifacts remain in the ignored `e2e/artifacts/screens/` directory.

## Integration sizing

The original screen batches remain the scope boundaries. Shared dictionaries,
provenance types and producer/consumer seams cross those batches; their coherent
foundation/data commits exceed the usual eight-file guideline. Keeping five-language
parity and coupled type/consumer changes together is the reason for that exception.
Source changes and final review were performed by the main agent. Delegated work was
bounded scratch proposals and read-only audits. No sibling repository was modified.

## Remaining acceptance

Review the generated Hinglish/Gujlish phrasing and representative longer-script
screenshots with a fluent human. Verify owner switching, cold starts, biometric and
permission prompts, calendar events and background tracking on an actual handset.
The `.easignore` correction changes the runtime fingerprint, so prepare a compatible
new Android build before an OTA rollout. Server deployment/configuration, deletion
review/fulfillment policy, store access and fleet acceptance remain external gates.
