import { describe, expect, it } from 'vitest';

import { humanApiMessage, isMachineCode } from '@/lib/apiMessage';

describe('isMachineCode', () => {
  it('recognises the reason codes this backend actually sends', () => {
    // Every one of these was read off the deployed backend (`origin/main`), not invented.
    expect(isMachineCode('NO_ACCOUNT')).toBe(true);
    expect(isMachineCode('BAD_PASSWORD')).toBe(true);
    expect(isMachineCode('OTP_NOT_CONFIGURED')).toBe(true);
    expect(isMachineCode('OTP_DELIVERY_FAILED')).toBe(true);
    expect(isMachineCode('CLIENT_BOOK_DENIED')).toBe(true);
    expect(isMachineCode('LIMIT_FILE_SIZE')).toBe(true);
    expect(isMachineCode('UNSUPPORTED_MEDIA_TYPE')).toBe(true);
  });

  it('treats every prose refusal this backend sends as prose, not a code', () => {
    // These are real `error` values from routes/auth.js and middleware/errorHandler.js.
    // If any of them were misread as a code, its sentence would be suppressed and the
    // user would get a generic fallback instead of the specific reason — a regression.
    expect(isMachineCode('Your account is inactive. Please contact administration.')).toBe(false);
    expect(isMachineCode('The code has expired. Please request a new one.')).toBe(false);
    expect(isMachineCode('Too many attempts. Please request a new code.')).toBe(false);
    expect(isMachineCode('Incorrect code. Please try again.')).toBe(false);
    expect(isMachineCode('Validation failed')).toBe(false);
    expect(isMachineCode('Access denied')).toBe(false);
    expect(isMachineCode('File type video/mp4 is not allowed')).toBe(false);
    expect(isMachineCode('File too large')).toBe(false);
  });

  it('is false for empty and whitespace-only input', () => {
    expect(isMachineCode('')).toBe(false);
    expect(isMachineCode('   ')).toBe(false);
  });

  it('does not treat a single lower-case or mixed-case word as a code', () => {
    expect(isMachineCode('Forbidden')).toBe(false);
    expect(isMachineCode('unauthorized')).toBe(false);
  });

  it('accepts a single all-caps word and a digit-bearing code', () => {
    expect(isMachineCode('FORBIDDEN')).toBe(true);
    expect(isMachineCode('ERR_502')).toBe(true);
  });
});

describe('humanApiMessage', () => {
  const FALLBACK = 'Invalid credentials. Please check and try again.';

  it('shows the sentence, not the token, for the two commonest sign-in failures', () => {
    // Both bodies are verbatim from the live server (probed 2026-08-27) — the whole
    // reason this module exists. Before it, the user read the word "NO_ACCOUNT".
    expect(
      humanApiMessage(
        {
          error: 'NO_ACCOUNT',
          message:
            'No account found with that email or mobile number. Please check for a typo (e.g. the domain is cgpe.in).',
        },
        FALLBACK,
      ),
    ).toBe(
      'No account found with that email or mobile number. Please check for a typo (e.g. the domain is cgpe.in).',
    );
    expect(
      humanApiMessage(
        { error: 'BAD_PASSWORD', message: 'Incorrect password. Use “Forgot password?” to reset it.' },
        FALLBACK,
      ),
    ).toBe('Incorrect password. Use “Forgot password?” to reset it.');
  });

  it('keeps preferring a prose `error`, so no existing route loses its wording', () => {
    expect(
      humanApiMessage({ error: 'Your account is inactive. Please contact administration.' }, FALLBACK),
    ).toBe('Your account is inactive. Please contact administration.');
    // Prose in `error` wins even when a `message` is also present — unchanged behaviour.
    expect(humanApiMessage({ error: 'The code has expired. Please request a new one.', message: 'x' }, FALLBACK))
      .toBe('The code has expired. Please request a new one.');
  });

  it('falls back rather than printing a bare token when the server sends no sentence', () => {
    expect(humanApiMessage({ error: 'NO_ACCOUNT' }, FALLBACK)).toBe(FALLBACK);
    expect(humanApiMessage({ error: 'OTP_DELIVERY_FAILED', message: '   ' }, FALLBACK)).toBe(FALLBACK);
  });

  it('uses `message` when there is no `error` at all', () => {
    expect(humanApiMessage({ message: 'We could not do that right now.' }, FALLBACK))
      .toBe('We could not do that right now.');
  });

  it('falls back for an unparseable, empty or non-string body', () => {
    expect(humanApiMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(humanApiMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(humanApiMessage({}, FALLBACK)).toBe(FALLBACK);
    expect(humanApiMessage({ error: 42, message: { nested: true } } as any, FALLBACK)).toBe(FALLBACK);
  });

  it('trims surrounding whitespace off whichever string it returns', () => {
    expect(humanApiMessage({ error: '  Access denied  ' }, FALLBACK)).toBe('Access denied');
    expect(humanApiMessage({ error: 'NO_ACCOUNT', message: '  Try again.  ' }, FALLBACK)).toBe('Try again.');
  });
});
