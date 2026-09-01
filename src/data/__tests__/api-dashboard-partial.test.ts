/**
 * `getDashboardOverview` — the server's own "this number is not real" signal.
 *
 * Backend Phase 110 (D-140) replaced `.catch(() => [])` on the overview's source reads with a
 * `softRead` that records which collection failed. A degraded answer is still HTTP 200 and still a
 * well-formed body; the only difference is `partial:true` and `degraded:[…]` inside `data`, with the
 * affected KPIs zeroed. Nothing else in the app can detect that: the status is fine, `isObj` passes,
 * and `req()` has already called `reportSuccess` for the endpoint.
 *
 * So these pin the one thing that keeps the master dashboard honest — a partial answer raises the
 * banner, a healthy one does not, and a build that predates the field is unaffected.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` owns; the module is re-imported per test because
 * `api.ts` holds un-resettable module state (`sessionReal`, `authToken`) — CLAUDE.md test rule.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const KEY = '/dashboard/overview';
const COUNTS = { clients: { total: 4994 }, claims: { total: 0 }, tickets: { total: 12 } };

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token'); // a real (non-demo) session, so the call actually reaches fetch
});

describe('getDashboardOverview — partial answers', () => {
  it('a healthy answer leaves health clean', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { ...COUNTS, partial: false } }));

    const d = await api.getDashboardOverview();

    expect(d).toBeTruthy();
    expect(health.getHealth().degraded).toBe(false);
    expect(health.getHealth().failures).not.toContain(KEY);
  });

  it('a partial answer STILL returns the data, and raises the banner for it', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, {
      success: true,
      data: { ...COUNTS, partial: true, degraded: ['claims'] },
    }));

    const d = await api.getDashboardOverview();

    // The body is usable and is not thrown away — the clients count really is 4,994. Only the
    // claims zero is untrustworthy, and the banner is what says so.
    expect(d.clients.total).toBe(4994);
    expect(d.degraded).toEqual(['claims']);
    expect(health.getHealth().degraded).toBe(true);
    expect(health.getHealth().failures).toContain(KEY);
    expect(health.getHealth().kind).toBe('server'); // the collection read failed, not the transport
  });

  it('a body with no `partial` field at all is treated as healthy (pre-Phase-110 servers)', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: COUNTS }));

    await api.getDashboardOverview();

    expect(health.getHealth().degraded).toBe(false);
  });

  it('does not confuse a FALSY-but-present partial with a missing one', async () => {
    // `partial` is a boolean on the wire. Anything other than a literal `true` must not raise the
    // banner, or every healthy poll would flag an outage.
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { ...COUNTS, partial: 0 } }));

    await api.getDashboardOverview();

    expect(health.getHealth().degraded).toBe(false);
  });
});
