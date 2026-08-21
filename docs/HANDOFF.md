# HANDOFF — CGPE Connect (Android) — Phase 74 (Android push enablement + launcher icon + owner backlog triage) — 2026-08-21

Two things shipped this session, plus a large NEW owner backlog was **triaged** (not built — the owner asked only to
identify mobile vs backend and hand off). `[m]` only; no contract change from the shipped work.

## Done
- **The app can now do Android push (build side is complete).** Owner created a Firebase project (`com-cgpe-connect`) and
  added `google-services.json`; it is now **wired in `app.json`** (`android.googleServicesFile`) and a **push-enabled APK is
  cut** — EAS build `0d68ac07-e05e-4abe-8100-1755b8a91065`, profile `preview`, v1.10.0, git `ce9b1e6`, direct
  `.apk`: `https://expo.dev/artifacts/eas/SgvwNK6KD0bNInbOO87K3g32-_Gf1OhRkAStPxk74WI.apk`. Backend push endpoints are LIVE on
  prod (`/push/register` → 401). **Push will not DELIVER until the owner uploads the FCM V1 key to EAS (still pending).**
- **The launcher / app-drawer icon now fits.** The adaptive icon was using the raw non-square logo edge-to-edge, so the
  round/rounded mask cropped it. Generated a **1024² adaptive foreground** with the CGPE logo padded into the central ~60%
  safe zone, plus a **square white main icon** (fixes the 827×975 non-square source). Rides the NEXT build.
- **The FCM service-account key is secured.** It landed untracked in the repo; added a `.gitignore` rule so the secret can
  never be committed. `google-services.json` (client config, safe) is committed for the build.
- **The whole 2026-08-21 owner backlog is triaged** in `docs/OWNER-BACKLOG-2026-08-21.md` — ~18 items split into
  `[m]` / `[api]` / `[admin]` / `[data-ops]`, with the ones that need owner spec-lock flagged.

## Files changed
- `app.json` — `android.googleServicesFile` added; `icon` → `android-icon-cgpe.png`; `adaptiveIcon.foregroundImage` → `android-icon-cgpe-foreground.png` (splash logo untouched).
- `google-services.json` — NEW, committed (Firebase client config for `com.cgpe.connect`; safe to commit).
- `.gitignore` — NEW rules: `*-firebase-adminsdk-*.json`, `google-service-account*.json` (the FCM V1 SECRET, never commit).
- `assets/images/android-icon-cgpe-foreground.png` — NEW, 1024² padded adaptive foreground (logo at 60% safe zone).
- `assets/images/android-icon-cgpe.png` — NEW, 1024² square white main icon.
- `docs/OWNER-BACKLOG-2026-08-21.md` — NEW, the triaged owner backlog.
- Commits: `ce9b1e6` (push enablement), `5c8ac46` (icon fit).

## Decisions made
- **Transport = FCM/Firebase; the key Expo needs is the FCM V1 SERVICE ACCOUNT JSON (Service accounts tab → Generate new
  private key), NOT the Web Push / VAPID key** (owner grabbed the VAPID one by mistake). Legacy Cloud Messaging API stays
  DISABLED — V1 is what Expo uses.
- **FCM key upload is an owner interactive step, not mine.** `eas credentials` has no non-interactive flag and this session's
  stdin is EOF; the EAS CLI is already authed (`shivam-bhadoriya`), so the owner needs NO expo.dev login/email — they run
  `npx eas-cli credentials -p android` in a normal terminal and point it at the JSON.
- **Icon fixed by padding into the Android adaptive safe zone** (central ~60% of 1024²), not by shrinking the source in-place —
  the mask reserves the outer ~33%, so a full-bleed foreground always crops. New files only; brand + `#ffffff` are grounded.
- **The backlog was triaged, not built** — the owner's instruction was "identify mine vs backend, then /handoff."

## Known broken / deliberately skipped
- **Push does not deliver yet** — the FCM V1 service-account key is not uploaded to EAS (owner's `eas credentials` step; they
  hit a Windows "Press any key" terminal quirk — retry in PowerShell, or just install+login+create-a-task to test).
- **Icon fix is not in the installed APK** — it rides the next build (owner asked for it "before the next build" — done in code).
- **Nothing from `docs/OWNER-BACKLOG-2026-08-21.md` is built.** Several items need owner spec-lock first (C2 hour threshold,
  D6 what-to-simplify, B2/B5 the consent-vs-visibility reality).

## Next session starts here
- **Phase 75: verify push end-to-end, then pick the highest-value backlog item.** First confirm FCM is uploaded (install APK
  → login → create a task → does a closed phone get the notification?). If yes, cut ONE clean build that also carries the icon
  fix. Then start the triaged backlog — likely **B1 (master detail)** or **D4 (tasks calendar view)**, after spec-locking.
- First command: `/boot`
- Watch out for: the FCM **service-account** key (Service accounts tab) vs the **VAPID** key (Web config) — only the former
  works; and it is a **secret** (already gitignored — keep it that way). Backend deploy gap is CLOSED (`origin/main` `10e1f76`),
  so re-diagnose "not working" items as mobile-render / backend-data / config, NOT as un-deployed backend.
