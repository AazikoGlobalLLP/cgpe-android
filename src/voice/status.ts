/**
 * Pure parsing + sizing for `GET /voice/status`, split out so it is testable with no network.
 *
 * The status endpoint is the definitive answer to the owner's "we speak and nothing comes back":
 * `ready = stt && brain` (cgpe-api), so a server missing `SARVAM_API_KEY` / `N8N_VOICE_BRAIN_URL` /
 * `CGPE_VOICE_SECRET` answers `ready:false` and NAMES the gap in `missing[]`. Reading it BEFORE the
 * user records means the app says "voice is not switched on for this server yet" up front instead of
 * making them speak and wait through a dead turn — the symptom, not a crash.
 *
 * It also carries `timeouts.budget_ms`, the server's real turn budget, so the app sizes its abort to
 * the actual config (one TTS engine = 80 s, two = 110 s, or an OPS override) rather than a hardcoded
 * guess. See `VOICE.CEILING_MS`, which is now only the fallback for when this cannot be read.
 */
import { VOICE } from '@/voice/constants';

export type VoiceStatus = {
  /** stt && brain — a turn can reach a reply. TTS is separate (see `hasTts`). */
  ready: boolean;
  /** Which legs the server reports absent — the diagnosis, surfaced under the friendly message. */
  missing: string[];
  /** A TTS engine is configured, so a reply can come back as AUDIO. `ready` does NOT include this:
   *  stt+brain can be up while TTS is down, which gives text with no voice. */
  hasTts: boolean;
  /** The server's real per-turn budget (ms), for sizing the client abort. `null` when not reported. */
  budgetMs: number | null;
};

/**
 * Parse the `/voice/status` body. Defensive about the envelope — this backend puts most payloads
 * under `data`, but the voice routes have not always followed that, so accept either shape. Every
 * field degrades safely: an unreadable body yields `{ready:false, missing:[], hasTts:false, budgetMs:null}`,
 * which fails fast rather than pretending voice is on.
 */
export function parseVoiceStatus(json: unknown): VoiceStatus {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;

  const missing = Array.isArray(data.missing) ? data.missing.map((x) => String(x)) : [];
  const timeouts = data.timeouts && typeof data.timeouts === 'object' ? (data.timeouts as Record<string, unknown>) : {};

  const budget = Number(timeouts.budget_ms);
  const budgetMs = Number.isFinite(budget) && budget > 0 ? budget : null;

  const ready = data.ready === true;
  // Prefer the numeric engine count. When it is absent, only INFER tts from missing[] on an
  // otherwise-ready server — never claim tts on a not-ready or garbage body (an empty missing[] there
  // must not read as "tts is fine"). A false "text only" hint is harmless; a false "voice works" is not.
  const ttsEngines = Number(timeouts.tts_engines);
  const hasTts = Number.isFinite(ttsEngines)
    ? ttsEngines > 0
    : ready && !missing.some((m) => /tts/i.test(m));

  return { ready, missing, hasTts, budgetMs };
}

/** The abort ceiling for a turn: the server's real budget when known, else the generous fallback. */
export function voiceAbortMs(status: VoiceStatus | null): number {
  return status?.budgetMs ?? VOICE.CEILING_MS;
}
