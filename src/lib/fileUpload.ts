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

/** Plain-language version of the allowlist, for a hint/error line. */
export const ALLOWED_UPLOAD_LABEL = 'a photo (JPG, PNG, GIF, WebP), a PDF, or a Word or Excel document';

/** File extension → MIME, used only to resolve a type when the picker gives us no `mimeType`. */
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** A picked file, normalised across `expo-image-picker` and `expo-document-picker`. */
export type PickedFile = { uri: string; name: string; mimeType?: string; size?: number };

/** Every way an upload can honestly not-succeed. */
export type UploadFailure =
  | 'too_large'      // over the 10 MB cap
  | 'type_rejected'  // a type the server does not accept
  | 'timeout'        // aborted at UPLOAD_TIMEOUT
  | 'network'        // never reached the server
  | 'server'         // reached the server, was not stored (5xx / no url)
  | 'unauthorized'   // 401/403 — role or session
  | 'not_signed_in'  // no real session on this handset
  | 'not_stored';    // uploaded, but to ephemeral disk (cloud storage not configured)

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
  if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) return 'too_large';
  const mime = resolveMime(file);
  if (mime && !ALLOWED_UPLOAD_MIME.includes(mime)) return 'type_rejected';
  return null;
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
 * True when the server handed back a loopback / private URL. That is the signature of the
 * "captures vanish" bug: with DigitalOcean Spaces unset, `routes/upload.js` falls back to
 * `${BACKEND_URL || 'http://localhost:3001'}/uploads/...` on throwaway droplet disk. The
 * upload "succeeded" (200) but the file is not reachable and is wiped on the next redeploy,
 * so we must NOT report it as durably stored.
 */
export function isEphemeralUrl(url: string): boolean {
  const host = (url.match(/^https?:\/\/([^/:]+)/i)?.[1] || '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
  if (host.endsWith('.local')) return true;
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
  }
}
