# Status — CGPE Connect (Android)

**Updated:** 31 August 2026

**Working on right now:** Getting the first app build since 25 August ready, now that the review of
the server team's unreleased work is finished.

**Done this week:**
- **We found that the "send a notice to the team" feature does not work, and has not for some time.**
  When a manager sends a notice from the app, the server saves it, counts it, and tells the app it
  went to everyone — but nobody can actually see it. The saving and the reading use two different
  ways of identifying a person, so the notices go into a place no one's app ever looks. **Nothing was
  showing as an error at either end, which is why nobody reported it.** The server team had already
  fixed this without realising how visible the problem was; the fix is written but not yet switched
  on. Once the server team releases their work, it starts working — with no app update needed, so it
  will reach the 21 phones already in use straight away.
- **We read every piece of unreleased server work and confirmed nothing else affects the app.** Seven
  batches of changes, checked one by one against the parts of the app that use them, with the reason
  written down for each. This is the second time this review has caught something real, so it is now
  a permanent step rather than a one-off.
- **We checked that a security setting the server team is about to switch on cannot break the app.**
  It cannot — confirmed by reading the actual server code rather than assuming.
- **We fixed a problem before it reached anyone (earlier this week).** The server is changing how it
  hands file links to the app. Those links now expire after a few minutes, and the app was saving
  them as if they were permanent — so documents attached from that point on would have quietly
  stopped opening. The app now saves the file's permanent reference and asks for a fresh link each
  time someone opens it.
- **The voice assistant would have failed on a working server, and now it will not.** The app gave up
  waiting after 8 seconds, but a spoken question genuinely takes longer — so it was throwing away
  good answers, saying "something went wrong, please try again", and running the whole thing again at
  extra cost. It now waits properly and shows a short "still working" note.
- Every automated check is passing: **1,309 checks**, all green.

**Blocked on:**
1. **The app-store build allowance**, which resets on 1 September. **Nothing from the last three
   weeks is on anyone's phone** — the last build was 25 August. One build carries all of it, and it
   is now the single most valuable thing we can do.
2. **The server team.** A large batch of finished server work is written but not yet live — including
   the team-notices fix above, the new file storage settings, three security fixes and the voice
   service. A full written list is ready for the server developer.
3. **Translations.** Several screens are waiting on Gujarati and Hindi wording that only you can
   supply. Two voice messages are showing in English until that comes back.

**Next:** Produce the first app build since 25 August, so three weeks of finished work finally
reaches the team's phones.
