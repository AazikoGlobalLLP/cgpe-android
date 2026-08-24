# Status — CGPE Connect (Android)
**Updated:** 2026-08-24
**Working on right now:** Making the tasks part of the app simpler and correct for the field team.

**Done this week:**
- Staff who aren't managers no longer see an "Add task" button that only fails the moment they tap it. The app now offers task creation only to the people the system actually allows to create tasks — everywhere it used to appear (the tasks screen, the home screen, and the manager dashboards).
- You can now edit a task after you've created it — fix its title, its priority, or its due date. (Editing was simply not possible before.)
- When you assign a task to someone, or hand one over, you can now search for a colleague by name, and the list now includes everyone — not just people who already happen to have a task. Long lists are searchable instead of cut off.
- A confusing, always-empty "Workflow" checklist that showed on every task has been removed.
- Every change was double-checked by an automated review that found several real problems, all of which were fixed before this went out. It updates over-the-air (no new app install needed).

**Blocked on:** A few things only you can switch on or decide — turning on the reports service on the server, turning on document storage on the server, and deciding whether ordinary team members should be allowed to create their own tasks (right now the server refuses them, so the app simply doesn't offer it).

**Next:** Give the tasks calendar a proper month view you can flip between months on, with a real count of how many tasks fall on each day.
