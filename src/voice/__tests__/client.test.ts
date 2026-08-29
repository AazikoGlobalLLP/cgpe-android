/**
 * The voice client is a WRITE path (a retried voice command is a double clock-in), so the tests pin
 * the things that keep it safe and correct: exactly one fetch, no Content-Type (so the multipart
 * boundary survives), the bearer token attached, the snake_case fields, the 8 s abort, and that every
 * failure mode returns a typed result instead of throwing. It touches api.ts's mutable token state, so
 * it follows the house `vi.resetModules()` + dynamic-import pattern.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VOICE } from '@/voice/constants';
import type { VoiceLangCode } from '@/voice/request';

/** A minimal FormData that records appends — Node's real undici FormData rejects RN file parts. */
class FakeFormData {
  entries: [string, unknown][] = [];
  append(k: string, v: unknown) {
    this.entries.push([k, v]);
  }
}

const INPUT = {
  audioUri: 'file:///tmp/voice.m4a',
  lang: 'hi-IN' as VoiceLangCode,
  sessionId: 'sess-1',
  requestId: 'req-uuid-1',
  screen: '/(tabs)/tasks',
  history: [{ role: 'user' as const, text: 'hi' }],
};

async function load(token?: string) {
  const api = await import('@/data/api');
  if (token) api.setAuthToken(token);
  const client = await import('@/voice/client');
  return client;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('FormData', FakeFormData);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('gating — never POST without a real session', () => {
  it('returns unauthenticated and does NOT fetch when there is no token', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const client = await load(); // no token
    const r = await client.askVoice(INPUT);
    expect(r).toEqual({ ok: false, transport: 'unauthenticated' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('the request shape', () => {
  it('POSTs multipart to /voice/ask with the bearer token and NO Content-Type', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ ok: true, transcript: 't', reply_text: 'r', confidence: 0.9 }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const client = await load('real-jwt-token');
    await client.askVoice(INPUT);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/voice\/ask$/);
    expect(opts.method).toBe('POST');
    const headers = opts.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer real-jwt-token');
    expect(headers['X-CGPE-Token']).toBe('real-jwt-token');
    expect(headers['X-CGPE-Request-Id']).toBe('req-uuid-1');
    expect(headers['X-CGPE-App-Version']).toBeTruthy();
    // NO Content-Type — fetch must set the multipart boundary itself.
    expect(headers['Content-Type']).toBeUndefined();
    // the app never sends the webhook secret — the proxy attaches it
    expect(headers['X-CGPE-Webhook-Secret']).toBeUndefined();
  });

  it('sends the snake_case fields the contract names', async () => {
    let captured: FakeFormData | null = null;
    const fetchSpy = vi.fn(async (_u: string, opts: RequestInit) => {
      captured = opts.body as unknown as FakeFormData;
      return { ok: true, status: 200, json: async () => ({ ok: true, transcript: 't', reply_text: 'r', confidence: 0.9 }) };
    });
    vi.stubGlobal('fetch', fetchSpy);
    const client = await load('real-jwt-token');
    await client.askVoice(INPUT);

    const keys = captured!.entries.map((e) => e[0]);
    expect(keys).toEqual(['audio', 'lang', 'session_id', 'request_id', 'screen', 'history']);
    const asObj = Object.fromEntries(captured!.entries);
    expect(asObj.lang).toBe('hi-IN');
    expect(asObj.session_id).toBe('sess-1');
    expect(asObj.request_id).toBe('req-uuid-1');
    expect(asObj.history).toBe(JSON.stringify(INPUT.history));
  });
});

describe('outcomes', () => {
  it('a 200 with a valid body is parsed into a VoiceReply', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ ok: true, transcript: 'aaj kitne kaam', reply_text: '4 kaam', confidence: 0.9 }),
    })));
    const client = await load('real-jwt-token');
    const r = await client.askVoice(INPUT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.replyText).toBe('4 kaam');
  });

  it('a 200 with an empty/garbage body is a parse error, not a transport error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => null })));
    const client = await load('real-jwt-token');
    const r = await client.askVoice(INPUT);
    expect(r.ok).toBe(false);
    expect(client.isTransportError(r)).toBe(false);
    if (!r.ok && !client.isTransportError(r)) expect(r.code).toBe('empty_body');
  });

  it('a non-200 is a server transport error carrying the status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })));
    const client = await load('real-jwt-token');
    const r = await client.askVoice(INPUT);
    expect(r).toEqual({ ok: false, transport: 'server', status: 502 });
  });

  it('a thrown fetch is a network transport error', async () => {
    const fetchSpy = vi.fn(async () => { throw new Error('down'); });
    vi.stubGlobal('fetch', fetchSpy);
    const client = await load('real-jwt-token');
    const r = await client.askVoice(INPUT);
    expect(r).toEqual({ ok: false, transport: 'network' });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // exactly once — never retried
  });

  it('an abort at the 8 s ceiling is a timeout transport error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_u: string, opts: RequestInit) => new Promise((_res, rej) => {
      opts.signal?.addEventListener('abort', () => rej(new Error('aborted')));
    })));
    const client = await load('real-jwt-token');
    const p = client.askVoice(INPUT);
    await vi.advanceTimersByTimeAsync(VOICE.CEILING_MS + 5);
    const r = await p;
    expect(r).toEqual({ ok: false, transport: 'timeout' });
  });
});
