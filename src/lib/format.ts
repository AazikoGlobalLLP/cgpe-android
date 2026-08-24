/** Formatting helpers — India / LIC conventions (₹, lakh, DD Mon). */

/**
 * NON-BREAKING SPACE. Every space this module emits INSIDE a single value is this character,
 * never U+0020.
 *
 * WHY IT MATTERS HERE. React Native breaks a line at ordinary spaces, so "Rs 37.2L" rendered
 * in any constrained container could wrap between the currency and the figure, leaving an
 * orphaned "Rs" on one line and "37.2L" on the next. That reads as two separate values. The
 * layout fix (numbers never shrink, see ui/data.tsx) handles the container side; this handles
 * the STRING side, so a value is unbreakable no matter which component renders it or what a
 * future caller does with it.
 *
 * Dates use it too: "28 Jul 2026" splitting after "28" is the same defect in a different
 * field. `nbsp()` is exported so screens composing their own labels get the same guarantee.
 */
const NB = ' ';

/** Replace every ordinary space in a value with a non-breaking one. */
export function nbsp(s: string): string {
  return String(s).replace(/ /g, NB);
}

/** ₹ with Indian digit grouping, no decimals. e.g. 125000 -> "₹1,25,000" */
export function inr(n: number): string {
  if (n == null || isNaN(n)) return '₹0';
  const s = Math.round(Math.abs(n)).toString();
  let last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return (n < 0 ? '-₹' : '₹') + grouped;
}

/** Compact ₹ in lakh/crore the way LIC agents read money. e.g. 1250000 -> "₹12.5L" */
export function inrShort(n: number): string {
  if (n == null || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

function trim(x: number): string {
  return x.toFixed(x % 1 === 0 ? 0 : x >= 10 ? 1 : 2).replace(/\.0+$/, '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * What every date helper renders when it is handed something it cannot parse.
 *
 * Deliberately a REGULAR HYPHEN, not an em dash. These helpers are called from nearly every
 * screen, so the em dash they used to return was the app's single largest source of banned
 * characters in user-visible copy, and no per-screen fix could have caught it.
 */
const NO_DATE = '-';

/**
 * Coerce anything the backend might hand us into a valid Date, or null.
 *
 * THIS GUARD IS THE POINT. Real documents in this book carry `null`, `''`, `0`, and
 * half-typed strings in date fields, because much of the data was bulk-imported from LIC
 * spreadsheets. `new Date(undefined)` yields an Invalid Date whose getHours() is NaN, which
 * is how `fmtTime` used to render the literal string "12:NaN AM" on screen. Every helper
 * below now goes through here first.
 */
function toDate(d: string | Date | null | undefined): Date | null {
  if (d == null || d === '') return null;
  const dt = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return null;
  return dt;
}

export function fmtDate(d: string | Date | null | undefined): string {
  const dt = toDate(d);
  if (!dt) return NO_DATE;
  return `${dt.getDate()}${NB}${MONTHS[dt.getMonth()]}${NB}${dt.getFullYear()}`;
}

export function fmtDay(d: string | Date | null | undefined): string {
  const dt = toDate(d);
  if (!dt) return NO_DATE;
  return `${dt.getDate()}${NB}${MONTHS[dt.getMonth()]}`;
}

export function fmtTime(d: string | Date | null | undefined): string {
  const dt = toDate(d);
  if (!dt) return NO_DATE;   // previously rendered "12:NaN AM"
  let h = dt.getHours();
  const m = dt.getMinutes().toString().padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m}${NB}${ap}`;
}

/** "2h ago", "3d ago", "Just now" from an ISO string or Date. */
export function timeAgo(d: string | Date | null | undefined): string {
  const dt = toDate(d);
  if (!dt) return NO_DATE;   // previously rendered "NaNm ago"
  const diff = Date.now() - dt.getTime();
  const s = Math.floor(diff / 1000);
  // A clock-skewed device, or a record stamped in the future, must not read "-4m ago".
  if (s < 0) return `Just${NB}now`;
  if (s < 60) return `Just${NB}now`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${NB}ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${NB}ago`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d${NB}ago`;
  return fmtDay(dt);
}

/**
 * Days until a future date, negative if past. Returns NaN for an unparseable input so the
 * caller can branch; every call site already treats a non-finite result as "unknown".
 */
export function daysUntil(d: string | Date | null | undefined): number {
  const dt = toDate(d);
  if (!dt) return NaN;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dt);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/**
 * Avatar initials.
 *
 * The whitespace guard matters: `initials('   ')` used to return the literal string
 * "UNDEFINED" (because `'   '` is truthy, `'   '.trim().split(/\s+/)` is `['']`, and
 * `undefined + ''` stringifies). Imported client records genuinely contain whitespace-only
 * names, so this was reachable, not theoretical.
 */
export function initials(name: string | null | undefined): string {
  const clean = (name ?? '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  const out = (first + second).toUpperCase();
  return out || '?';
}

/** Deterministic pastel-ish color from a string (for avatars). */
export function colorFromString(s: string, palette: string[]): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}
