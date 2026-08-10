/**
 * PHASE 5 — the WhatsApp send wire contract, pinned.
 *
 * Every expectation here is quoted from `contracts/api.md` §`/api/whatsapp` and was re-read in
 * `cgpe-backend-main/routes/whatsapp.js:816-898` before it was written:
 *
 *   POST /api/whatsapp/hub/send
 *     body:  { phone (must yield 10 digits), name, text, purpose='custom', language='hinglish' }
 *     200:   { success, data: Message, delivery: { dispatched, configured, note } }
 *     400:   { success:false, message:'A valid 10-digit phone is required.' }
 *     400:   { success:false, message:'Message text is required.' }   (purpose==='custom' only)
 *
 * WHY THIS FILE EXISTS. The old `sendWaMessage` sent `message` where the handler reads `text`,
 * with a phone taken from an array that is empty for the life of the process — so every send was
 * refused 400 — and then wrapped the whole thing in `tryReal(..., () => true)`, which cannot fail.
 * Nothing in `tsc`, and nothing in a test of `adapt.ts`, can see any of that. The request body and
 * the response envelope ARE the contract, so they are what is asserted.
 *
 * THE ENVELOPE IS THE POINT OF THE SECOND HALF. This endpoint answers 200 for a message it never
 * dispatched: it writes its log row first and calls the gateway after. `delivery.dispatched` is
 * the only difference between a message that went out and one that was merely filed, and it sits
 * BESIDE `data`, so any helper that unwraps to `data` destroys it.
 *
 * FETCH IS STUBBED, not mocked-through: `api.ts` is the only file in the app that calls `fetch`,
 * so a stub at that boundary exercises the real `req` / health path.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (body: unknown) => reply(200, body);

/** A thread row as `normThread` serialises one (`routes/whatsapp.js:662-676`). */
const threadRow = (extra: Record<string, unknown> = {}) => ({
  thread_ref: 'custom:9876543210',
  name: 'Asha Patel',
  phone_last10: '9876543210',
  preview: 'ok',
  last_at: '2026-08-09T10:00:00.000Z',
  stage: null,
  type: 'chat',
  status: 'active',
  last_status: 'sent',
  policy_number: null,
  ...extra,
});

/** A message as `normMessage` serialises one (`routes/whatsapp.js:678-691`). */
const messageRow = (extra: Record<string, unknown> = {}) => ({
  id: 'ADM-1754820000000-123456',
  direction: 'outbound',
  text: 'Namaste',
  purpose: 'custom',
  status: 'queued',
  simulated: false,
  source: 'admin_panel',
  at: '2026-08-10T06:00:00.000Z',
  ...extra,
});

/** The full 200 body, whose `delivery` sits beside `data` rather than inside it. */
const sendReply = (delivery: Record<string, unknown>, data = messageRow()) =>
  ok({ success: true, data, delivery: { dispatched: true, configured: true, note: '', ...delivery } });

/** The request the app actually sent: [url, init]. */
const sent = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  return { url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

/** Load the inbox so `waThreadCache` is warm, then forget the call. */
async function warmCache(row: Record<string, unknown> = threadRow()) {
  fetchSpy.mockResolvedValueOnce(ok({ success: true, data: [row], total: 1, page: 1, limit: 100, totalPages: 1 }));
  await api.getWaThreads();
  fetchSpy.mockClear();
}

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

/* ------------------------------------------------------- the body that never arrived */

describe('sendWaMessage — the request body', () => {
  it('sends `text`, and no `message` key at all', async () => {
    // THE PHASE 5 BUG. `message` is not a key `routes/whatsapp.js:818` destructures, so `text`
    // was undefined, `body` was '' and — purpose defaulting to 'custom' — line 824 refused it.
    await warmCache();
    fetchSpy.mockResolvedValue(sendReply({}));

    await api.sendWaMessage('custom:9876543210', 'Namaste');

    expect(sent().body.text).toBe('Namaste');
    expect('message' in sent().body).toBe(false);
  });

  it('posts to /whatsapp/hub/send', async () => {
    await warmCache();
    fetchSpy.mockResolvedValue(sendReply({}));
    await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(sent().url.endsWith('/whatsapp/hub/send')).toBe(true);
    expect(sent().init.method).toBe('POST');
  });

  it('sends the ten digits from the cached thread, not the +91 display string', async () => {
    await warmCache();
    fetchSpy.mockResolvedValue(sendReply({}));
    await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(sent().body.phone).toBe('9876543210');
  });

  it("sends purpose 'custom' explicitly rather than relying on the default", async () => {
    // The server's "text is required" check only fires WHEN purpose === 'custom'. Our own
    // empty-text guard has to mean the same thing that one does.
    await warmCache();
    fetchSpy.mockResolvedValue(sendReply({}));
    await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(sent().body.purpose).toBe('custom');
  });

  it('sends no `language`, so the server applies its own default', async () => {
    // The only language this app knows is the ADVISOR's UI preference. Writing it onto the
    // customer's thread would be inventing a fact about someone else.
    await warmCache();
    fetchSpy.mockResolvedValue(sendReply({}));
    await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect('language' in sent().body).toBe(false);
  });

  it("sends the client's name, because the thread upsert would otherwise blank it", async () => {
    // `$set: { clientName: name || '' }` (`:860`) is unconditional — omitting the key does not
    // leave the stored name alone, it wipes it for the panel too.
    await warmCache();
    fetchSpy.mockResolvedValue(sendReply({}));
    await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(sent().body.name).toBe('Asha Patel');
  });

  it("sends '' rather than the placeholder when no real name is known", async () => {
    // 'WhatsApp user' is `adaptWaThread`'s stand-in, held only when the server's own name and
    // clientName were both already empty — so '' is lossless and the placeholder is junk.
    await warmCache(threadRow({ name: '', phone_last10: '9876543210' }));
    fetchSpy.mockResolvedValue(sendReply({}));
    await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(sent().body.name).toBe('');
  });
});

/* ------------------------------------------------------------- resolving the number */

describe('sendWaMessage — which number it sends to', () => {
  it('recovers the number from the thread id when the cache is cold', async () => {
    // A cold start straight into a chat: `getWaThreads` has not run, so `waThreadCache` is
    // empty. The id IS the server's own `custom:<last10>` thread_ref.
    fetchSpy.mockResolvedValue(sendReply({}));
    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(r.ok).toBe(true);
    expect(sent().body.phone).toBe('9876543210');
  });

  it('accepts a bare ten-digit thread id', async () => {
    // `adaptWaThread` falls back to phone_last10 when thread_ref is null (`normThread:665`).
    fetchSpy.mockResolvedValue(sendReply({}));
    await api.sendWaMessage('9876543210', 'Namaste');
    expect(sent().body.phone).toBe('9876543210');
  });

  it('makes NO request when no number can be resolved, and says which thing is wrong', async () => {
    const r = await api.sendWaMessage('custom:', 'Namaste');
    expect(r).toEqual({ ok: false, reason: 'invalid', message: 'This chat has no phone number, so nothing can be sent to it.' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('REFUSES an id that merely contains digits — a hex id is not a phone number', async () => {
    // The lenient reading ("strip non-digits, take the last ten") turns 507f1f77bcf86cd799439011
    // into 7868799439011 → 8799439011, a plausible Indian mobile, and sends a customer's message
    // to a stranger. An unsendable chat is recoverable; that is not.
    const r = await api.sendWaMessage('507f1f77bcf86cd799439011', 'Namaste');
    expect(r.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends nothing when the text is blank', async () => {
    const r = await api.sendWaMessage('custom:9876543210', '   ');
    expect(r).toEqual({ ok: false, reason: 'invalid', message: 'There is nothing to send.' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('trims the text it does send', async () => {
    fetchSpy.mockResolvedValue(sendReply({}));
    await api.sendWaMessage('custom:9876543210', '  Namaste  ');
    expect(sent().body.text).toBe('Namaste');
  });
});

/* ----------------------------------------------------- a 200 is not necessarily a send */

describe('sendWaMessage — the delivery envelope', () => {
  it('resolves ok with the server’s own message when the gateway accepted it', async () => {
    fetchSpy.mockResolvedValue(sendReply({ dispatched: true, configured: true }));

    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.message.id).toBe('ADM-1754820000000-123456');
    expect(r.message.fromMe).toBe(true);
    expect(r.message.at).toBe('2026-08-10T06:00:00.000Z');
    expect(r.simulated).toBe(false);
  });

  it('reports a simulated send as ok, with the flag set', async () => {
    // n8n took it and will not deliver it. The tick is honest; the silence would not be.
    fetchSpy.mockResolvedValue(sendReply({ dispatched: true }, messageRow({ simulated: true })));

    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.simulated).toBe(true);
  });

  it('a 200 with dispatched:false is NOT a send', async () => {
    // The endpoint writes its log row before it calls the gateway and answers 200 either way.
    fetchSpy.mockResolvedValue(sendReply({
      dispatched: false, configured: true, note: 'n8n did not accept the message (500) — logged locally.',
    }));

    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');

    expect(r).toEqual({
      ok: false, reason: 'undelivered', configured: true,
      note: 'n8n did not accept the message (500) — logged locally.',
    });
  });

  it('distinguishes "the gateway is not configured" from "the gateway refused it"', async () => {
    // Not configured means retrying can never help, which is a different sentence to the user.
    fetchSpy.mockResolvedValue(sendReply({
      dispatched: false, configured: false, note: 'n8n webhook not configured — message logged locally only.',
    }));

    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');

    expect(r.ok).toBe(false);
    if (r.ok || r.reason !== 'undelivered') throw new Error('unreachable');
    expect(r.configured).toBe(false);
  });

  it('an undelivered message is not an outage — no health failure is raised', async () => {
    fetchSpy.mockResolvedValue(sendReply({ dispatched: false, configured: false }));
    await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(health.getHealth().degraded).toBe(false);
  });

  it('treats a missing delivery object as undelivered, not as a send', async () => {
    // Fail closed: an envelope we do not recognise must never be read as "it went out".
    fetchSpy.mockResolvedValue(ok({ success: true, data: messageRow() }));

    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('undelivered');
  });
});

/* ------------------------------------------------------------------ failure classification */

describe('sendWaMessage — what kind of failure it was', () => {
  it('400 is a refusal, carries the server’s sentence, and is not an outage', async () => {
    fetchSpy.mockResolvedValue(reply(400, { success: false, message: 'A valid 10-digit phone is required.' }));

    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');

    expect(r).toEqual({ ok: false, reason: 'invalid', message: 'A valid 10-digit phone is required.' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('403 is forbidden and raises no banner', async () => {
    fetchSpy.mockResolvedValue(reply(403, { success: false, message: 'nope' }));
    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(r).toEqual({ ok: false, reason: 'forbidden' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('404 is unsupported and raises no banner', async () => {
    fetchSpy.mockResolvedValue(reply(404, { success: false, message: 'Route not found' }));
    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(r).toEqual({ ok: false, reason: 'unsupported' });
    expect(health.getHealth().degraded).toBe(false);
  });

  it('500 is a server failure AND an outage', async () => {
    fetchSpy.mockResolvedValue(reply(500, { success: false, message: 'boom' }));
    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(r).toEqual({ ok: false, reason: 'server' });
    expect(health.getHealth().degraded).toBe(true);
  });

  it('a dead network is `network` AND an outage', async () => {
    fetchSpy.mockRejectedValue(new Error('Network request failed'));
    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(r).toEqual({ ok: false, reason: 'network' });
    expect(health.getHealth().degraded).toBe(true);
  });

  it('a 2xx with no usable body is a contract fault, reported once', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true }));
    const r = await api.sendWaMessage('custom:9876543210', 'Namaste');
    expect(r).toEqual({ ok: false, reason: 'server' });
    expect(health.getHealth().failures).toEqual(['/whatsapp/hub/send']);
  });

  it('clears its own suppression note, so the NEXT real outage is still reported', async () => {
    // PHASE 4's `addLead` bug, found by review: `reportIfOutage` leaves a "this was an answer"
    // note for `unavailable` to consume, and a write path never calls `unavailable`. Left
    // behind, the note is eaten by the next failure on the same key — one silent outage.
    fetchSpy.mockResolvedValueOnce(reply(403, { success: false, message: 'nope' }));
    await api.sendWaMessage('custom:9876543210', 'one');
    expect(health.getHealth().degraded).toBe(false);

    fetchSpy.mockResolvedValueOnce(reply(500, { success: false, message: 'boom' }));
    await api.sendWaMessage('custom:9876543210', 'two');
    expect(health.getHealth().degraded).toBe(true);
  });
});

/* --------------------------------------------------------------------- the local buffer */

describe('sendWaMessage — the buffer it used to write to', () => {
  it('writes nothing to the local thread buffer on a successful send', async () => {
    // The old code pushed the message into `state.waThreads` and set lastMessage/lastAt/unread
    // on an array nothing ever populates. Observable here because that same array is what a
    // failed `getWaThreads` resolves to.
    fetchSpy.mockResolvedValue(sendReply({}));
    await api.sendWaMessage('custom:9876543210', 'Namaste');

    fetchSpy.mockRejectedValue(new Error('offline'));
    const threads = api.getWaThreads();
    await vi.advanceTimersByTimeAsync(400);          // unavailable() → wait()
    expect(await threads).toEqual([]);
  });

  it('writes nothing to the local thread buffer on a failed send either', async () => {
    fetchSpy.mockRejectedValue(new Error('offline'));
    await api.sendWaMessage('custom:9876543210', 'Namaste');

    const threads = api.getWaThreads();
    await vi.advanceTimersByTimeAsync(400);
    expect(await threads).toEqual([]);

    const one = api.getWaThread('custom:9876543210');
    await vi.advanceTimersByTimeAsync(400);
    expect(await one).toBeUndefined();
  });
});

/* ---------------------------------------------------------- the chat that could not be opened */

describe('getWaThread — the cold-cache stub', () => {
  it('carries the phone recovered from the thread id', async () => {
    // Opening a chat without loading the inbox first used to produce a thread with phone: '',
    // so the call button, the "Open in WhatsApp" button and the composer were all dead.
    fetchSpy.mockResolvedValue(ok({ success: true, data: [{ id: 'x', direction: 'inbound', text: 'hi', at: '2026-08-09T10:00:00.000Z' }] }));

    const t = await api.getWaThread('custom:9876543210');

    expect(t?.phone).toBe('+919876543210');
    expect(t?.messages).toHaveLength(1);
    expect(t?.messages[0].fromMe).toBe(false);
  });

  it('leaves the phone empty when the id carries no number', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true, data: [] }));
    const t = await api.getWaThread('custom:');
    expect(t?.phone).toBe('');
  });

  it('prefers the cached thread over the stub', async () => {
    await warmCache();
    fetchSpy.mockResolvedValue(ok({ success: true, data: [] }));
    const t = await api.getWaThread('custom:9876543210');
    expect(t?.name).toBe('Asha Patel');
  });
});
