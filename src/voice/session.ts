/**
 * Multi-turn voice session — in-memory, on the phone, NEVER persisted (architecture §7).
 *
 * Multi-turn is required, not a nice-to-have: "aur uska number?" is how Hindi and Gujarati are
 * actually spoken, and a one-shot assistant forces every utterance to re-name the person — exactly
 * the step STT gets wrong. So the phone keeps a little conversation context: the last few text turns,
 * one resolved entity slot, and the last intent id.
 *
 * 🔴 DANGER ZONE — this is module-scope per-user state that a storage purge does NOT touch, the same
 * class as `api.ts`'s `state` buffer and its `clientCache`/`claimCache` Maps. On a shared handset it
 * would leak the previous user's spoken context (a client's name in a transcript, a resolved slot) to
 * the next user. It is therefore cleared by `resetVoiceSession()`, which `api.ts#resetApiState()`
 * calls — so logout and a silent 401 wipe it exactly like the rest of the per-user memory. If you add
 * another field here, it must be cleared in `reset()` too.
 *
 * DPDP posture (§7): what is SENT to the NLU is deliberately minimal — the last few text turns, and
 * the slot's `kind`/`label` only, NEVER the slot's id, a phone number, or a ₹ figure. Pronoun
 * resolution happens on the phone, not in the model, so the model never needs the id. The store keeps
 * time as an explicit argument (never reads a clock itself) so the idle/expiry logic stays pure and
 * testable and never trips the "no Date.now() in render" rule.
 */
import { VOICE } from '@/voice/constants';

export type TurnRole = 'user' | 'assistant';
export type Turn = { role: TurnRole; text: string };

/** A resolved entity the conversation is "about" — a person/client. The id stays on the phone. */
export type EntitySlot = { kind: string; label: string; id: string };

type SessionState = {
  turns: Turn[];
  slot: EntitySlot | null;
  lastIntentId: string | null;
  /** ms timestamp of the last activity; 0 = no activity yet. Supplied by the caller, never read here. */
  lastActivityAt: number;
};

const session: SessionState = { turns: [], slot: null, lastIntentId: null, lastActivityAt: 0 };

function push(role: TurnRole, text: string, now: number): void {
  session.turns.push({ role, text });
  // Keep only the most recent HISTORY_KEEP turns in memory.
  if (session.turns.length > VOICE.HISTORY_KEEP) {
    session.turns.splice(0, session.turns.length - VOICE.HISTORY_KEEP);
  }
  session.lastActivityAt = now;
}

export function recordUserTurn(text: string, now: number): void {
  push('user', text, now);
}

export function recordAssistantTurn(text: string, now: number): void {
  push('assistant', text, now);
}

export function setSlot(slot: EntitySlot, now: number): void {
  session.slot = slot;
  session.lastActivityAt = now;
}

export function clearSlot(): void {
  session.slot = null;
}

export function setLastIntent(id: string): void {
  session.lastIntentId = id;
}

export function lastIntentId(): string | null {
  return session.lastIntentId;
}

/** The current slot, id included — for ON-PHONE pronoun resolution only. Never send this to the NLU. */
export function currentSlot(): EntitySlot | null {
  return session.slot;
}

/** The last N turns to send to the NLU as context (§7: HISTORY_SEND). A defensive copy. */
export function historyForNlu(): Turn[] {
  return session.turns.slice(-VOICE.HISTORY_SEND).map((t) => ({ ...t }));
}

/** The slot as the NLU may see it — `kind`/`label` ONLY, never the id (§7 DPDP). */
export function slotForNlu(): { kind: string; label: string } | null {
  return session.slot ? { kind: session.slot.kind, label: session.slot.label } : null;
}

/** True once there has been activity and it is older than the idle window (§7: 90 s). */
export function isIdleExpired(now: number): boolean {
  return session.lastActivityAt !== 0 && now - session.lastActivityAt > VOICE.SESSION_IDLE_MS;
}

/** Clear the session if it has gone idle; returns whether it was cleared. Call before reading context. */
export function expireIfIdle(now: number): boolean {
  if (isIdleExpired(now)) {
    reset();
    return true;
  }
  return false;
}

/**
 * The single teardown. Called by every clear trigger (§7: 90 s idle, sheet closed, backgrounded
 * >5 min, sign-out, silent-401, view-as change) and — the security-critical one — by
 * `api.ts#resetApiState()` so a shared handset cannot leak spoken context across users.
 */
export function reset(): void {
  session.turns = [];
  session.slot = null;
  session.lastIntentId = null;
  session.lastActivityAt = 0;
}

/** Named export used by `api.ts#resetApiState()`; kept distinct so its call site reads clearly. */
export const resetVoiceSession = reset;
