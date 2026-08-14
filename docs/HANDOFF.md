# HANDOFF — CGPE Connect (Android) — Phase 41a-iii-b (part 1: the consent boot gate) — 2026-08-14

This session built **the editor-verifiable half of Phase 41a-iii-b** — the consent **boot gate** that
redirects a signed-in, not-yet-consented user to the mandatory `/consent` notice — and deferred the
`tracker.ts` device pieces to the on-device pass. First it re-checked the backend and found the previous
hard-block **cleared**.

## Backend blocker cleared (checked first, before writing any code)
- `909b117 backend: Phases 43-46 — location retention & ambient consent` is **committed** (backend working
  tree clean) and cgpe-admin's INBOX re-verify confirms that exact commit is **live on `:3001`** (serving PID
  started 16:42:36). So the last handoff's "Phase 43 uncommitted / not `:3001`-restarted" trap **no longer
  holds** — the ambient/consent endpoints are live. The remaining constraint is purely **device-only
  verification**, not a backend dependency.

## Done — the boot gate (redirect), fully gate-green
- **`needsConsentGate(read)` — NEW pure predicate in `src/data/api.ts`** beside `getLocationConsent`. Redirect
  ONLY on `ok` + non-granted (`pending`/`withdrawn`); `granted`→no; **`error`→no (FAIL OPEN)**. Extracted so
  the fail-open invariant — an outage / pre-Phase-43 backend / dead network must NEVER bounce every user to
  `/consent` — is pinned by a test, not buried in an effect.
- **`ConsentGate` — NEW headless component in `src/app/_layout.tsx`**, mounted in `RootNav` beside
  `AppLock`/`JobPill` (the live navigation context — JobPill navigates from exactly there). Fires **once per
  signed-in session** (a `checked` ref, reset only on sign-out) so it can't loop; the consent screen's own
  Agree→`replace('/(tabs)/home')` never re-triggers it. **Native-only** (the gate enables the native
  recorder; web has none, and the e2e web harness must keep reaching every screen). Runs at `_layout.tsx`
  level, NOT `index.tsx` (which only mounts at `/`), so it survives Expo's restored-route cold start.
- Gates green: `tsc` 0 · `npm test` **467/467** (+3) · lint **0 errors / 12 warnings** (baseline; the two
  touched `src` files add 0 new — the 4 warnings eslint shows on them all pre-date this change).

## Files changed
- `src/data/api.ts` — NEW `needsConsentGate(read: ConsentReadResult): boolean` (the fail-open gate decision).
- `src/app/_layout.tsx` — NEW headless `ConsentGate` + its mount in `RootNav`; added `useRouter`/`Href`/
  `Platform`/`useRef` imports and the `getLocationConsent`/`needsConsentGate` import.
- `src/data/__tests__/api-consent-read.test.ts` — +3 cases pinning `needsConsentGate` (non-granted→true,
  granted→false, **error→false, the fail-open invariant**).
- `docs/spec/PHASE-41.md` (§8 41a-iii-b split into part 1 built / part 2 device), `docs/PHASES.md`,
  `docs/DECISIONS.md`, `docs/STATUS.md` — this handoff.

## Decisions made
- **Split 41a-iii-b into part 1 (redirect, editor-verifiable, done) and part 2 (`tracker.ts` device pieces,
  deferred).** Same testable-slice split every prior 41a step used: the redirect is app code that gates green;
  the `tracker.ts` pieces have zero test path (no stub) and are a danger zone, provable only on a handset.
- **Extracted the decision as a pure predicate** so the fail-open safety property is unit-tested. A one-liner
  that, if the `error` branch were wrong, would trap every staff member behind the consent wall — so it earns
  a pinned test.
- **No `let alive` cancel guard in `ConsentGate`** (deliberately unlike every screen): the component is
  process-lifetime like `AppLock` and performs NO setState — only a one-shot `router.replace` — so an `alive`
  flag is unnecessary and would in fact swallow the redirect under React StrictMode's dev double-mount.
- **`/consent` cast `as Href`** — it postdates the last generated route type (exactly as `/earnings` does in
  `attendance.tsx:240`) until `expo start` regenerates `.expo/types`. Not a route bug.

## Known broken / deliberately skipped
- **41a-iii-b part 2 is UNBUILT (device-only):** the battery-opt step in `ensureBackgroundPermission`; the
  ambient recorder in `tracker.ts` calling `postAmbientPoints` on grant; the neutral 24/7 foreground
  notification (`consent.serviceTitle`/`serviceBody` copy already exists from 41a-ii). `tracker.ts` has NO
  test stub — provable only on a handset. Backend is now live, so this is no longer backend-gated, only
  device-gated.
- **The redirect's on-device UX is unverified here:** that a non-granted user lands on `/consent` with no Home
  flash-then-bounce, no loop, and survives a restored-route cold start. The pure decision IS unit-tested; the
  boot-navigation behaviour has no test stub and needs a handset.
- **`git push` still 403s** — this session's commit is local only. Human-owned credential swap (CLAUDE.md).

## Next session starts here
- **Phase 41a-iii-b part 2 — the `tracker.ts` device pieces**, on a real device: battery-opt exemption step,
  the ambient recorder wiring (`postAmbientPoints` on grant), and the 24/7 foreground notification — plus the
  on-device UX check of the boot gate built this session. Backend Phase 43/45 is live on `:3001`, so wiring
  the recorder is now safe (the Phase-34 trap is cleared).
- **First command:** `/boot`
- **Watch out for:** the boot gate changes app entry for EVERY user — on device, confirm a granted user never
  sees `/consent`, a non-granted user reaches it without a Home flash-then-bounce or a loop, and a config
  outage (read → `error`) leaves everyone on their normal Home (fail-open). Do the recorder wiring at
  `Accuracy.Balanced`/batched per §3 so battery stays flat.
