/**
 * A voice waveform — a row of bars whose heights ride the live mic amplitude (`level`, a UI-thread
 * SharedValue) with a centre-weighted travelling envelope. All motion is on the UI thread (zero
 * re-render). Native-free; the Skia particle visualizer (unit 3) is an upgrade behind the same idea.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';

function Bar({ i, count, level, phase, color, height }: {
  i: number; count: number; level: SharedValue<number>; phase: SharedValue<number>; color: string; height: number;
}) {
  const style = useAnimatedStyle(() => {
    const mid = (count - 1) / 2;
    const center = 1 - Math.abs(i - mid) / mid; // 1 at centre, 0 at the edges
    const flow = 0.5 + 0.5 * Math.sin(phase.value * Math.PI * 2 + i * 0.55);
    const lv = level.value < 0 ? 0 : level.value > 1 ? 1 : level.value;
    const s = 0.1 + lv * (0.25 + 0.75 * center) * flow;
    return { transform: [{ scaleY: s < 0.08 ? 0.08 : s }] };
  });
  return <Animated.View style={[{ width: 4, height, borderRadius: 3, backgroundColor: color }, style]} />;
}

export function VoiceWaveform({
  level, color, active, count = 22, height = 44,
}: {
  level: SharedValue<number>; color: string; active: boolean; count?: number; height?: number;
}) {
  const phase = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(phase);
    if (active) phase.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    else phase.value = withTiming(0, { duration: 200 });
    return () => cancelAnimation(phase);
  }, [active, phase]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height }}>
      {Array.from({ length: count }).map((_, i) => (
        <Bar key={i} i={i} count={count} level={level} phase={phase} color={color} height={height} />
      ))}
    </View>
  );
}
