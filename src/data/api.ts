/**
 * Data layer — REAL BACKEND ONLY.
 *
 * PHASE 8 CHANGED THE CONTRACT OF THIS FILE. It used to be "real-backend-first with
 * graceful fallback": any failing call silently returned sample records so a screen was
 * never empty. Three things were wrong with that, and all three are fixed here.
 *
 * 1. FABRICATED BUSINESS DATA. A failed `/clients` call rendered invented people with
 *    invented premium amounts, pixel-identical to live data. An agent could read a made-up
 *    figure to a real policyholder. Sample records no longer exist at runtime: a failed
 *    call resolves EMPTY and reports to `data/health`, which raises a banner on screen.
 *
 * 2. AUTHENTICATION BYPASS. `login()` used to hand out a `demo-token` session whenever the
 *    backend was unreachable, and `verifyOtp()` accepted ANY four digits in that state.
 *    Airplane mode plus four taps therefore got you inside the app on a shared handset.
 *    Both paths are deleted. Unreachable now throws, and the login screen says so.
 *
 * 3. INVISIBLE DEAD SESSIONS. A revoked or expired JWT produced 401s that each screen
 *    swallowed into its fallback, so the user kept browsing as though signed in. Every
 *    authenticated response now passes through `reportAuth`, and a 401 expires the session
 *    exactly once via `lib/session`.
 *
 * Raw documents are still mapped through `src/data/adapt.ts`. `FORCE_DEMO` is retained as a
 * build-time escape hatch for UI work against a dead backend; it must never ship enabled,
 * and it no longer synthesises records — it only short-circuits the network.
 */
import { Platform } from 'react-native';
import { API_BASE_URL, FORCE_DEMO, MOCK_LATENCY, REQUEST_TIMEOUT } from '@/constants/config';
import { expireSession, resetSessionGuard } from '@/lib/session';
// PHASE 7: one string in this file is read off a screen by somebody standing in a car park.
// `nbsp` is the house guarantee that a value never wraps between its number and its unit.
import { nbsp } from '@/lib/format';
import { reportFailure, reportSuccess } from './health';
import { adaptClient, adaptLead, adaptUser, adaptClaim, adaptWaThread, adaptWaMessage, adaptReminder, adaptNotification, adaptLicPlan } from './adapt';
// Types only. The seed arrays these modules once exported (`teamMembers`, `teamActivityFeed`,
// `tasks`) were deleted — importing them is what kept sample records inside the shipped bundle,
// one `??` away from reaching a screen. Task data comes from getTasks; team data from /profiles.
import type { TeamMember, TeamActivity } from './team';
import { Task, TaskStatus } from './tasks';
import type {
  Claim, Client, Commission, Contest, Lead, LeadStage, LicPlan,
  Reminder, User, WaThread, WaMessage, AppNotification,
} from './types';

const wait = (ms = MOCK_LATENCY) => new Promise((r) => setTimeout(r, ms));
/**
 * PHASE 3: undefined-safe. `JSON.stringify(undefined)` returns the VALUE `undefined`, not a
 * string, so `JSON.parse` then received the literal text "undefined" and threw a SyntaxError.
 *
 * That mattered because `unavailable()` ends in `clone(value)`, and every single-record
 * lookup passes `undefined` as its empty value — `getClient`, `getLead`, `getTeamMember`,
 * `getTicket`, `getFamily`, `getKbArticle`. So a failed lookup REJECTED instead of resolving
 * empty, which means the carefully-worded "This client could not load" empty states on those
 * six detail screens have never once rendered; the screens saw an unhandled rejection.
 */
const clone = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

let authToken: string | null = null;
let sessionReal = false;
let currentUserId: string | null = null;
let currentUserName: string | null = null;

export function setAuthToken(t: string | null) {
  authToken = t;
  sessionReal = !!t && !t.startsWith('demo-');
  // A different account has different permissions, so no 403-was-expected note survives the
  // switch. `store/auth.tsx` calls `resetHealth()` alongside this on both sign-in and out.
  suppressed.clear();
}
export function setCurrentUser(id: string | null, name?: string | null) {
  currentUserId = id; currentUserName = name || null;
}
export function isRealSession() { return sessionReal; }

/**
 * Why a write did not land. PHASE 1.
 *
 * Several writes in this file used to resolve `{ ok: true }` on a timeout, an offline device
 * or a 500, because the failure was swallowed by a bare `catch`. The screens above them then
 * fired a success haptic, persisted local state and navigated away, so the user was told their
 * shift had started, their task was done, or their account was deleted — none of which had
 * reached the server. Each of those screens already had a correctly-worded failure branch; the
 * branches were simply unreachable.
 *
 * A write now reports what actually happened. `unsupported` is its own case because it is not
 * a transient fault: the endpoint is not there, and retrying will never help.
 *
 * PHASE 4 added `invalid`: the server understood the request and refused it (HTTP 400). That is
 * neither an outage nor something to retry — the user has to change what they typed — so it must
 * not raise the health banner and must not be held in the local buffer as if it were saved.
 */
export type WriteFailure = 'network' | 'server' | 'forbidden' | 'unsupported' | 'invalid';

/**
 * A request path reduced to the stable key the health channel reports under. PHASE 3.
 *
 * Two things have to agree on one string or the banner double-counts: the helper that
 * discovers a failure (`tryReal`) and the caller that resolves it (`unavailable`). The
 * helper only knows the URL it fetched — `/clients/68f1…c0d1?scope=all` — while the caller
 * writes the human key, `/clients/:id`. Normalising the first into the second makes one
 * failure produce one entry.
 *
 * ONLY id-SHAPED SEGMENTS COLLAPSE, and that restraint is the whole point: a blanket
 * "replace the last segment" rule would fold `/clients/segments` and `/clients/stats/overview`
 * into `/clients/:id`, so three unrelated endpoints would share one banner row and one
 * endpoint's recovery would silently clear another's failure.
 */
const ID_SEGMENT =
  /\/(?:[0-9a-f]{24}|\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\/|$)/gi;
const healthKey = (path: string) => path.split('?')[0].replace(ID_SEGMENT, '/:id');

/**
 * Report a non-2xx — unless it is a status that is an ANSWER rather than a fault. PHASE 3.
 *
 * The banner exists to say "we could not load this". Three statuses mean something else
 * entirely, and reporting them would replace one lie with a louder one:
 *
 *   401 — `reportAuth` has already ended the session. A banner on the way out is noise.
 *   403 — a permission result, not an outage. `GET /profiles` is admin-only
 *         (`contracts/api.md:211`) and `getAgentLocations` calls it unconditionally, so
 *         reporting 403 would pin an outage banner open for EVERY ADVISOR against a
 *         perfectly healthy backend — failing this phase's own acceptance criterion.
 *   404 / 501 — the endpoint is not deployed. Phase 1 already named this case `unsupported`
 *         (see `WriteFailure` above): "not a transient fault: the endpoint is not there, and
 *         retrying will never help." Reporting a 404 would hold the banner open for the whole
 *         session on a route the caller can do nothing about.
 *
 * Everything else — 4xx that indicates a malformed request, and every 5xx — is reported.
 */
function reportIfOutage(status: number, key: string): void {
  if (status === 401 || status === 403 || status === 404 || status === 501) {
    suppressed.add(key);
    return;
  }
  suppressed.delete(key);
  reportFailure(key);
}

/**
 * Endpoints whose most recent failure was an ANSWER (401/403/404/501) rather than a fault.
 *
 * This set exists because the suppression in `reportIfOutage` would otherwise be undone one
 * line later. Most callers respond to `tryReal`'s `null` with `?? unavailable(…)`, and
 * `unavailable` reports unconditionally — so a 403 on `/profiles` would be classified as
 * "not an outage", return `null`, and then have the caller raise the banner anyway. That is
 * precisely the advisor-sees-a-permanent-outage case this phase must not ship.
 *
 * Keyed by health key, so the producer (`tryReal`, which knows the URL) and the consumer
 * (`unavailable`, which knows the human key) meet on the same string — that is what
 * `healthKey` is for. Consumed exactly once on read, so the NEXT attempt reports normally if
 * it fails for a real reason.
 */
const suppressed = new Set<string>();

async function req(
  path: string,
  opts: RequestInit = {},
  timeout = REQUEST_TIMEOUT,
  key: string = healthKey(path),
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(opts.headers || {}),
      },
    });
    const json = await res.json().catch(() => null);
    reportAuth(res.status, !!authToken, key);
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Single choke point for credential rejection.
 *
 * Called on EVERY response. When we sent a token and the server answered 401, that token is
 * no longer valid — expired, revoked, or the staff account was disabled — and the only
 * correct response is to end the session rather than let the user keep browsing a screen
 * full of empty lists wondering why nothing loads. `expireSession` is idempotent, so a
 * dashboard firing six parallel requests logs out once.
 *
 * 403 is deliberately NOT treated as session death. On this backend 403 means "your role
 * cannot do this particular thing" (for example a non-leader trying to send a campaign),
 * which is a per-action permission result, not a broken session. Logging the user out for
 * it would be both wrong and infuriating.
 */
function reportAuth(status: number, sentToken: boolean, key: string): void {
  if (sentToken && status === 401) {
    expireSession('expired');
    return;
  }
  // PHASE 3: clears THIS endpoint only. It used to wipe every recorded failure, which made
  // the banner order-dependent inside a `Promise.all` fan-out. See `data/health.ts`.
  if (status >= 200 && status < 400) {
    suppressed.delete(key);   // a working endpoint has no pending "this was an answer" note
    reportSuccess(key);
  }
}

/**
 * Try the real API; null on any failure or validation miss so the caller can fall back.
 *
 * PHASE 3 GAVE THIS FUNCTION A VOICE. It used to return `null` three different ways and say
 * nothing about any of them, so 18 of its 32 call sites failed in total silence — the client
 * book, the org snapshot, the claims summary and ten more resolved empty while
 * `data/health` stayed clean and every screen rendered its "you have none" copy.
 *
 * The three exits are NOT equivalent, and only two of them are outages:
 *   - a non-2xx is reported through `reportIfOutage`, which filters the statuses that are
 *     answers rather than faults (401/403/404/501 — see there);
 *   - a throw is always reported: that is a dead network or the 4.5 s abort;
 *   - a 200 whose body fails `validate` is ALSO reported, deliberately. The server answered,
 *     so it is a contract fault rather than an outage — but the caller's next move is to
 *     render a zeroed shell, and an unlabelled zero is the exact lie this channel exists to
 *     prevent. `contracts/CHANGELOG.md` lists 15 confirmed drifts, so this is not theoretical.
 *
 * `key` defaults to the normalised path and is overridable for the handful of callers whose
 * `unavailable()` key cannot be derived from the URL (a slug id, say).
 */
async function tryReal<T>(
  path: string,
  opts: RequestInit,
  validate: (d: any) => boolean,
  key: string = healthKey(path),
): Promise<T | null> {
  if (FORCE_DEMO || !sessionReal) return null;   // no request attempted; nothing to report
  try {
    const { ok, status, json } = await req(path, opts, REQUEST_TIMEOUT, key);
    if (!ok) { reportIfOutage(status, key); return null; }
    const data = json?.data ?? json;
    if (validate(data)) return data as T;
    reportFailure(key);
    return null;
  } catch {
    reportFailure(key);
    return null;
  }
}

const isArr = (d: any) => Array.isArray(d);
const isObj = (d: any) => d && typeof d === 'object' && !Array.isArray(d);

/**
 * Local record buffer — NOT sample data.
 *
 * Every collection starts EMPTY. This object exists for one honest purpose: when the user
 * creates a task, lead, or claim and the write cannot reach the server, the record they just
 * typed is held here so it stays visible in the list instead of vanishing under their thumb.
 * Those are the user's OWN records, entered seconds ago, not invented ones.
 *
 * It is deliberately kept as the same shape the fallbacks used to read from, so a failed
 * fetch resolves to `[]` / `undefined` through the exact same expressions. Nothing seeds it.
 */
const state = {
  leads: [] as Lead[],
  clients: [] as Client[],
  claims: [] as Claim[],
  reminders: [] as Reminder[],
  waThreads: [] as WaThread[],
  notifications: [] as AppNotification[],
  commission: null as Commission | null,
  contests: [] as Contest[],
  licPlans: [] as LicPlan[],
  tasks: [] as Task[],
};

/* ------------------------------------------------------------------- Tasks */
function adaptTask(raw: any): Task {
  return {
    id: String(raw._id || raw.id),
    title: raw.title || raw.task || raw.name || 'Task',
    description: raw.description || raw.details || raw.aiUnderstanding || '',
    status: (raw.status || raw.state || 'todo') as TaskStatus,
    priority: raw.priority === 'P0' || raw.priority === 'high' ? 'high' : raw.priority === 'low' || raw.priority === 'P3' ? 'low' : 'medium',
    category: raw.category || raw.type || 'General',
    dueDate: raw.due_date || raw.dueDate || raw.due || raw.createdAt || new Date().toISOString(),
    assignedBy: raw.assigned_by || raw.created_by || raw.by || 'Self',
    client: raw.client_name || raw.clientName || raw.client,
    clientPhone: raw.client_phone || raw.clientPhone,
    steps: Array.isArray(raw.steps || raw.subtasks) ? (raw.steps || raw.subtasks).map((s: any, i: number) => ({ id: String(s._id || s.id || i), label: s.label || s.title || String(s), done: !!(s.done || s.completed) })) : [],
    createdAt: raw.createdAt || new Date().toISOString(),
    completedAt: raw.completedAt || raw.completed_at,
  };
}
/* --- REAL team tasks -------------------------------------------------------
 * The live `tasks` collection is EMPTY; the real work items live in `team_tasks`
 * and are served UN-SCOPED by GET /team/task-overview (grouped per member, joined
 * to profiles + the manager hierarchy). That is the real source of truth.
 * ------------------------------------------------------------------------- */
const P2PRIORITY: Record<string, Task['priority']> = { P1: 'high', P2: 'medium', P3: 'low' };
const DONE_WORDS = ['done', 'completed', 'closed', 'resolved', 'cancelled'];

function adaptTeamTask(raw: any, assignee?: string): Task {
  const st = String(raw.status || 'open').toLowerCase();
  const status: Task['status'] = DONE_WORDS.includes(st) ? 'done'
    : st === 'in_progress' || st === 'in progress' || st === 'doing' ? 'in_progress'
    : st === 'blocked' || st === 'on_hold' ? 'blocked' : 'todo';
  const due = raw.due_at || raw.dueAt || raw.updated_at || raw.created_at || new Date().toISOString();
  return {
    id: String(raw.id || raw._id || raw.team_task_id),
    title: String(raw.title || raw.task || 'Task'),
    description: String(raw.details || raw.description || ''),
    status,
    priority: P2PRIORITY[String(raw.priority || 'P2').toUpperCase()] || 'medium',
    category: String(raw.type || 'Task').replace(/^\w/, (m) => m.toUpperCase()),
    dueDate: due,
    assignedBy: raw.created_by || raw.createdBy || 'Admin',
    client: raw.client || undefined,
    clientPhone: raw.client_phone || undefined,
    steps: [],
    createdAt: raw.created_at || due,
    completedAt: status === 'done' ? raw.updated_at : undefined,
    // extra (non-typed) fields used by admin views
    ...({ assignee: assignee || raw.assigneeName } as any),
  };
}

export type TaskOverview = {
  totals: { members: number; total: number; open: number; done: number; overdue: number };
  priority_totals?: Record<string, number>;
  members: { name: string; user_id?: string; role?: string; department?: string; phone?: string; is_active?: boolean; manager?: any; counts: { total: number; open: number; done: number; overdue: number }; completion_pct?: number; tasks: any[] }[];
};

export async function getTaskOverview(): Promise<TaskOverview | null> {
  return await tryReal<TaskOverview>('/team/task-overview', {}, (d) => d && Array.isArray(d.members));
}

/* --- Phase 45: per-member completed-tasks report + monthly performance score ---
 * `GET /team/task-report?month=YYYY-MM[&scope=all|own][&user_id=…]` (cgpe-api Backend
 * Phase 53, `contracts/api.md` §`/api/team`). The SERVER computes the score from the
 * owner-locked rules — manager-assigned AND actually-completed tasks only (reminders,
 * self-created and cancelled excluded), importance (P1:3/P2:2/P3:1) × timeliness
 * (on-time ×1 / late ×0.5), bucketed by due-month. **The app RENDERS it and never
 * recomputes it** (rule 2) — every count/score below is the server's, passed through.
 *
 * TWO OUTCOMES, told apart by `req()` (not `tryReal`, which would collapse the envelope) —
 * this is admin/master monitoring data, so a 401/403 for the wrong role must be a quiet
 * ANSWER, not a banner:
 *   - a 200 `{ data:{ month, members[], totals } }` → `{ status:'ok', report }`;
 *   - a 5xx / network / shape-drift → `{ status:'error' }` + banner; a 401/403/404 stays quiet.
 * `score` is a server integer 0–100 OR `null` ("no tasks" — never a fabricated 0%). An empty
 * `members[]` on a healthy 200 is a valid `ok` (a month with no counted work), not an error. */
export type TaskReportMember = {
  name: string;
  userId: string;
  role: string | null;
  department: string | null;
  counts: { assigned: number; completed: number; onTime: number; late: number; notCompleted: number };
  /** 0–100 server integer, or `null` when no tasks were counted — render as "no tasks", NEVER 0%. */
  score: number | null;
  completedTasks: { id: string; title: string; priority: string | null; dueAt: string | null; completedAt: string | null; onTime: boolean }[];
};
export type TaskReport = {
  month: string;
  members: TaskReportMember[];
  totals: { members: number; assigned: number; completed: number; onTime: number; late: number };
};
export type TaskReportResult = { status: 'ok'; report: TaskReport } | { status: 'error' };
export type TaskReportScope = { scope?: 'all' | 'own'; userId?: string };

/** Defensive wire→app mapper. Coerces every field; drops junk rows; keeps `score:null` distinct
 *  from `score:0` (0 = a real "earned nothing", null = "no tasks"). Pure — pinned by tests. */
function mapTaskReport(data: any): TaskReport {
  const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  const members: TaskReportMember[] = (Array.isArray(data.members) ? data.members : [])
    .filter((m: any) => m && typeof m === 'object')
    .map((m: any) => {
      const c = isObj(m.counts) ? m.counts : {};
      const s = m.score;
      return {
        name: str(m.name),
        userId: str(m.user_id),
        role: strOrNull(m.role),
        department: strOrNull(m.department),
        counts: {
          assigned: int(c.assigned),
          completed: int(c.completed),
          onTime: int(c.on_time),
          late: int(c.late),
          notCompleted: int(c.not_completed),
        },
        score: typeof s === 'number' && Number.isFinite(s) ? s : null,   // null (no tasks) survives; 0 passes through
        completedTasks: (Array.isArray(m.completed_tasks) ? m.completed_tasks : [])
          .filter((t: any) => t && typeof t === 'object')
          .map((t: any) => ({
            id: str(t.id),
            title: str(t.title),
            priority: strOrNull(t.priority),
            dueAt: strOrNull(t.due_at),
            completedAt: strOrNull(t.completed_at),
            onTime: t.on_time === true,
          })),
      };
    });
  const t = isObj(data.totals) ? data.totals : {};
  return {
    month: str(data.month),
    members,
    totals: {
      members: int(t.members),
      assigned: int(t.assigned),
      completed: int(t.completed),
      onTime: int(t.on_time),
      late: int(t.late),
    },
  };
}

export async function getTaskReport(month: string, opts: TaskReportScope = {}): Promise<TaskReportResult> {
  if (FORCE_DEMO || !sessionReal) return { status: 'error' };   // no request attempted
  const q: string[] = [`month=${encodeURIComponent(month)}`];
  if (opts.scope) q.push(`scope=${opts.scope}`);
  if (opts.userId) q.push(`user_id=${encodeURIComponent(opts.userId)}`);
  const path = `/team/task-report?${q.join('&')}`;
  const key = healthKey('/team/task-report');   // collapse month/scope → one banner row
  try {
    const { ok, status, json } = await req(path, {}, REQUEST_TIMEOUT, key);
    if (!ok) { reportIfOutage(status, key); return { status: 'error' }; }
    const data = json?.data;
    if (!isObj(data) || !Array.isArray(data.members)) { reportFailure(key); return { status: 'error' }; }
    return { status: 'ok', report: mapTaskReport(data) };
  } catch {
    reportFailure(key);            // dead network or the 4.5 s abort
    return { status: 'error' };
  }
}

/** All tasks the signed-in user may see (own only for team tier; everything for admin/master). */
export async function getTasks(ownOnly = false): Promise<Task[]> {
  const ov = await getTaskOverview();
  if (ov) {
    const mine = (m: any) =>
      (currentUserId && String(m.user_id) === String(currentUserId)) ||
      (currentUserName && String(m.name).trim().toLowerCase() === String(currentUserName).trim().toLowerCase());
    const members = ownOnly ? ov.members.filter(mine) : ov.members;
    return members.flatMap((m) => (m.tasks || []).map((t) => adaptTeamTask(t, m.name)));
  }
  const real = await tryReal<any[]>('/tasks?limit=500', {}, isArr);
  return real ? real.map(adaptTask) : unavailable('/tasks', state.tasks);
}

/** Live org dashboard counters (claims, tickets, tasks) — un-scoped. */
export async function getDashboardOverview(): Promise<any | null> {
  return await tryReal<any>('/dashboard/overview', {}, isObj);
}

/**
 * Consolidated REAL org snapshot for the Admin/Master dashboards. It stitches
 * together only the numbers the backend can actually produce for a super_admin:
 *   • client total   ← /clients paginator (totalPages @ limit 1)          [real]
 *   • claims/tickets  ← /dashboard/overview                                [real]
 *   • task totals     ← /team/task-overview                                [real]
 *   • leads           ← /leads?scope=all length                           [real]
 * Premium book value, renewals-due and birthday counts are deliberately omitted:
 * the aggregation endpoints return 0 for super_admin (scope bug), so renewals are
 * surfaced on-demand via the Premium scan instead of shown as a misleading zero.
 */
export type OrgSnapshot = {
  total_clients: number;
  claims: { total: number; under_process: number; passed: number; paid_amount: number };
  tickets: number;
  leads: number;
  tasks: { members: number; total: number; open: number; done: number; overdue: number };
};
export async function getOrgSnapshot(): Promise<OrgSnapshot | null> {
  // No live session means no numbers. This used to synthesise a populated snapshot from
  // sample data "so no screen is empty" — which put invented client counts and invented
  // settled-claim rupee totals on the master dashboard, the single most trusted surface in
  // the app. Null is the honest answer; the dashboard renders its empty state.
  if (!sessionReal || FORCE_DEMO) return null;
  const [dov, stats, ov, leads] = await Promise.all([
    getDashboardOverview(),
    getClientStats(),
    getTaskOverview(),
    getLeads().catch(() => [] as Lead[]),
  ]);
  if (!dov && !stats && !ov) return null;
  const claims = dov?.claims || {};
  return {
    total_clients: stats?.total_clients || dov?.clients?.total || 0,
    claims: {
      total: claims.total ?? 0,
      under_process: claims.under_process ?? 0,
      passed: claims.passed ?? 0,
      paid_amount: claims.paid_amount ?? 0,
    },
    tickets: dov?.tickets?.total ?? 0,
    leads: Array.isArray(leads) ? leads.length : 0,
    tasks: ov?.totals || { members: 0, total: 0, open: dov?.tasks?.open ?? 0, done: 0, overdue: 0 },
  };
}

/** REAL claims register summary — un-scoped (the per-record list is ownership-filtered). */
export type ClaimsSummary = {
  total_claims: number; total_amount: number; paid_amount: number; pending_amount: number;
  status_counts?: Record<string, number>; type_counts?: Record<string, number>;
};
export async function getClaimsSummary(): Promise<ClaimsSummary | null> {
  return await tryReal<ClaimsSummary>('/claims/stats/summary', {}, isObj);
}
export async function getTask(id: string): Promise<Task | undefined> {
  const ov = await getTaskOverview();
  if (ov) {
    for (const m of ov.members) {
      const hit = (m.tasks || []).find((t: any) => String(t.id || t._id || t.team_task_id) === String(id));
      if (hit) return adaptTeamTask(hit, m.name);
    }
  }
  return unavailable('/tasks/:id', state.tasks.find((t) => t.id === id));
}

/** Map the app's status back to the backend's team_tasks vocabulary. */
const toServerStatus = (s: TaskStatus) => (s === 'done' ? 'done' : s === 'in_progress' ? 'in_progress' : s === 'blocked' ? 'blocked' : 'open');

/**
 * PHASE 1: this used to return `{ ok: true }` for every outcome except a 403 — a 500, a 404,
 * a timeout and an offline device all fell through to a local mutation against the permanently
 * empty `state.tasks` buffer and then reported success. `task/[id].tsx` trusts that verdict
 * completely: it toasts "Task completed." and navigates away. So a member marking work done on
 * a flaky connection was told it saved, was moved off the screen, and the task stayed open.
 * Its rollback branch was already written and correct — it just only ran for a 403.
 */
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<{ ok: boolean; forbidden?: boolean; reason?: WriteFailure }> {
  if (FORCE_DEMO) {
    const t = state.tasks.find((x) => x.id === id);
    if (t) { t.status = status; if (status === 'done') { t.completedAt = new Date().toISOString(); t.steps.forEach((s) => (s.done = true)); } }
    await wait(120);
    return { ok: true };
  }
  if (!sessionReal) return { ok: false, reason: 'network' };
  try {
    const { ok, status: code } = await req(`/team/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: toServerStatus(status) }) });
    if (code === 403) return { ok: false, forbidden: true, reason: 'forbidden' };
    if (!ok) return { ok: false, reason: 'server' };
    const t = state.tasks.find((x) => x.id === id);
    if (t) { t.status = status; if (status === 'done') { t.completedAt = new Date().toISOString(); t.steps.forEach((s) => (s.done = true)); } }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** Reassign a task to another member (admin/leader only). */
export async function reassignTask(id: string, assigneeName: string): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO) return true;
  try { const { ok } = await req(`/team/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ assigneeName }) }); return ok; }
  catch { return false; }
}
/* `toggleTaskStep` was REMOVED in Phase 1, deliberately — do not re-add it here.
 *
 * It made no network call. It mutated `state.tasks`, which is the write buffer declared above
 * and is never populated for tasks: `getTasks`/`getTask` build their result from
 * `/team/task-overview` and return it directly. So the whole body was dead, the tick reverted
 * on the next focus refetch, and `task/[id].tsx` fired a success haptic over it.
 *
 * There is no backend endpoint for a task step. Wiring one is Phase 9 (`docs/PHASES.md`), and
 * it needs `cgpe-api` to build it first. Until then the checklist renders read-only. */
const PRIORITY2P: Record<string, string> = { high: 'P1', medium: 'P2', low: 'P3' };

/** Create a REAL team task (admin/leader only on the backend). */
export async function addTask(data: Partial<Task> & { assigneeName?: string }): Promise<Task & { forbidden?: boolean }> {
  const local: Task = {
    id: 't' + (Date.now() % 100000), title: data.title || 'New task', description: data.description || '',
    status: 'todo', priority: data.priority || 'medium', category: data.category || 'Task',
    dueDate: data.dueDate || new Date().toISOString(), assignedBy: currentUserName || 'Admin', client: data.client,
    steps: [], createdAt: new Date().toISOString(),
  };
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, status, json } = await req('/team/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: local.title,
          details: local.description || null,
          assigneeName: data.assigneeName || currentUserName || 'Unassigned',
          priority: PRIORITY2P[local.priority] || 'P2',
          dueAt: local.dueDate,
          type: (local.category || 'task').toLowerCase(),
          clientName: local.client || '',
          status: 'open',
        }),
      });
      if (status === 403) return { ...local, forbidden: true };
      if (ok && json?.data?.id) return { ...local, id: String(json.data.id) };
    } catch { /* fall through */ }
  }
  state.tasks.unshift(local); await wait(200); return clone(local);
}

/**
 * Resolve a request that could not be served.
 *
 * Named for what it now does. It used to be `demo()` and returned sample records; it returns
 * whatever the empty local buffer holds (`[]` for a collection, `undefined` for a lookup) and
 * tells `data/health` which endpoint failed so the screen can raise a banner and offer Retry.
 *
 * The short wait is retained so a spinner does not flash for a single frame before the empty
 * state lands, which reads as a glitch rather than a considered "nothing here".
 */
async function unavailable<T>(endpoint: string, value: T): Promise<T> {
  // PHASE 3: do not contradict a classification already made upstream. If `tryReal` decided
  // this endpoint's failure was an answer (403 "you may not", 404 "not deployed") rather than
  // an outage, it left a note in `suppressed` and this must stay quiet. Read-once.
  if (!suppressed.delete(endpoint)) reportFailure(endpoint);
  await wait();
  return clone(value);
}

/* -------------------------------------------------------------------- Auth
 *
 * THE ONLY WAY INTO THIS APP IS A TOKEN THE SERVER ISSUED.
 *
 * Every offline shortcut that used to exist here has been removed. Previously an
 * unreachable backend produced a `demo-token` session, and `verifyOtp` accepted any
 * four digits in that state. On a shared handset that is a complete authentication
 * bypass: enable airplane mode, type 1234, and you are inside someone's client book.
 * There is now no code path that mints a session locally. If the server cannot be
 * reached, sign-in FAILS and says so, which is the only safe behaviour.
 *
 * `NetworkError` is distinguished from a credential rejection so the login screen can
 * word the two differently. Both block entry; only the message differs.
 * ------------------------------------------------------------------------- */

/** Thrown when the backend could not be reached at all, as opposed to rejecting us. */
export class NetworkError extends Error {
  constructor(message = 'Could not reach the CGPE server. Check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

const isUnreachable = (e: any) =>
  e?.name === 'AbortError' ||
  (typeof e?.message === 'string' && /fetch|network|Failed to fetch|Load failed|timeout/i.test(e.message));

export async function login(
  id: string,
  pw: string,
): Promise<{ user: User; token: string; refreshToken?: string }> {
  try {
    const { ok, status, json } = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email_or_phone: id, password: pw }),
    });
    const data = ok ? (json?.data ?? json) : null;
    if (data?.token && data?.user) {
      sessionReal = true;
      resetSessionGuard();
      // No health call here. `reportSuccess` is per-endpoint since Phase 3 and would only
      // clear `/auth/login`; the whole-list clear a fresh session wants is `resetHealth()`,
      // which `store/auth.tsx:124` already runs on the sign-in path.
      // `refresh_token` (backend Phase 58, 30d) is optional — the login still succeeds without
      // it; biometric restore is simply unavailable until the next login that carries one.
      return {
        user: adaptUser(data.user),
        token: data.token,
        refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
      };
    }
    // The server answered and refused. Surface its own wording where it gave one.
    throw new Error(json?.error || json?.message || 'Invalid credentials. Please check and try again.');
  } catch (e: any) {
    if (isUnreachable(e)) throw new NetworkError();
    throw e;
  }
}

/**
 * Request a login OTP. The backend sends a real 5-minute WhatsApp code via its waService.
 * A failure is reported truthfully: telling the user "OTP sent" when nothing was sent
 * strands them on a code-entry screen waiting for a message that will never arrive.
 */
export async function sendOtp(phone: string): Promise<{ ok: boolean; message: string }> {
  try {
    const { ok, json } = await req('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email_or_phone: phone, phone }),
    });
    if (ok && json?.success !== false) {
      return { ok: true, message: json?.message || 'Code sent to your WhatsApp number.' };
    }
    return { ok: false, message: json?.error || json?.message || 'Could not send the code. Please try again.' };
  } catch (e: any) {
    if (isUnreachable(e)) throw new NetworkError();
    return { ok: false, message: 'Could not send the code. Please try again.' };
  }
}

/**
 * Verify a login OTP. Only the server can decide whether a code is valid; this function
 * has no local opinion about it. Returns null when the code is wrong or expired.
 */
export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{ user: User; token: string; refreshToken?: string } | null> {
  try {
    const { ok, json } = await req('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, email_or_phone: phone, code, otp: code }),
    });
    const data = ok ? (json?.data ?? json) : null;
    if (data?.token && data?.user) {
      sessionReal = true;
      resetSessionGuard();
      // See `login()` — the fresh-session clear is `resetHealth()` in `store/auth.tsx:124`.
      return {
        user: adaptUser(data.user),
        token: data.token,
        refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
      };
    }
    return null;
  } catch (e: any) {
    if (isUnreachable(e)) throw new NetworkError();
    return null;
  }
}

/**
 * Restore a session from the biometric-sealed refresh credential (Phase 48, backend Phase 58).
 *
 * PUBLIC on the wire — the access token is dead by design after a silent 24h expiry, so this
 * sends NO Authorization header (`authToken` is null by the time the user is back at the login
 * screen). The server verifies the refresh credential against its allow-list and, on success,
 * mints a fresh 24h access token AND a ROTATED refresh credential (the presented one is revoked).
 * Three honest outcomes, never a fabricated session:
 *   - 'ok'       : { user, token, refreshToken } — re-seal the NEW refreshToken, start the session.
 *   - 'declined' : refused (revoked on logout / past its 30-day window / unknown / reuse) — a flat
 *                  400/401. An ANSWER, not a fault: the caller drops the dead binding and asks for
 *                  a manual sign-in. Raises no outage banner.
 *   - 'error'    : dead network, a 5xx/503, or a 200 whose body is not the required shape. Keep the
 *                  binding and offer Retry — re-scanning a fingerprint is useless if the net is down.
 *
 * Uses low-level `req()` (not `tryReal`) so it has no health-channel side effects — this runs on
 * the pre-session login screen, which shows its own Banner, exactly like `login()`/`sendOtp()`.
 */
export type BiometricRestore =
  | { status: 'ok'; user: User; token: string; refreshToken: string }
  | { status: 'declined' }
  | { status: 'error' };

export async function refreshBiometricSession(
  refreshToken: string,
  deviceId?: string,
): Promise<BiometricRestore> {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) return { status: 'declined' };
  try {
    const { ok, status, json } = await req('/auth/refresh-biometric', {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: refreshToken,
        ...(deviceId ? { device_id: deviceId } : {}),
      }),
    });
    if (ok) {
      const data = json?.data ?? json;
      // Require BOTH the fresh access token and a rotated refresh credential to re-seal. Starting
      // a session without the rotated credential would leave the keystore holding a now-revoked
      // token that fails closed on the next restore — treat a partial body as a contract fault.
      if (data?.token && data?.user && typeof data?.refresh_token === 'string') {
        sessionReal = true;
        resetSessionGuard();
        return {
          status: 'ok',
          user: adaptUser(data.user),
          token: data.token,
          refreshToken: data.refresh_token,
        };
      }
      return { status: 'error' };
    }
    // 400 (missing) / 401 (INVALID_REFRESH — revoked/expired/unknown/reuse) are ANSWERS: the
    // credential is dead, sign in manually. Anything else (5xx/503) is a fault → retryable.
    if (status === 400 || status === 401) return { status: 'declined' };
    return { status: 'error' };
  } catch {
    // Dead network / abort. Keep the binding; retryable, not a refusal.
    return { status: 'error' };
  }
}

/**
 * Best-effort server-side revoke of the biometric refresh credential on explicit logout (Phase 48
 * / backend Phase 58). Sent WHILE still authenticated (the access token is still valid), so
 * `protect` passes and the server revokes that credential's allow-list row — enforcing "an
 * explicit logout forces a full login" on the wire, not just by clearing the local keystore.
 * Never throws: a failed revoke must never block sign-out (the local binding is destroyed anyway).
 */
export async function serverLogout(refreshToken?: string | null): Promise<void> {
  try {
    await req('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
    });
  } catch {
    // ignore — sign-out proceeds regardless
  }
}

/**
 * The signed-in user, straight from the server. Returns null when the profile cannot be
 * fetched. Callers keep the profile they already restored from the keychain rather than
 * being handed a stand-in identity, which previously meant a failed refresh could show a
 * different person's name and role in the header.
 */
export async function me(): Promise<User | null> {
  const real = await tryReal<any>('/auth/me', {}, isObj);
  const u = real?.user ?? real; // /auth/me nests under data.user
  return u && (u.user_id || u.full_name || u.email) ? adaptUser(u) : null;
}
/**
 * Erase this account on the server.
 *
 * THE BACKEND HAS NO SUCH ROUTE. `routes/auth.js` declares no `router.delete` at all, so this
 * request reaches the catch-all 404. It previously discarded that and returned a hardcoded
 * `{ ok: true }`, which signed the user out, fired a success haptic and left every record in
 * place — after a two-step confirm promising the opposite in writing. That is a data-deletion
 * claim the server cannot honour, so it now reports `unsupported` and the caller keeps the
 * session. See `../contracts/INBOX.md` — `DELETE /api/auth/me` is filed with `cgpe-api`.
 */
export async function deleteAccount(): Promise<{ ok: boolean; reason?: WriteFailure }> {
  if (FORCE_DEMO) { await wait(500); return { ok: true }; }
  if (!sessionReal) return { ok: false, reason: 'network' };
  try {
    const { ok, status } = await req('/auth/me', { method: 'DELETE' });
    if (ok) return { ok: true };
    if (status === 403) return { ok: false, reason: 'forbidden' };
    // 404/405/501 = the route does not exist. Today that is every call.
    if (status === 404 || status === 405 || status === 501) return { ok: false, reason: 'unsupported' };
    return { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/* ------------------------------------------------------------------ Leads
 *
 * PHASE 4 — THE WHOLE SECTION SPOKE A VOCABULARY AND AN ENVELOPE THE SERVER DOES NOT HAVE.
 *
 * `contracts/api.md:366-370` — the four shapes every function below now depends on:
 *   GET  /api/leads      → { success, data: { leads: Lead[], pagination } }
 *   GET  /api/leads/:id  → { success, data: { lead } }
 *   POST /api/leads      → 201 { success, data: { lead }, message }
 *   PUT  /api/leads/:id  → { success, data: { lead }, message }   ← the POST-update document
 *
 * The record is under `data.lead` on three of the four. `tryReal` unwraps one level (`json.data`),
 * so every validator here has to look one level further — which is precisely what the old
 * `getLead` did not do, and why the detail screen had never rendered a real lead.
 *
 * The write field is `status`, not `stage`. See `src/data/types.ts` for the vocabulary and
 * `docs/spec/PHASE-4.md` §2 for the other three that must not be merged with it.
 */

/**
 * The pipeline, in one call. The array is at `data.leads` — not at `data`.
 *
 * PHASE 4 ALSO STOPPED THIS RAISING A FALSE OUTAGE. Every `/api/leads` route sits behind
 * `requireModule('sales')` (`api.md:362`), so a user whose department is not granted that module
 * gets 403 here on a perfectly healthy backend. This path never classified the status, so
 * `unavailable()` reported unconditionally and pinned the banner open for their whole session —
 * the same defect Phase 3 fixed for `GET /profiles`. `reportIfOutage` is the classifier.
 */
export async function getLeads(): Promise<Lead[]> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, status, json } = await req('/leads?limit=500&scope=all');
      if (ok && Array.isArray(json?.data?.leads)) return json.data.leads.map(adaptLead);
      if (!ok) reportIfOutage(status, '/leads');
    } catch { /* fall through — `unavailable` reports the outage */ }
  }
  return unavailable('/leads', state.leads);
}

/**
 * One lead. `?scope=all` is gone: `GET /:id` does not read a scope at all — it is a raw
 * `lead.advisor_id === req.user.user_id` test with an admin bypass (`routes/leads.js:266`), so
 * the parameter only ever implied a widening that does not exist.
 */
export async function getLead(id: string): Promise<Lead | undefined> {
  const real = await tryReal<any>(`/leads/${id}`, {}, (d) => isObj(d) && isObj(d.lead));
  return real ? adaptLead(real.lead) : unavailable('/leads/:id', state.leads.find((l) => l.id === id));
}

/**
 * Move a lead, and resolve to the server's own copy of it — or `null` if it did not move.
 *
 * TWO THINGS CHANGED HERE AND BOTH ARE LOAD-BEARING.
 *
 * 1. The body is `{ status }`. It used to be `{ stage }`, and `stage` is not a path on the Lead
 *    schema, so Mongoose strict mode dropped it: the server answered 200 with the record
 *    unchanged and wrote no `status_change` timeline row. Every stage change in this app's
 *    history was a no-op that reported success to a validator of `() => true`.
 *
 * 2. It returns the updated lead instead of `void`, so the caller no longer needs a second
 *    request to confirm. `PUT` runs `findByIdAndUpdate(…, { new: true })` and returns the
 *    POST-update document (`routes/leads.js:404-435`), which is the strongest confirmation
 *    available — and it removes a real failure of the old read-back: `PUT` has no ownership
 *    check while `GET /:id` has a strict one, so for an unowned lead (which the list
 *    deliberately shows — `utils/scope.js:121-126`) the write succeeded and the confirming read
 *    403'd, telling the user their change was not saved when it had been.
 *
 * A failed write no longer edits the local buffer. The screens roll the stage back and say so;
 * a buffer holding the new value would contradict the message the user just read.
 */
export async function setLeadStage(id: string, stage: LeadStage): Promise<Lead | null> {
  const real = await tryReal<any>(
    `/leads/${id}`,
    { method: 'PUT', body: JSON.stringify({ status: stage }) },
    (d) => isObj(d) && isObj(d.lead),
  );
  return real ? adaptLead(real.lead) : null;
}

/** What `addLead` resolves to. Three outcomes that must not look alike to the caller. */
export type AddLeadResult =
  /** The server created it. `lead` is the server's own record. */
  | { ok: true; lead: Lead }
  /** HTTP 400: the server understood and refused. Nothing was written, here or there. */
  | { ok: false; reason: 'invalid'; message: string }
  /** The write never landed. `lead` is what the user typed, held in the local buffer. */
  | { ok: false; reason: Exclude<WriteFailure, 'invalid'>; lead: Lead };

/**
 * Create a lead.
 *
 * THE BODY IS NOW A LEAD DOCUMENT. It used to be the app's own object — `id`, `stage`,
 * `interest`, `potential`, `city`, `priority`, `createdAt`, `lastActivity` and `notes: []`.
 * `POST /api/leads` spreads the whole body into `Lead.create` (`routes/leads.js:315-320`), so
 * strict mode dropped eight of those eleven keys and `notes: []` went at a `String` path. The
 * fields below are the schema's own names (`models/Lead.js:10-56`).
 *
 * `priority` is deliberately not sent. The Add sheet never asked for it — it passed a hardcoded
 * `'warm'` — the schema has no such path, and the field priority is *derived* from is
 * `probability`, whose default is 10. Sending a probability picked to make the badge read "warm"
 * would be inventing a number.
 *
 * A 400 IS NOT AN OUTAGE AND NOT A LOCAL SAVE. `phone` is required and validated server-side
 * (`isMobilePhone`), so a typo is the likeliest failure of all — and routed through `tryReal` it
 * would have reported "some data could not load" to the entire app. It is also the one failure
 * where buffering the record would be a fabrication: the server has refused this lead, and it
 * will keep refusing it until the user changes what they typed.
 */
export async function addLead(data: Partial<Lead>): Promise<AddLeadResult> {
  const local: Lead = {
    id: 'l' + (Date.now() % 100000), name: data.name || 'New Lead', phone: data.phone || '',
    stage: 'new_lead', source: data.source || 'Manual', interest: data.interest || '',
    potential: data.potential || 0, city: data.city || '',
    // 'cold', not the old invented 'warm'. This record has to read the same way the server's
    // copy of it would: `probability` defaults to 10 (`models/Lead.js:47-52`) and `adaptLead`'s
    // ladder turns 10 into 'cold'. A held record that reads 'warm' and a saved one that reads
    // 'cold' would be the same lead wearing two badges depending on the connection.
    priority: data.priority || 'cold',
    createdAt: new Date().toISOString(), lastActivity: new Date().toISOString(), notes: [],
  };

  const body: Record<string, unknown> = {
    name: (data.name || '').trim(),
    phone: (data.phone || '').trim(),
    // The sheet promises "It starts at the New stage" in writing. The schema default agrees
    // (`models/Lead.js:32`), but the promise should not depend on a default.
    status: 'new_lead' satisfies LeadStage,
  };
  if (data.interest) body.insurance_need = data.interest;
  if (data.city) body.address = { city: data.city };
  if (data.potential) body.expected_premium = data.potential;
  if (data.source) body.source = data.source;

  let reason: Exclude<WriteFailure, 'invalid'> = 'network';
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, status, json } = await req('/leads', { method: 'POST', body: JSON.stringify(body) });
      if (ok && isObj(json?.data?.lead)) return { ok: true, lead: adaptLead(json.data.lead) };
      if (status === 400) {
        // express-validator puts the human sentence in `details[].msg`. The two envelopes in
        // play use different keys for the summary (`error` from routers, `message` from
        // middleware — `enums.md` §15), so both are read.
        const msg = json?.details?.[0]?.msg || json?.error || json?.message;
        return { ok: false, reason: 'invalid', message: String(msg || 'The server refused this lead.') };
      }
      if (ok) { reportFailure('/leads'); reason = 'server'; }          // 2xx with no `data.lead`
      else {
        reportIfOutage(status, '/leads');
        // `reportIfOutage` leaves a "this was an answer" note for `unavailable` to consume, and
        // this function never calls `unavailable`. Left behind, that note would be eaten by the
        // NEXT failure of `GET /leads` — one real outage, silently unreported. Read paths clear
        // it for themselves; a write path has to clear its own.
        suppressed.delete('/leads');
        reason = status === 403 ? 'forbidden' : status === 404 || status === 501 ? 'unsupported' : 'server';
      }
    } catch { reportFailure('/leads'); }
  }

  // A refusal the user cannot fix by trying again — no `sales` module (403), or an endpoint that
  // is not there (404/501) — is not held. Same reasoning as the 400 above: this lead will never
  // exist, so keeping it in the list would be the fabrication this file was built to remove.
  // A dropped connection or a 5xx IS held: that is what the buffer is for.
  if (reason === 'network' || reason === 'server') state.leads.unshift(local);
  await wait(250);
  return { ok: false, reason, lead: clone(local) };
}

/* ---------------------------------------------------------------- Clients */
/**
 * IMPORTANT: on the live backend `GET /clients` is ownership-scoped (RBAC) and
 * returns 0 rows for accounts that don't own records. Passing `?scope=all` unlocks
 * the full 9,012-client book (100/page, supports `page` + `search`) with the complete
 * lic-import documents, so that is the real source for the Clients list.
 */
const CLIENT_PAGE = 100;

/** Session cache so client detail works and renewal scans reuse loaded pages. */
const clientCache = new Map<string, Client>();
let clientTotal = 0;

/**
 * One page of the REAL client book. `GET /clients?scope=all` returns the full
 * lic-import documents (name, mobile, dob, fupDate, premium, sumAssured, policyNo…)
 * with accurate pagination. `scope=all` is required because the backend RBAC
 * defaults super_admin/admin to "own records only" (0 rows) unless it's passed.
 */
export async function getClientsPage(page = 1, search = ''): Promise<{ items: Client[]; hasMore: boolean; total: number }> {
  const q = `/clients?limit=${CLIENT_PAGE}&page=${page}&scope=all${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  if (sessionReal && !FORCE_DEMO) {
    /**
     * PHASE 3: THIS PATH USED TO FAIL IN COMPLETE SILENCE, and it is the busiest read in
     * the app. A throw, a non-2xx, or a `data` that is not an array all fell through to the
     * permanently-empty `state.clients` buffer below and returned `{ items: [], total: 0 }`
     * with the health channel untouched. `src/app/(tabs)/clients.tsx:169-181` branches on
     * `health.degraded`, which stayed false — so a field agent with a 9,000-client book was
     * told "No clients in your book yet. Clients appear here as soon as records are assigned
     * to you." The correct copy was already written on the line beside it and never ran.
     */
    try {
      const { ok, status, json } = await req(q, {}, REQUEST_TIMEOUT, '/clients');
      if (ok && Array.isArray(json?.data)) {
        const items = json.data.map(adaptClient);
        items.forEach((cl: Client) => clientCache.set(cl.id, cl));
        const totalPages = Number(json.totalPages) || 0;
        if (!search) clientTotal = totalPages * CLIENT_PAGE; // approximate; exact total via getClientStats
        return { items, hasMore: page < totalPages, total: totalPages };
      }
      // A 2xx whose `data` is not an array is as unusable as a 500, and must not read as empty.
      if (ok) reportFailure('/clients');
      else reportIfOutage(status, '/clients');
    } catch { reportFailure('/clients'); }
  }
  const all = search
    ? state.clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
    : state.clients;
  await wait();
  return { items: clone(all), hasMore: false, total: all.length };
}

/** Portfolio stats. Exact client total comes from the paginator (totalPages @ limit 1). */
export async function getClientStats(): Promise<{ total_clients: number; total_premium: number; total_sum_assured: number; birthdays_this_month: number } | null> {
  if (!sessionReal || FORCE_DEMO) return null;
  let total = 0;
  let countOk = false;
  try {
    const { ok, status, json } = await req('/clients?limit=1&page=1&scope=all', {}, REQUEST_TIMEOUT, '/clients');
    if (ok) { total = Number(json?.totalPages) || 0; countOk = true; } // limit=1 -> totalPages == exact doc count
    else reportIfOutage(status, '/clients');
  } catch { reportFailure('/clients'); }
  // The aggregation endpoint is scope-buggy for super_admin; use it only if it returns real numbers.
  const agg = await tryReal<any>('/clients/stats/overview?scope=all', {}, isObj);
  /**
   * PHASE 3: NULL WHEN NOTHING ANSWERED. This is the defect the phase's DONE-WHEN names.
   *
   * Both requests used to be swallowed and the function returned an object literal on every
   * path — `total` defaulting to 0 through the `catch`, every other field `agg?.x ?? 0`. So
   * `stats` was ALWAYS truthy for a signed-in user, which made `if (!dov && !stats && !ov)`
   * in `getOrgSnapshot` unreachable dead code, which in turn made the Master dashboard render
   * "0 clients · ₹0 claims paid" as fact on a completely dead backend, and made the honest
   * empty state already written at `src/app/(tabs)/home.tsx:1918-1935` unreachable too.
   *
   * A zero here is only trustworthy if something actually answered. If neither leg did, the
   * caller gets `null` and renders "could not load" instead of a confident empty organisation.
   */
  if (!countOk && !agg) return null;
  return {
    total_clients: total || (agg?.total_clients ?? 0),
    total_premium: agg?.total_premium ?? 0,
    total_sum_assured: agg?.total_sum_assured ?? 0,
    birthdays_this_month: agg?.birthdays_this_month ?? 0,
  };
}

export async function getClients(): Promise<Client[]> {
  const { items } = await getClientsPage(1);
  return items;
}

/**
 * REAL renewal audience — the backend campaign aggregation is scope-buggy for
 * super_admin, so we scan the real client book (fupDate within `days`) ourselves,
 * page by page, reporting progress. Bounded so a huge book can't hang the UI.
 */
export type RenewalClient = { id: string; name: string; phone: string; premium: number; policyNo: string; dueDate: string };
export async function scanRenewals(
  days = 30,
  onProgress?: (scanned: number, found: number, total: number) => void,
  maxPages = 95,
): Promise<RenewalClient[]> {
  const found: RenewalClient[] = [];
  if (!sessionReal || FORCE_DEMO) {
    await wait(400);
    const now = new Date();
    return state.clients
      .filter((c) => { const d = c.policies[0]?.nextRenewal; return d && new Date(d).getMonth() === now.getMonth(); })
      .map((c) => ({ id: c.id, name: c.name, phone: c.phone, premium: c.totalPremium, policyNo: c.policies[0]?.number || '', dueDate: c.policies[0]?.nextRenewal || '' }));
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let page = 1, totalPages = 1, scanned = 0;
  do {
    let json: any = null;
    // PHASE 3: a skipped page is reported. A renewal audience shrunk by an outage used to be
    // indistinguishable from "nobody is due" — and this list decides who gets contacted about
    // a lapsing policy, so a silently short one costs real renewals.
    try {
      const r = await req(`/clients?limit=${CLIENT_PAGE}&page=${page}&scope=all`, {}, REQUEST_TIMEOUT, '/clients');
      if (r.ok) json = r.json; else reportIfOutage(r.status, '/clients');
    } catch { reportFailure('/clients'); }
    const rows: any[] = json?.data || [];
    totalPages = Number(json?.totalPages) || totalPages;
    for (const raw of rows) {
      const fup = raw.fupDate || raw.fup_date || raw.next_premium_date;
      if (!fup) continue;
      const base = new Date(fup); if (isNaN(base.getTime())) continue;
      // next annual occurrence of the premium-due date
      let due = new Date(today.getFullYear(), base.getMonth(), base.getDate());
      if (due < today) due = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
      const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
      if (diff >= 0 && diff <= days) {
        const digits = String(raw.mobile || raw.phone || raw.phoneLast10 || '').replace(/\D/g, '');
        if (!digits) continue;
        found.push({
          id: String(raw._id || raw.id), name: adaptClient(raw).name,
          phone: digits.length === 10 ? '+91' + digits : '+' + digits,
          premium: Number(raw.premium || raw.premium_amount) || 0,
          policyNo: String(raw.policyNo || raw.policy_number || ''), dueDate: due.toISOString(),
        });
      }
    }
    scanned += rows.length;
    onProgress?.(scanned, found.length, totalPages * CLIENT_PAGE);
    page += 1;
  } while (page <= totalPages && page <= maxPages);
  return found;
}
export async function getClient(id: string): Promise<Client | undefined> {
  if (clientCache.has(id)) return clone(clientCache.get(id)!);
  const real = await tryReal<any>(`/clients/${id}?scope=all`, {}, (d) => d && (d.name || d._id));
  if (real) return adaptClient(real);
  return unavailable('/clients/:id', state.clients.find((c) => c.id === id));
}

/* ----------------------------------------------------------------- Claims */
const claimCache = new Map<string, Claim>();
/** Real claims register — `?scope=all` unlocks the whole book for super_admin, and
 *  adaptClaim maps the register shape (claim_number/claim_amount/patient_name/status). */
export async function getClaims(): Promise<Claim[]> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, json } = await req('/claims?limit=500&scope=all');
      const arr = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : null);
      if (ok && arr) {
        const claims = arr.map(adaptClaim);
        claims.forEach((c: Claim) => claimCache.set(c.id, c));
        return claims;
      }
    } catch { /* fall through */ }
  }
  return unavailable('/claims', state.claims);
}
export async function getClaim(id: string): Promise<Claim | undefined> {
  if (claimCache.has(id)) return clone(claimCache.get(id)!);
  const real = await tryReal<any>(`/claims/${id}?scope=all`, {}, (d) => d && (d.id || d._id || d.claim_number));
  if (real) return adaptClaim(real);
  return unavailable('/claims/:id', state.claims.find((c) => c.id === id));
}
// App claim type → backend register enum (health|life|motor|property|travel|other).
const CLAIM_TYPE_TO_SERVER: Record<Claim['type'], string> = {
  Health: 'health', Death: 'life', Maturity: 'life', Surrender: 'other', Accident: 'motor',
};
export type NewClaimInput = { clientId?: string; clientName?: string; clientPhone?: string; policyNumber?: string; type?: Claim['type']; amount?: number; insurer?: string; notes?: string; docs?: any[] };

/** Create a real register claim via POST /claims/ (needs an existing client_id +
 *  a valid claim_type). Returns { forbidden } on 403, { error } on validation. */
export async function addClaim(data: NewClaimInput): Promise<Claim & { forbidden?: boolean; error?: string }> {
  const type = (data.type as Claim['type']) || 'Health';
  const local: Claim = {
    id: 'cl' + (Date.now() % 100000), ref: 'CLM-' + String(1000 + (Date.now() % 9000)),
    clientName: data.clientName || 'New Client', clientPhone: data.clientPhone || '',
    type, policyNumber: data.policyNumber || '', amount: data.amount || 0, status: 'submitted',
    insurer: data.insurer || 'LIC of India', openedAt: new Date().toISOString(), ageDays: 0,
    docs: data.docs || [],
    timeline: [{ id: 't' + Date.now(), label: 'Claim registered', at: new Date().toISOString(), by: currentUserName || 'Admin' }],
    aiSummary: data.notes || 'New claim created. Collect required documents to proceed.',
  };
  if (sessionReal && !FORCE_DEMO && data.clientId) {
    try {
      const body = {
        client_id: data.clientId,
        claim_amount: Number(data.amount) || 0,
        claim_type: CLAIM_TYPE_TO_SERVER[type] || 'health',
        notes: data.notes || '',
        policy_number: data.policyNumber || '',
        status: 'submitted',
      };
      const { ok, status, json } = await req('/claims/', { method: 'POST', body: JSON.stringify(body) });
      if (status === 403) return { ...local, forbidden: true };
      const created = json?.data;
      if (ok && (created?.id || json?.success)) {
        return adaptClaim({
          id: created?.id, claim_number: created?.claim_number, patient_name: data.clientName,
          claimant: { name: data.clientName, phone: data.clientPhone }, policy_number: data.policyNumber,
          claim_amount: body.claim_amount, claim_type: body.claim_type, status: 'submitted',
          insurer_company: data.insurer, last_note: data.notes, created_at: new Date().toISOString(),
        });
      }
      return { ...local, error: json?.message || 'Could not create the claim. Pick a client and try again.' };
    } catch (e: any) { return { ...local, error: e?.message || 'Could not reach the server.' }; }
  }
  state.claims.unshift(local); await wait(300); return clone(local);
}
export async function toggleClaimDoc(claimId: string, docId: string): Promise<void> {
  const c = state.claims.find((x) => x.id === claimId);
  const doc = c?.docs.find((x) => x.id === docId);
  if (doc) doc.received = !doc.received;
  await wait(100);
}

/* -------------------------------------------------------------- Reminders */
export async function getReminders(): Promise<Reminder[]> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, json } = await req('/reminders?limit=100');
      const arr = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : null);
      if (ok && arr) return arr.map(adaptReminder);
    } catch { /* fall through */ }
  }
  return unavailable('/reminders', state.reminders);
}
/**
 * Mark a reminder done, for real. PHASE 9.
 *
 * One-way on purpose: the only "this is finished" write the backend offers is
 * `POST /reminders/:id/acknowledge` (`routes/reminders.js:419`, sets `status:'acknowledged'`),
 * and there is no un-acknowledge — `PUT /:id` takes no `status`, and `/:id/cancel` sets
 * `cancelled` (still *done* to `adaptReminder`). So this completes a reminder and returns whether
 * the SERVER accepted it; the screen reverts its optimistic tick when it did not, rather than
 * leaving a tick that the next `getReminders` would wipe. Same shape as `markAllNotificationsRead`
 * — no `reportFailure`, because a single user-initiated write surfaces inline, not on the global
 * read-outage banner.
 */
export async function toggleReminder(id: string): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO) return false;
  try {
    const { ok, json } = await req(`/reminders/${id}/acknowledge`, { method: 'POST' });
    if (!ok || json?.success === false) return false;
    const r = state.reminders.find((x) => x.id === id);
    if (r) r.done = true;
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------- Misc */
/**
 * The caller's OWN earned-commission aggregate — the commissions-screen ledger.
 * `GET /api/commissions/my-summary` (`contracts/api.md` §`/api/commissions`, backend Phase 31).
 *
 * SELF-SCOPED BY THE SERVER, LIKE `/payroll/my-earnings`. `protect`-only; the backend FORCES the
 * summary to the token identity and ignores any `?user_id=`/`?advisor_id=`, so a caller can only
 * ever read their OWN commissions. We send NO query params — the windows are fixed to the server
 * clock and bucketed on each commission's business period (`month`+`year`), NOT `created_at`, so a
 * July commission counts as July regardless of when it was keyed in. `pending` is the approved-but-
 * unpaid balance; `thisMonth`/`lastMonth`/`ytd`/`history` sum earned rows (every status except
 * `cancelled`/`disputed`). Every ₹ is the server's own summed rows — the app never multiplies.
 *
 * WHAT IT CARRIES. The EARNED money (`thisMonth/lastMonth/pending/ytd/history/recent`) plus, since
 * backend Phase 62 (2026-08-17, D-87): `target` — the advisor's NEXT MDRT tier premium
 * `{ current, next, next_premium, to_next, achieved_premium, basis }` or `null` — and `byProduct` —
 * this-year earned commissions grouped by product `[{ product, amount, count }]` with `Σ amount === ytd`.
 * Both are server-computed from the SAME FYC basis as `/advisor/performance`, so the tier can never
 * differ between the two surfaces; the screen no longer needs a second `getMdrtTier` call for the tier.
 * `target` is a PREMIUM/production goal, NOT a rupee-commission target — the screen labels it so.
 * Every ₹ is the server's own summed rows; the app never multiplies or invents a figure.
 *
 * TWO OUTCOMES, told apart — `req()` not `tryReal`, so a shape miss reports rather than silently
 * collapsing the envelope. There is NO `data:null` empty here: an advisor with no commissions gets a
 * 200 with zeros + empty arrays, which is an `ok` the screen renders as its calm "none yet" state.
 *   - `ok`    — a 200 whose `data` is an object. Zeros included: 200-zeros is NOT an outage and
 *               raises no banner; the screen's own blank check turns it into the empty state.
 *   - `error` — a 503 (DB down; banner via `reportIfOutage`) OR a dead network / abort / contract-
 *               shape miss. A 401/403/404 answer is suppressed (no banner). The screen shows its
 *               "did not load" state and the global <HealthBanner/> speaks once for a real outage.
 */
export type CommissionSummaryResult = { status: 'ok'; summary: Commission } | { status: 'error' };

export async function getCommissionSummary(): Promise<CommissionSummaryResult> {
  if (FORCE_DEMO || !sessionReal) return { status: 'error' };   // no request attempted
  const path = '/commissions/my-summary';
  const key = healthKey(path);
  try {
    const { ok, status, json } = await req(path, {}, REQUEST_TIMEOUT, key);
    if (!ok) { reportIfOutage(status, key); return { status: 'error' }; }
    const data = json?.data;
    if (!isObj(data)) { reportFailure(key); return { status: 'error' }; }      // 200 but the envelope drifted
    const fin = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const history: Commission['history'] = Array.isArray(data.history)
      ? data.history
          .filter((m: any) => m && typeof m.month === 'string' && Number.isFinite(m.amount))
          .map((m: any) => ({ month: m.month as string, amount: fin(m.amount) }))
      : [];
    const recent: Commission['recent'] = Array.isArray(data.recent)
      ? data.recent
          .filter((r: any) => r && typeof r === 'object')
          .map((r: any) => ({
            id: typeof r.id === 'string' ? r.id : '',
            client: typeof r.client === 'string' ? r.client : '',
            plan: typeof r.plan === 'string' ? r.plan : '',
            amount: fin(r.amount),
            date: typeof r.date === 'string' ? r.date : '',
          }))
      : [];
    // `target` is the next-MDRT-tier premium goal (object) or `null`; camel-cased off the wire's
    // snake_case. Defended field-by-field so a partial/odd object degrades to `null`, never a crash.
    const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
    const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const t: any = data.target;
    const target: Commission['target'] = isObj(t)
      ? { current: str(t.current), next: str(t.next), nextPremium: numOrNull(t.next_premium), toNext: fin(t.to_next), achievedPremium: fin(t.achieved_premium) }
      : null;
    // `byProduct`: this-year earned rows grouped by product, server-sorted amount desc (Σ === ytd).
    const byProduct: Commission['byProduct'] = Array.isArray(data.byProduct)
      ? data.byProduct
          .filter((p: any) => p && typeof p.product === 'string' && p.product)
          .map((p: any) => ({ product: p.product as string, amount: fin(p.amount), count: fin(p.count) }))
      : [];
    return {
      status: 'ok',
      summary: {
        thisMonth: fin(data.thisMonth),
        lastMonth: fin(data.lastMonth),
        pending: fin(data.pending),
        ytd: fin(data.ytd),
        target,
        byProduct,
        history,
        recent,
      },
    };
  } catch {
    reportFailure(key);            // dead network or the 4.5 s abort
    return { status: 'error' };
  }
}

/**
 * The caller's OWN MDRT/COT/TOT achievement tier — the commissions-screen tier-progress element.
 * `GET /api/advisor/performance/:advisorId` (`contracts/api.md` §`/api/advisor`, backend Phase 29).
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT THE COMMISSIONS METER. Commissions is still blocked on an
 * earned aggregate (`/commissions/my-summary`, filed to `cgpe-api`, unscoped). This is a SEPARATE,
 * real datum we can already show: the server-authoritative tier ladder derived from an advisor's
 * FYC `total_premium` (`utils/mdrtTiers.js`, six owner-confirmed thresholds ₹3.75L…₹90L). It is an
 * ANNUAL cumulative-premium goal, a different unit than the screen's monthly-commission meter — so
 * it renders as its own element and is NEVER fed into that meter (INBOX 2026-08-12).
 *
 * SELF-SCOPED BY CALLER, NOT BY THE SERVER. This route has no forced self-scope like `/my-earnings`;
 * the screen passes the signed-in user's OWN id. For `role === 'advisor'` the backend 403s any id but
 * their own (`advisor.js:28`), and a `leader` is team-scoped (403 on their own id — no self team row),
 * so the caller must be an advisor-track role reading themselves. The screen gates the call to
 * `advisor`/`learn_advisor` before it reaches here; a 403 is still handled as an answer, not an outage.
 *
 * TWO OUTCOMES, told apart — `req()` not `tryReal`, so a shape miss reports rather than silently
 * collapsing the envelope:
 *   - `ok`    — a valid `performance.mdrt_tier` + numeric `total_premium`; every ₹ is the server's.
 *   - `error` — a 5xx/network/abort (banner via `reportIfOutage`) OR a 401/403/404 answer (suppressed,
 *               no banner). The tier card renders nothing on error — it is a bonus element, and a real
 *               outage is already announced once by the global `<HealthBanner/>`.
 */
export type MdrtTier = {
  /** Highest tier reached, `null` below Quarter MDRT (₹3.75L). Rendered verbatim — no acronym invented. */
  current: string | null;
  /** The next tier up, `null` at TOT (the top). */
  next: string | null;
  /** Rupee FYC target for `next`, `null` at TOT. */
  nextPremium: number | null;
  /** `max(0, nextPremium − totalPremium)`; `0` at TOT. */
  toNext: number;
  /** Cumulative FYC premium the tier is bucketed from (rupees). */
  totalPremium: number;
};
export type MdrtTierResult = { status: 'ok'; tier: MdrtTier } | { status: 'error' };

export async function getMdrtTier(advisorId: string): Promise<MdrtTierResult> {
  if (FORCE_DEMO || !sessionReal || !advisorId) return { status: 'error' };   // no request attempted
  const path = `/advisor/performance/${encodeURIComponent(advisorId)}`;
  const key = '/advisor/performance/:id';   // stable banner key regardless of the id's form
  try {
    const { ok, status, json } = await req(path, {}, REQUEST_TIMEOUT, key);
    if (!ok) { reportIfOutage(status, key); return { status: 'error' }; }
    const perf = json?.data?.performance;
    const mt = perf?.mdrt_tier;
    if (isObj(perf) && isObj(mt) && typeof perf.total_premium === 'number' && Number.isFinite(perf.total_premium)) {
      const fin = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
      return {
        status: 'ok',
        tier: {
          current: typeof mt.current === 'string' ? mt.current : null,
          next: typeof mt.next === 'string' ? mt.next : null,
          nextPremium: typeof mt.next_premium === 'number' && Number.isFinite(mt.next_premium) ? mt.next_premium : null,
          toNext: fin(mt.to_next),
          totalPremium: fin(perf.total_premium),
        },
      };
    }
    reportFailure(key);                                                        // 200 but the shape drifted
    return { status: 'error' };
  } catch {
    reportFailure(key);                                                        // dead network or the abort
    return { status: 'error' };
  }
}
const waThreadCache = new Map<string, WaThread>();

/**
 * The recipient's 10 digits recovered from a hub thread id, or `''`. PHASE 5.
 *
 * A hub thread's id IS its `thread_ref`, and the backend builds that itself as
 * `` `custom:${pl10}` `` (`routes/whatsapp.js:829`), reads it back with its own `last10()`, and
 * serves it as `thread_ref` unchanged (`normThread:665`). So the number is recoverable from the
 * id alone — which is the only thing that makes a send work on a cold start straight into a chat,
 * when `waThreadCache` is empty because `getWaThreads` has not run in this process.
 *
 * DELIBERATELY STRICT, because the failure mode is messaging a stranger. It accepts only the two
 * shapes the server actually produces — `<prefix>:<10 digits>` and a bare 10 digits (`adaptWaThread`
 * falls back to `phone_last10` when `thread_ref` is null) — and refuses anything else outright. A
 * lenient "strip non-digits and take the last ten" would turn an id that merely *contains* digits,
 * such as a Mongo `_id` hex, into a plausible Indian mobile number and send a customer's message
 * to it. An unsendable chat is a bad afternoon; a message delivered to the wrong person is not
 * recoverable.
 */
function waPhoneFromThreadId(threadId: string): string {
  const tail = String(threadId || '').split(':').pop() ?? '';
  return /^\d{10}$/.test(tail) ? tail : '';
}

/** The last 10 digits of a phone we were given by the server — `+919876543210` → `9876543210`. */
function last10(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}
/** Real WhatsApp hub threads — `?scope=all` unlocks the whole inbox; adaptWaThread
 *  maps thread_ref/preview/last_at/phone_last10 (the UI's id/lastMessage/lastAt/phone). */
export async function getWaThreads(): Promise<WaThread[]> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, json } = await req('/whatsapp/hub/threads?scope=all&limit=100');
      const arr = Array.isArray(json?.data) ? json.data : null;
      if (ok && arr) {
        const threads = arr.map(adaptWaThread);
        threads.forEach((t: WaThread) => waThreadCache.set(t.id, t));
        return threads;
      }
    } catch { /* fall through */ }
  }
  return unavailable('/whatsapp/hub/threads', state.waThreads);
}
/** One conversation — thread meta from the cached list + messages from
 *  /whatsapp/hub/messages?threadRef= (merged inbound + outbound, chronological). */
export async function getWaThread(id: string): Promise<WaThread | undefined> {
  const meta = waThreadCache.get(id);
  if (sessionReal && !FORCE_DEMO && (meta || id)) {
    try {
      const ref = encodeURIComponent(meta?.id || id);
      const { ok, json } = await req(`/whatsapp/hub/messages?threadRef=${ref}&scope=all&limit=200`);
      const arr = Array.isArray(json?.data) ? json.data : null;
      if (ok && arr) {
        const messages = arr.map(adaptWaMessage);
        // PHASE 5: the cold-cache stub used to carry `phone: ''`, so opening a chat without
        // having loaded the inbox first (a cold start, a deep link) produced a thread nobody
        // could call, WhatsApp, or send to. The id carries the number — see `waPhoneFromThreadId`.
        const p10 = waPhoneFromThreadId(id);
        const stub: WaThread = {
          id, name: 'WhatsApp user', phone: p10 ? '+91' + p10 : '',
          lastMessage: '', lastAt: '', unread: 0, messages: [],
        };
        return { ...(meta || stub), messages };
      }
    } catch { /* fall through */ }
  }
  return unavailable('/whatsapp/hub/messages', state.waThreads.find((t) => t.id === id));
}
/**
 * What `sendWaMessage` resolves to. Four outcomes that must not look alike to the composer.
 *
 * `dispatched` is the only one that earns a tick. The other three all leave the user's words
 * needing somewhere to go, and the screen puts them back in the box.
 */
export type SendWaResult =
  /** n8n accepted it. `simulated` = dev safe-mode took it and will not deliver it. */
  | { ok: true; message: WaMessage; simulated: boolean }
  /** 200, but the gateway never took it. The row is in the server's log and nothing was sent. */
  | { ok: false; reason: 'undelivered'; configured: boolean; note: string }
  /** 400: the server understood and refused — or we knew it would and did not ask. */
  | { ok: false; reason: 'invalid'; message: string }
  /** The request itself did not land. */
  | { ok: false; reason: Exclude<WriteFailure, 'invalid'> };

/**
 * Send one WhatsApp message, and say what actually happened to it.
 *
 * FOUR THINGS WERE WRONG HERE AND THE FOURTH HID THE OTHER THREE.
 *
 * 1. The body said `message`. `routes/whatsapp.js:818` destructures `text`. The key was never
 *    read, so `body` was `''` and — `purpose` being unsent and therefore `'custom'` — line 824
 *    refused it with 400 `'Message text is required.'`
 * 2. The phone came from `state.waThreads`, which is `[]` for the life of the process and always
 *    was: four reads in this file, zero writes anywhere in `src/`. So `phone` was `undefined` and
 *    line 821 refused it with 400 `'A valid 10-digit phone is required.'` first. The real thread
 *    list is `waThreadCache`, ten lines up.
 * 3. It then pushed the message into that same empty array and called it sent.
 * 4. All of it ran through `tryReal(..., () => true)`, a validator that cannot fail, and the
 *    `null` was discarded — so the screen's error branch, which returns the words to the composer
 *    and raises a banner, had never once executed. Same shape of defect as Phase 1's write paths.
 *
 * WHY THIS CANNOT USE `tryReal`. The endpoint answers `200 success:true` for a message it never
 * dispatched: the handler writes an optimistic `wa_comm_messages` row (`:834-857`), *then* tries
 * the n8n webhook (`:869`), and returns 200 either way. The only honest signal is the **top-level
 * `delivery` object** (`:888-896`) — and `tryReal` returns `json?.data ?? json`, which throws it
 * away. `addLead` uses bare `req()` for the same reason.
 *
 * A 200 WITH `dispatched:false` IS NOT A SEND. The row exists, so "it saved" is true and beside
 * the point: nothing reached the customer. `configured:false` additionally means retrying can
 * never help — the webhook is unset on the server, not busy.
 */
export async function sendWaMessage(threadId: string, text: string): Promise<SendWaResult> {
  const body = String(text || '').trim();
  if (!body) return { ok: false, reason: 'invalid', message: 'There is nothing to send.' };

  // Cache first, then the id itself. See `waPhoneFromThreadId` for why the id is authoritative.
  const cached = waThreadCache.get(threadId);
  const p10 = last10(cached?.phone || '') || waPhoneFromThreadId(threadId);
  if (!p10) {
    // The server's answer is already known (400, `:821`), and we can say something truer than it
    // can: it is this conversation that has no number, not the message that is malformed.
    return { ok: false, reason: 'invalid', message: 'This chat has no phone number, so nothing can be sent to it.' };
  }

  if (!sessionReal || FORCE_DEMO) return { ok: false, reason: 'network' };

  const KEY = '/whatsapp/hub/send';
  try {
    const { ok, status, json } = await req(KEY, {
      method: 'POST',
      body: JSON.stringify({
        phone: p10,
        // The thread upsert is unconditional — `$set: { clientName: name || '' }` (`:860`) — so
        // omitting this does not leave the stored name alone, it wipes it for the panel too. The
        // placeholder is the one name we must NOT send: we only hold it when the server's own
        // `name`/`clientName` were both already empty, so `''` is lossless and it is not.
        name: cached && cached.name !== 'WhatsApp user' ? cached.name : '',
        text: body,
        // Explicit, though it matches the documented default: the server's "text is required"
        // check only fires *when* purpose is 'custom', and our empty-text guard above has to mean
        // the same thing that one does. Two validations kept in step by a default drift apart.
        purpose: 'custom',
        // `language` is deliberately absent. The server defaults it to 'hinglish'; the only
        // language this app knows is the advisor's own UI preference, which says nothing about
        // the customer whose thread it would be written onto.
      }),
    });

    if (ok && isObj(json?.data)) {
      if (!isObj(json?.delivery)) {
        // No `delivery` at all is a CONTRACT FAULT, not a quiet non-delivery. The endpoint
        // documents it as always present (`api.md`, "returns a top-level `delivery` object …
        // unique in this slice"), so its absence means the shape moved — and the health channel
        // is exactly what Phase 3 built for that. Reporting it as `undelivered` instead would
        // have made the screen say "the gateway is switched off", which we would not know.
        reportFailure(KEY);
        return { ok: false, reason: 'server' };
      }
      const delivery = json.delivery;
      if (!delivery.dispatched) {
        return {
          ok: false,
          reason: 'undelivered',
          configured: !!delivery.configured,
          // The server writes this sentence; rendering our own would guess at which of the two
          // non-dispatch cases happened when it has already said.
          note: String(delivery.note || ''),
        };
      }
      return {
        ok: true,
        message: adaptWaMessage(json.data),
        simulated: !!json.data.simulated,
      };
    }

    if (status === 400) {
      // This endpoint's two refusals are both `{ success:false, message }` (`:821`, `:824`).
      // `error` is read as well because `enums.md` §15 records both keys in play across routers.
      const msg = json?.message || json?.error;
      return { ok: false, reason: 'invalid', message: String(msg || 'The server refused this message.') };
    }

    if (ok) { reportFailure(KEY); return { ok: false, reason: 'server' }; }   // 2xx, no usable body

    reportIfOutage(status, KEY);
    // `reportIfOutage` leaves a "this was an answer" note for `unavailable` to consume, and this
    // function never calls `unavailable`. Left behind, it would be eaten by the next failure of a
    // read on the same key — one real outage, silently unreported. Phase 4's `addLead` bug.
    suppressed.delete(KEY);
    return {
      ok: false,
      reason: status === 403 ? 'forbidden' : status === 404 || status === 501 ? 'unsupported' : 'server',
    };
  } catch {
    reportFailure(KEY);
    return { ok: false, reason: 'network' };
  }
}
export async function getNotifications(): Promise<AppNotification[]> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, json } = await req('/notifications?limit=50');
      const arr = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : null);
      if (ok && arr) return arr.map(adaptNotification);
    } catch { /* fall through */ }
  }
  return unavailable('/notifications', state.notifications);
}
/**
 * Mark every notification read.
 *
 * THE BUG THIS FIXES. This used to call `POST /notifications/read-all`. The backend route is
 * `PUT /notifications/mark-all-read` — both the verb and the path were wrong, so the request
 * 404'd on every single invocation. `tryReal` swallows a non-2xx into `null`, so the failure
 * was silent: the local array was flipped to read, the badge cleared, and then the next fetch
 * pulled the server's still-unread rows straight back. That is the "not everything could be
 * marked as read" desync, and no amount of retrying could have fixed it.
 *
 * Now returns whether the SERVER accepted it, so the screen can refuse to clear its badge on
 * a failure instead of lying about it.
 */
export async function markAllNotificationsRead(): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO) return false;
  try {
    const { ok, json } = await req('/notifications/mark-all-read', { method: 'PUT' });
    if (!ok || json?.success === false) {
      reportFailure('/notifications/mark-all-read');
      return false;
    }
    return true;
  } catch {
    reportFailure('/notifications/mark-all-read');
    return false;
  }
}

/**
 * Mark ONE notification read — the per-item companion to `markAllNotificationsRead`.
 *
 * Backend: `PUT /api/notifications/:id/read` (`protect`, ownership-checked — `api.md:878`).
 * `id` is the row's Mongo `_id`, which is exactly what `adaptNotification` stores in
 * `AppNotification.id`, so it drops straight into the path. `healthKey` collapses that 24-hex
 * segment back to `/notifications/:id/read`, the same string used below.
 *
 * The server 404s a row that no longer exists and 403s one that is not the caller's. Both are
 * ANSWERS, not outages, so — like `reportIfOutage` — they stay quiet and let the screen roll
 * its optimistic row back; only a genuine fault (5xx, a malformed 4xx, or a dead network)
 * raises the app-wide health banner. Returns whether the SERVER accepted the write, the same
 * boolean contract as `markAllNotificationsRead`, so a caller never claims a read it did not get.
 */
export async function markNotificationRead(id: string): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO || !id) return false;
  try {
    const { ok, status, json } = await req(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' });
    if (ok && json?.success !== false) return true;
    if (![401, 403, 404, 501].includes(status)) reportFailure('/notifications/:id/read');
    return false;
  } catch {
    reportFailure('/notifications/:id/read');
    return false;
  }
}

/**
 * Dispatch a custom notification to the team. Admin/leader only.
 *
 * `audience: 'all'` fans out to every active staff member; `'selected'` targets the given
 * user_ids. Returns the number the server actually created, so the composer can report a
 * real figure rather than assuming success.
 *
 * REQUIRES BACKEND DEPLOY: this calls `POST /api/notifications/dispatch`, which is new in
 * this pass. Against a backend that predates it the call 404s and this returns
 * `{ ok: false, created: 0, needsDeploy: true }`, which the UI states plainly.
 */
export async function dispatchNotification(input: {
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high';
  audience: 'all' | 'selected';
  user_ids?: string[];
}): Promise<{ ok: boolean; created: number; message: string; needsRole?: boolean; needsDeploy?: boolean }> {
  if (!sessionReal || FORCE_DEMO) {
    return { ok: false, created: 0, message: 'Not signed in. Sign in to send notifications.' };
  }
  try {
    const { ok, status, json } = await req('/notifications/dispatch', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        message: input.message,
        priority: input.priority || 'medium',
        audience: input.audience,
        user_ids: input.audience === 'selected' ? (input.user_ids || []) : undefined,
      }),
    });
    if (status === 403) {
      return { ok: false, created: 0, needsRole: true, message: 'Your role cannot send team notifications.' };
    }
    if (status === 404) {
      return {
        ok: false, created: 0, needsDeploy: true,
        message: 'The server does not support team notifications yet. It needs the latest backend deploy.',
      };
    }
    if (!ok || json?.success === false) {
      return { ok: false, created: 0, message: json?.message || json?.error || 'Could not send the notification.' };
    }
    const created = Number(json?.data?.created ?? json?.created ?? 0);
    return { ok: true, created, message: json?.message || `Sent to ${created} ${created === 1 ? 'person' : 'people'}.` };
  } catch (e: any) {
    if (isUnreachable(e)) return { ok: false, created: 0, message: 'Could not reach the server. Check your connection.' };
    return { ok: false, created: 0, message: 'Could not send the notification.' };
  }
}
export async function getContests(): Promise<Contest[]> {
  return (await tryReal<Contest[]>('/contests', {}, isArr)) ?? unavailable('/contests', state.contests);
}
export async function getLicPlans(): Promise<LicPlan[]> {
  // GET /api/lic-plans → { success:true, data:{ meta, plans } } (routes/licPlans.js:62-71).
  // `tryReal` unwraps the `data` envelope, leaving `{ meta, plans }`; the plans are the legacy LIC
  // shape, mapped to the app's `LicPlan` by `adaptLicPlan`. The old code validated with `isArr`
  // against that object and always missed — so the screen showed empty (and raised a false outage)
  // against a healthy backend. The endpoint is LIVE, not 404 (app.js:461) — Phase 6, D-1.
  const real = await tryReal<{ plans?: unknown[] }>('/lic-plans', {}, (d) => d && Array.isArray(d.plans));
  if (!real || !Array.isArray(real.plans)) return unavailable('/lic-plans', state.licPlans);
  return real.plans.map(adaptLicPlan);
}

/* --------------------------------------------------------- Team (admin) */
function adaptMember(raw: any): TeamMember {
  return {
    id: String(raw.user_id || raw._id || raw.id),
    name: raw.full_name || raw.name || 'Member',
    role: raw.role || 'advisor',
    phone: raw.phone || raw.mobile || '',
    email: raw.email,
    agentCode: raw.agent_code || raw.employee_id || raw.code || '',
    tier: raw.tier || raw.club || 'Growth',
    branch: raw.branch || raw.department || '',
    online: !!raw.is_active,
    clockedIn: !!raw.clocked_in,
    lastActive: raw.last_login || raw.updated_at || new Date().toISOString(),
    stats: raw.stats || { clients: 0, premiumMtd: 0, policiesMtd: 0, renewalPct: 0, openClaims: 0, leads: 0 },
    activity: Array.isArray(raw.activity) ? raw.activity : [],
  };
}
/** REAL team roster — built from /team/task-overview (names, roles, departments,
 *  phones, manager and live task counts), falling back to /profiles. */
export async function getTeam(): Promise<TeamMember[]> {
  const ov = await getTaskOverview();
  if (ov && ov.members.length) {
    // Cross-reference the live attendance pins so "clocked in" is real (was hardcoded
    // false, so Team/Admin dashboards always said "0/15" even with 14 on duty).
    const pins = await getAgentLocations().catch(() => [] as AgentPin[]);
    const onDutyIds = new Set(pins.filter((p) => p.onDuty).map((p) => String(p.id)));
    const onDutyNames = new Set(pins.filter((p) => p.onDuty).map((p) => String(p.name).trim().toLowerCase()));
    const isOnDuty = (m: any) => onDutyIds.has(String(m.user_id)) || onDutyNames.has(String(m.name).trim().toLowerCase());
    return ov.members.map((m) => ({
      id: String(m.user_id || m.name),
      name: m.name,
      role: (m.role || 'advisor') as any,
      phone: m.phone ? (String(m.phone).length === 10 ? '+91' + m.phone : '+' + String(m.phone).replace(/^\+/, '')) : '',
      email: undefined,
      agentCode: '',
      tier: 'Growth' as any,
      branch: m.department || '',
      online: m.is_active !== false,
      clockedIn: isOnDuty(m),
      lastActive: new Date().toISOString(),
      stats: {
        clients: 0,
        premiumMtd: 0,
        policiesMtd: m.counts?.done ?? 0,
        renewalPct: m.completion_pct ?? 0,
        openClaims: 0,
        leads: m.counts?.open ?? 0,
      },
      activity: (m.tasks || []).slice(0, 6).map((t: any, i: number) => ({
        id: String(t.id || i),
        icon: 'checkbox-outline',
        text: `${String(t.status || 'open').toLowerCase() === 'done' ? 'Completed' : 'Working on'}: ${t.title}`,
        at: t.updated_at || t.created_at || new Date().toISOString(),
      })),
    })) as TeamMember[];
  }
  const real = await tryReal<any[]>('/profiles?limit=500', {}, isArr);
  return real ? real.map(adaptMember) : unavailable('/profiles', [] as TeamMember[]);
}
/**
 * Roster with REAL user_ids (from /profiles) — for the master track viewer's picker.
 *
 * This was the last sample-data leak in the app. It used to fall back to the seed roster in
 * `data/team.ts`, which meant a master whose /profiles call failed was offered a picker full
 * of invented colleagues, and selecting one queried movement tracks for a user id that does
 * not exist. Empty is the correct answer: the picker then shows its empty state.
 */
export async function getTrackableMembers(): Promise<{ id: string; name: string; role: string }[]> {
  const real = await tryReal<any[]>('/profiles?limit=100', {}, isArr);
  if (real) return real.filter((p) => p.user_id).map((p) => ({ id: String(p.user_id), name: p.full_name || p.name || 'Member', role: p.role || 'advisor' }));
  return unavailable('/profiles', [] as { id: string; name: string; role: string }[]);
}

export async function getTeamMember(id: string): Promise<TeamMember | undefined> {
  const real = await tryReal<any>(`/profiles/${id}`, {}, isObj);
  return real ? adaptMember(real) : unavailable('/profiles/:id', undefined as TeamMember | undefined);
}
/**
 * The team activity feed — currently unwired, and honest about it. PHASE 3.
 *
 * THIS USED TO FABRICATE AN OUTAGE. The body was `return unavailable('/activity', [])`, and
 * `unavailable` reports to `data/health` synchronously before its `await`. So every single
 * mount of the Team screen raised the global outage banner at t≈0 — against a perfectly
 * healthy backend — for a path the backend has NEVER had. `'/activity'` appears nowhere in
 * `contracts/api.md`, which lists all 61 mounted routers.
 *
 * Returning `[]` and reporting NOTHING is the truthful answer: no request failed, there is
 * simply nothing wired yet. The screen's response to `[]` is to render no section at all
 * (`src/app/team/index.tsx:146`), so no claim is made to the user either way.
 *
 * WIRING IT UP IS BLOCKED ON THE BACKEND, not on us. The real feed is
 * `GET /api/dashboard/activity` (`contracts/api.md:1272`), but its writer sets `actor.id`
 * while its reader filters `actor.user_id` (`contracts/models.md:1881`, `:2149`), so it
 * returns `[]` for every role including admin. Filed to `cgpe-api` in `contracts/INBOX.md`.
 * When that lands, use `tryEnvelope` — the response carries `total`, which `tryReal` discards.
 */
export async function getTeamActivity(): Promise<TeamActivity[]> {
  return [];
}

/** Global search across the REAL book — clients server-side, plus live leads/claims/tasks. */
export async function search(q: string) {
  const s = q.toLowerCase().trim();
  if (!s) return { leads: [], clients: [], claims: [], tasks: [] };
  const [clientsPage, leads, claims, tasks] = await Promise.all([
    getClientsPage(1, s), // server-side over all 9k clients
    getLeads().catch(() => [] as Lead[]),
    getClaims().catch(() => [] as Claim[]),
    getTasks(false).catch(() => [] as Task[]),
  ]);
  const hit = (t?: string) => !!t && t.toLowerCase().includes(s);
  return {
    clients: clientsPage.items.slice(0, 12),
    leads: leads.filter((l) => hit(l.name) || (l.phone || '').includes(s)).slice(0, 6),
    claims: claims.filter((cl) => hit(cl.clientName) || hit(cl.ref)).slice(0, 6),
    tasks: tasks.filter((tk) => hit(tk.title) || hit(tk.client)).slice(0, 6),
  };
}

/* ============================ Real feature actions ========================= */

/* ------------------------------------------------------- Office geofence */
export type Geofence = { lat: number; lng: number; radius_m: number; label: string; enforce: boolean };

/**
 * The office fence — or `null`, meaning we could not learn it. PHASE 7.
 *
 * THERE IS NO LONGER A FALLBACK FENCE, AND THAT IS THE POINT.
 * This used to fall back to a hardcoded Surat pin with a 2 km radius and `enforce: true`. The
 * server's own default is **200 m** (`cgpe-backend-main/utils/geofence.js:27`), so the offline
 * fence was not "strict" or "lenient" — it was *wrong in both directions*: ten times wider than
 * the server at the office pin, and absolutely closed anywhere else, including at an office the
 * master had legitimately moved the fence to. A coordinate compiled into the APK has to agree
 * with a row in someone else's database forever, which is the drift `cgpe-api` filed against the
 * admin panel as D13. An unknown fence is now represented as unknown.
 *
 * THERE IS NO CACHE EITHER, WHICH IS A DELIBERATE STEP BACKWARDS IN CLEVERNESS.
 * The old `_geoCache` was assigned on the first call *whatever happened*, so one failed fetch —
 * including a 404 on an undeployed route, which `reportIfOutage` deliberately keeps off the
 * health banner — fixed the fence for the life of the JS context, and nothing cleared it, not
 * even signing in as somebody else. Caching only successes fixed half of that and left the other
 * half: the master can move the office pin (`PUT /time-tracker/geofence`, which busts the
 * server's own 60 s cache at `routes/timeTracker.js:1293`) and a phone that has not been killed
 * since morning would keep the old fence all day.
 *
 * The whole cache bought one thing: skipping a request on a second reader. There is no second
 * reader — `checkGeofence` is the only caller and it runs once per clock-in tap, which happens
 * about twice a day. Deleting it makes a stale fence structurally impossible rather than
 * carefully handled.
 *
 * A fence with no usable radius fails `validate` rather than being repaired with an invented
 * number, so it reports as the contract fault it is and this returns null.
 */
export async function getGeofence(): Promise<Geofence | null> {
  const real = await tryReal<any>(
    '/time-tracker/geofence',
    {},
    (d) => d && Number.isFinite(d.lat) && Number.isFinite(d.lng) && Number(d.radius_m) > 0,
  );
  if (!real) return null;
  return {
    lat: Number(real.lat),
    lng: Number(real.lng),
    radius_m: Number(real.radius_m),
    label: String(real.label || 'Office'),
    // Mirrors the server's own reading of the flag (`utils/geofence.js:62`): anything but an
    // explicit false means the fence is on.
    enforce: real.enforce !== false,
  };
}

/** Haversine distance in metres (client-side pre-check, mirrors the server). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * A distance a person standing in the street can act on. PHASE 7.
 *
 * Metres below a kilometre, rounded to 10 m — the fence is a 200 m fence, and
 * `(200/1000).toFixed(1)` renders it as "0.2 km", which is the shape of the server's own stale
 * refusal copy (`utils/geofence.js:101`, filed as INBOX D10). The floor of 10 m stops a
 * near-miss reading as "0 m". Spaces are U+00A0 per `lib/format.ts`: a value must not wrap
 * between its number and its unit.
 */
export function distanceText(m: number): string {
  // Round FIRST, then pick the unit. Testing the raw value would render 995 m as "1000 m" — the
  // one string the metres branch exists to avoid.
  const rounded = Math.max(10, Math.round(m / 10) * 10);
  if (rounded >= 1000) return nbsp(`${(m / 1000).toFixed(1)} km`);
  return nbsp(`${rounded} m`);
}

export type GeofenceCheck = {
  allowed: boolean;
  /**
   * Whether we actually know the fence. `allowed: true, known: false` is a DEFERRAL — "ask the
   * server" — not a verdict, and a caller that cannot tell the two apart cannot write honest
   * copy. `enforce: false` from the server is `allowed: true, known: true`: the fence is off,
   * which is a fact rather than an absence of one.
   */
  known: boolean;
  distance_m: number | null;
  radius_m: number | null;
  message: string;
};

/**
 * Client-side clock-in pre-check. PHASE 7.
 *
 * THE RULE THIS FUNCTION NOW OBEYS: it may never refuse something the server would allow. Its
 * only job is to save a round trip on a refusal that is certain; `POST /time-tracker/clock-in`
 * re-validates every request and is the authority (`routes/timeTracker.js:317-318`), and
 * `home.tsx` hard-returns on a refusal here, so anything this function gets wrong in the strict
 * direction is a clock-in the server would have accepted and never hears about. Three
 * consequences, each deliberate:
 *
 *  - an unknown fence ALLOWS. See `getGeofence`.
 *  - the accuracy credit is coerced with `Number()`, matching `utils/geofence.js:88`. The old
 *    `typeof accuracy === 'number'` test gave a numeric-STRING fix a tolerance of 0 where the
 *    server gives it 100, so the app refused people the server would have let in.
 *  - the credit is clamped at zero. `Math.min(-200, 100)` is -200, which turned a negative
 *    accuracy into a stricter fence; the server has the same bug (`geofence.js:93`, no
 *    `Math.max`) but matching a bug is not agreement, and clamping only ever allows more.
 *
 * NOT MIRRORED, ON PURPOSE: the server refuses any fix coarser than 300 m outright
 * (`geofence.js:89`). Copying that threshold would duplicate a number that lives in someone
 * else's file and can move, to buy one round trip — and it would make this function refuse.
 * A weak fix now comes back as a 403 carrying the server's own, better sentence.
 */
export async function checkGeofence(lat?: number, lng?: number, accuracy?: number): Promise<GeofenceCheck> {
  const g = await getGeofence();
  if (!g) return { allowed: true, known: false, distance_m: null, radius_m: null, message: '' };
  if (!g.enforce) return { allowed: true, known: true, distance_m: null, radius_m: g.radius_m, message: '' };
  if (lat == null || lng == null || !isFinite(lat) || !isFinite(lng)) {
    return { allowed: false, known: true, distance_m: null, radius_m: g.radius_m, message: 'Enable location to clock in.' };
  }
  const dist = distanceMeters(lat, lng, g.lat, g.lng);
  const acc = Number(accuracy);
  const tol = Number.isFinite(acc) ? Math.max(0, Math.min(acc, 100)) : 0;
  // How far past the fence this fix is, with the accuracy credit already spent. <= 0 is inside.
  if (dist - tol - g.radius_m <= 0) {
    return { allowed: true, known: true, distance_m: Math.round(dist), radius_m: g.radius_m, message: 'Within the office area' };
  }
  return {
    allowed: false, known: true, distance_m: Math.round(dist), radius_m: g.radius_m,
    // STATES NO FENCE SIZE — INBOX D10. Both numbers are measured rather than quoted, so neither
    // can contradict the server the way "allowed within 0.2 km" does. The server's own refusal
    // copy, which does quote a radius and understates it by the accuracy credit, is rendered
    // verbatim when a 403 comes back: it is the producer's message, awkward rather than jargon.
    //
    // THE ADVICE DELIBERATELY SPENDS NO ACCURACY CREDIT, unlike the verdict one line above.
    // `dist - tol - radius` is the least that could possibly work, and only for THIS fix — walk
    // exactly that far, get a cleaner fix on arrival, and the credit shrinks and the refusal
    // repeats. `dist - radius` is sufficient whatever the next fix looks like. Advice has to
    // still be true after somebody follows it, so it is the conservative number that ships; the
    // cost is asking for up to 100 m more walking than strictly needed.
    message: `You're ${distanceText(dist)} from the office. Move about ${distanceText(dist - g.radius_m)} closer to clock in.`,
  };
}

/** Attendance clock-in with GPS -> POST /api/time-tracker/clock-in. Returns the
 *  server geofence verdict (403 → blocked with distance) and the session id. */
export async function clockIn(coords: { lat?: number; lng?: number; accuracy?: number; city?: string }): Promise<{ ok: boolean; message?: string; blocked?: boolean; distance_m?: number; sessionId?: string; reason?: WriteFailure }> {
  if (FORCE_DEMO) { await wait(300); return { ok: true }; }
  if (!sessionReal) return { ok: false, reason: 'network' };
  try {
    const { ok, status, json } = await req('/time-tracker/clock-in', {
      method: 'POST',
      body: JSON.stringify({ ...coords, source: 'mobile' }),
    });
    if (status === 403) return { ok: false, blocked: true, message: json?.message, distance_m: json?.distance_m };
    if (!ok) return { ok: false, reason: 'server', message: json?.message };
    const sessionId = json?.data?.session?._id || json?.data?.sessionId || json?.sessionId;
    return { ok: true, message: json?.message, sessionId: sessionId ? String(sessionId) : undefined };
  } catch {
    // PHASE 1: this used to return { ok: true }. A timeout or an offline handset therefore
    // started a local shift the server knew nothing about, with `sessionId` undefined — so the
    // whole day's GPS route attached to no session — and fired the app's one heavy haptic to
    // confirm it. Attendance feeds payroll; a silent loss here costs someone a day's pay.
    return { ok: false, reason: 'network' };
  }
}
export async function clockOut(coords: { lat?: number; lng?: number; accuracy?: number; city?: string } = {}): Promise<{ ok: boolean; blocked?: boolean; message?: string; distance_m?: number; reason?: WriteFailure }> {
  if (FORCE_DEMO) { await wait(200); return { ok: true }; }
  if (!sessionReal) return { ok: false, reason: 'network' };
  try {
    const { ok, status, json } = await req('/time-tracker/clock-out', { method: 'POST', body: JSON.stringify({ ...coords, source: 'mobile' }) });
    if (status === 403) return { ok: false, blocked: true, message: json?.message, distance_m: json?.distance_m };
    if (!ok) return { ok: false, reason: 'server', message: json?.message };
    return { ok: true };
  } catch {
    // Mirror of clock-in: a shift genuinely open on the server must stay visibly open on the
    // device, or the next clock-in silently overlaps a session that was never closed.
    return { ok: false, reason: 'network' };
  }
}
/**
 * The signed-in user's CURRENT clock state, straight from the server.
 *
 * WHY THIS EXISTS. Clock state used to live only in AsyncStorage under a device-scoped key
 * (`clock.<date>`), which made it a property of the HANDSET rather than of the person. On a
 * shared device that is straightforwardly wrong: user X clocks in, hands the phone to user Y,
 * and Y sees X's running shift and can clock X out. It also meant a user who logged in on a
 * second device saw "not clocked in" while the server had them on duty.
 *
 * `GET /time-tracker/current` resolves the DayLog from the JWT, so it is per-user by
 * construction and cannot be spoofed by local cache. This is now the source of truth; local
 * storage is only a paint-before-network cache, and it is keyed per user.
 *
 * Returns null when the state could not be read, so the caller can keep showing its cached
 * value rather than flipping the button to "Clock in" on a transient network blip.
 */
export type ClockSnapshot = {
  isClockedIn: boolean;
  isOnBreak: boolean;
  /** Seconds worked in the currently running session, breaks already deducted. */
  currentSessionTime: number;
  /** ISO timestamp the running session began, when the server reports one. */
  since?: string;
};

export async function getClockState(): Promise<ClockSnapshot | null> {
  const env = await tryEnvelope<any>('/time-tracker/current', (j) => j && j.data);
  if (!env) return null;
  const d = env.data || {};
  const day = d.dayLog || {};
  // The active session carries the clock-in stamp; fall back to deriving it from the
  // elapsed seconds the server already computed so the timer is right either way.
  let since: string | undefined;
  const sessions = Array.isArray(day.sessions) ? day.sessions : [];
  const active = sessions.find((x: any) => String(x?._id || x?.id) === String(day.activeSessionId));
  if (active?.clockIn) since = new Date(active.clockIn).toISOString();
  else if (d.isClockedIn && Number.isFinite(d.currentSessionTime)) {
    since = new Date(Date.now() - Number(d.currentSessionTime) * 1000).toISOString();
  }
  return {
    isClockedIn: !!d.isClockedIn,
    isOnBreak: !!d.isOnBreak,
    currentSessionTime: Number(d.currentSessionTime) || 0,
    since,
  };
}

export async function getAttendanceHistory(): Promise<any[]> {
  // History accrues in DayLog sessions via /time-tracker/history; fall back to the
  // per-user attendance endpoint used by the map so the screen is never empty.
  //
  // PHASE 3: BOTH LEGS REPORT UNDER ONE KEY, deliberately. This is a fallback CHAIN, not two
  // independent reads — the first leg missing is a normal, expected step on the way to the
  // second. Letting it report under its own key would raise an outage banner on a screen that
  // then loaded its data perfectly from the fallback. Only the pair failing is an outage, and
  // the shared key means exactly that: the second leg's success clears the first leg's entry.
  const real = await tryReal<any[]>('/time-tracker/history?limit=30', {}, isArr, '/attendance/history');
  if (real) return real;
  return (await tryReal<any[]>('/attendance/history?limit=30', {}, isArr, '/attendance/history')) ?? [];
}

/* ----------------------------------------------------- Payroll (admin-only) */
/**
 * One member's per-calendar-month payroll figures, as `GET /api/payroll/compute` returns
 * them (`contracts/api.md` §`/api/payroll`). `per_day_rate` is null for the `base` segment.
 * `payable_precise` is the un-rounded number; the roster's `payable` is the rounded ₹ figure.
 */
export type PayrollMonth = {
  year: number;
  month: number;
  working_days: number;
  present_days: number;
  worked_hours: number;
  per_day_rate: number | null;
  payable_precise?: number;
};
export type PayrollRow = {
  user_id: string;
  name: string | null;
  /** false = no staff Profile matched this payroll `user_id` (an orphan row). */
  staff_found: boolean;
  segment: string;            // 'day_wise' | 'hourly' | 'base'
  salary_amount: number;
  office_hours?: number;
  /** Server-computed, rounded to ₹1. The app RENDERS this; it never multiplies a rate. */
  payable: number;
  months: PayrollMonth[];
};

/**
 * Admin-only salary roster for a single calendar month.
 * `GET /api/payroll/compute?year=&month=` (the salary engine, `services/payrollEngine.js`).
 *
 * ACCESS. The whole payroll router is `router.use(protect); router.use(authorize('admin'))`
 * (`routes/payroll.js:22-23`), so ONLY an `admin`/`super_admin` token gets rows — a `leader`
 * or lower is **403**'d. `tryReal` classifies 403 as an ANSWER, not an outage, so it returns
 * `null` and raises no banner (the screen gates on the real role before calling, so a 403 is a
 * belt-and-braces edge, not the norm). A **503** (DB down) IS an outage and raises the banner.
 * **400** cannot occur here: the period is built from a real `year`+`month`, never reversed.
 *
 * RETURN. The roster array on success — possibly `[]` when no payroll profiles exist — or
 * `null` on any failure/refusal, so the screen can tell "loaded, none" from "could not load".
 * Every `payable` is computed server-side from the member's own `daylogs`; nothing here
 * derives money from a rate (CLAUDE.md money rule).
 */
export async function getPayrollRoster(year: number, month: number): Promise<PayrollRow[] | null> {
  return await tryReal<PayrollRow[]>(`/payroll/compute?year=${year}&month=${month}`, {}, isArr);
}

/**
 * The caller's OWN earnings for one month — the mobile Phase 16 self-view.
 * `GET /api/payroll/my-earnings?month=YYYY-MM` (`contracts/api.md` §`/api/payroll`, Phase 28).
 *
 * SELF-SCOPED, NO ROLE GATE. This is the ONE non-admin payroll route: `protect`-only, registered
 * above `authorize('admin')`. The backend FORCES `user_id` to the token identity, so a caller can
 * only ever read their own pay — we send NO `?user_id=`. It reuses the same `buildRoster()` + locked
 * salary engine as the admin `/compute`, so the number is byte-identical to an admin's figure for
 * this person. The app RENDERS `payable`; it never multiplies a rate (CLAUDE.md money rule).
 *
 * THREE OUTCOMES, told apart — the reason this uses `req()` and not `tryReal`, which would collapse
 * a `data:null` body into the whole envelope via `json?.data ?? json`:
 *   - `ok`    — a real `RosterRow` for the caller.
 *   - `empty` — HTTP **200** with `data:null`: the caller has no payroll profile. An explicit empty
 *               state, NOT an outage — the 200 already cleared health via `reportSuccess`, so no
 *               banner is raised and the screen shows its "not configured" copy.
 *   - `error` — a 5xx / dead network / 4.5 s abort / contract-shape miss. `reportIfOutage` raises the
 *               banner (except the answer statuses 401/403/404/501, which it suppresses); the screen
 *               shows its retryable error state. A well-formed `?month=` never draws the 400.
 */
export type MyEarnings =
  | { status: 'ok'; row: PayrollRow }
  | { status: 'empty' }
  | { status: 'error' };

export async function getMyEarnings(month: string): Promise<MyEarnings> {
  if (FORCE_DEMO || !sessionReal) return { status: 'error' };   // no request attempted; screen shows could-not-load
  const path = `/payroll/my-earnings?month=${month}`;
  const key = healthKey(path);
  try {
    const { ok, status, json } = await req(path, {}, REQUEST_TIMEOUT, key);
    if (!ok) { reportIfOutage(status, key); return { status: 'error' }; }
    const data = json?.data;
    if (data == null) return { status: 'empty' };                              // 200 + data:null — no profile
    if (isObj(data) && Array.isArray(data.months)) return { status: 'ok', row: data as PayrollRow };
    reportFailure(key);                                                        // 200 but the shape drifted
    return { status: 'error' };
  } catch {
    reportFailure(key);                                                        // dead network or the abort
    return { status: 'error' };
  }
}

/* --------------------------------------------------- Movement tracking */
export type TrackPoint = { lat: number; lng: number; at?: string | number; accuracy?: number; speed?: number; heading?: number; battery?: number };
export type TrackSession = { session_id: string; date: string; started_at: string; ended_at: string | null; point_count: number; distance_m: number };

/**
 * What happened to a batch of GPS points. PHASE 7.
 *
 * `sent` — the server took them. `added` is its own count and CAN BE ZERO: it drops every point
 *          whose accuracy is worse than 100 m (`routes/timeTracker.js:1350`) and still answers
 *          200. The buffer is cleared either way, because re-sending is discarded identically.
 * `refused` — the server understood these points and said no. Retrying cannot change the answer,
 *          so holding them only grows a bag of somebody's coordinates on a handset.
 * `retry` — a dead network, the 4.5 s abort, a 5xx, or a 429. Keep them for the next wake-up.
 * `signed-out` — 401. The credential is dead, so nothing this service records can ever be
 *          uploaded; the caller stops recording rather than filling a buffer with a person's
 *          movements that has nowhere to go.
 * `no-session` — we have no session id to attribute them to. See `postTrackPoints`.
 *
 * THE BANDS ARE NOT "4xx VERSUS 5xx", AND THAT DISTINCTION IS LOAD-BEARING. A 401 is routine —
 * tokens are signed with a 24 h expiry (`routes/auth.js:62-64`) so one lapses mid-shift as a
 * matter of course — and a 429 is the production rate limiter (`app.js:190-207`), which is
 * transient by construction. Filing either under `refused` would delete a whole afternoon's
 * buffered route, silently, in a headless context where nothing can say so: `expireSession` has
 * no subscriber when `AuthProvider` never mounted, so the token is never cleared from storage,
 * `deliver` rehydrates it on the next wake, and the loop repeats for the rest of the shift while
 * the notification still reads "Recording your field route".
 *
 * Same distinction Phase 1 drew between `invalid` and `network`, and Phase 5 between a 200 and a
 * dispatch: the status code is not the outcome.
 */
export type TrackDelivery = 'sent' | 'refused' | 'retry' | 'signed-out' | 'no-session';
export type TrackResult = { outcome: TrackDelivery; added: number };

export async function startTrack(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  if (!sessionReal || FORCE_DEMO) return true;
  try { const { ok } = await req('/time-tracker/track/start', { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }); return ok; }
  catch { return false; }
}

/**
 * Append GPS points to a shift's route.
 *
 * A SESSION ID IS REQUIRED, AND THAT IS THE PHASE 7 FIX. `JSON.stringify` omits a key whose value
 * is `undefined`, so `{ session_id: undefined, points }` went out as `{ points }` — a body with no
 * session at all. The server then falls back to `resolveActiveSession`
 * (`routes/timeTracker.js:1339`), which is exactly the case INBOX **D5** describes: it works while
 * the shift is running and answers `400 "No active session — clock in first."` afterwards, i.e.
 * the buffered-points replay after clock-out.
 *
 * The 400 is the mild half. `resolveActiveSession` resolves the session from the **token**, so on
 * a shared handset where one person's route service is still running after somebody else signs in,
 * the first person's buffered points post with the second person's token and land on the second
 * person's shift. `startTracking` already refuses to inherit another session's points for this
 * reason; a session-less post is the hole that guard does not cover. Requiring the id makes the
 * body impossible to construct rather than merely unlikely.
 */
export async function postTrackPoints(points: TrackPoint[], sessionId?: string): Promise<TrackResult> {
  if (!points.length) return { outcome: 'sent', added: 0 };
  if (!sessionId) return { outcome: 'no-session', added: 0 };
  if (!sessionReal || FORCE_DEMO) return { outcome: 'sent', added: 0 };
  try {
    const { ok, status, json } = await req('/time-tracker/track/points', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, points }),
    });
    if (ok) return { outcome: 'sent', added: Number(json?.added) || 0 };
    if (status === 401) return { outcome: 'signed-out', added: 0 };
    if (status === 429) return { outcome: 'retry', added: 0 };
    return { outcome: status >= 400 && status < 500 ? 'refused' : 'retry', added: 0 };
  } catch {
    return { outcome: 'retry', added: 0 };
  }
}

export async function stopTrack(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  if (!sessionReal || FORCE_DEMO) return true;
  try { const { ok } = await req('/time-tracker/track/stop', { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }); return ok; }
  catch { return false; }
}
/** Master viewer: a member's tracked shifts in a date range. */
export async function getTrackSessions(userId: string, from?: string, to?: string): Promise<TrackSession[]> {
  const qs = `user_id=${encodeURIComponent(userId)}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`;
  return (await tryReal<TrackSession[]>(`/time-tracker/track/sessions?${qs}`, {}, isArr)) ?? [];
}
/** Master viewer: the full point path for one session. */
export async function getTrack(sessionId: string): Promise<{ points: TrackPoint[]; distance_m: number; started_at: string; ended_at: string | null } | null> {
  return await tryReal<any>(`/time-tracker/track/${encodeURIComponent(sessionId)}`, {}, (d) => d && Array.isArray(d.points));
}

/* --------------------------- 24/7 off-duty location + DPDP consent (Phase 41 · backend Phase 43) */

export type ConsentState = 'granted' | 'withdrawn' | 'pending';
export type ConsentWriteResult =
  | { status: 'ok'; consent: ConsentState; decidedAt: string | null; version: string | null }
  | { status: 'refused' }   // a definite server answer (400 bad body / 404 no profile) — retrying will not help
  | { status: 'error' };    // 5xx / dead network / shape drift — retryable; the global banner also speaks

/**
 * Record the caller's 24/7 location-tracking consent -> POST /api/time-tracker/consent (backend Phase 43).
 *
 * `granted:true` sets `location_consent.status:'granted'`; `granted:false` WITHDRAWS it, and the
 * server notifies every super_admin so a withdrawal is LOUD by design (PHASE-41 §5 — no silent
 * opt-out). `version` is the consent-notice version agreed to, so a materially changed notice can
 * force re-consent later. The current state is read separately off `GET /rbac/config`
 * `me.location_consent` (a later slice) — this write returns only what the 200 confirms.
 *
 * Three outcomes the consent screen forks on — the getMyEarnings / getMdrtTier posture:
 *   ok      — 200; the returned status/decided_at/version are authoritative.
 *   refused — 400 (`granted` not a boolean — a client bug) or 404 (no Profile on file): a definite
 *             answer, surfaced rather than retried.
 *   error   — 5xx / dead network / shape drift: retryable.
 * Never fabricates a granted state: only a real 200 yields `ok`.
 */
export async function setLocationConsent(granted: boolean, version?: string): Promise<ConsentWriteResult> {
  if (FORCE_DEMO || !sessionReal) return { status: 'error' };   // no request attempted
  const key = '/time-tracker/consent';
  try {
    const body: Record<string, unknown> = { granted };
    if (version != null) body.version = version;
    const { ok, status, json } = await req(key, { method: 'POST', body: JSON.stringify(body) }, REQUEST_TIMEOUT, key);
    if (ok) {
      const data = json?.data;
      const st = data?.status;
      const consent: ConsentState =
        st === 'granted' || st === 'withdrawn' || st === 'pending' ? st : granted ? 'granted' : 'withdrawn';
      return {
        status: 'ok',
        consent,
        decidedAt: typeof data?.decided_at === 'string' ? data.decided_at : null,
        version: typeof data?.version === 'string' ? data.version : null,
      };
    }
    reportIfOutage(status, key);   // 400 = malformed (banner); 404 = answer (quiet); 5xx = outage (banner)
    return { status: status === 400 || status === 404 ? 'refused' : 'error' };
  } catch {
    reportFailure(key);
    return { status: 'error' };
  }
}

export type AmbientDelivery = 'sent' | 'consent-required' | 'signed-out' | 'retry' | 'refused';
export type AmbientResult = { outcome: AmbientDelivery; added: number; dropped: number };

/**
 * Append OFF-DUTY (ambient) GPS points -> POST /api/time-tracker/track/ambient (backend Phase 43).
 *
 * Distinct from postTrackPoints: there is NO shift session — the server attributes the points to
 * the token and stores them ONLY if the caller's `location_consent.status === 'granted'`, else it
 * answers 403 `consent_required`. On that 403 the caller MUST stop recording and drop its buffer:
 * there is nothing to retry for an un-consented user, and a loud consent-withdrawal already reached
 * the master. Every other non-2xx is a transient fault to retry; a 401 ends the session (reportAuth).
 *
 * Coarse fixes are kept server-side (the shift path's `accuracy <= 100 m` drop is NOT applied to
 * ambient), so `dropped` counts only server-rejected (non-finite) points, not battery-friendly ones.
 * Silent like postTrackPoints — a background recorder must never raise the outage banner.
 */
export async function postAmbientPoints(points: TrackPoint[], date?: string): Promise<AmbientResult> {
  if (!points.length) return { outcome: 'sent', added: 0, dropped: 0 };
  if (!sessionReal || FORCE_DEMO) return { outcome: 'sent', added: 0, dropped: 0 };
  try {
    const body: Record<string, unknown> = { points };
    if (date) body.date = date;
    const { ok, status, json } = await req('/time-tracker/track/ambient', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (ok) return { outcome: 'sent', added: Number(json?.added) || 0, dropped: Number(json?.dropped) || 0 };
    if (status === 403 || json?.code === 'consent_required') return { outcome: 'consent-required', added: 0, dropped: 0 };
    if (status === 401) return { outcome: 'signed-out', added: 0, dropped: 0 };
    if (status === 429) return { outcome: 'retry', added: 0, dropped: 0 };
    return { outcome: status >= 400 && status < 500 ? 'refused' : 'retry', added: 0, dropped: 0 };
  } catch {
    return { outcome: 'retry', added: 0, dropped: 0 };
  }
}

export type ConsentReadResult =
  | { status: 'ok'; consent: ConsentState; decidedAt: string | null; version: string | null }
  | { status: 'error' };   // unknown — the boot gate MUST fail open on this (never trap the user)

/**
 * Read the caller's stored 24/7 location-consent state -> GET /api/rbac/config `me.location_consent`
 * (backend Phase 43; `contracts/api.md` §`/api/rbac/config` `me`). This is the boot-gate input: the
 * app decides whether to show the mandatory consent notice (`/consent`) and whether to start the
 * ambient recorder from `consent === 'granted'`.
 *
 * A GENUINELY NEW READ PATH. Nothing in the app read `GET /rbac/config` before — the server-driven
 * layout comes from `GET /rbac/app-ui` via `getAppUiConfig`/`normalizeUiConfig`, which rebuilds a
 * fixed object and DROPS unknown fields, so `me.location_consent` could never have arrived through
 * it. Note the envelope: `me` is TOP-LEVEL on this response (`{ success, config, me }`), NOT under
 * `data` (`routes/rbac.js` GET `/config`), so this reads `json.me.location_consent`, not `json.data`.
 *
 * DELIBERATELY SILENT, and FAIL-OPEN. Unlike `getMdrtTier`, this read never touches the health
 * channel, for two reasons: (1) it runs on EVERY cold start and drives an invisible gate, so a
 * banner the user cannot act on (or one pinned open until the backend deploys Phase 43) would be the
 * exact permanent-outage anti-pattern the channel exists to prevent — the parallel `/rbac/app-ui`
 * boot fetch is the surface that legitimately reports config-endpoint health; (2) the only safe
 * response to "couldn't determine consent" is to NOT block the user, so anything that is not a clear
 * granted/withdrawn/pending answer collapses to `error`, which the gate treats as "don't redirect".
 *
 *   ok    — 200 carrying a valid `me.location_consent.status`; authoritative.
 *   error — 200 with no consent block (Phase 43 not yet deployed — the field is simply absent),
 *           any non-2xx, or a dead network / abort. All fail open; none raises the banner.
 * `req`'s universal auth handling still applies: a 401 with a live token ends the session, same as
 * every other call — that is correct (a dead token should log out), not a consent decision.
 */
export async function getLocationConsent(): Promise<ConsentReadResult> {
  if (FORCE_DEMO || !sessionReal) return { status: 'error' };   // no request attempted; gate fails open
  try {
    const { ok, json } = await req('/rbac/config', {}, REQUEST_TIMEOUT, '/rbac/config');
    if (!ok) return { status: 'error' };
    const lc = json?.me?.location_consent;
    const st = lc?.status;
    if (st === 'granted' || st === 'withdrawn' || st === 'pending') {
      return {
        status: 'ok',
        consent: st,
        decidedAt: typeof lc?.decided_at === 'string' ? lc.decided_at : null,
        version: typeof lc?.version === 'string' ? lc.version : null,
      };
    }
    return { status: 'error' };   // no consent block yet ⇒ unknown ⇒ fail open
  } catch {
    return { status: 'error' };   // dead network / abort ⇒ unknown ⇒ fail open
  }
}

/**
 * The boot gate's decision, isolated as a pure predicate so its ONE load-bearing safety property
 * — fail open — is pinned by a test rather than buried in an effect. Returns true ONLY on a clear
 * server answer that consent is not yet granted (`pending`/`withdrawn`); everything else is false,
 * so the app redirects to the mandatory notice ONLY when it is certain it must:
 *   - `ok` + `granted`  → false (the user already consented; never re-gate them)
 *   - `ok` + `pending`  → true  (never asked / re-consent needed → show the notice)
 *   - `ok` + `withdrawn`→ true  (opted out → must re-consent to keep using the app)
 *   - `error`           → false (unknown: outage, legacy backend, dead network — NEVER trap staff)
 * Getting the `error` branch wrong would bounce every user to `/consent` on every failed read, so
 * the fail-open default is the whole point of extracting this.
 */
export function needsConsentGate(read: ConsentReadResult): boolean {
  return read.status === 'ok' && read.consent !== 'granted';
}

/* ------------------------------------------------------- Agent locations */
export type AgentPin = {
  id: string; name: string; city?: string;
  inLat?: number; inLng?: number; inTime?: string;
  outLat?: number; outLng?: number; outTime?: string;
  onDuty: boolean;
};

const num2 = (v: any) => (typeof v === 'number' && isFinite(v) ? v : undefined);

/**
 * Live agent pins. The backend exposes attendance per user at
 * /attendance/user/:userId (raw `attendance` collection, string user_id), so we
 * fan out across the roster and keep whoever has coordinates for today.
 */
const toPin = (row: any, p: any): AgentPin | null => {
  const ci = row?.clock_in || {}; const co = row?.clock_out || {};
  const inLat = num2(ci.lat), inLng = num2(ci.lng);
  if (inLat === undefined || inLng === undefined) return null;
  return {
    id: String(p.user_id),
    name: row.user_name || p.full_name || p.name || 'Agent',
    city: ci.city || undefined,
    inLat, inLng, inTime: ci.time || undefined,
    outLat: num2(co.lat), outLng: num2(co.lng), outTime: co.time || undefined,
    onDuty: !co.time,
  };
};

export async function getAgentLocations(): Promise<AgentPin[]> {
  // PHASE 10. This used to return three invented agents pinned at real Gujarat coordinates
  // (Anand, Nadiad, Borsad) with `onDuty: true` and a live timestamp. On the master's agent
  // map that is indistinguishable from genuine field telemetry: a manager could believe three
  // named people were out working when nobody was. Of every sample-data path in this app it
  // was the most misleading, because the map carries no other cue that it might be fake.
  //
  // PHASE 12. The roster came from admin-only `GET /profiles`, which 403s for a leader — so a
  // leader (and any advisor) got an empty roster, no /attendance fan-out, and "0 on duty" on
  // every dashboard. Read it from `GET /team/task-overview` instead: any staff may read it, the
  // server scopes it per role (a leader's `?scope=all` is clamped to their team, NOT widened —
  // verified in ../cgpe-backend-main/utils/scope.js `visibilityScope`; `?scope=all` is honoured
  // only for admin/super_admin, preserving their org-wide breadth), and each member carries the
  // `user_id`+`name` this pipeline needs. Same source getTeam() already trusts for the roster,
  // so the on-duty numerator now matches the roster denominator. A task-overview outage reports
  // under the existing `/attendance` health key, not a competing `/team/task-overview` row
  // (getTaskOverview owns that one).
  if (!sessionReal || FORCE_DEMO) return unavailable('/attendance', [] as AgentPin[]);
  const overview = await tryReal<any>('/team/task-overview?scope=all', {}, (d) => d && Array.isArray(d.members), '/attendance');
  const people = ((overview?.members || []) as any[]).filter((p) => p.user_id).slice(0, 20);
  const today = new Date().toISOString().slice(0, 10);

  // First pass: whoever has an attendance record dated *today* (real, current field status).
  const todays = await Promise.all(people.map(async (p) => {
    try {
      const { ok, json } = await req(`/attendance/user/${encodeURIComponent(p.user_id)}?date=${today}`);
      if (!ok) return null;
      const rows: any[] = json?.data ?? [];
      return toPin(rows[rows.length - 1], p);
    } catch { return null; }
  }));
  const todayPins = todays.filter(Boolean) as AgentPin[];
  if (todayPins.length) return todayPins;

  // Fallback: nobody clocked in *today* — show each agent's most recent known clock
  // point so the map is never blank (survives a date rollover / quiet morning).
  const recent = await Promise.all(people.map(async (p) => {
    try {
      const { ok, json } = await req(`/attendance/user/${encodeURIComponent(p.user_id)}`);
      if (!ok) return null;
      const rows: any[] = json?.data ?? [];
      const withGps = rows.filter((r) => num2(r?.clock_in?.lat) !== undefined);
      withGps.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return toPin(withGps[withGps.length - 1], p);
    } catch { return null; }
  }));
  return recent.filter(Boolean) as AgentPin[];
}

/** Generate a family/client report -> POST /api/clients/generate-report. Null on any failure. */
export async function generateReport(clientName: string): Promise<any | null> {
  return await tryReal<any>('/clients/generate-report', { method: 'POST', body: JSON.stringify({ clientName }) }, isObj);
}

/** Upload a captured/selected file -> POST /api/upload (multipart). Returns {url,key} or null. */
export async function uploadFile(uri: string, name = 'document.jpg', mimeType = 'image/jpeg'): Promise<{ url: string; key?: string } | null> {
  if (!sessionReal || FORCE_DEMO) { await wait(500); return { url: 'demo://uploaded/' + name }; }
  try {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      form.append('file', blob, name);
    } else {
      form.append('file', { uri, name, type: mimeType } as any);
    }
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, // no Content-Type: let fetch set the multipart boundary
      body: form as any,
    });
    const json = await res.json().catch(() => null);
    const data = json?.data ?? json;
    return res.ok && data?.url ? { url: data.url, key: data.key } : null;
  } catch { return null; }
}

/* -------------------------------------------------------------- Campaigns */
export type CampaignSummary = {
  total_clients: number; opted_in: number; birthday_today: number; birthday_month: number;
  anniversary_month: number; renewal_due: number; maturity_soon: number;
};
export async function getCampaignSummary(): Promise<CampaignSummary | null> {
  return await tryReal<CampaignSummary>('/campaigns/summary?scope=all', {}, isObj);
}
/** Preview an audience: count + up to 8 personalised sample recipients (backend uses .lean() so fupDate survives). */
export async function getCampaignAudience(type: 'renewal' | 'birthday' | 'anniversary' | 'maturity'): Promise<{ count: number; matched: number; sample: { name: string; phone: string; message: string }[] } | null> {
  const real = await tryReal<any>(`/campaigns/audience?type=${type}&scope=all`, {}, isObj);
  if (!real) return null;
  return { count: real.count ?? 0, matched: real.matched ?? real.count ?? 0, sample: real.sample || [] };
}
/** One-click BULK send: premium reminders (type:'renewal'), birthday, etc. */
export async function sendCampaign(type: 'renewal' | 'birthday' | 'anniversary' | 'maturity' | 'marketing', opts: { text?: string; limit?: number; filters?: any } = {}): Promise<{ ok: boolean; count: number; message: string; needsRole?: boolean }> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, status, json } = await req('/campaigns/send', { method: 'POST', body: JSON.stringify({ type, ...opts }) }, 30000);
      if (status === 403) return { ok: false, count: 0, message: 'Only admin/leader can send bulk campaigns.', needsRole: true };
      const data = json?.data ?? {};
      return { ok: !!(json?.success), count: data.count ?? 0, message: json?.message || (ok ? 'Sent' : 'Send failed') };
    } catch (e: any) {
      return { ok: false, count: 0, message: e?.message || 'Send failed' };
    }
  }
  // No live session. Reporting a fake "queued N messages" here would be the worst possible
  // lie in this app: the user would believe renewal reminders went out to real policyholders
  // when nothing was dispatched at all.
  reportFailure('/campaigns/send');
  return { ok: false, count: 0, message: 'Not signed in. Sign in to send campaigns.' };
}

/* ==================================================================== *
 * PHASE 9 — FEATURE PARITY LAYER
 *
 * Every function below is wired to an endpoint verified live on BOTH the production host
 * and the local backend (401 when unauthenticated, which proves the route is mounted).
 *
 * SHAPES COME FROM THE BACKEND ROUTE SOURCE, NOT FROM GUESSWORK. These collections have
 * hand-rolled transforms whose wire field names do not match their Mongo documents.
 * `transformTicket` in routes/tickets.js is the clearest case: the document carries
 * `aiUnderstanding` and `assignedTo`, the wire format carries `reason` and `owner.name`.
 * Guessing here yields a screen that renders blank rows against a perfectly healthy server,
 * which is indistinguishable from an outage and impossible to debug from the UI.
 *
 * `/api/lic-plans` IS LIVE (mounted at app.js:461), CORRECTED IN PHASE 6. An earlier note here
 * claimed it 404s in production; it does not — it returns `{ meta, plans }` (routes/licPlans.js),
 * and `getLicPlans` now unwraps `data.plans` and maps the legacy LIC shape through `adaptLicPlan`.
 * A genuinely empty library or a real outage still surfaces through `data/health` as usual.
 * ==================================================================== */

/**
 * Envelope-aware fetch. `tryReal` unwraps to `json.data`, which throws away `total`,
 * `meta` and `facets` — precisely the fields these list screens need for their counts and
 * filter chips. This keeps the whole envelope.
 */
async function tryEnvelope<T>(
  path: string,
  validate: (d: any) => boolean,
  opts: RequestInit = {},
  key: string = healthKey(path),
): Promise<T | null> {
  if (FORCE_DEMO || !sessionReal) return null;
  try {
    const { ok, status, json } = await req(path, opts, REQUEST_TIMEOUT, key);
    if (!ok) { reportIfOutage(status, key); return null; }
    // A 2xx with no parseable body at all is not a usable answer either.
    if (!json || !validate(json)) { reportFailure(key); return null; }
    return json as T;
  } catch {
    reportFailure(key);
    return null;
  }
}

const qs = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '' && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

/* ----------------------------------------------------------- Tickets */

export type Ticket = {
  id: string;
  ticket_ref: string | null;
  type: string;
  type_label: string;
  category?: string;
  status: string;
  status_label: string;
  is_closed: boolean;
  priority?: string;          // P1 | P2 | P3
  zone?: string;              // RAG: red | amber | green
  client: { name: string; phone: string };
  client_id?: string;
  reason?: string;            // the AI's understanding of what was asked
  task?: string;              // what actually needs doing
  request_text?: string;
  policy_no?: string;
  source?: string;
  channel?: string;
  owner: { name: string; phone?: string; team?: string; status?: string } | null;
  timeline?: { status: string; at: string | null; actor: string | null }[];
  createdAt?: string;
  updatedAt?: string;
};

export type TicketPage = {
  data: Ticket[];
  total: number;
  page: number;
  totalPages: number;
  meta: {
    typeCounts: Record<string, number>;
    stateCounts: { all: number; active: number; closed: number };
  };
};

const EMPTY_TICKET_PAGE: TicketPage = {
  data: [], total: 0, page: 1, totalPages: 1,
  meta: { typeCounts: {}, stateCounts: { all: 0, active: 0, closed: 0 } },
};

export async function getTickets(opts: {
  state?: string; type?: string; search?: string; page?: number; limit?: number;
} = {}): Promise<TicketPage> {
  const path = `/tickets?${qs({
    state: opts.state && opts.state !== 'all' ? opts.state : undefined,
    type: opts.type && opts.type !== 'all' ? opts.type : undefined,
    search: opts.search,
    page: opts.page ?? 1,
    limit: opts.limit ?? 25,
  })}`;
  const env = await tryEnvelope<any>(path, (j) => Array.isArray(j?.data));
  if (!env) return unavailable('/tickets', EMPTY_TICKET_PAGE);
  return {
    data: env.data as Ticket[],
    total: env.total ?? env.data.length,
    page: env.page ?? 1,
    totalPages: env.totalPages ?? 1,
    meta: {
      typeCounts: env.meta?.typeCounts ?? {},
      stateCounts: env.meta?.stateCounts ?? { all: env.total ?? 0, active: 0, closed: 0 },
    },
  };
}

export async function getTicket(id: string): Promise<Ticket | undefined> {
  const real = await tryReal<Ticket>(`/tickets/${encodeURIComponent(id)}`, {}, isObj);
  return real ?? unavailable('/tickets/:id', undefined as Ticket | undefined);
}

/**
 * Update a ticket. This is the "I am handling it" action: `assignedTo` claims ownership,
 * `state` advances it, `note` appends a comment. The backend writes an audit entry for
 * every field that actually changed, so the detail screen timeline stays truthful.
 *
 * Returns null when the write was refused, so the caller shows a real error rather than
 * optimistically painting a state the server never accepted.
 */
export async function updateTicket(id: string, patch: {
  state?: string; assignedTo?: string; assignedTeam?: string; priority?: string;
  note?: string; task?: string;
}): Promise<Ticket | null> {
  if (!sessionReal || FORCE_DEMO) return null;
  try {
    const { ok, json } = await req(`/tickets/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (!ok || !json?.success) return null;
    return (json.data as Ticket) ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------- Notes (private board) */

export type BoardNote = {
  id: string;
  noticeId: string | null;
  text: string;
  transcript: string;       // the original dictation, often Gujarati
  sourceType: 'text' | 'voice';
  category: string;
  tags: string[];
  pinned: boolean;
  status: string;
  ownerName: string;
  ownerRole: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type NotesPage = {
  data: BoardNote[];
  total: number;
  totalPages: number;
  facets: {
    categories: { label: string; value: number }[];
    tags: { label: string; value: number }[];
    statuses: { label: string; value: number }[];
  };
  owner: { name: string; phoneLast10: string };
};

const EMPTY_NOTES: NotesPage = {
  data: [], total: 0, totalPages: 1,
  facets: { categories: [], tags: [], statuses: [] },
  owner: { name: '', phoneLast10: '' },
};

/**
 * The private board is owned by PHONE, not by user id: notes arrive as WhatsApp voice
 * memos keyed to the sender's last ten digits. An account with no phone on its profile
 * legitimately has no board, and the backend fails closed rather than leaking someone
 * else's notes. An empty result can therefore mean "no phone on file", which the screen
 * should say plainly instead of implying the user has written nothing.
 */
export async function getNotes(opts: { search?: string; category?: string; page?: number; limit?: number } = {}): Promise<NotesPage> {
  const path = `/notice-board?${qs({
    // The handler reads `q` (noticeBoard.js:93,102), NOT `search` — the old key was silently
    // ignored, so every notes search returned the whole board unfiltered (Phase 6).
    q: opts.search,
    category: opts.category && opts.category !== 'all' ? opts.category : undefined,
    page: opts.page ?? 1,
    limit: opts.limit ?? 30,
  })}`;
  const env = await tryEnvelope<any>(path, (j) => Array.isArray(j?.data));
  if (!env) return unavailable('/notice-board', EMPTY_NOTES);
  return {
    data: env.data as BoardNote[],
    total: env.total ?? env.data.length,
    totalPages: env.totalPages ?? 1,
    facets: env.facets ?? EMPTY_NOTES.facets,
    owner: env.owner ?? EMPTY_NOTES.owner,
  };
}

export async function addNote(text: string, category = 'note', tags: string[] = []): Promise<BoardNote | null> {
  if (!sessionReal || FORCE_DEMO) return null;
  try {
    const { ok, json } = await req('/notice-board', { method: 'POST', body: JSON.stringify({ text, category, tags }) });
    return ok && json?.success ? (json.data as BoardNote) : null;
  } catch { return null; }
}

export async function updateNote(
  id: string,
  patch: Partial<Pick<BoardNote, 'text' | 'category' | 'tags' | 'pinned' | 'status'>>,
): Promise<BoardNote | null> {
  if (!sessionReal || FORCE_DEMO) return null;
  try {
    const { ok, json } = await req(`/notice-board/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    return ok && json?.success ? (json.data as BoardNote) : null;
  } catch { return null; }
}

export async function deleteNote(id: string): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO) return false;
  try {
    const { ok, json } = await req(`/notice-board/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return !!(ok && json?.success);
  } catch { return false; }
}

/* ------------------------------------------ Notice Board (official notices) */

export type CompanyNotice = {
  _id?: string;
  id?: string;
  title?: string;
  message?: string;
  content?: string;
  category?: string;
  priority?: string;
  createdAt?: string;
  created_at?: string;
  author?: string;
  pinned?: boolean;
};

export async function getCompanyNotices(): Promise<{ data: CompanyNotice[]; categories: string[] }> {
  const env = await tryEnvelope<any>('/notices?limit=60', (j) => Array.isArray(j?.data));
  if (!env) return unavailable('/notices', { data: [] as CompanyNotice[], categories: [] as string[] });
  return { data: env.data as CompanyNotice[], categories: env.categories ?? [] };
}

export async function markNoticeRead(id: string): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO) return false;
  try {
    const { ok } = await req(`/notices/${encodeURIComponent(id)}/read`, { method: 'POST' });
    return ok;
  } catch { return false; }
}

/* --------------------------------------------------------- Prospects */

export type Prospect = {
  _id?: string;
  id?: string;
  name?: string;
  firm?: string;
  phone?: string;
  stage?: string;
  city?: string;
  notes?: string;
  updatedAt?: string;
  createdAt?: string;
  [k: string]: unknown;
};

export type ProspectPage = { data: Prospect[]; total: number; page: number; totalPages: number };

export async function getProspects(opts: { search?: string; stage?: string; page?: number; limit?: number } = {}): Promise<ProspectPage> {
  const path = `/prospects?${qs({
    search: opts.search,
    stage: opts.stage && opts.stage !== 'all' ? opts.stage : undefined,
    page: opts.page ?? 1,
    limit: opts.limit ?? 25,
  })}`;
  const env = await tryEnvelope<any>(path, (j) => Array.isArray(j?.data));
  if (!env) return unavailable('/prospects', { data: [] as Prospect[], total: 0, page: 1, totalPages: 1 });
  return { data: env.data as Prospect[], total: env.total ?? 0, page: env.page ?? 1, totalPages: env.totalPages ?? 1 };
}

/** Stage buckets and their counts, for the pipeline header. */
export async function getProspectSegments(): Promise<any | null> {
  return await tryEnvelope<any>('/prospects/segments', (j) => !!j?.success);
}

/** Record an action against a prospect. The backend advances the stage and logs activity. */
export async function actOnProspect(id: string, action: string, note?: string): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO) return false;
  try {
    const { ok, json } = await req(`/prospects/${encodeURIComponent(id)}/action`, {
      method: 'POST', body: JSON.stringify({ action, note }),
    });
    return !!(ok && json?.success);
  } catch { return false; }
}

/* --------------------------------------------------- Client segments */

export type SegmentRow = Record<string, unknown> & { name?: string; phone?: string; flags?: string[] };
export type SegmentsResult = {
  rows: SegmentRow[];
  total?: number;
  segment?: string;
  counts?: Record<string, number>;
  [k: string]: unknown;
};

/**
 * Smart segmentation over the whole client book. `flags` is a comma-joined list
 * (hot-lead, birthday-soon, renewal-due and so on) and `match` decides whether a row must
 * satisfy all of them or any one.
 *
 * PERFORMANCE NOTE FOR CALLERS: the backend scans roughly 9,000 documents in memory per
 * call and caches per visibility scope. Debounce the search field; do not fire this on
 * every keystroke.
 */
export async function getClientSegments(opts: {
  segment?: 'individual' | 'family';
  flags?: string[];
  match?: 'all' | 'any';
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
} = {}): Promise<SegmentsResult> {
  const path = `/clients/segments?${qs({
    segment: opts.segment ?? 'individual',
    flags: opts.flags && opts.flags.length ? opts.flags.join(',') : undefined,
    match: opts.match ?? 'all',
    search: opts.search,
    sort: opts.sort ?? 'priority',
    page: opts.page ?? 1,
    limit: opts.limit ?? 25,
  })}`;
  const real = await tryReal<SegmentsResult>(path, {}, (d) => d && Array.isArray(d.rows));
  return real ?? unavailable('/clients/segments', { rows: [] as SegmentRow[], total: 0 } as SegmentsResult);
}

/* ---------------------------------------------------------- Families */

export type Family = {
  family_id?: string;
  id?: string;
  head_name?: string;
  member_count?: number;
  members?: { name?: string; phone?: string; relation?: string }[];
  total_premium?: number;
  total_cover?: number;
  [k: string]: unknown;
};

export type FamilyStats = {
  families: number;
  multi_person_families: number;
  persons: number;
  units: number;
  review: number;
  largest: number;
};

export async function getFamilies(opts: { search?: string; page?: number; limit?: number } = {}): Promise<{ data: Family[]; total: number; totalPages: number }> {
  const path = `/families?${qs({ search: opts.search, page: opts.page ?? 1, limit: opts.limit ?? 25 })}`;
  const env = await tryEnvelope<any>(path, (j) => Array.isArray(j?.data));
  if (!env) return unavailable('/families', { data: [] as Family[], total: 0, totalPages: 1 });
  return { data: env.data as Family[], total: env.total ?? 0, totalPages: env.totalPages ?? 1 };
}

export async function getFamilyStats(): Promise<FamilyStats | null> {
  return await tryReal<FamilyStats>('/families/stats', {}, isObj);
}

export async function getFamily(id: string): Promise<Family | undefined> {
  const real = await tryReal<Family>(`/families/${encodeURIComponent(id)}`, {}, isObj);
  return real ?? unavailable('/families/:id', undefined as Family | undefined);
}

/* ------------------------------------------------------ Insurance KB */

export type KbArticle = {
  _id?: string;
  id?: string;
  title?: string;
  content?: string;
  topic?: string;
  domain?: string;
  category?: string;
  tags?: string[];
  query_examples?: string[];
  [k: string]: unknown;
};

export type KbPage = {
  data: KbArticle[];
  total: number;
  pages: number;
  facets: { domains: string[]; categories: string[] };
};

const EMPTY_KB: KbPage = { data: [], total: 0, pages: 1, facets: { domains: [], categories: [] } };

/** The advisor field reference. Search covers title, content, topic, tags and examples. */
export async function getKbArticles(opts: {
  search?: string; domain?: string; category?: string; page?: number; limit?: number;
} = {}): Promise<KbPage> {
  const path = `/insurance-kb?${qs({
    search: opts.search,
    domain: opts.domain && opts.domain !== 'all' ? opts.domain : undefined,
    category: opts.category && opts.category !== 'all' ? opts.category : undefined,
    page: opts.page ?? 1,
    limit: opts.limit ?? 24,
  })}`;
  const env = await tryEnvelope<any>(path, (j) => Array.isArray(j?.data));
  if (!env) return unavailable('/insurance-kb', EMPTY_KB);
  return {
    data: env.data as KbArticle[],
    total: env.total ?? env.data.length,
    pages: env.pages ?? 1,
    facets: env.facets ?? EMPTY_KB.facets,
  };
}

export async function getKbArticle(id: string): Promise<KbArticle | undefined> {
  const real = await tryReal<KbArticle>(`/insurance-kb/${encodeURIComponent(id)}`, {}, isObj);
  return real ?? unavailable('/insurance-kb/:id', undefined as KbArticle | undefined);
}

/* ------------------------------------------- Server-driven UI (RBAC layout) */

export type UiWidget = {
  key: string;
  visible: boolean;
  title_override?: string | null;
  max_items: number;
  mandatory: boolean;
};

export type AppUiConfig = {
  role_key: string;
  label?: string;
  dashboard: { hero: 'clock_and_tasks' | 'tasks_only' | 'clock_only' | 'none'; widgets: UiWidget[] };
  nav: {
    tabs: string[];
    /** `collapsed_by_default` is part of the ui_rbac_config.json contract; it was missing
     *  here, so the config provider was silently dropping it during normalisation. */
    more_sections?: { title: string; items: string[]; collapsed_by_default?: boolean }[];
    hidden: string[];
  };
  features: Record<string, boolean | string[]>;
  theme?: { accent?: string; badge_label?: string; density?: 'comfortable' | 'compact' };
};

/**
 * The signed-in user's mobile UI layout, resolved server-side from their role.
 *
 * The contract is documented in `ANDROID/ui_rbac_config.json`, which is also what the web
 * Admin Panel builds its editor against. The server deep-merges the stored document over
 * role defaults, so a half-filled admin form can never blank someone's dashboard.
 *
 * RETURNS NULL ON ANY FAILURE, AND THAT IS LOAD-BEARING. The caller falls back to the app's
 * built-in layout and shows the FULL menu. A layout-config outage must never be able to hide
 * a field agent's own work from them. Authorisation is enforced by the API routes; this only
 * decides presentation.
 */
export async function getAppUiConfig(): Promise<AppUiConfig | null> {
  const env = await tryEnvelope<any>('/rbac/app-ui', (j) => j && j.data && j.data.dashboard);
  return env ? (env.data as AppUiConfig) : null;
}

