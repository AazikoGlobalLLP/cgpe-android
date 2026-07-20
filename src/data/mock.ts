/* eslint-disable */
import type {
  User, Lead, Client, Claim, Reminder, Commission, WaThread,
  AppNotification, LicPlan, Contest,
} from './types';

/** Relative-date helpers so the demo always looks "today-fresh". */
const now = Date.now();
const day = 86400000;
const d = (offsetDays: number, hour = 10, min = 0) => {
  const dt = new Date(now + offsetDays * day);
  dt.setHours(hour, min, 0, 0);
  return dt.toISOString();
};
const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString();

export const currentUser: User = {
  id: 'u1',
  name: 'Rahul Patel',
  email: 'rahul.patel@cgpe.in',
  phone: '+91 98250 41122',
  role: 'admin',
  designation: 'Branch Admin · Development Officer',
  branch: 'Anand Branch · 82C',
  agentCode: 'LIC-0058231',
  tier: 'MDRT',
};

export const leads: Lead[] = [
  {
    id: 'l1', name: 'Kiran Shah', phone: '+91 99042 33110', stage: 'meeting', source: 'Referral',
    interest: 'Jeevan Anand · Child plan', potential: 145000, city: 'Anand', priority: 'hot',
    nextAction: 'Meeting at his office', nextActionDate: iso(0), createdAt: iso(-4), lastActivity: iso(0),
    notes: [
      { id: 'n1', text: 'Wants ₹25L cover, prefers yearly mode. Compare Jeevan Anand vs Jeevan Labh.', at: iso(-1) },
      { id: 'n2', text: 'Referred by Nileshbhai. Budget ~₹1.4L/yr.', at: iso(-4) },
    ],
  },
  {
    id: 'l2', name: 'Pooja Desai', phone: '+91 90991 55208', stage: 'new', source: 'WhatsApp campaign',
    interest: 'Term + Tax saving', potential: 60000, city: 'Vidyanagar', priority: 'warm',
    nextAction: 'First call', nextActionDate: iso(0), createdAt: iso(0), lastActivity: iso(0), notes: [],
  },
  {
    id: 'l3', name: 'Nilesh Chauhan', phone: '+91 98795 71234', stage: 'proposal', source: 'Existing client',
    interest: 'Jeevan Umang · Pension', potential: 220000, city: 'Nadiad', priority: 'hot',
    nextAction: 'Send proposal PDF', nextActionDate: iso(1), createdAt: iso(-9), lastActivity: iso(-1),
    notes: [{ id: 'n3', text: 'Proposal illustration shared. Awaiting spouse discussion.', at: iso(-1) }],
  },
  {
    id: 'l4', name: 'Anjali Mehta', phone: '+91 97129 88420', stage: 'contacted', source: 'Facebook',
    interest: 'Child education plan', potential: 96000, city: 'Anand', priority: 'warm',
    nextAction: 'Follow up call', nextActionDate: iso(2), createdAt: iso(-6), lastActivity: iso(-2), notes: [],
  },
  {
    id: 'l5', name: 'Rakesh Solanki', phone: '+91 94263 10099', stage: 'new', source: 'Walk-in',
    interest: 'Jeevan Labh', potential: 84000, city: 'Borsad', priority: 'cold',
    nextAction: 'Qualify budget', createdAt: iso(-1), lastActivity: iso(-1), notes: [],
  },
  {
    id: 'l6', name: 'Hetal Trivedi', phone: '+91 99251 45670', stage: 'meeting', source: 'Referral',
    interest: 'Endowment + ULIP', potential: 175000, city: 'Anand', priority: 'hot',
    nextAction: 'Product comparison meeting', nextActionDate: iso(1), createdAt: iso(-7), lastActivity: iso(-1), notes: [],
  },
  {
    id: 'l7', name: 'Sanjay Bhatt', phone: '+91 90333 21876', stage: 'closed_won', source: 'Referral',
    interest: 'New Endowment', potential: 130000, city: 'Nadiad', priority: 'warm',
    createdAt: iso(-20), lastActivity: iso(-3), notes: [{ id: 'n4', text: 'Policy issued 🎉', at: iso(-3) }],
  },
  {
    id: 'l8', name: 'Meena Rao', phone: '+91 98987 44521', stage: 'contacted', source: 'WhatsApp campaign',
    interest: 'Health rider', potential: 42000, city: 'Vidyanagar', priority: 'cold',
    nextAction: 'Share brochure', createdAt: iso(-3), lastActivity: iso(-2), notes: [],
  },
  {
    id: 'l9', name: 'Dhruv Parmar', phone: '+91 91045 66230', stage: 'proposal', source: 'Referral',
    interest: 'Jeevan Anand ₹50L', potential: 285000, city: 'Anand', priority: 'hot',
    nextAction: 'Close — collect cheque', nextActionDate: iso(0), createdAt: iso(-12), lastActivity: iso(0), notes: [],
  },
  {
    id: 'l10', name: 'Falguni Joshi', phone: '+91 99786 00341', stage: 'closed_lost', source: 'Facebook',
    interest: 'Term plan', potential: 30000, city: 'Borsad', priority: 'cold',
    createdAt: iso(-15), lastActivity: iso(-8), notes: [{ id: 'n5', text: 'Went with a competitor.', at: iso(-8) }],
  },
];

export const clients: Client[] = [
  {
    id: 'c1', name: 'Rameshbhai Patel', phone: '+91 98240 11002', email: 'ramesh.patel@gmail.com', city: 'Anand',
    dob: '1971-07-22', family: 'Patel (Anand)', totalPremium: 186000, totalCover: 4200000, since: '2009',
    segment: ['renewal_due', 'cross_sell'],
    policies: [
      { id: 'p1', plan: 'LIC Jeevan Anand', number: '82C-4410021', sumAssured: 2500000, premium: 118000, frequency: 'Yearly', startDate: '2016-08-01', maturityDate: '2041-08-01', nextRenewal: iso(6), status: 'in_force' },
      { id: 'p2', plan: 'LIC New Endowment', number: '82C-4410088', sumAssured: 1700000, premium: 68000, frequency: 'Yearly', startDate: '2019-03-10', maturityDate: '2039-03-10', nextRenewal: iso(41), status: 'in_force' },
    ],
  },
  {
    id: 'c2', name: 'Manishaben Shah', phone: '+91 99048 55210', city: 'Vidyanagar', dob: '1985-07-21',
    family: 'Shah', totalPremium: 92000, totalCover: 2000000, since: '2014', segment: ['birthday', 'maturity_soon'],
    policies: [
      { id: 'p3', plan: 'LIC Jeevan Labh', number: '82C-5521190', sumAssured: 2000000, premium: 92000, frequency: 'Yearly', startDate: '2015-07-01', maturityDate: iso(70), nextRenewal: iso(120), status: 'in_force' },
    ],
  },
  {
    id: 'c3', name: 'Jayeshbhai Desai', phone: '+91 98795 22118', city: 'Nadiad', dob: '1968-11-03',
    family: 'Desai (Nadiad)', totalPremium: 240000, totalCover: 6500000, since: '2005', segment: ['cross_sell'],
    policies: [
      { id: 'p4', plan: 'LIC Jeevan Umang', number: '82C-3310455', sumAssured: 4000000, premium: 155000, frequency: 'Yearly', startDate: '2012-01-15', maturityDate: '2042-01-15', nextRenewal: iso(88), status: 'in_force' },
      { id: 'p5', plan: 'LIC Jeevan Anand', number: '82C-3310460', sumAssured: 2500000, premium: 85000, frequency: 'Half-Yearly', startDate: '2018-06-20', maturityDate: '2043-06-20', nextRenewal: iso(20), status: 'in_force' },
    ],
  },
  {
    id: 'c4', name: 'Sunitaben Trivedi', phone: '+91 99251 78003', city: 'Anand', dob: '1979-07-25',
    family: 'Trivedi', totalPremium: 54000, totalCover: 1500000, since: '2017', segment: ['birthday', 'renewal_due'],
    policies: [
      { id: 'p6', plan: 'LIC New Jeevan Anand', number: '82C-6640012', sumAssured: 1500000, premium: 54000, frequency: 'Yearly', startDate: '2017-07-05', maturityDate: '2042-07-05', nextRenewal: iso(4), status: 'in_force' },
    ],
  },
  {
    id: 'c5', name: 'Amitbhai Chauhan', phone: '+91 94265 33440', city: 'Borsad', dob: '1990-02-14',
    family: 'Chauhan', totalPremium: 36000, totalCover: 1000000, since: '2020', segment: ['cross_sell'],
    policies: [
      { id: 'p7', plan: 'LIC Tech Term', number: '82C-7710233', sumAssured: 1000000, premium: 36000, frequency: 'Yearly', startDate: '2020-09-01', maturityDate: '2050-09-01', nextRenewal: iso(55), status: 'in_force' },
    ],
  },
  {
    id: 'c6', name: 'Nileshbhai Joshi', phone: '+91 98987 11229', city: 'Anand', dob: '1975-05-30',
    family: 'Joshi', totalPremium: 128000, totalCover: 3000000, since: '2011', segment: ['maturity_soon'],
    policies: [
      { id: 'p8', plan: 'LIC Jeevan Saral', number: '82C-2210087', sumAssured: 1200000, premium: 60000, frequency: 'Yearly', startDate: '2011-04-01', maturityDate: iso(120), nextRenewal: iso(30), status: 'in_force' },
      { id: 'p9', plan: 'LIC New Endowment', number: '82C-2210090', sumAssured: 1800000, premium: 68000, frequency: 'Yearly', startDate: '2016-04-01', maturityDate: '2041-04-01', nextRenewal: iso(9), status: 'in_force' },
    ],
  },
  {
    id: 'c7', name: 'Bhavnaben Mehta', phone: '+91 97120 66554', city: 'Vidyanagar', dob: '1988-09-12',
    family: 'Mehta', totalPremium: 72000, totalCover: 2200000, since: '2018', segment: ['cross_sell', 'birthday'],
    policies: [
      { id: 'p10', plan: 'LIC Jeevan Labh', number: '82C-8810322', sumAssured: 2200000, premium: 72000, frequency: 'Yearly', startDate: '2018-10-01', maturityDate: '2038-10-01', nextRenewal: iso(75), status: 'in_force' },
    ],
  },
  {
    id: 'c8', name: 'Prakashbhai Solanki', phone: '+91 94264 90011', city: 'Nadiad', dob: '1963-03-19',
    family: 'Solanki', totalPremium: 310000, totalCover: 8000000, since: '2001', segment: ['maturity_soon'],
    policies: [
      { id: 'p11', plan: 'LIC Jeevan Umang', number: '82C-1120044', sumAssured: 5000000, premium: 210000, frequency: 'Yearly', startDate: '2008-02-01', maturityDate: iso(150), nextRenewal: iso(48), status: 'in_force' },
      { id: 'p12', plan: 'LIC Jeevan Anand', number: '82C-1120050', sumAssured: 3000000, premium: 100000, frequency: 'Yearly', startDate: '2015-02-01', maturityDate: '2040-02-01', nextRenewal: iso(15), status: 'in_force' },
    ],
  },
];

export const claims: Claim[] = [
  {
    id: 'cl1', ref: 'CLM-2026-0184', clientName: 'Kantaben Patel', clientPhone: '+91 98240 77120',
    type: 'Maturity', policyNumber: '82C-3300121', amount: 1850000, status: 'docs_pending',
    insurer: 'LIC of India', openedAt: iso(-3), ageDays: 3,
    aiSummary: 'Maturity claim ready for processing. Missing bank NEFT mandate & original policy bond.',
    docs: [
      { id: 'd1', name: 'Discharge form', received: true },
      { id: 'd2', name: 'Original policy bond', received: false },
      { id: 'd3', name: 'NEFT bank mandate', received: false },
      { id: 'd4', name: 'ID proof (Aadhaar/PAN)', received: true },
    ],
    timeline: [
      { id: 't1', label: 'Claim opened via WhatsApp intake', at: iso(-3), by: 'AI-Ops' },
      { id: 't2', label: 'Documents requested from client', at: iso(-3), by: 'Rahul Patel' },
      { id: 't3', label: 'Discharge form received', at: iso(-1), by: 'AI-Ops' },
    ],
  },
  {
    id: 'cl2', ref: 'CLM-2026-0179', clientName: 'Vijaybhai Shah', clientPhone: '+91 99048 22001',
    type: 'Health', policyNumber: '82C-4420190', amount: 145000, status: 'under_review',
    insurer: 'Star Health (TPA)', openedAt: iso(-6), ageDays: 6,
    aiSummary: 'Cashless hospitalisation. TPA reviewing. All documents complete.',
    docs: [
      { id: 'd5', name: 'Hospital bills', received: true },
      { id: 'd6', name: 'Discharge summary', received: true },
      { id: 'd7', name: 'Diagnostic reports', received: true },
    ],
    timeline: [
      { id: 't4', label: 'Claim opened', at: iso(-6), by: 'Rahul Patel' },
      { id: 't5', label: 'All documents verified', at: iso(-4), by: 'AI-Ops' },
      { id: 't6', label: 'Submitted to TPA', at: iso(-3), by: 'Rahul Patel' },
    ],
  },
  {
    id: 'cl3', ref: 'CLM-2026-0171', clientName: 'Ushaben Desai', clientPhone: '+91 98795 90112',
    type: 'Death', policyNumber: '82C-2200455', amount: 4000000, status: 'submitted',
    insurer: 'LIC of India', openedAt: iso(-12), ageDays: 12,
    aiSummary: 'Death claim submitted to branch. High value — priority follow-up recommended.',
    docs: [
      { id: 'd8', name: 'Death certificate', received: true },
      { id: 'd9', name: 'Claim form A', received: true },
      { id: 'd10', name: 'Nominee KYC', received: true },
      { id: 'd11', name: 'Policy bond', received: true },
    ],
    timeline: [
      { id: 't7', label: 'Claim intake', at: iso(-12), by: 'Rahul Patel' },
      { id: 't8', label: 'Documents collected', at: iso(-8), by: 'Rahul Patel' },
      { id: 't9', label: 'Submitted to LIC branch', at: iso(-5), by: 'Rahul Patel' },
    ],
  },
  {
    id: 'cl4', ref: 'CLM-2026-0165', clientName: 'Rameshbhai Patel', clientPhone: '+91 98240 11002',
    type: 'Maturity', policyNumber: '82C-4410099', amount: 920000, status: 'settled',
    insurer: 'LIC of India', openedAt: iso(-25), ageDays: 25,
    aiSummary: 'Settled. ₹9.2L credited to client account.',
    docs: [{ id: 'd12', name: 'All documents', received: true }],
    timeline: [
      { id: 't10', label: 'Claim opened', at: iso(-25), by: 'Rahul Patel' },
      { id: 't11', label: 'Amount credited to client', at: iso(-2), by: 'LIC of India' },
    ],
  },
  {
    id: 'cl5', ref: 'CLM-2026-0158', clientName: 'Maheshbhai Rao', clientPhone: '+91 94268 12300',
    type: 'Accident', policyNumber: '82C-5510233', amount: 500000, status: 'intake',
    insurer: 'LIC of India', openedAt: iso(0), ageDays: 0,
    aiSummary: 'New accident claim. Needs FIR copy & medical certificate to proceed.',
    docs: [
      { id: 'd13', name: 'FIR copy', received: false },
      { id: 'd14', name: 'Medical certificate', received: false },
      { id: 'd15', name: 'Policy bond', received: false },
    ],
    timeline: [{ id: 't12', label: 'Claim intake started', at: iso(0), by: 'Rahul Patel' }],
  },
];

export const reminders: Reminder[] = [
  { id: 'r1', type: 'renewal', title: 'Renewal due — Sunitaben Trivedi', subtitle: 'New Jeevan Anand · ₹54,000 · in 4 days', clientName: 'Sunitaben Trivedi', phone: '+91 99251 78003', date: iso(0), done: false },
  { id: 'r2', type: 'birthday', title: 'Birthday — Manishaben Shah', subtitle: 'Turning 41 today · send greeting', clientName: 'Manishaben Shah', phone: '+91 99048 55210', date: iso(0), done: false },
  { id: 'r3', type: 'meeting', title: 'Meeting — Kiran Shah', subtitle: '11:00 AM · Jeevan Anand discussion', clientName: 'Kiran Shah', phone: '+91 99042 33110', date: iso(0), done: false },
  { id: 'r4', type: 'followup', title: 'Follow up — Dhruv Parmar', subtitle: 'Close ₹50L proposal · collect cheque', clientName: 'Dhruv Parmar', phone: '+91 91045 66230', date: iso(0), done: false },
  { id: 'r5', type: 'renewal', title: 'Renewal due — Rameshbhai Patel', subtitle: 'Jeevan Anand · ₹1,18,000 · in 6 days', clientName: 'Rameshbhai Patel', phone: '+91 98240 11002', date: iso(0), done: false },
  { id: 'r6', type: 'birthday', title: 'Birthday — Sunitaben Trivedi', subtitle: 'Send WhatsApp greeting', clientName: 'Sunitaben Trivedi', phone: '+91 99251 78003', date: iso(1), done: false },
  { id: 'r7', type: 'maturity', title: 'Maturity soon — Nileshbhai Joshi', subtitle: 'Jeevan Saral matures in 4 months', clientName: 'Nileshbhai Joshi', phone: '+91 98987 11229', date: iso(2), done: false },
  { id: 'r8', type: 'anniversary', title: 'Policy anniversary — Bhavnaben Mehta', subtitle: 'Jeevan Labh · 8 years', clientName: 'Bhavnaben Mehta', phone: '+91 97120 66554', date: iso(-1), done: true },
];

export const commission: Commission = {
  thisMonth: 184500,
  lastMonth: 152000,
  pending: 96200,
  ytd: 1245000,
  target: 250000,
  history: [
    { month: 'Feb', amount: 142000 },
    { month: 'Mar', amount: 168000 },
    { month: 'Apr', amount: 121000 },
    { month: 'May', amount: 195000 },
    { month: 'Jun', amount: 152000 },
    { month: 'Jul', amount: 184500 },
  ],
  recent: [
    { id: 'cm1', client: 'Sanjay Bhatt', plan: 'New Endowment', amount: 26000, date: iso(-3) },
    { id: 'cm2', client: 'Amitbhai Chauhan', plan: 'Tech Term', amount: 7200, date: iso(-6) },
    { id: 'cm3', client: 'Jayeshbhai Desai', plan: 'Jeevan Anand (HY)', amount: 17000, date: iso(-9) },
    { id: 'cm4', client: 'Bhavnaben Mehta', plan: 'Jeevan Labh', amount: 14400, date: iso(-14) },
  ],
};

export const waThreads: WaThread[] = [
  {
    id: 'w1', name: 'Kiran Shah', phone: '+919904233110', lastMessage: 'Ok Rahulbhai, see you at 11 👍', lastAt: iso(0), unread: 2, tag: 'Hot lead',
    messages: [
      { id: 'm1', fromMe: true, text: 'Namaste Kiranbhai! Sharing the Jeevan Anand illustration for ₹25L cover.', at: d(-1, 9, 12) },
      { id: 'm2', fromMe: false, text: 'Thank you. Premium looks fine. Can we meet tomorrow?', at: d(-1, 9, 40) },
      { id: 'm3', fromMe: true, text: 'Sure, 11 AM at your office works for me.', at: d(0, 8, 15) },
      { id: 'm4', fromMe: false, text: 'Ok Rahulbhai, see you at 11 👍', at: d(0, 8, 20) },
    ],
  },
  {
    id: 'w2', name: 'Manishaben Shah', phone: '+919904855210', lastMessage: 'Happy to renew, please send link', lastAt: iso(0), unread: 1, tag: 'Renewal',
    messages: [
      { id: 'm5', fromMe: true, text: 'Happy Birthday Manishaben! 🎂 Wishing you health & happiness from CGPE family.', at: d(0, 8, 0) },
      { id: 'm6', fromMe: false, text: 'Thank you so much Rahulbhai 🙏', at: d(0, 8, 30) },
      { id: 'm7', fromMe: true, text: 'Also your Jeevan Labh renewal is coming up. Shall I send the payment link?', at: d(0, 8, 32) },
      { id: 'm8', fromMe: false, text: 'Happy to renew, please send link', at: d(0, 9, 5) },
    ],
  },
  {
    id: 'w3', name: 'Dhruv Parmar', phone: '+919104566230', lastMessage: 'Cheque ready, come anytime', lastAt: iso(0), unread: 0, tag: 'Closing',
    messages: [
      { id: 'm9', fromMe: false, text: 'Rahulbhai I discussed with wife, we will go ahead with ₹50L Jeevan Anand.', at: d(-1, 18, 0) },
      { id: 'm10', fromMe: true, text: 'Excellent decision Dhruvbhai! I will bring the forms.', at: d(-1, 18, 10) },
      { id: 'm11', fromMe: false, text: 'Cheque ready, come anytime', at: d(0, 9, 30) },
    ],
  },
  {
    id: 'w4', name: 'Pooja Desai', phone: '+919099155208', lastMessage: 'What is the tax benefit?', lastAt: iso(-1), unread: 0, tag: 'New lead',
    messages: [
      { id: 'm12', fromMe: false, text: 'Hi, saw your message about tax saving plans.', at: d(-1, 11, 0) },
      { id: 'm13', fromMe: true, text: 'Namaste Poojaben! Yes, LIC plans give 80C deduction up to ₹1.5L.', at: d(-1, 11, 20) },
      { id: 'm14', fromMe: false, text: 'What is the tax benefit?', at: d(-1, 11, 45) },
    ],
  },
  {
    id: 'w5', name: 'Jayeshbhai Desai', phone: '+919879522118', lastMessage: 'Received, thank you', lastAt: iso(-2), unread: 0,
    messages: [
      { id: 'm15', fromMe: true, text: 'Jayeshbhai, your premium receipt for Jeevan Anand is attached.', at: d(-2, 15, 0) },
      { id: 'm16', fromMe: false, text: 'Received, thank you', at: d(-2, 15, 30) },
    ],
  },
];

export const notifications: AppNotification[] = [
  { id: 'nt1', icon: 'document-text', title: 'Claim needs documents', body: 'CLM-2026-0184 (Kantaben Patel) — bank mandate & policy bond pending.', at: iso(0), read: false, kind: 'claim' },
  { id: 'nt2', icon: 'gift', title: 'Birthday today', body: 'Manishaben Shah turns 41 — send a WhatsApp greeting.', at: iso(0), read: false, kind: 'renewal' },
  { id: 'nt3', icon: 'flame', title: 'Hot lead follow-up', body: 'Dhruv Parmar is ready to close ₹50L Jeevan Anand.', at: iso(0), read: false, kind: 'lead' },
  { id: 'nt4', icon: 'refresh-circle', title: 'Renewal due in 4 days', body: 'Sunitaben Trivedi — New Jeevan Anand ₹54,000.', at: iso(-1), read: true, kind: 'renewal' },
  { id: 'nt5', icon: 'trophy', title: 'Contest update', body: 'You are Rank #3 in the Monsoon Sprint. ₹40K to go for the prize!', at: iso(-1), read: true, kind: 'contest' },
  { id: 'nt6', icon: 'checkmark-circle', title: 'Claim settled', body: 'CLM-2026-0165 — ₹9.2L credited to Rameshbhai Patel.', at: iso(-2), read: true, kind: 'claim' },
];

export const licPlans: LicPlan[] = [
  { id: 'lp1', name: 'LIC Jeevan Anand', code: '915', type: 'Endowment + Whole Life', minAge: 18, maxAge: 50, term: '15–35 yrs', highlight: 'Cover continues even after maturity payout', tags: ['Popular', 'Protection', 'Savings'] },
  { id: 'lp2', name: 'LIC Jeevan Labh', code: '936', type: 'Limited Premium Endowment', minAge: 8, maxAge: 59, term: '16/21/25 yrs', highlight: 'Pay for shorter term, higher returns', tags: ['Popular', 'Savings'] },
  { id: 'lp3', name: 'LIC Jeevan Umang', code: '945', type: 'Whole Life + Income', minAge: 90, maxAge: 55, term: 'Till age 100', highlight: '8% annual survival benefit for life', tags: ['Pension', 'Income'] },
  { id: 'lp4', name: 'LIC Tech Term', code: '954', type: 'Pure Term', minAge: 18, maxAge: 65, term: '10–40 yrs', highlight: 'High cover, low premium, online', tags: ['Protection', 'Low cost'] },
  { id: 'lp5', name: 'LIC New Endowment', code: '914', type: 'Endowment', minAge: 8, maxAge: 55, term: '12–35 yrs', highlight: 'Classic savings + protection', tags: ['Savings'] },
  { id: 'lp6', name: 'LIC New Children Money Back', code: '932', type: 'Money Back (Child)', minAge: 0, maxAge: 12, term: 'Till age 25', highlight: 'Periodic payouts for education', tags: ['Child', 'Money back'] },
];

export const contests: Contest[] = [
  { id: 'ct1', name: 'Monsoon Sprint', reward: 'Goa trip + ₹25K', progress: 0.72, metric: '₹1.8L / ₹2.5L premium', ends: iso(11), rank: 3 },
  { id: 'ct2', name: 'MDRT Fast-Track', reward: 'MDRT qualification', progress: 0.55, metric: '11 / 20 policies', ends: iso(40), rank: 7 },
  { id: 'ct3', name: 'Renewal Champion', reward: '₹15K voucher', progress: 0.9, metric: '90% renewal rate', ends: iso(5), rank: 2 },
];
