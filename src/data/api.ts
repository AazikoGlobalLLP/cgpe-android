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
import { adaptClient, adaptLead, adaptUser } from './adapt';
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

export function setAuthToken(t: string | null) {
  authToken = t;
  sessionReal = !!t && !t.startsWith('demo-');
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
export async function getTasks(): Promise<Task[]> {
  const real = await tryReal<any[]>('/tasks?limit=500', {}, isArr);
  return real ? real.map(adaptTask) : demo(state.tasks);
}
export async function getTask(id: string): Promise<Task | undefined> {
  const real = await tryReal<any>(`/tasks/${id}`, {}, isObj);
  return real ? adaptTask(real) : demo(state.tasks.find((t) => t.id === id));
}
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const real = await tryReal(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }, () => true);
  if (real == null) {
    const t = state.tasks.find((x) => x.id === id);
    if (t) { t.status = status; if (status === 'done') { t.completedAt = new Date().toISOString(); t.steps.forEach((s) => (s.done = true)); } }
    await wait(150);
  }
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
export async function addTask(data: Partial<Task>): Promise<Task> {
  const task: Task = {
    id: 't' + (Date.now() % 100000), title: data.title || 'New task', description: data.description || '',
    status: 'todo', priority: data.priority || 'medium', category: data.category || 'General',
    dueDate: data.dueDate || new Date().toISOString(), assignedBy: 'Self', client: data.client,
    steps: [], createdAt: new Date().toISOString(),
  };
  const real = await tryReal<any>('/tasks', { method: 'POST', body: JSON.stringify(task) }, isObj);
  if (real) return adaptTask(real);
  state.tasks.unshift(task); await wait(250); return clone(task);
}

async function demo<T>(value: T): Promise<T> { await wait(); return clone(value); }

/* -------------------------------------------------------------------- Auth */
export async function login(id: string, pw: string): Promise<{ user: User; token: string }> {
  if (!FORCE_DEMO) {
    try {
      const { ok, json } = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email_or_phone: id, password: pw }) });
      const data = ok ? (json?.data ?? json) : null;
      if (data?.token && data?.user) {
        sessionReal = true;
        return { user: adaptUser(data.user), token: data.token };
      }
    } catch { /* fall through to demo */ }
  }
  await wait(400);
  sessionReal = false;
  return { user: clone(mock.currentUser), token: 'demo-token-' + Date.now() };
}
/** Send a login OTP to a mobile number (tries the real backend, else simulates). */
export async function sendOtp(phone: string): Promise<{ ok: boolean; message: string }> {
  if (!FORCE_DEMO) {
    try {
      const { ok, json } = await req('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone, email_or_phone: phone }) });
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
export async function getLeads(): Promise<Lead[]> {
  const real = await tryReal<any[]>('/leads?limit=500', {}, isArr);
  return real ? real.map(adaptLead) : demo(state.leads);
}
export async function getLead(id: string): Promise<Lead | undefined> {
  const real = await tryReal<any>(`/leads/${id}`, {}, isObj);
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
export async function getClients(): Promise<Client[]> {
  // Request a high limit so the whole book comes back (server default is 10).
  const real = await tryReal<any[]>('/clients?limit=1000&page=1', {}, isArr);
  return real ? real.map(adaptClient) : demo(state.clients);
}
export async function getClient(id: string): Promise<Client | undefined> {
  const real = await tryReal<any>(`/clients/${id}`, {}, isObj);
  return real ? adaptClient(real) : demo(state.clients.find((c) => c.id === id));
}

/* ----------------------------------------------------------------- Claims */
export async function getClaims(): Promise<Claim[]> {
  return (await tryReal<Claim[]>('/claims?limit=500', {}, isArr)) ?? demo(state.claims);
}
export async function getClaim(id: string): Promise<Claim | undefined> {
  return (await tryReal<Claim>(`/claims/${id}`, {}, isObj)) ?? demo(state.claims.find((c) => c.id === id));
}
export async function addClaim(data: Partial<Claim>): Promise<Claim> {
  const claim: Claim = {
    id: 'cl' + (Date.now() % 100000), ref: 'CLM-2026-' + String(1000 + (Date.now() % 9000)).slice(-4),
    clientName: data.clientName || 'New Client', clientPhone: data.clientPhone || '',
    type: (data.type as Claim['type']) || 'Maturity', policyNumber: data.policyNumber || '',
    amount: data.amount || 0, status: 'intake', insurer: data.insurer || 'LIC of India',
    openedAt: new Date().toISOString(), ageDays: 0, docs: data.docs || [],
    timeline: [{ id: 't' + Date.now(), label: 'Claim intake started', at: new Date().toISOString(), by: 'Rahul Patel' }],
    aiSummary: 'New claim created. Collect required documents to proceed.',
  };
  const real = await tryReal<Claim>('/claims/intake', { method: 'POST', body: JSON.stringify(claim) }, isObj);
  if (real) return real;
  state.claims.unshift(claim); await wait(300); return clone(claim);
}
export async function toggleClaimDoc(claimId: string, docId: string): Promise<void> {
  const c = state.claims.find((x) => x.id === claimId);
  const doc = c?.docs.find((x) => x.id === docId);
  if (doc) doc.received = !doc.received;
  await wait(100);
}

/* -------------------------------------------------------------- Reminders */
export async function getReminders(): Promise<Reminder[]> {
  return (await tryReal<Reminder[]>('/reminders', {}, isArr)) ?? demo(state.reminders);
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
export async function getWaThreads(): Promise<WaThread[]> {
  return (await tryReal<WaThread[]>('/whatsapp/hub/threads', {}, isArr)) ?? demo(state.waThreads);
}
export async function getWaThread(id: string): Promise<WaThread | undefined> {
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
  return (await tryReal<AppNotification[]>('/notifications', {}, isArr)) ?? demo(state.notifications);
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
export async function getTeam(): Promise<TeamMember[]> {
  const real = (await tryReal<any[]>('/team', {}, isArr)) || (await tryReal<any[]>('/profiles?limit=500', {}, isArr));
  return real ? real.map(adaptMember) : demo(teamMembers);
}
export async function getTeamMember(id: string): Promise<TeamMember | undefined> {
  const real = await tryReal<any>(`/profiles/${id}`, {}, isObj);
  return real ? adaptMember(real) : demo(teamMembers.find((m) => m.id === id));
}
export async function getTeamActivity(): Promise<TeamActivity[]> {
  return demo(teamActivityFeed());
}

export async function search(q: string) {
  await wait(150);
  const s = q.toLowerCase().trim();
  if (!s) return { leads: [], clients: [], claims: [] };
  const clients = await getClients();
  return {
    leads: state.leads.filter((l) => l.name.toLowerCase().includes(s) || l.phone.includes(s)).slice(0, 6),
    clients: clients.filter((cl) => cl.name.toLowerCase().includes(s) || cl.phone.includes(s)).slice(0, 8),
    claims: state.claims.filter((cl) => cl.clientName.toLowerCase().includes(s) || cl.ref.toLowerCase().includes(s)).slice(0, 6),
  };
}

/* ============================ Real feature actions ========================= */

/** Attendance clock-in with GPS -> POST /api/time-tracker/clock-in. */
export async function clockIn(coords: { lat?: number; lng?: number; accuracy?: number; city?: string }): Promise<{ ok: boolean; message?: string }> {
  if (sessionReal && !FORCE_DEMO) {
    try {
      const { ok, json } = await req('/time-tracker/clock-in', {
        method: 'POST',
        body: JSON.stringify({ ...coords, source: 'mobile' }),
      });
      return { ok, message: json?.message };
    } catch { return { ok: true }; }
  }
  await wait(300);
  return { ok: true };
}
export async function clockOut(coords: { lat?: number; lng?: number; city?: string } = {}): Promise<{ ok: boolean }> {
  if (sessionReal && !FORCE_DEMO) {
    try { const { ok } = await req('/time-tracker/clock-out', { method: 'POST', body: JSON.stringify({ ...coords, source: 'mobile' }) }); return { ok }; }
    catch { return { ok: true }; }
  }
  await wait(200); return { ok: true };
}
export async function getAttendanceHistory(): Promise<any[]> {
  return (await tryReal<any[]>('/attendance/history?limit=30', {}, isArr)) ?? [];
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
  return await tryReal<CampaignSummary>('/campaigns/summary', {}, isObj);
}
/** Preview an audience: count + up to 8 personalised sample recipients (backend uses .lean() so fupDate survives). */
export async function getCampaignAudience(type: 'renewal' | 'birthday' | 'anniversary' | 'maturity'): Promise<{ count: number; matched: number; sample: { name: string; phone: string; message: string }[] } | null> {
  const real = await tryReal<any>(`/campaigns/audience?type=${type}`, {}, isObj);
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
