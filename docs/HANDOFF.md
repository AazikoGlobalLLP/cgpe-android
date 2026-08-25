# HANDOFF — CGPE Connect (Android) — Point 13 Payroll (whole-team roster + master-only bank panel) — 2026-08-25

## Done
- **Payroll now lists the WHOLE team, not just Pavitra.** The roster used to render only members who
  have a `PayrollProfile` (that's the "only one member shows" symptom). It now left-joins the full
  staff directory with the computed roster, so every staff member appears; anyone without a computed
  row shows an amber **"Data pending"** pill instead of being absent. The header gains a `N data
  pending` count and a one-line explanation of what it means.
- **A master (super_admin) can see each member's Essential details on the payroll detail screen** —
  shift timing + beneficiary / bank / account / IFSC. The **account number is masked to the last 4
  with tap-to-reveal**. **Aadhaar and PAN are never shown** — they are dropped before they enter app
  state. A non-master admin sees the pay breakdown but not the bank panel. Each blank field reads
  "pending", so a half-filled profile is honest rather than a confident blank.
- Gates green: `tsc` 0 · `npm test` **953** (+22 across the two slices) · `eslint` 0 new errors
  (2 pre-existing warnings untouched). Two commits pushed to `aaziko Shivam` (`9ac8c18`, `7a49774`).
  All OTA-eligible, device-unverified. The backend endpoint was confirmed LIVE on prod (`GET
  /payroll/profiles/:userId` → 401 not 404; `/health` 200) — no backend change was needed.

## Files changed
- `src/data/payroll.ts` (new, pure + tested) — `mergePayrollRoster` (directory × compute roster, id
  join with normalized-name fallback; orphan payroll rows kept, never dropped), `payrollRosterStats`
  (members / with-pay / pending / total), `maskAccountNumber` (last-4 visible, rest bulleted).
- `src/data/__tests__/payroll.test.ts` (new) — 15 cases over the merge, stats and account mask.
- `src/app/payroll.tsx` — fetches the directory (`getAssignableTeam`) alongside the roster, renders
  the merged whole-team list, adds the "data pending" pill + header count; `MemberRow` handles a
  profile-less member. `roster === null` still shows the honest could-not-load state.
- `src/data/api.ts` — new `getPayrollProfile(userId)` (whitelists bank + shift + salary basics,
  DROPS `aadhar_no`/`pan_no`; ok / missing(404) / error outcomes) + `PayrollProfile`/`PayrollProfileResult` types.
- `src/data/__tests__/api-payroll.test.ts` — 7 new cases, incl. the load-bearing test that a
  response's Aadhaar/PAN are not present in the returned object.
- `src/app/payroll-detail.tsx` — master-only "Essential details" section (real super_admin gate via
  `canSeeTeamPerformance`), shift + bank with a masked/tap-to-reveal account row.

## Decisions made
- **Bank details on the phone: master only, account masked, Aadhaar/PAN never** (owner via
  AskUserQuestion, 2026-08-25). This deliberately reverses the older "no PII on the phone" rule, but
  only for the master and only for bank fields.
- **Aadhaar/PAN are dropped in `getPayrollProfile`, not just hidden in the UI** — so they never enter
  app state, the strongest client-side guarantee possible without a backend change.
- **Client-side directory merge, not the optional `[api]` "include all staff" compute mode** — the
  merge covers it with no contract change, and the roster gap is a data problem, not a wire problem.

## Known broken / deliberately skipped
- **The real "why only one shows" fix is a DATA job, owner/OPS** — create `payroll_profiles`
  (salary + segment) for the rest of the team, in the admin panel or a seed script. Until then the
  team correctly reads "data pending"; no client code can conjure a salary that was never entered.
- **Transit caveat (flagged to owner, NOT filed):** the admin endpoint still SENDS the full record
  (incl. Aadhaar/PAN) in the JSON body; the app never stores or shows them, but they do reach the
  device in transit. Stripping them would need a backend change, and that same endpoint feeds the
  admin panel which legitimately edits them — so it is an optional `[api]` hardening, only if the
  owner asks. No INBOX item filed.
- **Device-unverified** — masked/reveal, the "data pending" rows, and the master-only gate were not
  walked on a device this session.

## Next session starts here
- Phase: **#10 Document picker** (owner backlog Point 11) — the last major backlog item; add a
  file/gallery picker + honest errors + the attach call. **NOT OTA** — `expo-document-picker` is a
  native module, so it needs a fresh APK, and it needs the owner's DigitalOcean **Spaces env** OPS
  switch or claim uploads land on throwaway disk. (Alternatively, act on the Point 13 owner items:
  seed the payroll profiles + on-device check.)
- First command: `/boot`
- Watch out for: **#10 is native, not OTA** — do not promise it reaches the team by OTA; it needs a
  new EAS build AND the Spaces env set server-side, so scope both the picker code and the OPS switch.
