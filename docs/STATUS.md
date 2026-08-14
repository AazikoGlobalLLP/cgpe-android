# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Checking whether any screen in the app shows made-up or placeholder information instead of real data from the database — starting with notifications.

**Done this week:**
- Checked the whole app for fake or placeholder data, notifications first. The result: there is none. Every list and figure the user sees comes from the real database, or is worked out from real database information. When something can't load, the app now clearly says "couldn't load" instead of quietly showing a blank or a made-up zero. The few things that looked like placeholders were traced and confirmed to be either real, or already cleaned up in earlier weeks. No changes to the app were needed — this was a verification, and it passed.
- Earlier this week: fixed the lock-screen freeze where tapping "Unlock" often did nothing (worst on Samsung). Still needs a quick check on a real phone before we call it fully closed.
- Earlier this week: fixed the reason a task you create for yourself didn't show on the phone (a server fix; needs the server restarted to appear on a device).

**Blocked on:**
- The app still cannot be uploaded to the shared code store (an access issue on the developer's account) — all work is saved locally on this machine.

**Next:** Add a "mark as read" button to notifications so the little dot on the bell clears once you've seen them — first checking the server supports remembering that they were read.
