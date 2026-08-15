# Status — CGPE Connect (Android)
**Updated:** 2026-08-15
**Working on right now:** Finished building the staff performance score end to end; it now needs a check on a real phone.

**Done this week:**
- Designed the **staff performance score** with you — it only counts real work (tasks a manager gave the person that they actually finished; not personal to-dos, reminders, or cancelled tasks), rewards finishing on time and finishing the more important tasks, and is worked out fresh each month. Nothing was invented — you chose every rule.
- The **server team built it the same day**, and we checked their work line by line against your rules — it matches exactly. We confirmed the remaining choice with you (a task counts in the month it was *due*).
- **Built the screen inside the app.** Each staff member gets a "My performance" screen showing their own score and the tasks they completed. The owner gets a "Team performance" screen showing everyone's scores, ranked — and this is locked so only the owner can open it; a regular manager or team member cannot see other people's scores. The app only shows the server's numbers; it never makes up a score.
- Earlier: confirmed salary-from-hours was already done; delivered per-person clock-in location; wrote the always-on location recorder in five languages.
- All automated checks pass.

**Blocked on:** Two things, unchanged. (1) The code-upload permission still needs fixing so our saved work can reach the shared repository — it's saved safely on this machine meanwhile. (2) The performance screen and the always-on recorder **need checking on real phones** — and the server needs its scheduled restart before the performance screen shows live numbers.

**Next:** Check the performance screens on a real phone (own score for a staff member, full ranked list for the owner, and that others are correctly locked out); and test the always-on location recorder on several phones (especially battery use).
