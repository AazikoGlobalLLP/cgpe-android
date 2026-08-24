# HANDOFF — CGPE Connect (Android) — Band 2 #5–#7 (Search / Premium / Client access) — 2026-08-24

## Done
- **Team members can no longer reach the client book.** A team-tier advisor now sees **no** Clients tab,
  no Clients / Segments / Families / "Premium and greetings" menu entries, no client tiles on Home, and
  **no client rows in global search** — and deep-linking a client, segment, family, or campaign lands on a
  clean "master and admin only" panel instead of the data. Master and the whole admin tier (admin + leader)
  keep the full book. **This is the app-side half; the real fix is a backend 403 that is FILED for the owner
  to relay (see below) — until it deploys, a technical user could still hit the API directly.**
- **Campaigns no longer leaks the client book to team.** Its audience preview was rendering real
  policyholder names/phones/premiums (whole book, `scope=all`) to team members even though the send was
  already blocked — an adversarial review caught it as HIGH. It is now behind the same gate.
- **A campaign that a role can't bulk-send no longer reads as "Dispatch failed."** A 403 role-refusal now
  shows an amber "Your role cannot send bulk campaigns" on both campaign screens and the job monitor
  (previously red "Dispatch failed", or a green "100% Send finished" in the monitor).
- **The duplicate `/premium` screen is retired** — its Home/More/dashboard entries now open `/campaigns`.
- **Band 2 #5 (client-only search) was closed as no-build** — the owner chose "keep global search, just rank
  clients first," which it already does; recorded so it isn't rebuilt.
- Gates on the final state: `tsc` 0 · `npm test` **902** (+11 over the session) · `eslint` 0 new errors.
  Every substantive change passed an adversarial multi-agent review. All device-unverified (OTA-eligible).

## Files changed (this session, by commit)
- `9121020` — `docs/spec/BAND2-5-client-search.md` (NEW): decision record, no code (Band 2 #5).
- `fb64734` — `src/lib/campaignOutcome.ts` (NEW, +5 tests): the pure "a role refusal is a completed job that
  delivered nothing, never a failure" rule; `store/jobs.tsx` (typed `Job.needsRole`, both send paths use it);
  `app/premium.tsx` + `app/campaigns.tsx` + `app/job/[id].tsx` (refusal-aware); `lib/format.ts` (deleted dead
  `greeting()`).
- `9967db3` — `app/(tabs)/home.tsx`, `app/(tabs)/more.tsx`, `screens/dashboards.tsx` (repointed 3 `/premium`
  entries → `/campaigns`); deleted `app/premium.tsx`.
- `4575106` — `store/roles.ts` (NEW `canViewClients(user,viewAs)` + 6 tests in `roles.test.ts`);
  `ui/RestrictedNotice.tsx` (NEW shared guard panel); screen guards on `(tabs)/clients.tsx`, `client/[id].tsx`,
  `segments.tsx`, `families.tsx`, `campaigns.tsx`; entry-point gates in `(tabs)/_layout.tsx`, `(tabs)/more.tsx`,
  `(tabs)/home.tsx`, `search.tsx`; spec `docs/spec/BAND2-7-client-access.md`.

## Decisions made
- **Client access = master/admin only** (owner). Team sees nothing client-related; this option needs no
  data-ownership job (unlike own-only/team). Predicate `canViewClients = tier !== 'team'` — INCLUDES the admin
  tier (admin + leader run a branch) and is view-as-aware, so a master previewing "team" loses the book.
- **Campaigns is gated as part of Point 9** even though the owner's words said "the Clients section" — its
  audience preview *is* the client book, and leaving a confirmed HIGH PII leak open while calling Point 9 done
  would be dishonest. Reversible if the owner disagrees.
- **Retire `/premium`** (owner): `/campaigns` is a strict superset with correct 403 handling.
- **A role-refusal is `status:'done'` (terminal, not failed)** with a typed `needsRole` flag every surface
  reads — chosen over marking it `'failed'` (which mislabeled it red) or leaving it (which showed green success
  in the monitor).

## Known broken / deliberately skipped (owner-owned)
- **Backend 403 not yet in place** — the app gate is defence-in-depth only. `GET /clients` + `/clients/:id` are
  `protect`-only and a team advisor's non-strict scope treats the ~9,000 unowned book as firm-visible. Relay
  FILED at the top of `../contracts/INBOX.md` (owner relays + confirms `:3001` deploy).
- **Adjacent client-PII surfaces NOT gated (owner call open):** the WhatsApp hub, search's Tickets group, and
  the task-contact sheet (a member contacting the client on their own assigned task) still show client
  names/phones. Left because they're the member's own work, not book-browsing.
- The 4 non-English `emptyCalendarBody` copies still say "strip" (from Band 2 #4) — owe one human line each.
- `more.tsx:129` has a pre-existing `'c' unused` lint warning — untouched (not introduced this session).

## Next session starts here
- Phase: **Band 2 #9 — Contest mapper fix** (P2, OTA, self-contained latent bug — every field of the app's
  Contest type mismatches the backend, so any real contest renders blank; no owner dependency) **OR Band 2 #8 —
  wire the 10 inert role toggles** (P1, but needs the owner's Point 6 role matrix first). Authoritative worklist:
  `docs/OWNER-BACKLOG-2026-08-24.md`.
- First command: `/boot`
- Watch out for: **do not weaken `canViewClients`** or remove the screen guards — that re-opens the client-book
  PII gate. And remember the app gate is NOT the authority: confirm the `[api]` INBOX relay was picked up before
  telling the owner clients are "locked down" end-to-end.
