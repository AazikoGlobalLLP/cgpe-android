import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { DimensionValue, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation, Easing, FadeInDown, FadeOutDown, useAnimatedStyle, useReducedMotion,
  useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, shadow, useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/theme';
import { useT } from '@/i18n';
import { Card, Grad, Metric, Txt } from './base';
import type { IconName } from './base';

/* ------------------------------------------------------------------ *
 * feedback — how the app tells the truth about its own state.
 *
 * Four jobs, in the order a screen needs them:
 *
 *   1. LOADING      Skeleton / SkeletonText / SkeletonCard, and Loader for whole routes.
 *                   A skeleton is preferred inside content areas because it holds the
 *                   final layout: the page does not jump when data lands, and the shape
 *                   itself tells you what is coming. A centred spinner tells you nothing
 *                   and reflows everything.
 *   2. CONDITION    Banner — a persistent inline strip the user can act on or dismiss.
 *   3. CONFIRMATION Toast — transient, non-blocking, queued.
 *   4. MEASUREMENT  ProgressBar / Meter — a value against a track, optionally a target.
 *
 * WHY THE 'offline' TONE EXISTS AND WHY IT IS NOT RED:
 * This app runs in the field, on patchy mobile data, over a backend that has had real
 * Atlas connection blips. The dishonest options are (a) show cached numbers as if they
 * were live, or (b) show sample data. Both are worse than saying "showing data from
 * 09:14". So `offline` is a first-class tone with a deliberately calm, neutral surface:
 * stale data is a normal field condition, not an error, and an alarm-red strip on every
 * tunnel and lift would train people to ignore the one strip that matters.
 *
 * Gradient discipline: the brand gradient is rationed to the clock-in ring and the
 * active tab. The one gradient here is the skeleton sheen, which is a neutral
 * base -> highlight -> base sweep in surface tokens, not the brand ramp.
 * ------------------------------------------------------------------ */

/** Toasts and Banners share one tone vocabulary so a condition looks the same either way. */
export type FeedbackTone = 'info' | 'success' | 'warning' | 'danger' | 'offline';

type ToneSpec = { fg: string; bg: string; rail: string; line: string; icon: IconName };

function toneSpec(c: Palette, tone: FeedbackTone): ToneSpec {
  switch (tone) {
    case 'success':
      return { fg: c.success, bg: c.successSoft, rail: c.success, line: c.success + '33', icon: 'checkmark-circle' };
    case 'warning':
      return { fg: c.warning, bg: c.warningSoft, rail: c.warning, line: c.warning + '33', icon: 'alert-circle' };
    case 'danger':
      return { fg: c.danger, bg: c.dangerSoft, rail: c.danger, line: c.danger + '33', icon: 'alert-circle' };
    case 'offline':
      // Neutral on purpose — see the module note. The rule is the spine grey, so the
      // strip reads as structure/metadata rather than as a fault.
      return { fg: c.muted, bg: c.cardAlt, rail: c.spine, line: c.border, icon: 'cloud-offline' };
    default:
      return { fg: c.info, bg: c.infoSoft, rail: c.info, line: c.info + '33', icon: 'information-circle' };
  }
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
/** RN accepts percentage strings for width/left; TS needs the template literal narrowed. */
const asPct = (n: number) => `${n}%` as DimensionValue;

/* ================================================================== *
 * Loading
 * ================================================================== */

/* ---------- Loader ----------
 * Route-level fallback. Kept as a real indicator (not a skeleton) because at this point
 * the screen has no layout to hold yet — there is nothing honest to draw a shape for. */
export function Loader({ label, inline }: { label?: string; inline?: boolean }) {
  const c = useTheme();
  const { spacing, font } = c;
  return (
    <View style={inline
      ? { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.md }
      : { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, gap: spacing.md }}>
      <ActivityIndicator color={c.primary} size="large" />
      {label ? <Txt size={font.sub} weight="500" color={c.muted} numberOfLines={2}>{label}</Txt> : null}
    </View>
  );
}

const SWEEP_MS = 1150;
const SWEEP_HOLD_MS = 420;

/* ---------- Skeleton ----------
 * A shimmer block. The sheen is a wide soft band swept left to right with a sine opacity
 * envelope, so it fades in and out at the edges instead of clipping in and out.
 *
 * The band fades to the block's OWN colour rather than to `transparent`: interpolating to
 * transparent on Android goes through transparent *black*, which greys the mid-stops. */
export function Skeleton({ width = '100%', height = 14, radius: rProp, style }: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const r = rProp ?? c.radius.sm;
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return; // frozen flat — no sweep, no pulse
    // Sweep, then hold at 1 (band parked off the right edge, envelope at 0) for cadence.
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SWEEP_MS, easing: Easing.bezier(...motion.smooth.bezier) }),
        withTiming(1, { duration: SWEEP_HOLD_MS }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [reduced, t]);

  // Band is wider than half the block so the highlight never reads as a hard bar.
  const bandW = Math.max(56, w * 0.6);
  const sheen = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.sin(t.value * Math.PI)) * 0.9,
    transform: [{ translateX: -bandW + t.value * (w + bandW * 2) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== w) setW(next);
  };

  const highlight = c.scheme === 'dark' ? c.border : c.bgElevated;

  return (
    <View
      onLayout={onLayout}
      accessible={false}
      style={[{ width, height, borderRadius: r, backgroundColor: c.cardAlt, overflow: 'hidden' }, style]}
    >
      {!reduced && w > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, bottom: 0, width: bandW }, sheen]}
        >
          <Grad colors={[c.cardAlt, highlight, c.cardAlt] as const} angle="horiz" style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// Prose does not come in equal-length lines; equal-length skeleton lines read as a table.
const LINE_WIDTHS: DimensionValue[] = ['100%', '94%', '88%'];

/* ---------- SkeletonText ---------- */
export function SkeletonText({ lines = 3, lineHeight = 12, gap: gapProp, style }: {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const gap = gapProp ?? c.spacing.sm;
  const n = Math.max(1, Math.round(lines));
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          radius={c.radius.sm}
          // Last line runs short: a full-width final line reads as a block, not a paragraph.
          width={n > 1 && i === n - 1 ? '62%' : LINE_WIDTHS[i % LINE_WIDTHS.length]}
        />
      ))}
    </View>
  );
}

/* ---------- SkeletonCard ----------
 * Mirrors the real list-row card (avatar + title + subtitle + trailing meta) so the
 * layout does not shift when the data lands. */
export function SkeletonCard({ rows = 2, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  const { spacing, radius } = c;
  return (
    <Card style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Skeleton width={44} height={44} radius={44 / 2.6} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton width="66%" height={13} />
          <Skeleton width="42%" height={11} />
        </View>
        <Skeleton width={54} height={22} radius={radius.pill} />
      </View>
      {rows > 0 ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <SkeletonText lines={rows} lineHeight={11} />
        </View>
      ) : null}
    </Card>
  );
}

/* ================================================================== *
 * Empty
 * ================================================================== */

/* ---------- EmptyState ----------
 * Used both inside cards and as a FlatList ListEmptyComponent, so it must never assume
 * flex:1 — it sizes to its content. */
export function EmptyState({ icon, title, subtitle, action, style }: {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Optional recovery path. An empty state that offers nothing is a dead end. */
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  return (
    <View style={[{
      alignItems: 'center', justifyContent: 'center',
      paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm,
    }, style]}>
      <View style={{
        width: 70, height: 70, borderRadius: radius.xl, backgroundColor: c.cardAlt,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      }}>
        <Ionicons name={icon} size={32} color={c.faint} />
      </View>
      {/* Deliberately UNCLAMPED, matching the pre-split kit. A clamp looks tidier in the
          kitchen sink but truncates real copy: premium.tsx passes a 137-char subtitle whose
          last sentence is the actionable instruction, and an empty state that hides the way
          out is worse than one that runs to four lines. */}
      <Txt size={16} weight="700" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
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
            marginTop: spacing.md, height: 40, paddingHorizontal: spacing.xl,
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

/* ================================================================== *
 * Measurement
 * ================================================================== */

/* Shared track+fill. Extracted so ProgressBar and Meter can never drift apart.
 * The fill animates to its value; a bar that snaps gives no sense of magnitude. */
function FillBar({ value, color, height, target }: {
  value: number; color: string; height: number; target?: number;
}) {
  const c = useTheme();
  const reduced = useReducedMotion();
  const pct = clamp01(value);
  const p = useSharedValue(reduced ? pct : 0);

  useEffect(() => {
    if (reduced) { p.value = pct; return; }
    p.value = withTiming(pct, {
      duration: motion.smooth.duration,
      easing: Easing.bezier(...motion.smooth.bezier),
    });
  }, [pct, reduced, p]);

  // The template literal is built INLINE rather than via asPct(). A worklet may only call
  // other worklets: Reanimated serializes a plain module-scope function as a Remote Function
  // whose UI-runtime stub throws ("Tried to synchronously call a Remote Function"), which
  // would take down every ProgressBar and Meter on their first animated frame. The cast is
  // compile-time only, so it is safe here. tsc cannot catch this class of bug.
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` as DimensionValue }));

  return (
    // Wrapper is unclipped so the target tick can overhang the track's top and bottom.
    <View style={{ height, justifyContent: 'center' }}>
      <View style={{ height, borderRadius: height / 2, backgroundColor: c.track, overflow: 'hidden' }}>
        <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color }, fill]} />
      </View>
      {target != null ? (
        // Two layers: a surface-coloured sleeve so the tick stays legible over the fill,
        // and the tick itself.
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', left: asPct(clamp01(target) * 100), top: -4, bottom: -4,
            width: 5, marginLeft: -2.5, borderRadius: 3, backgroundColor: c.card,
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1, width: 2, borderRadius: 1, backgroundColor: c.text }} />
        </View>
      ) : null}
    </View>
  );
}

/* ---------- ProgressBar ----------
 * `tone` is a raw colour (kept exactly as the 39 screens already pass it — e.g.
 * `tone={c.success}`), NOT a semantic tone name. Meter below takes the semantic union. */
export function ProgressBar({ value, tone, height = 9, target, style }: {
  value: number;
  /** A colour, not a tone name. Defaults to `c.primary`. */
  tone?: string;
  height?: number;
  /** 0..1 — draws a goal tick over the track. */
  target?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  return (
    <View style={style}>
      <FillBar value={value} color={tone ?? c.primary} height={height} target={target} />
    </View>
  );
}

export type MeterTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

function meterColor(c: Palette, tone: MeterTone): string {
  switch (tone) {
    case 'accent': return c.accent;
    case 'success': return c.success;
    case 'warning': return c.warning;
    case 'danger': return c.danger;
    case 'neutral': return c.faint;
    default: return c.primary;
  }
}

/* ---------- Meter ----------
 * A labelled bar: what it is on the left, what it reads on the right, the bar beneath,
 * and an optional target tick. This is the shape a field agent scans — "am I ahead of
 * where I should be?" — which a bare ProgressBar cannot answer. */
export function Meter({
  value, label, valueLabel, tone = 'primary', target, color, height = 10, targetLabel, style,
}: {
  /** 0..1. Clamped. */
  value: number;
  label?: string;
  /** Defaults to the rounded percentage. Tabular either way. */
  valueLabel?: string;
  tone?: MeterTone;
  /** 0..1 — draws a goal tick over the track. */
  target?: number;
  /** Escape hatch for a palette colour outside the semantic tones. Wins over `tone`. */
  color?: string;
  height?: number;
  /** Caption under the bar. Only rendered when `target` is set. */
  targetLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { spacing, font } = c;
  const col = color ?? meterColor(c, tone);
  const shown = valueLabel ?? `${Math.round(clamp01(value) * 100)}%`;

  return (
    <View style={[{ gap: 7 }, style]}>
      {label || shown ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm }}>
          {label ? (
            <Txt size={font.cap} weight="600" color={c.muted} numberOfLines={1} style={{ flex: 1 }}>{label}</Txt>
          ) : <View style={{ flex: 1 }} />}
          {/* Metric, not Txt: this is the datum, and it must align down a column of meters. */}
          <Metric value={shown} size={font.body} />
        </View>
      ) : null}

      <FillBar value={value} color={col} height={height} target={target} />

      {target != null && targetLabel ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {/* Repeats the tick glyph so the caption is unmistakably about the marker. */}
          <View style={{ width: 2, height: 9, borderRadius: 1, backgroundColor: c.faint }} />
          <Txt size={font.tiny} weight="600" color={c.faint} numeric numberOfLines={1}>{targetLabel}</Txt>
        </View>
      ) : null}
    </View>
  );
}

/* ================================================================== *
 * Condition
 * ================================================================== */

/* ---------- Banner ----------
 * Inline, persistent, dismissible. Sits in the content flow rather than floating, because
 * a condition that affects what you are reading belongs next to what you are reading. */
export function Banner({ tone = 'info', title, message, action, onDismiss, icon, style }: {
  tone?: FeedbackTone;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
  /** Overrides the tone's default glyph. */
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const t = useT();
  const { spacing, radius, font } = c;
  const reduced = useReducedMotion();
  const s = toneSpec(c, tone);

  const body = (
    <View style={[{
      backgroundColor: s.bg,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: s.line,
      // The rail is the tone's loudest signal; it survives being glanced at sideways.
      borderLeftWidth: 3,
      borderLeftColor: s.rail,
      padding: spacing.md,
    }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <Ionicons name={icon ?? s.icon} size={18} color={s.fg} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={font.sub} weight="700" color={tone === 'offline' ? c.text : s.fg} numberOfLines={2}>
            {title}
          </Txt>
          {message ? (
            <Txt size={font.cap} color={c.muted} numberOfLines={3} style={{ lineHeight: 17 }}>{message}</Txt>
          ) : null}
        </View>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            style={({ pressed }) => [{
              width: 26, height: 26, borderRadius: 13, marginTop: -2, marginRight: -2,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? c.card : 'transparent',
              opacity: pressed ? 0.9 : 0.7,
            }]}
          >
            <Ionicons name="close" size={16} color={tone === 'offline' ? c.faint : s.fg} />
          </Pressable>
        ) : null}
      </View>

      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [{
            alignSelf: 'flex-start', marginTop: spacing.md, marginLeft: 26,
            height: 32, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: c.bgElevated,
            borderWidth: StyleSheet.hairlineWidth, borderColor: s.line,
            opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
          }]}
        >
          <Txt size={font.cap} weight="700" color={tone === 'offline' ? c.text : s.fg} numberOfLines={1}>
            {action.label}
          </Txt>
          <Ionicons name="arrow-forward" size={12} color={tone === 'offline' ? c.text : s.fg} />
        </Pressable>
      ) : null}
    </View>
  );

  if (reduced) return body;
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.enter.duration)}
      exiting={FadeOutDown.duration(motion.smooth.duration)}
    >
      {body}
    </Animated.View>
  );
}

/* ================================================================== *
 * Confirmation
 * ================================================================== */

const TOAST_MS = 3000;
/** Clears the tab bar (~58 + inset) and the 56pt Fab, so a toast never covers either. */
const TOAST_LIFT = 86;

/* ---------- Toast ----------
 * Presentational. Solid elevated surface rather than a tinted soft one: a toast lands on
 * top of arbitrary content and has to stay readable there. Tone rides the icon and edge. */
export function Toast({ message, tone = 'info', onDismiss, icon }: {
  message: string;
  tone?: FeedbackTone;
  onDismiss?: () => void;
  icon?: IconName;
}) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  const s = toneSpec(c, tone);
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={({ pressed }) => [{
        maxWidth: 480, width: '100%',
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: c.bgElevated,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth, borderColor: s.line,
        borderLeftWidth: 3, borderLeftColor: s.rail,
        paddingVertical: 13, paddingHorizontal: spacing.lg,
        ...shadow(c, 2),
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      }]}
    >
      <Ionicons name={icon ?? s.icon} size={18} color={s.fg} />
      <Txt size={font.sub} weight="600" numberOfLines={3} style={{ flex: 1, lineHeight: 19 }}>{message}</Txt>
    </Pressable>
  );
}

type QueuedToast = { id: number; message: string; tone: FeedbackTone };
type ToastFn = (message: string, tone?: FeedbackTone) => void;

// No-op default: a toast is never load-bearing, so a missing provider must not crash a
// screen the way a missing confirm() would.
const ToastContext = createContext<ToastFn>(() => {});

/** `const toast = useToast(); toast('Saved', 'success')` */
export const useToast = () => useContext(ToastContext);

/* ---------- ToastProvider ----------
 * Follows the ConfirmProvider shape: context + host rendered as a sibling of `children`.
 *
 * Queued, not stacked. Two toasts at once means neither is read, so messages wait their
 * turn; each gets its own full dwell. Rapid-fire calls therefore never drop a message. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [queue, setQueue] = useState<QueuedToast[]>([]);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback<ToastFn>((message, tone = 'info') => {
    seq.current += 1;
    const id = seq.current;
    setQueue((q) => [...q, { id, message, tone }]);
  }, []);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  const current = queue.length > 0 ? queue[0] : null;
  const currentId = current?.id;

  // Keyed on the head's id so a new head restarts the clock instead of inheriting the
  // previous toast's remaining time.
  useEffect(() => {
    if (currentId == null) return;
    timer.current = setTimeout(dismiss, TOAST_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [currentId, dismiss]);

  const host = current
    ? <Toast message={current.message} tone={current.tone} onDismiss={dismiss} />
    : null;

  return (
    <ToastContext.Provider value={push}>
      {children}
      {/* box-none: the strip itself must not swallow taps meant for the screen beneath. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: insets.bottom + TOAST_LIFT,
          alignItems: 'center', paddingHorizontal: spacing.lg,
        }}
      >
        {host && current ? (
          reduced ? (
            <View key={current.id} style={{ width: '100%', alignItems: 'center' }}>{host}</View>
          ) : (
            // Remounted per id, so each toast plays its own entrance.
            <Animated.View
              key={current.id}
              entering={FadeInDown.duration(motion.enter.duration)}
              exiting={FadeOutDown.duration(motion.smooth.duration)}
              style={{ width: '100%', alignItems: 'center' }}
            >
              {host}
            </Animated.View>
          )
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}
