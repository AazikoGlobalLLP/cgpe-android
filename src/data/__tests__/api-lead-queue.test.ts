/**
 * PHASE 57 (Leads-create) — the `addLead` outcomes with the offline write queue wired, pinned.
 *
 * `api-leads.test.ts` pins the wire contract (the request body, the four response envelopes). THIS
 * file pins the extra safety property the write queue adds: a lead the user typed while the network
 * was DOWN is queued (not lost, not falsely reported saved), and NOTHING else is queued —
 *   - a 201 with the lead document  → ok:true                 (on the server, queues nothing)
 *   - a 400                         → reason:'invalid'         (a typo — the user fixes it; NOT queued)
 *   - a 403                         → reason:'forbidden'       (no access — retry can't help; NOT queued)
 *   - a 404/501                     → reason:'unsupported'     (endpoint absent; NOT queued)
 *   - a 500 / 2xx-without-a-lead    → reason:'server'          (server ANSWERED and refused; NOT queued)
 *   - a NETWORK throw               → reason:'network'         (queued, flagged pending, held to sync)
 * The DISTINCTION is the whole point: only a genuine throw enqueues; every server answer does not.
 *
 * The queue's device I/O (AsyncStorage) is a no-op under the test stub, so this pins the CLASSIFY +
 * bus behaviour; the flush replay + storage round-trip are device-only, like every AsyncStorage path
 * in this suite. The pure decisions live in `lib/writeQueue`'s own test.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Pending = typeof import('@/data/pendingWrites');
let api: Api;
let pending: Pending;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A lead document as `Lead.create` serialises one back (`models/Lead.js`). */
const doc = (extra: Record<string, unknown> = {}) => ({
  _id: 'srv-1',
  name: 'asha patel',
  phone: '9876543210',
  status: 'new_lead',
  probability: 10,
  created_at: '2026-08-01T04:30:00.000Z',
  updated_at: '2026-08-01T04:30:00.000Z',
  ...extra,
});

const FIELDS = { name: 'Asha Patel', phone: '9876543210', interest: 'Term plan', city: 'Surat', potential: 45000 };

/** Drive a call that ends on `wait()` (every non-2xx path) past the fake timer, then resolve it. */
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(400);
  return p;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  pending = await import('@/data/pendingWrites');
  api.setAuthToken('test-token');       // a real session (a `demo-` token would disable the network)
  api.setCurrentUser('u1', 'Tester');   // the queue is per-user; without an id nothing can be queued
});
afterEach(() => {
  vi.useRealTimers();
});

describe('addLead — the write queue only ever holds a genuine offline draft', () => {
  it('SAVED: a 201 with the lead document returns ok and queues nothing', async () => {
    fetchSpy.mockResolvedValue(reply(201, { success: true, data: { lead: doc({ insurance_need: 'Term plan' }) } }));
    const res = await api.addLead(FIELDS);
    expect(res.ok).toBe(true);
    expect(res.ok && res.lead.id).toBe('srv-1');
    expect(res.ok && res.lead.name).toBe('Asha Patel');
    expect(pending.getPendingByKind('lead')).toHaveLength(0);
  });

  it('INVALID: a 400 returns the server sentence and does NOT queue (the user retypes)', async () => {
    fetchSpy.mockResolvedValue(reply(400, { success: false, details: [{ msg: 'Please provide a valid phone number' }] }));
    const res = await api.addLead({ name: 'Asha Patel', phone: '123' });
    expect(res).toEqual({ ok: false, reason: 'invalid', message: 'Please provide a valid phone number' });
    expect(pending.getPendingByKind('lead')).toHaveLength(0);
  });

  it('FORBIDDEN: a 403 does NOT queue (retry cannot grant the sales module)', async () => {
    fetchSpy.mockResolvedValue(reply(403, { success: false, code: 'RBAC_MODULE_DENIED', module: 'sales' }));
    const res = await settle(api.addLead(FIELDS));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toBe('forbidden');
    expect(pending.getPendingByKind('lead')).toHaveLength(0);
  });

  it('UNSUPPORTED: a 404 (endpoint not there) does NOT queue', async () => {
    fetchSpy.mockResolvedValue(reply(404, { success: false }));
    const res = await settle(api.addLead(FIELDS));
    expect(!res.ok && res.reason).toBe('unsupported');
    expect(pending.getPendingByKind('lead')).toHaveLength(0);
  });

  it('SERVER: a 500 is a server ANSWER, not a throw — held in memory but NOT queued', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false, error: 'Server Error' }));
    const res = await settle(api.addLead(FIELDS));
    expect(!res.ok && res.reason).toBe('server');
    expect(pending.getPendingByKind('lead')).toHaveLength(0);
  });

  it('QUEUED: a NETWORK throw queues an additive draft flagged pending, storing the exact request body', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const res = await settle(api.addLead(FIELDS));

    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toBe('network');
    expect(!res.ok && res.reason !== 'invalid' && res.lead.pending).toBe(true);
    expect(!res.ok && res.reason !== 'invalid' && res.lead.name).toBe('Asha Patel');
    expect(!res.ok && res.reason !== 'invalid' && res.lead.interest).toBe('Term plan');
    expect(!res.ok && res.reason !== 'invalid' && res.lead.potential).toBe(45000);

    const q = pending.getPendingByKind('lead');
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe('lead');
    expect(q[0].payload).toEqual({
      name: 'Asha Patel',
      phone: '9876543210',
      status: 'new_lead',
      insurance_need: 'Term plan',
      address: { city: 'Surat' },
      expected_premium: 45000,
    });
  });

  it('QUEUED: a bare offline lead stores only the fields the user filled', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    await settle(api.addLead({ name: 'Asha Patel', phone: '9876543210' }));
    const q = pending.getPendingByKind('lead');
    expect(q).toHaveLength(1);
    expect(q[0].payload).toEqual({ name: 'Asha Patel', phone: '9876543210', status: 'new_lead' });
  });

  it('a NETWORK throw with NO signed-in user id does NOT queue (still returns network)', async () => {
    api.setCurrentUser(null, null);        // sign the user out of the id — enqueue has nowhere to write
    fetchSpy.mockRejectedValue(new Error('network down'));
    const res = await settle(api.addLead(FIELDS));
    expect(!res.ok && res.reason).toBe('network');
    expect(pending.getPendingByKind('lead')).toHaveLength(0);
  });
});
