# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Making the notification bell honest — you can now tap a notification to mark it as read, and the little dot on the bell clears once you've seen them.

**Done this week:**
- Added "mark as read" to notifications. Tap any new notification and it's marked as read on the spot; the unread dot on the bell clears once nothing is left unread. If the phone can't reach the server, it doesn't pretend — the item stays marked new and it says so, rather than quietly clearing. The server already remembered "read" for us, so no server work was needed this time.
- Earlier this week: checked the whole app for fake or placeholder data (notifications first) and confirmed there is none — everything shown comes from the real database.
- Earlier this week: fixed the lock-screen freeze where tapping "Unlock" often did nothing (worst on Samsung). Still needs a quick check on a real phone before we call it fully closed.
- Earlier this week: fixed the reason a task you create for yourself didn't show on the phone (a server fix; needs the server restarted to appear on a device).

**Blocked on:**
- The app still cannot be uploaded to the shared code store (an access issue on the developer's account) — all work is saved locally on this machine.

**Next:** Set up the "master" view for the three specified phone numbers (a change made in the database, not in the app), then show them live staff location and performance.
