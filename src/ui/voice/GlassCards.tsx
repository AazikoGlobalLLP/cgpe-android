/**
 * A frosted-glass surface for the voice mode's transcript + reply. When `expo-blur` is available
 * (`hasBlur()`), it renders a REAL backdrop blur — Android needs `experimentalBlurMethod="dimezisBlurView"`
 * or it degrades to a flat tint — with a subtle theme tint over it for text contrast. Otherwise it falls
 * back to the simulated frost (translucent fill + hairline + inner-highlight bevel), which is convincing
 * because the voice background is our own controlled gradient. Expo Go / web / low-end all get the fallback.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { shadow, useTheme } from '@/theme/theme';
import { hasBlur } from '@/lib/voiceGraphics';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

export function VoiceGlass({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  const dark = c.scheme === 'dark';
  const box: ViewStyle = {
    borderWidth: 1, borderColor: c.glassBorder, borderRadius: c.radius.lg, overflow: 'hidden', ...shadow(c, 1),
  };
  const topHighlight = (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
  );

  if (hasBlur()) {
    return (
      <View style={[box, style]}>
        <BlurView intensity={38} tint={dark ? 'dark' : 'light'} experimentalBlurMethod="dimezisBlurView" style={FILL} />
        {/* contrast tint over the blur so text stays legible even where the blur is weak */}
        <View pointerEvents="none" style={{ ...FILL, backgroundColor: dark ? 'rgba(15,23,36,0.34)' : 'rgba(255,255,255,0.36)' }} />
        {topHighlight}
        {children}
      </View>
    );
  }

  // simulated frost fallback
  return (
    <View style={[box, { backgroundColor: c.glass }, style]}>
      {topHighlight}
      {children}
    </View>
  );
}
