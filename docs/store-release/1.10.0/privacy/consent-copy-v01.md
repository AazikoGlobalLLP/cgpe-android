# Consent notice — v.01 (verbatim)

The 24/7 location consent notice shown at `src/app/consent.tsx`. Version constant `CONSENT_NOTICE_VERSION = 'v.01'`
(stamped on the server write). Owner-supplied human copy in all five languages (en/gu/hi/hi-en/gu-en);
machine translation is forbidden. English text below (`src/i18n/index.tsx`).

## The notice (English)

- **What is shared:** "your precise location and your movement/activity, 24 hours a day — including outside your
  working hours." (`consent.collect`)
- **Why:** "so the company can manage and support the field team." (`consent.why`)
- **Who can see it:** "only the company Master. Your colleagues cannot see your location." (`consent.who`)
- **How long it is kept:** "your location history is hidden after 90 days and permanently deleted after 180 days."
  (`consent.retention`)
- **Transparency:** "whenever location is being shared, a notice stays in your phone's status bar. You always know
  it is on." (`consent.transparent`)
- **Mandatory:** "This is required to use the CGPE Connect work app. If you do not agree, you cannot continue."
  (`consent.mandatory`)
- **Withdrawal:** "You can turn location off later, but the app will stop working until you turn it back on, and
  the Master is told when you turn it off." (`consent.withdraw`)

There is deliberately **no back and no skip**: declining shows an honest "you cannot continue" state, not a way
around the gate.

## How consent is recorded (verified)

- On Agree → `setLocationConsent(true, 'v.01')` → `POST /api/time-tracker/consent` (backend Phase 43).
- The screen **only** proceeds and arms the 24/7 recorder on a real `200` — a failed call never fabricates a local
  "consented" state ("Not recorded — never pretend it was.").
- Ambient recording cannot arm without **both** recorded server consent **and** background location permission.
- The record is keyed to the authenticated user (server-derived), stamped `decided_at` server-side, and carries
  the notice `version`.
- Withdrawal: turning off background permission is detected on next foreground → `setLocationConsent(false)` →
  the server notifies **every** Master (a loud, auditable opt-out) → the recorder stops.

## Known gaps (for the errata / backlog)

- The **language variant** the user actually read is not recorded (only the copy-version `v.01`). Recording it
  needs a backend-defined field on `POST /time-tracker/consent` — file as a contract item; do not invent a field.
- The withdrawal POST omits the notice `version`.
- **Re-consent trigger:** bump `CONSENT_NOTICE_VERSION` whenever the notice text materially changes, so the boot
  gate can force re-consent.
