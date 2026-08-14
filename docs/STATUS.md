# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Letting each department choose how tight or roomy its app layout looks, controlled centrally with no new app version — rolling that choice out one group of screens at a time.

**Done this week:**
- Switched over the base building blocks that appear on almost every screen — the buttons, the text-entry fields, the cards, the alert strips, the loading placeholders and the pop-up panels. Because these show up everywhere, the "compact" choice now makes them tighter across the whole app, on top of the small tags, number tiles, detail rows and people rows done just before. Text size and tap targets stay the same for readability, and departments that don't pick compact keep today's roomier look.
- Being upfront about what this does and doesn't do yet: a screen's shared pieces get tighter under compact, but each screen's own outer spacing only tightens once that individual screen is switched over too. The one busy home screen is the main piece still to do.
- The backend team has now made the change we asked for, so every business area — not just plain Sales and Operations — can get its own menu and look once someone enters those settings. Nothing more is needed from them for this.
- Every batch is fully checked before moving on, so anything not yet switched keeps working exactly as before.

**Blocked on:**
- The compact layout, brand colours and name tags only take effect once someone with database access enters them for each department. Before that setup runs, a database password that was pasted into the setup file must be removed and changed.
- The app still cannot be uploaded to the shared code store (an access issue for the developer's account) — all work is saved locally.

**Next:** Switch over the busy home screen, check the compact layout on a real phone in light and dark, remove the pasted password, and run the one-time department setup.
