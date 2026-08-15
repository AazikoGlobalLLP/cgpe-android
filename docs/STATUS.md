# Status — CGPE Connect (Android)
**Updated:** 2026-08-15
**Working on right now:** Checking off the owner's requests one by one — this week we confirmed the "salary based on real hours worked" request is already built and working, and we're still waiting to prove the always-on location recorder on real phones.

**Done this week:**
- Confirmed the **salary-from-hours/days** request is already done. We checked the server code carefully: pay is worked out from each person's actual attendance — a full day counts if they worked 8 hours or more, half a day for 4 or more, nothing below that — and shown as one final amount, both on a staff member's own "My earnings" screen and on the manager's salary list. The phone never does the sums itself; it only shows the server's figure. We showed the owner exactly how it calculates and he confirmed it's what he wants, so there was nothing new to build.
- Earlier: delivered the **per-person clock-in location** (each person clocks in only near their own assigned spot); the server team built it the same day and we confirmed the phone app needs no change.
- Earlier: wrote the always-on location recorder (logs travel during a shift, and — once a staff member agrees — keeps logging off-hours, clearly marked "off duty"), plus the agreement screen in all five languages and the "please don't power-save this app" request. No one is worse off: someone who hasn't agreed keeps today's behaviour.
- All automated checks pass.

**Blocked on:** Two things, unchanged. (1) The code-upload permission still needs fixing so our saved work can reach the shared repository — it's saved safely on this machine meanwhile. (2) The always-on recorder **cannot be tested on a computer** — it needs a real installable app on real phones.

**Next:** Build an installable test app and check on several real phones that off-duty location logs correctly, the shift/off-duty switch works when clocking in and out, it keeps working after the app is closed, and — most important — it does **not** noticeably drain the battery over a full working day.
