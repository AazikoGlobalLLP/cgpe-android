/**
 * Adapters that map RAW backend documents (mixed lic-import + app schema) into the
 * app's typed shapes. Mirrors backend services/greetingEngine.js normalizeClient so
 * real client data renders correctly. Also holds the fupDate premium-due rule.
 */
import type { AppNotification, Claim, Client, Lead, LeadStage, Policy, Reminder, User, WaMessage, WaThread } from './types';

function num(v: any): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}
function parseDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s || /^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function iso(d: Date | null): string {
  return d ? d.toISOString() : '';
}
function titleCase(name: any): string {
  const s = String(name || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return s.toLowerCase().split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}
function pickPhone(c: any): string {
  const cands = [c.phone, c.whatsappNumber, c.mobile, c.phoneNumber, c.mobileRaw, c.phoneLast10];
  for (const v of cands) {
    const digits = String(v || '').replace(/\D/g, '');
    if (digits.length === 10) return '+91' + digits;
    if (digits.length >= 11 && digits.length <= 15) return '+' + digits;
  }
  return '';
}

/** month+day match helpers (any year) */
export function monthMatches(d?: string | Date | null, ref = new Date()): boolean {
  const x = d ? new Date(d) : null;
  return !!x && !isNaN(x.getTime()) && x.getMonth() === ref.getMonth();
}
export function dayMatches(d?: string | Date | null, ref = new Date()): boolean {
  const x = d ? new Date(d) : null;
  return !!x && !isNaN(x.getTime()) && x.getMonth() === ref.getMonth() && x.getDate() === ref.getDate();
}

/** Item 12: premium is due THIS month when fupDate's month falls in the current month. */
export function isPremiumDueThisMonth(client: Client, ref = new Date()): boolean {
  const fup = client.policies[0]?.nextRenewal;
  return monthMatches(fup, ref);
}
export function isBirthdayThisMonth(client: Client, ref = new Date()): boolean {
  return monthMatches(client.dob, ref);
}
export function isBirthdayToday(client: Client, ref = new Date()): boolean {
  return dayMatches(client.dob, ref);
}

function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

export function adaptClient(raw: any): Client {
  raw = raw || {};
  const pi = raw.personal_info || {};
  const pd = raw.policy_details || {};
  const name = titleCase(raw.name || raw.clientName || raw.fullName || raw.insuredName) || 'Customer';
  const dob = parseDate(raw.dob || pi.date_of_birth || raw.date_of_birth || raw.dateOfBirth);
  const commencement = parseDate(raw.commencementDate || raw.policy_start_date || raw.startDate);
  const maturity = parseDate(raw.maturityDate || raw.maturity_dt || raw.policy_end_date || raw.maturity_date);
  const fupDate = parseDate(raw.fupDate || raw.fup_date || raw.next_premium_date); // premium-due anchor
  const premium = num(raw.premium != null ? raw.premium : raw.premium_amount);
  const sumAssured = num(raw.sumAssured != null ? raw.sumAssured : (pd.sum_assured != null ? pd.sum_assured : raw.sum_assured));
  const policyNo = String(raw.policyNo || raw.policy_number || raw.policyNumber || '').trim();
  const plan = String(raw.policy_type || raw.planName || raw.plan || 'LIC Policy').trim() || 'LIC Policy';
  const mode = String(raw.mode || pd.premium_frequency || '').trim();
  const city = String((raw.address && raw.address.city) || raw.city || '').trim();

  const policy: Policy = {
    id: policyNo || String(raw._id || raw.id || Math.random()),
    plan,
    number: policyNo || '-',
    sumAssured,
    premium,
    frequency: (mode as any) || 'Yearly',
    startDate: iso(commencement),
    maturityDate: iso(maturity),
    nextRenewal: iso(fupDate), // fupDate drives premium-due
    status: 'in_force',
  };

  const segment: Client['segment'] = [];
  if (monthMatches(fupDate)) segment.push('renewal_due');
  if (monthMatches(dob)) segment.push('birthday');
  const matDays = daysUntil(maturity);
  if (matDays != null && matDays >= 0 && matDays <= 90) segment.push('maturity_soon');
  if (!segment.length) segment.push('cross_sell');

  return {
    id: String(raw._id || raw.id || policyNo || name),
    name,
    phone: pickPhone(raw),
    email: raw.email || undefined,
    city,
    dob: iso(dob),
    family: raw.familyName || raw.family || undefined,
    totalPremium: premium,
    totalCover: sumAssured,
    policies: [policy],
    segment: Array.from(new Set(segment)) as Client['segment'],
    since: commencement ? String(commencement.getFullYear()) : '-',
  };
}

export function adaptUser(raw: any): User {
  raw = raw || {};
  return {
    id: String(raw.user_id || raw._id || raw.id || 'u1'),
    name: raw.full_name || raw.name || 'Advisor',
    email: raw.email || '',
    phone: raw.phone || raw.mobile || '',
    role: raw.role || 'advisor',
    designation: raw.designation || raw.title || 'Advisor',
    branch: raw.branch || raw.branch_name || '',
    agentCode: raw.agent_code || raw.employee_id || raw.code || '',
    tier: (raw.tier || raw.club || 'Growth') as User['tier'],
  };
}

/** Pull a rupee figure out of free text ("Budget: Rs 50,000", "₹2 lakh", "50k"). */
function parseBudget(s: any): number {
  const str = String(s || '');
  const m = str.match(/(?:budget|rs\.?|₹|inr)\s*:?\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|lac|l|cr)?/i);
  if (!m) return 0;
  let n = Number(m[1].replace(/,/g, ''));
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'k') n *= 1000;
  else if (unit === 'l' || unit === 'lakh' || unit === 'lac') n *= 100000;
  else if (unit === 'cr') n *= 10000000;
  return isFinite(n) ? n : 0;
}
function mapLeadStage(s: any): LeadStage {
  const x = String(s || '').toLowerCase();
  if (/won|convert|closed_won/.test(x)) return 'closed_won';
  if (/lost|closed_lost|dead|junk/.test(x)) return 'closed_lost';
  if (/propos|quot/.test(x)) return 'proposal';
  if (/meet|visit/.test(x)) return 'meeting';
  if (/contact|call|follow|working|qualif/.test(x)) return 'contacted';
  return 'new';
}

/** Real leads have a free-text `notes` string (not an array), `probability` instead
 *  of a rupee potential, and a `phoneLast10`. Map all of that so the UI isn't blank. */
export function adaptLead(raw: any): Lead {
  raw = raw || {};
  const notesRaw = raw.notes;
  const notes = Array.isArray(notesRaw)
    ? notesRaw.map((n: any, i: number) => ({ id: String(n._id || i), text: n.text || String(n), at: n.at || n.createdAt || '' }))
    : (typeof notesRaw === 'string' && notesRaw.trim()
        ? [{ id: 'n0', text: notesRaw.trim(), at: raw.updatedAt || raw.updated_at || raw.createdAt || '' }]
        : []);
  const potential = num(raw.potential || raw.premium_potential || raw.value || raw.expected_premium)
    || parseBudget(notesRaw) || parseBudget(raw.interest);
  const prob = num(raw.probability);
  const p10 = String(raw.phoneLast10 || '').replace(/\D/g, '');
  return {
    id: String(raw._id || raw.id || raw.leadId),
    name: titleCase(raw.name || raw.clientName || raw.fullName) || 'Lead',
    phone: raw.phone ? String(raw.phone) : (p10.length === 10 ? '+91' + p10 : ''),
    stage: mapLeadStage(raw.stage || raw.status),
    source: raw.source || 'Manual',
    interest: raw.interest || raw.product || (typeof notesRaw === 'string' ? notesRaw.slice(0, 90) : '') || '',
    potential,
    city: (raw.address && raw.address.city) || raw.city || '',
    priority: raw.priority || (prob >= 70 ? 'hot' : prob > 0 && prob < 30 ? 'cold' : 'warm'),
    nextAction: raw.next_action || raw.nextAction,
    nextActionDate: raw.next_followup_date || raw.next_action_date || raw.nextActionDate,
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    lastActivity: raw.updatedAt || raw.updated_at || raw.lastActivity || raw.createdAt || new Date().toISOString(),
    notes,
  };
}

/* ------------------------------------------------------------------ Claims */
const CLAIM_TYPE_LABEL: Record<string, Claim['type']> = {
  health: 'Health', life: 'Death', death: 'Death', maturity: 'Maturity',
  motor: 'Accident', accident: 'Accident', property: 'Accident', travel: 'Accident',
  surrender: 'Surrender', other: 'Health',
};
function mapClaimStatus(raw: any): Claim['status'] {
  const s = String(raw.status || '').toLowerCase();
  const stage = String(raw.stage || '').toLowerCase();
  if (/paid|settl|closed|pass/.test(s)) return 'settled';
  if (/reject|declin/.test(s)) return 'rejected';
  if (/submit/.test(s)) return 'submitted';
  if (/partial|process|review|progress/.test(s)) return 'under_review';
  if (stage.includes('document') && !raw.documents_received) return 'docs_pending';
  if (s === 'intake' || s === 'new') return 'intake';
  return 'under_review';
}
/** Real claim register doc → app Claim. Fields: claim_number, claim_amount,
 *  patient_name, status(in_process/partial_paid/paid), claimant{}, client{}, etc. */
export function adaptClaim(raw: any): Claim {
  raw = raw || {};
  const claimant = raw.claimant || {};
  const client = raw.client || {};
  const created = parseDate(raw.created_at || raw.submitted_date || raw.createdAt);
  const ageDays = created ? Math.max(0, Math.round((Date.now() - created.getTime()) / 86400000)) : 0;
  const ctype = String(raw.claim_type || raw.insurance_subtype || '').toLowerCase();
  const amount = num(raw.claim_amount != null ? raw.claim_amount : (raw.claimable_amount != null ? raw.claimable_amount : raw.settlement_amount));
  const missing: string[] = Array.isArray(raw.missing_info) ? raw.missing_info : [];
  const docs = missing.length
    ? missing.map((m, i) => ({ id: 'd' + i, name: String(m), received: false }))
    : (raw.documents_received ? [{ id: 'd0', name: 'All required documents', received: true }] : []);
  const hist = Array.isArray(raw.status_history) ? raw.status_history : [];
  const timeline = hist.map((h: any, i: number) => ({
    id: String(h._id || i),
    label: String(h.label || h.status || h.stage || 'Update'),
    at: h.at || h.createdAt || h.date || '',
    by: h.by || h.actor || 'System',
  }));
  if (!timeline.length && created) timeline.push({ id: 't0', label: 'Claim registered', at: iso(created), by: 'System' });
  return {
    id: String(raw.id || raw._id),
    ref: String(raw.claim_number || raw.claimId || raw.ref || raw.id || ''),
    clientName: titleCase(raw.patient_name || claimant.name || client.name) || 'Claimant',
    clientPhone: pickPhone({ phone: claimant.phone || client.phone || raw.mobileNumber }),
    type: CLAIM_TYPE_LABEL[ctype] || 'Health',
    policyNumber: String(raw.policy_number || raw.policyNumber || ''),
    amount,
    status: mapClaimStatus(raw),
    insurer: String(raw.insurer_company || raw.tpa_name || raw.insurer || 'LIC of India'),
    openedAt: iso(created),
    ageDays,
    docs,
    timeline,
    aiSummary: raw.last_note || raw.workflow_label || (raw.details && raw.details.TPA ? `TPA: ${raw.details.TPA}` : '') || undefined,
  };
}

/* --------------------------------------------------------------- WhatsApp */
export function adaptWaThread(raw: any): WaThread {
  raw = raw || {};
  const p10 = String(raw.phone_last10 || raw.phoneLast10 || '').replace(/\D/g, '');
  return {
    id: String(raw.thread_ref || raw.threadRef || raw.id || p10),
    name: titleCase(raw.name || raw.clientName) || 'WhatsApp user',
    phone: p10.length === 10 ? '+91' + p10 : (p10 ? '+' + p10 : ''),
    lastMessage: raw.preview || raw.lastMessageText || '',
    lastAt: raw.last_at || raw.lastMessageAt || raw.updatedAt || '',
    unread: num(raw.unread),
    tag: raw.type || raw.threadType || undefined,
    messages: [],
  };
}
export function adaptWaMessage(raw: any): WaMessage {
  raw = raw || {};
  return {
    id: String(raw.id || raw._id || Math.random()),
    fromMe: String(raw.direction || 'outbound') === 'outbound',
    text: raw.text || raw.messageText || '',
    at: raw.at || raw.createdAt || '',
  };
}

/* --------------------------------------------------------------- Reminders */
const REMINDER_TYPE: Record<string, Reminder['type']> = {
  birthday: 'birthday', anniversary: 'anniversary', renewal: 'renewal',
  maturity: 'maturity', event: 'meeting', meeting: 'meeting', followup: 'followup', task: 'followup',
};
export function adaptReminder(raw: any): Reminder {
  raw = raw || {};
  const t = String(raw.type || '').toLowerCase();
  const done = /done|complete|sent|dismiss|cancel/.test(String(raw.status || ''));
  return {
    id: String(raw._id || raw.id),
    type: REMINDER_TYPE[t] || 'followup',
    title: raw.title || raw.message || 'Reminder',
    subtitle: raw.message || raw.description || '',
    clientName: raw.client_name || raw.clientName || undefined,
    phone: raw.phone || undefined,
    date: raw.scheduled_for || raw.date || raw.remind_at || raw.createdAt || '',
    done,
  };
}

/* ------------------------------------------------------------ Notifications */
const NOTIF_KIND: Record<string, AppNotification['kind']> = {
  claim: 'claim', lead: 'lead', renewal: 'renewal', reminder: 'system', event: 'system',
  contest: 'contest', system: 'system',
};
const NOTIF_ICON: Record<AppNotification['kind'], string> = {
  claim: 'shield-half', lead: 'person-add', renewal: 'refresh-circle', contest: 'trophy', system: 'notifications',
};
export function adaptNotification(raw: any): AppNotification {
  raw = raw || {};
  const t = String(raw.type || 'system').toLowerCase();
  const kind = NOTIF_KIND[t] || 'system';
  return {
    id: String(raw._id || raw.id),
    icon: NOTIF_ICON[kind] || 'notifications',
    title: raw.title || raw.message || 'Notification',
    body: raw.body || raw.message || raw.description || '',
    at: raw.at || raw.createdAt || raw.created_at || '',
    read: !!(raw.read ?? raw.is_read),
    kind,
  };
}
