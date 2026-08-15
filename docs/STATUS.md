# Status — CGPE Connect (Android)
**Updated:** 2026-08-15
**Working on right now:** Finished the "sign back in with just your fingerprint" feature — a person who returns days later, logged out, can get straight back into their own account with a fingerprint or face scan, no password or OTP.

**Done this week:**
- Built fingerprint/face sign-back-in: after your session quietly expires, one fingerprint tap returns you to your own account — no typing a password or waiting for a code.
- Made it safe: if someone deliberately taps "Log out", the fingerprint shortcut stops working and a full login is required again — both on the phone and confirmed on the server.
- Checked the server team's part of this feature against their actual code before building on top of it — it was correct and secure, so we finished our side.
- The greeting now shows a time-of-day icon, and the "master/owner" monitoring view and the fingerprint feature all passed the app's automated quality checks.

**Blocked on:** Two things need a person, not the app: (1) the server needs a quick restart so the new sign-in works live, and then this feature must be tried on a real phone; (2) the code still cannot be uploaded to the shared code store — a login/permission needs fixing. Until that upload works, the final installable app cannot be produced.

**Next:** Get the server restarted and the upload permission fixed, test the remaining features on a real phone, then produce the one final installable app link.
