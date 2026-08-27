# Status — CGPE Connect (Android app)

**Updated:** 2026-08-27

**Working on right now:** Switching on Gujarati and Hindi wording that was already paid for but
sitting unused in the app — and, this session, proving there is none of it left to find.

**Done this week:**

- **We found 117 places showing English that had already been translated, and switched on 73.** The
  Gujarati, Hindi and romanised wording was supplied weeks ago and no screen was reading it. This
  cost nothing extra — the words were already bought.

- **The most important of those is the daily clock-in.** Seven were the messages staff see when
  clocking in, clocking out, or starting and ending a break fails. That is the part of the app every
  field advisor touches every single day, and until now it answered them in English whichever
  language they had chosen.

- **Then we found four more that the first search could not see — because of apostrophes.** The app's
  own text used a straight quote mark and your translated copy used a curly one. To a computer those
  are different sentences, so the match was missed. Those four are now switched on: the "saved on
  this device, it will sync later" message on three screens, and the client report button.

- **One button was speaking two languages at once.** On the client screen, "Generate client report"
  was translated but the "Generating report" it changed to while working was not. Same button, two
  languages, depending on whether you had tapped it. Fixed.

- **We have now proved there is nothing else of this kind left.** Rather than searching the app for
  translated words, we checked it from the other end: for every one of the 226 translated phrases,
  does any screen actually use it? Eighteen do not, and none of them is a missed opportunity — most
  are wording for screens that no longer exist. **This question is now settled, so nobody needs to
  spend time on it again** until the next batch of translations arrives.

- **The search itself is now saved into the project** rather than being thrown away after use, so it
  can be re-run in seconds each time you send new translations.

- **Three phrases you have already paid for still cannot be used, and we need one small thing for
  each.** Two of them put a number inside the sentence — "+12% vs last month" and "Send to all 42" —
  and the number does not sit in the same place in Gujarati or Hindi as it does in English, so we
  need those two translated with the number marked. The third needs no translation at all, just your
  preference between two wordings that mean the same thing.

**Blocked on:**

1. **The server changes are written but still not switched on.** The live server is still running the
   older version. Until someone merges and redeploys, video recording still fails and attached
   documents still cannot be linked to a claim. This is the single biggest unblock available and it
   needs no new work from anyone.
2. **File storage is still switched off.** One setting on the server would make existing attachments
   openable again today. For the full move we need the storage details and one decision from you:
   should uploaded files be openable by anyone with the link, or only when signed in? These are
   customer KYC and claim documents, so we recommend signed-in only. **One thing to pass on:**
   whoever creates the storage area must not name it "uploads" — that exact name would make the app
   wrongly warn staff their files are not being kept.
3. **Translations — this is now the only thing holding back the app side.** The 70 words that fix
   the mixed-language look are the first thing to send; the sign-in screen is second. Please do not
   use Google Translate — the automatic check can only confirm a translation exists, never that it
   is correct, and four wrong entries survived for months that way.
4. **Nothing can be installed on a phone until 1 September.** The build service's free monthly
   allowance is used up. Four weeks of work is waiting on this. Either we wait for the reset, or you
   move to the paid plan.
5. **One bug still needs a phone plugged in for about a minute.** You already answered the question
   we had — the row of buttons does stay visible when the screen goes blank — and that ruled out the
   most likely cause. The remaining check has to happen on a real phone; it takes about a minute.

**Next:** Get the server changes switched on, send back the translation lists, and prepare the build
for 1 September.
