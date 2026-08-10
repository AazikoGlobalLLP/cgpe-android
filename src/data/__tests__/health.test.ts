/**
 * PHASE 3 — the data-health honesty channel.
 *
 * WHAT THIS FILE IS FOR. The app's single most important promise to a field agent is that an
 * empty screen means "you have none", never "we could not load it". That promise is kept by
 * exactly three moving parts, none of which had a single test before this file:
 *
 *   1. `data/health.ts` — the failure ledger and the `degraded` flag 31 screens read.
 *   2. `tryReal` / `tryEnvelope` — which now decide WHETHER a failure is an outage at all.
 *   3. `unavailable()` — which must not contradict that decision.
 *
 * SPLIT FROM api-renewals.test.ts AND api-geo.test.ts ON PURPOSE, for the reason already
 * written at the top of those two: this file stubs `fetch` with failures, and letting a stub
 * meant for an outage satisfy a request that should never happen is how a test passes for the
 * wrong reason.
 *
 * FAKE TIMERS THROUGHOUT because `unavailable()` awaits `wait()` (MOCK_LATENCY, 260 ms) before
 * resolving. Every api-level case below advances the clock explicitly rather than waiting.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

/** Shape of what `req()` needs back from fetch. */
const res = (status: number, body: unknown = null) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  // Both modules are re-imported together. Importing only one leaves the test's binding
  // pointing at a different singleton than the code under test reports into.
  api = await import('@/data/api');
  health = await import('@/data/health');
});
afterEach(() => {
  vi.useRealTimers();
});

const signIn = () => api.setAuthToken('test-token');

/** Run a promise that is gated behind `unavailable()`'s wait, without waiting for real. */
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(2000);
  return p;
}

/* ================================================================== *
 * 1. The ledger itself — pure, no network
 * ================================================================== */

describe('health.ts — the failure ledger', () => {
  it('clears ONLY the endpoint that succeeded, and leaves the rest degraded', async () => {
    // THE PHASE 3 FIX. reportSuccess() used to take no argument and assign `failures: []`,
    // so any success anywhere wiped every recorded failure.
    health.reportFailure('/a');
    health.reportFailure('/b');
    expect(health.getHealth().failures).toEqual(['/a', '/b']);

    health.reportSuccess('/a');

    expect(health.getHealth().failures).toEqual(['/b']);
    expect(health.getHealth().degraded).toBe(true);
  });

  it('leaves degraded false once the last outstanding failure recovers', async () => {
    health.reportFailure('/a');
    health.reportSuccess('/a');
    expect(health.getHealth()).toMatchObject({ degraded: false, failures: [] });
  });

  it('keeps degraded exactly equal to failures.length > 0 through every transition', async () => {
    const inSync = () => health.getHealth().degraded === (health.getHealth().failures.length > 0);
    expect(inSync()).toBe(true);
    health.reportFailure('/a'); expect(inSync()).toBe(true);
    health.reportFailure('/b'); expect(inSync()).toBe(true);
    health.reportSuccess('/a'); expect(inSync()).toBe(true);
    health.reportSuccess('/b'); expect(inSync()).toBe(true);
  });

  it('ignores a success for an endpoint that never failed, without emitting', async () => {
    health.reportFailure('/a');
    let emissions = 0;
    const stop = health.subscribeHealth(() => { emissions += 1; });
    health.reportSuccess('/never-failed');
    stop();
    expect(emissions).toBe(0);
    expect(health.getHealth().failures).toEqual(['/a']);
  });

  it('does NOT move `at` on success — src/app/search.tsx:489 measures against that clock', async () => {
    // search.tsx snapshots `at` before its fan-out and compares afterwards to decide whether
    // THIS query lost a collection. A success that moved the clock would make every
    // successful search report itself as failed.
    health.reportFailure('/a');
    health.reportFailure('/b');
    const at = health.getHealth().at;

    health.reportSuccess('/a');

    expect(health.getHealth().at).toBe(at);
  });

  it('DOES move `at` on a repeat failure of an endpoint already listed', async () => {
    // The other half of the same contract. A second identical failure has to be visible to
    // search.tsx, or a real outage on a retried query renders as "nothing matched".
    health.reportFailure('/a');
    const first = health.getHealth().at;
    await vi.advanceTimersByTimeAsync(5);
    health.reportFailure('/a');

    expect(health.getHealth().failures).toEqual(['/a']);   // still de-duplicated
    expect(health.getHealth().at).not.toBe(first);         // but the clock moved
  });

  it('caps the ledger at 12 endpoints, keeping the most recent', async () => {
    for (let i = 0; i < 15; i += 1) health.reportFailure(`/e${i}`);
    const f = health.getHealth().failures;
    expect(f).toHaveLength(12);
    expect(f[0]).toBe('/e3');
    expect(f[11]).toBe('/e14');
  });

  it('resetHealth wipes everything, including the clock', async () => {
    health.reportFailure('/a');
    health.resetHealth();
    expect(health.getHealth()).toEqual({ degraded: false, failures: [], at: null });
  });
});

/* ================================================================== *
 * 2. Not every failure is an outage
 * ================================================================== */

describe('tryReal — which failures reach the banner', () => {
  beforeEach(signIn);

  it('reports a network throw', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    await settle(api.getContests());
    expect(health.getHealth().failures).toEqual(['/contests']);
  });

  it('reports a 500', async () => {
    fetchSpy.mockResolvedValue(res(500, { error: 'boom' }));
    await settle(api.getContests());
    expect(health.getHealth().failures).toEqual(['/contests']);
  });

  it('reports a 200 whose body the screen cannot use', async () => {
    // The server answered, so this is a contract fault rather than an outage — but the caller
    // renders a zeroed shell next, and an unlabelled zero is the exact lie this channel
    // exists to prevent. contracts/CHANGELOG.md lists 15 confirmed drifts of this kind.
    fetchSpy.mockResolvedValue(res(200, { data: { not: 'an array' } }));
    await settle(api.getContests());
    expect(health.getHealth().failures).toEqual(['/contests']);
  });

  it('does NOT report a 403 — a permission result is not an outage', async () => {
    fetchSpy.mockResolvedValue(res(403, { error: 'forbidden' }));
    await settle(api.getContests());
    expect(health.getHealth()).toMatchObject({ degraded: false, failures: [] });
  });

  it('does NOT report a 404 — the endpoint is not deployed, and retrying never helps', async () => {
    // Phase 1 already named this `unsupported` (api.ts WriteFailure). /lic-plans is
    // documented as exactly this in production; reporting it would pin the banner open.
    fetchSpy.mockResolvedValue(res(404, { error: 'not found' }));
    await settle(api.getContests());
    expect(health.getHealth()).toMatchObject({ degraded: false, failures: [] });
  });

  it('reports nothing when there is no real session — no request was attempted', async () => {
    // getDashboardOverview returns tryReal's null straight through, with no `?? unavailable`
    // after it, so this isolates the short-circuit at api.ts:119 from any caller's choice.
    api.setAuthToken(null);
    expect(await settle(api.getDashboardOverview())).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(health.getHealth().degraded).toBe(false);
  });

  it('PINNED: a caller that chains `?? unavailable(...)` still reports with no session', async () => {
    // Not changed by Phase 3, and pinned rather than "fixed" because it is the caller's
    // decision, not tryReal's: `unavailable()` means "resolve empty AND say so", and a
    // signed-out app is not supposed to be calling these functions at all. Worth knowing
    // about before someone reads a banner in a signed-out screenshot as an outage.
    api.setAuthToken(null);
    await settle(api.getContests());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(health.getHealth().failures).toEqual(['/contests']);
  });
});

describe('unavailable() must not contradict tryReal', () => {
  beforeEach(signIn);

  it('stays quiet when tryReal already classified the failure as an answer', async () => {
    // THE HAND-OFF. Callers respond to tryReal's null with `?? unavailable(...)`, which
    // reports unconditionally. Without the suppression note, a 403 would be classified
    // "not an outage" and then have the banner raised one line later anyway.
    fetchSpy.mockResolvedValue(res(403));
    await settle(api.getContests());
    expect(health.getHealth().degraded).toBe(false);
  });

  it('reports on the NEXT attempt if that one fails for a real reason', async () => {
    // The note is consumed once. A 403 followed by a genuine outage must still be heard.
    fetchSpy.mockResolvedValue(res(403));
    await settle(api.getContests());
    expect(health.getHealth().degraded).toBe(false);

    fetchSpy.mockRejectedValue(new Error('network down'));
    await settle(api.getContests());
    expect(health.getHealth().failures).toEqual(['/contests']);
  });
});

/* ================================================================== *
 * 3. Acceptance criterion 7 — an advisor on a healthy backend
 * ================================================================== */

describe('getTeam — a non-admin role must not see an outage banner', () => {
  beforeEach(signIn);

  it('raises no banner when /profiles answers 403', async () => {
    // GET /profiles is admin-only (contracts/api.md:211) and getTeam falls through to it
    // whenever /team/task-overview yields no members. Reporting that 403 would give every
    // advisor a permanent outage banner against a perfectly healthy backend.
    fetchSpy.mockResolvedValue(res(403, { error: 'forbidden' }));

    const team = await settle(api.getTeam());

    expect(team).toEqual([]);
    expect(health.getHealth()).toMatchObject({ degraded: false, failures: [] });
  });
});

/* ================================================================== *
 * 4. The DONE-WHEN, in test form
 * ================================================================== */

describe('the Master dashboard must not render a confident all-zero organisation', () => {
  beforeEach(signIn);

  it('getClientStats returns null when neither request answered', async () => {
    // It used to return an object literal on EVERY path — `total` defaulting to 0 through a
    // swallowed catch, every other field `agg?.x ?? 0`. That truthy zeroed object is what
    // made getOrgSnapshot's outage gate dead code.
    fetchSpy.mockRejectedValue(new Error('network down'));
    expect(await settle(api.getClientStats())).toBeNull();
  });

  it('getClientStats still answers when the count leg works and the aggregate does not', async () => {
    // A zero is trustworthy if something actually answered. Only BOTH legs failing is null.
    fetchSpy.mockImplementation((url: string) =>
      Promise.resolve(url.includes('/clients/stats/overview')
        ? res(500)
        : res(200, { data: [], totalPages: 7 })));

    expect(await settle(api.getClientStats())).toMatchObject({ total_clients: 7 });
  });

  it('getOrgSnapshot returns null on a dead backend, and raises the banner', async () => {
    // THE PHASE 3 ACCEPTANCE CRITERION. `if (!dov && !stats && !ov) return null` was
    // unreachable for any signed-in user, so the master dashboard rendered
    // "0 clients · ₹0 claims paid" as fact while the backend was completely down.
    fetchSpy.mockRejectedValue(new Error('network down'));

    expect(await settle(api.getOrgSnapshot())).toBeNull();
    expect(health.getHealth().degraded).toBe(true);
  });
});

/* ================================================================== *
 * 5. getTeamActivity stops fabricating an outage
 * ================================================================== */

describe('getTeamActivity', () => {
  beforeEach(signIn);

  it('resolves [] without a request and without reporting anything', async () => {
    // It used to be `return unavailable('/activity', [])`, which reported synchronously —
    // so every mount of the Team screen raised a false banner at t=0 against a healthy
    // backend, for a path contracts/api.md has never contained.
    expect(await api.getTeamActivity()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(health.getHealth()).toMatchObject({ degraded: false, failures: [] });
  });
});

/* ================================================================== *
 * 6. One broken endpoint is one banner row
 * ================================================================== */

describe('health keys — a failure is counted once', () => {
  beforeEach(signIn);

  it('normalises an id-shaped segment so tryReal and unavailable agree on one key', async () => {
    // getClient fetches `/clients/<24-hex>?scope=all` but its caller reports `/clients/:id`.
    // Without normalisation one dead lookup would occupy two rows in the banner's count.
    fetchSpy.mockRejectedValue(new Error('network down'));

    await settle(api.getClient('68f1a2b3c4d5e6f7a8b9c0d1'));

    expect(health.getHealth().failures).toEqual(['/clients/:id']);
  });

  it('does NOT collapse a word segment — /clients/segments is its own endpoint', async () => {
    // A blanket "replace the last segment" rule would fold /clients/segments and
    // /clients/stats/overview into /clients/:id, making three endpoints share one row and
    // letting one endpoint's recovery clear another's failure.
    fetchSpy.mockRejectedValue(new Error('network down'));

    await settle(api.getClientSegments({}));

    expect(health.getHealth().failures).toEqual(['/clients/segments']);
  });
});
