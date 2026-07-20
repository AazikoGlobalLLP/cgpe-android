/** Formatting helpers — India / LIC conventions (₹, lakh, DD Mon). */

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

export function fmtDate(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function fmtDay(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

export function fmtTime(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  let h = dt.getHours();
  const m = dt.getMinutes().toString().padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

/** "2h ago", "3d ago", "Just now" from an ISO string or Date. */
export function timeAgo(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - dt.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d ago`;
  return fmtDay(dt);
}

/** Days until a future date (negative if past). */
export function daysUntil(d: string | Date): number {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dt);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Deterministic pastel-ish color from a string (for avatars). */
export function colorFromString(s: string, palette: string[]): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}
