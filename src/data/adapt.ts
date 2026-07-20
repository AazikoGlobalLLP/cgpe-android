/**
 * Adapters that map RAW backend documents (mixed lic-import + app schema) into the
 * app's typed shapes. Mirrors backend services/greetingEngine.js normalizeClient so
 * real client data renders correctly. Also holds the fupDate premium-due rule.
 */
import type { Claim, Client, Lead, Policy, User } from './types';

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
    number: policyNo || '—',
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
    since: commencement ? String(commencement.getFullYear()) : '—',
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

/** Best-effort lead adapter (real leads route may already match app shape). */
export function adaptLead(raw: any): Lead {
  raw = raw || {};
  return {
    id: String(raw._id || raw.id),
    name: titleCase(raw.name || raw.clientName || raw.fullName) || 'Lead',
    phone: raw.phone || raw.mobile || '',
    stage: raw.stage || 'new',
    source: raw.source || 'Manual',
    interest: raw.interest || raw.product || raw.notes || '',
    potential: num(raw.potential || raw.premium_potential || raw.value),
    city: raw.city || '',
    priority: raw.priority || 'warm',
    nextAction: raw.next_action || raw.nextAction,
    nextActionDate: raw.next_action_date || raw.nextActionDate,
    createdAt: raw.createdAt || new Date().toISOString(),
    lastActivity: raw.updatedAt || raw.lastActivity || raw.createdAt || new Date().toISOString(),
    notes: Array.isArray(raw.notes) ? raw.notes.map((n: any, i: number) => ({ id: String(n._id || i), text: n.text || String(n), at: n.at || n.createdAt || '' })) : [],
  };
}
