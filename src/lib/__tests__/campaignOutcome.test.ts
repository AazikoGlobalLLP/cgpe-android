import { describe, it, expect } from 'vitest';
import { campaignOutcome } from '@/lib/campaignOutcome';

/**
 * The single rule under test: a 403 role refusal is a COMPLETED job that delivered nothing,
 * never a `failed` one. Before Band 2 #6 the audience send path flattened `needsRole` to
 * `status:'failed'`, which surfaced as a red "Dispatch failed" on premium.tsx and a green
 * "100% Send finished" on the job monitor — two different lies about the same refusal.
 */
describe('campaignOutcome', () => {
  it('a role refusal is done, delivered nothing, and is informational — not a failure', () => {
    const out = campaignOutcome(
      { ok: false, count: 0, needsRole: true, message: 'Only admin/leader can send bulk campaigns.' },
      120,
    );
    expect(out.status).toBe('done');       // NOT 'failed'
    expect(out.needsRole).toBe(true);
    expect(out.sent).toBe(0);              // nothing reached a policyholder
    expect(out.logState).toBe('info');     // NOT 'error'
    expect(out.logText).toBe('Bulk send blocked for this role.');
  });

  it('a genuine non-role failure stays failed and errors', () => {
    const out = campaignOutcome({ ok: false, count: 0, message: 'Send failed' }, 50);
    expect(out.status).toBe('failed');
    expect(out.needsRole).toBe(false);
    expect(out.sent).toBe(0);
    expect(out.logState).toBe('error');
    expect(out.logText).toBe('Send failed');
  });

  it('a failure with no server message falls back to a generic error line', () => {
    const out = campaignOutcome({ ok: false, count: 0 }, 10);
    expect(out.status).toBe('failed');
    expect(out.logState).toBe('error');
    expect(out.logText).toBe('Send failed.');
  });

  it('a success reports the server-confirmed count', () => {
    const out = campaignOutcome({ ok: true, count: 87, message: 'Sent' }, 120);
    expect(out.status).toBe('done');
    expect(out.needsRole).toBe(false);
    expect(out.sent).toBe(87);
    expect(out.logState).toBe('info');
    expect(out.logText).toBe('Sent');
  });

  it('a success with NO count (undefined) falls back to the whole audience total', () => {
    const out = campaignOutcome({ ok: true }, 42);   // count absent → "server said ok, no number"
    expect(out.sent).toBe(42);
    expect(out.logText).toBe('Campaign dispatched.');
  });

  it('a success with an EXPLICIT 0 count reports 0, NOT the whole audience (loophole audit round 3)', () => {
    // The backend returns {success:true, data:{count:0}} when opt-in/dedup/cap filtered every recipient
    // at send time. This used to read as "sent to the whole audience" (0 || total = total) — a false
    // "Dispatched to N clients" for real policyholders who got nothing.
    const out = campaignOutcome({ ok: true, count: 0 }, 42);
    expect(out.sent).toBe(0);
    expect(out.status).toBe('done');
  });
});
