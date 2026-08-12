# Status — CGPE Connect (Android)
**Updated:** 2026-08-12
**Working on right now:** Letting each department choose how tight or roomy its app layout looks, controlled centrally with no new app version — starting with the client list as the first proven example.

**Done this week:**
- The app can now take a department's "compact" layout choice from the central settings and tighten the spacing on screen, so more fits without shrinking the text (readability and comfortable tap targets are kept). Departments that don't choose it keep today's roomier look, so nothing changes for them.
- Built this the careful way: one screen (the client list) is switched over and fully checked as proof, and every other screen keeps working exactly as before. The rest of the screens will be switched over a few at a time in later steps, rather than all at once in a risky sweep.
- Earlier this week: each department can now show its own brand colour and a small name tag in the app, and its "More" menu groups and order come from the central settings.
- Earlier this week: staff can see their real commission earnings and their own salary-and-days summary.

**Blocked on:**
- The compact layout, brand colours and name tags only take effect once someone with database access enters them for each department. Before that setup runs, a database password that was pasted into the setup file must be removed and changed.
- The backend team still needs to make its change before every business area (not just plain Sales and Operations) can get its own menu and look. That request is in their queue.
- The app still cannot be uploaded to the shared code store (an access issue for the developer's account) — all work is saved locally.

**Next:** Check the compact layout on a real phone (light and dark), switch over a few more screens, wait for the backend team's reply, remove the pasted password, and run the one-time department setup.
