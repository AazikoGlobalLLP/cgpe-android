/**
 * A frosted-glass surface for the voice mode's transcript + reply. Unit 1 is a SIMULATED frost
 * (translucent fill + hairline border + a top inner-highlight bevel) — convincing because the voice
 * background is our own controlled gradient. Unit 3 swaps the interior for a real `expo-blur` BlurView,
 * keeping this exact treatment as the fallback (Expo Go / reduced-motion / low-end).
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { shadow, useTheme } from '@/theme/theme';

export function VoiceGlass({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassBorder, borderRadius: c.radius.lg, overflow: 'hidden', ...shadow(c, 1) },
        style,
      ]}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
      {children}
    </View>
  );
}
