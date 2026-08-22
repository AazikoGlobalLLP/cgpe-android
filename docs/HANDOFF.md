# HANDOFF — CGPE Connect (Android) — Phase 78 (client Idempotency-Key wiring) — 2026-08-22

The big outcome: **a create that the server already saved can no longer be saved twice.** When the
network drops the acknowledgement *after* the server committed a new lead / task / note, the offline
write-queue used to re-POST it on reconnect and insert a second identical row — a duplicate lead that
double-counts the pipeline and sends two agents after one prospect. The client now stamps each create
with an `Idempotency-Key` the server dedupes on, so the reconnect replay is recognised as the same
create, not a new one. This closes audit item **#7** (duplicate-create), which had been backend-blocked
until cgpe-api shipped the header contract (Backend Phase 81).

## Done
- **All three additive creates send a per-create `Idempotency-Key` header** — `addLead`→`POST /leads`,
  `addTask`→`POST /team/tasks`, `addNote`→`POST /notice-board`. Key shape `idem-<ts36>-<rand>-<rand>`,
  always within the server's required 8–200 chars.
- **The key is generated ONCE per logical create and stored on the queued draft**, so the offline
  reconnect *replay* re-sends the SAME key. That is the load-bearing property: the server dedupes on
  `(creator, key)`, so a committed-but-unacked create replays its stored 2xx instead of inserting a
  duplicate row.
- **Back-compatible + live-safe:** opt-in/additive, so it is safe to ship before the backend redeploy
  (an un-deployed server just ignores the header); a draft persisted before this phase has no key and
  replays exactly as it did before (no worse than the old behaviour).
- Gates green: `tsc` 0 · `npm test` **787** (was 778, +9) · lint **0 new errors** (2 pre-existing warnings).

## Files changed
- `src/data/api.ts` — new `newIdempotencyKey()`; `addLead`/`addTask`/`addNote` generate a key, send it
  as a header on the online POST, and pass it to `enqueueWrite`; `enqueueWrite` stores it on the draft;
  `replayWrite` re-sends `draft.idempotencyKey` (or nothing, for an old draft) on all three kinds.
- `src/lib/writeQueue.ts` — `QueuedWrite` gains an optional `idempotencyKey`; the parser accepts it as
  optional so an old persisted queue still parses.
- `src/data/__tests__/api-idempotency.test.ts` (NEW) — 9 tests: every online create sends a valid-length
  key; two creates get different keys; a thrown create stores the same key on its draft; the flush replay
  re-sends the stored key; an old key-less draft replays without the header.

## Decisions made
- **Generate the key BEFORE the first online attempt, not at enqueue time.** The duplicate happens when
  the very first POST commits server-side but the ack is lost — so the first attempt and its replay must
  carry the *same* key. Generating it only when the draft is enqueued would give the replay a fresh key
  the server has never seen, and the duplicate would survive. The key is therefore created at the top of
  each create and threaded through both the online header and `enqueueWrite`.
- **Don't touch `flushDecision` for the idempotency 4xx codes.** 409 `idempotency_in_progress` /
  422 `key_conflict` / 400 `key_invalid` are all unreachable in correct sequential client operation
  (the online attempt throws before enqueue; the flush is re-entrancy-guarded; keys are unique-per-create
  and always valid length), so the existing "4xx → drop with a one-time notice" is safe as-is. Documented
  in `replayWrite`'s comment rather than adding a special case that can never fire.
- **`[m]`-only, no contract change.** cgpe-api already published the header contract; mobile is a pure
  consumer (~3 one-line header additions + the queue-draft field).

## Known broken / deliberately skipped
- **Device-unverified** — the dedupe only fires on a real committed-but-unacked create over a degraded
  network; not reproducible in tests or on web. OTA-eligible (JS-only, no native dep) — rides the next
  OTA/APK.
- **Needs the backend redeploy to actually dedupe on prod** — the client is harmless until cgpe-api's
  droplet redeploy + `:3001` restart lands (owner/OPS). Until then the header is sent and ignored.
- **`POST /track/start`** has the same unchecked-upsert weakness cgpe-api fixed on `/track/points`, but
  it was out of scope of the audit ask; cgpe-api offered to harden it on request (INBOX, their note).
- **Network "can't reach server"** — still the MTU/IPv6 server-path issue, NOT an app bug; dual-stacking
  `cgpe.in` (AAAA + IPv6) is owed by OPS (INBOX → cgpe-api/OPS). MSS clamp is the interim fix.
- **Push still doesn't deliver** — owner still owes the FCM V1 service-account key upload to EAS (Phase 74).

## Next session starts here
- **Resume the owner-backlog build.** Open mobile items (owner picks): **B1** master detail · **D4** tasks
  calendar view · **C2** clock-out reason · **D3** team-screen reorder · **D6** UX simplification.
- First command: `/boot`
- Watch out for: **C2 needs a spec-lock first** (the exact clock-out hour threshold + who sees the reason) —
  do not invent the number. And if "can't reach server" recurs it is the **MTU/IPv6 server-path** issue, not
  an app bug (confirm `cgpe.in` has an AAAA + the MSS clamp is still in place); ADB device-driving works
  from here (platform-tools + a static aarch64 curl are in the session scratchpad).
