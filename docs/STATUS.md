# Status — CGPE Connect (Android)
**Updated:** 2026-08-25
**Working on right now:** Ran a fourth automated safety review — this time over the parts of the app we hadn't deeply checked yet (start-up, who-can-see-what, the languages, and the look) — and fixed the real problems it found before anyone runs into them.

**Done this week:**
- Fixed a **privacy problem on shared phones**: after one person's login ended, some of their information could still be shown to the next person who signed in — client details, a claim, or a phone number the app had recently loaded. The app now fully clears that the moment any login ends, so nothing carries over to the next person.
- Closed a **"who can see what" gap**: an ordinary team member's home screen was showing the **team roster and company-wide sales figures** — information meant for team leads and managers. Those now only appear for the right roles, and the pages behind them are locked the same way.
- Fixed a **display problem**: if a team's brand colour is a light shade, the "Confirm" button and the fingerprint-unlock button could show invisible text. They now always stay readable.
- Every change was **checked twice** — found by one automated reviewer, then independently re-checked against the real code before fixing — and everything passed our automated checks (**993 tests green**) and is saved to the shared code store.

**Blocked on:** Nothing is blocking. A couple of smaller polish items are waiting on you — the app shows two Hindi words ("tomorrow"/"yesterday") that read the same, which needs the correct wording from a person (we don't let the computer guess translations), and a colour-contrast tweak that would only matter if a very unusual brand colour is chosen.

**Next:** The remaining work all needs you, not us — building and installing the new app version, and the server switches already on your list. There's no app-side work stuck waiting on our side.
