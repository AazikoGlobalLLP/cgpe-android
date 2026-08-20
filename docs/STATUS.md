# Status — CGPE Connect (Android)

**Updated:** 2026-08-20
**Working on right now:** Making the app safe to use when the phone has no internet.

**Done this week:**
- The app now keeps working when the connection drops. If a screen (tasks, reminders, notifications, leads) can't reach the
  server, it shows the last information it had, clearly labelled with when it was last updated, instead of a blank screen.
- Notes and tasks written while offline are no longer silently lost. They are saved on the phone, marked "Pending sync," and
  sent automatically the moment the connection comes back. The app never pretends something saved when it didn't.
- The "app doesn't work on my WiFi" complaint was fixed on our side earlier this week (longer wait times and an automatic retry),
  and a "Test connection" button now tells a phone problem apart from a network problem.

**Blocked on:** Team push notifications (waking a closed phone when a task is assigned) are waiting on the backend team and on a
one-time Google Firebase setup. Nothing we can do until both are in place.

**Next:** Get these offline and network fixes onto the real phones for a hands-on test, and gather the five-language wording for
the few new on-screen messages.
