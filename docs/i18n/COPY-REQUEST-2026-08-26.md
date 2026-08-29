# Translation copy request — 2026-08-26

> ## ⚠️ STATUS AS OF 2026-08-27 (night) — READ THIS BEFORE SENDING ANYTHING
>
> **The owner instructed us to do the remaining translations ourselves** rather than wait
> (*"translation aap abhi ke liye khud se kar lijiye … agar [problem] aaye toh hum solve kar
> denge"*), which waives the machine-translation rule in PHASE-19 §4 for those batches. So the
> table below is no longer a shopping list — most of it is **already in the app**, written by
> Claude and **labelled as such** in `src/i18n/index.tsx`. A native reader can change any line
> without a rebuild.
>
> | batch | what | state |
> |---|---|---|
> | 1, 2, 3, 4 | the early layers | ✅ owner copy, wired |
> | **6a** (70) | the half-translated groups | ✅ **owner copy, wired** (Phase 82) |
> | **6f** (23) | what wiring 6a created | ✅ **Claude-translated, wired** (Phase 83) |
> | **5** (38 of ~49) | the sign-in screen | ✅ **Claude-translated, wired** (Phase 83) |
> | **6d, 6e, 4b** | peers, `{pct}`/`{n}`, video | ✅ **Claude-translated, wired** (Phase 83) |
> | **6b** (41) | the outage sentences | ⬜ **still to do** |
> | **6c** (~70) | the More menu + label tables | ⬜ **still to do** — needs a small refactor first |
> | 7, 8, 9 | the rest, ~1,700 | ⬜ not started |
> | **5b** (4) | the crash screen | 🚫 **BLOCKED — not by copy.** The error boundary renders outside every provider, so the translator there returns the key name itself. It would print `crash.title` on screen. Architecture change first. |
> | the rest of 5 | `session.*`, `net.*`, `biometric.prompt`, `login.codeSent*` | 🚫 **BLOCKED** — those live in modules with no React translator |
>
> **What we would still like from you, in one line each:** the three questions in §6f below
> (the Gujarati verb on `Generating report`; whether one word should win for
> Clients/Claims/Tasks across the tab bar and the Search table; the follow-ups wording), and a
> native reader's eye over the Claude-written entries whenever you have one spare.



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
>
> ## 🔁 STATUS 2026-08-27 (later) — 73 SITES WIRED FROM COPY YOU ALREADY SENT, AND BATCH 6 EXTRACTED
>
> A scan compared every hardcoded English string in the app against the dictionary and found **117
> places whose text already matched a key you had translated** — copy supplied weeks earlier that no
> screen ever read. **73 are now wired** across 42 keys. The most useful: **seven failure messages in
> the clock-in / clock-out / break flow**, the part of the app every advisor touches every day, which
> until now answered a failed punch in English no matter what language they had chosen.
>
> **This has a visible side effect, and Batch 6a exists to fix it.** Several groups are now *half*
> translated — a stat strip with two translated tiles and one English one. **Batch 6 (111 quoted strings, plus 6c's tables) is
> written out in full below**, and **6a (70 strings) is exactly the copy that closes those gaps.**
> After Batch 5, it is the highest-value thing you can send.

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

## Batch 7 onwards — the rest of the screens

**Batch 6 is no longer a count — it is written out in full further down**, so this table now covers
only what comes after it. Ordered by how often a field advisor sees it.

| batch | screens | approx. strings left |
|---|---|---|
| 7 | Tasks · Claims · Search · More · Settings | ~250 |
| 8 | Client / Lead / Task / Claim / Ticket detail screens, notes, WhatsApp, calendar | ~613 |
| 9 | Segments, prospects, payroll, performance, analytics, team, KB and other occasional screens | ~869 |

*(The old row saying "Claims and Search are 0% translated today" was true when written and is not
any more — both call the translator now, as do all but six route files.)*

**Whole-app total still in English: roughly 1,800–2,400 strings.** Batches 1–4 were **95 strings**
and removed far more visible English than their size suggested; Batch 6 quotes **111** strings
outright (6a 70 + 6b 41) and adds roughly **70** more as whole tables in 6c — and it does the same
job for the screens people use daily.

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

## Batch 6 — extracted 2026-08-27 ⭐ THE NEXT REAL ASK

**Why this batch exists now.** On 2026-08-27 a scan compared every hardcoded English string in
the app against the dictionary and found **117 places whose text already matched a key you had
translated** — copy supplied weeks earlier that no screen ever read. **73 of them are now wired.**
That is good news, but it has a side effect you will see immediately on a Gujarati or Hindi phone:
several groups are now **half translated**. A stat strip with two translated tiles and one English
one looks broken in a way that all-English did not.

**Batch 6a below is exactly the copy that closes those gaps** — nothing else. It is the highest
value per word in the whole document, because every string in it sits directly beside a string
that is already in your language.

### 6a — Finish the half-translated groups (70 strings) ⭐ START HERE

Each row names the group it belongs to, so you can see the words it will sit next to. Where the
same English appears in two groups it is listed twice on purpose — the context differs and the
right word may differ too.

| # | English (exact) | which group it completes | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 1 | In the register | Claims — the register stats and the filter chips | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 | Paid out | Claims — the register stats and the filter chips | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | Pending | Claims — the register stats and the filter chips | ⬜ | ⬜ | ⬜ | ⬜ |
| 4 | Your claims | Claims — the register stats and the filter chips | ⬜ | ⬜ | ⬜ | ⬜ |
| 5 | Still in progress | Claims — the register stats and the filter chips | ⬜ | ⬜ | ⬜ | ⬜ |
| 6 | Review | Claims — the register stats and the filter chips | ⬜ | ⬜ | ⬜ | ⬜ |
| 7 | Segment | Clients — the filter sheet groups | ⬜ | ⬜ | ⬜ | ⬜ |
| 8 | Next 30 days | Clients — the filter sheet groups | ⬜ | ⬜ | ⬜ | ⬜ |
| 9 | Later | Clients — the filter sheet groups | ⬜ | ⬜ | ⬜ | ⬜ |
| 10 | Contact | Clients — the filter sheet groups | ⬜ | ⬜ | ⬜ | ⬜ |
| 11 | Phone on file | Clients — the filter sheet groups | ⬜ | ⬜ | ⬜ | ⬜ |
| 12 | Missing phone | Clients — the filter sheet groups | ⬜ | ⬜ | ⬜ | ⬜ |
| 13 | Due today | Clients — the status token on a row | ⬜ | ⬜ | ⬜ | ⬜ |
| 14 | Due today | Home — the "needs attention" strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 15 | Follow-ups | Home — the "needs attention" strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 16 | Open tickets | Home — the "needs attention" strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 17 | Active leads | Home — the "needs attention" strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 18 | Search | More — the four quick-action tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 19 | Reminders | More — the four quick-action tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 20 | Tickets | More — the four quick-action tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 21 | WhatsApp | More — the four quick-action tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 22 | Where it looks | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 23 | Clients and tickets are matched on the server, so the whole book is searched, not only what this device has loaded. Four digits or more will match a mobile number by its last digits. | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 24 | Tickets are matched on the server. Four digits or more will match a mobile number by its last digits. | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 25 | Clients | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 26 | Name, mobile, policy, email | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 27 | Leads | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 28 | Name, mobile, interest | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 29 | Claims | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 30 | Reference, name, policy | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 31 | Tickets | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 32 | Reference, name, request | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 33 | Tasks | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 34 | Title, client, details | Search — the "Where it looks" table | ⬜ | ⬜ | ⬜ | ⬜ |
| 35 | Birthdays today | Analytics — the campaign stat tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 36 | Not clocked in | Attendance — the clocked-in caption | ⬜ | ⬜ | ⬜ | ⬜ |
| 37 | Renewals due | Campaigns — the six stat tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 38 | Reachable | Campaigns — the six stat tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 39 | In the book | Campaigns — the six stat tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 40 | Annual premium | Client 360 — the KPI strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 41 | Policies | Client 360 — the KPI strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 42 | Maturity | Client 360 — the KPI strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 43 | Generating report | Client 360 — the report button | ⬜ | ⬜ | ⬜ | ⬜ |
| 44 | Closed as lost | Lead — the pipeline progress caption | ⬜ | ⬜ | ⬜ | ⬜ |
| 45 | Pipeline progress | Lead — the pipeline progress caption | ⬜ | ⬜ | ⬜ | ⬜ |
| 46 | Not proceeding | Lead — the pipeline progress caption | ⬜ | ⬜ | ⬜ | ⬜ |
| 47 | Due | Edit task — the Due and Priority controls | ⬜ | ⬜ | ⬜ | ⬜ |
| 48 | Keep | Edit task — the Due and Priority controls | ⬜ | ⬜ | ⬜ | ⬜ |
| 49 | In a week | Edit task — the Due and Priority controls | ⬜ | ⬜ | ⬜ | ⬜ |
| 50 | Priority | Edit task — the Due and Priority controls | ⬜ | ⬜ | ⬜ | ⬜ |
| 51 | Due | New task — the Due and Priority controls | ⬜ | ⬜ | ⬜ | ⬜ |
| 52 | In a week | New task — the Due and Priority controls | ⬜ | ⬜ | ⬜ | ⬜ |
| 53 | Priority | New task — the Due and Priority controls | ⬜ | ⬜ | ⬜ | ⬜ |
| 54 | Premium (MTD) | Team member — the stat strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 55 | Done (MTD) | Team member — the stat strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 56 | Completion | Team member — the stat strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 57 | Open work | Team member — the stat strip | ⬜ | ⬜ | ⬜ | ⬜ |
| 58 | Online | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 59 | Open tasks | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 60 | 0 clients in process | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 61 | Client book | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 62 | Claims in process | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 63 | Open tickets | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 64 | Admin actions | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 65 | Agent map | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 66 | Assign task | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 67 | Send renewals | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 68 | Team | Admin dashboard — the mini stats and section headers | ⬜ | ⬜ | ⬜ | ⬜ |
| 69 | Live activity | Master dashboard — the live-activity header | ⬜ | ⬜ | ⬜ | ⬜ |
| 70 | All | Master dashboard — the live-activity header | ⬜ | ⬜ | ⬜ | ⬜ |

### 6b — The outage sentences (41 distinct, 54 places)

**These are the sentences the app shows when it could not reach the server.** They have been
deferred for four sessions, and the reason is worth stating: an earlier request proposed replacing
all of them with one line. That was refused, deliberately, and it is still the right call — each of
these names *what* could not load ("an empty **inbox** here is not confirmed", "an empty **register**
here is not confirmed"). Collapsing them into one sentence would tell a user their inbox is empty
when the truth is nobody knows. **The app never fabricates data and never implies an empty screen is
confirmed** — that is the single most important convention in this codebase, and these 41 sentences
are how it reaches the user.

So they need 41 individual translations rather than one. Where several screens share a sentence
word for word, it is listed once.

⚠️ **Rows 6-9 are not empty-state copy** — they are failure messages from the sign-in and sync
paths. They are included because they were found by the same scan, but if you are short of time,
**rows 1-5 cover 20 of the 54 places** and are the ones a field advisor actually meets.

| # | English (exact) | where it shows | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 1 | The server did not answer, so this is unconfirmed rather than empty. Check your connection and try again. | agent-track, contests, monitor, team (5 places) | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 | The server did not answer, so nothing here is confirmed. Check your connection and try again. | client/[id], lead/[id], team/[id], tickets/[id] (4 places) | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | The server did not answer, so nothing here is confirmed. Pull down to try again. | families, kb, lic-plans, segments (4 places) | ⬜ | ⬜ | ⬜ | ⬜ |
| 4 | The server did not answer, so nothing here is confirmed. Check your connection and pull to refresh. | clients, leads, whatsapp (3 places) | ⬜ | ⬜ | ⬜ | ⬜ |
| 5 | The salary service could not be reached, so this is blank rather than empty. Pull down or retry. | earnings, payroll-detail (2 places) | ⬜ | ⬜ | ⬜ | ⬜ |
| 6 | Account deletion was not confirmed | store/auth | ⬜ | ⬜ | ⬜ | ⬜ |
| 7 | Could not reach the CGPE server. Check your connection and try again. | data/api | ⬜ | ⬜ | ⬜ | ⬜ |
| 8 | Could not reach the server. Check your connection. | data/api | ⬜ | ⬜ | ⬜ | ⬜ |
| 9 | Could not unlock right now. Check your connection and try again. | (auth)/login | ⬜ | ⬜ | ⬜ | ⬜ |
| 10 | Some tasks could not be loaded, so this may be incomplete. Pull down to refresh, then search again. | tasks | ⬜ | ⬜ | ⬜ | ⬜ |
| 11 | The activity report could not be reached, so this is blank rather than empty — not that this member did nothing. Pull down to try again. | payroll-detail | ⬜ | ⬜ | ⬜ | ⬜ |
| 12 | The bank & shift details could not be reached, so this is blank rather than empty. Pull down to try again. | payroll-detail | ⬜ | ⬜ | ⬜ | ⬜ |
| 13 | The change could not be sent. Check your connection and try again. | task-edit | ⬜ | ⬜ | ⬜ | ⬜ |
| 14 | The file did not leave your phone, so nothing was attached. Check your connection and try again. | lib/fileUpload | ⬜ | ⬜ | ⬜ | ⬜ |
| 15 | The report service could not be reached, so this is blank rather than empty. Pull down or retry. | performance | ⬜ | ⬜ | ⬜ | ⬜ |
| 16 | The report service did not answer, so nothing was generated. No figures are shown. | client/[id] | ⬜ | ⬜ | ⬜ | ⬜ |
| 17 | The roster could not be loaded from the server. Pull back and try again. | notify | ⬜ | ⬜ | ⬜ | ⬜ |
| 18 | The salary service could not be reached, so this is blank rather than empty. Pull down to try again. | payroll | ⬜ | ⬜ | ⬜ | ⬜ |
| 19 | The server could not be reached, so this is not a confirmed empty day. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 20 | The server could not be reached, so this is not a confirmed empty result. Try the search again in a moment. | claim-new | ⬜ | ⬜ | ⬜ | ⬜ |
| 21 | The server could not be reached, so this list is not confirmed. The task can still be created unassigned. | task-new | ⬜ | ⬜ | ⬜ | ⬜ |
| 22 | The server did not accept the reassignment. Check your connection and try again. | task/[id] | ⬜ | ⬜ | ⬜ | ⬜ |
| 23 | The server did not answer in time | settings | ⬜ | ⬜ | ⬜ | ⬜ |
| 24 | The server did not answer, so an empty board here is not confirmed. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 25 | The server did not answer, so an empty inbox here is not confirmed. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 26 | The server did not answer, so an empty list here is not confirmed. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 27 | The server did not answer, so an empty log here is not confirmed. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 28 | The server did not answer, so an empty map here is unconfirmed rather than quiet. | ui/LeafletMap | ⬜ | ⬜ | ⬜ | ⬜ |
| 29 | The server did not answer, so an empty map here is unconfirmed rather than quiet. Check your connection and try again. | agent-map | ⬜ | ⬜ | ⬜ | ⬜ |
| 30 | The server did not answer, so an empty pipeline here is not confirmed. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 31 | The server did not answer, so an empty pool here is not confirmed. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 32 | The server did not answer, so an empty register here is not confirmed. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 33 | The server did not answer, so an empty roster here is not confirmed. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 34 | The server did not answer, so no message history is confirmed. Check your connection and try again. | whatsapp/[id] | ⬜ | ⬜ | ⬜ | ⬜ |
| 35 | The server did not answer, so this is not a confirmed empty day. Pull down to refresh. | home | ⬜ | ⬜ | ⬜ | ⬜ |
| 36 | The server did not answer, so this is not a confirmed empty pool. Check your connection and pull to refresh. | prospects | ⬜ | ⬜ | ⬜ | ⬜ |
| 37 | The server did not answer. Nothing is missing from your book, it just could not be read right now. | families | ⬜ | ⬜ | ⬜ | ⬜ |
| 38 | The server did not answer. Try again once you have a signal. | kb | ⬜ | ⬜ | ⬜ | ⬜ |
| 39 | The server did not confirm the deletion, so your account is unchanged. Check your connection and try again. | account | ⬜ | ⬜ | ⬜ | ⬜ |
| 40 | The team roster could not be loaded, so this list is not confirmed. Close this and try again. | task/[id] | ⬜ | ⬜ | ⬜ | ⬜ |
| 41 | Unlock was not confirmed on this device. Try again. | (auth)/login | ⬜ | ⬜ | ⬜ | ⬜ |

### 6c — The menu and label tables (must be translated whole, not piecemeal)

These are **module-scope tables**: one list in the code supplies every row of a menu or every
status chip on a screen. A few of their entries already have translated copy, but wiring only
those would produce a **navigation menu in two languages**, which is worse than one. So they were
deliberately left alone, and they need translating as complete units.

**The More menu (`MORE_CATALOGUE`) — 22 rows, each with a title and a one-word subtitle.** This is
the app's main menu; it is the single most valuable table here.

| title | subtitle | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|
| Leads and pipeline | Stages | ⬜ | ⬜ | ⬜ | ⬜ |
| Clients | Directory | ⬜ | ⬜ | ⬜ | ⬜ |
| Segments | Smart lists | ⬜ | ⬜ | ⬜ | ⬜ |
| Families | Households | ⬜ | ⬜ | ⬜ | ⬜ |
| Premium and greetings | Renewals | ⬜ | ⬜ | ⬜ | ⬜ |
| Prospects | Recruitment | ⬜ | ⬜ | ⬜ | ⬜ |
| LIC plans | Products | ⬜ | ⬜ | ⬜ | ⬜ |
| Claims | Register | ⬜ | ⬜ | ⬜ | ⬜ |
| Tickets | Requests | ⬜ | ⬜ | ⬜ | ⬜ |
| Reminders and follow-ups | Due dates | ⬜ | ⬜ | ⬜ | ⬜ |
| Calendar | Meetings | ⬜ | ⬜ | ⬜ | ⬜ |
| My attendance | GPS log | ⬜ | ⬜ | ⬜ | ⬜ |
| WhatsApp Hub | Chats | ⬜ | ⬜ | ⬜ | ⬜ |
| Commissions | Earnings | ⬜ | ⬜ | ⬜ | ⬜ |
| Notice Board | From the firm | ⬜ | ⬜ | ⬜ | ⬜ |
| Notes | Private | ⬜ | ⬜ | ⬜ | ⬜ |
| Knowledge Base | Field guide | ⬜ | ⬜ | ⬜ | ⬜ |
| Global search | Everything | ⬜ | ⬜ | ⬜ | ⬜ |
| Contests | Leaderboards | ⬜ | ⬜ | ⬜ | ⬜ |
| My profile | *(no subtitle)* | ⬜ | ⬜ | ⬜ | ⬜ |
| Settings | Security, language | ⬜ | ⬜ | ⬜ | ⬜ |
| Account and privacy | Data and deletion | ⬜ | ⬜ | ⬜ | ⬜ |

**The prospect stages (`prospects.tsx` STAGE_META) — 12 rows.** Two of these (Meeting, Lost) already
have copy from the leads pipeline; the other ten do not, so the whole table waits.

Prospect · Target · Contacted · Responded · Lead · Meeting · Quotation · Documents · Policy login ·
Won · Hold · Lost

**The notice-board categories (`notice-board.tsx`) — 5 rows, each a chip label plus a section
heading.** Event/Events · Meeting/Meetings · Announcement/Announcements · Policy/Policy updates ·
Holiday/Holidays

**The notify priorities (`notify.tsx`) — Low · Normal · Urgent**, and the audiences —
Whole team · Choose people. (Note "Normal" and "Urgent" are *not* the same words as the task
priorities Medium and High, and should not be assumed to share a translation.)

⚠️ **`segments.tsx`'s flag list is a FALLBACK, not the live labels.** Those eleven names (Hot lead,
Underinsured, Well insured, No cover on file, Birthday soon, Birthday today, Renewal due, Maturing
soon, High value, Large family, Inactive) are only used when the server sends none. The real ones
come from the backend, so translating the fallback alone would not change what most users see —
this one needs a decision about where segment names should live before it is worth your time.

### 6d — Six more groups, found 2026-08-27 (later) by the NEAR-MISS scan (13 strings)

**How these were found, and why they were invisible before.** The 2026-08-27 scan matched hardcoded
English against your dictionary **exactly**. This second scan normalised both sides first — case,
trailing full stops, and curly-vs-straight apostrophes — and found four more places where **copy you
had already supplied in all five languages was being rendered as a hand-written English string**.
Those four are now wired at zero copy cost. The rows below are the *peers* of those strings: the ones
next to them that have no key, and so would have left the group half-translated.

| # | English (exact) | which group it completes | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 1 | Claims open | Home — the Portfolio-analytics tile row (Clients / Leads / **Claims open** / **Tickets**) | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 | Tickets | Home — the Portfolio-analytics tile row | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | Portfolio analytics | Home — that tile row's own heading | ⬜ | ⬜ | ⬜ | ⬜ |
| 4 | Organisation-wide totals. Open analytics for the full breakdown. | Home — the footer under that tile row | ⬜ | ⬜ | ⬜ | ⬜ |
| 5 | Clients are master and admin only | Clients — the notice a team member sees instead of the directory | ⬜ | ⬜ | ⬜ | ⬜ |
| 6 | The client directory is available to administrators and the master account. Ask an administrator if you need a client's details. | Clients — the same notice | ⬜ | ⬜ | ⬜ | ⬜ |
| 7 | This job is no longer running | Background job — the whole screen is English | ⬜ | ⬜ | ⬜ | ⬜ |
| 8 | Background jobs are kept only while the app is open. It has finished and been cleared. | Background job — the same screen | ⬜ | ⬜ | ⬜ | ⬜ |
| 9 | Keep working, this runs in the background | Background job — the button's other state (its "Done" state already has copy) | ⬜ | ⬜ | ⬜ | ⬜ |
| 10 | Added | Notify — the button's other state (its "Add" state already has copy) | ⬜ | ⬜ | ⬜ | ⬜ |
| 11 | Live activity | Master dashboard — the heading over the activity list (its "All" link already has copy) | ⬜ | ⬜ | ⬜ | ⬜ |
| 12 | LIC Plans | LIC plans — the screen heading. **Note:** you already supplied `LIC plans` (small p) for the menu. If the heading may use that same wording, say so and no new copy is needed. | ⬜ | ⬜ | ⬜ | ⬜ |
| 13 | Quick actions *(no new copy needed — see note)* | More — the heading is already translated in your dictionary, but the **tiles under it** are part of the 6c menu tables. Wiring the heading alone would leave one translated word over English tiles, so it waits for 6c. | — | — | — | — |

**Nothing here is urgent.** Each row is a group that is currently **all English**, which reads fine.
They are listed so that the four newly-wired strings do not create new half-translated groups later.

### 6e — Three you have ALREADY paid for that the app still cannot use (2026-08-27, later)

We audited this from the other end: for each of the 226 keys, does any screen actually read it?
**18 do not.** Almost all are dead copy for surfaces that no longer exist — nothing owed, and we
have recorded them so nobody asks you about them again. **Three are different**, because the copy
is good and the app simply cannot use it in the shape it was supplied:

| # | You supplied | Where it should appear | What is needed | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|---|
| 1 | `vs last month` | Commissions — the growth line, which reads **"+12% vs last month"** | The number has to sit **inside** the sentence, and it does not sit in the same place in Gujarati or Hindi as it does in English. Gluing the words onto the number would produce broken word order. Please translate this instead, keeping `{pct}` where the number belongs: **`{pct}% vs last month`** | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 | `Send to all` | Campaigns — the send button, which reads **"Send to all 42"** | Same reason. Please translate: **`Send to all {n}`** | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | `No pending follow-ups right now.` and `All caught up!` | Home — the follow-ups widget when nothing is due | The screen currently says **"No follow-up is pending"** — the same thing in different words. **Just tell us which wording you prefer** and we wire yours; no new translation needed. Its two neighbours (`Birthdays, renewals and callbacks land here on the day they are due.` and the button `Open follow-ups`) do need copy, and are in 6a's family. | — | — | — | — |

**Why this matters more than it looks.** A key with no reader is invisible to every check we have:
the parity test only proves the five languages agree, and the compiler only sees a valid string. The
same defect shipped twice before — supplied copy sitting unread while the screen showed English.

### 6f — WHAT BATCH 6a ITSELF CREATED (2026-08-27, after wiring — 23 strings) ⭐ NEXT

**Batch 6a is wired and shipped.** 68 of its 70 rows now render on a phone. This section is the
short, honest list of what wiring it left behind — the same "half-translated group" arithmetic that
created 6a in the first place, now one level down. It is small, and it closes real screens.

**First, two rows of 6a that did NOT get used, and why:**

- **`0 clients in process` has no call site.** The scan that built this document pulled it out of a
  code **comment**, not a screen. There is no tile anywhere that says it. Nothing is owed — your
  translation is simply not needed. *(No key was added for it, deliberately: an unread key is the
  exact defect this whole exercise exists to remove.)*
- **`Agent map` is supplied but cannot be used yet.** Its only screen is the Master dashboard's
  controls row, and the other five buttons beside it have no copy. Wiring one of six would look
  broken. It is unblocked by the Master-dashboard rows below.

**Then, three calls that were left to us — decided, and easy to reverse if you disagree:**

1. **`Generating report` arrived twice in two different Gujarati forms**, differing on verb
   agreement: the earlier drop's `રિપોર્ટ બની રહી છે…` / `Report bani rahi chhe…` against this
   drop's `રિપોર્ટ બની રહ્યો છે` / `Report bani rahyo chhe`. **We adopted the newer one** — it is
   your later instruction, and the masculine agreement is the commoner treatment of the loanword
   *રિપોર્ટ* — keeping the `…` the English carries. Hindi and Hinglish were identical in both drops,
   so only the two Gujarati values moved. **If a native reader says otherwise it is a two-line
   change.**
2. **The app now says two different Gujarati words for the same noun** — **Clients** is `ગ્રાહકો` on
   the bottom tab bar and `ક્લાયન્ટ્સ` in the Search table; **Claims** `ક્લેમ` vs `ક્લેમ્સ`;
   **Tasks** `કાર્યો` vs `ટાસ્ક્સ` — because you wrote the Search cells fresh. **We kept both, and
   did not touch the tab bar.** Neither is wrong: one is a menu label, the other names what a search
   looks through, and both are your words. Rewriting the most-seen text in the app on our own
   judgement is a bigger risk than a mild difference of register across two screens. **Say the word
   and one wins everywhere** — but that is a decision about the tab bar, not about this batch.
3. **Home's follow-ups widget was left in English**, again. Its empty title could read your
   `home.noFollowups` today at zero cost, but its subtitle and its button have no copy, so wiring
   the title alone would leave one of three translated. **Both peers are now rows 20 and 21 below**,
   which closes it properly. 6e item 3's wording question still stands and is the only thing it
   waits on.

**And the 21 strings themselves:**

| # | English (exact) | which group it completes | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 1 | Assign to | New task — the form's other two field labels, now that Due and Priority are translated | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 | Nobody is assigned yet. The task stays on your own list. | New task — the hint under Assign to | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | Category | New task — the form's other two field labels | ⬜ | ⬜ | ⬜ | ⬜ |
| 4 | Total policies | Client report — the summary rows beside the translated "Annual premium" | ⬜ | ⬜ | ⬜ | ⬜ |
| 5 | Total life cover | Client report — the summary rows | ⬜ | ⬜ | ⬜ | ⬜ |
| 6 | Family members | Client report — the summary rows | ⬜ | ⬜ | ⬜ | ⬜ |
| 7 | Search your whole book | Clients — the header subtitle under the translated title | ⬜ | ⬜ | ⬜ | ⬜ |
| 8 | Close out | Lead — the closing section, whose "Not proceeding" row is still English for this reason | ⬜ | ⬜ | ⬜ | ⬜ |
| 9 | A closed lead stays in the pipeline list under its own stage, so nothing is lost. | Lead — the closing section footer | ⬜ | ⬜ | ⬜ | ⬜ |
| 10 | Current | Lead — the tag on the stage the lead is on now | ⬜ | ⬜ | ⬜ | ⬜ |
| 11 | Master controls | Master dashboard — the controls row (this is what unblocks "Agent map") | ⬜ | ⬜ | ⬜ | ⬜ |
| 12 | All teams | Master dashboard — the controls row | ⬜ | ⬜ | ⬜ | ⬜ |
| 13 | Movement | Master dashboard — the controls row | ⬜ | ⬜ | ⬜ | ⬜ |
| 14 | Analytics | Master dashboard — the controls row | ⬜ | ⬜ | ⬜ | ⬜ |
| 15 | Campaigns | Master dashboard — the controls row | ⬜ | ⬜ | ⬜ | ⬜ |
| 16 | Total clients | Master dashboard — the six org tiles (Admin's three are already translated) | ⬜ | ⬜ | ⬜ | ⬜ |
| 17 | Claims total | Master dashboard — the six org tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 18 | In process | Master dashboard — the six org tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 19 | Claims paid | Master dashboard — the six org tiles | ⬜ | ⬜ | ⬜ | ⬜ |
| 20 | Birthdays, renewals and callbacks land here on the day they are due. | Home — the follow-ups widget's empty state (with 21, this unblocks the title you already supplied) | ⬜ | ⬜ | ⬜ | ⬜ |
| 21 | Open follow-ups | Home — the follow-ups widget's button | ⬜ | ⬜ | ⬜ | ⬜ |

**Plus two that need a `{placeholder}`, like 6e:**

| # | Where it appears | What is needed | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 22 | Clients list — a renewal row reads **"Due 14 Mar"** | The date has to sit inside the phrase. Please translate **`Due {date}`** | ⬜ | ⬜ | ⬜ | ⬜ |
| 23 | Client 360 — a follow-up tag reads **"3 days late"** and **"In 12 days"** | Two phrases, number inside: **`{n} days late`** and **`In {n} days`**. Until these arrive, "Due today" stays English on that one tag, so the three read as one set | ⬜ | ⬜ | ⬜ | ⬜ |

### 6g — Home dashboard widget headers (Phase 85, 2026-08-29 — the peers this wiring created)

**Phase 85 wired the three home-dashboard widget headers that already had an exact key** — the
Prospects, Notes and Tickets widget titles now read in all five languages by reusing copy you had
already supplied (`Prospects` / `Notes` / `Tickets`). It changed **no** English and added **no** new
key. This section is the short, honest list of the *neighbouring* headers on the same dashboard that
could **not** be wired — because no key of their exact wording exists, or wiring the title alone
would leave the rest of the card English. They are grouped by what unblocks each one.

**A. Four widget headers with no key of any shape** — one new key each, then they wire:

| # | English (exact) | where it appears | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 1 | The day, in order | Home — the "day spine" widget header | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 | Leads pipeline | Home — the leads widget header. **Do not reuse the existing "Leads and pipeline"** — it is different words | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | Claim requests | Home — the claims widget header | ⬜ | ⬜ | ⬜ | ⬜ |
| 4 | Issue log | Home — the issue-log widget header | ⬜ | ⬜ | ⬜ | ⬜ |

**B. The issue-log card needs two more before its header (#4) can be wired** — otherwise the header
translates and the card body stays English:

| # | English (exact) | where it appears | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 5 | Open tickets that are unclaimed, flagged red, or raised as P1. | Home — the issue-log card footer/empty line | ⬜ | ⬜ | ⬜ | ⬜ |
| 6 | Unclaimed | Home — the issue-log status pill on a ticket nobody owns | ⬜ | ⬜ | ⬜ | ⬜ |

**C. The Team widget's header key already exists** (`Team`), but its card footer is a count sentence
that stays English, and the on/off-duty pills next to it are already translated — so wiring the
header alone would leave the English footer as a visible odd-one-out. **One `{placeholder}` string
unblocks it**, and then the header + footer wire together:

| # | Where it appears | What is needed | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 7 | Home — the Team widget footer reads **"3 of 8 on duty right now."** | Number inside the phrase. Please translate **`{n} of {total} on duty right now`** | ⬜ | ⬜ | ⬜ | ⬜ |

**D. The Home nav catalogue (the compact "shortcut" cards) — a whole-table job, like the More menu.**
Each card shows a **title above a subtitle**, so it must be translated as a unit or it looks
half-done. The seven subtitles have **no** key at all, and three of the titles differ from an
existing key only by a capital letter or a word (so please confirm the exact wording you want):

| # | English (exact) | which card | gu | hi | hi-en | gu-en |
|---|---|---|---|---|---|---|
| 8 | Announcements from the firm | Notice board — subtitle | ⬜ | ⬜ | ⬜ | ⬜ |
| 9 | Bulk WhatsApp sends to your book | Campaigns — subtitle | ⬜ | ⬜ | ⬜ | ⬜ |
| 10 | Slice the client book by need | Smart segments — subtitle | ⬜ | ⬜ | ⬜ | ⬜ |
| 11 | Households and their total cover | Families — subtitle | ⬜ | ⬜ | ⬜ | ⬜ |
| 12 | The advisor field guide | Knowledge base — subtitle | ⬜ | ⬜ | ⬜ | ⬜ |
| 13 | What you have earned so far | Commissions — subtitle | ⬜ | ⬜ | ⬜ | ⬜ |
| 14 | Your GPS clock log, day by day | My attendance — subtitle | ⬜ | ⬜ | ⬜ | ⬜ |
| 15 | Notice board | Title (an existing key says "Notice Board" with a capital B — confirm) | ⬜ | ⬜ | ⬜ | ⬜ |
| 16 | Smart segments | Title (an existing key says just "Segments" — confirm) | ⬜ | ⬜ | ⬜ | ⬜ |
| 17 | Knowledge base | Title (an existing key says "Knowledge Base" with a capital B — confirm) | ⬜ | ⬜ | ⬜ | ⬜ |

*(The other four card titles — Campaigns, Families, Commissions, My attendance — already have exact
keys and need nothing.)*

**Non-blocking flag (already handled, no copy owed yet):** the Notes widget rows show a small
**"Voice"** tag and a **"Voice note"** fallback in English on voice-dictated notes — the same status
as the "Overdue" tag on the tasks widget. They are pre-existing untranslated peers to sweep in a
later batch, and they do **not** hold up the Notes header that Phase 85 wired.

### What is deliberately NOT in Batch 6, and why

- **Task categories** (Follow-up, Claim, Renewal, Meeting, Documentation, Collection, Training,
  General) are **sent to the server as data**, not shown as labels only. Translating them would
  write Gujarati into the database and break every existing filter. They need a display-name layer
  first — a code change, not a copy job.
- **Month and weekday names** on the calendar remain English by the earlier decision. Say the word
  if you want them.
- **The date words in four screens' own formatters** (Today / Tomorrow / Yesterday / "4 days ago"
  on calendar, notifications, reminders and the WhatsApp thread) sit inside plain functions that
  cannot reach the translator. They need a small code change first; the copy for Today, Tomorrow
  and Yesterday already exists.
- **Four strings the app shows outside React** — the background-location notification, the device
  calendar name, and two sync messages — cannot be translated until the app grows a way to read the
  chosen language outside a screen. That is a code change and it is on our side, not yours.

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

**Batch 6 is now extracted too, and it is the one to prioritise after Batch 5** — 111 quoted
strings plus about 70 more inside 6c's tables, in three parts: **6a** (70) closes the groups that went half-translated on 2026-08-27 and are visibly
mixed on a phone today, **6b** (41) is the outage sentences, **6c** is the More menu and the other
label tables that have to be done as whole units. If you only have time for one thing, **6a is the
one people will notice**, because every string in it sits next to a word that is already in their
language.

**Batches 7–9 still have only counts, not strings.** They get the same verbatim extraction before
they are asked for, one batch at a time, because asking for translations of strings nobody has
quoted invites guesswork.

**Batch 2 is finished** (`48b3509`, 2026-08-26) — no copy is owed. The one part left out on purpose
was `common.offlineBody`, and that decision still stands for the empty-state sentences: they are now
Batch 6b, asked for individually rather than collapsed into one. *(Seven **write-failure** notices in
the clock-in flow did match it word for word and were wired on 2026-08-27 — that is a different set
of strings from the 41 empty-state ones, which is why both statements are true.)*
