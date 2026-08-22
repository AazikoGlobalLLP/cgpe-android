# Status — CGPE Connect (Android)
**Updated:** 2026-08-22
**Working on right now:** Making sure the app never accidentally creates the same thing twice when the phone's signal drops.

**Done this week:**
- Fixed a hidden double-entry problem: if the phone lost signal at the exact moment it saved a new
  lead, task, or note, the app could quietly save a second identical copy when the signal came back.
  It now recognises the repeat and keeps just one. (This needed a matching change on the server, which
  the backend team has already made; it fully switches on once they refresh the live server.)
- Made the sign-in screen honest about *why* it failed — "the server is taking too long" instead of
  wrongly telling people to check a connection that is actually fine.

**Blocked on:** Nothing on our side. Two things are waiting on the server/hosting team: a permanent
network fix so the app connects reliably on all mobile networks, and switching on phone notifications.

**Next:** Continue the owner's walkthrough list — the team-monitoring detail view, a calendar view for
tasks, and a few screen tidy-ups.
