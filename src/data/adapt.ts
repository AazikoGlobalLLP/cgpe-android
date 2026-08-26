/**
 * Adapters that map RAW backend documents (mixed lic-import + app schema) into the
 * app's typed shapes. Mirrors backend services/greetingEngine.js normalizeClient so
 * real client data renders correctly. Also holds the fupDate premium-due rule.
 */
import type { AppNotification, Claim, Client, Contest, Lead, LeadStage, LicPlan, Policy, Reminder, User, WaMessage, WaThread } from './types';

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

/** Item 12: premium is due THIS month when fupDate's month falls in the current month.
 *  A MATURED policy has run its full term and cannot have a premium due — match the guard the
 *  Client-360 detail already applies (client/[id].tsx), so the renewals list (premium.tsx) and the
 *  Clients segment filter stop resurrecting a due prompt from a matured policy's stale follow-up
 *  month. */
export function isPremiumDueThisMonth(client: Client, ref = new Date()): boolean {
  const p0 = client.policies[0];
  if (!p0 || p0.status === 'matured') return false;
  return monthMatches(p0.nextRenewal, ref);
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

/**
 * LIC Plans — legacy provider-scoped view. `GET /api/lic-plans` returns `{ meta, plans }` where
 * each plan is the LEGACY LIC shape produced by the backend's `unifiedToLic`
 * (`services/productIngestion.js:142-157`): `product_id`, `plan_name`, `plan_table`,
 * `category_label`, `summary`, `riders[]` — none of which match the app's `LicPlan`. Map the
 * fields that correspond and no more.
 *
 * ENTRY-AGE AND TERM ARE DELIBERATELY EMPTY. The wire carries no plan-level entry-age band and no
 * plan-level term; the only `term` in the source is a single illustrative value inside
 * `worked_example.inputs`, which is one example, not the plan's range. Mining a plan-wide figure
 * from it would fabricate a number the data does not assert, so `minAge`/`maxAge`/`term` stay
 * empty and the screen drops those rows (Phase 6, D-2).
 */
/**
 * The backend's own placeholder for a missing LIC plan name (`productIngestion.js:121`). It
 * arrives as a normal string, so it has to be matched by value; treated as "no name at all".
 * Exported for the test that pins it — if the backend ever stops substituting, this simply
 * stops matching and the real name flows through untouched.
 */
export const LIC_PLACEHOLDER_NAME = 'unnamed plan';

function realPlanName(name: string): string {
  return name.toLowerCase() === LIC_PLACEHOLDER_NAME ? '' : name;
}

export function adaptLicPlan(raw: any): LicPlan {
  const r = raw || {};
  const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');
  // `plan_table` is the LIC plan/table number. The seed stores it as a string for every legacy
  // row and `unifiedToLic` passes it through as `m.plan_table || ''`, so a string is what the wire
  // carries; the numeric arm is defence only, because `s()` would silently drop a number and this
  // is the ONLY identifier those rows have.
  const code = s(r.plan_table) || (typeof r.plan_table === 'number' ? String(r.plan_table) : '');
  return {
    id: s(r.product_id) || s(r._id),
    /**
     * `plan_name` is NULL for 11 legacy rows in the backend's `data/lic_plans_library.json`
     * (tables 5, 102, 113, 122, 165, 172, 180, 181, 195, 836, 904 — all
     * `category_label: "Legacy / to be sourced (in your book)"`), which is why the owner sees a
     * wall of identical "Unnamed" entries an advisor cannot tell apart.
     *
     * ⚠️ THE APP NEVER SEES THAT NULL, AND A `|| fallback` HERE WOULD BE DEAD CODE. The backend
     * substitutes a literal placeholder on the way in — `productIngestion.js:121`
     * `product_name: String(d.plan_name || 'Unnamed plan')` — and hands it back out at `:146`
     * `plan_name: u.product_name`. So the wire value is the truthy STRING "Unnamed plan", which is
     * exactly why the screen's own `|| 'Unnamed plan'` never had anything to do. Verified against
     * deployed `origin/main` (990c660), not just the local checkout.
     *
     * So the sentinel has to be recognised for what it is. The table number is known for all 11,
     * and "LIC Plan 102" is how agents name these in the field, so the label comes from real data.
     * Nothing is invented — no marketing name is guessed — and a row with neither a real name nor
     * a number still falls through to the screen's own "Unnamed plan". The proper fix is the owner
     * supplying the 11 names for the seed file; this stops the rows being indistinguishable today.
     */
    name: realPlanName(s(r.plan_name)) || (code ? `LIC Plan ${code}` : ''),
    code,
    type: s(r.category_label) || s(r.category),
    minAge: 0,
    maxAge: 0,
    term: '',
    highlight: s(r.summary) || s(r.benefit_note),
    tags: Array.isArray(r.riders)
      ? r.riders.filter((t: any): t is string => typeof t === 'string' && !!t.trim()).map((t: string) => t.trim())
      : [],
  };
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

  // A policy whose maturity date is already in the PAST has run its full term — it is matured, not
  // in force. The lic-import doc carries no reliable status field (this used to be hardcoded
  // 'in_force' for every policy, so a policy that matured years ago still read "In force"). Derive
  // the one status we CAN know for certain: past maturity ⇒ 'matured' (an existing contract status
  // with its own label, types.ts). lapsed/paid_up need data the doc doesn't carry, so anything not
  // yet matured stays 'in_force' exactly as before.
  const matDays = daysUntil(maturity);
  const status: Policy['status'] = matDays != null && matDays < 0 ? 'matured' : 'in_force';

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
    status,
  };

  const segment: Client['segment'] = [];
  // A matured policy is never "renewal due" — its follow-up month is stale (same guard as the
  // Client-360 detail and isPremiumDueThisMonth above).
  if (status !== 'matured' && monthMatches(fupDate)) segment.push('renewal_due');
  if (monthMatches(dob)) segment.push('birthday');
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
  // Department + the pre-merge original role ride in the login `user` object already
  // (`toPublicJSON()` returns the whole staff_unified row). Carry them so the app can key
  // department logic + drift detection off them (see `identityOf` in store/roles.ts). Emit each
  // key ONLY when non-empty — an absent department must not become a present-but-empty string,
  // and the empty-string rows ('' for the IT/admins masters) read the same as truly absent.
  const dept = typeof raw.department === 'string' ? raw.department.trim() : '';
  const orig = typeof raw._origRole === 'string' ? raw._origRole.trim() : '';
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
    ...(dept ? { department: dept } : {}),
    ...(orig ? { origRole: orig } : {}),
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
/**
 * `Lead.status`, verbatim — `contracts/enums.md:212`. The app's own vocabulary since Phase 4.
 *
 * A `Record<LeadStage, true>` rather than an array, so it is the compiler that keeps this table
 * and the union in step: add a sixth value to `LeadStage` and this object stops compiling.
 */
const LEAD_STATUS: Record<LeadStage, true> = {
  new_lead: true, meeting_scheduled: true, docs_shared: true, policy_issued: true, lost: true,
};

/**
 * The only values that are NOT `Lead.status` and still reach a real document.
 *
 * `contracts/models.md:2138` (drift #5) records that the raw `leads` collection carries a
 * `stage` key which non-Mongoose readers use, and `enums.md:586` gives that key's vocabulary:
 * `new | contacted | meeting_scheduled | docs_shared`. Two of those four are already enforced
 * values; the other two are here.
 *
 * `contacted` resolves DOWN to `new_lead` deliberately: the enforced enum has no counterpart,
 * and inventing `meeting_scheduled` would claim a meeting nobody recorded. Nothing here may
 * resolve UP into `policy_issued` — a guess that a sale closed removes a lead from the open
 * pipeline and adds it to a money figure, which is the one direction this app must not guess in.
 * (An earlier draft mapped `converted` that way. `converted` is not a value of any lead
 * vocabulary — it appears only as the `!converted` query sentinel at `routes/leads.js:109-111`,
 * which `enums.md:218` notes can never match a document — so the alias fabricated a won sale
 * out of a token that does not occur.)
 *
 * A `Map`, not an object literal: a lookup by an arbitrary server string must not be able to
 * reach `Object.prototype`. `{}['constructor']` is truthy, and a stage of `Object` crashes every
 * `STAGE_META[stage].label` in the app.
 */
const LEAD_STATUS_ALIAS = new Map<string, LeadStage>([
  ['new', 'new_lead'],
  ['contacted', 'new_lead'],
]);

/**
 * PHASE 4. Exact match first, then the short alias table — never a substring test.
 *
 * The old ladder was five unanchored regexes, and two of its arms read real values backwards:
 * `not_converted` contains `convert` and came back WON, `unqualified` contains `qualif` and came
 * back contacted. It also knew none of the server's actual words, so `policy_issued` and
 * `docs_shared` fell through to `new` — a closed sale was indistinguishable from a fresh lead
 * on every screen that renders a stage.
 *
 * Anything unrecognised resolves to `new_lead`, which is the schema's own default
 * (`models/Lead.js:32`) rather than a fallback this app invented.
 */
function mapLeadStage(s: any): LeadStage {
  const x = String(s ?? '').trim().toLowerCase();
  // hasOwnProperty, not `in` and not a bare index: both of those walk the prototype chain.
  if (Object.prototype.hasOwnProperty.call(LEAD_STATUS, x)) return x as LeadStage;
  return LEAD_STATUS_ALIAS.get(x) ?? 'new_lead';
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
    // PHASE 4: `status` first. It used to be `stage || status`, which is also what the backend's
    // own `reports.js:121` does — but `status` is the ONLY one of the two any endpoint will
    // write (`api.md:369-370`), so a document carrying both would show a stale `stage` forever
    // and every save would read as unconfirmed.
    stage: mapLeadStage(raw.status || raw.stage),
    source: raw.source || 'Manual',
    // `insurance_need` is the schema's field for what the lead wants (`models/Lead.js:25-28`)
    // and was the one source this never read, so the Interest column was blank for real leads.
    interest: raw.insurance_need || raw.interest || raw.product || (typeof notesRaw === 'string' ? notesRaw.slice(0, 90) : '') || '',
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
  // PHASE 9: 'acknowledg' is how the backend records a reminder finished (`status:'acknowledged'`,
  // set by POST /reminders/:id/acknowledge) — the state `toggleReminder` now writes. Kept
  // case-sensitive like the rest of this line: the wire value is lowercase.
  const done = /done|complete|sent|dismiss|cancel|acknowledg/.test(String(raw.status || ''));
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

/* ------------------------------------------------------------ Contests
 * Backend `GET /api/contests` (routes/contests.js) returns raw Contest documents
 * (models/Contest.js) inside the standard `{success,data}` envelope, each ANNOTATED per caller
 * with `user_progress` (this user's current_progress), `is_participating`, and a top-5
 * `leaderboard` (each entry carries `user_id` + `rank`). NONE of those field names match the
 * app's `Contest` shape — the doc has `title`/`reward_description`/`target_goal`/`target_unit`/
 * `end_date`, the app wants `name`/`reward`/`metric`/`ends` — so before this adapter existed the
 * screen read `Contest[]` straight off the wire and mapped EVERY field to `undefined`: blank
 * name, no reward, a 0% meter, no metric label, no countdown, no rank. Any real contest rendered
 * as an empty card (owner backlog Point 7).
 *
 * `progress` is the user's OWN progress toward the goal (`user_progress / target_goal`), clamped
 * 0..1; a 0 or missing target yields 0 rather than a NaN/Infinity meter. `rank` is populated ONLY
 * when this user actually appears in the (top-5) leaderboard — it is never inferred from a
 * progress tie — so an absent rank is honest silence, not a fabricated "#0".
 */
export function adaptContest(raw: any, userId?: string | null): Contest {
  raw = raw || {};
  const target = num(raw.target_goal);
  const progressUnits = num(raw.user_progress);
  const progress = target > 0 ? Math.min(1, Math.max(0, progressUnits / target)) : 0;

  const unit = String(raw.target_unit || 'points').trim() || 'points';
  const metric = target > 0 ? `${progressUnits} of ${target} ${unit}` : unit;

  let rank: number | undefined;
  if (userId != null && Array.isArray(raw.leaderboard)) {
    const mine = raw.leaderboard.find((p: any) => p && String(p.user_id) === String(userId));
    const r = mine ? Number(mine.rank) : NaN;
    if (Number.isFinite(r) && r > 0) rank = r;
  }

  const out: Contest = {
    id: String(raw._id || raw.id || ''),
    name: String(raw.title || raw.name || 'Contest').trim(),
    reward: String(raw.reward_description || raw.reward || '').trim(),
    progress,
    metric,
    ends: iso(parseDate(raw.end_date || raw.ends)),
  };
  if (rank != null) out.rank = rank;
  return out;
}

/* ------------------------------------------------------------------ *
 * Attendance history normaliser (A3).
 *
 * The attendance screen consumes ONE shape — the "attendance record" that
 * `/api/attendance/history` returns: `{ date, clock_in: { time }, clock_out?: { time } }`.
 * But `getAttendanceHistory` reads `/api/time-tracker/history` FIRST, and that endpoint
 * returns raw DayLog documents — `{ date, sessions: [{ clockIn, clockOut, clockInLoc }] }`,
 * where the clock times live INSIDE `sessions`, not at the top level. Read with the
 * record-shape mapping, every DayLog row saw `clock_in === undefined`, so the whole history
 * rendered as "No clock-in recorded" and Days-logged / Closed-days both read 0 — the
 * present/absent bug the owner reported.
 *
 * This flattens EITHER shape to the canonical record: a DayLog with N sessions becomes N
 * records (one per clock-in, exactly as the backend's own `dayLogToAttendanceRecords` does),
 * and an already-canonical row passes straight through (tolerating both `clock_in.time` and a
 * flat `clockIn`). Nothing is invented — a missing time stays missing, and a day whose
 * sessions never had a clock-in produces no record (matching `/attendance/history`).
 * ------------------------------------------------------------------ */
export type AttendanceRecord = {
  date: string;
  clock_in?: { time: string };
  clock_out?: { time: string };
};

export function adaptAttendanceHistory(raw: any): AttendanceRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: AttendanceRecord[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const date: string = String(row.date || row.day || '');

    // DayLog document (`/time-tracker/history`) → one record per session.
    if (Array.isArray(row.sessions)) {
      for (const s of row.sessions) {
        if (!s || !s.clockIn) continue;
        const rec: AttendanceRecord = { date, clock_in: { time: String(s.clockIn) } };
        if (s.clockOut) rec.clock_out = { time: String(s.clockOut) };
        out.push(rec);
      }
      continue;
    }

    // Already the canonical attendance-record shape (`/attendance/history`) or a legacy flat
    // row — pass through, tolerating `{ clock_in: { time } }` and `{ clockIn }` alike.
    const inTime = row.clock_in?.time ?? row.clockIn;
    const outTime = row.clock_out?.time ?? row.clockOut;
    const rec: AttendanceRecord = { date };
    if (inTime) rec.clock_in = { time: String(inTime) };
    if (outTime) rec.clock_out = { time: String(outTime) };
    out.push(rec);
  }
  return out;
}
