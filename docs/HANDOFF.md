# HANDOFF — CGPE Connect (Android) — matured-policy fix + installable APK cut + web E2E green — 2026-08-15

This session was owner-driven, not a numbered-phase build. Three real outcomes: (1) a genuine
data-logic bug the owner spotted was **fixed and shipped**, (2) an **installable APK was built and
handed over** (twice — proving EAS cloud build works from here despite the git-push 403), and (3)
the full **watchable web E2E suite was run green (33/33)**. Phase 41 device-verification is still the
roadmap "Now" and is untouched (it needs a handset, which this session could not do).

## Done (observable behavior)
- **A policy whose maturity date has passed now shows "Matured", not "In force".** The owner's
  screenshot (maturity Mar 2023, still reading "In force") is fixed — every matured policy app-wide
  now reads correctly, because status is derived from the maturity date instead of being hardcoded.
- **A matured policy no longer shows a "Premium due / X days late" alarm** (it has no premium due).
  A genuinely in-force overdue policy still shows its reminder unchanged.
- **An installable preview APK exists** with both fixes: direct link
  `https://expo.dev/artifacts/eas/WMrRPacaPdg0Tb1W41rQuR-NztEYSOsfvXZDrcl3TYo.apk`
  (build `7cdc351d-8e21-40ba-9851-eea9b159ac77`, v1.8.0). Open on an Android phone → Install.
- **Web E2E: 33/33 passed (5.8 min)** — all 42 screens render, worst-case backend states
  (500/503/timeout/malformed/empty/oversized) keep the HealthBanner honest, forms survive hostile
  input. Artifacts (73 screenshots + video + trace) under `e2e/artifacts/`.
- **WiFi "network error" was diagnosed, not fixed:** the backend is proven healthy and fast
  (HTTP 200, ~40 ms, IPv4-only) — so the failure is that specific WiFi cannot reach `cgpe.in`
  (captive portal / firewall / no-internet), NOT the app or a mobile-data requirement (there is no
  network-type check anywhere in `src/`). Awaiting the owner's on-phone browser test to confirm which.

## Files changed
- `src/data/adapt.ts` — `adaptClient` derives policy status from the maturity date (past ⇒ `'matured'`,
  else `'in_force'`); was hardcoded `'in_force'` for every policy. Commit `390f7ab`.
- `src/data/__tests__/adapt.test.ts` — +4 cases pinning matured (past) / in_force (future) / in_force
  (no maturity date); fixed the now-wrong "can never emit any other status" comment.
- `src/app/client/[id].tsx` — hide the "Premium due" KPI + the "Next premium" row on a matured policy.
  Commit `588a90d`.
- `docs/spec/PHASE-41-DEVICE-CHECKLIST.md` (new) — one walkable 16-row device-verification matrix
  consolidating §12.7 / §3 / 41b-c-d, each row anchored to code + observable. Commit `b0d8c86`.
- `docs/i18n/PHASE-41-CONSENT-COPY.md` — un-staled the blocked-screen section (copy landed + wired).
  Commit `b0d8c86`.

## Decisions made
- **Matured status is derived client-side from the maturity date** (owner-confirmed via
  AskUserQuestion 2026-08-15). The lic-import doc carries no reliable status field, so a past maturity
  date is the one status we can know for certain. `lapsed`/`paid_up` are left untouched (no data to
  infer them). See DECISIONS 2026-08-15.
- **Premium-due is hidden on matured policies** (owner-chosen) so the screen isn't self-contradictory.
- **The WiFi issue is environmental, not code** — validated from here (server 200/~40 ms). No code
  change made; the 4.5 s `REQUEST_TIMEOUT` is not the cause when the network is good. See DECISIONS.
- **EAS cloud build works from this environment** — used it to hand over a real APK. Documented in
  `CLAUDE.md` so the next session doesn't assume the push-403 blocks shipping.

## Known broken / deliberately skipped
- **Phase 41 device verification is untouched** — still needs a native APK on 3+ handsets (the new
  `7cdc351d` APK is exactly the build to use). Walk `docs/spec/PHASE-41-DEVICE-CHECKLIST.md`.
- **WiFi fix is pending the owner's phone-browser test** (`https://cgpe.in/internal/api/health` on the
  failing WiFi). If it loads but the app fails → revisit app-side (raise the 4.5 s timeout + retry);
  if it doesn't load → the WiFi blocks the server, no app fix helps.
- **`git push` still 403s** — all three commits (`b0d8c86`, `390f7ab`, `588a90d`) are local only.
  Blocks Phase 49. Needs a human credential swap.
- **Native surfaces still web-unverified** (haptics, GPS, biometric, native map, cold-start) — the E2E
  green run is the web slice only (`e2e/WEB-LIMITS.md`).
- **The 5-language E2E matrix (`50-languages`, ~15 min) was offered but not run** this session.

## Next session starts here
- Phase 41: **device-verify on a handset** using the new APK (`7cdc351d`) + `PHASE-41-DEVICE-CHECKLIST.md`;
  and close the WiFi question with the owner's browser-test result.
- First command: `/boot`
- Watch out for: **a "network error on WiFi" is almost always the WiFi, not the app** — the backend is
  proven healthy/fast and there is NO mobile-data requirement in `src/`; don't rebuild the APK to "fix"
  WiFi until the on-phone `health` test proves the app can even reach the server on that network.
