# Status — CGPE Connect (Android)

**Updated:** 2026-08-11

**Working on right now:** Small trust and safety fixes to the attendance and reporting features,
one at a time, each one tested before moving to the next.

**Done this week:**
- **Someone clocking out away from the office now gets a plain warning telling them how far away
  they were.** Clocking out still works exactly the same either way — nobody is blocked or
  delayed — this just makes an unusual clock-out visible instead of silent.
- **Location tracking and the office clock-in boundary were fixed.** Staff members were being
  wrongly refused clock-in in some cases because the app was checking against the wrong
  boundary; that is fixed, and the app no longer guesses at a boundary it does not actually know.
- **A fake insurance report figure is gone.** If the report system could not be reached, the app
  used to quietly show a made-up ₹42,00,000 cover figure instead of the real one. It now says the
  report could not be generated, and shows nothing invented.
- **Two help documents were corrected.** They still described an old offline/demo mode and
  sample login details that do not exist in the app any more, which would have confused anyone
  following them to test the app.
- The automatic safety-check suite is unchanged at 258 checks, all passing, plus the usual
  compile and code-quality checks.

**Blocked on:** Three things, all needing a person rather than more work.
1. **Nothing has been saved to the company's central code storage for ten rounds of work now.**
   The account being used does not have permission to write to this project. All the work is
   safe on this machine, but it exists in exactly one place. Someone with access to the GitHub
   account needs to grant permission or replace the saved credential.
2. **The shared folder the three teams (this app, the backend, the admin panel) use to pass
   information to each other is still not backed up anywhere.** Fixing it properly means deciding
   how the three projects should be stored together, which is a decision for whoever owns that
   layout, not something to do unilaterally.
3. **Hands-on checking on a real handset is now owed for several rounds of work** — attendance,
   location tracking, and this week's away-from-office warning. None of these can be checked on a
   computer, because they involve flight mode, GPS and the phone's own vibration.

**Next:** Remove a hardcoded personal email address that currently grants the highest access
level in the app, and have the server decide that instead.
