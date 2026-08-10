/**
 * Data health — the honesty channel.
 *
 * WHAT THIS REPLACES. The app used to ship a `demo()` helper: when a request failed, the
 * caller returned sample records instead. Screens were therefore never empty, which was the
 * stated goal, but the cost was severe — a field agent could be looking at invented client
 * names and invented premium amounts with no visual difference from live data. For an
 * insurance book that is not a cosmetic problem; an agent could quote a fabricated figure to
 * a real customer. Sample data is now gone from every runtime path.
 *
 * WHAT REPLACES IT. A failed fetch resolves to a genuinely EMPTY value (`[]`, `undefined`,
 * or a zeroed shell) and records the failure here. Screens subscribe through `useDataHealth`
 * and raise a Banner explaining that the server could not be reached, with a Retry. The user
 * therefore sees one of exactly two truthful states: real data, or "we could not load this."
 * Never a third state that looks like data but is not.
 *
 * WHY A ZEROED SHELL AND NOT `null`. Roughly a dozen API functions are typed to return a
 * concrete object (`Promise<Commission>`, not `Promise<Commission | null>`). Widening all of
 * them would ripple through 33 screens for no user-visible gain, and a half-migrated union
 * type is how null-dereference crashes get shipped. A zeroed shell keeps the types honest at
 * the boundary while the banner carries the actual message. The rule that matters is upheld
 * either way: every field is 0 or empty, so nothing fabricated ever reaches the screen.
 */

export type HealthState = {
  /**
   * True while at least one endpoint is known-failed. PHASE 3 made this DERIVED — it is
   * always exactly `failures.length > 0` and is never assigned on its own. It used to be set
   * and cleared independently of the list, which is how the banner ended up rendering a count
   * of zero failures and how two identical refreshes could disagree about whether the app was
   * degraded (whichever of report-success / report-failure happened to land last won).
   */
  degraded: boolean;
  /** Endpoints currently known-failed. An endpoint leaves this list when IT succeeds. */
  failures: string[];
  /**
   * ms timestamp of the most recent reported failure. Stamped by EVERY `reportFailure`,
   * including a repeat of an endpoint already in the list, and never moved by a success.
   *
   * That precision is load-bearing, not incidental: `src/app/search.tsx:489` snapshots this
   * value before its fan-out and compares it at `:508` to decide whether THIS search lost a
   * collection, rather than whether the app has failed at any point since launch. If a repeat
   * failure stopped stamping it, a second identical failure would be invisible to that check
   * and a genuine outage would render as "nothing matched".
   */
  at: number | null;
};

type Listener = (s: HealthState) => void;

const listeners = new Set<Listener>();

let state: HealthState = { degraded: false, failures: [], at: null };

function emit() {
  const snapshot = state;
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // A throwing screen must not stop the others from learning about the outage.
    }
  });
}

export function subscribeHealth(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getHealth(): HealthState {
  return state;
}

/**
 * Record that an endpoint could not be served. Called from the API layer only.
 * Failures are de-duplicated so a dashboard fanning out six calls does not list one
 * endpoint six times.
 */
export function reportFailure(endpoint: string): void {
  const failures = state.failures.includes(endpoint)
    ? state.failures
    : [...state.failures, endpoint].slice(-12);
  // `at` is re-stamped even when the endpoint is already listed. See the field's doc comment:
  // `search.tsx` reads this clock to scope an outage to one query.
  state = { degraded: true, failures, at: Date.now() };
  emit();
}

/**
 * Record that ONE endpoint served a request, and clear only that endpoint.
 *
 * WHAT THIS USED TO DO, AND WHY IT WAS WRONG. It took no argument and assigned
 * `{ degraded: false, failures: [] }` — any success anywhere wiped every recorded failure.
 * Three things followed from that, all of them user-visible:
 *
 *   1. The banner was ORDER-DEPENDENT. A dashboard fanning out six parallel calls resolved
 *      them in network order, so whichever of success/failure landed last decided whether the
 *      user saw a banner at all. Two identical refreshes against the same half-broken backend
 *      could disagree.
 *   2. The banner UNDERCOUNTED. `failures` only ever held what had failed since the last 2xx,
 *      so a refresh where six endpoints died usually rendered "One request did not reach the
 *      server."
 *   3. A 200 carrying an unusable body cleared the whole list and then re-added only itself,
 *      destroying unrelated failures on its way past.
 *
 * Clearing per endpoint costs one thing, accepted deliberately (`docs/spec/PHASE-3.md` L8):
 * `degraded` is now sticky until the failed endpoint itself recovers. Screens gate their
 * outage copy on `degraded && list.length === 0`, so the residual imprecision is a genuinely
 * empty screen reading "could not load" while a DIFFERENT endpoint is broken — strictly
 * narrower than the failure it replaces, which was a real outage reading "you have none".
 *
 * `at` is deliberately left where it is; a success is not a failure and must not move the
 * clock `search.tsx` measures against.
 */
export function reportSuccess(endpoint: string): void {
  if (!state.failures.includes(endpoint)) return;
  const failures = state.failures.filter((e) => e !== endpoint);
  state = { degraded: failures.length > 0, failures, at: state.at };
  emit();
}

/** Clear health state on logout so the next session starts clean. */
export function resetHealth(): void {
  state = { degraded: false, failures: [], at: null };
  emit();
}

/**
 * Empty-shell builder. Given the SHAPE of a value, returns the same shape with every leaf
 * emptied: numbers to 0, strings to '', booleans to false, arrays to []. Used so a failed
 * fetch can satisfy a non-nullable return type without inventing a single value.
 *
 * Depth-capped because the shapes it walks come from API responses, and a cyclic or
 * pathologically deep object would otherwise recurse without bound.
 */
export function emptyLike<T>(shape: T, depth = 0): T {
  if (depth > 6) return shape;
  if (Array.isArray(shape)) return [] as unknown as T;
  if (shape === null || shape === undefined) return shape;
  const t = typeof shape;
  if (t === 'number') return 0 as unknown as T;
  if (t === 'string') return '' as unknown as T;
  if (t === 'boolean') return false as unknown as T;
  if (t === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(shape as Record<string, unknown>)) {
      out[k] = emptyLike((shape as Record<string, unknown>)[k], depth + 1);
    }
    return out as unknown as T;
  }
  return shape;
}
