# CGPE Connect — Device Testing Guide

**APK:** v1.10.0 preview (EAS build `8f3238fa-deb5-41dc-ab58-5221f036d36d`)
**Covers the 2026-08-19 batch:** Phase 63 (background location), 64 (Monitor on-duty + map honesty), 66 (Live location), 67 (Payroll detail) — plus a full regression pass of everything already shipped.
**Written for:** the owner, to test **on a real phone**. Everything below is a thing that **cannot be verified in the editor or by automated tests** — it needs a real device, a real login, a real role, real GPS movement, or real backend data.

---

## How to use this guide

Each test is a checkbox. Under it:
- **Do** — the steps.
- **Expect** — exactly what a correct app shows. If you see something different, it's a bug — note the screen + what you saw.
- **Edge / unexpected** — the weird cases that are the whole reason for this document. These are where apps usually break.

### Why the editor cannot test these (markers)

| Marker | Meaning — why it needs YOU on the phone |
|---|---|
| 📱 **native** | Uses a real device feature (GPS, notification bar, biometric hardware, haptics, WebView map). The editor and the test-suite only run pure logic. |
| 🖐 **physical** | Needs real-world movement or a real place (walk a route, stand at the office, kill the app, reboot). No amount of code can fake it — and fake-GPS is deliberately **blocked** by the app. |
| 🔒 **role** | Only shows for a specific real login (Master / Admin / Leader / Advisor). The editor has no accounts. |
| 🌐 **backend** | Needs real data on the live server (real staff clocked in, real payroll profiles, real leads). |

### Accounts you'll need
- **Master** — your `super_admin` account (the same one that logs into the admin panel). This unlocks Monitor, Live location, Team performance, full Payroll, Viewing-as.
- **Advisor / member** — an ordinary field-team account. This is what most of the team uses.
- **Leader** and **Admin** — if you have them, they prove the "leader trap" cases (a leader must NOT see Master-only screens, and must NOT get a blank 403).
- If you only have the Master account, do the Master column now and hand an advisor's phone the advisor column later.

### Before you start — connectivity sanity (do this first)
- [ ] 🌐 On the **same Wi-Fi the phone will use**, open a browser on the phone and go to **`https://cgpe.in/internal/api/health`**.
  - **Expect:** a small `{"status":"ok"...}` style JSON page loads.
  - **If it does NOT load here**, the app will also fail — that's the Wi-Fi/network blocking `cgpe.in` (captive portal, firewall, or no real internet), **not the app**. Switch to mobile data or a different network and retry. Do not report "app doesn't work on Wi-Fi" until this page loads on that Wi-Fi.
- The app talks only to `https://cgpe.in/internal/api`. There is **no offline/demo mode** — every screen needs the internet.
- The network timeout is short (**4.5 seconds per request**). On a very slow connection a screen may show the outage state even though the server is fine — see §22.

---

## 0. Install & first launch  📱

- [ ] Install the APK (open the link on the phone → Install → allow "install from this source" if asked).
  - **Edge:** if it refuses, an **older CGPE Connect must be uninstalled first** (signing/downgrade). Uninstalling loses nothing on the server; you just log in again.
- [ ] Cold-launch the app.
  - **Expect:** splash → either the **login** screen (if logged out) or straight to **Home** (if a session is remembered).
  - **Known stale label — NOT a bug:** if any About/Settings screen shows an app version, it may read **`1.8.0`** (a hard-coded in-app string that wasn't bumped). The **actual installed build is v1.10.0**. Don't report this as a version mismatch.
  - **Edge / unexpected:**
    - Kill the app fully and reopen → should NOT crash, should NOT flash the login screen for a logged-in user, should NOT lose your language choice.
    - Launch with **airplane mode ON** → app opens, screens show the honest outage state (see §22), **no crash, no fake data**.
    - Rotate the phone / switch to dark mode mid-use → layout must not break or clip text.

---

## 1. Login, session & app-lock  📱🔒

- [ ] **Password login.** Enter your number + password.
  - **Expect:** lands on Home; your name/greeting is correct.
- [ ] **OTP login.** Switch the segmented control to OTP, request code, enter it.
  - **Expect:** same successful landing. **Edge:** wrong OTP → clear error, not a silent hang; expired OTP → honest message; request OTP on a slow network (login also uses the 4.5 s timeout) → if it times out, an error you can retry, never a spinner forever.
- [ ] **Wrong password / unknown number.**
  - **Expect:** a specific, readable error. Never "success then stuck", never a blank Home.
- [ ] **Biometric unlock (App Lock).** 📱 With a fingerprint/face enrolled, background the app and return, or relaunch.
  - **Expect:** the App-Lock overlay asks for fingerprint/face; on success → the screen you left; on cancel → stays locked, no data visible behind it.
  - **Edge:** fail the fingerprint 3× → honest fallback, not a lockout of your own data; enrol a NEW fingerprint on the phone then reopen → app should fail-closed (re-authenticate), never auto-open.
- [ ] **Biometric session restore after logout-by-time.** 📱🔒 This is the "come back 2 days later" case.
  - **Do:** stay logged in, don't log out, leave it 24h+ so the session quietly expires, reopen, tap **"Unlock with fingerprint"** on the login screen.
  - **Expect:** you're back in your OWN account with only fingerprint — no number, no OTP.
  - **Edge / unexpected (important):**
    - After an **explicit "Log out"**, the fingerprint-unlock affordance must **NOT** restore you — explicit logout always forces a full login. (Silent time-expiry restores; deliberate logout does not.)
    - After **30 days**, restore must stop working — full login required.
    - Trying to restore on a **different phone** must fail.
- [ ] **Logout.**
  - **Expect:** returns to login; reopening does not silently re-enter; the biometric binding is gone (see the explicit-logout edge above).
- [ ] **Session expiry mid-use.** 🌐 If the server rejects your token while you're on a screen.
  - **Expect:** you're sent to login with an honest "session expired" — never a screen full of blanks pretending to be data.

---

## 2. Location consent & permissions  📱🖐

This is the 24/7 location wall. Copy exists in all 5 languages.

- [ ] **First-run consent wall.** 🔒 As a field account that requires tracking.
  - **Expect** the consent screen states, in the chosen language: location is shared **24 hours a day including outside working hours**; **only the company Master** can see it (colleagues cannot); history is **hidden after 90 days, permanently deleted after 180 days**; a **status-bar notice** stays visible whenever sharing is on; it is **mandatory** — declining means you cannot continue.
  - Two buttons: **I Agree** / **I do not agree**.
- [ ] **Decline.**
  - **Expect:** you cannot proceed into the app; honest "required to continue" message. No half-open state.
- [ ] **Agree, then grant OS location "Allow all the time".** 📱
  - **Expect:** you reach Home; a persistent location notification appears in the status bar.
- [ ] **Revoke background location from Android settings while consented.** 📱🖐 (the anti-circumvention case)
  - **Expect:** the app detects it, **notifies the Master** (a loud opt-out), stops tracking, and shows the block/consent wall on next open until you turn location back on.
  - **Edge / unexpected:**
    - Turn the **device Location toggle OFF entirely** → app shows the full-screen **location-blocked** overlay (in your language) with a button to open settings; pressing back does not sneak past it.
    - **Fake-GPS / mock-location app** 🖐 → those points are **dropped**, never recorded (they show as a gap to the Master, not as a fake route). The app must not accept a mocked location.
    - Grant only **"While using the app"** (not "all the time") → background tracking cannot work; the app should be honest that always-on is required, not silently pretend it's tracking.

---

## 3. Clock-in / Clock-out & geofence  📱🖐🌐

Two Surat offices are allowed (Adajan / Katargam), **200 m** radius each. The office pins live in the panel/DB (not in the app).

> **Precondition:** the two office coordinates must be set on the server (`PUT /geofence`) and the attendance webhook configured, else the geofence has nothing to measure against. If pins aren't set yet, clock-in falls back to the honest "can't verify fence" behaviour rather than refusing.

- [ ] **Clock in standing INSIDE an office (within 200 m).** 🖐
  - **Expect:** clock-in succeeds; Home hero flips to the clocked-in state; the "Today" attendance card reflects it.
- [ ] **Nearest-office logic.** 🖐 Stand near office B (Katargam) and clock in.
  - **Expect:** it measures the **nearest** office and allows it. (Bug it fixes: the old build refused someone standing at office B because it only knew office A.)
- [ ] **Clock in OUT of range (more than 200 m from both).** 🖐
  - **Expect:** clock-in is **allowed but demands a reason**; you type a reason; the **Master (super_admin) is notified**. It is not silently blocked, and not silently allowed.
- [ ] **Clock OUT early (before shift end) — 15-minute grace.** 🖐
  - **Expect:** clocking out **more than 15 minutes** before shift end **demands a reason** → Master notified. Within 15 minutes of shift end → no reason needed.
- [ ] **Clock out OUT of range.** 🖐
  - **Expect:** allowed but requires a reason (clock-out is never refused, only reason-gated).
- [ ] **Edge / unexpected:**
  - Reason prompt must appear in **all 5 languages** (this UI copy is owner-supplied; if any language shows English or a blank, that's a bug).
  - Clock in with **GPS still "searching"** (weak fix) → it should wait for a real fix or tell you honestly, not clock in at (0,0) or the wrong office.
  - Double-tap clock-in fast → must not create two sessions.
  - The client pre-check must **never refuse what the server would allow** — if in doubt it defers to the server. A refusal message should quote a real measured distance, not a generic radius.

---

## 4. Break feature  📱🌐

After clocking in, the Home hero shows **Break** + **Clock out**.

- [ ] **Start a break** (normal, before 8h30m worked).
  - **Expect:** goes straight to an **optional-reason sheet**; you can add a reason or skip; hero now shows **End break**.
- [ ] **Start a break AFTER 8h 30m worked.**
  - **Expect:** a **confirmation gate** appears FIRST (are you sure — you've worked 8½ hours), then the optional-reason sheet.
- [ ] **End break.**
  - **Expect:** hero returns to Break + Clock out; the break's duration and location are recorded.
- [ ] **Clock out WHILE on a break.**
  - **Expect:** the app **ends the break first** (so its duration + location are saved) and then clocks you out — the break is not silently discarded.
- [ ] **Edge / unexpected:**
  - Break reason sheet in all 5 languages.
  - Start break → force-close app → reopen: state should be honest (still on break, from the server clock state), not reset.
  - Break location shows as an **orange** pin on the Master's map (see §8) — green = clock-in, red = clock-out, orange = break.

---

## 5. Background location tracking (Phase 63 — the batch's #1)  📱🖐

This is the "phone 20 hours chala, sirf 8 km / seedhi line dikhi" case. It can ONLY be judged over a **real shift on a real phone** — no editor or test can see it. Give it a proper multi-hour run.

**What changed in this build:** while clocked in, the app now records a point roughly **every ~60 seconds even when the phone is completely still**, at **high accuracy (~10 m)** so points survive the server's accuracy filter (which the backend has now relaxed to keep fixes up to **1000 m**). Off-duty ("ambient") tracking uses a **coarser** profile to protect battery and privacy. The offline buffer holds about **720 points (~12 hours)** if the network drops.

- [ ] **A stationary clocked-in phone still records a route.** 🖐 Clock in, leave the phone on a desk for 30–60 min.
  - **Expect:** the Master's map/track for you shows points accumulating over time (not a single dot, not nothing). Previously a still phone recorded nothing.
- [ ] **A walked/driven route is dense and follows the road.** 🖐 Clock in and move for 20–30 min.
  - **Expect:** the replay (§8, agent-track) traces your actual path with regular points — **not** two dots joined by a straight line across the city.
- [ ] **The service survives the app being killed.** 🖐 Clock in, then swipe the app away from recents. Wait, keep moving.
  - **Expect:** tracking continues (status-bar notice stays); after you reopen, the gap is small.
  - **Reality to accept:** on aggressive-battery phones (Xiaomi/Realme/Oppo/Samsung with battery-saver), a kill can cause a gap until the watchdog re-arms — honestly **up to ~15 minutes**, not seconds. That's the OS, not a bug, but it's why the next test matters.
- [ ] **The service re-arms after a reboot.** 🖐 Clock in, reboot the phone, don't open the app for a while, keep moving.
  - **Expect:** within ~15 min of boot, tracking resumes on its own (WorkManager watchdog), no need to open the app.
- [ ] **Battery is not destroyed.** 🖐 Run a full working day clocked in.
  - **Expect:** meaningful but not alarming battery use. If it drains the phone in 3–4 hours, that's a finding.
- [ ] **Any phone brand.** 🖐 Owner explicitly asked: Android/Samsung/etc. Test on at least 2 different brands if possible; the aggressive-OEM brands (Xiaomi, Realme, Oppo, Vivo) are the ones to watch.
  - **Setup that matters:** the app must be set to **"No restrictions" / "Don't optimize"** battery, and **autostart** enabled where the brand has it. Note which brands need this.
- [ ] **Edge / unexpected:**
  - **This APK profile only takes effect at the next service (re)start.** If you were already clocked in on the old build, **clock out and clock in again** (or reinstall) so the new denser profile loads. A phone that never clocked out won't show the change.
  - Off-duty movement should record **coarsely**, not the same dense ~10 m home tracking (privacy + battery). If your home is traced at 10 m all night, that's a finding.
  - A shift longer than ~12 hours fully offline may hit the buffer ceiling (720 points) — expect the oldest points to be the ones at risk, not a crash. (Continuous >12h offline upload is a known follow-up.)
  - iOS (when it exists) **cannot** match Android's always-on-after-force-quit — that's an OS limit, a separate future build. This APK is Android.

> **If §5 still shows a straight line / big gaps:** confirm (a) you clocked out+in on THIS build, (b) battery is unrestricted for the app, (c) location is "Allow all the time", (d) the phone browser reaches `cgpe.in/health`. Only if all four are true and it still fails is it an app finding.

---

## 6. Home dashboard  📱🔒

- [ ] **Greeting + time-of-day emoji.**
  - **Expect:** 🌅 before 12, ☀️ 12–5 pm, 🌆 after — beside the greeting, correctly for the current time, in every language (one emoji serves all languages).
- [ ] **KPI strip / widgets by role.** 🔒 Log in as different roles.
  - **Expect:** the widget list, hero mode, and quick actions change per role (the layout is server-driven). An admin-panel layout change should reflect on the phone after a relaunch (the owner already confirmed this once).
  - **Edge:** if the config server is slow, Home should **fail open** to the full menu within ~3.5 s, never a blank dashboard.
- [ ] **Quick actions** (clock-in hero, create task, team roster, org analytics) appear only when the role's flags allow.

---

## 7. Master monitoring — "the main side"  🔒🌐📱

All of this is **Master (super_admin) only**. Log in as your Master account.

- [ ] **Monitor hub.** More → **Monitor** (top of the Master group).
  - **Expect:** a 2×2 lens grid — **Locations first** (Movement), Performance, Payroll — then the team roster with on-duty counts. Tapping a member opens their detail. **No task UI here** (deliberate).
  - **Edge:** an **Admin or Leader** must NOT see the Monitor tile, and deep-linking `/monitor` as them shows **"Owner access only"**, never the hub.
- [ ] **On-duty / live field status counts.** 🌐 (Phase 64) With real staff actually clocked in.
  - **Expect:** the on-duty count and field-status reflect who is really clocked in — **not 0** when people are clocked in.
  - **This depends on the backend deploy that's now live** (clock-in coordinates are surfaced). If it still shows 0 while people are genuinely clocked in with GPS, that's a finding to escalate.
- [ ] **Agent map — pins.** 📱 (Phase 51/64) Open the movement/agent map.
  - **Expect:** clock-in pins **green**, clock-out **red**, break **orange**; a legend that matches; each pin at a real location.
  - **Edge:** if the map service can't be reached it should say so honestly, and a **404/empty** for break-points should be a **quiet empty**, NOT a red "server did not answer" banner (Phase 64 fix). A real 5xx/network fault DOES banner.
- [ ] **Agent track — replay.** 📱🖐 Open a member's GPS replay.
  - **Expect:** the route line + direction arrows trace the real path (see §5). Master-only.
- [ ] **Live location button.** 🔒🌐 (Phase 66) On a member's detail (`team/[id]`), the master-only **Live location** card.
  - **Expect:** a Sheet with an **honest last-known** readout: how fresh it is ("2 hours ago"), whether they're really on/off duty, the accuracy, and copyable coordinates.
  - **Edge / unexpected (important — this is a truthfulness feature):**
    - It must say **last-known**, not pretend it's a live real-time ping (there's no real-time ping without FCM — a separate future build).
    - A member who never shared location → an honest "no location yet", NOT a pin at (0,0) or a fake spot.
    - An **off-duty** member's point must not be labelled green "Clocked in".
    - A Leader/Admin must not see this card at all.
- [ ] **Team performance.** 🔒🌐 (Phase 45) More → Team performance (Master), and "My performance" (everyone).
  - **Expect (self):** every member sees their OWN score. **Expect (team):** only Master sees the ranked roster.
  - **Score rules:** only **manager-assigned AND actually-completed** tasks count — reminders, self-created, and cancelled tasks do **not** count. A member with no tasks shows **"—" / "no tasks"**, never **0%**. Late completion scores half.
  - **Edge:** an Admin/Leader opening `?view=team` → "Owner access only", never a roster.

---

## 8. Maps (the WebView map)  📱

- [ ] **Satellite toggle.** Top-right control → satellite.
  - **Expect:** hybrid satellite imagery with labels; an **"Imagery © Esri"** style credit shows in satellite mode; toggling back returns to the street map. State survives a light/dark flip.
- [ ] **Show/hide points toggle.**
  - **Expect:** hides the markers but keeps the route line + arrows.
- [ ] **Pin colours** (as in §7): green clock-in, red clock-out, orange break.
- [ ] **Edge:** on a slow phone the map (WebView) may take a moment — expect a loader, not a white void; no crash if you toggle rapidly.

---

## 9. Payroll & earnings  🔒🌐

- [ ] **My earnings.** 🔒 Any staff → More → My earnings.
  - **Expect:** the caller's own salary for the month, as **one server-computed amount** — the app never multiplies or re-derives it.
- [ ] **Payroll roster.** 🔒 As Master/Admin → Payroll.
  - **Expect:** a list of employees. **If only ONE shows**, that's the known OPS gap: each employee needs a **payroll profile + segment** created on the server. It's not a phone bug — flag it for OPS.
- [ ] **Payroll detail (Phase 67 — NEW).** 🔒🌐 Tap a roster member.
  - **Expect:** a per-member breakdown — segment, **hourly / per-day rate**, office + worked hours, the server's **working-days** derivation (days / Sundays / holidays), and the **payable amount rendered verbatim** (the app only computes `absent = working − present`, nothing else). Plus, for **Master only**, that member's **completed-tasks activity** list.
  - **Edge / unexpected:**
    - A **Leader** deep-linking payroll detail must get an **honest refusal**, not a blank 403 screen (the "leader trap": leaders are folded into the admin tier for menus but the payroll endpoint 403s them — the screen must handle that gracefully).
    - If the activity report **fails to load** (timeout / 5xx / endpoint missing), it must say **"couldn't load activity"**, NOT a confident **"No completed tasks"** (empty ≠ failed — this was a real bug that was fixed).
    - Hourly rate must appear as the server's own number, never the app dividing salary by hours.

---

## 10. Leads  🌐🔒

- [ ] **List + open a lead.**
  - **Expect:** the pipeline lists leads; tapping one opens it.
  - **Edge (Phase 54 — leader trap):** a **Leader or member** opening a **teammate/firm lead** that the list showed must NOT get "This lead could not be opened" (a 403). If it still 403s, that's a backend fix pending — note it.
- [ ] **Change a lead stage.**
  - **Expect:** the new stage sticks only when the server confirms it (the write's own reply). If the server rejects, the stage reverts — it does not lie that it saved.
- [ ] **Add a lead.** Fill the form with valid data → appears in the list.
  - **Edge:** submit with empty/invalid fields → clear validation, not a crash; submit on a dead network → honest failure, not a fake "added".

---

## 11. Clients & Client 360  🌐

- [ ] **List, pagination, search.** Scroll past 100 clients; type in search.
  - **Expect:** more load as you scroll (100/page); search is server-backed; segment filters apply to loaded pages.
- [ ] **Client 360 — matured policy.** 🌐 Open a client with a policy whose maturity date is in the **past**.
  - **Expect:** that policy reads **"Matured"**, not "In force"; and it shows **no** "premium due / X days late" reminder (a matured policy can't be overdue). An in-force overdue policy still shows its reminder.
  - **Edge:** a policy with a **missing/garbage maturity date** stays "In force" — that's a data issue, not a bug.

---

## 12. Claims  🌐

- [ ] **Register (list) + a claim's detail.**
  - **Expect:** claims list and open. **Status-advance is deliberately disabled** (no endpoint exists) — there should be no button that pretends to move a claim's status.
- [ ] **New claim.** Submit valid → appears; invalid → honest validation.

---

## 13. Tasks  🌐

- [ ] **The 5 filter views** (today / upcoming / etc.).
  - **Expect:** each view lists the right tasks; counts are honest.
- [ ] **Complete / reopen a task.**
  - **Expect:** the tick is optimistic but rolls back if the server rejects; completing then reopening never flashes an impossible count like "2 / 1".
- [ ] **"Today" count.** Home and Tasks must show the **same** today number (they share one calculation) — a reopen shifts only the numerator.
- [ ] **Undated tasks.**
  - **Expect:** a task with no due date sorts under **Upcoming** and shows "–" for date (deliberate — honest, since it has no due date).
- [ ] **Ticket → task (Phase 69).** 🌐 Claim a ticket ("I'll handle this").
  - **Expect (now that backend is deployed):** it becomes a real task in the task list. If it still doesn't appear, that's the deploy/OPS item — confirm the backend restart happened.

---

## 14. Tickets  🌐

- [ ] **List, search, facets, open a ticket, reply.**
  - **Expect:** fully server-driven; no write is painted as done until the server confirms.
- [ ] **"I'll handle this"** → see §13 (becomes a task).

---

## 15. WhatsApp & campaigns  🌐📱

- [ ] **Send a message from a thread.**
  - **Expect:** the tick means **the gateway actually accepted it** (`delivery.dispatched`) — a plain 200 is NOT treated as sent. If the gateway didn't dispatch, the words return to the composer with a clear sentence; if it was only *simulated*, it says the customer hasn't received it.
- [ ] **Campaigns / premium bulk send.** Start a bulk WhatsApp job.
  - **Expect:** it runs through the in-app job runner (the JobPill), with progress; not a fake instant "done".
  - **Edge:** an outbox message on a dead network → honest failure, no false tick.

---

## 16. Commissions  🌐🔒

- [ ] **As an advisor** → Commissions.
  - **Expect:** the MDRT tier card (progress to the next tier, from the server's `target`) and a **"This year by product"** breakdown where each bar is that product's share (the app renders, never re-sums).
  - **Edge:** a **non-advisor** (FYC = 0) must NOT see a meaningless "₹0 · 0% to Quarter MDRT" card — they see neither the tier card nor the product bars.

---

## 17. Search  🌐

- [ ] **Global search** across clients, leads, claims, tasks, tickets.
  - **Expect:** ranked fuzzy results; clients+tickets server-side, others matched locally. **Edge:** a query with no matches → honest empty, not a spinner; special characters don't crash it.

---

## 18. Notes, notice board, notifications  🌐📱

- [ ] **Notes board** (create / edit / delete a private note). Voice-note provenance (Gujarati transcript disclosure) renders if present.
- [ ] **Notice board** (read-only company bulletins) loads.
- [ ] **Notifications feed + bell dot.** 🌐
  - **Expect:** unread shows a dot; marking read clears it (Phase 37). **Edge:** the count must match the list; marking one read shouldn't clear all.

---

## 19. Other screens (regression)  🌐

Quick "does it load + is it honest on outage" pass:
- [ ] Analytics (deltas compare to the previous in-session reading — no server history).
- [ ] Calendar, Reminders, Attendance (the date-spine views; Attendance "Today" mirrors what Home wrote).
- [ ] Families, Prospects, Segments.
- [ ] KB, LIC plans, Contests.
- [ ] Account (DPDP / delete-account), Settings, Profile (read-only).
  - **Edge for delete-account:** it must honestly succeed or fail against the server — never a fake "deleted" (this was on the historical write-honesty list; confirm it reflects the real result).

---

## 20. Languages (i18n)  📱

Five languages: **English, ગુજરાતી (Gujarati), हिन्दी (Hindi), Hinglish, Roman Gujarati**.

- [ ] **Switch language** (Settings) and walk the main screens.
  - **Expect:** labels change everywhere they're wired. Consent, break, and clock-reason copy exist in all 5.
  - **Edge / unexpected:**
    - Some screens are still ~English-only (a known, in-progress rollout) — note any screen that shows a raw key like `common.tryAgain` instead of words (that IS a bug).
    - Hindi/Gujarati **word order** with names/counts must read naturally (the app interpolates, never glues words together) — e.g. a greeting with your name shouldn't read backwards.
    - A Gujarati string that accidentally shows the **English** sentence is a copy gap — note it (the test-suite cannot catch this; only a human reader can).

---

## 21. Network resilience & the outage banner  🌐📱

The app must **never fabricate data** on failure — a failed read shows empty **and** says why.

- [ ] **Kill the network mid-use** (airplane mode) and move between screens.
  - **Expect:** a single global **outage banner**; empty states say "could not load" (degraded), which is different from a genuine "you have no clients". No screen shows "0 clients · ₹0" as if it were a fact.
- [ ] **Very slow network.** 🖐
  - **Expect:** because each request times out at **4.5 s**, a slow-but-alive connection may show the outage state. Note if this happens on an otherwise-working connection — it's the known aggressive-timeout lever (a future raise + retry is planned).
- [ ] **"Server did not answer" honesty (Phase 64).**
  - **Expect:** a missing endpoint (404/501) is a **quiet** empty answer, not a red outage banner; only a real server error (5xx) or network drop raises the banner. If you see the banner while everything else works, note which screen.
- [ ] **Recover the network** → pull to refresh → data returns, banner clears.

---

## 22. Viewing-as (Master only)  🔒

- [ ] **As Master**, More → Viewing as → pick Admin or Team.
  - **Expect:** you preview the lower tier's menu, and can switch back. It can only ever go **downward** (a preview can't escalate you).
  - **Edge:** an **Admin or Leader** must NOT see the "Viewing as" row at all (Master-only, Phase 47). If they do, that's a bug.

---

## 23. Cross-cutting edge & unexpected cases  📱🖐

Run these against several screens — this is where real-world bugs hide.

- [ ] **Rapid double-taps** on any submit/clock/send button → one action, never two.
- [ ] **Back button** during a modal/sheet/App-Lock → closes the sheet, never leaks the screen behind a lock.
- [ ] **Rotate + dark mode** on data-heavy screens → no clipped text, no broken layout, both themes readable at small width.
- [ ] **Token expires while a write is in flight** → the write fails honestly and you're sent to login; it does not report "saved".
- [ ] **Background the app for a long time** then return → session and language intact; no crash; tracking (if clocked in) continued.
- [ ] **Low battery / battery-saver ON** 🖐 → note whether tracking survives; some OEMs kill it (see §5).
- [ ] **Change the phone clock / timezone** → dates, "Today", and shift/greeting logic don't go haywire.
- [ ] **Two accounts on one phone** (log out, log in as another) → no data from the first account leaks into the second; tracking attributes to the right person.
- [ ] **Airplane mode → action → back online** on writes (clock-in, task complete, WhatsApp) → nothing is silently lost or silently faked.

---

## What this build does NOT change (set expectations)

- **iOS** is not in this APK (Android only). iOS always-on-after-force-quit is an OS limit + a separate future build.
- **Real-time live location** (a live moving dot) needs push infrastructure (FCM) the project doesn't have yet — "Live location" is **last-known**, honestly labelled.
- **Offline mode** (working with no internet) doesn't exist yet — every screen needs the network.
- Some screens are still English-only pending human-translated copy.
- A **>12 h fully-offline shift** may exceed the on-device point buffer — a known follow-up.

---

## How to report a finding

For anything that fails, note: **screen name · what you did · what you expected · what you saw** (a screenshot helps). Group them by section number above. The GPS/geofence/monitor items (§3, §5, §7) are the batch's priority — test those most carefully, on more than one phone brand.
