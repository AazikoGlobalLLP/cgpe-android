# Status — CGPE Connect (Android)
**Updated:** 2026-08-15
**Working on right now:** Building the owner's monitoring tools and getting the app ready for a final release.

**Done this week:**
- The owner ("master") now has one dedicated screen that gathers everything they wanted to watch — where each
  team member is, their movement, their task performance, and their salary — in a single place, with no clutter.
- Only the owner can open it; ordinary team members and branch admins can't see it at all.
- Salary, attendance geofencing, and the per-person performance score are all finished and connected end to end.
- Wrote down the final release plan: one last app build with a single download link, after which the app updates
  itself automatically from then on (for normal updates — see the note below).

**Blocked on:**
- **Two things need the owner.** (1) The app can't be uploaded/backed up to GitHub yet — the login it's using has
  no permission, so someone needs to grant access. Until then everything is saved only on this machine.
  (2) The "always-on location" feature and several other features are built but still need to be checked on a real
  phone (they can't be tested on a computer).

**Next:** The owner's top priority is the 24/7 location tracking — the code is written, but it now needs to be
installed on a real phone and tested there. After that: restrict the "view as another role" option to one number,
add fingerprint sign-in, and finally cut the release build with the one-click download link.

**Note on the "last link ever" request:** normal updates (text, screens, fixes) will reach installed phones
automatically with no new link. But a deeper change — a new phone permission or a big system upgrade — will still
need a fresh install once in a while. That's a limitation of how phones work, not a choice.
