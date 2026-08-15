# Status — CGPE Connect (Android)

**Updated:** 2026-08-15

**Working on right now:** Making the staff location-tracking features reliable, honest, and battery-friendly, and getting them ready to test on real phones.

**Done this week:**
- The app now keeps recording a team member's location through the day even if the phone tries to shut it down, and it starts again by itself after the phone restarts.
- It uses less battery by checking location less often when the person is sitting still.
- It refuses fake-GPS apps, so nobody can pretend to be somewhere they are not.
- If a team member turns off location permission, their manager is notified straight away and recording stops — an opt-out is loud, never silent.
- Wrote up and sent two more requests to the backend team: (1) alert a manager when someone's phone goes quiet for too long, and (2) let staff clock in from either of the two offices, asking for a reason (sent to the manager) if they clock in/out from too far away or leave early.

**Blocked on:**
- A person is needed to (a) confirm the two office locations and a few rules, and (b) supply short on-screen messages translated into the local languages — until then the "turn your location back on" screen can't be finished.
- The code still cannot be uploaded/backed up because of a login-access problem — this needs IT to grant access before we can release a final version.

**Next:** Build the app onto real phones and test the location features, including how much battery they use over a full working day.
