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
   * DERIVED, not chosen, and re-derived against the CURRENT proxy (Phase 117 / D-150). The backend's
   * own declared worst case is `STT + brain + TTS x ttsEngineCount` — the TTS stage is tried once PER
   * configured engine, SEQUENTIALLY (ElevenLabs first, then Sarvam), each at the full TTS timeout
   * (`cgpe-backend-main/services/voiceService.js:78-84` and `:308`). With the default stage timeouts
   * (STT 30 s + brain 20 s + TTS 30 s, `voiceService.js:54-56`) that is:
   *   - one TTS engine  (Sarvam-only, today's planned config) -> 30 + 20 + 30      =  80 s
   *   - two TTS engines (ElevenLabs + Sarvam)                  -> 30 + 20 + 30 x 2  = 110 s
   * The old 80 s matched the single-engine case and would have ABORTED a healthy two-engine turn at
   * 80 s while the server was still legitimately within its 110 s budget — re-recording then re-runs
   * the whole billed STT->brain->TTS chain, the exact double-bill this ceiling exists to prevent. So
   * it is sized to the two-engine worst case. (Our brief predicted the brain ALONE at 2-6 s, which is
   * why the old 8 s A1.3 ceiling — now `SLOW_MS` — would have aborted healthy turns.)
   *
   * The backend publishes the EXACT number on `GET /voice/status` as `data.timeouts.budget_ms`
   * (`voiceService.js:142`), which also honours an OPS `VOICE_TOTAL_BUDGET_MS` override this static
   * value cannot see; reading it to track the live budget is the robust follow-up (filed to `cgpe-api`
   * as a `[api]`-adjacent note). Until then 110 s covers every default-stage-timeout config. Waiting is
   * strictly better than discarding: `SLOW_MS` keeps the user informed, and closing the overlay abandons it.
   */
  CEILING_MS: 110_000,

  /** Multi-turn memory (§7): turns kept on the phone, and the last N text-only turns sent to the NLU. */
  HISTORY_KEEP: 6,
  HISTORY_SEND: 3,
  /**
   * The session clears after this idle gap (§7 multi-turn: "90 s idle"), ENFORCED at the start of
   * every turn by `expireIfIdle(Date.now())` in `useVoiceTurn` before the prior turns are read for
   * NLU context. This tighter 90 s window also covers §7's "backgrounded > 5 min" trigger:
   * backgrounding is just idleness and 90 s < 5 min, so any background long enough to matter has
   * already tripped the idle clear. A separate 5 min background timer would therefore be dead weight
   * (the old `SESSION_BG_MS` constant, which nothing ever consumed) — so there isn't one.
   */
  SESSION_IDLE_MS: 90_000,
} as const;
