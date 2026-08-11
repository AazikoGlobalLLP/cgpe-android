/**
 * PHASE 6 — the LIC Plans wire contract, pinned.
 *
 * `GET /api/lic-plans` is LIVE (mounted at `cgpe-backend-main/app.js:461`) and answers
 * `{ success:true, data:{ meta, plans } }` (`routes/licPlans.js:62-71`), where each plan is the
 * LEGACY LIC shape produced by `unifiedToLic` (`services/productIngestion.js:142-157`). The old
 * `getLicPlans` validated the unwrapped `{ meta, plans }` object with `isArr`, always missed, and
 * fell through to an empty list AND a false outage. The envelope and the field names ARE the
 * contract, so both are asserted here — a test that fails if either moves.
 *
 * The failure cases resolve through `unavailable()`, which awaits `wait()`; those hold the promise,
 * advance the fake clock 400 ms, then await it (CLAUDE.md §npm test). `api.ts` is re-imported after
 * `vi.resetModules()` so its mutable module state does not leak between tests.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (body: unknown) => reply(200, body);

/** A plan exactly as `unifiedToLic` serialises one over the wire. */
const legacyPlan = (extra: Record<string, unknown> = {}) => ({
  _id: '652f0000000000000000abcd',
  product_id: 'LIC-914',
  company: 'LIC',
  plan_name: 'New Endowment Plan',
  plan_table: '914',
  category: 'endowment_par',
  category_label: 'Endowment (participating)',
  participating: true,
  status: 'active',
  summary: 'Classic savings + life cover; lump sum at maturity with bonuses.',
  benefit_note: '',
  riders: ['Accidental Death & Disability', 'Term Assurance', 'Critical Illness', 'Premium Waiver'],
  ...extra,
});

/** The real GET envelope: plans sit at `data.plans`, beside `data.meta`. */
const licBody = (plans: unknown[], meta: unknown = { categories: [] }) =>
  ok({ success: true, data: { meta, plans } });

const sentUrl = (i = 0) => (fetchSpy.mock.calls[i] as [string, RequestInit])[0];

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');   // a token starting `demo-` would disable all network calls
});
afterEach(() => {
  vi.useRealTimers();
});

describe('getLicPlans — request + envelope', () => {
  it('reads GET /lic-plans', async () => {
    fetchSpy.mockResolvedValue(licBody([]));
    await api.getLicPlans();
    expect(sentUrl().endsWith('/lic-plans')).toBe(true);
  });

  it('unwraps data.plans and returns one LicPlan per row', async () => {
    fetchSpy.mockResolvedValue(licBody([legacyPlan(), legacyPlan({ product_id: 'LIC-936', plan_name: 'Jeevan Labh', plan_table: '936' })]));
    const plans = await api.getLicPlans();
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => p.name)).toEqual(['New Endowment Plan', 'Jeevan Labh']);
  });

  it('maps the legacy field names onto the app shape', async () => {
    fetchSpy.mockResolvedValue(licBody([legacyPlan()]));
    const [p] = await api.getLicPlans();
    expect(p.id).toBe('LIC-914');
    expect(p.name).toBe('New Endowment Plan');
    expect(p.code).toBe('914');
    expect(p.type).toBe('Endowment (participating)');
    expect(p.highlight).toContain('Classic savings');
    expect(p.tags).toEqual(['Accidental Death & Disability', 'Term Assurance', 'Critical Illness', 'Premium Waiver']);
    expect(p.minAge).toBe(0);
    expect(p.maxAge).toBe(0);
    expect(p.term).toBe('');
  });

  it('a live 200 reports NO outage', async () => {
    fetchSpy.mockResolvedValue(licBody([legacyPlan()]));
    await api.getLicPlans();
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('getLicPlans — failure classification', () => {
  it('a 500 resolves empty AND raises the outage banner', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false, message: 'boom' }));
    const promise = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(400);   // unavailable() → wait()
    expect(await promise).toEqual([]);
    expect(health.getHealth().degraded).toBe(true);
    expect(health.getHealth().failures).toEqual(['/lic-plans']);
  });

  it('a 404 resolves empty and stays QUIET — a missing route is an answer, not an outage', async () => {
    fetchSpy.mockResolvedValue(reply(404, { success: false, message: 'Not found' }));
    const promise = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(400);
    expect(await promise).toEqual([]);
    expect(health.getHealth().degraded).toBe(false);
  });

  it('a 200 whose body carries no plans array is a contract fault, so it IS reported', async () => {
    // The server answered, but with something the screen cannot render — the exact "unlabelled
    // zero" case the health channel exists to prevent (api.ts tryReal doc).
    fetchSpy.mockResolvedValue(ok({ success: true, data: { meta: {} } }));
    const promise = api.getLicPlans();
    await vi.advanceTimersByTimeAsync(400);
    expect(await promise).toEqual([]);
    expect(health.getHealth().degraded).toBe(true);
    expect(health.getHealth().failures).toEqual(['/lic-plans']);
  });
});
