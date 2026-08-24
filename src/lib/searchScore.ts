/**
 * The pure search scorer — extracted from `src/app/search.tsx` (Band 2 #2, 2026-08-24).
 *
 * The global Search screen scored records by hand with these functions inlined; the Tasks tab
 * now needs the SAME typo-/word-order-/phone-tail-tolerant matching over its already-loaded
 * list. Rather than copy the logic (and let the two drift), the scorer lives here as pure
 * functions so it is unit-tested once and reused everywhere.
 *
 * WHAT LIVES HERE vs WHAT DOES NOT. This file knows nothing about clients, tasks or tickets:
 * it scores a query against a bag of weighted `Field`s. The per-domain field lists
 * (`clientFields`, `taskSearchFields`, …) stay with their owners — a client field list belongs
 * next to `Client`, a task field list next to `Task` — so this stays a leaf that imports only
 * the edit-distance seam and is safe to reach from the Vitest graph without a native stub.
 *
 * The tiers are, in the order a person means them: an exact hit, then something that STARTS
 * with what was typed, then something that merely CONTAINS it, then a typo-tolerant near-miss.
 */

import { tokenFuzzyHit, FUZZY_MIN } from '@/lib/fuzzyMatch';

/* ---------- tiers ---------- */

export const T_EXACT = 3;
export const T_PREFIX = 2;
export const T_CONTAINS = 1;
/**
 * Typo tolerance, a fractional tier BELOW "contains". A mistyped or transposed character
 * ("rajseh"→"Rajesh") still reaches the record, but the resulting score (5 + weight) always
 * ranks under a genuine substring hit (10 + weight), so a real match is never buried by a
 * lucky near-miss. Edit-distance logic lives, and is tested, in `@/lib/fuzzyMatch`.
 */
export const T_FUZZY = 0.5;

/** Field weights. Ties inside a tier break towards the identifying fields. */
export const W_ID = 3;
export const W_SECOND = 2;
export const W_TEXT = 1;

/**
 * Shortest digit run that may match a phone number by its TAIL. Agents remember the last
 * four digits of a mobile and almost never the first four, so a suffix hit is scored as
 * strongly as a prefix one. Below four digits a suffix match is noise: "12" would pull back
 * a third of the book.
 */
export const MIN_SUFFIX_DIGITS = 4;

/** Kept for a row the SERVER matched but the local scorer could not explain. */
export const SERVER_ONLY_SCORE = 1;

/** Rows kept per group. A search that returns 200 clients has not answered the question. */
export const GROUP_CAP = 20;

export type Q = {
  lower: string;
  /** Lowercase, punctuation and spacing removed, so "CLM-2024/8891" answers "clm20248891". */
  compact: string;
  digits: string;
  tokens: string[];
  /** True when the query is nothing but digits: a phone, policy or reference lookup. */
  numeric: boolean;
};

export const compactOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
export const digitsOf = (s: string) => s.replace(/\D+/g, '');

export function buildQuery(raw: string): Q {
  const lower = raw.trim().toLowerCase();
  const compact = compactOf(lower);
  const digits = digitsOf(lower);
  return {
    lower,
    compact,
    digits,
    // Split on whitespace rather than on a Latin character class: names and dictated notes
    // in this book are frequently Gujarati, and a-z tokenising would erase them entirely.
    tokens: lower.split(/\s+/).filter(Boolean),
    numeric: compact.length > 0 && compact === digits,
  };
}

/**
 * Last-resort typo match. Every query token must find a home in the value: a short token
 * (below the fuzzy minimum) must appear as a substring — it is never fuzzed, because a
 * two-letter edit budget is meaningless — while a longer token may sit within its edit
 * budget of any word. So "rajseh ptael" reaches "Rajesh Patel", but "in" still has to be
 * really present. Splitting on whitespace (not a Latin class) keeps Gujarati words intact.
 */
export function fuzzyMatches(q: Q, valueLower: string): boolean {
  if (q.tokens.length === 0) return false;
  const words = valueLower.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return q.tokens.every((tk) =>
    tk.length < FUZZY_MIN ? words.some((w) => w.includes(tk)) : tokenFuzzyHit(tk, words),
  );
}

/** 3 exact, 2 prefix, 1 contains, 0.5 fuzzy (typo), 0 miss. */
export function tierFor(q: Q, value: string): number {
  const lower = value.trim().toLowerCase();
  if (!lower) return 0;

  // Numeric queries take the digit path first, so "+91 98765 43210", "9876543210" and
  // "43210" all reach the same record.
  if (q.numeric && q.digits) {
    const fd = digitsOf(lower);
    if (fd) {
      if (fd === q.digits) return T_EXACT;
      if (q.digits.length >= MIN_SUFFIX_DIGITS && fd.endsWith(q.digits)) return T_PREFIX;
      if (fd.startsWith(q.digits)) return T_PREFIX;
      if (fd.includes(q.digits)) return T_CONTAINS;
    }
    // Deliberately falls through: "2024" is also a substring of a reference like CLM-2024-8891.
  }

  if (lower === q.lower) return T_EXACT;
  const compact = compactOf(lower);
  if (q.compact && compact === q.compact) return T_EXACT;

  if (lower.startsWith(q.lower)) return T_PREFIX;
  if (q.compact && compact.startsWith(q.compact)) return T_PREFIX;
  // A word start anywhere in the value counts as a prefix: "anand" should reach
  // "Jeevan Anand" as strongly as it reaches "Anand Patel".
  if (lower.split(/\s+/).some((w) => w.startsWith(q.lower))) return T_PREFIX;

  if (lower.includes(q.lower)) return T_CONTAINS;
  if (q.compact && compact.includes(q.compact)) return T_CONTAINS;
  // Out-of-order multi word: "patel rajesh" finds "Rajesh Patel".
  if (q.tokens.length > 1 && q.tokens.every((t) => lower.includes(t))) return T_CONTAINS;

  // Typo tolerance, last of all. Skipped for numeric queries: a wrong digit must never pull
  // back a DIFFERENT person's phone or policy number — a near-miss there is a wrong answer,
  // not a helpful one. The digit path above already owns numeric lookups.
  if (!q.numeric && fuzzyMatches(q, lower)) return T_FUZZY;

  return 0;
}

export type Field = { key: string; value: string; weight: number };
export type Hit = { score: number; field: Field };

/** The strongest field hit on one record, or null when nothing matched. */
export function bestHit(q: Q, fields: Field[]): Hit | null {
  let best: Hit | null = null;
  for (const f of fields) {
    if (!f.value) continue;
    const tier = tierFor(q, f.value);
    if (tier === 0) continue;
    // Tier dominates the weight by an order of magnitude, so an exact hit on a weak field
    // still outranks a contains hit on a name. That is the ordering the brief asks for.
    const score = tier * 10 + f.weight;
    if (!best || score > best.score) best = { score, field: f };
  }
  return best;
}

/** True when the query matches any field of the record. Sugar over `bestHit` for callers that
 *  only need to filter (the Tasks-tab local search) rather than rank. */
export function matchesFields(q: Q, fields: Field[]): boolean {
  return bestHit(q, fields) !== null;
}

export type Ranked<T> = { item: T; hit: Hit | null; score: number };

/**
 * Score, filter and sort one collection.
 *
 * `keepServerMatched` is passed for the collections the BACKEND filtered (clients, tickets).
 * Those rows are matches by definition, even when the local scorer cannot say which field
 * did it, because the server searches columns this app never maps. Dropping them would make
 * the screen quietly less capable than the endpoint behind it, so they are kept and ranked
 * last instead.
 */
export function rank<T>(
  items: T[],
  q: Q,
  fieldsOf: (x: T) => Field[],
  keepServerMatched = false,
): Ranked<T>[] {
  const out: Ranked<T>[] = [];
  for (const item of items) {
    const hit = bestHit(q, fieldsOf(item));
    if (hit) out.push({ item, hit, score: hit.score });
    else if (keepServerMatched) out.push({ item, hit: null, score: SERVER_ONLY_SCORE });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, GROUP_CAP);
}
