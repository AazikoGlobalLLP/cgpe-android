# HANDOFF — CGPE Connect (Android) — Phase 10 — 2026-08-11

One commit on `Shivam`: `0820d8d` (code + spec + docs).
**The branch is NOT pushed — `git push origin Shivam` still 403s**, unchanged, not re-tested this
session (no reason to expect it fixed itself).
Twelve phases now sit locally (11 done + this one; Phase 1 is code-complete but device-unverified).
Gates: `npx tsc --noEmit` exit 0 · `npm test` **266 passed / 9 files** · `npm run lint` 46 errors
(byte-identical to baseline).

## Done

- **Reordering tabs or hiding a module in the Admin Panel now changes what the app shows.** The
  bottom tab bar builds its order from `nav.tabs`/`nav.hidden` instead of a constant baked into the
  app, and every navigation destination the More screen lists disappears — including its quick-tap
  shortcut, if it has one — when its module is hidden for that role. This was the documented
  `ADMIN_PANEL_SYNC.md` §9 gap: the settings always saved correctly, they just never took effect on
  a device.
- The "More" button itself, and Sign Out inside it, can never be hidden or reordered away — even by
  a config that tries to. It's the only way back to anything that lost its spot, and the only way to
  sign out.
- Grouping the More menu by the Admin Panel's own section titles (`nav.more_sections`), and putting
  Prospects/Tickets directly in the bottom bar, are **not** part of this — see "Known broken" below.

## Files changed

- `src/store/appUi.tsx` — new `resolveTabs(config)` (ordered, deduped, hidden-filtered tab list,
  `more` always last) and `isHidden`, both exposed on `useAppUi()`.
- `src/app/(tabs)/_layout.tsx` — bottom bar reads `useAppUi().tabs` instead of the deleted `ORDER`
  constant; `TAB_META` gained a `leads` icon pair so Leads can take a bar slot.
- `src/app/(tabs)/more.tsx` — every navigable row and quick-action tile tagged with a `navKey`;
  hidden modules are filtered out (and an emptied group drops its header too).
- `src/store/__tests__/appUi.test.ts` — 8 new cases pin `resolveTabs`; one existing pinned-bug
  comment corrected (it claimed nothing reads `config.nav` — no longer true).
- `docs/spec/PHASE-10.md` **(new)** — five locked decisions, acceptance criteria, what was left out.
- `ui_rbac_config.json` — `_KNOWN_GAP` block updated: resolved for `nav.tabs`/`nav.hidden`, still
  open for `nav.more_sections`.
- `../contracts/INBOX.md` — one notice to `cgpe-admin` (this ships without their input, but their
  own "stored, not yet live on device" panel copy is now wrong for two of the three fields), grepped
  back after writing to confirm it survived a concurrent edit.
- `docs/{PHASES,DECISIONS}.md` — phase closed out per project convention.

## Decisions made

- **`more` is unconditional — immune to both `nav.tabs` and `nav.hidden`.** A config that omits or
  hides it still gets it rendered. Every real config already lists it last, so this changes nothing
  for a well-formed document; it only guards a malformed one from stranding a session with no way
  back and no way to sign out. `docs/DECISIONS.md` 2026-08-11, `docs/spec/PHASE-10.md` D-1.
- **`nav.more_sections` (title/grouping) was not wired in.** Only `nav.hidden` — the field the
  contract itself calls the only one that makes a module unreachable — was implemented. The
  existing More groups carry curated, role-conditional presentation (a live ticket count,
  Master/Admin copy switches, the view-as sheet) a generic renderer would have flattened for a
  benefit the phase's own done-when never asked for. D-3.
- **`prospects`/`tickets` were not turned into physical bottom tabs**, even though the schema's
  `nav.tabs` enum allows them. Neither route lives inside the `(tabs)` group today; doing that is a
  bigger structural change than this phase's budget. A config naming either one degrades to
  "reachable from More" — same as before this phase. D-2.

## Known broken / deliberately skipped

- **The branch is not pushed — `git push origin Shivam` returns 403.** Needs a human to grant
  `Dev-Shivam-05/CGPE-ANDROID-APPLICATION` write access or swap the credential in Windows
  Credential Manager. Unchanged for several sessions running.
- **`nav.more_sections` still does nothing on device** — deliberate, see above. A future phase if
  the product actually wants panel-driven section order.
- **`prospects`/`tickets` still cannot be selected as a physical bottom-tab slot** — deliberate, see
  above. Moving those screens into the `(tabs)` route group is real, separate work.
- **`nav.tabs[0]`'s documented meaning ("the landing screen after sign-in") is not wired to
  `app/index.tsx`'s redirect.** Not in this phase's file list or done-when; a misconfigured entry
  there would risk breaking sign-in itself, a different risk class than reordering a bar. Left for a
  future phase if wanted — `docs/spec/PHASE-10.md` D-4.
- **Everything already carried from Phases 1, 4, 5 and 7's handset-only acceptance criteria remains
  unverified** — no device work happened this session (haptics, the AsyncStorage clock key,
  background GPS, a shift's route appearing under the master's replay, airplane-mode behaviour).
- **`src/screens/dashboards.tsx:292-297` still shows all-zero Master KPI tiles on a partial
  outage** — still in no phase's file list. Carried since Phase 3.
- **`addTask`, `reassignTask`, `toggleReminder`, `toggleTaskStep`, `toggleClaimDoc` still fabricate
  success** — Phase 9, blocked on `cgpe-api`.

## Next session starts here

- **Phase 13 is next per `docs/PHASES.md`'s "Next 3"** — vendor Leaflet. `src/ui/LeafletMap.tsx`
  pulls Leaflet 1.9.4 from unpkg at runtime with no SRI and no offline fallback, in a field-sales
  app whose users are on mobile data by definition.
  **Files:** `src/ui/LeafletMap.tsx`, `assets/`.
  **Done when:** the map renders with the network blocked after first load.
- First command: `npm test`.
- Watch out for: **the Leaflet *library* (JS/CSS) can be vendored as a local asset, but the map
  *tile images* (OpenStreetMap imagery) are a separate, much larger CDN dependency that genuinely
  cannot be bundled wholesale.** Read the phase's own done-when literally before assuming which of
  the two it means — "renders with the network blocked" could mean "the map frame and controls
  appear with no imagery" rather than "fully offline satellite/street tiles," and building the wrong
  one wastes the phase. Also, as always: **re-read `../contracts/INBOX.md` fresh at boot** — it grew
  67 lines (2216 → 2283) during this session alone from a `cgpe-api` Phase 8 notice unrelated to
  mobile, and this session's own reply added another ~40. Anchor edits on surrounding text, never a
  line number, and grep your own reply back immediately after writing it.
