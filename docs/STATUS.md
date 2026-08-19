# Status — CGPE Connect (Android app)

**Updated:** 2026-08-19

**Working on right now:** Finished the top-priority task/dashboard fix, and turned the owner's new list of problems (the manager screens, payroll, and live location) into a clear, checked plan.

**Done this week:**
- Fixed the **owner's #1 issue — the task counts**. A task you reopen no longer makes the "today" number jump around, and a claimed job is set up to show on your own dashboard. The app side is done and tested.
- **Checked the server team's work** on the "claim a ticket → it becomes your task" feature. Their code is correct and our app already reads it — but see the blocker below: it isn't switched on yet on the live server.
- **Investigated the new list of problems** (the manager "Monitor" screen showing 0 people on duty, the map error, the payroll screen showing only one employee, live location, and the big one — a staff member's phone tracking her location poorly) and wrote a clear, grounded plan for each — every cause traced to the real code, not guesswork.

**Blocked on (the one big thing):**
- **The live server is running an old version of the back-end.** A lot of back-end work the server team said was "done" (including the claim-a-ticket feature and the manager performance report) was written but **never switched on for the live app** — some of it was never even uploaded. This is why the owner sees several "finished" features not working, and several "could not load" errors. **The server team needs to publish their latest work to the live server and restart it.** Our side can't do this. Until they do, our app is correct but shows honest "couldn't load" messages.

**Next:** The background location tracking (a staff member's phone should record her real position about every minute and keep every point) — this is the owner's new top priority and needs a fresh app build plus a check on her phone's settings. Alongside it: fix the manager "Monitor" screen (it shows 0 on duty because the server isn't sending the location data), and build the payroll screen so it lists all employees and shows how each person's pay was calculated.
