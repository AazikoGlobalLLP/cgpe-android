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
 *      ambiguous 400/500 the client can't name (multer's `LIMIT_FILE_SIZE` → 400, a rejected
 *      type → a plain 500 — see `middleware/errorHandler.js`). `precheckUpload` catches those
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
 * The exact `fileFilter` allowlist from `routes/upload.js`. A type NOT in this set is
 * rejected by the server, so we mirror it to reject it here first. `image/jpg` is a
 * non-standard alias some Android cameras emit; the backend accepts it, so we do too.
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
 * ⚠️ THE BACKEND DOES NOT ACCEPT ANY OF THESE YET. `routes/upload.js` `fileFilter` has no
 * `video/*` entry, so until it is taught these exact strings a video upload comes back as
 * a plain 500. That is the ONE backend change this feature needs (the size cap does NOT
 * change — the owner chose on 2026-08-26 to compress to fit the existing 10 MB instead).
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
 * `fileFilter`, and `middleware/errorHandler.js` turns anything without an explicit statusCode
 * into a plain **500** with `{ success:false, error:'File type video/mp4 is not allowed' }`. On
 * status alone that is indistinguishable from a real server fault, so the user was told "try
 * again in a moment" for something that can NEVER succeed — they would re-record, re-compress
 * and re-upload over mobile data, forever. Reading the message is not guesswork: it is the
 * server stating the reason.
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
 *  necessity — the server collapses too-large and no-file into 400, and a rejected type
 *  into a plain 500 — so the precheck above is what makes those two precise. */
export function classifyUploadStatus(status: number): UploadFailure {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 413) return 'too_large';      // some proxies enforce their own body cap
  if (status === 415) return 'type_rejected';  // defensive; this backend uses 500 for it
  return 'server';                             // 400 (rejected/no-file) or 5xx (write failed)
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
    case 'video_not_accepted':
      // A PERMANENT condition, so the copy must not say "try again" — the server told us it
      // does not accept this type, and it will keep saying so until an admin enables video.
      // Retrying costs the user another transcode and another upload over mobile data.
      return {
        tone: 'warning',
        title: 'This server does not accept videos yet',
        message: 'Your photos and documents still work. Ask your admin to switch on video uploads — until then, take photos of the damage instead.',
      };
  }
}
