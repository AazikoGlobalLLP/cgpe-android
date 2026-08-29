# HANDOFF — CGPE Connect (Android) — Phase 85 (i18n) — 2026-08-29

> This session advanced the **i18n phase track** to **Phase 85**. The parallel **store-deployment
> track** (Apple/Play submission program) opened in the previous session is unchanged and still
> owner/ops-blocked — its state is preserved at the foot of this file.

## Done

- **Three home-dashboard widget section headers now read in all five languages** — the Prospects,
  Notes and Tickets widgets. They were the only headers in `home.tsx`'s widget list whose exact
  English wording already had a translation key, so they were wired by **pure reuse**: no English
  text changed, and **zero new keys** were added.
- **The claimed "free win" was mostly not a clean reuse — and that was proven, not guessed.** A
  4-lens adversarial review (completeness / convention / exact-match / skeptic + synthesis) evaluated
  all 9 candidate sites + the shortcut-card table. It found a durable wiring rule and correctly
  refused 6 sites + the table.
- **The refused sites are filed as owner copy (Batch 6g)** in `docs/i18n/COPY-REQUEST-2026-08-26.md`,
  every string quoted verbatim and grouped by exactly what unblocks each one.
- Gates: `tsc` **0** · `npm test` **1084/67** (unchanged) · `npx eslint` cache-free **0** on
  `home.tsx` · orphan scan **17** (unchanged) · dictionary **430** keys (unchanged). Commit
  `d9adb5b`, pushed to `aaziko/Shivam`.

## The wiring rule this phase established (keep it)

**Translate a widget header only where the card body has no *translated* chrome for the header's
English peers to clash with** — i.e. the body is pure data, OR uniformly one-direction English like
the shipped flagship `my_tasks` (which already renders a hardcoded `Overdue ·` under a translated
header). This is why Prospects/Notes/Tickets wired and Team did not.

## Files changed

- `src/app/(tabs)/home.tsx` — three one-line header swaps: `'Prospects'`→`t('more.prospectsTitle')`,
  `'Notes'`→`t('more.notesTitle')`, `'Tickets'`→`t('common.tickets')`. Nothing else touched.
- `docs/i18n/COPY-REQUEST-2026-08-26.md` — new **Batch 6g** (the refused home-widget headers +
  the Team footer placeholder + the LINK_WIDGETS subtitle sentences + near-miss titles).
- `docs/PHASES.md` — Phase 85 entry.

## Decisions made

- **WIRE Prospects/Notes/Tickets; REFUSE the rest.** The split call was **Notes** (skeptic said refuse
  on the row-level `Voice` pill) — resolved to WIRE by reading the flagship `my_tasks` precedent in
  the same file. The other decisive call was **Team → REFUSE**: its card already renders translated
  on/off-duty pills beside a hardcoded English `${onDuty} of ${team.length} on duty right now` footer,
  so a translated header would create a half-translation *island* in a leader's everyday state.
- **`dash.campaigns` is NOT a clean win** — campaigns renders only as a shortcut card (title+subtitle),
  so wiring its title strands its keyless subtitle. The whole LINK_WIDGETS table is a
  whole-table-or-none module-scope job that needs an owner copy drop first.
- **No new keys, no reworded English.** `'Leads pipeline'` was left English rather than reuse the
  near-miss `more.leadsTitle` ('Leads and pipeline'), which would have silently changed the header.

## Known broken / deliberately skipped

- **No device verification** — `home.tsx` is device-testable only, and no APK can build until the EAS
  quota resets (1 Sep). The change is display-only (a section-header string) and low-risk, but the
  five-language render should be eyeballed on a handset during device QA.
- **Batch 6g is owner-owed** — until that copy (and one `{n} of {total} on duty right now` placeholder
  key) arrives, the day-spine / leads / claims / issue-log / team headers and the shortcut-card table
  stay English by design.

## Next session starts here

- **i18n track:** there is **no self-contained free win left in `home.tsx`** after this — the residue
  all needs owner copy or a placeholder key. The next moves are **Batch 6b** (41 outage sentences,
  owner-owed) or, when Batch 6g copy lands, finishing these home headers + the LINK_WIDGETS table as a
  whole. First command: `npm test`.
- **Relay to owner:** hand over `docs/i18n/COPY-REQUEST-2026-08-26.md` (now includes Batch 6g). The
  four standing server asks (Phase-94 not deployed on `origin/main`; `cloudStorageConfigured:false`;
  no AAAA record on `cgpe.in`; let any authed user create a self-assigned `team_task`) are unchanged
  and **not re-verified this session** — re-verify before repeating any of them. Plus the open INBOX
  item: adopt the presigned MinIO upload flow (inert until OPS sets `S3_*`+`BACKEND_URL`).

---

## Parallel track (unchanged from previous session) — STORE-DEPLOYMENT PROGRAM

Opened 2026-08-29 from `CGPE_Connect_App_Store_Play_Store_Developer_Deployment_Spec.md`. An 8-agent
read-only audit found the app **~90% store-ready**. Code-side slice shipped (`664b3c6`/`8d2196c`/
`b55afcd`): Section-5 boundary-attribution fix (new pure tested `src/lib/boundaryAttribution.ts` +
`sidStartedAt` + `ingest()` split — **device-QA owed**, `tracker.ts` is device-only), version
reconciled to 1.10.0, and `docs/store-release/1.10.0/` evidence folder. Recommended route: **private
org distribution** (Managed Google Play + Apple Business Manager Custom App). Blocked on owner/ops:
Apple account, `eas.json submit` creds, FCM key, public privacy/delete pages, store assets, reviewer
account, and the 1-Sep APK (which carries BOTH this i18n work and the boundary fix, and is where the
boundary fix gets its device QA). See `docs/store-release/1.10.0/README.md`.
