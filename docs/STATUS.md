# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Building the 24/7 staff-location feature — this step added the check that sends a staff member to the agreement screen if they haven't yet agreed.

**Done this week:**
- The app now automatically shows the always-on location agreement screen to any staff member who hasn't already agreed — and won't let them past it until they do. This is the "you must agree to use the app" gate the owner asked for.
- Built it to fail safe: if the server can't answer, or that part of the server isn't reachable, the app quietly leaves everyone on their normal home screen and never locks anyone out. It only sends someone to the agreement screen when it's certain they haven't agreed.
- Confirmed the company's server team has switched their matching location features on and they're running live, so the app side is no longer waiting on them.
- Earlier this week: the agreement notice itself (in all five languages), the screen that shows it, and the behind-the-scenes plumbing were all completed; the server team finished the data-cleanup rules.
- All automated checks pass.

**Blocked on:** One thing owned by someone else — the code-upload permission still needs fixing so our saved work can be pushed to the shared repository (it's saved safely on this machine in the meantime).

**Next:** Test the agreement gate on real phones, and switch on the actual always-on recording — this part can only be built and checked on a real device, and the server side it needs is now live.
