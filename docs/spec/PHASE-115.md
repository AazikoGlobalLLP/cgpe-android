# Phase 115 — API-authored and upload failures

Authorized September 7 for the existing pending scope.

## Locked scope

- `src/lib/fileUpload.ts`
- `src/ui/DocumentSource.tsx`
- `src/lib/session.ts`
- `src/data/api.ts`
- `src/store/jobs.tsx`

Translate all visible fixed copy and complete dynamic messages in these surfaces into all five app languages. Reuse supplied translations; preserve wire values, user/server content, brand names, and existing calendar formatting. Translate module label tables at render and pass translators into plain helpers. Keep complete messages and identical named placeholders. Recompute memoized labels when language changes. Generated copy is provisional pending human naturalness review.

## Acceptance

- No applicable callsite remains deferred after manual reconciliation.
- TypeScript, dictionary/placeholder parity and touched-file lint pass.
- Browser language switching and layout checks exercise the wired screens.
- Do not infer native cold-start, production or human naturalness acceptance from source checks.

## Completion evidence — 7 September 2026

Source implementation and callsite reconciliation are complete. The shared
integration passes TypeScript and 1,494 unit tests across 92 files. Dictionary and
named-placeholder parity pass for all 2,246 keys in each language; lint has zero
errors. The final browser results are consolidated in the current handoff and
the [completion record](../i18n/COMPLETION-2026-09-07.md).

Shared dictionary, provenance, helper and producer/consumer changes cross the
original screen batches. Their integration scope and sizing exception are recorded
in that completion record. No unrelated feature or recipient-facing template was
added. Human translation review, native-device acceptance and production evidence
remain open where applicable; this is source/local verification, not full rollout.
