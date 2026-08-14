# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Fixing the specific problems the owner reported — this session, the lock screen where tapping "Unlock" often did nothing.

**Done this week:**
- Fixed the lock-screen freeze. When you re-open the app it asks for your fingerprint or face, and tapping "Unlock" often did nothing — worst on Samsung phones. The cause: the app was asking for your fingerprint twice at the same time, and the phone quietly refuses the second request, so it looked like the button was dead. The app now only ever asks once, so Unlock responds on the first tap. This needs a quick check on a real phone (it can't be tested on a computer) before we call it fully closed.
- Earlier this week: fixed the reason a task you create for yourself didn't show on the phone (that one was a server fix, checked line by line, and needs the server restarted to appear on a device).

**Blocked on:**
- The lock-screen fix needs a real Android phone to confirm — ideally a Samsung — because this part of the app can't be tested on a computer. Reading the code, it is correct.
- The app still cannot be uploaded to the shared code store (an access issue for the developer's account) — all work is saved locally.

**Next:** Take stock of how much of the app shows real information from the database versus placeholder text, starting with the notifications, and list what needs cleaning up.
