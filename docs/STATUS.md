# Status — CGPE Connect (Android)

**Updated:** 31 August 2026

**Working on right now:** Making sure a document an advisor attaches to a claim is actually kept, and
can be opened again later.

**Done this week:**
- Photos, videos and documents now go **straight to the company's file storage** instead of passing
  through the main server. This is the fix for the complaint that attached documents disappear.
- A claim screen now **shows the documents the office is holding against that claim**, and each one
  opens with a fresh, private link. Before this, an advisor could attach a file and never see it again.
- If a file reaches storage but the office record fails to save, the app now **says so plainly** and
  asks the advisor to attach it again — instead of showing a tick for a file nobody could ever find.
- The app menus, dashboard and claim screens continue to read correctly in all five languages.
- Every automated check is passing: **1,289 checks**, all green.

**Blocked on:**
1. **The server team.** The new storage settings are not switched on yet, and the latest server work
   (29 changes) has not been put live. Until then the app quietly keeps using the old method — nothing
   is broken, but the improvement is not yet reaching phones. A full written list has been prepared
   for the server developer.
2. **The app-store build allowance**, which is used up until it resets. Nothing built in the last week
   is on anyone's phone yet — one build will carry all of it.
3. **Translations.** Several screens are waiting on Gujarati and Hindi wording that only you can supply.

**Next:** Finish the remaining phases, then send the server developer one complete instruction
message — this has been locked so it cannot be sent early or half-finished.
