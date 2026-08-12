/**
 * The MDRT tier-progress wire contract, pinned. `getMdrtTier(advisorId)` →
 * `GET /api/advisor/performance/:advisorId` (`contracts/api.md` §`/api/advisor`, backend Phase 29).
 *
 * WHAT THIS GUARDS. The tier ladder is server-authoritative (`utils/mdrtTiers.js`) and read from
 * `data.performance.{ total_premium, mdrt_tier:{ current, next, next_premium, to_next } }`. The call
 * uses `req()` (not `tryReal`) so the TWO outcomes stay distinct and a shape miss is REPORTED:
 *   - a valid tier            → `{ status:'ok', tier }`, every ₹ passed through unchanged;
 *   - a 5xx / network / shape → `{ status:'error' }`, banner raised under a STABLE `/advisor/performance/:id`
 *                               key — but a 403/404 answer (a leader/denied read) must NOT raise it.
 * The id is a PATH param and self-scope is the caller's responsibility, so NO `?user_id=` is ever sent.
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

const HEALTH_KEY = '/advisor/performance/:id';

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A `/performance/:advisorId` body exactly as `routes/advisor.js` serialises it. */
const body = (mdrt_tier: Record<string, unknown>, total_premium: number) => ({
  success: true,
  data: {
    advisor_id: 'u-me', advisor_name: 'Me', advisor_email: '', period: 'all',
    performance: {
      policies_count: 3, total_premium, category: 'Grow',
      category_details: { groom: false, grow: true, mdrt: false },
      mdrt_tier,
    },
    progression: { current_level: 'Grow', next_level: 'MDRT', requirements: {} },
  },
});

const serve = (status: number, b: unknown) => fetchSpy.mockImplementation(async () => reply(status, b));
const urls = () => fetchSpy.mock.calls.map((c) => String(c[0]));

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT make the session real
});

describe('getMdrtTier — the request is a self-read by path, no user_id', () => {
  it('GETs /advisor/performance/<id> and sends NO user_id query', async () => {
    serve(200, body({ current: 'Quarter MDRT', next: 'Half MDRT', next_premium: 750000, to_next: 250000 }, 500000));
    await api.getMdrtTier('u-me');
    expect(urls()[0]).toContain('/advisor/performance/u-me');
    expect(urls()[0]).not.toContain('user_id');
  });

  it('makes no request at all on a demo session', async () => {
    api.setAuthToken('demo-token');
    const r = await api.getMdrtTier('u-me');
    expect(r.status).toBe('error');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('makes no request and errors when no advisorId is given', async () => {
    const r = await api.getMdrtTier('');
    expect(r.status).toBe('error');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('getMdrtTier — the tier, normalised and verbatim', () => {
  it('maps performance.mdrt_tier + total_premium to the app shape', async () => {
    serve(200, body({ current: 'Quarter MDRT', next: 'Half MDRT', next_premium: 750000, to_next: 250000 }, 500000));
    const r = await api.getMdrtTier('u-me');
    expect(r.status).toBe('ok');
    expect(r).toMatchObject({
      status: 'ok',
      tier: { current: 'Quarter MDRT', next: 'Half MDRT', nextPremium: 750000, toNext: 250000, totalPremium: 500000 },
    });
  });

  it('passes every rupee figure through verbatim — no on-device arithmetic', async () => {
    serve(200, body({ current: 'MDRT', next: 'Double MDRT', next_premium: 3000000, to_next: 1234567 }, 1765433));
    const r = await api.getMdrtTier('u-me');
    expect(r.status === 'ok' && r.tier.toNext).toBe(1234567);
    expect(r.status === 'ok' && r.tier.totalPremium).toBe(1765433);
  });

  it('below the first tier: current null, next Quarter MDRT, zero premium', async () => {
    serve(200, body({ current: null, next: 'Quarter MDRT', next_premium: 375000, to_next: 375000 }, 0));
    const r = await api.getMdrtTier('u-me');
    expect(r).toMatchObject({ status: 'ok', tier: { current: null, next: 'Quarter MDRT', nextPremium: 375000, toNext: 375000, totalPremium: 0 } });
  });

  it('at TOT (the top): next and next_premium are null, to_next 0', async () => {
    serve(200, body({ current: 'TOT', next: null, next_premium: null, to_next: 0 }, 9500000));
    const r = await api.getMdrtTier('u-me');
    expect(r).toMatchObject({ status: 'ok', tier: { current: 'TOT', next: null, nextPremium: null, toNext: 0, totalPremium: 9500000 } });
  });

  it('raises no outage banner on a healthy read', async () => {
    serve(200, body({ current: 'Quarter MDRT', next: 'Half MDRT', next_premium: 750000, to_next: 250000 }, 500000));
    await api.getMdrtTier('u-me');
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('getMdrtTier — outages and answers are told apart', () => {
  it('returns error and RAISES the banner on 500 (a real fault)', async () => {
    serve(500, { success: false, message: 'Failed to get advisor performance' });
    const r = await api.getMdrtTier('u-me');
    expect(r.status).toBe('error');
    const h = health.getHealth();
    expect(h.degraded).toBe(true);
    expect(h.failures).toContain(HEALTH_KEY);
  });

  it('returns error but raises NO banner on 403 (leader/denied — an answer, not an outage)', async () => {
    serve(403, { success: false, message: 'Access denied' });
    const r = await api.getMdrtTier('u-me');
    expect(r.status).toBe('error');
    const h = health.getHealth();
    expect(h.degraded).toBe(false);
    expect(h.failures).not.toContain(HEALTH_KEY);
  });

  it('returns error and reports a contract fault when the 200 body has no performance', async () => {
    serve(200, { success: true, data: { advisor_id: 'u-me' } });   // shape drifted
    const r = await api.getMdrtTier('u-me');
    expect(r.status).toBe('error');
    expect(health.getHealth().failures).toContain(HEALTH_KEY);
  });

  it('returns error and reports when mdrt_tier is missing from performance', async () => {
    serve(200, { success: true, data: { performance: { total_premium: 500000 } } });
    const r = await api.getMdrtTier('u-me');
    expect(r.status).toBe('error');
    expect(health.getHealth().failures).toContain(HEALTH_KEY);
  });

  it('returns error and raises the banner when the network throws', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const r = await api.getMdrtTier('u-me');
    expect(r.status).toBe('error');
    expect(health.getHealth().degraded).toBe(true);
  });
});
