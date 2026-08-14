import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useReducedMotion,
  useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, shadow, tnum, type, useTheme } from '@/theme/theme';

/* ------------------------------------------------------------------ *
 * sheet — the app's one modal surface.
 *
 * Everything that is not a whole screen happens here: pick a filter, choose a template,
 * read a policy summary, confirm a callback. A sheet keeps the screen behind it visible,
 * which is why it beats a pushed route for anything the user is about to come straight
 * back from.
 *
 * HOW THE ANIMATION IS WIRED, because the naive version has two visible bugs:
 *
 *  1. `mounted` lags `visible` on the way out. RN's Modal unmounts instantly, so closing
 *     on `visible` alone would delete the sheet before it could slide away. The exit
 *     animation's completion callback is what unmounts it.
 *  2. The slide distance is the sheet's own measured height, not the screen's. Sliding a
 *     200pt sheet across 900pt of screen in 400ms is a whoosh, not a sheet. Until the
 *     first layout pass reports a height, `y` sits at a full screen height — off-screen
 *     and therefore invisible — so no frame is ever painted at the wrong position.
 *
 * `motion.spring` overshoots (bezier y1 = 1.275). That is wanted: the sheet settles
 * rather than stops. The overshoot lifts the panel a few points clear of the bottom edge,
 * which a filler strip below the sheet covers — otherwise the scrim flashes underneath.
 *
 * No gradient here. This is a surface, and `c.gradientBrand` is rationed to the clock-in
 * ring and the active tab indicator.
 * ------------------------------------------------------------------ */

const EASE_SPRING = Easing.bezier(...motion.spring.bezier);
const EASE_SMOOTH = Easing.bezier(...motion.smooth.bezier);

/** In on the spring (settles), out on the smooth curve (a dismissal should not bounce). */
const OPEN = { duration: motion.spring.duration, easing: EASE_SPRING };
const CLOSE = { duration: motion.smooth.duration, easing: EASE_SMOOTH };

const GRAB_W = 40;
const GRAB_H = 4;
/** Covers the spring's overshoot past the bottom edge. */
const UNDERLAP = 72;
/** Fraction of the sheet you must drag down before release dismisses instead of snapping back. */
const DISMISS_AT = 0.3;
const FLICK_VY = 900;

export function Sheet({
  visible, onClose, title, children, height = 'auto', subtitle, scroll = true, footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** 'auto' sizes to content (capped to the screen); a number pins the height. */
  height?: 'auto' | number;
  subtitle?: string;
  /** Set false when the children own their own scroller (a FlatList, a map, a chat log). */
  scroll?: boolean;
  /** Pinned below the scroll area — Apply/Reset bars belong here, not in `children`. */
  footer?: React.ReactNode;
}) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const reduced = useReducedMotion();

  const [mounted, setMounted] = useState(visible);
  const [h, setH] = useState(0);
  /** Which animation the sheet last ran. Guards against a content resize re-opening it. */
  const phase = useRef<'closed' | 'open'>('closed');

  // Starts a full screen below the fold: any frame painted before the first measurement
  // is off-screen, so there is nothing to hide with an opacity trick.
  const y = useSharedValue(win.height);
  const dragFrom = useSharedValue(0);

  const travel = h || win.height;

  // Mount first so the sheet can be measured; the slide-in waits for that measurement.
  useEffect(() => { if (visible) setMounted(true); }, [visible]);

  useEffect(() => {
    if (visible) {
      if (h === 0 || phase.current === 'open') return;   // unmeasured, or already up
      phase.current = 'open';
      y.value = h;                                        // park at the rail, then travel
      y.value = reduced ? 0 : withTiming(0, OPEN);
      return;
    }
    if (phase.current !== 'open') {
      // Never animated open — `visible` went true then false before the first onLayout
      // committed `h`, so the open branch above bailed at `h === 0`.
      //
      // This MUST still unmount. Returning early here leaves the Modal up forever with a
      // scrim that computes to opacity 0 but still absorbs every touch (an opacity-0 View
      // is not pointer-transparent in RN), and its dismiss Pressable calls an onClose whose
      // `visible` is already false — so nothing can ever clear it and the whole app is
      // locked behind an invisible overlay.
      if (mounted) { y.value = win.height; setMounted(false); }
      return;
    }
    phase.current = 'closed';
    if (reduced) { y.value = travel; setMounted(false); return; }
    y.value = withTiming(travel, CLOSE, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [visible, h, reduced, travel, y, mounted, win.height]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  // Scrim tracks the sheet's position, so a drag-dismiss dims out under the finger.
  // Clamped: the spring's overshoot would otherwise push opacity past 1.
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, travel], [1, 0], Extrapolation.CLAMP),
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    if (next > 0 && next !== h) setH(next);
  };

  /**
   * Drag lives on the header only. A pan over the body would fight the ScrollView, and
   * `activeOffsetY(10)` keeps a tap on the title from being read as a 0px drag.
   */
  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-20)
    .onStart(() => { dragFrom.value = y.value; })
    .onUpdate((e) => { y.value = Math.max(0, dragFrom.value + e.translationY); })
    .onEnd((e) => {
      if (y.value > travel * DISMISS_AT || e.velocityY > FLICK_VY) {
        // The caller owns `visible`; it flips false and the close effect finishes the
        // travel from wherever the finger let go, so the motion stays continuous.
        runOnJS(onClose)();
        return;
      }
      y.value = reduced ? 0 : withTiming(0, OPEN);
    });

  // Unmounted rather than hidden: a closed sheet must not keep its children rendered,
  // or every list inside every sheet in the app stays live behind the screen.
  if (!mounted) return null;

  const bodyPad = {
    paddingHorizontal: spacing.xl,
    paddingBottom: footer ? spacing.md : insets.bottom + spacing.xl,
  };

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Gesture handlers inside an RN Modal need their own root on Android. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }, scrimStyle]}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ flex: 1 }}
            />
          </Animated.View>

          <Animated.View
            onLayout={onLayout}
            accessibilityViewIsModal
            style={[
              {
                backgroundColor: c.bgElevated,
                borderTopLeftRadius: radius.xxl,
                borderTopRightRadius: radius.xxl,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor: c.border,
                maxHeight: win.height - insets.top - spacing.xxl,
                ...(typeof height === 'number' ? { height } : null),
                ...shadow(c, 2),
              },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={{
                paddingTop: spacing.sm,
                paddingHorizontal: spacing.xl,
                paddingBottom: title ? spacing.md : spacing.sm,
              }}>
                <View style={{
                  width: GRAB_W, height: GRAB_H, borderRadius: GRAB_H,
                  backgroundColor: c.border, alignSelf: 'center',
                }} />
                {title ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      {/* Matches Header's h2/800/-0.4 so a sheet title and a screen title
                          are the same voice. */}
                      <Text numberOfLines={1} style={{ color: c.text, ...type('800', font.h2), letterSpacing: -0.4 }}>
                        {title}
                      </Text>
                      {subtitle ? (
                        <Text numberOfLines={2} style={{ color: c.muted, ...type('400', font.sub), marginTop: 1 }}>
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={onClose}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      style={({ pressed }) => [{
                        width: 34, height: 34, borderRadius: 17, marginTop: -2,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: pressed ? c.cardAlt : 'transparent',
                      }]}
                    >
                      <Ionicons name="close" size={20} color={c.muted} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </GestureDetector>

            {scroll ? (
              <ScrollView
                // flexGrow 0 lets an 'auto' sheet hug its content; a pinned-height sheet
                // needs the scroller to fill what is left over instead.
                style={{ flexGrow: typeof height === 'number' ? 1 : 0, flexShrink: 1 }}
                contentContainerStyle={bodyPad}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[{ flexShrink: 1 }, bodyPad]}>{children}</View>
            )}

            {footer ? (
              <View style={{
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.md,
                paddingBottom: insets.bottom + spacing.md,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: c.hairline,
              }}>
                {footer}
              </View>
            ) : null}

            {/* Fills the gap the spring's overshoot opens under the sheet. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, right: 0, bottom: -UNDERLAP,
                height: UNDERLAP, backgroundColor: c.bgElevated,
              }}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/* ================================================================== *
 * FilterSheet
 * ================================================================== */

export type FilterOption = { key: string; label: string; count?: number };
export type FilterGroup = {
  key: string;
  label: string;
  /** 'single' keeps one option per group; 'multi' accumulates them. */
  mode: 'single' | 'multi';
  options: FilterOption[];
};

const CHIP_H = 36;
/** Chips wrap with an 8pt row gap, so 4pt of slop reaches 44 without stealing neighbours. */
const CHIP_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };
const BAR_H = 48;

/**
 * Chip drawn here rather than reused from controls' `Chips`, which is a single-select
 * control over one shared value. A filter group needs multi-select, an unset state, and a
 * tick that says "selected" instead of "current" — different semantics, same visual
 * language (pill, primary fill, onPrimary ink).
 */
function OptionChip({ label, count, selected, multi, onPress }: {
  label: string; count?: number; selected: boolean; multi: boolean; onPress: () => void;
}) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={CHIP_SLOP}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [{
        minHeight: CHIP_H, paddingHorizontal: 13, borderRadius: radius.pill,
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
        backgroundColor: selected ? c.primary : c.card,
        borderWidth: 1, borderColor: selected ? c.primary : c.border,
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }]}
    >
      {selected ? (
        <Ionicons name={multi ? 'checkmark' : 'checkmark-circle'} size={13} color={c.onPrimary} />
      ) : null}
      <Text numberOfLines={1} style={{ color: selected ? c.onPrimary : c.muted, ...type('700', font.sub) }}>
        {label}
      </Text>
      {count != null ? (
        <View style={{
          backgroundColor: selected ? c.primaryDark : c.cardAlt,
          borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1,
        }}>
          <Text style={{ color: selected ? c.onPrimary : c.muted, ...type('800', font.tiny), ...tnum }}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Footer bar button. Local for the same reason as OptionChip: two shapes, no new module. */
function BarBtn({ label, onPress, tone, disabled, flex, style }: {
  label: string; onPress: () => void; tone: 'solid' | 'outline'; disabled?: boolean;
  flex: number; style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { radius, font } = c;
  const solid = tone === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [{
        flex, height: BAR_H, borderRadius: radius.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: solid ? (pressed ? c.primaryDark : c.primary) : (pressed ? c.cardAlt : c.card),
        borderWidth: solid ? 0 : 1,
        borderColor: c.border,
        opacity: disabled ? 0.45 : 1,
      }, style]}
    >
      <Text numberOfLines={1} style={{ color: solid ? c.onPrimary : c.text, ...type('700', font.body), letterSpacing: 0.2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * FilterSheet — a Sheet preset for the filter bar every list screen needs.
 *
 * Filters apply live (`onChange` fires on every tap) rather than on an Apply press. The
 * list is behind the sheet and its counts update as you go, which is the whole reason to
 * use a sheet instead of a route; the footer button therefore just dismisses.
 *
 * In a 'single' group, tapping the selected option CLEARS it. There is no synthesised
 * "All" chip, so without that the first tap would lock the group into a state the user
 * cannot leave. Callers who want an explicit All should pass it as an option.
 */
export function FilterSheet({
  visible, onClose, groups, value, onChange, onReset, title = 'Filters', applyLabel = 'Show results',
}: {
  visible: boolean;
  onClose: () => void;
  groups: FilterGroup[];
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  onReset?: () => void;
  title?: string;
  applyLabel?: string;
}) {
  const c = useTheme();
  const { spacing, font } = c;

  const active = groups.reduce((n, g) => n + (value[g.key]?.length ?? 0), 0);

  const toggle = (g: FilterGroup, optKey: string) => {
    const cur = value[g.key] ?? [];
    const has = cur.includes(optKey);
    const next = g.mode === 'single'
      ? (has ? [] : [optKey])
      : has ? cur.filter((k) => k !== optKey) : [...cur, optKey];
    onChange({ ...value, [g.key]: next });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={active > 0 ? `${active} filter${active === 1 ? '' : 's'} applied` : 'Showing everything'}
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {onReset ? (
            <BarBtn label="Reset" tone="outline" flex={1} disabled={active === 0} onPress={onReset} />
          ) : null}
          <BarBtn label={applyLabel} tone="solid" flex={1.5} onPress={onClose} />
        </View>
      }
    >
      <View style={{ gap: spacing.xl, paddingTop: spacing.xs }}>
        {groups.map((g) => {
          const sel = value[g.key] ?? [];
          return (
            <View key={g.key} style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ color: c.faint, ...type('600', 11), letterSpacing: 0.8, textTransform: 'uppercase', flex: 1 }} numberOfLines={1}>
                  {g.label}
                </Text>
                {g.mode === 'multi' && sel.length > 0 ? (
                  <Text style={{ color: c.primary, ...type('700', font.cap), ...tnum }}>{sel.length}</Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {g.options.map((o) => (
                  <OptionChip
                    key={o.key}
                    label={o.label}
                    count={o.count}
                    multi={g.mode === 'multi'}
                    selected={sel.includes(o.key)}
                    onPress={() => toggle(g, o.key)}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}
