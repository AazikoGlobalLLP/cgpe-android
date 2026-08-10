# Status — CGPE Connect (Android)

**Updated:** 2026-08-10

**Working on right now:** Building the safety net that tells us automatically when a change to the
app has broken something, so we stop finding out from the field.

**Done this week:**
- The app no longer tells staff their attendance, task or account change was saved when it never
  reached the server. It now says plainly that it did not save, and keeps their shift open.
- We can now check, in under a second and without a phone, that the four riskiest pieces of
  behind-the-scenes logic still behave correctly: who gets contacted about a policy renewal,
  whether someone is close enough to the office to clock in, what each role sees on their home
  screen, and how far along a task is.
- That check runs 140 separate scenarios, including the awkward calendar cases — the year
  boundary, the 29th of February in a non-leap year, and month-end dates.
- We proved the safety net actually works by deliberately breaking a calculation and confirming
  the check caught it, then putting it back.
- We wrote down roughly twenty places where the app is currently wrong, as scenarios that will
  alert us the moment each one is fixed. Nothing is silently accepted any more.

**Blocked on:** Two things, both waiting on people outside this work.
1. The account-deletion promise. The backend cannot delete an account today, and the team building
   it needs a business answer before they start: exactly what our Play Store listing promises, in
   what timeframe, and whether "account closed and personal details removed, business records
   kept" is acceptable wording. That is a legal and commercial question, not a technical one.
2. One round of hands-on checking on a real handset with the phone in flight mode, to confirm last
   week's attendance fix behaves correctly in the field. It cannot be checked on a computer.

**Next:** Fix the alerting so that when the server is unreachable, staff see a clear "could not
load" message instead of a screen of convincing-looking zeroes.
