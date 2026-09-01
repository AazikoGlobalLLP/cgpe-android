/**
 * `describeCause` / `describeTransport` — the breadcrumb that makes a failed voice turn diagnosable.
 *
 * The first APK carrying voice failed at "Hold to speak" and said only "Something went wrong. Please
 * try again." The `catch` threw the exception away, so the only remaining route to a diagnosis was a
 * USB cable — which a field agent does not have. These pin that the reason survives to the screen,
 * and that it stays ONE readable line rather than a native stack dumped into a banner.
 */
import { describe, expect, it } from 'vitest';
import { describeCause, describeTransport } from '@/voice/cause';

describe('describeCause', () => {
  it('keeps an Error message — the thing that identifies the fault', () => {
    expect(describeCause(new Error('Failed to start recording: AAC encoder unavailable')))
      .toBe('Failed to start recording: AAC encoder unavailable');
  });

  it('falls back to the error NAME when the message is empty', () => {
    const e = new Error('');
    e.name = 'UnsatisfiedLinkError';
    expect(describeCause(e)).toBe('UnsatisfiedLinkError');
  });

  it('accepts a thrown string and a plain object carrying a message', () => {
    expect(describeCause('prepareToRecordAsync failed')).toBe('prepareToRecordAsync failed');
    expect(describeCause({ message: 'native module not found' })).toBe('native module not found');
  });

  it('collapses a multi-line native stack onto one line', () => {
    expect(describeCause(new Error('boom\n  at Foo.kt:21\n\tat Bar.kt:8')))
      .toBe('boom at Foo.kt:21 at Bar.kt:8');
  });

  it('truncates a very long message with an ellipsis (a banner is not a log viewer)', () => {
    const out = describeCause(new Error('x'.repeat(500)));
    expect(out).toHaveLength(160);
    expect(out?.endsWith('…')).toBe(true);
  });

  it('returns null when there is genuinely nothing to say, so the caller keeps its own copy', () => {
    expect(describeCause(null)).toBeNull();
    expect(describeCause(undefined)).toBeNull();
    expect(describeCause('   ')).toBeNull();
    // `String({})` is '[object Object]' — noise pretending to be information.
    expect(describeCause({})).toBeNull();
  });
});

describe('describeTransport', () => {
  it('names the kind, and the status when we have one', () => {
    // 404 vs 503 is exactly the distinction the friendly sentence hides: not deployed vs keys unset.
    expect(describeTransport('unconfigured', 404)).toBe('unconfigured (HTTP 404)');
    expect(describeTransport('unconfigured', 503)).toBe('unconfigured (HTTP 503)');
    expect(describeTransport('timeout')).toBe('timeout');
  });
});
