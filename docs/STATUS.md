# Status — CGPE Connect (Android)

**Updated:** 3 September 2026

**Working on right now:** Reviewing the whole app top to bottom for hidden problems and fixing them,
and working through a live back-and-forth with the server team and the admin-panel team on the things
that cross between the three sides.

**Done this week:**
- Reviewed the entire app and fixed more than fifteen real problems. The most important ones:
  - A claim where the customer was still owed part of their money was showing as fully paid and
    settled. An agent could have believed a payout was finished when it was not. Fixed.
  - On a shared phone, if one person logged out while the app was still sending work they had saved
    while offline, that work could be lost, or attached to the next person who logged in. Fixed.
  - Several screens said "no results" when the real problem was that the data could not be loaded.
    They now tell the difference honestly, so nobody acts on "there is nothing" when the truth is
    "we could not reach the server".
  - A pop-up that reported saved work had failed was only in English; it now appears in the user's
    own language.
- Shifts running past 24 hours: the app now warns the person once they have been on duty over 15
  hours, and the server team has built an automatic close at 15 hours so a forgotten clock-out no
  longer runs forever. The exact cut-off (14 or 15 hours) is a one-line choice we need from the owner.
- The voice assistant: found the real reason it gives no answer — a setting is missing on the server,
  not a fault in the app. The app now says so immediately instead of making the person speak and wait
  through a dead attempt. The server team confirmed the app code is correct.
- Found why a layout change made in the admin panel does not always show on a phone in one go: the
  app only re-read the layout on a full restart. It now also re-reads when you switch back into the
  app. The admin-panel team also found a deeper cause and is fixing their side.
- Did all of the above in a live, recorded conversation with the server team and the admin-panel team,
  so every cross-side decision is agreed rather than guessed.

**Blocked on:** A short list of decisions only the owner can make — turning on the voice service on
the server, approving the go-live of the pending server update, choosing the shift cut-off number,
and approving a new "download my data" feature. None of these are code problems; they are business
and server decisions, and they are written up for the owner in plain language.

**Next:** The owner makes those few decisions and the server update goes live; then a fresh app build
and rollout to all the phones, once everything is confirmed working.
