# Status — CGPE Connect (Android)

**Updated:** 31 August 2026

**Working on right now:** Making sure the voice assistant, and the attaching of documents, behave
honestly when the server side is not yet switched on.

**Done this week:**
- **The voice assistant would have failed on a working server, and now it will not.** The app gave up
  waiting after 8 seconds, but a spoken question genuinely takes longer than that to come back — so
  the app was throwing away good answers, telling the advisor "something went wrong, please try
  again", and then asking the whole thing again from scratch at extra cost. It now waits properly and
  shows a short "still working" note instead.
- **When a service is switched off, the app says so instead of telling people to keep trying.** Voice
  is not turned on on the live server yet, so every advisor who tried it was being told to try again,
  forever. It now says plainly that voice is not switched on and to ask their admin.
- **Photos, videos and documents now go straight to the company's file storage** rather than through
  the main server — the fix for the complaint that attached documents disappear — and a claim screen
  now shows the documents the office holds against that claim.
- **We found a problem before it reached anyone.** A change on the server side will shortly alter the
  way file links are handed to the app. On phones running the current app, those links would quietly
  stop working after a while. The server team has been warned, the app fix is written up as the next
  job, and nothing has gone wrong yet.
- Every automated check is passing: **1,297 checks**, all green.

**Blocked on:**
1. **The server team.** The new storage settings are still not switched on, and 29 pieces of finished
   server work — including three security fixes and the voice service — are written but not yet live.
   A full written list is ready for the server developer.
2. **The app-store build allowance**, which resets on 1 September. **Nothing from the last three weeks
   is on anyone's phone yet** — the last build was 25 August. One build will carry all of it, and it
   is now the single most valuable thing we can do.
3. **Translations.** Several screens are waiting on Gujarati and Hindi wording that only you can
   supply. Two new voice messages are showing in English until that comes back.

**Next:** Fix the file-link problem described above, then produce the first app build since 25 August
so that three weeks of finished work finally reaches the team's phones.
