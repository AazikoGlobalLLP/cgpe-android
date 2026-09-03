/**
 * A frosted-glass surface for the voice mode's transcript + reply. When `expo-blur` is available
 * (`hasBlur()`), it renders a REAL backdrop blur — Android needs `experimentalBlurMethod="dimezisBlurView"`
 * or it degrades to a flat tint — with a subtle theme tint over it for text contrast. Otherwise it falls
 * back to the simulated frost (translucent fill + hairline + inner-highlight bevel), which is convincing
 * because the voice background is our own controlled gradient. Expo Go / web / low-end all get the fallback.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
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

  // ⚠️ `hasBlur()` is FALSE for now — see the header of `lib/voiceGraphics.ts`. This branch is one of
  // the two suspects for the 2026-09-01 mic-button crash and is switched off until a real handset
  // proves it. Kept (not deleted) so re-enabling is one flag; two things must stay right when it is:
  //   • `blurMethod`, NOT `experimentalBlurMethod` — the latter is `@deprecated`/`@hidden` in
  //     expo-blur 57 and only aliases the former, so shipping it merely dates the call site.
  //   • this library renders a real backdrop blur in native code; if it aborts, it aborts the
  //     PROCESS. No try/catch and no error boundary around it means anything.
  if (hasBlur()) {
    // Lazy require, NOT a top-level import: expo-blur is a native module and GlassCards is reached at
    // boot (VoiceMode <- _layout), so a static import would run its module scope at startup — the
    // documented native-module-scope-throw danger zone that the Skia/Lottie probes already dodge.
    // hasBlur() has already require()'d expo-blur successfully and cached it, so this resolve is
    // guaranteed and free.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above; must not eval at boot
    const { BlurView } = require('expo-blur') as typeof import('expo-blur');
    return (
      <View style={[box, style]}>
        <BlurView intensity={38} tint={dark ? 'dark' : 'light'} blurMethod="dimezisBlurView" style={FILL} />
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
