# Store-release evidence — CGPE Connect 1.10.0

**Created:** 2026-08-29 · **Spec:** `CGPE_Connect_App_Store_Play_Store_Developer_Deployment_Spec.md` (Section 41)
**Basis:** branch `Shivam`; verified by an 8-agent read-only code audit (every claim cited to file:line).

This folder makes every store answer reproducible. Documents marked **✅ ready** are derived from the verified
code and can be used now. Documents marked **⏳ build/device** need a produced artifact (an EAS build log, a
device, a screenshot, a video). Documents marked **👤 owner** are account/web/ops deliverables I cannot produce.

## Contents

| File | Status | What it is |
|---|---|---|
| `android/permissions.md` | ✅ ready | The ~20-permission merged-manifest map + why each exists (Data Safety source) |
| `store-declarations.md` | ✅ ready | Play FGS + background-location declarations, Apple review narrative, demo-video script |
| `privacy/data-map.md` | ✅ ready | Full data inventory → drives Google Data Safety and Apple App Privacy |
| `privacy/retention-proof.md` | ✅ ready | The 90/180-day retention implementation + how to prove it is live on prod |
| `privacy/consent-copy-v01.md` | ✅ ready | The verbatim consent notice (v.01), all disclosures, and how consent is recorded |
| `security/secrets-scan.md` | ✅ ready | Source secret-scan result + release-binary scan checklist |
| `android/merged-manifest.txt` | ⏳ build | Paste from an EAS build log once the production AAB builds (quota resets 1 Sep 2026) |
| `android/disclosure-screenshots/`, `android/review-video.mp4` | ⏳ device | Record on a handset during Phase 8 QA |
| `android/device-tests.md`, `android/battery-tests.md` | ⏳ device | Fill from the real-device QA matrix (spec §39) |
| `ios/*` | 👤 owner + ⏳ | Needs the Apple Developer account (being purchased) + an iPhone; `review-notes` seeded in `store-declarations.md` |

## Release-readiness snapshot (spec §44.10)

| Area | State |
|---|---|
| 24/7 location (code) | ✅ verified correct; boundary-attribution fix landed 2026-08-29 (needs device walk-through) |
| Hourly sampling | ✅ verified (`HOURLY_MS = 3600000`, all profiles) |
| Consent (server-recorded, v.01, disclosures) | ✅ verified |
| 90/180-day retention | 🟢 implemented backend; ⏳ confirm deployed on prod `origin/main` |
| Secrets / HTTPS-only | ✅ verified |
| Android background-location + FGS declarations | ✅ drafted here; ⏳ needs screenshots + video |
| Data Safety / Apple App Privacy | ✅ data map ready; 👤 owner fills the console forms |
| Version consistency | ✅ reconciled to 1.10.0 |
| Android production build | ⛔ EAS free quota exhausted until **1 Sep 2026** (or paid plan) |
| iOS build / TestFlight | ⛔ needs Apple Developer account (owner purchasing) — EAS builds it in the cloud, no Mac required |
| `eas.json submit.production` credentials | 👤 owner (Play service-account JSON + Apple ASC API key) |
| FCM V1 key (push delivery) | 👤 owner (interactive `eas credentials`) |
| Public pages `cgpe.in/privacy`, `/delete-account` | 👤 owner (must resolve before review) |
| Store assets (feature graphic, screenshots, 512 icon) | 👤 owner |
| Reviewer/demo account | 👤 owner |
| Real-device QA (Android 24h, iOS) | ⏳ device |

## Recommended distribution route

**Private / organizational on both stores** — Managed Google Play private app (Android) + Apple Business Manager
Custom App (iOS). This preserves the 24/7 feature unchanged while removing the largest risk in the whole program:
public review of an employee-monitoring / 24/7 background-location app. Privacy policy, consent, Data Safety and
retention still apply; the public prominent-disclosure review and demo-video scrutiny are largely avoided.
Public listings remain a documented fallback (the declarations in `store-declarations.md` cover either route).
