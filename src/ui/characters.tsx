/**
 * Characters — code-native illustrations for empty states and headers.
 *
 * WHY THESE ARE BUILT FROM VIEWS. There is no illustration asset pipeline here and
 * react-native-svg is deliberately NOT a dependency: the APK was cut from 105MB to 59MB
 * and a new native module walks that back. Bitmaps would cost binary size and would need
 * a second dark-mode cut. So every character is plain `View` + `borderRadius` + `Grad`
 * (expo-linear-gradient, already bundled) + an Ionicon, which is theme-aware for free and
 * costs nothing at build time.
 *
 * THE GRAMMAR — this is what stops it reading as clip-art. Every character is the same
 * four moves, and the variation lives only in tint, shape and glyph:
 *
 *   1. BLOB    a soft asymmetric gradient shape filling the frame (the atmosphere)
 *   2. PLINTH  a short bar the figure stands on (the ground)
 *   3. CORE    one rounded body holding an Ionicon (the subject)
 *   4. ACCENT  at most one satellite detail: a badge, confetti, pages, a handle
 *
 * Seven characters, one system. Adding an eighth means fitting the grammar, not inventing
 * a new one — the moment two of these stop sharing a silhouette the set reads as stock art.
 *
 * COLOUR IS READ FROM THE PALETTE, NEVER HARD-CODED. Soft tokens (`primarySoft`,
 * `goldSoft`, `cardAlt`) are already dark-mode inverted in theme.tsx, so the same recipe
 * renders a pale azure wash in light and a deep navy one in dark with no branching.
 *
 * NO ANIMATION LOOPS. `animate` runs a single `Appear` entrance which honours the OS
 * reduced-motion setting. A perpetually bobbing mascot costs a GPU frame forever and stops
 * communicating after the first second.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Grad, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Appear } from '@/ui/motion';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/theme';

export type CharacterName =
  | 'welcome'      // onboarding / sign-in header
  | 'all-clear'    // nothing left to do today (the reward state)
  | 'no-results'   // a search that found nothing
  | 'offline'      // the server could not be reached
  | 'empty-book'   // no clients or leads yet
  | 'locked'       // permission denied
  | 'celebrate';   // a target met, a claim settled

/** Stable order, for a dev catalogue or a picker. */
export const characterNames: readonly CharacterName[] = [
  'welcome', 'all-clear', 'no-results', 'offline', 'empty-book', 'locked', 'celebrate',
];

type Pair = readonly [string, string];

type Recipe = {
  label: string;
  /** Atmosphere gradient behind everything. */
  blob: Pair;
  /** The core body fill. */
  fill: Pair;
  /** Icon colour on the core. Must survive both palettes. */
  on: string;
  icon: IconName;
  shape: 'circle' | 'squircle';
  /** Core diameter as a fraction of `size`. */
  frac?: number;
  /** Ring around the core, width as a fraction of `size`. */
  border?: { w: number; color: string };
};

/**
 * Three tones carry all seven characters.
 *
 *   brand    azure to teal, the signature
 *   success  green to teal, reserved for the two positive states
 *   neutral  slate to azure — grey alone reads dead, and the azure end also lifts the
 *            icon contrast on a light ground where flat `muted` is borderline
 *
 * `onPrimary` is the palette's on-brand ink (white in light, near-black in dark), which is
 * why nothing below writes '#fff'.
 */
function recipe(name: CharacterName, c: Palette): Recipe {
  const brand: Pair = [c.primary, c.accent];
  const success: Pair = [c.success, c.accent];
  const neutral: Pair = [c.muted, c.primary];

  switch (name) {
    case 'welcome':
      return {
        label: 'Illustration of a figure waving hello',
        blob: [c.primarySoft, c.accentSoft], fill: brand, on: c.onPrimary,
        icon: 'hand-right', shape: 'circle',
      };
    case 'all-clear':
      return {
        label: 'Illustration of a completed checkmark, everything is done',
        blob: [c.successSoft, c.accentSoft], fill: success, on: c.onPrimary,
        icon: 'checkmark-sharp', shape: 'circle',
      };
    case 'no-results':
      return {
        label: 'Illustration of a magnifying glass that found nothing',
        blob: [c.cardAlt, c.primarySoft], fill: [c.card, c.cardAlt], on: c.faint,
        icon: 'ellipsis-horizontal', shape: 'circle',
        frac: 0.42, border: { w: 0.042, color: c.muted },
      };
    case 'offline':
      return {
        label: 'Illustration of a cloud with no connection',
        blob: [c.cardAlt, c.warningSoft], fill: neutral, on: c.onPrimary,
        icon: 'cloud-offline', shape: 'squircle',
      };
    case 'empty-book':
      return {
        label: 'Illustration of an empty stack of records',
        blob: [c.primarySoft, c.cardAlt], fill: brand, on: c.onPrimary,
        icon: 'people', shape: 'squircle',
      };
    case 'locked':
      return {
        label: 'Illustration of a closed padlock',
        blob: [c.cardAlt, c.goldSoft], fill: neutral, on: c.onPrimary,
        icon: 'lock-closed', shape: 'squircle',
      };
    case 'celebrate':
      return {
        label: 'Illustration of a trophy with confetti',
        blob: [c.goldSoft, c.accentSoft], fill: brand, on: c.onPrimary,
        icon: 'trophy', shape: 'circle',
      };
  }
}

/* ================================================================== *
 * Shape primitives
 *
 * Everything is expressed as a fraction of `s` (the single base unit) so a 64pt inline
 * character and a 160pt header character are the same drawing, not two tunings.
 * ================================================================== */

/** The atmosphere. Corner radii are deliberately unequal — four equal corners read as a
 *  button, uneven ones read as a drawn shape. */
function Blob({ s, colors }: { s: number; colors: Pair }) {
  return (
    <Grad
      colors={colors}
      style={{
        position: 'absolute', left: 0, top: 0, width: s, height: s,
        borderTopLeftRadius: s * 0.44,
        borderTopRightRadius: s * 0.34,
        borderBottomRightRadius: s * 0.46,
        borderBottomLeftRadius: s * 0.36,
      }}
    />
  );
}

/** The ground. Small, but it is what stops every character floating in the middle of a box. */
function Plinth({ s, color }: { s: number; color: string }) {
  const w = s * 0.5;
  return (
    <View style={{
      position: 'absolute', left: (s - w) / 2, top: s - s * 0.135 - s * 0.05,
      width: w, height: s * 0.05, borderRadius: radius.pill, backgroundColor: color,
    }} />
  );
}

/** The subject. Sits slightly above centre so the plinth reads as ground, not as a caption. */
function Core({ s, r }: { s: number; r: Recipe }) {
  const d = s * (r.frac ?? 0.44);
  const bw = r.border ? Math.max(1, s * r.border.w) : 0;
  return (
    <View style={{
      position: 'absolute', width: d, height: d,
      left: (s - d) / 2, top: (s - d) / 2 - s * 0.05,
      borderRadius: r.shape === 'circle' ? d / 2 : d * 0.32,
      overflow: 'hidden', borderWidth: bw, borderColor: r.border?.color,
    }}>
      <Grad colors={r.fill} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={r.icon} size={Math.round(s * 0.2)} color={r.on} />
      </Grad>
    </View>
  );
}

/** A halo. Used only where the state deserves emphasis (done) or a boundary (locked). */
function Ring({ s, frac, color, w, opacity }: {
  s: number; frac: number; color: string; w: number; opacity: number;
}) {
  const d = s * frac;
  return (
    <View style={{
      position: 'absolute', width: d, height: d,
      left: (s - d) / 2, top: (s - d) / 2 - s * 0.05,
      borderRadius: d / 2, borderWidth: Math.max(1, s * w), borderColor: color, opacity,
    }} />
  );
}

/** A satellite detail. Soft tile background with its paired strong foreground, so contrast
 *  is guaranteed by the theme's own tile pairs rather than by eye. */
function Badge({ s, tile, icon, corner }: {
  s: number; tile: { bg: string; fg: string }; icon: IconName; corner: 'tr' | 'br';
}) {
  const d = s * 0.2;
  const top = corner === 'tr' ? s * 0.1 : s - d - s * 0.22;
  const left = corner === 'tr' ? s - d - s * 0.1 : s - d - s * 0.08;
  return (
    <View style={{
      position: 'absolute', top, left, width: d, height: d, borderRadius: d / 2,
      backgroundColor: tile.bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name={icon} size={Math.round(s * 0.105)} color={tile.fg} />
    </View>
  );
}

/** A stick. Confetti, signal bars, the magnifier handle — all the same shape. */
function Bar({ x, y, w, h, color, rot }: {
  x: number; y: number; w: number; h: number; color: string; rot?: number;
}) {
  return (
    <View style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      borderRadius: w / 2, backgroundColor: color,
      ...(rot ? { transform: [{ rotate: `${rot}deg` }] } : null),
    }} />
  );
}

/* ---------- per-character accents ---------- */

/** Drawn under the core: pages it sits on, halos, a handle it tucks over. */
function Behind({ name, s, c }: { name: CharacterName; s: number; c: Palette }) {
  if (name === 'all-clear') {
    return <Ring s={s} frac={0.62} color={c.accent} w={0.019} opacity={0.45} />;
  }
  if (name === 'locked') {
    return <Ring s={s} frac={0.62} color={c.muted} w={0.016} opacity={0.32} />;
  }
  if (name === 'no-results') {
    // The handle. Rotated 45deg so it reads as one continuous magnifier with the lens.
    return <Bar x={s * 0.63} y={s * 0.56} w={s * 0.075} h={s * 0.24} color={c.muted} rot={-45} />;
  }
  if (name === 'empty-book') {
    const page: ViewStyle = {
      position: 'absolute', width: s * 0.34, height: s * 0.3, borderRadius: s * 0.06,
      backgroundColor: c.bgElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    };
    return (
      <>
        <View style={[page, { left: s * 0.14, top: s * 0.24, transform: [{ rotate: '-9deg' }] }]} />
        <View style={[page, { left: s * 0.52, top: s * 0.26, transform: [{ rotate: '9deg' }] }]} />
      </>
    );
  }
  return null;
}

/** Drawn over the core: badges and scatter that must not be occluded. */
function Front({ name, s, c }: { name: CharacterName; s: number; c: Palette }) {
  if (name === 'welcome') return <Badge s={s} tile={c.tiles[2]} icon="sparkles" corner="tr" />;
  if (name === 'all-clear') return <Badge s={s} tile={c.tiles[1]} icon="sparkles" corner="tr" />;
  if (name === 'locked') return <Badge s={s} tile={c.tiles[4]} icon="close" corner="tr" />;

  if (name === 'offline') {
    // Three signal bars with a common baseline: the height ramp is the whole read.
    const base = s * 0.75;
    const w = s * 0.045;
    return (
      <>
        {[0.06, 0.095, 0.13].map((h, i) => (
          <Bar key={h} x={s * (0.1 + i * 0.075)} y={base - s * h} w={w} h={s * h} color={c.faint} />
        ))}
      </>
    );
  }

  if (name === 'celebrate') {
    const bits: { x: number; y: number; rot: number; color: string }[] = [
      { x: 0.09, y: 0.2, rot: -24, color: c.tiles[2].fg },
      { x: 0.81, y: 0.16, rot: 22, color: c.tiles[1].fg },
      { x: 0.05, y: 0.58, rot: 38, color: c.tiles[0].fg },
      { x: 0.85, y: 0.55, rot: -32, color: c.tiles[5].fg },
      { x: 0.46, y: 0.05, rot: 9, color: c.tiles[3].fg },
    ];
    return (
      <>
        {bits.map((b) => (
          <Bar key={`${b.x}-${b.y}`} x={s * b.x} y={s * b.y}
            w={s * 0.045} h={s * 0.11} color={b.color} rot={b.rot} />
        ))}
      </>
    );
  }
  return null;
}

/* ================================================================== *
 * Character
 * ================================================================== */

export function Character({ name, size = 120, animate = true, label, style }: {
  name: CharacterName;
  /** Drives every dimension proportionally. Clamped to a floor where the glyph stops reading. */
  size?: number;
  /** One entrance, no loop. Honours the OS reduced-motion setting via Appear. */
  animate?: boolean;
  /** Override the built-in screen-reader description when the surrounding copy says it better. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const s = Math.max(56, Math.round(size));
  const r = recipe(name, c);

  const body = (
    <View
      style={[{ width: s, height: s }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? r.label}
    >
      <Blob s={s} colors={r.blob} />
      <Behind name={name} s={s} c={c} />
      <Plinth s={s} color={c.spine} />
      <Core s={s} r={r} />
      <Front name={name} s={s} c={c} />
    </View>
  );

  if (!animate) return body;
  return <Appear distance={8}>{body}</Appear>;
}

/* ================================================================== *
 * CharacterEmpty
 *
 * The one-line adoption path: same props as EmptyState in @/ui/feedback, with `character`
 * in place of `icon`.
 *
 *     <CharacterEmpty character="empty-book" title="No clients in your book yet" ... />
 *
 * It re-states EmptyState's title/subtitle/action block rather than rendering EmptyState
 * itself, because that component's 70pt icon tile is not optional — composing it would
 * stack a tile under the illustration. The typography, spacing and action pill below are
 * copied from it verbatim so the two are interchangeable mid-screen, including the
 * deliberately unclamped title: real copy in premium.tsx runs to four lines and clamping
 * it hides the way out.
 * ================================================================== */

export function CharacterEmpty({
  character, title, subtitle, action, size = 132, animate = true, style,
}: {
  character: CharacterName;
  title: string;
  subtitle?: string;
  /** Optional recovery path. An empty state that offers nothing is a dead end. */
  action?: { label: string; onPress: () => void };
  size?: number;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  return (
    <View style={[{
      alignItems: 'center', justifyContent: 'center',
      paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm,
    }, style]}>
      <Character name={character} size={size} animate={animate} />
      <Txt size={16} weight="700" style={{ marginTop: spacing.md, textAlign: 'center' }}>
        {title}
      </Txt>
      {subtitle ? (
        <Txt size={font.sub} color={c.muted} style={{ textAlign: 'center', maxWidth: 260, lineHeight: 19 }}>
          {subtitle}
        </Txt>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [{
            marginTop: spacing.md, height: 44, paddingHorizontal: spacing.xl,
            borderRadius: radius.pill, backgroundColor: c.primarySoft,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
          }]}
        >
          <Txt size={13.5} weight="700" color={c.primary} numberOfLines={1}>{action.label}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
