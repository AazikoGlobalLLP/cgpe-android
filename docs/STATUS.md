# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Letting each department choose how tight or roomy its app layout looks, controlled centrally with no new app version — now rolled out to the main screens, with the smaller remaining screens to follow.

**Done this week:**
- Switched over the busy home screen — the dashboard people see first. Because it controls its own spacing, the "compact" choice now makes the whole home screen tighter, on top of the four main lists, the shared building blocks (buttons, fields, cards, alert strips, loading placeholders, pop-up panels) and the small tags, number tiles and people rows done earlier. Text size and tap targets stay the same for readability, and departments that don't pick compact keep today's roomier look.
- The big, high-traffic screens are now all covered. What's left is the smaller detail and settings screens, which can be done in batches — no single large one remains.
- The backend team's change has landed, so every business area — not just plain Sales and Operations — can get its own menu and look once someone enters those settings. Nothing more is needed from them for this.
- Every batch is fully checked before moving on, so anything not yet switched keeps working exactly as before.

**Blocked on:**
- The compact layout, brand colours and name tags only take effect once someone with database access enters them for each department. Before that setup runs, a database password that was pasted into the setup file must be removed and changed.
- The app still cannot be uploaded to the shared code store (an access issue for the developer's account) — all work is saved locally.

**Next:** Switch over the remaining smaller screens in batches, check the compact layout on a real phone in light and dark, remove the pasted password, and run the one-time department setup.
