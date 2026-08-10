/**
 * PHASE 7 — the GPS route-tracking wire contract, pinned.
 *
 * Every expectation here was read in `cgpe-backend-main/routes/timeTracker.js:1300-1432` before it
 * was written, and cross-checked against `contracts/api.md` §`/api/time-tracker`:
 *
 *   POST /api/time-tracker/track/points
 *     body:  { session_id?, date?, points:[{lat,lng,at,accuracy,speed,heading,battery}] }
 *     200:   { success:true, added:<number> }        ← `added` is TOP-LEVEL, not inside `data`
 *     400:   { success:false, message:'No active session — clock in first.' }
 *   POST /api/time-tracker/track/start  → 200 { success:true, session_id }
 *   POST /api/time-tracker/track/stop   → 200 { success:true }
 *   GET  /api/time-tracker/track/sessions → 200 { success:true, data:[TrackSession] }
 *   GET  /api/time-tracker/track/:id      → 200 { success:true, data:{ points:[…], … } }
 *
 * WHY THIS FILE EXISTS. INBOX **D5** warns that the handler reads `session_id` and silently
 * ignores `sessionId`, falling through to `resolveActiveSession` — which works while the shift is
 * running and 400s afterwards. This app already sent snake_case, so the warning looked spent. It
 * was not: `JSON.stringify` OMITS a key whose value is `undefined`, so a shift with no session id
 * produced exactly the body D5 describes, by a different route. And the 400 is the mild half —
 * `resolveActiveSession` resolves the owner from the TOKEN (`timeTracker.js:1311`), so on a shared
 * handset a session-less batch lands on whoever is signed in now.
 *
 * None of that is visible to `tsc`, and none of it is visible to a test of pure logic. The request
 * body and the response envelope ARE the contract, so they are what is asserted.
 *
 * FETCH IS STUBBED, not mocked-through: `api.ts` is the only file in the app that calls `fetch`,
 * so a stub at that boundary exercises the real `req` and health paths. `api.ts` holds mutable
 * module state with no reset export, so every test re-imports it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const SID = '68f1a2b3c4d5e6f7a8b9c0d1';

/** One fix as `lib/tracker.ts`'s `toPoints` serialises it. */
const point = (extra: Record<string, unknown> = {}) => ({
  lat: 21.20878,
  lng: 72.839281,
  at: '2026-08-10T09:15:00.000Z',
  accuracy: 12.5,
  speed: 3.2,
  heading: 91.4,
  ...extra,
});

/** The request the app actually sent: [url, init]. */
const sent = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  return { url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT make the session real
});

describe('postTrackPoints — the body D5 warns about is now impossible to construct', () => {
  it('refuses to post without a session id, and performs NO fetch', async () => {
    // The whole of D5 in one case. Before Phase 7 this sent `{ points }` with no session at all.
    expect(await api.postTrackPoints([point()])).toEqual({ outcome: 'no-session', added: 0 });
    expect(await api.postTrackPoints([point()], '')).toEqual({ outcome: 'no-session', added: 0 });
    expect(await api.postTrackPoints([point()], undefined)).toEqual({ outcome: 'no-session', added: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends `session_id` in snake_case, and no camelCase alias anywhere', async () => {
    // `timeTracker.js:1339` reads `req.body.session_id` with no destructuring and no alias.
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, added: 1 }));
    await api.postTrackPoints([point()], SID);

    const { url, body, init } = sent();
    expect(url).toContain('/time-tracker/track/points');
    expect(init.method).toBe('POST');
    expect(body.session_id).toBe(SID);
    expect(Object.keys(body).sort()).toEqual(['points', 'session_id']);
    expect(JSON.stringify(body)).not.toContain('sessionId');
  });

  it('forwards each fix with only the fields the handler reads, and omits the ones it has not got', async () => {
    // `timeTracker.js:1343-1350` maps lat/lng/at/accuracy/speed/heading/battery. A key the app
    // does not hold must be ABSENT rather than null — `Number.isFinite(Number(null))` is true,
    // so a null accuracy would be stored as 0 and pass a filter it should not.
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, added: 2 }));
    await api.postTrackPoints([point(), { lat: 21.3, lng: 72.9 }], SID);

    const { body } = sent();
    expect(body.points).toHaveLength(2);
    expect(body.points[0]).toEqual({
      lat: 21.20878, lng: 72.839281, at: '2026-08-10T09:15:00.000Z',
      accuracy: 12.5, speed: 3.2, heading: 91.4,
    });
    expect(body.points[1]).toEqual({ lat: 21.3, lng: 72.9 });
    expect('accuracy' in body.points[1]).toBe(false);
  });

  it('attaches the bearer token, which is what makes a headless upload work at all', async () => {
    // A background wake-up has no AuthProvider; `lib/tracker.ts` rehydrates the token from storage
    // and calls `setAuthToken` before delivering. If the header stopped being attached, every
    // batch would 401 and the route would silently never be recorded.
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, added: 1 }));
    await api.postTrackPoints([point()], SID);
    expect((sent().init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('sends nothing at all for an empty batch', async () => {
    expect(await api.postTrackPoints([], SID)).toEqual({ outcome: 'sent', added: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends nothing on a demo session', async () => {
    api.setAuthToken('demo-token');
    expect(await api.postTrackPoints([point()], SID)).toEqual({ outcome: 'sent', added: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('postTrackPoints — the outcome is the body\'s verdict, not the status code', () => {
  it('reads the server\'s own `added` count from the top level', async () => {
    // `timeTracker.js:1368` answers `{ success:true, added:N }` with no `data` wrapper, so a
    // helper that unwrapped to `data` would lose it — the same shape of mistake Phase 5 fixed
    // for `delivery` on the WhatsApp send.
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, added: 7 }));
    expect(await api.postTrackPoints([point()], SID)).toEqual({ outcome: 'sent', added: 7 });
  });

  it('surfaces `added: 0` — a batch the server accepted and then threw away entirely', async () => {
    // `timeTracker.js:1350` drops every point whose accuracy is worse than 100 m and `:1351`
    // answers 200 `{ added: 0 }`. The app records at `Location.Accuracy.Balanced`, which expo
    // documents as accurate to within one hundred metres — i.e. sitting on that threshold. The
    // buffer is still cleared (re-sending is discarded identically) but the number is no longer
    // invisible. Filed to `cgpe-api` rather than fixed here; see docs/spec/PHASE-7.md §5.
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, added: 0 }));
    expect(await api.postTrackPoints([point({ accuracy: 180 })], SID)).toEqual({ outcome: 'sent', added: 0 });
  });

  it('treats a missing or unusable `added` as 0 rather than guessing the batch size', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true }));
    expect(await api.postTrackPoints([point(), point()], SID)).toEqual({ outcome: 'sent', added: 0 });
  });

  it('calls a 400 REFUSED, so the buffer is dropped instead of retried forever', async () => {
    // Before Phase 7 a 400 and a dead network were the same `false`, and `lib/tracker.ts` kept the
    // points on both — so a permanently-refused batch was re-posted on every wake-up until the
    // 240-point cap evicted it. This is D5's own 400.
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false, message: 'No active session — clock in first.' }));
    expect(await api.postTrackPoints([point()], SID)).toEqual({ outcome: 'refused', added: 0 });
  });

  it('calls a 403 and a 404 refused too — the server understood and said no', async () => {
    fetchSpy.mockResolvedValueOnce(reply(403, { success: false, message: 'Access denied' }));
    expect((await api.postTrackPoints([point()], SID)).outcome).toBe('refused');
    fetchSpy.mockResolvedValueOnce(reply(404, { success: false }));
    expect((await api.postTrackPoints([point()], SID)).outcome).toBe('refused');
  });

  it('calls a 500 RETRY — the server broke, the points are still good', async () => {
    fetchSpy.mockResolvedValueOnce(reply(500, { success: false, message: 'boom' }));
    expect(await api.postTrackPoints([point()], SID)).toEqual({ outcome: 'retry', added: 0 });
  });

  it('calls a dead network RETRY, which is the case the buffer exists for', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network request failed'));
    expect(await api.postTrackPoints([point()], SID)).toEqual({ outcome: 'retry', added: 0 });
  });

  it('raises no outage banner for a refusal, because a refusal is not an outage', async () => {
    // These calls go through bare `req`, not `tryReal`, so nothing reports — asserted rather than
    // assumed, because an outage banner pinned open by a background task nobody can see would be
    // the worst kind of false alarm.
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false }));
    await api.postTrackPoints([point()], SID);
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    await api.postTrackPoints([point()], SID);
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('startTrack / stopTrack', () => {
  it('both require a session id and make no request without one', async () => {
    expect(await api.startTrack('')).toBe(false);
    expect(await api.stopTrack('')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('send `{ session_id }` and nothing else', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, session_id: SID }));
    expect(await api.startTrack(SID)).toBe(true);
    expect(sent().url).toContain('/time-tracker/track/start');
    expect(sent().body).toEqual({ session_id: SID });

    fetchSpy.mockResolvedValueOnce(reply(200, { success: true }));
    expect(await api.stopTrack(SID)).toBe(true);
    expect(sent(1).url).toContain('/time-tracker/track/stop');
    expect(sent(1).body).toEqual({ session_id: SID });
  });

  it('report a refusal as false rather than swallowing it', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false, message: 'No active session — clock in first.' }));
    expect(await api.startTrack(SID)).toBe(false);
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    expect(await api.stopTrack(SID)).toBe(false);
  });
});

describe('the master route viewer reads the documented envelopes', () => {
  it('unwraps `data` on the session list', async () => {
    const row = {
      session_id: SID, date: '2026-08-10', started_at: '2026-08-10T03:30:00.000Z',
      ended_at: null, point_count: 214, distance_m: 18400,
    };
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: [row] }));
    expect(await api.getTrackSessions('u-1')).toEqual([row]);
    expect(sent().url).toContain('user_id=u-1');
  });

  it('unwraps `data` on one route, and answers null when the body has no points array', async () => {
    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { points: [point()], distance_m: 12, started_at: 'x', ended_at: null } }));
    expect((await api.getTrack(SID))?.points).toHaveLength(1);

    fetchSpy.mockResolvedValueOnce(reply(200, { success: true, data: { distance_m: 12 } }));
    expect(await api.getTrack(SID)).toBeNull();
  });

  it('answers null for a 404, which is what an id nobody tracked returns', async () => {
    fetchSpy.mockResolvedValueOnce(reply(404, { success: false, message: 'Track not found' }));
    expect(await api.getTrack(SID)).toBeNull();
    expect(health.getHealth().degraded).toBe(false);
  });
});
