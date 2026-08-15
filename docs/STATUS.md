# Status — CGPE Connect (Android)

**Updated:** 2026-08-15

**Working on right now:** The staff location-tracking feature is now finished on the coding side, so the focus turns to testing it on real phones.

**Done this week:**
- The app now keeps recording a team member's location through the day even if the phone tries to shut it down, and it starts again by itself after the phone restarts.
- It uses less battery by checking location less often when the person is sitting still.
- It refuses fake-GPS apps, so nobody can pretend to be somewhere they are not.
- If a team member turns off location permission, their manager is notified straight away and recording stops — an opt-out is loud, never silent.
- Finished the last piece: if someone switches their phone's location OFF, the app now shows a full-screen "turn your location back on" notice — in all five languages — that blocks the app and offers a shortcut to the settings, until they turn it back on. (The translated messages had already been supplied, so this could be completed.)

**Blocked on:**
- Testing needs a fresh installable app to be built for real phones — this feature is too deep to send as a quick over-the-air update, so a full build is required first.
- The code still cannot be uploaded/backed up because of a login-access problem — this needs IT to grant access before we can release a final version.
- A person still needs to (a) confirm the two office locations and a few rules for the separate "clock in from either office" request, and (b) pass two requests to the backend team.

**Next:** Build the app onto real phones and test the location features, including how much battery they use over a full working day.
