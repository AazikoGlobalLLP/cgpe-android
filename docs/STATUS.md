# Status — CGPE Connect (Android)
**Updated:** 2026-08-20
**Working on right now:** Nothing in progress — the offline-support work is finished and waiting for a decision on what to do next.

**Done this week:**
- The app now keeps your work safe when the phone has no internet. If a team member adds a new **lead** while offline, it is
  saved on the phone, shown with a "Pending sync" tag, and sent to the server automatically the moment the connection comes
  back — it can no longer be quietly lost. The same safety already covers notes and tasks, so all three are now protected.
- When something is saved offline, the person sees an honest message ("saved on this device — it will sync when you're back
  online") instead of a confusing error, and the app never pretends an offline save reached the server.

**Blocked on:** Nothing. The team-notifications feature is still waiting on the backend team and the Firebase setup, exactly as before.

**Next:** Decide the next feature — either start iPhone support (needs a paid Apple developer account first) or pick up team
notifications once the backend and Firebase are confirmed live.
