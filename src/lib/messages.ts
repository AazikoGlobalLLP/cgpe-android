/**
 * Client-side WhatsApp message templates — ported from the backend
 * services/greetingEngine.js so a single "Send reminder" tap produces the exact
 * same wording the server sends in bulk. Used for one-tap wa.me sends.
 */
import { inr } from './format';

function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][v % 10] || 'th');
  return `${n}${suffix}`;
}

function ageOn(dob?: string | Date): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function fmt(d?: string | Date): string {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  return x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Ctx = {
  name: string;
  premium?: number;
  sumAssured?: number;
  policyNo?: string;
  mode?: string;
  dueDate?: string | Date;
  dob?: string | Date;
  maturity?: string | Date;
  since?: number;
};

export function renewalMessage(c: Ctx): string {
  const prem = c.premium ? inr(c.premium) : '';
  const sum = c.sumAssured ? inr(c.sumAssured) : '';
  const due = fmt(c.dueDate);
  const modePart = c.mode ? `${c.mode.toLowerCase()} ` : '';
  let msg = `Dear ${c.name} 🙏, a friendly reminder from CGPE:`;
  if (prem) msg += ` the ${modePart}premium of ${prem} for your policy ${c.policyNo || ''}`.replace(/\s+$/, '');
  else msg += ` your policy ${c.policyNo || ''}`.replace(/\s+$/, '');
  msg += due ? ` is due on ${due}.` : ` is due for renewal soon.`;
  msg += sum ? ` Renewing on time keeps your ${sum} cover active.` : ` Renewing on time keeps your cover active.`;
  return msg + ` Reply here and we'll help you pay in a minute. — Team CGPE`;
}

export function birthdayMessage(c: Ctx): string {
  const age = ageOn(c.dob);
  const agePart = age != null ? ` a very Happy ${ordinal(age)} Birthday` : ' a very Happy Birthday';
  let msg = `Dear ${c.name}, 🎂🎉 Wishing you${agePart}! On your special day, everyone at CGPE wishes you great health, happiness and prosperity in the year ahead.`;
  if (c.since && new Date().getFullYear() - c.since >= 1) {
    const yrs = new Date().getFullYear() - c.since;
    msg += ` Thank you for trusting us with your family's financial security for ${yrs} wonderful year${yrs === 1 ? '' : 's'}.`;
  }
  return msg + ` Warm wishes — Team CGPE 🙏`;
}

export function maturityMessage(c: Ctx): string {
  const mat = fmt(c.maturity);
  const sum = c.sumAssured ? inr(c.sumAssured) : '';
  let msg = `Dear ${c.name} 🙏, great news! Your CGPE policy ${c.policyNo || ''}`.replace(/\s+$/, '');
  msg += mat ? ` is set to mature on ${mat}` : ` is approaching maturity`;
  if (sum) msg += `, with a maturity value linked to a sum assured of ${sum}`;
  msg += `. Let's plan your payout or re-investment so your money keeps working for you.`;
  return msg + ` Reply here to book a quick review. — Team CGPE 🎯`;
}

export function anniversaryMessage(c: Ctx): string {
  const yrs = c.since ? new Date().getFullYear() - c.since : 0;
  const sum = c.sumAssured ? inr(c.sumAssured) : '';
  let msg = `Dear ${c.name}, 🎊 Today marks ${yrs} year${yrs === 1 ? '' : 's'} since you secured your future with CGPE${c.policyNo ? ` (Policy ${c.policyNo})` : ''}.`;
  if (sum) msg += ` Your family stays protected with a sum assured of ${sum}.`;
  return msg + ` Thank you for your continued trust — here's to many more years together! — Team CGPE 🙏`;
}

export function greetingFor(kind: 'renewal' | 'birthday' | 'maturity' | 'anniversary' | string, c: Ctx): string {
  switch (kind) {
    case 'renewal': return renewalMessage(c);
    case 'birthday': return birthdayMessage(c);
    case 'maturity': return maturityMessage(c);
    case 'anniversary': return anniversaryMessage(c);
    default: return `Namaste ${c.name} 🙏, a quick note from Team CGPE. Reply anytime.`;
  }
}
