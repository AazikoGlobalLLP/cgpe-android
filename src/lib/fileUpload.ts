import { UPLOAD_TIMEOUT } from '@/constants/config';

/* ------------------------------------------------------------------ *
 * fileUpload — the pure decision seam behind attaching a document.
 *
 * The screen picks a file (camera / gallery / a document) and hands it to `uploadFile`
 * in `data/api.ts`. Two honest questions live here, both answerable WITHOUT a network
 * round-trip, so they are pure and tested:
 *
 *   1. WOULD THIS FILE BE REJECTED BEFORE IT EVEN LEAVES THE PHONE? The backend caps a
 *      file at 10 MB and only accepts a fixed list of types (`routes/upload.js`, multer
 *      config). A 30 MB video or a `.zip` is a wasted upload and, worse, comes back as an
 *      ambiguous status the client can't name (multer's `LIMIT_FILE_SIZE` → 400; a rejected
 *      type → a plain 500 on the DEPLOYED build, 415 once backend Phase 94 ships — see the
 *      note on `classifyUploadStatus`). `precheckUpload` catches those
 *      two commonest mistakes up front using the server's OWN limits, so the user gets a
 *      precise reason ("too large" / "not supported") instead of a generic "didn't upload".
 *   2. WHEN A REQUEST DOES FAIL, WHAT DO WE HONESTLY TELL THE USER? `classifyUploadStatus`
 *      maps an HTTP status to a reason, and `describeUploadFailure` turns any reason into
 *      copy that names the real cause and the real next step — never one catch-all banner.
 *
 * The numbers here are NOT invented: 10 MB and the MIME allowlist are copied from the live
 * `cgpe-backend-main/routes/upload.js` (multer `limits.fileSize` + `fileFilter`, verified
 * 2026-08-25); the 30 s figure is `UPLOAD_TIMEOUT` from `constants/config.ts`, the single
 * source of truth the transport already uses. If the backend changes its limits, change
 * them HERE to match — do not let the two drift.
 * ------------------------------------------------------------------ */

/** Backend `multer` cap: `limits.fileSize = 10 * 1024 * 1024` (routes/upload.js). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

/**
 * The DOCUMENT half of `routes/upload.js`'s `fileFilter` allowlist — and, on the currently
 * deployed backend, the whole of it. A type NOT in this set is rejected by the server, so we
 * mirror it to reject it here first. `image/jpg` is a non-standard alias some Android cameras
 * emit; the backend accepts it, so we do too. The video half lives in `VIDEO_UPLOAD_MIME`
 * below; `ALL_UPLOAD_MIME` is the union and is what the precheck actually tests against.
 */
export const ALLOWED_UPLOAD_MIME: readonly string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * VIDEO — claim evidence. Kept as its OWN list rather than folded into
 * `ALLOWED_UPLOAD_MIME`, because the two are not interchangeable: the document list is a
 * mirror of what the server accepts TODAY, while this list is what it must be taught to
 * accept. Keeping them apart means the document path cannot be disturbed by the video
 * work, and `DocumentPicker` can be handed either set independently.
 *
 * ⚠️ THE DEPLOYED BACKEND STILL ACCEPTS NONE OF THESE. `cgpe-api` added exactly these four
 * strings to `routes/upload.js` `fileFilter` in their Phase 94 (`fda199c`, 2026-08-27) — the
 * ONE backend change this feature needed, and the size cap did NOT change because the owner
 * chose on 2026-08-26 to compress to fit the existing 10 MB. But that commit is on
 * `origin/Shivam` only, and prod deploys `origin/main`, which was `990c660` when this was
 * written and whose allowlist ends at the spreadsheet type. So a video upload on a real phone
 * today still comes back rejected. Do not describe video evidence as working until the owner
 * merges to `origin/main`, deploys and restarts `:3001`.
 *
 * The four types are what Android and iOS actually produce or hold: `video/mp4` is what the
 * compressor emits and what nearly every Android camera records; `video/quicktime` is the
 * `.mov` an iPhone-recorded clip arrives as; `video/3gpp` is what some older/low-end Android
 * cameras still write; `video/x-matroska` is the `.mkv` a few OEM camera apps produce.
 */
export const VIDEO_UPLOAD_MIME: readonly string[] = [
  'video/mp4',
  'video/quicktime',
  'video/3gpp',
  'video/x-matroska',
];

/**
 * Every type a user may attach — documents AND video. This is what the precheck tests
 * against; `ALLOWED_UPLOAD_MIME` on its own is deliberately left meaning "the document
 * types the server takes today" so nothing that reads it changes meaning.
 */
export const ALL_UPLOAD_MIME: readonly string[] = [...ALLOWED_UPLOAD_MIME, ...VIDEO_UPLOAD_MIME];

/**
 * The upload cap for VIDEO, as its own constant so it can move without touching the
 * document cap. Owner decision 2026-08-26: it is the SAME 10 MB — rather than raising the
 * server limit, evidence video is compressed on the phone until it fits
 * (`lib/videoCompress.ts`). That choice is why the backend needs no size change, and why
 * nginx needs no `client_max_body_size` change either.
 *
 * If this is ever raised, `routes/upload.js` `limits.fileSize` must be raised in the SAME
 * change, and the proxy's body limit checked — otherwise the phone sends a file the server
 * or the proxy refuses, and the user sees a 413 that looks like a broken app.
 */
export const MAX_VIDEO_UPLOAD_BYTES = MAX_UPLOAD_BYTES;
export const MAX_VIDEO_UPLOAD_MB = Math.round(MAX_VIDEO_UPLOAD_BYTES / (1024 * 1024));

/** Plain-language version of the allowlist, for a hint/error line. */
export const ALLOWED_UPLOAD_LABEL = 'a photo (JPG, PNG, GIF, WebP), a video, a PDF, or a Word or Excel document';

/** File extension → MIME, used only to resolve a type when the picker gives us no `mimeType`. */
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Video. `mov`/`3gp`/`mkv` are here for the same reason as the document extensions: a
  // gallery pick occasionally arrives with no `mimeType` and only a filename to go on.
  mp4: 'video/mp4', mov: 'video/quicktime', '3gp': 'video/3gpp', mkv: 'video/x-matroska',
};

/** True when a resolved MIME is a video. One place, so the rule cannot drift. */
export function isVideoMime(mime: string): boolean {
  return (mime || '').toLowerCase().startsWith('video/');
}

/**
 * A picked file, normalised across `expo-image-picker` and `expo-document-picker`.
 * `durationMs` is only ever present for video (the image picker reports it on the asset)
 * and is what lets the compressor size its bitrate to the real clip length instead of
 * assuming the 60-second ceiling.
 */
export type PickedFile = { uri: string; name: string; mimeType?: string; size?: number; durationMs?: number };

/** Every way an upload can honestly not-succeed. */
export type UploadFailure =
  | 'too_large'      // over the 10 MB cap
  | 'type_rejected'  // a type the server does not accept
  | 'timeout'        // aborted at UPLOAD_TIMEOUT
  | 'network'        // never reached the server
  | 'server'         // reached the server, was not stored (5xx / no url)
  | 'unauthorized'   // 401/403 — role or session
  | 'not_signed_in'  // no real session on this handset
  | 'not_stored'     // uploaded, but to ephemeral disk (cloud storage not configured)
  | 'not_linked'     // PRESIGNED flow only: the bytes are in the bucket, but the row that names
                     // the key could not be written, so nothing on the server points at them
  | 'video_not_accepted'; // the SERVER said it does not accept this video type (yet)

/**
 * Resolve a file's MIME. Prefer the picker's own `mimeType`; fall back to the extension
 * so a document picked without a type is still classifiable. Returns '' when we genuinely
 * cannot tell — in which case the caller must FAIL OPEN and let the server decide.
 */
export function resolveMime(file: { mimeType?: string; name?: string }): string {
  const m = (file.mimeType || '').trim().toLowerCase();
  if (m) return m;
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || '';
}

/**
 * The client-side gate, run BEFORE the request. Returns a reason if the file would be
 * rejected, or null if it is worth sending. Fails OPEN: an unknown size or an
 * unresolvable type is never blocked here — only a KNOWN violation is.
 */
export function precheckUpload(file: { name?: string; mimeType?: string; size?: number }): UploadFailure | null {
  const mime = resolveMime(file);
  // The cap is per-KIND. Today both caps are 10 MB, so this is behaviour-identical for
  // documents and images; it exists so raising the video cap later cannot silently raise
  // the document one too. Note the ORDER changed from "size then type": the size test now
  // needs to know the kind, so the MIME is resolved first. Resolution is pure and cannot
  // fail, so nothing else about the outcome moves.
  const cap = isVideoMime(mime) ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
  if (typeof file.size === 'number' && file.size > cap) return 'too_large';
  if (mime && !ALL_UPLOAD_MIME.includes(mime)) return 'type_rejected';
  return null;
}

/**
 * Refine a failed `/upload` response using the SERVER'S OWN WORDS, falling back to the status.
 *
 * WHY THIS EXISTS. `routes/upload.js` rejects a disallowed type by throwing from multer's
 * `fileFilter`. On the DEPLOYED build (`origin/main` 990c660) that error carries no statusCode,
 * so `middleware/errorHandler.js` renders it as a plain **500** with
 * `{ success:false, error:'File type video/mp4 is not allowed' }`. On status alone that is
 * indistinguishable from a real server fault, so the user was told "try again in a moment" for
 * something that can NEVER succeed — they would re-record, re-compress and re-upload over
 * mobile data, forever. Reading the message is not guesswork: it is the server stating the reason.
 *
 * ⚠️ THE STATUS IS ABOUT TO CHANGE, AND THIS FUNCTION ALREADY COPES. Backend Phase 94
 * (`fda199c`, not yet on `origin/main`) tags that same error `statusCode = 415`, so the
 * rejection will arrive as a 415 carrying the SAME body. Because the body match below runs
 * BEFORE the status fallback, both shapes resolve identically and no change is needed here —
 * which is exactly why the body match is kept rather than replaced by a status branch.
 *
 * This is deliberately CONSERVATIVE. It only overrides the status when the body matches a
 * phrase the backend actually emits; anything else falls through to `classifyUploadStatus`, so
 * a genuine 5xx is never relabelled as a content problem.
 */
export function classifyUploadFailureBody(
  status: number,
  serverMessage: string | undefined,
  mime?: string,
): UploadFailure {
  const msg = (serverMessage || '').toLowerCase();
  // `routes/upload.js` fileFilter: `File type ${mimetype} is not allowed`
  if (/file type .* is not allowed/.test(msg)) {
    return isVideoMime(mime || '') ? 'video_not_accepted' : 'type_rejected';
  }
  // `middleware/errorHandler.js` LIMIT_FILE_SIZE -> 400 'File too large'
  if (msg.includes('file too large')) return 'too_large';
  return classifyUploadStatus(status);
}

/** Map a non-ok HTTP status from `/upload` to a reason. Coarser than the precheck by
 *  necessity — the server collapses too-large and no-file into 400, and a rejected type into a
 *  plain 500 on the deployed build (a 415 once Phase 94 ships) — so the precheck above and the
 *  body match are what make those two precise. This is only ever the LAST resort: a rejection
 *  that reaches here carried no readable body at all. */
export function classifyUploadStatus(status: number): UploadFailure {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 413) return 'too_large';      // some proxies enforce their own body cap
  // 415 reaches this line only for a body-less rejection — a proxy's own 415, or a truncated
  // response. Both backend versions send a readable body, which `classifyUploadFailureBody`
  // consumes first. Deliberately NOT made video-aware: `video_not_accepted`'s copy says the
  // server takes no video at all, which is a strictly stronger claim than a body-less 415
  // supports, and after Phase 94 deploys it would be false.
  if (status === 415) return 'type_rejected';
  return 'server';                             // 400 (rejected/no-file) or 5xx (write failed)
}

/* ------------------------------------------------------ the presigned MinIO flow (Phase 86) */

/**
 * THE CONTRACT, so nobody has to re-derive it: `cgpe-api` Phase 95 (D-122, filed to
 * `contracts/INBOX.md` 2026-08-27) replaced the multipart proxy upload with three calls —
 *
 *   1. `POST /api/upload/presign` (Bearer) `{ content_type, filename?, folder? }`
 *      → `{ data: { key, url, method:'PUT', headers:{'Content-Type'}, expiresIn, maxBytes } }`
 *   2. `PUT` the bytes straight at `data.url` — **no Authorization header** (the signature IS
 *      the auth) and the `Content-Type` **exactly** as returned.
 *   3. `POST /api/file-attachments` with `storage_key: data.key` and an EMPTY `file_url`;
 *      render later via `GET /api/upload/download-url?key=…`, signed fresh per render.
 *
 * The bytes never pass through the API server and the app never holds storage credentials.
 *
 * ⚠️ TWO TRAPS, both written into the contract itself:
 * (a) **Persist the KEY, never the URL.** Every signed URL dies in `expiresIn` (300 s), so a
 *     stored URL is a link that is broken by the time anyone opens it — the exact shape of the
 *     "captures vanish" complaint this flow exists to fix.
 * (b) **The PUT is signed over the Content-Type.** Sending any other value, or omitting the
 *     header and letting the platform pick one, **403s at MinIO** — which is why
 *     `PresignedTarget` carries the server's string rather than the caller's MIME.
 */
export type PresignedTarget = {
  /** The DURABLE handle. This is what gets persisted, and it is owner-scoped server-side. */
  key: string;
  /** Short-lived signed PUT URL. Dead in `expiresInSec`; must never be stored. */
  url: string;
  /** The EXACT string the signature was computed over — send it back verbatim. */
  contentType: string;
  expiresInSec: number;
  /** ADVISORY. A presigned PUT cannot cap the body server-side, so the phone-side
   *  compress-to-fit step (`precheckUpload` + `compressIfNeeded`) is still the real limit. */
  maxBytes: number;
};

/**
 * What a `/upload/presign` response means for the caller.
 *
 * `fallback` is the one worth explaining: on the deployed backend today the route does not
 * exist (`origin/main` is 28 commits behind — verified 2026-08-29) and, even once it does, it
 * answers `503 STORAGE_NOT_CONFIGURED` until OPS sets `S3_*`. Neither is a user-visible
 * failure — both mean "this server is still on the old multipart path", so the caller retries
 * the legacy `POST /upload` and behaviour is byte-identical to before this phase. That is what
 * makes adopting the flow ahead of the deploy inert-safe.
 */
export type PresignOutcome =
  | { kind: 'target'; target: PresignedTarget }
  | { kind: 'fallback' }
  | { kind: 'failed'; reason: UploadFailure };

/**
 * Read a presign body into a target, or null if it is not usable.
 *
 * Strict on purpose: a missing `Content-Type` header is NOT recoverable by substituting the
 * MIME we asked for. The signature is computed over whatever the server normalised the type
 * to (it lower-cases and trims), so guessing would 403 at MinIO after the whole upload — a
 * confusing failure a long way from its cause. Refusing here falls back to the legacy path,
 * which still works.
 */
export function parsePresignTarget(body: unknown): PresignedTarget | null {
  const b = body as any;
  const d = b?.data ?? b;
  if (!d || typeof d !== 'object') return null;
  const key = typeof d.key === 'string' ? d.key.trim() : '';
  const url = typeof d.url === 'string' ? d.url.trim() : '';
  const headers = d.headers && typeof d.headers === 'object' ? d.headers : null;
  const ct = headers && typeof headers['Content-Type'] === 'string' ? headers['Content-Type'].trim() : '';
  if (!key || !url || !ct) return null;
  // The contract fixes the verb at PUT. A different verb means we are talking to something
  // other than the flow we were built against, so fall through rather than guess.
  if (typeof d.method === 'string' && d.method.toUpperCase() !== 'PUT') return null;
  const expiresIn = typeof d.expiresIn === 'number' && d.expiresIn > 0 ? d.expiresIn : 300;
  const maxBytes = typeof d.maxBytes === 'number' && d.maxBytes > 0 ? d.maxBytes : MAX_UPLOAD_BYTES;
  return { key, url, contentType: ct, expiresInSec: expiresIn, maxBytes };
}

/**
 * Classify a `/upload/presign` response. `mime` is the type we ASKED for, used only to tell a
 * rejected video apart from a rejected document in the 415 branch — the same distinction
 * `classifyUploadFailureBody` makes, kept in step with it deliberately.
 */
export function classifyPresignResponse(status: number, body: unknown, mime?: string): PresignOutcome {
  if (status >= 200 && status < 300) {
    const target = parsePresignTarget(body);
    return target ? { kind: 'target', target } : { kind: 'failed', reason: 'server' };
  }
  // 404 = the route is not on this build. 501 is this backend's OTHER quiet "not deployed"
  // answer (see the `isRetryableStatus` note in CLAUDE.md — it is deliberately NOT treated as
  // a transient fault anywhere else either). 503 = deployed but `S3_*` unset, or the whole
  // server is down; in both cases the legacy attempt is the honest next move — if the server
  // really is down it fails there and reports a network/server reason, which is what the user
  // would have seen before this phase existed.
  if (status === 404 || status === 501 || status === 503) return { kind: 'fallback' };
  if (status === 415) {
    return { kind: 'failed', reason: isVideoMime(mime || '') ? 'video_not_accepted' : 'type_rejected' };
  }
  if (status === 401 || status === 403) return { kind: 'failed', reason: 'unauthorized' };
  return { kind: 'failed', reason: 'server' };
}

/**
 * Classify a failed signed `PUT` — the response comes from MinIO, NOT from our API, so its
 * statuses mean different things than `classifyUploadStatus`'s.
 *
 * ⚠️ A 403 here is NOT `'unauthorized'`. There is no session on this request at all; a 403
 * means the signature did not verify — a `Content-Type` mismatch, or the 300-second window
 * expired mid-upload. Telling the user "this account can't upload here" would send them to
 * their admin over what a retry fixes, so it maps to `'server'`, whose copy is "try again in
 * a moment". Keep it that way.
 */
export function classifyPutStatus(status: number): UploadFailure {
  if (status === 413) return 'too_large';   // MinIO ingress hard cap (128 MB), or a proxy's own
  return 'server';                          // 403 signature/expiry, 400 malformed, 5xx storage
}

/** Read `GET /api/upload/download-url`'s body into a URL, or null. Never cached by callers:
 *  it expires, which is the whole reason the KEY is what gets stored. */
export function parseDownloadUrl(body: unknown): string | null {
  const b = body as any;
  const d = b?.data ?? b;
  const url = d && typeof d.url === 'string' ? d.url.trim() : '';
  return url || null;
}

/* ------------------------------ the LEGACY route learned to return a key too (Phase 88) */

/**
 * What the legacy multipart `POST /api/upload` actually gave us.
 *
 * WHY THIS EXISTS - it is a defect fix, not a tidy-up. `cgpe-api`'s Phase 101 (`9a74c9a`,
 * `routes/upload.js:174-196`) changed that route's SUCCESS body. Once the bucket is private the
 * public-style URL it used to return 403s for every caller, so it now hands back a **short-lived
 * presigned GET** as `url`, alongside `key`, `storage_key` and `url_expires_in`. Their own
 * comment states it plainly: *"`url` is short-lived when presigned. `key` is the durable handle
 * - store THIS."*
 *
 * The app read only `url` and recorded it as `file_url`. So on the day Phase 101 deploys **and**
 * `S3_*` is set, every legacy-path upload would persist a link that dies when the signature
 * expires - trap (a) of the D-122 contract above ("persist the KEY, never the URL"), arriving
 * through the one path that contract did not cover. Phase 86's presigned path was already right;
 * only this fallback was wrong, and the fallback is what runs today.
 *
 * THE DISCRIMINATOR IS TWO-PART, AND THE SECOND PART IS THE LOAD-BEARING ONE.
 * `storage_key` on its own is NOT enough. Phase 101 has a documented signing-failure branch that
 * still sets `storage_key` but falls back to the public URL and sets **`url_expires_in: null`**.
 * There the `url` is the durable thing and the key is NOT dependably re-signable - the signer
 * just failed - so keying on the key alone would throw away the only working link. A FINITE
 * `url_expires_in` is the server saying "this url is signed, and here is how long it lives";
 * that, and only that, means the url is disposable.
 *
 * Any older build answers with neither field and falls through to exactly today's behaviour,
 * which is what makes this safe to ship ahead of the deploy - production still 404s the presign
 * route and reports `cloudStorageConfigured:false`, so this branch cannot fire there yet.
 *
 * (Whether both fields are ALWAYS present on the configured path is filed as an open question to
 * `cgpe-api` at the top of `contracts/INBOX.md`, 2026-08-31. If they answer with a different
 * field to key on, change it HERE - this function is the only place that decides.)
 */
export type LegacyUploadResult = {
  /** The durable public URL to report. **Empty when `storageKey` is set** - see above. */
  url: string;
  /** The server's own `key`, passed through unchanged. */
  key?: string;
  /**
   * Set ONLY when the server signed `url` - i.e. the object is in real storage and the key is
   * the durable handle. Its presence moves the caller onto the presigned plumbing: record the
   * key, leave `file_url` empty, re-sign per render.
   */
  storageKey?: string;
};

/** Read a legacy `/upload` success body. `null` = nothing usable came back, which the caller
 *  must report as `'server'` rather than as a success with an empty URL. */
export function parseLegacyUploadResult(body: unknown): LegacyUploadResult | null {
  const b = body as any;
  const d = b?.data ?? b;
  if (!d || typeof d !== 'object') return null;
  const url = typeof d.url === 'string' ? d.url.trim() : '';
  const key = typeof d.key === 'string' && d.key.trim() ? d.key.trim() : undefined;
  const storageKey = typeof d.storage_key === 'string' ? d.storage_key.trim() : '';
  // `Number.isFinite`, not `typeof === 'number'`: NaN is a number and would otherwise read as
  // "signed". It also refuses a numeric STRING, deliberately - a shape we were not promised is
  // safer treated as the old one. No `> 0` test: a zero TTL is not a shape the server emits, and
  // if it ever were, "the url is already dead" is the safe reading of it, not the dangerous one.
  if (storageKey && Number.isFinite(d.url_expires_in)) {
    // `key ?? storageKey`: Phase 101 sets both from the same `uploadResult.key`, so they agree;
    // the fallback only matters if a future build ever sends one and not the other.
    return { url: '', key: key ?? storageKey, storageKey };
  }
  if (!url) return null;
  return { url, key };
}

/**
 * True when the server handed back a throwaway local-disk URL. That is the signature of the
 * "captures vanish" bug: with DigitalOcean Spaces unset (or a transient Spaces failure),
 * `routes/upload.js` falls back to `${BACKEND_URL || 'http://localhost:3001'}/uploads/...` on
 * droplet disk. The upload "succeeded" (200) but the file is wiped on the next redeploy, so we must
 * NOT report it as durably stored.
 *
 * Two signatures, because the host alone is NOT enough: in dev `BACKEND_URL` is unset so the URL is
 * loopback, but ON PROD `BACKEND_URL` is the PUBLIC domain (it must be — the same fallback serves
 * WhatsApp campaign media, which has to be publicly reachable), so the throwaway URL is
 * `https://cgpe.in/uploads/...` — not loopback, yet still ephemeral. So we also key off the express
 * static `/uploads/` route the fallback uses: a durable Spaces object never uses it (its key is
 * `${folder}/${file}`, host `*.digitaloceanspaces.com`, no `/uploads/` prefix). Detecting only the
 * loopback sub-case let a redeploy-wiped upload read as durably attached on prod (loophole audit
 * 2026-08-25).
 *
 * ⚠️ ONE KNOWN COLLISION, AND IT IS AN OPS CONSTRAINT, NOT A CODE FIX. Backend Phase 94 makes
 * object storage MinIO-shaped and PATH-STYLE by default, so a stored object's URL is
 * `${S3_ENDPOINT}/${S3_BUCKET_NAME}/${folder}/${file}` — the bucket name is the FIRST path
 * segment. If the bucket is literally named `uploads`, a perfectly durable object arrives as
 * `https://minio.example/uploads/general/x.jpg` and this function calls it ephemeral, so the
 * user is warned their file will not be kept when in fact it will.
 *
 * The obvious narrowing — only treat `/uploads/` as ephemeral when the host matches the API
 * host — is DELIBERATELY NOT DONE, because it trades a harmless false alarm for a dangerous
 * false reassurance: if `BACKEND_URL` is ever set to a host other than the API's, the
 * local-disk fallback would then read as durable, and a file wiped on the next redeploy would
 * be reported as safely attached. That is the exact defect the 2026-08-25 audit fixed.
 * Over-warning is recoverable; under-warning loses evidence.
 *
 * So the constraint is filed with OPS instead: do not name the bucket `uploads`, and do not
 * serve MinIO from the API's own host under an `/uploads/` path. Pinned by a test.
 */
export function isEphemeralUrl(url: string): boolean {
  const host = (url.match(/^https?:\/\/([^/:]+)/i)?.[1] || '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
  if (host.endsWith('.local')) return true;
  // The local-disk fallback serves from `/uploads/...` on WHATEVER host BACKEND_URL is set to.
  const path = url.replace(/^https?:\/\/[^/]+/i, '');
  if (/^\/uploads\//i.test(path)) return true;
  return false;
}

/** Honest copy for every failure. `tone` matches the app's `FeedbackTone` values so a
 *  screen can drop it straight onto a Banner. A hard failure is 'danger'; a "you/your
 *  setup, not the file" condition is the softer 'warning'. */
export function describeUploadFailure(reason: UploadFailure): {
  tone: 'danger' | 'warning'; title: string; message: string;
} {
  const secs = Math.round(UPLOAD_TIMEOUT / 1000);
  switch (reason) {
    case 'too_large':
      return {
        tone: 'warning',
        title: 'That file is too large',
        message: `The server accepts files up to ${MAX_UPLOAD_MB} MB. Choose a smaller file, or take the photo again at a lower size.`,
      };
    case 'type_rejected':
      return {
        tone: 'warning',
        title: "That file type isn't supported",
        message: `You can attach ${ALLOWED_UPLOAD_LABEL}.`,
      };
    case 'timeout':
      return {
        tone: 'danger',
        title: 'The upload timed out',
        message: `The file was still uploading after ${secs} seconds, so it was stopped. Check your connection and try again.`,
      };
    case 'network':
      return {
        tone: 'danger',
        title: "Couldn't reach the server",
        message: 'The file did not leave your phone, so nothing was attached. Check your connection and try again.',
      };
    case 'server':
      return {
        tone: 'danger',
        title: "The server didn't accept the file",
        message: 'It reached the server but was not stored. Try again in a moment.',
      };
    case 'unauthorized':
      return {
        tone: 'warning',
        title: "This account can't upload here",
        message: "Your role or sign-in doesn't allow uploads. Sign in again, or ask your branch admin.",
      };
    case 'not_signed_in':
      return {
        tone: 'warning',
        title: "You're not signed in",
        message: "This session isn't signed in to the register, so the file stayed on the handset. Sign in again and retry.",
      };
    case 'not_stored':
      return {
        tone: 'warning',
        title: "Uploaded, but the server won't keep it",
        message: "Document storage isn't switched on for this server, so this file won't be saved. Ask your admin to enable it before relying on it.",
      };
    case 'not_linked':
      // PRESIGNED FLOW ONLY, and the reason it is not silent like the legacy path's
      // fire-and-forget record: with a presigned upload the metadata row is the ONLY thing
      // that names the object key. The bytes are in the bucket, but if that row is not
      // written, nothing on the server points at them — the file is unreachable and the user
      // must attach it again. Reporting this as success would be the "captures vanish" bug
      // wearing a green tick. A retry re-uploads under a fresh key, which is correct.
      return {
        tone: 'danger',
        title: "The file wasn't attached",
        message: 'It reached storage, but the register did not record it, so it is not linked to this claim. Attach it again.',
      };
    case 'video_not_accepted':
      // A PERMANENT condition, so the copy must not say "try again" — the server told us it
      // does not accept this type, and it will keep saying so until an admin enables video.
      // Retrying costs the user another transcode and another upload over mobile data.
      //
      // This copy is accurate against the DEPLOYED backend, whose allowlist has no video entry
      // at all, and the "ask your admin" step is the right one: the admin action is merging
      // backend Phase 94 to `origin/main` and deploying. Once that lands this branch becomes
      // effectively unreachable rather than wrong — `VIDEO_UPLOAD_MIME` is byte-identical to
      // the server's new list, so `precheckUpload` stops any other container on the phone. Keep
      // the branch as the safety net, and revisit the wording only if the two lists diverge.
      return {
        tone: 'warning',
        title: 'This server does not accept videos yet',
        message: 'Your photos and documents still work. Ask your admin to switch on video uploads — until then, take photos of the damage instead.',
      };
  }
}
