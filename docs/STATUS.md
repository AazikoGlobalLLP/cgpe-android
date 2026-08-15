# Status — CGPE Connect (Android)
**Updated:** 2026-08-15
**Working on right now:** Setting up a fair, automatic "who got their work done" score for each team member, so managers can see it at a glance instead of guessing.

**Done this week:**
- Designed the **staff performance score** with you. It only counts real work: tasks a manager gave the person that they actually finished — not their own personal to-do items, not reminders, and not tasks that were cancelled. Finishing on time earns full marks, finishing late earns half, and more important tasks count for more. It's worked out fresh each month. We checked the server first and confirmed there was no honest version of this yet (the one score that existed was just typed in by hand), so we've handed the exact recipe to the server team to build. Nothing was invented — you chose every rule.
- Confirmed the **salary-from-hours** request was already built and working, and showed you exactly how it calculates.
- Earlier: delivered the **per-person clock-in location**, and wrote the **always-on location recorder** plus its agreement screen in all five languages.
- All automated checks pass.

**Blocked on:** Two things, unchanged. (1) The code-upload permission still needs fixing so our saved work can reach the shared repository — it's saved safely on this machine meanwhile. (2) The always-on recorder **cannot be tested on a computer** — it needs a real installable app on real phones.

**Next:** Once the server team builds the performance score, show it in the app on a per-person screen; and build an installable test app to check the always-on location recorder on several real phones (especially that it doesn't drain the battery).
