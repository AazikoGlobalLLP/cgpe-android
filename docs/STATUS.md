# Status — CGPE Connect (Android)
**Updated:** 2026-08-25
**Working on right now:** Ran two deep, automated safety reviews of the app and fixed the hidden problems they found — the kind of issues that only show up in unusual situations, before anyone on the team runs into them.

**Done this week:**
- Found and fixed **13 hidden issues** across the app, all checked twice by an independent review before fixing.
- On a **shared phone**, if someone's login timed out and the next person signed in, the first person's location could get logged onto the wrong person's workday, and the first person's notifications could go to the second person. That's now fully cleaned up whenever a login ends, not just on a manual sign-out.
- A field worker standing **away from the office** couldn't clock in at all once office locations are switched on — the app now lets them clock in and simply asks for a reason (which a manager sees), instead of blocking them.
- The app no longer says **"message sent to everyone"** when, in fact, nobody received it (for example when everyone had opted out).
- Fixed a **false "can't reach the server" warning** that could appear for the whole team on the home screen even when the server was healthy, and stopped a rare case where the calendar could remove someone's synced reminders during a brief connection drop.
- Also closed a **privacy gap** from last week's review: on the "new claim" screen, an ordinary team member could search the entire client list; that's now limited to the same people who are allowed to see clients everywhere else.
- Everything passed our automated checks (**991 tests green**) and is saved to the shared code store.

**Blocked on:** Nothing is blocking. Two of the fixes only take effect after a setup step you already have on your list: the "clock in away from the office" fix switches on once the two office locations are set on the server, and the notification fix matters only once the notification key is uploaded.

**Next:** Either continue these safety reviews on the remaining lower-risk parts of the app, or move to the steps that need you — building and installing the new app version and the server switches already noted. No app-side work is stuck waiting on us.
