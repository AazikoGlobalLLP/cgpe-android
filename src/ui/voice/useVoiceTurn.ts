/**
 * The voice turn pipeline — record → askVoice → parse → decide → speak/navigate — lifted verbatim from
 * the original VoiceSheet so both the sheet and the new full-screen VoiceMode share ONE glue path and
 * the tested `src/voice/*` seams stay untouched. v1 scope: reads + navigate + confirm-card display;
 * write EXECUTION stays dark.
 *
 * ⚠️ Uses the `expo-audio` `useAudioRecorder` hook, so this file is native and must be imported ONLY by
 * VoiceMode (← `_layout`, no route, no test). `level` is a Reanimated SharedValue the character reads on
 * the UI thread with zero re-render; unit 1 drives it synthetically, unit 2 swaps in real mic metering.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import {
  cancelAnimation, useSharedValue, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useToast } from '@/ui/feedback';
import { haptics } from '@/lib/haptics';
import { useI18n } from '@/i18n';
import * as voiceAudio from '@/lib/voiceAudio';
import { askVoice, isTransportError } from '@/voice/client';
import { VOICE } from '@/voice/constants';
import { langForVoice, isRecordingTooShort } from '@/voice/request';
import { describeCause, describeTransport } from '@/voice/cause';
import { isAllowedVoiceRoute } from '@/voice/routes';
import { historyForNlu, recordAssistantTurn, recordUserTurn } from '@/voice/session';
import { dbToAmp01, type VoiceCharacterState } from '@/ui/voice/voiceVisual';

export type VoiceTurn = {
  state: VoiceCharacterState;
  transcript: string;
  setTranscript: (s: string) => void;
  reply: string;
  /** The human sentence for the failure — the banner TITLE, not a hard-coded one. */
  error: string | null;
  /**
   * The technical reason behind `error`, shown under it. `null` when there is nothing useful to add.
   * Without this a failed turn is undiagnosable from anything but a USB cable — see `voice/cause.ts`.
   */
  cause: string | null;
  /** No retry can help (voice is switched off at the server) → the banner withholds "Try again". */
  permanent: boolean;
  /** 0..1 mic amplitude on the UI thread — the character/waveform read it with zero re-render. */
  level: SharedValue<number>;
  /** ms at which the current capture began (for the live duration + countdown). */
  startedAtRef: React.MutableRefObject<number>;
  startCapture: () => void;
  finishCapture: () => void;
  close: () => void;
  reset: () => void;
};

/** A short, unique-enough id for the turn — idempotency + tracing. Generated in a handler, not render. */
function newRequestId(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useVoiceTurn(onClose: () => void): VoiceTurn {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const screen = usePathname();

  const [state, setState] = useState<VoiceCharacterState>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The technical reason behind `error`, shown UNDER the friendly sentence. See `voice/cause.ts`:
  // without it a failed turn is undiagnosable from anything but a USB cable.
  const [cause, setCause] = useState<string | null>(null);
  // True when no retry can help — the server has voice switched off. Drives whether the banner is
  // allowed to offer "Try again", which for this case would be a promise the app cannot keep.
  const [permanent, setPermanent] = useState(false);
  const busy = useRef(false);
  const sessionIdRef = useRef('');
  const startedAtRef = useRef(0);

  const recorder = useAudioRecorder(
    useMemo(() => ({ ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, isMeteringEnabled: true }), []),
  );
  const level = useSharedValue(0);

  // Drive `level` (0..1) on the UI thread. While LISTENING, sample the recorder's real mic metering
  // (dBFS from `getStatus().metering`, Android-implemented) every ~70 ms and smooth it with withTiming;
  // if a device exposes no metering, fall back to a synthetic oscillation so the character never looks
  // dead. SPEAKING has no playback metering, so it uses a procedural envelope. Zero React re-render.
  useEffect(() => {
    cancelAnimation(level);
    if (state === 'listening') {
      const id = setInterval(() => {
        let amp: number | null = null;
        try {
          const m = recorder.getStatus?.()?.metering;
          if (typeof m === 'number' && Number.isFinite(m)) amp = dbToAmp01(m);
        } catch { /* getStatus unavailable on this build */ }
        if (amp == null) amp = 0.28 + 0.28 * Math.abs(Math.sin(Date.now() / 190)); // synthetic fallback
        level.value = withTiming(amp, { duration: 80 });
      }, 70);
      return () => clearInterval(id);
    }
    if (state === 'speaking') {
      level.value = withRepeat(withTiming(0.55, { duration: 520 }), -1, true);
      return () => cancelAnimation(level);
    }
    level.value = withTiming(0, { duration: 200 });
    return () => cancelAnimation(level);
  }, [state, level, recorder]);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    setCause(null);
    setPermanent(false);
  }, []);

  const fail = useCallback((msg: string, why?: string | null, isPermanent = false) => {
    haptics.error();
    setState('error');
    setError(msg);
    setCause(why ?? null);
    setPermanent(isPermanent);
  }, []);

  const startCapture = useCallback(async () => {
    if (busy.current) return;
    setError(null);
    setCause(null);
    setPermanent(false);
    const ok = await voiceAudio.ensureMicPermission();
    if (!ok) {
      toast(t('voice.micDenied'), 'warning');
      return;
    }
    try {
      if (!sessionIdRef.current) sessionIdRef.current = newRequestId();
      haptics.heavy();
      setState('listening');
      startedAtRef.current = Date.now();
      await voiceAudio.beginCaptureSession();
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      // The recorder is the likeliest thing to fail on a handset we have never tested on, and it is
      // the one failure the user CAN see. Keep what it actually said.
      fail(t('voice.failed'), describeCause(e));
    }
  }, [recorder, toast, t, fail]);

  const finishCapture = useCallback(async () => {
    if (state !== 'listening' || busy.current) return;
    busy.current = true;
    setState('thinking');
    const durationMs = Date.now() - startedAtRef.current;
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch {
      /* fall through to the no-audio guard below */
    }
    await voiceAudio.endCaptureSession();

    if (!uri || isRecordingTooShort(durationMs)) {
      busy.current = false;
      toast(t('voice.tooShort'), 'info');
      setState('idle');
      return;
    }

    // The proxy chains three vendor calls (STT -> brain -> TTS), so a healthy turn can genuinely run
    // past SLOW_MS. Say so, rather than leaving the character sitting in 'thinking' looking hung. The
    // alternative - aborting - discards an answer the server is still producing and bills it twice.
    const slow = setTimeout(() => toast(t('voice.stillWorking'), 'info'), VOICE.SLOW_MS);
    try {
      const result = await askVoice({
        audioUri: uri,
        lang: langForVoice(lang),
        sessionId: sessionIdRef.current,
        requestId: newRequestId(),
        screen: screen ?? '/',
        history: historyForNlu(),
      });

      if (isTransportError(result)) {
        // Three different fixes, so three different sentences. `unconfigured` is the one that must
        // NOT carry "please try again": voice is off at the server and no retry can turn it on.
        fail(
          result.transport === 'unconfigured'
            ? t('voice.notSetUp')
            : result.transport === 'timeout' || result.transport === 'server'
              ? t('voice.failed')
              : t('voice.offline'),
          describeTransport(result.transport, result.status),
          result.transport === 'unconfigured',
        );
        return;
      }
      if (!result.ok) {
        if (result.transcript) setTranscript(result.transcript);
        fail(t('voice.notUnderstood'));
        return;
      }

      setTranscript(result.transcript);
      recordUserTurn(result.transcript, Date.now());
      if (result.lowConfidence) {
        setState('idle');
        toast(t('voice.notUnderstood'), 'info');
        return;
      }

      setReply(result.replyText);
      recordAssistantTurn(result.replyText, Date.now());
      setState('speaking');
      haptics.tap();
      if (result.audio.mode !== 'none' && result.audio.url) void voiceAudio.play(result.audio.url);

      if (result.action.type === 'navigate' && isAllowedVoiceRoute(result.action.route)) {
        onClose();
        router.push({ pathname: result.action.route, params: (result.action.params ?? {}) as Record<string, string> } as Href);
        return;
      }
      // 'none' or a confirm_write (display only in v1): leave the answer on screen, then relax to idle.
      setTimeout(() => setState((s) => (s === 'speaking' ? 'idle' : s)), 1400);
    } catch (e) {
      fail(t('voice.failed'), describeCause(e));
    } finally {
      clearTimeout(slow);
      busy.current = false;
    }
  }, [recorder, state, screen, lang, t, toast, fail, onClose, router]);

  const close = useCallback(() => {
    voiceAudio.stopPlayback();
    busy.current = false;
    sessionIdRef.current = '';
    setTranscript('');
    setReply('');
    reset();
    onClose();
  }, [onClose, reset]);

  return { state, transcript, setTranscript, reply, error, cause, permanent, level, startedAtRef, startCapture, finishCapture, close, reset };
}
