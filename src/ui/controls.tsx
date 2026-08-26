import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text,
  TextInput, View, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue,
  withSequence, withTiming,
} from 'react-native-reanimated';
import { motion, shadow, tnum, type, useTheme } from '@/theme/theme';
import type { Font } from '@/theme/theme';
import { Metric, noOutline, type IconName } from './base';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Controls — everything the finger lands on.
 *
 * GRADIENT DISCIPLINE. The brand gradient used to sit on every primary button and on
 * the FAB. That is precisely what made the app read as a template: the signature was
 * spent on the most repeated element in the product, so it stopped signifying anything.
 * Here `primary` and the FAB are SOLID `c.primary`. The gradient is rationed to the
 * clock-in ring and the active tab indicator, where it is the only one of its kind.
 *
 * FOREGROUND ON FILLED SURFACES is `c.onPrimary`, never white. In dark mode the azure
 * lifts to #5ba3f5 and danger lifts to #f87171 — white text on those fails contrast,
 * whereas `onPrimary` is the deep ink #04121f. One token, correct in both schemes.
 *
 * PRESS FEEDBACK is a real animation, not an opacity flicker: a 2.5% scale settle plus
 * an interpolated background shift, both on the panel's own bezier curves. Reduced
 * motion drops the scale but keeps the colour change, so the affordance survives.
 * ------------------------------------------------------------------ */

const EASE_SMOOTH = Easing.bezier(...motion.smooth.bezier);
const EASE_SPRING = Easing.bezier(...motion.spring.bezier);

/** Press-in is faster than press-out — the finger should feel caught, then released. */
const PRESS_IN = { duration: 90, easing: EASE_SMOOTH };
const PRESS_OUT = { duration: 220, easing: EASE_SPRING };
/** Selection travel. `motion.spring` overshoots slightly, which is what sells a pill slide. */
const SLIDE = { duration: motion.spring.duration, easing: EASE_SPRING };

/**
 * Alpha-suffix a palette hex. Every solid token is `#rrggbb`, so this stays derived from
 * the palette rather than inventing a colour. Non-hex tokens (glass, overlay) pass through.
 */
function alpha(hex: string, a: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const n = Math.round(Math.min(1, Math.max(0, a)) * 255);
  return hex + n.toString(16).padStart(2, '0');
}

/**
 * Shared press progress: 0 at rest, 1 held down. Returned raw so each control decides
 * what the progress drives (scale, background, both).
 */
function usePress() {
  const p = useSharedValue(0);
  return {
    p,
    onPressIn: () => { p.value = withTiming(1, PRESS_IN); },
    onPressOut: () => { p.value = withTiming(0, PRESS_OUT); },
  };
}

/* ------------------------------------------------------------------ *
 * Button
 *
 * Metrics (heights 38/48/54, padding, label sizes) are preserved verbatim — 39 screens
 * lay out against them, so they are constants here rather than re-derived from the
 * spacing scale.
 * ------------------------------------------------------------------ */

export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp' | 'outline';

const BTN_H = { sm: 38, md: 48, lg: 54 } as const;
const BTN_PX = { sm: 14, md: 18, lg: 18 } as const;
/* Font never scales under density (font ×1.0), but the label size is still READ off the theme
 * scale rather than copied — a helper over `c.font`, the same treatment `data.tsx`'s `pillFs`
 * gave its module-scope `PILL_FS` const, so the static import can be dropped from this module. */
const btnFs = (f: Font) => ({ sm: 13.5, md: f.body, lg: f.body }) as const;
const BTN_ICON = { sm: 16, md: 18, lg: 18 } as const;
/** `sm` is 38pt tall by design; slop makes the real target 44. */
const SM_SLOP = { top: 3, bottom: 3, left: 0, right: 0 };

export function Button({
  label, onPress, variant = 'primary', icon, loading, disabled, style, size = 'md', full,
  iconRight, onLongPress,
}: {
  label: string; onPress?: () => void; variant?: BtnVariant; icon?: IconName; loading?: boolean;
  disabled?: boolean; style?: StyleProp<ViewStyle>; size?: 'sm' | 'md' | 'lg'; full?: boolean;
  /** Optional trailing glyph — chevrons, external-link marks. */
  iconRight?: IconName;
  onLongPress?: () => void;
}) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  const reduced = useReducedMotion();
  const { p, onPressIn, onPressOut } = usePress();

  const h = BTN_H[size];
  const px = BTN_PX[size];
  const fs = btnFs(font)[size];
  const iconSz = BTN_ICON[size];

  // rest / pressed background per variant. Pressed is always a real colour step, so the
  // state survives reduced motion and reads on a slow LCD.
  const v: { rest: string; press: string; fg: string; border?: string; raised?: boolean } =
    variant === 'primary' ? { rest: c.primary, press: c.primaryDark, fg: c.onPrimary, raised: true }
    : variant === 'secondary' ? { rest: c.primarySoft, press: alpha(c.primary, 0.22), fg: c.primary }
    : variant === 'ghost' ? { rest: alpha(c.primary, 0), press: alpha(c.primary, 0.14), fg: c.primary }
    : variant === 'danger' ? { rest: c.danger, press: alpha(c.danger, 0.82), fg: c.onPrimary }
    : variant === 'whatsapp' ? { rest: c.whatsapp, press: alpha(c.whatsapp, 0.82), fg: c.onPrimary }
    : { rest: c.card, press: c.cardAlt, fg: c.text, border: c.border };

  const anim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [v.rest, v.press]),
    transform: [{ scale: reduced ? 1 : 1 - 0.025 * p.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          alignSelf: full ? 'stretch' : 'auto',
          borderRadius: radius.md,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: disabled ? 0.5 : 1,
          ...(v.raised ? shadow(c, 1) : null),
        },
        style,
        // Animated last: it owns backgroundColor and transform and must not be overridden
        // by a caller's layout style.
        anim,
      ]}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        hitSlop={size === 'sm' ? SM_SLOP : undefined}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        style={{
          // Border lives on the outer Animated.View (it must sit outside the animated
          // background), and Yoga adds border OUTSIDE the content box — so a bordered
          // variant would measure h+2 overall. Subtracting the 2px here keeps every
          // variant's outer box at exactly h, preserving the documented 38/48/54 metrics.
          height: v.border ? h - 2 : h,
          paddingHorizontal: px, borderRadius: radius.md,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        }}
      >
        {loading ? <ActivityIndicator color={v.fg} size="small" /> : (
          <>
            {icon ? <Ionicons name={icon} size={iconSz} color={v.fg} /> : null}
            <Text numberOfLines={1}
              style={{ color: v.fg, ...type('700', fs), letterSpacing: 0.2, flexShrink: 1 }}>
              {label}
            </Text>
            {iconRight ? <Ionicons name={iconRight} size={iconSz} color={v.fg} /> : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ---------- IconBtn ---------- */
export function IconBtn({ icon, onPress, color, bg, size = 40, disabled, accessibilityLabel }: {
  icon: IconName; onPress?: () => void; color?: string; bg?: string; size?: number;
  disabled?: boolean;
  /**
   * Icon-only controls are invisible to a screen reader without this. Falls back to the
   * icon name, which reads poorly ("logo whatsapp") but is far better than an unlabelled
   * "button" — every call site currently omits it, so a silent optional was announcing
   * eight anonymous buttons.
   */
  accessibilityLabel?: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      // Slop keeps the real target at 44 even for the 36pt buttons used in chat headers.
      hitSlop={Math.max(8, Math.ceil((44 - size) / 2))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? String(icon).replace(/-/g, ' ')}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [{
        width: size, height: size, borderRadius: size / 2.6,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: bg ?? c.cardAlt,
        opacity: disabled ? 0.4 : pressed ? 0.62 : 1,
        transform: [{ scale: pressed ? 0.93 : 1 }],
      }]}
    >
      <Ionicons name={icon} size={size * 0.5} color={color ?? c.text} />
    </Pressable>
  );
}

/* ---------- Fab ---------- */
const FAB_H = 56;

export function Fab({ icon, onPress, label, style, disabled }: {
  icon: IconName; onPress?: () => void; label?: string;
  style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const c = useTheme();
  const t = useT();
  const { spacing, radius, font } = c;
  const reduced = useReducedMotion();
  const { p, onPressIn, onPressOut } = usePress();

  const anim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [c.primary, c.primaryDark]),
    transform: [{ scale: reduced ? 1 : 1 - 0.04 * p.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute', right: spacing.lg, bottom: spacing.xl,
          borderRadius: radius.xxl, opacity: disabled ? 0.5 : 1, ...shadow(c, 2),
        },
        style,
        anim,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? t('common.add')}
        style={{
          height: FAB_H, width: label ? undefined : FAB_H,
          paddingHorizontal: label ? spacing.xxl : 0,
          borderRadius: radius.xxl,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        }}
      >
        <Ionicons name={icon} size={24} color={c.onPrimary} />
        {label ? (
          <Text numberOfLines={1} style={{ color: c.onPrimary, ...type('800', font.body) }}>
            {label}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/* ---------- Chips (multi-select-looking single select, wraps) ---------- */
const CHIP_H = 36;
/** Row gap is 8, so 4pt of vertical slop reaches 44 without stealing the neighbour's taps. */
const CHIP_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

export function Chips<T extends string>({ options, value, onChange, style }: {
  options: { key: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            hitSlop={CHIP_SLOP}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [{
              paddingHorizontal: 14, height: CHIP_H, borderRadius: radius.pill,
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
              backgroundColor: active ? c.primary : c.card,
              borderWidth: 1, borderColor: active ? c.primary : c.border,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }]}
          >
            <Text numberOfLines={1}
              style={{ color: active ? c.onPrimary : c.muted, ...type('700', font.sub) }}>
              {o.label}
            </Text>
            {o.count != null && (
              <View style={{
                backgroundColor: active ? alpha(c.onPrimary, 0.22) : c.cardAlt,
                borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1,
              }}>
                <Text style={{ color: active ? c.onPrimary : c.muted, ...type('800', 11), ...tnum }}>
                  {o.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Segmented — one exclusive choice out of 2–4, with a pill that travels.
 *
 * Each option reports its own frame via onLayout rather than assuming equal thirds, so
 * the pill tracks content-sized segments as faithfully as stretched ones. The first
 * measurement is applied without animation: sliding in from x=0 on mount reads as a
 * glitch, not as motion.
 * ------------------------------------------------------------------ */

const SEG_H = 36;   // + 2 × spacing.xs track padding = a 44pt control

export function Segmented<T extends string>({ options, value, onChange, full, style }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { spacing, radius, font } = c;
  const reduced = useReducedMotion();

  const found = options.findIndex((o) => o.key === value);
  const idx = found < 0 ? 0 : found;

  const [boxes, setBoxes] = useState<Array<{ x: number; w: number } | undefined>>([]);
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const settled = useRef(false);

  const box = boxes[idx];
  const bx = box?.x ?? 0;
  const bw = box?.w ?? 0;

  useEffect(() => {
    if (bw === 0) return;               // not measured yet
    if (!settled.current || reduced) {
      x.value = bx; w.value = bw; settled.current = true; return;
    }
    x.value = withTiming(bx, SLIDE);
    w.value = withTiming(bw, SLIDE);
  }, [bx, bw, reduced, x, w]);

  const measure = (i: number) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setBoxes((prev) => {
      const cur = prev[i];
      // Bail on no-op layout passes — setState inside onLayout otherwise loops.
      if (cur && Math.abs(cur.x - lx) < 0.5 && Math.abs(cur.w - width) < 0.5) return prev;
      const next = prev.slice();
      next[i] = { x: lx, w: width };
      return next;
    });
  };

  const pill = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }] }));

  return (
    <View style={[{
      alignSelf: full ? 'stretch' : 'flex-start',
      backgroundColor: c.cardAlt, borderRadius: radius.pill, padding: spacing.xs,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    }, style]}>
      <View style={{ flexDirection: 'row' }}>
        <Animated.View
          pointerEvents="none"
          style={[{
            position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill,
            backgroundColor: c.card, ...shadow(c, 1),
          }, pill]}
        />
        {options.map((o, i) => {
          const active = i === idx;
          return (
            <Pressable
              key={o.key}
              onLayout={measure(i)}
              onPress={() => onChange(o.key)}
              hitSlop={{ top: spacing.xs, bottom: spacing.xs }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [{
                flex: full ? 1 : undefined,
                height: SEG_H, minWidth: 66, paddingHorizontal: spacing.lg,
                alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill,
                opacity: pressed ? 0.55 : 1,
              }]}
            >
              <Text numberOfLines={1}
                style={{ color: active ? c.text : c.muted, ...type(active ? '700' : '600', font.sub) }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Stepper — small integers, thumb-driven.
 *
 * Tap steps once; hold repeats. The repeat reads the latest value from a ref because the
 * interval outlives the render that started it and would otherwise fight a stale prop.
 * ------------------------------------------------------------------ */

const STEP_BTN = 44;

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, style, format, disabled }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
  style?: StyleProp<ViewStyle>;
  /** Render the readout as something other than a bare integer ("3 yrs", "₹5,000"). */
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const c = useTheme();
  const t = useT();
  const { spacing, radius, font } = c;
  const reduced = useReducedMotion();

  const latest = useRef(value);
  latest.current = value;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(false);

  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  useEffect(() => stop, []);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const nudge = (dir: 1 | -1) => {
    const next = clamp(latest.current + dir * step);
    if (next === latest.current) { stop(); return; }   // hit the rail — stop repeating
    latest.current = next;
    onChange(next);
  };
  const hold = (dir: 1 | -1) => { stop(); timer.current = setInterval(() => nudge(dir), 110); };

  // A short pop on the readout confirms the change without needing a colour flash.
  const bump = useSharedValue(1);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (reduced) return;
    bump.value = withSequence(withTiming(1.1, PRESS_IN), withTiming(1, PRESS_OUT));
  }, [value, reduced, bump]);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  const atMin = value <= min;
  const atMax = value >= max;

  const btn = (dir: 1 | -1, icon: IconName, off: boolean) => (
    <Pressable
      onPress={() => nudge(dir)}
      onLongPress={() => hold(dir)}
      onPressOut={stop}
      disabled={disabled || off}
      accessibilityRole="button"
      accessibilityLabel={dir > 0 ? t('common.increase') : t('common.decrease')}
      accessibilityState={{ disabled: disabled || off }}
      style={({ pressed }) => [{
        width: STEP_BTN, height: STEP_BTN, borderRadius: radius.pill,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? c.primarySoft : 'transparent',
        opacity: off ? 0.3 : 1,
      }]}
    >
      <Ionicons name={icon} size={20} color={c.primary} />
    </Pressable>
  );

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      style={[{
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: c.card, borderRadius: radius.pill,
        borderWidth: 1, borderColor: c.border, opacity: disabled ? 0.5 : 1,
      }, style]}
    >
      {btn(-1, 'remove', atMin)}
      <Animated.View style={[{
        minWidth: 54, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: radius.sm, backgroundColor: c.cardAlt, alignItems: 'center',
      }, bumpStyle]}>
        <Metric value={format ? format(value) : String(value)} size={font.h3} />
      </Animated.View>
      {btn(1, 'add', atMax)}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * SearchBar / Field
 *
 * Both grow a primary-coloured border on focus. That is the only focus affordance an
 * Android text field gets for free — nothing — so it has to be explicit here.
 * ------------------------------------------------------------------ */

const INPUT_H = 48;
const FIELD_H = 50;
const FIELD_MULTILINE_H = 92;

export const SearchBar = React.forwardRef(function SearchBar({ value, onChange, placeholder, autoFocus, onSubmit, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
  onSubmit?: () => void; style?: StyleProp<ViewStyle>;
}, ref: React.ForwardedRef<TextInput>) {
  const c = useTheme();
  const t = useT();
  const { spacing, radius, font } = c;
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: c.card, borderRadius: radius.md, paddingHorizontal: 14,
      height: INPUT_H, borderWidth: 1, borderColor: focused ? c.primary : c.border,
    }, style]}>
      <Ionicons name="search" size={18} color={focused ? c.primary : c.faint} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        // Names and policy numbers: autocorrect actively fights the user here.
        autoCorrect={false}
        autoCapitalize="none"
        // tnum unconditionally: this is the "by name or number" field on clients.tsx and
        // claim-new.tsx, so a query is as likely to be a policy or phone number as a name.
        // Tabular figures are a no-op on text that has no digits, so names are unaffected.
        style={[{ flex: 1, color: c.text, ...type('500', font.body), ...tnum, paddingVertical: 0 }, noOutline]}
      />
      {/* hitSlop 13, not 12: an 18pt glyph reaches only 42pt at 12 and the floor is 44. */}
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={13}
          accessibilityRole="button" accessibilityLabel={t('common.clearSearch')}
          style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
          <Ionicons name="close-circle" size={18} color={c.faint} />
        </Pressable>
      )}
    </View>
  );
});

export const Field = React.forwardRef(function Field({
  label, value, onChange, placeholder, keyboardType, multiline, secure,
  hint, error, icon, autoFocus, maxLength, autoCapitalize,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address'; multiline?: boolean; secure?: boolean;
  /** Helper copy under the input. Suppressed while `error` is showing. */
  hint?: string;
  error?: string;
  icon?: IconName;
  autoFocus?: boolean;
  maxLength?: number;
  /**
   * Android capitalises the first letter by default, which silently corrupts an email or a
   * username the moment the user types it. Any field that accepts an identifier must pass
   * 'none'.
   */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}, ref: React.ForwardedRef<TextInput>) {
  const c = useTheme();
  const t = useT();
  const { spacing, radius, font } = c;
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const numeric = keyboardType === 'numeric' || keyboardType === 'phone-pad';
  const border = error ? c.danger : focused ? c.primary : c.border;

  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: error ? c.danger : c.muted, ...type('700', font.sub) }} numberOfLines={1}>
        {label}
      </Text>

      <View style={{
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: spacing.sm,
        backgroundColor: c.card, borderWidth: 1, borderColor: border, borderRadius: radius.md,
        paddingHorizontal: 15,
        height: multiline ? FIELD_MULTILINE_H : FIELD_H,
        paddingVertical: multiline ? 12 : 0,
      }}>
        {icon ? (
          <Ionicons name={icon} size={18} color={focused ? c.primary : c.faint}
            style={{ marginTop: multiline ? 2 : 0 }} />
        ) : null}

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={c.faint}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secure && !revealed}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Sentence-casing an email address or a password is a bug, not a nicety. An explicit
          // `autoCapitalize` from the caller wins, because a field can accept an identifier
          // (email OR phone) without declaring an email keyboard type.
          autoCapitalize={autoCapitalize ?? (secure || keyboardType === 'email-address' ? 'none' : 'sentences')}
          autoCorrect={autoCapitalize === 'none' ? false : (!secure && keyboardType !== 'email-address')}
          style={[
            {
              flex: 1, color: c.text, ...type('500', font.body),
              paddingVertical: 0,
              textAlignVertical: multiline ? 'top' : 'center',
              // Amounts, ages and phone numbers align down a form when they're tabular.
              ...(numeric ? tnum : null),
            },
            noOutline,
          ]}
        />

        {/* hitSlop 13: a 19pt glyph reaches 43pt at 12, one point under the 44 floor. */}
        {secure ? (
          <Pressable onPress={() => setRevealed((r) => !r)} hitSlop={13}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
            <Ionicons name={revealed ? 'eye-off' : 'eye'} size={19} color={c.faint} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={{ color: c.danger, ...type('500', font.cap) }} numberOfLines={2}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: c.faint, ...type('400', font.cap) }} numberOfLines={2}>{hint}</Text>
      ) : null}
    </View>
  );
});
