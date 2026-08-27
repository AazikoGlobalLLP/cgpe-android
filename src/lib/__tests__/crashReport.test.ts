import { describe, expect, it } from 'vitest';

import { crashDetail, describeCrash, MAX_CRASH_DETAIL } from '@/lib/crashReport';

/**
 * The error screen is the one screen that only ever renders when everything else has failed, so
 * it is the one most likely to be broken without anyone knowing. These cases exist so the pure
 * half has actually been run at least once before a real crash runs it.
 */

describe('crashDetail', () => {
  it('names the error class as well as the message', () => {
    expect(crashDetail(new TypeError("Cannot read property 'id' of undefined")))
      .toBe("TypeError: Cannot read property 'id' of undefined");
  });

  it('survives everything a `throw` can actually produce, without throwing itself', () => {
    // `Try`'s prop is typed `Error`, but React passes through whatever was thrown. A boundary
    // that crashes while rendering a crash leaves the user with nothing at all.
    expect(crashDetail('a bare string')).toBe('a bare string');
    expect(crashDetail({ message: 'duck-typed' })).toBe('duck-typed');
    expect(crashDetail(undefined)).toBe('');
    expect(crashDetail(null)).toBe('');
    expect(crashDetail(42)).toBe('');
    expect(crashDetail({})).toBe('');
  });

  it('returns empty rather than whitespace, so the UI can drop the block entirely', () => {
    // An empty detail box reads like a bug in the error screen itself.
    expect(crashDetail('   \n  ')).toBe('');
    expect(crashDetail(new Error(''))).toBe('Error:');
  });

  it('flattens newlines so a stack fragment cannot turn the card into a page', () => {
    expect(crashDetail('line one\n  line two\n\tline three')).toBe('line one line two line three');
  });

  it('truncates with an ellipsis at the documented cap', () => {
    const long = 'x'.repeat(MAX_CRASH_DETAIL + 200);
    const out = crashDetail(long);
    expect(out).toHaveLength(MAX_CRASH_DETAIL);
    expect(out.endsWith('…')).toBe(true);
  });

  it('leaves a detail exactly at the cap untouched', () => {
    const exact = 'y'.repeat(MAX_CRASH_DETAIL);
    expect(crashDetail(exact)).toBe(exact);
  });
});

describe('describeCrash', () => {
  it('never claims to know the cause', () => {
    // We know a screen failed to draw. We do not know why. Copy that guesses ("check your
    // connection") sends a field advisor somewhere useless while the real fault stays hidden.
    const { title, message } = describeCrash(new Error('boom'));
    const all = `${title} ${message}`.toLowerCase();
    expect(all).not.toContain('connection');
    expect(all).not.toContain('internet');
    expect(all).not.toContain('offline');
  });

  it('gives a recovery path in cost order and does not promise it will work', () => {
    const { message } = describeCrash(new Error('boom'));
    expect(message.indexOf('Try the screen again')).toBeLessThan(message.indexOf('close the app'));
    expect(message.indexOf('close the app')).toBeLessThan(message.indexOf('branch admin'));
    expect(message.toLowerCase()).not.toContain('will work');
  });

  it('carries the error text through for a screenshot', () => {
    expect(describeCrash(new RangeError('bad index')).detail).toBe('RangeError: bad index');
  });

  it('still produces a usable screen when nothing readable was thrown', () => {
    const r = describeCrash(undefined);
    expect(r.title).toBeTruthy();
    expect(r.message).toBeTruthy();
    expect(r.detail).toBe('');
  });
});
