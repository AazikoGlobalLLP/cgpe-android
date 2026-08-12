import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { eyebrow, motion, tnum, type, useTheme } from '@/theme/theme';
import type { Font, Palette } from '@/theme/theme';
import { Card, Metric, Txt } from './base';
import type { IconName } from './base';

/* ------------------------------------------------------------------ *
 * data — the components that carry numbers.
 *
 * This app is an instrument for an insurance advisor: premium collected, policies in
 * force, claims pending, days to FUP. Numbers are the product, so this module has one
 * job — make a figure read as a measurement rather than as decorated text.
 *
 * Three rules run through everything here:
 *
 *   1. EVERY FIGURE GOES THROUGH `Metric`. That gives tabular numerals and the negative
 *      tracking Geist wants at scale. Stacked tiles and repeated rows only look aligned
 *      if the digits are the same width — proportional figures make a column of money
 *      visibly ragged, which is exactly what makes a dashboard look amateur.
 *   2. A FLAT DELTA IS NEVER COLOURED. Green/red is a judgement. "No change" is not a
 *      judgement, and painting it green (the common shortcut) teaches people to stop
 *      trusting the colour. `direction: 'flat'` renders muted, always.
 *   3. NO GRADIENT IN THIS MODULE. The brand gradient is rationed to the clock-in ring
 *      and the active tab indicator. Data surfaces are card + hairline + one tone
 *      accent; a KPI tile that glows is a KPI tile nobody reads twice.
 *
 * `Sparkline` is built from plain Views because react-native-svg is not installed — and
 * that constraint turned out to be the right answer anyway: at 26pt tall, bars survive
 * on a phone where a 1px polyline disappears.
 *
 * PRESS TREATMENT is matched to shape, deliberately, rather than uniform:
 *   cards settle (Card's own scale/opacity) · chips and tiles scale · rows tint.
 * A full-width row that scales pulls away from the card edge and looks broken; a chip
 * that only tints does not feel picked up.
 * ------------------------------------------------------------------ */

/** The semantic tone vocabulary Pill / StatCard / DataRow / KpiStrip share. */
export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

function toneColor(c: Palette, tone: Tone): string {
  switch (tone) {
    case 'success': return c.success;
    case 'warning': return c.warning;
    case 'danger': return c.danger;
    case 'info': return c.info;
    case 'accent': return c.accent;
    case 'neutral': return c.muted;
    default: return c.primary;
  }
}

function toneSurface(c: Palette, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'success': return { bg: c.successSoft, fg: c.success };
    case 'warning': return { bg: c.warningSoft, fg: c.warning };
    case 'danger': return { bg: c.dangerSoft, fg: c.danger };
    case 'info': return { bg: c.infoSoft, fg: c.info };
    case 'accent': return { bg: c.accentSoft, fg: c.accent };
    case 'neutral': return { bg: c.cardAlt, fg: c.muted };
    default: return { bg: c.primarySoft, fg: c.primary };
  }
}

/**
 * Alpha-suffix a palette hex. Every solid token is `#rrggbb`, so an icon wash stays
 * DERIVED from the palette instead of being a new invented colour. Non-hex tokens
 * (glass, overlay) pass through untouched.
 *
 * Duplicated from controls.tsx on purpose: these modules are deliberately independent of
 * each other so one can be edited without a rebuild cascade through the others.
 */
function alpha(hex: string, a: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const n = Math.round(Math.min(1, Math.max(0, a)) * 255);
  return hex + n.toString(16).padStart(2, '0');
}

/** 0.12 reproduces the legacy `col + '1f'` icon wash exactly (0.12 * 255 = 31 = 0x1f). */
const WASH = 0.12;

/**
 * Eyebrow caption, clipped to one line. This uses the `eyebrow` token directly rather than
 * base.tsx's `Eyebrow` wrapper because the wrapper takes no numberOfLines: a real caption
 * like "TEAM PREMIUM (MTD)" wraps on a two-across tile and shoves the figure down the card.
 */
function Label({ children, color, style }: {
  children: React.ReactNode; color?: string; style?: StyleProp<TextStyle>;
}) {
  const c = useTheme();
  return <Text numberOfLines={1} style={[eyebrow, { color: color ?? c.faint }, style]}>{children}</Text>;
}

const EASE_SMOOTH = Easing.bezier(...motion.smooth.bezier);
const EASE_SPRING = Easing.bezier(...motion.spring.bezier);
/** Press-in is faster than press-out — the finger should feel caught, then released. */
const PRESS_IN = { duration: 90, easing: EASE_SMOOTH };
const PRESS_OUT = { duration: 220, easing: EASE_SPRING };

/**
 * Scale-on-press for chip/tile shapes. Reduced motion drops the travel but keeps the
 * opacity change, so the affordance survives for people who turned animation off.
 */
function usePressScale(to = 0.96) {
  const p = useSharedValue(0);
  const reduced = useReducedMotion();
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 - (1 - to) * p.value }],
    opacity: 1 - 0.18 * p.value,
  }));
  return {
    anim,
    onPressIn: () => { p.value = withTiming(1, PRESS_IN); },
    onPressOut: () => { p.value = withTiming(0, PRESS_OUT); },
  };
}

/* ================================================================== *
 * Pill — a status token
 * ================================================================== */

/* Metrics are preserved verbatim: 30+ screens lay out rows of these against a 22pt
 * (small) / 26pt (regular) pill height, so they are constants rather than re-derived. */
const PILL_PX = { small: 8, regular: 11 } as const;
const PILL_PY = { small: 3, regular: 5 } as const;
/* Density leaves font sizes alone (font ×1.0), but the tiny size is still READ off the theme
 * scale rather than copied, so the pill sizes stay a helper over `c.font` — the same treatment
 * `clients.tsx`/`leads.tsx` gave their module-scope `sepInset`, applied here to a module const. */
const pillFs = (f: Font) => ({ small: f.tiny, regular: 11.5 }) as const;
const PILL_ICON = { small: 10, regular: 12 } as const;

export function Pill({ label, tone = 'neutral', icon, small, dot, numeric, style }: {
  label: string;
  tone?: Tone;
  icon?: IconName;
  small?: boolean;
  /** Status dot instead of an icon — cheaper than a glyph when the tone IS the message. */
  dot?: boolean;
  /** Tabular figures, for pills that carry a count or an amount. */
  numeric?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { radius, font } = c;
  const s = toneSurface(c, tone);
  const k = small ? 'small' : 'regular';
  const pf = pillFs(font);
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      backgroundColor: s.bg, paddingHorizontal: PILL_PX[k], paddingVertical: PILL_PY[k],
      borderRadius: radius.pill, maxWidth: '100%',
    }, style]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.fg }} /> : null}
      {icon && !dot ? <Ionicons name={icon} size={PILL_ICON[k]} color={s.fg} /> : null}
      {/* Pills sit in tight rows next to titles; without this a long status shoves the row.
          flexShrink:1 is load-bearing, not cosmetic — Yoga defaults flexShrink to 0 (unlike
          CSS), so numberOfLines alone lets the Text keep its full intrinsic width and get
          CLIPPED by the container instead of ellipsizing. */}
      <Text numberOfLines={1} style={[{ color: s.fg, flexShrink: 1, ...type('700', pf[k]) }, numeric && tnum]}>
        {label}
      </Text>
    </View>
  );
}

/* ================================================================== *
 * StatCard — the compact tile, three-across
 * ================================================================== */

const STAT_CHIP = 36;

export function StatCard({ label, value, icon, tone = 'primary', sub, onPress, style }: {
  label: string; value: string; icon: IconName; tone?: Tone; sub?: string;
  onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { spacing, font } = c;
  const col = toneColor(c, tone);
  return (
    <Card onPress={onPress} style={[{ flex: 1, padding: spacing.md }, style]}>
      <View style={{
        width: STAT_CHIP, height: STAT_CHIP, borderRadius: 11, backgroundColor: alpha(col, WASH),
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
      }}>
        <Ionicons name={icon} size={18} color={col} />
      </View>
      {/* Metric, not Txt: three of these sit side by side and the figures must line up. */}
      <Metric value={value} size={20} />
      <Txt size={font.cap} color={c.muted} numberOfLines={1} style={{ marginTop: 2 }}>{label}</Txt>
      {sub ? (
        <Txt size={11} weight="700" color={col} numeric numberOfLines={1} style={{ marginTop: 3 }}>{sub}</Txt>
      ) : null}
    </Card>
  );
}

/* ================================================================== *
 * Sparkline — trend, from Views
 * ================================================================== */

/** Only the tail is drawn: 40 points across a phone is 2px of bar and no information. */
const SPARK_BARS = 16;
const SPARK_GAP = 2;
/** A zero point still gets a stub, so an empty week reads as "low", not as "missing". */
const SPARK_MIN_H = 3;

export function Sparkline({ data, height = 26, tone, bars = SPARK_BARS, style }: {
  data: number[];
  height?: number;
  tone?: string;
  /** Max bars drawn; the series is tail-sliced to fit. */
  bars?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();

  // One point is not a trend. Rendering it would draw a single full-height bar and imply
  // a shape the data does not have, so this degrades to nothing at all.
  if (!data || data.length < 2) return null;

  const col = tone ?? c.primary;
  const n = Math.max(2, Math.floor(bars));
  const series = data.length > n ? data.slice(-n) : data;

  // Negatives are clamped rather than plotted: a mixed-sign series needs a zero axis, and
  // a baseline-less bar strip would misread a -5 as a small positive.
  const safe = series.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const max = Math.max(...safe);
  const span = height - SPARK_MIN_H;
  const last = safe.length - 1;

  return (
    <View style={[{ height, flexDirection: 'row', alignItems: 'flex-end', gap: SPARK_GAP }, style]}>
      {safe.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1, minWidth: 2, borderRadius: 2,
            height: SPARK_MIN_H + (max > 0 ? (v / max) * span : 0),
            // The newest bar is the reading; the rest is context. Fading history is what
            // makes a 16-bar strip legible at a glance without a label or an axis.
            backgroundColor: i === last ? col : alpha(col, 0.34),
          }}
        />
      ))}
    </View>
  );
}

/* ================================================================== *
 * MetricTile — the hero KPI
 * ================================================================== */

export type Delta = {
  value: string;
  direction: 'up' | 'down' | 'flat';
  /**
   * Override the good/bad reading. Up is not always good: "lapses down 8%" is a win.
   * Without this the caret and the colour are locked together, which would force screens
   * to lie about the arrow to get the right colour.
   */
  tone?: 'good' | 'bad' | 'muted';
};

const DELTA_ICON: Record<Delta['direction'], IconName> = {
  up: 'caret-up',
  down: 'caret-down',
  flat: 'remove',
};

function DeltaBadge({ delta }: { delta: Delta }) {
  const c = useTheme();
  const { radius, font } = c;
  // RULE: flat is muted, always. A no-change delta painted green is a lie by decoration,
  // and once one colour lies the whole palette stops being read.
  const sense = delta.tone ?? (delta.direction === 'flat' ? 'muted' : delta.direction === 'up' ? 'good' : 'bad');
  const fg = sense === 'good' ? c.success : sense === 'bad' ? c.danger : c.muted;
  const bg = sense === 'muted' ? c.cardAlt : alpha(fg, WASH);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 2,
      backgroundColor: bg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill,
    }}>
      <Ionicons name={DELTA_ICON[delta.direction]} size={11} color={fg} />
      <Text numberOfLines={1} style={{ color: fg, ...type('700', font.tiny), ...tnum }}>{delta.value}</Text>
    </View>
  );
}

export function MetricTile({ label, value, delta, icon, tone = 'primary', sparkline, onPress, style }: {
  label: string;
  value: string;
  delta?: Delta;
  icon?: IconName;
  tone?: Tone;
  /** Recent series, oldest first. Fewer than 2 points renders no chart. */
  sparkline?: number[];
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { spacing, font } = c;
  const col = toneColor(c, tone);
  const hasTop = !!icon || !!delta;

  return (
    <Card onPress={onPress} style={[{ flex: 1, padding: spacing.lg }, style]}>
      {hasTop ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          {icon ? (
            <View style={{
              width: 34, height: 34, borderRadius: 11, backgroundColor: alpha(col, WASH),
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={icon} size={17} color={col} />
            </View>
          ) : <View />}
          {delta ? <DeltaBadge delta={delta} /> : null}
        </View>
      ) : null}

      {/* Label ABOVE the figure — the hero treatment. A dashboard is scanned top-down for
          "what is this", then the eye stops on the number; StatCard's label-under order is
          right for a dense tile but buries the caption on a large one. */}
      <Label style={{ marginTop: hasTop ? spacing.md : 0 }}>{label}</Label>
      <Metric value={value} size={font.metric} style={{ marginTop: 3 }} />

      {sparkline ? (
        // Toned to the TILE, not to the delta: two competing good/bad signals in one card
        // cancel each other out. The badge carries the judgement, the strip carries shape.
        <Sparkline data={sparkline} tone={col} height={28} style={{ marginTop: spacing.md }} />
      ) : null}
    </Card>
  );
}

/* ================================================================== *
 * DataRow / ListSection — the detail-screen grouped list
 * ================================================================== */

/** Rows are 48 tall before padding, which clears 44 even with a one-line value. */
const ROW_MIN_H = 48;
const COPY_HIT = { top: 10, bottom: 10, left: 10, right: 10 };
/** Long enough to be seen, short enough that the row is not stuck in a "copied" state. */
const COPY_HOLD = 1400;

export function DataRow({
  label, value, icon, tone = 'neutral', onPress, copyable, numeric, copyText, onCopy, right, style,
}: {
  label: string;
  value: string;
  icon?: IconName;
  tone?: Tone;
  onPress?: () => void;
  /** Adds a copy button. Phone numbers, policy numbers and UTR refs get typed out by hand otherwise. */
  copyable?: boolean;
  /**
   * Force tabular figures. Left undefined it is inferred from the value: any string with a
   * digit gets `tnum`, which is safe because tabular figures are a no-op on text that has
   * none — so "12 Jan 2026" aligns down a column and "Jeevan Anand" is unaffected.
   */
  numeric?: boolean;
  /** Copy something other than the displayed value (a masked number, an unformatted amount). */
  copyText?: string;
  onCopy?: (text: string) => void;
  /** Rendered after the value — a Pill, a chevron replacement, a small control. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { spacing, font } = c;
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A row can unmount mid-confirmation (sheet closes, list refreshes) while the async
   *  clipboard write is still in flight, so both the timer and the promise check this. */
  const live = useRef(true);

  useEffect(() => () => {
    live.current = false;
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(() => {
    const text = copyText ?? value;
    // Optimistic: the confirmation has to land on the same frame as the tap, or the button
    // feels dead. A rejected write (web without clipboard permission) reverts it, so the
    // row never claims a copy that did not happen.
    setCopied(true);
    try { Haptics.selectionAsync(); } catch { /* no haptics engine on this device */ }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (live.current) setCopied(false); }, COPY_HOLD);
    Clipboard.setStringAsync(text)
      .then(() => { onCopy?.(text); })
      .catch(() => {
        if (timer.current) clearTimeout(timer.current);
        if (live.current) setCopied(false);
      });
  }, [copyText, value, onCopy]);

  const valueColor = tone === 'neutral' ? c.text : toneColor(c, tone);
  const isNum = numeric ?? /\d/.test(value);

  const body = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: ROW_MIN_H,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    }}>
      {icon ? <Ionicons name={icon} size={16} color={c.faint} /> : null}
      <Txt size={font.sub} color={c.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Txt>

      {/* Spacer, so the value is right-aligned however long the label is. */}
      <View style={{ flex: 1, minWidth: spacing.sm }} />

      {/* NUMBERS NEVER WRAP AND NEVER SHRINK.
          This was `numberOfLines={2}` with `flexShrink: 1` on the value, which is what
          fractured amounts across two lines: in a row with a long label the value was the
          thing that gave way, so "Rs 37.2L" broke after the currency and the figure landed
          on its own line. A number split across lines is not just ugly, it is misreadable,
          and this app quotes real premiums to real policyholders.

          The label already carries `flexShrink: 1`, so it is the correct thing to give way.
          A truncated label still reads ("Premium this mo..."); a broken figure does not.
          `adjustsFontSizeToFit` is the release valve for the genuinely extreme case (a crore
          figure on a 320pt screen): the number shrinks to fit rather than clipping or
          wrapping. `minimumFontScale` stops it shrinking into illegibility. */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit={isNum}
        minimumFontScale={0.82}
        style={[{
          color: valueColor, ...type('600', font.body), textAlign: 'right',
          flexShrink: isNum ? 0 : 1,
        }, isNum && tnum]}
      >
        {value}
      </Text>
      {right}

      {copyable ? (
        <Pressable
          onPress={copy}
          hitSlop={COPY_HIT}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${label}`}
          style={({ pressed }) => [{
            width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            backgroundColor: pressed ? c.cardAlt : 'transparent', opacity: pressed ? 0.7 : 1,
          }]}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={15}
            color={copied ? c.success : c.faint}
          />
        </Pressable>
      ) : null}

      {onPress ? <Ionicons name="chevron-forward" size={16} color={c.faint} /> : null}
    </View>
  );

  if (!onPress) return <View style={style}>{body}</View>;
  // Rows TINT rather than scale — a full-width row that shrinks visibly detaches from the
  // card edge it sits inside.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [{ backgroundColor: pressed ? c.cardAlt : 'transparent' }, style]}
    >
      {body}
    </Pressable>
  );
}

export function ListSection({ title, footer, children, style }: {
  title?: string;
  /** Caption under the group — the place for a caveat about the numbers above. */
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  // toArray drops null/false, so `{cond && <DataRow/>}` cannot leave an orphan separator.
  const kids = React.Children.toArray(children);
  if (kids.length === 0) return null;

  return (
    <View style={style}>
      {title ? <Label style={{ marginBottom: spacing.sm, marginLeft: spacing.xs }}>{title}</Label> : null}
      {/* padded={false}: rows own their horizontal padding so a row's press tint runs edge
          to edge. The clip lives on an INNER view, not on the Card — `overflow: hidden`
          alongside `elevation` suppresses the Android shadow, and every grouped list on a
          detail screen would lose its depth. */}
      <Card padded={false}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          {kids.map((k, i) => (
            <View key={i}>
              {i > 0 ? (
                <View style={{
                  height: StyleSheet.hairlineWidth, backgroundColor: c.hairline,
                  marginLeft: spacing.lg,
                }} />
              ) : null}
              {k}
            </View>
          ))}
        </View>
      </Card>
      {footer ? (
        <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.sm, marginHorizontal: spacing.xs }}>
          {footer}
        </Txt>
      ) : null}
    </View>
  );
}

/* ================================================================== *
 * KpiStrip — the dashboard header row
 * ================================================================== */

export type KpiItem = {
  label: string;
  value: string;
  tone?: Tone;
  icon?: IconName;
  onPress?: () => void;
};

function KpiChip({ item }: { item: KpiItem }) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  const col = toneColor(c, item.tone ?? 'primary');
  const { anim, onPressIn, onPressOut } = usePressScale();

  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {/* A 3pt rail instead of a filled chip: the tone is identification, not emphasis.
          Six filled pastel chips in a row is a toy; six rails is an instrument panel. */}
      <View style={{ width: 3, alignSelf: 'stretch', minHeight: 30, borderRadius: 2, backgroundColor: col }} />
      <View style={{ flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {item.icon ? <Ionicons name={item.icon} size={12} color={col} /> : null}
          <Label style={{ flexShrink: 1 }}>{item.label}</Label>
        </View>
        <Metric value={item.value} size={font.h3} style={{ marginTop: 1 }} />
      </View>
    </View>
  );

  const surface: ViewStyle = {
    backgroundColor: c.card, borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: 10, minWidth: 96, minHeight: 44, justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  };

  if (!item.onPress) return <View style={surface}>{inner}</View>;
  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={item.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${item.value}`}
        style={surface}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}

export function KpiStrip({ items, style, contentStyle }: {
  items: KpiItem[];
  style?: StyleProp<ViewStyle>;
  /**
   * Padding for the scrolling content. A strip must bleed to the screen edge to signal
   * that it scrolls, so a padded screen cancels its gutter on the ScrollView and re-adds
   * it here (`{ paddingHorizontal: spacing.lg }`) instead of clipping the last chip.
   */
  contentStyle?: StyleProp<ViewStyle>;
}) {
  // Hook before the early return — the strip owns no other theme reads, but the content gap
  // must react to density like every other gutter in this module.
  const { spacing } = useTheme();
  if (!items || items.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={[{ gap: spacing.sm, alignItems: 'stretch' }, contentStyle]}
    >
      {items.map((it, i) => <KpiChip key={`${it.label}-${i}`} item={it} />)}
    </ScrollView>
  );
}

/* ================================================================== *
 * ActionTile — the pastel quick action
 * ================================================================== */

const TILE_W = 68;
const TILE_BOX = 58;

export function ActionTile({ icon, label, tileIndex = 0, onPress, tint, badge, style }: {
  icon: IconName; label: string; tileIndex?: number; onPress?: () => void; tint?: string;
  /** Count overlay — "3 tasks due" belongs on the tile, not two screens deep. */
  badge?: number | string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { spacing, radius } = c;
  const tile = c.tiles[tileIndex % c.tiles.length];
  const { anim, onPressIn, onPressOut } = usePressScale(0.93);
  const badgeText = typeof badge === 'number' ? (badge > 99 ? '99+' : String(badge)) : badge;
  const showBadge = badgeText != null && badgeText !== '' && badgeText !== '0';

  return (
    <Animated.View style={[anim, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ alignItems: 'center', gap: spacing.sm, width: TILE_W }}
      >
        <View style={{
          width: TILE_BOX, height: TILE_BOX, borderRadius: radius.lg, backgroundColor: tile.bg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={25} color={tint ?? tile.fg} />
          {showBadge ? (
            <View style={{
              position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, paddingHorizontal: 5,
              borderRadius: radius.pill, backgroundColor: c.danger,
              alignItems: 'center', justifyContent: 'center',
              // Ring in the tile's own surface so the badge lifts off a pastel ground.
              borderWidth: 2, borderColor: c.card,
            }}>
              <Text numberOfLines={1} style={{ color: c.onPrimary, ...type('800', 10), ...tnum }}>{badgeText}</Text>
            </View>
          ) : null}
        </View>
        <Txt size={11.5} weight="600" color={c.muted} numberOfLines={1} style={{ textAlign: 'center' }}>
          {label}
        </Txt>
      </Pressable>
    </Animated.View>
  );
}
