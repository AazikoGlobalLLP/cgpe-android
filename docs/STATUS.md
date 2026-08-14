# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Setting up 24/7 staff location tracking the right way — with staff consent and a clear on/off choice.

**Done this week:**
- Agreed with the owner exactly what "24/7 tracking" should mean: track staff around the clock, including off-hours, but only after each person is shown a clear notice and taps "Agree", and with a way for them to turn it off later (which alerts their manager). This keeps it on the right side of India's data-protection law.
- Checked the app and the server carefully: today the app only records location during a work shift (clock-in to clock-out). The server literally cannot accept any location outside a shift right now, and it has no place to store a person's consent. So the server team has to build a few things before the app can do 24/7 tracking.
- Wrote up exactly what the server needs to add and handed the owner a plain-language copy to pass to the server team.
- Earlier: locked live locations to the master account only; fixed a task-not-showing bug, an unlock-screen freeze, and added "mark notification as read".

**Blocked on:** Two things before 24/7 tracking can go live — (1) the server team building the three pieces we described (store consent, accept off-hours location, alert the manager when someone opts out), and (2) the owner giving us the exact wording of the consent notice in all five app languages, plus deciding how long location history is kept.

**Next:** Once the server pieces are ready and the notice wording is supplied, build the consent screen and the always-on recorder in the app, then test it on real phones (Samsung/Xiaomi included).
