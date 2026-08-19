# Device Test Findings — CGPE Connect v1.10.0

**Date:** 2026-08-19 · **Build:** EAS `8f3238fa` (v1.10.0, hash-verified byte-for-byte on the phone)
**Device:** Samsung Galaxy A54 5G (SM-A546E), Android 16, driven over USB/ADB as **Shivam (super_admin / Master)**
**Method:** live on-device walk (screenshots) **+** an adversarial code audit (13 agents, 16 findings verified against source)

The 2026-08-19 batch (Phases 63/64/66/67) is **verified working** — on-device *and* in the code audit (the batch-specific audit found **zero** defects). The findings below are pre-existing issues surfaced by harsh testing; the one **HIGH** item is a *latent* bug in the Phase-50 clock-in/out flow that must be fixed **before** the office geofence is switched on.

> **✅ UPDATE — H1, M1, M2, M3 are FIXED (2026-08-19, gates green: tsc 0 · npm test 625 · eslint 0 new).**
> - **H1** — `dfa10f2`: `needsReason` branch on clock-in/out → mandatory reason Sheet → re-send. No more false "server could not be reached"; the agent can clock out/in with a reason. *(Sheet copy is English — localise with the 5-language reason copy before Phase-50 go-live. Full end-to-end test needs the office geofence configured.)*
> - **M1/M2/M3** — `95b0da2`: claims 403 classified (no false outage); matured-policy premium-due/renewal guarded at source (fixes premium.tsx + clients.tsx); stale prior-day point never shown as live "on duty".
> A **combined APK** (H1+M1+M2+M3) is building. The LOW/cosmetic items below are **not** yet fixed.

---

## ✅ Verified WORKING on device

| Area | Result |
|---|---|
| **Phase 64** — Monitor "on duty 0" | **On duty 1/3** (not 0) + agent-map "Live field status: 1", no false outage banner |
| **Phase 66** — Live location | Honest last-known: "10m ago", On duty, ±100 m, real coords (~Adajan office), "**not a live ping**" — no (0,0), no fake pin |
| **Phase 67** — Payroll detail | Full breakdown; "0 days → ₹574" explained = 2.5 h × ₹226 hourly; working-days 31−5−0=26; activity honest-empty |
| **Phase 51** — Map | Esri satellite + "Imagery © Esri", points hide, legend 🟢🟠🔴 |
| **Phase 45** — Team performance | Ved 75/100 (math correct), honest scoring rule |
| **Phase 39** — Monitor hub | Locations-first grid + roster |
| **Phase 46** — Greeting emoji | ☀️ afternoon |
| **Phase 47** — Viewing-as | Master-only, downward preview, honest copy |
| Clients / Client 360 | 9,018 in book, pagination, hostile-search crash-safe + honest empty; 360 renders |
| Tasks | Today 3/3 == Home (shared-count fix consistent), 5 filters |
| Claims | 85 in register, filters; **no fake status-advance** |
| Notifications | "all read", date-grouped |
| Commissions | ₹0 YTD, no fabricated delta, **no meaningless MDRT card** (advisor gating OK) |
| **Outage banner** | Network OFF → honest "Some data could not load… blank values are unconfirmed"; **clears on recovery** |
| i18n switch | Instant, no crash, **no raw keys** (mechanism solid) |

**Phase 63 (background GPS)** — code audit found the batch clean; **on-device it needs a real multi-hour shift** (can't be driven by ADB). See "Physical-only" below.

---

## 🐞 Findings (ranked)

### 🔴 HIGH — 1

**H1. Clock-out (and clock-in) don't handle the server's "reason required" answer → false "server could not be reached", and the agent literally cannot clock out.**
`src/app/(tabs)/home.tsx:869-887` (clock-out) and `:909-932` (clock-in). Confirmed by code audit **and** by direct re-read (`needsReason` has **zero** handling in home.tsx).
- **What happens:** the Phase-50 data layer maps the backend's `400 REASON_REQUIRED` (out-of-range / early clock-out) to `{ok:false, needsReason:true}` with `blocked` unset. home.tsx has **no `needsReason` branch**, so it falls into the generic `if (!res.ok)` → shows *"Attendance could not be recorded — The server could not be reached. Check your connection and try again."* and returns. The server **was** reached; no reason is ever collected, so **retry can never succeed** — the agent cannot clock out.
- **Exactly the owner's Phase-50 scenario:** an agent finishing at a client's home (out-of-range) or leaving early is the case that breaks.
- **Currently latent:** only fires once the office **geofence is configured server-side** (`PUT /geofence` office pins). Today the fence isn't set, so clock-in/out is unfenced and this path isn't reached.
- **⚠️ Action:** do **NOT** enable the Phase-50 office geofence until the **reason-prompt UI** is built in home.tsx (a `needsReason` branch → a reason sheet → resend `clockOut/clockIn(coords, reason)`). This UI was always a "remaining" Phase-50 item; the audit shows the consequence of enabling the backend half without it. Needs the **5-language reason copy** (human-translated — machine translation forbidden).

### 🟠 MEDIUM — 3

**M1. Claims list shows a false red outage for a user without the "operations" module.**
`src/data/api.ts:1182` (`getClaims`). It doesn't classify the response status, so a backend **403** (no Claims module) is reported as a server outage → global HealthBanner + "server could not be reached" empty state, instead of a quiet "no access". Fix mirrors `getLeads` (route `status` through `reportIfOutage`). Not visible to a Master (who has the module).

**M2. Matured policies still flagged "premium due / renewal due" in two surfaces.**
`src/data/adapt.ts` — the `matured` status is derived, and Client-360 (`client/[id].tsx:140`) correctly hides the due token for matured policies, but the **Renewals list** (`premium.tsx:94`) and the **Clients segment filter** (`clients.tsx`) don't apply that guard, so a policy matured years ago whose stale follow-up month equals the current month fabricates a renewal/premium-due prompt. Extends the owner's earlier matured-policy fix to these two screens.

**M3. Agent-map can show a stale "on duty" green pin.**
`src/data/api.ts:2601` (`getAgentLocations` fallback). An agent who forgot to clock out on a previous day has an open (no clock-out) record; when today's data is empty (early morning / after date-rollover), the fallback returns that prior-day record with `onDuty:true`, so the map draws a **green "on duty"** pin and counts it in the header — days-old position presented as live. Rare, but it's the "manager believes someone is out working when nobody is" case.

### 🟡 LOW / cosmetic

- **L1. i18n coverage gaps (device-confirmed).** After switching to Gujarati: **Settings, Claims, Search** screens stay fully English; **Home** leaves "**tasks done today**" and "**Nothing is overdue and nothing else is due today.**" in English (`home.tsx`, and `tasks.tsx:304`); the confirmation **toast** "Language changed to Gujarati" is English. Known partial rollout (~40 screens) — needs human copy, not a regression.
- **L2. `inrShort` trailing zero** — `format.ts:46` renders "₹1.50L" / "₹1.20K" instead of "₹1.5L" (values < 10 units). Cosmetic; inconsistent with ≥10-unit amounts on the same screen.
- **L3. `toDate('0')` / `toDate(0)`** — `format.ts:70` returns a fabricated "1 Jan 2000" / "1 Jan 1970" instead of "–" for a zero/`'0'` no-date sentinel. Narrow reachability.
- **L4. Signed zero "-₹0"** — `format.ts:31` for tiny negative values. Cosmetic.
- **L5. `mapClaimStatus` 'partial_paid' → "settled"** — `adapt.ts:287`, arm-ordering. **Known, deliberately pinned bug** (adapt.test.ts) — any fix must update the pin.
- **L6. Team-performance backend has no super_admin backstop** — `performance.tsx:88`. The app gates correctly (super_admin only); the gap is server-side defense-in-depth only (out-of-band). File as `[api]`.
- **L7. Latent non-classifying reads** — `getWaThreads/getWaThread/getReminders/getNotifications` share `getClaims`' pattern but aren't triggerable today (routes are auth-only). Future-proofing only.

### ⚪ Cosmetic (device-observed)

- Profile/More show role **"Advisor"** for the Master, while ROLE → Access level correctly says **super admin** (name-subtitle doesn't special-case super_admin).
- In-app **Version reads 1.8.0** (`config.ts:33`) though the build is **1.10.0**.
- "+ New claim" / "+ Add task" **FABs overlap** list rows / the empty-state text.
- Truncated labels ("Reminde…").
- Clients header "IN THE BOOK" count briefly renders two overlapping numbers (transient count animation — not persistent).

### 🔧 OPS (not app bugs)

- **Payroll shows only 1 member (Pavitra)** — each employee needs a **payroll profile + segment** created on the server.
- **Phase-50 office geofence pins not set** — so clock-in/out is currently unfenced. Set the pins only **after** H1 is fixed.
- Team performance / reports depend on the now-live backend (verified deployed).

---

## 📱 Only the owner can test (physical / real conditions)

- **§5 Background GPS (Phase 63)** — a real multi-hour shift: stationary phone still records, walked route is dense, survives app-kill + reboot, battery, ≥2 phone brands. *(Clock out + in on this build first so the new profile loads.)*
- **§3 Geofence (Phase 50)** — real 200 m fence, nearest-office, out-of-range/early reason → **but fix H1 first**.
- **Biometric unlock/restore**, **break 8h30m gate**, **actual clock-in/out**, **WhatsApp send** — hardware/real-write actions not driven in this pass.

See `docs/DEVICE-TESTING-GUIDE-v1.10.0.md` for the full step-by-step.

---

## Recommended next steps

1. **Fix H1** (reason-prompt UI) — needed before Phase-50 geofence go-live. Requires the owner's **5-language reason copy**.
2. Fix **M1 / M2 / M3** — small, self-contained, honesty-class.
3. Owner runs the **physical** checklist (§5/§3/biometric) on ≥2 phones.
4. OPS: create payroll profiles; set office pins (after H1).
