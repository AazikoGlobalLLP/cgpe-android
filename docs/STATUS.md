# Status — CGPE Connect (Android app)

**Updated:** 2026-08-27

**Working on right now:** Fixing the things people see and cannot explain — starting with the sign-in
screen, which has been showing staff meaningless words instead of telling them what went wrong.

**Done this week:**

- **The sign-in screen was showing staff the words "NO_ACCOUNT" and "BAD_PASSWORD".** These are
  labels meant for the computer, not for people. Anyone who mistyped their email address, or got
  their password wrong, saw one of those words and nothing else — while the real explanation ("No
  account found with that email or mobile number. Please check for a typo") was being sent by the
  server and thrown away by the app. These are the two most common things that go wrong when someone
  signs in, so this affected almost everyone who has ever had trouble getting in. It is fixed, and
  checked against the live server rather than a test copy.

- **A code sent to someone's email used to say "check your WhatsApp".** Staff can sign in with either
  an email address or a mobile number, and the code goes wherever they used. The message always said
  WhatsApp regardless, so people using email were told to look in the wrong place. Now it says the
  right one.

- **The app now explains itself when something breaks, instead of going blank.** Until this week, if
  any screen failed, the whole app vanished and left a blank screen with nothing on it — no message,
  no way back. Staff could only report "it went blank", which is impossible to act on. There is now a
  proper message with a "Try this screen again" button and the technical detail underneath, so a
  screenshot from the field is enough for us to find the problem.

- **The server team delivered the file-storage changes we asked for, and the app already uses them.**
  Documents can now be properly attached to a specific claim, instead of just mentioning it in a
  note. **Important: those server changes have not been switched on yet** (see below), so nothing
  changes for staff until that happens.

- **The Gujarati and Hindi wording for the sign-in screen is ready for you to fill in.** All 47
  phrases on that screen have been written out exactly as they appear in the app, so nobody has to
  guess what they say. It is the first screen anyone ever sees and it is currently English only.
  Please send back the four language versions when you can.

- **Our own project notes were wrong in about twenty places, and two of those were stopping work.**
  The notes still said certain translations were unfinished when you had already supplied them weeks
  ago. Corrected, so nobody redoes work that is done.

**Blocked on:**

1. **The server changes are written but not switched on.** They are finished and tested, but they are
   sitting on a side branch and the live server is still running the old version. Until someone
   merges and redeploys, video recording still fails and attached documents still cannot be linked to
   a claim. This is the single biggest unblock available right now, and it needs no new work.
2. **File storage still needs to be set up.** One setting on the server would make existing
   attachments openable again today, independently of the bigger storage move. For the bigger move we
   still need six values from you and one decision: should uploaded files be openable by anyone with
   the link, or private? These are customer KYC and claim documents, so we recommend private.
   **One small thing to pass on:** whoever creates the new storage area must not name it "uploads" —
   that particular name would make the app wrongly warn people their files are not being kept.
3. **Nothing can be installed on a phone until 1 September.** The build service's free monthly
   allowance is used up. Three weeks of work is waiting on this. Either we wait for the reset, or you
   pay for the paid plan.
4. **One bug still needs a phone plugged in for about a minute.** We narrowed it down further this
   week without a device and ruled out two of the possible causes, but the last step needs the real
   phone. There is also one question you could answer in a sentence that would help a lot: **when the
   screen goes blank, is the row of buttons along the bottom still there?**

**Next:** Get the server changes switched on, hand over the sign-in translations, and prepare the
build for 1 September.
