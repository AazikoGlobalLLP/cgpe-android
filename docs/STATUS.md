# Status — CGPE Connect (Android)

**Updated:** 1 September 2026

**Working on right now:** Getting the voice assistant to work reliably, and making sure we can test it
before putting another app update on people's phones.

**Done this week:**
- The app no longer closes when someone presses the microphone button. That was the biggest problem —
  it was happening on every phone — and it is fixed and confirmed working on a real handset.
- Found and fixed two further faults the moment the app stopped closing: the microphone could be left
  switched on after the user let go of the button (it stayed recording for minutes), and there was no
  limit on how long a recording could run. Both are fixed.
- When something does go wrong, the app now shows what actually went wrong instead of a generic
  "something went wrong". Before this, a photo of the error told us nothing.
- The app now shows its own build number on the Settings screen. This sounds small, but the phone's
  own settings do not show it, so until now nobody could tell which version someone was running — and
  a whole day was spent debugging a problem on a version that did not have the fix installed.
- Built a way to test the voice assistant from a computer, without needing a phone or a new app
  build. It signs in and speaks eight test commands through the real system. This means we can check
  voice works *before* spending an app update rather than after.
- Asked the server team to confirm two settings that could silently cut off longer voice requests.
  They have already responded and made a change on their side.

**Blocked on:** One test run. We need someone with a login to run the voice test on their computer —
it takes about a minute. Until that runs, nobody has yet seen the voice assistant answer a question
from end to end, so we cannot honestly say it works.

**Next:** Run that voice test, and if it passes, release the update — including a change that lets us
send future fixes to all phones in under a minute instead of asking everyone to install a new app.
