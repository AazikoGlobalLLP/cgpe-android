# Status — CGPE Connect (Android)
**Updated:** 17 August 2026
**Working on right now:** Finished the commissions screen upgrade the owner asked to prioritise, and parked the phone-testing job for later.

**Done this week:**
- Upgraded the Commissions screen: an advisor now sees their progress toward the next MDRT award level and a clear "This year by product" breakdown showing which policy types earned how much. The numbers all come straight from the server — the app never invents or recalculates a figure.
- Made the screen lighter and faster: it used to make two separate requests to the server for this information; it now gets everything in one, because the server was updated to send it together.
- Kept it honest for the right people: only advisors see the award-level card, so a manager or back-office user never sees a meaningless "0% to the first level".
- Checked a batch of recent server fixes and confirmed they need no change on the app side.
- Handed the owner a ready-to-use testing guide for the 24/7 location feature: which phones are needed, step by step what to do, what to expect, and a checklist to tick off.

**Blocked on:**
- The new commissions numbers only appear once the server team restarts their service — until then the app safely shows the old, simpler version.
- Publishing the code to the shared repository still fails (a login/permission issue that needs a person to fix) — the work is saved safely on this machine meanwhile.

**Next:** Once the server is restarted, do a quick check on a real advisor's phone that the new commissions figures show correctly. The full 24/7-location phone testing is now scheduled for last, as the owner requested.
