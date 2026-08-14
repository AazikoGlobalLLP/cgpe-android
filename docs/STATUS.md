# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Building the always-on staff-location feature — this step wrote the actual background-recording code, which can only be proven on real phones.

**Done this week:**
- Wrote the code for the always-on location recording. It's a single background recorder: during a shift it logs travel as before, and once a staff member has agreed, it also keeps logging in the background off-hours — clearly marked as "off duty" so on-duty and off-duty are never mixed up.
- Built it so no one is worse off: a staff member who has NOT agreed keeps exactly today's behaviour (records only during a shift). The always-on part is switched on only after they agree.
- Added the "please don't power-save this app" request (so the phone doesn't quietly kill the recorder) and a plain, always-visible "location on for work" notice shown in the person's own language — nothing is hidden.
- Confirmed the app never records off-hours unless the server says the person has agreed, and if agreement is later withdrawn on the server side the recorder stops itself.
- Earlier this week: the agreement gate, the agreement notice in all five languages, the screen, the plumbing, and the server team's data-cleanup rules were all finished.
- All automated checks pass.

**Blocked on:** Two things. (1) The code-upload permission still needs fixing so our saved work can reach the shared repository — it's saved safely on this machine in the meantime. (2) This recording step **cannot be tested on a computer at all** — it needs a real installable app on real phones, which is the next session.

**Next:** Build an installable test app and check on several real phones that off-duty location logs correctly, the shift/off-duty switch works when clocking in and out, it keeps working after the app is closed, and — the most important one — it does **not** noticeably drain the battery over a full working day.
