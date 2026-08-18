# v1.10.0 — What to test on the phone

**APK (EAS build `0c648a0c`, FINISHED 2026-08-18):**
`https://expo.dev/artifacts/eas/ls-3QFiTrj-GuDt-6ot-Q7dQOuYkDcMLlt2InWDuf0s.apk`
Open that link **on the Android phone** to download + install. If Android refuses to install over
v1.9.0 ("app not installed"), **uninstall v1.9.0 first, then install** — your data is on the server,
so you only need to log in again.


This build (**v1.10.0**) adds two things on top of the v1.9.0 background-location build:
- **Map upgrades** — satellite view, show/hide points, colour-coded pins (Phase 51)
- **Break feature** — Break button after clock-in + break pins on the master map (Phase 52)

The **same background-location fix** from v1.9.0 is still in here, so you can re-check that too.

Tick each box ✅ / ❌ and note anything that looks wrong. Some need the **owner/master** login,
some need a **normal team-member** login — it's marked on each.

---

## A. Map upgrades — login as OWNER/master → open "Agent locations" (or "Movement paths")

On the map you'll see **three round buttons** stacked at the **top-right**.

- [ ] **A1. Satellite view.** Tap the **globe** button. The map turns into **real satellite photos with road/place names on top**. A small "Imagery © Esri" mark shows in the corner. Tap again → back to the normal street map.
- [ ] **A2. Is the satellite clear enough?** Zoom in on your office area — is it sharp/detailed enough to be useful? (Note: this is the best free satellite; it is not the exact Apple Maps imagery.)
- [ ] **A3. Show / hide points.** Tap the **eye** button. The dots/pins **disappear**; tap again → they **come back**. On "Movement paths" the travel **line stays** even when dots are hidden.
- [ ] **A4. Pin colours + legend.** Clock-in pins are **green**, clock-out pins are **red**. The little legend under the map reads **green / orange / red**.

---

## B. Break feature — login as a NORMAL team member → Home → clock in first

- [ ] **B1. Two buttons.** After you **clock in**, the Home card shows **two buttons side by side: "Break" and "Clock out"**.
- [ ] **B2. Break under 8h 30m.** Tap **Break** before you've worked 8h30m → it goes **straight to a reason box** (no extra question). You can **Skip** (start break with no reason) or **type a reason** and **Start break**.
- [ ] **B3. Break after 8h 30m.** If you've already worked **8h30m or more**, tapping **Break** first asks **"You've done 8h 30m — take a break, or clock out?"** Only after you confirm does the reason box appear. *(Hard to test in one sitting — check whenever someone has done a full shift.)*
- [ ] **B4. End break.** While on a break, the button now says **"End break"**. Tap it → the break ends and it goes back to "Break".
- [ ] **B5. Language.** Switch the app language (Settings) to **Gujarati / Hindi** and check the Break, End break, reason box and the 8h30m message all appear **in that language**.
- [ ] **B6. Clock out during a break.** Start a break, then tap **Clock out** → it should clock you out cleanly (the app quietly ends the break first).

---

## C. Orange break pins on the master map — needs the backend restart

> ⚠️ **This only works after the backend team restarts their server (`:3001`) on the new build.**
> If the orange pins don't show yet, that's the restart, not the app. Please confirm with the backend dev first.

- [ ] **C1.** Have a team member **take a break** (section B). Then, logged in as **owner/master**, open **"Agent locations"**. Their break location shows as an **ORANGE** pin.
- [ ] **C2.** Tap the orange pin → it shows **who**, **"Break started / ended" + time**, and the **reason** they typed.
- [ ] **C3.** Someone **currently on a break** shows a slightly **bigger** orange pin.

---

## D. Background location (same as v1.9.0 — re-confirm if you like)

- [ ] **D1.** With the phone settings applied (Location = **Allow all the time**, Battery = **Unrestricted**, Auto-start **ON**), the app keeps recording location **after you swipe it away**. A full swipe-away can leave a gap of up to ~15 minutes before it re-arms — that's expected.

---

## Notes / problems (write anything here)

-
