/**
 * Native audio for the voice assistant — permissions, the recording OPTIONS, playback of the reply
 * clip, and the record/playback audio-session switch. Kept in ONE file so the native surface is
 * contained, mirroring `lib/push.ts` / `lib/calendar.ts` / `lib/tracker.ts`.
 *
 * ⚠️ THE NATIVE MODULE IS LOADED LAZILY. `expo-audio`'s `AudioModule.js` calls
 * `requireNativeModule('ExpoAudio')` at MODULE SCOPE. It is a first-party SDK module with `.web.js`
 * variants, so a top-level import is actually safe in Expo Go / web / e2e — but this file requires it
 * lazily anyway (belt-and-braces, same posture as `videoTranscode.ts`) so the module never evaluates
 * on web or if this file is ever pulled into the Vitest graph (it must NOT be — only `VoiceSheet`
 * imports it). Every function no-ops gracefully when the module is unavailable, so the app never
 * crashes for the lack of a microphone; the caller shows text either way.
 *
 * RECORDING itself is NOT here: `expo-audio` exposes recording through the `useAudioRecorder` HOOK,
 * which must live in the React component (`VoiceSheet`). This module supplies everything around it —
 * the permission gate, the options the hook is prepared with, the capture-session mode, and playback.
 */
import { Platform } from 'react-native';

type ExpoAudio = typeof import('expo-audio');

/** The native module, or null on web / when it cannot load. Never throws. */
function audio(): ExpoAudio | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose (see file header)
    return require('expo-audio') as ExpoAudio;
  } catch {
    return null;
  }
}

/** The recording options `VoiceSheet` prepares `useAudioRecorder` with: mono AAC/m4a, one channel. */
export function voiceRecordingOptions(): import('expo-audio').RecordingOptions | null {
  const A = audio();
  if (!A) return null;
  return { ...A.RecordingPresets.HIGH_QUALITY, numberOfChannels: 1 };
}

/** Ensure the mic permission, asking once if needed. Returns whether recording may proceed. */
export async function ensureMicPermission(): Promise<boolean> {
  const A = audio();
  if (!A) return false;
  try {
    const cur = await A.getRecordingPermissionsAsync();
    if (cur.granted) return true;
    const req = await A.requestRecordingPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/** Put the audio session into RECORD mode (call before the recorder starts). */
export async function beginCaptureSession(): Promise<void> {
  const A = audio();
  if (!A) return;
  try {
    await A.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  } catch {
    /* fail quiet — the recorder will surface a real error if it truly can't start */
  }
}

/** Return the audio session to PLAYBACK mode (call after recording stops, before playing the reply). */
export async function endCaptureSession(): Promise<void> {
  const A = audio();
  if (!A) return;
  try {
    await A.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  } catch {
    /* fail quiet */
  }
}

let player: import('expo-audio').AudioPlayer | null = null;

/**
 * Play the reply clip. `src` is either an `http(s)`/`file` URL (the preferred `audio.mode:'url'`) or a
 * base64 mp3 string (`audio.mode:'base64'`), which is written to a cache file first — a data URI is
 * not a documented `AudioSource`. Releases any previous player. No-ops if audio is unavailable.
 */
export async function play(src: string): Promise<void> {
  const A = audio();
  if (!A || !src) return;
  try {
    await A.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    let source = src;
    if (!/^https?:|^file:/.test(src)) {
      const uri = await writeBase64ToCache(src);
      if (!uri) return;
      source = uri;
    }
    stopPlayback();
    player = A.createAudioPlayer(source);
    player.play();
  } catch {
    /* fail quiet — the text reply is always on screen regardless */
  }
}

/** Stop and release the current player (call this on sheet close and before a new play). */
export function stopPlayback(): void {
  try {
    player?.release();
  } catch {
    /* already released */
  }
  player = null;
}

/** Write a base64 mp3 to a cache file and return its `file://` uri, or null on failure. */
async function writeBase64ToCache(b64: string): Promise<string | null> {
  try {
    // The legacy file API's base64 write is the stable path; `require` avoids a compile-time
    // dependency on the subpath's types and lets an absent module fail into the catch.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy so an absent module fails into the catch
    const FS = require('expo-file-system/legacy') as {
      cacheDirectory: string | null;
      writeAsStringAsync: (uri: string, data: string, opts: { encoding: string }) => Promise<void>;
    };
    if (!FS.cacheDirectory) return null;
    const uri = `${FS.cacheDirectory}voice-reply.mp3`;
    await FS.writeAsStringAsync(uri, b64, { encoding: 'base64' });
    return uri;
  } catch {
    return null;
  }
}
