# Status — CGPE Connect (Android)
**Updated:** 2026-08-21
**Working on right now:** Turning on push notifications for Android, and cleaning up a long list of app feedback into a clear "who does what" plan.

**Done this week:**
- **Push notifications are almost on.** You created the Firebase account and added its file; we connected it to the app and
  built a fresh app file (APK) that supports notifications. One small step is left on your side to finish it (below).
- **Fixed the app icon.** The CGPE logo was getting cut off in the phone's app menu because it filled the whole square; we
  padded it so it now sits neatly inside the circle. It will show correctly in the next app build.
- **Turned your big walkthrough feedback into an organised plan.** We went through every point you raised (tasks not showing
  on the clock-in screen, attendance, the live-location map, break/clock-out, roles, reports, cleanup, and more) and sorted
  each one into: our app work, the backend team's work, or a data/setup task. It's written down so nothing is lost.

**Blocked on:**
- **Push needs one action from you:** upload the Firebase "service account key" to our build service (one command in the
  terminal — no website login needed). Until then notifications won't actually arrive, even though everything else is ready.
- Several feedback items need you to confirm exact details before we build them (e.g. after how many hours clock-out should
  ask a reason; exactly what to hide to keep the team screen simple).

**Next:** Finish push (your one step, then we re-test on a real phone), then start working through the feedback list —
beginning with the app items; the backend and setup items go to the backend team and to you to action.
