# HANDOFF — CGPE Connect (Android) — Phase 79 — 2026-08-27

## Done

The session began as "finish what's left". The biggest thing found was not on any list: **the login
screen has been showing users raw machine tokens on production.**

- **`NO_ACCOUNT` and `BAD_PASSWORD` were appearing on screen as the error message.** Probed live, not
  inferred. The auth routes put a code in `error` and the human sentence in `message`; the app read
  `error` first. So the two commonest failures in the product — a mistyped address and a wrong
  password — showed a machine word under the heading "Sign in refused", while the sentence explaining
  what to do sat one field away, unread. Fixed for `/auth/login` and the two OTP failures.
- **An emailed sign-in code no longer tells the user to check WhatsApp.** The identifier field takes
  either, the backend routes on which one you typed, and the app now reads the channel it reports —
  in the toast **and** in the code-entry error underneath it.
- **Backend Phase 94 arrived mid-session and is consumed.** A file can now be tied to a real claim
  instead of merely mentioning one. **It is not deployed**, and that is stated everywhere it matters.
- **The app got its first React error boundary.** It had none — verified in the installed
  expo-router, not assumed — so any render throw killed the whole app and left nothing on screen.
- **i18n Batch 5 is extracted**: 49 sign-in strings, quoted verbatim, ready to hand to the owner.
- **CLAUDE.md was corrected in ~20 places.** Two of its instructions were blocking work already done.

Gates: `tsc` **0** · `npm test` **1069** (was 1037) · `eslint` **0 errors / 12 warnings** (baseline).
Everything is **device-unverified** — no EAS build is possible until the quota resets on 1 Sep 2026.

## Files changed

- `src/lib/apiMessage.ts` *(new)* + test — the pure seam deciding which of a failed response's two
  strings a human should read. **Read the header before touching it**: a blanket "prefer `message`"
  is a regression, because most routes carry their only human copy in `error` and send no `message`.
- `src/data/api.ts` — `login()` and `sendOtp()` read through it; `sendOtp` returns the server's
  `channel` on every path; `recordFileAttachment` sends `entity_id` / `entity_type`.
- `src/app/(auth)/login.tsx` — remembers the channel and names the right place in the OTP error;
  the plain "Sign in" button now uses the existing `common.signIn`.
- `src/ui/feedback.tsx` — the shared Banner's close button uses `common.dismiss` (lands everywhere).
- `src/lib/fileUpload.ts` — six comment blocks corrected; they stated "a plain 500" and "THE BACKEND
  DOES NOT ACCEPT ANY OF THESE YET" as unconditional facts. Logic unchanged, on purpose.
- `src/app/claim/[id].tsx`, `src/app/claim-new.tsx` — real entity link; claim id out of `description`.
- `src/data/__tests__/api-file-attachments.test.ts` *(new, 7)* — the whitelist, the
  empty-vs-placeholder id, single-attempt, fail-quiet, no-session.
- `src/lib/crashReport.ts` *(new)* + test *(11)*, `src/ui/RouteErrorBoundary.tsx` *(new)*,
  `src/app/_layout.tsx` — the error boundary and its copy.
- `docs/i18n/COPY-REQUEST-2026-08-26.md` — Batch 5 (49) + Batch 5b (4) written out; stale header fixed.
- `CLAUDE.md`, `docs/PHASES.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `src/i18n/index.tsx`.
- `../contracts/INBOX.md` — two replies (see "Cross-repo" below).

## Decisions made

*(Full text in `docs/DECISIONS.md` under 2026-08-27. The four that will bite someone who does not
know them:)*

- **The sign-in fix is a rule, not a field swap.** `error` still wins unless it is
  SCREAMING_SNAKE_CASE. The tests pin every prose refusal the backend really sends, precisely so a
  future "simplification" to `message`-first fails loudly.
- **cgpe-api's advice to add a 415 branch was declined, and they were told why.** Their 415 carries
  the same body as the old 500 and our classifier reads the body first, so both already resolve
  identically. A status-only branch would fire on a body-less proxy 415 and print "this server does
  not accept videos yet" — false the moment their change deploys.
- **`isEphemeralUrl` was deliberately NOT narrowed.** A MinIO bucket named `uploads` would make
  durable objects look ephemeral, but host-scoping it trades a harmless false alarm for a false
  *reassurance*. **Over-warning is recoverable; under-warning loses a claimant's evidence.** Filed as
  an ops constraint on the bucket name instead.
- **The error boundary is justified on its own merits and is NOT the #8 fix.** A root unmount kills
  the tab bar too; #8 is reported as still navigable.

## Known broken / deliberately skipped

- 🔴 **Backend Phase 94 is not deployed** (`origin/Shivam` only; `origin/main` is `990c660`), so
  video uploads and claim↔file linking still fail on a phone. The app is correct for both backends.
- 🔴 **Storage is still off** — `cloudStorageConfigured:false`, re-probed today. `BACKEND_URL` alone
  is a one-line fix for today's unopenable attachments.
- 🔴 **No APK until 1 Sep 2026.** Nothing from Phases 77, 78 or 79 is on a phone; there is no OTA.
- ❌ **#8 (More→Today blank) is still open and still needs a device.** Narrowed on paper this phase:
  a stuck `loading`/`uiReady` is ruled out, and `home.tsx` cannot render an empty body in either
  fork. **Native screen detach survives** — `detachInactiveScreens` does default to `true` on Android
  and expo-router does forward it — but it is armed, not proven. Do not ship
  `detachInactiveScreens={false}` as a fix without a repro.
- **`verifyOtp` still returns one generic message** instead of the server's specific "Incorrect
  code" / "Too many attempts". Less precise, not dishonest; left alone rather than widening scope.
- **The crash screen's 4 strings are English on purpose** — it cannot use `t()` at all, because it
  renders outside every provider. Listed as Batch 5b.
- **`common.offlineBody` still not swept** — deliberate, third session running. The 39 outage
  sentences each name what failed.

## Next session starts here

- **Phase 80: cut the APK, on or after 1 Sep 2026** — the first build to carry the Search tab and
  Phases 77–79. Everything else worth doing needs the owner: a merge, a device, or a decision.
- **First command: `/boot`**
- **Watch out for:** ⚠️ **do not "simplify" `humanApiMessage` into `json.message || json.error`** —
  the test suite says why, and the failure is silent. ⚠️ **do not delete the `ErrorBoundary` export
  from `_layout.tsx`** while tidying imports; that export *is* the mechanism, and importing the
  component is not enough. ⚠️ **CLAUDE.md's numbers were wrong for months in ways that blocked
  finished work** — when one of its claims decides what you do next, spend the thirty seconds to
  check it against the code.
