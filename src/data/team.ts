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

/**
 * Filter a roster for the assignee / transfer pickers (Band 2 #3). Pure, so it is unit-tested and
 * shared by BOTH pickers (no drift). A blank query returns the list unchanged BY REFERENCE. Otherwise
 * every whitespace-separated token must appear (case-insensitively) somewhere in the member's name,
 * branch or role — so "raj" and "rajesh surat" both narrow correctly. Kept as a plain substring match
 * (not the fuzzy search scorer) because a picker filter should be predictable, not ranked.
 */
export function filterMembers(list: TeamMember[], query: string): TeamMember[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return list;
  return list.filter((m) => {
    const hay = `${m.name} ${m.branch} ${m.role}`.toLowerCase();
    return tokens.every((tok) => hay.includes(tok));
  });
}
