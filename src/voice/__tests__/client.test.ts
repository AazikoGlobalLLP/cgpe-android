/**
 * The voice client is a WRITE path (a retried voice command is a double clock-in), so the tests pin
 * the things that keep it safe and correct: exactly one fetch, no Content-Type (so the multipart
 * boundary survives), the bearer token attached, the snake_case fields, the abort at the ceiling, and
 * that every
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

  it('a body that will not parse still classifies, and stays transient', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 500, json: async () => { throw new Error('not json'); },
    })));
    const client = await load('real-jwt-token');
    const r = await client.askVoice(INPUT);
    expect(r).toEqual({ ok: false, transport: 'server', status: 500 });
  });
});

/**
 * The permanent/transient split. Retry copy on a permanently-off server is the exact defect the
 * upload path had before `classifyUploadFailureBody`: the user is told to try again forever, for a
 * thing only an admin can fix. Prod is a live example TODAY — `POST /api/voice/ask` answers 404
 * because the proxy is built but not on `origin/main`.
 */
describe('permanent vs transient outage', () => {
  it('treats a not-deployed route (404 / 501) as permanent', async () => {
    const { isPermanentVoiceOutage } = await load();
    expect(isPermanentVoiceOutage(404, null)).toBe(true);
    expect(isPermanentVoiceOutage(501, null)).toBe(true);
  });

  it('treats a 503 as permanent ONLY when the body names it, in either documented spelling', async () => {
    const { isPermanentVoiceOutage } = await load();
    expect(isPermanentVoiceOutage(503, { code: 'not_configured', missing: ['SARVAM_API_KEY'] })).toBe(true);
    expect(isPermanentVoiceOutage(503, { not_configured: true })).toBe(true);
  });

  it('leaves a bare 503 transient — an overloaded proxy is not an unconfigured one', async () => {
    const { isPermanentVoiceOutage } = await load();
    expect(isPermanentVoiceOutage(503, null)).toBe(false);
    expect(isPermanentVoiceOutage(503, {})).toBe(false);
    expect(isPermanentVoiceOutage(503, { code: 'busy' })).toBe(false);
  });

  it('leaves every ordinary fault transient (the conservative direction)', async () => {
    const { isPermanentVoiceOutage } = await load();
    for (const s of [400, 401, 403, 408, 429, 500, 502, 504]) {
      expect({ s, permanent: isPermanentVoiceOutage(s, { code: 'not_configured' }) })
        .toEqual({ s, permanent: false });
    }
  });

  it('askVoice reports a 404 as unconfigured, not as a retryable server fault', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => null })));
    const client = await load('real-jwt-token');
    const r = await client.askVoice(INPUT);
    expect(r).toEqual({ ok: false, transport: 'unconfigured', status: 404 });
  });

  it('askVoice reports the documented 503 not_configured as unconfigured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 503, json: async () => ({ code: 'not_configured', missing: ['SARVAM_API_KEY'] }),
    })));
    const client = await load('real-jwt-token');
    const r = await client.askVoice(INPUT);
    expect(r).toEqual({ ok: false, transport: 'unconfigured', status: 503 });
  });

  it('askVoice keeps a bare 503 transient', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const client = await load('real-jwt-token');
    const r = await client.askVoice(INPUT);
    expect(r).toEqual({ ok: false, transport: 'server', status: 503 });
  });

  // CHANGED 2026-09-01: this used to assert the exception was DISCARDED. An owner screenshot showed a
  // failed turn whose whole on-screen explanation was the word "network" — no status to read (there
  // is none for a transport failure) and no message, so nobody could tell a dropped connection from a
  // missing file. The thrown message now rides along; the transport kind is unchanged.
  it('a thrown fetch is a network transport error, and KEEPS what was thrown', async () => {
    const fetchSpy = vi.fn(async () => { throw new Error('Network request failed'); });
    vi.stubGlobal('fetch', fetchSpy);
    const client = await load('real-jwt-token');
    const r = await client.askVoice(INPUT);
    expect(r).toEqual({ ok: false, transport: 'network', detail: 'Network request failed' });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // exactly once — never retried
  });

  it('an abort at the ceiling is a timeout transport error', async () => {
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
