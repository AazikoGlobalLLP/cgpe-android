# Status — CGPE Connect (Android)
**Updated:** 2026-08-11
**Working on right now:** Clearing out old, unused parts of the app so it stays lean and easy to maintain.

**Done this week:**
- Removed a batch of leftover files and code that the app no longer used — old styling and theme
  scaffolding from the project's early template, and stray bits left behind when sample data was
  taken out earlier. None of it was reachable by anyone using the app; taking it out makes the app
  slightly smaller and the code easier to work in, with no change to what users see.
- Double-checked, before deleting anything, that nothing still depended on those files — one of them
  even carried an out-of-date note claiming it was widely used, which turned out to be false. The
  app builds, and all automated checks pass exactly as before.

**Blocked on:** The finished code still can't be uploaded to the shared code server — the account
being used doesn't have permission to write to it. Someone with access needs to grant that
permission or update the saved login. This has held back several updates for a while now, so the
work is saved safely on this machine but not yet shared.

**Next:** Tidy up the remaining code-quality warnings so the automated checker reports a clean bill
of health.
