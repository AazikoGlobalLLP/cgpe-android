# HANDOFF — CGPE Connect (Android) — H1 reason-Sheet localized + fresh APK + owner batch 70–73 triaged — 2026-08-20

Two things this session: (1) the Phase-50 out-of-range / early clock-reason prompt is now **fully localized in all 5
languages** and shipped in a **fresh EAS APK `b01f4164`**; (2) the owner reported **4 new items**, each **investigated
against the real mobile + backend code** (4 parallel agents, file:line cited) and written up as **Phases 70–73** — none
built yet.

## Done
- **H1 clock-reason Sheet fully localized (5 languages).** The out-of-range / early clock-in-out reason prompt in
  `home.tsx` (Sheet titles + field prompts + the 2 edge-case "reason needed" notices) now renders in
  English / ગુજરાતી / हिन्दी / Hinglish / Roman-Gujarati instead of English-only. Owner supplied the human copy in-chat.
- **Fresh APK cut + delivered:** EAS `b01f4164`, v1.10.0, gitCommit `8e9ad46`, direct `.apk`
  `https://expo.dev/artifacts/eas/4ZaCvftKnI8K2MD--kCCtkii2HRmTYzKYxILWbtqNT8.apk` — **supersedes `6b76608b`**. Contains the
  localized reason Sheet + the whole 63/64/66/67 batch. Build-page (Install button on the phone):
  `https://expo.dev/accounts/shivam-bhadoriya/projects/ANDROID/builds/b01f4164-10db-4154-bd66-5a4bcd621068`.
- **Owner's 4 new items triaged into grounded Phases 70–73** (session-logout / location-60min / team-notifications /
  phone-calendar-sync) — verified against real code, classified `[m]`/`[api]`/OPS/native-rebuild, each with open questions.
- Gates green: `tsc` 0 · `npm test` **625** · eslint 0 new (1 pre-existing `i18n/index.tsx` warning).

## Files changed
- `src/i18n/index.tsx` — +8 keys × 5 langs: `clock.reasonTitleOut/In`, `clock.reasonEarly`, `clock.reasonAway` (commit
  `08f3a4f`) and `clock.reasonNeededTitleOut/BodyOut/TitleIn/BodyIn` (commit `8e9ad46`). Owner copy, not machine-translated.
- `src/app/(tabs)/home.tsx` — the clock-reason `Sheet` (title/field label/buttons) and the two `setNotice` edge branches now
  use `t()`; added `t` to `toggleClock`'s dep array. Buttons reuse existing `common.cancel`/`home.clockIn`/`home.clockOut`.
- `src/i18n/__tests__/dictionaries.test.ts` — parity count 103 → 111 (two bumps, documented).
- `docs/PHASES.md` — new 2026-08-20 status block + Phases 70–73 rows; `## Now` / `## Next 3` updated.
- `docs/DECISIONS.md` — appended 2026-08-20 decisions.

## Decisions made
- **Localized H1 with owner-supplied copy, not a guess.** Machine translation is forbidden here; the owner pasted all 12
  strings in 5 languages, so the whole Phase-50 clock-reason surface is now honest in every language.
- **Left the two edge-case notices' English fallback in place until copy landed** (owner then supplied it, so both are now
  localized). The server's own `message` still wins over the fallback keys.
- **Cut a fresh APK immediately on owner request** — EAS archives the local working tree, so `b01f4164` carries local commits
  `08f3a4f`+`8e9ad46` even though `git push` 403s. Identify a build by **commit / build-ID**, never the version string (every
  preview build is v1.10.0 / versionCode 1).
- **Phases 70–73 written as grounded triage, not started.** The owner asked to "analyze well + make rows + handoff." Several
  need owner decisions (see Next) and 3 of 4 need a native rebuild — building blind would be wasted work.

## Known broken / deliberately skipped
- **Phase-50 office geofence still must NOT be enabled** until this APK (`b01f4164`) is installed on the field phones — until
  the fence is configured server-side, the (now-localized) reason prompt is latent and can't be end-to-end device-tested.
- **Phases 70–73 not built** — triage only. Each carries OPEN QUESTIONS the owner must answer before a sane build (esp. 70's
  Mech-A-vs-B question, 72's in-app-vs-real-push, 73's which-entities).
- **`git push` still 403s** — every commit local (`08f3a4f`, `8e9ad46`, plus the docs commit).
- **Physical/device tests still owner-owed** — bg GPS over a real shift, geofence at a real office, the localized reason
  prompt actually appearing (needs the fence live).

## Next session starts here
- Phase: **70 — the session "keeps logging me out / re-verify every 2-3 hours" fix.** Owner's #1. But FIRST get the owner to
  answer the disambiguating question, because it decides the entire fix:
  **when "logged out", is it (A) a dark fingerprint-only overlay (session alive — the AppLock grace-window `[m]` fix) or
  (B) the full email/OTP sign-in card (a real 401 — check prod `JWT_EXPIRE`, an OPS/`[api]` matter)?**
- First command: `/boot`
- Watch out for: **most of this batch needs a NATIVE APK rebuild (71 profile pickup, 72 push, 73 expo-calendar) — none are
  OTA.** And 70's "cookie/logout" is almost certainly the grace-window-less AppLock (`AppLock.tsx:77`) with the session still
  alive, NOT a token clear — don't chase a token bug before confirming which overlay the owner sees.
