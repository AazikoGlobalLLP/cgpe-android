# Status — CGPE Connect (Android)
**Updated:** 2026-08-11
**Working on right now:** Re-checked the "My salary" screen after the server team built the pay data it was waiting for — and found it is only half-ready: the salary numbers now exist on the server, but only managers are allowed to see them, so a normal staff member still can't see their own pay in the app.

**Done this week:**
- Confirmed the server team has now built the salary calculation (each person's pay worked out from their attendance). This is real progress — it's the piece the salary screen was blocked on for weeks.
- But found the catch: right now only an admin can open that salary data. A regular team member gets refused. The app's screen was always meant to show each person *their own* pay, so it still can't be built until the server allows a person to see their own figure.
- Sent the server team a short, precise request for that one missing piece — "let a signed-in person read their own already-calculated pay" — and wrote down exactly why, so it's clear and easy to act on. This is a much smaller ask than before (the hard part, the calculation, is already done).

**Blocked on:**
- The salary screen still can't be built until the server team allows a person to see their own pay (not just admins). The commissions screen is still waiting for its data too — unchanged.
- Finished work still can't be uploaded to GitHub — the login saved on this machine doesn't have permission. Someone with access needs to grant it or swap the login. Everything is saved safely on this machine in the meantime.

**Next:** Build the salary screen the moment the server team allows self-access. In the meantime, either translate more of the app (needs someone to supply the correct Hinglish/Gujarati wording) or work through the checks that can only be done on a real phone.
