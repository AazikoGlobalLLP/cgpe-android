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
import { langForVoice, isRecordingTooShort } from '@/voice/request';
import { isAllowedVoiceRoute } from '@/voice/routes';
import { historyForNlu, recordAssistantTurn, recordUserTurn } from '@/voice/session';
import type { VoiceCharacterState } from '@/ui/voice/voiceVisual';

export type VoiceTurn = {
  state: VoiceCharacterState;
  transcript: string;
  setTranscript: (s: string) => void;
  reply: string;
  error: string | null;
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
  const busy = useRef(false);
  const sessionIdRef = useRef('');
  const startedAtRef = useRef(0);

  const recorder = useAudioRecorder(
    useMemo(() => ({ ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1 }), []),
  );
  const level = useSharedValue(0);

  // Unit 1: a gentle synthetic amplitude so the character has life. Unit 2 replaces this with a real
  // mic-metering sampler writing `level.value`.
  useEffect(() => {
    cancelAnimation(level);
    if (state === 'listening' || state === 'speaking') {
      level.value = withRepeat(withTiming(0.6, { duration: 620 }), -1, true);
    } else {
      level.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(level);
  }, [state, level]);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const fail = useCallback((msg: string) => {
    haptics.error();
    setState('error');
    setError(msg);
  }, []);

  const startCapture = useCallback(async () => {
    if (busy.current) return;
    setError(null);
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
    } catch {
      fail(t('voice.failed'));
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
        fail(result.transport === 'timeout' || result.transport === 'server' ? t('voice.failed') : t('voice.offline'));
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
    } catch {
      fail(t('voice.failed'));
    } finally {
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

  return { state, transcript, setTranscript, reply, error, level, startedAtRef, startCapture, finishCapture, close, reset };
}
