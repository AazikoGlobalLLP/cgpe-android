# Status — CGPE Connect (Android)
**Updated:** 2026-08-24
**Working on right now:** Fixed the first item from your 12-point list that I can do on my own — the reports problem — and started working down the rest.

**Done this week:**
- Fixed the reports bug on the app's side. The app used to give up after 12 seconds, but a report genuinely takes up to a minute to build, so it was quitting too early every time and it looked like reports never worked. It now waits long enough. If a report is ever still slow, the app says "this is taking longer than usual, try again" instead of wrongly flashing a "whole app is offline" warning.
- Built a new installable app version earlier this week that bundles all the recent improvements (attendance fix, the whole-team map, the new task views, typo-tolerant search, and more) so they finally reach real phones, with a step-by-step testing guide.
- Studied every one of your 12 points properly and wrote each up in plain terms with a priority.

**Important — reports are only half done:**
- The app side is now fixed, but reports still will not actually generate on a phone until **your side turns on the report service on the server**. Both halves are needed. Please don't treat reports as working until that server switch is on.

**Blocked on (needs you):**
- Three server switches only your side can flip: the report service, file storage for uploads, and WhatsApp live-sending.
- A few decisions: what a normal team member should be allowed to see in Clients, the exact access list per role, and whether team members may create their own tasks.

**Next:** I keep building the app-side fixes I can do without waiting — next is adding a search box to the Tasks screen and smoothing the task-creation flow — while you work through the short list of decisions and server switches above.
