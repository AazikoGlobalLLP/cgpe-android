# PHASE 62 — On-phone check (Commissions screen: MDRT tier card + "This year by product")

**STATUS: PENDING — do NOT mark passed until the owner personally confirms "testing pass hai".**
Everything below is already BUILT and verified in code against the live backend (commit `fc92573`,
`tsc` clean, `npm test` 557/557). The ONLY thing left is this visual pass on a real phone, because
there is no advisor login inside the editor and the web build can't exercise it.

Walk this on a handset with the latest APK installed and the backend live on `:3001`.

---

## What changed (plain language)

The **Commissions** screen now shows two new things for an advisor:

1. **An MDRT tier card** near the top — how close the advisor is to their next MDRT tier.
   It is a **premium / production goal** (how much first-year premium they've done toward the next
   tier), **NOT** a rupee-commission target. It reads: current tier, the next tier, and how much
   more premium is needed to reach it.
2. **A "This year by product" section** — one bar per product (LIC plan type), showing how much of
   this year's commission each product earned. The bars are each product's share of the year total.

Both numbers come fully calculated from the server — the app only draws them, it never does its own
maths on them.

---

## Test A — Real advisor account  (the main check)

1. Log in with a **real advisor** (or learn-advisor) account that has actually booked policies /
   earned commission.
2. Open the **Commissions** screen.
3. **PASS if** — an **MDRT tier card** appears near the top showing the tier progress
   (e.g. "₹X of ₹Y" and "₹Z more to reach [next tier]"). It should read as a premium goal, not a
   commission target.
   - Special case: a **top-tier (TOT)** advisor — the highest tier — should show **no "next target"
     and no progress bar**, just their achieved tier. That is correct, not a bug.
4. **PASS if** — a **"This year by product"** section appears, with one bar per product. Each bar is
   labelled with the product name, the number of credits, and a rupee amount on the right.
5. **PASS (the key correctness check) if** — the rupee amounts on the product bars **add up to the
   "Year to date" total** shown lower down on the same screen. (Example: bars of ₹1.2L + ₹80k + ₹40k
   should match a Year-to-date of ₹2.4L.) If they don't add up, **FAIL — note it.**

## Test B — Non-advisor account

1. Log in with an **admin / leader / payroll** account (any non-advisor).
2. Open the **Commissions** screen.
3. **PASS if** — there is **NO MDRT tier card** at all (no "₹0, 0% to Quarter MDRT" — it should be
   completely absent, not a zeroed-out card).
4. A non-advisor has no advisor commissions, so the **"This year by product"** section should also be
   **absent**. If either the tier card or product bars appear for a non-advisor, **FAIL — note it.**

## Test C — Advisor with no commissions yet (optional edge)

- The tier card may still show (at the first tier, ₹0 done), but the ledger shows the calm
  **"No commission recorded yet"** message and **no product bars**. That is correct.

## Not-a-Phase-62-bug (just so you know what you're seeing)

- If the phone can't reach the backend, Commissions shows **"Your earnings did not load"** instead of
  zeros. That's the outage message, not a Phase 62 problem — retry when the connection is back.

---

## Sign-off

- [ ] Test A passed on a real advisor handset (tier card + product bars + amounts sum to Year-to-date)
- [ ] Test B passed (non-advisor sees neither)
- [ ] **Owner confirms: "Phase 62 testing pass hai"**

Until all three are ticked by the owner, Phase 62 stays **PENDING** and Phase 41 stays last.
