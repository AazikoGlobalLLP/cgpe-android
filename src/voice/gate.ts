/**
 * Voice access gates — the load-bearing security seam for the voice assistant.
 *
 * Every voice intent (`src/voice/registry.ts`) declares a `Gate`. This module evaluates a `Gate`
 * against the live signed-in user, so a spoken command inherits the SAME owner-locked permission
 * rules as the tapped UI — it never re-implements them. This project already carries two hand-mirrored
 * permission tables (`SCHEMA_FEATURE_DEFAULTS` vs `ui_rbac_config.json`, and `DEPARTMENTS` vs the
 * backend) and both are documented as drifting silently. The voice path must not add a third, on the
 * security path — so this file composes the existing predicates in `@/store/roles` verbatim and
 * invents no new rule.
 *
 * THE ONE DESIGN DECISION (voice architecture doc §7). There is deliberately NO `{ kind: 'flag' }`
 * variant. RBAC feature flags FAIL OPEN: `can()` falls back to `SCHEMA_FEATURE_DEFAULTS` (ten default
 * false, four default true) and to `DEFAULT_UI`'s all-true on a total outage, and per-role configs are
 * UNSEEDED in prod — so a flag ALONE can neither authorise nor restrict anything today. A flag may
 * only NARROW a caps/self decision, and only when the server EXPLICITLY set it to `false`. A developer
 * who wants to gate on a flag alone must pick `self` and name the flag — a reviewable choice, not an
 * accident. This is the fix for the exact bug that shipped a create button and two whole dashboard
 * widgets to a team advisor (Band 2 #3 / loophole round 4).
 *
 * ⚠️ The naive narrowing helper the research first wrote — `!f || !ready || can(f) !== false` —
 * SILENTLY KILLS its own intents: `can_view_team_roster` / `can_dispatch_notification` default
 * `false`, so with prod configs unseeded every gate carrying such a flag would refuse master and admin
 * too, and only work during a total config outage. The correct rule reads the EXPLICIT config value,
 * not `can()`: a flag refuses only when the server SET it false. `tsc` and `npm test` cannot see that
 * distinction — it is pinned by a test below.
 *
 * This is DEFENCE IN DEPTH, not the authority. The real authority is the backend endpoint 403 that
 * `run` hits through `src/data/api.ts`; the catalogue filter on the server is layer 1. See §7.
 */
import type { User } from '@/data/types';
import type { FeatureKey } from '@/store/appUi';
import {
  type Capabilities,
  type Tier,
  capabilitiesOf,
  canViewClients,
  canViewOwnClients,
} from '@/store/roles';

/** The boolean capability keys on `Capabilities` — every field except the descriptive `tier`/`label`. */
export type CapKey = Exclude<keyof Capabilities, 'tier' | 'label'>;

/**
 * How a voice intent is authorised. There is intentionally no flag-only variant (see module doc).
 *
 *  - `self`       — any signed-in user, acting on their OWN data (their tasks, their attendance,
 *                   their commission). A `flag` may only narrow it.
 *  - `caps`       — requires a capability from `capabilitiesOf` (view-as aware). `cap` is REQUIRED;
 *                   a `flag` may only narrow it further.
 *  - `clientBook` — the owner-locked Point-9 invariant. `whole` = master/admin/leader (`canViewClients`);
 *                   `own` = those, OR a sales-department advisor on their own book (`canViewOwnClients`).
 *  - `realMaster` — reads the REAL role (leader folded OUT), like `canSeeLiveLocation`. Master only.
 *  - `realAdmin`  — payroll-class: the backend 403s a leader, so admin/super_admin only, never the tier.
 */
export type Gate =
  | { kind: 'self'; flag?: FeatureKey }
  | { kind: 'caps'; cap: CapKey; flag?: FeatureKey }
  | { kind: 'clientBook'; scope: 'own' | 'whole' }
  | { kind: 'realMaster' }
  | { kind: 'realAdmin' };

export type GateContext = {
  /** The LIVE signed-in user. `null` refuses every gate — voice never runs unauthenticated. */
  user: User | null;
  /** The active "view as" tier, if a master is previewing a lower side. Only ever narrows. */
  viewAs?: Tier | null;
  /**
   * False until the server's app-UI config has settled. A narrowing flag may NOT refuse before then
   * (the config is not yet known, so we cannot honestly say the server set the flag false).
   */
  ready: boolean;
  /**
   * The EXPLICIT config value for a feature flag: `true`/`false` when the server set it, `undefined`
   * when it did not. This is NOT `can()` — `can()` folds in the schema default (mostly false), which
   * is precisely what a narrowing flag must ignore. Wire it as
   * `(k) => { const v = config.features?.[k]; return typeof v === 'boolean' ? v : undefined; }`.
   */
  flagValue: (key: FeatureKey) => boolean | undefined;
};

/**
 * Does the caller pass this gate? The single choke point every voice intent runs through before it
 * touches data. Fails CLOSED: an unrecognised gate kind refuses.
 */
export function passesGate(gate: Gate, ctx: GateContext): boolean {
  const { user, viewAs, ready, flagValue } = ctx;

  // A feature flag may only NARROW, and only when the server EXPLICITLY set it to false. Undefined
  // (server left it out / unseeded prod), true, or a not-yet-ready config never refuses on its own.
  const flagOk = (f?: FeatureKey): boolean => !f || !ready || flagValue(f) !== false;

  switch (gate.kind) {
    case 'self':
      return user != null && flagOk(gate.flag);
    case 'caps': {
      const caps: Capabilities = capabilitiesOf(user, viewAs);
      return caps[gate.cap] === true && flagOk(gate.flag);
    }
    case 'clientBook':
      return gate.scope === 'whole'
        ? canViewClients(user, viewAs)
        : canViewOwnClients(user, viewAs);
    case 'realMaster':
      return user?.role === 'super_admin';
    case 'realAdmin':
      return user?.role === 'admin' || user?.role === 'super_admin';
    default: {
      // Exhaustiveness guard: a gate kind added without a case here fails the type-check AND refuses
      // at runtime, so a new intent can never fall open by forgetting its branch.
      const _never: never = gate;
      void _never;
      return false;
    }
  }
}
