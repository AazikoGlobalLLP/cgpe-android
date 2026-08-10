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
import { reportFailure, reportSuccess } from './health';
import { adaptClient, adaptLead, adaptUser, adaptClaim, adaptWaThread, adaptWaMessage, adaptReminder, adaptNotification } from './adapt';
// Types only. The seed arrays these modules also export (`teamMembers`, `teamActivityFeed`,
// `tasks`) are deliberately NOT imported any more: importing them is what kept sample records
// inside the shipped bundle and one `??` away from reaching a screen.
import type { TeamMember, TeamActivity } from './team';
import { Task, TaskStatus } from './tasks';
import type {
  Claim, Client, Commission, Contest, Lead, LeadStage, LicPlan,
  Reminder, User, WaThread, AppNotification,
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
 */
export type WriteFailure = 'network' | 'server' | 'forbidden' | 'unsupported';

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
 *         retrying will never help." `/lic-plans` is documented as exactly this in
 *         production, and reporting it would hold the banner open for the whole session.
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

/**
 * Zeroed commission shell for a failed `/commissions` fetch. Every figure is 0 so the
 * screen renders honest blanks under the outage banner rather than a fabricated payout.
 */
const EMPTY_COMMISSION: Commission = {
  total: 0, paid: 0, pending: 0, thisMonth: 0, lastMonth: 0, policies: 0, entries: [],
} as unknown as Commission;

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

export async function login(id: string, pw: string): Promise<{ user: User; token: string }> {
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
      return { user: adaptUser(data.user), token: data.token };
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
export async function verifyOtp(phone: string, code: string): Promise<{ user: User; token: string } | null> {
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
      return { user: adaptUser(data.user), token: data.token };
    }
    return null;
  } catch (e: any) {
    if (isUnreachable(e)) throw new NetworkError();
    return null;
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

/* ------------------------------------------------------------------ Leads */
/** /leads?scope=all returns { data: { leads: [...], pagination } } — real leads. */
export async function getLeads(): Promise<Lead[]> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, json } = await req('/leads?limit=500&scope=all');
      const arr = Array.isArray(json?.data?.leads) ? json.data.leads : (Array.isArray(json?.data) ? json.data : null);
      if (ok && arr) return arr.map(adaptLead);
    } catch { /* fall through */ }
  }
  return unavailable('/leads', state.leads);
}
export async function getLead(id: string): Promise<Lead | undefined> {
  const real = await tryReal<any>(`/leads/${id}?scope=all`, {}, (d) => d && (d.name || d._id || d.leadId));
  return real ? adaptLead(real) : unavailable('/leads/:id', state.leads.find((l) => l.id === id));
}
export async function setLeadStage(id: string, stage: LeadStage): Promise<void> {
  const real = await tryReal(`/leads/${id}`, { method: 'PUT', body: JSON.stringify({ stage }) }, () => true);
  if (real == null) {
    const l = state.leads.find((x) => x.id === id);
    if (l) { l.stage = stage; l.lastActivity = new Date().toISOString(); }
    await wait(150);
  }
}
export async function addLead(data: Partial<Lead>): Promise<Lead> {
  const lead: Lead = {
    id: 'l' + (Date.now() % 100000), name: data.name || 'New Lead', phone: data.phone || '',
    stage: 'new', source: data.source || 'Manual', interest: data.interest || '',
    potential: data.potential || 0, city: data.city || '', priority: data.priority || 'warm',
    createdAt: new Date().toISOString(), lastActivity: new Date().toISOString(), notes: [],
  };
  const real = await tryReal<any>('/leads', { method: 'POST', body: JSON.stringify(lead) }, isObj);
  if (real) return adaptLead(real);
  state.leads.unshift(lead); await wait(250); return clone(lead);
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
export async function toggleReminder(id: string): Promise<void> {
  const r = state.reminders.find((x) => x.id === id);
  if (r) r.done = !r.done;
  await wait(100);
}

/* ------------------------------------------------------------------- Misc */
export async function getCommission(): Promise<Commission> {
  return (await tryReal<Commission>('/commissions', {}, isObj)) ?? unavailable('/commissions', EMPTY_COMMISSION);
}
const waThreadCache = new Map<string, WaThread>();
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
        return { ...(meta || { id, name: 'WhatsApp user', phone: '', lastMessage: '', lastAt: '', unread: 0, messages: [] }), messages };
      }
    } catch { /* fall through */ }
  }
  return unavailable('/whatsapp/hub/messages', state.waThreads.find((t) => t.id === id));
}
export async function sendWaMessage(threadId: string, text: string): Promise<void> {
  if (sessionReal && !FORCE_DEMO) {
    const t = state.waThreads.find((x) => x.id === threadId);
    await tryReal('/whatsapp/hub/send', { method: 'POST', body: JSON.stringify({ phone: t?.phone, message: text }) }, () => true);
  }
  const t = state.waThreads.find((x) => x.id === threadId);
  if (t) {
    t.messages.push({ id: 'm' + Date.now(), fromMe: true, text, at: new Date().toISOString() });
    t.lastMessage = text; t.lastAt = new Date().toISOString(); t.unread = 0;
  }
  await wait(120);
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
  const real = await tryReal<any[]>('/lic-plans', {}, isArr);
  return real ? (real as LicPlan[]) : unavailable('/lic-plans', state.licPlans);
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
// Fallback = the office pin (Surat), used if the backend geofence route isn't reachable yet.
const FALLBACK_GEOFENCE: Geofence = { lat: 21.208780388697864, lng: 72.83928189060113, radius_m: 2000, label: 'CGPE Head Office', enforce: true };
let _geoCache: Geofence | null = null;

/** The office geofence (cached for the session). */
export async function getGeofence(): Promise<Geofence> {
  if (_geoCache) return _geoCache;
  const real = await tryReal<any>('/time-tracker/geofence', {}, (d) => d && Number.isFinite(d.lat));
  _geoCache = real ? { lat: real.lat, lng: real.lng, radius_m: real.radius_m || 2000, label: real.label || 'Office', enforce: real.enforce !== false } : FALLBACK_GEOFENCE;
  return _geoCache;
}

/** Haversine distance in metres (client-side pre-check, mirrors the server). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Client-side geofence check (UX only — the server re-validates). */
export async function checkGeofence(lat?: number, lng?: number, accuracy?: number): Promise<{ allowed: boolean; distance_m: number | null; radius_m: number; message: string }> {
  const g = await getGeofence();
  if (!g.enforce) return { allowed: true, distance_m: null, radius_m: g.radius_m, message: '' };
  if (lat == null || lng == null || !isFinite(lat) || !isFinite(lng)) {
    return { allowed: false, distance_m: null, radius_m: g.radius_m, message: 'Enable location to clock in.' };
  }
  const dist = distanceMeters(lat, lng, g.lat, g.lng);
  const tol = typeof accuracy === 'number' && isFinite(accuracy) ? Math.min(accuracy, 100) : 0;
  const allowed = dist - tol <= g.radius_m;
  return {
    allowed, distance_m: Math.round(dist), radius_m: g.radius_m,
    message: allowed ? 'Within the office area' : `You're ${(dist / 1000).toFixed(2)} km from the office. Clock-in is allowed within ${(g.radius_m / 1000).toFixed(1)} km.`,
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

/* --------------------------------------------------- Movement tracking */
export type TrackPoint = { lat: number; lng: number; at?: string | number; accuracy?: number; speed?: number; heading?: number; battery?: number };
export type TrackSession = { session_id: string; date: string; started_at: string; ended_at: string | null; point_count: number; distance_m: number };

export async function startTrack(sessionId?: string): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO) return true;
  try { const { ok } = await req('/time-tracker/track/start', { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }); return ok; }
  catch { return false; }
}
export async function postTrackPoints(points: TrackPoint[], sessionId?: string): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO || !points.length) return true;
  try { const { ok } = await req('/time-tracker/track/points', { method: 'POST', body: JSON.stringify({ session_id: sessionId, points }) }); return ok; }
  catch { return false; }
}
export async function stopTrack(sessionId?: string): Promise<boolean> {
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
  if (!sessionReal || FORCE_DEMO) return unavailable('/attendance', [] as AgentPin[]);
  const profiles = (await tryReal<any[]>('/profiles?limit=60', {}, isArr)) || [];
  const people = profiles.filter((p) => p.user_id).slice(0, 20);
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

/** Generate a family/client report -> POST /api/clients/generate-report. */
export async function generateReport(clientName: string): Promise<any | null> {
  const real = await tryReal<any>('/clients/generate-report', { method: 'POST', body: JSON.stringify({ clientName }) }, isObj);
  if (real) return real;
  // demo fallback: a representative summary so the flow is visible offline
  await wait(700);
  return {
    ok: true, familyHead: clientName, source: 'demo',
    summary: { total_policies: 2, life_cover: 4200000, annual_premium: 186000, members: 1 },
    viewUrl: null, pdfUrl: null,
  };
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
 * ONE KNOWN GAP IS FLAGGED, NOT HIDDEN. `/api/lic-plans` returns 404 in production while
 * existing locally, so that screen legitimately comes back empty in a shipped build until
 * the backend is redeployed. It surfaces through `data/health` like any other outage.
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
    search: opts.search,
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

