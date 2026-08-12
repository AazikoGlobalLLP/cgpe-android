# Status — CGPE Connect (Android)
**Updated:** 2026-08-12
**Working on right now:** Added a coverage-health percentage to the client "Smart segments" list so an advisor can see at a glance how well-insured each client is — and, right as this was wrapping up, the server team delivered the missing piece we'd been waiting on for the Commissions "money earned" screen, so that screen is now ready to build next.

**Done this week:**
- Added a coverage percentage to each client and household in the Smart segments list — a quick read of how much life cover they hold against the recommended benchmark, shown on the row and in more detail when you tap in. The number comes straight from the server; the app never guesses it, and a client with no cover on file simply shows nothing rather than a misleading "0%".
- Added a live "MDRT tier progress" section to the Commissions screen so advisors can see how close they are to their next achievement level (earlier this week).
- Built the personal "My earnings" screen so each person can see their own pay for any of the last 12 months, calculated on the server (earlier this week).

**Blocked on:**
- Someone to supply the correct Gujarati / Hindi / Roman-script wording for the remaining repeated labels; that translation batch stays paused by choice until the wording arrives.
- Several recent screens (coverage percentage, tier progress, personal pay) should be checked by hand on a real phone before being trusted widely — the one thing automated tests can't do.
- Finished work still can't be uploaded to GitHub — the saved login on this machine lacks permission. Everything is saved safely on this machine meanwhile.

**Next:** Build the Commissions "money earned" screen against the server data the server team just delivered — the long-standing wait for that piece is now over.
