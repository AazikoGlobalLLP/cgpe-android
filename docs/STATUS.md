# Status — CGPE Connect (Android)
**Updated:** 2026-08-20
**Working on right now:** Fixed the "app keeps making me sign in / fingerprint every couple of hours" complaint, and set up the new code repository so every finished piece of work is saved to it.

**Done this week:**
- Fixed the biggest complaint: the app was asking for a fingerprint **every single time** it was reopened, which felt like being logged out. It now only asks again if the phone has been left for **more than 5 minutes** — a quick glance at another app or a phone call no longer triggers it. (Confirmed with the owner it was the fingerprint lock being over-eager, not a real sign-out.)
- Connected the app's code to the new company repository the owner provided, and saved all the work there. From now on, every completed piece of work is pushed to it automatically so progress is easy to track.
- Earlier this week: the "why did you clock in/out away from the office" message now shows in all five languages, and a fresh installable app with that change was sent to the owner.

**Blocked on:** The next three requested items (guaranteed location updates, team-specific alerts, and adding tasks to the phone's calendar) need a couple of quick decisions from the owner first, and will each need a brand-new app build to reach the phones.

**Next:** Make sure the app records the field team's location at least once an hour, even when the phone is idle.
