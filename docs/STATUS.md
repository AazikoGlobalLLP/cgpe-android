# Status — CGPE Connect (Android)
**Updated:** 2026-08-20
**Working on right now:** Making the app cope better with a weak or patchy phone connection.

**Done this week:**
- The app used to give up after about four and a half seconds on a slow network — which also meant you sometimes couldn't even sign in. It now waits longer and quietly tries a failed screen-load one more time on its own, so a brief signal blip fixes itself instead of showing an error.
- When something can't load, the message now tells you *why* — "the connection is slow", "can't reach the network", or "the server had a problem" — instead of one vague line.
- Attaching a file no longer freezes forever if the upload stalls; it now gives up cleanly and lets you retry.
- Added a "Test connection" button in Settings so you can check on the spot whether a problem is the app or the WiFi.

**Blocked on:** Nothing for this piece. Separately, the team-notifications feature is still waiting on the backend team to finish and switch it on, plus a one-time Firebase setup — that hasn't happened yet, so we're not shipping it.

**Next:** Either finish team notifications the moment the backend is confirmed live, or start iOS (which first needs an Apple developer account decision).
