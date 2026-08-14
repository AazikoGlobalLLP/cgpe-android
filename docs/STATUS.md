# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** A full plan for 24/7 staff location (and activity) tracking — done openly, with each person's agreement, and in a way they can't quietly switch off.

**Done this week:**
- Agreed the final approach with the owner: track staff 24/7 (including off-hours), but **openly** — each person is shown a clear notice and agrees, tracking is a required part of the work app (they can't turn it off to avoid it), and it must not drain their battery. Nothing hidden.
- Wrote the complete plan covering: the agreement screen, how to keep tracking running even when Android tries to shut apps down (including after a restart), how to keep battery use low, how to stop staff from quietly disabling it (the app notices and tells the manager), and automatic deletion of old location history (hidden after 90 days, permanently erased after 180).
- Good timing: the server team, in parallel, already built the part that accepts off-hours location with each person's agreement — so that piece is ready. We asked them for one more thing: the automatic 90/180-day deletion.
- Earlier: locked live locations to the master account only; fixed a task-not-showing bug, an unlock-screen freeze, and added "mark notification as read".

**Blocked on:** Two things before the app work can start — (1) the owner supplying the exact wording of the agreement notice in all five languages, and (2) the server team adding the automatic old-data deletion. Also, since tracking is mandatory, the phones should be set up (battery settings) so Android doesn't kill the app.

**Next:** Build the app in four steps — the agreement screen, the always-on recorder, the battery-saving + activity part, and the "can't quietly disable it" safeguards — then test on real phones (Samsung/Xiaomi included).
