import { describe, it, expect } from 'vitest';
import {
  canMonitorTeam, canSeeLiveLocation, canSeeTeamPerformance, canViewAs, canViewClients,
  canViewOwnClients, canonicalizeDepartment, identityOf, isSalesAdvisor, isSalesDepartment,
  tierOf, tierOfRole,
} from '@/store/roles';
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

describe('canMonitorTeam — Master (super_admin) only (Phase 39)', () => {
  // The dedicated monitoring hub (`/monitor`, "the main side") is master-only. Same folded-tier
  // trap as location/performance: admin/leader must NOT open the oversight surface, so the gate
  // reads the real role. Kept identical to canSeeLiveLocation/canSeeTeamPerformance by design.
  it('admits super_admin', () => {
    expect(canMonitorTeam(withRole('super_admin'))).toBe(true);
  });

  it('refuses every non-master role, incl. admin AND leader (the folded-tier trap)', () => {
    for (const role of ALL_ROLES) {
      if (role === 'super_admin') continue;
      expect(canMonitorTeam(withRole(role))).toBe(false);
    }
    expect(canMonitorTeam(withRole('admin'))).toBe(false);
    expect(canMonitorTeam(withRole('leader'))).toBe(false);
  });

  it('refuses a null/unauthenticated user', () => {
    expect(canMonitorTeam(null)).toBe(false);
  });

  it('agrees exactly with the master tier for every role', () => {
    for (const role of ALL_ROLES) {
      const u = withRole(role);
      expect(canMonitorTeam(u)).toBe(tierOf(u) === 'master');
    }
    expect(canMonitorTeam(null)).toBe(tierOf(null) === 'master');
  });
});

describe('canViewAs — Master (super_admin) only (Phase 47)', () => {
  // Owner-locked (2026-08-15): the "Viewing as" tier-preview row in More is master-only. Before
  // this phase it was gated on capabilitiesOf().manageTeam, which is true for the whole admin tier
  // (and tierOf() folds leader into it), so every admin and leader saw it — exactly the folded-tier
  // trap. The gate now reads the real role, identical to the three siblings above.
  it('admits super_admin', () => {
    expect(canViewAs(withRole('super_admin'))).toBe(true);
  });

  it('refuses every non-master role, incl. admin AND leader (the folded-tier trap)', () => {
    for (const role of ALL_ROLES) {
      if (role === 'super_admin') continue;
      expect(canViewAs(withRole(role))).toBe(false);
    }
    expect(canViewAs(withRole('admin'))).toBe(false);
    expect(canViewAs(withRole('leader'))).toBe(false);
  });

  it('refuses a null/unauthenticated user', () => {
    expect(canViewAs(null)).toBe(false);
  });

  it('agrees exactly with the master tier for every role', () => {
    for (const role of ALL_ROLES) {
      const u = withRole(role);
      expect(canViewAs(u)).toBe(tierOf(u) === 'master');
    }
    expect(canViewAs(null)).toBe(tierOf(null) === 'master');
  });
});

describe('canViewClients — Master + Admin only, Team excluded (Point 9, 2026-08-24)', () => {
  // Owner decision: the client book is master/admin-only; ordinary team members get no Clients
  // section. UNLIKE the four gates above, this INCLUDES the whole admin tier (admin AND leader
  // run a branch and own the book), so it reads the view-as-aware tier, NOT the real role.
  it('admits master (super_admin) and the whole admin tier (admin AND leader)', () => {
    expect(canViewClients(withRole('super_admin'))).toBe(true);
    expect(canViewClients(withRole('admin'))).toBe(true);
    expect(canViewClients(withRole('leader'))).toBe(true);
  });

  it('refuses every team-tier role (advisor, learn_advisor, payroll_staff)', () => {
    expect(canViewClients(withRole('advisor'))).toBe(false);
    expect(canViewClients(withRole('learn_advisor'))).toBe(false);
    expect(canViewClients(withRole('payroll_staff'))).toBe(false);
  });

  it('refuses a null/unauthenticated user', () => {
    expect(canViewClients(null)).toBe(false);
  });

  it('agrees exactly with "tier is not team" for every role (folds leader IN, unlike the master gates)', () => {
    for (const role of ALL_ROLES) {
      const u = withRole(role);
      expect(canViewClients(u)).toBe(tierOf(u) !== 'team');
    }
    expect(canViewClients(null)).toBe(tierOf(null) !== 'team');
  });

  it('view-as is honoured: a master previewing the team side loses the client book', () => {
    // Preview fidelity — seeing what a team member sees is the whole point of the preview.
    expect(canViewClients(withRole('super_admin'), 'team')).toBe(false);
    expect(canViewClients(withRole('super_admin'), 'admin')).toBe(true);
    expect(canViewClients(withRole('admin'), 'team')).toBe(false);
  });

  it('a team member cannot preview UP into client access', () => {
    // capabilitiesOf only lets you preview a LOWER tier, so a stray viewAs='admin' is ignored.
    expect(canViewClients(withRole('advisor'), 'admin')).toBe(false);
    expect(canViewClients(withRole('advisor'), 'master')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * tierOfRole — the role-string core of tierOf (2026-08-25)
 * ------------------------------------------------------------------ */
describe('tierOfRole agrees with tierOf for every role, incl. the empty cases', () => {
  it('maps each role to the same tier tierOf(user) would', () => {
    for (const role of ALL_ROLES) {
      expect(tierOfRole(role)).toBe(tierOf(withRole(role)));
    }
  });
  it('folds a null/undefined/unknown role to team, exactly like tierOf(null)', () => {
    expect(tierOfRole(null)).toBe('team');
    expect(tierOfRole(undefined)).toBe('team');
    expect(tierOfRole('not_a_role')).toBe('team');
    expect(tierOf(null)).toBe('team');
  });
});

/* ------------------------------------------------------------------ *
 * canonicalizeDepartment — faithful port of backend utils/rbac.js (2026-08-25).
 * Must stay byte-for-byte equivalent so the app and server silo the same people.
 * ------------------------------------------------------------------ */
describe('canonicalizeDepartment', () => {
  it('passes the 9 canonical values through (case-insensitive exact match)', () => {
    expect(canonicalizeDepartment('Operations')).toBe('Operations');
    expect(canonicalizeDepartment('operations')).toBe('Operations');
    expect(canonicalizeDepartment('TATA AIA')).toBe('TATA AIA');
    expect(canonicalizeDepartment('SALES - RENEWALS & LIC')).toBe('SALES - RENEWALS & LIC');
    expect(canonicalizeDepartment('SALES - MUTUAL FUNDS & WEALTH')).toBe('SALES - MUTUAL FUNDS & WEALTH');
    expect(canonicalizeDepartment('SALES-CGPE_Tree')).toBe('SALES-CGPE_Tree');
    expect(canonicalizeDepartment('RECRUITMENT & CALLING')).toBe('RECRUITMENT & CALLING');
    expect(canonicalizeDepartment('SALES')).toBe('SALES');
  });

  it('maps messy/legacy strings via the keyword rules', () => {
    expect(canonicalizeDepartment('renewals dept')).toBe('SALES - RENEWALS & LIC');
    expect(canonicalizeDepartment('LIC')).toBe('SALES - RENEWALS & LIC');
    expect(canonicalizeDepartment('mutual fund')).toBe('SALES - MUTUAL FUNDS & WEALTH');
    expect(canonicalizeDepartment('recruitment')).toBe('RECRUITMENT & CALLING');
    expect(canonicalizeDepartment('health')).toBe('HEALTH INSURANCE');
    expect(canonicalizeDepartment('tata')).toBe('TATA AIA');
  });

  it('returns null for the FOUR real values not in the canonical list — the known un-siloed gap', () => {
    // Verified against staff_unified 2026-08-25: these return null → "not siloed" (full role-wide
    // access). Fixing them is the backend's job; the port must match the backend, which returns null.
    expect(canonicalizeDepartment('GENERAL INSURANCE')).toBe(null);
    expect(canonicalizeDepartment('BANKING & COLLECTION')).toBe(null);
    expect(canonicalizeDepartment('DRIVER')).toBe(null);
    expect(canonicalizeDepartment('IT')).toBe(null);
  });

  it('returns null for empty / null / non-string input', () => {
    expect(canonicalizeDepartment('')).toBe(null);
    expect(canonicalizeDepartment('   ')).toBe(null);
    expect(canonicalizeDepartment(null)).toBe(null);
    expect(canonicalizeDepartment(undefined)).toBe(null);
  });
});

/* ------------------------------------------------------------------ *
 * identityOf — the "who is this person" model: role (authoritative) + department + _origRole drift.
 * Cases mirror the REAL staff_unified rows the owner reconciled on 2026-08-25.
 * ------------------------------------------------------------------ */
describe('identityOf', () => {
  it('a team advisor with a canonical department is team-tier, siloed, no drift', () => {
    // e.g. Yash Ghelani — role advisor, dept SALES, _origRole "sales" (a job title, not a demotion).
    const id = identityOf({ role: 'advisor', department: 'SALES', origRole: 'sales' });
    expect(id.tier).toBe('team');
    expect(id.department).toBe('SALES');
    expect(id.departmentRaw).toBe('SALES');
    expect(id.siloed).toBe(true);
    expect(id.drift).toBe(false); // "sales" is not an enum role → not a drift
  });

  it('flags DRIFT only when _origRole is a REAL role that differs from role (the Ved Test case)', () => {
    // Ved Test — _origRole super_admin, working role admin → a genuine post-merge demotion.
    const ved = identityOf({ role: 'admin', department: '', origRole: 'super_admin' });
    expect(ved.tier).toBe('admin');
    expect(ved.drift).toBe(true);
    // Sagar — _origRole super_admin AND role super_admin → NO drift.
    const sagar = identityOf({ role: 'super_admin', department: '', origRole: 'super_admin' });
    expect(sagar.tier).toBe('master');
    expect(sagar.drift).toBe(false);
    // A legacy job-title origin (ops/manager/driver) is NEVER a drift.
    expect(identityOf({ role: 'advisor', origRole: 'manager' }).drift).toBe(false);
    expect(identityOf({ role: 'advisor', origRole: 'driver/commute-work' }).drift).toBe(false);
  });

  it('never lets _origRole change the tier — role is authoritative', () => {
    // Even though origin was super_admin, the working role admin decides the tier (no re-promotion).
    expect(identityOf({ role: 'admin', origRole: 'super_admin' }).tier).toBe('admin');
  });

  it('keeps departmentRaw but null-canonicalises an un-recognised department (siloed:false)', () => {
    // Aashubhai — dept DRIVER → not canonical → un-siloed, but we keep the raw label for display.
    const drv = identityOf({ role: 'advisor', department: 'DRIVER', origRole: 'driver/commute-work' });
    expect(drv.department).toBe(null);
    expect(drv.departmentRaw).toBe('DRIVER');
    expect(drv.siloed).toBe(false);
  });

  it('null / empty input resolves to a team advisor with no department', () => {
    const id = identityOf(null);
    expect(id).toEqual({ role: 'advisor', tier: 'team', department: null, departmentRaw: null, siloed: false, drift: false });
    expect(identityOf({}).tier).toBe('team');
  });
});

/* ------------------------------------------------------------------ *
 * SALES-advisor client-book carve-out (backend Phase 90 / D-117, 2026-08-25).
 * The app gate MUST mirror the server's dept-based rule (isSalesDepartment/isSalesAdvisor), or the
 * app shows a tab the server 403s (or hides one it allows). Cases mirror the real reconciled roster.
 * ------------------------------------------------------------------ */
const withRoleDept = (role: Role, department?: string): User => ({ ...withRole(role), department });

describe('isSalesDepartment — the 4 SALES-* canonical departments only', () => {
  it('is true for every SALES-family department (incl. legacy variants that canonicalise into it)', () => {
    for (const d of ['SALES', 'SALES-CGPE_Tree', 'SALES - RENEWALS & LIC', 'SALES - MUTUAL FUNDS & WEALTH', 'mutual fund', 'renewals']) {
      expect(isSalesDepartment(d)).toBe(true);
    }
  });
  it('is false for non-sales departments and empties', () => {
    for (const d of ['Operations', 'TATA AIA', 'RECRUITMENT & CALLING', 'GENERAL INSURANCE', 'DRIVER', 'IT', '', null, undefined]) {
      expect(isSalesDepartment(d as any)).toBe(false);
    }
  });
});

describe('isSalesAdvisor — an advisor in a SALES department (mirrors backend middleware)', () => {
  it('admits an advisor whose department is in the SALES family', () => {
    // Yash Ghelani (SALES) and Daniesh Adak (SALES - MUTUAL FUNDS & WEALTH) — real sales advisors.
    expect(isSalesAdvisor(withRoleDept('advisor', 'SALES'))).toBe(true);
    expect(isSalesAdvisor(withRoleDept('advisor', 'SALES - MUTUAL FUNDS & WEALTH'))).toBe(true);
    // Jagdish Bhai's dept is 'SALES - RENEWALS & LIC' → the SERVER counts him as a sales advisor by
    // DEPARTMENT even though the owner describes his function as ops; the app must match the server.
    expect(isSalesAdvisor(withRoleDept('advisor', 'SALES - RENEWALS & LIC'))).toBe(true);
  });
  it('refuses a non-sales advisor, a departmentless advisor, and every non-advisor role', () => {
    expect(isSalesAdvisor(withRoleDept('advisor', 'TATA AIA'))).toBe(false);   // Pavitra — ops product line
    expect(isSalesAdvisor(withRoleDept('advisor', 'Operations'))).toBe(false);
    expect(isSalesAdvisor(withRole('advisor'))).toBe(false);                    // no department
    expect(isSalesAdvisor(withRoleDept('learn_advisor', 'SALES'))).toBe(false); // only role 'advisor'
    expect(isSalesAdvisor(withRoleDept('payroll_staff', 'SALES'))).toBe(false);
    expect(isSalesAdvisor(withRoleDept('admin', 'SALES'))).toBe(false);         // admin is caught by canViewClients, not this
    expect(isSalesAdvisor(null)).toBe(false);
  });
});

describe('canViewOwnClients — Clients list/detail: full-book tiers OR a sales advisor (own-only)', () => {
  it('admits master/admin/leader (the full-book tiers) regardless of department', () => {
    expect(canViewOwnClients(withRole('super_admin'))).toBe(true);
    expect(canViewOwnClients(withRole('admin'))).toBe(true);
    expect(canViewOwnClients(withRole('leader'))).toBe(true);
  });
  it('admits a SALES-department advisor (server scopes them own-only), refuses other team users', () => {
    expect(canViewOwnClients(withRoleDept('advisor', 'SALES'))).toBe(true);
    expect(canViewOwnClients(withRoleDept('advisor', 'TATA AIA'))).toBe(false);     // ops advisor
    expect(canViewOwnClients(withRole('advisor'))).toBe(false);                      // no dept
    expect(canViewOwnClients(withRoleDept('learn_advisor', 'SALES'))).toBe(false);
    expect(canViewOwnClients(null)).toBe(false);
  });
  it('is a strict SUPERSET of canViewClients — never narrower', () => {
    for (const role of ALL_ROLES) {
      const u = withRoleDept(role, 'SALES');
      if (canViewClients(u)) expect(canViewOwnClients(u)).toBe(true);
    }
  });
  it('honours view-as: a master previewing the team side still loses the client list', () => {
    // The carve-out reads the REAL role, and a super_admin is not a sales advisor, so previewing
    // team drops the list exactly like canViewClients does — preview fidelity is preserved.
    expect(canViewOwnClients(withRole('super_admin'), 'team')).toBe(false);
    expect(canViewOwnClients(withRole('admin'), 'team')).toBe(false);
  });
});
