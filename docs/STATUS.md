# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Fixing the specific problems the owner reported — starting with tasks a person creates for themselves not showing up on their phone.

**Done this week:**
- Found and fixed the reason a task you create for yourself didn't appear on the phone. The cause was on the server, not the app: the server wasn't recognising "you created this" properly. The backend team corrected it, and we checked their change line by line — it is right, and the app needs no change. Your own tasks now show in your normal view.
- Confirmed how the whole task list reaches the phone, and wrote it down, so the next person doesn't have to re-investigate.
- The owner agreed to pass any server-side requests to the backend team and confirm back when they're live — and that already worked end-to-end this week on the task problem (we asked, the owner relayed, the backend fixed it, we verified).

**Blocked on:**
- Before the task fix is visible on a phone, the server needs to be restarted (and, for the live site, re-published). Until then a test may still look broken even though the fix is done.
- The app still cannot be uploaded to the shared code store (an access issue for the developer's account) — all work is saved locally.

**Next:** Look into the reported "screen stops responding to touch," especially the unlock button on the lock screen.
