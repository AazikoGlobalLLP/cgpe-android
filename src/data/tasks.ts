/** Tasks — the app's primary domain for team members. Types + sample data. */
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStep = { id: string; label: string; done: boolean };
export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  dueDate: string;
  assignedBy: string;
  client?: string;
  clientPhone?: string;
  steps: TaskStep[];
  createdAt: string;
  completedAt?: string;
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: any }> = {
  todo: { label: 'To do', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'info' },
  blocked: { label: 'Blocked', tone: 'danger' },
  done: { label: 'Done', tone: 'success' },
};
export const TASK_PRIORITY: Record<TaskPriority, { label: string; tone: any }> = {
  high: { label: 'High', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'neutral' },
};
export const CATEGORY_ICON: Record<string, string> = {
  Claim: 'shield-half', Renewal: 'refresh-circle', Documentation: 'document-text',
  'Follow-up': 'call', Meeting: 'people', Training: 'school', Onboarding: 'person-add',
  Collection: 'cash', General: 'checkbox',
};

const now = Date.now();
const day = 86400000;
const d = (o: number, h = 17) => { const dt = new Date(now + o * day); dt.setHours(h, 0, 0, 0); return dt.toISOString(); };
export function taskProgress(t: Task): number {
  if (t.status === 'done') return 1;
  if (!t.steps.length) return t.status === 'in_progress' ? 0.5 : 0;
  return t.steps.filter((s) => s.done).length / t.steps.length;
}

export const tasks: Task[] = [
  {
    id: 't1', title: 'Collect KYC & bank mandate — Kantaben Patel', description: 'Maturity claim CLM-2026-0184 is missing the original policy bond and NEFT mandate. Collect and upload before branch cut-off.',
    status: 'in_progress', priority: 'high', category: 'Claim', dueDate: d(0), assignedBy: 'Branch Admin', client: 'Kantaben Patel', clientPhone: '+91 98240 77120',
    steps: [
      { id: 's1', label: 'Call client for documents', done: true },
      { id: 's2', label: 'Collect original policy bond', done: false },
      { id: 's3', label: 'Collect NEFT bank mandate', done: false },
      { id: 's4', label: 'Upload to claim & notify branch', done: false },
    ],
    createdAt: d(-2),
  },
  {
    id: 't2', title: 'Renewal follow-up — Sunitaben Trivedi', description: 'New Jeevan Anand premium ₹54,000 due in 4 days. Send reminder and confirm payment mode.',
    status: 'todo', priority: 'high', category: 'Renewal', dueDate: d(0), assignedBy: 'Self', client: 'Sunitaben Trivedi', clientPhone: '+91 99251 78003',
    steps: [
      { id: 's5', label: 'Send WhatsApp reminder', done: false },
      { id: 's6', label: 'Confirm payment mode', done: false },
      { id: 's7', label: 'Share payment link', done: false },
    ],
    createdAt: d(-1),
  },
  {
    id: 't3', title: 'Meeting — Kiran Shah (Jeevan Anand ₹25L)', description: '11:00 AM at client office. Carry illustration and proposal forms.',
    status: 'todo', priority: 'high', category: 'Meeting', dueDate: d(0, 11), assignedBy: 'Self', client: 'Kiran Shah', clientPhone: '+91 99042 33110',
    steps: [], createdAt: d(-3),
  },
  {
    id: 't4', title: 'Submit death claim to branch — Ushaben Desai', description: 'CLM-2026-0171 (₹40L). Documents complete — hand over to branch and get acknowledgement.',
    status: 'blocked', priority: 'high', category: 'Claim', dueDate: d(-1), assignedBy: 'Branch Admin', client: 'Ushaben Desai',
    steps: [
      { id: 's8', label: 'Verify all documents', done: true },
      { id: 's9', label: 'Branch officer sign-off', done: false },
    ],
    createdAt: d(-5),
  },
  {
    id: 't5', title: 'Complete “Jeevan Umang” product training', description: 'Assigned learning module + short quiz. Due this week.',
    status: 'in_progress', priority: 'medium', category: 'Training', dueDate: d(2), assignedBy: 'Branch Admin',
    steps: [
      { id: 's10', label: 'Watch module (18 min)', done: true },
      { id: 's11', label: 'Attempt quiz', done: false },
    ],
    createdAt: d(-2),
  },
  {
    id: 't6', title: 'Premium collection — Rameshbhai Patel', description: 'Jeevan Anand ₹1,18,000 renewal due in 6 days. Collect cheque or online payment.',
    status: 'todo', priority: 'medium', category: 'Collection', dueDate: d(1), assignedBy: 'Self', client: 'Rameshbhai Patel', clientPhone: '+91 98240 11002',
    steps: [], createdAt: d(-1),
  },
  {
    id: 't7', title: 'Onboard new lead — Dhruv Parmar', description: 'Cheque ready for ₹50L Jeevan Anand. Complete proposal + KYC.',
    status: 'in_progress', priority: 'high', category: 'Onboarding', dueDate: d(0), assignedBy: 'Self', client: 'Dhruv Parmar', clientPhone: '+91 91045 66230',
    steps: [
      { id: 's12', label: 'Fill proposal form', done: true },
      { id: 's13', label: 'Collect KYC', done: true },
      { id: 's14', label: 'Collect cheque', done: false },
      { id: 's15', label: 'Submit to branch', done: false },
    ],
    createdAt: d(-1),
  },
  {
    id: 't8', title: 'Send birthday greetings — 12 clients', description: 'Today’s birthday list. One-tap send from Premium & Greetings.',
    status: 'todo', priority: 'low', category: 'Follow-up', dueDate: d(0), assignedBy: 'Self',
    steps: [], createdAt: d(0),
  },
  {
    id: 't9', title: 'Update policy documents — Jayeshbhai Desai', description: 'Upload updated nominee KYC to client record.',
    status: 'done', priority: 'medium', category: 'Documentation', dueDate: d(-1), assignedBy: 'Self', client: 'Jayeshbhai Desai',
    steps: [{ id: 's16', label: 'Upload nominee KYC', done: true }], createdAt: d(-2), completedAt: d(-1),
  },
  {
    id: 't10', title: 'Weekly report submission', description: 'Submit weekly sales & activity report to branch admin.',
    status: 'done', priority: 'medium', category: 'General', dueDate: d(-1), assignedBy: 'Branch Admin',
    steps: [], createdAt: d(-3), completedAt: d(-1),
  },
];
