import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAuth } from '@/store/auth';
import { motion, radius, spacing, useTheme } from '@/theme/theme';
import { Grad, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Loader } from '@/ui/feedback';
import { useReducedMotion } from '@/ui/motion';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * The bottom bar — the one surface that is on screen the entire session.
 *
 * ONE-THUMB ERGONOMICS. Five equal slots, each a full-height flex column, so the target
 * is the whole column and not just the glyph. Every slot keeps its label at all times:
 * the previous bar showed a label only on the active tab, which meant four of the five
 * destinations were an unlabelled icon and the bar had to be learned rather than read.
 *
 * THE GRADIENT LIVES HERE. The brand ramp is rationed to exactly two places in the app,
 * the clock-in ring and this indicator. It is a single travelling pill, not one gradient
 * per tab, so the signature stays scarce. Slots are equal width by construction
 * (flex: 1), so the pill's position is derived from the measured track rather than from
 * per-item layout callbacks.
 * ------------------------------------------------------------------ */

const TAB_META: Record<string, { icon: IconName; active: IconName }> = {
  home: { icon: 'home-outline', active: 'home' },
  tasks: { icon: 'checkbox-outline', active: 'checkbox' },
  clients: { icon: 'people-outline', active: 'people' },
  claims: { icon: 'shield-outline', active: 'shield' },
  more: { icon: 'ellipsis-horizontal', active: 'ellipsis-horizontal' },
};
const ORDER = ['home', 'tasks', 'clients', 'claims', 'more'];

/** Indicator height. The icon is centred inside it, the label sits under it. */
const PILL_H = 32;
/** Horizontal breathing room between the pill and its slot edge. */
const PILL_INSET = 18;
const BAR_PAD_H = spacing.sm;

const SLIDE = { duration: motion.spring.duration, easing: Easing.bezier(...motion.spring.bezier) };

function TabBar({ state, navigation }: BottomTabBarProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const reduced = useReducedMotion();

  // Routes are registered in file order and include ones that never appear in the bar
  // (leads), so the bar builds its own ordered view and keeps each route's real index
  // for the focus comparison.
  const items = useMemo(
    () => state.routes
      .map((route, index) => ({ route, index }))
      .filter((r) => !!TAB_META[r.route.name])
      .sort((a, b) => ORDER.indexOf(a.route.name) - ORDER.indexOf(b.route.name)),
    [state.routes],
  );

  const slot = items.findIndex((r) => r.index === state.index);
  const [trackW, setTrackW] = useState(0);
  const slotW = items.length > 0 ? trackW / items.length : 0;

  const x = useSharedValue(0);
  // The first measurement is applied without animation: sliding in from x=0 on mount
  // reads as a glitch rather than as motion.
  const settled = useRef(false);

  useEffect(() => {
    if (slotW === 0 || slot < 0) return;
    const to = slot * slotW;
    if (!settled.current || reduced) {
      x.value = to;
      settled.current = true;
      return;
    }
    x.value = withTiming(to, SLIDE);
  }, [slot, slotW, reduced, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== trackW) setTrackW(w);
  };

  return (
    <View
      style={{
        backgroundColor: c.bgElevated,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.border,
        paddingTop: spacing.sm,
        // Sits above the gesture bar / navigation bar rather than under it.
        paddingBottom: insets.bottom + spacing.sm,
        paddingHorizontal: BAR_PAD_H,
      }}
    >
      <View onLayout={onLayout} style={{ flexDirection: 'row' }}>
        {slot >= 0 && slotW > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', left: 0, top: 0, width: slotW, height: PILL_H, alignItems: 'center' },
              pill,
            ]}
          >
            <View style={{
              width: Math.max(44, slotW - PILL_INSET),
              height: PILL_H,
              borderRadius: radius.pill,
              overflow: 'hidden',
            }}>
              <Grad colors={c.gradientBrand} angle="horiz" style={{ flex: 1 }} />
            </View>
          </Animated.View>
        ) : null}

        {items.map(({ route, index }) => {
          const focused = state.index === index;
          const meta = TAB_META[route.name];
          const label = t('tab.' + route.name);

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            // Plain navigation gets no haptic — the budget is spent on writes, not on moves.
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              style={{ flex: 1, alignItems: 'center', minHeight: 48 }}
            >
              <View style={{ height: PILL_H, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons
                  name={focused ? meta.active : meta.icon}
                  size={21}
                  // onPrimary, not white: in dark mode the ramp lifts and deep ink is the
                  // legible ink on it.
                  color={focused ? c.onPrimary : c.faint}
                />
              </View>
              <Txt
                size={11}
                weight={focused ? '700' : '500'}
                color={focused ? c.primary : c.muted}
                numberOfLines={1}
                style={{ marginTop: 3 }}
              >
                {label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="clients" />
      <Tabs.Screen name="claims" />
      <Tabs.Screen name="more" />
      {/* Registered but hidden from the bar — reachable from More */}
      <Tabs.Screen name="leads" />
    </Tabs>
  );
}
