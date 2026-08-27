# HANDOFF — CGPE Connect (Android) — Phase 79 — 2026-08-27

## Done

The session started as "finish what's left" and the biggest thing found was not on any list: **the
login screen has been showing users raw machine tokens on production.**

- **`NO_ACCOUNT` and `BAD_PASSWORD` were appearing on screen as the error message.** Probed live, not
  inferred. The backend puts a code in `error` and the human sentence in `message`; the app read
  `error` first. So the two commonest failures in the product — a mistyped address and a wrong
  password — told the user a machine word, under the heading "Sign in refused", while the sentence
  explaining what to do sat one field away unread.
- **Backend Phase 94 arrived mid-session and is consumed.** `cgpe-api` answered our whole
  upload/storage item while we were working. Files can now be linked to a claim for real. **It is not
  deployed**, and that is stated everywhere it matters.
- **The app got its first React error boundary.** It had none — verified in the installed
  expo-router, not assumed — so any render throw killed the whole app with nothing on screen.
- **i18n Batch 5 is extracted**: 47 sign-in strings, quoted verbatim, ready to hand to the owner.
- **CLAUDE.md was corrected in ~20 places.** Two of its instructions were actively blocking work that
  is already finished.

Gates: `tsc` **0** · `npm test` **1068** (was 1037) · `eslint` **0 errors**. Everything is
**device-unverified** — no EAS build is possible until the quota resets on 1 Sep 2026.

## Files changed

- `src/lib/apiMessage.ts` *(new)* + its test — the pure seam that decides which of a failed
  response's two strings a human should read. **Read the header before touching it**: a blanket
  "prefer `message`" would be a regression, because most routes carry their only human copy in
  `error` and send no `message` at all.
- `src/data/api.ts` — `login()` and `sendOtp()` read through it. `sendOtp` also returns the server's
  `channel` now, so an emailed code stops claiming it went to WhatsApp.
- `src/app/(auth)/login.tsx`, `src/ui/feedback.tsx` — two strings that already had human copy in all
  five languages were still hardcoded (`common.signIn`, `common.dismiss`). The Banner one lands on
  every screen.
- `src/lib/fileUpload.ts` — six comment blocks corrected. They stated "a plain 500" and "THE BACKEND
  DOES NOT ACCEPT ANY OF THESE YET" as unconditional facts; both are now conditional on a deploy that
  has not happened.
- `src/data/api.ts` `recordFileAttachment` + `claim/[id].tsx` + `claim-new.tsx` — real `entity_id` /
  `entity_type`.
- `src/data/__tests__/api-file-attachments.test.ts` *(new, 7)* — the whitelist, the
  empty-vs-placeholder id, single-attempt, fail-quiet.
- `src/lib/crashReport.ts` *(new)* + test, `src/ui/RouteErrorBoundary.tsx` *(new)*,
  `src/app/_layout.tsx` — the error boundary.
- `docs/i18n/COPY-REQUEST-2026-08-26.md` — Batch 5 + 5b written out; its stale STATUS header fixed.
- `CLAUDE.md`, `docs/PHASES.md`, `docs/STATUS.md`, `src/i18n/index.tsx` (one stale comment).
- `../contracts/INBOX.md` — two replies (see below).

## Decisions made

- **The sign-in fix is a rule, not a flip.** `error` still wins unless it is SCREAMING_SNAKE_CASE.
  The test file pins every prose refusal the backend really sends (`'Your account is inactive…'`,
  `'The code has expired…'`) precisely so a future "simplification" to `message`-first fails loudly.
- **We did NOT take cgpe-api's advice to add a 415 branch, and told them why.** Their new 415 carries
  the same body as the old 500, and our classifier reads the body before the status — so both already
  resolve identically, with no deploy-order coupling. A status-only branch would have been *worse*: a
  body-less 415 from a proxy would print "this server does not accept videos yet", which becomes
  false the moment their change deploys. Pinned by a test asserting 415 and 500 agree.
- **`isEphemeralUrl` was deliberately NOT narrowed, and this is the judgement call of the session.**
  MinIO storage is path-style, so a bucket named `uploads` would make durable objects look ephemeral.
  The obvious fix — only flag `/uploads/` when the host matches the API host — trades a harmless
  false alarm for a false *reassurance*: if `BACKEND_URL` ever points at a non-API host, the disk
  fallback starts reading as durable and a file wiped on the next redeploy is reported as safely
  attached. That is the exact defect the 2026-08-25 audit fixed. **Over-warning is recoverable;
  under-warning loses a claimant's evidence.** Filed as an ops constraint instead, pinned by a test.
- **The error boundary is justified on its own merits and is NOT filed as the #8 fix.** A root
  unmount kills the tab bar with it, so it presents as a wholly dead app; #8 is described as still
  navigable. Reporting it as the fix would be the third confident-but-wrong answer to that bug.
- **The boundary uses literal colours, and the reason is a trap worth knowing:** `useTheme()` does
  **not** throw outside its provider — `ThemeContext` is created with `light` as its default — so it
  would silently return the wrong scheme and flash a dark-mode user a white screen.
- **Verified by booting, not by typechecking.** `_layout.tsx` is a danger-zone file, so
  `expo start --web` was run: 1821 modules bundled, page served, zero errors. That also exercises
  expo-router's dev-mode route validation over every route file.
- **Two backend claims were checked against the DEPLOYED branch, not the commit.** Phase 94 is on
  `origin/Shivam`; `origin/main` is `990c660` and still has the old allowlist. Stated in the code
  comments, in CLAUDE.md and to cgpe-api.

## Known broken / deliberately skipped

- 🔴 **Backend Phase 94 is not deployed**, so video uploads and claim↔file linking still fail on a
  phone. The app is correct for both the old and the new backend; nothing is blocked, but nothing
  works either until the merge. **OPS ask filed.**
- 🔴 **Storage is still off** — `cloudStorageConfigured:false`, re-probed today. `BACKEND_URL` alone
  is a one-line fix for existing attachments.
- 🔴 **No APK until 1 Sep 2026.** Nothing from Phases 77, 78 or 79 is on a phone, and there is no OTA.
- ❌ **#8 (More→Today blank) is still open, and still needs a device.** Phase 79 narrowed it on paper:
  a stuck `loading`/`uiReady` is ruled out, and home.tsx cannot render an empty body in either fork.
  **Native screen detach survives** — `detachInactiveScreens` does default to `true` on Android and
  expo-router does forward it (checked in the installed source) — but it is armed, not proven. Do not
  ship `detachInactiveScreens={false}` as a fix without a repro. **Cheapest unmade observation: is
  the bottom tab bar still visible while the screen is blank?**
- **The crash screen's copy is English on purpose** (4 strings, in the copy request). It cannot use
  `t()` at all — it renders outside every provider.
- **`verifyOtp` still returns a generic message** rather than the server's specific "Incorrect code" /
  "Too many attempts". Less precise, not dishonest; left alone rather than widening the change.
- **`common.offlineBody` still not swept** — deliberate, for the third session running. The 39 outage
  sentences each name what failed.

## Next session starts here

- **First command: `/boot`.** Every self-contained app-side item is done; all three remaining items
  need someone else — a phone plugged in, a merge, or a decision. See "Next 3" in `docs/PHASES.md`.
- **The relay is worth more than any code right now:** merge + deploy Phase 94, set `BACKEND_URL`,
  and tell whoever creates the MinIO bucket **not to call it `uploads`**.
- **Watch out for:** ⚠️ do not "simplify" `humanApiMessage` into `json.message || json.error` — the
  test suite says why. ⚠️ do not delete the `ErrorBoundary` export from `_layout.tsx` while tidying
  imports; that export *is* the mechanism. ⚠️ CLAUDE.md's numbers were wrong for months in ways that
  blocked finished work — when one of its claims decides what you do next, spend the thirty seconds
  to check it against the code.
