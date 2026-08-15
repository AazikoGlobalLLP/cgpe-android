import { describe, it, expect } from 'vitest';
import { canSeeLiveLocation, canSeeTeamPerformance, tierOf } from '@/store/roles';
import type { Role, User } from '@/data/types';

/* ------------------------------------------------------------------ *
 * Phase 40 — live-location visibility is Master-only.
 *
 * `canSeeLiveLocation` is the single gate the `agent-map` and `agent-track` screens (and the
 * More-tab tiles + the Master dashboard) share. The one thing that must never regress: it reads
 * the REAL `role` and admits ONLY `super_admin`. The whole point of the phase is that an admin or
 * a leader — who `tierOf()` folds together into the "admin" tier, and for whom `seeAgentMap` is
 * true — must NOT reach the location surfaces. So these cases pin every role, not just the two
 * that flip the answer.
 * ------------------------------------------------------------------ */

const ALL_ROLES: Role[] = ['advisor', 'learn_advisor', 'leader', 'admin', 'payroll_staff', 'super_admin'];

const withRole = (role: Role): User => ({
  id: 'u1',
  name: 'Test User',
  email: 't@example.com',
  phone: '9000000000',
  role,
  designation: '',
  branch: '',
  agentCode: '',
  tier: 'Growth',
});

describe('canSeeLiveLocation — Master (super_admin) only (Phase 40)', () => {
  it('admits super_admin', () => {
    expect(canSeeLiveLocation(withRole('super_admin'))).toBe(true);
  });

  it('refuses every non-master role', () => {
    for (const role of ALL_ROLES) {
      if (role === 'super_admin') continue;
      expect(canSeeLiveLocation(withRole(role))).toBe(false);
    }
  });

  it('refuses admin AND leader specifically — the folded-tier trap', () => {
    // Both fold into the "admin" tier and both have seeAgentMap=true, yet neither is Master.
    expect(canSeeLiveLocation(withRole('admin'))).toBe(false);
    expect(canSeeLiveLocation(withRole('leader'))).toBe(false);
  });

  it('refuses a null/unauthenticated user', () => {
    expect(canSeeLiveLocation(null)).toBe(false);
  });

  it('agrees exactly with the master tier for every role (real role, not the folded tier)', () => {
    for (const role of ALL_ROLES) {
      const u = withRole(role);
      expect(canSeeLiveLocation(u)).toBe(tierOf(u) === 'master');
    }
    expect(canSeeLiveLocation(null)).toBe(tierOf(null) === 'master');
  });
});

describe('canSeeTeamPerformance — Master (super_admin) only (Phase 45)', () => {
  // The team-performance ROSTER is owner-locked to super_admin; each member's OWN score is
  // ungated (server self-scoped). Same folded-tier trap as location: admin/leader must NOT see
  // everyone's score, so the gate reads the real role, exactly like canSeeLiveLocation.
  it('admits super_admin', () => {
    expect(canSeeTeamPerformance(withRole('super_admin'))).toBe(true);
  });

  it('refuses every non-master role, incl. admin AND leader (the folded-tier trap)', () => {
    for (const role of ALL_ROLES) {
      if (role === 'super_admin') continue;
      expect(canSeeTeamPerformance(withRole(role))).toBe(false);
    }
    expect(canSeeTeamPerformance(withRole('admin'))).toBe(false);
    expect(canSeeTeamPerformance(withRole('leader'))).toBe(false);
  });

  it('refuses a null/unauthenticated user', () => {
    expect(canSeeTeamPerformance(null)).toBe(false);
  });

  it('agrees exactly with the master tier for every role', () => {
    for (const role of ALL_ROLES) {
      const u = withRole(role);
      expect(canSeeTeamPerformance(u)).toBe(tierOf(u) === 'master');
    }
    expect(canSeeTeamPerformance(null)).toBe(tierOf(null) === 'master');
  });
});
