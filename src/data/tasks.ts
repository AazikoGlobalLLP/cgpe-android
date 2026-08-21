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
  /** PHASE 57b: an offline-queued create not yet on the server. Renders a "Pending sync" badge and
   *  is inert (no swipe, no complete, not tappable) until it flushes. Absent/false = a real task. */
  pending?: boolean;
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

export function taskProgress(t: Task): number {
  if (t.status === 'done') return 1;
  if (!t.steps.length) return t.status === 'in_progress' ? 0.5 : 0;
  return t.steps.filter((s) => s.done).length / t.steps.length;
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Which day-bucket a task's due date falls in, relative to `now`.
 *
 * A task with NO due date carries `dueDate === ''` (see `adaptTeamTask`), so `new Date('')` is an
 * Invalid Date, `startOfDay` is NaN, and both comparisons below are false → it sorts to 'upcoming'.
 * That is deliberate: an undated task must never claim to be overdue or due today. (Never pass a
 * `null` dueDate — `new Date(null)` is the 1970 epoch and would read as 'overdue'.)
 *
 * Shared by the Tasks tab and Home so the two never drift; `now` is injectable for tests.
 */
export function dueBucket(t: Task, now: Date = new Date()): 'overdue' | 'today' | 'upcoming' {
  const due = startOfDay(new Date(t.dueDate));
  const today = startOfDay(now);
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'upcoming';
}

/** True iff `iso` is a valid timestamp on the same local calendar day as `now`. */
function isSameDay(iso: string | undefined, now: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return startOfDay(new Date(t)) === startOfDay(now);
}

/**
 * "Today's progress" — of the tasks that belong to today, how many are done.
 *
 * A task belongs to today if it is DUE today (its real schedule) OR was COMPLETED today. This is
 * deliberately schedule-/completion-based, never touch-time-based:
 *   - an undated task (dueDate '') is only ever counted on the day it is completed, and is never
 *     re-bucketed into "today"/"overdue" by the server's `updated_at`; and
 *   - completing a task then reopening it moves it in and out of the SAME set, so the ratio shifts
 *     by one step instead of the numerator and denominator jumping independently — this is the
 *     owner-reported "the count animates wrong on reopen" (2026-08-18).
 *
 * Home and the Tasks tab BOTH call this one function, so their two headline counts cannot drift.
 */
export function todayProgress(
  list: Task[],
  now: Date = new Date(),
): { total: number; done: number; pct: number } {
  const belongs = list.filter(
    (t) => dueBucket(t, now) === 'today' || (t.status === 'done' && isSameDay(t.completedAt, now)),
  );
  const done = belongs.filter((t) => t.status === 'done').length;
  return { total: belongs.length, done, pct: belongs.length ? done / belongs.length : 0 };
}

/**
 * PHASE 75 (owner report A2, 2026-08-21) — "today's ACTIONABLE work": due-today ∪ OPEN-overdue,
 * plus anything completed today. Overdue tasks ARE today's work — you must clear them today — so
 * the Tasks tab's headline counts them. Without this, a member whose only work was an overdue item
 * (e.g. a ticket claimed today but opened days ago — the backend mirror dates it by the ticket's
 * own open date, so it buckets 'overdue') saw "0 / nothing scheduled", which read as "nothing to do".
 *
 * This is the Tasks tab's headline ONLY, a deliberate divergence from `todayProgress`: the Tasks
 * screen already frames its header as "N due now" (today + overdue), so its hero matches that. Home's
 * hero keeps the tighter `todayProgress` (a pure "how much of TODAY is left" snapshot).
 *
 * Reopen stays stable exactly like `todayProgress`: an overdue task belongs to the set whether it is
 * open (open-overdue) or done-today (completed-today), so completing/reopening it moves only the
 * numerator, never the denominator — no oscillating ratio.
 */
export function todayWorkload(
  list: Task[],
  now: Date = new Date(),
): { total: number; done: number; pct: number } {
  const belongs = list.filter((t) => {
    const b = dueBucket(t, now);
    if (b === 'today') return true;
    if (b === 'overdue' && t.status !== 'done') return true;       // open overdue = actionable today
    return t.status === 'done' && isSameDay(t.completedAt, now);   // credited on the day it closes
  });
  const done = belongs.filter((t) => t.status === 'done').length;
  return { total: belongs.length, done, pct: belongs.length ? done / belongs.length : 0 };
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
