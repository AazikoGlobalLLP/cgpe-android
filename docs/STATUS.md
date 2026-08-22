# Status — CGPE Connect (Android)
**Updated:** 2026-08-22
**Working on right now:** We found and fixed why the app "wouldn't open" for you, and we cleaned up a set of real reliability problems in the app.

**Done this week:**
- **The app now opens and works.** The "app won't open / can't reach server" turned out to be a network setup issue, not a fault in the app. Your phones use a newer type of mobile internet (IPv6-only), but our server was only reachable the old way (IPv4). Your phone had to go through a translation step, and our server was sending data in pieces too large to fit through it — so the app's secure connection stalled and gave up (while the browser managed to cope). We proved this on your actual phone. Your senior made a small one-time change on the server so it sends smaller pieces, and the app started working immediately — no new app install needed.
- **We did a deep, thorough "find every hidden problem" sweep of the app** and fixed 8 real issues that would bite people out in the field — for example, the Clock In / Break button could freeze in a low-signal spot, and offline-typed work could be silently lost. All fixed and delivered into a fresh app build.
- **Home loads faster,** especially for a manager/master account — it now fetches everything at once instead of one slow step after another.

**Blocked on:**
- **One more permanent server tweak (recommended):** giving our server a modern (IPv6) address as well, so no phone ever needs the translation step. The quick fix your senior applied is holding; this makes it bulletproof for the whole team. We've written down exactly what's needed.
- **Push notifications still need your one step** — uploading the Firebase key to our build service — before alerts actually arrive.

**Next:** Now that the app works, we continue through the rest of your feedback list — the manager detail view, a calendar view for tasks, the clock-out reason prompt, and a general clean-up of the screens for non-technical team members.
