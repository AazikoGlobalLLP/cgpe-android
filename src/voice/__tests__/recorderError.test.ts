import { describe, it, expect } from 'vitest';
import { isAlreadyPreparedError } from '@/voice/recorderError';

/**
 * The message in the first case is the one the owner photographed on 2026-09-01 (build 5), truncated
 * by the banner exactly as shown. The second is `expo-audio`'s full sentence from
 * `android/src/main/java/expo/modules/audio/AudioExceptions.kt:39`.
 */
describe('isAlreadyPreparedError', () => {
  it('recognises the error as it reaches the app through the expo bridge', () => {
    expect(isAlreadyPreparedError(new Error(
      "Call to function 'AudioRecorder.prepareToRecordAsync' has been rejected. → Caused by: AudioRecorder has already been prepared. Stop or release the current session before preparing again.",
    ))).toBe(true);
  });

  it('recognises expo-audio\'s own sentence verbatim', () => {
    expect(isAlreadyPreparedError(new Error(
      'AudioRecorder has already been prepared. Stop or release the current session before preparing again.',
    ))).toBe(true);
  });

  it('recognises a coded variant, should a future expo-audio surface one', () => {
    expect(isAlreadyPreparedError({ code: 'ERR_AUDIO_RECORDER_ALREADY_PREPARED', message: 'nope' })).toBe(true);
  });

  it('accepts a bare string', () => {
    expect(isAlreadyPreparedError('AudioRecorder has already been prepared.')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAlreadyPreparedError(new Error('ALREADY BEEN PREPARED'))).toBe(true);
  });

  it('does NOT claim an options/encoder failure — that needs the preset fallback, not a stop', () => {
    expect(isAlreadyPreparedError(new Error('Failed to prepare the AudioRecorder'))).toBe(false);
    expect(isAlreadyPreparedError(new Error('java.lang.IllegalArgumentException: bad channel count'))).toBe(false);
  });

  it('does not throw on the shapes a native reject can actually be', () => {
    expect(isAlreadyPreparedError(null)).toBe(false);
    expect(isAlreadyPreparedError(undefined)).toBe(false);
    expect(isAlreadyPreparedError({})).toBe(false);
    expect(isAlreadyPreparedError(42)).toBe(false);
    expect(isAlreadyPreparedError({ message: 7 })).toBe(false);
  });
});
