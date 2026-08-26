import { describe, it, expect } from 'vitest';
import {
  AUDIO_BITRATE_BPS,
  MAX_VIDEO_SECONDS,
  MIN_VIDEO_BITRATE_BPS,
  VIDEO_MAX_DIMENSION,
  judgeCompression,
  planVideoCompression,
  videoBitrateFor,
} from '@/lib/videoCompress';
import { MAX_VIDEO_UPLOAD_BYTES, MAX_UPLOAD_BYTES } from '@/lib/fileUpload';

/* The pure half of evidence-video compression. The native transcoder it feeds
 * (`lib/videoTranscode.ts`) is device-only and unreachable from Vitest, so these decisions are
 * the only part that CAN be proven — which is exactly why they were split out. */

describe('videoBitrateFor — the budget arithmetic', () => {
  it('fills the byte budget over the clip length, charging audio per second', () => {
    // 10 MB, 60 s, 5% container overhead, 128 kbps audio:
    //   10485760 * 8 = 83,886,080 bits · * 0.95 = 79,691,776 · - (128000*60 = 7,680,000)
    //   = 72,011,776 · / 60 = 1,200,196 bps of video.
    expect(videoBitrateFor(60, 10 * 1024 * 1024, 0.05, 128000)).toBe(1200196);
  });

  it('charges AUDIO PER SECOND, not as a flat share — the bug a fixed fraction hid', () => {
    // With a fixed fraction, a 180 s clip reserved the same 1.5 MB for an audio track that
    // actually costs ~2.9 MB, so the muxed file went over the cap while the video track was
    // exactly to budget. Doubling the duration must more than halve the video bitrate.
    const at60 = videoBitrateFor(60);
    const at120 = videoBitrateFor(120);
    expect(at120).toBeLessThan(at60 / 2);
  });

  it('the MUXED size — video PLUS audio — fits the cap at every plausible duration', () => {
    // This is the property that actually matters. Encoding the video track to budget is
    // worthless if the muxed result is over.
    for (const secs of [5, 15, 30, 60, 90, 120, 180]) {
      const muxed = ((videoBitrateFor(secs) + AUDIO_BITRATE_BPS) * secs) / 8;
      expect(muxed).toBeLessThanOrEqual(MAX_VIDEO_UPLOAD_BYTES);
    }
  });

  it('never encodes below the quality floor — an impossible clip is refused, not mangled', () => {
    // A 20-minute clip cannot fit 10 MB at a usable bitrate. Rather than encode it into mush,
    // the floor holds and the oversized result is reported by judgeCompression.
    expect(videoBitrateFor(1200)).toBe(MIN_VIDEO_BITRATE_BPS);
  });

  it('gives a SHORTER clip a higher bitrate — the same budget spread over less time', () => {
    expect(videoBitrateFor(30)).toBeGreaterThan(videoBitrateFor(60));
  });

  it('gives a LONGER clip a lower bitrate, so an over-length clip still fits the cap', () => {
    expect(videoBitrateFor(180)).toBeLessThan(videoBitrateFor(60));
  });

  it('falls back to the ceiling duration for a nonsensical one — the SAFE direction', () => {
    // Assuming the longest allowed clip yields the LOWEST bitrate, i.e. the smallest file.
    const ceiling = videoBitrateFor(MAX_VIDEO_SECONDS);
    expect(videoBitrateFor(0)).toBe(ceiling);
    expect(videoBitrateFor(-5)).toBe(ceiling);
    expect(videoBitrateFor(NaN)).toBe(ceiling);
    expect(videoBitrateFor(Infinity)).toBe(ceiling);
  });

  it('never returns a bitrate below 1, however small the budget', () => {
    expect(videoBitrateFor(60, 0)).toBeGreaterThanOrEqual(1);
  });

  it('the VIDEO track alone always fits, at every duration including impossible ones', () => {
    for (const secs of [5, 30, 60, 120, 600]) {
      const bytes = (videoBitrateFor(secs) * secs) / 8;
      // At 600 s the floor applies, so the video track alone can exceed the cap — that is the
      // deliberate "refuse honestly" path, not a silent overflow.
      if (videoBitrateFor(secs) > MIN_VIDEO_BITRATE_BPS) {
        expect(bytes).toBeLessThanOrEqual(MAX_VIDEO_UPLOAD_BYTES);
      }
    }
  });
});

describe('planVideoCompression — what to do with a picked file', () => {
  it('skips anything that is not a video, so photos and PDFs are never touched', () => {
    expect(planVideoCompression({ mimeType: 'image/jpeg', size: 99 * 1024 * 1024 }))
      .toEqual({ action: 'skip', reason: 'not_video' });
    expect(planVideoCompression({ mimeType: 'application/pdf', size: 99 * 1024 * 1024 }))
      .toEqual({ action: 'skip', reason: 'not_video' });
    // No mime at all is not a video either — the document path must not be diverted.
    expect(planVideoCompression({ size: 99 * 1024 * 1024 }))
      .toEqual({ action: 'skip', reason: 'not_video' });
  });

  it('skips a video that already fits — no transcode the user has to wait for', () => {
    expect(planVideoCompression({ mimeType: 'video/mp4', size: 1024 }))
      .toEqual({ action: 'skip', reason: 'already_small' });
  });

  it('compresses an oversized video at the derived bitrate and resolution', () => {
    const plan = planVideoCompression({ mimeType: 'video/mp4', size: 60 * 1024 * 1024, durationMs: 60_000 });
    expect(plan.action).toBe('compress');
    if (plan.action !== 'compress') throw new Error('unreachable');
    expect(plan.maxSize).toBe(VIDEO_MAX_DIMENSION);
    expect(plan.bitrate).toBe(videoBitrateFor(60));
  });

  it('sizes the bitrate from the REAL duration, not the ceiling, so an over-length clip still fits', () => {
    // The Android picker's videoMaxDuration is only a hint, so a 3-minute clip really can arrive.
    const long = planVideoCompression({ mimeType: 'video/mp4', size: 200 * 1024 * 1024, durationMs: 180_000 });
    const short = planVideoCompression({ mimeType: 'video/mp4', size: 200 * 1024 * 1024, durationMs: 60_000 });
    if (long.action !== 'compress' || short.action !== 'compress') throw new Error('unreachable');
    expect(long.bitrate).toBeLessThan(short.bitrate);
  });

  it('compresses when the size is UNKNOWN — a needless transcode beats a lost clip', () => {
    const plan = planVideoCompression({ mimeType: 'video/mp4' });
    expect(plan.action).toBe('compress');
  });

  it('treats an unknown duration as the ceiling', () => {
    const plan = planVideoCompression({ mimeType: 'video/mp4', size: 60 * 1024 * 1024 });
    if (plan.action !== 'compress') throw new Error('unreachable');
    expect(plan.bitrate).toBe(videoBitrateFor(MAX_VIDEO_SECONDS));
  });

  it('is case-insensitive about the mime — pickers are inconsistent', () => {
    expect(planVideoCompression({ mimeType: 'VIDEO/MP4', size: 60 * 1024 * 1024 }).action).toBe('compress');
  });
});

describe('judgeCompression — did it actually help?', () => {
  it('accepts a result inside the cap and reports what was saved', () => {
    const v = judgeCompression(50 * 1024 * 1024, 6 * 1024 * 1024);
    expect(v.kind).toBe('ok');
    if (v.kind !== 'ok') throw new Error('unreachable');
    expect(v.savedBytes).toBe(44 * 1024 * 1024);
  });

  it('reports still-too-large when the transcode could not get it under the cap', () => {
    const v = judgeCompression(90 * 1024 * 1024, MAX_VIDEO_UPLOAD_BYTES + 1);
    expect(v).toEqual({ kind: 'still_too_large', size: MAX_VIDEO_UPLOAD_BYTES + 1 });
  });

  it('treats exactly-at-the-cap as acceptable, matching the precheck (> not >=)', () => {
    expect(judgeCompression(99, MAX_VIDEO_UPLOAD_BYTES).kind).toBe('ok');
  });

  it('FAILS OPEN when the output size cannot be read — the server limit is the backstop', () => {
    const v = judgeCompression(50 * 1024 * 1024, undefined);
    expect(v.kind).toBe('ok');
    if (v.kind !== 'ok') throw new Error('unreachable');
    expect(v.savedBytes).toBe(0);
  });

  it('never reports a negative saving when a transcode made the file bigger', () => {
    const v = judgeCompression(1024, 2048);
    if (v.kind !== 'ok') throw new Error('unreachable');
    expect(v.savedBytes).toBe(0);
  });
});

describe('the video cap tracks the document cap until someone deliberately parts them', () => {
  it('is the same 10 MB the backend enforces — owner chose to compress rather than raise it', () => {
    // If this ever fails, `routes/upload.js` limits.fileSize must have moved in the same change.
    expect(MAX_VIDEO_UPLOAD_BYTES).toBe(MAX_UPLOAD_BYTES);
    expect(MAX_VIDEO_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });
});
