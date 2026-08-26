import { describe, it, expect } from 'vitest';
import {
  MAX_VIDEO_SECONDS,
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
  it('fills the byte budget over the clip length, minus overhead', () => {
    // 10 MB over 60 s with 15% held back for audio/container:
    //   10485760 bytes * 8 = 83,886,080 bits · * 0.85 = 71,303,168 · / 60 = 1,188,386 bps
    // i.e. ~1.19 Mbps, which at 720p is ordinary streaming quality.
    expect(videoBitrateFor(60, 10 * 1024 * 1024, 0.15)).toBe(1188386);
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

  it('a clip encoded at the derived bitrate lands inside the cap', () => {
    // The whole point of the arithmetic: bitrate * seconds / 8 must fit, overhead included.
    for (const secs of [5, 30, 60, 120, 600]) {
      const bytes = (videoBitrateFor(secs) * secs) / 8;
      expect(bytes).toBeLessThanOrEqual(MAX_VIDEO_UPLOAD_BYTES);
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
