/**
 * The voice-assistant avatar — a coded Reanimated "orb". This is the SHELL the owner's Lottie
 * character drops into later: the prop interface (`persona` / `state` / `level` / `muted`) is kept 1:1
 * with what a `<LottieView>` needs (state → segment, level → progress, persona → colour), so the
 * internals can be swapped without touching a single call site. It costs nothing in APK size and needs
 * no new dependency (react-native-svg and lottie are both absent), and — because it is JS — it can be
 * tuned without a rebuild, which matters while there is no OTA.
 *
 * All motion is driven from shared values on the UI thread. Amplitude accepts `number | SharedValue`
 * so real mic metering can write `level.value` on the UI thread with ZERO re-render per frame. Every
 * animation is gated on `useReducedMotion()` — reduced motion collapses the orb to a static state chip.
 * `thinking` is a slow sweep, never a spinner (a spinner reads as "loading data").
 */
import React, { useEffect } from 'react';
import { AccessibilityInfo, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, Extrapolation, cancelAnimation, interpolate, interpolateColor,
  useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue,
  withRepeat, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { motion, type, useTheme } from '@/theme/theme';

export type VoiceAvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface VoiceAvatarProps {
  /** Which persona's colourway — kept for the Lottie swap (male/female asset sets). */
  persona: 'male' | 'female';
  state: VoiceAvatarState;
  /** 0..1 mic amplitude. A SharedValue is written on the UI thread → no re-render; a number is synced. */
  level?: number | SharedValue<number>;
  muted?: boolean;
  size?: number;
  /** Optional accent override (e.g. the department accent) — defaults to the persona hue. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/** Local copy of the palette's `alpha` helper (it is module-private in controls.tsx). */
function alpha(hex: string, a: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const clamped = a < 0 ? 0 : a > 1 ? 1 : a;
  return hex + Math.round(clamped * 255).toString(16).padStart(2, '0');
}

const SMOOTH = { duration: motion.smooth.duration, easing: Easing.bezier(...motion.smooth.bezier) };

export function VoiceAvatar({ persona, state, level = 0, muted, size = 96, accent, style }: VoiceAvatarProps) {
  const c = useTheme();
  const reduced = useReducedMotion();

  const base = accent ?? (persona === 'female' ? c.accent : c.primary);
  const glowHue = persona === 'female' ? c.accent : c.primary;

  // ---- amplitude: one UI-thread reader, never setState ----
  const numAmp = useSharedValue(typeof level === 'number' ? level : 0);
  useEffect(() => {
    if (typeof level === 'number') numAmp.value = withTiming(level, { duration: 90 });
  }, [level, numAmp]);
  const amp = useDerivedValue(() => {
    'worklet';
    if (muted) return 0;
    return typeof level === 'number' ? numAmp.value : (level?.value ?? 0);
  });

  // ---- drivers ----
  const phase = useSharedValue(0); // 0..1 repeating (breathe / sweep / ripple)
  const shake = useSharedValue(0); // -1..1 error oscillation
  const err = useSharedValue(0);   // 0..1 colour → danger

  useEffect(() => {
    cancelAnimation(phase);
    cancelAnimation(shake);
    err.value = withTiming(state === 'error' ? 1 : 0, SMOOTH);
    if (reduced) {
      phase.value = 0;
      shake.value = 0;
      return;
    }
    if (state === 'idle') phase.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
    else if (state === 'listening') phase.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    else if (state === 'thinking') phase.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.bezier(...motion.smooth.bezier) }), -1, false); // sweep, NOT spin
    else if (state === 'speaking') phase.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), -1, false); // ripple
    else if (state === 'error') shake.value = withRepeat(withSequence(withTiming(1, { duration: 55 }), withTiming(-1, { duration: 55 })), 6, true);
    return () => {
      cancelAnimation(phase);
      cancelAnimation(shake);
      phase.value = 0;
      shake.value = 0;
    };
  }, [state, reduced, phase, shake, err]);

  const core = useAnimatedStyle(() => {
    const breathe = 1 + 0.04 * Math.sin(phase.value * Math.PI * 2);
    const punch = 1 + amp.value * 0.35;
    return {
      transform: [{ translateX: shake.value * 6 }, { scale: breathe * punch }],
      backgroundColor: interpolateColor(err.value, [0, 1], [base, c.danger]),
    };
  });

  const glow = useAnimatedStyle(() => ({
    opacity: interpolate(amp.value, [0, 1], [0.16, 0.6], Extrapolation.CLAMP) + (state === 'speaking' ? (1 - phase.value) * 0.4 : 0),
    transform: [{ scale: 1 + amp.value * 0.6 + (state === 'speaking' ? phase.value * 0.5 : 0) }],
  }));

  const sweep = useAnimatedStyle(() => ({
    opacity: state === 'thinking' ? Math.max(0, Math.sin(phase.value * Math.PI)) * 0.85 : 0,
    transform: [{ translateX: -size + phase.value * size * 2 }],
  }));

  const label = `Voice ${state}${muted ? ', muted' : ''}`;

  if (reduced) {
    const dot = state === 'error' ? c.danger : muted ? c.muted : base;
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]} accessibilityRole="image" accessibilityLabel={label}>
        <View style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: dot }} />
        <Text style={{ ...type('600', 12), color: c.text }}>{state}</Text>
      </View>
    );
  }

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: '100%', height: '100%', borderRadius: 999, backgroundColor: alpha(glowHue, 0.5) }, glow]} />
      <View style={{ width: size * 0.7, height: size * 0.7, borderRadius: 999, overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', width: '100%', height: '100%', borderRadius: 999, opacity: muted ? 0.4 : 1 }, core]} />
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, bottom: 0, width: size * 0.5, backgroundColor: alpha('#ffffff', 0.5) }, sweep]}
        />
      </View>
      {/* LOTTIE-READY: replace the two Animated.Views above with <LottieView source={ORB[persona]}
          progress={amp} segment-from={state} colorFilters-from={base} /> — the props above are unchanged. */}
    </View>
  );
}

/** Read the device reduce-motion flag once (for callers that need it outside the component). */
export async function prefersReducedMotion(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    return false;
  }
}

export default VoiceAvatar;
