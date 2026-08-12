# Status — CGPE Connect (Android)
**Updated:** 2026-08-12
**Working on right now:** Letting each department choose how tight or roomy its app layout looks, controlled centrally with no new app version — rolling that choice out one group of screens at a time.

**Done this week:**
- The "compact" layout choice now applies to four of the app's main screens: the client list plus the tasks, leads and claims lists. A department that picks compact sees tighter spacing on all four, with the text size and tap targets kept the same for readability. Departments that don't pick it keep today's roomier look.
- This was rolled out the careful way again: the screens are switched over a few at a time and each batch is fully checked, so every screen not yet switched keeps working exactly as before. The remaining screens follow in later steps rather than all at once.
- Earlier this week: each department can show its own brand colour and a small name tag, and its "More" menu groups and order come from the central settings; staff can see their real commission earnings and their own salary-and-days summary.

**Blocked on:**
- The compact layout, brand colours and name tags only take effect once someone with database access enters them for each department. Before that setup runs, a database password that was pasted into the setup file must be removed and changed.
- The backend team still needs to make its change before every business area (not just plain Sales and Operations) can get its own menu and look. That request is in their queue.
- The app still cannot be uploaded to the shared code store (an access issue for the developer's account) — all work is saved locally.

**Next:** Switch over the shared building blocks that many screens reuse (so the compact choice reaches more of the app at once), check the compact layout on a real phone in light and dark, wait for the backend team's reply, remove the pasted password, and run the one-time department setup.
