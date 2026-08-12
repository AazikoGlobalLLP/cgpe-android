# Status — CGPE Connect (Android)
**Updated:** 2026-08-12
**Working on right now:** Finished the Commissions "money earned" screen — it now shows each advisor their own real earnings — and answered the owner's question about whether the app's screen layout can be controlled from the database per team (short answer: it already can, for the main building blocks).

**Done this week:**
- The Commissions screen now shows real earnings: this month, last month, money still owed, the year's total, a six-month trend, and recent payouts — all pulled from the server for the signed-in person only. If someone has no commissions yet it says so calmly; if the data can't load it says that too, and it never shows a made-up number.
- Added a coverage percentage to each client and household in the Smart segments list — a quick read of how well-insured they are, straight from the server.
- Added a live "MDRT tier progress" section to the Commissions screen (how close an advisor is to their next achievement level).
- Built the personal "My earnings" screen so each person can see their own pay for any of the last 12 months.
- Confirmed how the app's layout works: which dashboard cards, menu tabs, and permissions each team sees is already controlled from the database and editable per team from the admin panel — no app rebuild needed to reorder or hide things. What's fixed in the app is the internal design of each individual screen.

**Blocked on:**
- Someone to supply the correct Gujarati / Hindi / Roman-script wording for the remaining repeated labels; that translation batch stays paused until the wording arrives.
- Several recent screens (the new earnings screen, coverage percentage, tier progress) should be checked by hand on a real phone before being trusted widely — the one thing automated tests can't do.
- Finished work still can't be uploaded to GitHub — the saved login on this machine lacks permission. Everything is saved safely on this machine meanwhile.

**Next:** Owner to decide — either push the per-team layout control further (seed each department's layout in the database and let more of it be edited from the admin panel), or wait on the translations / a test phone to clear the checks already queued.
