/**
 * POINT 13 — the payroll roster over the WHOLE team, not just profile-holders.
 *
 * The payroll screen used to render exactly the rows `GET /api/payroll/compute` returns, and that
 * endpoint iterates ONLY `PayrollProfile` documents (`routes/payroll.js` `buildRoster`): a staff
 * member with no payroll profile never enters the roster. So the owner opened Payroll and saw only
 * the one member who has a profile (Pavitra) — everyone else looked *dropped*, when in truth their
 * salary was simply never entered. Creating the missing profiles is a data job (owner/OPS); this
 * module is the CLIENT half — it makes the gap VISIBLE instead of silent by left-joining the full
 * staff directory (`getAssignableTeam` → `/profiles`) with the computed roster, so every member
 * appears and anyone without a computed row is marked "data pending" rather than being absent.
 *
 * PURE + tested here (the network layer `api.ts` has no test seam), mirroring `roster.ts`. Join key
 * is the directory member's id (payroll `user_id` and `/profiles` `user_id` share the `user_...`
 * space — unlike the live-locations `_id` case), with a normalized-name fallback so a row is still
 * recovered if the id spaces ever drift; a payroll row that matches NO directory member is kept as
 * its own entry, because it carries real pay and must never be dropped.
 *
 * NO NEW PII. This slice adds only names/roles the directory already surfaces elsewhere; bank /
 * Aadhaar / PAN stay off the phone (payroll.tsx "NO PII ON THE PHONE") pending the owner's decision.
 */
import type { PayrollRow } from './api';
import type { TeamMember } from './team';

export type PayrollRosterEntry = {
  user_id: string;
  name: string;
  role: string;
  branch: string;
  /** The server-computed payroll row, or null when this member has no payroll profile. */
  row: PayrollRow | null;
  /** true = no computed payroll row exists for this member → render a "data pending" warning. */
  pending: boolean;
};

const norm = (s: unknown): string => String(s ?? '').trim().toLowerCase();
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Order: members WITH pay first, then profiled-but-unpaid (₹0 / no attendance yet), then data-pending
 * members — each group by name — so the meaningful payroll sits on top and the gaps read as a distinct
 * block below. Array.sort is stable in Hermes/V8, so equal ranks keep their name ordering.
 */
function rank(e: PayrollRosterEntry): number {
  if (e.row && num(e.row.payable) > 0) return 0;
  if (e.row) return 1;
  return 2;
}

/** Left-join the full staff directory with the computed payroll roster (see file header). */
export function mergePayrollRoster(directory: TeamMember[], roster: PayrollRow[]): PayrollRosterEntry[] {
  // The set of directory ids + how many members share each normalized name — both needed to keep the
  // name fallback from misattributing pay (loophole audit 2026-08-25, see below).
  const dirIds = new Set<string>();
  const dirNameCount = new Map<string, number>();
  for (const mem of directory) {
    dirIds.add(norm(mem.id));
    const nm = norm(mem.name);
    dirNameCount.set(nm, (dirNameCount.get(nm) ?? 0) + 1);
  }

  const byId = new Map<string, PayrollRow>();
  const byName = new Map<string, PayrollRow | null>();
  for (const r of roster) {
    const id = norm(r.user_id);
    if (id && !byId.has(id)) byId.set(id, r);      // first wins — a duplicate keeps the earlier row
    // The name fallback exists ONLY to recover a row whose id lines up with NO directory member (an
    // id-space drift). A row already OWNED by a directory id must never also be reachable by name — or
    // a profile-less namesake would show that member's pay and the total would double-count. And a
    // name that appears on more than one row is AMBIGUOUS (null) so it is never guessed. (Loophole
    // audit 2026-08-25: the old map indexed every row by name and had no already-claimed guard.)
    const nm = norm(r.name);
    if (nm && id && !dirIds.has(id)) byName.set(nm, byName.has(nm) ? null : r);
  }

  const used = new Set<PayrollRow>();
  const entries: PayrollRosterEntry[] = directory.map((mem) => {
    // Honour a name match only when the DIRECTORY name is unique too — two members sharing a name can't
    // both claim one drifted row. `byId` (id-owned) always wins; the name map holds only drifted rows.
    const nameHit = dirNameCount.get(norm(mem.name)) === 1 ? byName.get(norm(mem.name)) : null;
    const row = byId.get(norm(mem.id)) ?? nameHit ?? null;
    if (row) used.add(row);
    return { user_id: mem.id, name: mem.name, role: mem.role, branch: mem.branch, row, pending: !row };
  });

  // Payroll rows that matched no directory member (an orphan profile, a `staff_found:false` row, or a
  // profile whose staff account isn't in `/profiles`) still carry real pay — keep them, never drop.
  for (const r of roster) {
    if (used.has(r)) continue;
    entries.push({
      user_id: String(r.user_id),
      name: r.name || String(r.user_id) || 'Member',
      role: '',
      branch: '',
      row: r,
      pending: false,
    });
  }

  return entries.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/**
 * Roster figures for the header: total staff shown, how many have pay, how many are data-pending, and
 * the sum of the server's own payables — an aggregate of computed figures, never a rate the app derived
 * (CLAUDE.md money rule). Kept pure + tested so the count/total logic can't drift from the merge.
 */
/**
 * Mask a bank account number to its last 4 digits for the master's payroll-detail view (Point 13,
 * owner decision 2026-08-25: bank details to master only, account masked with tap-to-reveal). Every
 * hidden character becomes '•'; the last 4 stay visible. A value of 4 or fewer characters is returned
 * as-is (nothing meaningful to hide). Pure, so the mask is unit-tested and can't silently regress into
 * showing the whole number. The reveal action shows the raw `account_no` — this only shapes the
 * default, masked display.
 */
export function maskAccountNumber(account: string): string {
  const s = String(account ?? '').trim();
  if (s.length <= 4) return s;
  return '•'.repeat(s.length - 4) + s.slice(-4);
}

export function payrollRosterStats(entries: PayrollRosterEntry[]): { members: number; withPay: number; pending: number; totalPayable: number } {
  let withPay = 0;
  let pending = 0;
  let totalPayable = 0;
  for (const e of entries) {
    if (e.pending) pending++;
    if (e.row) {
      const p = num(e.row.payable);
      if (p > 0) withPay++;
      totalPayable += p;
    }
  }
  return { members: entries.length, withPay, pending, totalPayable };
}
