# Status — CGPE Connect (Android app)

**Updated:** 2026-08-26

**Working on right now:** Making the app usable in Gujarati and Hindi, letting the team record video
evidence for claims, and finding out why attached files disappear.

**Done this week:**

- **The app now speaks Gujarati and Hindi in 118 more places.** The translations had already been
  supplied, but they were sitting unused — the app was still showing English on screen. "Try again"
  alone appeared 54 times across 41 different screens. All of those now appear in the language the
  person chose, along with the buttons for searching, refreshing, filters, and the on-duty and
  off-duty labels.

- **We found out why attached files disappear, and it is not the app.** Photos and documents that
  staff attach are being saved onto the server's own hard drive and given a web address that points
  back at the phone itself — so the file uploads successfully and can then never be opened again.
  File storage has simply never been switched on. We checked this on the live server, not just on a
  test copy. There is a **one-line change on the server that would fix existing attachments today**,
  separate from the larger storage move.

- **Staff can now record video evidence for claims.** A person can record a clip or pick one from
  their gallery, and the app shrinks it on the phone — from roughly 40–80 MB down to about 9.5 MB —
  so it fits within what the server accepts. That also saves the field team a lot of mobile data. It
  shows a progress percentage while it works, because on an ordinary phone this takes 10–20 seconds
  and people otherwise think the app has frozen. Photos and documents are completely unaffected.

- **Location tracking now takes a reading once an hour instead of once a minute**, as you asked, to
  save battery and mobile data. Worth knowing what this costs: a nine-hour shift now records about
  nine points instead of hundreds, so the route on the live map will be nine straight lines between
  positions rather than a real path. If that starts being reported as a problem, it is this change,
  and it can be adjusted.

- **A serious mistake was caught before it reached anyone.** A change made this week would have
  stopped the app from starting at all during testing. All of our automated checks passed on it —
  the problem was only found by having the work independently reviewed. It is fixed. This is the
  second week running that review has caught something the automated checks could not see.

**Blocked on:**

1. **Nothing can be installed on a phone until 1 September.** The build service's free monthly
   allowance is used up. Nothing from the last two weeks of work is on anyone's phone yet. Either we
   wait for the reset, or you pay for the paid plan.
2. **Video needs one small change on the server** before it will work — the server currently refuses
   video files. Until that is done, recording a video will fail (the app now explains this clearly
   rather than telling people to keep retrying).
3. **File storage needs to be set up.** We need six settings from you for the new storage system, and
   one decision: should uploaded files be openable by anyone with the link, or private? These are
   customer KYC and claim documents, so we recommend private.
4. **One bug needs the phone plugged in for about a minute.** A test is written and ready; it needs
   no new version of the app.

**Next:** Run the one-minute test on a phone to finish off the last open bug, get the server changes
relayed, and prepare the build for 1 September.
