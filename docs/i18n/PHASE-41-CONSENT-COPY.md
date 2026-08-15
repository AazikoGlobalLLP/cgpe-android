# Phase 41 — consent-notice copy · English source (DRAFT for owner approval)

**Status:** DRAFT, 2026-08-14. English source only. **Not wired into `src/i18n` yet** and must not be
until a human supplies all five languages — the parity gate (`dictionaries.test.ts`) and the
machine-translation ban (PHASE-19 §4) both apply.

**Owner action (PHASE-41 §9.2):**
1. Review / edit the English wording below — you own the final text.
2. Hand it to a **human** translator for the other four languages (columns left blank on purpose).
3. Set the consent **version** id (see the note at the foot) so a materially changed notice can force
   re-consent.

⚠️ **Not legal advice.** This is plain-language product copy that reflects the design decisions in
`docs/spec/PHASE-41.md`. Whether it satisfies DPDP consent-notice requirements is the owner's / a
lawyer's call, not mine.

**Grounding:** every claim below is taken verbatim in substance from the locked spec — 24/7 incl.
off-duty + activity (§1), field-force management (§1), Master-only visibility (§1/§6, Phase 40),
90-day soft-delete / 180-day hard-delete (§6), transparent ongoing OS notification, nothing hidden
(§0.1, §2.1), mandatory — "I Agree" required to continue (§0.2/§1), no silent opt-out — withdrawal is
loud and blocks the app until restored, and the Master is told (§0.3/§5). Nothing here invents a
number, recipient, or timing that is not written down.

---

## Screen strings

Keys are proposed (flat dot-keys, the app's i18n convention). Keep sentences short and idiom-free so
they translate cleanly (same discipline as `docs/i18n/SCOPE.md`).

| Key | English source (edit freely) | ગુજરાતી | हिन्दी | Hinglish | Roman Gujarati |
|---|---|---|---|---|---|
| `consent.title` | Location sharing for work | | | | |
| `consent.intro` | Please read this before you start. CGPE Connect shares your location so the company can manage the field team. | | | | |
| `consent.collect` | **What is shared:** your precise location and your movement/activity, 24 hours a day — including outside your working hours. | | | | |
| `consent.why` | **Why:** so the company can manage and support the field team. | | | | |
| `consent.who` | **Who can see it:** only the company Master. Your colleagues cannot see your location. | | | | |
| `consent.retention` | **How long it is kept:** your location history is hidden after 90 days and permanently deleted after 180 days. | | | | |
| `consent.transparent` | **Nothing is hidden from you:** whenever location is being shared, a notice stays in your phone's status bar. You always know it is on. | | | | |
| `consent.mandatory` | This is required to use the CGPE Connect work app. If you do not agree, you cannot continue. | | | | |
| `consent.withdraw` | You can turn location off later, but the app will stop working until you turn it back on, and the Master is told when you turn it off. | | | | |
| `consent.agreeButton` | I Agree | | | | |
| `consent.declineButton` | I do not agree | | | | |
| `consent.declineTitle` | You cannot continue without agreeing | | | | |
| `consent.declineBody` | Sharing your location is required for this work app. If you have questions, please talk to your manager. | | | | |
| `consent.declineBack` | Go back | | | | |

## Ongoing foreground-service notification (24/7 recorder — PHASE-41 §2.1)

Neutral, transparent wording. Shown by the Android foreground service whenever location is being
shared. Kept separate from the shift recorder's existing "Recording your field route" text.

| Key | English source | ગુજરાતી | हिन्दी | Hinglish | Roman Gujarati |
|---|---|---|---|---|---|
| `consent.serviceTitle` | CGPE Connect | | | | |
| `consent.serviceBody` | Location on for work | | | | |

## Blocked-app screen (anti-circumvention — PHASE-41 §5) — ✅ LANDED & WIRED (41d, 2026-08-15)

**Superseded:** this section is no longer a draft. The owner supplied the five-language copy
(`translation-v.01.txt`), it is wired in `src/i18n/index.tsx` (`consent.blockedTitle` / `blockedBody`
/ `blockedAction`, all five languages), and 41d's `src/ui/LocationBlock.tsx` renders it. **The live
copy in `src/i18n` is the source of truth** — the English column below is kept for reference only; do
not treat the blank language columns here as outstanding work, and do not edit copy here (edit
`src/i18n` + `translation-v.01.txt`, or the two drift).

| Key | English source (reference — live copy is in `src/i18n`) |
|---|---|
| `consent.blockedTitle` | Turn location back on to use CGPE Connect |
| `consent.blockedBody` | Location sharing is required for this app. Please turn location and the "Allow all the time" permission back on to continue. |
| `consent.blockedAction` | Open settings |

---

## Version id (owner to set)

The consent write (`POST /time-tracker/consent`) and `me.location_consent` carry a `version` string.
The backend uses it so a **materially changed** notice can force everyone to re-consent. Pick a stable
id for THIS text and change it only when the wording materially changes — e.g. a date (`2026-08-14`)
or `v1`. Not set here because it is an owner decision, not a value written in the spec.

Once the four language columns are filled and the version is set, the next step is 41a-ii: add these
as i18n keys (bumping the `dictionaries.test.ts` parity count deliberately), build the consent screen,
and wire `setLocationConsent(true, <version>)` on Agree.
