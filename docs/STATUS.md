# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** The always-on staff-location feature — the background-recording code is written and now needs proving on real phones; alongside it, we scoped the "clock-in only near each person's own location" request and handed it to the server team.

**Done this week:**
- Scoped the **per-person clock-in location** the owner asked for: today the app only lets people clock in when they're near **one shared office**, and each person having their **own** allowed spot (within 200 m) is a change the **server team** must make. We checked the actual server code to be sure, wrote it up, and handed them a plain-language request to build it. The phone app needs **no change** — it will simply use whatever location rule the server gives it, so this "just works" the moment the server side ships.
- Wrote the code for the always-on location recording: one background recorder that logs travel during a shift as before, and — once a staff member has agreed — also keeps logging off-hours, clearly marked "off duty" so the two are never mixed up.
- Built it so no one is worse off: someone who has NOT agreed keeps exactly today's behaviour. The always-on part switches on only after they agree, and stops itself if agreement is later withdrawn.
- Added the "please don't power-save this app" request and a plain, always-visible "location on for work" notice in the person's own language — nothing is hidden.
- Earlier this week: the agreement gate, the notice in all five languages, the screen, the plumbing, and the server team's data-cleanup rules were all finished.
- All automated checks pass.

**Blocked on:** Two things. (1) The code-upload permission still needs fixing so our saved work can reach the shared repository — it's saved safely on this machine in the meantime. (2) The recording step **cannot be tested on a computer** — it needs a real installable app on real phones, which is the next session. (The per-person clock-in location is waiting on the server team to build it.)

**Next:** Build an installable test app and check on several real phones that off-duty location logs correctly, the shift/off-duty switch works when clocking in and out, it keeps working after the app is closed, and — most important — it does **not** noticeably drain the battery over a full working day.
