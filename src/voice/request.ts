/**
 * Pure request-shaping decisions for a voice turn — the parts that need no network and no microphone,
 * split out so they are testable and so the audio/native code stays in one native-only file later.
 *
 *  - `langForVoice` maps the app's five UI languages onto the STT `language_code` the contract expects
 *    (A1.2 / §5 #6: "pass language_code explicitly from the app's existing i18n setting"). Auto-detect
 *    costs accuracy on short clips, so the app always names the language it already knows.
 *  - the local audio gates reject a clip BEFORE any API call (§5 #7 / §7 offline): too short is a
 *    misfire, too large will not fit the ~1 MB budget. ("Silent" needs the native amplitude and is
 *    handled at the recorder, not here.)
 */
import type { Lang } from '@/i18n';
import { VOICE } from '@/voice/constants';

/** The STT language codes the contract accepts (A1.2). `auto` is a fallback, never the default. */
export type VoiceLangCode = 'en-IN' | 'hi-IN' | 'gu-IN';

/**
 * App language → STT language code. Both Hindi variants (script + Hinglish) map to `hi-IN`, and both
 * Gujarati variants (script + Roman) to `gu-IN` — the transcript comes back in Latin script either way
 * (Sarvam `mode=translit`), which is what the app's name matcher needs (§5). Exhaustive over `Lang`.
 */
export function langForVoice(lang: Lang): VoiceLangCode {
  switch (lang) {
    case 'hi':
    case 'hi-en':
      return 'hi-IN';
    case 'gu':
    case 'gu-en':
      return 'gu-IN';
    case 'en':
      return 'en-IN';
    default: {
      // A new UI language must decide its STT code deliberately; until then, name English rather than
      // fall through to auto-detect (which is worse on short command clips).
      const _never: never = lang;
      void _never;
      return 'en-IN';
    }
  }
}

/** Too short to be a real command → reject locally, no API call ("thoda lamba boliye"). */
export function isRecordingTooShort(durationMs: number): boolean {
  return durationMs < VOICE.MIN_RECORD_MS;
}

/**
 * Over the advisory ~1 MB upload budget (A1.2). This is a pure guard for a caller that HAS the byte
 * count in hand (the web path, where `askVoice` already holds the recorded `Blob` and its `.size`).
 * On a real handset the recording is streamed to the proxy as a `{uri}` FormData part — the bytes
 * never enter JS memory, so there is nothing to measure here without a native file-stat. The live
 * size bound on native is therefore `VOICE.MAX_RECORD_MS` (15 s): a 15 s mono AAC clip is well under
 * 1 MB, so the duration cap enforces the byte budget in practice, and this stays the byte-exact check
 * for the paths that can afford one.
 */
export function exceedsAudioCap(sizeBytes: number): boolean {
  return sizeBytes > VOICE.MAX_AUDIO_BYTES;
}
