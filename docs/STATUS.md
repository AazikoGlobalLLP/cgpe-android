# Status — CGPE Connect (Android)
**Updated:** 2026-08-22
**Working on right now:** Fixing the master's live map so it shows the whole team, not just one person.

**Done this week:**
- The "Agent locations" screen now shows **every team member**, on duty or not. Before, if only one
  person was clocked in with GPS on, the manager saw just that one person and everyone else disappeared
  ("1 on duty, 1 tracked"). Now the full team list is always shown, with clear counts.
- Checked the two related requests and confirmed they already work as intended: the "Live location"
  button for a person (it honestly says when a location isn't available yet), and the earlier task,
  calendar, clock-out, and simpler-home changes.

**Blocked on:**
- To show a **red "clocked-out" dot** on the live map, the server needs to send that location back — a
  small change on the backend side (the app is already ready to draw it).
- One member ("Pavitra") shows no map location — need the backend team to confirm her phone actually
  sent its location during that trip.

**Next:** Decide whether to build a fresh installable app now (so the team can test everything on their
phones together), or start the next item on the list.
