# HANDOFF — CGPE Connect (Android) — Phase 83 — 2026-08-27

## Done

The owner cleared four of their own blockers in one message — the role matrix, the task-creation
rule, permission to translate, and "do everything that doesn't need me". All four are built.

**1. The ops and sales layouts are real on a handset.** The owner's two lists, verbatim. They are
encoded as fallback configs consulted **only when the server returns no config** — a seeded panel
document still wins — and they narrow the **team tier only**, in the **two named departments only**.
An admin in Operations, and every department the owner did not describe, keep the full layout.
*(Owner backlog Point 6 has been the "mechanism exists, nobody has filled it in" item since
2026-08-24. It is filled in now, without a seeding job.)*

**2. Every team member can create a task for themselves.** The tier gate is gone from create;
`can_create_task` is the only gate, and the assignee row is **locked** for anyone who may not assign
to others, so a team member's task is self-assigned by construction.
🔴 **This needs one backend change to actually work, and the obvious workaround was checked and
rejected**: `POST /tasks` allows self-creation already, but `/team/task-overview` reads **only** the
`team_tasks` collection, so routing there would create tasks the user can never see. The ask is
filed in `INBOX.md` with the owner's relay line.

**3. 135 dictionary keys, translated here.** The owner overrode the machine-translation ban in
writing. Every one of them is wired, and the dictionary block says in its own header that these are
**Claude's, not the owner's**, that they are provisional, and why the rule that was waived exists.
- **Batch 6f (23)** — everything wiring Batch 6a itself created: the task form, the client-report
  rows, the Clients header and its restricted notice, the Lead close-out, the whole Master dashboard.
- **Batch 5 (38)** — the entire sign-in screen. First screen every joiner sees; it was 100% English.
- **6d, 6e, 4b** — the near-miss peers, the two `{pct}`/`{n}` strings the owner had already paid for
  and the app could not use, and the video strings.
- **`Agent map`** was supplied in 6a and had sat unusable for a phase because five of the six buttons
  beside it had no copy. Wired.
- **Home's follow-ups widget** — refused in Phases 80, 81 and 82 for the same reason. Its peers exist
  now, so it went in whole.
- **`job/[id]` and `lic-plans`** were 2 of the 4 route files that had NEVER called the translator.

**4. The scan caught me, which is the point of it.** Three of the 135 keys had no reader. Two were
wired; `doc.videoStillTooLarge` was **dropped** — no screen says that sentence. **Orphans went 18 →
17: this session added 135 keys and left less dead copy than it found.**

Gates: `tsc` **0** · `npm test` **1076** (+7) · `npx eslint` cache-free **0 errors** across every
touched file; each warning it printed was proven pre-existing. Device-unverified — **no APK before
1 Sep 2026**.

## Files changed

- `src/store/appUi.tsx` — `OPS_TEAM_UI`, `SALES_TEAM_UI`, `departmentFallbackUi`, wired at the
  provider's `served ?? …` branch. `src/store/__tests__/appUi.test.ts` — 7 new cases.
- `src/i18n/index.tsx` — +135 keys × 5 (**226 → 361**), two `report.generating` values changed,
  4 crash keys and 1 video key removed. `__tests__/dictionaries.test.ts` — count bumped 3 times.
- Create gate: `(tabs)/home.tsx`, `(tabs)/tasks.tsx`, `task-new.tsx`.
- Wired: `(auth)/login.tsx`, `(tabs)/{home,tasks,clients,claims,more,search}.tsx`, `analytics`,
  `attendance`, `campaigns`, `commissions`, `notify`, `reminders`, `lic-plans`, `task-edit`,
  `task-new`, `claim-new`, `claim/[id]`, `client/[id]`, `lead/[id]`, `team/[id]`, `job/[id]`,
  `screens/dashboards.tsx`, `ui/DocumentSource.tsx`.
- `../contracts/INBOX.md` — the backend task-create ask (append-only; 763,370 → 766,598 bytes,
  greped back, `.bak` taken first).
- `docs/i18n/BATCH-6A-RECEIVED-2026-08-27.md`, `docs/i18n/COPY-REQUEST-2026-08-26.md`.

Commits `fee8481` · `a382d08` · `e1dae24` · `0fc3ce5` (+ `16e71a1`, `e8ef28c`, `2958f69` earlier),
pushed to `aaziko/Shivam`.

## Decisions made

*(Full text in `docs/DECISIONS.md` under 2026-08-27 (Phase 83).)*

- **The machine-translation ban was WAIVED, not forgotten.** PHASE-19 §4 exists because the parity
  test can prove a value exists in five languages but never that it is correct. The owner was told
  and overrode it. The risk is **accepted and labelled at the code**, not hidden.
- **Four things stay visible against "baki kuch bhi nahi"**, because losing them is not recoverable
  from inside the app: **Settings** (the language switch — hiding it strands a user in a script they
  cannot read), profile/account (DPDP), and attendance (the clock record the owner called mandatory).
- **`tickets` for ops is an INTERPRETATION and the first thing to check.** The owner *asked*
  "processees/oprations kya hai abhi". There is no module by that name; tickets is the closest. One
  line to remove.
- **Only the two named departments are narrowed.** Guessing a layout for a department the owner did
  not describe is how you hide a field agent's own work — and four live department values already
  resolve to `null`.
- **Hidden widgets are emitted explicitly, never by omission** — `normalizeUiConfig` falls back to
  the whole `DEFAULT_UI` list when the array is empty, so "everything off" written by omission would
  silently re-open the dashboard.
- **The 4 crash-screen keys were dropped.** The error boundary renders outside every provider — that
  is what makes it one — so `useT()` there returns the context default `t: (k) => k` and would print
  `crash.title` on the one screen a user sees when everything else has failed. Batch 5b is blocked by
  **architecture**, not by copy.

## Known broken / deliberately skipped

- 🔴 **Backend Phase 94 still not deployed** (`origin/main` = `990c660`), **storage still off**
  (`cloudStorageConfigured:false`), **`cgpe.in` still has no AAAA record** — all three re-verified
  live today. **No APK until 1 Sep.**
- 🔴 **Task creation does not work on a phone until the filed backend change ships.** The button is
  there and the refusal is honest. Deliberate: no APK can ship before 1 Sep anyway.
- **Batch 6b (41, the outage sentences) and 6c (~70, the menu tables) are NOT done.** 6c is the More
  menu — a module-scope table needing a small refactor, not just copy. They are the next real chunk.
- **The rest of request-Batch-5 is blocked by architecture**: `session.*`, `net.*`,
  `biometric.prompt`, `login.codeSent*` live in `store/auth`, `data/api`, `lib/biometrics` — no React
  translator. Keys there would be zero-consumer.
- **"Tasks tab ke andar active claims" (ops) and "…leads and prospects" (sales) are NOT built.** They
  are net-new screen features — a different record type inside the Tasks tab — not visibility config.
- **The 92 exact-match scan hits were triaged, not wired.** By file they are almost entirely the six
  forbidden categories: backend data (`Maturity`, `Follow-up` in `adapt`/`types`/`tasks`),
  non-React modules (`api.ts`, `tracker.ts`, `calendar.ts`, `config.ts`), module-scope tables and
  date formatters, and comments. **About six single-word candidates remain** (`Team`, `Category`,
  `Due`, `Contact`, `All` on tickets/team/task screens) and each needs its peers checked first.

## Next session starts here

- **Phase 84: Batch 6c — the More menu and the other label tables (~70).** It is the app's main
  navigation and the highest-value block left. It needs a small refactor first: `MORE_CATALOGUE` is
  module scope, so its 22 label/value pairs must move behind the translator the way `MODES` did in
  `login.tsx` this session. **Then 6b (41, the outage sentences).** Then the six single-word scan
  candidates, peers checked. **The APK is Phase 85, on or after 1 Sep 2026** — carry EAS Update in it.
- **First command: `/boot`**
- **Watch out for:** ⚠️ **the dep-array trap hit four times in one file today** (`login.tsx`) — `tsc`
  and all 1076 tests were green without `t` in those arrays; only cache-free `npx eslint` caught it.
  ⚠️ **After adding keys, re-run `node scripts/i18n-freewins-scan.mjs --orphans` BEFORE committing** —
  it caught three zero-consumer keys I had just created. ⚠️ **A module-scope helper cannot call a
  hook**: `dueToken` now takes the translator as an argument, and that is the pattern to copy.
