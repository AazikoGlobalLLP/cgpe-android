import { File } from 'expo-file-system';
import { Video } from 'react-native-compressor';

import { judgeCompression, planVideoCompression, type CompressOutcome } from '@/lib/videoCompress';
import { MAX_VIDEO_UPLOAD_BYTES, type PickedFile } from '@/lib/fileUpload';

/* ------------------------------------------------------------------ *
 * videoTranscode — the NATIVE half of shrinking a claim-evidence video.
 *
 * ⚠️ THIS MODULE MUST STAY OUT OF THE VITEST GRAPH. It imports `react-native-compressor`
 * and `expo-file-system`, and a native module reached from a test breaks Node with
 * `ReferenceError: __DEV__ is not defined` (via expo-modules-core) — the trap documented in
 * CLAUDE.md. Its only importer is `ui/DocumentSource.tsx`, which is itself deliberately
 * unreachable from tests for exactly this reason. Every DECISION it makes lives in the pure,
 * tested `lib/videoCompress.ts`; what is left here is the call and the file stat.
 *
 * IT FAILS OPEN, ALWAYS. Compression is an optimisation, not a gate. If the native module is
 * missing (an older build), the transcode throws, or the device runs out of space mid-encode,
 * this returns the ORIGINAL file and lets the existing precheck and the server's own limit be
 * the backstop. The one thing it must never do is lose the user's evidence because a
 * convenience step failed — that clip may be the only record of what a damaged vehicle looked
 * like, and it cannot be re-taken later.
 * ------------------------------------------------------------------ */

/** What the caller needs back: a file to upload, plus what happened, for honest copy. */
export type TranscodeResult = {
  file: PickedFile;
  /** 'skipped' — nothing to do · 'compressed' — smaller now · 'failed' — original returned. */
  status: 'skipped' | 'compressed' | 'failed';
  /** Only meaningful when status is 'compressed'. */
  savedBytes: number;
  /** True when the file is STILL over the cap; the caller shows the too-large error. */
  stillTooLarge: boolean;
};

/** Size of a file on disk, or undefined when it cannot be read. Never throws. */
function sizeOf(uri: string): number | undefined {
  try {
    const f = new File(uri);
    const s = f.size;
    return typeof s === 'number' && Number.isFinite(s) && s >= 0 ? s : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Compress `file` if it is an oversized video; otherwise hand it straight back.
 *
 * `onProgress` receives 0..1 so the screen can show something during what is, on a mid-range
 * Android phone, a genuinely slow operation — a 60-second clip can take 10-20 seconds. Without
 * a progress signal the user sees a frozen button and force-quits, losing the evidence.
 */
export async function compressIfNeeded(
  file: PickedFile,
  onProgress?: (fraction: number) => void,
): Promise<TranscodeResult> {
  // The picker does not always report a size; read it off disk so the plan is made on a real
  // number rather than `undefined` (which would force a needless transcode every time).
  const originalSize = typeof file.size === 'number' ? file.size : sizeOf(file.uri);

  const plan = planVideoCompression({
    mimeType: file.mimeType,
    size: originalSize,
    // expo-image-picker reports `duration` in ms on the asset; the caller passes it through
    // on `PickedFile.durationMs` when it has one.
    durationMs: file.durationMs,
  });

  if (plan.action === 'skip') {
    const over = typeof originalSize === 'number' && originalSize > MAX_VIDEO_UPLOAD_BYTES;
    return {
      file: { ...file, size: originalSize },
      status: 'skipped',
      savedBytes: 0,
      stillTooLarge: over,
    };
  }

  try {
    const outUri = await Video.compress(
      file.uri,
      {
        compressionMethod: 'manual',
        bitrate: plan.bitrate,
        maxSize: plan.maxSize,
        // Below this the library passes the file through untouched. Set to our own floor so
        // the two cannot disagree about what "already small enough" means.
        minimumFileSizeForCompress: MAX_VIDEO_UPLOAD_BYTES,
      },
      (p) => onProgress?.(p),
    );

    const outSize = sizeOf(outUri);
    const verdict: CompressOutcome = judgeCompression(originalSize, outSize, MAX_VIDEO_UPLOAD_BYTES);

    // The compressor always writes .mp4, so the name and type must follow the FILE, not the
    // original pick — otherwise a .mov name rides on mp4 bytes and the server's type check
    // (which reads the multipart `type`) disagrees with the extension.
    const renamed = file.name.replace(/\.[^./\\]+$/, '') || 'evidence';
    const out: PickedFile = {
      uri: outUri,
      name: `${renamed}.mp4`,
      mimeType: 'video/mp4',
      size: outSize,
      durationMs: file.durationMs,
    };

    return {
      file: out,
      status: 'compressed',
      savedBytes: verdict.kind === 'ok' ? verdict.savedBytes : 0,
      stillTooLarge: verdict.kind === 'still_too_large',
    };
  } catch {
    // Fail open — see the module header. The original file is returned untouched, and whether
    // it is too large is decided by its real size, exactly as it would have been without us.
    const over = typeof originalSize === 'number' && originalSize > MAX_VIDEO_UPLOAD_BYTES;
    return {
      file: { ...file, size: originalSize },
      status: 'failed',
      savedBytes: 0,
      stillTooLarge: over,
    };
  }
}
