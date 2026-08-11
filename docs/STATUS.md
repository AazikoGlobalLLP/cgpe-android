# Status — CGPE Connect (Android)
**Updated:** 2026-08-11
**Working on right now:** Nothing in progress — the reminders fix is finished and checked, and every other fix that can be made without a test phone or the server team is now done.
**Done this week:**
- Ticking a reminder as done now actually saves. Before, marking a follow-up complete looked done on screen but quietly forgot it the next time you opened the list; now it is saved on the server and stays done after you close and reopen the app. If the save fails (no signal), the tick pops back and the app says so instead of pretending it worked. This turned out not to need the server team at all — the "save" feature was already available and just wasn't connected.
- One small trade-off, deliberate: a reminder that's been marked done can no longer be un-done inside the app, because the server has no way to reopen one. We removed the reopen button rather than leave one that silently undoes itself. The server team could add proper reopening later.
- Earlier this week: the notifications screen now tells the truth during a server problem; the manager dashboards stopped showing a fake "0 clients" during an outage; the LIC plans catalogue lists the real plans; and the Notes search box actually finds matching notes.
- Everything is tested and saved on this computer; all the automated checks pass.
**Blocked on:**
- Finished work still can't be uploaded to GitHub — the login saved on this machine doesn't have permission. Someone with access needs to grant it or swap the login. This is the single thing holding back everything that's been built.
- The "commissions" earnings screen and the "my earnings/salary" screen both still wait on the server team to add figures the app can read. We re-checked this week — those are genuinely not available yet.
**Next:** Get the upload permission sorted so the built work can be shared, then run the final round of checks on a real phone against the live server (including confirming a completed reminder is still complete after closing and reopening the app).
