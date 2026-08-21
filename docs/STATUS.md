# Status — CGPE Connect (Android)
**Updated:** 2026-08-21
**Working on right now:** Fixing the everyday problems you spotted while using the app, and logging a serious "the app won't open on some networks" issue to chase down next.

**Done this week:**
- **The keyboard now comes up when you tap "Break" (and the clock-out reason box).** Before, tapping them opened the box but the keyboard stayed hidden, so you couldn't type. Fixed in the app — it reaches your phone with the next app build.
- **A ticket you take on now shows as today's work.** Earlier, if the ticket was a few days old, taking it on today made it count as "overdue", so the home clock-in area and the Tasks screen said "nothing scheduled" — it looked like the task had vanished. It now correctly appears as today's work in both places. Reaches your phone with the next build.
- **Wrote down the "app won't open on some networks" problem as a top priority.** You said the app won't open on your home WiFi and on mobile data. We recorded exactly how we'll find the cause on a real phone, so it's ready to chase straight away.

**Blocked on:**
- **Push still needs your one step** — uploading the Firebase key to our build service — before notifications actually arrive.
- **The "won't open" problem needs a 30-second check from your phone:** when it fails, does the app (a) close, (b) get stuck on the logo, or (c) open but show nothing? And can you open `cgpe.in/internal/api/health` in your phone's browser on that same network? That one answer tells us exactly where the fault is.

**Next:** Chase the "app won't open" issue on a real phone, finish push (your key + one fresh app build that also carries this week's fixes), then work through the rest of your feedback list.
