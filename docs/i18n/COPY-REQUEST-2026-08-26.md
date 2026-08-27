# Translation copy request — 2026-08-26

> ## ✅ STATUS 2026-08-26 (later) — BATCHES 1–4 SUPPLIED BY THE OWNER AND FULLY WIRED
>
> The owner supplied Batches 1, 2, 3 and 4 in one batch and they are **in the app**
> (`3d6b7f7` + `626aad5`). The dictionary went **143 → 226 keys**. What that means:
>
> - **Batch 1 — done.** All four already-wired-but-wrong keys are corrected, plus the new
>   `home.clockedInAt`. Zero "strip" references remain; `tab.search` is `શોધો` / `खोजें`;
>   tomorrow/yesterday no longer collide in Hindi or Hinglish.
> - **Batch 3 — done and wired.** Every shared component (connection banner, Confirm, app lock,
>   offline/sync, attach-document, filters, controls, map) now reads its copy through `t()`.
> - **Batch 4 — done and wired.** All 24 status words render translated on Home, Leads, Claims,
>   Tasks and Search.
> - **Batch 2 — DONE TOO, as of 2026-08-26 (`48b3509`).** *(This line used to say the call sites
>   were still to do; that was true when it was written and is not any more.)* The sweep replaced
>   **118** hardcoded English strings across **43** files. `common.tryAgain` alone now has 55 call
>   sites in 37 files. **One part was deliberately NOT swept** — `common.offlineBody`. The request
>   described it as one canonical replacement for all 39 outage sentences, but no site matches it
>   word for word and each of the 39 names *what* failed ("an empty inbox here is not confirmed").
>   Collapsing them would throw that away, so they need per-screen copy in a later batch.
> - **`storage.installNote`** is wired, restoring the install-size caveat.
> - **`nothing_to_clear_*` was deliberately not wired** — no code path produces that state.
>
> ## 📋 STATUS 2026-08-27 — BATCH 5 IS NOW EXTRACTED AND READY FOR YOU
>
> **Batch 5 (the sign-in screen) below is filled in with the real English strings**, taken from the
> source character for character on 2026-08-27, so it can be translated without anyone guessing at
> what the app actually says. It is **49 strings**. *(First published as 47 and corrected the same
> day: a review found one banner message missing from the extraction, and a second string was added
> when the OTP error was fixed to name the right channel. If you already started on the 47, only two
> rows are new — `login.errOtpRequiredEmail` and `login.msgCodeSendFailed`.)* A new
> **Batch 5b** (4 strings) covers the crash screen added the same day.
>
> Batches 6–9 (the screens themselves) still have only counts, not strings; they get the same
> verbatim treatment before they are asked for.

Everything in the app that still needs **human** Hindi / Hinglish / Gujarati / Roman-Gujarati copy,
in one place, ordered so the earliest batches remove the most visible English for the least work.

**Machine translation is forbidden here** (`PHASE-19` §4), so nothing below gets wired until a human
supplies it. The `storage.*` keys supplied on 2026-08-26 are **done** and are not repeated.

**Two facts to know before reading the counts:**
- The dictionary parity test can only prove a key *exists* in all five languages. It **cannot** see a
  value left as the English string, which is exactly how the gaps in Batch 1 survived.
- Counts below were produced by scripted extraction and hand-checked on the daily-driver screens;
  treat them as ±10%. The per-string lists are quoted from the source rather than estimated — but
  "quoted exactly" is not the same as "complete": the first Batch 5 extraction missed a banner
  message and had to be corrected the same day. If you spot English in the app that is not in a
  table here, that is worth telling us, not a mistake on your part.

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

## Batch 5 — the sign-in screen (49 strings) ⭐ READY TO FILL IN

The first screen anyone ever sees, and it is **0% translated** apart from two shared words. It is
self-contained, so it can be done as one clean unit.

**The strings below were extracted verbatim from the source on 2026-08-27** (and corrected the same
day — an adversarial review found one missing and two changed; the count is **49**, not the 47 first
published) — character for
character, including the full stops and the spacing. Copy the English cell as it stands; if a cell
looks odd (two spaces, three dots) that is what is really on screen, and the translation should
follow the same shape.

**Three things to know before you start.**

1. **Trade vocabulary stays English inside your sentence** — this is the project's existing rule
   (`src/i18n/index.tsx:20-24`), already used in the shipped copy. On this screen that means
   **OTP**, **WhatsApp**, **Face ID**, **CGPE** and **CGPE Connect** are left as they are; translate
   around them.
2. **Nothing here needs a `{placeholder}`.** Unusually for a screen this size, there is not one
   composed string — every message is a whole sentence chosen by the code, never glued together. So
   you never have to worry about word order around a value. Please do not introduce one.
3. **Two strings are already done and are NOT in the tables.** The plain `Sign in` button now uses
   the existing `common.signIn`, and the banner's close button uses `common.dismiss`. The app-lock
   overlay (`lock.*`) and the consent screen are already fully translated too.

### 5a. Buttons, labels and headings (13)

| key | English | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|
| `login.modePassword` | Password | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.modeOtp` | OTP | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.eyebrow` | Secure sign in | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.welcome` | Welcome back | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.unlockWithFingerprint` | Unlock with fingerprint | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.orSignIn` | or sign in | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.identifierLabel` | Email or mobile number | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.passwordLabel` | Password | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.unlockAndSignIn` | Unlock and sign in | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.otpLabel` | Enter code | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.verifyAndSignIn` | Verify and sign in | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.resendCode` | Send a new code | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.sendCode` | Send code | ⬜ | ⬜ | ⬜ | ⬜ |

*(`login.modePassword` and `login.passwordLabel` are the same English word in two places — the mode
tab and the field label. They are separate keys on purpose, because a language may want a different
word for a tab than for a field label. Put the same word in both if that reads best.)*

### 5b. Placeholder and hint text (5)

| key | English | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|
| `login.identifierPlaceholder` | you@cgpe.in or 98250 ... | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.identifierPlaceholderOtp` | you@cgpe.in  or  98250 00000 | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.passwordPlaceholder` | Your CGPE password | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.otpPlaceholder` | 6 digit code | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.otpChannelHint` | Email gets the code by mail. A mobile number gets it on WhatsApp. | ⬜ | ⬜ | ⬜ | ⬜ |

*(The two identifier placeholders really are different strings: the password one ends in three dots,
the OTP one has double spaces around "or" and shows a full example number. The email address and the
number are examples — leave them as they are.)*

### 5c. Errors shown under a field (6)

These appear in red directly beneath the box the person is typing in, so they should be short.

| key | English | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|
| `login.errIdentifierRequired` | Enter your email or mobile number. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.errPasswordRequired` | Enter your password. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.errIdentifierShape` | Enter your work email, or a 10 digit mobile number. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.errEmailShape` | That email address does not look right. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.errOtpRequired` | Enter the code from your WhatsApp message. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.errOtpRequiredEmail` | Enter the code from your email. | ⬜ | ⬜ | ⬜ | ⬜ |

*(These two are the SAME message for two different people: the code goes to WhatsApp or to email
depending on what the person typed to sign in, and the app now says the right one. Added
2026-08-27 — previously everyone was told to check WhatsApp.)*

### 5d. Banner headings (8)

The bold line at the top of the coloured box. Each is a whole heading chosen by the code — they are
never combined.

| key | English | when it shows | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| `login.bannerTimeout` | The server is taking too long | the request gave up waiting | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.bannerPasswordNotSent` | Your details were not sent | password mode, never reached the server | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.bannerCodeNotChecked` | Your code was not checked | code entered, never reached the server | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.bannerCodeRequestNotSent` | The code request was not sent | asking for a code, never reached the server | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.bannerSignInRefused` | Sign in refused | the server said no | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.bannerCodeNotAccepted` | Code not accepted | wrong or expired code | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.bannerCodeNotSent` | Code not sent | the server declined to send one | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.bannerSessionEnded` | Your session ended | shown after an automatic sign-out | ⬜ | ⬜ | ⬜ | ⬜ |

### 5e. Banner message bodies (7)

The smaller line under the heading.

| key | English | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|
| `login.msgUnlockNotConfirmed` | Unlock was not confirmed on this device. Try again. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.msgCodeNotAccepted` | That code was not accepted. It may have expired, so request a new one. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.msgQuickUnlockGone` | Quick unlock is no longer available. Please sign in with your password or OTP. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.msgUnlockFailed` | Could not unlock right now. Check your connection and try again. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.msgDetailsRefused` | Those details were not accepted. Check them and try again. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.msgCodeCheckFailed` | That code could not be checked. Please try again. | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.msgCodeSendFailed` | Could not send the code. Please try again. | ⬜ | ⬜ | ⬜ | ⬜ |

*(The last two are safety nets — the server almost always sends its own wording instead, so they are
rarely seen. Please still translate them; "rarely" is not "never".)*

### 5f. The footer line (1)

| key | English | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|
| `login.footerHint` | Sign in with your CGPE account. Next time you can unlock with fingerprint or Face ID. | ⬜ | ⬜ | ⬜ | ⬜ |

### 5g. Strings that reach this screen from elsewhere (9)

These render **on** the sign-in surface but are written in files that are not React screens, so they
need a small code change as well as copy. That work is ours, not yours — please just supply the copy.

| key | English | where it shows | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| `login.restoringSession` | Restoring your session | full-screen loader before the login screen appears | ⬜ | ⬜ | ⬜ | ⬜ |
| `session.expired` | Your session timed out. Please sign in again. | banner after an automatic sign-out | ⬜ | ⬜ | ⬜ | ⬜ |
| `session.revoked` | You were signed out because your access changed. Please sign in again. | banner after an admin changes your access | ⬜ | ⬜ | ⬜ | ⬜ |
| `session.forbidden` | Your permissions changed. Please sign in again. | banner after a role change | ⬜ | ⬜ | ⬜ | ⬜ |
| `net.timeout` | The CGPE server is taking too long to respond. It may be busy, or the connection is slow — please try again. | banner body when a request times out | ⬜ | ⬜ | ⬜ | ⬜ |
| `net.unreachable` | Could not reach the CGPE server. Check your connection and try again. | banner body when nothing left the phone | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.invalidCredentials` | Invalid credentials. Please check and try again. | last-resort banner body when the server sends no reason | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.codeSentWhatsapp` | Code sent to your WhatsApp number. | green toast after a code goes out by WhatsApp | ⬜ | ⬜ | ⬜ | ⬜ |
| `login.codeSentEmail` | Code sent to your email. | green toast after a code goes out by email | ⬜ | ⬜ | ⬜ | ⬜ |
| `biometric.prompt` | Unlock CGPE Connect | the fingerprint / Face ID sheet the phone itself shows | ⬜ | ⬜ | ⬜ | ⬜ |

*(That is 10 rows for 9 unique strings — `biometric.prompt` appears at three call sites but is one
string. `login.codeSentEmail` is **new as of 2026-08-27**: the toast used to say "WhatsApp" even when
the code was emailed, which is now fixed, so it needs its own wording.)*

---

## Batch 5b — the crash screen (4 strings, NEW 2026-08-27)

The app now has an error screen for the first time. Before this, when a screen failed to draw, the
whole app went blank with nothing on it. Now it shows a card explaining what to do. It is **English
today on purpose** — the keys do not exist yet, and an unwired key prints its own name.

This screen is deliberately plain: it is the last thing standing when everything else has failed, so
it cannot use the app's colours, fonts or translations the normal way.

| key | English | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|
| `crash.title` | This screen stopped working | ⬜ | ⬜ | ⬜ | ⬜ |
| `crash.body` | Reloading starts the app again from the beginning, so anything you had typed on this screen and not yet saved will be lost. Work already saved is not affected. If this keeps happening, tell your branch admin what you were doing when it went wrong. | ⬜ | ⬜ | ⬜ | ⬜ |
| `crash.detailHeading` | WHAT WENT WRONG | ⬜ | ⬜ | ⬜ | ⬜ |
| `crash.retry` | Reload the app | ⬜ | ⬜ | ⬜ | ⬜ |

*(`crash.detailHeading` is shown in capitals above the technical error text. The technical text
itself is never translated — it comes from the phone.)*

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

## Batch 4b — the video-evidence strings (4 strings, NEW 2026-08-26)

Added when video capture shipped. These are **hardcoded English in the app right now**, on purpose:
the keys do not exist, and `t()` falls back to the key itself, so wiring them before the copy exists
would print `doc.recordVideo` on screen. Inventing the Gujarati/Hindi spelling of "video" would be
machine translation, which is forbidden (`PHASE-19` §4) — so they wait here for human copy.

Note `video` is trade vocabulary and can stay the English word inside the romanized rows, exactly
like `policy` and `premium` do. What is needed is the surrounding words.

| key | English | where it shows | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| `doc.recordVideo` | Record a video | the attach-document sheet, under "Take a photo" | ⬜ | ⬜ | ⬜ | ⬜ |
| `doc.videoHint` | Videos are limited to {seconds} seconds and are made smaller on your phone before they are sent. | the hint line under the attach buttons | ⬜ | ⬜ | ⬜ | ⬜ |
| `doc.preparingVideo` | Preparing video… | the attach button, while the clip is being compressed (10–20 s) | ⬜ | ⬜ | ⬜ | ⬜ |
| `doc.videoStillTooLarge` | That video is still too large after compressing. Record a shorter clip. | shown when a clip cannot be squeezed under the limit | ⬜ | ⬜ | ⬜ | ⬜ |

*(`{seconds}` is a placeholder — leave it exactly as `{seconds}` in your translation; the app fills
in the number. Do not translate the braces or what is inside them.)*

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

---

## What to send next, and what has to happen first

**Batch 5 (sign-in, 49 strings) and Batch 5b (the crash screen, 4 strings) are the next copy ask,
and both are now fully written out above** — every English string quoted exactly as it appears in
the app, checked character by character on 2026-08-27. Nothing in them needs a `{placeholder}`.
That is what to fill in and send back.

**Batch 4b (the 4 video strings) is still outstanding** from 2026-08-26 and is quick — send it in
the same reply if you can.

**Batches 6–9 still have only counts, not strings.** They get the same verbatim extraction before
they are asked for, one batch at a time, because asking for translations of strings nobody has
quoted invites guesswork.

**Batch 2 is finished** (`48b3509`, 2026-08-26) — no copy is owed. The one part left out on purpose
is `common.offlineBody`; see the status note at the top. Those 39 outage sentences each say what
could not load, and they will be asked for individually rather than collapsed into one.
