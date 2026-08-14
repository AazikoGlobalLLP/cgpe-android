# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Making sure only the master account can see where staff are on the live map.

**Done this week:**
- Locked live staff locations to the master account only. Regular admins and team leaders can no longer open the live map or the movement-replay screen — the buttons are gone from their menus, and if they somehow reach the screen it now says plainly "Master access only" instead of showing a map.
- Confirmed this doesn't hide the everyday "who's clocked in" count — managers still see how many people are on duty; they just can't see each person's exact location.
- Fixed a staff task that wasn't showing up on the phone, a freeze on the unlock screen, and added a "mark notification as read" that also clears the little dot on the bell.
- Confirmed exactly what needs to happen for the three chosen phone numbers to become master accounts — it's a small change the owner makes in the database, no app update needed.

**Blocked on:** Nothing on the app side. To test the master view on a real phone we still need the owner to flip those three phone numbers to master in the database.

**Next:** Build the master-only monitoring screen that shows each team member's performance, location, and pay in one place.
