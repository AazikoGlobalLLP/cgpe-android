/** Team (admin view) — types only, imported with `import type` everywhere. The seeded roster
 *  and activity feed once exported here (plus their date helpers) were removed in the Phase 14
 *  dead-code sweep; both are served exclusively from /profiles now. */
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
