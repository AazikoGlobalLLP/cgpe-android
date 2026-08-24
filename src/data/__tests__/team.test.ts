/**
 * Band 2 #3 — `filterMembers`, the pure roster filter shared by the assignee + transfer pickers.
 *
 * Pinned here because the pickers now source the FULL staff directory, so this filter is the only
 * thing that lets an entitled user reach a colleague past the render cap. The contract that matters:
 * a blank query is a no-op BY REFERENCE (so a small roster renders untouched), and a multi-word query
 * is an AND across name/branch/role (so "rajesh surat" narrows, not widens).
 */
import { describe, expect, it } from 'vitest';
import { filterMembers } from '@/data/team';
import type { TeamMember } from '@/data/team';

const mk = (over: Partial<TeamMember>): TeamMember => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: over.name ?? 'Member',
  role: over.role ?? 'advisor',
  phone: '',
  agentCode: '',
  tier: 'Growth',
  branch: over.branch ?? '',
  online: true,
  clockedIn: false,
  lastActive: '',
  stats: { clients: 0, premiumMtd: 0, policiesMtd: 0, renewalPct: 0, openClaims: 0, leads: 0 },
  activity: [],
  ...over,
});

const roster: TeamMember[] = [
  mk({ id: '1', name: 'Rajesh Patel', branch: 'Surat', role: 'advisor' }),
  mk({ id: '2', name: 'Priya Shah', branch: 'Adajan', role: 'leader' }),
  mk({ id: '3', name: 'Amit Rajput', branch: 'Katargam', role: 'admin' }),
];

describe('filterMembers', () => {
  it('a blank query returns the SAME array reference (a no-op, so a small roster renders untouched)', () => {
    expect(filterMembers(roster, '')).toBe(roster);
    expect(filterMembers(roster, '   ')).toBe(roster);
  });

  it('matches a name case-insensitively', () => {
    expect(filterMembers(roster, 'rajesh').map((m) => m.id)).toEqual(['1']);
    expect(filterMembers(roster, 'PRIYA').map((m) => m.id)).toEqual(['2']);
  });

  it('matches on branch or role, not only the name', () => {
    expect(filterMembers(roster, 'surat').map((m) => m.id)).toEqual(['1']);
    expect(filterMembers(roster, 'leader').map((m) => m.id)).toEqual(['2']);
  });

  it('requires EVERY whitespace-separated token to match (AND across fields)', () => {
    // "rajesh surat" hits name+branch of #1 only; it must NOT also surface #3 (whose name has "Raj").
    expect(filterMembers(roster, 'rajesh surat').map((m) => m.id)).toEqual(['1']);
    // A token that matches nobody drops the whole result to empty.
    expect(filterMembers(roster, 'rajesh adajan')).toEqual([]);
  });

  it('a substring shared by several members returns all of them', () => {
    // "raj" is in "Rajesh" (#1) and "Rajput" (#3).
    expect(filterMembers(roster, 'raj').map((m) => m.id).sort()).toEqual(['1', '3']);
  });

  it('a query that matches nobody returns an empty array', () => {
    expect(filterMembers(roster, 'zzzz')).toEqual([]);
  });
});
