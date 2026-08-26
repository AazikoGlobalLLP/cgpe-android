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
 * Bits per second reserved for the AUDIO track. Modelled as a BITRATE, not as a fraction of
 * the byte budget, and that distinction is a real bug fix rather than a refinement.
 *
 * The compressor re-encodes the VIDEO track but muxes audio through, so audio costs
 * `bitrate x seconds` — it grows with the clip, while a fixed fraction of a FIXED byte budget
 * does not. Reserving "15% of 10 MB" covers a 128 kbps track for about 90 seconds and then
 * silently stops covering it: at 180 s the audio alone is ~2.9 MB against a 1.5 MB reserve, so
 * the muxed file lands OVER the cap even though the video track was encoded exactly to budget.
 * Because the Android duration cap is only a hint, over-length clips are not hypothetical.
 *
 * 128 kbps is the ordinary AAC rate phone cameras record at; it is an upper bound for speech,
 * so reserving it never under-provisions.
 */
export const AUDIO_BITRATE_BPS = 128000;

/**
 * A container/muxing safety margin, as a fraction of the byte budget. Unlike audio this really
 * is roughly proportional to file size (MP4 headers, the moov atom, interleaving slack), and it
 * also absorbs the compressor overshooting its requested bitrate, which encoders do.
 */
export const VIDEO_OVERHEAD_SHARE = 0.05;

/**
 * The lowest video bitrate worth encoding at. Below this the picture is unusable as evidence,
 * so a clip that would need less is not silently encoded into mush — it is encoded at this
 * floor and comes back over the cap, where `judgeCompression` reports `still_too_large` and the
 * user is honestly told to record something shorter.
 */
export const MIN_VIDEO_BITRATE_BPS = 150000;

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
 * The video bitrate, in bits per second, that makes the MUXED file fit `budgetBytes` over
 * `seconds` — audio and container overhead charged first.
 *
 *   total bits  = budgetBytes * 8 * (1 - containerOverhead)
 *   video bits  = total bits - (audioBps * seconds)     <- audio grows WITH the clip
 *   bitrate     = video bits / seconds
 *
 * At the owner-locked 60 s and 10 MB this is ~1.20 Mbps of video, and the muxed result lands
 * at ~9.5 MB. Measured across durations: 30 s / 60 s / 120 s / 180 s all land at 9.50 MB; a
 * 300 s clip hits `MIN_VIDEO_BITRATE_BPS` and lands at 9.94 MB — still inside the cap, and
 * anything longer comes back over it and is honestly reported rather than silently mangled.
 *
 * Guards: a non-finite or non-positive duration cannot produce a bitrate, so it falls
 * back to the full ceiling duration — the SAFE direction, because assuming the longest
 * allowed clip yields the LOWEST bitrate and therefore the smallest file. The result never
 * drops below `MIN_VIDEO_BITRATE_BPS`, so evidence is never encoded into unusable mush to
 * hit a number; an impossible clip is refused instead.
 */
export function videoBitrateFor(
  seconds: number,
  budgetBytes: number = MAX_VIDEO_UPLOAD_BYTES,
  overheadShare: number = VIDEO_OVERHEAD_SHARE,
  audioBps: number = AUDIO_BITRATE_BPS,
): number {
  const dur = Number.isFinite(seconds) && seconds > 0 ? seconds : MAX_VIDEO_SECONDS;
  const totalBits = budgetBytes * 8 * Math.max(0, 1 - overheadShare);
  // Audio is charged per SECOND, so a longer clip leaves less for the picture — which is the
  // whole point: the muxed result has to fit, not just the video track.
  const videoBits = totalBits - audioBps * dur;
  return Math.max(MIN_VIDEO_BITRATE_BPS, Math.floor(videoBits / dur));
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
