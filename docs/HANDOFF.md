# HANDOFF — CGPE Connect (Android) — Phase 41a-iii-a — 2026-08-14

This session built **the editor-buildable, testable slice of Phase 41a-iii** — the consent boot-gate's
READ input — and deferred the rest (redirect wiring + `tracker.ts` device pieces) to one on-device pass,
because they are device-only and must not wire against the still-uncommitted backend Phase 43.

## Done
- **`getLocationConsent()` reads the caller's stored consent state** off `GET /rbac/config`
  `me.location_consent` and returns `ok`(granted/withdrawn/pending) / `error`. It is the input the boot
  gate will use to decide whether to show `/consent` and whether to start the ambient recorder. **Dormant
  until wired** — adding it changes zero runtime behavior (no caller yet), so the app behaves exactly as
  before this commit.
- The read is **fail-open + fully silent**: a legacy body with no `location_consent` block (Phase 43 not
  yet deployed), any non-2xx, or a dead network all collapse to `{status:'error'}`, and it **never raises
  the health banner** — so it can never trap staff behind the consent wall or pin a boot-time banner open.
- Gates green: `tsc` 0 · `npm test` **464/464** (+10) · lint **0 errors / 12 warnings** (baseline).

## Files changed
- `src/data/api.ts` — NEW `getLocationConsent()` + `ConsentReadResult` type. Reads `json.me.location_consent`
  (TOP-LEVEL on this envelope, NOT `.data`); fully silent, fail-open.
- `src/data/__tests__/api-consent-read.test.ts` — NEW (10): pins the `json.me` (not `.data`) unwrap, all
  three enum states, absent/odd fields → null, and the silent fail-open on legacy-body / 5xx / 403 / network.
- `docs/spec/PHASE-41.md` — §8 41a-iii split into `-a` (built) / `-b` (device-deferred).
- `docs/DECISIONS.md`, `docs/PHASES.md`, `docs/STATUS.md` — this handoff.

## Decisions made
- **Split 41a-iii into `-a` (read, done) and `-b` (wiring + device, deferred).** The redirect changes app
  entry for every user and is only verifiable on a handset against a live backend; the `tracker.ts` pieces
  are device-only and backend-live-gated. So "go" produced a gate-green, dormant, tested capability.
- **Verified the contract before coding** (the handoff was ambiguous): it is `GET /rbac/config` (not
  `/rbac/app-ui`), and `me` is TOP-LEVEL (`{ success, config, me }`, `routes/rbac.js:79`) — so the read is
  `json.me.location_consent`, not the app's usual `.data` unwrap. A test pins that a `.data`-only body is ignored.
- **Fully silent + fail-open** (deliberately unlike `getMdrtTier`): the read runs on every cold start and
  drives an invisible gate, so a banner would be the permanent-outage anti-pattern; `/rbac/app-ui`'s boot
  fetch is the surface that reports config-endpoint health.

## Known broken / deliberately skipped
- **41a-iii-b is UNBUILT (device-only + backend-live-gated):** the boot redirect to `/consent` when
  `getLocationConsent()` returns `ok` with status ≠ granted (a once-per-cold-start, fail-open, no-flash/no-loop
  guard — reliably at `_layout.tsx` level, NOT `index.tsx` which only runs at `/`); the battery-opt step; the
  ambient recorder (`postAmbientPoints`) in `tracker.ts`; the neutral 24/7 foreground notification
  (`consent.serviceTitle`/`serviceBody`). `tracker.ts` has NO test stub — provable only on a handset.
- **Backend Phase 43 (+45) still UNCOMMITTED / not `:3001`-restarted** — until then `me.location_consent` may
  be absent (the read correctly fails open on that). Do NOT wire the recorder before it is live (Phase-34 trap).
- **`git push` still 403s** — commit `8e76bbe` is local only. Human-owned credential swap (CLAUDE.md).

## Next session starts here
- **Phase 41a-iii-b — the boot gate + device wiring.** Wire the `_layout.tsx`-level fail-open redirect
  (`getLocationConsent()` is ready), then the `tracker.ts` ambient recorder + battery-opt step + 24/7
  foreground notification. All device-checked, and only after backend Phase 43 is committed + `:3001`-restarted.
- **First command:** `/boot`
- **Watch out for:** the redirect changes app entry for EVERY user and is native/device-only to verify —
  it must fail open (redirect ONLY on a confirmed `ok` + non-granted), never flash Home-then-bounce into a
  loop, and survive Expo's restored-route cold start. And do NOT wire the ambient recorder until Phase 43 is
  live on `:3001` (a device miss before that is not a code bug).
