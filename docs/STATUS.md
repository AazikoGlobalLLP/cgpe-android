# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Building the 24/7 staff-location feature — this session finished the agreement (consent) screen and the piece that sends location to the server.

**Done this week:**
- Built the **agreement screen**: before using the app, each person sees a clear notice — what is shared, why, who can see it (only the master), that old data is deleted after 90/180 days, and that agreeing is required. It shows in all five languages (the owner supplied the wording) and works two ways: agree and continue, or decline and see an honest "you can't continue without agreeing" message. No hidden tracking, no way to quietly skip it.
- Built the **behind-the-scenes plumbing** that records the agreement and sends off-hours location to the server, with safe handling for every failure (e.g. if someone hasn't agreed, the app stops sending and clears what it held).
- **Confirmed the server team finished the automatic old-data deletion** we asked for (hidden after 90 days, permanently erased after 180) — checked their actual code; it does exactly what was requested, and the app needs no change for it.
- All automated checks pass. Earlier this week: agreed the overall approach with the owner and wrote the full plan.

**Blocked on:** Two server-side items must go live before the feature works end to end — the server team needs to **switch on** the two pieces they built (the agreement handling and the old-data deletion). Also, the always-on part still needs testing on real phones, which comes next.

**Next:** Wire the app so it shows the agreement screen automatically at startup for anyone who hasn't agreed, then turn on the always-on background recorder — and test all of it on real phones (Samsung/Xiaomi included), since that part can only be checked on a device.
