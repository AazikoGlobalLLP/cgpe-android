# Status — CGPE Connect (Android app)

**Updated:** 2026-08-26

**Working on right now:** Fixing the small things in the app that look broken to the team, and getting
those fixes onto everyone's phones.

**Done this week:**
- The **start-up screen** is fixed. The logo used to visibly jump and change size while the app was
  opening, and the line of text underneath it was too faint to read. The logo now stays exactly where it
  is, and the text is dark enough to read easily. In night mode it was worse — the logo almost vanished
  into a black background — so the opening screen is now always light, and the two opening screens match
  each other instead of flashing from white to black.
- The **LIC plans that showed "Unnamed"** now show their real plan number instead, for example "LIC Plan
  102", so an advisor can tell them apart. This is a stop-gap: the actual plan names are missing from the
  company's own plan data and only the owner can supply them. There are **eleven** such plans, not the
  eight that were reported.
- The app has a new **"Clear cached downloads"** button in Settings. This answers the complaint that the
  app grows from 63 MB to 125 MB with use. The real cause was found and it was not what anyone expected:
  every document and photo a person attaches is quietly kept a second time on the phone and was never
  deleted. That affects **everyone**. The map images, which were assumed to be the cause, only affect
  managers, because nobody else can open a map. The button is deliberately honest — it does not claim a
  number of megabytes freed, because the phone does not tell the app how much it removed, and it says
  plainly that the app's own size will not go back to 63 MB.
- The owner supplied the wording for all of the above in **all five languages**, so nothing new ships in
  English only.
- One reported problem was **re-opened rather than declared fixed**. The team reports that going to
  "More" and back to "Today" leaves the screen mostly empty. The cause written down in earlier notes was
  checked properly this week and is **wrong**, so the fix that was ready to go would have changed nothing
  while looking like a solution. Instead, two quick checks were prepared that will identify the real
  cause in about a minute — and they work on the app that is already installed, with no new version
  needed.

**Blocked on:** Two things, both needing an owner decision. **(1)** The new version cannot be built and
sent to the team: the app-building service's free monthly allowance has run out and resets on **1
September**. The choice is to wait five days or pay for the paid tier. Until then, none of this week's
work is on anybody's phone. **(2)** The eleven real LIC plan names.

**Next:** Identify the real cause of the empty-screen problem using the two quick phone checks, then
start building the voice assistant.
