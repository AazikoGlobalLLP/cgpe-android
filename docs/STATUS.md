# Status — CGPE Connect (Android)
**Updated:** 2026-08-19
**Working on right now:** Making the app record a staff member's location properly all through their shift, instead of losing most of it.

**Done this week:**
- Fixed the biggest reported problem in the app: when a team member was on duty, the phone was recording their location too rarely and too roughly, so their day showed up as a single straight line instead of their real route. The app now takes a precise location reading about once a minute for the whole shift — even when they are standing still.
- Made sure this change did not accidentally start tracking people's homes when they are off duty — off-duty tracking stays deliberately light on detail and on battery.
- Double-checked the change with an automated review that looks for mistakes, found a few, and fixed them before calling it finished.

**Blocked on:** Two things that are not ours to do: (1) the office's own server still needs to be updated so it stops throwing away the more detailed location readings, and (2) the affected staff phones need their battery/permission settings checked and the newest app installed. Both are with the owner to arrange.

**Next:** Continue fixing the rest of this batch of reported issues (the manager's monitoring screen, payroll, etc.). As agreed with the owner, we will build all of them first, then make one final app version and test everything together in a single round.
