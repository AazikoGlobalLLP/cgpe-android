/**
 * PHASE 6 — the notice-board search query key, pinned.
 *
 * `getNotes` used to send `/notice-board?search=<term>`. The handler
 * (`cgpe-backend-main/routes/noticeBoard.js:93,102-105`) destructures `q` from the query and
 * applies the text filter on `q` only — it never reads `search`. So every notes search the app
 * ran was silently ignored and the whole board came back unfiltered. The fix is one query key,
 * and the query key IS the contract, so it is what is asserted here.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` uses, so the real `req`/`tryEnvelope` path runs.
 * `api.ts` holds mutable module state with no reset export, so every test re-imports it after
 * `vi.resetModules()` (CLAUDE.md §npm test).
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (body: unknown) => reply(200, body);

/** A well-formed notice-board page, so `getNotes` resolves without the `unavailable()` timer. */
const notesBody = (extra: Record<string, unknown> = {}) => ok({
  success: true,
  data: [],
  total: 0,
  page: 1,
  limit: 30,
  totalPages: 1,
  facets: { categories: [], tags: [], statuses: [] },
  owner: { name: '', phoneLast10: '' },
  ...extra,
});

const sentUrl = (i = 0) => (fetchSpy.mock.calls[i] as [string, RequestInit])[0];

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  api.setAuthToken('test-token');   // a token starting `demo-` would disable all network calls
});
afterEach(() => {
  vi.useRealTimers();
});

describe('getNotes — the search query key', () => {
  it('sends the term as `q`, and no `search` key at all', async () => {
    // THE PHASE 6 BUG: the handler reads `q`, not `search`, so the old key filtered nothing.
    fetchSpy.mockResolvedValue(notesBody());
    await api.getNotes({ search: 'renewal' });
    const url = sentUrl();
    expect(url).toContain('q=renewal');
    expect(url).not.toContain('search=');
  });

  it('URL-encodes a multi-word term under `q`', async () => {
    fetchSpy.mockResolvedValue(notesBody());
    await api.getNotes({ search: 'premium due' });
    expect(sentUrl()).toContain('q=premium%20due');
  });

  it('omits `q` entirely when no search term is given', async () => {
    fetchSpy.mockResolvedValue(notesBody());
    await api.getNotes({});
    const url = sentUrl();
    expect(url).not.toContain('q=');
    expect(url).not.toContain('search=');
  });

  it('still passes a category through unchanged alongside the search', async () => {
    fetchSpy.mockResolvedValue(notesBody());
    await api.getNotes({ search: 'renewal', category: 'reminder' });
    const url = sentUrl();
    expect(url).toContain('q=renewal');
    expect(url).toContain('category=reminder');
  });

  it("drops the sentinel 'all' category rather than sending it", async () => {
    fetchSpy.mockResolvedValue(notesBody());
    await api.getNotes({ search: 'renewal', category: 'all' });
    expect(sentUrl()).not.toContain('category=');
  });
});
