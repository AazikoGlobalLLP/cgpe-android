/**
 * The voice-mode entry point: a floating mic button that opens the `VoiceSheet`. Mounted once in
 * `_layout`'s `RootNav`, right beside `JobPill` — the one place the live navigation context is proven
 * available (JobPill navigates from there), which `VoiceSheet`'s `usePathname`/`useRouter` need.
 *
 * Native-only and only for a signed-in user. Self-contained (its own open state) — no context provider
 * is needed in v1 because nothing else opens voice programmatically yet; a `useVoice()` context can be
 * added later if a screen needs to trigger it.
 *
 * ⚠️ Imports `VoiceSheet` (→ `expo-audio`). That is safe at boot: `expo-audio` is first-party with
 * `.web.js` variants, so web/e2e resolve away from the native module, and on native it is linked; and
 * on web this component returns null before `VoiceSheet` ever renders. It is imported only by
 * `_layout`, which no test reaches — so `expo-audio` never enters the Vitest graph.
 *
 * The button position is provisional and meant to be tuned on a device (it should clear the tab bar).
 */
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/store/auth';
import { shadow, useTheme } from '@/theme/theme';
import { useT } from '@/i18n';
import { VoiceSheet } from '@/ui/VoiceSheet';

export function VoiceLauncher() {
  const { user } = useAuth();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [open, setOpen] = useState(false);

  // Hooks are all above this guard, so the guard never changes hook order.
  if (Platform.OS === 'web' || !user) return null;

  return (
    <>
      {!open ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', right: 18, bottom: insets.bottom + 96 }}>
          <Pressable
            onPress={() => setOpen(true)}
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
      ) : null}
      <VoiceSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default VoiceLauncher;
