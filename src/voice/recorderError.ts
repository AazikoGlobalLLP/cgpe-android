/**
 * Reading what the native recorder actually objected to.
 *
 * ── WHY THIS EXISTS (owner screenshot, 2026-09-01, build 5) ───────────────────────────────────
 * The first build that survived the mic press then showed:
 *
 *   "Call to function 'AudioRecorder.prepareToRecordAsync' has been rejected.
 *    → Caused by: AudioRecorder has already been prepared…"
 *
 * That string is not ambiguous. It is thrown by `expo-audio`'s own Android code at
 * `android/src/main/java/expo/modules/audio/AudioRecorder.kt:84`:
 *
 *   if (recorder != null || isPrepared || isRecording || isPaused) throw AlreadyPreparedException()
 *
 * i.e. **a previous capture was never torn down.** It is a STATE fault, not a configuration fault —
 * and the two need opposite responses, which is the whole reason this file exists:
 *
 *  • The encoder REFUSED OUR OPTIONS (mono / metering / a bitrate this handset's AAC encoder never
 *    shipped) → preparing again with the vendor's unmodified preset is the right recovery.
 *  • The recorder is ALREADY LIVE → preparing again is guaranteed to throw the identical error,
 *    because nothing about the recorder changed between the two calls. The recovery is to STOP it
 *    first. `useVoiceTurn` used to run the options fallback for both, so the second case always
 *    reported failure twice and recovered never.
 *
 * Kept pure and separate from `useVoiceTurn` because that file is native (it calls `expo-audio`'s
 * `useAudioRecorder`) and therefore unreachable by the test suite. This decision is the part worth
 * pinning, so it lives where a test can reach it.
 */

/**
 * Does this thrown value mean "the recorder is still live from a previous capture"?
 *
 * Matched on the message rather than a code because `CodedException` derives its code from the Kotlin
 * class name and that is an implementation detail of a version we do not pin; the sentence is the
 * part the library actually shows, and it is what arrived on the owner's screenshot. A `code` is
 * accepted too when one is present, so a future expo-audio that surfaces one still works.
 *
 * Deliberately narrow: anything unrecognised returns `false` and falls through to the options
 * fallback, which is the safe direction — an unnecessary re-prepare with the vendor preset costs one
 * call, whereas mistaking an options failure for a state failure would stop a recorder that was
 * never started and lose the real error.
 */
export function isAlreadyPreparedError(e: unknown): boolean {
  if (e == null) return false;

  const parts: string[] = [];
  if (typeof e === 'string') parts.push(e);
  else if (typeof e === 'object') {
    const o = e as { message?: unknown; code?: unknown };
    if (typeof o.message === 'string') parts.push(o.message);
    if (typeof o.code === 'string') parts.push(o.code);
  }

  const hay = parts.join(' ').toLowerCase();
  if (!hay) return false;
  // The sentence expo-audio throws, and the shape a coded variant would take.
  return hay.includes('already been prepared') || hay.includes('already_prepared');
}
