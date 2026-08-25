# Status — CGPE Connect (Android)
**Updated:** 2026-08-25
**Working on right now:** Making the Payroll screen show the whole team, and letting the owner account see each person's bank details safely.

**Done this week:**
- Payroll used to show only one person. It now lists **everyone on the team**. Anyone whose salary hasn't been set up yet shows a clear amber **"Data pending"** label instead of just being missing — so you can see at a glance who still needs setting up.
- The owner account can now see a member's **bank details** (account holder, bank, account number, IFSC) on their payroll page. The account number is **hidden except the last 4 digits** and only shows fully when tapped. **Aadhaar and PAN are never put on the phone.** Only the owner account sees any of this — ordinary managers do not.
- All automated checks pass, and the work is saved to the shared code space.

**Blocked on:** Nothing on our side. For the rest of the team to show actual pay (not "data pending"), someone needs to **enter each person's salary once** in the admin panel — that's a one-time data-entry job, not a software fix.

**Next:** Add the ability to attach documents (files/photos) — this one needs a new app install to go out, plus one server setting switched on, so it's the next thing to schedule.
