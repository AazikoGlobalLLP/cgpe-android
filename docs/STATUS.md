# Status — CGPE Connect (Android)
**Updated:** 2026-08-11
**Working on right now:** Planned out what it would take to translate the rest of the app into Gujarati and Hindi — the app today only translates a small part of its screens.

**Done this week:**
- Checked how much of the app actually changes when someone switches language. It turns out only a small core (the home dashboard, the tab names, and a couple of screens) translates — roughly forty screens still show English no matter which language is chosen.
- Went through every one of those screens and listed the exact ~1,800 pieces of text that would need translating, screen by screen, so the work can be handed to someone to fill in the Gujarati/Hindi wording. This list is now saved with the project.
- Flagged three things that have to be sorted before translation can start — mainly that some text has numbers or names inside it (like "3 of 10 leads") which needs a small technical change first, and that the automated check we rely on won't notice if a translation was accidentally left in English, so the human wording has to be done carefully.
- Re-confirmed the "each person sees their own pay" screen still can't be built — the server team hasn't yet opened up that access.

**Blocked on:**
- The personal "my pay" screen still waits on the server team to allow a person to read their own figure. Unchanged.
- The translation work needs someone to supply the correct Gujarati, Hindi and Roman-script wording — it can't be machine-guessed, or it will read badly to customers.
- Finished work still can't be uploaded to GitHub — the saved login on this machine lacks permission. Everything is saved safely on this machine meanwhile.

**Next:** Do the small technical groundwork that translation needs (no wording required for that part), then translate one important screen fully as a first example. Otherwise, the personal-pay screen the moment the server allows it.
