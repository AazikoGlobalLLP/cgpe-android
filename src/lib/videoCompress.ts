import { MAX_VIDEO_UPLOAD_BYTES } from '@/lib/fileUpload';

/* ------------------------------------------------------------------ *
 * videoCompress — the PURE decision seam for shrinking a claim-evidence video
 * before it is uploaded. No native import lives here on purpose: the transcoder
 * (`lib/videoTranscode.ts`) is device-only and unreachable from Vitest, so every
 * decision it makes is taken here instead, where it can be tested.
 *
 * WHY COMPRESSION IS NOT OPTIONAL. The backend caps an upload at 10 MB
 * (`routes/upload.js` multer `limits.fileSize`) and the owner chose on 2026-08-26 to
 * keep that cap rather than raise it, so video has to be made to FIT. A raw 60-second
 * clip from a modern Android phone is roughly 40-80 MB, so without this step every
 * single evidence video would be rejected and the feature would be dead on arrival.
 *
 * WHY THE PICKER CANNOT DO IT. `expo-image-picker` exposes `videoQuality`, which looks
 * like the answer and is NOT: it is documented `@platform ios` only, and this is an
 * Android app. Its `videoMaxDuration` is honoured on Android only insofar as "the
 * installed camera app" supports it. So neither the size nor the duration can be relied
 * on at capture time, and both have to be handled after the fact.
 *
 * EVERY NUMBER BELOW IS DERIVED, NOT PICKED. The two inputs are the owner's: a
 * 60-second ceiling and the backend's existing 10 MB cap. The bitrate falls out of them
 * by arithmetic (see `videoBitrateFor`), and the resolution is the standard evidence-grade
 * step that keeps that bitrate from looking blocky. Change the two inputs and the rest
 * follows; do not hand-tune the derived values.
 * ------------------------------------------------------------------ */

/**
 * The recording ceiling handed to the picker, in seconds. Owner-locked 2026-08-26.
 * On Android this is a REQUEST, not a guarantee — see the module header — which is
 * exactly why `planVideoCompression` sizes the bitrate from this number rather than
 * trusting that the clip actually came back this short.
 */
export const MAX_VIDEO_SECONDS = 60;

/**
 * How much of the byte budget is reserved for audio and container overhead, as a
 * fraction. MP4 muxing plus an AAC track is comfortably inside a tenth of the budget at
 * these bitrates; holding that back stops a clip that lands exactly at the ceiling from
 * tipping over it once the audio is muxed in.
 */
export const VIDEO_OVERHEAD_SHARE = 0.15;

/**
 * The longest edge, in pixels, of the compressed output. 720 is the lowest standard step
 * that still resolves a document, a number plate or a crack in a wall — the things a
 * claim video is actually taken of — while keeping the derived bitrate below plausible.
 */
export const VIDEO_MAX_DIMENSION = 720;

/**
 * Do not spend battery and seconds transcoding something that already fits. A clip under
 * this is passed through untouched. Set at the upload cap itself: if it already fits, the
 * only thing compression could buy is a smaller upload, which is not worth a transcode
 * the user has to wait for.
 */
export const VIDEO_COMPRESS_FLOOR_BYTES = MAX_VIDEO_UPLOAD_BYTES;

/**
 * The video bitrate, in bits per second, that fills `budgetBytes` over `seconds` once
 * audio and container overhead are held back.
 *
 *   bits available = budgetBytes * 8 * (1 - overhead)
 *   bitrate        = bits available / seconds
 *
 * At the owner-locked 60 s and 10 MB this is ~1.13 Mbps, which at 720p is ordinary
 * streaming quality — not artefact-free, but far above "can I read what this shows".
 *
 * Guards: a non-finite or non-positive duration cannot produce a bitrate, so it falls
 * back to the full ceiling duration — the SAFE direction, because assuming the longest
 * allowed clip yields the LOWEST bitrate and therefore the smallest file.
 */
export function videoBitrateFor(
  seconds: number,
  budgetBytes: number = MAX_VIDEO_UPLOAD_BYTES,
  overheadShare: number = VIDEO_OVERHEAD_SHARE,
): number {
  const dur = Number.isFinite(seconds) && seconds > 0 ? seconds : MAX_VIDEO_SECONDS;
  const usable = Math.max(0, 1 - overheadShare);
  return Math.max(1, Math.floor((budgetBytes * 8 * usable) / dur));
}

/** What the transcoder should do with this particular clip. */
export type VideoPlan =
  | { action: 'skip'; reason: 'already_small' | 'not_video' }
  | { action: 'compress'; bitrate: number; maxSize: number };

/**
 * Decide whether a picked file needs transcoding, and with what settings.
 *
 * Fails towards COMPRESSING: an unknown size is treated as "might be huge", because the
 * cost of a needless transcode is a few seconds of waiting, while the cost of skipping a
 * needed one is a rejected upload and a lost piece of claim evidence.
 */
export function planVideoCompression(file: {
  mimeType?: string;
  size?: number;
  durationMs?: number;
}): VideoPlan {
  const mime = (file.mimeType || '').toLowerCase();
  if (!mime.startsWith('video/')) return { action: 'skip', reason: 'not_video' };

  if (typeof file.size === 'number' && Number.isFinite(file.size) && file.size <= VIDEO_COMPRESS_FLOOR_BYTES) {
    return { action: 'skip', reason: 'already_small' };
  }

  // Duration drives the bitrate. An absent or nonsensical duration falls back to the
  // ceiling inside `videoBitrateFor`, which errs small.
  const seconds =
    typeof file.durationMs === 'number' && Number.isFinite(file.durationMs) && file.durationMs > 0
      ? file.durationMs / 1000
      : MAX_VIDEO_SECONDS;

  // A clip LONGER than the ceiling still has to fit the same byte budget, so the bitrate
  // is computed from its real duration rather than the ceiling — otherwise a 3-minute
  // clip would be encoded at the 60-second bitrate and land three times over the cap.
  return {
    action: 'compress',
    bitrate: videoBitrateFor(Math.max(seconds, 1)),
    maxSize: VIDEO_MAX_DIMENSION,
  };
}

/** How a finished compression turned out, from the caller's point of view. */
export type CompressOutcome =
  /** Use `uri`; it is within the cap. `savedBytes` is 0 when nothing was transcoded. */
  | { kind: 'ok'; uri: string; size?: number; savedBytes: number }
  /** Transcoding ran (or was skipped) but the result is still over the cap. */
  | { kind: 'still_too_large'; size: number };

/**
 * Judge a finished transcode. Separated from the native call so the "did this actually
 * help?" rule is testable.
 *
 * FAILS OPEN on an unknown output size: if we cannot measure the result we let it through
 * to the upload, where the server's own limit is the backstop and the existing honest
 * `too_large` error already covers it. Blocking here on a missing number would throw away
 * a clip that may well have been fine.
 */
export function judgeCompression(
  originalSize: number | undefined,
  resultSize: number | undefined,
  limitBytes: number = MAX_VIDEO_UPLOAD_BYTES,
): CompressOutcome {
  if (typeof resultSize !== 'number' || !Number.isFinite(resultSize)) {
    return { kind: 'ok', uri: '', size: undefined, savedBytes: 0 };
  }
  if (resultSize > limitBytes) return { kind: 'still_too_large', size: resultSize };
  const saved =
    typeof originalSize === 'number' && Number.isFinite(originalSize) && originalSize > resultSize
      ? originalSize - resultSize
      : 0;
  return { kind: 'ok', uri: '', size: resultSize, savedBytes: saved };
}
