/** Team (admin view) — types + sample data. Real endpoints tried first in api.ts. */
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

export const teamMembers: TeamMember[] = [
  {
    id: 'tm1', name: 'Rahul Patel', role: 'advisor', phone: '+91 98250 41122', email: 'rahul.patel@cgpe.in',
    agentCode: 'LIC-0058231', tier: 'MDRT', branch: 'Anand · 82C', online: true, clockedIn: true, lastActive: at(0.2),
    stats: { clients: 128, premiumMtd: 184500, policiesMtd: 6, renewalPct: 94, openClaims: 3, leads: 10 },
    activity: [
      { id: 'a1', icon: 'funnel', text: 'Moved lead “Kiran Shah” to Meeting', at: at(1), kind: 'lead' },
      { id: 'a2', icon: 'shield', text: 'Opened claim CLM-2026-0184', at: at(3), kind: 'claim' },
      { id: 'a3', icon: 'location', text: 'Clocked in · Anand', at: at(8), kind: 'attendance' },
    ],
  },
  {
    id: 'tm2', name: 'Priya Sharma', role: 'advisor', phone: '+91 99042 55031', agentCode: 'LIC-0061190',
    tier: 'Star', branch: 'Nadiad · 71B', online: true, clockedIn: true, lastActive: at(0.6),
    stats: { clients: 96, premiumMtd: 142000, policiesMtd: 5, renewalPct: 91, openClaims: 1, leads: 7 },
    activity: [
      { id: 'a4', icon: 'gift', text: 'Sent 12 birthday greetings', at: at(2), kind: 'campaign' },
      { id: 'a5', icon: 'person-add', text: 'Added lead “Meera Joshi”', at: at(5), kind: 'lead' },
    ],
  },
  {
    id: 'tm3', name: 'Amit Desai', role: 'learn_advisor', phone: '+91 98795 71234', agentCode: 'LIC-0071445',
    tier: 'Growth', branch: 'Anand · 82C', online: false, clockedIn: false, lastActive: at(20),
    stats: { clients: 34, premiumMtd: 48000, policiesMtd: 2, renewalPct: 88, openClaims: 0, leads: 4 },
    activity: [
      { id: 'a6', icon: 'school', text: 'Completed “Jeevan Anand” training module', at: at(22), kind: 'login' },
      { id: 'a7', icon: 'call', text: 'Logged 8 follow-up calls', at: at(26), kind: 'client' },
    ],
  },
  {
    id: 'tm4', name: 'Sneha Trivedi', role: 'advisor', phone: '+91 97129 88420', agentCode: 'LIC-0059882',
    tier: 'COT', branch: 'Vidyanagar · 82D', online: true, clockedIn: false, lastActive: at(2),
    stats: { clients: 152, premiumMtd: 221000, policiesMtd: 8, renewalPct: 96, openClaims: 2, leads: 12 },
    activity: [
      { id: 'a8', icon: 'cash', text: 'Booked ₹2.2L premium (Jeevan Umang)', at: at(4), kind: 'client' },
      { id: 'a9', icon: 'shield-checkmark', text: 'Settled claim CLM-2026-0165', at: at(9), kind: 'claim' },
    ],
  },
  {
    id: 'tm5', name: 'Vijay Chauhan', role: 'advisor', phone: '+91 94263 10099', agentCode: 'LIC-0063201',
    tier: 'Star', branch: 'Borsad · 82E', online: false, clockedIn: false, lastActive: at(30),
    stats: { clients: 71, premiumMtd: 89000, policiesMtd: 3, renewalPct: 85, openClaims: 1, leads: 5 },
    activity: [{ id: 'a10', icon: 'refresh-circle', text: 'Sent 24 renewal reminders', at: at(28), kind: 'campaign' }],
  },
  {
    id: 'tm6', name: 'Hetal Mehta', role: 'advisor', phone: '+91 99251 45670', agentCode: 'LIC-0064777',
    tier: 'MDRT', branch: 'Nadiad · 71B', online: true, clockedIn: true, lastActive: at(0.1),
    stats: { clients: 143, premiumMtd: 198000, policiesMtd: 7, renewalPct: 93, openClaims: 4, leads: 9 },
    activity: [
      { id: 'a11', icon: 'funnel', text: 'Closed lead “Sanjay Bhatt” (Won)', at: at(1.5), kind: 'lead' },
      { id: 'a12', icon: 'location', text: 'Clocked in · Nadiad', at: at(7), kind: 'attendance' },
    ],
  },
];

export function teamActivityFeed(): TeamActivity[] {
  return teamMembers
    .flatMap((m) => m.activity.map((a) => ({ ...a, text: `${m.name.split(' ')[0]}: ${a.text}` })))
    .sort((x, y) => +new Date(y.at) - +new Date(x.at))
    .slice(0, 20);
}
