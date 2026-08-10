# Status — CGPE Connect (Android)

**Updated:** 2026-08-10

**Working on right now:** Making the app tell the truth about whether something it "sent" or
"saved" actually reached the company's systems.

**Done this week:**
- **WhatsApp messages sent from the app now actually go out.** Until today, not one ever had. An
  advisor would type a message to a client, see it appear in the chat with a tick beside it, and
  the message would be rejected by the server every single time. Nobody could have known: the app
  showed exactly the same thing whether it worked or not. Anyone who has been messaging clients
  from the app should be told that those messages were never delivered.
- **A message that does not go out now says so**, in plain words, and puts the text back in the
  typing box so it is not lost. Four different reasons get four different explanations, because
  what the advisor should do next is different in each case — retry, change the number, or send it
  from WhatsApp themselves.
- **We found that "the server said OK" does not mean "the message was sent".** The system records
  the message before it hands it to the messaging service, and answers OK either way. The app now
  reads the part of the answer that says what actually happened. We have asked the backend team the
  one question we cannot answer ourselves: whether the messaging service is switched on in
  production at all. If it is not, messages from *every* part of the business — the admin panel
  included — are being recorded and never sent.
- **Opening a client chat directly from a notification or a fresh start now works.** Before, the
  call button, the "Open in WhatsApp" button and sending were all dead in that situation.
- The automatic safety net grew from 188 checks to 219, and all of them pass. We also deliberately
  broke our own code three times to confirm the new checks would actually catch the mistakes they
  were written for.
- **A near-miss worth recording.** The shared file the three teams use to send each other questions
  quietly lost 5.7 KB of content while this session was reading it, including two of our previous
  answers, which reverted to looking unanswered. The backend team would have concluded we had
  ignored them and held their work. We re-checked and re-wrote both answers, and warned the other
  two teams to check their own. That file has no backup of any kind — see Blocked on.

**Blocked on:** Three things, all needing a person rather than more work.
1. **Nothing has been saved to the company's central code storage for five rounds of work.** The
   account it is trying to use does not have permission to write to this project. All the work is
   safe on this machine, but it exists in exactly one place. Someone with access to the GitHub
   account needs to grant permission or replace the saved credential.
2. **The shared contracts folder the three teams depend on is not backed up anywhere**, which is why
   the near-miss above was unrecoverable. Fixing it properly means deciding how the three projects
   should be stored, which is not a decision one team should make alone.
3. **Hands-on checking on a real handset.** Three rounds are now owed — attendance, the outage
   messages, and this week's WhatsApp work. None of them can be checked on a computer, because they
   involve flight mode, GPS and the phone's own vibration.

**Next:** Fix location tracking and the clock-in boundary, so that a staff member is not wrongly
refused clock-in when the app cannot check where the office is.
