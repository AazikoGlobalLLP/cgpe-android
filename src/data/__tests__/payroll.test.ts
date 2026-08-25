/**
 * POINT 13 — the pure payroll roster join. `mergePayrollRoster` is the whole point: the payroll
 * screen's universe becomes the full staff directory (`/profiles`) rather than only members who have
 * a `PayrollProfile` (from `/payroll/compute`). These tests pin the properties that make it a fix
 * rather than a regression:
 *   - every directory member appears; one with no computed payroll row is flagged `pending` (visible,
 *     not dropped) — the owner's "only Pavitra shows" bug;
 *   - the join is by id with a normalized-name fallback, so enrichment still lands if the id spaces
 *     ever drift; and
 *   - a payroll row that matches NO directory member is kept (real pay is never silently dropped).
 * `payrollRosterStats` is pinned so the header counts/total can't drift from the merge.
 */
import { describe, expect, it } from 'vitest';

import { mergePayrollRoster, payrollRosterStats, type PayrollRosterEntry } from '@/data/payroll';
import type { PayrollRow } from '@/data/api';
import type { TeamMember } from '@/data/team';

const member = (over: Partial<TeamMember> = {}): TeamMember => ({
  id: 'user_a',
  name: 'Asha Patel',
  role: 'advisor',
  phone: '',
  agentCode: '',
  tier: 'Growth',
  branch: 'Sales',
  online: true,
  clockedIn: false,
  lastActive: '2026-08-25T00:00:00Z',
  stats: { clients: 0, premiumMtd: 0, policiesMtd: 0, renewalPct: 0, openClaims: 0, leads: 0 },
  activity: [],
  ...over,
});

const payRow = (over: Partial<PayrollRow> = {}): PayrollRow => ({
  user_id: 'user_a',
  name: 'Asha Patel',
  staff_found: true,
  segment: 'day_wise',
  salary_amount: 30000,
  payable: 25000,
  months: [],
  ...over,
});

describe('mergePayrollRoster', () => {
  it('shows EVERY directory member — one without a payroll row is pending, not dropped', () => {
    const dir = [member({ id: 'user_a', name: 'Asha' }), member({ id: 'user_b', name: 'Ben' })];
    const roster = [payRow({ user_id: 'user_a', name: 'Asha', payable: 25000 })];

    const out = mergePayrollRoster(dir, roster);

    expect(out).toHaveLength(2);
    const asha = out.find((e) => e.name === 'Asha')!;
    const ben = out.find((e) => e.name === 'Ben')!;
    expect(asha.pending).toBe(false);
    expect(asha.row?.payable).toBe(25000);
    expect(ben.pending).toBe(true);          // the whole bug: Ben used to vanish; now he is "data pending"
    expect(ben.row).toBeNull();
  });

  it('joins a directory member to its payroll row by id', () => {
    const [e] = mergePayrollRoster([member({ id: 'user_x', name: 'Different Name' })], [payRow({ user_id: 'user_x', name: 'Also Different', payable: 9000 })]);
    expect(e.pending).toBe(false);
    expect(e.row?.payable).toBe(9000);
    expect(e.name).toBe('Different Name');   // the directory name wins for the entry
  });

  it('falls back to a normalized-name match when the ids differ', () => {
    const [e] = mergePayrollRoster([member({ id: 'objectid-1', name: '  Asha Patel  ' })], [payRow({ user_id: 'user_zzz', name: 'asha patel', payable: 12000 })]);
    expect(e.pending).toBe(false);
    expect(e.row?.payable).toBe(12000);
  });

  it('keeps a payroll row that matches NO directory member — real pay is never dropped', () => {
    const out = mergePayrollRoster([member({ id: 'user_a', name: 'Asha' })], [
      payRow({ user_id: 'user_a', name: 'Asha', payable: 25000 }),
      payRow({ user_id: 'orphan_1', name: 'Ex Employee', payable: 4000, staff_found: false }),
    ]);
    expect(out).toHaveLength(2);
    const orphan = out.find((e) => e.name === 'Ex Employee')!;
    expect(orphan).toBeDefined();
    expect(orphan.pending).toBe(false);      // it has a row (real pay), just no directory/staff match
    expect(orphan.row?.payable).toBe(4000);
  });

  it('a profiled member with no attendance (₹0) is NOT pending — pending means no profile at all', () => {
    const [e] = mergePayrollRoster([member({ id: 'user_a', name: 'Asha' })], [payRow({ user_id: 'user_a', name: 'Asha', payable: 0 })]);
    expect(e.pending).toBe(false);
    expect(e.row?.payable).toBe(0);
  });

  it('orders paid members first, then profiled-unpaid, then pending — each group by name', () => {
    const dir = [
      member({ id: 'u_pending_z', name: 'Zoya' }),
      member({ id: 'u_paid_b', name: 'Bhavin' }),
      member({ id: 'u_unpaid_c', name: 'Chirag' }),
      member({ id: 'u_paid_a', name: 'Aarav' }),
      member({ id: 'u_pending_a', name: 'Anjali' }),
    ];
    const roster = [
      payRow({ user_id: 'u_paid_b', name: 'Bhavin', payable: 20000 }),
      payRow({ user_id: 'u_paid_a', name: 'Aarav', payable: 30000 }),
      payRow({ user_id: 'u_unpaid_c', name: 'Chirag', payable: 0 }),
    ];

    const names = mergePayrollRoster(dir, roster).map((e) => e.name);
    // paid (Aarav, Bhavin) → unpaid-profiled (Chirag) → pending (Anjali, Zoya), each alphabetical
    expect(names).toEqual(['Aarav', 'Bhavin', 'Chirag', 'Anjali', 'Zoya']);
  });

  it('an empty roster leaves every member present and pending', () => {
    const out = mergePayrollRoster([member({ id: 'a', name: 'A' }), member({ id: 'b', name: 'B' })], []);
    expect(out.map((e) => e.name)).toEqual(['A', 'B']);
    expect(out.every((e) => e.pending && e.row === null)).toBe(true);
  });

  it('an empty directory returns just the payroll rows as entries', () => {
    const out = mergePayrollRoster([], [payRow({ user_id: 'user_a', name: 'Asha', payable: 25000 })]);
    expect(out).toHaveLength(1);
    expect(out[0].pending).toBe(false);
    expect(out[0].name).toBe('Asha');
  });

  it('empty directory AND empty roster → []', () => {
    expect(mergePayrollRoster([], [])).toEqual([]);
  });
});

describe('payrollRosterStats', () => {
  it('counts members, paid, pending and sums the server payables', () => {
    const entries: PayrollRosterEntry[] = mergePayrollRoster(
      [member({ id: 'a', name: 'A' }), member({ id: 'b', name: 'B' }), member({ id: 'c', name: 'C' })],
      [
        payRow({ user_id: 'a', name: 'A', payable: 25000 }),
        payRow({ user_id: 'b', name: 'B', payable: 0 }),        // profiled, no pay
        // C has no profile → pending
      ],
    );
    expect(payrollRosterStats(entries)).toEqual({ members: 3, withPay: 1, pending: 1, totalPayable: 25000 });
  });

  it('ignores a non-finite payable rather than summing NaN', () => {
    const entries: PayrollRosterEntry[] = mergePayrollRoster(
      [member({ id: 'a', name: 'A' })],
      [payRow({ user_id: 'a', name: 'A', payable: NaN as unknown as number })],
    );
    const stats = payrollRosterStats(entries);
    expect(stats.totalPayable).toBe(0);
    expect(stats.withPay).toBe(0);
  });
});
