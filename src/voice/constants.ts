/**
 * Voice tuning constants. Every value here is written down in the voice contract — either
 * `docs/PLAN-2026-08-26-VOICE-N8N-AND-BUGS.md` (§A1, the n8n request/response contract) or
 * `docs/VOICE-ARCHITECTURE-DECISION-2026-08-26.md` (§3 latency, §7 multi-turn / offline). Nothing is
 * invented here; the citation is on each line so a change is a deliberate contract change.
 */
export const VOICE = {
  /** Below this confidence the app will NOT act — it shows the transcript and asks (contract A1.3). */
  CONFIDENCE_MIN: 0.55,

  /** Hard cap on one recording; a visible countdown ring warns before it (§7 offline audio · A1.2). */
  MAX_RECORD_MS: 15_000,
  /** Clips shorter than this are rejected locally with NO API call ("thoda lamba boliye", §5 #7). */
  MIN_RECORD_MS: 1_000,
  /** Advisory upload cap — audio only, mono AAC, compressed on the phone to ~1 MB (A1.2). */
  MAX_AUDIO_BYTES: 1_048_576,

  /** Round-trip target; past the ceiling the app aborts to the transcript + a retry (A1.3 timing). */
  TARGET_MS: 3_000,
  CEILING_MS: 8_000,

  /** Multi-turn memory (§7): turns kept on the phone, and the last N text-only turns sent to the NLU. */
  HISTORY_KEEP: 6,
  HISTORY_SEND: 3,
  /** The session clears after this idle gap (§7 multi-turn: "90 s idle"). */
  SESSION_IDLE_MS: 90_000,
  /** Backgrounded longer than this also clears the session (§7). */
  SESSION_BG_MS: 300_000,
} as const;
