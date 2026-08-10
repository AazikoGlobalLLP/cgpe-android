# Status — CGPE Connect (Android)

**Updated:** 2026-08-10

**Working on right now:** Making the app admit when it could not load something, instead of showing
a convincing screen of zeroes.

**Done this week:**
- When the server cannot be reached, staff now see a clear "could not load" message. Before this,
  a manager opening the dashboard during an outage saw a confident "0 clients, ₹0 claims paid" —
  indistinguishable from a real, quiet day. The honest message had in fact been written months ago
  but could never appear, because of a fault further down; that is now fixed.
- The client list was the worst case: an advisor with nine thousand clients was told "no clients in
  your book yet" whenever the connection dropped. It now says the list could not load.
- The renewal list — the one that decides who gets called about a policy about to lapse — used to
  go quietly short when the connection faltered, and looked identical to "nobody is due". It now
  says so.
- We removed a false alarm that appeared every single time anyone opened the Team screen, even when
  everything was working perfectly. It was reporting a failure for something that had never existed.
- We were careful about the opposite mistake. The app no longer cries "outage" when the real answer
  is "you are not allowed to see this" or "this feature is not switched on yet" — otherwise every
  advisor would have seen a permanent warning on a perfectly healthy system.
- Along the way we found that six "could not load" messages on detail screens had never once
  appeared, because of a small fault in shared code. Fixed in one line.
- The automatic safety net grew from 140 checks to 164, and all of them pass.
- Housekeeping worth noting: our ability to save work to version control had been broken for two
  weeks. It is fixed, and three weeks of finished work is now safely stored and backed up.

**Blocked on:** Two things, both waiting on people outside this work.
1. The account-deletion promise. The backend cannot delete an account today, and the team building
   it needs a business answer before they start: exactly what our Play Store listing promises, in
   what timeframe, and whether "account closed and personal details removed, business records
   kept" is acceptable wording. That is a legal and commercial question, not a technical one.
2. Hands-on checking on a real handset with the phone in flight mode. Two rounds are now owed — one
   for the attendance fix and one for this week's. Neither can be checked on a computer.

**Next:** Fix the leads screens, where opening a lead shows nothing and a change of status is lost
as soon as the app is closed.
