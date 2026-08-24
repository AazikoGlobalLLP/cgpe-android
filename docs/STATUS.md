# Status — CGPE Connect (Android)
**Updated:** 2026-08-24
**Working on right now:** Working down your 12-point list — the app-side fixes I can do on my own — while you handle the server switches and decisions.

**Done this week:**
- Added a **search box to the Tasks screen.** You can now type part of a task name, the client's name, or the last four digits of their phone and it finds the task instantly — and it forgives spelling mistakes and words typed in the wrong order. It searches every task you have loaded, so a task set for a later month (which the day/week/month views couldn't show) can now be found too.
- Fixed the **reports bug on the app's side** — the app used to give up after 12 seconds, but a report genuinely takes up to a minute to build, so it was quitting too early every time. It now waits long enough.
- Built a new **installable app version** earlier this week bundling the recent improvements (attendance fix, whole-team map, new task views, typo-tolerant search) so they reach real phones, with a testing guide.
- Studied all 12 of your points properly and wrote each up in plain terms with a priority.

**Important — reports are only half done:**
- The app side is fixed, but reports still will not actually generate on a phone until **your side turns on the report service on the server.** Both halves are needed — please don't treat reports as working until that switch is on.

**Blocked on (needs you):**
- Three server switches only your side can flip: the report service, file storage for uploads, and WhatsApp live-sending.
- A few decisions: what a normal team member should see in Clients, the exact access list per role, and whether team members may create their own tasks.

**Next:** I keep building the app-side fixes I can do without waiting — next is smoothing the task-creation flow (so people aren't offered a task form they aren't allowed to submit, and can edit a task after making it) — while you work through the short list of decisions and server switches above.
