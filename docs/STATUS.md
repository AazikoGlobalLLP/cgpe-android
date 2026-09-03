# Status — CGPE Connect (Android)

**Updated:** 3 September 2026 (end of day)

**Working on right now:** Nothing new on the app itself — the app-side work is finished and pushed.
Everything now waiting is a decision or an action only the owner or the server can do.

**Done this week:**
- Reviewed the whole app top to bottom and fixed more than fifteen real problems. The biggest ones: a
  claim where the customer was still owed money was showing as fully paid; on a shared phone, one
  person's saved-offline work could be lost or attached to the next person; and several screens said
  "no results" when the truth was "could not load".
- Shifts running past 24 hours: the app now warns the person after 15 hours, and the server team built
  an automatic close at 15 hours. Both sides agreed on 15 hours.
- The voice assistant: found the real reason it gives no answer — three settings are missing on the
  server, not a fault in the app. The app now says so immediately instead of making the person speak
  and wait. The server team confirmed the app code is correct.
- Fixed why an admin-panel layout change did not always show on a phone: the app now re-reads the
  layout when you switch back into it, not only on a full restart. The panel team found a deeper cause
  (a department layout can silently override a role layout) and added a clear warning; the owner ruled
  to keep that behaviour and warn about it.
- Built the "Export my data" feature end to end with the server team: a person can now download a
  spreadsheet of their own records. It is switched off until the server update goes live.
- Did all of this in a live conversation with the server team and the panel team, so every decision
  that crosses between the three sides is agreed, not guessed.

**Blocked on:** Four things only the owner or the server can do, and one number to hand over: (1) turn
the voice service on by setting three values on the server; (2) put the pending server update live;
(3) rotate the security key during that update (everyone re-logs in once); (4) hand the server team
the list matching sellers to advisors, so each person sees their own clients. None of these are app
problems.

**Next:** The owner does those four things; the voice test is run to confirm voice works end to end;
then a fresh app build and rollout to all the phones — once everything is confirmed working.
