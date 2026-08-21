/**
 * PHASE 2 — `scanRenewals` date rollover pinned.
 *
 * This is the audience builder for every renewal campaign: it walks the real client book and
 * decides whose premium falls due inside the next N days. It re-projects each stored `fupDate`
 * onto the current year, which is where all the interesting behaviour lives — leap days,
 * month ends, and the year boundary.
 *
 * SPLIT OUT FROM api-geo.test.ts ON PURPOSE. This file installs a fetch stub; that one asserts
 * fetch is never called. Keeping them together would let a stub meant for renewals silently
 * satisfy a geofence request that should not be happening.
 *
 * EVERY expected timestamp is built with the same local-time `new Date(y, m, d)` the code uses
 * (api.ts:663-664, :673), never written as a UTC literal — so nothing here depends on the
 * machine's timezone. Fixture dates use the 'YYYY-MM-DDTHH:mm:ss' form, which ECMAScript parses
 * as LOCAL time; the date-only form would be parsed as UTC and shift by a day west of Greenwich.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

/** Shape of what `req()` needs back from fetch: ok, status and a json() thenable. */
const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const onePage = (rows: unknown[]) => okJson({ data: rows, totalPages: 1 });

/** A client row as the lic-import collection actually stores one. */
const row = (extra: Record<string, unknown>) => ({ _id: 'r1', mobile: '9876543210', ...extra });

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
});
afterEach(() => {
  vi.useRealTimers();
});

/** Put the module into "real session" mode. A token starting `demo-` would NOT do this. */
function signIn() {
  api.setAuthToken('test-token');
}

describe('scanRenewals — the demo branch', () => {
  it('resolves [] without a network call when there is no real session', async () => {
    // api.ts:644 takes a COMPLETELY different algorithm that ignores `days` and `maxPages` and
    // reads `state.clients` — the write buffer, which starts empty and is never seeded.
    const promise = api.scanRenewals(30);
    await vi.advanceTimersByTimeAsync(400); // api.ts:645 wait(400)
    expect(await promise).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('scanRenewals — date rollover', () => {
  beforeEach(signIn);

  it('rolls a 1 January anchor forward when today is 31 December', async () => {
    vi.setSystemTime(new Date(2026, 11, 31, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([row({ fupDate: '2020-01-01T00:00:00' })]));

    expect(await api.scanRenewals(30)).toEqual([{
      id: 'r1',
      name: 'Customer',
      phone: '+919876543210',
      premium: 0,
      policyNo: '',
      dueDate: new Date(2027, 0, 1).toISOString(),   // next year, 1 day away — not 364
    }]);
  });

  it('silently shifts a 29 February anchor to 1 March in a non-leap year', async () => {
    // `new Date(2026, 1, 29)` does not throw — JS overflow-normalises it. A leap-day
    // policyholder is contacted a day later than their anchor says.
    vi.setSystemTime(new Date(2026, 1, 20, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([row({ fupDate: '2020-02-29T00:00:00' })]));

    const out = await api.scanRenewals(30);
    expect(out).toHaveLength(1);
    expect(out[0].dueDate).toBe(new Date(2026, 2, 1).toISOString());
  });

  it('includes a 31 January anchor while the month end is still ahead', async () => {
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([row({ fupDate: '2020-01-31T00:00:00' })]));

    const out = await api.scanRenewals(30);
    expect(out).toHaveLength(1);
    expect(out[0].dueDate).toBe(new Date(2026, 0, 31).toISOString());
  });

  it('includes a renewal due TODAY, because the roll-forward test is strict less-than', async () => {
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([row({ fupDate: '2019-08-10T00:00:00' })]));

    const out = await api.scanRenewals(30);
    expect(out).toHaveLength(1);
    expect(out[0].dueDate).toBe(new Date(2026, 7, 10).toISOString());
  });

  it('is inclusive at exactly `days` and excludes days + 1', async () => {
    // Both halves are needed: either alone would survive an off-by-one at api.ts:666.
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));

    fetchSpy.mockResolvedValue(onePage([row({ fupDate: '2019-09-09T00:00:00' })])); // diff 30
    expect(await api.scanRenewals(30)).toHaveLength(1);

    vi.resetModules();
    api = await import('@/data/api');
    signIn();
    fetchSpy.mockResolvedValue(onePage([row({ fupDate: '2019-09-10T00:00:00' })])); // diff 31
    expect(await api.scanRenewals(30)).toEqual([]);
  });
});

describe('scanRenewals — pinned known behaviour worth arguing about', () => {
  beforeEach(signIn);

  it('drops a renewal that lapsed YESTERDAY by pushing it a full year out', async () => {
    // 31 Jan 2026 is in the past on 1 Feb, so it rolls to 31 Jan 2027 and diff becomes 364.
    // Whether that is a bug is a product question; this pins what the code does today.
    vi.setSystemTime(new Date(2026, 1, 1, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([row({ fupDate: '2020-01-31T00:00:00' })]));
    expect(await api.scanRenewals(30)).toEqual([]);
  });

  it('can never report an OVERDUE premium, only upcoming ones', async () => {
    // The `diff >= 0` guard at api.ts:666. A premium that went unpaid in March is invisible
    // to the renewal scan for the rest of the year.
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([row({ fupDate: '2020-03-15T00:00:00' })]));
    expect(await api.scanRenewals(30)).toEqual([]);
  });

  it('silently drops a genuinely-due client that has no phone digits', async () => {
    // api.ts:667-668 `if (!digits) continue` runs AFTER the window test, so the row is
    // excluded with no user-visible signal that anyone was skipped.
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([{ _id: 'r7', fupDate: '2019-08-15T00:00:00' }]));
    expect(await api.scanRenewals(30)).toEqual([]);
  });

  it('prefixes a bare "+" on anything that is not exactly 10 digits', async () => {
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([
      { _id: 'a', fupDate: '2019-08-15T00:00:00', mobile: '919876543210' },
      { _id: 'b', fupDate: '2019-08-15T00:00:00', mobile: '12345' },
    ]));
    const out = await api.scanRenewals(30);
    expect(out.map((r) => r.phone)).toEqual(['+919876543210', '+12345']);
  });

  it('gives a row with neither _id nor id the literal string "undefined" as its id', async () => {
    // Same family as adaptLead / adaptClaim / adaptReminder / adaptNotification.
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([{ fupDate: '2019-08-15T00:00:00', mobile: '9876543210' }]));
    expect((await api.scanRenewals(30))[0].id).toBe('undefined');
  });

  it('DISCARDS a real zero premium, the exact opposite of adaptClient', async () => {
    // api.ts:672 is `Number(raw.premium || raw.premium_amount) || 0` — a plain ||. adaptClient
    // (adapt.ts:76) uses `!= null` and keeps the zero. Pinning both sides documents the
    // inconsistency rather than letting someone "unify" them without noticing.
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([
      row({ fupDate: '2019-08-15T00:00:00', premium: 0, premium_amount: 4500 }),
    ]));
    expect((await api.scanRenewals(30))[0].premium).toBe(4500);
  });

  it('returns [] on a failed first page and DOES raise the health banner', async () => {
    // UPDATED DELIBERATELY BY PHASE 3 — this assertion was `toBe(false)` and was written to
    // go red exactly here. It pinned the finding that scanRenewals swallowed a failed page,
    // so an outage-shortened renewal audience read as "nobody is due". Since this list is
    // what decides who gets contacted about a lapsing policy, a silently short one costs
    // real renewals. api.ts now reports the skipped page under the `/clients` key.
    //
    // Note the key: scanRenewals pages `/clients?limit=…`, and `unavailable('/clients', …)`
    // and getClientsPage use the same `/clients` key, so one broken client book produces ONE
    // banner entry rather than three.
    health.resetHealth();
    fetchSpy.mockRejectedValue(new Error('network down'));

    // Phase 55: the first-page GET is now retried once (a backoff wait, then a 2nd attempt) before
    // it gives up, so hold the promise and advance timers past the backoff rather than awaiting it
    // directly, and expect 2 network calls for the ONE page (the loop still ends — totalPages is 1).
    const p = api.scanRenewals(30);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);   // one page attempted, but a failed GET retries once
    expect(health.getHealth().degraded).toBe(true);
    expect(health.getHealth().failures).toEqual(['/clients']);
  });
});

describe('scanRenewals — paging and progress', () => {
  beforeEach(signIn);

  it('reports an ESTIMATED total of totalPages x 100, once per page', async () => {
    // api.ts:678 passes `totalPages * CLIENT_PAGE`, NOT a real row count, so the progress
    // denominator over-reports on any partial last page.
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    fetchSpy
      .mockResolvedValueOnce(okJson({ data: [row({ _id: 'p1', fupDate: '2019-08-15T00:00:00' })], totalPages: 2 }))
      .mockResolvedValueOnce(okJson({ data: [row({ _id: 'p2', fupDate: '2019-08-16T00:00:00' })], totalPages: 2 }));

    const calls: number[][] = [];
    const out = await api.scanRenewals(30, (scanned, found, total) => calls.push([scanned, found, total]));

    expect(out).toHaveLength(2);
    expect(calls).toEqual([[1, 1, 200], [2, 2, 200]]);
  });

  it('stops at maxPages even when the server claims there are more', async () => {
    // api.ts:680. The production default is 95 pages = 9,500 clients, after which a PARTIAL
    // list is returned with no truncation signal at all.
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    fetchSpy.mockResolvedValue(okJson({ data: [], totalPages: 500 }));

    expect(await api.scanRenewals(30, undefined, 3)).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('CIRCUIT BREAKER: stops after 2 consecutive failed pages instead of grinding every page (audit #8)', async () => {
    // Page 1 succeeds and claims 10 pages; the network then dies. Without the breaker the loop would
    // walk pages 2..10, each hanging the full timeout+retry (~25s) — >30 min of frozen progress that
    // blocks the campaign queued behind it. The breaker must stop after the 2nd consecutive failure.
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    health.resetHealth();
    fetchSpy
      .mockResolvedValueOnce(okJson({ data: [row({ _id: 'p1', fupDate: '2019-08-15T00:00:00' })], totalPages: 10 }))
      .mockRejectedValue(new Error('network down'));   // every page from 2 onward throws

    const p = api.scanRenewals(30);
    await vi.advanceTimersByTimeAsync(5000);            // past both retry backoffs (600ms each)
    const out = await p;

    expect(out).toHaveLength(1);                        // the PARTIAL result from page 1 is returned
    expect(out[0].id).toBe('p1');
    // page1 (1 ok) + page2 (throw + 1 retry = 2) + page3 (throw + 1 retry = 2) = 5, then BREAK.
    // Pages 4..10 are never fetched — that is the whole point.
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(health.getHealth().degraded).toBe(true);
  });

  it('requests the paginated client book with scope=all', async () => {
    // Asserted on the PATH SUFFIX only. The full URL depends on API_BASE_URL, which is chosen
    // from Platform.OS — and Platform comes from a test stub, so asserting the whole string
    // would be asserting on the stub's choice rather than on this function.
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    fetchSpy.mockResolvedValue(onePage([]));

    await api.scanRenewals(30);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/clients?limit=100&page=1&scope=all');
  });
});
