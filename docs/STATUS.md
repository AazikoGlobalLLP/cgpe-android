# Status — CGPE Connect (Android)

**Updated:** 31 August 2026

**Working on right now:** Waiting for the app-build allowance to reset tomorrow so the first build
since 25 August can be produced.

**Done this week:**
- **We tried to produce the new app build today, and the allowance had not reset yet.** Our account's
  monthly quota of free builds runs out and refills on 1 September; today it told us there were 18
  hours to go. Nothing is wrong with the app — every check passes and it is ready to build. We simply
  cannot start one until tomorrow. The alternative is to pay for a month, which is your decision;
  waiting costs nothing and keeps everything else identical.
- **That failed attempt turned out to be worth it — we found the app package has been 58 times larger
  than it needed to be, every single time.** Every build was sending 338 MB of test recordings — video
  of automated tests running, useful to nobody outside our own checks — up to the build service along
  with the app. The cause was one settings file that quietly overrides the normal rules about what to
  leave out, and it has been doing so since the project's first week. Now fixed: what we send has gone
  from 347 MB to under 6 MB. This does not change the app itself; it makes every future build start
  much faster, and it means a failed attempt no longer wastes several minutes.
- **We closed a small security gap in our own housekeeping.** The tool that manages the app's signing
  key can write that key and its passwords into a plain text file. The rule that keeps such a file out
  of our shared code had been written but never saved properly, so it only existed on one computer. It
  is now saved for everyone.
- **We wrote down why the large-package problem happened**, because it is genuinely surprising and
  would otherwise be rediscovered the hard way in a few months. Three sensible-sounding explanations
  were all wrong; the answer came from measuring rather than reasoning.
- Every automated check still passing: **1,309 checks**, all green. No part of the app was changed
  this week in a way a user would see.

**Blocked on:**
1. **The build allowance, until 1 September.** **Nothing from the last three weeks is on anyone's
   phone** — the last build was 25 August. One build carries all of it, and it remains the single most
   valuable thing we can do.
2. **The server team.** A large batch of finished server work is written but not yet live — including
   the team-notices fix found last week, the new file storage settings, three security fixes and the
   voice service. We re-checked today: still not switched on. A full written list is ready for the
   server developer.
3. **Translations.** Several screens are waiting on Gujarati and Hindi wording that only you can
   supply. Two voice messages are showing in English until that comes back.

**Next:** Produce the app build tomorrow, so three weeks of finished work finally reaches the team's
phones.
