/**
 * The voice-assistant sheet — the hold-to-talk surface. It ties the whole voice pipeline together:
 * record with `expo-audio`, POST via `askVoice`, parse with `parseVoiceReply`, decide with
 * `decideOutcome`, then show the transcript + spoken answer and (for a navigate) move the screen.
 *
 * v1 scope (matches the n8n brief and the build plan): READS + NAVIGATE + the confirm CARD as display
 * only. Write EXECUTION is dark (`VOICE_WRITES_ENABLED` is false) — n8n does not emit `confirm_write`
 * in v1, and if it ever did, the card shows but the write does not run.
 *
 * ⚠️ This file is imported ONLY by `VoiceProvider` (never a route, never a test), so the `expo-audio`
 * hook import here never reaches the Vitest graph. It is native-only; `VoiceProvider` renders it on
 * native only. All the pure decisions live in the tested `src/voice/*` seams — this is just the glue
 * and the UI, built on the house primitives (Sheet keeps its default scroll → the built-in
 * `keyboardShouldPersistTaps="handled"`, required because the editable transcript sits above tappable
 * rows). No bare `fontWeight`; foreground on filled surfaces is `c.onPrimary`, never `#fff`.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { Sheet } from '@/ui/sheet';
import { Field } from '@/ui/controls';
import { Card, Txt } from '@/ui/base';
import { Banner, useToast } from '@/ui/feedback';
import { shadow, useTheme } from '@/theme/theme';
import { haptics } from '@/lib/haptics';
import { useI18n } from '@/i18n';
import { VoiceAvatar, type VoiceAvatarState } from '@/ui/VoiceAvatar';
import * as voiceAudio from '@/lib/voiceAudio';
import { askVoice, isTransportError } from '@/voice/client';
import { langForVoice, isRecordingTooShort } from '@/voice/request';
import { isAllowedVoiceRoute } from '@/voice/routes';
import {
  historyForNlu, recordAssistantTurn, recordUserTurn,
} from '@/voice/session';

type Persona = 'male' | 'female';

/** A short, unique-enough id for the turn — idempotency + tracing. Generated in a handler, not render. */
function newRequestId(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function VoiceSheet({ open, onClose, persona = 'female' }: { open: boolean; onClose: () => void; persona?: Persona }) {
  const c = useTheme();
  const { spacing, font } = c;
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const screen = usePathname();

  const [state, setState] = useState<VoiceAvatarState>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const sessionIdRef = useRef<string>('');
  const startedAtRef = useRef(0);

  const recorder = useAudioRecorder(useMemo(() => ({ ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1 }), []));

  // mic button press animation (Button has no onPressIn/onPressOut, so this is hand-rolled)
  const press = useSharedValue(0);
  const micStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + press.value * 0.06 }] }));
  const holding = state === 'listening';
  const level = state === 'listening' || state === 'speaking' ? 0.5 : 0;

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
      press.value = withTiming(1, { duration: 90 });
      setState('listening');
      startedAtRef.current = Date.now();
      await voiceAudio.beginCaptureSession();
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      press.value = withTiming(0, { duration: 200 });
      fail(t('voice.failed'));
    }
  }, [recorder, press, toast, t, fail]);

  const finishCapture = useCallback(async () => {
    press.value = withTiming(0, { duration: 200 });
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

      // success
      setTranscript(result.transcript);
      recordUserTurn(result.transcript, Date.now());
      if (result.lowConfidence) {
        // do not act on a low-confidence guess — show the transcript and ask
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
        // The route is a validated member of the curated allow-list (all real, existing routes); the
        // typed-routes union just cannot express "one of this dynamic subset", so an Href cast is
        // legitimate here — NOT the missing-route case CLAUDE.md warns about.
        router.push({ pathname: result.action.route, params: (result.action.params ?? {}) as Record<string, string> } as Href);
        return;
      }
      // 'none' or a confirm_write (display only in v1): leave the answer on screen.
      setTimeout(() => setState('idle'), 1200);
    } catch {
      fail(t('voice.failed'));
    } finally {
      busy.current = false;
    }
  }, [recorder, press, state, screen, lang, t, toast, fail, onClose, router]);

  const handleClose = useCallback(() => {
    voiceAudio.stopPlayback();
    busy.current = false;
    sessionIdRef.current = '';
    setTranscript('');
    setReply('');
    reset();
    onClose();
  }, [onClose, reset]);

  const HINT: Record<VoiceAvatarState, string> = {
    idle: t('voice.holdToSpeak'),
    listening: t('voice.listening'),
    thinking: t('voice.thinking'),
    speaking: t('voice.speaking'),
    error: t('voice.failed'),
  };

  return (
    <Sheet visible={open} onClose={handleClose} title={t('voice.title')} subtitle={HINT[state]} height={560}>
      <View style={{ gap: spacing.lg, paddingTop: spacing.sm, alignItems: 'stretch' }}>
        {state === 'error' && error ? (
          <Banner tone="danger" title={t('voice.failed')} message={error} action={{ label: t('common.tryAgain'), onPress: reset }} onDismiss={reset} />
        ) : null}

        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <VoiceAvatar persona={persona} state={state} level={level} size={132} />
        </View>

        {transcript ? (
          <Field label={t('voice.transcriptLabel')} value={transcript} onChange={setTranscript} multiline hint={t('voice.editHint')} />
        ) : null}

        {reply ? (
          <Card>
            <Txt size={font.cap} weight="600" color={c.muted} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {t('voice.replyLabel')}
            </Txt>
            <Txt size={font.body} weight="600" style={{ marginTop: spacing.xs, lineHeight: 22 }}>
              {reply}
            </Txt>
          </Card>
        ) : null}

        <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <Animated.View style={micStyle}>
            <Pressable
              onPressIn={startCapture}
              onPressOut={finishCapture}
              accessibilityRole="button"
              accessibilityLabel={t('voice.holdToSpeak')}
              style={{
                width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center',
                backgroundColor: holding ? c.primary : c.primarySoft, ...shadow(c, 2),
              }}
            >
              <Ionicons name="mic" size={32} color={holding ? c.onPrimary : c.primary} />
            </Pressable>
          </Animated.View>
          <Txt size={font.sub} weight="600" color={c.muted}>{HINT[state]}</Txt>
        </View>
      </View>
    </Sheet>
  );
}

export default VoiceSheet;
