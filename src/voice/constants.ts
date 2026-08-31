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

  /** Round-trip target - the aim, not a deadline (A1.3 timing). */
  TARGET_MS: 3_000,
  /**
   * Past this a turn is SLOW, not failed: the UI says so and KEEPS WAITING. This value was A1.3's
   * `CEILING_MS`, written before the proxy existed and before anyone knew its stage timeouts.
   */
  SLOW_MS: 8_000,
  /**
   * The hard abort. It must NOT be shorter than an answer the server can still produce, or the app
   * throws away work a vendor was already paid for and tells the user to "try again" while the proxy
   * is still running - the user then re-records, and the whole chain runs twice.
   *
   * DERIVED, not chosen: the proxy is three sequential vendor calls whose own timeouts are
   * STT 30 s + brain 20 s + TTS 30 s (`cgpe-backend-main/services/voiceService.js:54-56` at `a926650`,
   * each env-overridable), so 80 s is the server's own declared worst case. Our brief predicted the
   * brain ALONE at 2-6 s (`docs/spec/VOICE-BACKEND-PROXY-BRIEF.md:75`), which is why the old 8 s
   * ceiling would have aborted healthy turns on a perfectly working server.
   *
   * 80 s is a bad thing to sit through, and that is a SERVER budget problem, not an app one - an ask
   * to tighten the three stage timeouts is filed to `cgpe-api`. Until it lands, waiting is strictly
   * better than discarding: `SLOW_MS` keeps the user informed, and closing the overlay abandons it.
   */
  CEILING_MS: 80_000,

  /** Multi-turn memory (§7): turns kept on the phone, and the last N text-only turns sent to the NLU. */
  HISTORY_KEEP: 6,
  HISTORY_SEND: 3,
  /** The session clears after this idle gap (§7 multi-turn: "90 s idle"). */
  SESSION_IDLE_MS: 90_000,
  /** Backgrounded longer than this also clears the session (§7). */
  SESSION_BG_MS: 300_000,
} as const;
