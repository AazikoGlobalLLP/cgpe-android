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
  });

  it('classifies a dead network (no route to host) as network, keeping the reach-copy', async () => {
    fetchSpy.mockRejectedValue(new Error('Network request failed'));
    const err = await api.login('a@b.com', 'pw').catch((e) => e);
    expect(err).toBeInstanceOf(api.NetworkError);
    expect(err.kind).toBe('network');
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
  });
});

describe('sendOtp / verifyOtp — same timeout honesty', () => {
  it('sendOtp throws a timeout-kind NetworkError on an abort', async () => {
    fetchSpy.mockRejectedValue(abortError());
    const err = await api.sendOtp('9876543210').catch((e) => e);
    expect(err).toBeInstanceOf(api.NetworkError);
    expect(err.kind).toBe('timeout');
  });

  it('verifyOtp throws a network-kind NetworkError on a dead link', async () => {
    fetchSpy.mockRejectedValue(new Error('Failed to fetch'));
    const err = await api.verifyOtp('9876543210', '12345').catch((e) => e);
    expect(err).toBeInstanceOf(api.NetworkError);
    expect(err.kind).toBe('network');
  });
});
