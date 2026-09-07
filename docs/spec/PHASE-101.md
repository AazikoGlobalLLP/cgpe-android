# Phase 101 — Exclude staff exports from build uploads

Authorized by the owner's September 7 instruction to complete pending work.

## Locked scope

Add the existing Git exclusions for `cgpe-connect.staff_unified.json` and
`*.staff_unified.json` to `.easignore`. The latter takes precedence for EAS archive
selection, so Git exclusions alone leave staff exports eligible for upload.
Do not read export contents, generate an archive, or upload anything to verify this.

## Acceptance

- The installed EAS archive selector excludes named and nested staff exports.
- Existing credential exclusions remain effective.
- App configuration and all tracked build source/assets remain eligible.
- Record the runtime implication: `.easignore` participates in the Android
  fingerprint. A subsequent release needs a compatible new build before its OTA
  update can reach phones; build 6 compatibility cannot be assumed.

Device behavior is unchanged by the exclusion itself. This phase does not authorize
production deployment, staff-data migration, or an unverified release claim.

## Verification — September 7

The installed EAS CLI 23.2.0 `Ignore.createForCopyingAsync` was exercised against
the actual modified `.easignore`: all eight exclusion cases passed; five essential
configuration files and all 290 tracked non-Markdown source/asset files remained
eligible. No archive was created, no export contents were read and nothing was
uploaded. This source-side phase is complete; release compatibility remains a
separate new-build gate.
