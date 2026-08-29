/**
 * Voice mode — the full-screen immersive surface. An opaque absolute-fill overlay mounted in
 * `_layout`'s RootNav beside VoiceLauncher (modeled on `AppLock`): `accessibilityViewIsModal`, safe-area
 * insets, a hardware-back interceptor, `zIndex` BELOW LocationBlock(55)/AppLock(60) so a lock always
 * wins, and `return null` when closed. Off the route graph → no typed-routes/boot trap.
 *
 * All the voice logic lives in `useVoiceTurn` (the tested `src/voice/*` seams); this file is the
 * premium presentation only: an ambient gradient + tier/persona blooms, the character, a live waveform,
 * frosted transcript + reply cards, and the hold-to-talk dock.
 *
 * ⚠️ Native (via `useVoiceTurn`→`expo-audio`), so imported ONLY by `_layout`, never a route/test.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Grad, Txt } from '@/ui/base';
import { Field } from '@/ui/controls';
import { Banner } from '@/ui/feedback';
import { shadow, tnum, useTheme } from '@/theme/theme';
import { useI18n } from '@/i18n';
import { useAuth } from '@/store/auth';
import { tierOf } from '@/store/roles';
import { useVoiceMode } from '@/ui/voice/VoiceModeContext';
import { useVoiceTurn } from '@/ui/voice/useVoiceTurn';
import { VoiceCharacter } from '@/ui/voice/VoiceCharacter';
import { VoiceWaveform } from '@/ui/voice/VoiceWaveform';
import { PersonaToggle } from '@/ui/voice/PersonaToggle';
import { VoiceGlass } from '@/ui/voice/GlassCards';
import { formatDuration, personaBase, stateCopyKey, tierGlow } from '@/ui/voice/voiceVisual';

function alpha(hex: string, a: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const v = a < 0 ? 0 : a > 1 ? 1 : a;
  return hex + Math.round(v * 255).toString(16).padStart(2, '0');
}

export function VoiceMode() {
  const { isOpen, close: closeCtx, persona, setPersona } = useVoiceMode();
  const c = useTheme();
  const { spacing, font } = c;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { user } = useAuth();
  const tier = tierOf(user);

  const turn = useVoiceTurn(closeCtx);
  const [elapsed, setElapsed] = useState(0);

  const press = useSharedValue(0);
  const micStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + press.value * 0.07 }] }));

  // Hardware back closes voice mode (and does NOT navigate the Stack behind it) while open.
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { turn.close(); return true; });
    return () => sub.remove();
  }, [isOpen, turn]);

  // Live duration while capturing / speaking.
  useEffect(() => {
    if (turn.state !== 'listening' && turn.state !== 'speaking') { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(Date.now() - turn.startedAtRef.current), 250);
    return () => clearInterval(id);
  }, [turn.state, turn.startedAtRef]);

  const onPressIn = useCallback(() => { press.value = withTiming(1, { duration: 90 }); turn.startCapture(); }, [press, turn]);
  const onPressOut = useCallback(() => { press.value = withTiming(0, { duration: 200 }); turn.finishCapture(); }, [press, turn]);

  if (!isOpen || Platform.OS === 'web') return null;

  const dark = c.scheme === 'dark';
  const bg: [string, string, string] = dark ? [c.gradientHero[0], c.gradientHero[1], c.gradientHero[2]] : ['#eef4ff', '#f2fbff', '#eafaf6'];
  const holding = turn.state === 'listening';
  const active = turn.state === 'listening' || turn.state === 'speaking';
  const glow = tierGlow(tier);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }} accessibilityViewIsModal>
      <Grad colors={bg} angle="vert" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* ambient tier + persona blooms for depth */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -90, left: -70, width: 280, height: 280, borderRadius: 140, backgroundColor: alpha(glow.accent, dark ? 0.2 : 0.14) }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -80, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: alpha(personaBase(persona, c), dark ? 0.18 : 0.12) }} />

      <View style={{ flex: 1, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }}>
        {/* top bar: close + persona toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={turn.close}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassBorder }}
          >
            <Ionicons name="close" size={22} color={c.text} />
          </Pressable>
          <PersonaToggle persona={persona} onChange={setPersona} femaleLabel={t('voice.female')} maleLabel={t('voice.male')} />
        </View>

        {/* hero: character + state hint + duration + waveform */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <VoiceCharacter persona={persona} state={turn.state} level={turn.level} tier={tier} size={230} />
          <Txt size={font.h3} weight="700" color={turn.state === 'error' ? c.danger : c.text}>{t(stateCopyKey(turn.state))}</Txt>
          {active ? <Txt size={font.metric} weight="700" color={c.muted} style={tnum}>{formatDuration(elapsed)}</Txt> : null}
          <VoiceWaveform level={turn.level} color={personaBase(persona, c)} active={active} />
        </View>

        {/* result cards */}
        <View style={{ gap: spacing.md }}>
          {turn.state === 'error' && turn.error ? (
            <Banner tone="danger" title={t('voice.failed')} message={turn.error} action={{ label: t('common.tryAgain'), onPress: turn.reset }} onDismiss={turn.reset} />
          ) : null}
          {turn.transcript ? (
            <VoiceGlass style={{ padding: spacing.md }}>
              <Field label={t('voice.transcriptLabel')} value={turn.transcript} onChange={turn.setTranscript} multiline hint={t('voice.editHint')} />
            </VoiceGlass>
          ) : null}
          {turn.reply ? (
            <VoiceGlass style={{ padding: spacing.md }}>
              <Txt size={font.cap} weight="600" color={c.muted} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>{t('voice.replyLabel')}</Txt>
              <Txt size={font.body} weight="600" color={c.text} style={{ marginTop: spacing.xs, lineHeight: 22 }}>{turn.reply}</Txt>
            </VoiceGlass>
          ) : null}
        </View>

        {/* dock: hold-to-talk mic */}
        <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
          <Animated.View style={micStyle}>
            <Pressable
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              accessibilityRole="button"
              accessibilityLabel={t('voice.holdToSpeak')}
              style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: holding ? c.primary : c.primarySoft, ...shadow(c, 3) }}
            >
              <Ionicons name="mic" size={34} color={holding ? c.onPrimary : c.primary} />
            </Pressable>
          </Animated.View>
          <Txt size={font.sub} weight="600" color={c.muted}>{t('voice.holdToSpeak')}</Txt>
        </View>
      </View>
    </View>
  );
}

export default VoiceMode;
