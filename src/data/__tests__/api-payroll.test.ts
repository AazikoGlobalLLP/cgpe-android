/**
 * The admin payroll roster wire contract, pinned. `getPayrollRoster(year, month)` →
 * `GET /api/payroll/compute?year=&month=` (`contracts/api.md` §`/api/payroll`).
 *
 * WHAT THIS GUARDS. The whole payroll router is admin-only (`routes/payroll.js:22-23` =
 * `authorize('admin')`), so a `leader`/`advisor` token is **403**'d. `tryReal` classifies 403 as
 * an ANSWER, not an outage: the call must return `null` and raise NO banner — otherwise any
 * non-admin who deep-linked to the screen would pin a false outage. A **503** (DB down) IS an
 * outage and must raise the banner. And the screen renders the server's `payable` and never
 * multiplies, so a test pins that the figure is passed through unchanged.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` calls, so the real `req`/`tryReal`/health paths
 * run. `api.ts` holds mutable module state with no reset export, so every test re-imports it
 * (CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A `/compute` RosterRow exactly as `routes/payroll.js:307-316` serialises it (PII omitted). */
const rrow = (over: Record<string, unknown> = {}) => ({
  user_id: 'u-asha', name: 'Asha', staff_found: true, segment: 'day_wise',
  salary_amount: 26000, office_hours: 8.5, payable: 22000,
  months: [{ year: 2026, month: 3, working_days: 26, present_days: 22, worked_hours: 176, per_day_rate: 1000, payable_precise: 22000 }],
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

describe('getPayrollRoster — the request', () => {
  it('GETs /payroll/compute with the given year and month', async () => {
    serve(200, { success: true, data: [rrow()] });
    await api.getPayrollRoster(2026, 3);
    expect(urls()[0]).toContain('/payroll/compute?year=2026&month=3');
  });
});

describe('getPayrollRoster — the envelope', () => {
  it('unwraps { data: RosterRow[] } to the array (tryReal reads json.data)', async () => {
    serve(200, { success: true, data: [rrow(), rrow({ user_id: 'u-ravi', name: 'Ravi' })] });
    const rows = await api.getPayrollRoster(2026, 3);
    expect(rows).toHaveLength(2);
    expect(rows?.[0]).toMatchObject({ user_id: 'u-asha', payable: 22000, staff_found: true });
  });

  it('passes the server payable through verbatim — no on-device arithmetic on the figure', async () => {
    serve(200, { success: true, data: [rrow({ payable: 18333 })] });
    const rows = await api.getPayrollRoster(2026, 3);
    expect(rows?.[0].payable).toBe(18333);
  });

  it('returns [] for a loaded-but-empty roster (no payroll profiles), raising no outage', async () => {
    serve(200, { success: true, data: [] });
    expect(await api.getPayrollRoster(2026, 3)).toEqual([]);
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('getPayrollRoster — access and outages are told apart', () => {
  it('returns null on 403 (a leader hitting the admin gate) and raises NO banner', async () => {
    serve(403, { success: false, message: 'User role leader is not authorized to access this route' });
    expect(await api.getPayrollRoster(2026, 3)).toBeNull();
    const h = health.getHealth();
    expect(h.degraded).toBe(false);
    expect(h.failures).not.toContain('/payroll/compute');
  });

  it('returns null on 503 (DB down) and DOES raise the outage banner under /payroll/compute', async () => {
    serve(503, { success: false, error: 'Database not connected' });
    expect(await api.getPayrollRoster(2026, 3)).toBeNull();
    const h = health.getHealth();
    expect(h.degraded).toBe(true);
    expect(h.failures).toContain('/payroll/compute');
  });

  it('makes no request at all on a demo session', async () => {
    api.setAuthToken('demo-token');
    expect(await api.getPayrollRoster(2026, 3)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
