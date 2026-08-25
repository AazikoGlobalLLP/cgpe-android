import { describe, it, expect } from 'vitest';

import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  ALLOWED_UPLOAD_MIME,
  resolveMime,
  precheckUpload,
  classifyUploadStatus,
  isEphemeralUrl,
  describeUploadFailure,
  type UploadFailure,
} from '@/lib/fileUpload';

/* These pins are load-bearing: they mirror the LIVE backend limits in
 * `cgpe-backend-main/routes/upload.js`. If the backend changes its cap or allowlist and
 * these are updated to match, that is intentional — the point is that the two never drift
 * silently. */

describe('backend limit mirror', () => {
  it('caps at exactly 10 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_UPLOAD_MB).toBe(10);
  });

  it('accepts exactly the multer fileFilter allowlist', () => {
    expect([...ALLOWED_UPLOAD_MIME].sort()).toEqual([
      'application/msword',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/gif',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ]);
  });
});

describe('resolveMime', () => {
  it('prefers the picker mimeType, lower-cased', () => {
    expect(resolveMime({ mimeType: 'IMAGE/JPEG', name: 'x.png' })).toBe('image/jpeg');
  });
  it('falls back to the extension when no mimeType is given', () => {
    expect(resolveMime({ name: 'scan.PDF' })).toBe('application/pdf');
    expect(resolveMime({ name: 'sheet.xlsx' })).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });
  it('returns empty string when it genuinely cannot tell (caller must fail open)', () => {
    expect(resolveMime({ name: 'noextension' })).toBe('');
    expect(resolveMime({})).toBe('');
  });
});

describe('precheckUpload — the client-side gate', () => {
  it('passes a normal photo under the cap', () => {
    expect(precheckUpload({ name: 'photo.jpg', mimeType: 'image/jpeg', size: 2_000_000 })).toBeNull();
  });

  it('rejects a file over 10 MB as too_large', () => {
    expect(precheckUpload({ name: 'big.pdf', mimeType: 'application/pdf', size: MAX_UPLOAD_BYTES + 1 }))
      .toBe('too_large');
  });

  it('allows a file exactly at the cap (the cap is inclusive on the server)', () => {
    expect(precheckUpload({ name: 'edge.pdf', mimeType: 'application/pdf', size: MAX_UPLOAD_BYTES }))
      .toBeNull();
  });

  it('rejects an unsupported type by mimeType', () => {
    expect(precheckUpload({ name: 'clip.mp4', mimeType: 'video/mp4', size: 500 })).toBe('type_rejected');
    expect(precheckUpload({ name: 'a.zip', mimeType: 'application/zip', size: 500 })).toBe('type_rejected');
  });

  it('FAILS OPEN on a disallowed extension when no mimeType is given — the extension map only knows accepted types, so an unresolvable type is left for the server to reject', () => {
    // `.zip` is not in the (allowlist-only) extension map, so resolveMime returns '' and the
    // precheck cannot judge it — it must not block what it cannot confidently classify.
    expect(precheckUpload({ name: 'archive.zip', size: 500 })).toBeNull();
  });

  it('FAILS OPEN on an unknown size and an unresolvable type — never blocks what it cannot judge', () => {
    expect(precheckUpload({ name: 'mystery', size: undefined })).toBeNull();
    expect(precheckUpload({ name: 'mystery' })).toBeNull();
  });

  it('checks size before type (a huge unsupported file reads as too_large first)', () => {
    expect(precheckUpload({ name: 'huge.mp4', mimeType: 'video/mp4', size: MAX_UPLOAD_BYTES + 1 }))
      .toBe('too_large');
  });
});

describe('classifyUploadStatus', () => {
  it('maps auth failures', () => {
    expect(classifyUploadStatus(401)).toBe('unauthorized');
    expect(classifyUploadStatus(403)).toBe('unauthorized');
  });
  it('maps proxy-enforced size/type when present', () => {
    expect(classifyUploadStatus(413)).toBe('too_large');
    expect(classifyUploadStatus(415)).toBe('type_rejected');
  });
  it('treats 400 and 5xx as a server-side non-acceptance', () => {
    expect(classifyUploadStatus(400)).toBe('server');
    expect(classifyUploadStatus(500)).toBe('server');
    expect(classifyUploadStatus(502)).toBe('server');
  });
});

describe('isEphemeralUrl — the "captures vanish" signature', () => {
  it('flags a loopback / private fallback URL', () => {
    expect(isEphemeralUrl('http://localhost:3001/uploads/general/x.jpg')).toBe(true);
    expect(isEphemeralUrl('https://127.0.0.1/uploads/x.pdf')).toBe(true);
    expect(isEphemeralUrl('http://0.0.0.0:3001/uploads/x.png')).toBe(true);
    expect(isEphemeralUrl('http://droplet.local/uploads/x.png')).toBe(true);
  });
  it('accepts a real cloud/CDN URL as durable', () => {
    expect(isEphemeralUrl('https://cgpe.blr1.digitaloceanspaces.com/general/x.jpg')).toBe(false);
    expect(isEphemeralUrl('https://cgpe.in/uploads/general/x.jpg')).toBe(false);
  });
  it('does not throw on a malformed URL', () => {
    expect(isEphemeralUrl('not a url')).toBe(false);
    expect(isEphemeralUrl('')).toBe(false);
  });
});

describe('describeUploadFailure', () => {
  const REASONS: UploadFailure[] = [
    'too_large', 'type_rejected', 'timeout', 'network',
    'server', 'unauthorized', 'not_signed_in', 'not_stored',
  ];

  it('returns non-empty title + message for every reason', () => {
    for (const r of REASONS) {
      const d = describeUploadFailure(r);
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.message.length).toBeGreaterThan(0);
      expect(['danger', 'warning']).toContain(d.tone);
    }
  });

  it('names the real 10 MB cap and 30 s timeout, sourced from the constants (no invented numbers)', () => {
    expect(describeUploadFailure('too_large').message).toContain('10 MB');
    expect(describeUploadFailure('timeout').message).toContain('30 seconds');
  });

  it('uses the softer warning tone for user/setup conditions, danger for hard failures', () => {
    expect(describeUploadFailure('too_large').tone).toBe('warning');
    expect(describeUploadFailure('not_stored').tone).toBe('warning');
    expect(describeUploadFailure('not_signed_in').tone).toBe('warning');
    expect(describeUploadFailure('network').tone).toBe('danger');
    expect(describeUploadFailure('server').tone).toBe('danger');
    expect(describeUploadFailure('timeout').tone).toBe('danger');
  });
});
