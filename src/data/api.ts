/**
 * Data layer — REAL-BACKEND-FIRST with graceful fallback.
 * A real advisor session (successful login or restored real token) calls the live
 * CGPE REST API; raw docs are mapped through src/data/adapt.ts. If a call is
 * unreachable it falls back to sample data for that call so the UI never breaks.
 * Set FORCE_DEMO=true to always use sample data.
 */
import { Platform } from 'react-native';
import { API_BASE_URL, FORCE_DEMO, MOCK_LATENCY, REQUEST_TIMEOUT } from '@/constants/config';
import * as mock from './mock';
import { adaptClient, adaptLead, adaptUser, adaptClaim, adaptWaThread, adaptWaMessage, adaptReminder, adaptNotification } from './adapt';
import { teamMembers, teamActivityFeed, TeamMember, TeamActivity } from './team';
import { tasks as mockTasks, Task, TaskStatus } from './tasks';
import type {
  Claim, Client, Commission, Contest, Lead, LeadStage, LicPlan,
  Reminder, User, WaThread, AppNotification,
} from './types';

const wait = (ms = MOCK_LATENCY) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

let authToken: string | null = null;
let sessionReal = false;
let currentUserId: string | null = null;
let currentUserName: string | null = null;

export function setAuthToken(t: string | null) {
  authToken = t;
  sessionReal = !!t && !t.startsWith('demo-');
}
export function setCurrentUser(id: string | null, name?: string | null) {
  currentUserId = id; currentUserName = name || null;
}
export function isRealSession() { return sessionReal; }

async function req(path: string, opts: RequestInit = {}, timeout = REQUEST_TIMEOUT): Promise<any> {
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
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/** Try the real API; null on any failure/validation miss so the caller can fall back. */
async function tryReal<T>(path: string, opts: RequestInit, validate: (d: any) => boolean): Promise<T | null> {
  if (FORCE_DEMO || !sessionReal) return null;
  try {
    const { ok, json } = await req(path, opts);
    if (!ok) return null;
    const data = json?.data ?? json;
    return validate(data) ? (data as T) : null;
  } catch {
    return null;
  }
}

const isArr = (d: any) => Array.isArray(d);
const isObj = (d: any) => d && typeof d === 'object' && !Array.isArray(d);

const state = {
  leads: clone(mock.leads),
  clients: clone(mock.clients),
  claims: clone(mock.claims),
  reminders: clone(mock.reminders),
  waThreads: clone(mock.waThreads),
  notifications: clone(mock.notifications),
  commission: clone(mock.commission),
  contests: clone(mock.contests),
  licPlans: clone(mock.licPlans),
  tasks: clone(mockTasks),
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
  return real ? real.map(adaptTask) : demo(state.tasks);
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
  if (!sessionReal || FORCE_DEMO) {
    // Demo preview: derive a populated snapshot from sample data so no screen is empty.
    const settled = state.claims.filter((c) => c.status === 'settled');
    const openTasks = state.tasks.filter((t) => t.status !== 'done');
    return {
      total_clients: state.clients.length,
      claims: {
        total: state.claims.length,
        under_process: state.claims.filter((c) => c.status !== 'settled' && c.status !== 'rejected').length,
        passed: settled.length,
        paid_amount: settled.reduce((s, c) => s + (c.amount || 0), 0),
      },
      tickets: state.notifications.length,
      leads: state.leads.length,
      tasks: { members: teamMembers.length, total: state.tasks.length, open: openTasks.length, done: state.tasks.length - openTasks.length, overdue: 0 },
    };
  }
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
  return demo(state.tasks.find((t) => t.id === id));
}

/** Map the app's status back to the backend's team_tasks vocabulary. */
const toServerStatus = (s: TaskStatus) => (s === 'done' ? 'done' : s === 'in_progress' ? 'in_progress' : s === 'blocked' ? 'blocked' : 'open');

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<{ ok: boolean; forbidden?: boolean }> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, status: code } = await req(`/team/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: toServerStatus(status) }) });
      if (code === 403) return { ok: false, forbidden: true };
      if (ok) return { ok: true };
    } catch { /* fall through to local */ }
  }
  const t = state.tasks.find((x) => x.id === id);
  if (t) { t.status = status; if (status === 'done') { t.completedAt = new Date().toISOString(); t.steps.forEach((s) => (s.done = true)); } }
  await wait(120);
  return { ok: true };
}

/** Reassign a task to another member (admin/leader only). */
export async function reassignTask(id: string, assigneeName: string): Promise<boolean> {
  if (!sessionReal || FORCE_DEMO) return true;
  try { const { ok } = await req(`/team/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ assigneeName }) }); return ok; }
  catch { return false; }
}
export async function toggleTaskStep(taskId: string, stepId: string): Promise<void> {
  const t = state.tasks.find((x) => x.id === taskId);
  const step = t?.steps.find((s) => s.id === stepId);
  if (step && t) {
    step.done = !step.done;
    const allDone = t.steps.every((s) => s.done);
    if (allDone) { t.status = 'done'; t.completedAt = new Date().toISOString(); }
    else if (t.status === 'done' || t.status === 'todo') t.status = 'in_progress';
  }
  await wait(120);
}
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

async function demo<T>(value: T): Promise<T> { await wait(); return clone(value); }

/* -------------------------------------------------------------------- Auth */
export async function login(id: string, pw: string): Promise<{ user: User; token: string }> {
  if (!FORCE_DEMO) {
    let reachable = true;
    try {
      const { ok, status, json } = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email_or_phone: id, password: pw }) });
      const data = ok ? (json?.data ?? json) : null;
      if (data?.token && data?.user) {
        sessionReal = true;
        return { user: adaptUser(data.user), token: data.token };
      }
      // The backend answered but REJECTED the credentials — surface the real error
      // instead of silently signing the user into sample data.
      if (status >= 400 && status < 500) {
        throw new Error(json?.error || json?.message || 'Invalid credentials. Please check and try again.');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError' && e?.message && !/fetch|network|Failed to fetch|Load failed/i.test(e.message)) {
        throw e; // real auth failure — propagate
      }
      reachable = false; // unreachable -> demo fallback below
    }
    if (!reachable) { /* fall through */ }
  }
  await wait(400);
  sessionReal = false;
  return { user: clone(mock.currentUser), token: 'demo-token-' + Date.now() };
}
/** Send a login OTP to a mobile number (tries the real backend, else simulates). */
export async function sendOtp(phone: string): Promise<{ ok: boolean; message: string }> {
  if (!FORCE_DEMO) {
    try {
      // Staff login OTP lives at /auth/request-otp (body: { email_or_phone }).
      const { ok, json } = await req('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email_or_phone: phone, phone }) });
      if (ok && json?.success !== false) return { ok: true, message: json?.message || 'OTP sent to your mobile number.' };
    } catch { /* fall through */ }
  }
  await wait(500);
  return { ok: true, message: 'OTP sent to your mobile number.' };
}
/** Verify a login OTP -> session (real backend, else demo when a code is entered). */
export async function verifyOtp(phone: string, code: string): Promise<{ user: User; token: string } | null> {
  if (!FORCE_DEMO) {
    try {
      const { ok, json } = await req('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, email_or_phone: phone, code, otp: code }) });
      const data = ok ? (json?.data ?? json) : null;
      if (data?.token && data?.user) { sessionReal = true; return { user: adaptUser(data.user), token: data.token }; }
    } catch { /* fall through */ }
  }
  if (code && code.replace(/\D/g, '').length >= 4) {
    await wait(400); sessionReal = false;
    return { user: clone(mock.currentUser), token: 'demo-token-' + Date.now() };
  }
  return null;
}

export async function me(): Promise<User> {
  const real = await tryReal<any>('/auth/me', {}, isObj);
  const u = real?.user ?? real; // /auth/me nests under data.user
  return u && (u.user_id || u.full_name || u.email) ? adaptUser(u) : demo(mock.currentUser);
}
export async function deleteAccount(): Promise<{ ok: true }> {
  if (sessionReal && !FORCE_DEMO) await tryReal('/auth/me', { method: 'DELETE' }, () => true);
  else await wait(500);
  return { ok: true };
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
  return demo(state.leads);
}
export async function getLead(id: string): Promise<Lead | undefined> {
  const real = await tryReal<any>(`/leads/${id}?scope=all`, {}, (d) => d && (d.name || d._id || d.leadId));
  return real ? adaptLead(real) : demo(state.leads.find((l) => l.id === id));
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
    try {
      const { ok, json } = await req(q);
      if (ok && Array.isArray(json?.data)) {
        const items = json.data.map(adaptClient);
        items.forEach((cl: Client) => clientCache.set(cl.id, cl));
        const totalPages = Number(json.totalPages) || 0;
        if (!search) clientTotal = totalPages * CLIENT_PAGE; // approximate; exact total via getClientStats
        return { items, hasMore: page < totalPages, total: totalPages };
      }
    } catch { /* fall through to demo */ }
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
  try {
    const { ok, json } = await req('/clients?limit=1&page=1&scope=all');
    if (ok) total = Number(json?.totalPages) || 0; // limit=1 -> totalPages == exact doc count
  } catch { /* ignore */ }
  // The aggregation endpoint is scope-buggy for super_admin; use it only if it returns real numbers.
  const agg = await tryReal<any>('/clients/stats/overview?scope=all', {}, isObj);
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
    try { const r = await req(`/clients?limit=${CLIENT_PAGE}&page=${page}&scope=all`); if (r.ok) json = r.json; } catch { /* skip page */ }
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
  return demo(state.clients.find((c) => c.id === id));
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
  return demo(state.claims);
}
export async function getClaim(id: string): Promise<Claim | undefined> {
  if (claimCache.has(id)) return clone(claimCache.get(id)!);
  const real = await tryReal<any>(`/claims/${id}?scope=all`, {}, (d) => d && (d.id || d._id || d.claim_number));
  if (real) return adaptClaim(real);
  return demo(state.claims.find((c) => c.id === id));
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
  return demo(state.reminders);
}
export async function toggleReminder(id: string): Promise<void> {
  const r = state.reminders.find((x) => x.id === id);
  if (r) r.done = !r.done;
  await wait(100);
}

/* ------------------------------------------------------------------- Misc */
export async function getCommission(): Promise<Commission> {
  return (await tryReal<Commission>('/commissions', {}, isObj)) ?? demo(state.commission);
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
  return demo(state.waThreads);
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
  return demo(state.waThreads.find((t) => t.id === id));
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
  return demo(state.notifications);
}
export async function markAllNotificationsRead(): Promise<void> {
  if (sessionReal && !FORCE_DEMO) await tryReal('/notifications/read-all', { method: 'POST' }, () => true);
  state.notifications.forEach((n) => (n.read = true));
  await wait(100);
}
export async function getContests(): Promise<Contest[]> {
  return (await tryReal<Contest[]>('/contests', {}, isArr)) ?? demo(state.contests);
}
export async function getLicPlans(): Promise<LicPlan[]> { return demo(state.licPlans); }

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
  return real ? real.map(adaptMember) : demo(teamMembers);
}
/** Roster with REAL user_ids (from /profiles) — for the master track viewer's picker. */
export async function getTrackableMembers(): Promise<{ id: string; name: string; role: string }[]> {
  const real = await tryReal<any[]>('/profiles?limit=100', {}, isArr);
  if (real) return real.filter((p) => p.user_id).map((p) => ({ id: String(p.user_id), name: p.full_name || p.name || 'Member', role: p.role || 'advisor' }));
  return teamMembers.map((m) => ({ id: m.id, name: m.name, role: m.role }));
}

export async function getTeamMember(id: string): Promise<TeamMember | undefined> {
  const real = await tryReal<any>(`/profiles/${id}`, {}, isObj);
  return real ? adaptMember(real) : demo(teamMembers.find((m) => m.id === id));
}
export async function getTeamActivity(): Promise<TeamActivity[]> {
  return demo(teamActivityFeed());
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
export async function clockIn(coords: { lat?: number; lng?: number; accuracy?: number; city?: string }): Promise<{ ok: boolean; message?: string; blocked?: boolean; distance_m?: number; sessionId?: string }> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, status, json } = await req('/time-tracker/clock-in', {
        method: 'POST',
        body: JSON.stringify({ ...coords, source: 'mobile' }),
      });
      if (status === 403) return { ok: false, blocked: true, message: json?.message, distance_m: json?.distance_m };
      const sessionId = json?.data?.session?._id || json?.data?.sessionId || json?.sessionId;
      return { ok, message: json?.message, sessionId: sessionId ? String(sessionId) : undefined };
    } catch { return { ok: true }; }
  }
  await wait(300);
  return { ok: true };
}
export async function clockOut(coords: { lat?: number; lng?: number; accuracy?: number; city?: string } = {}): Promise<{ ok: boolean; blocked?: boolean; message?: string; distance_m?: number }> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, status, json } = await req('/time-tracker/clock-out', { method: 'POST', body: JSON.stringify({ ...coords, source: 'mobile' }) });
      if (status === 403) return { ok: false, blocked: true, message: json?.message, distance_m: json?.distance_m };
      return { ok };
    } catch { return { ok: true }; }
  }
  await wait(200); return { ok: true };
}
export async function getAttendanceHistory(): Promise<any[]> {
  // History accrues in DayLog sessions via /time-tracker/history; fall back to the
  // per-user attendance endpoint used by the map so the screen is never empty.
  const real = await tryReal<any[]>('/time-tracker/history?limit=30', {}, isArr);
  if (real) return real;
  return (await tryReal<any[]>('/attendance/history?limit=30', {}, isArr)) ?? [];
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
  if (!sessionReal || FORCE_DEMO) {
    return [
      { id: 'd1', name: 'Rahul Patel', city: 'Anand', inLat: 22.5645, inLng: 72.9289, inTime: new Date().toISOString(), onDuty: true },
      { id: 'd2', name: 'Sneha Trivedi', city: 'Nadiad', inLat: 22.6916, inLng: 72.8634, inTime: new Date().toISOString(), onDuty: true },
      { id: 'd3', name: 'Amit Chauhan', city: 'Borsad', inLat: 22.406, inLng: 72.897, inTime: new Date().toISOString(), outLat: 22.41, outLng: 72.9, outTime: new Date().toISOString(), onDuty: false },
    ];
  }
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
  // demo: count matching clients locally
  await wait(600);
  const clients = state.clients;
  const now = new Date();
  const match = clients.filter((c) => {
    const fup = c.policies[0]?.nextRenewal;
    if (type === 'renewal') return fup && new Date(fup).getMonth() === now.getMonth();
    if (type === 'birthday') return c.dob && new Date(c.dob).getMonth() === now.getMonth();
    return true;
  });
  const count = opts.limit ? Math.min(opts.limit, match.length) : match.length;
  return { ok: true, count, message: `Queued ${count} WhatsApp message(s) (demo).` };
}
