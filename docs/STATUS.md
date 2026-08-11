# Status — CGPE Connect (Android)
**Updated:** 2026-08-11
**Working on right now:** Making the team map show who is actually out working today for a team leader.

**Done this week:**
- Fixed the team view so a team leader now sees the correct "on duty now" count and the live agent
  map. Before this, a leader always saw "0 on duty" and a blank map even when their whole team was
  clocked in — the app was asking the server a question only a full administrator is allowed to ask,
  and getting turned away. It now asks a question every staff member is allowed to ask, so the number
  is real.
- Confirmed this needed no work from the backend team at all — an earlier note had said it did, and
  that turned out to be wrong. We checked the backend's own rules to be sure a leader only ever sees
  their own team, never the whole company. Automated checks all pass (281 of them).

**Blocked on:** The finished code still can't be uploaded to the shared code server — the account
being used doesn't have permission to write to it. Someone with access needs to grant that permission
or update the saved login. This continues to hold several completed updates on this machine, saved
safely but not yet shared.

**Next:** Two more small screens (a plan list and a notes search) can be fixed in the editor; the rest
of the remaining work either waits on the backend team or needs testing on a real phone — including
confirming today's team-map fix with a real leader account on a live connection.
