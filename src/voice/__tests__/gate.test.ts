/**
 * The voice gate is the security core of the assistant, so it is pinned exhaustively. The tests that
 * matter most are the flag-narrowing ones: they encode the exact distinction (`can()` vs the explicit
 * config value) that neither `tsc` nor a shape test can see, and that the research first got wrong.
 */
import { describe, it, expect } from 'vitest';
import type { User, Role } from '@/data/types';
import type { FeatureKey } from '@/store/appUi';
import { passesGate, type Gate, type GateContext } from '@/voice/gate';

function mkUser(role: Role, department?: string): User {
  return {
    id: 'u1', name: 'T', email: 't@x.io', phone: '9', role, designation: '', branch: '',
    agentCode: '', tier: 'Star', ...(department ? { department } : {}),
  };
}

/** A context with the config settled and no flag explicitly set (the unseeded-prod reality). */
function ctx(user: User | null, over: Partial<GateContext> = {}): GateContext {
  return { user, ready: true, flagValue: () => undefined, ...over };
}

const master = mkUser('super_admin');
const admin = mkUser('admin');
const leader = mkUser('leader');
const advisor = mkUser('advisor');
const learn = mkUser('learn_advisor');
const payroll = mkUser('payroll_staff');
const salesAdvisor = mkUser('advisor', 'SALES - RENEWALS & LIC');

describe('realMaster — the real role, leader folded OUT', () => {
  it('admits super_admin only', () => {
    expect(passesGate({ kind: 'realMaster' }, ctx(master))).toBe(true);
    for (const u of [admin, leader, advisor, payroll, null]) {
      expect(passesGate({ kind: 'realMaster' }, ctx(u))).toBe(false);
    }
  });
  it('a master previewing a lower tier KEEPS it (the screen is theirs)', () => {
    expect(passesGate({ kind: 'realMaster' }, ctx(master, { viewAs: 'team' }))).toBe(true);
  });
});

describe('realAdmin — payroll-class: the backend 403s a leader', () => {
  it('admits admin and super_admin, but NOT leader', () => {
    expect(passesGate({ kind: 'realAdmin' }, ctx(admin))).toBe(true);
    expect(passesGate({ kind: 'realAdmin' }, ctx(master))).toBe(true);
    for (const u of [leader, advisor, learn, payroll, null]) {
      expect(passesGate({ kind: 'realAdmin' }, ctx(u))).toBe(false);
    }
  });
});

describe('self — any signed-in user on their own data', () => {
  const g: Gate = { kind: 'self' };
  it('admits every signed-in role', () => {
    for (const u of [master, admin, leader, advisor, learn, payroll]) {
      expect(passesGate(g, ctx(u))).toBe(true);
    }
  });
  it('refuses when there is no session', () => {
    expect(passesGate(g, ctx(null))).toBe(false);
  });
});

describe('caps — capability required, view-as aware', () => {
  it('manageTeam: master/admin/leader yes, team no', () => {
    const g: Gate = { kind: 'caps', cap: 'manageTeam' };
    expect(passesGate(g, ctx(master))).toBe(true);
    expect(passesGate(g, ctx(admin))).toBe(true);
    expect(passesGate(g, ctx(leader))).toBe(true); // leader folds INTO admin tier
    expect(passesGate(g, ctx(advisor))).toBe(false);
    expect(passesGate(g, ctx(null))).toBe(false);
  });
  it('overseeAdmins is master-only', () => {
    const g: Gate = { kind: 'caps', cap: 'overseeAdmins' };
    expect(passesGate(g, ctx(master))).toBe(true);
    expect(passesGate(g, ctx(admin))).toBe(false);
  });
  it('view-as only NARROWS: a master previewing team loses a team-forbidden cap', () => {
    const g: Gate = { kind: 'caps', cap: 'manageTeam' };
    expect(passesGate(g, ctx(master, { viewAs: 'team' }))).toBe(false);
    expect(passesGate(g, ctx(master, { viewAs: 'admin' }))).toBe(true);
  });
});

describe('clientBook — the owner-locked Point-9 invariant', () => {
  it('whole: master/admin/leader yes, team no', () => {
    const g: Gate = { kind: 'clientBook', scope: 'whole' };
    expect(passesGate(g, ctx(master))).toBe(true);
    expect(passesGate(g, ctx(admin))).toBe(true);
    expect(passesGate(g, ctx(leader))).toBe(true);
    expect(passesGate(g, ctx(advisor))).toBe(false);
    expect(passesGate(g, ctx(salesAdvisor))).toBe(false); // whole book is NOT a sales advisor's
    expect(passesGate(g, ctx(null))).toBe(false);
  });
  it('own: the full-book tiers OR a sales-department advisor', () => {
    const g: Gate = { kind: 'clientBook', scope: 'own' };
    expect(passesGate(g, ctx(master))).toBe(true);
    expect(passesGate(g, ctx(salesAdvisor))).toBe(true);
    expect(passesGate(g, ctx(advisor))).toBe(false); // non-sales advisor: no book
    expect(passesGate(g, ctx(learn))).toBe(false);
    expect(passesGate(g, ctx(payroll))).toBe(false);
  });
  it('a master previewing team loses the whole book — that is the point of the preview', () => {
    const g: Gate = { kind: 'clientBook', scope: 'whole' };
    expect(passesGate(g, ctx(master, { viewAs: 'team' }))).toBe(false);
  });
});

describe('🔴 flag narrowing — a flag may only NARROW, and only when EXPLICITLY set false', () => {
  const teamRoster: FeatureKey = 'can_view_team_roster'; // schema default FALSE
  const flag = (val: boolean | undefined) => ({ flagValue: () => val });

  it('an UNSET flag never refuses — this is the bug the naive can()-based helper had', () => {
    // can('can_view_team_roster') would be false (schema default), which is exactly why using can()
    // here would wrongly refuse master/admin in unseeded prod. The explicit value is undefined → OK.
    const g: Gate = { kind: 'caps', cap: 'manageTeam', flag: teamRoster };
    expect(passesGate(g, ctx(master, flag(undefined)))).toBe(true);
    expect(passesGate(g, ctx(admin, flag(undefined)))).toBe(true);
  });
  it('an explicit TRUE never refuses', () => {
    const g: Gate = { kind: 'self', flag: teamRoster };
    expect(passesGate(g, ctx(advisor, flag(true)))).toBe(true);
  });
  it('an explicit FALSE refuses — the only way a flag bites', () => {
    const g: Gate = { kind: 'self', flag: teamRoster };
    expect(passesGate(g, ctx(advisor, flag(false)))).toBe(false);
  });
  it('an explicit FALSE while the config is NOT ready does not refuse yet', () => {
    const g: Gate = { kind: 'self', flag: teamRoster };
    expect(passesGate(g, ctx(advisor, { ...flag(false), ready: false }))).toBe(true);
  });
  it('a flag can only NARROW — it never widens a failed caps/self check', () => {
    // team user, manageTeam is false; an explicit-true flag must NOT grant it.
    const g: Gate = { kind: 'caps', cap: 'manageTeam', flag: teamRoster };
    expect(passesGate(g, ctx(advisor, flag(true)))).toBe(false);
    // no session; an explicit-true flag must NOT grant a self gate.
    expect(passesGate({ kind: 'self', flag: teamRoster }, ctx(null, flag(true)))).toBe(false);
  });
});
