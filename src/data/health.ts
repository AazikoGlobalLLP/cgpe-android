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
  /** True when the most recent request could not reach the server or returned unusable data. */
  degraded: boolean;
  /** Endpoints that failed since the last reset, for the retry affordance and support triage. */
  failures: string[];
  /** ms timestamp of the most recent failure. */
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
  state = { degraded: true, failures, at: Date.now() };
  emit();
}

/** Record that a request succeeded. Clears the degraded flag once anything works again. */
export function reportSuccess(): void {
  if (!state.degraded) return;
  state = { degraded: false, failures: [], at: state.at };
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
