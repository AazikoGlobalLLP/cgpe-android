# Status — CGPE Connect (Android)
**Updated:** 1 September 2026

**Working on right now:** The new app build is finished and ready to install on the team's phones.

**Done this week:**
- The new version of the app is built and can be installed today. It is the first update the team
  has had since 25 August, and it carries about six weeks of work — the five-language screens, the
  travel-tracking fix, the file-upload repair, and the voice assistant.
- This build is also the first one a person can identify on their own phone. Every previous build
  showed the same version number, so nobody could tell which one they had. This one shows a
  different number, so it is obvious whether a phone has been updated.
- The main office server was updated today as well, and we checked the whole of that update against
  the app before anything went out. One real problem turned up and was fixed the same morning: when
  part of the server was struggling, the manager dashboard was quietly showing "0 claims" as if that
  were the true figure. It now says plainly that the number could not be loaded.
- We also found that the server update had broken file uploads for anyone still on the old app —
  photos and documents saved a link that stopped working after five minutes. The new build fixes it,
  which is a large part of why installing it matters.

**Blocked on:**
- **Two passwords for the server.** The voice assistant is completely built and installed in this
  new version, but it cannot talk until the server engineer adds two missing keys and restarts the
  service. Until then it politely says it has not been switched on yet. Nothing more is needed from
  the app side.
- **A security clean-up that only you can approve.** A file in the other team's code repository
  contains real production passwords, including the one that protects every user's login. It needs
  to be replaced rather than just deleted. Changing it will sign everybody out once, so you should
  pick the moment.

**Next:** Get the new app onto a phone and walk through the main screens to confirm everything
behaves as expected before it goes to the whole team.
