# Status — CGPE Connect (Android)
**Updated:** 2026-08-20
**Working on right now:** Getting team notifications and phone-calendar sync into the app.

**Done this week:**
- The app used to make staff re-scan their fingerprint every single time they reopened it. It now only asks again if they've been away for more than 5 minutes.
- Fixed the "location stops updating in the background / shows a long straight line" problem: the app now takes its own location reading at least about every hour.
- Built the phone side of team notifications: when a task is assigned to a team, the app is now ready to receive a real notification that buzzes even when the app is closed. (It won't buzz yet — see "Blocked on.")
- Built automatic phone-calendar sync: a staff member's assigned tasks and reminders now appear on their phone's own calendar by themselves, in a clearly-named "CGPE Connect" calendar, and update or disappear as the tasks change.

**Blocked on:** Team notifications can't actually buzz a phone yet — that needs two things only you can arrange: the backend team building the sending side, and a one-time Google/Firebase setup for the app. Both are written up and ready for you to pass on.

**Next:** Once the backend and the Google/Firebase setup are done and confirmed, I'll switch the notifications on, then build one single app update that includes all four of this week's improvements for the team to install and test together.
