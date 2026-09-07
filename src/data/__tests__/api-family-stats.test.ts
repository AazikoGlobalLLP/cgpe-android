import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let api: typeof import('@/data/api');
let health: typeof import('@/data/health');
const fetchMock = vi.fn();
const counts = { families: 3, multi_person_families: 2, persons: 7, units: 4, review: 1, largest: 4 };

beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('family-stats-test-token');
});
afterEach(() => vi.unstubAllGlobals());

function reply(data: unknown) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data }) });
}

describe('family statistics remain unconfirmed when their counts are malformed', () => {
  it.each([{}, { ...counts, persons: undefined }, { ...counts, families: '3' }, { ...counts, largest: null }])
    ('rejects malformed statistics without supplying zero-valued KPIs: %j', async data => {
      reply(data);
      expect(await api.getFamilyStats()).toBeNull();
      expect(health.getHealth().failures).toContain('/families/stats');
    });

  it('preserves the server figures and legitimate all-zero counts', async () => {
    reply(counts);
    expect(await api.getFamilyStats()).toEqual(counts);
    const empty = Object.fromEntries(Object.keys(counts).map(key => [key, 0]));
    reply(empty);
    expect(await api.getFamilyStats()).toEqual(empty);
    expect(health.getHealth().degraded).toBe(false);
  });

  it('keeps an unavailable statistics response distinct from an empty household book', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ success: false }) });
    expect(await api.getFamilyStats()).toBeNull();
    expect(health.getHealth().degraded).toBe(true);
  });
});
