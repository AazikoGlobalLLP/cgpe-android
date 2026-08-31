# Status — CGPE Connect (Android)

**Updated:** 31 August 2026

**Working on right now:** Getting the updated app onto the team's phones — everything is built and
checked, and we are waiting for the monthly build allowance to reset tomorrow.

**Done this week:**
- Finished and checked all the app work that has been waiting since 25 August — the extra languages,
  the document-upload fix, the voice assistant, and the travel-tracking correction. All of it is
  ready; none of it is on anyone's phone yet.
- Found and fixed a serious security problem in how the app is packaged for release: every build we
  sent to the build service was also sending the app's signing key, its passwords, and the key that
  lets us send notifications. None of this was ever public, and nothing was stolen — but it should
  never have been travelling with the build, and it no longer does.
- Discovered our build uploads had been 58 times larger than necessary for months, because a settings
  file was quietly overriding another. Fixed — uploads are now seconds instead of minutes.
- Reviewed the admin panel's "Relationship map" screen that was reported as hard to read, and sent the
  panel team a precise list of what is wrong. The main problem is that its headings show the wrong
  counts — it says "5 tabs" above 7 items — so nobody can trust what they are reading.
- Checked three long-standing complaints about the admin panel before passing them on, and found two
  of them were no longer true: one had already been fixed weeks ago, and one had been described
  inaccurately. That saved the panel team from chasing problems that do not exist.

**Blocked on:** Two things, both outside the app team. The monthly allowance for building the app
resets tomorrow, 1 September — until then the updated app cannot reach any phone. And the server
changes written over the past two weeks have still not been put live, so the document uploads and the
voice assistant will not work on the phones even after the app is installed. One of those pending
server changes also fixes a problem we found this week: notices sent to the team are currently
recorded and reported as delivered, but nobody actually receives them.

**Next:** Build the updated app tomorrow morning and get it onto the 21 handsets, then confirm the
server changes are put live.
