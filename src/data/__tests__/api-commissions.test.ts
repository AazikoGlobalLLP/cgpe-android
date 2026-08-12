/**
 * The self-scoped earned-commission aggregate, pinned. `getCommissionSummary()` →
 * `GET /api/commissions/my-summary` (`contracts/api.md` §`/api/commissions`, backend Phase 31).
 *
 * WHAT THIS GUARDS. The route is `protect`-only and self-scoped: the backend forces the summary to
 * the token identity, so the app must send NO `?user_id=`/`?advisor_id=` and no query params at all.
 * There is NO `data:null` empty here — an advisor with no commissions gets a 200 with zeros + empty
 * arrays, which is an `ok` the screen renders as its calm "none yet" state. So there are TWO outcomes,
 * told apart by `req()` (not `tryReal`, which would collapse the envelope):
 *   - a 200 object            → `{ status:'ok', summary }`, every ₹ passed through unchanged;
 *   - a 5xx / network / shape → `{ status:'error' }`, banner raised (503) — but a 403/404 answer must not.
 * `tier` is intentionally absent from this endpoint (it lives on `/advisor/performance/:id`), and
 * `target` has no source, so the mapped summary always carries `target:0`.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` calls, so the real `req`/health paths run. `api.ts`
 * holds mutable module state with no reset export, so every test re-imports it (CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A `/my-summary` `data` payload exactly as the backend serialises it (earned aggregate, no tier). */
const csum = (over: Record<string, unknown> = {}) => ({
  thisMonth: 48200, lastMonth: 41000, pending: 12500, ytd: 305000,
  history: [
    { month: 'May', amount: 30000 },
    { month: 'Jun', amount: 41000 },
    { month: 'Jul', amount: 48200 },
  ],
  recent: [
    { id: 'c1', client: 'Asha Patel', plan: 'Term', amount: 8200, date: '2025-07-18T00:00:00.000Z' },
    { id: 'c2', client: 'Ravi Shah', plan: 'Endowment', amount: 5400, date: '2025-07-10T00:00:00.000Z' },
  ],
  ...over,
});

const serve = (status: number, body: unknown) => fetchSpy.mockImplementation(async () => reply(status, body));
const urls = () => fetchSpy.mock.calls.map((c) => String(c[0]));

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT make the session real
});

describe('getCommissionSummary — the request is self-scoped', () => {
  it('GETs /commissions/my-summary and sends NO user_id/advisor_id and no query params', async () => {
    serve(200, { success: true, data: csum() });
    await api.getCommissionSummary();
    expect(urls()[0]).toContain('/commissions/my-summary');
    expect(urls()[0]).not.toContain('user_id');
    expect(urls()[0]).not.toContain('advisor_id');
    expect(urls()[0]).not.toContain('?');
  });
});

describe('getCommissionSummary — the aggregate', () => {
  it('unwraps { data } to { status:"ok", summary } with every earned figure mapped', async () => {
    serve(200, { success: true, data: csum() });
    const r = await api.getCommissionSummary();
    expect(r.status).toBe('ok');
    expect(r).toMatchObject({
      status: 'ok',
      summary: { thisMonth: 48200, lastMonth: 41000, pending: 12500, ytd: 305000 },
    });
  });

  it('passes every ₹ through verbatim — no on-device arithmetic on the figures', async () => {
    serve(200, { success: true, data: csum({ thisMonth: 18333, ytd: 199999 }) });
    const r = await api.getCommissionSummary();
    expect(r.status === 'ok' && r.summary.thisMonth).toBe(18333);
    expect(r.status === 'ok' && r.summary.ytd).toBe(199999);
  });

  it('always sets target:0 — /my-summary carries no target, so it is never invented', async () => {
    serve(200, { success: true, data: csum() });
    const r = await api.getCommissionSummary();
    expect(r.status === 'ok' && r.summary.target).toBe(0);
  });

  it('preserves history order (ascending oldest→newest) and shape', async () => {
    serve(200, { success: true, data: csum() });
    const r = await api.getCommissionSummary();
    expect(r.status === 'ok' && r.summary.history).toEqual([
      { month: 'May', amount: 30000 },
      { month: 'Jun', amount: 41000 },
      { month: 'Jul', amount: 48200 },
    ]);
  });

  it('drops malformed history entries (non-string month, non-finite amount) rather than rendering junk', async () => {
    serve(200, { success: true, data: csum({ history: [
      { month: 'Jun', amount: 41000 },
      { month: 42, amount: 1 },              // bad month
      { month: 'Jul', amount: 'oops' },      // bad amount
      { month: 'Aug', amount: 5000 },
    ] }) });
    const r = await api.getCommissionSummary();
    expect(r.status === 'ok' && r.summary.history).toEqual([
      { month: 'Jun', amount: 41000 },
      { month: 'Aug', amount: 5000 },
    ]);
  });

  it('maps recent rows and fills missing string fields with "" (a bonus/override row has no client_id)', async () => {
    serve(200, { success: true, data: csum({ recent: [
      { id: 'c1', client: 'Asha Patel', plan: 'Term', amount: 8200, date: '2025-07-18T00:00:00.000Z' },
      { amount: 3000, date: '2025-07-01T00:00:00.000Z' },   // contest/override row: no id/client/plan
    ] }) });
    const r = await api.getCommissionSummary();
    expect(r.status === 'ok' && r.summary.recent).toEqual([
      { id: 'c1', client: 'Asha Patel', plan: 'Term', amount: 8200, date: '2025-07-18T00:00:00.000Z' },
      { id: '', client: '', plan: '', amount: 3000, date: '2025-07-01T00:00:00.000Z' },
    ]);
  });

  it('raises no outage banner on a healthy read', async () => {
    serve(200, { success: true, data: csum() });
    await api.getCommissionSummary();
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('getCommissionSummary — 200-zeros is an empty state, not an error', () => {
  it('returns { status:"ok" } with zeros + empty arrays and raises NO banner', async () => {
    serve(200, { success: true, data: { thisMonth: 0, lastMonth: 0, pending: 0, ytd: 0, history: [], recent: [] } });
    const r = await api.getCommissionSummary();
    expect(r.status).toBe('ok');
    expect(r).toMatchObject({ status: 'ok', summary: { thisMonth: 0, lastMonth: 0, pending: 0, ytd: 0, history: [], recent: [] } });
    const h = health.getHealth();
    expect(h.degraded).toBe(false);
    expect(h.failures).not.toContain('/commissions/my-summary');
  });
});

describe('getCommissionSummary — outages and answers are told apart', () => {
  it('returns { status:"error" } on 503 (DB down) and DOES raise the banner under /commissions/my-summary', async () => {
    serve(503, { success: false, error: 'Database not connected' });
    const r = await api.getCommissionSummary();
    expect(r.status).toBe('error');
    const h = health.getHealth();
    expect(h.degraded).toBe(true);
    expect(h.failures).toContain('/commissions/my-summary');
  });

  it('returns { status:"error" } on 403/404 but raises NO banner (an answer, not an outage)', async () => {
    serve(404, { success: false, message: 'Not found' });
    const r = await api.getCommissionSummary();
    expect(r.status).toBe('error');
    const h = health.getHealth();
    expect(h.degraded).toBe(false);
    expect(h.failures).not.toContain('/commissions/my-summary');
  });

  it('returns { status:"error" } and reports a contract fault when the 200 body has no data object', async () => {
    serve(200, { success: true, data: null });   // NOT the empty state — empty is 200-zeros, this is a drift
    const r = await api.getCommissionSummary();
    expect(r.status).toBe('error');
    expect(health.getHealth().failures).toContain('/commissions/my-summary');
  });

  it('returns { status:"error" } and raises the banner when the network throws', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const r = await api.getCommissionSummary();
    expect(r.status).toBe('error');
    expect(health.getHealth().degraded).toBe(true);
  });

  it('makes no request at all on a demo session', async () => {
    api.setAuthToken('demo-token');
    const r = await api.getCommissionSummary();
    expect(r.status).toBe('error');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
