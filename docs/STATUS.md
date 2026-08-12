# Status — CGPE Connect (Android)
**Updated:** 2026-08-12
**Working on right now:** Letting each department choose how tight or roomy its app layout looks, controlled centrally with no new app version — rolling that choice out one group of screens at a time.

**Done this week:**
- Switched over the shared building blocks that many screens reuse — the small status tags, the number tiles, the detail rows, the people/contact rows and their profile pictures. Because these pieces appear all over the app, the "compact" choice now makes them tighter wherever they show up, not just on the four main lists done earlier. Text size and tap targets stay the same for readability, and departments that don't pick compact keep today's roomier look.
- Being upfront about what this does and doesn't do yet: a screen's shared pieces get tighter under compact, but each screen's own outer spacing only tightens once that individual screen is switched over too. The remaining screens follow in later steps.
- Every batch is fully checked before moving on, so anything not yet switched keeps working exactly as before.
- Earlier this week: the four main lists (clients, tasks, leads, claims) got the compact option; each department can show its own brand colour and a small name tag, and its "More" menu groups and order come from the central settings; staff can see their real commission earnings and their own salary-and-days summary.

**Blocked on:**
- The compact layout, brand colours and name tags only take effect once someone with database access enters them for each department. Before that setup runs, a database password that was pasted into the setup file must be removed and changed.
- The backend team still needs to make its change before every business area (not just plain Sales and Operations) can get its own menu and look. That request is in their queue.
- The app still cannot be uploaded to the shared code store (an access issue for the developer's account) — all work is saved locally.

**Next:** Switch over the remaining shared building blocks and then the busy home screen, check the compact layout on a real phone in light and dark, wait for the backend team's reply, remove the pasted password, and run the one-time department setup.
