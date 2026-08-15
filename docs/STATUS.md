# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** The always-on staff-location feature — the background-recording code is written and now needs proving on real phones; alongside it, we scoped the "clock-in only near each person's own location" request and handed it to the server team.

**Done this week:**
- Delivered the **per-person clock-in location** the owner asked for: each person can now have their **own** allowed spot (within 200 m) instead of one shared office. We checked the server code, wrote it up, and handed the server team a plain-language request — and they **built it the same day**. We then re-checked their finished work and confirmed the **phone app needs no change** — it already uses whatever location rule the server gives it. The only thing left is a quick check on a real phone once a manager assigns each person's spot (someone standing at their spot can clock in; a couple of hundred metres away is refused).
- Wrote the code for the always-on location recording: one background recorder that logs travel during a shift as before, and — once a staff member has agreed — also keeps logging off-hours, clearly marked "off duty" so the two are never mixed up.
- Built it so no one is worse off: someone who has NOT agreed keeps exactly today's behaviour. The always-on part switches on only after they agree, and stops itself if agreement is later withdrawn.
- Added the "please don't power-save this app" request and a plain, always-visible "location on for work" notice in the person's own language — nothing is hidden.
- Earlier this week: the agreement gate, the notice in all five languages, the screen, the plumbing, and the server team's data-cleanup rules were all finished.
- All automated checks pass.

**Blocked on:** Two things. (1) The code-upload permission still needs fixing so our saved work can reach the shared repository — it's saved safely on this machine in the meantime. (2) The recording step **cannot be tested on a computer** — it needs a real installable app on real phones, which is the next session. (The per-person clock-in location is waiting on the server team to build it.)

**Next:** Build an installable test app and check on several real phones that off-duty location logs correctly, the shift/off-duty switch works when clocking in and out, it keeps working after the app is closed, and — most important — it does **not** noticeably drain the battery over a full working day.
