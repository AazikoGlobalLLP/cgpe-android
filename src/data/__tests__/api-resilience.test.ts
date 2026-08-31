/**
 * Phase 55 — network resilience wired into the real `req()` / `uploadFile` / `testConnection`.
 *
 * This pins the BEHAVIOUR the pure `netResilience` rules produce once they are in the transport:
 *   - an idempotent READ retries ONCE on a transient fault (5xx / 429 / a throw) and recovers if the
 *     retry lands; a WRITE never retries (a clock-in / send must not double-fire);
 *   - a considered answer (404) is not retried;
 *   - the failure KIND reaches `data/health` so the banner can name it;
 *   - `testConnection` probes the unauthenticated /health honestly (first result, no retry);
 *   - `uploadFile` now carries an AbortController signal so a stall can't hang forever.
 *
 * Fake timers, because a real read now waits a 600 ms backoff before its retry — the tests advance
 * past it instead of paying it. `api.ts` holds module state with no reset export, so it is re-imported
 * per test (CLAUDE.md). Fetch is stubbed at the one boundary so the real req/health paths run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

/**
 * The presigned PUT's transport, mocked at the app's own seam.
 *
 * `lib/binaryUpload` exists precisely so this is possible: it wraps the native
 * `expo-file-system` upload task, which cannot load in Node — and whose lazy `require()`
 * resolves through Node rather than Vite, so neither a config alias nor a `vi.mock` factory can
 * reach it directly. Mocking OUR module instead is what lets the contract's sharpest trap be
 * pinned: the `Content-Type` on the PUT is SIGNED, so any other value 403s at MinIO silently.
 */
const put = vi.hoisted(() => ({
  calls: [] as { url: string; fileUri: string; contentType: string; timeoutMs: number }[],
  outcome: { kind: 'response', status: 200 } as
    | { kind: 'response'; status: number } | { kind: 'timeout' } | { kind: 'network' },
}));
vi.mock('@/lib/binaryUpload', () => ({
  putBinary: async (input: { url: string; fileUri: string; contentType: string; timeoutMs: number }) => {
    put.calls.push(input);
    return put.outcome;
  },
}));

const reply = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
/** An error shaped like our AbortController's abort (what a timeout surfaces as). */
const abortErr = () => { const e = new Error('The operation was aborted'); e.name = 'AbortError'; return e; };

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  put.calls.length = 0;
  put.outcome = { kind: 'response', status: 200 };
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT make the session real
});

afterEach(() => { vi.useRealTimers(); });

describe('req() retry — idempotent reads recover from a transient fault', () => {
  it('retries a GET once after a 5xx and RECOVERS when the retry lands (no banner)', async () => {
    fetchSpy
      .mockResolvedValueOnce(reply(500, { success: false, error: 'flaky' }))
      .mockResolvedValueOnce(reply(200, { success: true, data: { plans: [] } }));   // getLicPlans validates data.plans
    const p = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(2000);   // past the backoff, so the 2nd attempt fires
    expect(await p).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(health.getHealth().degraded).toBe(false);   // recovered — the transient blip never reached the user
  });

  it('gives up after the BOUNDED number of retries (2 attempts total) and reports "server"', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false, error: 'down' }));
    const p = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);   // 1 first attempt + RETRY_ATTEMPTS(1)
    expect(health.getHealth().degraded).toBe(true);
    expect(health.getHealth().kind).toBe('server');
  });

  it('retries a GET on a network THROW and carries the "network" kind when it stays down', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const p = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(health.getHealth().kind).toBe('network');
  });

  it('does NOT retry a 404 — a considered answer, not a transient fault, and stays quiet', async () => {
    fetchSpy.mockResolvedValue(reply(404, { success: false, message: 'gone' }));
    const p = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);            // answered once, not retried
    expect(health.getHealth().degraded).toBe(false);      // 404 is an answer → no banner
  });
});

describe('req() retry — WRITES are never retried', () => {
  it('does not retry a POST that hits a 5xx (a write must not double-fire)', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false, message: 'boom' }));
    const r = await api.sendOtp('9876543210');   // POST /auth/request-otp
    expect(r.ok).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('testConnection — the on-device app-vs-WiFi probe', () => {
  it('reports ok + a round-trip time when /health answers 200', async () => {
    fetchSpy.mockResolvedValue(reply(200, { status: 'ok' }));
    const r = await api.testConnection();
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(typeof (r as { ms: number }).ms).toBe('number');
  });

  it('pings the /health path (unauthenticated diagnostic)', async () => {
    fetchSpy.mockResolvedValue(reply(200, {}));
    await api.testConnection();
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/health');
  });

  it('classifies a 5xx as a reachable-but-unwell "server" problem and does NOT retry', async () => {
    fetchSpy.mockResolvedValue(reply(503, { success: false }));
    const r = await api.testConnection();
    expect(r).toMatchObject({ ok: false, kind: 'server', status: 503 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);   // a diagnostic reports the first result honestly
  });

  it('classifies a fetch throw as "network" (cannot reach the host)', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await api.testConnection()).toMatchObject({ ok: false, kind: 'network' });
  });

  it('classifies our abort as "timeout" (the server did not answer in time)', async () => {
    fetchSpy.mockRejectedValue(abortErr());
    expect(await api.testConnection()).toMatchObject({ ok: false, kind: 'timeout' });
  });

  it('raises NO outage banner — it is a probe, not a data read', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    await api.testConnection();
    expect(health.getHealth().degraded).toBe(false);
  });
});

/**
 * Every upload now asks `POST /upload/presign` FIRST. A 404 is what every server that has not
 * deployed backend Phase 95 answers (production, as of 2026-08-29), and it puts the upload back
 * on the legacy multipart path — so this is what the legacy tests below have to arrange. That
 * this fallback exists at all is the reason adopting the presigned flow ahead of the backend
 * deploy is inert rather than a field outage.
 */
const presignAbsent = () => fetchSpy.mockResolvedValueOnce(reply(404, { success: false }));

describe('uploadFile — a typed outcome, not {url,key}|null (Point 11)', () => {
  it('carries an AbortController signal (Phase 55) and returns ok:true with the stored url', async () => {
    presignAbsent();
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: { url: 'https://cdn/x.jpg', key: 'x' } }));
    const r = await api.uploadFile('file:///tmp/a.jpg', 'a.jpg');
    expect(r).toEqual({ ok: true, url: 'https://cdn/x.jpg', key: 'x', ephemeral: false });
    // `.endsWith`, not `.includes` — '/upload/presign' contains '/upload' and would match first.
    const uploadCall = fetchSpy.mock.calls.find((call) => String(call[0]).endsWith('/upload'));
    expect(uploadCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('flags a loopback fallback URL as ephemeral (the "captures vanish" bug)', async () => {
    presignAbsent();
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: { url: 'http://localhost:3001/uploads/general/x.jpg', key: 'x' } }));
    expect(await api.uploadFile('file:///tmp/a.jpg', 'a.jpg')).toEqual({
      ok: true, url: 'http://localhost:3001/uploads/general/x.jpg', key: 'x', ephemeral: true,
    });
  });

  it('classifies a non-ok status instead of one generic failure', async () => {
    presignAbsent();
    fetchSpy.mockResolvedValue(reply(403, { success: false, error: 'no' }));
    expect(await api.uploadFile('file:///tmp/a.jpg', 'a.jpg')).toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('treats a 2xx with no url as a server non-acceptance, not a fake success', async () => {
    presignAbsent();
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: {} }));
    expect(await api.uploadFile('file:///tmp/a.jpg', 'a.jpg')).toEqual({ ok: false, reason: 'server' });
  });

  it('returns a typed failure (not a hang) when the upload throws', async () => {
    fetchSpy.mockRejectedValue(abortErr());   // the presign attempt throws too, and falls through
    const r = await api.uploadFile('file:///tmp/a.jpg', 'a.jpg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('network');
  });

  it('never leaves the handset without a real session — returns not_signed_in, no fetch', async () => {
    api.setAuthToken('demo-abc');   // a `demo-` token disables real network calls
    const p = api.uploadFile('file:///tmp/a.jpg', 'a.jpg');
    await vi.advanceTimersByTimeAsync(600);   // clear the fake-session wait(500)
    expect(await p).toEqual({ ok: false, reason: 'not_signed_in' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/**
 * PHASE 86 — the presigned MinIO flow (backend Phase 95 / D-122).
 *
 * The binary PUT goes through `expo-file-system`'s native upload task, which cannot load in
 * Node, so it is mocked here rather than stubbed globally: this is the only test that needs it,
 * and the mock is what lets the ONE trap in the contract be pinned — the `Content-Type` is
 * SIGNED, so sending anything but the server's own string 403s at MinIO, silently, in the field.
 */
describe('uploadFile — the presigned flow (Phase 86)', () => {
  const presigned = (over: Record<string, unknown> = {}) => reply(200, {
    success: true,
    data: {
      key: 'u123/general/1724-abc.jpg',
      url: 'https://minio.example/cgpe/u123/general/1724-abc.jpg?X-Amz-Signature=deadbeef',
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresIn: 300,
      maxBytes: 10485760,
      ...over,
    },
  });

  it('PUTs the bytes with the SIGNED Content-Type verbatim and NO Authorization header', async () => {
    fetchSpy.mockResolvedValueOnce(presigned());
    const r = await api.uploadFile('file:///tmp/a.jpg', 'a.jpg', 'IMAGE/JPEG');

    expect(r).toEqual({
      ok: true, url: '', key: 'u123/general/1724-abc.jpg',
      storageKey: 'u123/general/1724-abc.jpg', ephemeral: false,
    });
    expect(put.calls).toHaveLength(1);
    const sentPut = put.calls[0];
    expect(sentPut.url).toContain('X-Amz-Signature');
    expect(sentPut.fileUri).toBe('file:///tmp/a.jpg');
    // The server's string, not the caller's 'IMAGE/JPEG' — a mismatch fails the signature.
    expect(sentPut.contentType).toBe('image/jpeg');
  });

  it('hands back the KEY and an EMPTY url — a signed URL must never be persisted', async () => {
    fetchSpy.mockResolvedValueOnce(presigned());
    const r = await api.uploadFile('file:///tmp/a.jpg', 'a.jpg', 'image/jpeg');
    expect(r.ok && r.url).toBe('');
    expect(r.ok && r.storageKey).toBeTruthy();
  });

  it('asks for the presign with the file MIME, as ONE attempt (a retry would orphan a key)', async () => {
    fetchSpy.mockResolvedValueOnce(presigned());
    await api.uploadFile('file:///tmp/a.jpg', 'report.pdf', 'application/pdf');
    const call = fetchSpy.mock.calls.find((cl) => String(cl[0]).endsWith('/upload/presign'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ content_type: 'application/pdf', filename: 'report.pdf' });
    expect(call?.[1]?.method).toBe('POST');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to the legacy multipart path on a 503 (S3_* not set) — no user-visible failure', async () => {
    fetchSpy.mockResolvedValueOnce(reply(503, { success: false, code: 'STORAGE_NOT_CONFIGURED' }));
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: { url: 'https://cdn/x.jpg', key: 'x' } }));
    expect(await api.uploadFile('file:///tmp/a.jpg', 'a.jpg')).toEqual({
      ok: true, url: 'https://cdn/x.jpg', key: 'x', ephemeral: false,
    });
    expect(put.calls).toHaveLength(0);   // nothing was PUT directly to storage
  });

  it('reports a 415 as a content problem and NEVER falls back — retrying can only fail again', async () => {
    fetchSpy.mockResolvedValueOnce(reply(415, { success: false, code: 'UNSUPPORTED_MEDIA_TYPE' }));
    expect(await api.uploadFile('file:///tmp/a.zip', 'a.zip', 'application/zip')).toEqual({
      ok: false, reason: 'type_rejected',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('names a rejected VIDEO separately, so the copy does not tell the user to try again', async () => {
    fetchSpy.mockResolvedValueOnce(reply(415, { success: false, code: 'UNSUPPORTED_MEDIA_TYPE' }));
    expect(await api.uploadFile('file:///tmp/a.mp4', 'a.mp4', 'video/mp4')).toEqual({
      ok: false, reason: 'video_not_accepted',
    });
  });

  it('refuses a 2xx presign with no signed Content-Type rather than guessing one', async () => {
    // Guessing would 403 at MinIO after the whole file had uploaded — a failure a long way
    // from its cause. A malformed target is a server fault, reported as one.
    fetchSpy.mockResolvedValueOnce(presigned({ headers: {} }));
    expect(await api.uploadFile('file:///tmp/a.jpg', 'a.jpg')).toEqual({ ok: false, reason: 'server' });
    expect(put.calls).toHaveLength(0);
  });

  it('maps a PUT 403 to "server", not "unauthorized" — it is an expired signature, not a role', async () => {
    // 'unauthorized' copy sends the user to their branch admin. A 403 here means the signature
    // did not verify (mismatched type, or the 300 s window elapsed), which a retry fixes.
    fetchSpy.mockResolvedValueOnce(presigned());
    put.outcome = { kind: 'response', status: 403 };
    expect(await api.uploadFile('file:///tmp/a.jpg', 'a.jpg')).toEqual({ ok: false, reason: 'server' });
  });
});

describe('getAttachmentDownloadUrl — signed fresh per open, never stored', () => {
  it('returns the signed url from the response body', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: { url: 'https://minio/x?sig=1', expiresIn: 300 } }));
    expect(await api.getAttachmentDownloadUrl('u1/general/x.jpg')).toBe('https://minio/x?sig=1');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/upload/download-url?key=u1%2Fgeneral%2Fx.jpg');
  });

  it('returns null on a 403 OBJECT_FORBIDDEN instead of an unopenable placeholder', async () => {
    fetchSpy.mockResolvedValue(reply(403, { success: false, code: 'OBJECT_FORBIDDEN' }));
    expect(await api.getAttachmentDownloadUrl('someone-else/x.jpg')).toBeNull();
  });

  it('never asks for an empty key', async () => {
    expect(await api.getAttachmentDownloadUrl('')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('listAttachments — filtered again on the client, because an old server ignores the filter', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 'a1', filename: 'a.jpg', file_type: 'image/jpeg', file_size: 10,
    storage_key: 'u1/general/a.jpg', file_url: '', entity_id: 'CLM-1', ...over,
  });

  it('keeps only the rows whose entity_id the server echoes back as this claim', async () => {
    // `?entity_id=` is a Phase 94 filter and is NOT deployed. An older server answers with the
    // WHOLE collection, so without this second filter a claim would list another claim's files.
    fetchSpy.mockResolvedValue(reply(200, {
      success: true,
      data: [row({}), row({ id: 'a2', entity_id: 'CLM-9' }), row({ id: 'a3', entity_id: '' })],
    }));
    const rows = await api.listAttachments('CLM-1');
    expect(rows.map((r) => r.id)).toEqual(['a1']);
  });

  it('resolves empty — never throws — when the endpoint is not there', async () => {
    fetchSpy.mockResolvedValue(reply(404, { success: false }));
    expect(await api.listAttachments('CLM-1')).toEqual([]);
  });

  it('drops a row that names no object at all, so nothing renders as an unopenable link', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: [row({ storage_key: '', file_url: '' })] }));
    expect(await api.listAttachments('CLM-1')).toEqual([]);
  });
});
