# Status — CGPE Connect (Android)

**Updated:** 2026-08-20

**Working on right now:** Making the app usable when the phone briefly loses signal.

**Done this week:**
- The app no longer shows a blank screen the moment the network drops. Your tasks, leads, reminders and alerts now stay on screen from the last time they loaded, with a small "last synced a few minutes ago — may be out of date" note so nobody mistakes old information for live information.
- A note written while offline is no longer lost or wrongly shown as "saved". It now shows a "Pending sync" tag and quietly sends itself the moment the connection comes back. If the server rejects it, the app says so instead of pretending it saved.
- Sensitive client information (names, phone numbers, policy details, money figures) is deliberately NOT stored on the phone for offline use, and everything cached is wiped when a person signs out — important on shared handsets.

**Blocked on:** The "team notifications" feature (a new task pinging the whole team) is still waiting on the server team to publish their part and on a one-time Google/Firebase setup. Nothing we can do on the app side until both are live.

**Next:** Extend the same offline safety to tasks created offline, then get the new offline features onto a real phone for a hands-on check.
