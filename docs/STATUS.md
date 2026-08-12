# Status — CGPE Connect (Android)
**Updated:** 2026-08-12
**Working on right now:** Added a live "MDRT tier progress" section to the Commissions screen so advisors can see how close they are to their next achievement level, and confirmed how the app's screen layouts are controlled.

**Done this week:**
- Added a real, live section to the Commissions screen: an advisor now sees their first-year business total, the achievement tier they've reached (Quarter MDRT up to Top of the Table), and a progress bar to the next one. It shows correct figures straight from the server even though the "money earned" part of that screen is still waiting on a server change — so the screen is no longer empty for advisors. It only appears for the roles it makes sense for, and never shows a made-up number.
- Answered the owner's question about how the app is laid out: the *structure* — which cards appear on the home dashboard, in what order, which tabs show, what's hidden, and what each role can do — is controlled by a per-role setting stored on the server and editable from the Admin Panel without shipping a new app. The *look of each screen* (the actual designs) is built into the app. If the server is unreachable, the app safely shows the full menu rather than a blank screen.
- Built the personal "My earnings" screen earlier this week (each person sees their own pay for any of the last 12 months, worked out on the server).

**Blocked on:**
- The "money earned" figures on the Commissions screen still wait on a server change before they can show real numbers. (The new tier-progress section is not affected and is live.)
- The two new screens (tier progress and pay) should be checked by hand on a real phone before being trusted widely — the one thing automated tests can't do.
- Someone to supply the correct Gujarati / Hindi / Roman-script wording for the remaining repeated labels; that translation batch stays paused by choice until the wording arrives.
- Finished work still can't be uploaded to GitHub — the saved login on this machine lacks permission. Everything is saved safely on this machine meanwhile.

**Next:** Hand the two new screens to someone with a phone for a real-world check, and wait on the server change for the Commissions "money earned" figures and on the wording for translations.
