# Status — CGPE Connect (Android)
**Updated:** 2026-08-25
**Working on right now:** Finished the document-attach feature in Claims — staff can now take a photo, pick from their gallery, or choose a file, and if something goes wrong the app says exactly what happened instead of a vague error.

**Done this week:**
- Attaching documents to a claim now offers three clear choices — take a photo, choose from the gallery, or pick a file (PDF, Word, Excel). Before, the gallery only appeared if you refused camera access, and there was no way to pick a file at all.
- When an upload can't go through, the app now explains why in plain words — the file is too big, the wrong type, the connection dropped, or you're signed out — instead of one generic "didn't upload" message.
- The app now spots the situation where a document appears to upload but the server isn't set up to keep it, and warns "the server won't keep this" rather than pretending it saved — this is the real cause behind the "my photos vanish" complaint.
- Everything passed our automated checks (978 tests green) and is saved to the shared code store.

**Blocked on:** Three things only you/the server team can do, so this reaches the team fully: (1) build and install a new app version — this feature uses a phone capability that can't be delivered as a quiet background update; (2) switch on document storage on the server — until then uploads still don't persist (the app now says so honestly); (3) decide how an uploaded file should be permanently tied to its claim.

**Next:** No app-side work is left in the current backlog that can ship without a new build — the remaining items are the new app version, the server storage switch, and larger new features (goals, WhatsApp automation, voice) that each need to be scoped with you first.
