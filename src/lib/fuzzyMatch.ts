/**
 * Typo tolerance for search — the pure seam (Phase D5).
 *
 * `src/app/search.tsx` scores records in tiers: an exact hit, a prefix, a substring. None of
 * those forgives a MISTYPED character — "rajseh" never reaches "Rajesh", "jeevn" never reaches
 * "Jeevan". This file adds the one missing tier, edit-distance matching, as pure functions so
 * the thresholds are unit-tested rather than tuned by eye against a live book. No app imports:
 * this is a leaf, safe to reach from anywhere (and from the Vitest graph without a stub).
 *
 * The metric is Optimal String Alignment (Levenshtein PLUS adjacent transposition), because the
 * commonest human typo is two neighbouring letters swapped, and plain Levenshtein charges that
 * as two edits. So "rajseh"→"rajesh" costs 1, not 2, and lands inside a one-edit budget.
 */

/** Below four letters a fuzzy match is noise — a third of the book sits within one edit. */
export const FUZZY_MIN = 4;
/** At this length or longer a token earns a two-edit budget instead of one. */
export const FUZZY_LONG = 7;

/**
 * How many edits a query token of this length may be off by before it stops matching.
 * `0` means "not eligible for fuzzy at all" (too short to be safe).
 */
export function fuzzyBudget(len: number): number {
  if (len < FUZZY_MIN) return 0;
  return len >= FUZZY_LONG ? 2 : 1;
}

/**
 * Is the OSA edit distance between `a` and `b` at most `max`?
 *
 * Bounded and early-exiting: as soon as an entire row of the matrix exceeds `max`, no completion
 * can come back under it, so we bail with `false`. The search screen runs this per keystroke over
 * hundreds of rows, so the full O(n·m) fill is never paid on a value that cannot possibly match.
 * A length gap wider than `max` is an immediate miss.
 */
export function osaWithin(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (max <= 0) return false;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return false;
  if (la === 0) return lb <= max;
  if (lb === 0) return la <= max;

  // Two rolling rows plus the row before them (transpositions look back two rows).
  let prev2: number[] = [];
  let prev: number[] = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    const curr: number[] = new Array(lb + 1);
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,          // deletion
        prev[j - 1] + cost,   // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1); // adjacent transposition
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    // Nothing in this row is within budget → no full alignment can be either.
    if (rowMin > max) return false;
    prev2 = prev;
    prev = curr;
  }
  return prev[lb] <= max;
}

/**
 * Does any word in `words` sit within `token`'s edit budget?
 *
 * `token` must earn a budget (≥ `FUZZY_MIN`), and only words that are themselves ≥ `FUZZY_MIN`
 * are considered — matching a long typed token against a two-letter word is meaningless.
 */
export function tokenFuzzyHit(token: string, words: string[]): boolean {
  const budget = fuzzyBudget(token.length);
  if (budget === 0) return false;
  for (const w of words) {
    if (w.length >= FUZZY_MIN && osaWithin(token, w, budget)) return true;
  }
  return false;
}
