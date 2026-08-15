# Status — CGPE Connect (Android)
**Updated:** 2026-08-15
**Working on right now:** Getting the new staff "who got their work done" score ready to show inside the app, now that the server side of it is built and confirmed.

**Done this week:**
- Designed the **staff performance score** with you — it only counts real work (tasks a manager gave the person that they actually finished; not personal to-dos, reminders, or cancelled tasks), rewards finishing on time and finishing the more important tasks, and is worked out fresh each month. Nothing was invented — you chose every rule.
- The **server team built it the same day**, and we checked their work line by line against your rules — it matches exactly. We confirmed the one remaining choice with you (a task counts in the month it was *due*), so it's now fully settled.
- Built the app's side of reading that score and report, with automated tests. What's left is putting it on a screen — and deciding who's allowed to see it (it's manager/owner information, so it should be locked down, not shown to everyone).
- Earlier: confirmed the salary-from-hours request was already done; delivered the per-person clock-in location; wrote the always-on location recorder in five languages.
- All automated checks pass.

**Blocked on:** Two things, unchanged. (1) The code-upload permission still needs fixing so our saved work can reach the shared repository — it's saved safely on this machine meanwhile. (2) The always-on recorder **cannot be tested on a computer** — it needs a real installable app on real phones.

**Next:** Decide where the performance score appears and who can see it, then build that screen; and build an installable test app to check the always-on location recorder on several real phones (especially battery use).
