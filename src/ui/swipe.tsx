import React, { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { font, motion, radius as radii, spacing, type, useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/theme';
import type { IconName } from './base';

/* ------------------------------------------------------------------ *
 * swipe — the second gesture a list row owns.
 *
 * A field agent works one-handed, walking, often with the phone in the same hand that is
 * holding a file. Call / WhatsApp / Snooze / Delete are the actions they repeat forty
 * times a day, and reaching them through a row tap, a detail screen and a button is three
 * interactions too many. Swipe-to-reveal puts them one thumb-drag away.
 *
 * FOUR THINGS THAT MAKE OR BREAK THIS COMPONENT:
 *
 *  1. IT MUST NOT EAT VERTICAL SCROLL. `activeOffsetX` means the pan only claims the
 *     touch after 12pt of horizontal travel, and `failOffsetY` gives the gesture up
 *     entirely once the finger has moved 16pt vertically. A diagonal flick therefore
 *     scrolls the list, which is what the hand meant.
 *  2. THE ROW SURFACE IS OPAQUE AND OWNED HERE. It is the only thing hiding the action
 *     panel behind it, so SwipeRow supplies `c.card` itself rather than trusting the child.
 *  3. THE SNAP IS CLAMPED IN THE VIEW, NOT IN THE ANIMATION. `motion.spring` overshoots
 *     by design; letting the row travel past its rails would expose the seam between the
 *     row and the panel behind it. The curve stays, the excursion is absorbed.
 *  4. LONG-PRESS OPENS IT. A gesture with no visible affordance is undiscoverable and
 *     unreachable by anyone who cannot swipe precisely, so long-press is the equivalent
 *     path to the same actions.
 *
 * Reduced motion keeps the gesture and drops the animation: position is assigned, not
 * timed. Withholding the actions would be an accessibility regression, not a courtesy.
 * ------------------------------------------------------------------ */

export type SwipeTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'whatsapp' | 'neutral';

export type SwipeAction = {
  icon: IconName;
  label: string;
  tone: SwipeTone;
  onPress: () => void;
  /** Escape hatch for a palette colour outside the tones. Wins over `tone`. */
  color?: string;
};

function toneColor(c: Palette, tone: SwipeTone): string {
  switch (tone) {
    case 'accent': return c.accent;
    case 'success': return c.success;
    case 'warning': return c.warning;
    case 'danger': return c.danger;
    case 'whatsapp': return c.whatsapp;
    case 'neutral': return c.faint;
    default: return c.primary;
  }
}

/** 78 wide keeps a 44pt target with room for a one-word label under the glyph. */
const ACTION_W = 78;
const MAX_ACTIONS = 2;
const SNAP = { duration: motion.spring.duration, easing: Easing.bezier(...motion.spring.bezier) };
/** Past this flick speed, direction decides the snap regardless of how far the row moved. */
const FLICK_VX = 420;

function buzz() {
  // expo-haptics is a no-op on web and can reject on hardware without a motor. A missing
  // buzz must never surface as an unhandled rejection in a list row.
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    /* no haptics on this platform */
  }
}

export function SwipeRow({
  children, actions, onPress, onLongPress, disabled, radius: r = radii.lg, surface, style,
}: {
  children: React.ReactNode;
  /** 1–2 actions, revealed right to left. Extras are ignored: three is a menu, not a swipe. */
  actions: SwipeAction[];
  onPress?: () => void;
  /** Overrides the default long-press behaviour (which is to reveal the actions). */
  onLongPress?: () => void;
  disabled?: boolean;
  /** Corner radius of the row + its action panel. Defaults to the card radius. */
  radius?: number;
  /** Row surface colour. Must be opaque — it is what conceals the action panel. */
  surface?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const reduced = useReducedMotion();

  const acts = actions.slice(0, MAX_ACTIONS);
  const rail = -ACTION_W * acts.length;
  const skin = surface ?? c.card;

  const x = useSharedValue(0);
  const from = useSharedValue(0);
  /** Mirrors `revealed` on the UI thread so onEnd can tell a real state change from a no-op. */
  const wasOpen = useSharedValue(false);

  const [revealed, setRevealed] = useState(false);
  // The content Pressable fires from the JS thread and needs the current state without
  // waiting for a re-render, so the ref is the authority there.
  const revealedRef = useRef(false);

  const settle = useCallback((next: boolean) => {
    revealedRef.current = next;
    setRevealed(next);
    buzz();
  }, []);

  const slideTo = useCallback((open: boolean) => {
    wasOpen.value = open;
    settle(open);
    x.value = reduced ? (open ? rail : 0) : withTiming(open ? rail : 0, SNAP);
  }, [rail, reduced, settle, wasOpen, x]);

  const pan = Gesture.Pan()
    .enabled(!disabled && acts.length > 0)
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onStart(() => { from.value = x.value; })
    .onUpdate((e) => {
      // Hard rails rather than a rubber band: past the rails there is nothing to show but
      // the seam, so travel there would be a promise the component cannot keep.
      x.value = Math.min(0, Math.max(rail, from.value + e.translationX));
    })
    .onEnd((e) => {
      const wantOpen = e.velocityX < -FLICK_VX ? true
        : e.velocityX > FLICK_VX ? false
        : x.value < rail / 2;
      if (wantOpen !== wasOpen.value) {
        wasOpen.value = wantOpen;
        runOnJS(settle)(wantOpen);        // haptic + JS state, once per real snap
      }
      const to = wantOpen ? rail : 0;
      x.value = reduced ? to : withTiming(to, SNAP);
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(0, Math.max(rail, x.value)) }],
  }));

  // Actions grow into place as they are uncovered, so the panel reads as revealed rather
  // than as a strip that was always sitting there.
  const revealStyle = useAnimatedStyle(() => {
    if (reduced || rail === 0) return { opacity: 1, transform: [{ scale: 1 }] };
    const p = Math.min(1, Math.max(0, x.value / rail));
    return { opacity: 0.35 + 0.65 * p, transform: [{ scale: 0.84 + 0.16 * p }] };
  });

  const interactive = !!onPress || !!onLongPress || acts.length > 0;

  const content = (
    <Pressable
      // `disabled` gated only the pan and the long-press reveal, so a disabled row still
      // fired onPress on a plain tap — it would navigate or run the caller's action despite
      // the documented contract that the row is inert.
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        // An open row consumes the next tap to close itself. Firing the row's own action
        // while two buttons are exposed is how people delete the wrong client.
        if (revealedRef.current) { slideTo(false); return; }
        onPress?.();
      }}
      onLongPress={() => {
        if (disabled) return;
        if (onLongPress) { onLongPress(); return; }
        if (acts.length > 0 && !disabled) slideTo(!revealedRef.current);
      }}
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityState={{ expanded: revealed, disabled: !!disabled }}
      style={({ pressed }) => [{
        backgroundColor: pressed && interactive ? c.cardAlt : 'transparent',
      }]}
    >
      {children}
    </Pressable>
  );

  if (acts.length === 0) {
    return <View style={[{ borderRadius: r, overflow: 'hidden', backgroundColor: skin }, style]}>{content}</View>;
  }

  return (
    <View style={[{ borderRadius: r, overflow: 'hidden', backgroundColor: skin }, style]}>
      {/* Behind the row. Only reachable once the row has moved off it. */}
      <View
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: ACTION_W * acts.length, flexDirection: 'row',
        }}
      >
        {acts.map((a, i) => (
          <Pressable
            key={`${a.label}${i}`}
            onPress={() => { slideTo(false); a.onPress(); }}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={({ pressed }) => [{
              width: ACTION_W,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: a.color ?? toneColor(c, a.tone),
              opacity: pressed ? 0.8 : 1,
            }]}
          >
            <Animated.View style={[{ alignItems: 'center', gap: spacing.xs + 1 }, revealStyle]}>
              <Ionicons name={a.icon} size={20} color={c.onPrimary} />
              <Text
                numberOfLines={1}
                style={{
                  color: c.onPrimary, ...type('700', font.tiny),
                  letterSpacing: 0.2, paddingHorizontal: spacing.xs,
                }}
              >
                {a.label}
              </Text>
            </Animated.View>
          </Pressable>
        ))}
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[{ backgroundColor: skin }, rowStyle]}>
          {content}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
