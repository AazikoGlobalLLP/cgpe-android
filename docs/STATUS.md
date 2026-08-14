# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Building the 24/7 staff-location feature — this step taught the app how to check whether a staff member has already agreed to it.

**Done this week:**
- The app can now read, on start-up, whether a staff member has agreed to the always-on location notice — the piece the sign-up gate needs before it can require agreement.
- Built it safely: if the server can't answer (or that part of the server isn't live yet), the app quietly carries on as normal and never locks anyone out — so it can't cause a problem before the rest is ready.
- Earlier this week the consent notice itself (in all five languages), the screen that shows it, and the behind-the-scenes plumbing were all completed and checked; the company's server team finished the matching data-cleanup rules.
- All automated checks pass.

**Blocked on:** Two things owned by other people — the server team needs to switch on their new location features on the live server, and someone with the right access needs to fix the code-upload permission (our saved work can't currently be pushed to the shared repository).

**Next:** Wire up the actual sign-in gate and the always-on recording on real phones — this step can only be tested on an actual device once the server team's part is live.
