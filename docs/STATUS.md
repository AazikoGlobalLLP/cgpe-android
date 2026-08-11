# Status — CGPE Connect (Android)
**Updated:** 2026-08-11
**Working on right now:** Making the app's maps work when the phone has a weak signal or none at all.

**Done this week:**
- The map screens that show where field staff are, and the route they travelled during a shift, now
  open even when the phone has no internet. Before this, the map showed only an error message
  whenever the connection dropped — a real problem for staff who are out on the road all day. The
  map's background scenery still needs a connection to appear, but the staff markers and travel
  lines now show up regardless. (One final check on a real phone is still to be done to confirm it.)
- The app also stopped relying on an outside website to load part of the map each time, which is
  both faster on mobile data and safer.

**Blocked on:** The finished code still can't be uploaded to the shared code server — the account
being used doesn't have permission to write to it. Someone with access needs to grant that
permission or update the saved login. This has been holding back several updates for a while now,
so the work is saved safely on this machine but not yet shared.

**Next:** Clear out old, unused parts of the app so it stays lean and easier to maintain.
