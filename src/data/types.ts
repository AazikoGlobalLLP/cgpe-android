/** Domain types — mirror the CGPE backend shapes the mobile app consumes. */

export type Role = 'advisor' | 'learn_advisor' | 'leader' | 'admin' | 'payroll_staff' | 'super_admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  designation: string;
  branch: string;
  agentCode: string;
  photo?: string;
  tier: 'Star' | 'MDRT' | 'COT' | 'TOT' | 'Growth';
}

/**
 * PHASE 4: these are `Lead.status`'s five enforced values, verbatim —
 * `contracts/enums.md:212`, `contracts/models.md:147`, `models/Lead.js:29-34`.
 *
 * They are the ONLY lead words the server will store: `PUT /api/leads/:id` validates against
 * this exact list (`routes/leads.js:367-370`) and `stage` is not a path on the schema at all.
 * The app used to carry its own six (`new contacted meeting proposal closed_won closed_lost`),
 * three of which existed nowhere on the server, so no stage change could ever persist.
 *
 * `contracts/enums.md` §15 lists three further lead vocabularies (the query-engine dropdown,
 * `queryEngine.js:194`, and the raw `leads.stage` key) and says in terms: do not merge them.
 * The app property is still called `stage` — it is internal and carries no vocabulary of its own.
 */
export type LeadStage = 'new_lead' | 'meeting_scheduled' | 'docs_shared' | 'policy_issued' | 'lost';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  stage: LeadStage;
  source: string;
  interest: string;
  potential: number; // premium potential ₹
  city: string;
  priority: 'hot' | 'warm' | 'cold';
  nextAction?: string;
  nextActionDate?: string;
  createdAt: string;
  lastActivity: string;
  notes: LeadNote[];
}

export interface LeadNote {
  id: string;
  text: string;
  at: string;
}

export interface Policy {
  id: string;
  plan: string;
  number: string;
  sumAssured: number;
  premium: number;
  frequency: 'Yearly' | 'Half-Yearly' | 'Quarterly' | 'Monthly';
  startDate: string;
  maturityDate: string;
  nextRenewal: string;
  status: 'in_force' | 'lapsed' | 'matured' | 'paid_up';
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  dob: string;
  family?: string;
  totalPremium: number;
  totalCover: number;
  policies: Policy[];
  segment: ('hot_lead' | 'renewal_due' | 'maturity_soon' | 'birthday' | 'cross_sell')[];
  since: string;
}

export type ClaimStatus = 'intake' | 'docs_pending' | 'under_review' | 'submitted' | 'settled' | 'rejected';

export interface ClaimDoc {
  id: string;
  name: string;
  received: boolean;
}

export interface ClaimEvent {
  id: string;
  label: string;
  at: string;
  by: string;
}

export interface Claim {
  id: string;
  ref: string;
  clientName: string;
  clientPhone: string;
  type: 'Maturity' | 'Death' | 'Health' | 'Surrender' | 'Accident';
  policyNumber: string;
  amount: number;
  status: ClaimStatus;
  insurer: string;
  openedAt: string;
  ageDays: number;
  docs: ClaimDoc[];
  timeline: ClaimEvent[];
  aiSummary?: string;
}

export type ReminderType = 'birthday' | 'anniversary' | 'renewal' | 'maturity' | 'followup' | 'meeting';

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  subtitle: string;
  clientName?: string;
  phone?: string;
  date: string;
  done: boolean;
}

export interface CommissionMonth {
  month: string; // "Jul"
  amount: number;
}

export interface Commission {
  thisMonth: number;
  lastMonth: number;
  pending: number;
  ytd: number;
  target: number;
  history: CommissionMonth[];
  recent: { id: string; client: string; plan: string; amount: number; date: string }[];
}

export interface WaMessage {
  id: string;
  fromMe: boolean;
  text: string;
  at: string;
}

export interface WaThread {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  tag?: string;
  messages: WaMessage[];
}

export interface AppNotification {
  id: string;
  icon: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  kind: 'claim' | 'lead' | 'renewal' | 'system' | 'contest';
}

export interface LicPlan {
  id: string;
  name: string;
  code: string;
  type: string;
  minAge: number;
  maxAge: number;
  term: string;
  highlight: string;
  tags: string[];
}

export interface Contest {
  id: string;
  name: string;
  reward: string;
  progress: number; // 0..1
  metric: string;
  ends: string;
  rank?: number;
}
