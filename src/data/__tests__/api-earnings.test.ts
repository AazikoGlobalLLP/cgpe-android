/**
 * The self-scoped "my earnings" wire contract, pinned. `getMyEarnings(month)` →
 * `GET /api/payroll/my-earnings?month=YYYY-MM` (`contracts/api.md` §`/api/payroll`, Phase 28).
 *
 * WHAT THIS GUARDS. The route is `protect`-only and self-scoped: the backend forces `user_id` to the
 * token, so the app must send NO `?user_id=`. The response `data` is `RosterRow | null`, and the THREE
 * outcomes must stay distinct — which is why the call uses `req()` and not `tryReal` (`json?.data ?? json`
 * would turn a `data:null` body into the whole envelope):
 *   - a real row               → `{ status:'ok', row }`, the server `payable` passed through unchanged;
 *   - HTTP 200 with data:null  → `{ status:'empty' }`, an explicit "no profile" state, NO banner;
 *   - a 5xx / network / shape  → `{ status:'error' }`, banner raised (503) — but a 403/404 answer must not.
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

/** A `/my-earnings` RosterRow exactly as the shared `publicRow` projection serialises it (PII omitted). */
const rrow = (over: Record<string, unknown> = {}) => ({
  user_id: 'u-me', name: 'Me', staff_found: true, segment: 'day_wise',
  salary_amount: 27000, office_hours: 8.5, payable: 24545,
  months: [{ year: 2025, month: 10, working_days: 22, present_days: 20, worked_hours: 170, per_day_rate: 1227.27, payable_precise: 24545.45 }],
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

describe('getMyEarnings — the request is self-scoped', () => {
  it('GETs /payroll/my-earnings with the given month and sends NO user_id (the server forces it)', async () => {
    serve(200, { success: true, data: rrow() });
    await api.getMyEarnings('2025-10');
    expect(urls()[0]).toContain('/payroll/my-earnings?month=2025-10');
    expect(urls()[0]).not.toContain('user_id');
  });
});

describe('getMyEarnings — the row', () => {
  it('unwraps { data: RosterRow } to { status:"ok", row }', async () => {
    serve(200, { success: true, data: rrow() });
    const r = await api.getMyEarnings('2025-10');
    expect(r.status).toBe('ok');
    expect(r).toMatchObject({ status: 'ok', row: { user_id: 'u-me', payable: 24545, staff_found: true } });
  });

  it('passes the server payable through verbatim — no on-device arithmetic on the figure', async () => {
    serve(200, { success: true, data: rrow({ payable: 18333 }) });
    const r = await api.getMyEarnings('2025-10');
    expect(r.status === 'ok' && r.row.payable).toBe(18333);
  });

  it('raises no outage banner on a healthy read', async () => {
    serve(200, { success: true, data: rrow() });
    await api.getMyEarnings('2025-10');
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('getMyEarnings — data:null is an empty state, not an error', () => {
  it('returns { status:"empty" } on a 200 with data:null and raises NO banner', async () => {
    serve(200, { success: true, data: null, message: 'No payroll profile configured for your account.' });
    const r = await api.getMyEarnings('2025-10');
    expect(r.status).toBe('empty');
    const h = health.getHealth();
    expect(h.degraded).toBe(false);
    expect(h.failures).not.toContain('/payroll/my-earnings');
  });
});

describe('getMyEarnings — outages and answers are told apart', () => {
  it('returns { status:"error" } on 503 (DB down) and DOES raise the banner under /payroll/my-earnings', async () => {
    serve(503, { success: false, error: 'Database not connected' });
    const r = await api.getMyEarnings('2025-10');
    expect(r.status).toBe('error');
    const h = health.getHealth();
    expect(h.degraded).toBe(true);
    expect(h.failures).toContain('/payroll/my-earnings');
  });

  it('returns { status:"error" } on 403/404 but raises NO banner (an answer, not an outage)', async () => {
    serve(404, { success: false, message: 'Not found' });
    const r = await api.getMyEarnings('2025-10');
    expect(r.status).toBe('error');
    const h = health.getHealth();
    expect(h.degraded).toBe(false);
    expect(h.failures).not.toContain('/payroll/my-earnings');
  });

  it('returns { status:"error" } and reports a contract fault when the 200 body has no months array', async () => {
    serve(200, { success: true, data: { user_id: 'u-me', payable: 24545 } });   // shape drifted — no months
    const r = await api.getMyEarnings('2025-10');
    expect(r.status).toBe('error');
    expect(health.getHealth().failures).toContain('/payroll/my-earnings');
  });

  it('returns { status:"error" } and raises the banner when the network throws', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const r = await api.getMyEarnings('2025-10');
    expect(r.status).toBe('error');
    expect(health.getHealth().degraded).toBe(true);
  });

  it('makes no request at all on a demo session', async () => {
    api.setAuthToken('demo-token');
    const r = await api.getMyEarnings('2025-10');
    expect(r.status).toBe('error');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
