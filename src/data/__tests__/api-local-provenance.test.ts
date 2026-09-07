/** Phase 115: only app-selected fallbacks carry copy metadata; wire data stays unchanged. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
});
const sent = (index = 0) => {
  const [url, init] = fetchSpy.mock.calls[index] as [string, RequestInit];
  return { url, method: init.method, body: JSON.parse(String(init.body)) };
};

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  api.setAuthToken('test-token');
});
afterEach(() => { vi.useRealTimers(); });

describe('addLead refusal provenance', () => {
  it('marks only a missing-prose 400 fallback and leaves the lead request schema unchanged', async () => {
    const input = { name: 'New Lead', phone: '9876543210', source: 'Manual' };
    const message = 'The server refused this lead.';
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false }));
    expect(await api.addLead(input)).toEqual({ ok: false, reason: 'invalid', message, messageCopy: { key: 'api.leadRefused' } });
    expect(sent()).toEqual({
      url: expect.stringMatching(/\/leads$/), method: 'POST',
      body: { name: 'New Lead', phone: '9876543210', status: 'new_lead', source: 'Manual' },
    });
    fetchSpy.mockResolvedValueOnce(reply(400, { message }));
    expect(await api.addLead(input)).toEqual({ ok: false, reason: 'invalid', message });
    expect(sent(1).body).toEqual(sent(0).body);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps the existing details-before-error-before-message refusal precedence', async () => {
    fetchSpy.mockResolvedValue(reply(400, { details: [{ msg: 'Detail explains refusal' }], error: 'error detail', message: 'message detail' }));
    expect(await api.addLead({ name: 'Person', phone: '9876543210' })).toEqual({
      ok: false, reason: 'invalid', message: 'Detail explains refusal',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

const notificationInput = {
  title: '  Sent  ', message: 'Could not send the notification.', priority: 'high' as const,
  audience: 'selected' as const, user_ids: ['member-1', 'member-2'],
};

describe('dispatchNotification local versus raw message provenance', () => {
  it.each([0, 1, 3])('retains the confirmed count %i and leaves outgoing text untouched', async (created) => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: { created } }));
    expect(await api.dispatchNotification(notificationInput)).toEqual({
      ok: true, created, message: `Sent to ${created} ${created === 1 ? 'person' : 'people'}.`,
      messageCopy: { key: created === 1 ? 'api.notificationSent_one' : 'api.notificationSent_other', params: { count: created } },
    });
    expect(sent()).toEqual({
      url: expect.stringMatching(/\/notifications\/dispatch$/), method: 'POST', body: notificationInput,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps an equal-English server success message raw, including confirmed zero', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: { created: 0 }, message: 'Sent to 0 people.' }));
    expect(await api.dispatchNotification(notificationInput)).toEqual({ ok: true, created: 0, message: 'Sent to 0 people.' });
  });

  it('marks missing refusal prose but preserves the same words supplied in either server prose field', async () => {
    const message = 'Could not send the notification.';
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false }));
    expect(await api.dispatchNotification(notificationInput)).toEqual({
      ok: false, created: 0, message, messageCopy: { key: 'api.notificationFailed' },
    });
    for (const body of [{ success: false, message }, { success: false, error: message }]) {
      fetchSpy.mockResolvedValueOnce(reply(400, body));
      expect(await api.dispatchNotification(notificationInput)).toEqual({ ok: false, created: 0, message });
    }
  });

  it('keeps message before error and does not trim or translate server prose', async () => {
    fetchSpy.mockResolvedValue(reply(400, { success: false, message: '  Primary server explanation  ', error: 'other' }));
    expect(await api.dispatchNotification(notificationInput)).toEqual({ ok: false, created: 0, message: '  Primary server explanation  ' });
  });

  it.each([
    { status: 403, flag: 'needsRole', key: 'api.notificationRole', message: 'Your role cannot send team notifications.' },
    { status: 404, flag: 'needsDeploy', key: 'api.notificationUnsupported', message: 'The server does not support team notifications yet. It needs the latest backend deploy.' },
  ])('preserves the existing status $status outcome with its local message', async ({ status, flag, key, message }) => {
    fetchSpy.mockResolvedValue(reply(status, { message: 'server detail' }));
    expect(await api.dispatchNotification(notificationInput)).toEqual({ ok: false, created: 0, [flag]: true, message, messageCopy: { key } });
  });

  it('does not send while signed out and marks the existing local explanation', async () => {
    api.setAuthToken(null);
    expect(await api.dispatchNotification(notificationInput)).toEqual({
      ok: false, created: 0, message: 'Not signed in. Sign in to send notifications.', messageCopy: { key: 'api.notificationSignIn' },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

const claimInput = {
  clientId: 'client-1', clientName: 'New Client', clientPhone: '9876543210',
  type: 'Health' as const, amount: 0, notes: 'New claim created. Collect required documents to proceed.', policyNumber: 'P-1',
};

describe('addClaim errorCopy belongs only to a local fallback', () => {
  it('keeps the refusal error branch separate from model copy and preserves the exact request schema', async () => {
    fetchSpy.mockResolvedValueOnce(reply(400, { success: false }));
    const local = await api.addClaim(claimInput);
    const message = 'Could not create the claim. Pick a client and try again.';
    expect(local.error).toBe(message);
    expect(local.errorCopy).toEqual({ key: 'api.claimCreateFailed' });
    expect(sent()).toEqual({
      url: expect.stringMatching(/\/claims\/$/), method: 'POST',
      body: { client_id: 'client-1', claim_amount: 0, claim_type: 'health', notes: claimInput.notes, policy_number: 'P-1', status: 'submitted' },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockResolvedValueOnce(reply(400, { success: false, message }));
    const raw = await api.addClaim(claimInput);
    expect(raw.error).toBe(message);
    expect(raw.errorCopy).toBeUndefined();
    expect(sent(1).body).toEqual(sent(0).body);
  });

  it('preserves a thrown equal-English error and marks only a missing thrown message', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Could not reach the server.'));
    const raw = await api.addClaim(claimInput);
    expect(raw.error).toBe('Could not reach the server.');
    expect(raw.errorCopy).toBeUndefined();
    fetchSpy.mockRejectedValueOnce({});
    const local = await api.addClaim(claimInput);
    expect(local.error).toBe('Could not reach the server.');
    expect(local.errorCopy).toEqual({ key: 'api.serverUnreachable' });
  });
});

const campaignOptions = { text: '  Send failed  ', limit: 0, filters: { source: 'Manual' } };

describe('sendCampaign provenance does not alter result counts or outgoing text', () => {
  it.each([0, undefined])('keeps count %s distinct while marking a local success message', async (count) => {
    fetchSpy.mockResolvedValue(reply(200, { success: true, data: count === undefined ? {} : { count } }));
    expect(await api.sendCampaign('marketing', campaignOptions)).toEqual({ ok: true, count, message: 'Sent', messageCopy: { key: 'api.sent' } });
    expect(sent()).toEqual({
      url: expect.stringMatching(/\/campaigns\/send$/), method: 'POST', body: { type: 'marketing', ...campaignOptions },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 200, success: true, message: 'Sent' },
    { status: 400, success: false, message: 'Send failed' },
  ])('keeps equal-English server prose raw for status $status', async ({ status, success, message }) => {
    fetchSpy.mockResolvedValue(reply(status, { success, data: { count: 0 }, message }));
    expect(await api.sendCampaign('marketing', campaignOptions)).toEqual({ ok: success, count: 0, message });
  });

  it('preserves the existing difference between HTTP-ok fallback copy and json.success verdict', async () => {
    fetchSpy.mockResolvedValue(reply(200, { success: false, data: { count: 0 } }));
    expect(await api.sendCampaign('marketing')).toEqual({ ok: false, count: 0, message: 'Sent', messageCopy: { key: 'api.sent' } });
    fetchSpy.mockResolvedValue(reply(400, { success: false }));
    expect(await api.sendCampaign('marketing')).toEqual({ ok: false, count: undefined, message: 'Send failed', messageCopy: { key: 'api.sendFailed' } });
  });

  it('keeps the role refusal terminal result unchanged and marks its local prose', async () => {
    fetchSpy.mockResolvedValue(reply(403, { success: false, message: 'server detail' }));
    expect(await api.sendCampaign('marketing')).toEqual({
      ok: false, count: 0, needsRole: true, message: 'Only admin/leader can send bulk campaigns.', messageCopy: { key: 'api.campaignRole' },
    });
  });

  it('preserves thrown raw text and marks the existing missing-message catch fallback', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Send failed'));
    expect(await api.sendCampaign('marketing')).toEqual({ ok: false, count: 0, message: 'Send failed' });
    fetchSpy.mockRejectedValueOnce({});
    expect(await api.sendCampaign('marketing')).toEqual({ ok: false, count: 0, message: 'Send failed', messageCopy: { key: 'api.sendFailed' } });
  });

  it('keeps the signed-out no-request guard', async () => {
    api.setAuthToken(null);
    expect(await api.sendCampaign('marketing')).toEqual({
      ok: false, count: 0, message: 'Not signed in. Sign in to send campaigns.', messageCopy: { key: 'api.campaignSignIn' },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
