# Status — CGPE Connect (Android app)

**Updated:** 2026-08-27

**Working on right now:** Finishing everything that can be finished without waiting for anyone —
this week that meant switching on a large amount of Gujarati and Hindi that had already been paid
for and was sitting unused in the app.

**Done this week:**

- **We found 117 places in the app showing English text that had already been translated.** The
  Gujarati, Hindi and romanised wording was supplied weeks ago and was sitting in the app unused —
  no screen was reading it. **73 of those are now switched on.** This cost nothing extra: the words
  were already bought and paid for.

- **The most important one is the daily clock-in.** Seven of those messages were the ones staff see
  when clocking in, clocking out, or starting and ending a break fails. That is the part of the app
  every field advisor touches every single day, and until now it answered them in English no matter
  which language they had chosen.

- **One consequence you should know about, because it is visible.** A few places now show a mix —
  two words in Gujarati next to one still in English. That looks worse than all-English, and it is
  temporary. There is a specific list of 70 words that fixes it completely, and it is written out
  and ready for you (see below).

- **Every remaining piece of English wording has now been written out for translation.** Previously
  we only had rough counts. There are now exact word-for-word lists — the sign-in screen, the
  "could not reach the server" messages, and the whole More menu. Nobody has to guess what the app
  says any more. These lists were produced automatically from the app itself rather than typed out
  by hand, because the last hand-typed list turned out to be missing an entry.

- **The sign-in screen was showing staff the words "NO_ACCOUNT" and "BAD_PASSWORD".** *(Fixed
  earlier this week.)* These are labels meant for the computer, not for people. Anyone who mistyped
  their email address or got their password wrong saw one of those and nothing else, while the real
  explanation was being sent by the server and thrown away by the app. These are the two commonest
  sign-in problems, so it affected almost everyone who has ever had trouble getting in.

- **The app now explains itself when something breaks, instead of going blank.** *(Also earlier this
  week.)* There is now a proper message with a "Reload the app" button and the technical detail
  underneath, so a screenshot from the field is enough for us to find the problem.

- **A one-page summary of everything waiting on you is now written**, in plain language, with the
  server facts checked against the live system this morning rather than copied from older notes.

**Blocked on:**

1. **The server changes are written but still not switched on.** Checked again this morning: the
   live server is still running the older version. Until someone merges and redeploys, video
   recording still fails and attached documents still cannot be linked to a claim. This is the
   single biggest unblock available and it needs no new work from anyone.
2. **File storage is still switched off.** Also re-checked this morning. One setting on the server
   would make existing attachments openable again today. For the full move we need the storage
   details and one decision from you: should uploaded files be openable by anyone with the link, or
   only when signed in? These are customer KYC and claim documents, so we recommend signed-in only.
   **One thing to pass on:** whoever creates the storage area must not name it "uploads" — that
   exact name would make the app wrongly warn staff their files are not being kept.
3. **Translations.** The priority order is on the summary page. The 70 words that fix the mixed-language
   look are the first thing to send; the sign-in screen is second. Please do not use Google Translate
   for these — the automatic check can only confirm a translation exists, never that it is correct,
   and four wrong entries survived for months that way.
4. **Nothing can be installed on a phone until 1 September.** The build service's free monthly
   allowance is used up. Three weeks of work is waiting on this. Either we wait for the reset, or
   you move to the paid plan.
5. **One bug still needs a phone plugged in for about a minute.** There is also a question you could
   answer in one sentence that would help a great deal: **when the screen goes blank, is the row of
   buttons along the bottom of the app still there?**

**Next:** Get the server changes switched on, send back the translation lists, and prepare the
build for 1 September.
