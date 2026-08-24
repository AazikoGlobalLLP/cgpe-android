# Status — CGPE Connect (Android)
**Updated:** 2026-08-24
**Working on right now:** Went through all 12 issues you listed, checked each one against how the app actually works, and turned them into a clear, prioritized plan — and built a new app version that carries the recent fixes to your phone.

**Done this week:**
- Built a new installable app version that bundles all the recent improvements (attendance fix, the whole-team map, the new task views, typo-tolerant search, and more) so they finally reach real phones. It comes with a step-by-step testing guide.
- Studied every one of your 12 points properly instead of guessing, and wrote each up in plain terms with a priority. A few turned out to be more serious than they first looked:
  - "Reports don't work" is partly a real app bug (the app gives up after 12 seconds, but a report takes 15–40 seconds to build) — fixable — and partly a server switch that still needs turning on.
  - Right now **any team member can see your entire client list**. Hiding the menu doesn't stop it — the server itself hands the whole book to everyone. Fixing it needs a decision from you plus a server change.
  - The role/permission system is fully built but was **never set up**, so most people still see everything.
  - Ordinary team members currently **can't create their own tasks** even though the app invites them to.
  - Document upload in Claims has no "choose a file" option, and photos fail to save because file storage isn't switched on on the server.

**Blocked on (needs you):**
- Three server switches only your side can flip: the report service, file storage for uploads, and WhatsApp live-sending.
- A few decisions: what a normal team member should be allowed to see in Clients, the exact access list per role, and whether team members may create their own tasks.

**Next:** I start building the app-side fixes I can do without waiting (beginning with the report timeout bug), while you work through the short list of decisions and server switches above — the full plan is written down and prioritized.
