import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { motion, radius, tnum, type, useTheme } from '@/theme/theme';
import type { IconName } from './base';

/* ------------------------------------------------------------------ *
 * The date-spine — this app's signature structure.
 *
 * WHY THIS EXISTS, and why it replaces a tile grid:
 *
 * An advisor's book is a calendar. The backend models it that way: `clients` is one row
 * per POLICY carrying dob / fupDate / maturity, and services/greetingEngine.js exists
 * purely to answer "who comes due, and when". The work is date-ordered.
 *
 * A 4-across grid of pastel action tiles — what the app shipped with, and what every
 * template dashboard ships with — encodes nothing. It is decoration in the shape of
 * navigation. The spine encodes the one thing that is actually true about the data:
 * sequence in time. Structural devices should carry information, so the rule, the node,
 * and the time gutter each mean something.
 *
 * Layout: [ time gutter ][ rule + node ][ content ]. Each row draws its own rule
 * segment with flex:1, so the line grows to the row's true height and terminates
 * cleanly at the last node instead of running past it.
 * ------------------------------------------------------------------ */

const TIME_W = 48;
const RAIL_W = 18;
const DOT = 9;

export type SpineTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

function toneColor(c: ReturnType<typeof useTheme>, tone: SpineTone) {
  switch (tone) {
    case 'primary': return c.primary;
    case 'accent': return c.accent;
    case 'success': return c.success;
    case 'warning': return c.warning;
    case 'danger': return c.danger;
    default: return c.faint;
  }
}

export function Spine({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ paddingTop: 2 }, style]}>{children}</View>;
}

export function SpineRow({
  time, title, subtitle, tone = 'neutral', icon, right, onPress, last, index = 0, children,
}: {
  /** Short time or date label. Rendered tabular so the gutter aligns down the column. */
  time: string;
  title: string;
  subtitle?: string;
  tone?: SpineTone;
  icon?: IconName;
  right?: React.ReactNode;
  onPress?: () => void;
  /** Terminates the rule so it does not run past the final node. */
  last?: boolean;
  /** Position in the list — drives the staggered entrance. */
  index?: number;
  children?: React.ReactNode;
}) {
  const c = useTheme();
  const reduced = useReducedMotion();
  const col = toneColor(c, tone);

  const body = (
    <View style={{ flexDirection: 'row' }}>
      {/* time gutter */}
      <View style={{ width: TIME_W, alignItems: 'flex-end', paddingRight: 10, paddingTop: 1 }}>
        <Text style={{ color: c.faint, ...type('600', 11.5), ...tnum }} numberOfLines={1}>{time}</Text>
      </View>

      {/* rule + node */}
      <View style={{ width: RAIL_W, alignItems: 'center' }}>
        <View style={{
          width: DOT, height: DOT, borderRadius: DOT / 2,
          backgroundColor: tone === 'neutral' ? c.card : col,
          borderWidth: 2, borderColor: tone === 'neutral' ? c.spine : col,
          marginTop: 3,
        }} />
        {!last && <View style={{ flex: 1, width: 1.5, backgroundColor: c.spine, marginTop: 4, borderRadius: 1 }} />}
      </View>

      {/* content */}
      <View style={{ flex: 1, paddingLeft: 12, paddingBottom: last ? 2 : 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Ionicons name={icon} size={14} color={col} /> : null}
          <Text style={{ color: c.text, ...type('700', 14.5), flex: 1 }} numberOfLines={1}>{title}</Text>
          {right}
        </View>
        {subtitle ? (
          <Text style={{ color: c.muted, ...type('400', 12.5), marginTop: 2 }} numberOfLines={2}>{subtitle}</Text>
        ) : null}
        {children ? <View style={{ marginTop: 8 }}>{children}</View> : null}
      </View>
    </View>
  );

  const wrapped = onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1, borderRadius: radius.sm }]}>{body}</Pressable>
    : body;

  if (reduced) return <View>{wrapped}</View>;
  return (
    <Animated.View entering={FadeInDown.duration(motion.enter.duration).delay(index * motion.stagger)}>
      {wrapped}
    </Animated.View>
  );
}
