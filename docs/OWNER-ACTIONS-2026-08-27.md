# What only you can do — 27 August 2026

Everything on the app side that could be built without you **is now built.** This page is the
short list of things that are waiting on a decision, a plug-in cable, or a server change. Each one
is written so you can act on it or forward it as-is.

Checked live on 27 August, not copied from older notes.

---

## 1. Get the finished backend work onto the live server ⭐ biggest single unblock

**The situation.** The backend team finished a batch of work that the app is already built to use.
It is written, tested and sitting in their repository — but **the live server is still running an
older version**, so none of it does anything for staff today. Verified this morning: the live server
is on the older build, and the new work is not on it.

**What is stuck behind this**
- **Video evidence does not work.** Staff can record a clip and the app prepares it correctly, but
  the live server still refuses that file type. This is the only thing standing between the feature
  and the field.
- **A photo or document attached to a claim is not properly linked to that claim.** The app sends
  the link; the older server ignores it.

**What to ask for:** merge the finished branch into the live branch, deploy it to the server, and
restart the service.

**How you will know it worked:** ask them to confirm the deploy, then tell me — I can verify it
from here in about ten seconds.

---

## 2. Turn on file storage — one line fixes today's worst bug

**The situation.** Right now, **every file anyone uploads is saved onto the server's own temporary
disk and handed back with an address that only makes sense on that machine.** That is why captured
documents "vanish" or will not open. It is not an app fault — the app already detects this and warns
the user rather than pretending the file is safe.

Verified live this morning: file storage is **still switched off**.

**Two parts, and the first one is tiny:**

- **(a) One setting — the server's own public address.** Setting this alone repairs today's
  unopenable attachments, whether or not you ever do part (b). This is the cheapest fix on this
  whole page.
- **(b) Proper file storage.** The backend now supports it, but it needs the storage account details
  entered on the server, and it needs you to decide one thing:

  > **Should claim and KYC documents be readable by anyone with the link, or only by someone signed
  > in?** These are policy scans and identity documents. **The recommendation from both the app and
  > backend sides is signed, expiring links** — not public ones.

⚠️ **One naming rule, and it matters.** When the storage area is created, **it must not be named
`uploads`.** That exact name would make properly-stored files look identical to the broken temporary
ones, and the app would warn staff their documents are unsafe when they are actually fine. Any other
name is completely fine and needs nothing from us.

---

## 3. Plug a phone in for one minute — the blank-screen bug

**The situation.** A staff member reported that going to More, then Today, sometimes shows a blank
screen. It has been investigated three times on paper. The leading theory was **disproved** — and
shipping that "fix" would have cost a release and changed nothing.

**What is needed:** a phone with the app installed, connected by cable, for about a minute. Two
quick checks then settle which half of the app is at fault, with no new app version required.

**Even without the cable, one sentence from whoever sees it would help enormously:**

> **When the screen is blank, is the row of buttons along the bottom of the app still visible?**

- Bottom buttons still there ⇒ only that one page is blank.
- Bottom buttons gone too ⇒ the whole app has fallen over.

Those two answers point at completely different causes, and knowing which one it is would save days.

---

## 4. Translations — the app can go a long way further, today

**Good news first.** A check yesterday found **117 places in the app showing English text that you
had already paid to have translated** — the words were sitting unused. **73 of those are now
switched on**, including the whole clock-in, clock-out and break flow, which every field advisor
touches every day and which until now answered in English no matter what language they chose.

**What that means for you.** A side effect is that some groups are now **half** translated — a row
of three figures where two are in Gujarati and one is still English. That looks worse than all
English, and there is one specific list of words that fixes it.

**What to send back**, in priority order — all of it is written out word for word in the
translation request document, ready to fill in:

| | what it covers | how many | why it matters |
|---|---|---|---|
| **Batch 6a** | the exact words that finish the half-translated groups | 70 | the ones people will notice first |
| **Batch 5** | the entire sign-in screen | 49 | the first thing every new joiner reads |
| **Batch 6b** | the "could not reach the server" messages | 41 | shown whenever the network is poor |
| **Batch 6c** | the More menu and the other menus | ~70 | the app's main navigation |
| **Batch 5b / 4b** | the crash screen and the video wording | 8 | quick |

**Please do not use Google Translate for these.** The app has a rule against machine translation,
and there is a real reason: the automated check can only confirm a translation *exists*, never that
it is *correct*. Four wrong entries survived for months that way.

---

## 5. Decisions still open

These block work that is otherwise ready to start.

- **Who may create a task?** Today the app invites ordinary team members to create tasks, and the
  server refuses them. One of those two has to change, and it is your call which.
- **What should each role and department actually see?** The machinery to hide menus and tabs per
  role is built and live — it has simply never been filled in, so it currently does nothing. It
  needs you to write down, per role, which sections to remove.
- **Voice assistant** — still waiting on a free five-minute test you were asked to run, plus the
  service keys. Nothing can be built until that test says whether Gujarati speech is good enough.
- **App store** — Apple is not possible without the paid developer account, which is off the table.
  Google Play needs an account created before anything else can proceed.

---

## 6. One billing question

New app versions **cannot be built until 1 September**, when the monthly free allowance resets.
Nothing is broken — the allowance is simply used up. Two options:

- **Wait until 1 September** (costs nothing), or
- **Subscribe to the paid tier** if you want a new version sooner.

**Everything built in the last three sessions is waiting on this** — it is a real amount of work,
and none of it is on anyone's phone yet.

**Worth doing in that same build:** a small addition that lets future fixes reach phones **without
reinstalling the app**. Today, every single change — even one word of text — needs a full rebuild
and a fresh install on every handset. That is slow for everyone, and this ends it.

---

## What I did not do, and why

- **I did not translate anything myself.** Machine translation is forbidden here, and the reason is
  written above.
- **I did not change how tasks are categorised**, even though those words show in English. Those
  values are stored in the database, and translating them would corrupt existing records and break
  every filter. It needs a display layer first — a code change, and a safe one, but not a copy job.
- **I did not touch the GPS sampling rate.** It is hourly because you decided it should be, knowing
  what that costs in map detail. It stays until you say otherwise.
