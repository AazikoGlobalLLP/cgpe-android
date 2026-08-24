/**
 * E2 (2026-08-24) — the client/family report wire contract, pinned.
 *
 * `generateReport` POSTs to `/api/clients/generate-report` and, unlike a plain `tryReal`, reads the
 * server's OWN status so the screen can name the actual cause. Every expectation here is quoted from
 * the real handler `cgpe-backend-main/routes/clients.js:310-363`:
 *
 *   POST /api/clients/generate-report   body { clientName }
 *     200:  { success, data: { ok, reportId, viewUrl, pdfUrl, familyHead, summary } }
 *     503:  { success:false, not_configured:true, error }   ← n8n render webhook unset (the E2 cause)
 *     502:  { success:false, error }                        ← n8n unreachable
 *     422:  { success:false, error }                        ← no report could be built for the seed
 *     400:  { success:false, error }                        ← missing seed
 *
 * WHY THIS FILE EXISTS. The owner's "no report generates anywhere" (docs/OWNER-BACKLOG §E2) is almost
 * certainly a server that has the render webhook switched off — a 503 not_configured. The old
 * `generateReport` collapsed every non-2xx to `null`, so the app could only ever say "the service did
 * not answer", which reads like an app bug. The status IS the difference between "ask your admin to
 * enable reports" and "try again in a moment", so the status is what is asserted — and that a
 * not_configured / no-data answer is NOT treated as an outage (no health banner).
 *
 * FETCH IS STUBBED at the one boundary `api.ts` calls, exercising the real `req` / health path.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (body: unknown) => reply(200, body);

/** The 200 envelope as the handler builds it (`routes/clients.js:348-358`). */
const okReport = (extra: Record<string, unknown> = {}) =>
  ok({
    success: true,
    data: { ok: true, reportId: 'RPT-1', viewUrl: 'https://cgpe.in/r/RPT-1', pdfUrl: 'https://cgpe.in/r/RPT-1?pdf=1', familyHead: 'Asha Patel', summary: { total_policies: 3 }, ...extra },
  });

const sent = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  return { url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');
});
afterEach(() => {
  vi.useRealTimers();
});

describe('generateReport — the request', () => {
  it('POSTs the clientName to /clients/generate-report', async () => {
    fetchSpy.mockResolvedValue(okReport());
    await api.generateReport('Asha Patel');
    expect(sent().url.endsWith('/clients/generate-report')).toBe(true);
    expect(sent().init.method).toBe('POST');
    expect(sent().body).toEqual({ clientName: 'Asha Patel' });
  });
});

describe('generateReport — a report was built', () => {
  it('unwraps the envelope and carries the view/pdf urls the sheet opens', async () => {
    fetchSpy.mockResolvedValue(okReport());
    const r = await api.generateReport('Asha Patel');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.viewUrl).toBe('https://cgpe.in/r/RPT-1');
    expect(r.pdfUrl).toBe('https://cgpe.in/r/RPT-1?pdf=1');
    expect(r.familyHead).toBe('Asha Patel');
    expect(r.reportId).toBe('RPT-1');
  });

  it('a 200 with neither url nor id is NOT a report — it is a contract fault, reported once', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { ok: true } }));
    const r = await api.generateReport('Asha Patel');
    expect(r).toEqual({ ok: false, reason: 'no_data' });
    expect(health.getHealth().failures).toEqual(['/clients/generate-report']);
  });
});

describe('generateReport — why it could not be built', () => {
  it('503 not_configured is a permanent OPS gap, and NOT an outage', async () => {
    // The E2 cause: no n8n render webhook wired. Retrying can never help, and nothing is "down".
    fetchSpy.mockResolvedValue(reply(503, { success: false, not_configured: true, error: 'Report generation is not configured on this server.' }));
    const r = await api.generateReport('Asha Patel');
    expect(r).toEqual({ ok: false, reason: 'not_configured' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('a bare 503 without the flag is treated as a real outage, not a config gap', async () => {
    // A DB-down 503 (respondDbError elsewhere) carries no not_configured flag — that IS an outage.
    fetchSpy.mockResolvedValue(reply(503, { success: false, error: 'db down' }));
    const r = await api.generateReport('Asha Patel');
    expect(r).toEqual({ ok: false, reason: 'unavailable' });
    expect(health.getHealth().degraded).toBe(true);
  });

  it('422 (no report for this seed) is a considered answer, not an outage', async () => {
    fetchSpy.mockResolvedValue(reply(422, { success: false, error: 'No report could be generated. Check the name.' }));
    const r = await api.generateReport('Nobody');
    expect(r).toEqual({ ok: false, reason: 'no_data' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('400 (missing seed) is a considered answer too', async () => {
    fetchSpy.mockResolvedValue(reply(400, { success: false, error: 'A name is required.' }));
    const r = await api.generateReport('');
    expect(r).toEqual({ ok: false, reason: 'no_data' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('502 (n8n unreachable) is an outage', async () => {
    fetchSpy.mockResolvedValue(reply(502, { success: false, error: 'The report service is unavailable right now.' }));
    const r = await api.generateReport('Asha Patel');
    expect(r).toEqual({ ok: false, reason: 'unavailable' });
    expect(health.getHealth().degraded).toBe(true);
  });

  it('a dead network is an outage (a POST is not retried)', async () => {
    fetchSpy.mockRejectedValue(new Error('Network request failed'));
    const r = await api.generateReport('Asha Patel');
    expect(r).toEqual({ ok: false, reason: 'unavailable' });
    expect(health.getHealth().degraded).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);   // no retry on a write
  });
});
