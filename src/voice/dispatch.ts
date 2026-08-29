/**
 * The confirm → execute core for voice WRITES. The handshake is decided (voice architecture §7): the
 * PHONE owns every write; n8n's `confirm_write` is only a PROPOSAL (an intent id + args + card copy),
 * NEVER a command to execute, and there is deliberately no write endpoint on the n8n side. Routing a
 * write back through n8n would forfeit api.ts's one-attempt guarantee, its idempotency-key dedupe, the
 * offline queue and honest failures — producing double clock-ins and lies about outcomes.
 *
 * This module is PURE: it takes the write execution as an injected dependency, so it never imports
 * api.ts and stays trivially testable. The security machinery it enforces:
 *
 *  1. registry lookup — an id the registry does not know (or is not a write) is REFUSED. n8n cannot
 *     name a verb the app has not sanctioned.
 *  2. RE-GATE #1 at card-render — a forbidden write never even shows a card.
 *  3. a required TAP on the confirm card — no write is ever silent.
 *  4. RE-GATE #2 at the execution instant, with a FRESH gate context — because `viewAs`/`user`/session
 *     can change between render and tap; skipping this second check is a layer-2 RBAC bypass.
 *  5. execution through the injected api.ts adapter (which carries one-attempt + idempotency + queue).
 *
 * v1: `enabled` is FALSE — the machinery runs up to the execution instant (so the flow is real and
 * tested) but the write itself is dark, because a mis-wired write is a real mutation no gate can catch
 * and there is no device to verify on until the EAS quota resets. Writes light up as a flagged
 * fast-follow once device QA is possible and the `/api/voice/ask` proxy is live.
 */
import { passesGate, type GateContext } from '@/voice/gate';
import { getVoiceIntent } from '@/voice/registry';
import type { VoiceRunOutcome, WriteApiFn } from '@/voice/types';

export type WriteDispatchResult =
  /** id unknown to the registry, or not a write intent. */
  | { kind: 'refused'; reason: 'unknown' }
  /** the gate refused — at render (#1) or at the execution instant (#2). */
  | { kind: 'refused'; reason: 'forbidden' }
  /** the user did not tap confirm. */
  | { kind: 'cancelled' }
  /** everything passed, but write execution is feature-flagged off (v1). */
  | { kind: 'disabled' }
  /** the write ran; `outcome` is the honest typed result to speak. */
  | { kind: 'done'; outcome: VoiceRunOutcome };

export type WriteDispatchDeps = {
  /**
   * Returns a FRESH gate context each call — it is invoked TWICE (render + execution) precisely so a
   * mid-flow change to `viewAs`/`user`/`ready` is caught. Do not memoize the result across the tap.
   */
  gateContext: () => GateContext;
  /** Show the confirm card and resolve to whether the user tapped "save". Never auto-confirms. */
  confirm: () => Promise<boolean>;
  /** Execute the write via api.ts (one-attempt + idempotency + offline queue). Absent ⇒ dark. */
  execute?: (write: WriteApiFn, args: Record<string, unknown>) => Promise<VoiceRunOutcome>;
  /** v1 flag: false keeps writes dark even when everything else passes. */
  enabled: boolean;
};

export async function runWriteIntent(
  intentId: string | null | undefined,
  args: Record<string, unknown>,
  deps: WriteDispatchDeps,
): Promise<WriteDispatchResult> {
  const intent = getVoiceIntent(intentId);
  if (!intent || intent.kind !== 'write' || !intent.write) {
    return { kind: 'refused', reason: 'unknown' };
  }

  // RE-GATE #1 (render): a forbidden write must never show a card.
  if (!passesGate(intent.gate, deps.gateContext())) {
    return { kind: 'refused', reason: 'forbidden' };
  }

  const tapped = await deps.confirm();
  if (!tapped) return { kind: 'cancelled' };

  // RE-GATE #2 (execution instant, FRESH context): the state may have changed since the card rendered.
  if (!passesGate(intent.gate, deps.gateContext())) {
    return { kind: 'refused', reason: 'forbidden' };
  }

  // v1: writes are dark. The flow above is real and tested; only the mutation is withheld.
  if (!deps.enabled || !deps.execute) return { kind: 'disabled' };

  const outcome = await deps.execute(intent.write, args);
  return { kind: 'done', outcome };
}

/**
 * The v1 execution flag. Kept as a named constant (not a magic literal) so lighting up writes is a
 * single, reviewable one-line change once device QA is possible and the proxy is live.
 */
export const VOICE_WRITES_ENABLED = false;
