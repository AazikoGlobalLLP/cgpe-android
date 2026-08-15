# Status — CGPE Connect (Android)
**Updated:** 15 August 2026
**Working on right now:** Fixing issues the owner spotted in the live app and getting an installable test build onto phones.

**Done this week:**
- Fixed a real problem the owner noticed: policies that had already matured (finished) were still showing as "In force". Now any finished policy correctly shows "Matured", and it no longer nags for a premium that isn't due. This applies across the whole app, not just the one client.
- Built an installable app file (APK) and shared a download link, so the owner can put the latest version on a phone and try it.
- Ran an automated end-to-end test that clicked through every screen of the app in a real browser — all 33 checks passed, and it recorded a video and screenshots to review.
- Looked into the "doesn't work on WiFi" report: the app and server are both healthy and fast, and the app does NOT require mobile data. The problem is that the specific WiFi couldn't reach our server (a network/router issue), so there's a quick 30-second phone test for the owner to pinpoint it.

**Blocked on:**
- Publishing the code to the shared repository still fails (a login/permission issue that needs a person to fix) — the work is saved safely on this machine meanwhile.
- The 24/7 location feature needs to be tested on real phones over a full day before it can be called finished.

**Next:** Test the new app build on a few real phones, and confirm the WiFi issue is the network (not the app) using the quick phone test.
