# HANDOFF — CGPE Connect (Android) — Point 11 Document picker (client half) — 2026-08-25

## Done
- **The Claims upload flow is real now.** The "Capture or upload a document" button on both
  claim screens opens a source sheet with the three real choices — **Take a photo · Choose
  from gallery · Choose a file** (PDF / Word / Excel / image). Before this, the gallery was
  reachable *only* by denying the camera, and there was no file/PDF path at all even though the
  backend accepts them.
- **Upload failures now name their real cause** instead of one generic "didn't upload" banner:
  *too large* / *wrong type* (caught client-side before the request, using the backend's own
  10 MB cap + MIME allowlist) / *timed out* / *couldn't reach server* / *not signed in* /
  *server rejected*.
- **The "captures vanish" bug is now honest.** When cloud storage is off, the server returns a
  `localhost` URL on throwaway disk; the app detects that loopback URL and says *"uploaded, but
  the server won't keep it — ask your admin to enable storage"* and refuses to list it as a
  durably-attached document, rather than showing a false green success.
- Gates green: `tsc` 0 · `npm test` **978** (+25) · `eslint` 0 new errors (3 pre-existing
  warnings untouched). One commit pushed to `aaziko Shivam` (`a4e6dd0`). **NOT OTA** — a native
  module was added, so this needs a fresh APK. Device-unverified.

## Files changed
- `src/lib/fileUpload.ts` (new, pure + tested) — `MAX_UPLOAD_BYTES`/`ALLOWED_UPLOAD_MIME` mirror
  the live `cgpe-backend-main/routes/upload.js` multer config; `precheckUpload` (too-big/wrong-type
  gate that FAILS OPEN on unknowns), `classifyUploadStatus`, `isEphemeralUrl` (the loopback
  "vanishes" signature), `describeUploadFailure` (honest per-reason copy, numbers sourced from the
  constants — not invented).
- `src/lib/__tests__/fileUpload.test.ts` (new) — 21 cases over the limit mirror, precheck, classify,
  ephemeral detection, copy.
- `src/ui/DocumentSource.tsx` (new) — the `DocumentSourceSheet` (3 sources) + the ONLY place the
  native pickers (`expo-image-picker` + `expo-document-picker`) are imported; kept out of the
  Vitest graph on purpose. The OS document browser is constrained to the accepted MIME types.
- `src/data/api.ts` — `uploadFile` reshaped from `{url,key}|null` to a typed `UploadOutcome`
  (`ok:true{url,key,ephemeral}` | `ok:false{reason}`); no longer flips the global health banner
  (an upload failure is screen-specific, not an outage).
- `src/data/__tests__/api-resilience.test.ts` — the 2 upload cases updated to the new shape, +4
  new (ephemeral, non-ok status classify, 2xx-no-url, not-signed-in-no-fetch).
- `src/app/claim-new.tsx`, `src/app/claim/[id].tsx` — both rewired: open the source sheet, precheck,
  upload, branch on the typed outcome via `describeUploadFailure`; the old camera-first / gallery-on-deny
  flow and the `demo://` special-case are gone.
- `package.json` / `package-lock.json` — `expo-document-picker ~57.0.1` (`npx expo install`).

## Decisions made
- **Scope this session to the client half only** (picker + honest errors). The durable claim↔file
  link and the DigitalOcean Spaces env are owner/OPS + `[api]`+`[decision]` and were deliberately
  NOT wired — a contract can't be guessed (project rule).
- **Client-side precheck against the backend's OWN limits**, because the server collapses too-large
  (multer `LIMIT_FILE_SIZE` → 400) and rejected-type (a plain `Error` → 500) so status alone can't
  tell them apart. The precheck fails OPEN on an unknown size/type — the server stays the backstop.
- **Flag a loopback/ephemeral upload as a warning, and do NOT record it** as attached/ticked — the
  file will be wiped on the next redeploy, so a success claim would be a lie (the owner's exact bug).
- **Native pickers isolated in one UI module** (`ui/DocumentSource.tsx`), tested decisions in a pure
  `lib/fileUpload.ts` — the standing pattern for native-in-test-graph safety.

## Known broken / deliberately skipped
- **NOT OTA — needs a fresh EAS APK.** `expo-document-picker` is native; the picker does not reach
  the team until a new `preview` build is cut and installed.
- **Uploads still land on ephemeral disk until OPS sets Spaces.** `DO_SPACES_*` + `BACKEND_URL` must
  be set on the server and `:3001` restarted; until then the app honestly says "the server won't keep
  it" but nothing is durably stored. (Already in the backlog OPS relay text.)
- **No durable claim↔file link.** `routes/fileAttachments.js` exists but is unwired — needs the owner's
  decision on which endpoint/shape, then a relay. INBOX untouched (no concrete ask yet).
- **Device-unverified** — the source sheet, gallery/file pick, precheck messages, and the ephemeral
  warning were not walked on a device this session (web can't exercise the native pickers).

## Next session starts here
- Phase: **owner/OPS follow-through on Point 11** — there is no self-contained OTA `[m]` backlog item
  left. Options: cut the APK for Point 11; or, once the owner decides the claim↔file link model, wire
  it; or start a net-new feature (P7 goals / P8 WhatsApp automation / P12 voice) which each need a
  spec-lock first. Confirm the direction with the owner before building.
- First command: `/boot`
- Watch out for: **do not tell the owner "document upload works" from this commit** — the picker works,
  but real uploads are still ephemeral until the Spaces env is set AND a new APK is installed. Both are
  owner/OPS, not code.
