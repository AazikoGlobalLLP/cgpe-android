# HANDOFF — CGPE Connect (Android) — Owner 12-point backlog triaged + APK cut — 2026-08-24

## Done
- **Cut ONE `preview` APK** (`7a384ee3`, git `04c36d6`) that carries the whole accumulated OTA backlog
  (A3, B5, D3/B1/D4/C2/D6, E2, D5) to a phone for the first time. Gates green before build: `tsc` 0,
  `npm test` **827/827**. Direct `.apk`:
  https://expo.dev/artifacts/eas/TDTciayd0aC7sfbxzd_yEn8uvxjgtRYrsSvzO8Fk-zA.apk ·
  SHA-256 `f17227222fe0b63aaba8535751ce1da47f3c6762a1dc8143eb7f07222e5ebf65`.
- **Triaged + deeply described the owner's 12-point backlog**, verified against REAL code (this app +
  backend deployed `origin/main` `49482e9` + `contracts/`) by a 12-agent workflow — nothing guessed,
  every claim cites a file. Prioritized with **highest priority to items only the owner can unblock**.
- Surfaced findings the surface description hid: **report "not working" is a real 12 s client-timeout
  bug** (the backend waits 60 s for a 15–40 s render; the app aborts at 12 s → every FRESH report dies);
  **the client book is readable by every team token** (backend/data, hiding the tab is cosmetic);
  **role RBAC is built + deployed but never seeded**; **team-tier members cannot create tasks** yet the
  UI invites them; **document upload has no file picker** and cloud storage is off on prod.

## Files changed
- `docs/OWNER-BACKLOG-2026-08-24.md` — NEW. The deliverable: master priority table, Band-1 owner asks,
  a deep section per point (verified current state + root cause + who owns it + what changes + effort +
  decisions needed), and copy-paste relay texts. This is the driving worklist now.
- `docs/DEVICE-TESTING-GUIDE-2026-08-24.md` — NEW. Delta testing guide for the `7a384ee3` APK (A3/B5/
  D3/B1/D4/C2/D6/E2/D5) + corrected connectivity facts (12 s timeout + retry; IPv6/NAT64 note).
- `docs/PHASES.md` — `## Now` gained the 12-point triage rows + the APK; `## Next 3` re-pointed below.
- `docs/DECISIONS.md` — appended the triage decisions (below).
- `docs/STATUS.md` — rewritten (manager-plain).
- Memory `owner-backlog-12points-2026-08-24` added (+ MEMORY.md index line).

## Decisions made
- **APK first (owner option b).** A large OTA backlog was stranded behind one build; cut it before more
  code so nothing else blocks the team seeing A3/B5/D3/B1/D4/C2/D6/E2/D5.
- **Investigate before describing.** Ultracode-on + "describe each deeply" → a 12-agent workflow verified
  every point against real code rather than paraphrasing the owner's words. This caught the report timeout
  bug and the client-book exposure, neither of which is visible from the surface complaint.
- **Prioritization = human-need-first, served both ways.** Band 1 = items only the owner can unblock
  (decisions / OPS / relays), surfaced at top to run in parallel; P0/P1/P2 = severity to the team.
- **INBOX untouched (corruption risk).** All backend/OPS asks are provided as plain-language relay texts
  in the backlog doc for the owner to send, consistent with prior sessions.
- **Nothing built yet.** This session produced the triaged plan + the APK; no feature code changed.

## Known broken / deliberately skipped
- **Reports still won't generate on-device** — needs the OPS webhook env set (owner), *and* the app-side
  12 s timeout fix (Band 2, not yet built). Both are required.
- **Client-book privacy exposure (P9)** — real, but the fix is a backend + contract + data change plus an
  owner decision; not fixable from this session.
- **Everything in the backlog is device-unverified and unbuilt** — it's a plan, not shipped code.
- Backend `[api]`/`[ops]` items can't be actioned here (push 403; prod runs `origin/main` only) — relayed.

## Next session starts here
- Phase: **Build Band 2, starting with the report 12 s timeout fix** (real bug, ~3 lines + tests, OTA):
  add `REPORT_TIMEOUT ≈ 65000` in `src/constants/config.ts`, pass it in `generateReport`
  (`src/data/api.ts:3237`), and stop a slow report from flipping the global outage banner. Then Tasks-tab
  local search, then the task-flow mitigations.
- First command: `/boot`
- Watch out for: **don't tell the owner a Band-1 item is "fixed" from code alone** — reports, uploads,
  client-access, and the role matrix all need the owner's OPS/decision half. And read
  `docs/OWNER-BACKLOG-2026-08-24.md` before starting — it has the verified file citations for each fix.

### Plain-language relays owed to the owner (also in the backlog doc)
- **OPS (3 switches):** report webhook env; DigitalOcean Spaces env for uploads; confirm WhatsApp n8n
  webhooks are in live-send mode. **Decisions:** what team members should see in Clients (privacy); the
  per-role/department access matrix; whether team members may create their own tasks. **Backend relay:**
  make server search tokenized (so "patel rajesh" finds "Rajesh Patel").
