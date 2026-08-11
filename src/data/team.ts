/** Team (admin view) — types only, imported with `import type` everywhere. No sample data
 *  remains: the seeded roster and activity feed were removed (see the note below). */
export type TeamActivity = { id: string; icon: string; text: string; at: string; kind: 'lead' | 'claim' | 'client' | 'attendance' | 'campaign' | 'login' };
export type TeamMember = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  agentCode: string;
  tier: string;
  branch: string;
  online: boolean;
  clockedIn: boolean;
  lastActive: string;
  stats: { clients: number; premiumMtd: number; policiesMtd: number; renewalPct: number; openClaims: number; leads: number };
  activity: TeamActivity[];
};

const now = Date.now();
const day = 86400000;
const iso = (o: number) => new Date(now + o * day).toISOString();
const at = (h: number) => new Date(now - h * 3600000).toISOString();

/**
 * PHASE 10. The seeded roster and activity feed that used to live here are gone.
 *
 * Both are now served exclusively from /profiles. This module is imported for its TYPES
 * only (every import site uses `import type`), so it is erased at compile time.
 */
export const teamMembers: TeamMember[] = [];

export function teamActivityFeed(): TeamActivity[] {
  return [];
}
