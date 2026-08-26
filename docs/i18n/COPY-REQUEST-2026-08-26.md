# Translation copy request — 2026-08-26

Everything in the app that still needs **human** Hindi / Hinglish / Gujarati / Roman-Gujarati copy,
in one place, ordered so the earliest batches remove the most visible English for the least work.

**Machine translation is forbidden here** (`PHASE-19` §4), so nothing below gets wired until a human
supplies it. The `storage.*` keys supplied on 2026-08-26 are **done** and are not repeated.

**Two facts to know before reading the counts:**
- The dictionary parity test can only prove a key *exists* in all five languages. It **cannot** see a
  value left as the English string, which is exactly how the gaps in Batch 1 survived.
- Counts below were produced by scripted extraction and hand-checked on the daily-driver screens;
  treat them as ±10%. The per-string lists are exact.

---

## Batch 1 — already wired, but wrong or missing (14 strings) ⭐ START HERE

The cheapest batch in the project: these keys already exist and already ship, so this is pure
correction of things a user can see being wrong today. **All four claims below were verified in the
real dictionary, not taken from the docs.**

### 1a. `tab.search` is untranslated in Gujarati and Hindi script
It is a **permanent bottom-tab label**, so it is on screen every second the app is open. Currently
`'Search'` in all five. The romanized pair (hi-en / gu-en) can stay English — that is the sanctioned
trade-vocab fallback and it is how people type it. The two script languages should not.
Note the app already has `common.search` = `શોધો` / `खोजें`, so a word exists.

| key | English | Gujarati (gu) | Hindi (hi) |
|---|---|---|---|
| `tab.search` | Search | ⬜ | ⬜ |

### 1b. Consent buttons are English in Hinglish only
Roman Gujarati already has `Hu Sehmat Chhu` / `Hu Sehmat Nathi`; Hinglish was left as English. This is
the **mandatory first-run screen** — the first thing a new joiner ever reads.

| key | English | Hinglish (hi-en) |
|---|---|---|
| `consent.agreeButton` | I Agree | ⬜ |
| `consent.declineButton` | I do not agree | ⬜ |

### 1c. "Tomorrow" and "Yesterday" are THE SAME WORD in Hindi and Hinglish
Both render `कल` / `Kal`, so on the Tasks screen an **overdue** group header and an **upcoming** group
header read identically. Gujarati and Roman Gujarati are already correct
(`આવતીકાલે`/`ગઈકાલે`, `Aavtikale`/`Gaikale`). Hindi genuinely uses one word for both, so this needs a
deliberate disambiguation — whatever your team would actually say out loud.

| key | English | Hindi (hi) | Hinglish (hi-en) |
|---|---|---|---|
| `tasks.tomorrow` | Tomorrow | ⬜ | ⬜ |
| `tasks.yesterday` | Yesterday | ⬜ | ⬜ |

### 1d. The Tasks empty-state still says "strip" — a control that no longer exists
The day-rail was replaced by a month calendar grid. The English was corrected to "calendar above";
the four translations still say **સ્ટ્રિપ / स्ट्रिप / strip**, pointing at nothing.

| key | English (already corrected) |
|---|---|
| `tasks.emptyCalendarBody` | No task is due on the selected day. Pick another day from the **calendar above**. |

| gu | hi | hi-en | gu-en |
|---|---|---|---|
| ⬜ | ⬜ | ⬜ | ⬜ |

### 1e. "Clocked in" never shows your translation
The Home hero builds this line in English regardless of language, and only falls back to the
translated `home.clockedIn` when the time is unreadable. It needs a version with the time in it.
**This one also needs you to approve the English.**

| key | proposed English | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|
| `home.clockedIn` *(new `{time}` form)* | Clocked in {time} ⬜ approve | ⬜ | ⬜ | ⬜ | ⬜ |

*(`{time}` is replaced by e.g. `9:04 AM`. Keep the braces exactly.)*

---

## Batch 2 — the shared-word layer (19 strings) ⭐ BIGGEST WIN PER WORD

These 19 strings are each hardcoded in English in **many** places. Translating them once retires
roughly **170 English strings** across the app. Verified counts, not estimates:
`Try again` appears **55 times across 37 files**; `Clear search` 15×; the "server did not answer"
sentence has **60 occurrences in 39 slightly different wordings**, which will collapse into one.

| # | English | where it shows | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 1 | Try again | every failed screen (55×) | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 | Clear search | every search box (15×) | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | Refresh | pull-to-refresh prompts (6×) | ⬜ | ⬜ | ⬜ | ⬜ |
| 4 | The server could not be reached. Check your connection and try again. | **one canonical replacement for all 39 variants** | ⬜ | ⬜ | ⬜ | ⬜ |
| 5 | Load more | long lists | ⬜ | ⬜ | ⬜ | ⬜ |
| 6 | All | every filter row | ⬜ | ⬜ | ⬜ | ⬜ |
| 7 | Done | task actions | ⬜ | ⬜ | ⬜ | ⬜ |
| 8 | Clear | filter sheets | ⬜ | ⬜ | ⬜ | ⬜ |
| 9 | Continue | flows | ⬜ | ⬜ | ⬜ | ⬜ |
| 10 | Show results | filter sheets | ⬜ | ⬜ | ⬜ | ⬜ |
| 11 | Saving… | every form | ⬜ | ⬜ | ⬜ | ⬜ |
| 12 | Uploading… | document attach | ⬜ | ⬜ | ⬜ | ⬜ |
| 13 | Mobile | contact rows | ⬜ | ⬜ | ⬜ | ⬜ |
| 14 | On duty | Home hero | ⬜ | ⬜ | ⬜ | ⬜ |
| 15 | Off duty | Home hero | ⬜ | ⬜ | ⬜ | ⬜ |
| 16 | Go to sign in | session expiry | ⬜ | ⬜ | ⬜ | ⬜ |
| 17 | Call {name} | screen-reader label (7×) | ⬜ | ⬜ | ⬜ | ⬜ |
| 18 | Open WhatsApp chat with {name} | screen-reader label (5×) | ⬜ | ⬜ | ⬜ | ⬜ |
| 19 | Close | screen-reader label, every sheet | ⬜ | ⬜ | ⬜ | ⬜ |

*(`Cancel`, `Delete`, `Call`, `WhatsApp`, `Today`, `Sign in`, `Sign out` already exist — not repeated.)*

---

## Batch 3 — the shared components (38 strings)

These live in components that render on **many screens at once**, so they are the next best value.
The whole-app red/amber connection banner alone is 8 of them.

**Connection banner (shows over any screen when the server is unreachable)** — 8
`The server is responding slowly` · `Can't reach the network` · `The server had a problem` ·
`Some data could not load` · `One request could not be completed. Some values may be missing or out of
date.` · `{n} requests could not be completed. Some values may be missing or out of date.` ·
`{n} request(s) could not be completed. Blank values are unconfirmed.` · `Dismiss`

**Confirm dialogs (every destructive action)** — 1 (`Confirm`; `Cancel` already exists)

**App lock (every time the app is re-opened with biometrics on)** — 4
`App locked` · `Unlock CGPE Connect with your fingerprint, Face ID, or device passcode.` ·
`Verifying…` · `Unlock`

**Offline / sync (Phase 57)** — 6
`Pending sync` · `Synced {time} · may be out of date` · `Saved on this device — it'll sync when you're
back online.` · `{name} saved on this device — it will sync when you're back online` ·
`One offline change could not be saved and was removed.` · `{n} offline changes could not be saved and
were removed.`

**Attach a document sheet** — 5
`Attach a document` · `Take a new photo, or pick something already on your phone` · `Take a photo` ·
`Choose from gallery` · `Choose a file`

**Filter sheets / controls / map** — 14
`Filters` · `{n} filter(s) applied` · `Showing everything` · `Reset` · `Add` · `Increase` · `Decrease` ·
`Hide password` · `Show password` · `Go back` · `Copy {label}` · `Loading map` · `{n} points here` ·
`and {n} more`

*(`Imagery © Esri` stays English — a legal attribution. The splash tagline
"Khushiyo Ka Financial Planner" is a brand line and I suggest it stays as-is; tell me if not.)*

---

## Batch 4 — status words (24 strings)

One-to-three-word labels that appear on Home, Leads, Claims, Tasks **and** Search at the same time.
Until these land, those screens cannot look translated no matter what else is done.

- **Lead stages (5):** New · Meeting · Docs shared · Policy issued · Lost
- **Claim statuses (6):** Intake · Docs pending · Under review · Submitted · Settled · Rejected
- **Client segments (5):** Renewal due · Maturity soon · Birthday · Cross-sell · Hot
- **Task statuses (4):** To do · In progress · Blocked · Done
- **Task priorities (3):** High · Medium · Low
- **Task type (1):** Follow-up

---

## Batch 5 — the sign-in screen (~44 strings)

The first screen anyone ever sees, and it is currently **0% translated**. Self-contained, so it can be
done as one clean unit. Includes the mode tabs (Password / OTP), the field labels and placeholders, the
biometric-unlock prompt, the OTP flow, and the eight distinct error and session-expiry messages.

---

## Batch 6 onwards — the screens themselves

After Batches 2–4 absorb the shared words, roughly this much English remains. Ordered by how often a
field advisor sees it.

| batch | screens | approx. strings left |
|---|---|---|
| 6a | Home — hero, day strip, clock in/out flow (seen every single day) | ~55 |
| 6b | Home — widget empty and error states | ~130 |
| 7 | Tasks · Claims · Search · More · Settings (**Claims and Search are 0% translated today**) | ~250 |
| 8 | Client / Lead / Task / Claim / Ticket detail screens, notes, WhatsApp, calendar | ~613 |
| 9 | Segments, prospects, payroll, performance, analytics, team, KB and other occasional screens | ~869 |

**Whole-app total still in English: roughly 1,800–2,400 strings.** Batches 1–4 are **95 strings** and
remove far more visible English than their size suggests.

---

## Also owed (not translation)

- **`storage.description` lost a sentence.** The Storage footer now uses the supplied short
  description, so it no longer says that clearing does **not** shrink the app's own install size. Users
  who clear and then see 125 MB instead of 63 MB will think it is broken. Suggested addition, needing
  your approval and four translations:
  *"The app's own install size does not change — your phone's Settings › Apps › CGPE Connect › Storage
  shows the real figures."*
- **`nothing_to_clear_*` was supplied but not wired**, because no code path produces it: an absent
  cache folder counts as a successful clear, so an all-failed result must report a failure rather than
  reassure the user that the phone was already clean. Nothing owed unless you disagree.
- **Month and weekday names** on the Tasks calendar (`January`… , `Sun`…) are currently English by an
  earlier decision. Say the word if you want them translated — that is 19 more strings.
