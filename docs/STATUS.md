# Status — CGPE Connect (Android)
**Updated:** 2026-08-14
**Working on right now:** Setting up the "master" access for the three specified phone numbers — the accounts that should see everything (staff, locations, performance, salary).

**Done this week:**
- Worked out exactly how to make the three numbers "master". In this system "master" means the top-level account that can see and manage everything. Making a number master is a change in the database (one setting on their account), not a change in the app — so it also means those accounts can edit staff and see all information, which the owner confirmed is what's wanted. I checked the sign-in path end to end and confirmed that once the setting is changed, those phones will read as master the next time they sign in, with no app change needed. Handed the owner the exact, safe steps to make the change, plus two things to check per number (each number must belong to exactly one active account, and each person has to sign out and back in once).
- Added "mark as read" to notifications, and the unread dot on the bell now clears once nothing is left unread. If the phone can't reach the server it stays honest — it won't pretend an item is read.
- Earlier this week: confirmed there's no fake or placeholder data anywhere in the app; fixed the lock-screen freeze where "Unlock" often did nothing (worst on Samsung); and fixed the reason a task you create for yourself wasn't showing on the phone.

**Blocked on:**
- The three accounts becoming "master" needs the owner (or the server team) to make the small database change on those accounts — the app side is ready and needs nothing.
- The app still cannot be uploaded to the shared code store (an access issue on the developer's account) — all work is saved locally on this machine.

**Next:** Once the three accounts are master, restrict the live staff-location screens so only master accounts can open them, then build the master monitoring view (staff location, activity and salary in one place).
