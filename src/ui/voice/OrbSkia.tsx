/**
 * The heavy character — a glossy liquid orb rendered with @shopify/react-native-skia: a real radial
 * gradient sphere with a specular highlight, a fresnel rim, a blurred multi-layer glow aura, and a
 * reactive ring that rides the live mic amplitude. All geometry is a Reanimated derived value read on
 * the UI thread, so Skia repaints at 60 fps with ZERO React re-render.
 *
 * ⚠️ This module statically imports Skia (which is NOT in Expo Go and not usable on web), so it must be
 * reached ONLY behind the `hasSkia()` probe + `React.lazy` in `VoiceCharacter` — never a static import
 * from a file the boot/route graph evaluates. Default export, prop contract identical to OrbStatic.
 */
import React, { useEffect } from 'react';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { Blur, Canvas, Circle, Group, Paint, RadialGradient, vec } from '@shopify/react-native-skia';
import { motion, useTheme } from '@/theme/theme';
import { personaBase, personaGlow, type Persona, type VoiceCharacterState } from '@/ui/voice/voiceVisual';

export interface OrbSkiaProps {
  persona: Persona;
  state: VoiceCharacterState;
  level: SharedValue<number>;
  glow: { accent: string; accent2: string };
  size?: number;
  muted?: boolean;
}

function clamp01(n: number): number {
  'worklet';
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function toRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function mix(hex: string, target: [number, number, number], amt: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const [r, g, b] = toRgb(hex);
  const a = amt < 0 ? 0 : amt > 1 ? 1 : amt;
  const m = (x: number, t: number) => Math.round(x + (t - x) * a).toString(16).padStart(2, '0');
  return `#${m(r, target[0])}${m(g, target[1])}${m(b, target[2])}`;
}
const lighten = (h: string, a: number) => mix(h, [255, 255, 255], a);
const darken = (h: string, a: number) => mix(h, [8, 20, 40], a);

export function OrbSkia({ persona, state, level, glow, size = 230, muted }: OrbSkiaProps) {
  const c = useTheme();
  const base = personaBase(persona, c);
  const glowHue = personaGlow(persona, c);
  const cx = size / 2;
  const cy = size / 2;
  const sphereR = size * 0.3;
  const glowR = size * 0.44;

  const phase = useSharedValue(0);
  const shake = useSharedValue(0);
  const err = useSharedValue(0);
  const amp = useDerivedValue(() => (muted ? 0 : clamp01(level.value)));

  useEffect(() => {
    cancelAnimation(phase);
    cancelAnimation(shake);
    err.value = withTiming(state === 'error' ? 1 : 0, { duration: motion.smooth.duration });
    if (state === 'idle') phase.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true);
    else if (state === 'listening') phase.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    else if (state === 'thinking') phase.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
    else if (state === 'speaking') phase.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), -1, false);
    else if (state === 'error') shake.value = withRepeat(withSequence(withTiming(1, { duration: 55 }), withTiming(-1, { duration: 55 })), 6, true);
    return () => { cancelAnimation(phase); cancelAnimation(shake); phase.value = 0; shake.value = 0; };
  }, [state, phase, shake, err]);

  // container shake (Skia geometry stays put; the whole canvas nudges on error)
  const wrapStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value * 7 }] }));

  // animated Skia geometry (UI thread)
  const coreScale = useDerivedValue(() => 1 + 0.04 * Math.sin(phase.value * Math.PI * 2) + amp.value * 0.14);
  const coreTransform = useDerivedValue(() => [{ translateX: cx }, { translateY: cy }, { scale: coreScale.value }, { translateX: -cx }, { translateY: -cy }]);
  const glowOpacity = useDerivedValue(() => 0.22 + amp.value * 0.5 + (state === 'speaking' ? (1 - phase.value) * 0.3 : 0));
  const ringR = useDerivedValue(() => sphereR + amp.value * size * 0.12 + (state === 'listening' || state === 'speaking' ? phase.value * size * 0.1 : 0));
  const ringOpacity = useDerivedValue(() => (state === 'listening' || state === 'speaking' ? (1 - phase.value) * 0.55 : 0.18));

  const bodyColors = [lighten(base, 0.34), base, darken(base, 0.55)];
  const specR = sphereR * 0.55;

  return (
    <Animated.View style={[{ width: size, height: size }, wrapStyle]}>
      <Canvas style={{ width: size, height: size }}>
        {/* blurred aura glow */}
        <Group opacity={glowOpacity}>
          <Circle cx={cx} cy={cy} r={glowR}>
            <RadialGradient c={vec(cx, cy)} r={glowR} colors={[glow.accent, glowHue, `${glowHue}00`]} />
            <Blur blur={26} />
          </Circle>
        </Group>

        {/* reactive ring */}
        <Group opacity={ringOpacity}>
          <Circle cx={cx} cy={cy} r={ringR} style="stroke" strokeWidth={2} color={glow.accent2} />
        </Group>

        {/* glossy sphere */}
        <Group transform={coreTransform}>
          <Circle cx={cx} cy={cy} r={sphereR}>
            <RadialGradient c={vec(cx - sphereR * 0.32, cy - sphereR * 0.36)} r={sphereR * 1.5} colors={bodyColors} />
          </Circle>
          {/* error tint */}
          <Group opacity={err}>
            <Circle cx={cx} cy={cy} r={sphereR} color={c.danger} />
          </Group>
          {/* fresnel rim */}
          <Circle cx={cx} cy={cy} r={sphereR} style="stroke" strokeWidth={1.5} color={glow.accent2}>
            <Paint style="stroke" strokeWidth={1.5} color={glow.accent2} opacity={0.6} />
          </Circle>
          {/* specular highlight */}
          <Circle cx={cx - sphereR * 0.3} cy={cy - sphereR * 0.34} r={specR}>
            <RadialGradient c={vec(cx - sphereR * 0.3, cy - sphereR * 0.34)} r={specR} colors={['#ffffffcc', '#ffffff00']} />
            <Blur blur={5} />
          </Circle>
        </Group>
      </Canvas>
    </Animated.View>
  );
}

export default OrbSkia;
