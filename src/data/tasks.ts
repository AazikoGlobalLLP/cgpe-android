/** Tasks — the app's primary domain for team members. Types and label maps only; the
 *  fabricated seed array was removed (see the note below) and no sample data remains. */
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

/**
 * PHASE 10. The seeded `tasks` array that used to live here has been removed.
 *
 * It held ten fabricated work items carrying invented policyholder names, invented
 * policy numbers and invented premium amounts. Nothing imported it any more once the
 * API fallbacks were deleted, but because this module also exports runtime values that
 * every task screen needs (TASK_STATUS, TASK_PRIORITY, CATEGORY_ICON, taskProgress), the
 * module stayed in the bundle graph and the array rode along with it. It was verified
 * present in the shipped Hermes bundle by string-probing the exported .hbc.
 *
 * Task data now comes only from the backend, via api.getTasks / api.getTaskOverview.
 */
