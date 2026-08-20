/**
 * PHASE 37 — the notifications read-state wire contract, pinned.
 *
 * Every expectation here is quoted from `contracts/api.md` §`/api/notifications` and was
 * re-read in `cgpe-backend-main/routes/notifications.js` before it was written:
 *
 *   PUT /api/notifications/:id/read        (protect; ownership-checked)
 *     200: { success:true, data:Notification, message:'Notification marked as read' }
 *     403: { success:false, message:'Access denied' }        — not the caller's row
 *     404: { success:false, message:'Notification not found' }
 *   PUT /api/notifications/mark-all-read    (protect; caller's own rows only)
 *     200: { success:true, message:'All notifications marked as read' }
 *   GET /api/notifications                  → { success:true, data:Notification[], ... }
 *
 * WHY THIS FILE EXISTS. Phase 37 adds `markNotificationRead(id)` — the per-item companion to
 * `markAllNotificationsRead`. `id` is the row's Mongo `_id`, exactly what `adaptNotification`
 * puts in `AppNotification.id`, so the path IS the contract. Two failure shapes are the point:
 * a 403 (not yours) and a 404 (already gone) are ANSWERS the screen rolls its optimistic row
 * back on — they must NOT raise the app-wide health banner — while a 5xx or a dead network is a
 * fault that must. Only the request path and the boolean/health outcome could have caught the
 * class of bug the mark-all fix (wrong verb + wrong path, silent 404) shipped for, so those are
 * what is asserted.
 *
 * FETCH IS STUBBED, not mocked-through: `api.ts` is the only file that calls `fetch`, so a stub
 * at that boundary exercises the real `req` / health path.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (body: unknown) => reply(200, body);

/** A notification row as the backend serialises one (Mongoose `Notification`). */
const notifRow = (extra: Record<string, unknown> = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  type: 'claim',
  title: 'Claim approved',
  message: 'Your claim ABC was approved',
  read: false,
  createdAt: '2026-08-14T06:00:00.000Z',
  ...extra,
});

/** The request the app actually sent: [url, init]. */
const sent = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  return { url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT do this
});
afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------ mark ONE — the request it sends */

describe('markNotificationRead — the request', () => {
  it('PUTs to /notifications/:id/read with the id in the path', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: notifRow({ read: true }), message: 'Notification marked as read' }));
    await api.markNotificationRead('507f1f77bcf86cd799439011');
    expect(sent().url.endsWith('/notifications/507f1f77bcf86cd799439011/read')).toBe(true);
    expect(sent().init.method).toBe('PUT');
  });

  it('makes NO request for an empty id, and returns false', async () => {
    const r = await api.markNotificationRead('');
    expect(r).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('makes NO request on a demo session, and returns false', async () => {
    api.setAuthToken('demo-token');   // suppresses all network per setAuthToken
    const r = await api.markNotificationRead('507f1f77bcf86cd799439011');
    expect(r).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------- mark ONE — accepted vs answer vs fault */

describe('markNotificationRead — the outcome', () => {
  it('returns true when the server accepts it', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: notifRow({ read: true }), message: 'Notification marked as read' }));
    const r = await api.markNotificationRead('507f1f77bcf86cd799439011');
    expect(r).toBe(true);
    expect(health.getHealth().degraded).toBe(false);
  });

  it('403 (not the caller’s row) is an ANSWER — false, and no health banner', async () => {
    fetchSpy.mockResolvedValue(reply(403, { success: false, message: 'Access denied' }));
    const r = await api.markNotificationRead('507f1f77bcf86cd799439011');
    expect(r).toBe(false);
    expect(health.getHealth().degraded).toBe(false);
  });

  it('404 (already gone) is an ANSWER — false, and no health banner', async () => {
    fetchSpy.mockResolvedValue(reply(404, { success: false, message: 'Notification not found' }));
    const r = await api.markNotificationRead('507f1f77bcf86cd799439011');
    expect(r).toBe(false);
    expect(health.getHealth().degraded).toBe(false);
  });

  it('500 is a fault — false, and raises the banner once under the collapsed key', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false, message: 'boom' }));
    const r = await api.markNotificationRead('507f1f77bcf86cd799439011');
    expect(r).toBe(false);
    expect(health.getHealth().failures).toEqual(['/notifications/:id/read']);
  });

  it('a dead network is a fault — false, and raises the banner', async () => {
    fetchSpy.mockRejectedValue(new Error('Network request failed'));
    const r = await api.markNotificationRead('507f1f77bcf86cd799439011');
    expect(r).toBe(false);
    expect(health.getHealth().degraded).toBe(true);
  });

  it('a 200 whose success is false is a contract fault — false, and reported', async () => {
    fetchSpy.mockResolvedValue(ok({ success: false }));
    const r = await api.markNotificationRead('507f1f77bcf86cd799439011');
    expect(r).toBe(false);
    expect(health.getHealth().failures).toEqual(['/notifications/:id/read']);
  });
});

/* -------------------------------------------------------------- mark ALL (unchanged posture) */

describe('markAllNotificationsRead', () => {
  it('PUTs to /notifications/mark-all-read and returns true on success', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, message: 'All notifications marked as read' }));
    const r = await api.markAllNotificationsRead();
    expect(sent().url.endsWith('/notifications/mark-all-read')).toBe(true);
    expect(sent().init.method).toBe('PUT');
    expect(r).toBe(true);
  });

  it('returns false and raises the banner on a 500', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false }));
    const r = await api.markAllNotificationsRead();
    expect(r).toBe(false);
    expect(health.getHealth().degraded).toBe(true);
  });
});

/* --------------------------------------------------------------- the feed the bell reads from */

describe('getNotifications', () => {
  it('maps the server rows through adaptNotification, incl. the is_read alias', async () => {
    fetchSpy.mockResolvedValue(ok({
      success: true,
      data: [
        notifRow(),
        { _id: 'N2', type: 'lead', message: 'A new lead landed', is_read: true, createdAt: '2026-08-13T09:00:00.000Z' },
      ],
    }));

    const out = await api.getNotifications();

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: '507f1f77bcf86cd799439011', kind: 'claim', read: false, title: 'Claim approved', at: '2026-08-14T06:00:00.000Z' });
    // `is_read` is the alias `adaptNotification` also honours, and `title` falls back to `message`.
    expect(out[1]).toMatchObject({ id: 'N2', kind: 'lead', read: true, title: 'A new lead landed' });
  });

  it('an outage resolves EMPTY and raises the banner — never a fabricated feed', async () => {
    fetchSpy.mockRejectedValue(new Error('offline'));
    const p = api.getNotifications();         // reaches unavailable() → wait(), so do not await directly
    await vi.advanceTimersByTimeAsync(2000);  // Phase 55: the GET retries once (backoff) before unavailable()
    const out = await p;
    expect(out).toEqual([]);
    expect(health.getHealth().degraded).toBe(true);
  });
});
