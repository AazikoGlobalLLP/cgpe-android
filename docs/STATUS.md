# Status — CGPE Connect (Android app)

**Updated:** 27 August 2026

**Working on right now:** Making the app show each team only the things they actually use, and
putting the app into Gujarati, Hindi and the two Roman spellings.

**Done this week:**
- **The ops and sales teams now get their own, much shorter app.** You wrote out what each should
  see; that is now exactly what they get. Ops sees claims, reminders, requests and their attendance;
  sales sees leads, prospects and their attendance, five of each on the home screen. Everything else
  is gone from their menus. Managers and admins are untouched, and so is every other department —
  narrowing a team you did not describe is how people lose work they need.
- Four things stayed visible even though you said "nothing else", each because it cannot be got back
  from inside the app: Settings (that is where the language switch lives), profile, the privacy
  screen, and the attendance record. One judgement call to check: **"processes/operations" is not a
  module in the app** — you were asking what it was. The closest thing is Tickets, the requests
  raised by policyholders, so ops gets that. Say the word and it comes out.
- **Every staff member can now create a task for themselves.** One small server change is still
  needed for it to work in the field; it has been written up and is ready for you to forward.
- **The sign-in screen now speaks all five languages** — every label, every error, every message. It
  is the first thing a new joiner sees and it was entirely English until today.
- **135 phrases translated in all,** including everything that was left half-finished last week. You
  asked us to do the translations ourselves rather than wait, so we did; they are marked in the code
  as ours rather than yours, so a native speaker can review and change any line without a rebuild.
- A check that runs after every batch caught three phrases we had translated but not actually
  connected to a screen. All three were fixed the same day. The app now carries **less** unused
  translation than it did at the start of the week, despite adding far more.

**Blocked on:**
- **The live server is still on an older version**, so video evidence and document-to-claim linking
  still do not work in the field. **File storage is still switched off**, which is why captured
  documents will not open. Both were re-checked today.
- **New app versions cannot be built until 1 September.** Everything above is waiting on that, and
  none of it is on anyone's phone yet. Switching to a different build account would get around the
  date, but it would force every one of the 21 phones to uninstall and sign in again — not worth it
  for five days.
- **Two word lists are still to do:** the menus, and the "could not reach the server" messages.

**Next:** Translate the main menu, then the connection messages, and get the first build out on
1 September carrying everything from the last month.
