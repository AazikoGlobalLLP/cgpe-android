# Status — CGPE Connect (Android)
**Updated:** 2026-08-12
**Working on right now:** Built the personal "My earnings" screen — each person can now open the app and see their own pay for the month, worked out from their attendance.

**Done this week:**
- The server team added the missing piece we'd been asking for — a safe way for a person to read *only their own* pay — and we built the screen on top of it the same day. Each staff member now sees, for any of the last 12 months: the amount earned, how many days they were present, their payable days, days absent, and hours worked. The figure is always calculated on the server; the app only displays it, so there's no risk of the phone showing a wrong number.
- The screen is honest in every situation: if someone doesn't have a pay profile set up yet, it says so plainly rather than showing "₹0"; if the server can't be reached, it shows a clear "couldn't load" with a Try-again button instead of a made-up figure. For the current, still-running month it labels the amount "so far this month" so nobody mistakes it for a final payslip.
- Reached from two natural places: the personal section of the More menu, and a tap from the attendance screen (since the same days drive the pay).
- Earlier this week: re-sent the request for that pay feature; confirmed a server change about campaign counts doesn't affect us; and made everyday buttons (Call, Cancel, Delete, "Today") show in Gujarati and Hindi across 16 screens.

**Blocked on:**
- Nothing to build for this feature. Before it's trusted widely, it should be checked by hand on a real phone against the payroll sheet for a few people — the one thing automated tests can't do.
- Someone to supply the correct Gujarati / Hindi / Roman-script wording for the remaining repeated labels (like "Try again"). That batch of translation stays paused by choice until the wording arrives — it can't be machine-guessed without reading badly to customers.
- Finished work still can't be uploaded to GitHub — the saved login on this machine lacks permission. Everything is saved safely on this machine meanwhile.

**Next:** Hand the new pay screen to someone with a phone to check three real people's months against the payroll sheet. Separately, the remaining commissions screen still waits on a server change, and translation waits on the wording above.
