# Status — CGPE Connect (Android)

**Updated:** 31 August 2026

**Working on right now:** Closing the last known way an attached document could stop opening, and
getting ready for the first app build since 25 August.

**Done this week:**
- **We fixed a problem before it reached anyone.** The server is about to change how it hands file
  links to the app. Those links now expire after a few minutes, and the app was saving them as if
  they were permanent — so documents attached from that point on would have quietly stopped opening
  later. The app now saves the file's permanent reference instead and asks for a fresh link each time
  someone opens it. Nothing has gone wrong yet, and the server team has been told.
- **The warning that says "this server will not keep your file" still works.** That mattered: losing
  it while fixing the other problem would have been worse than the problem itself.
- **The voice assistant would have failed on a working server, and now it will not.** The app gave up
  waiting after 8 seconds, but a spoken question genuinely takes longer than that — so it was throwing
  away good answers, saying "something went wrong, please try again", and running the whole thing
  again at extra cost. It now waits properly and shows a short "still working" note.
- **When a service is switched off, the app says so** instead of telling people to keep trying. Voice
  is not switched on on the live server yet, so everyone who tried it was being told to retry forever.
- **Photos, videos and documents now go straight to the company's file storage** rather than through
  the main server — the fix for the complaint that attached documents disappear.
- Every automated check is passing: **1,308 checks**, all green.

**Blocked on:**
1. **The app-store build allowance**, which resets on 1 September. **Nothing from the last three weeks
   is on anyone's phone** — the last build was 25 August. One build carries all of it, and it is now
   the single most valuable thing we can do. Until it happens, this week's file fix protects new
   builds only, not the 21 phones in use.
2. **The server team.** The new storage settings are still not switched on, and a large batch of
   finished server work — including three security fixes and the voice service — is written but not
   yet live. A full written list is ready for the server developer.
3. **Translations.** Several screens are waiting on Gujarati and Hindi wording that only you can
   supply. Two voice messages are showing in English until that comes back.

**Next:** Read the server team's most recent finished-but-unreleased work for anything else that
affects the app — that is how this week's file problem was caught — then produce the first app build
since 25 August so three weeks of finished work finally reaches the team's phones.
