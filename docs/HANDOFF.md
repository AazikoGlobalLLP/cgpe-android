# HANDOFF — CGPE Connect (Android) — Phase 41a — 2026-08-14

This session **built Phase 41a** (the buildable, testable slice of the 24/7 location feature) end to end:
the consent data layer, the owner-supplied 5-language consent copy, and the consent screen. It also
**verified cgpe-api's retention job (backend Phase 45)** against real code — the last backend piece owed.

## Done
- **24/7 location consent flow is built and demoable on web at `/consent`.** A mandatory, transparent
  notice renders in the signed-in user's language (all 5), **Agree** records consent via the real backend
  and proceeds to Home, **Decline** shows an honest "you cannot continue" state — no back, no skip, no
  bypass. The screen **never claims consent it did not record** (only a real 200 lets the user through).
- **The data layer both the screen and the future recorder need is shipped + pinned by tests:**
  `setLocationConsent(granted, version?)` (POST /consent) and `postAmbientPoints(points, date?)`
  (POST /track/ambient — token-attributed, NO session; 403 `consent_required` ⇒ stop + drop buffer).
- **Backend side of Phase 41's data plane is now COMPLETE (verified in real code).** cgpe-api shipped the
  retention job (Phase 45): 90-day soft-delete / 180-day hard-delete on `location_tracks` (both shift and
  `off_duty:true` ambient), and every track read excludes soft-deleted rows. Matches the filed ask exactly;
  **zero mobile change needed** (row set only narrows). With Phase 43 (consent + ambient), the server is done.
- Gates green: `tsc` 0 · `npm test` **454/454** (+19) · lint **0 errors / 12 warnings** (baseline).

## Files changed
- `src/data/api.ts` — NEW `setLocationConsent` / `postAmbientPoints` + result types (Phase 43 wire contract).
- `src/data/__tests__/api-ambient.test.ts` — NEW (19): pins both request bodies + every failure branch,
  incl. the no-`session_id` invariant and 403→stop, and the silent-recorder (no banner) posture.
- `src/i18n/index.tsx` — 19 `consent.*` keys in all 5 dictionaries (owner human copy `translation-v.01`,
  NOT machine-translated; doc-only `**bold**` stripped).
- `src/i18n/__tests__/dictionaries.test.ts` — parity gate **75 → 94**.
- `src/app/consent.tsx` — NEW mandatory consent screen (`CONSENT_NOTICE_VERSION='v.01'`).
- `docs/i18n/PHASE-41-CONSENT-COPY.md` — NEW English source + 5-language translation table.
- `docs/spec/PHASE-41.md` — §8 build order updated (41a-i data layer + 41a-ii copy/screen DONE;
  41a-iii device-only remains).

## Decisions made
- **api layer FIRST, then copy, then screen** — so the owner's "go" produced verifiable work despite the
  copy blocker; the device-only `tracker.ts` wiring is deferred to 41a-iii. (DECISIONS 2026-08-14, top.)
- **Consent version `'v.01'`** tracks the owner's copy version (`translation-v.01`) — one-line change if a
  date/`v1` scheme is preferred.
- **Screen is NOT yet auto-gated** — the app does not read the `me` block from `/rbac/config`; the screen
  lives at `/consent` standalone until the boot-gate slice reads `me.location_consent`.
- **Retention verified, not assumed** — read cgpe-api's `services/locationRetention.js` + the `deleted_at`
  read-filters; it matches the filed ask, so nothing for mobile to build.

## Known broken / deliberately skipped
- **41a-iii is device-only and UNBUILT:** the `me.location_consent` boot read + redirect-to-`/consent`
  gate, the battery-opt permission step in `tracker.ts`, the ambient recorder wiring (`postAmbientPoints`),
  and the 24/7 foreground notification. `tracker.ts` has **NO test stub** — provable only on a handset.
- **Backend Phase 43 + 45 are UNCOMMITTED** on backend `main` — the flow is not live end-to-end until
  cgpe-api commits + `:3001`-restarts. A device miss before that ≠ a mobile code bug.
- **`git push` still 403s** — all this session's commits (`2a4cf31` data layer, `8992bc9` copy doc,
  `a7bad0b` i18n, `2578839` screen) are **local only**. Human-owned credential swap (rule in CLAUDE.md).

## Next session starts here
- **Phase 41a-iii — [m] boot-gate + device wiring.** Add a `getLocationConsent()` read of
  `GET /rbac/config` `me.location_consent` (the app does NOT read the `me` block yet — a NEW read path, not
  `appUi.tsx`'s `normalizeUiConfig` which drops unknown fields), redirect to `/consent` on boot when status
  ≠ granted, then wire the `tracker.ts` ambient recorder (`postAmbientPoints`) + the battery-opt permission
  step + the neutral 24/7 foreground notification (`consent.serviceTitle`/`serviceBody`). All device-checked.
- **First command:** `/boot`
- **Watch out for:** `tracker.ts` is **device-only, zero test coverage** — nothing here is provable in
  Vitest/web. And do NOT wire the ambient recorder against Phase 43/45 until they are **committed +
  `:3001`-restarted** — a device miss before the backend is live is not a code bug (the Phase-34 OPS trap).
