/**
 * PHASE 9 — `toggleReminder` is a real, confirmed, one-way write, pinned.
 *
 * Before this phase `toggleReminder` made no network call: it flipped an in-process buffer that
 * a real session never reads back, so the tick reverted on the next `getReminders`. It now POSTs
 * `/reminders/:id/acknowledge` (`cgpe-backend-main/routes/reminders.js:419`, sets
 * `status:'acknowledged'`) and returns whether the SERVER accepted it, so the screen can revert an
 * optimistic tick instead of lying about a save. The endpoint path IS the contract, and the
 * four-way return (persist / non-2xx / success:false / throw / no-session) is what the screen
 * branches on — both are asserted here.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` uses, so the real `req` path runs. `api.ts` holds
 * mutable module state with no reset export, so every test re-imports it after `vi.resetModules()`
 * (CLAUDE.md §npm test). `toggleReminder` never reaches `unavailable()`/`wait()`, so no timer
 * advancing is needed — a mocked fetch resolves/rejects on the microtask queue.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (body: unknown) => reply(200, body);

const call = (i = 0) => fetchSpy.mock.calls[i] as [string, RequestInit];
const sentUrl = (i = 0) => call(i)[0];
const sentInit = (i = 0) => call(i)[1];

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

describe('toggleReminder — the acknowledge write', () => {
  it('POSTs to /reminders/:id/acknowledge and nothing else', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { _id: 'r123', status: 'acknowledged' } }));
    await api.toggleReminder('r123');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sentUrl()).toContain('/reminders/r123/acknowledge');
    expect(sentInit().method).toBe('POST');
  });

  it('returns true only when the server confirms the acknowledge', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { _id: 'r123', status: 'acknowledged' } }));
    expect(await api.toggleReminder('r123')).toBe(true);
  });

  it('returns false on a non-2xx (e.g. 404 — not the caller’s reminder)', async () => {
    fetchSpy.mockResolvedValue(reply(404, { success: false, message: 'Reminder not found' }));
    expect(await api.toggleReminder('gone')).toBe(false);
  });

  it('returns false on a 200 whose body says success:false', async () => {
    // The backend can answer 200 and still refuse — the body's verdict wins, same shape as the
    // WhatsApp `delivery` and mark-all-read contracts.
    fetchSpy.mockResolvedValue(ok({ success: false, error: 'nope' }));
    expect(await api.toggleReminder('r123')).toBe(false);
  });

  it('returns false when the request throws (offline / aborted)', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    expect(await api.toggleReminder('r123')).toBe(false);
  });

  it('makes no network call at all without a real session, and returns false', async () => {
    api.setAuthToken('demo-anything');   // demo- prefix disables the network
    expect(await api.toggleReminder('r123')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
