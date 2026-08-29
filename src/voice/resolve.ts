/**
 * The voice outcome resolver — the pure decision core. Given the NLU result, whether the intent is
 * known, whether its gate passed, which required args are missing, and how the named entity resolved,
 * it returns exactly ONE `VoiceOutcome`. "There is no sixth outcome, and no best guess" (architecture
 * §7): this function is where that promise is kept, in one readable precedence order.
 *
 * The precedence is deliberate and is itself a security property:
 *   1. unknown        — an id the registry does not know is never acted on.
 *   2. lowConfidence  — a low-confidence classification is not trusted enough even to REVEAL that a
 *                       matching tool exists, so it is checked BEFORE the gate. This stops a misheard
 *                       command from leaking "that verb exists but you can't run it".
 *   3. forbidden      — the gate refused (layer 2 of the three-layer RBAC; see gate.ts).
 *   4. slotFill       — a required arg is missing → ask ONE question for the first one.
 *   5. entity         — 0 matches → notFound; 2+ → disambiguate; 1 (or none needed) → falls through.
 *   6. resolved       — execute.
 *
 * Kept free of the registry and the network so it is exhaustively testable; the orchestrator computes
 * the inputs (looks up the intent, runs the gate, resolves the entity) and hands them here.
 */
import { VOICE } from '@/voice/constants';
import type { EntityResolution, VoiceOutcome } from '@/voice/types';

export type ResolveInput = {
  /** False when the registry has no intent for the NLU's id. */
  intentKnown: boolean;
  /** The result of `passesGate(intent.gate, ctx)`. Ignored when the intent is unknown. */
  gateOk: boolean;
  /** The NLU's confidence, 0..1. */
  confidence: number;
  /** Overrides `VOICE.CONFIDENCE_MIN` (tests only, and a future per-intent tightening). */
  threshold?: number;
  /** Required arg names the NLU did not supply. The first is what slot-fill asks for. */
  missingSlots?: readonly string[];
  /** How the named entity resolved. Omit for a verb that needs no entity. */
  entity?: EntityResolution;
};

export function decideOutcome(input: ResolveInput): VoiceOutcome {
  const {
    intentKnown,
    gateOk,
    confidence,
    threshold = VOICE.CONFIDENCE_MIN,
    missingSlots = [],
    entity,
  } = input;

  if (!intentKnown) return { kind: 'unknown' };

  // A low-confidence classification is untrusted — do not act on it, and do not reveal a refusal for
  // it. `≥ T` executes (the boundary is inclusive, matching the ambiguity table's "confidence ≥ T").
  if (confidence < threshold) return { kind: 'lowConfidence' };

  if (!gateOk) return { kind: 'forbidden' };

  if (missingSlots.length > 0) return { kind: 'slotFill', slot: missingSlots[0] };

  if (entity?.required) {
    if (entity.matchCount === 0) return { kind: 'notFound' };
    if (entity.matchCount >= 2) return { kind: 'disambiguate' };
  }

  return { kind: 'resolved' };
}
