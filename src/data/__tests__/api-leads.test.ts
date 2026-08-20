/**
 * PHASE 4 — the leads wire contract, pinned.
 *
 * `adapt.test.ts` pins the vocabulary; this file pins the four shapes it travels in. Every
 * expectation here is quoted from `contracts/api.md:366-370` and was re-read in
 * `cgpe-backend-main/routes/leads.js` before it was written:
 *
 *   GET  /api/leads      → { success, data: { leads, pagination } }
 *   GET  /api/leads/:id  → { success, data: { lead } }
 *   POST /api/leads      → 201 { success, data: { lead }, message }   400 { error, details[] }
 *   PUT  /api/leads/:id  → { success, data: { lead }, message }       body: { status }
 *
 * WHY THIS FILE EXISTS AT ALL. Every defect Phase 4 fixed was invisible to a unit test of
 * `adapt.ts` and invisible to `tsc`: the app sent a field the schema does not declare and read
 * a level of envelope that was never there, and both failed as *silence* — a detail screen that
 * never loaded, a stage change that never persisted. The request body and the response envelope
 * are the contract, so they are what is asserted.
 *
 * FETCH IS STUBBED, not mocked-through: `api.ts` is the only file in the app that calls
 * `fetch`, so a stub at that boundary exercises the real `req` / `tryReal` / health path.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

/** What `req()` needs back from fetch. */
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (body: unknown) => reply(200, body);

/** A lead document as `Lead.findById` serialises one (`models/Lead.js`, virtuals included). */
const doc = (extra: Record<string, unknown> = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'asha patel',
  phone: '9876543210',
  status: 'new_lead',
  advisor_id: 'u1',
  probability: 10,
  created_at: '2026-08-01T04:30:00.000Z',
  updated_at: '2026-08-02T04:30:00.000Z',
  age_in_days: 9,
  is_overdue: false,
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

/* ------------------------------------------------------------------ GET /leads/:id */

describe('getLead — the envelope that kept the detail screen empty', () => {
  it('unwraps data.lead', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: { lead: doc({ status: 'policy_issued' }) } }));

    const lead = await api.getLead('507f1f77bcf86cd799439011');

    expect(lead?.id).toBe('507f1f77bcf86cd799439011');
    expect(lead?.name).toBe('Asha Patel');
    expect(lead?.stage).toBe('policy_issued');
    expect(health.getHealth().degraded).toBe(false);
  });

  it('sends no query string — GET /:id reads no scope', async () => {
    // `?scope=all` used to ride along. `routes/leads.js:266` is a raw ownership test with an
    // admin bypass; there is no scope to widen, so the parameter only implied one.
    fetchSpy.mockResolvedValue(ok({ success: true, data: { lead: doc() } }));
    await api.getLead('507f1f77bcf86cd799439011');
    expect(sent().url.endsWith('/leads/507f1f77bcf86cd799439011')).toBe(true);
  });

  it('rejects a bare document as a contract fault, and reports it ONCE', async () => {
    // This is the Phase 3 rule applied to a shape change: the server answered, so the failure
    // is a contract fault rather than an outage — but the screen's next move is an empty state,
    // and an unlabelled empty is the lie the health channel exists to prevent.
    fetchSpy.mockResolvedValue(ok({ success: true, data: doc() }));

    const promise = api.getLead('507f1f77bcf86cd799439011');
    await vi.advanceTimersByTimeAsync(400);          // unavailable() → wait()

    expect(await promise).toBeUndefined();
    expect(health.getHealth().degraded).toBe(true);
    // tryReal reports it and `unavailable` reports it again; health de-duplicates, so one
    // broken endpoint is one banner row.
    expect(health.getHealth().failures).toEqual(['/leads/:id']);
  });

  it('stays quiet on a 403 — an unowned lead is an answer, not an outage', async () => {
    // The list deliberately includes unowned leads (`utils/scope.js:121-126`) while
    // `GET /:id` refuses them, so this 403 is reachable by tapping a row that is really there.
    fetchSpy.mockResolvedValue(reply(403, { success: false, error: 'Not authorized to access this lead' }));

    const promise = api.getLead('507f1f77bcf86cd799439011');
    await vi.advanceTimersByTimeAsync(400);

    expect(await promise).toBeUndefined();
    expect(health.getHealth().degraded).toBe(false);
  });
});

/* ------------------------------------------------------------------ PUT /leads/:id */

describe('setLeadStage — the field the server actually stores', () => {
  it('PUTs { status } and nothing else', async () => {
    // THE DEFECT THIS PINS: the body was `{ stage }`, which is not a path on the Lead schema,
    // so Mongoose strict mode dropped it. The server answered 200 with the record unchanged
    // and wrote no `status_change` timeline row — every stage change in this app's history was
    // a no-op that reported success.
    fetchSpy.mockResolvedValue(ok({ success: true, data: { lead: doc({ status: 'docs_shared' }) }, message: 'Lead updated successfully' }));

    const saved = await api.setLeadStage('507f1f77bcf86cd799439011', 'docs_shared');

    expect(sent().init.method).toBe('PUT');
    expect(sent().body).toEqual({ status: 'docs_shared' });   // exact — no `stage`, no extras
    expect(saved?.stage).toBe('docs_shared');
    expect(saved?.name).toBe('Asha Patel');
  });

  it('resolves the SERVER\'s copy, not the value that was requested', async () => {
    // `{ new: true }` means the reply is the post-update document, so the caller can compare
    // instead of trusting. A server that stored something else must be visible here.
    fetchSpy.mockResolvedValue(ok({ success: true, data: { lead: doc({ status: 'new_lead' }) } }));

    const saved = await api.setLeadStage('507f1f77bcf86cd799439011', 'policy_issued');

    expect(saved?.stage).toBe('new_lead');   // the screens compare and roll back on this
  });

  it('resolves null when the reply carries no lead', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: {} }));
    expect(await api.setLeadStage('507f1f77bcf86cd799439011', 'lost')).toBeNull();
  });

  it('resolves null on a refused write, and DOES report it', async () => {
    // Deliberately unlike `addLead`, whose 400 is a user's typo in a form. A 400 here means the
    // app sent a status the server's own validator rejects (`routes/leads.js:367-370`), which
    // can only be a contract drift between this app and the enum — nobody can fix it by
    // retyping, and it is exactly what the health channel is for.
    fetchSpy.mockResolvedValue(reply(400, { success: false, error: 'Validation failed' }));

    expect(await api.setLeadStage('507f1f77bcf86cd799439011', 'lost')).toBeNull();
    expect(health.getHealth().failures).toEqual(['/leads/:id']);
  });

  it('stays quiet when the caller may not update this lead (403)', async () => {
    fetchSpy.mockResolvedValue(reply(403, { success: false, error: 'Not authorized to update this lead' }));
    expect(await api.setLeadStage('507f1f77bcf86cd799439011', 'lost')).toBeNull();
    expect(health.getHealth().degraded).toBe(false);
  });

  it('resolves null on a dead connection', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    expect(await api.setLeadStage('507f1f77bcf86cd799439011', 'lost')).toBeNull();
    expect(health.getHealth().failures).toEqual(['/leads/:id']);
  });
});

/* ------------------------------------------------------------------ POST /leads */

describe('addLead — a Lead document, not the app\'s own object', () => {
  it('sends only fields the schema declares', async () => {
    // THE DEFECT THIS PINS: the body used to be the app's Lead — `id`, `stage`, `interest`,
    // `potential`, `city`, `priority`, `createdAt`, `lastActivity`, `notes: []`. Eight of the
    // eleven keys are not schema paths and were dropped by strict mode, and `notes: []` went
    // at a String path. The names below are the schema's own (`models/Lead.js:10-56`).
    fetchSpy.mockResolvedValue(reply(201, { success: true, data: { lead: doc() }, message: 'Lead created successfully' }));

    await api.addLead({
      name: 'Asha Patel', phone: '9876543210', interest: 'Term plan',
      city: 'Surat', potential: 45000, priority: 'warm',
    });

    expect(sent().init.method).toBe('POST');
    expect(sent().body).toEqual({
      name: 'Asha Patel',
      phone: '9876543210',
      status: 'new_lead',
      insurance_need: 'Term plan',
      address: { city: 'Surat' },
      expected_premium: 45000,
      // and NOT `priority` — the sheet never asks for it, the schema has no such path, and the
      // field it is derived from (`probability`) has a default of its own.
    });
  });

  it('omits what the user left blank', async () => {
    fetchSpy.mockResolvedValue(reply(201, { success: true, data: { lead: doc() } }));
    await api.addLead({ name: 'Asha Patel', phone: '9876543210', interest: '', city: '', potential: 0 });
    expect(sent().body).toEqual({ name: 'Asha Patel', phone: '9876543210', status: 'new_lead' });
  });

  it('returns the SERVER\'s record, so a new lead shows its real name', async () => {
    // The 201 envelope is `data.lead` like the others. Unwrapped one level too few, `adaptLead`
    // saw `{ lead: {…} }`, and every new lead was called "Lead" with the id "undefined" — which
    // then 404'd on the read-back.
    fetchSpy.mockResolvedValue(reply(201, {
      success: true,
      data: { lead: doc({ _id: 'srv-1', name: 'asha patel', insurance_need: 'Term plan' }) },
      message: 'Lead created successfully',
    }));

    const result = await api.addLead({ name: 'Asha Patel', phone: '9876543210' });

    expect(result.ok).toBe(true);
    expect(result.ok && result.lead.id).toBe('srv-1');
    expect(result.ok && result.lead.name).toBe('Asha Patel');
    expect(result.ok && result.lead.interest).toBe('Term plan');
    expect(result.ok && result.lead.stage).toBe('new_lead');
  });

  it('treats a 400 as a refusal: the server\'s own sentence, no banner, nothing kept', async () => {
    // `phone` is required and validated server-side, so a typo is the likeliest failure of all.
    // Routed through `tryReal` it would have reported "some data could not load" to the whole
    // app; buffered locally it would have been a lead that does not exist and never will.
    fetchSpy.mockResolvedValue(reply(400, {
      success: false,
      error: 'Validation failed',
      details: [{ msg: 'Please provide a valid phone number', path: 'phone' }],
    }));

    const result = await api.addLead({ name: 'Asha Patel', phone: '123' });

    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'Please provide a valid phone number' });
    expect(health.getHealth().degraded).toBe(false);

    // ...and the record was not held anywhere. A failing list read falls back to the local
    // buffer, which must still be empty.
    fetchSpy.mockRejectedValue(new Error('network down'));
    const list = api.getLeads();
    await vi.advanceTimersByTimeAsync(2000);   // Phase 55: the GET retries once before the empty fallback
    expect(await list).toEqual([]);
  });

  it('falls back to the summary key when a 400 carries no details[]', async () => {
    // Two envelopes are in play — routers answer `error`, middleware answers `message`
    // (`contracts/enums.md` §15) — so both are read before giving up.
    fetchSpy.mockResolvedValue(reply(400, { success: false, message: 'Lead already exists' }));
    const result = await api.addLead({ name: 'Asha Patel', phone: '9876543210' });
    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'Lead already exists' });
  });

  it('does NOT keep a record the server refused outright, and leaves no note behind', async () => {
    // Two defects in one path, both found by review after the first commit.
    //
    // 1. A 403 (no `sales` module) or a 404/501 is as permanent as the 400 above — retrying
    //    changes nothing — so buffering the record shows the user a lead that will never exist.
    // 2. `reportIfOutage` records "this failure was an ANSWER" for `unavailable` to consume, and
    //    this function never calls `unavailable`. The note used to sit there until the NEXT
    //    failure of GET /leads ate it, silently swallowing one real outage.
    fetchSpy.mockResolvedValue(reply(403, { success: false, code: 'RBAC_MODULE_DENIED', module: 'sales' }));

    const add = api.addLead({ name: 'Asha Patel', phone: '9876543210' });
    await vi.advanceTimersByTimeAsync(400);
    const result = await add;

    expect(!result.ok && result.reason).toBe('forbidden');
    expect(health.getHealth().degraded).toBe(false);          // 403 is an answer, not an outage

    // The note is gone, so a REAL outage on the next read is still reported...
    fetchSpy.mockRejectedValue(new Error('network down'));
    const list = api.getLeads();
    await vi.advanceTimersByTimeAsync(2000);   // Phase 55: the GET retries once before the empty fallback
    // ...and that read also proves nothing was buffered: it falls back to the local buffer.
    expect(await list).toEqual([]);
    expect(health.getHealth().failures).toEqual(['/leads']);
  });

  it('keeps the typed record when the write never lands, and says so', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    const promise = api.addLead({ name: 'Asha Patel', phone: '9876543210' });
    await vi.advanceTimersByTimeAsync(400);
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe('network');
    expect(!result.ok && result.reason !== 'invalid' && result.lead.name).toBe('Asha Patel');
    expect(health.getHealth().failures).toEqual(['/leads']);
  });
});

/* ------------------------------------------------------------------ GET /leads */

describe('getLeads — the list envelope and the module gate', () => {
  it('reads data.leads', async () => {
    fetchSpy.mockResolvedValue(ok({
      success: true,
      data: { leads: [doc(), doc({ _id: 'l2', status: 'lost' })], pagination: { page: 1, limit: 500, total: 2, pages: 1 } },
    }));

    const leads = await api.getLeads();

    expect(leads.map((l) => l.stage)).toEqual(['new_lead', 'lost']);
    expect(health.getHealth().degraded).toBe(false);
  });

  it('does NOT raise the banner when the sales module is not granted', async () => {
    // PHASE 4. Every /api/leads route is behind `requireModule('sales')` (`api.md:362`), so a
    // user whose department lacks the module gets 403 on a perfectly healthy backend. This path
    // never classified the status, so the banner stayed open for their whole session — the
    // defect Phase 3 fixed for `GET /profiles`, still live here.
    fetchSpy.mockResolvedValue(reply(403, { success: false, code: 'RBAC_MODULE_DENIED', module: 'sales' }));

    const promise = api.getLeads();
    await vi.advanceTimersByTimeAsync(400);

    expect(await promise).toEqual([]);
    expect(health.getHealth().degraded).toBe(false);
  });

  it('DOES raise it on a 500', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false, error: 'Server Error' }));

    const promise = api.getLeads();
    await vi.advanceTimersByTimeAsync(2000);   // Phase 55: a 500 is retryable, so the GET tries twice first

    expect(await promise).toEqual([]);
    expect(health.getHealth().failures).toEqual(['/leads']);
  });
});
