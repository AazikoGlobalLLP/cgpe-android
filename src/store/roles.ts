/**
 * CGPE access model — three completely separate experiences.
 *
 *  MASTER  (role: super_admin) — sees EVERYTHING: every admin, every team member,
 *                           org-wide analytics, all activity, all data.
 *  ADMIN   (role: admin | leader) — runs a branch/team: assigns work, monitors their
 *                           team, runs campaigns, sees the whole client book.
 *  TEAM    (advisor | learn_advisor | payroll_staff) — does the work: only their own
 *                           assigned tasks, their own attendance, claims. Since the owner's
 *                           Point-9 decision (2026-08-24) the TEAM tier no longer sees the
 *                           client book at all — see `canViewClients` below.
 */
import type { Role, User } from '@/data/types';

export type Tier = 'master' | 'admin' | 'team';

export type Capabilities = {
  tier: Tier;
  label: string;
  /** see every record in the org, not just own */
  seeEverything: boolean;
  /** manage/see the team roster + their activity */
  manageTeam: boolean;
  /** assign tasks to other people */
  assignTasks: boolean;
  /** run bulk WhatsApp campaigns */
  runCampaigns: boolean;
  /** see live agent locations / attendance of others */
  seeAgentMap: boolean;
  /** org-wide analytics dashboards */
  orgAnalytics: boolean;
  /** oversee other admins (master only) */
  overseeAdmins: boolean;
};

/**
 * `super_admin` is `Profile.role`'s own top rank — "passes every `authorize()` gate
 * unconditionally" (`contracts/enums.md` §1.1) — so it is the server's own opinion of who
 * is Master, not a client-side guess. Whoever holds that account, this survives it changing
 * hands or changing address; the previous version compiled one person's email into every APK.
 */
/**
 * The tier for a bare role string — the pure core of `tierOf`.
 *
 * Split out so `identityOf` (and any roster row that has a role but not a whole `User`) can resolve
 * the tier without fabricating a `User`. `tierOf(user)` delegates here, so its behaviour is
 * unchanged: a null/absent role folds to `team`, `super_admin` → master, `admin`/`leader` → admin.
 */
export function tierOfRole(role: string | null | undefined): Tier {
  if (role === 'super_admin') return 'master';
  if (role === 'admin' || role === 'leader') return 'admin';
  return 'team';
}

export function tierOf(user: User | null): Tier {
  return tierOfRole(user?.role);
}

/**
 * Live-location gate (Phase 40) — the ONE predicate the location surfaces share.
 *
 * Only the Master (real `super_admin`) may see where the field physically is: the live pins on
 * `agent-map` and the movement replay on `agent-track`. This reads `user.role` DIRECTLY, never
 * the folded tier or `capabilitiesOf`, on purpose: `tierOf()` folds `leader` INTO the admin
 * tier and `seeAgentMap` is true for the whole admin tier, so gating location on the tier/caps
 * would leak it to every admin and leader. Master is `super_admin` and nothing else, so a real
 * `role` comparison is both the correct rule and immune to a "view as" preview (a master
 * previewing a lower tier still holds the real role — the screen is theirs to open). Duty status
 * (on/off) is NOT a location read and stays where it was: `getTeam()` uses locations only to
 * derive a boolean and never surfaces coordinates.
 */
export function canSeeLiveLocation(user: User | null): boolean {
  return user?.role === 'super_admin';
}

/**
 * Team-performance gate (Phase 45) — who may see EVERY member's performance score.
 *
 * Only the Master (real `super_admin`) may see the whole team's scores; each member always sees
 * their OWN (that view carries no gate — the server self-scopes it). Reads `user.role` DIRECTLY,
 * never the folded tier or `capabilitiesOf`, for the exact reason `canSeeLiveLocation` does: a
 * performance roster is monitoring data, and `tierOf()` folds `leader` into the admin tier, so a
 * tier/caps gate would leak every member's score to every admin and leader. Owner-locked
 * (2026-08-15): "team members see their own; super_admin sees all." A "view as" preview still
 * holds the real role, so a master previewing a lower tier keeps access — the screen is theirs.
 */
export function canSeeTeamPerformance(user: User | null): boolean {
  return user?.role === 'super_admin';
}

/**
 * Monitoring-hub gate (Phase 39) — who may open the dedicated master monitoring surface
 * (`/monitor`, "the main side").
 *
 * The hub gathers the master-only lenses (live location, movement replay, team performance, the
 * salary roster) plus the team roster in one place. It is a CONVENIENCE ENTRY, not the security
 * authority — every destination screen keeps its own gate (`agent-map`/`agent-track`/`performance`
 * on this same real-role rule, payroll on the admin endpoint). But the hub itself reads `user.role`
 * DIRECTLY and admits only `super_admin`, for the same folded-tier reason as its siblings above:
 * `tierOf()` folds `leader` into the admin tier, so a tier/caps gate would open the whole
 * monitoring surface to every admin and leader. Kept as its own predicate (identical body to the
 * two above) so the three gates can be reasoned about — and pinned — independently and can't drift.
 */
export function canMonitorTeam(user: User | null): boolean {
  return user?.role === 'super_admin';
}

/**
 * "Viewing as" gate (Phase 47) — who may open the tier-preview affordance in More.
 *
 * Owner-locked (2026-08-15): only the Master (real `super_admin`) may preview another side; every
 * admin and leader loses the row. Reads `user.role` DIRECTLY, never the folded tier or
 * `capabilitiesOf`, for the same reason as the three gates above: the "Viewing as" row used to be
 * gated on `capabilitiesOf(user).manageTeam`, which is true for the WHOLE admin tier — and
 * `tierOf()` folds `leader` into that tier — so a caps gate showed the affordance to every admin and
 * leader. Master is `super_admin` and nothing else. Reading the REAL role (not the preview caps)
 * also keeps the row visible while a master is previewing a lower tier, so they can switch back.
 * Kept as its own predicate (identical body to the three above) so the gates can't drift.
 */
export function canViewAs(user: User | null): boolean {
  return user?.role === 'super_admin';
}

export function capabilitiesOf(user: User | null, viewAs?: Tier | null): Capabilities {
  const real = tierOf(user);
  // "View as" preview: you can only ever preview a LOWER tier than you actually hold.
  const rank: Record<Tier, number> = { team: 0, admin: 1, master: 2 };
  const tier: Tier = viewAs && rank[viewAs] <= rank[real] ? viewAs : real;
  if (tier === 'master') {
    return { tier, label: 'Master', seeEverything: true, manageTeam: true, assignTasks: true, runCampaigns: true, seeAgentMap: true, orgAnalytics: true, overseeAdmins: true };
  }
  if (tier === 'admin') {
    return { tier, label: 'Admin', seeEverything: true, manageTeam: true, assignTasks: true, runCampaigns: true, seeAgentMap: true, orgAnalytics: true, overseeAdmins: false };
  }
  return { tier, label: 'Team', seeEverything: false, manageTeam: false, assignTasks: false, runCampaigns: false, seeAgentMap: false, orgAnalytics: false, overseeAdmins: false };
}

/**
 * Client-book gate (owner decision, Point 9, 2026-08-24) — who may reach the Clients section
 * at all: the Clients tab, the Clients / Segments / Families menu entries, client rows in
 * global search, and the client / segment / family detail screens by deep link.
 *
 * Owner-locked: the imported ~9,000-client book is visible to MASTER and ADMIN only; an ordinary
 * TEAM member gets none of it. Unlike the location / performance / monitor gates above — which read
 * the REAL role because they must fold `leader` OUT of the admin tier — this rule INCLUDES the
 * whole admin tier: admin AND leader run a branch and own the book (roles.ts module doc). So it
 * reads the (view-as-aware) tier via `capabilitiesOf`: `tier !== 'team'` is exactly "admin or
 * master". Reading the preview-aware tier is deliberate — a Master previewing the Team side SHOULD
 * lose the client book, because seeing what a team member sees is the whole point of that preview;
 * they hold the real role and can switch back.
 *
 * This is the APP-SIDE half (defence-in-depth + honest UX). The SECURITY AUTHORITY is the
 * server-enforced gate on `GET /clients` + `/clients/:id`, which today has no role gate and leaks
 * the unowned book to every token — filed to INBOX for the owner to relay. The two must stay in
 * step: this predicate is what the app hides; the server is what actually refuses.
 */
export function canViewClients(user: User | null, viewAs?: Tier | null): boolean {
  return capabilitiesOf(user, viewAs).tier !== 'team';
}

/* ------------------------------------------------------------------ department + identity */

/**
 * The 9 canonical departments — MUST mirror `cgpe-backend-main/utils/rbac.js` `DEPARTMENTS`.
 *
 * Kept in step BY HAND (there is no shared package), exactly like `appUi.tsx`'s
 * `SCHEMA_FEATURE_DEFAULTS` mirrors `ui_rbac_config.json`. The app and the backend must agree on
 * which department string is "recognised", because the backend's module matrix (and any future
 * department scope) keys off this same canonicalisation — a client that canonicalised differently
 * would silo a member the server does not, or vice-versa.
 *
 * ⚠️ KNOWN DATA GAP (verified against `staff_unified`, 2026-08-25): live staff carry four values
 * that are NOT in this list — `GENERAL INSURANCE`, `BANKING & COLLECTION`, `DRIVER`, `IT` — so
 * `canonicalizeDepartment` returns `null` for them and those members read as "not siloed" (full
 * role-wide access). Adding/mapping them is the BACKEND's to own (edit `utils/rbac.js` +
 * `rbac_config`); this port stays faithful to the deployed backend so the two never disagree.
 */
export const DEPARTMENTS = [
  'SALES-CGPE_Tree',
  'SALES - RENEWALS & LIC',
  'SALES - MUTUAL FUNDS & WEALTH',
  'SALES',
  'Operations',
  'RECRUITMENT & CALLING',
  'HEALTH INSURANCE',
  'TATA AIA',
  'OTHERS',
] as const;

/**
 * Normalise a messy department string to one of the 9 canonical values, or `null`.
 *
 * A faithful port of `utils/rbac.js#canonicalizeDepartment`: exact (case-insensitive) match first,
 * then the same keyword rules, then `null` for anything unrecognised (which the backend treats as
 * "not siloed — keeps legacy role-wide access"). Keep the two byte-for-byte equivalent.
 */
export function canonicalizeDepartment(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  const exact = DEPARTMENTS.find((d) => d.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  const u = s.toUpperCase();
  if (u.includes('CGPE') && u.includes('TREE')) return 'SALES-CGPE_Tree';
  if (u.includes('RENEWAL') || u.includes('LIC')) return 'SALES - RENEWALS & LIC';
  if (u.includes('MUTUAL') || u.includes('WEALTH')) return 'SALES - MUTUAL FUNDS & WEALTH';
  if (u.includes('RECRUIT') || u.includes('CALLING')) return 'RECRUITMENT & CALLING';
  if (u.includes('HEALTH')) return 'HEALTH INSURANCE';
  if (u.includes('TATA')) return 'TATA AIA';
  if (u.includes('OPERATION')) return 'Operations';
  if (u === 'SALES' || u.includes('SALES')) return 'SALES';
  if (u === 'OTHER' || u === 'OTHERS') return 'OTHERS';
  return null; // IT / HR / GENERAL INSURANCE / BANKING & COLLECTION / DRIVER / … → not siloed
}

/** The six roles the backend enum (`Profile.role`) actually enforces. */
const ENUM_ROLES: ReadonlySet<string> = new Set<Role>([
  'payroll_staff', 'advisor', 'learn_advisor', 'leader', 'admin', 'super_admin',
]);

/**
 * The resolved "who is this person" identity — the single field the owner asked for, derived from
 * the three raw inputs (`role`, `department`, `_origRole`) with `role` AUTHORITATIVE.
 *
 *  - `tier`         : master | admin | team — from `role` ALONE (the server's authority).
 *  - `department`   : the canonical department, or `null` when unrecognised (⇒ not siloed).
 *  - `departmentRaw`: the string as stored, kept for display + for the un-siloed-but-present case.
 *  - `siloed`       : `department !== null` — whether a department wall could apply to them.
 *  - `drift`        : `_origRole` is a REAL role AND differs from `role` — a post-merge role change
 *                     to reconcile (e.g. Ved Test: origin `super_admin`, working `admin`). A legacy
 *                     job title like `ops`/`sales`/`manager` is NOT a drift — it was never an enum
 *                     role, just the merge flattening a title to `advisor`.
 *
 * `_origRole` is READ ONLY to raise `drift`; it is never allowed to change the tier — that would
 * silently re-grant power the working `role` has already dropped.
 */
export type Identity = {
  role: string;
  tier: Tier;
  department: string | null;
  departmentRaw: string | null;
  siloed: boolean;
  drift: boolean;
};

export function identityOf(
  input: { role?: string | null; department?: string | null; origRole?: string | null } | null,
): Identity {
  const role = input?.role ?? 'advisor';
  const departmentRaw = typeof input?.department === 'string' && input.department.trim()
    ? input.department.trim()
    : null;
  const department = canonicalizeDepartment(departmentRaw);
  const orig = typeof input?.origRole === 'string' ? input.origRole.trim() : '';
  const drift = !!orig && ENUM_ROLES.has(orig) && orig !== role;
  return { role, tier: tierOfRole(role), department, departmentRaw, siloed: department !== null, drift };
}

/**
 * True when a raw department string is in the SALES family — mirrors backend
 * `utils/rbac.isSalesDepartment` (P90/D-117): a canonical department that starts with "SALES"
 * (`SALES-CGPE_Tree`, `SALES - RENEWALS & LIC`, `SALES - MUTUAL FUNDS & WEALTH`, `SALES`).
 * `Operations` / `GENERAL INSURANCE` / `OTHERS` are NOT sales. Composes `canonicalizeDepartment`
 * so the app and the server share ONE department vocabulary.
 */
export function isSalesDepartment(raw: string | null | undefined): boolean {
  const canon = canonicalizeDepartment(raw);
  return !!canon && canon.toUpperCase().startsWith('SALES');
}

/**
 * A SALES-department advisor — mirrors backend `middleware/auth.isSalesAdvisor` (P90/D-117).
 * The server admits exactly these team users to a STRICT own-only client view (`GET /clients` +
 * `GET /clients/:id`, scoped to `advisor_id === them`, never the unowned firm book, never another
 * advisor's client). Reads the REAL role + department — never the view-as tier — so the app gate
 * matches the server's token-based decision. Every other team role (learn_advisor / payroll_staff)
 * and every non-sales advisor stays fully 403'd on the book.
 */
export function isSalesAdvisor(user: User | null): boolean {
  return !!user && user.role === 'advisor' && isSalesDepartment(user.department);
}

/**
 * Who may open the Clients LIST + a client DETAIL: the full-book tiers (master/admin/leader, via
 * `canViewClients`) OR a sales-department advisor (own-only, server-enforced strict — P90/D-117).
 *
 * Use this ONLY for the two surfaces the backend opened to a sales advisor (`GET /clients`,
 * `GET /clients/:id` — and the client-search that rides the list endpoint). The WHOLE-BOOK surfaces
 * — segments, families, campaigns, birthdays, generate-report — stay on `canViewClients`, because
 * the server keeps `requireClientBook` (master/admin/leader) on them and 403s a sales advisor; the
 * app must not show those to one.
 */
export function canViewOwnClients(user: User | null, viewAs?: Tier | null): boolean {
  return canViewClients(user, viewAs) || isSalesAdvisor(user);
}

/**
 * Accent identity per tier so the three sides feel visibly different.
 *
 * Retinted onto the panel's azure-teal identity: admin takes the brand azure, team takes
 * the brand teal, and master keeps gold — gold reads as seniority and is the one hue that
 * stays legible against both. The previous violet/emerald pair predated the brand port and
 * clashed with the new palette.
 */
export const TIER_THEME: Record<Tier, { accent: string; accent2: string; grad: [string, string, ...string[]]; badge: string }> = {
  master: { accent: '#f5b74a', accent2: '#ffd98a', grad: ['#3a2d10', '#241c0c', '#12100a'], badge: 'MASTER' },
  admin: { accent: '#3182ed', accent2: '#8cc2ff', grad: ['#12314f', '#0b1c30', '#060d17'], badge: 'ADMIN' },
  team: { accent: '#1dd7bf', accent2: '#6ff5e4', grad: ['#0b3b36', '#0a2a28', '#08191c'], badge: 'TEAM' },
};
