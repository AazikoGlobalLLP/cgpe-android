/**
 * The voice-mode entry point: a floating mic button that opens the full-screen `VoiceMode` surface via
 * `useVoiceMode().open()`. Mounted once in `_layout`'s RootNav beside `JobPill`. Native-only and
 * signed-in-only, self-guarded. The heavy surface + the `expo-audio` recorder now live in `VoiceMode`
 * (mounted separately in `_layout`), so this launcher is native-free.
 *
 * The button position is provisional and meant to be tuned on a device (it should clear the tab bar).
 */
import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/store/auth';
import { shadow, useTheme } from '@/theme/theme';
import { useT } from '@/i18n';
import { useVoiceMode } from '@/ui/voice/VoiceModeContext';
import { VOICE_ENABLED } from '@/voice/enabled';

export function VoiceLauncher() {
  const { user } = useAuth();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { open } = useVoiceMode();

  // Hooks are all above this guard, so the guard never changes hook order.
  // VOICE_ENABLED is off: no mic button is rendered, so there is nothing to press and nothing to
  // crash. See `voice/enabled.ts` — the feature also cannot work until OPS sets the two env keys.
  if (!VOICE_ENABLED || Platform.OS === 'web' || !user) return null;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: 18, bottom: insets.bottom + 96 }}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t('voice.title')}
        style={{
          width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
          backgroundColor: c.primary, ...shadow(c, 3),
        }}
      >
        <Ionicons name="mic" size={26} color={c.onPrimary} />
      </Pressable>
    </View>
  );
}

export default VoiceLauncher;
