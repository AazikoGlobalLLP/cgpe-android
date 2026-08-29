/**
 * The gradient/Reanimated orb — native-free (no Skia, no SVG). It is BOTH the immediate premium
 * character (ships in the native-free foundation) AND the fallback the Skia orb degrades to (Expo Go,
 * web, reduced-motion, low-end devices). A glossy sphere is faked with layered `Grad` fills + a
 * specular cap + a multi-ring translucent aura; amplitude (`level`, a UI-thread SharedValue) and a
 * per-state `phase` drive all motion with zero re-render.
 *
 * Keeps the exact prop contract of the character seam so Skia/Lottie drop into the same call site.
 */
import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, cancelAnimation, interpolate, useAnimatedStyle,
  useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { Grad } from '@/ui/base';
import { motion, useTheme } from '@/theme/theme';
import { personaBase, personaGlow, type Persona, type VoiceCharacterState } from '@/ui/voice/voiceVisual';

export interface OrbStaticProps {
  persona: Persona;
  state: VoiceCharacterState;
  level: SharedValue<number>;
  /** Department glow pair (master gold / admin azure / team teal) for the aura. */
  glow: { accent: string; accent2: string };
  size?: number;
  muted?: boolean;
  reduced?: boolean;
  style?: StyleProp<ViewStyle>;
}

/* -- tiny colour helpers (local; no dependency hunting) -- */
function clamp01(n: number): number { return n < 0 ? 0 : n > 1 ? 1 : n; }
function alpha(hex: string, a: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  return hex + Math.round(clamp01(a) * 255).toString(16).padStart(2, '0');
}
function toRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function mix(hex: string, target: [number, number, number], amt: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const [r, g, b] = toRgb(hex);
  const a = clamp01(amt);
  const m = (x: number, t: number) => Math.round(x + (t - x) * a).toString(16).padStart(2, '0');
  return `#${m(r, target[0])}${m(g, target[1])}${m(b, target[2])}`;
}
const lighten = (h: string, a: number) => mix(h, [255, 255, 255], a);
const darken = (h: string, a: number) => mix(h, [10, 22, 40], a);

const SMOOTH = { duration: motion.smooth.duration, easing: Easing.bezier(...motion.smooth.bezier) };

export function OrbStatic({ persona, state, level, glow, size = 200, muted, reduced, style }: OrbStaticProps) {
  const c = useTheme();
  const base = personaBase(persona, c);
  const glowHue = personaGlow(persona, c);

  const phase = useSharedValue(0);
  const shake = useSharedValue(0);
  const err = useSharedValue(0);
  const amp = useDerivedValue(() => (muted ? 0 : clamp01(level.value)));

  useEffect(() => {
    cancelAnimation(phase);
    cancelAnimation(shake);
    err.value = withTiming(state === 'error' ? 1 : 0, SMOOTH);
    if (reduced) { phase.value = 0; shake.value = 0; return; }
    if (state === 'idle') phase.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true);
    else if (state === 'listening') phase.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    else if (state === 'thinking') phase.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.bezier(...motion.smooth.bezier) }), -1, false);
    else if (state === 'speaking') phase.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), -1, false);
    else if (state === 'error') shake.value = withRepeat(withSequence(withTiming(1, { duration: 55 }), withTiming(-1, { duration: 55 })), 6, true);
    return () => { cancelAnimation(phase); cancelAnimation(shake); phase.value = 0; shake.value = 0; };
  }, [state, reduced, phase, shake, err]);

  const D = size; // full canvas
  const sphere = D * 0.62;
  const cap = sphere * 0.5;

  // outer aura group: breathes, brightens with amplitude, blooms on speaking
  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + amp.value * 0.4 + (state === 'speaking' ? (1 - phase.value) * 0.3 : 0),
    transform: [{ scale: 1 + amp.value * 0.28 + Math.sin(phase.value * Math.PI * 2) * 0.03 + (state === 'speaking' ? phase.value * 0.3 : 0) }],
  }));
  // reactive ring emitted outward
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (state === 'listening' || state === 'speaking') ? interpolate(phase.value, [0, 1], [0.5, 0], 'clamp') : 0,
    transform: [{ scale: 1 + phase.value * (0.4 + amp.value * 0.5) }],
  }));
  // sphere body: breathes, punches with amplitude, recolours to danger on error, shakes on error
  const bodyStyle = useAnimatedStyle(() => {
    const breathe = 1 + 0.04 * Math.sin(phase.value * Math.PI * 2);
    const punch = 1 + amp.value * 0.16;
    return {
      transform: [{ translateX: shake.value * 7 }, { scale: breathe * punch }],
      opacity: muted ? 0.55 : 1,
    };
  });
  const bodyTint = useAnimatedStyle(() => ({ opacity: err.value * 0.85 }));
  // specular highlight drifts slightly so it isn't dead-static
  const capStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.sin(phase.value * Math.PI * 2) * 3 }, { translateY: Math.cos(phase.value * Math.PI * 2) * 2 }],
  }));
  // thinking sweep band across the sphere
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: state === 'thinking' ? Math.max(0, Math.sin(phase.value * Math.PI)) * 0.8 : 0,
    transform: [{ translateX: -sphere + phase.value * sphere * 2 }],
  }));

  const circle = (d: number): ViewStyle => ({ width: d, height: d, borderRadius: d / 2 });

  return (
    <View style={[circle(D), { alignItems: 'center', justifyContent: 'center' }, style]} accessibilityRole="image" accessibilityLabel={`Voice ${state}`}>
      {/* aura: three stacked translucent circles approximating a soft bloom */}
      <Animated.View style={[{ position: 'absolute' }, auraStyle]} pointerEvents="none">
        <View style={[circle(D), { position: 'absolute', left: -D / 2, top: -D / 2, backgroundColor: alpha(glow.accent, 0.16) }]} />
        <View style={[circle(D * 0.8), { position: 'absolute', left: -D * 0.4, top: -D * 0.4, backgroundColor: alpha(glowHue, 0.22) }]} />
        <View style={[circle(D * 0.6), { position: 'absolute', left: -D * 0.3, top: -D * 0.3, backgroundColor: alpha(glowHue, 0.3) }]} />
      </Animated.View>

      {/* reactive sonar ring */}
      <Animated.View style={[circle(sphere), { position: 'absolute', borderWidth: 2, borderColor: alpha(glow.accent2, 0.5) }, ringStyle]} pointerEvents="none" />

      {/* sphere body */}
      <Animated.View style={[circle(sphere), { overflow: 'hidden' }, bodyStyle]}>
        <Grad colors={[lighten(base, 0.32), base, darken(base, 0.5)]} angle="vert" style={{ ...circle(sphere), position: 'absolute' }} />
        {/* diagonal gloss sheen */}
        <Grad colors={[alpha('#ffffff', 0.34), alpha('#ffffff', 0), alpha('#04121f', 0.16)]} angle="diag" style={{ ...circle(sphere), position: 'absolute' }} />
        {/* lower-hemisphere deepen */}
        <Grad colors={[alpha('#04121f', 0), alpha('#04121f', 0.22)]} angle="vert" style={{ ...circle(sphere), position: 'absolute' }} />
        {/* error tint */}
        <Animated.View style={[circle(sphere), { position: 'absolute', backgroundColor: c.danger }, bodyTint]} />
        {/* thinking sweep */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, width: sphere * 0.45, backgroundColor: alpha('#ffffff', 0.5) }, sweepStyle]} />
        {/* specular highlight cap */}
        <Animated.View style={[{ position: 'absolute', left: sphere * 0.16, top: sphere * 0.12, width: cap, height: cap * 0.72, borderRadius: cap / 2, overflow: 'hidden' }, capStyle]} pointerEvents="none">
          <Grad colors={[alpha('#ffffff', 0.7), alpha('#ffffff', 0)]} angle="vert" style={{ width: cap, height: cap, borderRadius: cap / 2 }} />
        </Animated.View>
      </Animated.View>

      {/* fresnel rim */}
      <View style={[circle(sphere), { position: 'absolute', borderWidth: 1, borderColor: alpha(glow.accent2, 0.55) }]} pointerEvents="none" />
    </View>
  );
}

export default OrbStatic;
