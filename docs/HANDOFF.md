# HANDOFF — CGPE Connect (Android) — Phase 75 (daily-flow bug cluster C1+A2+A1 + reliability item logged) — 2026-08-21

Owner picked the "daily-flow bug cluster" (A1/A2/C1) over the bigger features (B1/D4). All three are
built, gate-green, and pushed to `aaziko/Shivam`. Two turned out to be the same root cause on two
surfaces. A new HIGH-PRIORITY reliability item ("app won't open on some networks") was logged for
triage. `[m]` only — no contract change.

## Done
- **The break / clock-out-reason / claim client-picker sheets raise the soft keyboard on their own again (C1).** Root cause was RN-Android firing `autoFocus` before the sheet's modal window attaches; they now focus the input on the modal's `onShow`.
- **A just-claimed but overdue ticket now shows as today's work, not "nothing scheduled" (A2 + A1).** Both the Tasks tab hero AND the Home clock-in hero now count due-today ∪ open-overdue as "today's actionable work". The Tasks "today" empty state now says "N overdue — check the Overdue view" instead of "today is clear".
- **A high-priority reliability item is documented** (`docs/OWNER-BACKLOG-2026-08-21.md` §F): "app won't open on his home WiFi AND mobile data" + a systematic loophole hunt — with the triage plan and the current-state facts.

## Files changed
- `src/ui/controls.tsx` — `Field` & `SearchBar` are now `forwardRef` to their `TextInput` (so a caller can imperatively focus).
- `src/ui/sheet.tsx` — `Sheet` gains an `onShown?` hook fired from the Modal's `onShow` (with a 50 ms settle) — the reliable moment to focus.
- `src/app/(tabs)/home.tsx` — break + clock-reason sheets wired to `onShown` + a ref, `autoFocus` dropped (C1); clock-in hero switched to `todayWorkload` + overdue sublabel (A1).
- `src/app/claim-new.tsx` — client-picker search wired to `onShown` + a ref (C1's unreported twin, a core write path).
- `src/data/tasks.ts` — new pure `todayWorkload` = due-today ∪ open-overdue ∪ completed-today (the shared Home+Tasks headline).
- `src/app/(tabs)/tasks.tsx` — hero uses `todayWorkload`; the 'today' empty state nudges to Overdue when overdue > 0 (A2).
- `src/data/__tests__/tasks.test.ts` — +6 `todayWorkload` pins (suite 763 → **769**).
- `docs/OWNER-BACKLOG-2026-08-21.md` — new **§F** (reliability, HIGH PRIORITY).

## Decisions made
- **C1: focus on `Modal.onShow` via a ref, NOT `autoFocus`.** On Android `autoFocus` fires before the modal window attaches, so the keyboard never rises. `autoFocus` was *removed* from the migrated fields — keeping it would let the input read "focused" with no keyboard and pre-empt the `onShown` focus.
- **A2: keep the backend ticket-date rule, fix the mobile screen (owner chose Option 2).** The mirror deliberately dates a claimed ticket by its own older open date (`../cgpe-backend-main/routes/tickets.js:382`, the 2026-08-18 owner rule), so it buckets Overdue. Rather than reverse that, the app now counts open-overdue as today's actionable work.
- **A1 = the Home clock-in hero** (owner clarified: "home screen me clock-in button jaha today's task dikhte hai"). Same `todayWorkload`, which re-unifies Home + Tasks (both share it again; `todayProgress` is now called by no screen, kept only as a tested reference).
- **The network item is logged, not built** — it needs on-device triage (crash vs splash-hang vs opens-blank) first. The old 4.5 s timeout is already 12 s (Phase 55), so that is not the lever.

## Known broken / deliberately skipped
- **All three fixes are device-unverified** — native keyboard (C1) and the hero render (A1/A2) can't be proven by tsc/vitest/web. Owner check: open **Break** → keyboard should pop by itself; the Tasks tab + Home hero should now show the overdue ticket instead of "nothing scheduled".
- **§F (app-won't-open) is unstarted** — awaiting the crash/hang/blank answer + an on-device `adb logcat` and the phone-browser health test on the failing network.
- **Push still doesn't deliver** — the owner still owes the FCM V1 service-account key upload to EAS (from Phase 74). A fresh APK carrying C1/A2/A1 + the icon fix is not yet cut.
- C2 / D6 / B2 / B5 still need owner spec-lock (unchanged from the Phase-74 triage).

## Next session starts here
- **Phase 76: triage §F — why the app won't open on some networks.** Get the crash/hang/blank answer from the owner, then `adb logcat` on the failing device + open `https://cgpe.in/internal/api/health` in the phone browser on that network, BEFORE any code change. In parallel: the owner's FCM key upload + a fresh APK (C1/A2/A1 + icon).
- First command: `/boot`
- Watch out for: **do NOT rebuild an APK to "fix WiFi" before the on-phone health test**, and the timeout is already **12 s** (Phase 55) — don't chase the stale "4.5 s" number.
