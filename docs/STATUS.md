# Status — CGPE Connect (Android)
**Updated:** 2026-08-11
**Working on right now:** Planning a full, watchable test of the whole app — one where you can sit and watch every screen and action go by in a browser window — plus checking the app works in all its languages, including the two "Roman" ones (Hindi and Gujarati written in English letters).

**Done this week:**
- Double-checked the two unfinished money screens ("commissions" and "my earnings / salary") one more time, this time by reading the server team's actual code rather than trusting a label. Confirmed again: the app genuinely cannot build these yet because the server has not created the data they need (a pay figure, and a per-product commission total). This is a server-side gap, not an app gap.
- Wrote a clear plan for a from-scratch, watch-along test of the entire app — every screen, deliberately trying to break it with the worst possible inputs and connection failures — set up so you can watch it happen live and replay a recording afterwards.
- Wrote a plan to confirm the app works fully in all five languages, including "Hinglish" and "Gujlish" (Hindi/Gujarati spoken the same way but written in the English alphabet).
- Told the server team, in writing, exactly which two things they need to build before the salary and commissions screens can be finished.

**Blocked on:**
- The salary and commissions screens are waiting for the server team to create the data endpoints — re-confirmed this week that they still don't exist.
- Finished work still can't be uploaded to GitHub — the login saved on this machine doesn't have permission. Someone with access needs to grant it or swap the login.

**Next:** Build the watch-along test of the whole app, then the language check — both can be done here without a test phone. Salary and commissions come after that, once the server team provides the missing data.
