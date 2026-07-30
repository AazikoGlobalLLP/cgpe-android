/**
 * CGPE access model — three completely separate experiences.
 *
 *  MASTER  (Shivam only)  — shivam@cgpe.in. Sees EVERYTHING: every admin, every team
 *                           member, org-wide analytics, all activity, all data.
 *  ADMIN   (role: admin | leader) — runs a branch/team: assigns work, monitors their
 *                           team, runs campaigns, sees the whole client book.
 *  TEAM    (advisor | learn_advisor | payroll_staff) — does the work: only their own
 *                           assigned tasks, their own attendance, client lookup, claims.
 */
import type { User } from '@/data/types';

export type Tier = 'master' | 'admin' | 'team';

/** The single master account. */
export const MASTER_EMAIL = 'shivam@cgpe.in';

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

export function tierOf(user: User | null): Tier {
  if (!user) return 'team';
  if ((user.email || '').trim().toLowerCase() === MASTER_EMAIL) return 'master';
  if (user.role === 'admin' || user.role === 'leader') return 'admin';
  return 'team';
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

/** Accent identity per tier so the three sides feel visibly different. */
export const TIER_THEME: Record<Tier, { accent: string; accent2: string; grad: [string, string, ...string[]]; badge: string }> = {
  master: { accent: '#f5b74a', accent2: '#ffd98a', grad: ['#3a2d10', '#241c0c', '#12100a'], badge: 'MASTER' },
  admin: { accent: '#8b83ff', accent2: '#b9a7ff', grad: ['#312a63', '#1e1a3e', '#12101f'], badge: 'ADMIN' },
  team: { accent: '#2ee6a6', accent2: '#7cf0c8', grad: ['#0f3b34', '#0d2a28', '#0b1a1c'], badge: 'TEAM' },
};
