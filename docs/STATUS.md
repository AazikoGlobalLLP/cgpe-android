# Status — CGPE Connect (Android)
**Updated:** 1 September 2026

**Working on right now:** A new build of the app is ready to install, with the voice assistant
switched off so the app stops closing itself.

**Done this week:**
- The new app version is built and ready. It carries about six weeks of work the team has not had
  since 25 August — the five-language screens, the travel-tracking fix and the file-upload repair.
- The voice assistant was closing the app whenever the microphone button was pressed. It has been
  switched off completely, so the button is gone and the app can no longer be closed by it. Nothing
  else in the app is affected, and the voice work itself is finished and waiting.
- Turning it off costs us nothing today: voice could not have answered anyway, because two settings
  are still missing on the server.
- The office server was updated today, and we checked that whole update against the app first. One
  real problem was found and fixed the same morning: when part of the server was struggling, the
  manager dashboard quietly showed "0 claims" as though that were true. It now says plainly that the
  figure could not be loaded.
- We also found the server update had broken file uploads for anyone still on the old app — photos
  saved a link that stopped working after five minutes. The new version fixes that, which is a large
  part of why installing it matters.
- Each build now carries its own number, so anyone can confirm from their phone which version they
  have. This one is 4.

**Blocked on:**
- **Two settings for the server.** The voice assistant cannot speak until the server engineer adds
  two missing keys and restarts the service. Nothing more is needed from the app.
- **Someone trying the app on a phone.** Everything built since 25 August has only ever been checked
  on a computer, and the tests a computer can run genuinely cannot catch the kind of fault that
  closed the app. This is the main thing holding up confidence right now.
- **A security clean-up only you can approve.** A file in the other team's code repository contains
  real production passwords, including the one protecting every user's login. It has to be replaced
  rather than deleted, and doing so signs everybody out once — so you should pick the moment.

**Next:** Install version 4 on one phone and walk through the main screens before giving it to the
whole team.
