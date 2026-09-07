/**
 * PHASE 77 — sign-in tells the truth about WHY it failed.
 *
 * `login`/`sendOtp`/`verifyOtp` throw a `NetworkError` when a request produced no answer. Until now
 * that error always said "Could not reach the CGPE server. Check your connection and try again." —
 * even when the connection was fine and the server was merely slow. That is the 2026-08-22
 * IPv6/NAT64-MTU symptom: the app opens a real TCP+TLS socket to `cgpe.in`, sends its request, and
 * the reply is dropped on the reduced-MTU path, so OUR AbortController fires at `LOGIN_TIMEOUT`.
 * "Check your connection" is the wrong instruction — the connection is up.
 *
 * So `NetworkError` now carries a `kind`: a fired abort (or a message that names a timeout) is
 * 'timeout' (server reached, no reply in time); anything else `fetch` throws is 'network' (no route
 * to host). The login screen words the two differently. These tests pin that split at the api
 * boundary — the only place in the app that calls `fetch`.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

/** An error shaped exactly like the one our own `AbortController.abort()` surfaces. */
const abortError = () => {
  const e = new Error('The operation was aborted.');
  e.name = 'AbortError';
  return e;
};

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
});
afterEach(() => {
  vi.useRealTimers();
});

describe('login — timeout is not "unreachable"', () => {
  it('classifies a fired abort as a timeout, and never says "check your connection"', async () => {
    fetchSpy.mockRejectedValue(abortError());

    await expect(api.login('a@b.com', 'pw')).rejects.toMatchObject({
      name: 'NetworkError',
      kind: 'timeout',
    });

    // Re-run to read the message off the thrown instance.
    const err = await api.login('a@b.com', 'pw').catch((e) => e);
    expect(err).toBeInstanceOf(api.NetworkError);
    expect(err.message).toMatch(/taking too long/i);
    expect(err.message).not.toMatch(/check your connection/i);
  });

  it('classifies a message that names a timeout as a timeout too', async () => {
    fetchSpy.mockRejectedValue(new Error('network timeout at: https://cgpe.in'));
    const err = await api.login('a@b.com', 'pw').catch((e) => e);
    expect(err).toBeInstanceOf(api.NetworkError);
    expect(err.kind).toBe('timeout');
    expect(err.messageCopy).toEqual({ key: 'api.timeout' });
  });

  it('classifies a dead network (no route to host) as network, keeping the reach-copy', async () => {
    fetchSpy.mockRejectedValue(new Error('Network request failed'));
    const err = await api.login('a@b.com', 'pw').catch((e) => e);
    expect(err).toBeInstanceOf(api.NetworkError);
    expect(err.kind).toBe('network');
    expect(err.messageCopy).toEqual({ key: 'api.unreachable' });
    expect(err.message).toMatch(/could not reach/i);
  });

  it('a server REFUSAL is not a NetworkError — the server answered', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials. Please check and try again.' }),
    });
    const err = await api.login('a@b.com', 'wrong').catch((e) => e);
    expect(err).not.toBeInstanceOf(api.NetworkError);
    expect(err.message).toMatch(/invalid credentials/i);
    // This server fixture is deliberately identical to the local English fallback.
    expect(err.messageCopy).toBeUndefined();
  });
});

describe('sendOtp / verifyOtp — same timeout honesty', () => {
  it('sendOtp throws a timeout-kind NetworkError on an abort', async () => {
    fetchSpy.mockRejectedValue(abortError());
    const err = await api.sendOtp('9876543210').catch((e) => e);
    expect(err).toBeInstanceOf(api.NetworkError);
    expect(err.kind).toBe('timeout');
    expect(err.messageCopy).toEqual({ key: 'api.timeout' });
  });

  it('verifyOtp throws a network-kind NetworkError on a dead link', async () => {
    fetchSpy.mockRejectedValue(new Error('Failed to fetch'));
    const err = await api.verifyOtp('9876543210', '12345').catch((e) => e);
    expect(err).toBeInstanceOf(api.NetworkError);
    expect(err.kind).toBe('network');
    expect(err.messageCopy).toEqual({ key: 'api.unreachable' });
  });
});

describe('Phase 115 local sign-in copy provenance', () => {
  it.each(['timeout', 'network'] as const)('marks only the %s constructor default, preserving Error classification', (kind) => {
    const local = new api.NetworkError(kind);
    expect(local).toBeInstanceOf(Error);
    expect(local.name).toBe('NetworkError');
    expect(local.kind).toBe(kind);
    expect(local.messageCopy).toEqual({ key: kind === 'timeout' ? 'api.timeout' : 'api.unreachable' });

    // Equal words are insufficient evidence: an explicitly supplied string stays raw.
    const custom = new api.NetworkError(kind, local.message);
    expect(custom.message).toBe(local.message);
    expect(custom.messageCopy).toBeUndefined();
    const blank = new api.NetworkError(kind, '');
    expect(blank.message).toBe('');
    expect(blank.messageCopy).toBeUndefined();
  });

  it('marks the local invalid-credentials fallback when the server supplied only a machine code', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'INVALID_CREDENTIALS' }) });
    const err = await api.login('a@b.com', 'wrong').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(api.NetworkError);
    expect(err.message).toBe('Invalid credentials. Please check and try again.');
    expect(err.messageCopy).toEqual({ key: 'api.invalidCredentials' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    { identifier: 'person@example.com', channel: 'email', key: 'api.codeSentEmail', message: 'Code sent to your email.' },
    { identifier: '9876543210', channel: 'whatsapp', key: 'api.codeSentWhatsApp', message: 'Code sent to your WhatsApp number.' },
  ] as const)('keeps the $channel OTP fallback local and preserves its request body', async ({ identifier, channel, key, message }) => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    expect(await api.sendOtp(identifier)).toEqual({ ok: true, channel, message, messageCopy: { key } });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/request-otp$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ email_or_phone: identifier, phone: identifier });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the served OTP channel even when it differs from the identifier derivation', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, channel: 'email' }) });
    expect(await api.sendOtp('9876543210')).toEqual({
      ok: true, channel: 'email', message: 'Code sent to your email.', messageCopy: { key: 'api.codeSentEmail' },
    });
  });

  it.each([
    { ok: true, status: 200, channel: 'email', message: 'Code sent to your email.' },
    { ok: true, status: 200, channel: 'whatsapp', message: 'Code sent to your WhatsApp number.' },
    { ok: false, status: 400, channel: 'email', message: 'Could not send the code. Please try again.' },
  ] as const)('keeps the server OTP message raw for $channel / status $status', async ({ ok, status, channel, message }) => {
    fetchSpy.mockResolvedValue({ ok, status, json: async () => ({ success: ok, channel, message: `  ${message}  ` }) });
    // The adapter's existing whitespace trimming remains; provenance still belongs to the server.
    expect(await api.sendOtp('person@example.com')).toEqual({ ok, channel, message });
  });

  it('marks missing human OTP refusal prose and the existing local non-network catch', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'OTP_DELIVERY_FAILED' }) });
    const expected = {
      ok: false, channel: 'email', message: 'Could not send the code. Please try again.',
      messageCopy: { key: 'login.msgCodeSendFailed' },
    };
    expect(await api.sendOtp('person@example.com')).toEqual(expected);
    fetchSpy.mockRejectedValueOnce(new Error('serialization failed'));
    expect(await api.sendOtp('person@example.com')).toEqual(expected);
  });
});
