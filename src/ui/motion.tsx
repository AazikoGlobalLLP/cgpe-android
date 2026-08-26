/**
 * Motion — entrance choreography for the design system.
 *
 * MOTION IS MOTIVATED, NEVER DECORATIVE. Every animation here answers one of exactly
 * three questions, and anything that answers none of them does not belong in the app:
 *
 *   · HIERARCHY   — what should the eye land on first? (staggered list entrance)
 *   · FEEDBACK    — did my touch register? (press scale)
 *   · TRANSITION  — did this value actually change? (count-up on a metric)
 *
 * There are no infinite loops in this module. A perpetually pulsing card communicates
 * nothing after the first second and costs a GPU frame forever. The one exception in the
 * codebase is the skeleton shimmer, which lives in feedback.tsx and stops when data lands.
 *
 * REDUCED MOTION IS HONOURED EVERYWHERE. `useReducedMotion` reads the OS accessibility
 * setting and every component below collapses to its final state instantly when it is on.
 * Vestibular disorders are common and an insurance field app is not the place to be cute
 * about it. The flag is read once at mount and subscribed for changes.
 *
 * CURVES COME FROM THE PANEL. `motion.enter` / `motion.smooth` / `motion.spring` in
 * theme.tsx are the same beziers the admin panel's tailwind config uses, so a user moving
 * between the web panel and this app feels one product.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@/theme/theme';

/* ------------------------------------------------------------------ *
 * useReducedMotion
 *
 * Subscribes to the OS setting rather than reading it once, because a user can toggle
 * it from the notification shade without backgrounding the app.
 * ------------------------------------------------------------------ */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setReduced(!!v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      if (alive) setReduced(!!v);
    });
    return () => {
      alive = false;
      // RN >= 0.65 returns a subscription object; older returned void.
      (sub as { remove?: () => void } | undefined)?.remove?.();
    };
  }, []);

  return reduced;
}

const ENTER_EASING = Easing.bezier(...motion.enter.bezier);

/* ------------------------------------------------------------------ *
 * Appear — the standard entrance.
 *
 * Fades up 10px over the panel's `section-in` curve. `index` multiplies the stagger step
 * so a mapped list orchestrates itself without the parent tracking anything:
 *
 *     {rows.map((r, i) => <Appear key={r.id} index={i}><Row .../></Appear>)}
 *
 * STAGGER IS CAPPED at `maxStagger` (default 6 slots ≈ 240ms). Without a cap, the 40th
 * row of a 9,000-client list would wait 1.6 seconds to appear, which reads as jank rather
 * than choreography. Past the cap every remaining row shares the last delay.
 * ------------------------------------------------------------------ */
export function Appear({
  children, index = 0, delay = 0, distance = 10, maxStagger = 6, style,
}: {
  children: React.ReactNode;
  /** Position in a list. Multiplies the stagger step. */
  index?: number;
  /** Extra delay in ms applied on top of the staggered offset. */
  delay?: number;
  /** Vertical travel in px. Use 0 for elements that must not shift layout. */
  distance?: number;
  /** Cap on staggered slots, so long lists do not trail. */
  maxStagger?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    const offset = delay + Math.min(index, maxStagger) * motion.stagger;
    progress.value = withDelay(
      offset,
      withTiming(1, { duration: motion.enter.duration, easing: ENTER_EASING }),
    );
    /*
     * PHASE 77 — AN INTERRUPTED ENTRANCE MUST NOT LEAVE CONTENT INVISIBLE.
     *
     * `progress` drives opacity, so 0 means "not painted". The old cleanup was a bare
     * `cancelAnimation(progress)`, and cancelAnimation FREEZES a shared value wherever it stands
     * — inside the `withDelay` window that is still exactly 0 (reanimated's `delay()` returns the
     * START value until the delay elapses). So a teardown mid-entrance could strand a subtree at
     * opacity 0 while its siblings painted normally. Settling at 1 instead costs nothing when the
     * entrance already finished (reanimated short-circuits an equal-value write) and makes that
     * strand impossible. The trade is that an entrance interrupted partway snaps to its end state
     * rather than continuing: a missed flourish is invisible, a missed element is a bug report.
     *
     * ⚠️ THIS IS LATENT-BUG HARDENING. IT IS NOT THE FIX FOR THE More→Today BLANK SCREEN, and it
     * was very nearly shipped as one. The recorded prime suspect for that bug was this exact line,
     * and it is WRONG: at every Home call site `Appear`'s deps (`index`, `delay`, `maxStagger`,
     * `reduced`, `progress`) are constants, so this effect runs once at mount and its cleanup runs
     * once at unmount — there is no third occasion on a tab switch. react-freeze is off
     * (`react-native-screens` ships `ENABLE_FREEZE = false` and nothing calls `enableFreeze()`),
     * there is no `unmountOnBlur`, and `BottomTabView` only ever appends to its `loaded` list, so
     * the Today screen is natively detached on blur but never unmounted from React. On top of
     * that, reanimated 4.5's `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS` pushes a settled
     * `opacity: 1` into React's own committed props within ~1 s of a successful entrance, which
     * survives any later re-render or re-attach. Do not re-file this line as the cause without a
     * device repro — see docs/PHASES.md for the two zero-build tests that discriminate it.
     */
    return () => {
      cancelAnimation(progress);
      progress.value = 1;
    };
  }, [reduced, index, delay, maxStagger, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/* ------------------------------------------------------------------ *
 * Press — tactile feedback on touch.
 *
 * A 0.97 scale on press-in. This is the physical-push cue: without it a flat card gives
 * the thumb no acknowledgement and the app feels dead under the finger. Pair it with a
 * haptic only for actions that COMMIT something; navigation gets the scale alone.
 *
 * Returns handlers rather than wrapping Pressable, so it composes with any pressable the
 * screen already has (including the ones inside controls.tsx).
 * ------------------------------------------------------------------ */
export function usePressScale(to = 0.97) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = () => {
    if (reduced) return;
    scale.value = withTiming(to, { duration: 90, easing: ENTER_EASING });
  };
  const onPressOut = () => {
    if (reduced) return;
    scale.value = withTiming(1, { duration: 160, easing: ENTER_EASING });
  };

  return { style, onPressIn, onPressOut };
}

/* ------------------------------------------------------------------ *
 * CountUp — a number that animates to its new value.
 *
 * Used ONLY where the change itself is the information: the task-progress figure on home,
 * portfolio totals, the live campaign counter. A number that counts up on every screen
 * mount is decoration; a number that counts up when it CHANGED is feedback.
 *
 * Deliberately not a worklet-driven text node. Reanimated cannot drive `children` on the
 * UI thread, so this steps on the JS thread at ~30fps for a short burst. That is cheap for
 * a handful of figures and avoids pulling in a text-specific animation dependency.
 * ------------------------------------------------------------------ */
export function useCountUp(value: number, duration = 620): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    if (from === value) return;

    const started = Date.now();
    const step = 33;
    if (rafRef.current) clearInterval(rafRef.current);

    rafRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / duration);
      // easeOutCubic — fast start, settles gently. Matches the entrance curve's feel.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t >= 1) {
        if (rafRef.current) clearInterval(rafRef.current);
        rafRef.current = null;
        fromRef.current = value;
      }
    }, step);

    return () => {
      if (rafRef.current) clearInterval(rafRef.current);
      rafRef.current = null;
      fromRef.current = value;
    };
  }, [value, duration, reduced]);

  return display;
}

export default Appear;
