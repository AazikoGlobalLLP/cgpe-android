# Status — CGPE Connect (Android)
**Updated:** 2026-08-20
**Working on right now:** Making sure a field agent's location keeps updating at least every hour even when their phone tries to save battery.

**Done this week:**
- The app used to make staff re-scan their fingerprint every single time they reopened it (even after a 10-second glance at another app). It now only asks again if they've been away for more than 5 minutes.
- Fixed the "location stops updating in the background / shows a long straight line" problem: the app now takes its own location reading at least about every hour, instead of waiting and hoping the phone reports one.
- Both fixes are saved to the company's own code storage.

**Blocked on:** Nothing to build right now — but the next two items (team notifications, phone-calendar sync) each need you to make a choice before we start (see "Next").

**Next:** Decide how team notifications should work — a message that shows inside the app only (quick to build), or a real phone notification that buzzes even when the app is closed (bigger job, needs extra setup) — then we build it.
