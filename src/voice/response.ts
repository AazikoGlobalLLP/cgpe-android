/**
 * Parse and structurally validate the n8n voice reply (contract A1.3) into a safe shape the app can
 * act on — or a typed failure. This seam exists because the failure mode is REAL, not hypothetical:
 * the one existing chat-shaped n8n webhook in this system is documented as returning an empty body
 * today (`routes/assistant.js:5-8`), and a non-200 / malformed / empty reply must never crash the
 * sheet or, worse, act on garbage.
 *
 * What this does NOT do: it does not DECIDE whether to act. Low confidence, a failed gate on a
 * confirm_write — those are the orchestrator's call via `decideOutcome`/`passesGate`. This function
 * only turns untrusted JSON into either a well-formed `VoiceReply` (with a `lowConfidence` flag
 * surfaced, never silently swallowed) or a `VoiceReplyError`. It sanitises STRUCTURE only:
 *  - an action naming a route not in the allow-list is downgraded to `none` (never navigate on a guess);
 *  - a `confirm_write` with no valid confirm block is downgraded to `none` (nothing to confirm with).
 * The transcript is preserved even on failure, because the user must always see what was heard (A1.3).
 */
import { VOICE } from '@/voice/constants';
import { isAllowedVoiceRoute } from '@/voice/routes';

export type VoiceActionType = 'none' | 'navigate' | 'confirm_write';

export type VoiceConfirmRow = { label: string; value: string };
export type VoiceConfirm = { title: string; rows: VoiceConfirmRow[]; confirmText: string };

export type VoiceAction = {
  type: VoiceActionType;
  route: string | null;
  params: Record<string, unknown>;
  intentId: string | null;
  args: Record<string, unknown>;
  confirm: VoiceConfirm | null;
};

export type VoiceAudio = { mode: 'url' | 'base64' | 'none'; url: string | null; mime: string | null };

export type VoiceReply = {
  ok: true;
  requestId: string | null;
  transcript: string;
  lang: string | null;
  replyText: string;
  action: VoiceAction;
  audio: VoiceAudio;
  confidence: number;
  /** confidence < CONFIDENCE_MIN — the orchestrator must NOT auto-act; show transcript + ask. */
  lowConfidence: boolean;
};

export type VoiceReplyErrorCode =
  | 'empty_body'   // null / non-object / no usable fields — the documented empty-body failure
  | 'malformed'    // an object, but a success reply missing transcript or reply_text
  | 'stt_failed' | 'llm_failed' | 'tts_failed' | 'forbidden' // the contract's own error codes (A1.3)
  | 'unknown';     // ok:false with a missing/unrecognised error code

export type VoiceReplyError = {
  ok: false;
  code: VoiceReplyErrorCode;
  /** Shown even on failure when the server returned one (A1.3: "always return transcript"). */
  transcript: string | null;
  message: string | null;
};

function isRec(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
function rec(v: unknown): Record<string, unknown> {
  return isRec(v) ? v : {};
}

const KNOWN_CODES = new Set<VoiceReplyErrorCode>(['stt_failed', 'llm_failed', 'tts_failed', 'forbidden']);
function normalizeErrorCode(code: unknown): VoiceReplyErrorCode {
  return typeof code === 'string' && KNOWN_CODES.has(code as VoiceReplyErrorCode)
    ? (code as VoiceReplyErrorCode)
    : 'unknown';
}

function parseConfirm(v: unknown): VoiceConfirm | null {
  if (!isRec(v)) return null;
  const title = str(v.title);
  const confirmText = str(v.confirmText);
  if (title == null || confirmText == null || !Array.isArray(v.rows)) return null;
  const rows: VoiceConfirmRow[] = [];
  for (const r of v.rows) {
    if (!isRec(r)) continue;
    const label = str(r.label);
    const value = str(r.value);
    if (label != null && value != null) rows.push({ label, value });
  }
  // A confirm card with no legible rows is not something we can safely ask the user to approve.
  if (rows.length === 0) return null;
  return { title, rows, confirmText };
}

/** The neutral "answer only, don't navigate" action — used on an absent/unknown action or a soft failure. */
const NO_ACTION: VoiceAction = { type: 'none', route: null, params: {}, intentId: null, args: {}, confirm: null };

function parseAction(v: unknown): VoiceAction {
  const none: VoiceAction = { ...NO_ACTION };
  if (!isRec(v)) return none;

  const rawType = str(v.type);
  const intentId = str(v.intentId);
  const args = rec(v.args);

  if (rawType === 'navigate') {
    const route = str(v.route);
    // Never navigate on a guess: a route not in the curated allow-list downgrades to a plain answer.
    if (!isAllowedVoiceRoute(route)) return { ...none, intentId, args };
    return { type: 'navigate', route, params: rec(v.params), intentId, args, confirm: null };
  }

  if (rawType === 'confirm_write') {
    const confirm = parseConfirm(v.confirm);
    // A confirm_write with no valid confirm block has nothing to show — downgrade to a plain answer.
    if (confirm == null) return { ...none, intentId, args };
    return { type: 'confirm_write', route: null, params: {}, intentId, args, confirm };
  }

  // Unknown/absent type, or an explicit 'none'.
  return { ...none, intentId, args };
}

function parseAudio(v: unknown): VoiceAudio {
  const silent: VoiceAudio = { mode: 'none', url: null, mime: null };
  if (!isRec(v)) return silent;
  const mode = v.mode;
  const mime = str(v.mime);
  if (mode === 'url') {
    const url = str(v.url);
    return url ? { mode: 'url', url, mime } : silent;
  }
  if (mode === 'base64') {
    // base64 payloads are carried in `url` per the contract's `data`/`url` variants; keep it as `url`
    // so the player has one field to read. An absent payload falls back to silent (text still shows).
    const data = str(v.url) ?? str((v as Record<string, unknown>).data);
    return data ? { mode: 'base64', url: data, mime } : silent;
  }
  return silent;
}

/**
 * Turn the untrusted `/api/voice/ask` JSON into a `VoiceReply` or a `VoiceReplyError`. Never throws.
 */
export function parseVoiceReply(raw: unknown): VoiceReply | VoiceReplyError {
  if (!isRec(raw)) {
    return { ok: false, code: 'empty_body', transcript: null, message: null };
  }

  const transcript = str(raw.transcript);
  const replyText = str(raw.reply_text);
  // The n8n brain uses `success`; the backend proxy may use `ok`. Either being false is a SOFT failure:
  // it still carries a spoken `reply_text` ("a short reason") — we speak it, we just never navigate.
  const failed = raw.ok === false || raw.success === false;

  // Any 200 that carries a non-empty reply_text is speakable — this is the normal path, and the soft
  // failure path too. Navigation is dropped on a soft failure.
  if (replyText != null && replyText.trim().length > 0) {
    const rawConf = raw.confidence;
    const hasConf = typeof rawConf === 'number' && Number.isFinite(rawConf);
    // The brain provides NO confidence. Absence means "act normally" (confident), NOT "refuse" — else
    // every real reply would be treated as low-confidence and never navigate.
    const confidence = hasConf ? clamp01(rawConf) : 1;
    return {
      ok: true,
      requestId: str(raw.request_id),
      transcript: transcript ?? '',
      lang: str(raw.lang_detected),
      replyText,
      action: failed ? NO_ACTION : parseAction(raw.action),
      audio: parseAudio(raw.audio),
      confidence,
      lowConfidence: confidence < VOICE.CONFIDENCE_MIN,
    };
  }

  // No usable reply_text → a HARD failure (STT died / empty / garbage body). Transcript shown if present.
  if (failed) {
    const e = isRec(raw.error) ? raw.error : null;
    return { ok: false, code: normalizeErrorCode(e?.code), transcript, message: e ? str(e.message) : null };
  }
  return { ok: false, code: 'malformed', transcript, message: null };
}
