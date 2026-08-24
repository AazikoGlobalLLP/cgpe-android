# Status — CGPE Connect (Android)

**Updated:** 2026-08-24
**Working on right now:** Making the customer list private so ordinary team members can't browse the whole client book, and tidying up the campaigns screens.

**Done this week:**
- **Locked the customer book to managers and admins.** An ordinary team member can no longer open, search, or tap through to the full client list, the "segments"/"families" views, or the campaigns audience — they now see a clear "managers and admins only" message instead of the data. Managers and admins are unaffected. (Important: to make this airtight I also need one change on the server — I've written it up in plain language for you to pass to the backend team. Until that lands, the app hides it but a very technical person could still reach it directly.)
- **Fixed a confusing campaigns error.** When someone whose role isn't allowed to send bulk WhatsApp tried to, the app used to say "Dispatch failed" as if something broke. It now clearly says their role can't send bulk campaigns and points them to message people one at a time.
- **Removed a duplicate screen.** "Premium & greetings" and "Campaigns" did the same job; the duplicate is gone and everything now opens the single Campaigns screen.
- **Confirmed the faster client-search idea wasn't needed** — the existing search already puts clients first, so no change was required there.

**Blocked on:** One server change (written up and ready for you to hand to the backend team) is needed to fully enforce the customer-list privacy. A couple of product decisions from you would unblock the next items: the list of what each role should see, and whether a few remaining screens (WhatsApp chats, support tickets, task contacts) should also be hidden from ordinary team members.

**Next:** Fix a hidden bug in the Contests feature before anyone creates a contest, or switch on the per-role menu controls once you give me the role list.
