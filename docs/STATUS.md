# Status — CGPE Connect (Android app)

**Updated:** 2026-08-26

**Working on right now:** Planning the voice assistant and fixing the small things in the app that look
broken to the team.

**Done this week:**
- The bottom menu of the app changed: the big **Search** button now sits where "Clients" used to be, so
  anyone can find any record from anywhere. Clients moved into the "More" menu, where only managers can
  see it. (This is written and tested, but it is **not on anyone's phone yet** — it needs a new app
  install to reach them.)
- Finished a deep study of how the **voice assistant** should work — which service should listen to
  Gujarati and Hindi speech, which should speak back, what it will cost each month (about **₹6,000 for
  the whole team of 21**), and how to make sure a team member cannot use voice to see information they
  are not allowed to see. Every price and claim in that study was double-checked by a second review.
- Went through the **nine problems the owner reported** and found the real cause of each one, instead of
  guessing. Three of them turned out **not to be app problems at all**: the LIC plans showing "Unnamed"
  are missing their names in the company's own plan data; the rule that only the Super Admin sees staff
  location is **already working correctly in the app** (the issue is in the web admin panel); and the
  request to show different menus to the Operations and Sales teams is **already supported** — it just
  needs to be switched on in the admin panel.
- Wrote a complete, step-by-step plan splitting all of this into seven numbered stages, with a clear list
  of what the owner needs to provide before each one can start.

**Blocked on:** Several things now need the owner before work can continue — the voice web address from
the automation tool, an ElevenLabs subscription and the two chosen voices, the storage server details for
fixing file attachments, a Google Play developer account, and the correct names for the LIC plans.

**Next:** Fix the four visible problems that need nothing from anyone else — the screen going blank when
returning from the "More" menu, the opening screen, the "Unnamed" plans, and the app growing to 125 MB —
then release one new app version containing all of it.
