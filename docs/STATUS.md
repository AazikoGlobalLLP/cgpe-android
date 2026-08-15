# Status — CGPE Connect (Android)
**Updated:** 2026-08-15
**Working on right now:** Restricting the "Viewing as" preview so only the owner can use it.

**Done this week:**
- The "Viewing as" option (which lets someone see the app the way a lower-level staff member sees it)
  is now hidden from managers and team leaders — only the owner-level account sees it.
- The owner chose how strict this should be: it now shows for owner-level accounts only, rather than
  wiring up a brand-new server setting to lock it to a single phone number.
- Finished and checked the master monitoring screen, the salary/performance reports, and the greeting
  emoji earlier this week; all pass the automated checks.

**Blocked on:** Two things, both needing a person, not more code:
1. Saving the work to the shared server is still refused (the login used doesn't have permission) — every
   change is saved only on this computer until someone fixes that access.
2. The always-on location tracking and a few other features can only be finished by installing a fresh
   test build on a real phone.

**Next:** Plan the "fingerprint/face to get back in after logging out" feature — carefully, because it
touches account security.
