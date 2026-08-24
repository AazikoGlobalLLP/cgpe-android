# CGPE Connect — Device Testing Guide (2026-08-24 OTA batch)

**APK:** v1.10.0 preview · EAS build `7a384ee3-ce78-43d6-b367-bdfcffd719c9` · git `04c36d6`
**Direct install (open ON the Android phone):**
https://expo.dev/artifacts/eas/TDTciayd0aC7sfbxzd_yEn8uvxjgtRYrsSvzO8Fk-zA.apk
**SHA-256 (verify the exact build on-device):**
`f17227222fe0b63aaba8535751ce1da47f3c6762a1dc8143eb7f07222e5ebf65`

> Every `preview` APK reads **v1.10.0 / versionCode 1** in Settings — the version string can NOT
> tell two builds apart. To be certain the phone is running THIS build, pull `base.apk` over ADB and
> confirm its SHA-256 equals the hash above (method in `docs/DEVICE-TESTING-GUIDE-v1.10.0.md`).

---

## What this APK is

This is the **one APK that carries the whole accumulated OTA backlog to a phone.** Everything below
had shipped in the editor (tsc clean · 827 tests green · lint clean) but **no phone had ever run it.**
All of it is JS-only, so it's OTA-eligible, but until now nothing pushed it to a device.

**New since the last device build (`8f3238fa`, 2026-08-19):**

| Ref | What changed |
|---|---|
| **A3** | Attendance history read present/absent correctly (was "no clock-in" for every day) |
| **B5** | Master agent-map shows the **whole team**, not just members with a live GPS pin |
| **D3** | Home shows a **day-figures strip** at the top |
| **B1** | Master gets a **full per-member breakdown** |
| **D4** | Tasks gains **4 time views** — Today / Week / Month / **Calendar (default)** |
| **C2** | **Clock-out asks for a reason when you've worked LESS than 8 h 30 m** |
| **D6** | Leaner Home · first-run guide · full-width Clock-in for the team tier |
| **E2** | Report failure now **names its cause** ("not set up on server" vs a transient error) |
| **D5** | **Typo-tolerant search** — a mistyped/transposed name still finds the record |

For **everything else** (login, location consent, background GPS, geofence, break, Monitor, maps,
payroll, leads, clients, claims, tickets, WhatsApp, i18n, resilience, viewing-as, cross-cutting edges)
run the full regression pass in **`docs/DEVICE-TESTING-GUIDE-v1.10.0.md`** — it still applies, with the
two connectivity corrections below.

### Markers (why the editor can't test these)
📱 native · 🖐 physical/real-world · 🔒 role-specific login · 🌐 needs live backend data

---

## Connectivity — two corrections to the older guide

1. **Timeout is 12 s + one automatic retry** (Phase 55), **not** the 4.5 s the v1.10.0 guide states.
   A read that fails is retried once after a ~600 ms backoff before it shows the outage state. So a
   slow-but-alive network is far more forgiving than the old guide implies.

2. **"Can't reach server" on ALL networks can be a SERVER/network issue, not the app** (Phase 76).
   `cgpe.in` is IPv4-only (an `A` record, no `AAAA`). On an **IPv6-only mobile network** the traffic
   crosses carrier NAT64 on a reduced-MTU path and the app's TLS response can stall — the app then
   (mislabels a timeout as) "Could not reach the CGPE server", even though the phone **browser** loads
   `cgpe.in` fine. **First test, unchanged:** open `https://cgpe.in/internal/api/health` in the phone
   browser on that same network.
   - Loads in browser **and** app works → fine.
   - Loads in browser but the **app** fails on every network → likely the NAT64/MTU case → **server-side
     fix** (dual-stack `cgpe.in` / MSS clamp), already filed to OPS. Not an app bug, don't rebuild for it.
   - Fails in the browser too → that network can't reach `cgpe.in` (captive portal / firewall).

---

## A3 — Attendance present/absent  🌐

- [ ] Open **Attendance** and look at past days where you know you clocked in.
  - **Expect:** those days read as **present with the real clock-in/out times**. The bug this fixes:
    every past day wrongly showed **"no clock-in"** because the history endpoint returns raw DayLog
    documents (times nested in `sessions[]`), which the app used to misread.
  - **Edge:** a day with **multiple sessions** (clocked in/out more than once) should show each session,
    not collapse to one or none. A genuine day off shows honestly absent — not a false "no clock-in".

## B5 — Master agent-map shows the whole team  🔒🌐📱

- [ ] As **Master**, open the **agent map** (Monitor → Movement / agent-map).
  - **Expect:** the roster lists **every team member**, even when only one (or none) currently has a
    live GPS pin. The bug this fixes: when a single member was located, the map showed **only that one**
    and everyone else vanished from the roster.
  - **Edge:** members with no location still appear in the roster (honestly, with no pin / a last-known
    label), not dropped. A member with zero team-tasks must not disappear either.

## D3 — Home day-figures strip  📱🔒

- [ ] Open **Home**.
  - **Expect:** a **day-figures strip near the top** summarising today. It should read for the current
    day and role, and not push the clock-in hero off-screen on a small phone.
  - **Edge:** on a slow config load Home still fails open within ~3.5 s — the strip shouldn't block the
    dashboard or show stale/`0` figures as fact on an outage (honest empty instead).

## B1 — Master per-member breakdown  🔒🌐

- [ ] As **Master**, open the per-member breakdown (Monitor / team performance → a member).
  - **Expect:** a **full breakdown for that member** (their real figures), not a summary-only card.
  - **Edge:** a member with no data shows an honest empty, never fabricated numbers. An **Admin/Leader**
    must not reach the Master-only breakdown (honest "owner access only", not a blank).

## D4 — Tasks time views (Today / Week / Month / Calendar)  🌐📱

> This **replaces** the "5 filter views" described in §13 of the v1.10.0 guide. Tasks now offers four
> **time** views and **defaults to Calendar**.

- [ ] Open **Tasks**.
  - **Expect:** a toggle for **Today / Week / Month / Calendar**, opening on **Calendar** by default.
    Each view shows the right tasks for its window; counts are honest.
- [ ] Switch between all four.
  - **Expect:** Today = due today; Week / Month = their windows; Calendar = a date view you can move
    through. Completing/reopening a task still rolls back if the server rejects (never a fake tick).
  - **Edge:** an **undated** task must still be reachable (it has no calendar slot — it should surface in
    a list view, not silently disappear). The toggle labels are **new English strings still awaiting
    5-language copy** — if a non-English language shows English toggle labels, that's the known copy gap,
    not a logic bug.

## C2 — Clock-out reason when under-worked  🖐🔒

- [ ] Clock in, then **clock out having worked LESS than 8 h 30 m.**
  - **Expect:** clock-out **demands a reason** (owner-locked at 8 h 30 m; it reuses the same reason
    sheet as the early clock-out flow). You type a reason → the Master is notified. Clock-out is never
    refused, only reason-gated.
- [ ] Clock out having worked **8 h 30 m or more.**
  - **Expect:** **no** under-work reason demanded.
  - **Edge:** the reason sheet must appear in **all 5 languages** (this reuses existing owner-supplied
    `clock.reason*` copy). This is **separate from** the geofence out-of-range reason and the >15-min
    early clock-out reason in §3 of the v1.10.0 guide — all are reason-gates, none is a refusal.

## D6 — Leaner Home · first-run guide · full-width Clock-in  📱🔒

- [ ] As a **team-tier** account, open Home for the first time on this build.
  - **Expect:** a **leaner Home** (advanced/admin widgets are already hidden from team), a **first-run
    guide** on first open, and a **full-width Clock-in** button for the team tier.
  - **Edge:** the first-run guide should show **once** and be dismissable — not reappear every launch.
    Its copy is **new English strings awaiting 5-language translation** — English text in another
    language here is the known copy gap. D6d (sales↔ops split) is **admin-panel config, not in this
    APK** — nothing to test on the phone for it.

## E2 — Report failure names its cause  🌐

- [ ] Trigger a **client/claim report** (the report/PDF action).
  - **Expect one of two honest outcomes:**
    - **"Report generation is not set up on the server yet"** → the render webhook env is unset on the
      droplet (this is the **current** state — an **OPS** item, not a phone bug). See the note below.
    - A **~15–40 s spin that opens a PDF** → reports are working.
  - **Expect NOT:** a fabricated summary, or a generic "something went wrong" that hides which of the two
    it is. E2 only makes the **message** honest; it does **not** make reports generate.

> **Reports will stay in the "not set up" state until OPS acts** — the owner must set
> `CGPE_REPORT_WEBHOOK_URL` (or `N8N_REPORT_WEBHOOK_URL`) + `CGPE_REPORT_SECRET` on the droplet, wire the
> n8n `cgpe-report-render` template, and restart `:3001`. Backend Phase 87 (shared 7-day report cache)
> **also isn't live** until its PR is merged to `origin/main` and the droplet redeploys — a shared cache
> with an unset webhook still produces no report.

## D5 — Typo-tolerant search  🌐📱

- [ ] Open **Search** and mistype a name you know — e.g. `rajseh` for Rajesh, `jeevn` for Jeevan,
      `ptael` for Patel.
  - **Expect:** the record still appears, ranked **below** exact/substring matches (a typo never
    outranks a real match).
  - **Scope — important:** typo tolerance works on the **local collections (leads / claims / tasks)** and
    on any **client/ticket rows the server already returned**. It does **NOT** yet cover a typo across the
    whole ~9k client/ticket book, because that search runs **server-side and is still exact** — a typed
    typo returns no server candidates for the app to rescue. (The server-fuzzy `[api]` ask is owed to the
    owner to relay — see below.) So: local typo → found; whole-book client typo → still misses for now.
  - **Edge:** a **numeric** query (phone / policy number) is deliberately **NOT** fuzzed — a wrong digit
    must not match a different person's number. `999` should not "correct" to someone else's `998`.

---

## How to report a finding

Screen · what you did · what you expected · what you saw (screenshot helps), grouped by the ref above.
The highest-value checks in this batch are **A3** (real attendance data), **B5/B1** (Master sees the
whole team), and **D4/C2** (the new Tasks views + under-work reason gate) — the rest of the app is
covered by the full v1.10.0 regression guide.
