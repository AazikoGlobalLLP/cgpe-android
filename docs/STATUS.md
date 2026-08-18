# Status — CGPE Connect (Android app)

**Updated:** 2026-08-18

**Working on right now:** Turning the owner's latest list of problems into a clear, checked plan and getting the next round of fixes ready.

**Done this week:**
- The team-location map now has a **satellite view**, a button to **hide or show the location dots**, and **colour-coded pins** — green where a person clocked in, red where they clocked out.
- Added a **Break** feature: after clocking in, a staff member can take a break (with an optional reason); if they've already finished their minimum hours it first asks whether they'd rather clock out. A manager can now see **break locations in orange** on the map.
- Sent a new installable app version (**v1.10.0**) to the owner for testing, with a simple checklist of what to try.
- Went through the app carefully and confirmed the **Break reason and the orange break pins** are wired correctly.
- Investigated the owner's new list of issues (tasks not reaching the dashboard, some leads not opening, the app failing on certain networks, iPhone support) and wrote a clear plan for each — grounded in the real code, not guesswork.

**Blocked on:**
- The **orange break locations** on the manager map only appear after the server team restarts the server once (a quick step on their side).
- **iPhone support** needs an **Apple developer account (about $99 a year)** before we can build an iPhone version at all. Also, honest note: on iPhone the app will work fully for login, data, the map and fingerprint/Face unlock, but Apple does **not** allow the same "record location 24/7 even after the app is fully closed" that Android does.

**Next:** Fix the **task/dashboard mismatch** (the owner's top priority — a claimed job should appear on your own dashboard, and the counts should stay correct when a task is reopened), fix the **"lead could not be opened"** error, and make the app **hold up better on weak networks**.
