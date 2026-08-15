/**
 * CGPE access model — three completely separate experiences.
 *
 *  MASTER  (role: super_admin) — sees EVERYTHING: every admin, every team member,
 *                           org-wide analytics, all activity, all data.
 *  ADMIN   (role: admin | leader) — runs a branch/team: assigns work, monitors their
 *                           team, runs campaigns, sees the whole client book.
 *  TEAM    (advisor | learn_advisor | payroll_staff) — does the work: only their own
 *                           assigned tasks, their own attendance, client lookup, claims.
 */
import type { User } from '@/data/types';

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
export function tierOf(user: User | null): Tier {
  if (!user) return 'team';
  if (user.role === 'super_admin') return 'master';
  if (user.role === 'admin' || user.role === 'leader') return 'admin';
  return 'team';
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
